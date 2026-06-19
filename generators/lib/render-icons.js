#!/usr/bin/env node
// =============================================================================
//  render-icons.js
//  Rasterizes every Qlik line-art SVG in generators/assets/icons/*.svg to a
//  square, transparent-background PNG of the same name. Square output means the
//  deck generators can place each icon with equal width/height — no aspect math,
//  no distortion (the glyph is centered with transparent padding).
//
//  Run standalone:  node generators/lib/render-icons.js
//  Also runs first in generate-all.js so PNGs stay in sync with the SVGs.
// =============================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ICON_DIR = path.join(__dirname, '..', 'assets', 'icons');
const SIZE = 256; // crisp at any slide size; export-safe

(async () => {
  const svgs = fs.readdirSync(ICON_DIR).filter(f => f.toLowerCase().endsWith('.svg'));
  let n = 0;
  for (const f of svgs) {
    const svg = fs.readFileSync(path.join(ICON_DIR, f));
    const out = path.join(ICON_DIR, f.replace(/\.svg$/i, '.png'));
    const buf = await sharp(svg, { density: 300 })
      .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    fs.writeFileSync(out, buf);
    n++;
  }
  console.log(`  ✓ Rendered ${n} line-art icons → assets/icons/*.png`);
})().catch(err => { console.error('ERROR rendering icons:', err); process.exit(1); });
