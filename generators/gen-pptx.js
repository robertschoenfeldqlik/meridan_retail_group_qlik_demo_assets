// Generate MCG Company Profile & Data Quality Issues PowerPoint
const PptxGenJS = require("pptxgenjs");

const MCG = {
  navy: "1B2A4A",
  teal: "0D7C8F",
  gold: "C4922E",
  lightGray: "F2F4F7",
  medGray: "6B7280",
  darkText: "1F2937",
  white: "FFFFFF",
  red: "DC2626",
  green: "059669",
  lightTeal: "E0F4F7",
  lightNavy: "E8EBF0",
};

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pptx.author = "Meridian Commerce Group";
pptx.company = "Meridian Commerce Group";
pptx.title = "MCG Company Profile & Data Quality Assessment";

// ─── HELPER: Add footer bar to every slide ───
function addFooter(slide, slideNum, totalSlides) {
  // Bottom bar
  slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 7.0, w: 13.33, h: 0.5, fill: { color: MCG.navy } });
  slide.addText("Meridian Commerce Group  •  Confidential", {
    x: 0.5, y: 7.05, w: 8, h: 0.4,
    fontSize: 9, color: MCG.medGray, fontFace: "Calibri",
  });
  slide.addText(`${slideNum}`, {
    x: 12, y: 7.05, w: 1, h: 0.4,
    fontSize: 9, color: MCG.medGray, fontFace: "Calibri", align: "right",
  });
}

// ─── HELPER: Section header slide ───
function sectionSlide(title, subtitle, slideNum) {
  const slide = pptx.addSlide();
  slide.background = { fill: MCG.navy };
  // Accent bar
  slide.addShape(pptx.shapes.RECTANGLE, { x: 0.8, y: 2.8, w: 2, h: 0.06, fill: { color: MCG.gold } });
  slide.addText(title, {
    x: 0.8, y: 3.0, w: 11, h: 1.2,
    fontSize: 40, color: MCG.white, fontFace: "Calibri", bold: true,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.8, y: 4.2, w: 11, h: 0.8,
      fontSize: 20, color: MCG.teal, fontFace: "Calibri", italic: true,
    });
  }
  slide.addText("MERIDIAN COMMERCE GROUP", {
    x: 0.8, y: 6.5, w: 6, h: 0.4,
    fontSize: 11, color: MCG.medGray, fontFace: "Calibri", letterSpacing: 3,
  });
  return slide;
}

// ═══════════════════════════════════════
// SLIDE 1: Title
// ═══════════════════════════════════════
let slide = pptx.addSlide();
slide.background = { fill: MCG.navy };
// Top accent line
slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: MCG.teal } });
// Company name
slide.addText([
  { text: "MERIDIAN ", options: { fontSize: 44, color: MCG.white, bold: true } },
  { text: "COMMERCE ", options: { fontSize: 44, color: MCG.white, bold: false } },
  { text: "GROUP", options: { fontSize: 44, color: MCG.teal, bold: true } },
], { x: 0.8, y: 1.5, w: 11.5, h: 1.0, fontFace: "Calibri" });
// Tagline
slide.addText("The neighborhood store with global reach", {
  x: 0.8, y: 2.5, w: 11.5, h: 0.6,
  fontSize: 22, color: MCG.gold, fontFace: "Calibri", italic: true,
});
// Separator
slide.addShape(pptx.shapes.RECTANGLE, { x: 0.8, y: 3.4, w: 3, h: 0.04, fill: { color: MCG.gold } });
// Subtitle
slide.addText("Company Profile & Data Quality Assessment", {
  x: 0.8, y: 3.8, w: 11.5, h: 0.8,
  fontSize: 28, color: MCG.white, fontFace: "Calibri",
});
slide.addText("Q3 2025  •  Prepared for Senior Leadership", {
  x: 0.8, y: 4.6, w: 11.5, h: 0.5,
  fontSize: 16, color: MCG.medGray, fontFace: "Calibri",
});
// Bottom
slide.addText("CONFIDENTIAL", {
  x: 0.8, y: 6.5, w: 4, h: 0.4,
  fontSize: 12, color: MCG.gold, fontFace: "Calibri", bold: true, letterSpacing: 4,
});

// ═══════════════════════════════════════
// SLIDE 2: Company at a Glance
// ═══════════════════════════════════════
slide = pptx.addSlide();
slide.background = { fill: MCG.white };
addFooter(slide, 2);
slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: MCG.teal } });
slide.addText("Company at a Glance", {
  x: 0.5, y: 0.3, w: 12, h: 0.7,
  fontSize: 32, color: MCG.navy, fontFace: "Calibri", bold: true,
});

// Key metrics in boxes
const metrics = [
  { val: "$14.2B", label: "Annual Revenue", color: MCG.navy },
  { val: "62,000", label: "Employees", color: MCG.teal },
  { val: "1,140", label: "Retail Stores", color: MCG.navy },
  { val: "23", label: "Countries", color: MCG.teal },
  { val: "28", label: "Distribution Centers", color: MCG.navy },
  { val: "$3.8B", label: "E-Commerce Revenue", color: MCG.teal },
];

metrics.forEach((m, i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  const x = 0.5 + col * 4.1;
  const y = 1.3 + row * 1.7;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y, w: 3.8, h: 1.4,
    fill: { color: MCG.lightGray },
    rectRadius: 0.1,
    line: { color: m.color, width: 1.5, dashType: "solid" },
  });
  slide.addText(m.val, {
    x, y: y + 0.15, w: 3.8, h: 0.7,
    fontSize: 32, color: m.color, fontFace: "Calibri", bold: true, align: "center",
  });
  slide.addText(m.label, {
    x, y: y + 0.8, w: 3.8, h: 0.4,
    fontSize: 14, color: MCG.medGray, fontFace: "Calibri", align: "center",
  });
});

// Bottom info
slide.addText([
  { text: "Founded: ", options: { bold: true, color: MCG.navy } },
  { text: "1987, Rotterdam  •  ", options: { color: MCG.darkText } },
  { text: "CEO: ", options: { bold: true, color: MCG.navy } },
  { text: "Ingrid van der Berg  •  ", options: { color: MCG.darkText } },
  { text: "CIO: ", options: { bold: true, color: MCG.navy } },
  { text: "Marcus Chen  •  ", options: { color: MCG.darkText } },
  { text: "CDO: ", options: { bold: true, color: MCG.navy } },
  { text: "Priya Ramanathan", options: { color: MCG.darkText } },
], { x: 0.5, y: 5.0, w: 12.3, h: 0.5, fontSize: 13, fontFace: "Calibri" });

slide.addText("Categories: Home goods  •  Electronics  •  Apparel  •  Grocery & Fresh  •  Health & Wellness", {
  x: 0.5, y: 5.5, w: 12.3, h: 0.4,
  fontSize: 12, color: MCG.medGray, fontFace: "Calibri",
});

// ═══════════════════════════════════════
// SLIDE 3: The Data Landscape
// ═══════════════════════════════════════
slide = pptx.addSlide();
slide.background = { fill: MCG.white };
addFooter(slide, 3);
slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: MCG.teal } });
slide.addText("The Data Landscape — A Tangled Web", {
  x: 0.5, y: 0.3, w: 12, h: 0.7,
  fontSize: 30, color: MCG.navy, fontFace: "Calibri", bold: true,
});

slide.addText("47 distinct source systems  •  6 ERP instances  •  3 WMS platforms  •  2 POS systems  •  14 spreadsheet trackers", {
  x: 0.5, y: 1.0, w: 12.3, h: 0.5,
  fontSize: 15, color: MCG.red, fontFace: "Calibri", bold: true,
});

const systems = [
  ["SAP S/4HANA", "Core ERP", "Global"],
  ["Oracle WMS", "Warehouse Mgmt", "Americas, EU"],
  ["Manhattan WMS", "Warehouse Mgmt", "APAC"],
  ["Salesforce Commerce", "E-Commerce", "Global"],
  ["Blue Yonder", "Demand Planning", "Americas"],
  ["Kinaxis", "Supply Chain Planning", "EU, APAC"],
  ["Descartes TMS", "Transportation", "Global"],
  ["Tive / Sensitech", "IoT Cold Chain", "EU, Americas"],
  ["Shopify POS", "Point of Sale", "Express stores"],
  ["Oracle Retail Xstore", "Point of Sale", "Full-format stores"],
  ["Snowflake", "Data Warehouse", "Global (partial)"],
  ["Legacy SQL Server", "Regional Reporting", "Various"],
];

slide.addTable(
  [
    [
      { text: "System", options: { bold: true, color: MCG.white, fill: { color: MCG.teal }, fontSize: 11 } },
      { text: "Purpose", options: { bold: true, color: MCG.white, fill: { color: MCG.teal }, fontSize: 11 } },
      { text: "Region", options: { bold: true, color: MCG.white, fill: { color: MCG.teal }, fontSize: 11 } },
    ],
    ...systems.map((row, i) => row.map(cell => ({
      text: cell,
      options: { fontSize: 10, color: MCG.darkText, fill: { color: i % 2 === 0 ? MCG.lightGray : MCG.white } },
    }))),
  ],
  {
    x: 0.5, y: 1.6, w: 12.3,
    fontFace: "Calibri",
    border: { type: "solid", pt: 0.5, color: "D1D5DB" },
    colW: [3.5, 4.5, 4.3],
    rowH: [0.35, ...Array(12).fill(0.32)],
  }
);

slide.addText("\"Why can't we see what's happening in our own supply chain?\" — CEO Ingrid van der Berg", {
  x: 0.5, y: 6.2, w: 12.3, h: 0.5,
  fontSize: 13, color: MCG.navy, fontFace: "Calibri", italic: true, bold: true,
});

// ═══════════════════════════════════════
// SLIDE 4: Section — Seven Nightmares
// ═══════════════════════════════════════
sectionSlide("The Seven Data Quality Nightmares", "$127M in annual losses from data quality failures");

// ═══════════════════════════════════════
// SLIDE 5: Nightmare Overview
// ═══════════════════════════════════════
slide = pptx.addSlide();
slide.background = { fill: MCG.white };
addFooter(slide, 5);
slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: MCG.red } });
slide.addText("Seven Data Quality Nightmares — $127M Annual Impact", {
  x: 0.5, y: 0.2, w: 12, h: 0.6,
  fontSize: 26, color: MCG.navy, fontFace: "Calibri", bold: true,
});

const nightmares = [
  { num: "1", name: "Phantom Inventory", cost: "$48.0M", metric: "IRA: 74% vs 97% target", color: MCG.red },
  { num: "2", name: "Address Catastrophe", cost: "$3.1M", metric: "4.7% first-delivery rejection", color: MCG.gold },
  { num: "3", name: "Product Master Mess", cost: "$8.2M", metric: "8,200 SKUs missing weight", color: MCG.gold },
  { num: "4", name: "Silent Pipelines", cost: "$12.0M", metric: "4.3-day detection time", color: MCG.red },
  { num: "5", name: "Timestamp Babel", cost: "$6.5M", metric: "14 TZs, no standards", color: MCG.gold },
  { num: "6", name: "Carrier Black Hole", cost: "$14.8M", metric: "42% missing tracking", color: MCG.red },
  { num: "7", name: "Compliance Gap", cost: "$4.2M", metric: "11-day recall vs 24h", color: MCG.red },
];

nightmares.forEach((n, i) => {
  const y = 1.0 + i * 0.82;
  // Number circle
  slide.addShape(pptx.shapes.OVAL, {
    x: 0.5, y: y + 0.05, w: 0.55, h: 0.55,
    fill: { color: n.color },
  });
  slide.addText(n.num, {
    x: 0.5, y: y + 0.05, w: 0.55, h: 0.55,
    fontSize: 18, color: MCG.white, fontFace: "Calibri", bold: true, align: "center", valign: "middle",
  });
  // Name
  slide.addText(n.name, {
    x: 1.3, y: y, w: 4, h: 0.65,
    fontSize: 16, color: MCG.navy, fontFace: "Calibri", bold: true, valign: "middle",
  });
  // Cost box
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 5.5, y: y + 0.05, w: 2.2, h: 0.55,
    fill: { color: n.color === MCG.red ? "FEE2E2" : "FEF3C7" },
    rectRadius: 0.05,
  });
  slide.addText(n.cost, {
    x: 5.5, y: y + 0.05, w: 2.2, h: 0.55,
    fontSize: 18, color: n.color, fontFace: "Calibri", bold: true, align: "center", valign: "middle",
  });
  // Metric
  slide.addText(n.metric, {
    x: 8.0, y: y, w: 5, h: 0.65,
    fontSize: 13, color: MCG.medGray, fontFace: "Calibri", valign: "middle",
  });
});

// Total bar
slide.addShape(pptx.shapes.RECTANGLE, {
  x: 0.5, y: 6.85, w: 12.3, h: 0.0, // just spacing
});

// ═══════════════════════════════════════
// SLIDE 6: Nightmare #1 — Phantom Inventory
// ═══════════════════════════════════════
slide = pptx.addSlide();
slide.background = { fill: MCG.white };
addFooter(slide, 6);
slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: MCG.red } });
slide.addText("Nightmare #1: Phantom Inventory — $48M Annual Impact", {
  x: 0.5, y: 0.2, w: 12, h: 0.6,
  fontSize: 26, color: MCG.navy, fontFace: "Calibri", bold: true,
});

// IRA gauge visual
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.0, w: 5.5, h: 2.8,
  fill: { color: MCG.lightGray }, rectRadius: 0.15,
  line: { color: MCG.red, width: 2 },
});
slide.addText("Inventory Record Accuracy", {
  x: 0.5, y: 1.1, w: 5.5, h: 0.4,
  fontSize: 14, color: MCG.medGray, fontFace: "Calibri", align: "center", bold: true,
});
slide.addText("74%", {
  x: 0.5, y: 1.6, w: 5.5, h: 1.2,
  fontSize: 72, color: MCG.red, fontFace: "Calibri", bold: true, align: "center",
});
slide.addText("Target: 97%", {
  x: 0.5, y: 2.9, w: 5.5, h: 0.5,
  fontSize: 18, color: MCG.green, fontFace: "Calibri", align: "center",
});

// Right side: details
slide.addText("The Rotterdam Incident", {
  x: 6.5, y: 1.0, w: 6.3, h: 0.4,
  fontSize: 18, color: MCG.navy, fontFace: "Calibri", bold: true,
});
const phantomDetails = [
  "SAP showed 500 units of BT Speaker at Rotterdam DC",
  "Oracle WMS showed 312 units",
  "Physical count: 287 units",
  "Cause: WMS-SAP batch job failed silently for 4.3 days",
  "No alert was ever generated",
  "847 phantom inventory units across 42 SKUs",
  "7 stores had preventable stockouts",
];
phantomDetails.forEach((text, i) => {
  slide.addText(`•  ${text}`, {
    x: 6.5, y: 1.5 + i * 0.38, w: 6.3, h: 0.35,
    fontSize: 12, color: MCG.darkText, fontFace: "Calibri",
  });
});

// Impact box
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 4.2, w: 12.3, h: 1.0,
  fill: { color: "FEE2E2" }, rectRadius: 0.1,
});
slide.addText("Impact: 855 hours of manual reconciliation daily across 1,140 stores. Store managers spend 45 minutes every morning reconciling inventory in spreadsheets.", {
  x: 0.8, y: 4.3, w: 11.8, h: 0.8,
  fontSize: 14, color: MCG.red, fontFace: "Calibri",
});

// Quote
slide.addText("\"We're asking warehouse staff to do a 15-20 minute manual sync check every morning. That's 855 hours of labor across our DC network, every day.\"\n— Henrik Jansen, VP Warehouse Operations", {
  x: 0.5, y: 5.5, w: 12.3, h: 0.8,
  fontSize: 12, color: MCG.navy, fontFace: "Calibri", italic: true,
});

// ═══════════════════════════════════════
// SLIDE 7: Nightmare #6 — Carrier Black Hole
// ═══════════════════════════════════════
slide = pptx.addSlide();
slide.background = { fill: MCG.white };
addFooter(slide, 7);
slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: MCG.red } });
slide.addText("Nightmare #6: Carrier Data Black Hole — $14.8M Annual Impact", {
  x: 0.5, y: 0.2, w: 12, h: 0.6,
  fontSize: 26, color: MCG.navy, fontFace: "Calibri", bold: true,
});

// Key stats
const carrierStats = [
  { val: "42", label: "Carriers Globally", color: MCG.navy },
  { val: "42%", label: "Missing Tracking #s", color: MCG.red },
  { val: "58%", label: "Real-Time Visibility", color: MCG.gold },
  { val: "536K", label: "WISMO Calls/Month", color: MCG.red },
];
carrierStats.forEach((s, i) => {
  const x = 0.5 + i * 3.2;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y: 1.0, w: 2.9, h: 1.3,
    fill: { color: MCG.lightGray }, rectRadius: 0.1,
    line: { color: s.color, width: 1.5 },
  });
  slide.addText(s.val, {
    x, y: 1.05, w: 2.9, h: 0.75,
    fontSize: 32, color: s.color, fontFace: "Calibri", bold: true, align: "center",
  });
  slide.addText(s.label, {
    x, y: 1.75, w: 2.9, h: 0.4,
    fontSize: 11, color: MCG.medGray, fontFace: "Calibri", align: "center",
  });
});

// Multi-language status table
slide.addText("Carrier Status Babel — Same Meaning, Different Languages", {
  x: 0.5, y: 2.6, w: 12, h: 0.4,
  fontSize: 16, color: MCG.navy, fontFace: "Calibri", bold: true,
});
slide.addTable(
  [
    [
      { text: "Carrier", options: { bold: true, color: MCG.white, fill: { color: MCG.teal }, fontSize: 11 } },
      { text: "\"Delivered\"", options: { bold: true, color: MCG.white, fill: { color: MCG.teal }, fontSize: 11 } },
      { text: "\"In Transit\"", options: { bold: true, color: MCG.white, fill: { color: MCG.teal }, fontSize: 11 } },
      { text: "Language", options: { bold: true, color: MCG.white, fill: { color: MCG.teal }, fontSize: 11 } },
    ],
    [{ text: "DPD (NL)" }, { text: "Bezorgd" }, { text: "In pakketcentrum" }, { text: "Dutch" }],
    [{ text: "DPD (DE)" }, { text: "Zugestellt" }, { text: "Im Paketzentrum" }, { text: "German" }],
    [{ text: "DPD (FR)" }, { text: "Livré" }, { text: "Au centre de tri" }, { text: "French" }],
    [{ text: "FedEx" }, { text: "Delivered" }, { text: "In transit" }, { text: "English" }],
    [{ text: "NinjaVan" }, { text: "Completed" }, { text: "In Transit" }, { text: "English" }],
    [{ text: "Local (Lagos)" }, { text: "DLVRD" }, { text: "N/A (no tracking)" }, { text: "Codes only" }],
  ].map((row, ri) => row.map(cell => ({
    text: typeof cell === "string" ? cell : cell.text,
    options: {
      ...(typeof cell === "object" ? cell.options : {}),
      fontSize: typeof cell === "object" && cell.options ? cell.options.fontSize : 10,
      color: typeof cell === "object" && cell.options ? cell.options.color : MCG.darkText,
      fill: typeof cell === "object" && cell.options ? cell.options.fill : { color: ri % 2 === 0 ? MCG.lightGray : MCG.white },
      fontFace: "Calibri",
    },
  }))),
  {
    x: 0.5, y: 3.1, w: 12.3,
    border: { type: "solid", pt: 0.5, color: "D1D5DB" },
    colW: [2.5, 3, 3.8, 3],
    rowH: [0.35, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3],
  }
);

// NinjaVan callout
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 5.5, w: 12.3, h: 1.0,
  fill: { color: "FEF3C7" }, rectRadius: 0.1,
});
slide.addText("Singapore Crisis: NinjaVan changed 5-10 kg delivery from 2-day to 3-day without notification. MCG continued promising 2-day delivery for 3+ weeks, affecting 14,000 customers/month. WISMO rate spiked to 52%.", {
  x: 0.8, y: 5.6, w: 11.8, h: 0.8,
  fontSize: 13, color: MCG.darkText, fontFace: "Calibri",
});

// ═══════════════════════════════════════
// SLIDE 8: Nightmare #7 — Compliance Gap
// ═══════════════════════════════════════
slide = pptx.addSlide();
slide.background = { fill: MCG.white };
addFooter(slide, 8);
slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: MCG.red } });
slide.addText("Nightmare #7: Compliance Traceability Gap — $4.2M", {
  x: 0.5, y: 0.2, w: 12, h: 0.6,
  fontSize: 26, color: MCG.navy, fontFace: "Calibri", bold: true,
});

// Timeline comparison
slide.addText("Lettuce Recall (RCL-2025-003): Full Traceability Timeline", {
  x: 0.5, y: 1.0, w: 12, h: 0.4,
  fontSize: 18, color: MCG.navy, fontFace: "Calibri", bold: true,
});

// Target bar
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.6, w: 1.5, h: 0.6,
  fill: { color: MCG.green }, rectRadius: 0.05,
});
slide.addText("24h", {
  x: 0.5, y: 1.6, w: 1.5, h: 0.6,
  fontSize: 20, color: MCG.white, fontFace: "Calibri", bold: true, align: "center", valign: "middle",
});
slide.addText("Regulatory Target", {
  x: 2.2, y: 1.65, w: 4, h: 0.5,
  fontSize: 13, color: MCG.green, fontFace: "Calibri", bold: true,
});

// Actual bar
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 2.4, w: 10, h: 0.6,
  fill: { color: MCG.red }, rectRadius: 0.05,
});
slide.addText("11 DAYS", {
  x: 0.5, y: 2.4, w: 10, h: 0.6,
  fontSize: 20, color: MCG.white, fontFace: "Calibri", bold: true, align: "center", valign: "middle",
});
slide.addText("MCG Actual (June 2025)", {
  x: 10.7, y: 2.45, w: 3, h: 0.5,
  fontSize: 13, color: MCG.red, fontFace: "Calibri", bold: true,
});

// Details
const recallDetails = [
  ["12,400 units", "Affected across 210 stores in NL, DE, BE, FR"],
  ["65 person-hours", "Manual cross-referencing across 4 disconnected systems"],
  ["32%", "Of stores had lot-level tracking (68% required manual audits)"],
  ["4 systems", "SAP, WMS, Descartes TMS, Salesforce — no common key"],
  ["€85,125", "Total recall cost (product, labor, regulatory, brand impact)"],
  ["NVWA citation", "Formal regulatory citation issued for traceability failure"],
];
recallDetails.forEach((d, i) => {
  const y = 3.4 + i * 0.5;
  slide.addText(d[0], {
    x: 0.5, y, w: 3, h: 0.45,
    fontSize: 15, color: MCG.navy, fontFace: "Calibri", bold: true,
  });
  slide.addText(d[1], {
    x: 3.5, y, w: 9.3, h: 0.45,
    fontSize: 13, color: MCG.darkText, fontFace: "Calibri",
  });
});

// ═══════════════════════════════════════
// SLIDE 9: Human Impact
// ═══════════════════════════════════════
slide = pptx.addSlide();
slide.background = { fill: MCG.white };
addFooter(slide, 9);
slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: MCG.teal } });
slide.addText("The Human Impact — These Aren't Just Data Problems", {
  x: 0.5, y: 0.2, w: 12, h: 0.6,
  fontSize: 26, color: MCG.navy, fontFace: "Calibri", bold: true,
});

const impacts = [
  { role: "Store Managers", stat: "855 hrs/day", desc: "Manual inventory reconciliation in spreadsheets — 45 min per store, every morning, across 1,140 stores" },
  { role: "Supply Chain Analysts", stat: "70%", desc: "Of their time spent finding and cleaning data. Only 30% on actual analysis." },
  { role: "Customer Service Agents", stat: "5 screens", desc: "Must toggle between 5 systems to answer a single WISMO call. 536K calls/month at $2.30 each." },
  { role: "Regional VPs", stat: "Stale data", desc: "Weekly PowerPoint decks already outdated by presentation time. Every region tells a different story." },
  { role: "CFO", stat: "Unreliable", desc: "Cannot accurately forecast inventory carrying costs. Data foundation too unreliable for financial planning." },
];

impacts.forEach((imp, i) => {
  const y = 1.1 + i * 1.1;
  // Role box
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y, w: 2.8, h: 0.9,
    fill: { color: MCG.navy }, rectRadius: 0.08,
  });
  slide.addText(imp.role, {
    x: 0.5, y, w: 2.8, h: 0.9,
    fontSize: 13, color: MCG.white, fontFace: "Calibri", bold: true, align: "center", valign: "middle",
  });
  // Stat
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 3.5, y, w: 2.3, h: 0.9,
    fill: { color: "FEE2E2" }, rectRadius: 0.08,
  });
  slide.addText(imp.stat, {
    x: 3.5, y, w: 2.3, h: 0.9,
    fontSize: 16, color: MCG.red, fontFace: "Calibri", bold: true, align: "center", valign: "middle",
  });
  // Description
  slide.addText(imp.desc, {
    x: 6.1, y: y + 0.05, w: 6.7, h: 0.8,
    fontSize: 12, color: MCG.darkText, fontFace: "Calibri", valign: "middle",
  });
});

// CEO quote
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 6.3, w: 12.3, h: 0.55,
  fill: { color: MCG.lightNavy }, rectRadius: 0.08,
});
slide.addText("\"Data quality is now our #1 operational priority for 2026.\" — CEO Ingrid van der Berg, Q3 Review", {
  x: 0.8, y: 6.35, w: 11.8, h: 0.45,
  fontSize: 14, color: MCG.navy, fontFace: "Calibri", italic: true, bold: true,
});

// ═══════════════════════════════════════
// SLIDE 10: Project CLARITY
// ═══════════════════════════════════════
sectionSlide("Project CLARITY", "The path from data chaos to trusted intelligence — $12.4M investment, 952% 3-year ROI");

// ═══════════════════════════════════════
// SLIDE 11: Solution Overview
// ═══════════════════════════════════════
slide = pptx.addSlide();
slide.background = { fill: MCG.white };
addFooter(slide, 11);
slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: MCG.green } });
slide.addText("Project CLARITY — Qlik Platform Solution", {
  x: 0.5, y: 0.2, w: 12, h: 0.6,
  fontSize: 26, color: MCG.navy, fontFace: "Calibri", bold: true,
});

const phases = [
  {
    name: "Phase 1: Foundation", months: "Months 1-8", budget: "$5.2M", color: MCG.teal,
    items: ["CDC from SAP, WMS, Salesforce", "Open Lakehouse Bronze/Silver", "Pipeline monitoring", "Inventory & cold chain dashboards"],
  },
  {
    name: "Phase 2: Analytics & Quality", months: "Months 6-16", budget: "$4.8M", color: MCG.navy,
    items: ["Data quality rules & Trust Score", "Address standardization", "Supplier deduplication", "AutoML predictions"],
  },
  {
    name: "Phase 3: AI & Conversational", months: "Months 14-24", budget: "$2.4M", color: MCG.gold,
    items: ["Qlik Answers (RAG over docs)", "Discovery Agent", "MCP Server", "Conversational analytics"],
  },
];

phases.forEach((p, i) => {
  const x = 0.5 + i * 4.2;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y: 1.0, w: 3.9, h: 4.5,
    fill: { color: MCG.lightGray }, rectRadius: 0.12,
    line: { color: p.color, width: 2 },
  });
  // Phase header
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: x + 0.1, y: 1.1, w: 3.7, h: 0.8,
    fill: { color: p.color }, rectRadius: 0.08,
  });
  slide.addText(p.name, {
    x: x + 0.1, y: 1.1, w: 3.7, h: 0.5,
    fontSize: 14, color: MCG.white, fontFace: "Calibri", bold: true, align: "center",
  });
  slide.addText(`${p.months}  •  ${p.budget}`, {
    x: x + 0.1, y: 1.55, w: 3.7, h: 0.35,
    fontSize: 11, color: "D1E7DD", fontFace: "Calibri", align: "center",
  });
  // Items
  p.items.forEach((item, j) => {
    slide.addText(`▸  ${item}`, {
      x: x + 0.2, y: 2.1 + j * 0.55, w: 3.5, h: 0.5,
      fontSize: 11, color: MCG.darkText, fontFace: "Calibri",
    });
  });
});

// ROI bar
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 5.8, w: 12.3, h: 0.9,
  fill: { color: MCG.navy }, rectRadius: 0.1,
});
slide.addText([
  { text: "Investment: $12.4M", options: { fontSize: 16, color: MCG.white, bold: false } },
  { text: "  |  ", options: { fontSize: 16, color: MCG.teal } },
  { text: "Annual Benefit: $52.7M+", options: { fontSize: 16, color: MCG.green, bold: true } },
  { text: "  |  ", options: { fontSize: 16, color: MCG.teal } },
  { text: "3-Year ROI: 952%", options: { fontSize: 16, color: MCG.gold, bold: true } },
  { text: "  |  ", options: { fontSize: 16, color: MCG.teal } },
  { text: "Payback: < 4 months", options: { fontSize: 16, color: MCG.white } },
], { x: 0.5, y: 5.8, w: 12.3, h: 0.9, fontFace: "Calibri", align: "center", valign: "middle" });

// ═══════════════════════════════════════
// SLIDE 12: Call to Action
// ═══════════════════════════════════════
slide = pptx.addSlide();
slide.background = { fill: MCG.navy };
slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: MCG.gold } });

slide.addText("The Question Is No Longer \"Can We Afford To Do This?\"", {
  x: 0.8, y: 1.5, w: 11.5, h: 1.0,
  fontSize: 34, color: MCG.white, fontFace: "Calibri", bold: true,
});
slide.addText("It's \"Can We Afford Not To?\"", {
  x: 0.8, y: 2.5, w: 11.5, h: 0.8,
  fontSize: 34, color: MCG.gold, fontFace: "Calibri", bold: true, italic: true,
});

slide.addShape(pptx.shapes.RECTANGLE, { x: 0.8, y: 3.6, w: 3, h: 0.04, fill: { color: MCG.teal } });

const closingStats = [
  "$127M in annual losses from data quality failures",
  "74% inventory accuracy vs 97% target",
  "11-day recall trace vs 24-hour regulatory requirement",
  "NVWA citation with Q1 2026 follow-up inspection",
  "536,000 WISMO calls per month ($14.8M annually)",
];
closingStats.forEach((s, i) => {
  slide.addText(`▸  ${s}`, {
    x: 0.8, y: 4.0 + i * 0.4, w: 11.5, h: 0.35,
    fontSize: 15, color: MCG.white, fontFace: "Calibri",
  });
});

slide.addText([
  { text: "MERIDIAN ", options: { bold: true, color: MCG.white } },
  { text: "COMMERCE ", options: { color: MCG.white } },
  { text: "GROUP", options: { bold: true, color: MCG.teal } },
], { x: 0.8, y: 6.3, w: 6, h: 0.5, fontSize: 18, fontFace: "Calibri" });

// ═══════════════════════════════════════
// SAVE
// ═══════════════════════════════════════
const outPath = require("path").join(__dirname, "..", "MCG_Company_Profile_Data_Quality.pptx");
pptx.writeFile({ fileName: outPath }).then(() => {
  console.log(`✅ PowerPoint saved: ${outPath}`);
}).catch(err => {
  console.error("Error:", err);
});
