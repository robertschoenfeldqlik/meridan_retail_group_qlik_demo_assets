#!/usr/bin/env node
// =============================================================================
// Dashboard Mockup Screenshot Capture
// =============================================================================
// Opens each HTML mockup in a headless Chromium browser at 1920×1080 and
// captures a PNG screenshot to deploy/apps/mockups/screenshots/
//
// Usage:  node generators/capture-mockups.js
// =============================================================================

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const MOCKUPS_DIR = path.join(__dirname, "..", "deploy", "apps", "mockups");
const SCREENSHOTS_DIR = path.join(MOCKUPS_DIR, "screenshots");

const HTML_FILES = [
  "app1-sheet1-inventory-health.html",
  "app1-sheet2-cold-chain.html",
  "app1-sheet3-product-quality.html",
  "app1-sheet4-compliance.html",
  "app1-sheet5-cost-impact.html",
  "app2-sheet1-last-mile.html",
  "app2-sheet2-shipment-tracking.html",
  "app2-sheet3-wismo.html",
  "app2-sheet4-order-timeline.html",
  "app2-sheet5-address-quality.html",
];

(async () => {
  console.log("\n  Dashboard Mockup Screenshot Capture");
  console.log("  ====================================\n");

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  for (const htmlFile of HTML_FILES) {
    const htmlPath = path.join(MOCKUPS_DIR, htmlFile);
    const pngFile = htmlFile.replace(".html", ".png");
    const pngPath = path.join(SCREENSHOTS_DIR, pngFile);

    if (!fs.existsSync(htmlPath)) {
      console.log(`  ✗ Missing: ${htmlFile}`);
      continue;
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });
    // Brief pause for any CSS animations to settle
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: pngPath, fullPage: false });
    await page.close();
    console.log(`  ✓ ${pngFile}`);
  }

  await browser.close();
  console.log(`\n  Captured ${HTML_FILES.length} screenshots to:`);
  console.log(`  ${SCREENSHOTS_DIR}\n`);
})();
