#!/usr/bin/env node
/**
 * fix-null-measures.js — repair chart measures that try to count NULLs with
 * set analysis, and audit every KPI for a silent zero.
 * ============================================================================
 * Qlik set analysis cannot select NULL. An expression like
 *
 *     Count({<[Weight (kg)] -= {"*"}>} [SKU])
 *
 * reads as "SKUs whose weight is not any value", which looks like a null test
 * and is in fact an empty set — it returns 0, always, with no error. The KPI
 * "SKUs With No Weight" on the Product Data Quality sheet read 0 while the
 * underlying data held 8,200 of them and the narration quoted that number.
 *
 * Two things make the obvious repair wrong here, both established by evaluating
 * against the live app rather than reasoning about it:
 *
 *   Count([SKU])            = 49114, not 25000 — SKU is a key field spanning
 *                             several tables, so it is not a row count.
 *   NullCount([Weight (kg)]) = 0     — the gaps survive the CSV -> QVD round
 *                             trip as EMPTY STRINGS, not NULLs, so every
 *                             null-based test reports nothing missing.
 *
 * The form that actually returns 8,200 tests the text length, which is true for
 * both an empty string and a NULL:
 *
 *     Sum(If(Len(Trim([Weight (kg)])) = 0 or [Weight (kg)] = 0, 1, 0))
 *
 * The sheets were authored straight into the tenant (config `apps.sheetsViaMcp`),
 * so there is no local source to regenerate — the fix has to be applied to the
 * live objects through the Engine API.
 *
 * Usage:
 *   node deploy/fix-null-measures.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const WebSocket = require('ws');

const CFG_PATH = path.join(__dirname, 'config.json');
if (!fs.existsSync(CFG_PATH)) {
  console.error(`No deploy/config.json. Copy config.example.json to config.json and fill in your tenant first.`);
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
const BASE = `https://${cfg.tenant.hostname}.${cfg.tenant.region}`;
const TOKEN = cfg.auth.apiKey;
const DRY = process.argv.includes('--dry-run');

// Apps are resolved BY NAME at run time. They used to be two hardcoded GUIDs,
// which meant this script only ever worked on the tenant it was written against
// — every other deployment of this repo gets different app ids.
const APP_NAMES = [
  'MCG Supply Chain Operations',
  'MCG Delivery & Customer Experience',
];

// Rewrites keyed by the exact broken expression. Each entry says what the
// author meant, so a future reader can tell a fix from a guess.
const REWRITES = [
  {
    // The first repair attempt, which was itself wrong: Count([SKU]) counts a
    // key field across the whole model (49114), not the product rows (25000).
    match: /Count\(\[([^\]]+)\]\)\s*-\s*Count\(\{<\[([^\]]+)\]-=\{0\}>\}\s*\[\1\]\)/,
    build: (m) => `Sum(If(Len(Trim([${m[2]}])) = 0 or [${m[2]}] = 0, 1, 0))`,
    why: 'Count() on a key field is not a row count; test the value instead',
  },
  {
    // "rows where the field is 0" + "rows where the field is null".
    // The first half is real; the second is the impossible set.
    match: /Count\(\{<\[([^\]]+)\]=\{0\}>\}\s*\[([^\]]+)\]\)\s*\+\s*Count\(\{<\[\1\]-=\{"\*"\}>\}\s*\[\2\]\)/,
    build: (m) => `Count([${m[2]}]) - Count({<[${m[1]}]-={0}>} [${m[2]}])`,
    why: 'count of NULL or zero = total rows minus rows with a non-zero value',
  },
  {
    // Bare null-probe with nothing else in the set.
    match: /Count\(\{<\[([^\]]+)\]-=\{"\*"\}>\}\s*\[([^\]]+)\]\)/,
    build: (m) => `Sum(If(Len(Trim([${m[1]}])) = 0, 1, 0))`,
    why: 'count of missing, tested by text length so it catches empty strings as well as NULLs',
  },
];

function api(method, p, body) {
  return new Promise((resolve) => {
    const req = https.request(new URL(BASE + p), {
      method,
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    }, (r) => { let b = ''; r.on('data', (d) => (b += d)); r.on('end', () => resolve({ s: r.statusCode, b })); });
    req.on('error', (e) => resolve({ s: 0, b: e.message }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function engine(appId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`wss://${cfg.tenant.hostname}.${cfg.tenant.region}/app/${appId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    let msgId = 0;
    const pending = new Map();
    const fail = (e) => { for (const { reject: rj } of pending.values()) rj(e); pending.clear(); };
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve: rs, reject: rj } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rj(new Error(JSON.stringify(msg.error))) : rs(msg.result || msg);
      }
    });
    ws.on('error', (e) => { fail(e); reject(e); });
    ws.on('close', () => fail(new Error('engine socket closed')));
    ws.on('open', () => {
      const send = (handle, method, params = []) => new Promise((rs, rj) => {
        const id = ++msgId;
        pending.set(id, { resolve: rs, reject: rj });
        ws.send(JSON.stringify({ jsonrpc: '2.0', id, handle, method, params }));
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); rj(new Error(`RPC timeout: ${method}`)); } }, 30000);
      });
      resolve({ send, close: () => new Promise((rs) => { ws.on('close', rs); ws.close(); }) });
    });
  });
}

/**
 * Resolve an app name to its id on THIS tenant. /api/v1/items is the endpoint
 * the deployer already uses for dataset lookup, so it is known to exist here.
 */
async function resolveApp(name) {
  const res = await api('GET', `/api/v1/items?resourceType=app&name=${encodeURIComponent(name)}&limit=50`);
  if (res.s !== 200) return null;
  let data;
  try { data = JSON.parse(res.b).data || []; } catch (_) { return null; }
  const exact = data.find((d) => (d.name || d.resourceAttributes?.name) === name);
  const hit = exact || data[0];
  return hit ? (hit.resourceId || hit.id) : null;
}

(async () => {
  let fixed = 0;
  let audited = 0;
  const zeros = [];

  const APPS = [];
  for (const name of APP_NAMES) {
    const id = await resolveApp(name);
    if (!id) { console.error(`  SKIP "${name}" — no app of that name on ${cfg.tenant.hostname}`); continue; }
    APPS.push([name, id]);
  }
  if (!APPS.length) {
    console.error('No MCG apps found on this tenant. Run build-apps first.');
    process.exit(1);
  }

  for (const [appName, appId] of APPS) {
    console.log(`\n=== ${appName}`);
    // Per-app, so the second app is not saved just because the first changed.
    const fixedBefore = fixed;
    const ses = await engine(appId);
    const doc = (await ses.send(-1, 'OpenDoc', [appId])).qReturn.qHandle;

    // Enumerate sheets through the Engine, not REST: /api/v1/apps/{id}/objects
    // does not exist on this tenant (404).
    const slHandle = (await ses.send(doc, 'CreateSessionObject', [{
      qInfo: { qType: 'SheetList' },
      qAppObjectListDef: { qType: 'sheet', qData: { title: '/qMetaDef/title' } },
    }])).qReturn.qHandle;
    const slLayout = await ses.send(slHandle, 'GetLayout', []);
    const sheetIds = (slLayout.qLayout.qAppObjectList.qItems || []).map((i) => i.qInfo.qId);
    console.log(`  ${sheetIds.length} sheet(s)`);

    for (const sheetId of sheetIds) {
      const sh = (await ses.send(doc, 'GetObject', [sheetId])).qReturn.qHandle;
      const layout = await ses.send(sh, 'GetFullPropertyTree', []);
      const kids = (layout.qPropEntry && layout.qPropEntry.qChildren) || [];

      for (const kid of kids) {
        const childId = kid.qProperty.qInfo.qId;
        const ch = (await ses.send(doc, 'GetObject', [childId])).qReturn.qHandle;
        const prop = (await ses.send(ch, 'GetProperties', [])).qProp;
        const hc = prop.qHyperCubeDef;
        if (!hc || !hc.qMeasures) continue;

        let dirty = false;
        for (const meas of hc.qMeasures) {
          const def = meas.qDef && meas.qDef.qDef;
          if (!def) continue;
          audited++;
          for (const rule of REWRITES) {
            const m = rule.match.exec(def);
            if (!m) continue;
            const next = def.replace(rule.match, rule.build(m));
            console.log(`  FIX  ${prop.qInfo.qType} "${prop.title || childId}" / ${meas.qDef.qLabel || ''}`);
            console.log(`       was: ${def}`);
            console.log(`       now: ${next}`);
            console.log(`       why: ${rule.why}`);
            meas.qDef.qDef = next;
            dirty = true;
            fixed++;
            break;
          }
        }
        if (dirty && !DRY) {
          await ses.send(ch, 'SetProperties', [prop]);
        }

        // The audit the header promises: after any rewrite, read the object's
        // LAYOUT (not its properties) and look at what each measure actually
        // evaluates to. qMeasureInfo carries qMin/qMax for the rendered
        // hypercube, so a measure that is flat zero across every row is a
        // silent-zero KPI — the exact failure this script exists to catch.
        try {
          const lay = await ses.send(ch, 'GetLayout', []);
          const cube = lay && lay.qLayout && lay.qLayout.qHyperCube;
          const info = (cube && cube.qMeasureInfo) || [];
          info.forEach((mi, idx) => {
            const label = mi.qFallbackTitle || (hc.qMeasures[idx] && hc.qMeasures[idx].qDef.qLabel) || `measure ${idx}`;
            const allZero = mi.qMin === 0 && mi.qMax === 0;
            const noRows = cube && cube.qSize && cube.qSize.qcy === 0;
            if (allZero || noRows) {
              zeros.push(`${appName} / ${prop.title || prop.qInfo.qId} / ${label}`
                + (noRows ? ' (no rows)' : ' (min=max=0)'));
            }
          });
        } catch (err) {
          console.log(`  warn  could not read layout for "${prop.title || childId}": ${err.message}`);
        }
      }
    }

    if (!DRY && fixed > fixedBefore) await ses.send(doc, 'DoSave', []);
    await ses.close();
  }

  console.log(`\n${DRY ? 'DRY RUN — ' : ''}${fixed} measure(s) rewritten, ${audited} audited.`);
  if (zeros.length) {
    console.log(`\n${zeros.length} measure(s) still reading zero or returning no rows:`);
    zeros.forEach((z) => console.log('  ' + z));
    console.log('\nA zero here is usually a field name the load script renamed away.');
    console.log('Check it with:  node deploy/validate-app-fields.js');
    process.exitCode = 1;
  } else {
    console.log('No silent-zero measures found.');
  }
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
