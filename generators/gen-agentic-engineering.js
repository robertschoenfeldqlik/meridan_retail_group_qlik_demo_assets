// Generate MCG Qlik Agentic Data Engineering PowerPoint
// The BUILD-SIDE AI story: author the pipeline, govern the data.
// Counterpart to the CONSUMPTION-SIDE AI in gen-demo-overview.js.
// Uses Qlik brand template (colors, fonts, contrail backgrounds, logo).
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
pptx.title = "Meridian Commerce Group — Qlik Agentic Data Engineering";

const deckMedia = require("./lib/deck-media");

let slideNum = 0;

// ─── HELPERS ───────────────────────────────────────
function footer(slide) {
  slideNum++;
  slide.addShape(pptx.shapes.RECTANGLE, { x: 0.5, y: 7.0, w: 12.33, h: 0.01, fill: { color: C.qlikGray } });
  slide.addImage({ path: QLIK_LOGO, x: 0.5, y: 7.1, w: 0.54, h: 0.3 });
  slide.addText("Qlik Agentic Data Engineering  •  MCG Demo  •  Qlik Talend Cloud", {
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

// ─── Capability slide (used for the six build-side capabilities) ───
function capabilitySlide(name, icon, accent, tagline, status, statusColor, whatItDoes, mcgMapping, note, noteBg, noteColor) {
  const s = contentSlide(name, accent);
  statusPill(s, status, statusColor);
  s.addText(tagline, {
    x: 0.5, y: 0.86, w: 9.2, h: 0.4,
    fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
  });
  panel(s, 0.5, 1.4, 7.4, 4.75, "What it does", accent, whatItDoes, { icon, fs: 11.5, spacing: 0.72 });
  panel(s, 8.1, 1.4, 4.72, 4.75, "MCG in this demo", C.qlikGreen, mcgMapping, { fs: 11, spacing: 0.72 });
  noteBand(s, note, 6.35, noteBg, noteColor);
  return s;
}

// ═══════════════════════════════════════════════════
// SLIDE 1: Title (Cover layout — contrail background)
// ═══════════════════════════════════════════════════
let slide = pptx.addSlide();
slideNum++;
slide.background = { fill: C.white };
slide.addImage({ path: COVER_BG, x: 0, y: 0, w: 13.33, h: 7.5 });
slide.addImage({ path: QLIK_LOGO, x: 0.5, y: 0.4, w: 1.12, h: 0.62 });

slide.addText("Meridian Commerce Group", {
  x: 0.5, y: 1.5, w: 7.0, h: 0.6,
  fontSize: 18, color: C.qlikGray, fontFace: FONT, letterSpacing: 2,
});
slide.addText("Qlik Agentic\nData Engineering", {
  x: 0.5, y: 2.15, w: 7.5, h: 1.7,
  fontSize: 40, color: C.qlikBlue, fontFace: FONT, bold: true, lineSpacingMultiple: 1.05,
});
slide.addText("Pipelines as code.  Agents that build trust.  AI that ships.", {
  x: 0.5, y: 3.95, w: 8.5, h: 0.5,
  fontSize: 16, color: C.qlikGreen, fontFace: FONT, bold: true,
});
slide.addText("Build-side AI — the counterpart to Qlik's consumption-side agents", {
  x: 0.5, y: 4.55, w: 8.0, h: 0.5,
  fontSize: 13, color: C.darkText, fontFace: FONT,
});

// Six capability chips
const capChips = [
  { label: "Declarative\nPipelines", color: C.qlikTeal },
  { label: "Data Product\nAgent", color: C.qlikGreen },
  { label: "Data Quality\nAgent", color: C.qlikGreen },
  { label: "Catalog &\nGlossary Agent", color: C.qlikLightGreen },
  { label: "Talend Agentic\nRoutes", color: C.qlikGreen },
  { label: "Qlik MCP\nServer", color: C.qlikTeal },
];
capChips.forEach((c, i) => {
  const x = 0.5 + i * 2.08;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y: 5.6, w: 1.95, h: 0.85,
    fill: { color: c.color }, rectRadius: 0.08,
  });
  slide.addText(c.label, {
    x, y: 5.6, w: 1.95, h: 0.85,
    fontSize: 10.5, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
    lineSpacingMultiple: 1.0,
  });
});

// ═══════════════════════════════════════════════════
// SLIDE 2: Forward-looking disclaimer
// ═══════════════════════════════════════════════════
slide = contentSlide("Forward-Looking Information", C.qlikBlue);

slide.addText("Please read before evaluating anything in this deck", {
  x: 0.5, y: 0.86, w: 12, h: 0.4,
  fontSize: 14, color: C.medGray, fontFace: FONT, italic: true,
});

slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.45, w: 12.3, h: 4.6,
  fill: { color: C.lightBg }, rectRadius: 0.12,
  line: { color: C.qlikBlue, width: 2 },
});

const disclaimerPoints = [
  "This presentation includes forward-looking information about Qlik products and capabilities. It is provided for planning and evaluation only and is not a commitment to deliver any feature, functionality, or timing.",
  "Declarative Data Pipelines and the Qlik MCP Server tooling are in Qlik internal preview (June 2026). Capabilities, availability, and timing may change before general availability.",
  "The Data Product Agent, Data Quality Agent, and Catalog and Business Glossary Agent are delivered as Qlik Answers capabilities — not separate products or SKUs.",
  "Talend Agentic Routes extend Qlik Talend Cloud. Named third-party models, vector stores, and tools are examples of supported integrations, not endorsements.",
  "Purchasing decisions should be based on generally available functionality. Preview and roadmap items are labeled as such throughout this deck.",
];
disclaimerPoints.forEach((p, i) => {
  slide.addText(`▸  ${p}`, {
    x: 0.8, y: 1.75 + i * 0.86, w: 11.7, h: 0.8,
    fontSize: 12.5, color: C.darkText, fontFace: FONT, lineSpacingMultiple: 1.03,
  });
});

// ═══════════════════════════════════════════════════
// SLIDE 3: Agenda
// ═══════════════════════════════════════════════════
slide = contentSlide("Agenda", C.qlikGreen);

slide.addText("Six ways Qlik puts AI on the build side of the data platform", {
  x: 0.5, y: 0.86, w: 12, h: 0.4,
  fontSize: 13, color: C.qlikGreen, fontFace: FONT, italic: true,
});

const agenda = [
  { num: "1", title: "Why now", desc: "The shift from UI-driven to declarative, code-first, AI-assisted data engineering", color: C.qlikTeal },
  { num: "2", title: "The big idea", desc: "One pipeline YAML — editable visually, programmatically, or agentically", color: C.qlikGreen },
  { num: "3", title: "Six build-side capabilities", desc: "Declarative pipelines, three Qlik Answers agents, Talend Agentic Routes, and the MCP Server", color: C.qlikGreen },
  { num: "4", title: "How it works", desc: "The raw-to-trusted flow, with a human in the loop at each stage", color: C.qlikLightGreen },
  { num: "5", title: "See it live", desc: "A one-line pipeline change in VS Code with a coding agent", color: C.qlikTeal },
  { num: "6", title: "Roadmap & what it unlocks for MCG", desc: "Where this is going, and the payoff for Meridian Commerce Group", color: C.qlikGreen },
];
agenda.forEach((item, i) => {
  const y = 1.35 + i * 0.9;
  slide.addShape(pptx.shapes.OVAL, {
    x: 0.6, y: y + 0.05, w: 0.6, h: 0.6, fill: { color: item.color },
  });
  slide.addText(item.num, {
    x: 0.6, y: y + 0.05, w: 0.6, h: 0.6,
    fontSize: 22, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
  slide.addText(item.title, {
    x: 1.4, y, w: 5.4, h: 0.4,
    fontSize: 17, color: item.color, fontFace: FONT, bold: true,
  });
  slide.addText(item.desc, {
    x: 1.4, y: y + 0.4, w: 11.4, h: 0.4,
    fontSize: 11.5, color: C.darkText, fontFace: FONT,
  });
});

// ═══════════════════════════════════════════════════
// SLIDE 4: Why now
// ═══════════════════════════════════════════════════
slide = contentSlide("Why Now — Data Engineering Goes Declarative", C.qlikTeal);

slide.addText("The same shift software went through: from clicking things together to code you can review, version, and let AI help write", {
  x: 0.5, y: 0.86, w: 12.3, h: 0.4,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

const shifts = [
  { from: "Pipelines clicked together in a UI — hard to review, diff, or reproduce", to: "Declarative YAML you can diff, version, and roll back" },
  { from: "Every change authored by hand, one screen at a time", to: "AI coding agents draft the change; engineers review and approve" },
  { from: "Data quality and definitions live in tribal knowledge", to: "Trust scores, DQ rules, and a glossary that ship as governed assets" },
];
shifts.forEach((sh, i) => {
  const y = 1.45 + i * 1.15;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y, w: 12.3, h: 1.0,
    fill: { color: C.lightBg }, rectRadius: 0.1, line: { color: C.qlikGray, width: 1 },
  });
  slide.addText("FROM", {
    x: 0.75, y: y + 0.12, w: 1.0, h: 0.3, fontSize: 10, color: C.medGray, fontFace: FONT, bold: true,
  });
  slide.addText(sh.from, {
    x: 0.75, y: y + 0.4, w: 5.3, h: 0.5, fontSize: 12, color: C.darkText, fontFace: FONT, valign: "top",
  });
  slide.addText("▶", {
    x: 6.15, y: y + 0.3, w: 0.6, h: 0.5, fontSize: 18, color: C.qlikGreen, fontFace: FONT, align: "center",
  });
  slide.addText("TO", {
    x: 6.95, y: y + 0.12, w: 1.0, h: 0.3, fontSize: 10, color: C.qlikGreen, fontFace: FONT, bold: true,
  });
  slide.addText(sh.to, {
    x: 6.95, y: y + 0.4, w: 5.6, h: 0.5, fontSize: 12, color: C.qlikBlue, fontFace: FONT, bold: true, valign: "top",
  });
});

noteBand(slide, "MCG already runs consumption-side AI — Discovery Agent, Qlik Answers, Qlik Predict. This is the build-side counterpart: AI that authors the pipeline and governs the data.", 5.0, C.lightGreen, C.qlikGreen);

// ═══════════════════════════════════════════════════
// SLIDE 5: The big idea — one pipeline YAML
// ═══════════════════════════════════════════════════
slide = contentSlide("The Big Idea — One Pipeline YAML", C.qlikGreen);

slide.addText("The whole pipeline is one declarative definition. Edit it whichever way fits the moment — the file is the single source of truth.", {
  x: 0.5, y: 0.86, w: 12.3, h: 0.4,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

// Central YAML box
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 4.16, y: 1.45, w: 5.0, h: 1.25,
  fill: { color: C.qlikBlue }, rectRadius: 0.12,
  shadow: { type: "outer", blur: 5, offset: 2, color: "000000", opacity: 0.18 },
});
slide.addText("pipeline.yaml", {
  x: 4.16, y: 1.55, w: 5.0, h: 0.55,
  fontSize: 22, color: C.white, fontFace: MONO, bold: true, align: "center",
});
slide.addText("one declarative definition · schema-validated · Git-versioned", {
  x: 4.16, y: 2.15, w: 5.0, h: 0.45,
  fontSize: 11, color: C.qlikCyan, fontFace: FONT, align: "center",
});

// Down arrows to the three modes
[2.6, 6.665, 10.73].forEach((cx) => {
  slide.addText("▼", {
    x: cx - 0.5, y: 2.85, w: 1.0, h: 0.4, fontSize: 18, color: C.qlikGray, fontFace: FONT, align: "center",
  });
});

// Three edit-mode cards
const modes = [
  { title: "Visually", color: C.qlikTeal, icon: "pipeline", desc: "In the Qlik Talend Cloud UI — the low-code pipeline designer your data team already knows." },
  { title: "Programmatically", color: C.qlikGreen, icon: "transform", desc: "In VS Code or any third-party IDE — export, import, diff, and commit to Git like any other code." },
  { title: "Agentically", color: C.qlikLightGreen, icon: "agent", desc: "With an AI coding agent — it drafts the change against the schema; you review and approve." },
];
modes.forEach((m, i) => {
  const x = 0.7 + i * 4.07;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y: 3.35, w: 3.87, h: 2.2,
    fill: { color: C.lightBg }, rectRadius: 0.12, line: { color: m.color, width: 2 },
  });
  iconBadge(slide, m.icon, x + 0.25, 3.55, 0.55, m.color);
  slide.addText(m.title, {
    x: x + 0.95, y: 3.6, w: 2.7, h: 0.5,
    fontSize: 16, color: m.color, fontFace: FONT, bold: true, valign: "middle",
  });
  slide.addText(m.desc, {
    x: x + 0.25, y: 4.25, w: 3.4, h: 1.1,
    fontSize: 11, color: C.darkText, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.05,
  });
});

noteBand(slide, "\"A path from raw data to trusted, AI-ready data product that keeps human expertise in the loop at each stage.\"", 5.85, C.lightCyan, C.qlikTeal);

// ═══════════════════════════════════════════════════
// SLIDES 6-11: The six build-side capabilities
// ═══════════════════════════════════════════════════

// 6 · Declarative Data Pipelines (PREVIEW)
capabilitySlide(
  "Declarative Data Pipelines", "pipeline", C.qlikTeal,
  "YAML, code-first pipeline definitions — authored anywhere, versioned like software",
  "PREVIEW · Jun 2026", C.qlikBlue,
  [
    "YAML, code-first definition of the whole pipeline",
    "Author in the Qlik Talend Cloud UI, a third-party IDE (VS Code), or an AI coding agent",
    "Git version control + CI/CD; export and import definitions",
    "Schema-validated and agent-friendly by design",
  ],
  [
    "2 QTCP projects on Open Lakehouse — 6 tasks total",
    "mcg-batch-pipeline (4 tasks) + mcg-streaming-pipeline (2 tasks)",
    "Shipped as a VS Code template in deploy/pipelines/",
    "Schema kit dropped in locally via \"npm run pipeline:template\"",
  ],
  "Qlik internal preview, June 2026 — roadmap, not GA. Availability and timing may change.",
  C.lightCyan, C.qlikTeal
);

// 7 · Data Product Agent (Qlik Answers capability)
capabilitySlide(
  "Data Product Agent", "agent", C.qlikGreen,
  "Create and manage data products through natural-language interaction",
  "Qlik Answers capability", C.qlikTeal,
  [
    "Create, read, update, and manage data products conversationally",
    "Discover and interact with products in plain language",
    "Review and improve data-product quality and completeness",
    "Packages Silver into Gold with governance metadata",
  ],
  [
    "2 gold data products: Supply Chain Health and Last Mile Performance",
    "Both API-shared, each with a trust-score SLA",
    "Built from the Silver medallion layer on Apache Iceberg",
    "The governed contract between producers and consumers",
  ],
  "Delivered as a Qlik Answers capability, not a separate product or SKU.",
  C.lightGreen, C.qlikGreen
);

// 8 · Data Quality Agent (Qlik Answers capability)
capabilitySlide(
  "Data Quality Agent", "governance", C.qlikGreen,
  "Helps data stewards assess, define, and enforce data-quality rules — conversationally",
  "Qlik Answers capability", C.qlikTeal,
  [
    "Assess data quality across datasets in plain language",
    "Create, manage, and map data-quality rules",
    "Run data-quality metric calculations on demand",
    "Bridges business and technical users",
  ],
  [
    "Silver-layer trust-score and DQ rules feed Gold SLAs",
    "Stewardship review queues keep a human in the loop",
    "Profiling surfaces issues before they reach a data product",
    "Grounds the trust scores on Supply Chain Health & Last Mile Performance",
  ],
  "Delivered as a Qlik Answers capability, not a separate product or SKU.",
  C.lightGreen, C.qlikGreen
);

// 9 · Catalog and Business Glossary Agent (Qlik Answers capability)
capabilitySlide(
  "Catalog and Business Glossary Agent", "answers", C.qlikGreen,
  "Discover data assets, understand context, and define consistent business terminology",
  "Qlik Answers capability", C.qlikTeal,
  [
    "Natural-language queries against Qlik Cloud Catalog metadata",
    "Generate glossaries from apps, data products, datasets, or a domain",
    "Standardize terms and synonyms across the estate",
    "Understand context and relationships between assets",
  ],
  [
    "25-term MCG business glossary",
    "Generated terms land in DRAFT status by default — a human reviews before publish",
    "Links terms to datasets, data products, and nightmare scenarios",
    "Keeps definitions consistent across analytics and AI",
  ],
  "Generated glossary terms are draft by default and require human review. Delivered as a Qlik Answers capability, not a separate product.",
  C.lightGreen, C.qlikGreen
);

// 10 · Talend Agentic Routes (Qlik Talend Cloud)
capabilitySlide(
  "Talend Agentic Routes", "transform", C.qlikGreen,
  "AI-native workflows inside Qlik Talend Cloud — LLMs, RAG, and orchestration in the pipeline task itself",
  "PREVIEW · Jun 2026", C.qlikBlue,
  [
    "LLM integration in data tasks — cloud (OpenAI, Anthropic Claude, Google Gemini, Amazon Bedrock) and on-prem (Ollama, Mistral, Gemma 3, Phi 4)",
    "RAG pipelines to vector targets: Pinecone, MongoDB, Snowflake, Databricks, Milvus, Oracle",
    "Agentic orchestration — event-driven, conversational AI, extensible tools + MCP client",
    "In-task sentiment analysis, entity extraction, classification, AI-assisted DQ",
  ],
  [
    "Existing Talend job mcg_sf_address_validate_bulk: address standardization, bulk geocoding, GPS routing gate to Iceberg or a Stewardship sprint",
    "Add an LLM-assisted address-correction step to that route",
    "Enrich Silver in place, before packaging to Gold",
  ],
  "Named models, vector stores, and tools are examples of supported integrations — not endorsements.",
  C.lightGreen, C.qlikGreen
);

// 11 · Qlik MCP Server (PREVIEW)
capabilitySlide(
  "Qlik MCP Server", "mcp", C.qlikTeal,
  "An MCP-compliant server that exposes Qlik Cloud's governance to any AI assistant",
  "PREVIEW · Jun 2026", C.qlikBlue,
  [
    "Exposes Qlik Cloud analytical and data-governance capabilities over MCP",
    "Surfaces data products, quality metrics, lineage, and catalog",
    "Works with any MCP-compatible assistant — Claude, Copilot",
    "Bridges Qlik governance to third-party AI agents",
  ],
  [
    "Expose MCG's 2 gold data products + trust metrics to Claude / Copilot",
    "Governed, read-through access to lineage and glossary",
    "Complements the consumption-side MCP already in the MCG demo",
  ],
  "Qlik internal preview, June 2026 — roadmap, not GA. Availability and timing may change.",
  C.lightCyan, C.qlikTeal
);

// ═══════════════════════════════════════════════════
// SLIDE 12: How it works — the 7-step raw→trusted flow
// ═══════════════════════════════════════════════════
slide = contentSlide("How It Works — Raw to Trusted, AI-Ready", C.qlikGreen);

slide.addText("Seven stages take data from a declarative definition to a governed, AI-ready product — each stage owned by a capability", {
  x: 0.5, y: 0.86, w: 12.3, h: 0.4,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

const flow = [
  { name: "Design", detail: "Author declaratively in your IDE with an AI coding agent; commit to Git", owner: "Declarative Data Pipelines" },
  { name: "Data movement", detail: "CI/CD deploys the definition to the Open Lakehouse", owner: "Qlik Talend Cloud" },
  { name: "Quality", detail: "Profile and validate the data conversationally", owner: "Data Quality Agent" },
  { name: "Packaging", detail: "Package Silver into Gold with governance metadata", owner: "Data Product Agent" },
  { name: "Discovery & governance", detail: "Catalog assets and generate glossary terms (draft)", owner: "Catalog & Glossary Agent" },
  { name: "AI enhancement", detail: "Inject LLM, RAG, and orchestration into pipeline tasks", owner: "Talend Agentic Routes" },
  { name: "AI-ready output", detail: "Trusted data product with trust scores + provenance", owner: "Gold data products" },
];
flow.forEach((f, i) => {
  const y = 1.35 + i * 0.72;
  slide.addShape(pptx.shapes.OVAL, {
    x: 0.55, y: y + 0.03, w: 0.5, h: 0.5,
    fill: { color: i === flow.length - 1 ? C.qlikGreen : C.qlikTeal },
  });
  slide.addText(`${i + 1}`, {
    x: 0.55, y: y + 0.03, w: 0.5, h: 0.5,
    fontSize: 16, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
  slide.addText(f.name, {
    x: 1.25, y: y + 0.02, w: 3.4, h: 0.55,
    fontSize: 13, color: C.qlikBlue, fontFace: FONT, bold: true, valign: "middle",
  });
  slide.addText(f.detail, {
    x: 4.7, y: y + 0.02, w: 5.2, h: 0.55,
    fontSize: 11, color: C.darkText, fontFace: FONT, valign: "middle",
  });
  slide.addText(f.owner, {
    x: 9.95, y: y + 0.02, w: 2.85, h: 0.55,
    fontSize: 10, color: C.qlikTeal, fontFace: FONT, italic: true, align: "right", valign: "middle",
  });
});

// ═══════════════════════════════════════════════════
// SLIDE 13: Human-in-the-loop — the 4-step coding-agent loop
// ═══════════════════════════════════════════════════
slide = contentSlide("Human in the Loop — The Coding-Agent Loop", C.qlikGreen);

slide.addText("The agent moves fast; the schema guards the work; the engineer decides. Four steps, repeated for every change.", {
  x: 0.5, y: 0.86, w: 12.3, h: 0.4,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

const loop = [
  { title: "Developer Prompts", icon: "agent", color: C.qlikTeal, desc: "Describe the change in plain language — no boilerplate." },
  { title: "Agent Generates", icon: "transform", color: C.qlikGreen, desc: "The coding agent edits the pipeline YAML for you." },
  { title: "Schema Validates", icon: "governance", color: C.qlikLightGreen, desc: "The pipeline schema checks the change automatically." },
  { title: "Developer Reviews", icon: "answers", color: C.qlikTeal, desc: "The engineer reads the git diff and approves." },
];
loop.forEach((step, i) => {
  const x = 0.5 + i * 3.16;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y: 1.9, w: 2.9, h: 2.9,
    fill: { color: C.lightBg }, rectRadius: 0.12, line: { color: step.color, width: 2 },
  });
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y: 1.9, w: 2.9, h: 0.55,
    fill: { color: step.color }, rectRadius: 0.06,
  });
  slide.addText(`Step ${i + 1}`, {
    x, y: 1.9, w: 2.9, h: 0.55,
    fontSize: 12, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
  iconBadge(slide, step.icon, x + 1.2, 2.65, 0.5, step.color);
  slide.addText(step.title, {
    x: x + 0.1, y: 3.3, w: 2.7, h: 0.5,
    fontSize: 14, color: step.color, fontFace: FONT, bold: true, align: "center",
  });
  slide.addText(step.desc, {
    x: x + 0.2, y: 3.85, w: 2.5, h: 0.85,
    fontSize: 10.5, color: C.darkText, fontFace: FONT, align: "center", valign: "top", lineSpacingMultiple: 1.03,
  });
  if (i < loop.length - 1) {
    slide.addText("▶", {
      x: x + 2.86, y: 3.05, w: 0.4, h: 0.5,
      fontSize: 18, color: C.qlikGray, fontFace: FONT, align: "center",
    });
  }
});

noteBand(slide, "Human expertise stays in the loop at every stage — the agent drafts, the schema guards, the engineer decides.", 5.2, C.lightGreen, C.qlikGreen);

// ═══════════════════════════════════════════════════
// SLIDE 14: See it live — VS Code + coding agent
// ═══════════════════════════════════════════════════
slide = contentSlide("See It Live — A One-Line Change in VS Code", C.qlikTeal);

slide.addText("Change the CRM landing cadence from every 15 minutes to every 30 — with a coding agent, a one-line diff, and Apply-from-Remote", {
  x: 0.5, y: 0.86, w: 12.3, h: 0.4,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

// Left: walkthrough steps
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.45, w: 6.3, h: 4.55,
  fill: { color: C.lightBg }, rectRadius: 0.12, line: { color: C.qlikTeal, width: 2 },
});
slide.addText("Walkthrough", {
  x: 0.7, y: 1.6, w: 5.9, h: 0.45,
  fontSize: 15, color: C.qlikTeal, fontFace: FONT, bold: true,
});
const walk = [
  "Open deploy/pipelines/ in VS Code — schema kit is local via \"npm run pipeline:template\"",
  "Prompt the coding agent: \"change MCG CRM Landing from every 15 to every 30 minutes\"",
  "The agent edits one line of the task YAML schedule",
  "The pipeline schema validates the change automatically",
  "Review the one-line git diff, then Apply-from-Remote back to Qlik Talend Cloud",
];
walk.forEach((w, i) => {
  slide.addShape(pptx.shapes.OVAL, {
    x: 0.75, y: 2.2 + i * 0.72, w: 0.42, h: 0.42, fill: { color: C.qlikTeal },
  });
  slide.addText(`${i + 1}`, {
    x: 0.75, y: 2.2 + i * 0.72, w: 0.42, h: 0.42,
    fontSize: 13, color: C.white, fontFace: FONT, bold: true, align: "center", valign: "middle",
  });
  slide.addText(w, {
    x: 1.35, y: 2.15 + i * 0.72, w: 5.3, h: 0.6,
    fontSize: 11, color: C.darkText, fontFace: FONT, valign: "middle", lineSpacingMultiple: 1.02,
  });
});

// Right: the git diff
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 7.0, y: 1.45, w: 5.8, h: 3.05,
  fill: { color: C.qlikBlue }, rectRadius: 0.1,
});
slide.addText("git diff — mcg-batch-pipeline / crm-landing", {
  x: 7.2, y: 1.55, w: 5.5, h: 0.35,
  fontSize: 10, color: C.qlikCyan, fontFace: MONO,
});
const diffLines = [
  { t: "  task: MCG CRM Landing", c: "D0D4D7" },
  { t: "  schedule:", c: "D0D4D7" },
  { t: "-   rrule: FREQ=MINUTELY;INTERVAL=15", c: C.qlikGray },
  { t: "+   rrule: FREQ=MINUTELY;INTERVAL=30", c: C.qlikCyan },
];
diffLines.forEach((d, i) => {
  slide.addText(d.t, {
    x: 7.25, y: 2.0 + i * 0.42, w: 5.4, h: 0.4,
    fontSize: 12, color: d.c, fontFace: MONO, valign: "middle",
  });
});
slide.addText("One line changed · additions in green, removals in gray", {
  x: 7.2, y: 3.85, w: 5.5, h: 0.35,
  fontSize: 9.5, color: C.qlikCyan, fontFace: FONT, italic: true,
});

// Right-lower: what this proves
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 7.0, y: 4.65, w: 5.8, h: 1.35,
  fill: { color: C.lightCyan }, rectRadius: 0.1,
});
slide.addText("The git diff is the audit trail. Apply-from-Remote is the deploy. No UI clicking, no guesswork — a reviewable, reproducible change.", {
  x: 7.2, y: 4.75, w: 5.5, h: 1.15,
  fontSize: 12, color: C.qlikTeal, fontFace: FONT, bold: true, valign: "middle", lineSpacingMultiple: 1.05,
});

// ═══════════════════════════════════════════════════
// SLIDE 15: MCP roadmap
// ═══════════════════════════════════════════════════
slide = contentSlide("Qlik MCP Server — Roadmap", C.qlikBlue);
statusPill(slide, "PREVIEW · ROADMAP", C.qlikBlue);

slide.addText("Where governance-aware AI agents are headed at Qlik — clearly a roadmap item, not a commitment", {
  x: 0.5, y: 0.86, w: 9.2, h: 0.4,
  fontSize: 13, color: C.medGray, fontFace: FONT, italic: true,
});

panel(slide, 0.5, 1.4, 6.0, 4.0, "What the MCP Server exposes", C.qlikTeal, [
  "Data products — discover and query the governed catalog",
  "Quality metrics — trust scores and DQ signals",
  "Lineage — where a field comes from, end to end",
  "Catalog & glossary — consistent business terminology",
  "Reachable from any MCP-compatible assistant (Claude, Copilot)",
], { icon: "mcp", fs: 11.5, spacing: 0.62 });

panel(slide, 6.8, 1.4, 6.0, 4.0, "What it unlocks for MCG", C.qlikGreen, [
  "Ask Claude or Copilot governed questions about MCG data",
  "Expose the 2 gold data products + trust metrics safely",
  "Governance travels with the answer — lineage and glossary in context",
  "Complements the consumption-side MCP already in the demo",
  "One governed surface for build-side and consumption-side AI",
], { icon: "governance", fs: 11.5, spacing: 0.62 });

noteBand(slide, "Roadmap, not a commitment. Qlik internal preview, June 2026 — capabilities, availability, and timing may change before GA.", 5.6, C.lightCyan, C.qlikTeal);

// ═══════════════════════════════════════════════════
// SLIDE 16: Close — what this unlocks + CTA
// ═══════════════════════════════════════════════════
slide = pptx.addSlide();
slideNum++;
slide.background = { fill: C.white };
slide.addImage({ path: COVER_BG, x: 0, y: 0, w: 13.33, h: 7.5 });
slide.addImage({ path: QLIK_LOGO, x: 0.5, y: 0.4, w: 1.12, h: 0.62 });

slide.addText("Meridian Commerce Group", {
  x: 0.5, y: 1.5, w: 7.0, h: 0.5,
  fontSize: 16, color: C.qlikGray, fontFace: FONT, letterSpacing: 2,
});
slide.addText("Pipelines as code.\nAgents that build trust.\nAI that ships.", {
  x: 0.5, y: 2.05, w: 8.0, h: 1.7,
  fontSize: 30, color: C.qlikBlue, fontFace: FONT, bold: true, lineSpacingMultiple: 1.15,
});
slide.addText("What this unlocks for MCG:  faster, governed pipeline changes — drafted by AI, reviewed by engineers, trusted by the business.", {
  x: 0.5, y: 3.85, w: 8.5, h: 0.5,
  fontSize: 13, color: C.qlikGreen, fontFace: FONT, bold: true,
});

const closeMetrics = [
  { val: "2", label: "QTCP Projects", color: C.qlikTeal },
  { val: "6", label: "Pipeline Tasks", color: C.qlikTeal },
  { val: "2", label: "Gold Data Products", color: C.qlikGreen },
  { val: "25", label: "Glossary Terms", color: C.qlikGreen },
  { val: "6", label: "Build-Side Capabilities", color: C.qlikLightGreen },
];
closeMetrics.forEach((m, i) => {
  const x = 0.5 + i * 2.5;
  const y = 4.55;
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
  { text: "Learn more:  ", options: { bold: true, color: C.qlikBlue } },
  { text: "Qlik Agentic Data Engineering evaluation guide — [placeholder]", options: { color: C.darkText } },
], {
  x: 0.5, y: 5.95, w: 12.3, h: 0.35,
  fontSize: 12, fontFace: FONT,
});
slide.addText([
  { text: "Try it:  ", options: { bold: true, color: C.qlikGreen } },
  { text: "open deploy/pipelines/ in VS Code and run  npm run pipeline:template", options: { color: C.darkText } },
], {
  x: 0.5, y: 6.35, w: 12.3, h: 0.35,
  fontSize: 12, fontFace: FONT,
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
    ['The Job the Route Upgrades', 'automation-address-correction', 'mcg_sf_address_validate_bulk hands unresolved rows to a steward; an agentic route clears them in-line first.'],
    ['Deployed: Stewardship Sprint', 'stewardship-sprints', 'Where the unresolved branch lands today.'],
]);


const outPath = path.join(__dirname, "..", "MCG_Agentic_Data_Engineering.pptx");
pptx.writeFile({ fileName: outPath }).then(() => {
  console.log(`✅ PowerPoint saved: ${outPath} (${slideNum} slides)`);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
