#!/usr/bin/env node
// ---------------------------------------------------------------------------
//  capture-tenant-screenshots.js
//  Captures the live-tenant screenshots that the guides, demo scripts and decks
//  embed, driven by generators/screenshots.json.
//
//  Why this is separate from capture-mockups.js: that one shoots local
//  file:/// mockups and needs no session. These screens are behind a Qlik Cloud
//  login, so the browser has to be authenticated. It uses a PERSISTENT Chrome
//  profile (generators/.chrome-profile, gitignored) — you sign in once, and
//  every later run reuses the cookies headlessly.
//
//  Usage:
//    node generators/capture-tenant-screenshots.js --login    # one-time sign-in
//    node generators/capture-tenant-screenshots.js            # capture all
//    node generators/capture-tenant-screenshots.js --only stewardship-sprints,di-home
//    node generators/capture-tenant-screenshots.js --report   # coverage only, no browser
//    node generators/capture-tenant-screenshots.js --headful  # watch it run
//
//  Deliberately NOT registered in generate-all.js: that runs generators as
//  headless child processes on a 120s timeout, and a login-gated browser
//  capture does not belong in that path. Screenshots are committed assets;
//  refresh them with this script when the tenant changes.
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');

const GEN_DIR      = __dirname;
const MANIFEST     = path.join(GEN_DIR, 'screenshots.json');
const OUT_DIR      = path.join(GEN_DIR, 'assets', 'screenshots');
const PROFILE_DIR  = path.join(GEN_DIR, '.chrome-profile');

const argv    = process.argv.slice(2);
const has     = (f) => argv.includes(f);
const val     = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const doLogin = has('--login');
const headful = has('--headful') || doLogin;
const only    = (val('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);

// ---------------------------------------------------------------------------
//  Manifest
// ---------------------------------------------------------------------------

if (!fs.existsSync(MANIFEST)) {
  console.error('No manifest at ' + MANIFEST);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));
const shots = (manifest.shots || []).filter((s) => !only.length || only.includes(s.slug));

function pngPath(slug) {
  return path.join(OUT_DIR, slug + '.png');
}

/**
 * Is this URL a sign-in page rather than tenant content?
 *
 * Deliberately narrow: matching a bare /auth/ or the word "login" anywhere would
 * also match legitimate tenant routes, so anchor on the identity hosts and the
 * Qlik login path.
 */
function isLoginUrl(u) {
  return /accounts\.qlik|login\.qlik|\/login(\?|$|\/)|auth0\.com|okta\.com|microsoftonline\.com/i.test(u || '');
}

function resolveUrl(shot) {
  if (!shot.url) return '';
  if (/^https?:\/\//i.test(shot.url)) return shot.url;
  return (manifest.tenantUrl || '').replace(/\/$/, '') + shot.url;
}

// ---------------------------------------------------------------------------
//  Coverage report — what the generators will actually be able to embed
// ---------------------------------------------------------------------------

function report() {
  const have = [], missing = [], skipped = [];
  for (const s of manifest.shots || []) {
    if (s.skip) skipped.push(s);
    else if (fs.existsSync(pngPath(s.slug))) have.push(s);
    else missing.push(s);
  }
  const w = 32;
  console.log('\nScreenshot coverage\n');
  for (const s of have) {
    const kb = (fs.statSync(pngPath(s.slug)).size / 1024).toFixed(0);
    console.log('  [ok]   ' + s.slug.padEnd(w) + kb + ' KB');
  }
  for (const s of missing) console.log('  [--]   ' + s.slug.padEnd(w) + 'not captured yet');
  for (const s of skipped) console.log('  [skip] ' + s.slug.padEnd(w) + (s.skipReason || ''));
  console.log('\n  ' + have.length + ' captured, ' + missing.length + ' missing, ' +
              skipped.length + ' skipped (of ' + (manifest.shots || []).length + ')');
  console.log('  Missing and skipped shots keep their original text callout in the generated docs.\n');
  return { have, missing, skipped };
}

if (has('--report')) { report(); process.exit(0); }

// ---------------------------------------------------------------------------
//  Readiness
// ---------------------------------------------------------------------------

/**
 * Wait until the page has actually rendered something.
 *
 * Qlik Cloud is a slow-booting micro-frontend shell: domcontentloaded fires
 * almost immediately, and a fixed sleep reliably captures the loading spinner
 * (an 8 KB near-white PNG) while reporting success. So poll for real content
 * instead — meaningful text, a stable DOM, and no visible progressbar.
 */
async function waitForRender(page, cfg) {
  const budget = cfg.renderTimeoutMs || 30000;
  const minText = cfg.minTextLength || 200;
  const started = Date.now();
  let lastLen = -1, stableFor = 0;

  while (Date.now() - started < budget) {
    const state = await page.evaluate(() => {
      const txt = (document.body && document.body.innerText || '').trim();
      const spinner = document.querySelector(
        '[role="progressbar"], .lui-fade, [class*="spinner" i], [class*="loading" i]'
      );
      return { len: txt.length, spinner: !!spinner };
    }).catch(() => ({ len: 0, spinner: true }));

    if (state.len >= minText && !state.spinner) {
      // Text is present and nothing is visibly loading — let it settle, then go.
      if (state.len === lastLen) {
        stableFor += 500;
        if (stableFor >= 1000) break;
      } else {
        stableFor = 0;
      }
      lastLen = state.len;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  // Final paint settle for fonts/charts.
  await new Promise((r) => setTimeout(r, cfg.settleMs || 2500));
}

/**
 * Reject a capture that is blank or near-uniform.
 *
 * Silently writing a spinner frame and calling it "ok" is worse than failing:
 * the generators embed it and the deck ships a white rectangle. File size on a
 * PNG of a flat page is a good enough proxy — a real Qlik screen is 60 KB+,
 * a spinner is under 15 KB.
 */
function looksBlank(pngFile, cfg) {
  try {
    const bytes = fs.statSync(pngFile).size;
    return bytes < (cfg.minBytes || 25000);
  } catch (_) {
    return true;
  }
}

// ---------------------------------------------------------------------------
//  Capture
// ---------------------------------------------------------------------------

(async () => {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (_) {
    console.error('puppeteer is not installed. It is a devDependency: npm install');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const vp = manifest.viewport || { width: 1600, height: 1000 };

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: headful ? false : 'new',
      userDataDir: PROFILE_DIR,          // <- the whole point: cookies survive runs
      defaultViewport: vp,
      args: ['--no-sandbox', '--disable-setuid-sandbox', `--window-size=${vp.width},${vp.height + 120}`],
    });
  } catch (e) {
    if (/profile|lock|SingletonLock|already running/i.test(e.message)) {
      console.error('\nCould not open generators/.chrome-profile - it is still in use.');
      console.error('Close the Chrome window left open by --login, then re-run.\n');
      process.exit(1);
    }
    throw e;
  }

  try {
    const page = (await browser.pages())[0] || (await browser.newPage());
    await page.setViewport(vp);

    if (doLogin) {
      const url = (manifest.tenantUrl || '').replace(/\/$/, '') + '/data-integration/home';
      console.log('\nOpening ' + url);
      console.log('Sign in to Qlik Cloud in the window that just opened.');
      console.log('The session is saved to generators/.chrome-profile and reused by later runs.');
      console.log('This waits for sign-in to complete and then closes by itself.\n');
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

      // Poll for a signed-in tenant page rather than waiting on stdin. `npm run`
      // does not give this script a TTY, so process.stdin.once('data') resolved
      // instantly and slammed the window shut before anyone could type — which
      // is exactly why the profile came back unauthenticated.
      const deadline = Date.now() + (10 * 60 * 1000);
      let signedIn = false;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        let here = '';
        try { here = page.url(); } catch (_) { break; } // window closed by hand
        if (isLoginUrl(here)) { process.stdout.write('.'); continue; }

        const ready = await page.evaluate(() => {
          const t = (document.body && document.body.innerText || '').trim();
          return t.length > 200;
        }).catch(() => false);

        if (ready) { signedIn = true; break; }
        process.stdout.write('.');
      }

      console.log('');
      if (signedIn) {
        // Give Chrome a moment to flush cookies to the profile before exiting.
        await new Promise((r) => setTimeout(r, 3000));
        console.log('Signed in - session saved to generators/.chrome-profile');
        console.log('Now run:  npm run screenshots');
      } else {
        console.log('Timed out waiting for sign-in. Nothing was saved; re-run when ready.');
      }
      await browser.close();
      return;
    }

    let ok = 0, failed = 0, skipped = 0, authFailed = false;

    for (const shot of shots) {
      if (shot.skip) {
        console.log('  [skip] ' + shot.slug + ' — ' + (shot.skipReason || 'marked skip'));
        skipped++;
        continue;
      }
      const url = resolveUrl(shot);
      if (!url) { console.log('  [skip] ' + shot.slug + ' — no url'); skipped++; continue; }

      try {
        // networkidle0 never settles on Qlik Cloud (polling + websockets), so
        // wait for the DOM, then wait for the SPA to actually RENDER. A fixed
        // sleep is not enough — Qlik's micro-frontend shell boots slowly and a
        // short timer captures its loading spinner instead of the page.
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        if (shot.waitFor) {
          await page.waitForSelector(shot.waitFor, { timeout: 20000 }).catch(() => {});
        }
        await waitForRender(page, manifest);

        // Optional: click a nav item by visible text before shooting (used by
        // the deploy-console wizard pages, which are all one URL).
        if (shot.clickNav) {
          await page.evaluate((label) => {
            const els = Array.from(document.querySelectorAll('button, a'));
            const hit = els.find((e) => (e.textContent || '').trim().includes(label));
            if (hit) hit.click();
          }, shot.clickNav);
          await new Promise((r) => setTimeout(r, 1200));
        }

        // A login redirect means the saved session expired.
        const landed = page.url();
        if (isLoginUrl(landed) && !/localhost/.test(url)) {
          console.log('  [auth] ' + shot.slug + ' - landed on ' + landed.split('?')[0]);
          console.log('         The saved session is not valid. Re-run: npm run screenshots:login');
          failed++;
          authFailed = true;
          break;   // every other shot will fail the same way
        }

        const out = pngPath(shot.slug);
        await page.screenshot({ path: out, fullPage: false });

        if (looksBlank(out, manifest)) {
          // Don't leave a spinner frame on disk for the generators to embed.
          try { fs.unlinkSync(out); } catch (_) {}
          console.log('  [blank] ' + shot.slug + ' - page never finished rendering; discarded');
          failed++;
          continue;
        }
        console.log('  [ok]   ' + shot.slug + '  (' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB)');
        ok++;
      } catch (e) {
        console.log('  [fail] ' + shot.slug + ' — ' + e.message.split('\n')[0]);
        failed++;
      }
    }

    console.log('\n' + ok + ' captured, ' + failed + ' failed, ' + skipped + ' skipped');
  } finally {
    await browser.close();
  }

  report();
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
