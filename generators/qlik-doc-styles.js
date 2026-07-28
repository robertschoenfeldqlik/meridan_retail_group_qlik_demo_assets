// =============================================================================
// Qlik DOCX Theme — parallel in shape to mcg-styles.js, drops into mcg-docx-builder
// =============================================================================
// This is the Qlik-BRAND document theme (Inter typography, Qlik palette, the
// official Qlik logo). It is intentionally structured exactly like mcg-styles.js
// (a brand object with .colors/.fonts, a `styles` block, and page `margins`) so
// it can be injected into the shared DOCX builder without changing any helper.
//
// Palette (canonical Qlik colors):
//   GREEN      #009845  primary accent / success / logo mark
//   DEEP_BLUE  #19416C  primary heading color
//   GRAY       #54565A  body text
//   SKY        #10CFC9  optional light accent
//   OCEAN      #006580  secondary heading + structural color (tables, rules)
//   ALABASTER  #F6F7F8  fills / callout backgrounds
//   LINE       #DEE2E6  hairline borders
//
// Heading rule: primary headings Deep Blue, secondary headings Ocean, accents
// Green; body Gray. All colors above are from the Qlik palette.
//
// Font: Inter (fallback Calibri where Inter is not installed).
// =============================================================================

const { convertInchesToTwip } = require("docx");
const fs = require("fs");
const path = require("path");

// ─── Canonical Qlik palette (hex without leading #, docx style) ───
const PALETTE = {
  GREEN: "009845",
  DEEP_BLUE: "19416C",
  GRAY: "54565A",
  SKY: "10CFC9",
  OCEAN: "006580",
  ALABASTER: "F6F7F8",
  LINE: "DEE2E6",
  WHITE: "FFFFFF",
};

// Font family + documented fallback (Word substitutes automatically if Inter
// is not installed; Calibri is the closest built-in metric match).
const FONT = "Inter";
const FONT_FALLBACK = "Calibri";

// ─── Asset paths ───
const ASSETS_DIR = path.join(__dirname, "assets");
// Official Qlik artwork lives in the qlik-brand skill. The "positive" mark
// (dark ink + green, transparent background) reads correctly on a light page.
const LOGO_SVG_SRC = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".claude", "skills", "qlik-brand", "assets", "logo", "qlik-logo-positive.svg"
);
// DOCX needs a raster; this is the rasterization target.
const LOGO_PNG = path.join(ASSETS_DIR, "qlik-logo.png");

// ─── Brand object (parallel to MCG in mcg-styles.js) ────────────────────────
// `colors` carries the canonical Qlik names AND the builder-compatible aliases
// (navy/teal/gold/lightGray/medGray/darkText/white/green/red) so the existing
// mcg-docx-builder helpers render on-brand with zero changes.
const QLIK = {
  name: "Qlik",
  footerText: "Qlik",
  colors: {
    // Canonical Qlik palette
    green: PALETTE.GREEN,
    deepBlue: PALETTE.DEEP_BLUE,
    gray: PALETTE.GRAY,
    sky: PALETTE.SKY,
    ocean: PALETTE.OCEAN,
    alabaster: PALETTE.ALABASTER,
    line: PALETTE.LINE,
    white: PALETTE.WHITE,

    // Builder-compatible aliases (map the MCG structural keys onto Qlik colors)
    navy: PALETTE.DEEP_BLUE,   // primary headings (h1/h3), labels, "critical"
    teal: PALETTE.OCEAN,       // secondary headings (h2), tables, rules, "info"
    gold: PALETTE.GREEN,       // accent: doc-type label, "warning" (no Qlik gold)
    green_: PALETTE.GREEN,     // (reserved) keep green primary below
    lightGray: PALETTE.ALABASTER, // fills / callout backgrounds
    medGray: PALETTE.GRAY,     // secondary text (footer, captions)
    darkText: PALETTE.GRAY,    // body text
    red: PALETTE.DEEP_BLUE,    // no reds in Qlik — emphasis falls back to blue
  },
  fonts: { heading: FONT, body: FONT, mono: FONT },
  // Path the builder will use for the header logo (guarded by fs.existsSync,
  // so a missing raster simply omits the mark — the logo is never redrawn).
  logoPath: LOGO_PNG,
};
// green is a first-class alias too (kept last so it wins if a linter dedupes)
QLIK.colors.green = PALETTE.GREEN;

// ─── Reusable style definitions (same shape as mcg-styles.js `styles`) ───
// Headings Deep Blue (primary) / Ocean (secondary), body Gray, all Inter.
const styles = {
  default: {
    document: {
      run: { font: FONT, size: 22, color: PALETTE.GRAY },
      paragraph: { spacing: { after: 120, line: 276 } },
    },
    heading1: {
      run: { font: FONT, size: 32, bold: true, color: PALETTE.DEEP_BLUE },
      paragraph: { spacing: { before: 360, after: 200 } },
    },
    heading2: {
      run: { font: FONT, size: 26, bold: true, color: PALETTE.OCEAN },
      paragraph: { spacing: { before: 300, after: 160 } },
    },
    heading3: {
      run: { font: FONT, size: 22, bold: true, color: PALETTE.DEEP_BLUE },
      paragraph: { spacing: { before: 240, after: 120 } },
    },
  },
};

// ─── Page margins (mirror mcg-styles.js) ───
const margins = {
  top: convertInchesToTwip(1.2),
  bottom: convertInchesToTwip(0.8),
  left: convertInchesToTwip(1),
  right: convertInchesToTwip(1),
};

// Attach so the whole theme travels as one object into buildQlikDocument(...).
QLIK.styles = styles;
QLIK.margins = margins;

// ─── Logo rasterization (robust, best-effort) ───────────────────────────────
// Rasterize qlik-logo-positive.svg -> generators/assets/qlik-logo.png with sharp.
// Returns the PNG path on success, or null if it could not be produced (in which
// case the builder omits the logo — it is never redrawn). Idempotent: if a
// raster already exists it is reused.
async function ensureQlikLogo() {
  try {
    if (fs.existsSync(LOGO_PNG)) return LOGO_PNG;
    if (!fs.existsSync(LOGO_SVG_SRC)) {
      console.warn(`  ! Qlik logo source not found (${LOGO_SVG_SRC}); logo will be omitted.`);
      return null;
    }
    const sharp = require("sharp");
    if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
    // density 300 renders the vector crisply; width 900 preserves the source aspect (900x500).
    await sharp(LOGO_SVG_SRC, { density: 300 })
      .resize({ width: 900, withoutEnlargement: false })
      .png()
      .toFile(LOGO_PNG);
    return fs.existsSync(LOGO_PNG) ? LOGO_PNG : null;
  } catch (err) {
    console.warn(`  ! Qlik logo rasterization failed (${err.message}); logo will be omitted.`);
    return null;
  }
}

// Path is only "produced" (truthy) when the raster actually exists on disk.
const LOGO_PATH = fs.existsSync(LOGO_PNG) ? LOGO_PNG : null;

module.exports = {
  QLIK,
  styles,
  margins,
  PALETTE,
  FONT,
  FONT_FALLBACK,
  ensureQlikLogo,
  LOGO_PATH,
  LOGO_PNG,
  LOGO_SVG_SRC,
};
