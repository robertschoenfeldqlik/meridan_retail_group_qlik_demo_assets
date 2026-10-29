#!/usr/bin/env node
// =============================================================================
// MCG Data Integration Pillar — four slides
// =============================================================================
// 1. Technical architecture: gateway and databases, Kafka, Open Lakehouse,
//    Snowflake, data products and the analytics apps, task by task.
// 2. What's included — the Data Movement Gateway container repo.
// 3. What's included — this repo (MCG Full Stack).
// 4. What is Apache Iceberg — the table format under the lakehouse.
//
// White Qlik layout: green eyebrow, navy title, rounded cards with a line
// icon, green tag line, streaks top right, Qlik logo bottom left.
//
// Usage:  node generators/gen-di-pillar-slides.js [--out <file>]
// Output: MCG_DI_Pillar_Slides.pptx (assets root), or <file>
// =============================================================================

const PptxGenJS = require("pptxgenjs");
const sharp = require("sharp");
const path = require("path");
const { deck } = require("./lib/asset-paths");

const C = {
  navy: "19416C",
  green: "009845",
  teal: "006580",
  text: "454659",
  gray: "6B7280",
  border: "D5DADD",
  zone: "F6F7F8",
  white: "FFFFFF",
  lightGreen: "E0F5EA",
  lightTeal: "E0F2F5",
  lightBlue: "E3EAF3",
};
const FONT = "Inter";
const ASSETS = path.join(__dirname, "assets");
const ICON = (name) => path.join(ASSETS, "icons", name + ".png");

const GATEWAY_REPO = "https://github.com/robertschoenfeldqlik/qlik_data_movement_gateway_rdbms_container";
const MCG_REPO = "https://github.com/robertschoenfeldqlik/meridan_retail_group_qlik_demo_assets";

// Project colours: every task box carries its pipeline project's accent.
const PROJECT = {
  cdc: { name: "MCG Supply Chain Pipeline - CDC", color: C.green, fill: C.lightGreen },
  iot: { name: "MCG Supply Chain Pipeline - IoT Streaming", color: C.teal, fill: C.lightTeal },
  transform: { name: "MCG Supply Chain Pipeline - Transform", color: C.navy, fill: C.lightBlue },
};

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE"; // 13.33 × 7.5 inches
pptx.author = "Qlik";
pptx.company = "Qlik / Meridian Commerce Group";
pptx.title = "Project Qlarity — MCG Data Integration Pillar";

// ─── Images: the template's streaks and the Qlik logo, cropped to size ───
async function loadImages() {
  // qlik_template_image6.png is a 2400×1350 slide background whose streaks
  // sit along the top-left edge; the band alone is the top 220 px.
  const streak = await sharp(path.join(ASSETS, "qlik_template_image6.png"))
    .extract({ left: 0, top: 0, width: 1500, height: 220 })
    .png().toBuffer();
  const logo = await sharp(path.join(ASSETS, "qlik-logo.png")).trim().png().toBuffer();
  const meta = await sharp(logo).metadata();
  const b64 = (buf) => "image/png;base64," + buf.toString("base64");
  return { streak: b64(streak), logo: b64(logo), logoAspect: meta.width / meta.height };
}

function chrome(slide, img, eyebrow, title) {
  slide.background = { color: C.white };
  slide.addImage({ data: img.streak, x: 8.75, y: 0, w: 4.6, h: 4.6 * 220 / 1500 });
  slide.addText(eyebrow, {
    x: 0.55, y: 0.36, w: 8, h: 0.3, margin: 0,
    fontFace: FONT, fontSize: 11, bold: true, color: C.green, charSpacing: 2,
  });
  slide.addText(title, {
    x: 0.55, y: 0.68, w: 9, h: 0.7, margin: 0,
    fontFace: FONT, fontSize: 32, bold: true, color: C.navy, valign: "middle",
  });
  const lh = 0.3;
  slide.addImage({ data: img.logo, x: 0.55, y: 7.0, w: lh * img.logoAspect, h: lh });
  slide.addShape(pptx.shapes.LINE, { x: 0, y: 7.46, w: 13.333, h: 0, line: { color: "B9C0C4", width: 0.75 } });
}

// ─── "What's included" card: line icon, heading, body, green tag ───
function card(slide, x, y, w, h, c) {
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, fill: { color: C.white }, rectRadius: 0.28,
    line: { color: C.border, width: 0.75 },
  });
  slide.addImage({ path: ICON(c.icon), x: x + 0.22, y: y + 0.2, w: 0.44, h: 0.44 });
  slide.addText(c.title, {
    x: x + 0.8, y: y + 0.2, w: w - 1.0, h: 0.44, margin: 0,
    fontFace: FONT, fontSize: 15, bold: true, color: C.navy, valign: "middle",
  });
  slide.addText(c.body, {
    x: x + 0.24, y: y + 0.76, w: w - 0.48, h: 0.92, margin: 0,
    fontFace: FONT, fontSize: 11, color: C.text, valign: "top", lineSpacingMultiple: 1.05,
  });
  slide.addText(c.tag, {
    x: x + 0.24, y: y + h - 0.5, w: w - 0.48, h: 0.3, margin: 0,
    fontFace: FONT, fontSize: 10, bold: true, color: C.green, valign: "middle",
  });
}

function whatsIncluded(img, eyebrow, url, cards, notes, opts = {}) {
  const slide = pptx.addSlide();
  chrome(slide, img, eyebrow, opts.title || "What’s included");
  slide.addText(opts.linkText || "GitHub Link", {
    x: 0.76, y: 1.56, w: 2, h: 0.34, margin: 0,
    fontFace: FONT, fontSize: 13, color: C.navy, underline: { style: "sng" },
    hyperlink: { url, tooltip: url },
  });
  const w = 3.87, h = 2.16, gx = 0.3, gy = 0.31, x0 = 0.55, y0 = 2.23;
  cards.forEach((c, i) => card(slide, x0 + (i % 3) * (w + gx), y0 + Math.floor(i / 3) * (h + gy), w, h, c));
  slide.addNotes(notes);
}

// ─── Diagram primitives ───
function zone(slide, x, y, w, h, label, sub) {
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, fill: { color: C.zone }, rectRadius: 0.16, line: { color: "E3E7EA", width: 0.75 },
  });
  slide.addText([
    { text: label, options: { bold: true, color: C.gray, charSpacing: 1 } },
    ...(sub ? [{ text: "   " + sub, options: { color: C.gray } }] : []),
  ], { x: x + 0.15, y: y + 0.08, w: w - 0.3, h: 0.28, margin: 0, fontFace: FONT, fontSize: 8.5, valign: "middle" });
}

// White node box. `accent` is a project colour (task) or null (infrastructure).
function node(slide, x, y, w, h, title, sub, opts = {}) {
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, fill: { color: opts.fill || C.white }, rectRadius: 0.08,
    line: { color: opts.accent || C.border, width: opts.accent ? 1 : 0.75 },
  });
  if (opts.accent) {
    slide.addShape(pptx.shapes.RECTANGLE, { x: x + 0.012, y: y + 0.12, w: 0.06, h: h - 0.24, fill: { color: opts.accent }, line: { color: opts.accent, width: 0 } });
  }
  let tx = x + (opts.accent ? 0.16 : 0.12);
  if (opts.icon) {
    slide.addImage({ path: ICON(opts.icon), x: tx, y: y + 0.1, w: 0.34, h: 0.34 });
    tx += 0.42;
  }
  const tw = x + w - tx - 0.08;
  slide.addText(title, {
    x: tx, y: y + 0.08, w: tw, h: 0.38, margin: 0,
    fontFace: FONT, fontSize: opts.titleSize || 10, bold: true, color: C.navy, valign: "middle",
  });
  if (sub) {
    const sx = opts.icon ? x + (opts.accent ? 0.16 : 0.12) : tx;
    slide.addText(sub, {
      x: sx, y: y + 0.48, w: x + w - sx - 0.08, h: h - 0.56, margin: 0,
      fontFace: FONT, fontSize: opts.subSize || 8, color: C.text, valign: "top", lineSpacingMultiple: 1.05,
    });
  }
}

function arrow(slide, x1, y1, x2, y2, color) {
  slide.addShape(pptx.shapes.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    flipH: x2 < x1, flipV: y2 < y1,
    line: { color: color || C.gray, width: 1.5, endArrowType: "triangle" },
  });
}

// =============================================================================
// SLIDE 1 — Technical architecture
// =============================================================================
function slideArchitecture(img) {
  const slide = pptx.addSlide();
  chrome(slide, img, "DATA INTEGRATION PILLAR", "Technical architecture");

  // Project legend: Qlik Talend Cloud runs the three projects; the task boxes
  // below carry the colour of the project they belong to.
  slide.addText("Qlik Talend Cloud pipeline projects", {
    x: 0.55, y: 1.55, w: 2.75, h: 0.32, margin: 0, fontFace: FONT, fontSize: 10, bold: true, color: C.text, valign: "middle",
  });
  let lx = 3.3;
  for (const p of Object.values(PROJECT)) {
    const w = p.name.length * 0.068 + 0.36;
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: lx, y: 1.55, w, h: 0.32, rectRadius: 0.16, fill: { color: p.fill }, line: { color: p.color, width: 0.75 } });
    slide.addText(p.name, { x: lx, y: 1.55, w, h: 0.32, margin: 0, align: "center", valign: "middle", fontFace: FONT, fontSize: 9, bold: true, color: p.color });
    lx += w + 0.15;
  }

  const top = 2.05, bottom = 6.8, zh = bottom - top;
  const Z1 = { x: 0.55, w: 2.7 }, Z2 = { x: 3.5, w: 5.0 }, Z3 = { x: 8.75, w: 2.0 }, Z4 = { x: 11.0, w: 1.8 };
  zone(slide, Z1.x, top, Z1.w, zh, "MCG HOST", "Podman");
  zone(slide, Z2.x, top, Z2.w, zh, "MCG AWS VPC · QLIK OPEN LAKEHOUSE", "rgs-olh-mcg");
  zone(slide, Z3.x, top, Z3.w, zh, "SNOWFLAKE");
  zone(slide, Z4.x, top, Z4.w, zh, "QLIK CLOUD");

  const r1 = 2.5, r1h = 1.45;            // CDC row
  const band = 4.13, bandH = 0.45;       // Glue catalog band
  const r2 = 4.78, r2h = 1.85;           // streaming row

  // ── Zone 1: the gateway container and the local Kafka ──
  const gx = Z1.x + 0.12, gw = Z1.w - 0.24, ch = 2.3;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: gx, y: r1, w: gw, h: ch, fill: { color: C.white }, rectRadius: 0.08, line: { color: C.border, width: 0.75 },
  });
  slide.addText("mcg-qlik-dmg", { x: gx + 0.12, y: r1 + 0.06, w: 1.3, h: 0.28, margin: 0, fontFace: FONT, fontSize: 10, bold: true, color: C.navy, valign: "middle" });
  slide.addText("Oracle Linux 9", { x: gx + 1.3, y: r1 + 0.06, w: gw - 1.42, h: 0.28, margin: 0, fontFace: FONT, fontSize: 7.5, color: C.gray, align: "right", valign: "middle" });
  // The gateway row, tinted: the one process that talks to Qlik Cloud.
  const rx = gx + 0.1, rw = gw - 0.2;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: rx, y: r1 + 0.4, w: rw, h: 0.6, fill: { color: C.lightGreen }, rectRadius: 0.06, line: { color: C.green, width: 0.75 },
  });
  slide.addImage({ path: ICON("gateway"), x: rx + 0.08, y: r1 + 0.53, w: 0.34, h: 0.34 });
  slide.addText("Data Movement Gateway", { x: rx + 0.5, y: r1 + 0.45, w: rw - 0.56, h: 0.26, margin: 0, fontFace: FONT, fontSize: 9.5, bold: true, color: C.navy, valign: "bottom" });
  slide.addText("2026.5.37 · outbound only", { x: rx + 0.5, y: r1 + 0.72, w: rw - 0.56, h: 0.22, margin: 0, fontFace: FONT, fontSize: 7.5, color: C.text, valign: "top" });
  slide.addText("reads the change logs of", { x: gx + 0.12, y: r1 + 1.06, w: gw - 0.2, h: 0.2, margin: 0, fontFace: FONT, fontSize: 7.5, italic: true, color: C.gray });
  for (const [i, db] of [["MySQL 8 · Meridian CRM", "mcg_crm · binary log, ROW format"], ["PostgreSQL 15 · WMS", "mcg_wms · logical decoding"]].entries()) {
    const y = r1 + 1.3 + i * 0.5;
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: rx, y, w: rw, h: 0.45, fill: { color: C.white }, rectRadius: 0.06, line: { color: C.border, width: 0.75 } });
    slide.addText(db[0], { x: rx + 0.1, y: y + 0.03, w: rw - 0.2, h: 0.2, margin: 0, fontFace: FONT, fontSize: 8.5, bold: true, color: C.navy, valign: "middle" });
    slide.addText(db[1], { x: rx + 0.1, y: y + 0.23, w: rw - 0.2, h: 0.18, margin: 0, fontFace: FONT, fontSize: 7.5, color: C.gray, valign: "middle" });
  }

  node(slide, gx, r2 + 0.25, gw, r2h - 0.25, "Kafka · Confluent 7.7.1",
    "IoT simulator → mcg.iot.cold-chain, mcg.iot.carrier-events\n\nMirrorMaker 2 copies mcg.iot.* to the Kafka EC2 (SASL, port 29093)",
    { icon: "stream" });

  // ── Zone 2: Open Lakehouse ──
  const ax = Z2.x + 0.15, aw = Z2.w - 0.3;
  const landW = 2.0;
  node(slide, ax, r1 + 0.25, landW, r1h - 0.25, "Landing · S3",
    "MCG_CRM_Lake_landing\nMCG_WMS_Lake_landing\nbucket: MCG S3 Landing CDC", { accent: PROJECT.cdc.color });
  // rgs-olh-mcg-cluster around the storage task
  const cx = ax + landW + 0.3, cw = ax + aw - cx;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: cx, y: r1, w: cw, h: r1h, fill: { color: "EEF1F3" }, rectRadius: 0.08, line: { color: "A9B3B6", width: 0.75, dashType: "dash" },
  });
  slide.addText("rgs-olh-mcg-cluster · Spot", { x: cx + 0.1, y: r1 + 0.02, w: cw - 0.2, h: 0.22, margin: 0, fontFace: FONT, fontSize: 7.5, bold: true, color: C.gray, valign: "middle" });
  node(slide, cx + 0.08, r1 + 0.25, cw - 0.16, r1h - 0.33, "Storage · Iceberg",
    "MCG_CRM_Storage\nMCG_WMS_Storage\n6 Iceberg tables on S3", { accent: PROJECT.cdc.color });

  node(slide, ax, band, aw, bandH, "AWS Glue Data Catalog", null, { icon: "lakehouse", titleSize: 9 });
  slide.addText("MCG Glue Catalog · Iceberg table metadata", {
    x: ax + 2.4, y: band, w: aw - 2.5, h: bandH, margin: 0, fontFace: FONT, fontSize: 7.5, color: C.text, valign: "middle", align: "right",
  });

  const ec2W = 1.2;
  node(slide, ax, r2 + 0.25, ec2W, r2h - 0.25, "Kafka EC2",
    "t3.small Spot\nVPC listener 29092\nMCG IoT Telemetry", {});
  const sx = ax + ec2W + 0.25, sw = ax + aw - sx;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: sx, y: r2, w: sw, h: r2h, fill: { color: "EEF1F3" }, rectRadius: 0.08, line: { color: "A9B3B6", width: 0.75, dashType: "dash" },
  });
  slide.addText("rgs_olh_mcg_streaming · Spot", { x: sx + 0.1, y: r2 + 0.02, w: sw - 0.2, h: 0.22, margin: 0, fontFace: FONT, fontSize: 7.5, bold: true, color: C.gray, valign: "middle" });
  const stW = (sw - 0.16 - 0.2) / 2;
  const st2 = sx + 0.08 + stW + 0.2;
  node(slide, sx + 0.08, r2 + 0.25, stW, r2h - 0.33, "Streaming landing",
    "MCG IoT Streaming Landing\nbucket: MCG S3 Landing Streaming", { accent: PROJECT.iot.color, titleSize: 9.5, subSize: 7.5 });
  node(slide, st2, r2 + 0.25, stW, r2h - 0.33, "Streaming transform",
    "silver.iot_normalized\nstays in Iceberg, not mirrored", { accent: PROJECT.iot.color, titleSize: 9.5, subSize: 7.5 });

  // ── Zone 3: Snowflake ──
  const fx = Z3.x + 0.12, fw = Z3.w - 0.24;
  node(slide, fx, r1, fw, 1.3, "Zero-copy mirror",
    "MCG Snowflake Mirror\nMCG WMS Snowflake Mirror\nsame Iceberg files, no copy\nRGS_E2E_DEMO_DB", { accent: PROJECT.cdc.color });
  node(slide, fx, 4.05, fw, 1.13, "Silver · 7 datasets",
    "MCG Silver Transform\nshipments, inventory, orders, products, suppliers, addresses, events", { accent: PROJECT.transform.color });
  node(slide, fx, 5.43, fw, 1.2, "Gold · 2 datasets",
    "MCG Gold Transform\nsupply_chain_health\nlast_mile_performance", { accent: PROJECT.transform.color });

  // ── Zone 4: Qlik Cloud ──
  const qx = Z4.x + 0.12, qw = Z4.w - 0.24;
  node(slide, qx, r1, qw, 1.95, "Analytics",
    "MCG Supply Chain Operations\n\nMCG Delivery & Customer Experience\n\nQlik Answers assistant", { icon: "analytics" });
  node(slide, qx, 4.78, qw, 1.85, "Data products",
    "Supply Chain Health\nLast Mile Performance\n\ncatalog · data quality · stewardship", { icon: "governance" });

  // ── Flows ──
  const y1 = r1 + 0.25 + (r1h - 0.25) / 2;                  // CDC row centre
  arrow(slide, rx + rw, r1 + 0.7, ax, r1 + 0.7, C.green);    // gateway → landing
  arrow(slide, ax + landW, y1, cx + 0.08, y1, C.green);      // landing → storage
  arrow(slide, ax + aw, y1, fx, y1, C.green);                // storage → mirror
  const y2 = r2 + 0.25 + (r2h - 0.25) / 2;                  // streaming row centre
  arrow(slide, gx + gw, y2, ax, y2, C.teal);                 // Kafka → Kafka EC2
  arrow(slide, ax + ec2W, y2, sx + 0.08, y2, C.teal);        // EC2 → streaming landing
  arrow(slide, sx + 0.08 + stW, y2, st2, y2, C.teal);        // landing → transform
  arrow(slide, fx + fw / 2, r1 + 1.3, fx + fw / 2, 4.05, C.navy);    // mirror → silver
  arrow(slide, fx + fw / 2, 4.05 + 1.13, fx + fw / 2, 5.43, C.navy); // silver → gold
  arrow(slide, fx + fw, 6.03, qx, 6.03, C.navy);             // gold → data products
  arrow(slide, qx + qw / 2, 4.78, qx + qw / 2, r1 + 1.95, C.navy);  // data products → apps

  slide.addNotes(
    "Left to right is the path a change takes. The Data Movement Gateway runs in one container with the CRM's MySQL and the WMS's PostgreSQL " +
    "and reads their change logs, outbound only. The CDC project lands those changes in S3, the storage task turns them into Iceberg tables " +
    "on the rgs-olh-mcg cluster, and the mirror exposes the same files to Snowflake without copying them. The Transform project builds " +
    "Silver and Gold in Snowflake; Gold is published as two data products that the two Qlik apps read. The IoT stream takes a separate " +
    "path: MirrorMaker 2 copies the local Kafka topics to a Kafka EC2 in the VPC, and the streaming cluster lands and normalizes them in Iceberg."
  );
}

// =============================================================================
// SLIDES 2 & 3 — What's included
// =============================================================================
const GATEWAY_CARDS = [
  { icon: "gateway", title: "Data Movement Gateway", tag: "Gateway 2026.5.37",
    body: "Qlik's gateway RPM on Oracle Linux 9 with systemd as PID 1. It generates the registration key before the service starts and resets the tenant URL only when it changes." },
  { icon: "database", title: "Three databases", tag: "MySQL · PostgreSQL · SQL Server",
    body: "MySQL 8.0, PostgreSQL 15 and SQL Server 2022 Developer run beside the gateway, each with its ODBC driver, on ports 3306, 5432 and 1433." },
  { icon: "pipeline", title: "Ready for CDC", tag: "Log-based CDC",
    body: "MySQL binary logging in ROW format and PostgreSQL logical decoding are switched on at setup, so the gateway reads changes straight from the logs." },
  { icon: "analytics", title: "Sample data", tag: "churn · crm · mcg_wms",
    body: "MySQL ships with the churn and crm databases, and crm reloads whenever it is missing. crm.account joins the churn customers; PostgreSQL gets mcg_wms." },
  { icon: "automation", title: "Deploy scripts", tag: "Windows · Linux/macOS · Docker · Podman",
    body: "PowerShell and Bash scripts check the engine, fetch the RPM, ask for the tenant URL, open the ports, build, start and print the registration token." },
  { icon: "mcp", title: "First-boot init", tag: "qlik-dmg-init.service",
    body: "A oneshot systemd unit runs entrypoint.sh on every boot. It sets up each database once, installs the RPM and prepares the gateway before repagent starts." },
];

const MCG_CARDS = [
  { icon: "automation", title: "Deploy UI and CLI", tag: "npm run ui · npm run deploy",
    body: "A web UI on port 3939 and deploy-to-qlik.js build the tenant: spaces, pipeline projects, data products, apps, glossary and automations. Dry run first." },
  { icon: "pipeline", title: "Declarative pipelines", tag: "Open Lakehouse · Snowflake",
    body: "QTCP YAML exported from the live CDC, IoT Streaming and Transform projects. The deployer imports Streaming and Transform and binds Transform to CDC by name." },
  { icon: "stream", title: "Source simulators", tag: "CRM · WMS · IoT",
    body: "Python simulators keep changes flowing into the Meridian CRM (MySQL), the WMS (PostgreSQL) and the IoT topics on Kafka, from shared reference data." },
  { icon: "mcp", title: "Container stack", tag: "Podman · Docker",
    body: "Compose files for the simulators, Kafka (Confluent 7.7.1) and the gateway container. MirrorMaker 2 copies the IoT topics to the Kafka EC2 in AWS." },
  { icon: "governance", title: "Governance and analytics", tag: "Data products · Apps",
    body: "Two Gold data products, a 25-term glossary, stewardship sprints, and the Supply Chain Operations and Delivery & Customer Experience apps." },
  { icon: "answers", title: "Generators and AI", tag: "npm run generate · review:ui",
    body: "Node.js generators for decks, guides, SOPs and demo scripts, a Qlik Answers knowledge base and assistant, and a review app that scores videos and decks." },
];

// The table format underneath the lakehouse. The last card ties it to what
// was queried on this stack: Athena and the Snowflake mirror read the same
// Iceberg files the storage tasks write to rgs-olh-mcg-iceberg-s3.
const ICEBERG_CARDS = [
  { icon: "lakehouse", title: "Open table format", tag: "Apache top-level project",
    body: "A table format for huge analytic datasets on object storage. Data stays in open Parquet, ORC or Avro files; Iceberg adds the table: schema, partitions and snapshots." },
  { icon: "pipeline", title: "Metadata, not folders", tag: "metadata.json · manifests · data files",
    body: "Each table is a tree of metadata. A metadata file points to manifests that list every data file, so engines plan a query without listing the bucket." },
  { icon: "governance", title: "ACID transactions", tag: "Serializable isolation",
    body: "Every write commits a new snapshot by swapping one pointer in the catalog. Readers never see a partial write, and concurrent writers cannot corrupt the table." },
  { icon: "transform", title: "Evolves without rewrites", tag: "Schema · partitions",
    body: "Add, drop, rename or reorder columns and change the partitioning without rewriting data. Hidden partitioning means queries never name partition columns." },
  { icon: "automation", title: "Time travel", tag: "Snapshots · rollback",
    body: "Query a table as of any snapshot, see exactly what changed between two of them, and roll back a bad write to the last good state." },
  { icon: "cloud", title: "Any engine, one copy", tag: "Spark · Trino · Athena · Snowflake · Qlik",
    body: "Engines share tables through a catalog instead of copying them. Here, Athena and the Snowflake mirror read the Iceberg files Qlik Open Lakehouse writes to S3." },
];

async function main() {
  const img = await loadImages();
  slideArchitecture(img);
  whatsIncluded(img, "QLIK DATA MOVEMENT GATEWAY CONTAINER", GATEWAY_REPO, GATEWAY_CARDS,
    "The gateway repo is a single container: the Data Movement Gateway plus MySQL, PostgreSQL and SQL Server, ready for log-based CDC. " +
    "The MCG stack builds it as a submodule; on its own, the PowerShell or Bash script builds, starts and prints the registration token.");
  whatsIncluded(img, "PROJECT QLARITY · MERIDIAN COMMERCE GROUP", MCG_REPO, MCG_CARDS,
    "The MCG repo holds everything that puts the demo in a tenant: the deploy UI and CLI, the pipeline YAML, the simulators and containers " +
    "that feed it, the governance and analytics content, and the generators for the decks and guides.");
  whatsIncluded(img, "APACHE ICEBERG", "https://iceberg.apache.org", ICEBERG_CARDS,
    "Iceberg is the table format under the Open Lakehouse. The data sits in ordinary Parquet files on S3; Iceberg's metadata turns them " +
    "into a table with transactions, schema evolution and snapshots. Because the format is open, any engine that speaks Iceberg can query " +
    "the same copy: on this stack Athena queries it directly and Snowflake reads it through the zero-copy mirror.",
    { title: "What is Apache Iceberg?", linkText: "iceberg.apache.org" });
  // --out <file> writes elsewhere, e.g. while the deck is open in PowerPoint.
  const i = process.argv.indexOf("--out");
  const out = i > 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : deck("MCG_DI_Pillar_Slides.pptx");
  await pptx.writeFile({ fileName: out });
  console.log("Wrote " + out);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
