#!/usr/bin/env node
/**
 * MCG Logo Generator
 * Creates a modern "MCG" logo in Inter font with Meridian Commerce Group color scheme
 * Colors: Navy #1B2A4A, Teal #0D7C8F, Gold #C4922E
 * Output: PNG at various sizes
 */

const sharp = require("sharp");
const path = require("path");

// MCG brand colors
const NAVY = "#1B2A4A";
const TEAL = "#0D7C8F";
const GOLD = "#C4922E";
const WHITE = "#FFFFFF";

// Logo dimensions
const WIDTH = 800;
const HEIGHT = 280;

// Create SVG logo
function createLogoSVG(width, height) {
  // Modern minimalist MCG logo:
  // - "MCG" in bold Inter font
  // - Teal accent bar on left
  // - Gold underline accent
  // - Navy background option + white background option

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@700;800;900&amp;display=swap');
    </style>
    <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${TEAL};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0A6170;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${GOLD};stop-opacity:1" />
      <stop offset="60%" style="stop-color:${GOLD};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${GOLD};stop-opacity:0" />
    </linearGradient>
  </defs>

  <!-- Background: transparent -->

  <!-- Left accent bar -->
  <rect x="40" y="40" width="8" height="200" rx="4" fill="url(#tealGrad)" />

  <!-- MCG Text -->
  <text x="72" y="190" font-family="Inter, 'Segoe UI', Calibri, Arial, sans-serif" font-weight="800" font-size="180" fill="${NAVY}" letter-spacing="-4">MCG</text>

  <!-- Gold underline accent -->
  <rect x="72" y="210" width="320" height="6" rx="3" fill="url(#goldGrad)" />
</svg>`;
}

// Dark variant: navy background, white text
function createLogoDarkSVG(width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@700;800;900&amp;display=swap');
    </style>
    <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${TEAL};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#10CFC9;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${GOLD};stop-opacity:1" />
      <stop offset="60%" style="stop-color:${GOLD};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${GOLD};stop-opacity:0" />
    </linearGradient>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0D2137;stop-opacity:1" />
      <stop offset="100%" style="stop-color:${NAVY};stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Dark background -->
  <rect width="${width}" height="${height}" rx="16" fill="url(#bgGrad)" />

  <!-- Left accent bar -->
  <rect x="40" y="40" width="8" height="200" rx="4" fill="url(#tealGrad)" />

  <!-- MCG Text — white on dark -->
  <text x="72" y="190" font-family="Inter, 'Segoe UI', Calibri, Arial, sans-serif" font-weight="800" font-size="180" fill="${WHITE}" letter-spacing="-4">MCG</text>

  <!-- Gold underline accent -->
  <rect x="72" y="210" width="320" height="6" rx="3" fill="url(#goldGrad)" />
</svg>`;
}

// Compact square variant (for favicons, app icons)
function createLogoSquareSVG(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0D2137;stop-opacity:1" />
      <stop offset="100%" style="stop-color:${NAVY};stop-opacity:1" />
    </linearGradient>
    <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${TEAL};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#10CFC9;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Dark background -->
  <rect width="${size}" height="${size}" rx="24" fill="url(#bgGrad)" />

  <!-- Teal accent top -->
  <rect x="20" y="16" width="4" height="${size - 32}" rx="2" fill="url(#tealGrad)" />

  <!-- MCG Text -->
  <text x="${size / 2}" y="${size * 0.68}" text-anchor="middle" font-family="Inter, 'Segoe UI', Calibri, Arial, sans-serif" font-weight="800" font-size="${size * 0.42}" fill="${WHITE}" letter-spacing="-2">MCG</text>

  <!-- Gold underline -->
  <rect x="${size * 0.2}" y="${size * 0.76}" width="${size * 0.5}" height="4" rx="2" fill="${GOLD}" />
</svg>`;
}

async function generateLogos() {
  const outDir = path.join(__dirname, "assets");

  // 1. Light logo (transparent bg, navy text)
  const lightSVG = Buffer.from(createLogoSVG(WIDTH, HEIGHT));
  await sharp(lightSVG)
    .png()
    .toFile(path.join(outDir, "mcg_logo_light.png"));
  console.log("  mcg_logo_light.png (800x280)");

  // 2. Dark logo (navy bg, white text)
  const darkSVG = Buffer.from(createLogoDarkSVG(WIDTH, HEIGHT));
  await sharp(darkSVG)
    .png()
    .toFile(path.join(outDir, "mcg_logo_dark.png"));
  console.log("  mcg_logo_dark.png (800x280)");

  // 3. Square icon (for app icons, favicons)
  const squareSVG = Buffer.from(createLogoSquareSVG(256));
  await sharp(squareSVG)
    .png()
    .toFile(path.join(outDir, "mcg_logo_square.png"));
  console.log("  mcg_logo_square.png (256x256)");

  // 4. Large dark for presentations
  const largeDarkSVG = Buffer.from(createLogoDarkSVG(1200, 420));
  await sharp(largeDarkSVG)
    .png()
    .toFile(path.join(outDir, "mcg_logo_dark_large.png"));
  console.log("  mcg_logo_dark_large.png (1200x420)");

  console.log("\nAll MCG logos generated in generators/assets/");
}

generateLogos().catch((err) => { console.error(err); process.exit(1); });
