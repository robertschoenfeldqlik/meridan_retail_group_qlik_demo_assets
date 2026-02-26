// MCG Brand Constants & Shared Styles for DOCX generation
const { AlignmentType, HeadingLevel, BorderStyle, ShadingType, WidthType, convertInchesToTwip } = require("docx");

const MCG = {
  name: "Meridian Commerce Group",
  tagline: "The neighborhood store with global reach",
  hq: "Weena 505, 3013 AL Rotterdam, Netherlands",
  phone: "+31 10 798 4000",
  web: "www.meridiancommerce.com",
  email: "info@meridiancommerce.com",
  colors: {
    navy: "1B2A4A",
    teal: "0D7C8F",
    gold: "C4922E",
    lightGray: "F2F4F7",
    medGray: "6B7280",
    darkText: "1F2937",
    white: "FFFFFF",
    red: "DC2626",
    green: "059669",
  },
  fonts: {
    heading: "Calibri",
    body: "Calibri",
    mono: "Consolas",
  },
};

// Reusable style definitions for document sections
const styles = {
  default: {
    document: {
      run: { font: MCG.fonts.body, size: 22, color: MCG.colors.darkText },
      paragraph: { spacing: { after: 120, line: 276 } },
    },
    heading1: {
      run: { font: MCG.fonts.heading, size: 32, bold: true, color: MCG.colors.navy },
      paragraph: { spacing: { before: 360, after: 200 } },
    },
    heading2: {
      run: { font: MCG.fonts.heading, size: 26, bold: true, color: MCG.colors.teal },
      paragraph: { spacing: { before: 300, after: 160 } },
    },
    heading3: {
      run: { font: MCG.fonts.heading, size: 22, bold: true, color: MCG.colors.navy },
      paragraph: { spacing: { before: 240, after: 120 } },
    },
  },
};

// Page margins
const margins = {
  top: convertInchesToTwip(1.2),
  bottom: convertInchesToTwip(0.8),
  left: convertInchesToTwip(1),
  right: convertInchesToTwip(1),
};

module.exports = { MCG, styles, margins };
