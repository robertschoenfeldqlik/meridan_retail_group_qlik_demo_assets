// Generate MCG Demo Overview PowerPoint — Four Stories
// Uses Qlik brand template (colors, fonts, contrail backgrounds, logo)
// Integration | Data Governance | Analytics | AI
const PptxGenJS = require("pptxgenjs");
const path = require("path");

// ─── Qlik brand palette (from Qlik Powerpoint template theme1.xml) ───
const C = {
  // Primary Qlik colors
  qlikBlue: "19416C",    // dk2 — primary dark blue
  qlikGreen: "009845",   // accent1 — Qlik green
  qlikTeal: "006580",    // accent3 — teal
  qlikCyan: "10CFC9",    // accent4 — bright cyan
  qlikPurple: "93579C",  // accent5 — purple
  qlikGray: "A9B3B6",    // accent6 — medium gray
  // Text & backgrounds
  darkText: "545659",    // dk1 — main dark text
  white: "FFFFFF",       // lt1
  lightBg: "F6F7F8",     // lt2 — light background
  // Extended palette
  medGray: "6B7280",
  red: "DC2626",
  lightGreen: "D1FAE5",
  lightRed: "FEE2E2",
  lightCyan: "E0F8F7",
  lightBlue: "E3EAF3",
  lightPurple: "EDE9FE",
  lightGold: "FEF3C7",
};

// ─── Asset paths ───
const ASSETS = path.join(__dirname, "assets");
const COVER_BG = path.join(ASSETS, "qlik_cover_bg.png");
const DIVIDER_BG = path.join(ASSETS, "qlik_divider_bg.png");
const QLIK_LOGO = path.join(ASSETS, "qlik_logo.png");
const FONT = "Inter";

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pptx.author = "Qlik";
pptx.company = "Qlik";
pptx.title = "MCG Qlik Cloud Demo — Four Stories";

let slideNum = 0;

// ─── HELPERS ───────────────────────────────────────
function footer(slide) {
  slideNum++;
  // Thin line separator
  slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 7.0, w: 12.33, h: 0.01, fill: { color: C.qlikGray } });
  // Qlik logo small
  slide.addImage({ path: QLIK_LOGO, x: 0.5, y: 7.1, w: 0.7, h: 0.3 });
  slide.addText("MCG End-to-End Demo  •  Qlik Cloud", {
    x: 1.4, y: 7.1, w: 8, h: 0.3,
    fontSize: 8, color: C.qlikGray, fontFace: FONT,
  });
  slide.addText(`${slideNum}`, {
    x: 12, y: 7.1, w: 1, h: 0.3,
    fontSize: 8, color: C.qlikGray, fontFace: FONT, align: "right",
  });
}

function topBar(slide, color) {
  slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.05, fill: { color: color || C.qlikGreen } });
}

function contentSlide(title, accentColor) {
  const slide = pptx.addSlide();
  slide.background = { fill: C.white };
  topBar(slide, accentColor || C.qlikGreen);
  footer(slide);
  slide.addText(title, {
    x: 0.5, y: 0.2, w: 12, h: 0.65,
    fontSize: 26, color: C.qlikBlue, fontFace: FONT, bold: true,
  });
  return slide;
}

function sectionSlide(number, title, subtitle, color) {
  const slide = pptx.addSlide();
  slide.background = { fill: C.white };
  slideNum++;
  // Contrail background (divider pattern — streaks on left)
  slide.addImage({ path: DIVIDER_BG, x: 0, y: 0, w: 13.33, h: 7.5 });
  // Dark overlay on left half for text readability
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 0, w: 7.5, h: 7.5,
    fill: { color: C.qlikBlue, type: "solid" },
    transparency: 15,
  });
  // Number badge
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.8, y: 2.0, w: 0.9, h: 0.9,
    fill: { color: C.qlikGreen }, rectRadius: 0.1,
  });
  slide.addText(number, {
    x: 0.8, y: 2.0, w: 0.9, h: 0.9,
    fontSize: 36, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
  // Accent bar
  slide.addShape(pptx.shapes.RECTANGLE, { x: 2.0, y: 2.85, w: 2.5, h: 0.05, fill: { color: C.qlikGreen } });
  slide.addText(title, {
    x: 0.8, y: 3.1, w: 6.0, h: 1.0,
    fontSize: 36, color: C.white, fontFace: FONT, bold: true,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.8, y: 4.2, w: 6.0, h: 0.8,
      fontSize: 16, color: C.qlikCyan, fontFace: FONT, italic: true,
    });
  }
  // Qlik logo bottom-right
  slide.addImage({ path: QLIK_LOGO, x: 11.0, y: 6.5, w: 1.5, h: 0.66 });
  return slide;
}

function metricBoxes(slide, metrics, startY) {
  const count = metrics.length;
  const boxW = Math.min(3.8, (12.3 - (count - 1) * 0.3) / count);
  const gap = (12.3 - count * boxW) / (count - 1 || 1);
  metrics.forEach((m, i) => {
    const x = 0.5 + i * (boxW + gap);
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x, y: startY, w: boxW, h: 1.3,
      fill: { color: C.lightBg }, rectRadius: 0.1,
      line: { color: m.color || C.qlikTeal, width: 1.5 },
    });
    slide.addText(m.val, {
      x, y: startY + 0.1, w: boxW, h: 0.65,
      fontSize: 28, color: m.color || C.qlikTeal, fontFace: FONT, bold: true, align: "center",
    });
    slide.addText(m.label, {
      x, y: startY + 0.75, w: boxW, h: 0.4,
      fontSize: 11, color: C.medGray, fontFace: FONT, align: "center",
    });
  });
}

function bulletList(slide, items, x, y, w, opts = {}) {
  items.forEach((item, i) => {
    const text = typeof item === "string" ? item : item.text;
    const isBold = typeof item === "object" && item.bold;
    slide.addText(`▸  ${text}`, {
      x, y: y + i * (opts.spacing || 0.42), w, h: opts.h || 0.38,
      fontSize: opts.fontSize || 12, color: opts.color || C.darkText,
      fontFace: FONT, bold: isBold,
    });
  });
}

function recommendBox(slide, title, items, y, bgColor) {
  const boxH = 0.35 + items.length * 0.35;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y, w: 12.3, h: boxH,
    fill: { color: bgColor || C.lightGreen }, rectRadius: 0.1,
  });
  slide.addText(`★  ${title}`, {
    x: 0.7, y: y + 0.05, w: 5, h: 0.35,
    fontSize: 13, color: C.qlikBlue, fontFace: FONT, bold: true,
  });
  items.forEach((item, i) => {
    slide.addText(`→  ${item}`, {
      x: 0.9, y: y + 0.35 + i * 0.32, w: 11.5, h: 0.3,
      fontSize: 11, color: C.darkText, fontFace: FONT,
    });
  });
  return y + boxH + 0.15;
}

// ═══════════════════════════════════════════════════
// SLIDE 1: Title (Cover layout — contrail background)
// ═══════════════════════════════════════════════════
let slide = pptx.addSlide();
slideNum++;
slide.background = { fill: C.white };
// Contrail background image (streaks on right side)
slide.addImage({ path: COVER_BG, x: 0, y: 0, w: 13.33, h: 7.5 });
// Qlik logo top-left
slide.addImage({ path: QLIK_LOGO, x: 0.5, y: 0.4, w: 1.4, h: 0.62 });

slide.addText("Meridian Commerce Group", {
  x: 0.5, y: 1.6, w: 6.5, h: 0.7,
  fontSize: 18, color: C.qlikGray, fontFace: FONT, letterSpacing: 2,
});
slide.addText("Qlik Cloud\nEnd-to-End Demo", {
  x: 0.5, y: 2.3, w: 6.5, h: 1.6,
  fontSize: 38, color: C.qlikBlue, fontFace: FONT, bold: true, lineSpacingMultiple: 1.1,
});
slide.addText("Integration  •  Governance  •  Analytics  •  AI", {
  x: 0.5, y: 4.0, w: 6.5, h: 0.5,
  fontSize: 16, color: C.qlikGreen, fontFace: FONT, bold: true,
});
slide.addText("From 47 fragmented systems to a trusted, AI-ready data platform", {
  x: 0.5, y: 4.7, w: 6.5, h: 0.5,
  fontSize: 14, color: C.darkText, fontFace: FONT,
});

// Four story boxes
const stories = [
  { label: "Integration", color: C.qlikTeal },
  { label: "Governance", color: C.qlikGreen },
  { label: "Analytics", color: C.qlikBlue },
  { label: "AI", color: C.qlikPurple },
];
stories.forEach((s, i) => {
  const x = 0.5 + i * 2.5;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y: 5.6, w: 2.2, h: 0.8,
    fill: { color: s.color }, rectRadius: 0.08,
  });
  slide.addText(s.label, {
    x, y: 5.6, w: 2.2, h: 0.8,
    fontSize: 14, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
});

// ═══════════════════════════════════════════════════
// SLIDE 2: Agenda — Four Stories
// ═══════════════════════════════════════════════════
slide = contentSlide("Demo Agenda — Four Stories, One Platform");

const agendaItems = [
  {
    num: "1", title: "The Integration Story", color: C.qlikTeal,
    desc: "CDC, Kafka streaming, Salesforce → Open Lakehouse (Bronze/Silver/Gold) → Direct Query",
    components: "CDC • Data Flows • Table Recipes • Direct Query",
  },
  {
    num: "2", title: "The Data Governance Story", color: C.qlikGreen,
    desc: "Data Products, Lineage, Impact Analysis, Trust Score, Data Profiling, Stewardship Campaigns, Business Glossary, Data Marketplace",
    components: "Data Products • Lineage • Impact Analysis • Trust Score • Profiling • Stewardship • Glossary • Data Marketplace",
  },
  {
    num: "3", title: "The Analytics Story", color: C.qlikGreen,
    desc: "Qlik Sense dashboards, Qlik Answers agentic analytics, native alerting, reporting & subscriptions, embedded analytics, mobile, collaboration",
    components: "Qlik Sense • Qlik Answers • Alerting • Reporting • qlik-embed • Mobile • Notes • Bookmarks",
  },
  {
    num: "4", title: "The AI Story", color: C.qlikPurple,
    desc: "Qlik Predict (AutoML), Qlik Answers (agentic AI), Discovery Agent, MCP Server, Natural Language Insights, Agentic Analytics (GA)",
    components: "Predict • Qlik Answers • Discovery Agent • MCP • NLI • Knowledge Mart • Agentic Analytics",
  },
];

agendaItems.forEach((item, i) => {
  const y = 1.1 + i * 1.5;
  // Number badge
  slide.addShape(pptx.shapes.OVAL, {
    x: 0.5, y: y + 0.15, w: 0.6, h: 0.6,
    fill: { color: item.color },
  });
  slide.addText(item.num, {
    x: 0.5, y: y + 0.15, w: 0.6, h: 0.6,
    fontSize: 22, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
  // Title
  slide.addText(item.title, {
    x: 1.3, y, w: 5, h: 0.45,
    fontSize: 18, color: item.color, fontFace: FONT, bold: true,
  });
  // Description
  slide.addText(item.desc, {
    x: 1.3, y: y + 0.45, w: 11.5, h: 0.4,
    fontSize: 11, color: C.darkText, fontFace: FONT,
  });
  // Components chips
  slide.addText(item.components, {
    x: 1.3, y: y + 0.85, w: 11.5, h: 0.35,
    fontSize: 10, color: C.medGray, fontFace: FONT, italic: true,
  });
});

// ═══════════════════════════════════════════════════
//  STORY 1: INTEGRATION
// ═══════════════════════════════════════════════════
sectionSlide("1", "The Integration Story", "From 47 fragmented systems to a unified, real-time data fabric", C.qlikBlue);

// ─── Slide: Data Sources & Connectivity ───
slide = contentSlide("Data Sources & Connectivity", C.qlikTeal);

slide.addText("Three live data sources feeding the Qlik Open Lakehouse in real-time", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

const sources = [
  {
    name: "PostgreSQL (WMS)", method: "CDC via Qlik Cloud Connector", color: C.qlikTeal,
    tables: "inventory_positions • warehouse_events • shipments",
    detail: "Real-time Change Data Capture, logical replication, sub-second latency",
  },
  {
    name: "Apache Kafka (IoT)", method: "Streaming via Kafka Connector", color: C.qlikBlue,
    tables: "mcg.iot.cold-chain • mcg.iot.carrier-events",
    detail: "Continuous IoT telemetry from cold chain sensors + carrier GPS/status events",
  },
  {
    name: "Salesforce (CRM)", method: "Standard Connector (15 min)", color: C.qlikGreen,
    tables: "Contact • MCG_Order__c • MCG_Product__c",
    detail: "Customer addresses, orders, product master — with intentional data quality issues",
  },
];

sources.forEach((s, i) => {
  const y = 1.4 + i * 1.65;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y, w: 12.3, h: 1.45,
    fill: { color: C.lightBg }, rectRadius: 0.1,
    line: { color: s.color, width: 1.5 },
  });
  slide.addText(s.name, {
    x: 0.8, y: y + 0.08, w: 4, h: 0.4,
    fontSize: 16, color: s.color, fontFace: FONT, bold: true,
  });
  slide.addText(s.method, {
    x: 5.5, y: y + 0.08, w: 7, h: 0.4,
    fontSize: 12, color: C.medGray, fontFace: FONT, italic: true,
  });
  slide.addText(s.tables, {
    x: 0.8, y: y + 0.5, w: 11.7, h: 0.35,
    fontSize: 12, color: C.qlikBlue, fontFace: FONT, bold: true,
  });
  slide.addText(s.detail, {
    x: 0.8, y: y + 0.9, w: 11.7, h: 0.35,
    fontSize: 11, color: C.darkText, fontFace: FONT,
  });
});

// Callout
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 6.4, w: 12.3, h: 0.5,
  fill: { color: C.lightCyan }, rectRadius: 0.08,
});
slide.addText("Demo Tip: Run all 3 simulators before the demo. Data flows into Bronze within seconds (PostgreSQL, Kafka) or 15 min (Salesforce).", {
  x: 0.8, y: 6.42, w: 11.8, h: 0.45,
  fontSize: 11, color: C.qlikTeal, fontFace: FONT, bold: true,
});

// ─── Slide: Open Lakehouse Architecture ───
slide = contentSlide("Open Lakehouse — Bronze / Silver / Gold", C.qlikTeal);

slide.addText("Medallion architecture with automated data flows and table recipes", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

const layers = [
  {
    name: "BRONZE", label: "Raw Ingestion", count: "8 tables", color: C.qlikGreen, bg: C.lightCyan,
    tables: "inventory_positions • warehouse_events • shipments • sf_contacts • sf_orders • sf_products • iot_cold_chain • iot_carrier_events",
  },
  {
    name: "SILVER", label: "Cleaned & Transformed", count: "8 tables", color: C.qlikTeal, bg: C.lightCyan,
    tables: "warehouse_events_clean • inventory_reconciled • addresses_standardized • products_harmonized • shipments_canonical • iot_telemetry_normalized • suppliers_deduped • order_delivery_timeline",
  },
  {
    name: "GOLD", label: "Business-Ready Data Products", count: "7 tables", color: C.qlikBlue, bg: C.lightBlue,
    tables: "supply_chain_health • last_mile_performance • cold_chain_compliance • product_master_360 • customer_delivery_experience • compliance_readiness • operational_cost_impact",
  },
];

layers.forEach((l, i) => {
  const y = 1.4 + i * 1.7;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y, w: 12.3, h: 1.5,
    fill: { color: l.bg }, rectRadius: 0.1,
    line: { color: l.color, width: 2 },
  });
  // Layer badge
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.7, y: y + 0.15, w: 1.8, h: 0.5,
    fill: { color: l.color }, rectRadius: 0.06,
  });
  slide.addText(l.name, {
    x: 0.7, y: y + 0.15, w: 1.8, h: 0.5,
    fontSize: 13, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
  slide.addText(`${l.label}  (${l.count})`, {
    x: 2.8, y: y + 0.15, w: 9.5, h: 0.5,
    fontSize: 14, color: l.color, fontFace: FONT, bold: true,
  });
  slide.addText(l.tables, {
    x: 0.8, y: y + 0.75, w: 11.7, h: 0.55,
    fontSize: 10, color: C.darkText, fontFace: FONT,
  });
  // Arrow down (except last)
  if (i < 2) {
    slide.addText("▼", {
      x: 6.2, y: y + 1.5, w: 1, h: 0.2,
      fontSize: 14, color: l.color, fontFace: FONT, align: "center",
    });
  }
});

// ─── Slide: Data Flows & Transformation Routes ───
slide = contentSlide("Data Flows — 8 Transformation Routes", C.qlikTeal);

slide.addText("Qlik Cloud Data Integration transforms raw data into trusted, business-ready assets", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

const routes = [
  { num: "1", name: "Timestamp Normalization", desc: "14 timezone formats → UTC standard", nightmare: "#5" },
  { num: "2", name: "Inventory Reconciliation", desc: "WMS-ERP comparison, phantom detection, Trust Score", nightmare: "#1" },
  { num: "3", name: "Address Standardization", desc: "18.4M addresses cleaned, fuzzy match, dedup", nightmare: "#2" },
  { num: "4", name: "Product Master Harmonization", desc: "8,200 SKUs missing weight/dims → enriched", nightmare: "#3" },
  { num: "5", name: "Carrier Status Canonicalization", desc: "6 carriers × 6 languages → unified lifecycle", nightmare: "#6" },
  { num: "6", name: "IoT Telemetry Normalization", desc: "Cold chain sensor data → exceedance flags", nightmare: "#6" },
  { num: "7", name: "Supplier Master Dedup", desc: "80 suppliers with 2-4 duplicates → clean master", nightmare: "#3" },
  { num: "8", name: "Order-to-Delivery Timeline", desc: "Cross-source join → end-to-end order visibility", nightmare: "#4" },
];

const rtHeaders = [
  [
    { text: "#", options: { bold: true, color: C.white, fill: { color: C.qlikTeal }, fontSize: 10, align: "center" } },
    { text: "Route Name", options: { bold: true, color: C.white, fill: { color: C.qlikTeal }, fontSize: 10 } },
    { text: "What It Does", options: { bold: true, color: C.white, fill: { color: C.qlikTeal }, fontSize: 10 } },
    { text: "Nightmare", options: { bold: true, color: C.white, fill: { color: C.qlikTeal }, fontSize: 10, align: "center" } },
  ],
];
const rtRows = routes.map((r, i) => [
  { text: r.num, options: { fontSize: 10, color: C.darkText, fill: { color: i % 2 === 0 ? C.lightBg : C.white }, align: "center" } },
  { text: r.name, options: { fontSize: 10, color: C.qlikBlue, fill: { color: i % 2 === 0 ? C.lightBg : C.white }, bold: true } },
  { text: r.desc, options: { fontSize: 10, color: C.darkText, fill: { color: i % 2 === 0 ? C.lightBg : C.white } } },
  { text: r.nightmare, options: { fontSize: 10, color: C.red, fill: { color: i % 2 === 0 ? C.lightBg : C.white }, align: "center", bold: true } },
]);

slide.addTable([...rtHeaders, ...rtRows], {
  x: 0.5, y: 1.3, w: 12.3,
  fontFace: FONT,
  border: { type: "solid", pt: 0.5, color: "D1D5DB" },
  colW: [0.6, 3.2, 6.0, 2.5],
  rowH: [0.35, ...Array(8).fill(0.45)],
});

slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 5.5, w: 12.3, h: 0.5,
  fill: { color: C.lightCyan }, rectRadius: 0.08,
});
slide.addText("Each route maps directly to one of the 7 Data Quality Nightmares — show the before/after transformation live", {
  x: 0.8, y: 5.52, w: 11.8, h: 0.45,
  fontSize: 11, color: C.qlikTeal, fontFace: FONT, bold: true,
});

// ─── Slide: Integration — What to Show ───
slide = contentSlide("Integration Story — What to Show in the Demo", C.qlikTeal);

let yPos = 1.1;
yPos = recommendBox(slide, "Live CDC Demo", [
  "Show PostgreSQL simulator running → watch rows appear in bronze.inventory_positions in real-time",
  "Make a manual UPDATE in PostgreSQL → show CDC propagating through Bronze → Silver → Gold in under 60 seconds",
  "Highlight pipeline status in the Qlik Cloud Integration hub",
], yPos, C.lightCyan);

yPos = recommendBox(slide, "Lakehouse Walk-Through", [
  "Navigate Open Lakehouse → show the Bronze/Silver/Gold tier structure",
  "Open a Table Recipe (e.g., gold.supply_chain_health) → show how Gold tables are defined from Silver inputs",
  "Show Data Flow Route 2 (Inventory Reconciliation) in Pipeline Designer — the 'phantom inventory' detection logic",
], yPos, C.lightCyan);

yPos = recommendBox(slide, "Direct Query [NEW — add to demo]", [
  "Show a Direct Query app connecting live to the Lakehouse — no data import, SQL pushdown at query time",
  "Great for large dataset scenarios — demonstrate real-time exploration without engine memory load",
], yPos, C.lightCyan);


// ═══════════════════════════════════════════════════
//  STORY 2: DATA GOVERNANCE
// ═══════════════════════════════════════════════════
sectionSlide("2", "The Data Governance Story", "Trust, transparency, and quality at every layer", C.qlikBlue);

// ─── Slide: Data Products for Analytics ───
slide = contentSlide("Qlik Data Products for Analytics", C.qlikGreen);

slide.addText("Governed, curated datasets with ownership, quality signals, and API access — the foundation of trusted analytics", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

const products = [
  { name: "Supply Chain Health", owner: "Henrik Jansen", refresh: "15 min", trust: "4.5", api: true },
  { name: "Last Mile Performance", owner: "Sophie Muller", refresh: "30 min", trust: "4.2", api: true },
  { name: "Cold Chain Compliance", owner: "Henrik Jansen", refresh: "5 min", trust: "4.8", api: true },
  { name: "Product Master 360", owner: "Thomas Berger", refresh: "1 hour", trust: "3.9", api: true },
  { name: "Customer Delivery Experience", owner: "Lisa Park", refresh: "1 hour", trust: "4.1", api: false },
  { name: "Compliance Readiness", owner: "Maria Santos", refresh: "1 hour", trust: "4.6", api: false },
  { name: "Operational Cost Impact", owner: "CFO Office", refresh: "Daily", trust: "4.3", api: false },
];

const dpHeaders = [
  [
    { text: "Data Product", options: { bold: true, color: C.white, fill: { color: C.qlikGreen }, fontSize: 11 } },
    { text: "Owner", options: { bold: true, color: C.white, fill: { color: C.qlikGreen }, fontSize: 11 } },
    { text: "Refresh", options: { bold: true, color: C.white, fill: { color: C.qlikGreen }, fontSize: 11, align: "center" } },
    { text: "Trust Score", options: { bold: true, color: C.white, fill: { color: C.qlikGreen }, fontSize: 11, align: "center" } },
    { text: "API Shared", options: { bold: true, color: C.white, fill: { color: C.qlikGreen }, fontSize: 11, align: "center" } },
  ],
];
const dpRows = products.map((p, i) => [
  { text: p.name, options: { fontSize: 11, color: C.qlikBlue, fill: { color: i % 2 === 0 ? C.lightBg : C.white }, bold: true } },
  { text: p.owner, options: { fontSize: 11, color: C.darkText, fill: { color: i % 2 === 0 ? C.lightBg : C.white } } },
  { text: p.refresh, options: { fontSize: 11, color: C.darkText, fill: { color: i % 2 === 0 ? C.lightBg : C.white }, align: "center" } },
  { text: p.trust, options: { fontSize: 11, color: C.qlikGreen, fill: { color: i % 2 === 0 ? C.lightBg : C.white }, align: "center", bold: true } },
  { text: p.api ? "✓ Enabled" : "—", options: { fontSize: 11, color: p.api ? C.qlikGreen : C.medGray, fill: { color: i % 2 === 0 ? C.lightBg : C.white }, align: "center", bold: p.api } },
]);

slide.addTable([...dpHeaders, ...dpRows], {
  x: 0.5, y: 1.4, w: 12.3,
  fontFace: FONT,
  border: { type: "solid", pt: 0.5, color: "D1D5DB" },
  colW: [3.5, 2.6, 1.8, 1.8, 2.6],
  rowH: [0.38, ...Array(7).fill(0.42)],
});

slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 5.2, w: 12.3, h: 0.65,
  fill: { color: C.lightGreen }, rectRadius: 0.08,
});
slide.addText("Data Products are the governed contract between data producers and consumers — ownership, quality, freshness, and access all in one place.", {
  x: 0.8, y: 5.25, w: 11.8, h: 0.55,
  fontSize: 12, color: C.qlikGreen, fontFace: FONT, bold: true,
});

// ─── Slide: Lineage & Impact Analysis ───
slide = contentSlide("Data Lineage & Impact Analysis", C.qlikGreen);

slide.addText("Visual field-level lineage and downstream dependency analysis across the entire data estate", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

// Two columns
const govFeatures = [
  {
    title: "Data Lineage", color: C.qlikGreen, items: [
      "Visual field-level lineage graphs",
      "Source → Transformation → App",
      "Cross-system traceability",
      "Data flow route integration",
      "ML content lineage",
      "MCG: PostgreSQL → Bronze → Silver → Gold → App",
    ],
  },
  {
    title: "Impact Analysis", color: C.qlikTeal, items: [
      "Downstream dependency maps",
      "\"What if I change this field?\"",
      "Affected apps, tasks, datasets",
      "Change risk assessment",
      "ML experiment dependencies",
      "MCG: silver.inventory_reconciled → 3 Gold + 2 apps",
    ],
  },
];

govFeatures.forEach((f, i) => {
  const x = 0.5 + i * 6.4;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y: 1.4, w: 6.1, h: 4.5,
    fill: { color: C.lightBg }, rectRadius: 0.12,
    line: { color: f.color, width: 2 },
  });
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: x + 0.1, y: 1.5, w: 5.9, h: 0.6,
    fill: { color: f.color }, rectRadius: 0.06,
  });
  slide.addText(f.title, {
    x: x + 0.1, y: 1.5, w: 5.9, h: 0.6,
    fontSize: 16, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
  f.items.forEach((item, j) => {
    slide.addText(`▸  ${item}`, {
      x: x + 0.3, y: 2.3 + j * 0.55, w: 5.4, h: 0.5,
      fontSize: 12, color: C.darkText, fontFace: FONT,
    });
  });
});

// ─── Slide: Trust Score & Data Profiling ───
slide = contentSlide("Trust Score & Data Profiling", C.qlikGreen);

slide.addText("Quantified data quality at every layer — from raw ingestion to AI consumption", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

// Trust Score section
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.4, w: 6.0, h: 3.3,
  fill: { color: C.lightBg }, rectRadius: 0.12,
  line: { color: C.qlikGreen, width: 2 },
});
slide.addText("Qlik Trust Score", {
  x: 0.7, y: 1.5, w: 5.5, h: 0.5,
  fontSize: 18, color: C.qlikGreen, fontFace: FONT, bold: true,
});
slide.addText("Aggregated quality score (0-5) across dimensions:", {
  x: 0.7, y: 2.0, w: 5.5, h: 0.35,
  fontSize: 12, color: C.darkText, fontFace: FONT,
});
const trustDims = [
  { dim: "Validity", desc: "Are values within expected ranges?" },
  { dim: "Completeness", desc: "Are required fields populated?" },
  { dim: "Discoverability", desc: "Is metadata documented?" },
  { dim: "Usage", desc: "Is the data actively consumed?" },
  { dim: "AI-Specific", desc: "Accuracy, Diversity, Timeliness (new)" },
];
trustDims.forEach((d, i) => {
  slide.addText(`▸  ${d.dim}: `, {
    x: 0.7, y: 2.4 + i * 0.38, w: 2.2, h: 0.35,
    fontSize: 11, color: C.qlikBlue, fontFace: FONT, bold: true,
  });
  slide.addText(d.desc, {
    x: 2.7, y: 2.4 + i * 0.38, w: 3.5, h: 0.35,
    fontSize: 11, color: C.darkText, fontFace: FONT,
  });
});

// Profiling section
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 6.8, y: 1.4, w: 6.0, h: 3.3,
  fill: { color: C.lightBg }, rectRadius: 0.12,
  line: { color: C.qlikTeal, width: 2 },
});
slide.addText("Data Profiling", {
  x: 7.0, y: 1.5, w: 5.5, h: 0.5,
  fontSize: 18, color: C.qlikTeal, fontFace: FONT, bold: true,
});
const profItems = [
  "Automated statistical analysis of datasets",
  "Column-level quality metrics & distributions",
  "Pattern detection (e.g., truncated addresses)",
  "Null/blank/outlier identification",
  "Supports SQL DBs, QVDs, CSV, XLSX, Snowflake",
  "MCG use: Profile bronze.contacts_raw → show 11% format issues, 6% truncation at 30 chars",
];
profItems.forEach((item, i) => {
  slide.addText(`▸  ${item}`, {
    x: 7.0, y: 2.1 + i * 0.42, w: 5.6, h: 0.38,
    fontSize: 11, color: C.darkText, fontFace: FONT,
  });
});

// ─── Slide: Stewardship Campaigns ───
slide = contentSlide("Stewardship — Human-in-the-Loop Data Quality", C.qlikGreen);

slide.addText("Crowdsource data corrections to domain experts with tracked campaigns", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

const campaigns = [
  { name: "Address Cleanup", source: "silver.addresses_standardized", filter: "quality_score < 0.7", owner: "Customer Data Team", nightmare: "#2", records: "~2,000" },
  { name: "Supplier Dedup", source: "silver.suppliers_deduped", filter: "confidence < 0.9", owner: "Procurement Team", nightmare: "#3", records: "~160" },
  { name: "Missing Weights", source: "silver.products_harmonized", filter: "weight_kg IS NULL", owner: "Product Data Team", nightmare: "#3", records: "~8,200" },
  { name: "Lot Number Compliance", source: "silver.inventory_reconciled", filter: "perishable AND lot IS NULL", owner: "Quality Team", nightmare: "#7", records: "~15%" },
];

const campHeaders = [
  [
    { text: "Campaign", options: { bold: true, color: C.white, fill: { color: C.qlikGreen }, fontSize: 10 } },
    { text: "Data Source", options: { bold: true, color: C.white, fill: { color: C.qlikGreen }, fontSize: 10 } },
    { text: "Filter", options: { bold: true, color: C.white, fill: { color: C.qlikGreen }, fontSize: 10 } },
    { text: "Owner", options: { bold: true, color: C.white, fill: { color: C.qlikGreen }, fontSize: 10 } },
    { text: "Nightmare", options: { bold: true, color: C.white, fill: { color: C.qlikGreen }, fontSize: 10, align: "center" } },
  ],
];
const campRows = campaigns.map((c, i) => [
  { text: c.name, options: { fontSize: 10, color: C.qlikBlue, fill: { color: i % 2 === 0 ? C.lightBg : C.white }, bold: true } },
  { text: c.source, options: { fontSize: 9, color: C.darkText, fill: { color: i % 2 === 0 ? C.lightBg : C.white } } },
  { text: c.filter, options: { fontSize: 9, color: C.darkText, fill: { color: i % 2 === 0 ? C.lightBg : C.white } } },
  { text: c.owner, options: { fontSize: 10, color: C.darkText, fill: { color: i % 2 === 0 ? C.lightBg : C.white } } },
  { text: c.nightmare, options: { fontSize: 10, color: C.red, fill: { color: i % 2 === 0 ? C.lightBg : C.white }, align: "center", bold: true } },
]);

slide.addTable([...campHeaders, ...campRows], {
  x: 0.5, y: 1.4, w: 12.3,
  fontFace: FONT,
  border: { type: "solid", pt: 0.5, color: "D1D5DB" },
  colW: [2.2, 3.0, 2.8, 2.3, 2.0],
  rowH: [0.38, ...Array(4).fill(0.48)],
});

// ─── Slide: Business Glossary + Section Access ───
slide = contentSlide("Business Glossary & Data Security", C.qlikGreen);

// Left: Glossary
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.1, w: 6.0, h: 4.5,
  fill: { color: C.lightBg }, rectRadius: 0.12,
  line: { color: C.qlikGreen, width: 2 },
});
slide.addText("Business Glossary", {
  x: 0.7, y: 1.2, w: 5.5, h: 0.5,
  fontSize: 18, color: C.qlikGreen, fontFace: FONT, bold: true,
});
slide.addText("25 standardized terms across 5 categories:", {
  x: 0.7, y: 1.7, w: 5.5, h: 0.35,
  fontSize: 12, color: C.darkText, fontFace: FONT,
});
const glossCats = [
  "Inventory & Warehouse (Phantom Inventory, IRA, Cycle Count, ...)",
  "Supply Chain & Logistics (WISMO, SLA Breach, Cold Chain, ...)",
  "Data Quality & Governance (Trust Score, Data Lineage, ...)",
  "Compliance & Regulatory (Lot Traceability, NVWA, Recall, ...)",
  "Business Operations (Fill Rate, OTIF, Carrier SLA, ...)",
];
glossCats.forEach((cat, i) => {
  slide.addText(`▸  ${cat}`, {
    x: 0.7, y: 2.1 + i * 0.42, w: 5.6, h: 0.38,
    fontSize: 11, color: C.darkText, fontFace: FONT,
  });
});
slide.addText("Each term links to data products, datasets, and nightmare scenarios", {
  x: 0.7, y: 4.3, w: 5.5, h: 0.35,
  fontSize: 11, color: C.medGray, fontFace: FONT, italic: true,
});

// Right: Section Access + Data Marketplace
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 6.8, y: 1.1, w: 6.0, h: 2.1,
  fill: { color: C.lightBg }, rectRadius: 0.12,
  line: { color: C.qlikBlue, width: 2 },
});
slide.addText("Section Access [NEW]", {
  x: 7.0, y: 1.2, w: 5.5, h: 0.5,
  fontSize: 18, color: C.qlikBlue, fontFace: FONT, bold: true,
});
const saItems = [
  "Row-level + column-level data reduction",
  "Based on USER.EMAIL, USERID, groups",
  "Regional VPs see only their DCs",
  "Carrier partners see only their shipments",
];
saItems.forEach((item, i) => {
  slide.addText(`▸  ${item}`, {
    x: 7.0, y: 1.75 + i * 0.33, w: 5.6, h: 0.3,
    fontSize: 11, color: C.darkText, fontFace: FONT,
  });
});

slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 6.8, y: 3.4, w: 6.0, h: 2.2,
  fill: { color: C.lightBg }, rectRadius: 0.12,
  line: { color: C.qlikTeal, width: 2 },
});
slide.addText("Data Marketplace [NEW]", {
  x: 7.0, y: 3.5, w: 5.5, h: 0.5,
  fontSize: 18, color: C.qlikTeal, fontFace: FONT, bold: true,
});
const mpItems = [
  "Self-service portal for data product discovery",
  "Business users browse & request access",
  "Governed access with approval workflows",
  "Reduces shadow data / rogue spreadsheets",
  "MCG: Analysts find gold.supply_chain_health without asking IT",
];
mpItems.forEach((item, i) => {
  slide.addText(`▸  ${item}`, {
    x: 7.0, y: 4.05 + i * 0.33, w: 5.6, h: 0.3,
    fontSize: 11, color: C.darkText, fontFace: FONT,
  });
});

// ─── Slide: Governance — What to Show ───
slide = contentSlide("Governance Story — What to Show in the Demo", C.qlikGreen);

yPos = 1.1;
yPos = recommendBox(slide, "Data Products Walk-Through", [
  "Open Data Products catalog → show 7 products with owners, Trust Scores, SLAs, API sharing status",
  "Click 'API Sharing' on Supply Chain Health → copy the endpoint → run a curl command to fetch live data",
  "Show Data Marketplace → demonstrate self-service data discovery for business users",
], yPos, C.lightGreen);

yPos = recommendBox(slide, "Lineage + Impact Analysis + Trust Score", [
  "Click gold.supply_chain_health → Lineage view → trace field-level path from PostgreSQL → Bronze → Silver → Gold",
  "Click Impact Analysis → show which apps, reports, and ML models depend on this data product",
  "Show Trust Score on gold.cold_chain_compliance → highlight Validity (4.2), Completeness (3.8), Discoverability (5.0)",
], yPos, C.lightGreen);

yPos = recommendBox(slide, "Stewardship + Glossary", [
  "Open Address Cleanup campaign → show steward's review queue (ambiguous matches < 90% confidence)",
  "Open 'Phantom Inventory' glossary term → show definition, owner, linked datasets, related nightmares",
], yPos, C.lightGreen);

// ═══════════════════════════════════════════════════
//  STORY 3: ANALYTICS
// ═══════════════════════════════════════════════════
sectionSlide("3", "The Analytics Story", "From stale PowerPoints to real-time, interactive, AI-assisted insights", C.qlikBlue);

// ─── Slide: Qlik Sense Dashboards ───
slide = contentSlide("Qlik Sense — 7 Analytics Apps", C.qlikGreen);

slide.addText("Interactive dashboards connected to Gold-layer data products with associative exploration", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

const apps = [
  { name: "Supply Chain Health", focus: "Inventory accuracy, pipeline status, DC-level KPIs", nightmare: "#1, #4" },
  { name: "Last Mile Performance", focus: "Carrier SLAs, rejection rates, WISMO by region", nightmare: "#2, #6" },
  { name: "Cold Chain Monitoring", focus: "Temperature exceedances, spoilage risk, real-time alerts", nightmare: "#6" },
  { name: "Product Master 360", focus: "SKU completeness, weight/dims gaps, supplier mapping", nightmare: "#3" },
  { name: "Customer Delivery Experience", focus: "WISMO rates, delivery promises vs actuals, NPS impact", nightmare: "#2, #6" },
  { name: "Compliance & Recall Readiness", focus: "Lot traceability, recall simulation, NVWA readiness", nightmare: "#7" },
  { name: "Executive Cost Impact", focus: "C-level view: $127M cost breakdown by nightmare, ROI tracking", nightmare: "All" },
];

const appHeaders = [
  [
    { text: "Dashboard", options: { bold: true, color: C.white, fill: { color: C.qlikGreen }, fontSize: 11 } },
    { text: "Key Focus", options: { bold: true, color: C.white, fill: { color: C.qlikGreen }, fontSize: 11 } },
    { text: "Nightmares", options: { bold: true, color: C.white, fill: { color: C.qlikGreen }, fontSize: 11, align: "center" } },
  ],
];
const appRows = apps.map((a, i) => [
  { text: a.name, options: { fontSize: 11, color: C.qlikBlue, fill: { color: i % 2 === 0 ? C.lightBg : C.white }, bold: true } },
  { text: a.focus, options: { fontSize: 10, color: C.darkText, fill: { color: i % 2 === 0 ? C.lightBg : C.white } } },
  { text: a.nightmare, options: { fontSize: 10, color: C.red, fill: { color: i % 2 === 0 ? C.lightBg : C.white }, align: "center", bold: true } },
]);

slide.addTable([...appHeaders, ...appRows], {
  x: 0.5, y: 1.4, w: 12.3,
  fontFace: FONT,
  border: { type: "solid", pt: 0.5, color: "D1D5DB" },
  colW: [3.5, 6.3, 2.5],
  rowH: [0.38, ...Array(7).fill(0.48)],
});

// ─── Slide: Qlik Answers — Agentic Analytics ───
slide = contentSlide("Qlik Answers — Agentic Conversational Analytics", C.qlikGreen);

slide.addText("Unified agentic interface: ask questions in natural language, get governed answers from data and documents", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

const answersFeatures = [
  {
    title: "Conversational Analytics", color: C.qlikGreen, items: [
      "Ask questions in natural language",
      "Qlik engine powers governed calculations",
      "Auto-generates visualizations & narratives",
      "MCG: \"Show inventory accuracy by DC\"",
    ],
  },
  {
    title: "Agentic Reasoning", color: C.qlikTeal, items: [
      "Chain-of-thought multi-step reasoning",
      "Blends structured data + documents",
      "Citations & explainability built in",
      "MCG: \"Why did Rotterdam IRA drop?\"",
    ],
  },
  {
    title: "Business Logic", color: C.qlikBlue, items: [
      "Logical Model defines data relationships",
      "Vocabulary maps business terms",
      "Guides Qlik Answers behavior",
      "MCG: \"phantom\" → inventory_accuracy",
    ],
  },
];

answersFeatures.forEach((f, i) => {
  const x = 0.5 + i * 4.2;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y: 1.4, w: 3.9, h: 3.5,
    fill: { color: C.lightBg }, rectRadius: 0.12,
    line: { color: f.color, width: 2 },
  });
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: x + 0.1, y: 1.5, w: 3.7, h: 0.6,
    fill: { color: f.color }, rectRadius: 0.06,
  });
  slide.addText(f.title, {
    x: x + 0.1, y: 1.5, w: 3.7, h: 0.6,
    fontSize: 15, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
  f.items.forEach((item, j) => {
    slide.addText(`▸  ${item}`, {
      x: x + 0.3, y: 2.3 + j * 0.5, w: 3.4, h: 0.45,
      fontSize: 12, color: C.darkText, fontFace: FONT,
    });
  });
});

// NLI callout
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 5.1, w: 12.3, h: 0.8,
  fill: { color: C.lightCyan }, rectRadius: 0.08,
});
slide.addText("Natural Language Insights (NLI): Add NLI objects to dashboards — auto-generated narrative summaries of trends, outliers, and drivers in plain English. Updated Nov 2025 to link directly to selected charts.", {
  x: 0.8, y: 5.15, w: 11.8, h: 0.7,
  fontSize: 11, color: C.darkText, fontFace: FONT,
});

// GA callout
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 6.1, w: 12.3, h: 0.5,
  fill: { color: C.lightGreen }, rectRadius: 0.08,
});
slide.addText("✓ Qlik Answers agentic experience reached GA in February 2026 — replaces legacy Insight Advisor with unified conversational AI.", {
  x: 0.8, y: 6.15, w: 11.8, h: 0.4,
  fontSize: 12, color: C.qlikGreen, fontFace: FONT, bold: true,
});

// ─── Slide: Alerting, Reporting & Subscriptions ───
slide = contentSlide("Alerting, Reporting & Subscriptions", C.qlikGreen);

// Left: Alerting
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.1, w: 6.0, h: 2.7,
  fill: { color: C.lightBg }, rectRadius: 0.12,
  line: { color: C.qlikGreen, width: 2 },
});
slide.addText("Native Data Alerts [NEW]", {
  x: 0.7, y: 1.2, w: 5.5, h: 0.5,
  fontSize: 18, color: C.qlikGreen, fontFace: FONT, bold: true,
});
const alertItems = [
  "Condition-based alerts on data reload or schedule",
  "Compare against values, measures, or last evaluation",
  "Web, push, and email notification channels",
  "Shareable alerts across teams",
  "MCG: Alert when IRA drops below 85% for any DC",
  "MCG: Alert when WISMO rate exceeds 40% for a carrier",
];
alertItems.forEach((item, i) => {
  slide.addText(`▸  ${item}`, {
    x: 0.7, y: 1.8 + i * 0.35, w: 5.6, h: 0.32,
    fontSize: 11, color: C.darkText, fontFace: FONT,
  });
});

// Right: Reporting
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 6.8, y: 1.1, w: 6.0, h: 2.7,
  fill: { color: C.lightBg }, rectRadius: 0.12,
  line: { color: C.qlikTeal, width: 2 },
});
slide.addText("Reporting Service [NEW]", {
  x: 7.0, y: 1.2, w: 5.5, h: 0.5,
  fontSize: 18, color: C.qlikTeal, fontFace: FONT, bold: true,
});
const reportItems = [
  "PixelPerfect: Banded PDF reports (replaces NPrinting)",
  "Tabular Reports: Excel-based export templates",
  "On-Demand: User sets selections → downloads report",
  "Subscriptions: Scheduled email delivery of charts/sheets",
  "MCG: Weekly compliance report to regulatory affairs",
  "MCG: Daily inventory summary emailed to DC managers",
];
reportItems.forEach((item, i) => {
  slide.addText(`▸  ${item}`, {
    x: 7.0, y: 1.8 + i * 0.35, w: 5.6, h: 0.32,
    fontSize: 11, color: C.darkText, fontFace: FONT,
  });
});

// Bottom: Collaboration
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 4.1, w: 12.3, h: 2.0,
  fill: { color: C.lightBg }, rectRadius: 0.12,
  line: { color: C.qlikBlue, width: 2 },
});
slide.addText("Collaboration & User Experience [NEW]", {
  x: 0.7, y: 4.2, w: 11.8, h: 0.5,
  fontSize: 18, color: C.qlikBlue, fontFace: FONT, bold: true,
});

const collabCols = [
  { title: "Notes", items: ["In-app commentary", "Chart snapshots", "Tag team members"] },
  { title: "Bookmarks", items: ["Save selection states", "Share with team", "Public grouping"] },
  { title: "Collections", items: ["Organize apps/charts", "Personal curations", "Quick access"] },
  { title: "Mobile", items: ["iOS/Android app", "Offline exploration", "Push notifications"] },
];
collabCols.forEach((col, i) => {
  const x = 0.7 + i * 3.1;
  slide.addText(col.title, {
    x, y: 4.7, w: 2.9, h: 0.35,
    fontSize: 13, color: C.qlikBlue, fontFace: FONT, bold: true,
  });
  col.items.forEach((item, j) => {
    slide.addText(`▸  ${item}`, {
      x, y: 5.05 + j * 0.3, w: 2.9, h: 0.28,
      fontSize: 10, color: C.darkText, fontFace: FONT,
    });
  });
});

// ─── Slide: Embedded Analytics ───
slide = contentSlide("Embedded Analytics & Automations", C.qlikGreen);

// Left: Embedded
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.1, w: 6.0, h: 3.0,
  fill: { color: C.lightBg }, rectRadius: 0.12,
  line: { color: C.qlikGreen, width: 2 },
});
slide.addText("Embedded Analytics [NEW]", {
  x: 0.7, y: 1.2, w: 5.5, h: 0.5,
  fontSize: 18, color: C.qlikGreen, fontFace: FONT, bold: true,
});
const embedItems = [
  "qlik-embed: Modern web component framework",
  "<qlik-embed> HTML elements with OAuth2",
  "React support via @qlik/embed-react",
  "Embed charts, sheets, or full apps",
  "Nebula.js for custom rendering",
  "MCG: Embed cold chain dashboard in carrier portal",
  "MCG: Embed inventory KPIs in store manager intranet",
];
embedItems.forEach((item, i) => {
  slide.addText(`▸  ${item}`, {
    x: 0.7, y: 1.8 + i * 0.35, w: 5.6, h: 0.32,
    fontSize: 11, color: C.darkText, fontFace: FONT,
  });
});

// Right: Automations
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 6.8, y: 1.1, w: 6.0, h: 3.0,
  fill: { color: C.lightBg }, rectRadius: 0.12,
  line: { color: C.qlikTeal, width: 2 },
});
slide.addText("Qlik Automations", {
  x: 7.0, y: 1.2, w: 5.5, h: 0.5,
  fontSize: 18, color: C.qlikTeal, fontFace: FONT, bold: true,
});
const autoItems = [
  "Block-based automation designer (no code)",
  "MCG Daily App Reload (06:00 UTC)",
  "Cold Chain Alert → Teams (every 5 min)",
  "Pipeline Health Summary → Teams (07:00 UTC)",
  "WISMO Rate Alert → Customer Ops",
  "Webhook triggers for external events",
  "100+ connector blocks (Teams, Slack, SMTP, REST, ...)",
];
autoItems.forEach((item, i) => {
  slide.addText(`▸  ${item}`, {
    x: 7.0, y: 1.8 + i * 0.35, w: 5.6, h: 0.32,
    fontSize: 11, color: C.darkText, fontFace: FONT,
  });
});

// Custom Themes callout
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 4.4, w: 12.3, h: 0.8,
  fill: { color: C.lightCyan }, rectRadius: 0.08,
});
slide.addText("Custom Themes & Extensions: Apply MCG branding (Navy #1B2A4A, Teal #0D7C8F, Gold #C4922E, Calibri font) as a tenant-level theme. Import custom visualization extensions for specialized supply chain charts.", {
  x: 0.8, y: 4.45, w: 11.8, h: 0.7,
  fontSize: 11, color: C.darkText, fontFace: FONT,
});

// ─── Slide: Analytics — What to Show ───
slide = contentSlide("Analytics Story — What to Show in the Demo", C.qlikGreen);

yPos = 1.1;
yPos = recommendBox(slide, "Qlik Sense Dashboard Tour", [
  "Open Supply Chain Health → show Rotterdam DC's IRA at 74%, drill into phantom inventory by SKU",
  "Open Cold Chain Monitoring → show live temperature exceedances on São Paulo→Buenos Aires route",
  "Switch to Executive Cost Impact → C-level view of $127M broken down by nightmare category",
], yPos, C.lightCyan);

yPos = recommendBox(slide, "Qlik Answers Agentic Demo", [
  "Open Qlik Answers → ask: \"Which distribution centers have the lowest inventory accuracy?\"",
  "Follow up: \"Show me the trend for Rotterdam over the last 3 months\" — demonstrate chain-of-thought reasoning",
  "Show Business Logic: vocabulary mapping 'phantom' → inventory_accuracy, 'WISMO' → customer_delivery_experience",
], yPos, C.lightCyan);

yPos = recommendBox(slide, "Alerting + Reporting", [
  "Show a native alert: IRA < 85% for DC-RTD-01 → triggered, sent via email and push notification",
  "Open a subscription: weekly compliance PDF emailed to regulatory team every Monday 08:00",
], yPos, C.lightCyan);

yPos = recommendBox(slide, "Embedded Analytics [NEW]", [
  "Show a qlik-embed code snippet → demo a cold chain chart embedded in a mock carrier portal page",
], yPos, C.lightCyan);


// ═══════════════════════════════════════════════════
//  STORY 4: AI
// ═══════════════════════════════════════════════════
sectionSlide("4", "The AI Story", "From reactive dashboards to proactive, conversational, agentic intelligence", C.qlikBlue);

// ─── Slide: Qlik Predict ───
slide = contentSlide("Qlik Predict — AutoML for Supply Chain", C.qlikPurple);

slide.addText("Train, deploy, and share ML models without code — predictions served via API", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

// Two model cards
const models = [
  {
    name: "Spoilage Risk Predictor", type: "Regression", color: C.red,
    source: "gold.cold_chain_compliance",
    target: "spoilage_risk_score",
    features: "max_temp_celsius, exceedance_minutes, humidity_avg, product_category, route_id, season",
    scenario: "Predict which São Paulo→Buenos Aires shipments will spoil before arrival",
    nightmare: "#6 (Carrier Black Hole)",
  },
  {
    name: "Delivery SLA Predictor", type: "Classification", color: C.qlikGreen,
    source: "gold.last_mile_performance",
    target: "sla_met (Y/N)",
    features: "carrier, destination_region, address_quality_score, weight_kg, promised_sla_hours, day_of_week",
    scenario: "Predict which APAC shipments will miss SLA — enable proactive customer notification",
    nightmare: "#2 (Address Catastrophe)",
  },
];

models.forEach((m, i) => {
  const x = 0.5 + i * 6.4;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y: 1.4, w: 6.1, h: 4.5,
    fill: { color: C.lightBg }, rectRadius: 0.12,
    line: { color: m.color, width: 2 },
  });
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: x + 0.1, y: 1.5, w: 5.9, h: 0.6,
    fill: { color: m.color }, rectRadius: 0.06,
  });
  slide.addText(`${m.name}  (${m.type})`, {
    x: x + 0.1, y: 1.5, w: 5.9, h: 0.6,
    fontSize: 14, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
  const fields = [
    ["Source:", m.source],
    ["Target:", m.target],
    ["Features:", m.features],
    ["Scenario:", m.scenario],
    ["Nightmare:", m.nightmare],
  ];
  fields.forEach((f, j) => {
    slide.addText(f[0], {
      x: x + 0.3, y: 2.25 + j * 0.7, w: 1.5, h: 0.3,
      fontSize: 11, color: C.qlikBlue, fontFace: FONT, bold: true,
    });
    slide.addText(f[1], {
      x: x + 1.7, y: 2.25 + j * 0.7, w: 4.1, h: j === 2 ? 0.55 : 0.3,
      fontSize: 10, color: C.darkText, fontFace: FONT,
    });
  });
});

// ─── Slide: Qlik Answers — Document Intelligence ───
slide = contentSlide("Qlik Answers — Document Intelligence & Knowledge Base", C.qlikPurple);

slide.addText("Agentic AI that answers questions from 25 MCG operational documents with citations and reasoning", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

// KB summary
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.4, w: 5.5, h: 2.5,
  fill: { color: C.lightBg }, rectRadius: 0.12,
  line: { color: C.qlikPurple, width: 2 },
});
slide.addText("Knowledge Base: 25 Documents", {
  x: 0.7, y: 1.5, w: 5.1, h: 0.45,
  fontSize: 15, color: C.qlikPurple, fontFace: FONT, bold: true,
});
const docTypes = [
  "5 SOPs (warehouse, cold chain, returns, ...)",
  "3 Carrier contracts (NinjaVan, FedEx, DPD)",
  "4 Policies (cold chain, data governance, ...)",
  "2 Purchase orders + 2 Supplier comms",
  "2 Incident reports + 1 Recall notice",
  "2 Training docs + 1 Meeting minutes",
  "1 Compliance plan + 1 Project brief",
];
docTypes.forEach((doc, i) => {
  slide.addText(`▸  ${doc}`, {
    x: 0.7, y: 2.0 + i * 0.27, w: 5.1, h: 0.25,
    fontSize: 10, color: C.darkText, fontFace: FONT,
  });
});

// Test scenarios
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 6.3, y: 1.4, w: 6.5, h: 2.5,
  fill: { color: C.lightBg }, rectRadius: 0.12,
  line: { color: C.qlikTeal, width: 2 },
});
slide.addText("Demo Scenarios", {
  x: 6.5, y: 1.5, w: 6.1, h: 0.45,
  fontSize: 15, color: C.qlikTeal, fontFace: FONT, bold: true,
});
const answersScenarios = [
  { q: "\"What is the goods receiving procedure?\"", ref: "→ SOP-WH-001" },
  { q: "\"What happened at Rotterdam in September?\"", ref: "→ INC-2025-04872" },
  { q: "\"What are cold chain temp requirements?\"", ref: "→ SOP-SC-002, MCG-POL-012" },
  { q: "\"What is Project CLARITY?\"", ref: "→ PROJ-CLARITY-2025" },
  { q: "\"What caused the lettuce recall?\"", ref: "→ RCL-2025-003" },
];
answersScenarios.forEach((s, i) => {
  slide.addText(s.q, {
    x: 6.5, y: 2.0 + i * 0.38, w: 4.3, h: 0.35,
    fontSize: 10, color: C.qlikBlue, fontFace: FONT, bold: true,
  });
  slide.addText(s.ref, {
    x: 10.8, y: 2.0 + i * 0.38, w: 2, h: 0.35,
    fontSize: 10, color: C.medGray, fontFace: FONT, italic: true,
  });
});

// Knowledge Mart callout
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 4.2, w: 12.3, h: 0.7,
  fill: { color: C.lightPurple }, rectRadius: 0.08,
});
slide.addText("Knowledge Mart [NEW]: Automate the RAG pipeline — structured-to-document transformation, vectorization, and incremental loading to vector stores. Keeps Qlik Answers grounded in fresh data. GA July 2025.", {
  x: 0.8, y: 4.25, w: 11.8, h: 0.6,
  fontSize: 11, color: C.qlikPurple, fontFace: FONT,
});

// ─── Slide: Discovery Agent + MCP ───
slide = contentSlide("Discovery Agent & MCP Server", C.qlikPurple);

// Left: Discovery Agent
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.1, w: 6.0, h: 3.8,
  fill: { color: C.lightBg }, rectRadius: 0.12,
  line: { color: C.qlikPurple, width: 2 },
});
slide.addText("Discovery Agent", {
  x: 0.7, y: 1.2, w: 5.5, h: 0.5,
  fontSize: 18, color: C.qlikPurple, fontFace: FONT, bold: true,
});
slide.addText("Proactive AI that monitors data products for anomalies", {
  x: 0.7, y: 1.7, w: 5.5, h: 0.35,
  fontSize: 12, color: C.medGray, fontFace: FONT, italic: true,
});
const agentItems = [
  "Monitors gold-layer data products continuously",
  "Detects: Trust Score drops, sync lag, volume anomalies",
  "MCG scenario: TransFrio spoilage detection",
  "Alert thresholds: Trust < 0.70, Lag > 60 min, Volume ±50%",
  "Links to dashboards, contracts, incident reports",
  "\"Temp exceedance on GRU-BA route. Spoilage up 4x.\"",
  "\"12 active shipments at risk. Est. $180K exposure.\"",
];
agentItems.forEach((item, i) => {
  slide.addText(`▸  ${item}`, {
    x: 0.7, y: 2.1 + i * 0.37, w: 5.6, h: 0.34,
    fontSize: 11, color: C.darkText, fontFace: FONT,
  });
});

// Right: MCP Server
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 6.8, y: 1.1, w: 6.0, h: 3.8,
  fill: { color: C.lightBg }, rectRadius: 0.12,
  line: { color: C.qlikTeal, width: 2 },
});
slide.addText("Qlik MCP Server", {
  x: 7.0, y: 1.2, w: 5.5, h: 0.5,
  fontSize: 18, color: C.qlikTeal, fontFace: FONT, bold: true,
});
slide.addText("Connect AI agents (Claude, GPT) directly to Qlik data", {
  x: 7.0, y: 1.7, w: 5.5, h: 0.35,
  fontSize: 12, color: C.medGray, fontFace: FONT, italic: true,
});
const mcpItems = [
  "npx @qlik/mcp-server",
  "Query data products via natural language",
  "List spaces, apps, connections programmatically",
  "Works with Claude Desktop, Claude Code, others",
  "MCG: \"What is IRA at Rotterdam DC?\"",
  "Response: \"74%, 847 phantom units, 143 SKUs\"",
  "Root cause: \"Silent pipeline failure (INC-2025-04872)\"",
];
mcpItems.forEach((item, i) => {
  slide.addText(`▸  ${item}`, {
    x: 7.0, y: 2.1 + i * 0.37, w: 5.6, h: 0.34,
    fontSize: 11, color: C.darkText, fontFace: FONT,
  });
});

// Agentic callout
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 5.2, w: 12.3, h: 0.7,
  fill: { color: C.lightPurple }, rectRadius: 0.08,
});
slide.addText("Agentic Analytics [GA Feb 2026]: Unified conversational interface combining structured analytics (Qlik Sense) + unstructured documents (Qlik Answers) + LLM reasoning. A single AI assistant that can query data, read documents, and reason across both.", {
  x: 0.8, y: 5.25, w: 11.8, h: 0.6,
  fontSize: 11, color: C.qlikPurple, fontFace: FONT,
});

// ─── Slide: AI — What to Show ───
slide = contentSlide("AI Story — What to Show in the Demo", C.qlikPurple);

yPos = 1.1;
yPos = recommendBox(slide, "Qlik Predict Live Demo", [
  "Open Spoilage Risk experiment → show training report, feature importance (temperature is #1 driver)",
  "Run a prediction on a live shipment: São Paulo→Buenos Aires, 32°C outside temp, Correios carrier → 87% spoilage risk",
  "Show prediction API endpoint → demonstrate external system consuming predictions",
], yPos, C.lightPurple);

yPos = recommendBox(slide, "Qlik Answers Conversation", [
  "Ask: \"What happened at Rotterdam DC in September?\" → Answers pulls from INC-2025-04872",
  "Follow up: \"What was the root cause?\" → TLS certificate expired, batch job failed silently",
  "Ask: \"What does Project CLARITY propose to fix this?\" → cross-document reasoning",
], yPos, C.lightPurple);

yPos = recommendBox(slide, "Discovery Agent Scenario", [
  "Show Discovery Agent alert: spoilage rate on GRU-BA route spiked 2.1% → 8.8% after fleet change",
  "Agent links to: cold chain dashboard, TransFrio carrier contract, incident report INC-2025-05102",
], yPos, C.lightPurple);

yPos = recommendBox(slide, "MCP Server Demo", [
  "In Claude Desktop: \"What is the current inventory accuracy at Rotterdam DC?\"",
  "Claude queries gold.supply_chain_health via MCP → returns: 74% IRA, 847 phantom units, root cause analysis",
], yPos, C.lightPurple);


// ═══════════════════════════════════════════════════
//  SUMMARY: Features to Add
// ═══════════════════════════════════════════════════
sectionSlide("★", "Features to Add to Demo", "Qlik Cloud capabilities not yet in the checklist — recommended additions");

slide = contentSlide("Missing Features — Prioritized Additions", C.red);

const missing = [
  { priority: "HIGH", feature: "Lineage + Impact Analysis", story: "Governance", effort: "Low — auto-populated from existing data" },
  { priority: "HIGH", feature: "Trust Score + Data Profiling", story: "Governance", effort: "Low — enable on Gold-layer products" },
  { priority: "HIGH", feature: "Native Data Alerts", story: "Analytics", effort: "Low — create 2-3 condition-based alerts" },
  { priority: "MED", feature: "Reporting Service + Subscriptions", story: "Analytics", effort: "Medium — build 1-2 report templates" },
  { priority: "MED", feature: "Section Access (Row-Level Security)", story: "Governance", effort: "Medium — configure for regional VP views" },
  { priority: "MED", feature: "Embedded Analytics (qlik-embed)", story: "Analytics", effort: "Medium — build a sample HTML page" },
  { priority: "MED", feature: "Business Logic / Logical Model", story: "Analytics", effort: "Low — define in app settings" },
  { priority: "LOW", feature: "Direct Query", story: "Integration", effort: "Low — create one Direct Query app" },
  { priority: "LOW", feature: "Notes / Bookmarks / Collections", story: "Analytics", effort: "Low — create during demo walk-through" },
  { priority: "LOW", feature: "Knowledge Mart", story: "AI", effort: "Medium — configure RAG pipeline" },
  { priority: "LOW", feature: "Custom MCG Theme", story: "Analytics", effort: "Low — upload JSON theme file" },
  { priority: "LOW", feature: "Data Marketplace", story: "Governance", effort: "Low — enable on data products" },
  { priority: "LOW", feature: "Mobile Analytics", story: "Analytics", effort: "Low — install app, log in" },
];

const mHeaders = [
  [
    { text: "Priority", options: { bold: true, color: C.white, fill: { color: C.red }, fontSize: 10, align: "center" } },
    { text: "Feature", options: { bold: true, color: C.white, fill: { color: C.red }, fontSize: 10 } },
    { text: "Story", options: { bold: true, color: C.white, fill: { color: C.red }, fontSize: 10, align: "center" } },
    { text: "Effort to Add", options: { bold: true, color: C.white, fill: { color: C.red }, fontSize: 10 } },
  ],
];
const mRows = missing.map((m, i) => {
  const pColor = m.priority === "HIGH" ? C.red : m.priority === "MED" ? C.qlikGreen : C.qlikGreen;
  return [
    { text: m.priority, options: { fontSize: 10, color: pColor, fill: { color: i % 2 === 0 ? C.lightBg : C.white }, bold: true, align: "center" } },
    { text: m.feature, options: { fontSize: 10, color: C.qlikBlue, fill: { color: i % 2 === 0 ? C.lightBg : C.white }, bold: true } },
    { text: m.story, options: { fontSize: 10, color: C.darkText, fill: { color: i % 2 === 0 ? C.lightBg : C.white }, align: "center" } },
    { text: m.effort, options: { fontSize: 10, color: C.darkText, fill: { color: i % 2 === 0 ? C.lightBg : C.white } } },
  ];
});

slide.addTable([...mHeaders, ...mRows], {
  x: 0.3, y: 1.0, w: 12.7,
  fontFace: FONT,
  border: { type: "solid", pt: 0.5, color: "D1D5DB" },
  colW: [1.3, 4.0, 2.2, 5.2],
  rowH: [0.32, ...Array(13).fill(0.35)],
});

// ═══════════════════════════════════════════════════
//  CLOSING SLIDE (End layout style)
// ═══════════════════════════════════════════════════
slide = pptx.addSlide();
slideNum++;
slide.background = { fill: C.white };
// Contrail background
slide.addImage({ path: COVER_BG, x: 0, y: 0, w: 13.33, h: 7.5 });
// Qlik logo top-left
slide.addImage({ path: QLIK_LOGO, x: 0.5, y: 0.4, w: 1.4, h: 0.62 });

slide.addText("Meridian Commerce Group", {
  x: 0.5, y: 1.6, w: 6.5, h: 0.5,
  fontSize: 16, color: C.qlikGray, fontFace: FONT, letterSpacing: 2,
});

slide.addText("One Platform.\nFour Stories.\nComplete Data Intelligence.", {
  x: 0.5, y: 2.2, w: 6.5, h: 1.6,
  fontSize: 30, color: C.qlikBlue, fontFace: FONT, bold: true, lineSpacingMultiple: 1.2,
});

const closingMetrics = [
  { val: "3", label: "Live Data Sources", color: C.qlikTeal },
  { val: "23", label: "Lakehouse Tables", color: C.qlikTeal },
  { val: "7", label: "Data Products", color: C.qlikGreen },
  { val: "7", label: "Dashboards", color: C.qlikGreen },
  { val: "2", label: "ML Models", color: C.qlikPurple },
  { val: "25", label: "KB Documents", color: C.qlikPurple },
];
closingMetrics.forEach((m, i) => {
  const x = 0.5 + (i % 6) * 2.1;
  const y = 4.2;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y, w: 1.8, h: 1.1,
    fill: { color: C.lightBg }, rectRadius: 0.08,
    line: { color: m.color, width: 1.5 },
  });
  slide.addText(m.val, {
    x, y: y + 0.05, w: 1.8, h: 0.6,
    fontSize: 28, color: m.color, fontFace: FONT, bold: true, align: "center",
  });
  slide.addText(m.label, {
    x, y: y + 0.65, w: 1.8, h: 0.35,
    fontSize: 9, color: C.darkText, fontFace: FONT, align: "center",
  });
});

slide.addText("Qlik Cloud  •  End-to-End Demo  •  Integration  •  Governance  •  Analytics  •  AI", {
  x: 0.5, y: 5.8, w: 11.5, h: 0.4,
  fontSize: 12, color: C.qlikGray, fontFace: FONT,
});

// ═══════════════════════════════════════════════════
//  SAVE
// ═══════════════════════════════════════════════════
const outPath = path.join(__dirname, "..", "MCG_Demo_Overview_Four_Stories.pptx");
pptx.writeFile({ fileName: outPath }).then(() => {
  console.log(`✅ PowerPoint saved: ${outPath} (${slideNum} slides)`);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
