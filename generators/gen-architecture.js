#!/usr/bin/env node
// =============================================================================
// MCG Technology Architecture PowerPoint Generator
// =============================================================================
// Qlik Colors 2024 palette • Inter font • Presentation-ready sizing
//
// Usage:  node generators/gen-architecture.js
// Output: MCG_Technology_Architecture.pptx + MCG_Technology_Architecture_v2.pptx
// =============================================================================

const PptxGenJS = require("pptxgenjs");
const path = require("path");
const fs = require("fs");

// ─── Qlik Colors 2024 (official brand only — no reds, purples, golds) ───
const C = {
  qlikBlue: "19416C",
  qlikGreen: "009845",
  qlikTeal: "006580",
  qlikCyan: "10CFC9",
  qlikLightGreen: "4CB393",
  qlikGray: "A9B3B6",
  darkText: "454659",
  white: "FFFFFF",
  lightBg: "F6F7F8",
  medGray: "6B7280",
  lightBlue: "E3EAF3",
  lightCyan: "E0F8F7",
  lightTeal: "E0F2F5",
  lightGreen: "E0F5EA",
};

const ASSETS = path.join(__dirname, "assets");
const COVER_BG = path.join(ASSETS, "qlik_cover_bg.png");
const DIVIDER_BG = path.join(ASSETS, "qlik_divider_bg.png");
const QLIK_LOGO = path.join(ASSETS, "qlik_logo.png");
const FONT = "Inter";

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";   // 13.33 × 7.5 inches
pptx.author = "Qlik";
pptx.company = "Qlik / Meridian Commerce Group";
pptx.title = "MCG Technology Architecture — Qlik Cloud Full Stack Demo";

let slideNum = 0;

// ─── HELPERS ───────────────────────────────────────────────────────────────────

function footer(slide) {
  slideNum++;
  slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 7.05, w: 12.33, h: 0.008, fill: { color: C.qlikGray } });
  if (fs.existsSync(QLIK_LOGO))
    slide.addImage({ path: QLIK_LOGO, x: 0.5, y: 7.12, w: 0.65, h: 0.28 });
  slide.addText("MCG Technology Architecture  •  Qlik Cloud", {
    x: 1.3, y: 7.12, w: 8, h: 0.28, fontSize: 8, color: C.qlikGray, fontFace: FONT,
  });
  slide.addText(`${slideNum}`, {
    x: 12, y: 7.12, w: 1, h: 0.28, fontSize: 8, color: C.qlikGray, fontFace: FONT, align: "right",
  });
}

function topBar(slide, color) {
  slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: color || C.qlikGreen } });
}

function contentSlide(title, accentColor) {
  const slide = pptx.addSlide();
  slide.background = { fill: C.white };
  topBar(slide, accentColor || C.qlikGreen);
  footer(slide);
  slide.addText(title, {
    x: 0.6, y: 0.25, w: 12, h: 0.6,
    fontSize: 22, color: C.qlikBlue, fontFace: FONT, bold: true,
  });
  return slide;
}

function dividerSlide(title, subtitle) {
  const slide = pptx.addSlide();
  slide.background = { fill: C.white };
  if (fs.existsSync(DIVIDER_BG))
    slide.addImage({ path: DIVIDER_BG, x: 0, y: 0, w: 13.33, h: 7.5 });
  slide.addText(title, {
    x: 0.8, y: 2.4, w: 8, h: 1.3,
    fontSize: 36, color: C.qlikBlue, fontFace: FONT, bold: true,
  });
  if (subtitle) slide.addText(subtitle, {
    x: 0.8, y: 3.7, w: 8, h: 0.6,
    fontSize: 16, color: C.qlikGreen, fontFace: FONT,
  });
  slideNum++;
}

// ─── Rounded box with label + optional sublabel ───
function box(slide, x, y, w, h, label, sub, bgColor, txtColor) {
  const bg = bgColor || C.lightBg;
  const txt = txtColor || C.white;
  const borderColor = bg === C.white ? C.qlikGray : bg;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, fill: { color: bg }, rectRadius: 0.1,
    line: { color: borderColor, width: 0.5 },
    shadow: { type: "outer", blur: 4, offset: 1.5, color: "000000", opacity: 0.08 },
  });
  if (sub) {
    slide.addText(label, {
      x: x + 0.08, y: y + 0.06, w: w - 0.16, h: h * 0.5,
      fontSize: 12, color: txt, fontFace: FONT, bold: true, align: "center", valign: "bottom",
    });
    slide.addText(sub, {
      x: x + 0.08, y: y + h * 0.5 + 0.02, w: w - 0.16, h: h * 0.42,
      fontSize: 10, color: txt === C.white ? "D0D4D7" : C.medGray,
      fontFace: FONT, align: "center", valign: "top", lineSpacingMultiple: 1.05,
    });
  } else {
    slide.addText(label, {
      x: x + 0.08, y, w: w - 0.16, h,
      fontSize: 12, color: txt, fontFace: FONT, bold: true, align: "center", valign: "middle",
    });
  }
}

// ─── Arrow line ───
function arrow(slide, x1, y1, x2, y2, color) {
  slide.addShape(pptx.shapes.LINE, {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color: color || C.qlikTeal, width: 1.5, endArrowType: "triangle" },
  });
}

// ─── Layer badge (left sidebar label) ───
function layerBadge(slide, y, label, color) {
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.35, y, w: 1.55, h: 0.65,
    fill: { color }, rectRadius: 0.06,
  });
  slide.addText(label, {
    x: 0.35, y, w: 1.55, h: 0.65,
    fontSize: 10, color: C.white, fontFace: FONT, bold: true,
    align: "center", valign: "middle", lineSpacingMultiple: 1.0,
  });
}


// =============================================================================
// SLIDE 1 — COVER
// =============================================================================
(function slide_cover() {
  const slide = pptx.addSlide();
  slide.background = { fill: C.white };
  if (fs.existsSync(COVER_BG))
    slide.addImage({ path: COVER_BG, x: 0, y: 0, w: 13.33, h: 7.5 });
  if (fs.existsSync(QLIK_LOGO))
    slide.addImage({ path: QLIK_LOGO, x: 0.6, y: 0.5, w: 1.5, h: 0.66 });

  slide.addText("Meridian Commerce Group", {
    x: 0.6, y: 1.6, w: 6, h: 0.6,
    fontSize: 17, color: C.qlikGray, fontFace: FONT, letterSpacing: 2,
  });
  slide.addText("Technology\nArchitecture", {
    x: 0.6, y: 2.2, w: 6, h: 1.7,
    fontSize: 40, color: C.qlikBlue, fontFace: FONT, bold: true, lineSpacingMultiple: 1.05,
  });
  slide.addText("Qlik Cloud Full Stack Demo", {
    x: 0.6, y: 4.0, w: 6, h: 0.5,
    fontSize: 16, color: C.qlikGreen, fontFace: FONT, bold: true,
  });
  slide.addText(
    "3 Sources  •  2 Declarative Pipelines  •  Open Lakehouse  •  2 Data Products\n" +
    "2 Analytics Apps  •  2 AutoML Models  •  25 Knowledge Documents  •  MCP + AI Agents", {
    x: 0.6, y: 4.7, w: 6.5, h: 1.0,
    fontSize: 12, color: C.darkText, fontFace: FONT, lineSpacingMultiple: 1.5,
  });

  // Four pillar buttons
  const pillars = [
    { label: "Integration", color: C.qlikGreen },
    { label: "Governance", color: C.qlikTeal },
    { label: "Analytics", color: C.qlikBlue },
    { label: "AI & Outcomes", color: C.qlikLightGreen },
  ];
  pillars.forEach((p, i) => {
    const x = 0.6 + i * 2.6;
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x, y: 6.1, w: 2.3, h: 0.6, fill: { color: p.color }, rectRadius: 0.08,
    });
    slide.addText(p.label, {
      x, y: 6.1, w: 2.3, h: 0.6,
      fontSize: 13, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
    });
  });
  slideNum++;
})();


// =============================================================================
// SLIDE 2 — HIGH-LEVEL ARCHITECTURE OVERVIEW
// =============================================================================
(function slide_overview() {
  const slide = contentSlide("End-to-End Architecture Overview");

  // Y coordinates for the 4 rows (more spacing between them)
  const R1 = 1.1;   // Data Sources
  const R2 = 2.65;  // Integration
  const R3 = 4.15;  // Analytics
  const R4 = 5.55;  // AI & Outcomes
  const RH = 1.0;   // Row height
  const GAP = 0.2;   // Arrow gap
  const LX = 2.15;   // Left edge of content area (after layer badge)

  // Layer badges (left sidebar)
  layerBadge(slide, R1 + 0.17, "DATA\nSOURCES", C.qlikTeal);
  layerBadge(slide, R2 + 0.17, "INTEGRATION", C.qlikGreen);
  layerBadge(slide, R3 + 0.17, "ANALYTICS", C.qlikBlue);
  layerBadge(slide, R4 + 0.17, "AI &\nOUTCOMES", C.qlikLightGreen);

  // ── ROW 1: DATA SOURCES ──
  box(slide, LX, R1, 3.1, RH, "PostgreSQL (WMS)", "CDC • 3 tables • Real-time", C.qlikTeal);
  box(slide, LX + 3.3, R1, 3.1, RH, "Apache Kafka", "Streaming • 2 IoT topics", C.qlikTeal);
  box(slide, LX + 6.6, R1, 3.1, RH, "Salesforce CRM", "Connector • 3 objects • 15 min", C.qlikTeal);

  // Arrows → row 2
  [LX + 1.55, LX + 4.85, LX + 8.15].forEach(ax => arrow(slide, ax, R1 + RH, ax, R2, C.qlikTeal));

  // ── ROW 2: INTEGRATION ──
  // Lakehouse container
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: LX, y: R2, w: 7.7, h: RH,
    fill: { color: C.lightGreen }, rectRadius: 0.12,
    line: { color: C.qlikGreen, width: 1.5 },
  });
  slide.addText("Qlik Open Lakehouse", {
    x: LX, y: R2 - 0.01, w: 7.7, h: 0.32,
    fontSize: 11, color: C.qlikGreen, fontFace: FONT, bold: true, align: "center",
  });
  // Bronze / Silver / Gold inside
  box(slide, LX + 0.2, R2 + 0.32, 2.2, 0.58, "Bronze (8 tables)", "Raw ingestion", C.qlikTeal);
  box(slide, LX + 2.6, R2 + 0.32, 2.2, 0.58, "Silver (8 routes)", "Cleansed + joined", C.qlikGreen);
  box(slide, LX + 5.0, R2 + 0.32, 2.5, 0.58, "Gold (2 products)", "Governed + API-shared", C.qlikBlue);
  // Horizontal arrows between medal tiers
  arrow(slide, LX + 2.4, R2 + 0.61, LX + 2.6, R2 + 0.61, C.qlikGreen);
  arrow(slide, LX + 4.8, R2 + 0.61, LX + 5.0, R2 + 0.61, C.qlikBlue);
  // Talend box
  box(slide, LX + 7.9, R2, 1.85, RH, "Talend Cloud", "Address Validation\n+ Stewardship", C.qlikGreen);

  // Qlik Cloud Pipelines band — sits on the source→lakehouse flow
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: LX, y: R2 - 0.42, w: 7.7, h: 0.33,
    fill: { color: C.qlikGreen }, rectRadius: 0.08,
    shadow: { type: "outer", blur: 3, offset: 1, color: "000000", opacity: 0.12 },
  });
  slide.addText("Qlik Cloud Pipelines  •  MCG Batch + MCG Streaming  •  declarative YAML, API-imported", {
    x: LX, y: R2 - 0.42, w: 7.7, h: 0.33,
    fontSize: 10, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });

  // Arrows → row 3
  [LX + 2.0, LX + 6.5].forEach(ax => arrow(slide, ax, R2 + RH, ax, R3, C.qlikGreen));

  // ── ROW 3: ANALYTICS ──
  box(slide, LX, R3, 3.0, RH, "Qlik Analytics", "2 apps • 10 sheets", C.qlikBlue);
  box(slide, LX + 3.2, R3, 3.0, RH, "Qlik Predict", "Exceedance • Late Delivery", C.qlikBlue);
  box(slide, LX + 6.4, R3, 3.35, RH, "Governance & Trust", "Trust Score • Stewardship\nGlossary • Lineage", C.qlikBlue);

  // Arrows → row 4
  [LX + 1.5, LX + 4.7, LX + 8.1].forEach(ax => arrow(slide, ax, R3 + RH, ax, R4, C.qlikBlue));

  // ── ROW 4: AI & OUTCOMES ──
  const ai4 = [
    { off: 0,    w: 2.3, label: "Qlik Answers", sub: "25 DOCX docs\nKnowledge base" },
    { off: 2.5,  w: 2.3, label: "Discovery Agent", sub: "Anomaly detection\nProactive alerts" },
    { off: 5.0,  w: 2.3, label: "MCP Server", sub: "Claude integration\nAgentic queries" },
    { off: 7.5,  w: 2.25, label: "Automations", sub: "Teams alerts\nTalend jobs" },
  ];
  ai4.forEach(b => box(slide, LX + b.off, R4, b.w, RH, b.label, b.sub, C.qlikLightGreen, C.white));

  // Side callout
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 11.75, y: 1.1, w: 1.35, h: 1.0,
    fill: { color: C.lightBlue }, rectRadius: 0.08,
    line: { color: C.qlikBlue, width: 1 },
  });
  slide.addText("7 Data Quality\nNightmares\n$127M/yr", {
    x: 11.75, y: 1.1, w: 1.35, h: 1.0,
    fontSize: 9, color: C.qlikBlue, fontFace: FONT, bold: true,
    align: "center", valign: "middle", lineSpacingMultiple: 1.2,
  });
})();


// =============================================================================
// SLIDE 3 — DATA SOURCES DETAIL
// =============================================================================
(function slide_sources() {
  const slide = contentSlide("Data Sources — Three Pillars", C.qlikTeal);

  const sources = [
    {
      x: 0.5, color: C.qlikBlue, bg: C.lightBlue,
      title: "PostgreSQL (WMS)", subtitle: "Change Data Capture • Real-time",
      tables: [
        ["inventory_positions", "~8,000 rows", "Stock levels by DC/SKU"],
        ["warehouse_events", "~15,000 rows", "Pick, pack, ship events"],
        ["shipments", "~3,000 rows", "Outbound shipment tracking"],
      ],
      issues: [
        "Phantom inventory (WMS vs ERP mismatch)",
        "Missing lot numbers on 15% of perishables",
        "Timestamp drift between WMS and SAP",
        "Silent pipeline failures (72h undetected)",
      ],
    },
    {
      x: 4.6, color: C.qlikTeal, bg: C.lightTeal,
      title: "Apache Kafka (IoT)", subtitle: "Streaming • Confluent Platform",
      tables: [
        ["mcg.iot.cold-chain", "~1 msg/5s", "Temperature, humidity, GPS"],
        ["mcg.iot.carrier-events", "~1 msg/min", "Carrier status updates"],
      ],
      issues: [
        "5% readings in Fahrenheit (mixed units)",
        "3% bare timestamps (no timezone)",
        "2% Lagos GPS blackouts",
        "8.8% GRU-BA temp exceedances",
        "Carrier status in 5 languages",
      ],
    },
    {
      x: 8.7, color: C.qlikGreen, bg: C.lightGreen,
      title: "Salesforce CRM", subtitle: "Standard Connector • 15-min polling",
      tables: [
        ["Contact", "18.4M records", "Customer addresses"],
        ["MCG_Order__c", "~12,000", "Order details + SLAs"],
        ["MCG_Product__c", "~5,000", "Product catalog"],
      ],
      issues: [
        "11% address format inconsistencies",
        "6% truncated addresses (30-char limit)",
        "Duplicate customer records (fuzzy)",
        "Mixed naming conventions",
      ],
    },
  ];

  sources.forEach(s => {
    const W = 3.9;
    // Card background
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: s.x, y: 1.1, w: W, h: 5.6, fill: { color: s.bg }, rectRadius: 0.12,
      line: { color: s.color, width: 1.5 },
    });
    // Title
    slide.addText(s.title, {
      x: s.x, y: 1.15, w: W, h: 0.45,
      fontSize: 14, color: s.color, fontFace: FONT, bold: true, align: "center", valign: "middle",
    });
    slide.addText(s.subtitle, {
      x: s.x, y: 1.55, w: W, h: 0.3,
      fontSize: 10, color: C.medGray, fontFace: FONT, align: "center",
    });
    // Table/topic boxes
    s.tables.forEach((t, i) => {
      const y = 2.0 + i * 0.72;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: s.x + 0.15, y, w: W - 0.3, h: 0.62,
        fill: { color: C.white }, rectRadius: 0.06,
        line: { color: s.color, width: 0.75 },
      });
      slide.addText(t[0], {
        x: s.x + 0.25, y, w: W - 0.5, h: 0.32,
        fontSize: 11, color: s.color, fontFace: FONT, bold: true, valign: "bottom",
      });
      slide.addText(`${t[1]}  •  ${t[2]}`, {
        x: s.x + 0.25, y: y + 0.3, w: W - 0.5, h: 0.28,
        fontSize: 9, color: C.medGray, fontFace: FONT, valign: "top",
      });
    });
    // Data Quality issues
    const iy = s.tables.length === 2 ? 3.6 : 4.3;
    slide.addText("Data Quality Issues", {
      x: s.x + 0.15, y: iy, w: W - 0.3, h: 0.35,
      fontSize: 11, color: s.color, fontFace: FONT, bold: true,
    });
    const issueText = s.issues.map(t => `•  ${t}`).join("\n");
    slide.addText(issueText, {
      x: s.x + 0.15, y: iy + 0.35, w: W - 0.3, h: 2.2,
      fontSize: 10, color: C.darkText, fontFace: FONT, lineSpacingMultiple: 1.35,
    });
  });
})();


// =============================================================================
// SLIDE 4 — OPEN LAKEHOUSE (MEDALLION ARCHITECTURE)
// =============================================================================
(function slide_lakehouse() {
  const slide = contentSlide("Open Lakehouse — Medallion Architecture", C.qlikGreen);

  const cols = [
    { x: 0.5, w: 3.6, label: "BRONZE", sub: "Raw Ingestion", color: C.qlikTeal, bg: C.lightTeal,
      items: [
        "inventory_positions (CDC)", "warehouse_events (CDC)", "shipments (CDC)",
        "sf_contacts (API)", "sf_orders (API)", "sf_products (API)",
        "iot_cold_chain (Stream)", "iot_carrier_events (Stream)",
      ]},
    { x: 4.6, w: 3.7, label: "SILVER", sub: "Transformation Routes", color: C.qlikGreen, bg: C.lightGreen,
      items: [
        "1. Timestamp Normalization", "2. Inventory Reconciliation",
        "3. Address Standardization", "4. Product Harmonization",
        "5. Carrier Canonicalization", "6. IoT Normalization",
        "7. Supplier Deduplication", "8. Order-to-Delivery Timeline",
      ]},
    { x: 8.8, w: 3.9, label: "GOLD", sub: "Governed Data Products", color: C.qlikBlue, bg: C.lightBlue,
      items: [
        "supply_chain_health", "last_mile_performance",
      ]},
  ];

  cols.forEach(col => {
    // Column background
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: col.x, y: 1.1, w: col.w, h: 5.65, fill: { color: col.bg }, rectRadius: 0.12,
      line: { color: col.color, width: 1.5 },
    });
    // Header badge
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: col.x + 0.2, y: 1.25, w: col.w - 0.4, h: 0.6,
      fill: { color: col.color }, rectRadius: 0.06,
    });
    slide.addText(col.label, {
      x: col.x + 0.2, y: 1.25, w: col.w - 0.4, h: 0.38,
      fontSize: 15, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "bottom",
    });
    slide.addText(col.sub, {
      x: col.x + 0.2, y: 1.6, w: col.w - 0.4, h: 0.25,
      fontSize: 10, color: "D0D4D7", fontFace: FONT, align: "center",
    });
    // Items
    col.items.forEach((item, i) => {
      const y = 2.05 + i * 0.56;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: col.x + 0.15, y, w: col.w - 0.3, h: 0.46,
        fill: { color: C.white }, rectRadius: 0.06,
        line: { color: col.color, width: 0.75 },
      });
      slide.addText(item, {
        x: col.x + 0.28, y, w: col.w - 0.56, h: 0.46,
        fontSize: 10, color: C.darkText, fontFace: FONT, valign: "middle",
      });
    });
  });

  // Flow arrows between columns
  [4.1, 8.5].forEach(x => {
    slide.addShape(pptx.shapes.LINE, {
      x, y: 3.8, w: 0.5, h: 0,
      line: { color: C.qlikGreen, width: 2, endArrowType: "triangle" },
    });
  });
  slide.addText("8 Flows +\nTalend Jobs", {
    x: 3.95, y: 3.2, w: 0.8, h: 0.5,
    fontSize: 8, color: C.qlikGreen, fontFace: FONT, align: "center", bold: true,
  });
  slide.addText("7 Table\nRecipes", {
    x: 8.35, y: 3.2, w: 0.8, h: 0.5,
    fontSize: 8, color: C.qlikBlue, fontFace: FONT, align: "center", bold: true,
  });
})();


// =============================================================================
// SLIDE 5 — TRANSFORMATION ROUTES
// =============================================================================
(function slide_routes() {
  const slide = contentSlide("8 Transformation Routes — Nightmare Mapping", C.qlikGreen);

  const routes = [
    { name: "Timestamp Normalization", nightmare: "#5 Timestamp Tower of Babel", desc: "All timestamps → UTC with source tracking" },
    { name: "Inventory Reconciliation", nightmare: "#1 Phantom Inventory", desc: "WMS vs ERP comparison, phantom detection" },
    { name: "Address Standardization", nightmare: "#2 Address Catastrophe", desc: "Fuzzy matching, postal code normalization" },
    { name: "Product Harmonization", nightmare: "#3 Product Master Mess", desc: "SKU resolution, weight/UoM standardization" },
    { name: "Carrier Canonicalization", nightmare: "#6 Carrier Data Black Hole", desc: "Multi-language status → MCG canonical codes" },
    { name: "IoT Normalization", nightmare: "#5 + #6 Combined", desc: "Celsius normalization, GPS gap detection" },
    { name: "Supplier Deduplication", nightmare: "#3 Product Master Mess", desc: "Fuzzy name matching, canonical ID assignment" },
    { name: "Order-to-Delivery Timeline", nightmare: "#5 + #6 Combined", desc: "End-to-end order lifecycle assembly" },
  ];

  // Table header
  const HY = 1.1;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: HY, w: 12.33, h: 0.5,
    fill: { color: C.qlikGreen }, rectRadius: 0.06,
  });
  slide.addText("Route", { x: 0.7, y: HY, w: 3.3, h: 0.5, fontSize: 12, color: C.white, fontFace: FONT, bold: true, valign: "middle" });
  slide.addText("Nightmare Addressed", { x: 4.1, y: HY, w: 3.6, h: 0.5, fontSize: 12, color: C.white, fontFace: FONT, bold: true, valign: "middle" });
  slide.addText("Key Transformation", { x: 7.9, y: HY, w: 4.8, h: 0.5, fontSize: 12, color: C.white, fontFace: FONT, bold: true, valign: "middle" });

  routes.forEach((r, i) => {
    const y = HY + 0.55 + i * 0.6;
    const bg = i % 2 === 0 ? C.lightBg : C.white;
    slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y, w: 12.33, h: 0.55, fill: { color: bg } });
    slide.addText(`${i + 1}. ${r.name}`, { x: 0.7, y, w: 3.3, h: 0.55, fontSize: 11, color: C.qlikBlue, fontFace: FONT, bold: true, valign: "middle" });
    slide.addText(r.nightmare, { x: 4.1, y, w: 3.6, h: 0.55, fontSize: 11, color: C.qlikTeal, fontFace: FONT, bold: true, valign: "middle" });
    slide.addText(r.desc, { x: 7.9, y, w: 4.8, h: 0.55, fontSize: 11, color: C.darkText, fontFace: FONT, valign: "middle" });
  });

  // Talend callout bar
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 6.3, w: 12.33, h: 0.5,
    fill: { color: C.lightGreen }, rectRadius: 0.06,
    line: { color: C.qlikGreen, width: 1 },
  });
  slide.addText("+ Talend Address Validation Job (callable service)   •   All 8 routes defined as declarative YAML — version-controlled, API-imported, daily-scheduled (QTCP preview)", {
    x: 0.7, y: 6.3, w: 12, h: 0.5,
    fontSize: 10, color: C.qlikGreen, fontFace: FONT, bold: true, valign: "middle",
  });
})();


// =============================================================================
// SLIDE 6 — DATA PRODUCTS
// =============================================================================
(function slide_products() {
  const slide = contentSlide("Gold-Layer Data Products", C.qlikBlue);

  const products = [
    { name: "Supply Chain Health",   owner: "Henrik Jansen", refresh: "Daily 06:00 UTC", kpi: "IRA: 97% target", color: C.qlikTeal },
    { name: "Last Mile Performance", owner: "Sophie Müller", refresh: "Daily 06:00 UTC", kpi: "On-time: 92%",    color: C.qlikGreen },
  ];

  slide.addText("One governed mart per analytics domain app — created by the pipeline's gold datamart task, attached via the Data Products API", {
    x: 0.5, y: 0.95, w: 12.33, h: 0.4,
    fontSize: 12, color: C.medGray, fontFace: FONT, align: "center", valign: "middle",
  });

  products.forEach((p, i) => {
    const x = 0.9 + i * 6.1;
    const y = 1.7;
    const w = 5.5;
    const h = 2.55;

    // Card
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x, y, w, h, fill: { color: C.white }, rectRadius: 0.12,
      line: { color: p.color, width: 1.5 },
      shadow: { type: "outer", blur: 4, offset: 1.5, color: "000000", opacity: 0.08 },
    });
    // Accent bar
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: x + 0.08, y: y + 0.06, w: w - 0.16, h: 0.06, fill: { color: p.color },
    });
    // Name
    slide.addText(p.name, {
      x, y: y + 0.2, w, h: 0.45,
      fontSize: 13, color: C.qlikBlue, fontFace: FONT, bold: true, align: "center", valign: "middle",
    });
    // Details
    slide.addText(`Owner: ${p.owner}`, {
      x: x + 0.2, y: y + 0.75, w: w - 0.4, h: 0.3,
      fontSize: 10, color: C.medGray, fontFace: FONT, valign: "middle",
    });
    slide.addText(`Refresh: ${p.refresh}`, {
      x: x + 0.2, y: y + 1.05, w: w - 0.4, h: 0.3,
      fontSize: 10, color: C.medGray, fontFace: FONT, valign: "middle",
    });
    slide.addText(`KPI: ${p.kpi}`, {
      x: x + 0.2, y: y + 1.35, w: w - 0.4, h: 0.3,
      fontSize: 11, color: p.color, fontFace: FONT, bold: true, valign: "middle",
    });
    // Capabilities pill
    slide.addText("Trust Score  •  API Sharing  •  Lineage", {
      x, y: y + 1.9, w, h: 0.3,
      fontSize: 9, color: C.qlikGray, fontFace: FONT, align: "center", italic: true,
    });
  });
})();


// ─── DIVIDER ───
dividerSlide("Analytics &\nAI Layer", "Qlik Analytics  •  Predict  •  Answers  •  Discovery Agent  •  MCP");

// =============================================================================
// SLIDE 8 — ANALYTICS & AI
// =============================================================================
(function slide_analytics_ai() {
  const slide = contentSlide("Analytics & AI Layer", C.qlikBlue);

  // ── Qlik Analytics ──
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 1.1, w: 6.1, h: 2.6, fill: { color: C.lightBlue }, rectRadius: 0.12,
    line: { color: C.qlikBlue, width: 1.5 },
  });
  slide.addText("Qlik Analytics — 2 Domain Apps", {
    x: 0.5, y: 1.12, w: 6.1, h: 0.42,
    fontSize: 14, color: C.qlikBlue, fontFace: FONT, bold: true, align: "center",
  });
  box(slide, 0.75, 1.65, 2.7, 0.9, "Supply Chain Operations", "5 sheets: Inventory, Cold Chain,\nQuality, Compliance, Cost", C.qlikTeal);
  box(slide, 3.6, 1.65, 2.7, 0.9, "Delivery & Customer Exp.", "5 sheets: Last Mile, Tracking,\nWISMO, Orders, Addresses", C.qlikTeal);
  slide.addText("MCG Dark Theme  •  Streaming IoT  •  Section Access  •  Business Logic  •  NLI", {
    x: 0.5, y: 2.75, w: 6.1, h: 0.35,
    fontSize: 9, color: C.medGray, fontFace: FONT, align: "center",
  });

  // ── Qlik Predict ──
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 6.85, y: 1.1, w: 5.95, h: 2.6, fill: { color: C.lightTeal }, rectRadius: 0.12,
    line: { color: C.qlikTeal, width: 1.5 },
  });
  slide.addText("Qlik Predict — 2 AutoML Models", {
    x: 6.85, y: 1.12, w: 5.95, h: 0.42,
    fontSize: 14, color: C.qlikTeal, fontFace: FONT, bold: true, align: "center",
  });
  box(slide, 7.1, 1.65, 2.7, 0.9, "Cold Chain Exceedance", "Target: alert_flag\nTop: temperature_c, route_id", C.qlikTeal);
  box(slide, 9.95, 1.65, 2.6, 0.9, "Late Delivery Predictor", "Target: delivered_late\nTop: tracking_missing", C.qlikTeal);
  slide.addText("AutoML  •  Feature Importance  •  API Sharing  •  Deployed to Production", {
    x: 6.85, y: 2.75, w: 5.95, h: 0.35,
    fontSize: 9, color: C.medGray, fontFace: FONT, align: "center",
  });

  // ── AI & Agentic Layer ──
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 4.05, w: 12.3, h: 2.7, fill: { color: C.lightGreen }, rectRadius: 0.12,
    line: { color: C.qlikLightGreen, width: 1.5 },
  });
  slide.addText("AI & Agentic Layer", {
    x: 0.5, y: 4.05, w: 12.3, h: 0.42,
    fontSize: 14, color: C.qlikLightGreen, fontFace: FONT, bold: true, align: "center",
  });
  const aiBoxes = [
    { x: 0.75, label: "Qlik Answers", sub: "25 DOCX docs\n6 demo scenarios\nKnowledge Mart" },
    { x: 3.6,  label: "Discovery Agent", sub: "Anomaly detection\nTransFrio spoilage\nProactive alerts" },
    { x: 6.45, label: "MCP Server", sub: "Claude integration\n5 demo prompts\nData + docs" },
    { x: 9.3,  label: "Automations", sub: "5 automations\nTeams integration\nTalend job trigger" },
  ];
  aiBoxes.forEach(b => box(slide, b.x, 4.6, 2.6, 1.9, b.label, b.sub, C.qlikLightGreen, C.white));
})();


// ─── DIVIDER ───
dividerSlide("The 7 Nightmares", "$127M in annual data quality costs");

// =============================================================================
// SLIDE 10 — 7 NIGHTMARES
// =============================================================================
(function slide_nightmares() {
  const slide = contentSlide("The 7 Data Quality Nightmares — $127M Annual Impact", C.qlikBlue);

  const nightmares = [
    { num: "1", name: "Phantom Inventory", cost: "$41M", desc: "ERP says 50, WMS says 42. Stockouts from ghost inventory." },
    { num: "2", name: "Address Catastrophe", cost: "$31M", desc: "11% format issues, 6% truncated. 4.7% carrier rejection." },
    { num: "3", name: "Product Master Mess", cost: "$14M", desc: "8,200 missing weights, duplicated suppliers, SKU chaos." },
    { num: "4", name: "Silent Pipeline Failures", cost: "$4M", desc: "Rotterdam CDC sync: 72h undetected. 847 phantom units." },
    { num: "5", name: "Timestamp Tower of Babel", cost: "$6M", desc: "Mixed UTC/local/bare timestamps across 3 sources." },
    { num: "6", name: "Carrier Data Black Hole", cost: "$22M", desc: "6 carriers, 5 languages, no canonical status mapping." },
    { num: "7", name: "Compliance Traceability Gap", cost: "$9M", desc: "Lettuce recall: 11 days vs 24h requirement. NVWA citation." },
  ];

  nightmares.forEach((n, i) => {
    const y = 1.15 + i * 0.8;
    // Number circle
    slide.addShape(pptx.shapes.OVAL, {
      x: 0.6, y: y + 0.05, w: 0.56, h: 0.56, fill: { color: C.qlikBlue },
    });
    slide.addText(n.num, {
      x: 0.6, y: y + 0.05, w: 0.56, h: 0.56,
      fontSize: 18, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
    });
    // Name + cost
    slide.addText(n.name, {
      x: 1.4, y, w: 3.0, h: 0.38,
      fontSize: 13, color: C.qlikBlue, fontFace: FONT, bold: true, valign: "middle",
    });
    slide.addText(n.cost + " / year", {
      x: 1.4, y: y + 0.35, w: 2.0, h: 0.3,
      fontSize: 11, color: C.qlikTeal, fontFace: FONT, bold: true,
    });
    // Description
    slide.addText(n.desc, {
      x: 4.6, y, w: 8.2, h: 0.68,
      fontSize: 11, color: C.darkText, fontFace: FONT, valign: "middle",
    });
    // Separator line
    if (i < 6) {
      slide.addShape(pptx.shapes.RECTANGLE, {
        x: 0.5, y: y + 0.74, w: 12.33, h: 0.005, fill: { color: C.lightBg },
      });
    }
  });
})();


// =============================================================================
// SLIDE 11 — PIPELINE & CLUSTER ARCHITECTURE
// =============================================================================
(function slide_clusters() {
  const slide = contentSlide("Pipeline & Cluster Architecture", C.qlikTeal);

  // ── CDC Cluster ──
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 1.1, w: 6.0, h: 3.5, fill: { color: C.lightTeal }, rectRadius: 0.12,
    line: { color: C.qlikTeal, width: 1.5 },
  });
  slide.addText("CDC Cluster", {
    x: 0.5, y: 1.12, w: 6.0, h: 0.42,
    fontSize: 16, color: C.qlikTeal, fontFace: FONT, bold: true, align: "center",
  });
  slide.addText("PostgreSQL CDC + Salesforce incremental sync", {
    x: 0.5, y: 1.52, w: 6.0, h: 0.3,
    fontSize: 10, color: C.medGray, fontFace: FONT, align: "center",
  });
  const cdcPipes = [
    "Pipeline 1: inventory_positions (CDC, real-time)",
    "Pipeline 2: warehouse_events (CDC, real-time)",
    "Pipeline 3: shipments (CDC, real-time)",
    "Pipeline 6: sf_contacts (API, 15 min)",
    "Pipeline 7: sf_orders (API, 15 min)",
    "Pipeline 8: sf_products (API, 15 min)",
  ];
  cdcPipes.forEach((p, i) => {
    slide.addText(p, {
      x: 0.75, y: 2.0 + i * 0.42, w: 5.5, h: 0.38,
      fontSize: 11, color: C.darkText, fontFace: FONT, valign: "middle",
      fill: { color: i % 2 === 0 ? C.white : C.lightBg },
    });
  });

  // ── Streaming Cluster ──
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 6.8, y: 1.1, w: 6.0, h: 3.5, fill: { color: C.lightGreen }, rectRadius: 0.12,
    line: { color: C.qlikGreen, width: 1.5 },
  });
  slide.addText("Streaming Cluster", {
    x: 6.8, y: 1.12, w: 6.0, h: 0.42,
    fontSize: 16, color: C.qlikGreen, fontFace: FONT, bold: true, align: "center",
  });
  slide.addText("Real-time Kafka ingestion from IoT topics", {
    x: 6.8, y: 1.52, w: 6.0, h: 0.3,
    fontSize: 10, color: C.medGray, fontFace: FONT, align: "center",
  });
  const streamPipes = [
    "Pipeline 4: mcg.iot.cold-chain → bronze.iot_cold_chain",
    "Pipeline 5: mcg.iot.carrier-events → bronze.iot_carrier_events",
  ];
  streamPipes.forEach((p, i) => {
    slide.addText(p, {
      x: 7.05, y: 2.0 + i * 0.42, w: 5.5, h: 0.38,
      fontSize: 11, color: C.darkText, fontFace: FONT, valign: "middle",
      fill: { color: i % 2 === 0 ? C.white : C.lightBg },
    });
  });

  // ── Infrastructure ──
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 5.0, w: 12.3, h: 1.7, fill: { color: C.lightBg }, rectRadius: 0.1,
    line: { color: C.qlikGray, width: 1 },
  });
  slide.addText("Infrastructure Components", {
    x: 0.5, y: 5.0, w: 12.3, h: 0.38,
    fontSize: 13, color: C.darkText, fontFace: FONT, bold: true, align: "center",
  });
  const infra = [
    { x: 0.75, label: "Data Movement\nGateway", sub: "On-prem PostgreSQL" },
    { x: 3.25, label: "Data Gateway\nStreaming", sub: "Kafka connectivity" },
    { x: 5.75, label: "Docker Compose", sub: "Confluent Platform" },
    { x: 8.25, label: "IoT Simulator", sub: "kafka_iot_simulator.py" },
    { x: 10.55, label: "WMS Simulator", sub: "postgres_simulator.py" },
  ];
  infra.forEach(b => {
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: b.x, y: 5.5, w: 2.25, h: 1.0, fill: { color: C.white }, rectRadius: 0.06,
      line: { color: C.qlikGray, width: 0.75 },
    });
    slide.addText(b.label, {
      x: b.x, y: 5.52, w: 2.25, h: 0.52,
      fontSize: 10, color: C.qlikBlue, fontFace: FONT, bold: true, align: "center", valign: "bottom",
    });
    slide.addText(b.sub, {
      x: b.x, y: 6.02, w: 2.25, h: 0.4,
      fontSize: 9, color: C.medGray, fontFace: FONT, align: "center", valign: "top",
    });
  });
})();


// =============================================================================
// SLIDE 12 — COMPONENT SUMMARY
// =============================================================================
(function slide_summary() {
  const slide = contentSlide("Full Stack Component Summary");

  const components = [
    { category: "Data Sources (3)", items: "PostgreSQL WMS (CDC)  •  Apache Kafka 2 topics (streaming)  •  Salesforce CRM (API)", color: C.qlikTeal },
    { category: "Open Lakehouse", items: "2 declarative pipeline projects (batch + streaming)  •  8 Bronze tables  •  8 Silver transforms  •  2 Gold products", color: C.qlikGreen },
    { category: "Governance", items: "Trust Score  •  Data Lineage  •  Impact Analysis  •  Profiling  •  25-term Glossary  •  4 Stewardship campaigns", color: C.qlikTeal },
    { category: "Analytics", items: "2 Qlik Analytics apps (10 sheets)  •  MCG Dark Theme  •  Streaming IoT  •  Alerts  •  Reports", color: C.qlikBlue },
    { category: "AI / ML", items: "2 Predict models (Exceedance + Late Delivery)  •  Qlik Answers (25 docs)  •  Discovery Agent  •  MCP Server", color: C.qlikLightGreen },
    { category: "Automation", items: "5 automations: App Reload, Cold Chain Alert, Pipeline Health, WISMO, Address Correction", color: C.qlikGreen },
    { category: "Infrastructure", items: "Docker Compose (Confluent)  •  3 simulators (PG, Kafka, SF)  •  Deploy script  •  Setup guide", color: C.qlikGray },
  ];

  components.forEach((c, i) => {
    const y = 1.15 + i * 0.82;
    // Category badge
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.5, y, w: 2.9, h: 0.65, fill: { color: c.color }, rectRadius: 0.06,
    });
    slide.addText(c.category, {
      x: 0.5, y, w: 2.9, h: 0.65,
      fontSize: 12, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
    });
    // Items
    slide.addText(c.items, {
      x: 3.6, y, w: 9.2, h: 0.65,
      fontSize: 11, color: C.darkText, fontFace: FONT, valign: "middle",
    });
  });

  // Total count bar
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 6.9, w: 12.33, h: 0.45,
    fill: { color: C.qlikBlue }, rectRadius: 0.06,
  });
  slide.addText("3 Sources  •  2 Pipelines  •  18 Tables  •  2 Products  •  10 Sheets  •  2 Models  •  25 Docs  •  5 Automations  •  1 MCP Server", {
    x: 0.5, y: 6.9, w: 12.33, h: 0.45,
    fontSize: 11, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
})();


// =============================================================================
// SAVE
// =============================================================================
const outPath = path.join(__dirname, "..", "MCG_Technology_Architecture.pptx");

pptx.writeFile({ fileName: outPath }).then(() => {
  console.log(`\n  ✓ Generated: ${path.basename(outPath)}`);
  console.log(`    ${slideNum} slides\n`);
}).catch(err => {
  console.error("ERROR:", err);
  process.exit(1);
});
