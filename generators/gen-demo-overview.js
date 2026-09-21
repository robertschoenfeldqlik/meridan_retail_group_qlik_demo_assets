// Generate MCG Demo Overview PowerPoint — Four Stories
// Uses Qlik brand template (colors, fonts, contrail backgrounds, logo)
// Integrations | Governance | Analytics | AI & Outcomes
const PptxGenJS = require("pptxgenjs");
const path = require("path");
const fs = require("fs");

// ─── Qlik brand palette (from Qlik Powerpoint template theme1.xml) ───
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

// ─── Asset paths ───
const ASSETS = path.join(__dirname, "assets");
const COVER_BG = path.join(ASSETS, "qlik_cover_bg.png");
const DIVIDER_BG = path.join(ASSETS, "qlik_divider_bg.png");
const QLIK_LOGO = path.join(ASSETS, "qlik_logo.png");
const ICON_DIR = path.join(ASSETS, "icons");
const FONT = "Inter";

// ─── Icon chip: white circle + Qlik line-art icon (legible on any fill) ───
function iconBadge(slide, name, x, y, d, ring) {
  slide.addShape(pptx.shapes.OVAL, {
    x, y, w: d, h: d, fill: { color: "FFFFFF" },
    line: { color: ring || "A9B3B6", width: 1 },
    shadow: { type: "outer", blur: 3, offset: 1, color: "000000", opacity: 0.15 },
  });
  const p = path.join(ICON_DIR, name + ".png");
  if (fs.existsSync(p)) {
    const ip = d * 0.62, off = (d - ip) / 2;
    slide.addImage({ path: p, x: x + off, y: y + off, w: ip, h: ip });
  }
}

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pptx.author = "Qlik";
pptx.company = "Qlik";
pptx.title = "Project Qlarity — MCG Qlik Cloud Demo — Four Stories";

const deckMedia = require("./lib/deck-media");

let slideNum = 0;

// ─── HELPERS ───────────────────────────────────────
function footer(slide) {
  slideNum++;
  // Thin line separator
  slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 7.0, w: 12.33, h: 0.01, fill: { color: C.qlikGray } });
  // Qlik logo small
  slide.addImage({ path: QLIK_LOGO, x: 0.5, y: 7.1, w: 0.54, h: 0.3 });
  slide.addText("Project Qlarity  •  MCG Full Stack  •  Qlik Cloud", {
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
    fill: { color: C.qlikBlue, type: "solid", transparency: 15 },
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
  slide.addImage({ path: QLIK_LOGO, x: 11.0, y: 6.5, w: 1.19, h: 0.66 });
  return slide;
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
slide.addImage({ path: QLIK_LOGO, x: 0.5, y: 0.4, w: 1.12, h: 0.62 });

slide.addText("Meridian Commerce Group", {
  x: 0.5, y: 1.6, w: 6.5, h: 0.7,
  fontSize: 18, color: C.qlikGray, fontFace: FONT, letterSpacing: 2,
});
slide.addText("Qlik Cloud\nFull Stack", {
  x: 0.5, y: 2.3, w: 6.5, h: 1.6,
  fontSize: 38, color: C.qlikBlue, fontFace: FONT, bold: true, lineSpacingMultiple: 1.1,
});
slide.addText("Project Qlarity  ·  Integrations  •  Governance  •  Analytics  •  AI & Outcomes", {
  x: 0.5, y: 4.0, w: 7.5, h: 0.5,
  fontSize: 16, color: C.qlikGreen, fontFace: FONT, bold: true,
});
slide.addText("From 47 fragmented systems to a trusted, AI-ready data platform", {
  x: 0.5, y: 4.7, w: 6.5, h: 0.5,
  fontSize: 14, color: C.darkText, fontFace: FONT,
});

// Four story boxes
const stories = [
  { label: "Integrations", color: C.qlikTeal },
  { label: "Governance", color: C.qlikGreen },
  { label: "Analytics", color: C.qlikBlue },
  { label: "AI & Outcomes", color: C.qlikLightGreen },
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
// SLIDE 2: Technical Architecture — Qlik Cloud Full Stack
// ═══════════════════════════════════════════════════
(function slide_technical_architecture() {
  const s = contentSlide("Technical Architecture — Qlik Cloud Full Stack", C.qlikBlue);

  // ── Helper: row badge on the left ──
  function rowBadge(label, y, color) {
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.3, y, w: 1.35, h: 0.45,
      fill: { color }, rectRadius: 0.06,
    });
    s.addText(label, {
      x: 0.3, y, w: 1.35, h: 0.45,
      fontSize: 8, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
    });
  }

  // ── Helper: component box with a left icon chip + left-aligned text ──
  function compBox(x, y, w, h, icon, title, subtitle, bgColor) {
    h = h || 0.95;
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x, y, w, h,
      fill: { color: bgColor || C.lightBg }, rectRadius: 0.08,
      shadow: { type: "outer", blur: 3, offset: 1, color: "D0D0D0", opacity: 0.3 },
    });
    const d = Math.min(0.56, h - 0.2, w * 0.3);
    iconBadge(s, icon, x + 0.12, y + (h - d) / 2, d, C.qlikGray);
    const tx = x + 0.12 + d + 0.12;
    const tw = w - (tx - x) - 0.1;
    s.addText(title, {
      x: tx, y: y + 0.08, w: tw, h: subtitle ? 0.34 : h - 0.16,
      fontSize: 10, color: C.qlikBlue, fontFace: FONT, bold: true,
      align: "left", valign: subtitle ? "bottom" : "middle",
    });
    if (subtitle) {
      s.addText(subtitle, {
        x: tx, y: y + 0.44, w: tw, h: h - 0.5,
        fontSize: 8, color: C.medGray, fontFace: FONT, align: "left", valign: "top",
        lineSpacingMultiple: 1.02,
      });
    }
  }

  // ── Row 1: DATA SOURCES (y=1.1) ──
  rowBadge("DATA SOURCES", 1.3, C.qlikTeal);
  compBox(1.85, 1.1, 3.2, 0.95, "database", "PostgreSQL (WMS)", "CDC — Change Data Capture", C.lightTeal);
  compBox(5.25, 1.1, 3.2, 0.95, "stream", "Apache Kafka (IoT)", "Streaming — Cold Chain & Carrier", C.lightTeal);
  compBox(8.65, 1.1, 3.2, 0.95, "cloud", "Salesforce CRM", "API — Contacts, Orders, Products", C.lightTeal);

  // ── Flow arrow 1→2 ──
  s.addText("▼", { x: 6.1, y: 2.08, w: 1, h: 0.5, fontSize: 18, color: C.qlikGray, fontFace: FONT, align: "center" });

  // ── Row 2: QLIK CLOUD PLATFORM (y=2.7) ──
  rowBadge("QLIK CLOUD", 2.9, C.qlikGreen);
  // Large container
  s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 1.85, y: 2.55, w: 10.0, h: 1.35,
    fill: { color: C.lightGreen }, rectRadius: 0.1,
    shadow: { type: "outer", blur: 4, offset: 1, color: "D0D0D0", opacity: 0.25 },
  });
  compBox(2.05, 2.65, 3.1, 0.85, "lakehouse", "Open Lakehouse", "Bronze → Silver → Gold", C.white);
  compBox(5.35, 2.65, 3.1, 0.85, "pipeline", "Qlik Cloud Pipelines", "2 declarative projects (YAML)", C.white);
  compBox(8.65, 2.65, 3.0, 0.85, "transform", "Talend Cloud", "Address Validation & Cleansing", C.white);

  // ── Flow arrow 2→3 ──
  s.addText("▼", { x: 6.1, y: 3.92, w: 1, h: 0.5, fontSize: 18, color: C.qlikGray, fontFace: FONT, align: "center" });

  // ── Row 3: ANALYTICS & GOVERNANCE (y=4.3) ──
  rowBadge("ANALYTICS", 4.5, C.qlikBlue);
  compBox(1.85, 4.3, 3.2, 0.95, "analytics", "Qlik Analytics", "2 Apps  •  10 Sheets", C.lightBlue);
  compBox(5.25, 4.3, 3.2, 0.95, "predict", "Qlik Predict", "2 AutoML Models", C.lightBlue);
  compBox(8.65, 4.3, 3.2, 0.95, "governance", "Governance", "Trust • Lineage • Glossary • Stewardship", C.lightBlue);

  // ── Flow arrow 3→4 ──
  s.addText("▼", { x: 6.1, y: 5.28, w: 1, h: 0.5, fontSize: 18, color: C.qlikGray, fontFace: FONT, align: "center" });

  // ── Row 4: AI & OUTCOMES (y=5.7) ──
  rowBadge("AI & OUTCOMES", 5.9, C.qlikLightGreen);
  compBox(1.85, 5.7, 2.3, 0.95, "answers", "Qlik Answers", "25 Documents", C.lightGreen);
  compBox(4.35, 5.7, 2.3, 0.95, "agent", "Discovery Agent", "Autonomous Analysis", C.lightGreen);
  compBox(6.85, 5.7, 2.3, 0.95, "mcp", "MCP Server", "Claude Integration", C.lightGreen);
  compBox(9.35, 5.7, 2.5, 0.95, "automation", "Automations", "Teams Notifications", C.lightGreen);

  // ── Right sidebar callout ──
  s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 12.1, y: 1.1, w: 1.05, h: 5.55,
    fill: { color: C.lightBlue }, rectRadius: 0.1,
    line: { color: C.qlikBlue, width: 1 },
  });
  s.addText("7\nNightmares", {
    x: 12.1, y: 2.0, w: 1.05, h: 1.0,
    fontSize: 11, color: C.qlikBlue, fontFace: FONT, bold: true, align: "center", valign: "middle",
    lineSpacingMultiple: 1.1,
  });
  s.addText("$127M/yr", {
    x: 12.1, y: 3.0, w: 1.05, h: 0.5,
    fontSize: 10, color: C.qlikTeal, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
})();

// ═══════════════════════════════════════════════════
// SLIDE 3: Functional Architecture — The Four Stories
// ═══════════════════════════════════════════════════
(function slide_functional_architecture() {
  const s = contentSlide("Functional Architecture — The Four Stories", C.qlikGreen);

  // ── Helper: column header badge ──
  function colHeader(x, w, num, label, color, icon) {
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x, y: 1.0, w, h: 0.45,
      fill: { color }, rectRadius: 0.06,
    });
    if (icon) iconBadge(s, icon, x + 0.1, 1.055, 0.34, C.white);
    s.addText(`${num}. ${label}`, {
      x, y: 1.0, w, h: 0.45,
      fontSize: 11, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
    });
  }

  // ── Helper: column item list ──
  function colItems(x, w, items, bgColor) {
    const itemH = 0.38;
    const startY = 1.6;
    // Column background
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x, y: startY - 0.05, w, h: items.length * itemH + 0.2,
      fill: { color: bgColor }, rectRadius: 0.08,
      shadow: { type: "outer", blur: 3, offset: 1, color: "D0D0D0", opacity: 0.25 },
    });
    items.forEach((item, i) => {
      s.addText(`▸  ${item}`, {
        x: x + 0.15, y: startY + i * itemH, w: w - 0.3, h: itemH,
        fontSize: 9.5, color: C.darkText, fontFace: FONT,
      });
    });
  }

  // ── Helper: flow arrow between columns ──
  function flowArrow(x) {
    s.addText("▶", {
      x: x - 0.25, y: 2.8, w: 0.5, h: 0.5,
      fontSize: 16, color: C.qlikGray, fontFace: FONT, align: "center",
    });
  }

  // ── Column 1: INTEGRATIONS ──
  colHeader(0.5, 3.0, "1", "Integrations", C.qlikTeal, "pipeline");
  colItems(0.5, 3.0, [
    "3 Data Sources",
    "2 Declarative Pipeline Projects (8 feeds)",
    "Bronze Layer (8 tables)",
    "Real-time & Batch",
    "Data Movement Gateway",
  ], C.lightTeal);

  flowArrow(3.6);

  // ── Column 2: GOVERNANCE ──
  colHeader(3.7, 3.0, "2", "Governance", C.qlikGreen, "governance");
  colItems(3.7, 3.0, [
    "8 Transformation Routes",
    "Silver Layer (cleansed)",
    "2 Gold Data Products",
    "Trust Score & Lineage",
    "Business Glossary (25 terms)",
    "4 Stewardship Sprints",
  ], C.lightGreen);

  flowArrow(6.8);

  // ── Column 3: ANALYTICS ──
  colHeader(6.9, 3.0, "3", "Analytics", C.qlikBlue, "analytics");
  colItems(6.9, 3.0, [
    "2 Qlik Analytics Apps (10 sheets)",
    "Agentic Analytics & NLI",
    "Data Alerts & Reports",
    "5 Automations (Teams)",
    "MCG Dark Theme",
  ], C.lightBlue);

  flowArrow(10.0);

  // ── Column 4: AI & OUTCOMES ──
  colHeader(10.1, 2.7, "4", "AI & Outcomes", C.qlikLightGreen, "agent");
  colItems(10.1, 2.7, [
    "2 Predict Models (Spoilage/SLA)",
    "Qlik Answers (25 docs)",
    "Discovery Agent",
    "MCP Server (Claude)",
    "Closed-Loop Automation",
  ], C.lightGreen);

  // ── Bottom summary bar ──
  s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 5.9, w: 12.3, h: 0.6,
    fill: { color: C.lightBg }, rectRadius: 0.08,
    line: { color: C.qlikGray, width: 0.75 },
  });
  s.addText("Total:  3 Sources  →  18 Tables  →  9 Flows  →  2 Products  →  10 Sheets  →  2 Models  →  25 Docs  →  5 Automations", {
    x: 0.7, y: 5.9, w: 11.9, h: 0.6,
    fontSize: 11, color: C.qlikBlue, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
})();

// ═══════════════════════════════════════════════════
// SLIDE 4: Agenda — Four Stories
// ═══════════════════════════════════════════════════
slide = contentSlide("Demo Agenda — Four Stories, One Platform");

slide.addText("Four proof points behind Project Qlarity's business case — MCG's unified Qlik data platform", {
  x: 0.5, y: 0.86, w: 12.3, h: 0.24,
  fontSize: 12, color: C.qlikGreen, fontFace: FONT, italic: true,
});

const agendaItems = [
  {
    num: "1", title: "The Integrations Story", color: C.qlikTeal,
    desc: "CDC, Kafka streaming, Salesforce → Open Lakehouse (Bronze/Silver/Gold)",
    components: "CDC • Data Flows • Table Recipes",
  },
  {
    num: "2", title: "The Governance Story", color: C.qlikGreen,
    desc: "Data Products, Lineage, Impact Analysis, Trust Score, Data Profiling, Stewardship Sprints, Business Glossary, Data Marketplace",
    components: "Data Products • Lineage • Impact Analysis • Trust Score • Profiling • Stewardship • Glossary • Data Marketplace",
  },
  {
    num: "3", title: "The Analytics Story", color: C.qlikGreen,
    desc: "Qlik Analytics dashboards, Analytics Engine (associative model), Natural Language Insights, Business Logic, native alerting, reporting & subscriptions, automations",
    components: "Qlik Analytics • Analytics Engine • Associative Model • NLI • Business Logic • Alerting • Reporting • Automations",
  },
  {
    num: "4", title: "The AI & Outcomes Story", color: C.qlikLightGreen,
    desc: "Consumption-side AI (Agentic Analytics, Qlik Answers, Qlik Predict, Discovery Agent, MCP Server) plus build-side agentic engineering — declarative pipelines as code, the governance agents, and Talend agentic routes",
    components: "Agentic Analytics • Qlik Answers • Predict • Discovery Agent • MCP • Declarative Pipelines • Governance Agents • Talend Agentic Routes",
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
//  STORY 1: INTEGRATIONS
// ═══════════════════════════════════════════════════
sectionSlide("1", "The Integrations Story", "From 47 fragmented systems to a unified, real-time data fabric", C.qlikBlue);

// ─── Slide: Data Sources & Connectivity ───
slide = contentSlide("Data Sources & Connectivity", C.qlikTeal);

slide.addText("Three live data sources feeding the Qlik Open Lakehouse in real-time", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

const sources = [
  {
    name: "PostgreSQL (WMS)", method: "CDC via Data Movement gateway", color: C.qlikTeal,
    tables: "inventory_positions • warehouse_events • shipments",
    detail: "Real-time Change Data Capture, logical replication, sub-second latency",
  },
  {
    name: "Apache Kafka (IoT)", method: "Streaming via Data Gateway - Streaming", color: C.qlikBlue,
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

// ─── Slide: Connecting the Sources — Gateways ───
slide = contentSlide("Connecting the Sources — Data Movement Gateway", C.qlikTeal);

slide.addText("Local databases reach Qlik Cloud through a registered gateway: one-time registration, then a connection per source created in a Data Integration project.", {
  x: 0.5, y: 0.85, w: 12.3, h: 0.5,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

// Column 1 — Register the gateway
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.5, w: 6.0, h: 3.05,
  fill: { color: C.lightBg }, rectRadius: 0.1, line: { color: C.qlikTeal, width: 1.5 },
});
slide.addText("1 · Register the gateway", {
  x: 0.7, y: 1.6, w: 5.6, h: 0.4, fontSize: 15, color: C.qlikTeal, fontFace: FONT, bold: true,
});
bulletList(slide, [
  "Deploy UI → Local Stack & Gateway → Register Gateway / Get Token",
  "(or run agentctl in the mcg-qlik-dmg container) to print the token",
  "Qlik Cloud → Administration → Data Gateways → Register",
  "Paste the token, then wait for status Connected",
], 0.7, 2.15, 5.7, { fontSize: 11.5, spacing: 0.5 });

// Column 2 — Create source connections
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 6.8, y: 1.5, w: 6.0, h: 3.05,
  fill: { color: C.lightBg }, rectRadius: 0.1, line: { color: C.qlikBlue, width: 1.5 },
});
slide.addText("2 · Create source connections", {
  x: 7.0, y: 1.6, w: 5.6, h: 0.4, fontSize: 15, color: C.qlikBlue, fontFace: FONT, bold: true,
});
bulletList(slide, [
  "Data Integration → your project → Create connection",
  "Choose PostgreSQL / MySQL / SQL Server",
  "Select the mcg-qlik-dmg gateway from the dropdown",
  "Enter host/port/db/credentials → Test → Save",
], 7.0, 2.15, 5.7, { fontSize: 11.5, spacing: 0.5 });

// Gateway-types note
recommendBox(slide, "Gateway types", [
  "Data Movement gateway → database CDC sources (Postgres / MySQL / SQL Server) — used here",
  "Data Gateway - Streaming → required for Kafka sources (a separate gateway type)",
  "Salesforce / S3 / Athena → credentialed connectors created in Data → Create connection",
], 4.8, C.lightGreen);

// Callout: API limitation
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 6.4, w: 12.3, h: 0.5, fill: { color: C.lightCyan }, rectRadius: 0.08,
});
slide.addText("Note: a Data Movement gateway connection is created in the Data Integration UI by selecting the gateway — the public REST API cannot create it, so the deploy script skips these sources with on-screen guidance.", {
  x: 0.8, y: 6.42, w: 11.8, h: 0.45,
  fontSize: 10.5, color: C.qlikTeal, fontFace: FONT, bold: true,
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
    tables: "warehouse_events_clean • inventory_reconciled • addresses_standardized • products_harmonized • shipments_canonical • iot_normalized • suppliers_deduped • order_delivery_timeline",
  },
  {
    name: "GOLD", label: "Business-Ready Data Products", count: "2 tables", color: C.qlikBlue, bg: C.lightBlue,
    tables: "supply_chain_health • last_mile_performance",
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
  { text: r.nightmare, options: { fontSize: 10, color: C.qlikTeal, fill: { color: i % 2 === 0 ? C.lightBg : C.white }, align: "center", bold: true } },
]);

slide.addTable([...rtHeaders, ...rtRows], {
  x: 0.5, y: 1.3, w: 12.3,
  fontFace: FONT,
  border: { type: "solid", pt: 0.5, color: "D1D5DB" },
  colW: [0.6, 3.2, 6.0, 2.5],
  rowH: [0.38, ...Array(8).fill(0.45)],
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
slide = contentSlide("Integrations Story — What to Show in the Demo", C.qlikTeal);

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
  "Pipelines as code: the whole project is declarative YAML — API import, daily schedules, git round-trip (QTCP preview)",
], yPos, C.lightCyan);


// ═══════════════════════════════════════════════════
//  STORY 2: GOVERNANCE
// ═══════════════════════════════════════════════════
sectionSlide("2", "The Governance Story", "Trust, transparency, and quality at every layer", C.qlikBlue);

// ─── Slide: Data Products for Analytics ───
slide = contentSlide("Qlik Data Products for Analytics", C.qlikGreen);

slide.addText("Governed, curated datasets with ownership, quality signals, and API access — the foundation of trusted analytics", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

const products = [
  { name: "Supply Chain Health", owner: "Henrik Jansen", refresh: "Daily 06:00 UTC", trust: "4.5", api: true },
  { name: "Last Mile Performance", owner: "Sophie Muller", refresh: "Daily 06:00 UTC", trust: "4.2", api: true },
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
  "Supports SQL DBs, CSV, XLSX, Snowflake, Iceberg",
  "MCG use: Profile bronze.contacts_raw → show 11% format issues, 6% truncation at 30 chars",
];
profItems.forEach((item, i) => {
  slide.addText(`▸  ${item}`, {
    x: 7.0, y: 2.1 + i * 0.42, w: 5.6, h: 0.38,
    fontSize: 11, color: C.darkText, fontFace: FONT,
  });
});

// ─── Slide: Stewardship Sprints ───
slide = contentSlide("Stewardship — Human-in-the-Loop Data Quality", C.qlikGreen);

slide.addText("Crowdsource data corrections to domain experts with tracked sprints", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

const sprints = [
  { name: "Address Cleanup", source: "mcg_sf_address_validate_bulk", filter: "no GPS resolved", owner: "Customer Data Team", nightmare: "#2", records: "~640" },
  { name: "Supplier Dedup", source: "silver.suppliers_deduped", filter: "confidence < 0.9", owner: "Procurement Team", nightmare: "#3", records: "~160" },
  { name: "Missing Weights", source: "silver.products_harmonized", filter: "weight_kg IS NULL", owner: "Product Data Team", nightmare: "#3", records: "~8,200" },
  { name: "Lot Number Compliance", source: "silver.inventory_reconciled", filter: "perishable AND lot IS NULL", owner: "Quality Team", nightmare: "#7", records: "~15%" },
];

const campHeaders = [
  [
    { text: "Sprint", options: { bold: true, color: C.white, fill: { color: C.qlikGreen }, fontSize: 10 } },
    { text: "Data Source", options: { bold: true, color: C.white, fill: { color: C.qlikGreen }, fontSize: 10 } },
    { text: "Filter", options: { bold: true, color: C.white, fill: { color: C.qlikGreen }, fontSize: 10 } },
    { text: "Owner", options: { bold: true, color: C.white, fill: { color: C.qlikGreen }, fontSize: 10 } },
    { text: "Nightmare", options: { bold: true, color: C.white, fill: { color: C.qlikGreen }, fontSize: 10, align: "center" } },
  ],
];
const campRows = sprints.map((c, i) => [
  { text: c.name, options: { fontSize: 10, color: C.qlikBlue, fill: { color: i % 2 === 0 ? C.lightBg : C.white }, bold: true } },
  { text: c.source, options: { fontSize: 10, color: C.darkText, fill: { color: i % 2 === 0 ? C.lightBg : C.white } } },
  { text: c.filter, options: { fontSize: 10, color: C.darkText, fill: { color: i % 2 === 0 ? C.lightBg : C.white } } },
  { text: c.owner, options: { fontSize: 10, color: C.darkText, fill: { color: i % 2 === 0 ? C.lightBg : C.white } } },
  { text: c.nightmare, options: { fontSize: 10, color: C.qlikTeal, fill: { color: i % 2 === 0 ? C.lightBg : C.white }, align: "center", bold: true } },
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
  "Open Data Products catalog → show both products with owners, Trust Scores, SLAs, API sharing status",
  "Click 'API Sharing' on Supply Chain Health → copy the endpoint → run a curl command to fetch live data",
  "Show Data Marketplace → demonstrate self-service data discovery for business users",
], yPos, C.lightGreen);

yPos = recommendBox(slide, "Lineage + Impact Analysis + Trust Score", [
  "Click gold.supply_chain_health → Lineage view → trace field-level path from PostgreSQL → Bronze → Silver → Gold",
  "Click Impact Analysis → show which apps, reports, and ML models depend on this data product",
  "Show Trust Score on gold.last_mile_performance → highlight Validity (4.5), Completeness (4.2), Discoverability (5.0)",
], yPos, C.lightGreen);

yPos = recommendBox(slide, "Stewardship + Glossary", [
  "Open Address Cleanup sprint → show the steward's queue (rows the bulk geocoder could not resolve to GPS)",
  "Open 'Phantom Inventory' glossary term → show definition, owner, linked datasets, related nightmares",
], yPos, C.lightGreen);

// ═══════════════════════════════════════════════════
//  STORY 3: ANALYTICS
// ═══════════════════════════════════════════════════
sectionSlide("3", "The Analytics Story", "From stale PowerPoints to real-time, interactive, AI-assisted insights", C.qlikBlue);

// ─── Slide: Qlik Analytics Dashboards ───
slide = contentSlide("Qlik Analytics — 2 Domain Apps (10 Sheets)", C.qlikGreen);

slide.addText("Interactive dashboards connected to Gold-layer data products with associative exploration", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

const apps = [
  { name: "Supply Chain Operations", focus: "5 sheets: Inventory accuracy, cold chain monitoring, quality, compliance, cost impact", nightmare: "#1, #3, #4, #6, #7" },
  { name: "Delivery & Customer Exp.", focus: "5 sheets: Last mile performance, order tracking, WISMO analysis, carrier SLAs, addresses", nightmare: "#2, #5, #6" },
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
  { text: a.nightmare, options: { fontSize: 10, color: C.qlikTeal, fill: { color: i % 2 === 0 ? C.lightBg : C.white }, align: "center", bold: true } },
]);

slide.addTable([...appHeaders, ...appRows], {
  x: 0.5, y: 1.4, w: 12.3,
  fontFace: FONT,
  border: { type: "solid", pt: 0.5, color: "D1D5DB" },
  colW: [3.5, 6.3, 2.5],
  rowH: [0.38, ...Array(2).fill(0.55)],
});

// ─── Slide: Analytics Engine & Intelligence ───
slide = contentSlide("Analytics Engine & Intelligent Insights", C.qlikGreen);

slide.addText("The Qlik Associative Engine — the foundation powering every dashboard, calculation, and AI interaction", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

const engineFeatures = [
  {
    title: "Associative Engine", color: C.qlikGreen, items: [
      "In-memory associative data model",
      "Green/white/gray selection states",
      "Set analysis for complex calculations",
      "Cross-source data associations",
      "No pre-defined drill paths or queries",
      "MCG: Select Rotterdam → all charts update",
    ],
  },
  {
    title: "Natural Language Insights", color: C.qlikTeal, items: [
      "Auto-generated narrative summaries",
      "Trend, outlier, and driver detection",
      "Linked directly to chart selections",
      "Plain-English explanations of data",
      "Updated Nov 2025: chart-linked NLI",
      "MCG: NLI on Supply Chain Health app",
    ],
  },
  {
    title: "Business Logic", color: C.qlikBlue, items: [
      "Logical Model defines relationships",
      "Vocabulary maps business terms",
      "Guides analytics + AI behavior",
      "Calendar & geographic hierarchies",
      "Measure definitions & formatting",
      "MCG: \"phantom\" → inventory_accuracy",
    ],
  },
];

engineFeatures.forEach((f, i) => {
  const x = 0.5 + i * 4.2;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y: 1.4, w: 3.9, h: 4.6,
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
      x: x + 0.3, y: 2.3 + j * 0.48, w: 3.4, h: 0.43,
      fontSize: 11, color: C.darkText, fontFace: FONT,
    });
  });
});

// Cross-reference to AI & Outcomes
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 6.2, w: 12.3, h: 0.55,
  fill: { color: C.lightGreen }, rectRadius: 0.08,
});
slide.addText("→  Story 4 — AI & Outcomes: The Agentic Analytics experience layers conversational AI and Qlik Answers on top of this engine. See the full agentic demo flow in Story 4.", {
  x: 0.8, y: 6.25, w: 11.8, h: 0.45,
  fontSize: 11, color: C.qlikLightGreen, fontFace: FONT, bold: true,
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

// ─── Slide: Qlik Automations ───
slide = contentSlide("Qlik Automations", C.qlikGreen);

slide.addText("No-code automation designer for scheduled reloads, alerts, and cross-system workflows", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.4, w: 12.3, h: 4.2,
  fill: { color: C.lightBg }, rectRadius: 0.12,
  line: { color: C.qlikGreen, width: 2 },
});

const autoItems = [
  "Block-based automation designer (no code)",
  "MCG Daily App Reload (06:00 UTC)",
  "Cold Chain Alert → Teams (every 5 min)",
  "Pipeline Health Summary → Teams (07:00 UTC)",
  "Stewardship Sprint Summary → daily digest",
  "Webhook triggers for external events",
  "100+ connector blocks (Teams, Slack, SMTP, REST, ...)",
];
autoItems.forEach((item, i) => {
  slide.addText(`▸  ${item}`, {
    x: 0.8, y: 1.6 + i * 0.5, w: 11.5, h: 0.45,
    fontSize: 13, color: C.darkText, fontFace: FONT,
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
yPos = recommendBox(slide, "Qlik Analytics Dashboard Tour", [
  "Open Supply Chain Health → show Rotterdam DC's IRA at 74%, drill into phantom inventory by SKU",
  "Open Cold Chain Monitoring → show live temperature exceedances on São Paulo→Buenos Aires route",
  "Switch to Executive Cost Impact → C-level view of $127M broken down by nightmare category",
], yPos, C.lightCyan);

yPos = recommendBox(slide, "Analytics Engine & NLI", [
  "Show associative selections: click Rotterdam DC → green/white/gray state across all charts instantly",
  "Open NLI object on Supply Chain Health → auto-generated narrative explaining IRA trend and key drivers",
  "Show Business Logic: Logical Model vocabulary mapping 'phantom' → inventory_accuracy",
], yPos, C.lightCyan);

yPos = recommendBox(slide, "Alerting + Reporting", [
  "Show a native alert: IRA < 85% for DC-RTD-01 → triggered, sent via email and push notification",
  "Open a subscription: weekly compliance PDF emailed to regulatory team every Monday 08:00",
], yPos, C.lightCyan);


// ═══════════════════════════════════════════════════
//  STORY 4: AI & OUTCOMES
// ═══════════════════════════════════════════════════
sectionSlide("4", "The AI & Outcomes Story", "From reactive dashboards to proactive, conversational, agentic intelligence", C.qlikBlue);

// ─── Slide: Agentic Analytics Experience ───
slide = contentSlide("Agentic Analytics — Unified AI Experience", C.qlikLightGreen);

slide.addText("A single conversational AI that queries data, reads documents, and reasons across both — now GA", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

const agenticFeatures = [
  {
    title: "Conversational Analytics", color: C.qlikLightGreen, items: [
      "Ask questions in natural language",
      "Qlik engine powers governed answers",
      "Auto-generates visualizations",
      "MCG: \"Show IRA by DC\"",
    ],
  },
  {
    title: "Agentic Reasoning", color: C.qlikTeal, items: [
      "Chain-of-thought multi-step logic",
      "Blends structured + unstructured",
      "Citations & explainability built in",
      "MCG: \"Why did Rotterdam IRA drop?\"",
    ],
  },
  {
    title: "Document Intelligence", color: C.qlikBlue, items: [
      "25 MCG operational documents",
      "SOPs, contracts, incident reports",
      "Cross-document reasoning",
      "MCG: \"What is Project Qlarity?\"",
    ],
  },
];

agenticFeatures.forEach((f, i) => {
  const x = 0.5 + i * 4.2;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y: 1.4, w: 3.9, h: 3.3,
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

// GA callout
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 4.9, w: 12.3, h: 0.55,
  fill: { color: C.lightGreen }, rectRadius: 0.08,
});
slide.addText("✓ Qlik Answers agentic experience is now GA — replaces legacy Insight Advisor with unified conversational AI across data and documents.", {
  x: 0.8, y: 4.95, w: 11.8, h: 0.45,
  fontSize: 12, color: C.qlikGreen, fontFace: FONT, bold: true,
});

// Qlik Answers flow
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 5.6, w: 12.3, h: 0.55,
  fill: { color: C.lightCyan }, rectRadius: 0.08,
});
slide.addText("→  Powered by the Qlik Associative Engine & Business Logic from Story 3 — Analytics. The engine provides governed calculations; Agentic Analytics adds conversational reasoning on top.", {
  x: 0.8, y: 5.65, w: 11.8, h: 0.45,
  fontSize: 11, color: C.qlikGreen, fontFace: FONT, bold: true,
});

// ─── Slide: Qlik Predict ───
slide = contentSlide("Qlik Predict — AutoML for Supply Chain", C.qlikLightGreen);

slide.addText("Train, deploy, and share ML models without code — predictions served via API", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

// Two model cards
const models = [
  {
    name: "Cold Chain Exceedance", type: "Classification", color: C.qlikTeal,
    source: "silver.iot_normalized (Open Lakehouse)",
    target: "alert_flag (Y/N)",
    features: "temperature_c, humidity_pct, battery_level_pct, battery_low, gps_gap, shock_detected, route_id, warehouse_id",
    scenario: "Predict which São Paulo→Buenos Aires readings will breach the cold chain before product spoils",
    nightmare: "#6 (Carrier Black Hole)",
  },
  {
    name: "Late Delivery Predictor", type: "Classification", color: C.qlikGreen,
    source: "silver.order_delivery_timeline (Open Lakehouse)",
    target: "delivered_late (Y/N)",
    features: "carrier_code, fulfillment_method, tracking_missing, delivery_attempts, exception_code, order_date",
    scenario: "Predict at ship time which orders will deliver late — enable proactive customer notification",
    nightmare: "#2 / #6 (tracking gaps + carrier reclassification)",
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
slide = contentSlide("Qlik Answers — Document Intelligence & Knowledge Base", C.qlikLightGreen);

slide.addText("Agentic AI that answers questions from 25 MCG operational documents with citations and reasoning", {
  x: 0.5, y: 0.85, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

// KB summary
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.4, w: 5.5, h: 2.5,
  fill: { color: C.lightBg }, rectRadius: 0.12,
  line: { color: C.qlikLightGreen, width: 2 },
});
slide.addText("Knowledge Base: 25 Documents", {
  x: 0.7, y: 1.5, w: 5.1, h: 0.45,
  fontSize: 15, color: C.qlikLightGreen, fontFace: FONT, bold: true,
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
    x: 0.7, y: 2.0 + i * 0.27, w: 5.1, h: 0.27,
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
  { q: "\"What is Project Qlarity?\"", ref: "→ PROJ-CLARITY-2025" },
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
  fill: { color: C.lightGreen }, rectRadius: 0.08,
});
slide.addText("Knowledge Mart: Automate the RAG pipeline — structured-to-document transformation, vectorization, and incremental loading to vector stores. Keeps Qlik Answers grounded in fresh data.", {
  x: 0.8, y: 4.25, w: 11.8, h: 0.6,
  fontSize: 11, color: C.qlikLightGreen, fontFace: FONT,
});

// ─── Slide: Discovery Agent + MCP ───
slide = contentSlide("Discovery Agent & MCP Server", C.qlikLightGreen);

// Left: Discovery Agent
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.1, w: 6.0, h: 3.8,
  fill: { color: C.lightBg }, rectRadius: 0.12,
  line: { color: C.qlikLightGreen, width: 2 },
});
slide.addText("Discovery Agent", {
  x: 0.7, y: 1.2, w: 5.5, h: 0.5,
  fontSize: 18, color: C.qlikLightGreen, fontFace: FONT, bold: true,
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
  "Cloud-hosted SSE endpoint: <tenant>/api/ai/mcp",
  "71 tools: App Discovery, Lineage, Data Products, Glossary...",
  "Query data products via natural language",
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

// Cross-reference
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 5.2, w: 12.3, h: 0.55,
  fill: { color: C.lightGreen }, rectRadius: 0.08,
});
slide.addText("Both tools integrate with the Agentic Analytics experience (see slide above) — Discovery Agent proactively surfaces issues; MCP enables external AI agents to query Qlik data directly.", {
  x: 0.8, y: 5.25, w: 11.8, h: 0.45,
  fontSize: 11, color: C.qlikLightGreen, fontFace: FONT,
});

// ═══════════════════════════════════════════════════
//  STORY 4 (build-side): AGENTIC DATA ENGINEERING
//  The counterpart to the consumption-side AI above —
//  author the pipeline / govern the data with AI.
// ═══════════════════════════════════════════════════

// ─── Slide: Declarative Pipelines & the VS Code Template ───
slide = contentSlide("Declarative Pipelines & the VS Code Template", C.qlikLightGreen);

slide.addText("The build side of AI: one underlying pipeline YAML — editable visually, programmatically, or with an AI coding agent — on a single path from raw data to a trusted, AI-ready data product.", {
  x: 0.5, y: 0.85, w: 12.3, h: 0.5,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

const authorModes = [
  {
    title: "Visual (UI)", color: C.qlikTeal, items: [
      "Qlik Talend Cloud pipeline canvas",
      "Point-and-click transforms",
      "Business-user friendly",
    ],
  },
  {
    title: "Code (IDE)", color: C.qlikBlue, items: [
      "Declarative YAML definition",
      "VS Code + third-party IDEs",
      "Git version control + CI/CD",
      "Export / import, schema-validated",
    ],
  },
  {
    title: "Agent (AI)", color: C.qlikLightGreen, items: [
      "AI coding agent authors the YAML",
      "\"Agent-friendly\" schema",
      "Prompt → Generate → Validate → Review",
      "Developer approves every change",
    ],
  },
];

authorModes.forEach((f, i) => {
  const x = 0.5 + i * 4.2;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y: 1.45, w: 3.9, h: 2.45,
    fill: { color: C.lightBg }, rectRadius: 0.12,
    line: { color: f.color, width: 2 },
  });
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: x + 0.1, y: 1.55, w: 3.7, h: 0.55,
    fill: { color: f.color }, rectRadius: 0.06,
  });
  slide.addText(f.title, {
    x: x + 0.1, y: 1.55, w: 3.7, h: 0.55,
    fontSize: 15, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
  f.items.forEach((item, j) => {
    slide.addText(`▸  ${item}`, {
      x: x + 0.3, y: 2.25 + j * 0.4, w: 3.4, h: 0.36,
      fontSize: 10.5, color: C.darkText, fontFace: FONT,
    });
  });
});

// MCG grounding — the whole pipeline is code
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 4.05, w: 12.3, h: 1.55,
  fill: { color: C.lightBg }, rectRadius: 0.1, line: { color: C.qlikLightGreen, width: 1.5 },
});
slide.addText("MCG today — the whole pipeline is code", {
  x: 0.7, y: 4.12, w: 11.9, h: 0.35,
  fontSize: 13, color: C.qlikLightGreen, fontFace: FONT, bold: true,
});
bulletList(slide, [
  "2 QTCP DATA_PIPELINE projects on Open Lakehouse — mcg-batch-pipeline (4 tasks) + mcg-streaming-pipeline (2 tasks) = 6 tasks authored as YAML",
  "Shipped as a VS Code template: deploy/pipelines/ with .vscode/settings.json, CLAUDE.md, .github/copilot-instructions.md per project (schema kit via \"npm run pipeline:template\")",
  "Demo edit: change \"MCG CRM Landing\" schedule FREQ=MINUTELY;INTERVAL=15 → INTERVAL=30 — a one-line git diff, then Apply-from-Remote",
], 0.7, 4.52, 11.9, { fontSize: 10.5, spacing: 0.36 });

// Raw → trusted flow strip
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 5.7, w: 12.3, h: 0.5,
  fill: { color: C.lightGreen }, rectRadius: 0.08,
});
slide.addText("Human-in-the-loop from raw → trusted: design in IDE + agent → Git / CI-CD deploy → quality → packaging → catalog & glossary → AI-ready output with trust scores.", {
  x: 0.7, y: 5.73, w: 11.9, h: 0.44,
  fontSize: 10.5, color: C.qlikGreen, fontFace: FONT, bold: true,
});

// Preview disclaimer
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 6.3, w: 12.3, h: 0.5,
  fill: { color: C.lightCyan }, rectRadius: 0.08,
});
slide.addText("Preview / roadmap: Qlik declarative-pipeline tooling is a Qlik internal preview (June 2026). Forward-looking — capabilities and timing may change.", {
  x: 0.7, y: 6.33, w: 11.9, h: 0.44,
  fontSize: 10, color: C.qlikTeal, fontFace: FONT, bold: true,
});

// ─── Slide: The Governance Agents ───
slide = contentSlide("The Governance Agents", C.qlikLightGreen);

slide.addText("Three conversational agents keep human expertise in the loop while packaging, validating, and cataloging data — Qlik frames these as Qlik Answers capabilities, not separate products.", {
  x: 0.5, y: 0.85, w: 12.3, h: 0.5,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

const govAgents = [
  {
    title: "Data Product Agent", color: C.qlikLightGreen, items: [
      "Create & manage data products by chat",
      "CRUD + conversational discovery",
      "Review & improve quality / completeness",
      "MCG: package Supply Chain Health & Last Mile Performance",
    ],
  },
  {
    title: "Data Quality Agent", color: C.qlikTeal, items: [
      "Helps stewards define & enforce DQ rules",
      "Assess quality across datasets by chat",
      "Create / map rules, run DQ metrics",
      "MCG: rules on silver.addresses_standardized",
    ],
  },
  {
    title: "Catalog & Business Glossary Agent", color: C.qlikBlue, items: [
      "NL queries over Qlik Cloud Catalog metadata",
      "Generate glossaries from apps, data products, a domain",
      "Standardize terms & synonyms",
      "MCG: extend the 25-term business glossary",
    ],
  },
];

govAgents.forEach((f, i) => {
  const x = 0.5 + i * 4.2;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y: 1.45, w: 3.9, h: 3.7,
    fill: { color: C.lightBg }, rectRadius: 0.12,
    line: { color: f.color, width: 2 },
  });
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: x + 0.1, y: 1.55, w: 3.7, h: 0.75,
    fill: { color: f.color }, rectRadius: 0.06,
  });
  slide.addText(f.title, {
    x: x + 0.2, y: 1.55, w: 3.5, h: 0.75,
    fontSize: 13, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
  f.items.forEach((item, j) => {
    slide.addText(`▸  ${item}`, {
      x: x + 0.3, y: 2.5 + j * 0.62, w: 3.4, h: 0.58,
      fontSize: 11, color: C.darkText, fontFace: FONT,
    });
  });
});

// Human-in-the-loop callout
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 5.35, w: 12.3, h: 0.95,
  fill: { color: C.lightGreen }, rectRadius: 0.08,
});
slide.addText("Human-in-the-loop by design: agent-generated glossary terms land as DRAFT and require human review before they become official. These are Qlik Answers capabilities, not standalone products — they bridge business and technical users.", {
  x: 0.7, y: 5.42, w: 11.9, h: 0.82,
  fontSize: 11, color: C.qlikGreen, fontFace: FONT, bold: true,
});

// ─── Slide: Talend Agentic Routes ───
slide = contentSlide("Talend Agentic Routes", C.qlikLightGreen);

slide.addText("AI-native workflows inside pipeline tasks — call LLMs, build RAG pipelines, and orchestrate agents, with MCP client support.", {
  x: 0.5, y: 0.85, w: 12.3, h: 0.4,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

const talendRoutes = [
  {
    title: "LLM integration", color: C.qlikTeal, items: [
      "Call LLMs from data tasks",
      "Cloud: OpenAI, Anthropic Claude, Google Gemini, Amazon Bedrock",
      "On-prem: Ollama, Mistral, Gemma 3, Phi 4",
      "Sentiment, entity extraction, classification",
    ],
  },
  {
    title: "RAG pipelines", color: C.qlikBlue, items: [
      "Build retrieval-augmented pipelines",
      "Vector targets: Pinecone, MongoDB, Snowflake, Databricks, Milvus, Oracle",
      "AI-assisted data quality in-task",
    ],
  },
  {
    title: "Agentic orchestration", color: C.qlikLightGreen, items: [
      "Event-driven agent orchestration",
      "Conversational AI",
      "Extensible tools + MCP client",
    ],
  },
];

talendRoutes.forEach((f, i) => {
  const x = 0.5 + i * 4.2;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y: 1.35, w: 3.9, h: 3.3,
    fill: { color: C.lightBg }, rectRadius: 0.12,
    line: { color: f.color, width: 2 },
  });
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: x + 0.1, y: 1.45, w: 3.7, h: 0.55,
    fill: { color: f.color }, rectRadius: 0.06,
  });
  slide.addText(f.title, {
    x: x + 0.1, y: 1.45, w: 3.7, h: 0.55,
    fontSize: 14, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
  f.items.forEach((item, j) => {
    slide.addText(`▸  ${item}`, {
      x: x + 0.3, y: 2.15 + j * 0.6, w: 3.4, h: 0.56,
      fontSize: 10.5, color: C.darkText, fontFace: FONT,
    });
  });
});

// MCG grounding — the Salesforce address job
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 4.8, w: 12.3, h: 1.0,
  fill: { color: C.lightBg }, rectRadius: 0.1, line: { color: C.qlikLightGreen, width: 1.5 },
});
slide.addText("MCG surface — the Salesforce address job", {
  x: 0.7, y: 4.87, w: 11.9, h: 0.32,
  fontSize: 13, color: C.qlikLightGreen, fontFace: FONT, bold: true,
});
slide.addText("Today's Talend job repairs and scores every Salesforce address, bulk-geocodes the batch against OSM Nominatim, and routes on one gate — GPS resolved goes to Iceberg, the rest to a Qlik Stewardship sprint. An agentic route adds an LLM-assisted correction step inside the same job, before the record ever reaches that queue.", {
  x: 0.7, y: 5.2, w: 11.9, h: 0.55,
  fontSize: 11, color: C.darkText, fontFace: FONT,
});

// Forward-looking note
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 5.95, w: 12.3, h: 0.5,
  fill: { color: C.lightCyan }, rectRadius: 0.08,
});
slide.addText("Forward-looking: agentic-engineering capabilities are emerging across Qlik Talend Cloud; MCP-server tooling is in Qlik preview (June 2026). Timing and scope may change.", {
  x: 0.7, y: 5.98, w: 11.9, h: 0.44,
  fontSize: 10, color: C.qlikTeal, fontFace: FONT, bold: true,
});

// ─── Slide: AI — What to Show ───
slide = contentSlide("AI & Outcomes Story — What to Show in the Demo", C.qlikLightGreen);

yPos = 1.1;
yPos = recommendBox(slide, "Agentic Analytics Experience", [
  "Open Qlik Answers → ask: \"Which distribution centers have the lowest inventory accuracy?\" → data agent queries Qlik Analytics",
  "Follow up: \"What happened at Rotterdam in September?\" → document agent pulls INC-2025-04872 with citations",
  "Ask: \"What does Project Qlarity propose to fix this?\" → chain-of-thought reasoning across data + documents",
], yPos, C.lightGreen);

yPos = recommendBox(slide, "Qlik Predict Live Demo", [
  "Open the Cold Chain Exceedance experiment → show training report, feature importance (temperature_c #1, battery_low #2)",
  "Run a prediction on a live GRU-BA reading: 11.2°C, battery 9% → 78% exceedance probability — the TransFrio story in one number",
  "Show prediction API endpoint → demonstrate external system consuming predictions",
], yPos, C.lightGreen);

yPos = recommendBox(slide, "Discovery Agent Scenario", [
  "Show Discovery Agent alert: spoilage rate on GRU-BA route spiked 2.1% → 8.8% after fleet change",
  "Agent links to: cold chain dashboard, TransFrio carrier contract, incident report INC-2025-05102",
], yPos, C.lightGreen);

yPos = recommendBox(slide, "MCP Server Demo", [
  "In Claude Desktop: \"What is the current inventory accuracy at Rotterdam DC?\"",
  "Claude queries gold.supply_chain_health via MCP → returns: 74% IRA, 847 phantom units, root cause analysis",
], yPos, C.lightGreen);


// ═══════════════════════════════════════════════════
//  SUMMARY: Features to Add
// ═══════════════════════════════════════════════════
sectionSlide("★", "Features to Add to Demo", "Qlik Cloud capabilities not yet in the checklist — recommended additions");

slide = contentSlide("Missing Features — Prioritized Additions", C.qlikBlue);

const missing = [
  { priority: "HIGH", feature: "Lineage + Impact Analysis", story: "Governance", effort: "Low — auto-populated from existing data" },
  { priority: "HIGH", feature: "Trust Score + Data Profiling", story: "Governance", effort: "Low — enable on Gold-layer products" },
  { priority: "HIGH", feature: "Native Data Alerts", story: "Analytics", effort: "Low — create 2-3 condition-based alerts" },
  { priority: "MED", feature: "Reporting Service + Subscriptions", story: "Analytics", effort: "Medium — build 1-2 report templates" },
  { priority: "MED", feature: "Section Access (Row-Level Security)", story: "Governance", effort: "Medium — configure for regional VP views" },
  { priority: "MED", feature: "Business Logic / Logical Model", story: "Analytics", effort: "Low — define in app settings" },
  { priority: "LOW", feature: "Knowledge Mart", story: "AI & Outcomes", effort: "Medium — configure RAG pipeline" },
  { priority: "LOW", feature: "Custom MCG Theme", story: "Analytics", effort: "Low — upload JSON theme file" },
  { priority: "LOW", feature: "Data Marketplace", story: "Governance", effort: "Low — enable on data products" },
];

const mHeaders = [
  [
    { text: "Priority", options: { bold: true, color: C.white, fill: { color: C.qlikBlue }, fontSize: 10, align: "center" } },
    { text: "Feature", options: { bold: true, color: C.white, fill: { color: C.qlikBlue }, fontSize: 10 } },
    { text: "Story", options: { bold: true, color: C.white, fill: { color: C.qlikBlue }, fontSize: 10, align: "center" } },
    { text: "Effort to Add", options: { bold: true, color: C.white, fill: { color: C.qlikBlue }, fontSize: 10 } },
  ],
];
const mRows = missing.map((m, i) => {
  const pColor = m.priority === "HIGH" ? C.qlikTeal : m.priority === "MED" ? C.qlikGreen : C.qlikGreen;
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
  rowH: [0.38, ...Array(9).fill(0.42)],
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
slide.addImage({ path: QLIK_LOGO, x: 0.5, y: 0.4, w: 1.12, h: 0.62 });

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
  { val: "18", label: "Lakehouse Tables", color: C.qlikTeal },
  { val: "2", label: "Data Products", color: C.qlikGreen },
  { val: "10", label: "Sheets (2 Apps)", color: C.qlikGreen },
  { val: "2", label: "ML Models", color: C.qlikLightGreen },
  { val: "25", label: "KB Documents", color: C.qlikLightGreen },
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
    fontSize: 10, color: C.darkText, fontFace: FONT, align: "center",
  });
});

slide.addText("Plus build-side AI — pipelines as code, governance agents, and agentic data engineering (preview)", {
  x: 0.5, y: 5.45, w: 11.5, h: 0.3,
  fontSize: 11, color: C.qlikGreen, fontFace: FONT, bold: true,
});

slide.addText("Qlik Cloud  •  Full Stack  •  Integrations  •  Governance  •  Analytics  •  AI & Outcomes", {
  x: 0.5, y: 5.8, w: 11.5, h: 0.4,
  fontSize: 12, color: C.qlikGray, fontFace: FONT,
});

// ═══════════════════════════════════════════════════
//  SAVE
// ═══════════════════════════════════════════════════

// --- Proof slides: the deployed environment, captured live -------------------
// Skipped entirely when a screenshot has not been captured, so the deck never
// shows an empty frame. Refresh: node generators/capture-tenant-screenshots.js
function proofSlide(title, slug, subtitle) {
  const hit = deckMedia.resolveShot(slug);
  if (!hit) return false;
  const slide = contentSlide(title, C.qlikTeal || C.qlikGreen);
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.6, y: 0.82, w: 12.1, h: 0.32,
      fontSize: 11, color: C.darkText, fontFace: FONT,
    });
  }
  deckMedia.screenshotCard(pptx, slide, hit.path, {
    x: 1.55, y: 1.32, w: 10.2, maxH: 5.2, caption: hit.caption, colors: C,
  });
  return true;
}

function renderProofs(list) {
  let shown = 0;
  for (const [t, slug, sub] of list) if (proofSlide(t, slug, sub)) shown++;
  if (shown) console.log(`    ${shown} proof slide(s) from captured screenshots`);
}

renderProofs([
    ['Deployed: Stewardship Sprint', 'stewardship-sprints', 'The Address Cleanup sprint - created over the API, fed by the Talend routing gate.'],
    ['Deployed: Automations', 'automations-list', 'All five MCG automations, each with a real block graph.'],
    ['Deployed: Data Products', 'data-products', 'The two governed gold data products.'],
    ['Deploy Console', 'deploy-ui-wizard', 'One repository, one command - or 11 guided steps.'],
]);


const outPath = path.join(__dirname, "..", "MCG_Demo_Overview_Four_Stories.pptx");
pptx.writeFile({ fileName: outPath }).then(() => {
  console.log(`✅ PowerPoint saved: ${outPath} (${slideNum} slides)`);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
