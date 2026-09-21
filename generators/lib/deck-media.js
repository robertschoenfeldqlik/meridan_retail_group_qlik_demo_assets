// ---------------------------------------------------------------------------
//  deck-media.js
//  Shared screenshot plumbing for the deck and document generators.
//
//  Two jobs:
//    1. resolveShot()    — map a screenshot placeholder description (or a slug)
//                          to a captured PNG under assets/screenshots/.
//    2. screenshotCard() — drop a screenshot onto a pptxgenjs slide, framed and
//                          captioned to match the existing deck visual system.
//
//  This lives in one module on purpose: iconBadge() is copy-pasted verbatim
//  into four deck generators, and repeating that mistake for screenshots would
//  mean fixing aspect-ratio bugs in four places.
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');

const GEN_DIR  = path.join(__dirname, '..');
const SHOT_DIR = path.join(GEN_DIR, 'assets', 'screenshots');
const MANIFEST = path.join(GEN_DIR, 'screenshots.json');

// ---------------------------------------------------------------------------
//  Resolution
// ---------------------------------------------------------------------------

let _manifest = null;
function manifest() {
  if (_manifest) return _manifest;
  try {
    _manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));
  } catch (_) {
    _manifest = { shots: [] };
  }
  return _manifest;
}

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Resolve a slug, or one of the existing `screenshot("...")` description
 * strings, to a captured PNG path.
 *
 * Matching is substring-on-normalized-text in both directions, because the
 * manifest's `placeholder` is deliberately a shortened form of the long
 * descriptions already written into the guides — that way the 31 existing call
 * sites never have to change.
 *
 * @returns {{path: string, caption: string, slug: string}|null}
 */
function resolveShot(descriptionOrSlug) {
  const shots = manifest().shots || [];
  const want = normalize(descriptionOrSlug);
  if (!want) return null;

  let hit = shots.find((s) => s.slug === descriptionOrSlug);

  if (!hit) {
    // Longest placeholder wins, so a specific entry beats a generic one that
    // happens to share a prefix.
    const candidates = shots
      .filter((s) => {
        const p = normalize(s.placeholder);
        return p && (want.includes(p) || p.includes(want));
      })
      .sort((a, b) => normalize(b.placeholder).length - normalize(a.placeholder).length);
    hit = candidates[0];
  }
  if (!hit) return null;

  const p = path.join(SHOT_DIR, hit.slug + '.png');
  if (!fs.existsSync(p)) return null;
  return { path: p, caption: hit.caption || '', slug: hit.slug };
}

/** True if any screenshots have been captured at all. */
function haveShots() {
  return fs.existsSync(SHOT_DIR) && fs.readdirSync(SHOT_DIR).some((f) => f.endsWith('.png'));
}

// ---------------------------------------------------------------------------
//  Image dimensions
// ---------------------------------------------------------------------------

/**
 * Read a PNG's pixel dimensions from its IHDR chunk.
 *
 * This matters more than it looks: iconBadge() places images with w === h and
 * gets away with it only because render-icons.js forces every icon to a square
 * 256x256. A screenshot is not square, so its height MUST come from the real
 * file or it renders stretched.
 */
function pngSize(pngPath) {
  try {
    const fd = fs.openSync(pngPath, 'r');
    const buf = Buffer.alloc(24);
    fs.readSync(fd, buf, 0, 24, 0);
    fs.closeSync(fd);
    if (buf.readUInt32BE(0) === 0x89504e47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
  } catch (_) { /* fall through */ }
  return null;
}

/** Height in inches for a given width, preserving the file's true aspect. */
function heightFor(pngPath, w) {
  const s = pngSize(pngPath);
  return s ? w * (s.height / s.width) : w * 0.5625; // 16:9 fallback
}

// ---------------------------------------------------------------------------
//  PPTX
// ---------------------------------------------------------------------------

/**
 * Place a screenshot on a slide: soft frame, thin border, caption underneath.
 * Composed the same way iconCard() composes iconBadge with a rounded rect, so
 * it sits inside the existing visual system rather than looking pasted on.
 *
 * @param {object} pptx    the PptxGenJS instance (needed for pptx.shapes)
 * @param {object} slide   target slide
 * @param {string} png     absolute path to the screenshot
 * @param {object} opts    { x, y, w, caption, colors, maxH }
 * @returns {number} the total height consumed, in inches (0 if nothing drawn)
 */
function screenshotCard(pptx, slide, png, opts = {}) {
  if (!png || !fs.existsSync(png)) return 0; // degrade silently, as icons do

  const C = opts.colors || {};
  const x = opts.x != null ? opts.x : 1.0;
  const y = opts.y != null ? opts.y : 1.6;
  let w = opts.w != null ? opts.w : 8.0;
  let h = heightFor(png, w);

  // Respect a height budget by shrinking width rather than squashing.
  if (opts.maxH && h > opts.maxH) {
    w = w * (opts.maxH / h);
    h = opts.maxH;
  }

  const pad = 0.08;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: x - pad, y: y - pad, w: w + pad * 2, h: h + pad * 2,
    fill: { color: C.white || 'FFFFFF' },
    line: { color: C.qlikGray || 'D6D9DE', width: 1 },
    rectRadius: 0.04,
    shadow: { type: 'outer', blur: 6, offset: 2, color: '000000', opacity: 0.18 },
  });
  slide.addImage({ path: png, x, y, w, h });

  let used = h + pad * 2;
  if (opts.caption) {
    slide.addText(opts.caption, {
      x: x - pad, y: y + h + pad + 0.06, w: w + pad * 2, h: 0.3,
      fontFace: 'Inter', fontSize: 10, italic: true,
      color: C.medGray || '6B7280', align: 'center', valign: 'top',
    });
    used += 0.36;
  }
  return used;
}

/**
 * Convenience: resolve by slug and place in one call. Returns 0 when the shot
 * has not been captured, so callers can decide whether to draw a fallback.
 */
function screenshotBySlug(pptx, slide, slug, opts = {}) {
  const hit = resolveShot(slug);
  if (!hit) return 0;
  return screenshotCard(pptx, slide, hit.path, {
    caption: opts.caption !== undefined ? opts.caption : hit.caption,
    ...opts,
  });
}

module.exports = {
  SHOT_DIR,
  resolveShot, haveShots,
  pngSize, heightFor,
  screenshotCard, screenshotBySlug,
};
