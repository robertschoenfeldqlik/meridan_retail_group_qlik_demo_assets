// One-off: swap the SoR and Data Integration columns in MCG_Marketecture.pptx
// (sources -> integration -> system of record). Post-processes the BUILT file;
// the skill's build script is untouched.
const { unzipToDirectory, zipDirectory } = require('./zip-utils');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EMU = 914400;
const SRC = path.resolve(__dirname, '..', 'MCG_Marketecture.pptx');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcg-mkt-'));
unzipToDirectory(fs.readFileSync(SRC), tmp);

const slidePath = path.join(tmp, 'ppt', 'slides', 'slide1.xml');
let xml = fs.readFileSync(slidePath, 'utf-8');

const near = (a, b) => Math.abs(a - b) < 0.006;

// Exact-match gap furniture moves (label/arrow x in inches)
const exact = [
  [4.85, 2.75],   // EXTRACT label -> gap 1 (sources -> pipelines)
  [7.80, 5.64],   // LOAD label    -> gap 2 (pipelines -> lakehouse)
  [10.50, 7.86],  // SERVE label   -> gap 3 (lakehouse -> analytics)
  [5.21, 6.00],   // arrow         -> gap 2
  [8.16, 8.22],   // arrow         -> gap 3
  // 10.86 arrow stays (gap 4, analytics -> outcomes)
];

let moved = 0;
xml = xml.replace(/<a:off x="(\d+)" y="(\d+)"\/>/g, (m, xs, ys) => {
  const xIn = parseInt(xs) / EMU;
  const yIn = parseInt(ys) / EMU;
  if (yIn > 6.8) return m; // bottom band is full-width — never move it
  let newX = null;
  for (const [from, to] of exact) {
    if (near(xIn, from)) { newX = to; break; }
  }
  if (newX === null) {
    if (xIn >= 3.14 && xIn < 5.22) newX = xIn + 3.075;      // SoR block -> right slot
    else if (xIn >= 5.24 && xIn < 8.04) newX = xIn - 2.10;  // Integration block -> left slot
  }
  if (newX === null) return m;
  moved++;
  return `<a:off x="${Math.round(newX * EMU)}" y="${ys}"/>`;
});

fs.writeFileSync(slidePath, xml);
fs.writeFileSync(SRC, zipDirectory(tmp));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Swapped columns: ${moved} shape position(s) updated.`);
