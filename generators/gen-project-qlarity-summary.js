// Generate MCG Project Qlarity — Executive Summary PowerPoint
// The one-deck overview of Project Qlarity: MCG's end-to-end Qlik Cloud demo.
// "Qlik" + "Clarity" — from 7 data-quality nightmares to a trusted, AI-ready platform.
// Uses the Qlik brand template (colors, fonts, contrail backgrounds, logo),
// mirroring gen-agentic-engineering.js styling and helpers.
const PptxGenJS = require("pptxgenjs");
const path = require("path");
const fs = require("fs");

// ─── Qlik brand palette (from Qlik Powerpoint template theme1.xml) ───
const C = {
  qlikBlue: "19416C",       // DEEP_BLUE — headings / dark bands
  qlikGreen: "009845",      // GREEN — primary accent
  qlikTeal: "006580",       // OCEAN
  qlikCyan: "10CFC9",       // SKY
  qlikLightGreen: "4CB393",
  qlikGray: "A9B3B6",
  darkText: "454659",       // body
  white: "FFFFFF",
  lightBg: "F6F7F8",        // ALABASTER
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
const MONO = "Inter";  // brand: Inter only — no non-brand mono font

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
pptx.company = "Qlik / Meridian Commerce Group";
pptx.title = "Project Qlarity — Meridian Commerce Group Qlik Cloud Demo";

let slideNum = 0;

// ─── HELPERS ───────────────────────────────────────
function footer(slide) {
  slideNum++;
  slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 7.0, w: 12.33, h: 0.01, fill: { color: C.qlikGray } });
  slide.addImage({ path: QLIK_LOGO, x: 0.5, y: 7.1, w: 0.54, h: 0.3 });
  slide.addText("Project Qlarity  •  MCG Demo  •  Qlik Cloud", {
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
    x: 0.5, y: 0.2, w: 9.2, h: 0.65,
    fontSize: 26, color: C.qlikBlue, fontFace: FONT, bold: true,
  });
  return slide;
}

// ─── Status pill (top-right): GA / PREVIEW / capability framing ───
function statusPill(slide, text, color) {
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 9.85, y: 0.28, w: 3.0, h: 0.44,
    fill: { color }, rectRadius: 0.22,
  });
  slide.addText(text, {
    x: 9.85, y: 0.28, w: 3.0, h: 0.44,
    fontSize: 10.5, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
}

// ─── Panel: rounded card with a colored header bar + bullet list ───
function panel(slide, x, y, w, h, headerText, headerColor, bullets, opts = {}) {
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h,
    fill: { color: C.lightBg }, rectRadius: 0.12,
    line: { color: headerColor, width: 2 },
  });
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: x + 0.1, y: y + 0.1, w: w - 0.2, h: 0.5,
    fill: { color: headerColor }, rectRadius: 0.06,
  });
  slide.addText(headerText, {
    x: x + 0.1, y: y + 0.1, w: w - 0.2, h: 0.5,
    fontSize: 14, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
  if (opts.icon) iconBadge(slide, opts.icon, x + 0.18, y + 0.16, 0.38, C.white);
  const spacing = opts.spacing || 0.62;
  const startY = y + 0.78;
  bullets.forEach((b, i) => {
    slide.addText(`▸  ${b}`, {
      x: x + 0.28, y: startY + i * spacing, w: w - 0.5, h: opts.h || 0.55,
      fontSize: opts.fs || 11.5, color: C.darkText, fontFace: FONT,
      lineSpacingMultiple: 1.02,
    });
  });
}

// ─── Full-width note band ───
function noteBand(slide, text, y, bg, color) {
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y, w: 12.3, h: 0.6, fill: { color: bg }, rectRadius: 0.08,
  });
  slide.addText(text, {
    x: 0.8, y: y + 0.02, w: 11.8, h: 0.55,
    fontSize: 11, color, fontFace: FONT, bold: true, valign: "middle",
  });
}

// ═══════════════════════════════════════════════════
// SLIDE 1: Title (Cover layout — contrail background)
// ═══════════════════════════════════════════════════
let slide = pptx.addSlide();
slide.addNotes("Open here. Project Qlarity — Qlik plus Clarity — is our repeatable framework for demoing the full Qlik Cloud stack end to end. Be clear it is a demo framework, not a product or a customer platform. Set up the arc: a fictional retailer with a messy data estate, walked through four connected acts — Integrations, Governance, Analytics, and AI & Outcomes.");
slideNum++;
slide.background = { fill: C.white };
slide.addImage({ path: COVER_BG, x: 0, y: 0, w: 13.33, h: 7.5 });
slide.addImage({ path: QLIK_LOGO, x: 0.5, y: 0.4, w: 1.12, h: 0.62 });

slide.addText("Meridian Commerce Group", {
  x: 0.5, y: 1.5, w: 8.0, h: 0.6,
  fontSize: 18, color: C.qlikGray, fontFace: FONT, letterSpacing: 2,
});
slide.addText("Project Qlarity", {
  x: 0.5, y: 2.15, w: 9.5, h: 1.1,
  fontSize: 52, color: C.qlikBlue, fontFace: FONT, bold: true,
});
slide.addText("The end-to-end Qlik Cloud demo", {
  x: 0.5, y: 3.35, w: 9.0, h: 0.55,
  fontSize: 20, color: C.qlikGreen, fontFace: FONT, bold: true,
});
slide.addText("Qlik + Clarity:  a repeatable framework for demoing the full Qlik Cloud stack, end to end.", {
  x: 0.5, y: 4.0, w: 10.5, h: 0.5,
  fontSize: 14, color: C.darkText, fontFace: FONT,
});

// Four-story chips
const storyChips = [
  { label: "Integrations", color: C.qlikTeal },
  { label: "Governance", color: C.qlikGreen },
  { label: "Analytics", color: C.qlikLightGreen },
  { label: "AI & Outcomes", color: C.qlikGreen },
];
storyChips.forEach((c, i) => {
  const x = 0.5 + i * 3.12;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y: 5.6, w: 2.9, h: 0.85,
    fill: { color: c.color }, rectRadius: 0.08,
  });
  slide.addText(c.label, {
    x, y: 5.6, w: 2.9, h: 0.85,
    fontSize: 13, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
});

// ═══════════════════════════════════════════════════
// SLIDE 2: What is Project Qlarity
// ═══════════════════════════════════════════════════
slide = contentSlide("What is Project Qlarity", C.qlikGreen);
slide.addNotes("Frame it plainly: this is a framework for demoing Qlik Cloud, not a platform we are selling. Meridian Commerce Group is our fictional global retailer with data scattered across 47 systems. The whole demo lives in one git repo and stands up with one command through the MCG Deploy console. Land the phrase: a framework, not a product.");

slide.addText("The initiative in plain terms — a repeatable framework for demoing the full Qlik Cloud stack, end to end", {
  x: 0.5, y: 0.86, w: 12.3, h: 0.4,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

// Naming callout card
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.4, w: 12.3, h: 1.1,
  fill: { color: C.lightGreen }, rectRadius: 0.12, line: { color: C.qlikGreen, width: 2 },
});
slide.addText([
  { text: "\"Qlik\"  +  \"Clarity\"  =  ", options: { bold: true, color: C.qlikBlue, fontSize: 20 } },
  { text: "Project Qlarity", options: { bold: true, color: C.qlikGreen, fontSize: 20 } },
], {
  x: 0.8, y: 1.5, w: 11.7, h: 0.45, fontFace: FONT, valign: "middle",
});
slide.addText("A repeatable framework for demoing how Qlik Cloud turns fragmented, messy data into trusted, AI-ready data products.", {
  x: 0.8, y: 1.98, w: 11.7, h: 0.45,
  fontSize: 13, color: C.darkText, fontFace: FONT, valign: "middle",
});

// Two explainer panels
panel(slide, 0.5, 2.75, 6.05, 3.35, "What it is", C.qlikTeal, [
  "Meridian Commerce Group (MCG) — a fictional global retail / commerce company",
  "MCG's data estate is scattered across 47 fragmented systems",
  "Project Qlarity is the framework for demoing that mess becoming trusted, governed Qlik data",
  "A complete, presentable end-to-end Qlik demo environment — a framework, not a product",
], { icon: "cloud", fs: 11.5, spacing: 0.66 });

panel(slide, 6.75, 2.75, 6.05, 3.35, "How it comes to life", C.qlikGreen, [
  "One git repository holds the whole demo",
  "One command — npm run deploy — stands it up",
  "A self-hosted MCG Deploy console (web wizard) drives it",
  "Four connected stories: Integrations, Governance, Analytics, AI & Outcomes",
], { icon: "gateway", fs: 11.5, spacing: 0.66 });

noteBand(slide, "From 7 data-quality nightmares (~$127M/year, 47 systems) to gold data products, governed knowledge, and AI outcomes — all in one repo.", 6.35, C.lightCyan, C.qlikTeal);

// ═══════════════════════════════════════════════════
// SLIDE 3: The problem — 7 data-quality nightmares
// ═══════════════════════════════════════════════════
slide = contentSlide("The Problem", C.qlikBlue);
slide.addNotes("Set the stakes fast: seven recurring data-quality nightmares, roughly 127 million dollars a year, across 47 fragmented systems with no single source of truth. This is the before. Keep it concrete — WISMO calls, cold-chain spoilage, late deliveries, mismatched addresses, duplicate customers — all tracing back to untrusted data.");

slide.addText("Before Qlarity — why MCG's data estate needs a transformation", {
  x: 0.5, y: 0.86, w: 12.3, h: 0.4,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

const problemStats = [
  { val: "7", label: "data quality nightmares", sub: "recurring failure patterns across the estate", color: C.qlikBlue },
  { val: "~$127M", label: "cost per year", sub: "the price of dirty, fragmented data", color: C.qlikGreen },
  { val: "47", label: "fragmented systems", sub: "no single, trusted source of truth", color: C.qlikTeal },
];
problemStats.forEach((s, i) => {
  const x = 0.5 + i * 4.15;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y: 1.5, w: 3.9, h: 2.7,
    fill: { color: C.lightBg }, rectRadius: 0.12, line: { color: s.color, width: 2 },
  });
  slide.addText(s.val, {
    x, y: 1.75, w: 3.9, h: 1.0,
    fontSize: 46, color: s.color, fontFace: FONT, bold: true, align: "center",
  });
  slide.addText(s.label, {
    x: x + 0.2, y: 2.85, w: 3.5, h: 0.5,
    fontSize: 15, color: C.qlikBlue, fontFace: FONT, bold: true, align: "center",
  });
  slide.addText(s.sub, {
    x: x + 0.25, y: 3.4, w: 3.4, h: 0.65,
    fontSize: 11, color: C.darkText, fontFace: FONT, align: "center", valign: "top", lineSpacingMultiple: 1.03,
  });
});

noteBand(slide, "Symptoms show up everywhere: WISMO calls, cold-chain spoilage, late deliveries, mismatched addresses, and duplicated customer records — all traced back to untrusted data.", 4.55, C.lightGreen, C.qlikGreen);

slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 5.4, w: 12.3, h: 1.25,
  fill: { color: C.lightBlue }, rectRadius: 0.1,
});
slide.addText("Project Qlarity's job", {
  x: 0.75, y: 5.55, w: 5.0, h: 0.4,
  fontSize: 13, color: C.qlikBlue, fontFace: FONT, bold: true,
});
slide.addText("Show 47 systems consolidated into one governed Qlik Cloud environment — so every downstream analytic, document, and AI answer stands on data the business can trust.", {
  x: 0.75, y: 5.95, w: 11.8, h: 0.6,
  fontSize: 12, color: C.darkText, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.04,
});

// ═══════════════════════════════════════════════════
// SLIDE 4: The Four Stories
// ═══════════════════════════════════════════════════
slide = contentSlide("The Four Stories", C.qlikGreen);
slide.addNotes("The spine of every demo, four connected acts. Integrations lands three messy feeds into the Open Lakehouse. Governance turns raw data into trusted data. Analytics publishes gold data products and apps. AI & Outcomes turns trusted data into decisions and action. Each act maps to a live click-path and a Demo2Win script.");

slide.addText("One narrative, told in four connected chapters — the spine of the whole demo", {
  x: 0.5, y: 0.86, w: 12.3, h: 0.4,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

const stories = [
  { icon: "gateway", title: "Integrations", color: C.qlikTeal,
    desc: "Land 3 messy source feeds into the Open Lakehouse — WMS change data, IoT cold-chain streams, and CRM records." },
  { icon: "governance", title: "Governance", color: C.qlikGreen,
    desc: "Turn raw data into trusted data — trust scores, data-quality rules, lineage, a business glossary, and stewardship." },
  { icon: "analytics", title: "Analytics", color: C.qlikLightGreen,
    desc: "Publish gold data products and apps that answer supply-chain and last-mile questions on data people believe." },
  { icon: "predict", title: "AI & Outcomes", color: C.qlikGreen,
    desc: "Qlik Predict, Qlik Answers, Discovery Agent, and the agentic layer turn trusted data into decisions and action." },
];
stories.forEach((st, i) => {
  const y = 1.4 + i * 1.28;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y, w: 12.3, h: 1.14,
    fill: { color: C.lightBg }, rectRadius: 0.1, line: { color: st.color, width: 2 },
  });
  slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y, w: 0.12, h: 1.14, fill: { color: st.color } });
  iconBadge(slide, st.icon, 0.85, y + 0.32, 0.5, st.color);
  slide.addText(`${i + 1}`, {
    x: 1.55, y, w: 0.5, h: 1.14,
    fontSize: 22, color: st.color, fontFace: FONT, bold: true, valign: "middle",
  });
  slide.addText(st.title, {
    x: 2.1, y: y + 0.14, w: 3.4, h: 0.5,
    fontSize: 19, color: st.color, fontFace: FONT, bold: true, valign: "middle",
  });
  slide.addText(st.desc, {
    x: 2.1, y: y + 0.58, w: 10.4, h: 0.5,
    fontSize: 12, color: C.darkText, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.03,
  });
});

// ═══════════════════════════════════════════════════
// SLIDE 5: Architecture at a glance
// ═══════════════════════════════════════════════════
slide = contentSlide("Architecture at a Glance", C.qlikTeal);
slide.addNotes("One picture of the whole flow. Three source feeds — PostgreSQL WMS via CDC, Kafka IoT cold-chain streaming, and Salesforce every 15 minutes — land in the Open Lakehouse on Apache Iceberg, flow bronze to silver to gold, and surface as two governed gold data products that feed apps and AI. No copies; everything downstream reads trusted data.");

slide.addText("Three source feeds flow through a medallion lakehouse into gold data products, apps, and AI", {
  x: 0.5, y: 0.86, w: 12.3, h: 0.4,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

// Stage 1: Feeds
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.6, w: 2.75, h: 4.1,
  fill: { color: C.lightBg }, rectRadius: 0.1, line: { color: C.qlikTeal, width: 2 },
});
slide.addText("3 SOURCE FEEDS", {
  x: 0.5, y: 1.72, w: 2.75, h: 0.4,
  fontSize: 12, color: C.qlikTeal, fontFace: FONT, bold: true, align: "center",
});
const feeds = [
  { icon: "database", name: "PostgreSQL WMS", mode: "CDC" },
  { icon: "stream", name: "Kafka IoT cold-chain", mode: "streaming" },
  { icon: "cloud", name: "Salesforce CRM", mode: "every 15 min" },
];
feeds.forEach((f, i) => {
  const y = 2.25 + i * 1.12;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.68, y, w: 2.4, h: 0.95,
    fill: { color: C.white }, rectRadius: 0.08, line: { color: C.qlikGray, width: 1 },
  });
  iconBadge(slide, f.icon, 0.82, y + 0.24, 0.46, C.qlikTeal);
  slide.addText(f.name, {
    x: 1.38, y: y + 0.12, w: 1.65, h: 0.45,
    fontSize: 10.5, color: C.qlikBlue, fontFace: FONT, bold: true, valign: "middle", lineSpacingMultiple: 0.95,
  });
  slide.addText(f.mode, {
    x: 1.38, y: y + 0.55, w: 1.65, h: 0.3,
    fontSize: 9.5, color: C.qlikGreen, fontFace: FONT, italic: true,
  });
});

// Arrow
slide.addText("▶", { x: 3.28, y: 3.35, w: 0.5, h: 0.5, fontSize: 20, color: C.qlikGray, align: "center" });

// Stage 2: Open Lakehouse medallion
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 3.85, y: 1.6, w: 3.35, h: 4.1,
  fill: { color: C.lightTeal }, rectRadius: 0.1, line: { color: C.qlikTeal, width: 2 },
});
iconBadge(slide, "lakehouse", 4.05, 1.72, 0.44, C.qlikTeal);
slide.addText("OPEN LAKEHOUSE", {
  x: 4.55, y: 1.72, w: 2.55, h: 0.44,
  fontSize: 12, color: C.qlikTeal, fontFace: FONT, bold: true, valign: "middle",
});
slide.addText("Apache Iceberg on S3 · medallion", {
  x: 4.05, y: 2.2, w: 3.0, h: 0.3,
  fontSize: 9.5, color: C.darkText, fontFace: FONT, italic: true, align: "center",
});
const medallion = [
  { name: "BRONZE", desc: "raw landed data", color: C.qlikGray },
  { name: "SILVER", desc: "cleansed + trust-scored", color: C.qlikGray },
  { name: "GOLD", desc: "governed data products", color: C.qlikGreen },
];
medallion.forEach((m, i) => {
  const y = 2.6 + i * 1.0;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 4.05, y, w: 2.95, h: 0.85,
    fill: { color: C.white }, rectRadius: 0.08, line: { color: m.color, width: 1.5 },
  });
  slide.addText(m.name, {
    x: 4.05, y: y + 0.1, w: 2.95, h: 0.4,
    fontSize: 14, color: m.color === C.qlikGray ? C.qlikBlue : m.color, fontFace: FONT, bold: true, align: "center",
  });
  slide.addText(m.desc, {
    x: 4.05, y: y + 0.48, w: 2.95, h: 0.32,
    fontSize: 10, color: C.darkText, fontFace: FONT, align: "center",
  });
});

// Arrow
slide.addText("▶", { x: 7.22, y: 3.35, w: 0.5, h: 0.5, fontSize: 20, color: C.qlikGray, align: "center" });

// Stage 3: Products
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 7.8, y: 1.6, w: 5.0, h: 4.1,
  fill: { color: C.lightBg }, rectRadius: 0.1, line: { color: C.qlikGreen, width: 2 },
});
slide.addText("GOLD DATA PRODUCTS  +  APPS & AI", {
  x: 7.8, y: 1.72, w: 5.0, h: 0.4,
  fontSize: 12, color: C.qlikGreen, fontFace: FONT, bold: true, align: "center",
});
const outputs = [
  { icon: "analytics", name: "Supply Chain Health", sub: "gold data product · trust-score SLA" },
  { icon: "analytics", name: "Last Mile Performance", sub: "gold data product · trust-score SLA" },
  { icon: "predict", name: "Analytics apps + Qlik Predict", sub: "2 AutoML models on trusted data" },
  { icon: "answers", name: "Qlik Answers + agents", sub: "governed knowledge and AI outcomes" },
];
outputs.forEach((o, i) => {
  const y = 2.25 + i * 0.82;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 7.98, y, w: 4.65, h: 0.68,
    fill: { color: C.white }, rectRadius: 0.07, line: { color: C.qlikGray, width: 1 },
  });
  iconBadge(slide, o.icon, 8.1, y + 0.13, 0.42, C.qlikGreen);
  slide.addText(o.name, {
    x: 8.65, y: y + 0.06, w: 3.9, h: 0.34,
    fontSize: 11.5, color: C.qlikBlue, fontFace: FONT, bold: true,
  });
  slide.addText(o.sub, {
    x: 8.65, y: y + 0.38, w: 3.9, h: 0.28,
    fontSize: 9.5, color: C.darkText, fontFace: FONT,
  });
});

noteBand(slide, "One flow, end to end: raw feeds → bronze/silver/gold on the Open Lakehouse → trusted gold data products that feed every app, document, and AI experience.", 5.95, C.lightGreen, C.qlikGreen);

// ═══════════════════════════════════════════════════
// SLIDE 6: Assets — Presentations & Narrative
// ═══════════════════════════════════════════════════
slide = contentSlide("Assets — Presentations & Narrative", C.qlikGreen);
slide.addNotes("The story-telling layer. Three core decks frame the value and 18 Demo2Win scripts walk it through live. This is what makes the demo repeatable — any SE runs the same narrative the same way, every time.");

slide.addText("The story-telling layer: decks that frame the value and scripts that walk it through live", {
  x: 0.5, y: 0.86, w: 12.3, h: 0.4,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

panel(slide, 0.5, 1.4, 6.05, 4.75, "3 PowerPoint decks", C.qlikTeal, [
  "Demo Overview / Four Stories (35 slides)",
  "Technology Architecture",
  "Company Profile & Data Quality",
], { icon: "answers", fs: 12, spacing: 0.66 });

panel(slide, 6.75, 1.4, 6.05, 4.75, "18 demo-script walkthroughs", C.qlikGreen, [
  "One guided walkthrough per demo topic",
  "Demo2Win \"Tell → Show → Tell\" format",
  "Qlik-branded DOCX, presenter-ready",
  "Map each of the Four Stories to a live click-path",
  "Keep the narrative consistent across presenters",
], { icon: "governance", fs: 12, spacing: 0.66 });

noteBand(slide, "Decks set the strategic frame; the 18 scripts make every capability demonstrable, live, in a repeatable Tell → Show → Tell flow.", 6.35, C.lightCyan, C.qlikTeal);

// ═══════════════════════════════════════════════════
// The Demo2Win Scripts — dedicated deep-dive on the 18 walkthroughs
// ═══════════════════════════════════════════════════
slide = contentSlide("Assets — The Demo2Win Scripts", C.qlikGreen);
slide.addNotes("Our flagship enablement asset. Every capability has a script with the same anatomy — a Limbic emotional opening, Tell then Show then Tell, click-by-click steps, a So You Can value chain, and a troubleshooting table. Eighteen modules cover all four acts plus the agentic engineering work.");

slide.addText("18 presenter-ready walkthroughs — every capability has a script, so any SE runs the same winning demo the same way", {
  x: 0.5, y: 0.86, w: 12.3, h: 0.4,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

panel(slide, 0.5, 1.4, 6.05, 4.75, "Every script, the same anatomy", C.qlikTeal, [
  "Limbic emotional opening — hook before feature",
  "Tell → Show → Tell narration frame",
  "Click-by-click steps + an interaction prompt",
  "\"So You Can\" value chain per module",
  "Talking points + a troubleshooting table",
  "Metadata: duration, phase, nightmares, components",
], { icon: "answers", fs: 12, spacing: 0.66 });

panel(slide, 6.75, 1.4, 6.05, 4.75, "18 modules across the Four Stories", C.qlikGreen, [
  "Integrations — Infrastructure, Connections, Open Lakehouse (3)",
  "Governance — Lineage/Trust, Data Products, Stewardship, Glossary (4)",
  "Analytics — Analytics Apps, Alerting, Automations (3)",
  "AI & Outcomes — Predict, Answers, Discovery Agent & MCP (3)",
  "Agentic Engineering — Pipelines in VS Code, 3 agents, Talend Routes (5)",
], { icon: "governance", fs: 11.5, spacing: 0.80 });

noteBand(slide, "Every capability in Project Qlarity has a matching Demo2Win script — the same winning demo, run the same way, by any presenter.", 6.35, C.lightCyan, C.qlikTeal);

// ═══════════════════════════════════════════════════
// SLIDE 7: Assets — Data & Pipelines
// ═══════════════════════════════════════════════════
slide = contentSlide("Assets — Data & Pipelines", C.qlikTeal);
slide.addNotes("The build layer. Two declarative QTCP pipeline projects, six tasks total, shipped as a VS Code template you can author by hand or with an AI coding agent. Two governed gold data products, and three simulators that generate the intentionally-messy demo data. Flag that declarative pipelines are a Qlik internal preview.");
statusPill(slide, "PIPELINES: PREVIEW", C.qlikBlue);

slide.addText("The data foundation: declarative pipelines, the medallion lakehouse, gold products, and messy-data simulators", {
  x: 0.5, y: 0.86, w: 9.2, h: 0.4,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

panel(slide, 0.5, 1.4, 6.05, 4.4, "Pipelines & lakehouse", C.qlikTeal, [
  "2 declarative QTCP pipeline projects (preview)",
  "mcg-batch-pipeline (4 tasks) + mcg-streaming-pipeline (2 tasks) = 6 tasks",
  "Shipped as a VS Code template (per-project settings, CLAUDE.md, Copilot instructions)",
  "Schema kit installed locally via npm run pipeline:template",
  "Open Lakehouse medallion — Apache Iceberg on S3",
], { icon: "pipeline", fs: 11.5, spacing: 0.74 });

panel(slide, 6.75, 1.4, 6.05, 4.4, "Data products & simulators", C.qlikGreen, [
  "2 gold data products: Supply Chain Health + Last Mile Performance",
  "Both API-shared, each with a trust-score SLA",
  "3 data simulators: PostgreSQL, Kafka IoT, Salesforce",
  "Simulators generate the intentionally-messy demo data",
  "The mess that Governance and Analytics then clean up",
], { icon: "lakehouse", fs: 11.5, spacing: 0.74 });

noteBand(slide, "Declarative Data Pipelines are a Qlik internal preview (June 2026) — roadmap, not GA. Availability and timing may change.", 6.0, C.lightCyan, C.qlikTeal);

// ═══════════════════════════════════════════════════
// SLIDE 8: Assets — Governance & Knowledge
// ═══════════════════════════════════════════════════
slide = contentSlide("Assets — Governance & Knowledge", C.qlikGreen);
slide.addNotes("The trust layer. A 25-document Qlik Answers knowledge base, 25 business glossary terms as one shared vocabulary, and five Teams automations — plus trust scores, lineage, and stewardship. Governance makes the data trustworthy, the knowledge base and glossary make it understandable, and automations keep it that way in the flow of work.");

slide.addText("The trust layer: a document knowledge base, a shared vocabulary, and automations that keep watch", {
  x: 0.5, y: 0.86, w: 12.3, h: 0.4,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

panel(slide, 0.5, 1.4, 6.05, 4.4, "Knowledge & vocabulary", C.qlikGreen, [
  "25 operational documents → Qlik Answers knowledge base",
  "SOPs, contracts, policies, incident reports, training, compliance, POs, shipments, suppliers, recall, minutes, brief",
  "25 business glossary terms — one shared vocabulary",
  "Trust scores + lineage + stewardship across the estate",
], { icon: "answers", fs: 11.5, spacing: 0.82 });

panel(slide, 6.75, 1.4, 6.05, 4.4, "5 automations (Teams alerts)", C.qlikTeal, [
  "Daily app-reload alert",
  "Cold-chain exception alert",
  "Pipeline-health alert",
  "WISMO-rate alert",
  "Talend address-correction loop",
], { icon: "automation", fs: 11.5, spacing: 0.7 });

noteBand(slide, "Governance makes the data trustworthy; the knowledge base and glossary make it understandable; automations keep it that way in the flow of work.", 6.0, C.lightGreen, C.qlikGreen);

// ═══════════════════════════════════════════════════
// SLIDE 9: Assets — AI & Agentic
// ═══════════════════════════════════════════════════
slide = contentSlide("Assets — AI & Agentic", C.qlikGreen);
slide.addNotes("The intelligence layer. Qlik Predict with two AutoML models, Qlik Answers over the knowledge base, the Discovery Agent, and the Qlik MCP Server, plus the agentic data-engineering capabilities. Two honesty callouts: the MCP Server is a preview, and the three governance agents are Qlik Answers capabilities, not separate products or SKUs.");
statusPill(slide, "MCP: PREVIEW", C.qlikBlue);

slide.addText("The intelligence layer: prediction, document intelligence, discovery, and the agentic data-engineering stack",  {
  x: 0.5, y: 0.86, w: 9.2, h: 0.4,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

panel(slide, 0.5, 1.4, 6.05, 4.4, "AI capabilities", C.qlikGreen, [
  "Qlik Predict — 2 AutoML models: Cold Chain Exceedance + Late Delivery",
  "Qlik Answers — document intelligence over the 25-doc knowledge base",
  "Discovery Agent — guided, conversational data exploration",
  "Qlik MCP Server (preview) — governed Qlik context to any AI assistant",
], { icon: "predict", fs: 11.5, spacing: 0.82 });

panel(slide, 6.75, 1.4, 6.05, 4.4, "Agentic Data Engineering", C.qlikTeal, [
  "Declarative pipelines authored by AI coding agents",
  "Data Product, Data Quality, and Catalog & Business Glossary agents",
  "Delivered as Qlik Answers capabilities — not separate products",
  "Talend Agentic Routes — LLM / RAG steps inside pipeline tasks",
], { icon: "agent", fs: 11.5, spacing: 0.82 });

noteBand(slide, "The Qlik MCP Server is a Qlik internal preview (June 2026). The three governance agents are Qlik Answers capabilities, not separate products or SKUs.", 6.0, C.lightCyan, C.qlikTeal);

// ═══════════════════════════════════════════════════
// SLIDE 10: How it deploys
// ═══════════════════════════════════════════════════
slide = contentSlide("How It Deploys — One Repo, One Command", C.qlikTeal);
slide.addNotes("The punchline that makes this a framework, not a one-off. One repo, one command — npm run deploy — driven by the MCG Deploy console, a web wizard on port 3939. Always dry-run first: it previews every change before anything is written, then commit for real. The declarative pipelines import via API as part of the same deployment.");

slide.addText("The whole environment stands up from a single repository with a single command",  {
  x: 0.5, y: 0.86, w: 12.3, h: 0.4,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

// Command box
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 4.16, y: 1.4, w: 5.0, h: 1.2,
  fill: { color: C.qlikBlue }, rectRadius: 0.12,
  shadow: { type: "outer", blur: 5, offset: 2, color: "000000", opacity: 0.18 },
});
slide.addText("npm run deploy", {
  x: 4.16, y: 1.5, w: 5.0, h: 0.55,
  fontSize: 24, color: C.white, fontFace: MONO, bold: true, align: "center",
});
slide.addText("one git repository · dry-run first · deploy-to-qlik.js engine", {
  x: 4.16, y: 2.08, w: 5.0, h: 0.45,
  fontSize: 10.5, color: C.qlikCyan, fontFace: FONT, align: "center",
});

// Three deploy cards
const deploySteps = [
  { icon: "gateway", title: "MCG Deploy console", color: C.qlikTeal,
    desc: "A self-hosted web wizard on port 3939 walks you through the deployment step by step." },
  { icon: "governance", title: "Dry-run first", color: C.qlikGreen,
    desc: "Preview every change before anything is written — validate, then commit for real." },
  { icon: "pipeline", title: "Declarative pipelines", color: C.qlikLightGreen,
    desc: "The QTCP pipeline projects are imported via API as part of the same deployment." },
];
deploySteps.forEach((d, i) => {
  const x = 0.7 + i * 4.07;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y: 3.0, w: 3.87, h: 2.35,
    fill: { color: C.lightBg }, rectRadius: 0.12, line: { color: d.color, width: 2 },
  });
  iconBadge(slide, d.icon, x + 0.25, 3.2, 0.55, d.color);
  slide.addText(d.title, {
    x: x + 0.95, y: 3.25, w: 2.8, h: 0.55,
    fontSize: 15, color: d.color, fontFace: FONT, bold: true, valign: "middle",
  });
  slide.addText(d.desc, {
    x: x + 0.25, y: 3.95, w: 3.4, h: 1.25,
    fontSize: 11.5, color: C.darkText, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.05,
  });
});

noteBand(slide, "From clone to a live, presentable Qlik Cloud demo: one repository, one command, dry-run safety, and the full stack imported for you.", 5.7, C.lightCyan, C.qlikTeal);

// ═══════════════════════════════════════════════════
// SLIDE 11: By the numbers
// ═══════════════════════════════════════════════════
slide = contentSlide("Project Qlarity — By the Numbers", C.qlikGreen);
slide.addNotes("A quick recap of scale, and every figure here ships in the repo — nothing invented. Three decks, 18 scripts, 25 knowledge-base documents, 25 glossary terms, three source feeds, two gold data products, six pipeline tasks, five automations, three simulators, and two Predict models.");

slide.addText("Everything in the demo, counted — the grounded asset inventory at a glance",  {
  x: 0.5, y: 0.86, w: 12.3, h: 0.4,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

const tiles = [
  { val: "3", label: "PowerPoint decks", color: C.qlikTeal },
  { val: "18", label: "Demo-script walkthroughs", color: C.qlikGreen },
  { val: "25", label: "Knowledge-base documents", color: C.qlikLightGreen },
  { val: "25", label: "Business glossary terms", color: C.qlikTeal },
  { val: "3", label: "Source feeds", color: C.qlikGreen },
  { val: "2", label: "Gold data products", color: C.qlikTeal },
  { val: "6", label: "Pipeline tasks (2 projects)", color: C.qlikGreen },
  { val: "5", label: "Automations", color: C.qlikLightGreen },
  { val: "3", label: "Data simulators", color: C.qlikTeal },
  { val: "2", label: "Qlik Predict models", color: C.qlikGreen },
];
// 5 columns x 2 rows
const tW = 2.3, tH = 1.85, gapX = 0.16, gapY = 0.28;
const gridW = 5 * tW + 4 * gapX; // 12.14
const startX = (13.33 - gridW) / 2;
tiles.forEach((t, i) => {
  const col = i % 5, row = Math.floor(i / 5);
  const x = startX + col * (tW + gapX);
  const y = 1.55 + row * (tH + gapY);
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y, w: tW, h: tH,
    fill: { color: C.lightBg }, rectRadius: 0.1, line: { color: t.color, width: 1.5 },
  });
  slide.addShape(pptx.shapes.RECTANGLE, { x, y, w: tW, h: 0.1, fill: { color: t.color } });
  slide.addText(t.val, {
    x, y: y + 0.28, w: tW, h: 0.9,
    fontSize: 44, color: t.color, fontFace: FONT, bold: true, align: "center",
  });
  slide.addText(t.label, {
    x: x + 0.15, y: y + 1.24, w: tW - 0.3, h: 0.55,
    fontSize: 11, color: C.darkText, fontFace: FONT, align: "center", valign: "top", lineSpacingMultiple: 1.02,
  });
});

noteBand(slide, "Grounded figures only — every number above ships in the Project Qlarity repository.", 6.3, C.lightGreen, C.qlikGreen);

// ═══════════════════════════════════════════════════
// SLIDE 12: Close (Cover layout)
// ═══════════════════════════════════════════════════
slide = pptx.addSlide();
slideNum++;
slide.background = { fill: C.white };
slide.addImage({ path: COVER_BG, x: 0, y: 0, w: 13.33, h: 7.5 });
slide.addImage({ path: QLIK_LOGO, x: 0.5, y: 0.4, w: 1.12, h: 0.62 });

slide.addText("Meridian Commerce Group", {
  x: 0.5, y: 1.4, w: 8.0, h: 0.5,
  fontSize: 16, color: C.qlikGray, fontFace: FONT, letterSpacing: 2,
});
slide.addText("Project Qlarity", {
  x: 0.5, y: 1.95, w: 9.5, h: 1.0,
  fontSize: 46, color: C.qlikBlue, fontFace: FONT, bold: true,
});
slide.addNotes("Wrap it. Project Qlarity is one repository, one command, the full Qlik stack — a repeatable framework any SE can stand up and present. Point to the resources link for the repository and the demo guide, and offer to walk any of the four acts live.");
slide.addText("One repository, one command, the full Qlik stack.", {
  x: 0.5, y: 3.05, w: 10.5, h: 0.5,
  fontSize: 20, color: C.qlikGreen, fontFace: FONT, bold: true,
});
slide.addText("Qlik + Clarity: a repeatable framework for demoing the full Qlik Cloud stack, end to end.", {
  x: 0.5, y: 3.65, w: 10.5, h: 0.5,
  fontSize: 13, color: C.darkText, fontFace: FONT,
});

const closeTiles = [
  { val: "4", label: "Connected Stories", color: C.qlikTeal },
  { val: "3", label: "Presentation Decks", color: C.qlikTeal },
  { val: "2", label: "Gold Data Products", color: C.qlikGreen },
  { val: "1", label: "Repo · One Command", color: C.qlikLightGreen },
];
closeTiles.forEach((m, i) => {
  const x = 0.5 + i * 2.5;
  const y = 4.4;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y, w: 2.2, h: 1.1,
    fill: { color: C.lightBg }, rectRadius: 0.08, line: { color: m.color, width: 1.5 },
  });
  slide.addText(m.val, {
    x, y: y + 0.05, w: 2.2, h: 0.6,
    fontSize: 28, color: m.color, fontFace: FONT, bold: true, align: "center",
  });
  slide.addText(m.label, {
    x, y: y + 0.65, w: 2.2, h: 0.4,
    fontSize: 10, color: C.darkText, fontFace: FONT, align: "center",
  });
});

slide.addText([
  { text: "Deploy it:  ", options: { bold: true, color: C.qlikGreen } },
  { text: "clone the repo and run  npm run deploy  (dry-run first) via the MCG Deploy console on port 3939", options: { color: C.darkText } },
], {
  x: 0.5, y: 5.85, w: 12.3, h: 0.35,
  fontSize: 12, fontFace: FONT,
});
slide.addText([
  { text: "Resources:  ", options: { bold: true, color: C.qlikBlue } },
  { text: "Project Qlarity repository & demo guide — [placeholder]", options: { color: C.darkText } },
], {
  x: 0.5, y: 6.25, w: 12.3, h: 0.35,
  fontSize: 12, fontFace: FONT,
});

// ═══════════════════════════════════════════════════
//  SAVE
// ═══════════════════════════════════════════════════
const outPath = path.join(__dirname, "..", "MCG_Project_Qlarity_Summary.pptx");
pptx.writeFile({ fileName: outPath }).then(() => {
  console.log(`✅ PowerPoint saved: ${outPath} (${slideNum} slides)`);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
