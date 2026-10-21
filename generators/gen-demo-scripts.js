#!/usr/bin/env node
// =============================================================================
// MCG Demo Scripts Generator — Creates 18 DOCX demo walk-through documents
// =============================================================================
// Each document covers one phase of the MCG Full Stack Demo checklist with
// presenter-ready narration, click-by-click steps, and talking points.
// Modules 1-13 cover the consumption-side platform; Modules 14-18 cover the
// build-side agentic data engineering story (Qlik Agentic Data Engineering).
// Rendered in the Qlik brand (Inter, Qlik palette, official Qlik logo).
//
// Usage:  node generators/gen-demo-scripts.js
// Output: documents/demo-scripts/*.docx (18 files)
// =============================================================================

const {
  buildQlikDocument, saveDocument,
  heading, para, numberedItem, calloutBox, metadataTable, dataTable, labelValue,
  setDocTheme, figure,
} = require("./mcg-docx-builder");
const { QLIK, ensureQlikLogo } = require("./qlik-doc-styles");
const deckMedia = require("./lib/deck-media");
const { Paragraph, TextRun, PageBreak, BorderStyle, Table, TableRow, TableCell, ShadingType, WidthType } = require("docx");
const path = require("path");
const { deck, doc, DOCS_DIR } = require("./lib/asset-paths");

// Render all demo scripts in the Qlik brand: Inter typography, Qlik palette,
// and the official Qlik logo header/footer (injected via the QLIK theme object).
setDocTheme(QLIK);

// Qlik brand colors for local helpers (canonical Qlik palette)
const Q = {
  blue: "19416C", green: "009845", teal: "006580", cyan: "10CFC9",
  lightGreen: "4CB393", gray: "A9B3B6", darkText: "54565A",
  lightBg: "F6F7F8", medGray: "6B7280",
};
const FONT = "Inter";

const OUT_DIR = doc("demo-scripts");

// ─── HELPER: Page break paragraph ───
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ─── HELPER: Prompt box (teal left accent for user prompts) ───
function promptBox(prompt, label = "Prompt") {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 2, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: Q.teal },
            borders: { top: { style: "none" }, bottom: { style: "none" }, left: { style: "none" }, right: { style: "none" } },
            children: [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: " ", size: 10 })] })],
          }),
          new TableCell({
            width: { size: 98, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: "E0F2F5" },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [
              new Paragraph({
                spacing: { after: 40 },
                children: [new TextRun({ text: label, font: FONT, size: 18, bold: true, color: Q.teal })],
              }),
              new Paragraph({
                spacing: { after: 0 },
                children: [new TextRun({ text: prompt, font: "Inter", size: 20, color: Q.darkText })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ─── HELPER: Expected response box (gold accent) ───
function expectedBox(text) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 2, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: Q.green },
            borders: { top: { style: "none" }, bottom: { style: "none" }, left: { style: "none" }, right: { style: "none" } },
            children: [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: " ", size: 10 })] })],
          }),
          new TableCell({
            width: { size: 98, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: "E0F5EA" },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [
              new Paragraph({
                spacing: { after: 40 },
                children: [new TextRun({ text: "Expected Response", font: FONT, size: 18, bold: true, color: Q.green })],
              }),
              new Paragraph({
                spacing: { after: 0 },
                children: [new TextRun({ text, font: FONT, size: 20, color: Q.darkText })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ─── HELPER: Screenshot ───
// Resolves a slug from generators/screenshots.json. Returns [] when the shot has
// not been captured, so an uncaptured screen leaves no trace in the document
// rather than printing a placeholder into a customer-facing script.
//
// Refresh captures with: node generators/capture-tenant-screenshots.js
function shot(slug, caption) {
  const hit = deckMedia.resolveShot(slug);
  if (!hit) return [];
  return figure(hit.path, caption || hit.caption || "");
}

// ─── HELPER: Section divider ───
function divider() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: Q.teal, space: 4 } },
    children: [new TextRun({ text: "", size: 4 })],
  });
}

// ─── HELPER: Talking point bullet ───
function talkingPoint(text) {
  return para(text, { bullet: true, color: Q.blue });
}

// ─── HELPER: Project Qlarity context line ───
// One concise line per scenario tying it to its Qlarity phase / data-quality nightmare.
function clarityContext(text) {
  return new Paragraph({
    spacing: { before: 80, after: 120 },
    children: [
      new TextRun({ text: "Project Qlarity context:  ", font: FONT, size: 20, bold: true, color: Q.teal }),
      new TextRun({ text, font: FONT, size: 20, italics: true, color: Q.darkText }),
    ],
  });
}

// ─── DEMO2WIN / SHOW-TELL-SHOW HELPERS ──────────────────────

// Limbic Opening box — emotional hook at the start of each module
function limbicOpening(text, type = "Problem/Consequence") {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 2, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: Q.blue },
            borders: { top: { style: "none" }, bottom: { style: "none" }, left: { style: "none" }, right: { style: "none" } },
            children: [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: " ", size: 10 })] })],
          }),
          new TableCell({
            width: { size: 98, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: "E3EAF3" },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [
              new Paragraph({
                spacing: { after: 40 },
                children: [new TextRun({ text: `Limbic Opening  (${type})`, font: FONT, size: 18, bold: true, color: Q.blue })],
              }),
              new Paragraph({
                spacing: { after: 0 },
                children: [new TextRun({ text, font: FONT, size: 20, italics: true, color: Q.darkText })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// Tell annotation — opening or closing Tell in Show-Tell-Show
function tellAnnotation(phase, text) {
  const label = phase === "open" ? "TELL (before showing)" : "TELL (after showing)";
  const color = phase === "open" ? Q.teal : Q.green;
  const bgColor = phase === "open" ? "E0F2F5" : "E0F5EA";
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: bgColor },
            margins: { top: 40, bottom: 40, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color },
              bottom: { style: BorderStyle.SINGLE, size: 1, color },
              left: { style: BorderStyle.SINGLE, size: 6, color },
              right: { style: "none" },
            },
            children: [
              new Paragraph({
                spacing: { after: 30 },
                children: [new TextRun({ text: label, font: FONT, size: 16, bold: true, color })],
              }),
              new Paragraph({
                spacing: { after: 0 },
                children: [new TextRun({ text, font: FONT, size: 18, italics: true, color: Q.darkText })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// Interaction prompt — question to ask the audience
function interactionPrompt(question) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [
      new TextRun({ text: "Ask the audience: ", font: FONT, size: 20, bold: true, color: Q.cyan }),
      new TextRun({ text: `"${question}"`, font: FONT, size: 20, italics: true, color: Q.darkText }),
    ],
  });
}

// "So You Can" value chain — walks up the value pyramid
function valueChain(items) {
  const runs = [];
  items.forEach((item, i) => {
    if (i > 0) runs.push(new TextRun({ text: "  →  so you can  ", font: FONT, size: 20, bold: true, color: Q.green }));
    runs.push(new TextRun({ text: item, font: FONT, size: 20, color: Q.darkText }));
  });
  return new Paragraph({ spacing: { before: 60, after: 100 }, children: runs });
}


// =============================================================================
// MODULE 1: Infrastructure & Data Sources
// =============================================================================
function module01() {
  return [
    heading("Module 1: Infrastructure & Data Sources"),
    metadataTable([
      ["Duration", "15-20 minutes (setup) / 5 minutes (demo walkthrough)"],
      ["Checklist Phase", "Phase 1"],
      ["Nightmares", "All 7 (data sources feed all nightmare scenarios)"],
      ["Components", "PostgreSQL, Apache Kafka (Confluent), MySQL, Docker"],
    ]),

    para("This is Module 1 of the Project Qlarity demo walkthrough — the end-to-end story of MCG's unified Qlik data-platform initiative (Connected Logistics, Analytics, and Real-time Intelligence Technology). Each module maps to a Project Qlarity phase and to the data-quality nightmares it eliminates.", { italics: true, color: Q.teal }),
    clarityContext("Project Qlarity Phase 1 (Foundation) — the three independent sources are exactly the systems Qlarity unifies; their baked-in quality problems are the origin of all Seven Data Quality Nightmares."),

    heading("Overview", 2),
    para("This module covers the foundational infrastructure: three independent data sources that feed the MCG demo. Each source represents a real-world system in a global supply chain company — a warehouse management database, IoT cold-chain sensors, and a CRM platform."),
    calloutBox("Key message: MCG's data problems start at the source. Three different systems, three different data formats, three different quality levels. This is the reality for every enterprise."),

    heading("Prerequisites", 2),
    para("Before starting, ensure you have:"),
    numberedItem(1, "Podman (rootful machine) with the Docker Compose v2 CLI — npm run engine confirms both (runs the Kafka, PostgreSQL and MySQL containers)"),
    numberedItem(2, "Python 3.9+ with pip installed"),
    numberedItem(3, "Node.js 18+ (for deploy scripts)"),
    numberedItem(4, "Nothing external — the CRM is a MySQL container in this repo's own stack"),
    numberedItem(5, "Network access to your Qlik Cloud tenant"),

    heading("Demo Methodology: Tell → Show → Tell", 2),
    limbicOpening("It's Monday morning. Henrik Jansen gets a call: 200 orders shipped over the weekend are wrong. The WMS said the inventory was there — it wasn't. Phantom inventory. $48 million a year in write-offs, and nobody knew until customers started calling. What if he could have seen the discrepancy before those orders shipped?", "Problem/Consequence"),
    interactionPrompt("How does your team currently know when inventory data doesn't match reality?"),

    heading("Demo Walk-Through", 2),

    tellAnnotation("open", "Before showing the infrastructure, set context: MCG has three completely independent data systems — a warehouse database, IoT sensors on trucks, and a CRM. None of them talk to each other. That's the starting point. Now let me show you where this data lives."),

    heading("Step 1: Start PostgreSQL & Seed WMS Data", 3),
    numberedItem(1, "Ensure PostgreSQL is running (Docker, RDS, or local install)"),
    numberedItem(2, "Verify database mcg_wms exists with user mcg_admin"),
    numberedItem(3, "Run the simulator to create schema and seed initial data:"),
    promptBox("python simulators/postgres_simulator.py --host localhost --port 5432 --db mcg_wms --user mcg_admin --password mcg_demo_2025 --setup-only", "Terminal Command"),
    numberedItem(4, "Verify 3 tables created: inventory_positions (~5,000 rows), warehouse_events (~20,000), shipments (~8,000)"),
    numberedItem(5, "Start continuous simulation for live CDC during demo (runs until Ctrl+C):"),
    promptBox("python simulators/postgres_simulator.py --host localhost --port 5432 --db mcg_wms --user mcg_admin --password mcg_demo_2025", "Terminal Command"),
    calloutBox("Talking point: The PostgreSQL simulator injects intentional data quality issues — phantom inventory (ERP says 50, WMS says 42), missing lot numbers on 15% of perishables, and timestamp drift between systems.", "warning"),

    heading("Step 2: Start Kafka & IoT Simulator", 3),
    numberedItem(1, "Start the Confluent Platform container stack (the npm script resolves the engine — Podman on this host — so never call compose directly):"),
    promptBox("npm run docker:up:kafka", "Terminal Command"),
    numberedItem(2, "Verify all services are healthy:"),
    promptBox("npm run docker:status", "Terminal Command"),
    expectedBox("kafka, zookeeper, schema-registry, control-center should all show 'healthy' or 'running'"),
    numberedItem(3, "Open Confluent Control Center at http://localhost:9021 to visually verify topics"),
    numberedItem(4, "Start the IoT simulator:"),
    promptBox("python simulators/kafka_iot_simulator.py --bootstrap-servers localhost:9092", "Terminal Command"),
    numberedItem(5, "Verify messages flowing: check Control Center > Topics > mcg.iot.cold-chain > Messages"),
    calloutBox("Talking point: The IoT simulator intentionally mixes Fahrenheit and Celsius readings (8% of sensors), sends bare timestamps without timezone info (3%), and creates GPS blackouts for Lagos shipments (2%). These are the real data quality nightmares IoT teams face.", "warning"),

    heading("Step 3: Start the Meridian CRM", 3),
    numberedItem(1, "Bring up the CRM database and its simulator (the same compose command also starts the WMS and IoT feeds):"),
    promptBox("npm run docker:up:simulators", "Terminal Command"),
    numberedItem(2, "The seeder creates crm_contacts, crm_orders and crm_products and loads the demo population. It is idempotent, so re-running changes nothing."),
    numberedItem(3, "Open a SQL prompt against it and show live rows:"),
    promptBox("npm run db:crm", "Terminal Command"),
    numberedItem(4, "Prove the change stream is real, not an append log:"),
    promptBox("SELECT order_status, COUNT(*) FROM crm_orders GROUP BY order_status;", "SQL — re-run after a minute and watch orders move along the lifecycle"),
    calloutBox("Talking point: Meridian CRM data has 11% address formatting inconsistencies and a legacy 30-character field limit that truncates addresses. These feed directly into Nightmare #2 (Address Catastrophe).", "warning"),
    calloutBox("Talking point: this source is not just growing, it is CHANGING. Orders advance through their lifecycle, addresses get corrected in place, old orders get purged. The MySQL binary log carries UPDATE and DELETE events, which is what log-based CDC exists to capture — a source that only ever inserts would make CDC indistinguishable from an append.", "info"),

    tellAnnotation("close", "So what you just saw are three real data sources — a warehouse database, IoT cold-chain sensors, and a CRM — all generating data with real-world quality problems baked in. This is not sanitized demo data. This is how supply chain data actually looks."),
    interactionPrompt("Does this feel familiar? How many disconnected data sources does your team deal with today?"),
    valueChain(["Ingest data from three independent systems in real-time", "see the complete supply chain picture in one place", "catch problems like phantom inventory before they cost $48M"]),

    heading("Talking Points", 2),
    talkingPoint("Three completely independent data systems — this is reality for every enterprise, not a contrived demo"),
    talkingPoint("Each source has its own data quality problems baked in — we didn't clean the data before loading it"),
    talkingPoint("The simulators generate realistic volumes: ~1 message/5 seconds for IoT, continuous CDC for PostgreSQL"),
    talkingPoint("All three sources need to come together to answer even simple questions like 'Where is my order?'"),

    heading("Troubleshooting", 2),
    dataTable(
      ["Issue", "Cause", "Fix"],
      [
        ["Compose command fails", "Podman machine not running", "Run: podman machine start, wait 30s, retry"],
        ["PostgreSQL connection refused", "Wrong host/port or database not created", "Verify with: psql -h localhost -U mcg_admin -d mcg_wms"],
        ["Kafka topics not created", "Init container failed", "Run: podman exec mcg-kafka kafka-topics --bootstrap-server kafka:9092 --list"],
        ["CRM connection refused", "MySQL container still starting", "Wait for the healthcheck: podman ps shows mcg-mysql (healthy)"],
      ]
    ),
  ];
}

// =============================================================================
// MODULE 2: Connections & Spaces
// =============================================================================
function module02() {
  return [
    heading("Module 2: Qlik Cloud Connections & Spaces"),
    metadataTable([
      ["Duration", "10-15 minutes"],
      ["Checklist Phase", "Phase 2"],
      ["Nightmares", "#4 (Silent Pipeline Failures), #6 (Carrier Data Black Hole)"],
      ["Components", "Qlik Cloud Administration, Data Integration connectors"],
    ]),

    clarityContext("Project Qlarity Phase 1 (Foundation): the CDC + Kafka integration backbone. Governed dev/prod spaces and gateway-bound connections are the prerequisite for the pipeline-health monitoring that closes Nightmare #4 (Silent Pipeline Failures) and the carrier feed behind Nightmare #6."),

    heading("Overview", 2),
    para("This module establishes the Qlik Cloud workspace and connects to all three MCG data sources. The space architecture separates development, production analytics, and data governance — a best practice for enterprise Qlik deployments."),

    heading("Prerequisites", 2),
    numberedItem(1, "Qlik Cloud tenant provisioned with admin user"),
    numberedItem(2, "API key generated (Profile > API Keys)"),
    numberedItem(3, "All three data sources running (Module 1 complete)"),
    numberedItem(4, "Data Movement Gateway installed (for PostgreSQL CDC)"),
    numberedItem(5, "Data Gateway - Streaming installed (for Kafka streaming)"),

    heading("Gateway & Source Connections: How They Connect", 2),
    para("MCG's databases run locally in the mcg-qlik-dmg container. Qlik Cloud reaches them through a registered Data Movement gateway — a one-time registration, then one connection per source created inside a Data Integration project."),
    para("Register the gateway:"),
    numberedItem(1, "MCG Deploy UI → Local Stack & Gateway → Register Gateway / Get Token (or run agentctl in the mcg-qlik-dmg container) to print the registration token."),
    numberedItem(2, "Qlik Cloud → Administration → Data Gateways → Register; paste the token and wait for status Connected."),
    para("Create the source connections (in a Data Integration project):"),
    numberedItem(1, "Data Integration → your project → Create connection → PostgreSQL / MySQL / SQL Server."),
    numberedItem(2, "Select the mcg-qlik-dmg gateway, enter host/port/database/credentials, then test and save."),
    calloutBox("A Data Movement gateway connection is created in the Data Integration UI by selecting the gateway — the public REST API cannot create it, so the deploy script skips these sources and prints this same guidance instead of a non-functional connection. Kafka as a source needs a Data Gateway - Streaming; S3/Athena are credentialed UI connectors. Full guide: https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Gateways/dm-gateway-setting-up.htm", "info"),

    heading("Demo Methodology: Tell → Show → Tell", 2),
    limbicOpening("MCG had a data engineer who spent 3 days debugging a broken pipeline — only to discover it was feeding the wrong Kafka topic to the wrong team's dashboard. No governance, no separation, no audit trail. That single incident delayed a product launch by two weeks.", "Case Study"),
    interactionPrompt("How do you currently separate development data from production analytics?"),

    heading("Demo Walk-Through", 2),

    tellAnnotation("open", "What I'm about to show you is how Qlik Cloud organizes the entire data landscape — separate spaces for development and production, with connections that handle CDC, streaming, and API sources all from one console."),

    heading("Step 1: Create Spaces", 3),
    numberedItem(1, "Navigate to Qlik Cloud Hub > Spaces > Create Space"),
    numberedItem(2, 'Create shared space: "MCG Demo - Development"'),
    numberedItem(3, 'Create managed space: "MCG Demo - Published"'),
    numberedItem(4, 'Create data space: "MCG Data - Lakehouse" (optional, for data separation)'),
    calloutBox("Talking point: The shared space is where analysts build and iterate. The managed space is where governed, published content lives. This separation ensures data consumers always see approved, quality-checked analytics."),

    heading("Step 2: PostgreSQL Connection", 3),
    numberedItem(1, 'In Data Integration, open your data project and click Create connection'),
    numberedItem(2, "Select the PostgreSQL connector"),
    numberedItem(3, "Select the Data Movement gateway (mcg-qlik-dmg) so Qlik Cloud can reach the local database, then configure:"),
    dataTable(
      ["Setting", "Value"],
      [
        ["Name", "MCG WMS Database"],
        ["Data gateway", "mcg-qlik-dmg (Data Movement)"],
        ["Host", "WMS Postgres as seen from the gateway (Docker service name / host IP)"],
        ["Port", "5432"],
        ["Database", "mcg_wms"],
        ["Username", "mcg_admin"],
        ["Schema", "public"],
      ]
    ),
    numberedItem(4, "Test connection — should succeed and show 3 tables"),
    numberedItem(5, 'Verify tables visible: inventory_positions, warehouse_events, shipments'),
    calloutBox("This connection must be created here in the Data Integration UI with the gateway selected — the public API cannot create a Data Movement gateway connection.", "info"),

    heading("Step 3: Kafka Connection", 3),
    numberedItem(1, "Select Apache Kafka connector via Data Gateway - Streaming"),
    numberedItem(2, "Configure bootstrap servers: localhost:9092 (Docker) or your-broker:9092 (external)"),
    numberedItem(3, "Test connection — should show 2 topics: mcg.iot.cold-chain, mcg.iot.carrier-events"),
    calloutBox("Talking point: Kafka streaming data flows continuously — no batch windows, no stale data. Temperature readings arrive every 5 seconds. This is how you catch a cold chain exceedance before product spoils."),

    heading("Step 4: Meridian CRM Connection", 3),
    numberedItem(1, "Select MySQL CDC connector"),
    numberedItem(2, "Point it at the gateway and supply host, port, database, username and password"),
    numberedItem(3, "Test connection — should show Contact, crm_orders, crm_products"),

    heading("Step 5: Amazon Athena Connection (Analytics Reads)", 3),
    numberedItem(1, "Select Amazon Athena connector — this is how the analytics apps read the Open Lakehouse"),
    numberedItem(2, 'Name it "MCG Lakehouse (Athena)" — the app load scripts LIB CONNECT TO this exact name'),
    numberedItem(3, "Configure region, workgroup, and S3 output location; authenticate with IAM keys"),
    numberedItem(4, "Test connection — the Glue catalog should expose the bronze, silver, and gold databases"),
    calloutBox("Talking point: data flows one way into the Open Lakehouse (CDC, streaming, API), and analytics reads flow back out through Athena — open formats, open engines. The lakehouse is Iceberg on S3, so anything that speaks Athena can query the same governed tables the Qlik apps use.", "info"),

    tellAnnotation("close", "What you just saw is the foundation: governed spaces with clear dev/prod separation, three very different data sources — database CDC, real-time streaming, and API — connected from one console, plus the Athena read path that lets analytics query the Open Lakehouse in place. No custom ETL code, no middleware, no integration tax."),
    interactionPrompt("Which of these connector types would be most relevant for your environment?"),
    valueChain(["Connect all three data source types from one platform", "eliminate the middleware and custom integration layer", "give your data team back the 40% of time they currently spend on plumbing"]),

    heading("Talking Points", 2),
    talkingPoint("Two CDC sources on different engines (PostgreSQL WAL, MySQL binlog) plus a streaming source (Kafka) - one gateway, three capture mechanisms"),
    talkingPoint("Each connector type handles change tracking differently — CDC captures row-level changes, streaming is continuous, API is polling-based"),
    talkingPoint("Data Movement Gateway runs on-premises for secure PostgreSQL access without opening firewall ports"),
    talkingPoint("Space architecture follows Qlik best practices: dev/prod separation with governed publishing"),

    heading("Troubleshooting", 2),
    dataTable(
      ["Issue", "Cause", "Fix"],
      [
        ["Connection test fails", "Firewall blocking port", "Ensure outbound access to data source from Gateway/Engine"],
        ["Gateway not paired", "Pairing token expired", "Generate new token in Administration > Gateways"],
        ["CRM connection fails from the gateway", "Host resolves on your laptop but not inside the gateway container", "Use the compose service name (mysql) or the host IP, and port 3306 inside the network"],
        ["Topics not visible", "Wrong bootstrap server", "Verify broker address and port; check Data Gateway - Streaming logs"],
      ]
    ),
  ];
}

// =============================================================================
// MODULE 3: Open Lakehouse
// =============================================================================
function module03() {
  return [
    heading("Module 3: Open Lakehouse (Bronze / Silver / Gold)"),
    metadataTable([
      ["Duration", "20-30 minutes (setup) / 10 minutes (demo)"],
      ["Checklist Phase", "Phase 3"],
      ["Nightmares", "All 7 (Lakehouse is the integration hub for all data quality remediation)"],
      ["Components", "Open Lakehouse, Data Integration pipelines, Transformation Flows, Table Recipes"],
    ]),

    clarityContext("Project Qlarity Phase 1 → Phase 2: the Open Lakehouse Bronze/Silver foundation (Phase 1) plus the remaining transforms and governed Gold data products (Phase 2 Analytics & Quality). The 8 Silver routes are where all Seven Data Quality Nightmares are systematically remediated."),

    heading("Overview", 2),
    para("The Open Lakehouse is the heart of the MCG demo. It implements the medallion architecture (Bronze/Silver/Gold) where raw data lands, gets cleansed and transformed, and emerges as governed data products. This is where MCG's 7 data quality nightmares get resolved."),
    calloutBox("Key message: Without a Lakehouse, MCG had 3 disconnected data silos. With it, they have a single source of truth with full lineage from raw source to business-ready data product."),
    ...shot("lakehouse-clusters"),
    ...shot("catalog"),

    heading("Bronze Layer: Raw Ingestion (8 Tables)", 2),
    para("Bronze tables contain raw data exactly as it arrives from source systems. No transformations, no cleanup — this preserves the original data for auditability."),
    dataTable(
      ["Source", "Pipeline Type", "Bronze Table", "Refresh"],
      [
        ["PostgreSQL", "CDC (real-time)", "bronze.inventory_positions", "Real-time"],
        ["PostgreSQL", "CDC (real-time)", "bronze.warehouse_events", "Real-time"],
        ["PostgreSQL", "CDC (real-time)", "bronze.shipments", "Real-time"],
        ["Meridian CRM", "MySQL CDC", "bronze.crm_contacts", "15 min"],
        ["Meridian CRM", "MySQL CDC", "bronze.crm_orders", "15 min"],
        ["Meridian CRM", "MySQL CDC", "bronze.crm_products", "15 min"],
        ["Kafka", "Streaming", "bronze.iot_cold_chain", "Real-time"],
        ["Kafka", "Streaming", "bronze.iot_carrier_events", "Real-time"],
      ]
    ),

    heading("Silver Layer: Transformation Routes (8 Flows)", 2),
    para("Silver tables contain cleansed, standardized, deduplicated data. Each transformation route addresses one or more data quality nightmares."),
    dataTable(
      ["Route", "Silver Table", "Nightmare(s)", "Key Transformation"],
      [
        ["Timestamp Normalization", "silver.warehouse_events_clean", "#5", "All timestamps to UTC with per-DC timezone handling"],
        ["Inventory Reconciliation", "silver.inventory_reconciled", "#1, #4", "WMS vs ERP comparison, phantom detection"],
        ["Address Standardization", "silver.addresses_standardized", "#2", "Fuzzy matching, postal code normalization"],
        ["Product Master Harmonization", "silver.products_harmonized", "#3", "SKU resolution, weight/UoM standardization"],
        ["Carrier Canonicalization", "silver.shipments_canonical", "#6", "Multi-language status mapping to MCG codes"],
        ["IoT Normalization", "silver.iot_normalized", "#5, #6", "Celsius normalization, GPS gap detection"],
        ["Supplier Dedup", "silver.suppliers_deduped", "#3", "Fuzzy name matching, canonical ID assignment"],
        ["Order Timeline", "silver.order_delivery_timeline", "#5, #6", "End-to-end order lifecycle assembly"],
      ]
    ),

    heading("Gold Layer: Data Products (2 Tables)", 2),
    para("The pipeline's gold datamart task creates two governed, business-ready data products with Trust Scores, SLAs, and API sharing — one per analytics domain app."),
    dataTable(
      ["Gold Table", "Owner", "Refresh", "Key Metric"],
      [
        ["gold.supply_chain_health",     "Henrik Jansen (VP Warehouse Ops)",    "Daily 06:00 UTC", "IRA target: 97%"],
        ["gold.last_mile_performance",   "Sophie Müller (EU Logistics Mgr)",    "Daily 06:00 UTC", "On-time target: 92%"],
      ]
    ),

    heading("Demo Methodology: Tell → Show → Tell", 2),
    limbicOpening("Last quarter, MCG shipped 4,200 orders with incorrect cold chain documentation. An NVWA inspector found the gap during a routine audit — 15% of perishable items were missing lot numbers entirely. The fine was €350,000. The real cost? Every shipment was frozen for 72 hours while compliance manually traced each item back through three different spreadsheets. The Lakehouse you're about to see was built to make that scenario impossible.", "Problem/Consequence"),
    interactionPrompt("When your team finds a data quality issue, how long does it typically take to trace it back to the source?"),

    heading("Demo Walk-Through", 2),

    tellAnnotation("open", "The Lakehouse implements a medallion architecture — Bronze for raw data, Silver for cleansed data, Gold for business-ready products. What makes this different is that each transformation addresses a specific MCG nightmare. Let me show you how raw, messy data becomes trusted, governed data products."),

    numberedItem(1, "Navigate to Data Integration > Lakehouse > Show Bronze tables receiving data"),
    numberedItem(2, 'Open bronze.inventory_positions — show raw data with quality issues visible (null lot numbers, timestamp mismatches)'),
    numberedItem(3, 'Navigate to a Silver transformation route — show the Pipeline Designer visual flow'),
    numberedItem(4, 'Show before/after: bronze.crm_contacts (messy addresses) vs silver.addresses_standardized (standardized)'),
    numberedItem(5, 'Open a Gold table recipe — show how Silver tables combine into business-ready products'),
    numberedItem(6, 'Highlight refresh schedules: real-time CDC, continuous streaming, 15-min CRM sync, event-triggered silver, plus the daily gold full refresh (06:00 UTC)'),

    heading("Pipelines as Code (Declarative Pipelines — Preview)", 3),
    para("The pipeline you just saw was not built by hand — it is defined as version-controlled YAML in deploy/pipelines/ as two Open Lakehouse projects (mcg-batch-pipeline and mcg-streaming-pipeline) and deployed from the repo. This is the declarative pipelines capability (QTCP preview), and it is the primary deployment method for the entire medallion architecture: landing tasks, transformations, schedules, and bindings."),
    numberedItem(1, "Show the YAML projects in VS Code: qtcp_project.yaml, one folder per task (folder name = task name), datasets with custom SQL, and one schedule per task — event-triggered silver, daily 06:00 UTC gold"),
    numberedItem(2, "Show the deployment — one command drives the whole chain over REST APIs: create connections, import definitions, resolve bindings, prepare, then start every task in dependency order (landing > transform > datamart):"),
    promptBox("npm run deploy", "Terminal Command (with pipelines.prepare + pipelines.run enabled)"),
    numberedItem(3, "Show the deploy web UI toggles on the pipeline page: Prepare, Start tasks, Attach gold datasets to Data Products, Publish to marketplace"),
    numberedItem(4, "Credential-free option — package the project for manual import (Data Integration > your project > Import):"),
    promptBox("npm run pipeline:zip", "Terminal Command"),
    numberedItem(5, "Show the round-trip: refine a transformation in the UI, then export it back to the repo for git versioning"),
    calloutBox("Talking point: Pipelines as code means the medallion architecture is reproducible, reviewable, and versioned. A new tenant goes from empty to a full, running, daily-scheduled bronze/silver/gold pipeline in minutes — and every transformation change has a git history. After the first run, the deploy attaches the gold catalog datasets to their Data Products automatically (Module 5 shows the result). AI assistants can author and validate the YAML directly against the published schemas.", "info"),

    tellAnnotation("close", "What you just saw is raw data arriving from three systems, getting cleansed through 8 transformation routes that directly address MCG's 7 data nightmares, and emerging as two governed Gold data products — each with an owner, an SLA, and a Trust Score. Full lineage at every step."),
    interactionPrompt("Which of these transformation routes — inventory reconciliation, address standardization, carrier canonicalization — resonates most with your current challenges?"),
    valueChain(["Transform raw data through automated quality pipelines", "resolve all 7 data quality nightmares systematically", "deliver trusted Gold data products that the business actually uses for decisions"]),

    heading("Talking Points", 2),
    talkingPoint("Bronze preserves raw data for auditability — you can always go back to the source"),
    talkingPoint("Silver is where the magic happens — 8 transformation routes address all 7 nightmares"),
    talkingPoint("Gold is business-ready: governed, documented, with Trust Scores and SLAs"),
    talkingPoint("Full lineage from source record through every transformation to the Gold product"),
    talkingPoint("Streaming data (Kafka IoT) flows through Bronze and Silver in near-real-time — no batch delays"),
  ];
}

// =============================================================================
// MODULE 4: Lineage, Profiling & Trust Score
// =============================================================================
function module04() {
  return [
    heading("Module 4: Data Lineage, Profiling & Trust Score"),
    metadataTable([
      ["Duration", "8-12 minutes"],
      ["Checklist Phase", "Phase 3b"],
      ["Nightmares", "#1 (Phantom Inventory), #4 (Silent Pipelines)"],
      ["Components", "Data Lineage, Impact Analysis, Data Profiling, Trust Score"],
    ]),

    clarityContext("Project Qlarity Phase 1 (Foundation): pipeline-health monitoring and Trust Score. Lineage, profiling, and a single Trust Score turn Rotterdam's 72-hour silent pipeline failure (Nightmare #4) and phantom inventory (Nightmare #1) into a 5-minute alert."),

    heading("Overview", 2),
    para("This module demonstrates Qlik's governance capabilities: tracing data from source to dashboard (lineage), understanding what breaks when a table changes (impact analysis), automated quality profiling, and Trust Scores that quantify data reliability."),

    heading("Demo Methodology: Tell → Show → Tell", 2),
    limbicOpening("The Rotterdam CDC pipeline failed on a Friday afternoon. Nobody noticed until Monday. By then, 72 hours of inventory data was stale. Three Gold data products showed wrong numbers. Two dashboards were making decisions on phantom data. The Trust Score dropped from 0.89 to 0.31 — but there was no Trust Score back then. There was just a phone call from a very angry VP on Monday morning.", "Discovery Findings"),
    interactionPrompt("When a data pipeline fails silently, how long does it typically take your team to discover it?"),

    heading("Demo Walk-Through", 2),

    tellAnnotation("open", "What I'm about to show you are four governance capabilities that would have caught Rotterdam's failure in minutes, not days: visual lineage, impact analysis, automated profiling, and Trust Scores. These work together as an early warning system for data quality."),

    heading("Step 1: Data Lineage", 3),
    numberedItem(1, "Navigate to gold.supply_chain_health > Lineage"),
    numberedItem(2, "Show the visual lineage graph tracing back through:"),
    para("  Gold table > Silver transformation route > Bronze landing table > PostgreSQL CDC pipeline > Source database", { indent: true }),
    numberedItem(3, "Click on a field (e.g., ira_pct) to show field-level lineage"),
    numberedItem(4, 'Repeat for gold.last_mile_performance — shows the carrier data streaming path'),
    calloutBox("Talking point: When the Rotterdam pipeline failed silently for 72 hours, nobody could trace what was affected. With Qlik lineage, you can see exactly which downstream tables and dashboards depend on any source."),

    heading("Step 2: Impact Analysis", 3),
    numberedItem(1, "Navigate to silver.inventory_reconciled > Impact Analysis"),
    numberedItem(2, "Show downstream dependencies: Gold tables, analytics apps, ML experiments"),
    numberedItem(3, "Explain: if this Silver table breaks, these 3 Gold products go stale, these 2 apps show wrong data"),
    calloutBox("Talking point: Impact analysis answers the question every data engineer dreads: 'If I change this table, what breaks?' Before Qlik, MCG had no way to know."),

    heading("Step 3: Data Profiling", 3),
    numberedItem(1, "Run profiling on bronze.crm_contacts"),
    expectedBox("Profiling should detect: 11% address format inconsistencies, 6% truncated fields (>30 chars), null patterns in postal_code column"),
    numberedItem(2, "Run profiling on bronze.inventory_positions"),
    expectedBox("Should flag: 15% of perishable items have NULL lot_number, timestamp columns have mixed timezone formats"),
    numberedItem(3, "Show profiling on silver.products_harmonized"),
    expectedBox("Should identify: 8,200 products with NULL or zero weight_kg — these are Stewardship candidates"),

    heading("Step 4: Trust Score", 3),
    numberedItem(1, "Navigate to a Gold data product > Trust Score"),
    numberedItem(2, "Show the four dimensions: Validity, Completeness, Discoverability, Usage"),
    numberedItem(3, "Show Trust Score comparison:"),
    dataTable(
      ["Data Domain", "Before Transformation", "After Transformation"],
      [
        ["Inventory", "0.31", "0.89"],
        ["Addresses", "0.42", "0.87"],
        ["Products", "0.55", "0.91"],
      ]
    ),
    numberedItem(4, "Demonstrate Trust Score drop: simulate a pipeline failure scenario for DC-RTD-01"),
    calloutBox("Talking point: Trust Score is the single number that tells you whether you can trust your data. When Rotterdam's pipeline failed, the Trust Score dropped from 0.89 to 0.31 — that's an automatic alert, not a manual discovery 72 hours later."),

    tellAnnotation("close", "What you saw is an automated governance layer: lineage traces every record from source to dashboard, impact analysis shows exactly what breaks when something changes, profiling catches quality issues humans miss, and Trust Score gives you a single number — 0.89 means go, 0.31 means stop. Rotterdam's 72-hour silent failure? Now it's a 5-minute alert."),
    interactionPrompt("If you had a Trust Score for your critical data products today, what would it be? Above 0.7? Below?"),
    valueChain(["See full data lineage and impact analysis automatically", "detect pipeline failures and quality degradation in minutes", "give the business confidence that the numbers they see are the numbers they can trust"]),

    heading("Talking Points", 2),
    talkingPoint("Lineage is automatic — Qlik traces every transformation, every join, every filter"),
    talkingPoint("Impact analysis prevents 'change and pray' — you know what breaks before you change it"),
    talkingPoint("Profiling catches problems humans miss — 11% format issues in 18.4M addresses"),
    talkingPoint("Trust Score turns subjective 'data quality' into an objective, trackable metric"),
  ];
}

// =============================================================================
// MODULE 5: Data Products & API Sharing
// =============================================================================
function module05() {
  return [
    heading("Module 5: Data Products & API Sharing"),
    metadataTable([
      ["Duration", "10-15 minutes"],
      ["Checklist Phase", "Phase 4"],
      ["Nightmares", "All 7 (every nightmare feeds at least one data product)"],
      ["Components", "Data Products, AI-Driven Descriptions, Semantic Types, Validation Rules, API Sharing, Data Marketplace"],
    ]),

    clarityContext("Project Qlarity Phase 2 (Analytics & Quality): the governed Gold data products. Owners, SLAs, Trust Scores, and validation rules that route violations to stewardship are how Qlarity makes the remediation of all Seven Nightmares durable and consumable."),

    heading("Overview", 2),
    para("Gold-layer tables become governed Data Products with owners, SLAs, Trust Scores, and API access. AI automatically generates descriptions and suggests validation rules. The Data Marketplace lets business users discover and request access to data products."),

    heading("Demo Walk-Through", 2),
    ...shot("data-products"),

    heading("Demo Methodology: Tell → Show → Tell", 2),
    limbicOpening("MCG's data engineering team built 23 Gold tables last year. By December, 14 had no documentation, 6 had no owner, and the business didn't know 9 of them existed. Meanwhile, three different teams independently built their own 'customer delivery' datasets — all slightly different, all 'correct.' Data Products turn undiscoverable assets into governed, SLA-backed products with clear ownership.", "Industry Insights"),
    interactionPrompt("How does your organization currently discover and access analytical datasets — is there a catalog, or is it tribal knowledge?"),

    tellAnnotation("open", "I'm going to show you how MCG turns Gold tables into governed Data Products — with AI-generated descriptions, validation rules, Trust Scores, and API sharing. A Data Product is a contract between the data team and the business."),

    heading("Step 1: Register Data Products", 3),
    numberedItem(1, "Navigate to Data Catalog > Data Products > Register"),
    numberedItem(2, 'Register "Supply Chain Health" — assign owner Henrik Jansen, tags: inventory, phantom-inventory, kpi'),
    numberedItem(3, "Click 'Generate Description' to auto-create AI-driven metadata from schema + sample data"),
    numberedItem(4, "Review AI-generated product description and column-level descriptions"),
    numberedItem(5, "Publish descriptions for Data Marketplace discoverability"),
    calloutBox("Talking point: AI-driven descriptions save hours of manual documentation. The AI reads the actual data, understands the schema, and writes descriptions that are grounded in reality — not aspirational."),
    calloutBox("Deployment note: the primary path is npm run deploy — it provisions both data products via the Data Products API, attaches each product's gold dataset from the catalog once the pipeline has run, and (optionally) activates the product in the marketplace. Walk the manual steps above to show the workflow interactively; the API path is what actually deploys the environment.", "info"),

    heading("Step 2: Semantic Types & Validation Rules", 3),
    numberedItem(1, "Navigate to a data product > Schema > Review AI-detected semantic types"),
    para("Examples: dc_id detected as Identifier, ira_pct as Percentage, carrier as Categorical"),
    numberedItem(2, "Review AI-suggested validation rules:"),
    dataTable(
      ["Column", "Suggested Rule", "Type"],
      [
        ["ira_pct", "Value between 0.0 and 1.0", "Range constraint"],
        ["dc_id", "Matches pattern DC-[A-Z]{3}-\\d{2}", "Pattern match"],
        ["pipeline_status", "One of: HEALTHY, DEGRADED, FAILED", "Enum constraint"],
        ["lot_number", "NOT NULL when perishable = TRUE", "Conditional completeness"],
      ]
    ),
    numberedItem(3, "Accept or modify rules — violations automatically route to Stewardship sprints"),

    heading("Step 3: API Sharing", 3),
    numberedItem(1, "Enable API sharing on Supply Chain Health, Last Mile Performance"),
    numberedItem(2, "Show the API endpoint URL for each product"),
    numberedItem(3, "Test with a curl command or Postman request"),
    calloutBox("Talking point: API sharing means these data products aren't locked in Qlik — they feed Discovery Agent, MCP Server, external dashboards, and partner portals. Data products become a service, not just a table."),

    heading("Step 4: Data Marketplace", 3),
    numberedItem(1, "Open the Data Marketplace self-service portal"),
    numberedItem(2, "Browse data products — show AI-generated descriptions and Trust Scores"),
    numberedItem(3, 'Search by tag: "carrier" — should find Last Mile Performance product'),
    numberedItem(4, "Demonstrate access request workflow for a business user"),

    tellAnnotation("close", "What you saw is data as a product: owned, documented, quality-scored, and accessible via API. No more shadow datasets, no more tribal knowledge, no more 'which version of the customer table is right?'"),
    interactionPrompt("If you could expose any of your internal datasets as a governed API tomorrow, which one would create the most value?"),
    valueChain(["Publish governed data products with AI-generated documentation", "eliminate shadow datasets and ensure one version of truth", "let the business self-serve trusted data without filing tickets"]),

    heading("Talking Points", 2),
    talkingPoint("Data Products turn tables into governed, discoverable business assets"),
    talkingPoint("AI descriptions eliminate the documentation bottleneck — metadata is always fresh"),
    talkingPoint("Validation rules enforce quality automatically — violations create Stewardship tasks"),
    talkingPoint("API sharing enables a data mesh architecture — producers publish, consumers subscribe"),
    talkingPoint("The Marketplace is self-service: business users find and request data without filing IT tickets"),
  ];
}

// =============================================================================
// MODULE 6: Analytics Apps (Qlik Analytics)
// =============================================================================
function module06() {
  return [
    heading("Module 6: Analytics Apps (Qlik Analytics)"),
    metadataTable([
      ["Duration", "15-20 minutes"],
      ["Checklist Phase", "Phase 5"],
      ["Nightmares", "All 7 (dashboards visualize every nightmare)"],
      ["Components", "Qlik Analytics, Business Logic, Agentic Analytics, Section Access, MCG Dark Theme"],
    ]),

    clarityContext("Project Qlarity Phase 2 (Analytics & Quality): full analytics on governed data. The inventory and cold-chain dashboards (begun in Phase 1) plus the Executive Cost Impact view quantify all Seven Nightmares; the in-app Qlik Answers preview bridges to Phase 3 conversational AI."),

    heading("Overview", 2),
    para("Two domain-based Qlik Analytics apps bring MCG's data to life: Supply Chain Operations (inventory, cold chain, compliance) and Delivery & Customer Experience (carrier SLAs, WISMO, order tracking). Both use the MCG Dark Theme and connect to Gold-layer data products with streaming IoT data."),

    heading("App 1: MCG Supply Chain Operations", 2),
    dataTable(
      ["Sheet", "Primary Visualization", "Key KPI"],
      [
        ["Inventory Health Overview", "IRA Gauge + Phantom Inventory Bar Chart + DC Map", "IRA target: 97%"],
        ["Cold Chain Monitoring", "Live Temperature Feed (streaming) + GPS Map + Spoilage Scatter", "Exceedance count"],
        ["Product Data Quality", "Completeness KPI + SKU Pie + Supplier Sankey", "Missing weights: 8,200"],
        ["Compliance & Recall", "Trace-Complete Rate + NVWA Risk Table", "Target: 100% trace"],
        ["Executive Cost Impact", "Treemap by Nightmare + Remediation Bullets", "$127M annual impact"],
      ]
    ),

    heading("App 2: MCG Delivery & Customer Experience", 2),
    dataTable(
      ["Sheet", "Primary Visualization", "Key KPI"],
      [
        ["Last Mile Performance", "On-Time by Carrier Bars + Region Map + SLA Combo", "On-time target: 92%"],
        ["Live Shipment Tracking", "Live Status Feed (streaming) + Pipeline Funnel + Exception Monitor", "Active shipments"],
        ["WISMO & Customer Impact", "WISMO Rate by Carrier + Cost KPI + Trend Line", "WISMO rate: 41%"],
        ["Order Timeline", "Waterfall Chart + SLA Heatmap + Late Orders Table", "SLA breach <8%"],
        ["Address Quality Impact", "Scatter Plot + Histogram + Hotspot Map", "Avg quality score"],
      ]
    ),

    heading("Build the Sheets via Qlik MCP (Agentic Authoring)", 2),
    para("The deploy creates both apps empty — each carries only its load script, which reads the pipeline's gold data products and silver datasets from the Open Lakehouse through the Amazon Athena connection. The sheets are then authored conversationally through the Qlik MCP server:"),
    numberedItem(1, "Run the deploy (or the Build Apps page) — apps are created with their QVS load scripts and reloaded against the data products"),
    numberedItem(2, "Open the deploy UI > Build Apps page > Sheet Prompts (Qlik MCP) — one ready-made prompt per sheet, with copy buttons"),
    numberedItem(3, "In Claude (Desktop or Code) with the Qlik MCP server connected (Module 13 covers the setup), paste a prompt:"),
    promptBox("In the Qlik app 'MCG Supply Chain Operations', create a sheet named 'Inventory Health Overview'. Add four KPI objects: 'Inventory Record Accuracy' = Avg([IRA %]) ...", "Ask Claude (Qlik MCP connected)"),
    expectedBox("Claude uses the MCP visualization tools to create the sheet and its objects in the live app, then confirms each object it created. Repeat per sheet — 5 prompts per app, all field names matching the load script."),
    numberedItem(4, "Refine conversationally: 'make the reference line 97%', 'sort the bar chart descending', 'add a filter pane for Storage Zone'"),
    calloutBox("Talking point: this is agentic analytics authoring — the app definition (load script) is code mapped to governed data products, and the presentation layer is built by an AI agent through MCP. Rebuild the sheets any time from the same prompt library: deploy/apps/mcp-sheet-prompts.json.", "info"),

    heading("Demo Methodology: Tell → Show → Tell", 2),
    limbicOpening("Picture this: it's the quarterly business review. The CFO asks, 'What's our real exposure from data quality issues?' Three VPs give three different numbers — $48M, $85M, $127M — because each one pulled from a different dataset. The analytics apps you're about to see give everyone the same number, from the same governed source, in real-time.", "Problem/Consequence"),
    interactionPrompt("How many different dashboards or reports does your leadership team currently look at for operational decisions?"),

    heading("Demo Walk-Through", 2),

    tellAnnotation("open", "I'm going to show you two domain apps built on the Gold data products we just created. The key: every visualization connects to governed data with Trust Scores. And with Agentic Analytics, users can ask questions in natural language — the AI reasons across both structured data and documents."),

    numberedItem(1, "Open MCG Supply Chain Operations app — show MCG Dark Theme (Navy/Teal/Gold)"),
    numberedItem(2, "Inventory Health sheet: point out IRA at 74% for Rotterdam DC (below 97% target)"),
    numberedItem(3, "Cold Chain Monitoring: show live temperature feed updating in real-time from Kafka"),
    numberedItem(4, "Navigate to Executive Cost Impact: show the $127M headline across all 7 nightmares"),
    numberedItem(5, "Switch to MCG Delivery & Customer Experience app"),
    numberedItem(6, "Live Shipment Tracking: show carrier events arriving in real-time, 6 carriers in 5 languages"),
    numberedItem(7, "WISMO sheet: highlight the 41% WISMO rate and $2.30 cost per inquiry"),
    numberedItem(8, "Show Business Logic Vocabulary: natural language queries understand MCG terminology"),

    heading("Agentic Analytics (Qlik Answers in App)", 3),
    numberedItem(1, "Open the Qlik Answers conversational interface within the app"),
    promptBox("Show inventory accuracy by distribution center", "Natural Language Query"),
    expectedBox("Returns a bar chart of IRA by DC with Rotterdam DC highlighted in red at 74%, narrative explanation of the variance"),
    numberedItem(2, "Test multi-step reasoning:"),
    promptBox("Which carriers miss SLAs most in APAC and what does the contract say about penalties?", "Natural Language Query"),
    expectedBox("Combines structured data (SLA metrics from gold.last_mile_performance) with unstructured contract text from knowledge base. Shows NinjaVan at 69% on-time in Singapore with AMD3 reclassification context."),

    heading("Talking Points", 2),
    tellAnnotation("close", "Two apps, 10 sheets, one version of truth. Every KPI traces back to a governed Gold data product. The Agentic Analytics layer lets anyone ask questions in plain language and get answers that combine real data with document context. No more 'which number is right?' — it's the same number everywhere."),
    interactionPrompt("What if your team could ask a question like 'why did Singapore SLA drop?' and get an answer that includes both the data and the contract context?"),
    valueChain(["Visualize operational and customer data in real-time from governed sources", "give every stakeholder the same trusted numbers", "let business users self-serve insights through conversational AI instead of filing dashboard requests"]),

    talkingPoint("Two apps cover the entire supply chain: operations (internal) and delivery (customer-facing)"),
    talkingPoint("Streaming sheets show live IoT data — not stale batch reports"),
    talkingPoint("MCG Dark Theme provides consistent, professional branding across all analytics"),
    talkingPoint("Agentic Analytics blends structured data with document intelligence — one question, complete answer"),
    talkingPoint("Section Access ensures regional VPs see only their DCs; carrier partners see only their shipments"),
  ];
}

// =============================================================================
// MODULE 7: Native Alerting & Reporting
// =============================================================================
function module07() {
  return [
    heading("Module 7: Native Alerting & Reporting"),
    metadataTable([
      ["Duration", "8-10 minutes"],
      ["Checklist Phase", "Phase 5b"],
      ["Nightmares", "#1 (Phantom Inventory), #4 (Silent Pipelines), #6 (Carrier Data Black Hole)"],
      ["Components", "Native Data Alerts, Reporting Service (PixelPerfect, Tabular)"],
    ]),

    clarityContext("Project Qlarity Phase 1 (Foundation): pipeline-health monitoring made proactive. Threshold alerts catch Nightmare #4 (Silent Pipeline Failures) and #1 (Phantom Inventory) in minutes, while scheduled compliance reports pre-compile the traceability data behind Nightmare #7."),

    heading("Overview", 2),
    para("Native alerts push notifications when data crosses thresholds — no automation needed. The Reporting Service generates formatted PDF and Excel reports on schedule or on-demand, ensuring stakeholders who don't log into Qlik still get the information they need."),

    heading("Demo Methodology: Tell → Show → Tell", 2),
    limbicOpening("The Rotterdam failure was discovered 72 hours late — by a human who happened to notice stale numbers. The São Paulo cold chain spoilage was discovered by a customer who opened a box of spoiled food. The NVWA citation arrived by registered mail. Every one of these incidents could have been an alert instead of a crisis.", "Discovery Findings"),
    interactionPrompt("When a KPI crosses a critical threshold, how quickly does the right person find out today?"),

    heading("Demo Walk-Through: Alerts", 2),

    tellAnnotation("open", "I'll show you two proactive capabilities: native alerts that push notifications when data crosses thresholds, and formatted reports that deliver compliance data on schedule. The key: data finds the stakeholder — they don't have to go looking for it."),

    numberedItem(1, "Navigate to MCG Supply Chain Operations app > Alerts"),
    numberedItem(2, 'Create alert: "IRA Below 85%" — triggers when IRA drops below 85% for any DC'),
    numberedItem(3, 'Create alert: "Cold Chain Exceedance" — triggers when temperature > 8 C for 15+ minutes'),
    numberedItem(4, "Switch to Delivery app > Create alert: 'WISMO Rate Spike' — triggers when WISMO > 40%"),
    numberedItem(5, "Configure notification: web + email (push if mobile app installed)"),
    numberedItem(6, "Share alerts with relevant team members"),
    numberedItem(7, "Test: simulate a pipeline failure and show the alert trigger"),
    calloutBox("Talking point: These alerts would have caught the Rotterdam pipeline failure in minutes, not 72 hours. IRA dropping from 97% to 74% triggers instantly."),

    heading("Demo Walk-Through: Reporting", 2),
    numberedItem(1, "Navigate to Reporting > Create Template"),
    numberedItem(2, 'Create PixelPerfect report: "Weekly Compliance Summary" (PDF, banded layout)'),
    numberedItem(3, 'Create Tabular report: "Daily Inventory Summary" (Excel export by DC)'),
    numberedItem(4, "Configure subscription: compliance PDF emailed weekly (Monday 08:00)"),
    numberedItem(5, "Test on-demand: user sets selections in app, clicks download > formatted PDF"),
    calloutBox("Talking point: The compliance team needed 11 days to compile traceability data for the lettuce recall. With scheduled reports, that data is pre-compiled and emailed every Monday."),

    heading("Talking Points", 2),
    tellAnnotation("close", "Alerts turn reactive incident response into proactive data-driven notification. Reports reach stakeholders who never log into a dashboard. Together, they close the gap between 'data exists' and 'the right person acts on it.'"),
    valueChain(["Set threshold-based alerts on any KPI", "catch pipeline failures and quality issues in minutes", "prevent the next Rotterdam from becoming a 72-hour silent crisis"]),

    talkingPoint("Alerts are proactive — they find you, you don't have to go looking for problems"),
    talkingPoint("No code required — business users create alerts on any KPI with threshold rules"),
    talkingPoint("Reporting reaches stakeholders who don't use Qlik — formatted PDFs and Excel files"),
    talkingPoint("On-demand reports respect app selections — drill down, then export exactly what you see"),
  ];
}

// =============================================================================
// MODULE 8: Qlik Predict (AutoML)
// =============================================================================
function module08() {
  return [
    heading("Module 8: Qlik Predict (AutoML)"),
    metadataTable([
      ["Duration", "10-12 minutes"],
      ["Checklist Phase", "Phase 6"],
      ["Nightmares", "#2 (Address Catastrophe), #6 (Carrier Data Black Hole)"],
      ["Components", "Qlik Predict (AutoML experiments, model deployment, API sharing)"],
    ]),

    clarityContext("Project Qlarity Phase 2 (Analytics & Quality): AutoML spoilage prediction. The Cold Chain Exceedance model is Qlarity's spoilage predictor (it would have flagged the TransFrio fleet change, Nightmare #6); the Late Delivery model links tracking and address gaps (Nightmare #2) to SLA outcomes."),

    heading("Overview", 2),
    para("Two AutoML models predict real-world outcomes from MCG data: a Cold Chain Exceedance (spoilage risk) model and a Late Delivery (SLA) model. Both train on the silver datasets the declarative pipelines land in the Open Lakehouse — picked straight from the catalog (read via the Athena/lakehouse layer), so the training data carries the same lineage and Trust Score as everything else — and deploy with API access."),

    heading("Demo Methodology: Tell → Show → Tell", 2),
    limbicOpening("Last quarter, TransFrio quietly swapped in 12 older trucks on the São Paulo→Buenos Aires route. Nobody noticed until spoilage spiked from 2.1% to 8.8% — $2.48M in losses. The spoilage predictor you're about to see would have flagged the risk shift the moment the new truck data started flowing in.", "Case Study"),
    interactionPrompt("Does your team currently use any predictive models for operational risk, or is it mostly reactive?"),

    heading("Model 1: Cold Chain Exceedance (Spoilage Risk)", 2),
    metadataTable([
      ["Data Source", "silver.iot_normalized — streaming pipeline output in the Open Lakehouse (catalog dataset)"],
      ["Target Variable", "alert_flag (binary classification — temperature exceedance)"],
      ["Key Features", "temperature_c, humidity_pct, battery_level_pct, battery_low, gps_gap, shock_detected, light_exposure, sensor_unregistered, route_id, warehouse_id"],
      ["Business Value", "Predict which in-transit readings will breach the cold chain before product spoils"],
      ["Nightmare", "#6 — Carrier Data Black Hole (TransFrio fleet change undetected)"],
    ]),

    heading("Demo Walk-Through: Exceedance Model", 3),
    numberedItem(1, "Navigate to Qlik Predict > Create Experiment"),
    numberedItem(2, "Select data source from the catalog: silver.iot_normalized (landed by the MCG Streaming Pipeline)"),
    numberedItem(3, "Select target: alert_flag (binary classification)"),
    numberedItem(4, "Review auto-selected features — note temperature_c, battery_low, and route_id as top predictors"),
    numberedItem(5, "Train model — show AutoML trying multiple algorithms"),
    numberedItem(6, "Review results: feature importance chart"),
    calloutBox("Key insight: route_id = GRU-BA appears as a top predictor alongside battery_low. The model learned that the Sao Paulo to Buenos Aires route runs 4x the exceedance rate — because TransFrio replaced 6 trucks with new Thermo King X4 7500 units that require a different startup procedure, and their sensors run hot and low on battery.", "warning"),
    numberedItem(7, "Deploy best model to production"),
    numberedItem(8, "Test prediction on a live GRU-BA reading:"),
    expectedBox("Exceedance probability: 78%. Contributing factors: temperature_c = 11.2 (threshold 8), battery_level_pct = 9 (battery_low = true), route_id = GRU-BA-001, gps_gap = false"),

    heading("Model 2: Late Delivery (SLA) Predictor", 2),
    metadataTable([
      ["Data Source", "silver.order_delivery_timeline — order-grain dataset in the Open Lakehouse (batch pipeline)"],
      ["Target Variable", "delivered_late (binary classification)"],
      ["Key Features", "carrier_code, fulfillment_method, tracking_missing, delivery_attempts, exception_code, order_date (auto date features: month, weekday)"],
      ["Business Value", "Predict which orders will deliver late at the moment they ship"],
      ["Nightmare", "#2 / #6 — tracking gaps and carrier reclassification predict lateness"],
    ]),

    heading("Demo Walk-Through: SLA Model", 3),
    numberedItem(1, "Create new experiment with silver.order_delivery_timeline from the catalog"),
    numberedItem(2, "Target: delivered_late (classification)"),
    numberedItem(3, "Train and review feature importance"),
    calloutBox("Key insight: tracking_missing is the #2 predictor (after carrier_code). Orders with no tracking number deliver late far more often — the data gap itself predicts the failure. For richer features, create an Athena view over the lakehouse joining avg address quality per contact (silver.addresses_standardized) into the timeline and retrain — address quality then surfaces as a top-3 predictor, directly linking Nightmare #2 to outcomes.", "warning"),
    numberedItem(4, "Test prediction: NINJAVAN order, standard fulfillment, tracking number missing"),
    expectedBox("Late-delivery probability: 81%. Factors: carrier_code = NINJAVAN (69% on-time post AMD3 reclassification), tracking_missing = true, fulfillment_method = STANDARD, order weekday = Friday"),

    tellAnnotation("close", "Two no-code ML models trained on the Open Lakehouse silver datasets: one predicts cold-chain exceedance from live IoT readings, the other predicts late delivery at ship time. Both revealed insights MCG didn't expect — a missing tracking number is the #2 predictor of a late delivery. And both are API-shareable, so predictions flow into dashboards and automations automatically."),
    interactionPrompt("What operational outcome would be most valuable for your team to predict — quality issues, delivery failures, or something else?"),
    valueChain(["Train predictive models on governed data without writing code", "predict operational risks before they become incidents", "shift from reactive firefighting to proactive risk management"]),

    heading("Talking Points", 2),
    talkingPoint("AutoML requires no data science expertise — select a target, Qlik does the rest"),
    talkingPoint("Models train on the Open Lakehouse silver datasets straight from the catalog — same Trust Score, same lineage as the data products"),
    talkingPoint("Feature importance reveals business insights: route, battery health, and tracking gaps predict outcomes"),
    talkingPoint("API sharing lets predictions flow into dashboards, automations, and agent responses"),
    talkingPoint("The spoilage model would have flagged the TransFrio problem on Day 1 of the fleet change"),
  ];
}

// =============================================================================
// MODULE 9: Qlik Answers
// =============================================================================
function module09() {
  return [
    heading("Module 9: Qlik Answers (Knowledge Base & AI Assistant)"),
    metadataTable([
      ["Duration", "12-15 minutes"],
      ["Checklist Phase", "Phase 7"],
      ["Nightmares", "#1, #2, #4, #6, #7 (Answers references documents about each)"],
      ["Components", "Qlik Answers, Knowledge Base, AI Assistant, Knowledge Mart"],
    ]),

    clarityContext("Project Qlarity Phase 3 (AI & Conversational): Qlik Answers over structured data plus documents. This is Qlarity's knowledge layer — cited, traceable answers across the 25 operational documents, including the Project Qlarity business case itself."),

    heading("Overview", 2),
    para("Qlik Answers provides AI-powered natural language access to MCG's 25 operational documents — SOPs, incident reports, policies, carrier contracts, and the Project Qlarity brief. The AI assistant understands context, cites sources, and connects structured data with unstructured knowledge."),

    heading("Prerequisites", 2),
    numberedItem(1, "All 25 DOCX documents uploaded to documents/ directory"),
    numberedItem(2, "Knowledge base created and indexed (allow 5-10 minutes for 25 documents)"),
    numberedItem(3, "Assistant configured with conversation starters"),

    heading("Setup", 2),
    numberedItem(1, 'Navigate to Qlik Answers > Knowledge Bases > Create: "MCG Operations Knowledge Base"'),
    numberedItem(2, "Add datasource > Upload files > Select all 25 .docx files from documents/"),
    numberedItem(3, "Wait for indexing to complete (status bar shows progress)"),
    numberedItem(4, 'Create assistant: "MCG Operations Assistant"'),
    numberedItem(5, "Link to knowledge base, add 5 conversation starters"),

    heading("Demo Methodology: Tell → Show → Tell", 2),
    limbicOpening("When the lettuce recall hit, the compliance team spent 11 days manually searching through SOPs, supplier contracts, and incident reports across 4 different systems. EU regulation requires 24-hour traceability. Imagine if they could have simply asked, 'What happened with the lettuce recall and who was the supplier?' and gotten a sourced, cited answer in 30 seconds.", "Problem/Consequence"),
    interactionPrompt("When your team needs to find information across operational documents — SOPs, contracts, policies — how long does it typically take?"),

    tellAnnotation("open", "I'm going to ask the AI assistant 6 real questions about MCG operations — each one pulls from specific documents, cites its sources, and connects the dots across multiple reports. Watch for the citations — every answer is traceable."),

    heading("Demo Scenarios", 2),

    heading("Scenario 1: Singapore SLA Decline", 3),
    clarityContext("Project Qlarity Phase 3: conversational access to carrier knowledge (Nightmare #6, Carrier Data Black Hole)."),
    promptBox("Why did Singapore delivery promise accuracy drop to 69%?", "Ask Qlik Answers"),
    expectedBox("References CARRIER-NV-2025 (NinjaVan AMD3 reclassification effective October 1). Explains: 5-10 kg parcels reclassified from 2-day to 3-day delivery. MCG website was not updated for 3 weeks. 14,000 customers/month affected. Also references MCG-POL-020 (Delivery Promise Policy) for the contractual obligations."),
    para("Follow-up: 'What should we do about it?'"),

    heading("Scenario 2: Rotterdam Pipeline Failure", 3),
    clarityContext("Project Qlarity Phase 1 made queryable in Phase 3: pipeline-health monitoring behind Nightmare #4 (Silent Pipeline Failures) and the phantom inventory of Nightmare #1."),
    promptBox("What happened at Rotterdam DC in September 2025?", "Ask Qlik Answers"),
    expectedBox("References INC-2025-04872: WMS-to-SAP CDC sync stopped for 72 hours due to expired TLS certificate. Created 847 phantom inventory units across 143 SKUs. Cost: EUR 30,500 in emergency transfers. References TRN-2025-001 for the remediation training guide."),
    para("Follow-up: 'How are we preventing this from happening again?'"),

    heading("Scenario 3: Lettuce Recall Investigation", 3),
    clarityContext("Project Qlarity Phase 3 closing the loop on Nightmare #7 (Compliance Traceability Gap) — 11-day, four-system traceability collapses to a cited 30-second answer."),
    promptBox("How long did the lettuce recall take and what was the root cause?", "Ask Qlik Answers"),
    expectedBox("References RCL-2025-003: Listeria detected in organic butter lettuce from backup farm FARM-NL-0042. Full traceability took 11 days across 4 disconnected systems. EU regulation requires 24 hours. Affected 210 stores. NVWA citation NVWA-2025-CIT-04412 issued with 5 findings."),

    heading("Scenario 4: Cold Chain Spoilage", 3),
    clarityContext("Project Qlarity Phase 3 narrating the outcome the Phase 2 AutoML spoilage model predicts — the TransFrio fleet change behind Nightmare #6 (Carrier Data Black Hole)."),
    promptBox("What caused the $2.48M spoilage on the Sao Paulo-Buenos Aires route?", "Ask Qlik Answers"),
    expectedBox("References INC-2025-05102: TransFrio replaced 6 trucks with new Thermo King X4 7500 refrigeration units. Drivers were not retrained on the new startup procedure (requires pressing and holding START for 3 seconds). Temperature exceedance rate spiked from 2.1% to 8.8%. References TRN-2025-002 for the correct procedure."),
    para("Follow-up: 'What is the correct startup procedure for the Thermo King X4 7500?'"),

    heading("Scenario 5: WISMO Call Handling", 3),
    clarityContext("Project Qlarity Phase 3: WISMO deflection — surfacing the SOP behind the carrier visibility gap (Nightmare #6) so customers self-serve instead of calling."),
    promptBox("What is the procedure for handling a Where Is My Order call?", "Ask Qlik Answers"),
    expectedBox("References SOP-CS-001: 4-step WISMO procedure. Step 1: Verify customer identity. Step 2: Check carrier tracking system. Step 3: Provide estimated delivery window. Step 4: Escalate if delivery is 48+ hours overdue. Cross-references carrier contact information."),

    heading("Scenario 6: Project Qlarity ROI", 3),
    clarityContext("The capstone question — Project Qlarity itself: the $12.4M / 24-month initiative across all three phases that eliminates all Seven Data Quality Nightmares for a 952% 3-year ROI."),
    promptBox("What is Project Qlarity and what is the expected return on investment?", "Ask Qlik Answers"),
    expectedBox("References PROJ-CLARITY-2025: $12.4M Qlik platform investment. Conservative annual benefit: $52.7M. 3-year ROI: 952%. Covers all 7 data quality nightmares. Phase 1 (Integration Foundation) starts Q1 2026. Each nightmare has a specific remediation workstream with cost savings quantified."),

    tellAnnotation("close", "Six questions, six instant answers, all sourced and cited from MCG's actual operational documents. The lettuce recall investigation that took 11 days? Qlik Answers gives you the supplier, the incident ID, the NVWA findings, and the remediation steps in 30 seconds. And it connects structured data with document intelligence for complete answers."),
    interactionPrompt("Which of those scenarios — the recall investigation, the carrier SLA issue, or the cold chain spoilage — is closest to a situation your team has faced?"),
    valueChain(["Ask natural language questions across all operational documents", "get cited, traceable answers in seconds instead of days", "empower every team member to access institutional knowledge without being an expert"]),

    heading("Talking Points", 2),
    talkingPoint("Qlik Answers is grounded in MCG's actual documents — not generic AI hallucinations"),
    talkingPoint("Every answer cites specific documents with reference IDs (INC-*, SOP-*, RCL-*)"),
    talkingPoint("Follow-up questions maintain context — the assistant remembers what you were asking about"),
    talkingPoint("Knowledge Mart keeps Answers grounded in fresh data — not stale snapshots"),
    talkingPoint("Agentic Analytics combines structured data (from Qlik engine) with document intelligence (from Answers) in a single conversational interface"),
  ];
}

// =============================================================================
// MODULE 10: Stewardship
// =============================================================================
function module10() {
  return [
    heading("Module 10: Qlik Stewardship"),
    metadataTable([
      ["Duration", "8-10 minutes"],
      ["Checklist Phase", "Phase 8"],
      ["Nightmares", "#2 (Address), #3 (Product Master), #7 (Compliance)"],
      ["Components", "Qlik Stewardship sprints, human-in-the-loop data quality"],
    ]),

    clarityContext("Project Qlarity Phase 2 (Analytics & Quality): the human-in-the-loop stewardship layer. The four sprints finish what automation can't — address standardization (Nightmare #2), supplier dedup / product master (Nightmare #3), and lot-number compliance (Nightmare #7)."),

    heading("Overview", 2),
    para("Some data quality issues can't be fixed algorithmically — they need human judgment. Stewardship sprints route ambiguous records to domain experts for review: fuzzy address matches, duplicate suppliers, missing product weights, and compliance gaps. This is human-in-the-loop data quality at scale."),

    heading("The 4 Sprints", 2),

    heading("Sprint 1: Address Cleanup", 3),
    metadataTable([
      ["Source", "The UNRESOLVED branch of mcg_crm_address_validate_bulk — rows the bulk geocoder could not resolve to GPS"],
      ["Records", "~640 addresses (3.2% of 20,000 customer records)"],
      ["Assignee", "Customer Data Team (Sophie Muller)"],
      ["Task Type", "Correct the address so it can be geocoded"],
      ["Nightmare", "#2 — Address Catastrophe"],
    ]),
    ...shot("deploy-ui-stewardship"),
    calloutBox("The sprint is created from code, not clicks: npm run stewardship:sprint. It must live in a DATA space — creating one in a shared or managed space returns 403 NOT_ALLOWED_TO_CREATE_SPRINT, which is the product enforcing the rule rather than a permissions gap. The 12-column record schema is defined in deploy/stewardship.js.", "info"),
    para('Example task: "Can this address be corrected so it geocodes?"'),
    dataTable(
      ["Field", "Record A", "Record B"],
      [
        ["Name", "Jan de Vries", "Jan De Vries"],
        ["Address", "Keizersgracht 482, Apartment 4B, 1017 EJ", "Keizersgracht 482, Apt 4B, 1017EJ"],
        ["Match Confidence", "88%", ""],
      ]
    ),

    heading("Sprint 2: Supplier Deduplication", 3),
    metadataTable([
      ["Source", "silver.suppliers_deduped (fuzzy match candidates)"],
      ["Records", "~80 supplier groups with 2-4 potential duplicates each"],
      ["Assignee", "Procurement Team (Thomas Berger)"],
      ["Task Type", "Confirm match / reject match"],
      ["Nightmare", "#3 — Product Master Mess"],
    ]),

    heading("Sprint 3: Missing Product Weights", 3),
    metadataTable([
      ["Source", "silver.products_harmonized (weight_kg IS NULL or = 0)"],
      ["Records", "8,200 products with missing weight data"],
      ["Assignee", "Product Data Team"],
      ["Task Type", "Fill in missing values from source documents"],
      ["Nightmare", "#3 — Product Master Mess"],
    ]),

    heading("Sprint 4: Lot Number Compliance", 3),
    metadataTable([
      ["Source", "silver.inventory_reconciled (perishable = TRUE AND lot_number IS NULL)"],
      ["Records", "15% of perishable grocery items (~2,400 records)"],
      ["Assignee", "Warehouse Supervisors / Quality Team"],
      ["Task Type", "Assign lot number from physical inventory"],
      ["Nightmare", "#7 — Compliance Traceability Gap"],
    ]),

    heading("Demo Methodology: Tell → Show → Tell", 2),
    limbicOpening("MCG's data quality team estimated that 18.4 million customer address records needed review. Impossible to automate — a machine can normalize formatting, but only a human can decide whether '123 Keizersgracht' and '123-A Keizersgracht Apt 2' are the same customer. Stewardship puts domain experts in the loop for the decisions that require human judgment.", "Illustrative Analogy"),
    interactionPrompt("When you find data quality issues that can't be fixed automatically, what's your current process — spreadsheets? Email chains?"),

    heading("Demo Walk-Through", 2),

    tellAnnotation("open", "I'll show you four sprints that assign data quality tasks to the people who actually understand the data — logistics experts for addresses, procurement for suppliers, warehouse supervisors for lot numbers. Each task has context, comparison views, and one-click resolution."),

    numberedItem(1, "Navigate to Data Integration > Data stewardship (the product route is literally /data-integration/sprints)"),
    ...shot("stewardship-sprints"),
    numberedItem(2, "Open the Address Cleanup sprint — show the task list"),
    numberedItem(3, "Open an address record — the raw fields are visible but locked, the repaired fields are editable, and reason says why the job gave up"),
    numberedItem(4, "Correct the address and submit"),
    numberedItem(5, "Show the sprint dashboard: tasks completed, pending, accuracy trend"),
    numberedItem(6, "Open Missing Weights sprint — show the bulk review interface"),
    numberedItem(7, "Explain: corrections are picked up by MCG Address Correction — Talend Job Trigger (Module 12), which hands them to mcg_crm_address_validate_bulk to re-process"),

    heading("Talking Points", 2),
    tellAnnotation("close", "Four sprints, four different domain teams, one unified workflow. The key: corrections approved in Stewardship flow back through the Lakehouse automatically. This is a closed-loop data quality cycle — not a one-time cleanup but a continuous improvement process."),
    valueChain(["Assign data quality tasks to domain experts who understand the data", "resolve quality issues that automation can't handle", "continuously improve data quality instead of accepting the $3.1M annual cost of bad carrier delivery failures"]),

    talkingPoint("Not everything can be automated — Stewardship puts humans in the loop where judgment matters"),
    talkingPoint("Domain experts review data quality issues they actually understand (logistics people for addresses, procurement for suppliers)"),
    talkingPoint("Sprint dashboards show progress — management sees task completion rates"),
    talkingPoint("Approved corrections feed back into the Lakehouse — the closed-loop data quality cycle"),
    talkingPoint("The alternative is ignoring these issues — $3.1M/year in carrier delivery failures from bad addresses, plus $14.8M in WISMO call costs. The full Address Catastrophe is $31M once you include customer churn"),
  ];
}

// =============================================================================
// MODULE 11: Business Glossary
// =============================================================================
function module11() {
  return [
    heading("Module 11: Business Glossary"),
    metadataTable([
      ["Duration", "5-8 minutes"],
      ["Checklist Phase", "Phase 9"],
      ["Nightmares", "All 7 (glossary defines terminology for each)"],
      ["Components", "Business Glossary, term definitions, data product linkage"],
    ]),

    clarityContext("Project Qlarity Phase 2 (Analytics & Quality): the shared-vocabulary backbone. A single agreed definition for every term — phantom inventory, Trust Score, WISMO — links each of the Seven Nightmares to the data products and stewardship sprints that resolve it."),

    heading("Overview", 2),
    para("The Business Glossary provides a single source of truth for MCG terminology. When someone says 'phantom inventory', everyone means the same thing. Terms link to data products, datasets, and nightmares — creating a connected governance layer across the platform."),

    heading("Term Categories", 2),
    dataTable(
      ["Category", "Example Terms", "Count"],
      [
        ["Inventory & Warehouse", "Phantom Inventory, IRA, Cycle Count, Stock-Out", "5 terms"],
        ["Supply Chain & Logistics", "Cold Chain Exceedance, SLA Breach, WISMO, On-Time Delivery", "5 terms"],
        ["Data Quality & Governance", "Trust Score, Data Product, Table Recipe, CDC, Bronze/Silver/Gold", "5 terms"],
        ["Compliance & Regulatory", "NVWA, Lot Number, Traceability, EC 178/2002, Farm-to-Shelf", "5 terms"],
        ["Business Operations", "Distribution Center, Carrier Canonical Status, Address Quality Score", "5 terms"],
      ]
    ),

    heading("Demo Methodology: Tell → Show → Tell", 2),
    limbicOpening("In an MCG leadership meeting, the VP of Warehouse said 'phantom inventory is down 12%' while the CFO said 'phantom inventory is up 8%.' They were both right — they were using different definitions. The warehouse measures by SKU count; finance measures by dollar value. The glossary ensures everyone means the same thing when they use the same term.", "Discovery Findings"),

    heading("Demo Walk-Through", 2),
    numberedItem(1, "Navigate to Business Glossary > Browse"),
    numberedItem(2, 'Search for "Phantom Inventory"'),
    numberedItem(3, "Show the term definition, owner (Henrik Jansen), related datasets, related nightmare (#1)"),
    numberedItem(4, 'Search for "Trust Score" — show the governance-specific definition and how it links to data products'),
    numberedItem(5, "Show linked data products: click through from the glossary term to the data product and vice versa"),
    numberedItem(6, "Demonstrate: a new analyst can understand MCG's data landscape through the glossary alone"),

    heading("Talking Points", 2),
    talkingPoint("Shared vocabulary eliminates misunderstandings — 'phantom inventory' means the same thing to everyone"),
    talkingPoint("Terms link to data products, creating a connected knowledge graph"),
    talkingPoint("The glossary is a living document — it evolves as the data landscape changes"),
    talkingPoint("New team members can onboard through the glossary instead of tribal knowledge"),
  ];
}

// =============================================================================
// MODULE 12: Automations
// =============================================================================
function module12() {
  return [
    heading("Module 12: Qlik Application Automations"),
    metadataTable([
      ["Duration", "10-15 minutes"],
      ["Checklist Phase", "Phase 10"],
      ["Nightmares", "#4 (Silent Pipelines), #6 (Carrier Data Black Hole)"],
      ["Components", "Qlik Application Automation, Microsoft Teams, Talend Job trigger"],
    ]),

    clarityContext("Project Qlarity Phase 1 → Phase 2: turning monitoring into action. The pipeline-health summary and cold-chain alert operationalize Phase 1 monitoring (Nightmares #4 and #6), while the Stewardship → Talend → Lakehouse correction loop closes Phase 2 data-quality remediation."),

    heading("Overview", 2),
    para("Automations close the loop between data quality detection and action. When a cold chain exceedance is detected, an alert fires to Teams. When a pipeline fails, the engineering team is notified. When a steward corrects an address, the correction is surfaced for the Talend job to apply. No manual intervention required."),
    calloutBox("All five automations are deployed with real block graphs and run green — they are not templates. The graphs are authored from version-controlled code by npm run automations:workspaces, which also creates the API Key connection they need. Verify with a Run now on any of them.", "success"),

    heading("The 5 Automations", 2),
    ...shot("automations-list"),
    dataTable(
      ["Automation", "Trigger", "Action", "Target"],
      [
        ["Daily App Reload", "Schedule: 06:00 UTC", "Reload both analytics apps", "Qlik Analytics"],
        ["Cold Chain Alert", "Every 5 min: temp > 8 C for 15+ min", "Post Adaptive Card to Teams", "#mcg-cold-chain-alerts"],
        ["Pipeline Health Summary", "Schedule: 07:00 UTC daily", "Post health summary to Teams", "#mcg-data-engineering"],
        ["Stewardship Sprint Summary", "Schedule: 07:00 UTC daily", "Read the Address Cleanup sprint summary", "Run title / digest"],
        ["Address Correction — Talend Job Trigger", "Schedule (every 30 min)", "Read steward-corrected records from the Address Cleanup sprint", "Hand-off to mcg_crm_address_validate_bulk"],
      ]
    ),

    heading("Demo Methodology: Tell → Show → Tell", 2),
    limbicOpening("The São Paulo spoilage cost $2.48M, but the real failure wasn't the temperature — it was the response time. The IoT system detected the exceedance. But the alert went to an email inbox nobody checks on weekends. By Monday, the product was in stores. Automation ensures the right action happens immediately, every time, without a human remembering to check.", "Problem/Consequence"),
    interactionPrompt("When a critical operational event happens, how many manual steps are between detection and action in your current process?"),

    heading("Demo Walk-Through", 2),

    tellAnnotation("open", "I'll walk through 5 no-code automations that close the loop between detection and action. The cold chain alert is the flagship: when temperature exceeds threshold, a Teams message with full context goes to the right team within 5 minutes. No email, no manual check, no weekend gaps."),

    heading("Cold Chain Alert (Primary Demo)", 3),
    numberedItem(1, "Navigate to Automations > MCG Cold Chain Alert > Edit"),
    numberedItem(2, "Walk through the 5 automation blocks:"),
    para("  Block 1: Query silver.iot_normalized for unalerted exceedances", { indent: true }),
    para("  Block 2: Condition check — any results?", { indent: true }),
    para("  Block 3: Loop over each exceedance record", { indent: true }),
    para("  Block 4: Post Adaptive Card to Teams channel", { indent: true }),
    para("  Block 5: Update alert_sent flag to prevent duplicates", { indent: true }),
    numberedItem(3, "Show the Adaptive Card template: shipment ID, carrier, route, temperature, estimated loss"),
    numberedItem(4, "Click 'Run Now' to test"),
    expectedBox("Teams channel receives an Adaptive Card showing a temperature exceedance with shipment details, estimated $ exposure, and links to the Qlik Analytics dashboard and SOP document."),

    heading("Address Correction Loop (Advanced)", 3),
    ...shot("automation-address-correction"),
    numberedItem(1, "Show the Stewardship-to-Talend-to-Lakehouse loop:"),
    para("  Steward corrects an address in the Address Cleanup sprint > the automation reads the corrected records > mcg_crm_address_validate_bulk re-runs them and writes the GPS-resolved rows to S3 > they land in the Iceberg table silver.addresses_geocoded > the silver transform joins them onto silver.addresses_standardized > Gold refreshes > the Predict model improves", { indent: true }),
    calloutBox("Why the automation surfaces records rather than consuming them: consuming a record means ‘this correction is handled’, and at that point in the flow Talend has not applied it yet. Acknowledging first would let a Talend failure silently lose a steward’s work, so the Talend job owns the consume call. The block is present in the graph but deliberately disabled.", "info"),
    calloutBox("Talking point: This is the closed-loop data quality cycle. Detection (profiling) > Notification (alert) > Review (stewardship) > Correction (Talend job) > Validation (Trust Score). Fully automated except the human judgment step."),

    heading("Talking Points", 2),
    tellAnnotation("close", "Five automations, all running, complete closed-loop action. The cold chain alert alone would have prevented the $2.48M TransFrio spoilage. The address correction automation feeds Stewardship decisions back into the Lakehouse automatically. This is how you turn insights into outcomes."),
    valueChain(["Automate the response to critical operational events", "eliminate the gap between detection and action", "save $2.48M by catching cold chain issues on Day 1 instead of Day 7"]),

    talkingPoint("Automations turn insights into action — the cold chain alert would have caught TransFrio on Day 1"),
    talkingPoint("Block-based builder requires no code — business users can create automations"),
    talkingPoint("The address correction loop is unique: Stewardship > Talend > Lakehouse > Gold > Predict"),
    talkingPoint("The block graphs are code, not clicks — npm run automations:workspaces authors and pushes all five"),
    talkingPoint("Pipeline health summary gives engineering a daily digest — no more silent failures"),
  ];
}

// =============================================================================
// MODULE 13: Discovery Agent & MCP
// =============================================================================
function module13() {
  return [
    heading("Module 13: Discovery Agent, MCP Server & Agentic AI"),
    metadataTable([
      ["Duration", "12-15 minutes"],
      ["Checklist Phase", "Phase 11 + 12"],
      ["Nightmares", "#1 (Phantom Inventory), #4 (Silent Pipelines), #6 (Carrier Data Black Hole)"],
      ["Components", "Discovery Agent, Qlik MCP Server, Claude Desktop/Code, Agentic Analytics"],
    ]),

    clarityContext("Project Qlarity Phase 3 (AI & Conversational) — the capstone. The Discovery Agent and MCP server are Qlarity's proactive, agentic layer: anomalies find you, and AI agents query the same governed data and documents that earlier phases built."),

    heading("Overview", 2),
    para("The Discovery Agent proactively monitors data products for anomalies and alerts users before problems escalate. The MCP Server connects Qlik data to AI agents (Claude), enabling natural language queries that combine structured data with document intelligence. Together, they represent the AI-driven future of data analytics."),

    heading("Demo Methodology: Tell → Show → Tell", 2),
    limbicOpening("Everything we've shown so far requires a human to ask a question or look at a dashboard. But what if the data found you? What if an AI agent noticed that spoilage rates were climbing, correlated it with a fleet change, estimated the financial exposure, and alerted the right person — all before a single box of product spoiled? That's not future vision. That's what the Discovery Agent does today.", "Problem/Consequence"),
    interactionPrompt("What if your data could proactively find problems and tell you before anyone asks — how would that change your team's operating model?"),

    divider(),

    heading("Part A: Discovery Agent", 2),

    heading("Setup", 3),
    numberedItem(1, "Enable Discovery Agent on Gold data products: Supply Chain Health, Last Mile Performance"),
    numberedItem(2, "Configure alert thresholds:"),
    dataTable(
      ["Threshold", "Value", "Purpose"],
      [
        ["Trust Score drop", "Below 0.70", "Data quality degradation"],
        ["Sync lag", "Exceeds 60 minutes", "Pipeline failure detection"],
        ["Volume anomaly", "Spike or drop > 50%", "Source system issues"],
      ]
    ),

    heading("Demo Scenario: TransFrio Spoilage Detection", 3),
    clarityContext("Project Qlarity Phase 3 Discovery Agent acting on the Phase 2 spoilage signal — proactively catching the TransFrio fleet change behind Nightmare #6 (Carrier Data Black Hole)."),
    para("The Discovery Agent monitors silver.iot_normalized and detects an anomaly pattern:"),
    numberedItem(1, "Temperature exceedance rate on GRU-BA route spiked from 2.1% to 8.8% over 3 weeks"),
    numberedItem(2, "Agent correlates: fleet metadata shows 6 truck replacements in the same period"),
    numberedItem(3, "Agent generates alert:"),
    expectedBox("Temperature exceedance on GRU-BA route. Spoilage rate increased 4x since fleet change on July 7. 12 active shipments at risk. Estimated $180K exposure. Click to view Cold Chain Dashboard."),
    numberedItem(4, "Agent links to: Qlik Analytics dashboard, carrier contract (CARRIER-TF-2024), incident report (INC-2025-05102)"),
    calloutBox("Talking point: The Discovery Agent found a pattern that took human analysts 3 weeks to notice. It connected fleet metadata changes to temperature anomalies across multiple data products — something no single dashboard could show."),

    divider(),

    heading("Part B: MCP Server", 2),

    heading("Setup", 3),
    para("The Qlik MCP Server is cloud-hosted — no local installation required. It runs at your tenant URL and is accessed via the SSE (Server-Sent Events) transport. No npm package exists; the server is built into Qlik Cloud."),
    numberedItem(1, "Generate an API key: Qlik Cloud Profile > API Keys > Generate new key"),
    numberedItem(2, "Add the Qlik MCP server to Claude Desktop config (claude_desktop_config.json):"),
    promptBox('{\n  "mcpServers": {\n    "qlik": {\n      "url": "https://your-tenant.us.qlikcloud.com/api/ai/mcp",\n      "headers": {\n        "Authorization": "Bearer YOUR_API_KEY_HERE"\n      }\n    }\n  }\n}', "Claude Desktop Config (claude_desktop_config.json)"),
    numberedItem(3, "Restart Claude Desktop — the Qlik MCP server connects automatically over SSE"),
    numberedItem(4, 'Test: Ask Claude "Search my Qlik tenant for supply chain apps"'),
    calloutBox("Key talking point: The Qlik MCP Server exposes 71 tools across 10 categories — App Discovery, Bookmarks, Business Glossary, Datasets & Data Quality, Data Exploration, Data Products, Lineage, Master Items, Selections, Visualization & Sheets. These are live Qlik Cloud capabilities, not simulated responses.", "info"),
    dataTable(
      ["MCP Tool Category", "Key Tools", "MCG Demo Use Case"],
      [
        ["App Discovery",           "qlik_search, qlik_describe_app, qlik_list_apps",               "Find supply chain and delivery apps"],
        ["Data Products",           "qlik_list_data_products, qlik_get_data_product",               "Browse the two Gold data products"],
        ["Business Glossary",       "qlik_list_terms, qlik_get_term",                               "Look up 'phantom inventory', 'WISMO'"],
        ["Data Exploration",        "qlik_get_fields, qlik_evaluate_expression",                    "Query gold.supply_chain_health"],
        ["Lineage",                 "qlik_get_lineage",                                             "Trace phantom inventory to source CDC pipeline"],
        ["Datasets & Data Quality", "qlik_list_datasets, qlik_get_trust_score",                    "Check Trust Scores across all data products"],
        ["Visualization & Sheets",  "qlik_list_sheets, qlik_get_visualization",                    "Navigate Supply Chain Operations app sheets"],
      ]
    ),

    heading("Build-Side: Governance for Coding Agents (Preview)", 3),
    para("The same Qlik MCP Server is the bridge that carries Qlik governance to any MCP-compatible AI assistant — including the coding agents developers use to author pipelines. Point Claude Code or GitHub Copilot at the MCP server and the agent can read data products, quality metrics, lineage, and the catalog while it works, so a developer editing the declarative pipeline YAML (Module 14) can ask 'what is the current Trust Score on Supply Chain Health?' or 'what lands silver.inventory_reconciled?' without leaving the IDE."),
    valueChain(["Expose Qlik data products, quality metrics, lineage, and catalog through one MCP server", "let coding agents author pipelines with governance context in view", "keep the build-side and consumption-side AI grounded in the same governed metadata"]),
    calloutBox("Preview / roadmap: the Qlik MCP Server tooling is a Qlik internal preview (June 2026). Position it as forward-looking. It is the same governance surface Module 14 (declarative pipelines) and the agentic-engineering modules build against — one MCP server serving both the developer in the IDE and the analyst in a chat.", "info"),

    heading("MCP Demo Scenario 1: Rotterdam Inventory", 3),
    clarityContext("Project Qlarity Phase 3 MCP querying Phase 1 monitoring outputs — phantom inventory (Nightmare #1) from the Rotterdam silent pipeline failure (Nightmare #4)."),
    promptBox("What is the current inventory accuracy rate at Rotterdam DC, and what is causing the issues?", "Ask Claude"),
    expectedBox("Claude uses MCP to query gold.supply_chain_health filtered by location_id = 'DC-RTD-01'. Gets: phantom_suspect_count = 1,667 of sku_positions = 3,710, avg_trust_score = 0.31 — so IRA = 1 - 1667/3710 = 55%. Then queries silver.inventory_reconciled for the affected positions. Finally pulls context from INC-2025-04872 (Rotterdam Pipeline Failure) via Qlik Answers.\n\nResponse: Rotterdam DC inventory record accuracy is 55%, far below the 97% target and the worst of the 12 DCs — the estate average is 74%. Trust score on those positions is 0.31 against 0.89 elsewhere. Root cause: silent pipeline failure INC-2025-04872, where the WMS-to-SAP CDC sync stopped for 72 hours on an expired TLS certificate. The incident report records 847 overstated units across 143 SKUs and EUR 30,500 of write-off. Pipeline has recovered; Project Qlarity Phase 1 extends monitoring to all 12 DCs."),

    heading("MCP Demo Scenario 2: Cold Chain Risk", 3),
    clarityContext("Project Qlarity Phase 3 MCP combining the Phase 2 spoilage prediction with live IoT data — the cold-chain carrier risk of Nightmare #6."),
    promptBox("What is the current spoilage risk for active TransFrio shipments on the Sao Paulo to Buenos Aires route?", "Ask Claude"),
    expectedBox("Claude queries silver.iot_normalized filtered by route_id = 'GRU-BA-001' (TransFrio's Sao Paulo to Buenos Aires lane — the carrier lives on silver.shipments_canonical, this table carries the route). Returns: 250 of 2,724 readings with alert_flag = 1, a 9.2% temperature-exceedance rate against roughly 2% on the comparable DPD lane. Pulls INC-2025-05102 for context about the fleet change and TRN-2025-002 for the Thermo King X4 7500 startup procedure."),

    heading("MCP Demo Scenario 3: Carrier SLA Analysis", 3),
    clarityContext("Project Qlarity Phase 3 MCP across the canonicalized carrier data — resolving Nightmare #6 (Carrier Data Black Hole) into a single APAC SLA comparison."),
    promptBox("Compare carrier on-time delivery performance across the estate. Which carrier is worst and why?", "Ask Claude"),
    expectedBox("Claude queries gold.last_mile_performance, whose grain is carrier_code x destination_country across the six countries MCG ships into (NL, DE, FR, ES, IT, PL). Returns: NinjaVan at 69% on-time — the clear worst — against GLS 93%, FedEx 92%, DHL 92%, TransFrio 92%, DPD 92%, on an estate average of 88%. NinjaVan also carries the highest WISMO rate at 31% versus 24-26% for the rest. Pulls CARRIER-NV-2025 for context: AMD3 reclassification effective Oct 1 changed 5-10 kg parcels from 2-day to 3-day delivery. 14,000 customers/month affected."),

    heading("MCP Demo Scenario 4: Customer WISMO Impact", 3),
    clarityContext("Project Qlarity Phase 3: WISMO deflection — quantifying the carrier-visibility cost (Nightmare #6) the conversational layer is designed to reduce."),
    promptBox("What is our WISMO rate and how much is it costing us?", "Ask Claude"),
    expectedBox("Claude queries gold.last_mile_performance filtered by wismo_flag=TRUE. Returns: overall WISMO rate 41%, cost per inquiry $2.30. Singapore worst at 52% (up from 30% pre-October). Annual WISMO cost: ~$4.2M. Pulls SOP-CS-001 for the current handling procedure and suggests process improvements."),

    heading("MCP Demo Scenario 5: Compliance Audit", 3),
    clarityContext("Project Qlarity Phase 3 MCP closing Nightmare #7 (Compliance Traceability Gap) — instant NVWA audit readiness from the governed lot-capture and recall data."),
    promptBox("How ready are we for the next NVWA food safety audit? What are our biggest gaps?", "Ask Claude"),
    expectedBox("Claude queries silver.inventory_reconciled filtered by nvwa_applicable=TRUE. Returns: 85% lot capture rate (target 100%), 30% of lettuce records missing trace_complete. Pulls COMP-2025-NVWA for the 5 findings from the last audit and RCL-2025-003 for the recall timeline. Recommends prioritizing lot number capture for perishables."),

    divider(),

    tellAnnotation("close", "Two AI capabilities that complete the picture: the Discovery Agent proactively monitors your data products and finds anomalies before anyone asks. The MCP Server lets AI agents like Claude query your real-time Qlik data and documents in a single conversation. Together, they shift your operating model from 'search for problems' to 'problems find you.'"),
    interactionPrompt("If an AI agent could monitor all of your data products 24/7 and alert you to anomalies — what would you stop doing manually?"),
    valueChain(["Deploy AI agents that proactively monitor data quality and operational metrics", "combine structured data with document intelligence in natural language conversations", "shift from reactive analytics to proactive, AI-driven operational intelligence"]),

    heading("Talking Points", 2),
    talkingPoint("Discovery Agent is proactive AI — it finds anomalies you didn't know to look for"),
    talkingPoint("MCP turns Claude into a data analyst that queries real-time Qlik data, not just general knowledge"),
    talkingPoint("Claude combines structured data (Lakehouse queries) with document intelligence (Answers) in one response"),
    talkingPoint("Every MCP response is traceable: which data products were queried, which documents were cited"),
    talkingPoint("The same MCP server (preview) also serves coding agents — governance in the IDE, not just the chat window (see Modules 14-18)"),
    talkingPoint("This is the vision: AI agents that understand your entire data landscape, not just one dashboard"),
  ];
}


// =============================================================================
// AGENTIC DATA ENGINEERING (BUILD-SIDE) — Modules 14-18
// -----------------------------------------------------------------------------
// The build-side counterpart to Modules 1-13. One underlying pipeline YAML,
// editable visually, programmatically, OR agentically — a path from raw data to
// a trusted, AI-ready data product that keeps human expertise in the loop at
// each stage. Verbatim Qlik capability names; grounded in MCG's real assets.
// =============================================================================

// =============================================================================
// MODULE 14: Declarative Pipelines in VS Code
// =============================================================================
function module14() {
  return [
    heading("Module 14: Declarative Pipelines in VS Code"),
    metadataTable([
      ["Duration", "12-15 minutes"],
      ["Checklist Phase", "Phase 3 (Open Lakehouse) — build-side / Agentic Data Engineering"],
      ["Nightmares", "#4 (Silent Pipeline Failures); foundation for all 7"],
      ["Components", "Declarative Data Pipelines (QTCP preview), VS Code, AI coding agent, Git, live schema validation, Apply from Remote"],
    ]),

    clarityContext("Project Qlarity Phase 1 → Phase 2, build-side: the same medallion pipeline that lands and transforms MCG's data is authored as version-controlled YAML — so changing it is a reviewed one-line git commit instead of an untracked console click (the root of Nightmare #4)."),

    heading("Overview", 2),
    para("Declarative Data Pipelines make the pipeline definition code-first: it is YAML, and the same definition is authorable in the Qlik Talend Cloud UI, in third-party IDEs like VS Code, and by AI coding agents — with Git version control, CI/CD, and schema validation. MCG's two Open Lakehouse projects, mcg-batch-pipeline (4 tasks) and mcg-streaming-pipeline (2 tasks), ship as a VS Code template in deploy/pipelines/."),
    calloutBox("Key message: ONE underlying pipeline YAML — editable visually (the UI), programmatically (the IDE), or agentically (a coding agent). Same file, same schema, same git history, whichever path you choose.", "info"),

    heading("Prerequisites", 2),
    numberedItem(1, "VS Code with the pipeline projects open from deploy/pipelines/"),
    numberedItem(2, "The schema kit + IDE config dropped in locally (one command):"),
    promptBox("npm run pipeline:template", "Terminal Command"),
    numberedItem(3, "An AI coding agent available in the IDE (Claude Code or GitHub Copilot)"),
    numberedItem(4, "Git initialized on the repo so changes produce a reviewable diff"),

    heading("Demo Methodology: Tell → Show → Tell", 2),
    limbicOpening("MCG's CRM landing task was still polling every 15 minutes months after the business asked for 30 — because changing a pipeline meant clicking through a console nobody owned, with no review and no history. When something broke, there was no diff to look at. What if changing the pipeline were a one-line, reviewed git commit?", "Problem/Consequence"),
    interactionPrompt("How do you change a production data pipeline today — and who reviews that change before it ships?"),

    heading("Demo Walk-Through", 2),

    tellAnnotation("open", "The pipeline is not clicked together — it is YAML in a repo. I'll open it in VS Code, ask a coding agent to make a change, watch the schema validate it as it types, review the one-line diff, and push it back into the running pipeline."),

    heading("Step 1: Open the Pipeline Project", 3),
    numberedItem(1, "Open the mcg-batch-pipeline project in VS Code (deploy/pipelines/)"),
    numberedItem(2, "Show qtcp_project.yaml, one folder per task (folder name = task name), datasets with custom SQL, and one schedule per task"),
    numberedItem(3, "Point out the template scaffolding: .vscode/settings.json (YAML schema associations), CLAUDE.md, and .github/copilot-instructions.md — this is what makes the IDE and the agent pipeline-aware"),

    heading("Step 2: Prompt the Coding Agent to Change the Schedule", 3),
    numberedItem(1, "Open the 'MCG CRM Landing' task folder and find its schedule — RRULE FREQ=MINUTELY;INTERVAL=15"),
    numberedItem(2, "Ask the coding agent, in plain language:"),
    promptBox("In the MCG CRM Landing task, change the landing schedule from every 15 minutes to every 30 minutes.", "Ask the coding agent (Claude Code / Copilot)"),
    expectedBox("The agent edits the task YAML, changing RRULE FREQ=MINUTELY;INTERVAL=15 to INTERVAL=30. Because the .vscode schema associations are active, the editor validates the change against the published QTCP schema as the agent types — a bad interval or a misspelled key is flagged inline before anything is saved."),

    heading("Step 3: Live Schema Validation", 3),
    numberedItem(1, "Hover the RRULE field — the schema describes the allowed values right in the editor"),
    numberedItem(2, "Type an intentional typo (INTERVEL) to show the red squiggle, then fix it"),
    calloutBox("Talking point: the schema is the guardrail. Whether a human or an agent makes the change, an invalid pipeline definition is caught in the editor — not at deploy time, and not at 2 a.m. when the task fails.", "info"),

    heading("Step 4: Review the One-Line Git Diff", 3),
    numberedItem(1, "Show the diff:"),
    promptBox("git diff", "Terminal Command"),
    expectedBox("A single changed line:\n- FREQ=MINUTELY;INTERVAL=15\n+ FREQ=MINUTELY;INTERVAL=30\nThe whole change is reviewable at a glance. Commit it with a message and it lives in the pipeline's history forever."),
    numberedItem(2, "This is the human-in-the-loop coding-agent loop: Developer Prompts → Agent Generates → Schema Validates → Developer Reviews. The developer stays in control at every step."),

    heading("Step 5: Apply from Remote", 3),
    numberedItem(1, "Commit and push the change"),
    numberedItem(2, "In Qlik Talend Cloud, use Apply from Remote (or the deploy import) to pull the committed YAML into the project — the CRM landing task now runs every 30 minutes, traceable to the commit"),
    calloutBox("Preview / roadmap: Declarative Data Pipelines are a Qlik internal preview (June 2026) — position them as forward-looking. The same definition remains fully editable in the Qlik Talend Cloud UI today; the IDE and coding-agent paths are the emerging capability.", "info"),

    tellAnnotation("close", "One YAML file, three ways to edit it — the Qlik Talend Cloud UI, VS Code, or an AI coding agent — and every path lands in the same schema-validated, version-controlled definition. Changing a pipeline stopped being a risky console click and became a reviewed one-line commit."),
    interactionPrompt("If every pipeline change came with a one-line diff and a reviewer, how many silent failures would you avoid?"),
    valueChain(["Author the pipeline as version-controlled YAML in the IDE", "let an AI coding agent make the change while the schema validates it live", "ship pipeline changes as reviewed, one-line git commits with full history"]),

    heading("Talking Points", 2),
    talkingPoint("ONE pipeline definition — editable visually (UI), programmatically (IDE), or agentically (coding agent); same YAML, same schema, same git history"),
    talkingPoint("Schema validation is live in the editor — the agent's change is checked against the published QTCP schema before it is saved"),
    talkingPoint("A pipeline change is a one-line git diff — reviewable, revertible, and auditable, unlike an untracked console edit"),
    talkingPoint("MCG's two pipelines (mcg-batch-pipeline, mcg-streaming-pipeline) ship as a VS Code template with schema kit, CLAUDE.md, and Copilot instructions"),
    talkingPoint("Apply from Remote pulls the committed YAML back into the running pipeline — the loop from prompt to production stays governed"),

    heading("Troubleshooting", 2),
    dataTable(
      ["Issue", "Cause", "Fix"],
      [
        ["No schema validation in the editor", "Schema kit / .vscode settings missing", "Run: npm run pipeline:template to drop the schema kit and IDE config locally"],
        ["Agent edits the wrong task", "Task folder name mismatch", "The folder name must equal the task name — confirm the MCG CRM Landing folder before prompting"],
        ["git diff shows more than one line", "Editor reformatted the YAML on save", "Disable format-on-save for YAML, or stage only the RRULE line"],
        ["Apply from Remote does not update the schedule", "Change not committed/pushed", "Commit and push first, then Apply from Remote (or re-run the deploy import)"],
      ]
    ),
  ];
}

// =============================================================================
// MODULE 15: Data Product Agent
// =============================================================================
function module15() {
  return [
    heading("Module 15: Data Product Agent"),
    metadataTable([
      ["Duration", "8-10 minutes"],
      ["Checklist Phase", "Phase 4 (Data Products) — Agentic Data Engineering"],
      ["Nightmares", "All 7 (data products package the remediated data)"],
      ["Components", "Data Product Agent (a Qlik Answers capability), the two Gold data products"],
    ]),

    clarityContext("Project Qlarity Phase 2 (Analytics & Quality): the governed Gold layer, now created and curated by conversation. The two data products the business consumes are packaged and improved through natural language, not a wizard."),

    heading("Overview", 2),
    para("The Data Product Agent lets you create and manage data products through natural-language interaction: create, update, and retire data products; discover and interact with them conversationally; and review and improve a product's quality and completeness. In the MCG demo it manages the two Gold data products — Supply Chain Health and Last Mile Performance."),
    calloutBox("This is a Qlik Answers capability, not a separate product. The Data Product Agent is the conversational way to do what the Data Products UI does — same governance model, same two Gold products.", "info"),

    heading("Demo Methodology: Tell → Show → Tell", 2),
    limbicOpening("MCG's data engineers could build a Gold table in a day, but packaging it as a governed product — description, ownership, tags, quality review — took a week of forms and follow-ups, so most never got packaged. The Data Product Agent turns that week into a conversation.", "Industry Insights"),
    interactionPrompt("When your team ships a new dataset, how much of the work is the data — and how much is the paperwork to make it discoverable and governed?"),

    heading("Demo Walk-Through", 2),

    tellAnnotation("open", "I'll ask the agent to create and curate a data product in plain language, then watch it review the product's own completeness and tell me what's missing — with a human approving every publish."),

    heading("Step 1: Discover Existing Products", 3),
    numberedItem(1, "Open the Data Product Agent (Qlik Answers) conversational panel"),
    promptBox("List our data products and tell me which one has the lowest completeness.", "Ask the Data Product Agent"),
    expectedBox("Returns Supply Chain Health and Last Mile Performance with a short profile of each (owner, datasets, API sharing, Trust Score context), and flags the one with gaps — e.g. columns without descriptions or an unassigned tag."),

    heading("Step 2: Create & Curate a Product", 3),
    promptBox("Create a data product called 'Last Mile Performance' from the gold last-mile dataset, owner Sophie Müller, tags carrier, wismo, on-time; then draft a description from the schema.", "Ask the Data Product Agent"),
    expectedBox("The agent packages the gold dataset as a data product, sets owner and tags, and drafts a product description plus column-level descriptions grounded in the actual schema. It presents the draft for review before publishing."),

    heading("Step 3: Review Quality & Completeness", 3),
    promptBox("Review Supply Chain Health for completeness and tell me what to fix before I publish it.", "Ask the Data Product Agent"),
    expectedBox("The agent reports completeness gaps (columns without descriptions, no SLA note, missing steward) and proposes concrete fixes. You accept or edit — the human stays in the loop."),
    numberedItem(1, "Cross-check against the two products the pipeline attaches (Module 5): same owners (Henrik Jansen, Sophie Müller), same API sharing, same Trust Score SLAs — the agent manages the real products, it does not create shadow copies"),

    tellAnnotation("close", "Two governed data products — created, tagged, described, and quality-reviewed through conversation, with a human approving every publish. The packaging that used to gate every dataset is now a five-minute dialogue."),
    interactionPrompt("If packaging a dataset as a governed product took five minutes of conversation, how many of your Gold tables would finally become real products?"),
    valueChain(["Create and manage data products in natural language", "let the agent review each product's own quality and completeness", "publish governed, discoverable products without the packaging tax"]),

    heading("Talking Points", 2),
    talkingPoint("The Data Product Agent is a Qlik Answers capability, not a standalone SKU"),
    talkingPoint("CRUD data products conversationally: create, update, tag, describe, retire"),
    talkingPoint("It reviews a product's own completeness and quality and proposes fixes — a second set of eyes before publish"),
    talkingPoint("It manages MCG's two real Gold products (Supply Chain Health, Last Mile Performance), not shadow copies"),
    talkingPoint("Human-in-the-loop: the agent drafts, the owner approves — governance is preserved"),

    heading("Troubleshooting", 2),
    dataTable(
      ["Issue", "Cause", "Fix"],
      [
        ["Agent can't find the gold dataset", "Pipeline gold datamart not yet run/attached", "Run the batch pipeline gold task first (Module 3), then retry"],
        ["Draft description looks generic", "Sparse schema metadata / no sample", "Ask the agent to profile the dataset first, then regenerate the description"],
        ["Duplicate data product created", "Product name differs from the existing one", "Use the exact existing name (Supply Chain Health / Last Mile Performance) so the agent updates rather than creates"],
        ["Publish blocked", "Missing owner or required tag", "Assign the owner and required tags when prompted, then publish"],
      ]
    ),
  ];
}

// =============================================================================
// MODULE 16: Data Quality Agent
// =============================================================================
function module16() {
  return [
    heading("Module 16: Data Quality Agent"),
    metadataTable([
      ["Duration", "8-10 minutes"],
      ["Checklist Phase", "Phase 3b / Phase 8 (Stewardship) — Agentic Data Engineering"],
      ["Nightmares", "#1 (Phantom Inventory), #3 (Product Master Mess), #7 (Compliance Traceability Gap)"],
      ["Components", "Data Quality Agent (a Qlik Answers capability), Silver datasets, Qlik Stewardship"],
    ]),

    clarityContext("Project Qlarity Phase 2 (Analytics & Quality): data quality as a conversation for the steward. The DQ rules that gate the Silver layer are assessed, authored, and mapped in plain language, then feed the Stewardship sprints (Module 10)."),

    heading("Overview", 2),
    para("The Data Quality Agent supports data stewards in assessing, defining, and enforcing data-quality rules conversationally: assess DQ across datasets, create/manage/map DQ rules, and run DQ metric calculations. It bridges business and technical users — a steward describes the rule in business terms, and the agent expresses, maps, and measures it. In the MCG demo the steward works the Silver layer: silver.inventory_reconciled, silver.addresses_standardized, silver.products_harmonized."),
    calloutBox("This is a Qlik Answers capability, not a separate product. It is the conversational front door to the same DQ rules and metrics — it bridges the business steward and the platform without a hand-off.", "info"),

    heading("Demo Methodology: Tell → Show → Tell", 2),
    limbicOpening("Sophie Müller knows exactly what a good customer address looks like — but she is not going to write a regex or a SQL constraint, and the engineer who can does not know the business rule. That gap is where bad data slips through. The Data Quality Agent lets the steward state the rule in plain language and turns it into an enforced check.", "Illustrative Analogy"),
    interactionPrompt("When a business expert spots a data-quality rule, how many hand-offs does it take before that rule is actually enforced?"),

    heading("Demo Walk-Through", 2),

    tellAnnotation("open", "I'll put a steward in front of the Silver layer and let them assess quality, write a rule in business language, and map it across datasets — no SQL, no ticket to engineering."),

    heading("Step 1: Assess Data Quality", 3),
    numberedItem(1, "Open the Data Quality Agent (Qlik Answers) as the steward (Sophie Müller, Customer Data Team)"),
    promptBox("Assess the data quality of silver.inventory_reconciled. Where are the biggest gaps?", "Ask the Data Quality Agent"),
    expectedBox("The agent profiles the dataset and reports issues in business terms — 15% of perishable items have no lot_number, timestamp columns with mixed formats, ira_pct values outside 0-1 — ranked by impact."),

    heading("Step 2: Define a Rule Conversationally", 3),
    promptBox("Add a rule: every perishable item must have a lot number. Flag any that don't.", "Ask the Data Quality Agent"),
    expectedBox("The agent expresses the rule (lot_number NOT NULL when perishable = TRUE), names it, and shows how many current records violate it — grounding the abstract rule in a real count before you commit."),

    heading("Step 3: Map & Run Metrics", 3),
    promptBox("Map that rule to all perishable datasets and run the completeness metric.", "Ask the Data Quality Agent"),
    expectedBox("The agent maps the rule across the relevant Silver datasets and runs the DQ metric calculation, returning the completeness score and the violating record set."),

    heading("Step 4: Enforce & Route to Stewardship", 3),
    numberedItem(1, "Send the violations to the Lot Number Compliance sprint (Module 10) — the agent-authored rule becomes the enforced gate, and the human-judgment cases go to warehouse supervisors"),
    calloutBox("Talking point: the steward wrote a data-quality rule in one sentence, saw exactly how many records break it, and routed the rest to a human-in-the-loop sprint — the closed-loop quality cycle, driven from the steward's own language.", "info"),

    tellAnnotation("close", "A steward assessed a Silver dataset, wrote a rule in plain language, saw the real violation count, mapped it across datasets, and routed the ambiguous cases to a sprint — start to finish, without a hand-off to engineering."),
    interactionPrompt("Which of your data-quality rules live only in someone's head today — and what would it take to make them enforced instead?"),
    valueChain(["Let a steward assess data quality across datasets in plain language", "turn a business rule into an enforced, mapped DQ check with live violation counts", "route what's left to human-in-the-loop stewardship"]),

    heading("Talking Points", 2),
    talkingPoint("The Data Quality Agent is a Qlik Answers capability, not a standalone SKU"),
    talkingPoint("It bridges business and technical: the steward states the rule, the agent expresses, maps, and measures it"),
    talkingPoint("Assess, define, map, and run DQ metrics — all conversationally, on the Silver layer"),
    talkingPoint("Every rule is grounded in a real violation count before it is committed — no abstract rules"),
    talkingPoint("Agent-authored rules feed the Stewardship sprints (Module 10) — the closed-loop data quality cycle"),

    heading("Troubleshooting", 2),
    dataTable(
      ["Issue", "Cause", "Fix"],
      [
        ["Agent returns no issues", "Dataset already clean or wrong name", "Confirm the Silver dataset name; try silver.addresses_standardized or silver.products_harmonized"],
        ["Rule maps to too many datasets", "Over-broad mapping request", "Ask the agent to list the datasets it will map to and confirm before applying"],
        ["Violation count looks wrong", "Metric run against a stale snapshot", "Ask the agent to re-run the metric after the latest Silver refresh"],
        ["Steward can't access the agent", "Space / role permissions", "Grant the steward access to the data space and the Answers assistant"],
      ]
    ),
  ];
}

// =============================================================================
// MODULE 17: Catalog and Business Glossary Agent
// =============================================================================
function module17() {
  return [
    heading("Module 17: Catalog and Business Glossary Agent"),
    metadataTable([
      ["Duration", "6-8 minutes"],
      ["Checklist Phase", "Phase 9 (Business Glossary) — Agentic Data Engineering"],
      ["Nightmares", "All 7 (shared vocabulary spans every nightmare)"],
      ["Components", "Catalog and Business Glossary Agent (a Qlik Answers capability), Qlik Cloud Catalog, Business Glossary"],
    ]),

    clarityContext("Project Qlarity Phase 2 (Analytics & Quality): the shared-vocabulary backbone, generated. The glossary that gives every term one meaning is drafted from the catalog by the agent, then human-reviewed before it becomes canonical."),

    heading("Overview", 2),
    para("The Catalog and Business Glossary Agent helps you discover data assets, understand their context and relationships, and define consistent business terminology. It runs natural-language queries against Qlik Cloud Catalog metadata and generates glossaries from apps, data products, datasets, or a whole domain, standardizing terms and synonyms. Generated glossary terms are DRAFT status by default and require human review before they are approved."),
    calloutBox("This is a Qlik Answers capability, not a separate product. Generated terms are DRAFT by default and require human review — the agent accelerates the glossary, it does not get the final say.", "info"),

    heading("Demo Methodology: Tell → Show → Tell", 2),
    limbicOpening("In one MCG meeting the VP of Warehouse said phantom inventory was down 12% while the CFO said it was up 8% — both right, because they used different definitions. Multiply that across 25 documents and two data products and you have a vocabulary problem no one owns. The agent drafts the glossary from the catalog so there is one definition to agree on, not three.", "Discovery Findings"),
    interactionPrompt("How many of your key business terms have exactly one agreed definition today — and who would you ask to be sure?"),

    heading("Demo Walk-Through", 2),

    tellAnnotation("open", "I'll point the agent at the catalog, ask it to generate glossary terms from a data product, and watch every term land as a reviewable draft — not an instant fact."),

    heading("Step 1: Discover Assets & Relationships", 3),
    numberedItem(1, "Open the Catalog and Business Glossary Agent (Qlik Answers)"),
    promptBox("What datasets and terms relate to phantom inventory across our catalog?", "Ask the Catalog & Glossary Agent"),
    expectedBox("The agent queries catalog metadata and returns related datasets (silver.inventory_reconciled, gold.supply_chain_health), the owner, and existing terms — surfacing context and relationships, not just a name match."),

    heading("Step 2: Generate a Glossary from a Data Product", 3),
    promptBox("Generate glossary terms for the Supply Chain Health data product, with synonyms.", "Ask the Catalog & Glossary Agent"),
    expectedBox("The agent drafts terms (Phantom Inventory, IRA, Trust Score, Lot Number) with definitions and synonyms, standardized against the catalog. Every generated term is created in DRAFT status."),

    heading("Step 3: Standardize Terms & Synonyms", 3),
    promptBox("Standardize 'WISMO' and merge its synonyms across the glossary.", "Ask the Catalog & Glossary Agent"),
    expectedBox("The agent proposes a single canonical definition for WISMO and lists the synonyms to merge, flagging conflicts for a human to resolve."),

    heading("Step 4: Human Review Before Approval", 3),
    numberedItem(1, "Route the DRAFT terms to their owners (e.g. Henrik Jansen for inventory terms) for review"),
    numberedItem(2, "Nothing becomes canonical until a human approves it — draft-by-default is the guardrail"),

    tellAnnotation("close", "The agent read the catalog, drafted a consistent set of terms with synonyms straight from the data products, and left every one in draft for a human to approve. The glossary that used to be tribal knowledge now has a first draft in minutes — and a reviewer on every term."),
    interactionPrompt("If the first draft of your business glossary wrote itself from your catalog tonight, whose review would make it official?"),
    valueChain(["Query the catalog in natural language to discover assets and relationships", "generate a consistent, synonym-aware glossary from your data products", "keep every generated term in draft for human review before it becomes canonical"]),

    heading("Talking Points", 2),
    talkingPoint("The Catalog and Business Glossary Agent is a Qlik Answers capability, not a standalone SKU"),
    talkingPoint("NL queries run against Qlik Cloud Catalog metadata — discovery by meaning, not just names"),
    talkingPoint("Generates glossaries from apps, data products, datasets, or a whole domain, with standardized synonyms"),
    talkingPoint("Generated terms are DRAFT by default and require human review — accuracy stays with the owner"),
    talkingPoint("Feeds the Business Glossary (Module 11) — the same connected governance layer, drafted faster"),

    heading("Troubleshooting", 2),
    dataTable(
      ["Issue", "Cause", "Fix"],
      [
        ["Agent returns few related assets", "Catalog not fully indexed", "Let catalog indexing complete, then re-ask; broaden from a term to a domain"],
        ["Worried generated terms overwrite existing ones", "They don't — drafts are separate", "Review drafts side by side with existing terms; approve or merge deliberately"],
        ["Synonyms merged incorrectly", "Ambiguous term", "Ask the agent to show the conflict and choose the canonical definition manually"],
        ["Terms stuck in draft", "Awaiting human review by design", "Assign each term to an owner for approval — draft-by-default is intended"],
      ]
    ),
  ];
}

// =============================================================================
// MODULE 18: Talend Agentic Routes
// =============================================================================
function module18() {
  return [
    heading("Module 18: Talend Agentic Routes"),
    metadataTable([
      ["Duration", "10-12 minutes"],
      ["Checklist Phase", "Phase 10 (Automations) — Agentic Data Engineering"],
      ["Nightmares", "#2 (Address Catastrophe), #6 (Carrier Data Black Hole)"],
      ["Components", "Talend Agentic Routes (LLM integration, RAG, agentic orchestration), the CRM address job mcg_crm_address_validate_bulk"],
    ]),

    clarityContext("Project Qlarity Phase 2 (Analytics & Quality): AI inside the pipeline task itself. The existing CRM address-validation job gains an LLM-assisted correction step, so the fix happens inside the route — not in a bolt-on app after it."),

    calloutBox("Preview / roadmap: Talend Agentic Routes are a Qlik internal preview (June 2026) — position as forward-looking, and confirm availability for the customer's edition before committing.", "warning"),

    heading("Overview", 2),
    para("Talend Agentic Routes extend Qlik Talend Cloud for AI-native workflows in three ways: (a) LLM integration in data tasks — cloud LLMs (OpenAI, Anthropic Claude, Google Gemini, Amazon Bedrock) and on-prem models (Ollama, Mistral, Gemma 3, Phi 4); (b) RAG pipelines writing to vector targets (Pinecone, MongoDB, Snowflake, Databricks, Milvus, Oracle); and (c) agentic orchestration — event-driven agent orchestration, conversational AI, and extensible tool + MCP client support. This puts sentiment analysis, entity extraction, content classification, and AI-assisted data quality inside pipeline tasks. The MCG surface is the existing Talend job mcg_crm_address_validate_bulk: address standardization, bulk geocoding, and a GPS routing gate that sends unresolved rows to a Qlik Stewardship sprint."),
    calloutBox("The LLM step runs inside the pipeline task, so the AI enrichment inherits the pipeline's scheduling, lineage, and governance — it is a data step, not a separate application. Choose cloud or on-prem models per your data-residency rules.", "info"),

    heading("Demo Methodology: Tell → Show → Tell", 2),
    limbicOpening("11% of MCG's CRM addresses are malformed and a further 6% are truncated by a legacy 30-character field — the root of $3.1M a year in delivery failures. The existing address job repairs what it can and bulk-geocodes the batch, but whatever it cannot resolve to GPS still falls out to a human queue. An LLM step inside the same route can propose the corrected address before it ever reaches that queue.", "Case Study"),
    interactionPrompt("Where in your pipelines are you routing messy records to a human queue that an in-line AI step could clear first?"),

    heading("Demo Walk-Through", 2),

    tellAnnotation("open", "I'll take the address-validation job MCG already runs and drop an LLM-assisted correction step into the route — an AI enrichment that lives inside the pipeline task, not in a separate app."),

    heading("Step 1: Open the Existing Address Job", 3),
    numberedItem(1, "Open the CRM Address Validation job (Talend) and show the existing flow:"),
    para("  CRM contacts > AddressStandardizer (repair + score) > BulkGeocoder (one bulk OSM Nominatim call for the whole batch) > routing gate on GPS > S3/Iceberg silver.addresses_geocoded, or the Address Cleanup stewardship sprint", { indent: true }),
    calloutBox("Five subjobs, all free: the AddressStandardizer and BulkGeocoder custom Java routines replace the subscription-only tAddressRowStandardize / tAddressRowValidate / tGeocode chain — no Talend Data Quality subscription, no licensed postal reference data, no API key. Full build spec: deploy/talend/BUILD_BULK_ADDRESS_JOB.md; run npm run talend:zip for the Studio import bundle.", "success"),

    heading("Step 2: Add an LLM Integration Step", 3),
    numberedItem(1, "Insert an LLM component before the Stewardship route; configure it against a model — a cloud LLM (Anthropic Claude, OpenAI, Google Gemini, Amazon Bedrock) or an on-prem model (Ollama, Mistral, Gemma 3, Phi 4) if data residency requires it"),
    promptBox("Given this raw CRM address, return the corrected, standardized address and a confidence score. Raw: 'Keizersgr 482 4B, 1017EJ Amsterd'", "LLM step prompt (inside the data task)"),
    expectedBox("The LLM returns a normalized address (Keizersgracht 482, Apt 4B, 1017 EJ, Amsterdam) with a confidence score. High-confidence corrections flow straight through; low-confidence ones still route to the Address Cleanup stewardship sprint (Module 10)."),

    heading("Step 3: Ground with RAG (Optional)", 3),
    numberedItem(1, "For records needing reference context, add a RAG lookup against a vector target (Pinecone, MongoDB, Snowflake, Databricks, Milvus, or Oracle) holding known-good postal references — so a correction cites a source instead of guessing"),

    heading("Step 4: Agentic Orchestration", 3),
    numberedItem(1, "Wire the route into event-driven orchestration — a new or updated CRM contact triggers the route automatically"),
    numberedItem(2, "Extensible tool + MCP client support lets the route call out to other governed tools when a record needs more than a single model call"),

    heading("Step 5: Close the Loop", 3),
    numberedItem(1, "Corrected addresses land in the Iceberg table silver.addresses_geocoded, which the silver transform joins onto silver.addresses_standardized — feeding the Gold products and the Late Delivery predictor (Module 8)"),
    numberedItem(2, "The human only sees the genuinely ambiguous cases — the in-line AI clears the rest"),
    calloutBox("Accuracy note: don't promise a specific correction-accuracy figure — route high-confidence fixes through and escalate the rest. If a number is needed for a given customer, capture it as a [placeholder] and validate before quoting it.", "warning"),

    tellAnnotation("close", "The address job MCG already runs now corrects the messy records in-line with an LLM, grounds them with RAG when needed, and escalates only the truly ambiguous ones. The AI is inside the pipeline — same schedule, same lineage, same governance — not a bolt-on."),
    interactionPrompt("If your pipelines could clean, classify, and enrich records with AI in-line, which manual data-prep step would you retire first?"),
    valueChain(["Drop an LLM (or RAG) step into an existing data task", "correct, classify, and enrich records in-line with your choice of cloud or on-prem model", "escalate only the genuinely ambiguous cases to a human"]),

    heading("Talking Points", 2),
    talkingPoint("Talend Agentic Routes put LLM, RAG, and agentic orchestration inside pipeline tasks — AI as a data step, not a separate app"),
    talkingPoint("Model choice is yours: cloud (OpenAI, Anthropic Claude, Google Gemini, Amazon Bedrock) or on-prem (Ollama, Mistral, Gemma 3, Phi 4) for data residency"),
    talkingPoint("RAG targets are open: Pinecone, MongoDB, Snowflake, Databricks, Milvus, Oracle"),
    talkingPoint("The in-line AI step inherits the pipeline's scheduling, lineage, and governance"),
    talkingPoint("It extends MCG's real address-validation job — high-confidence fixes flow through, ambiguous ones still go to stewardship"),

    heading("Troubleshooting", 2),
    dataTable(
      ["Issue", "Cause", "Fix"],
      [
        ["LLM step times out", "Model endpoint/network, or oversized batch", "Reduce batch size; verify the endpoint/credentials; try an on-prem model for latency"],
        ["Corrections low confidence across the board", "Prompt lacks context", "Add a RAG lookup for postal reference data, or few-shot examples in the prompt"],
        ["Sensitive data must stay on-prem", "Cloud LLM selected", "Switch to an on-prem model (Ollama, Mistral, Gemma 3, Phi 4)"],
        ["Route doesn't trigger", "Event orchestration not wired", "Confirm the CRM insert/update event is bound to the route trigger"],
      ]
    ),
  ];
}


// =============================================================================
// MAIN — Generate all 18 DOCX files
// =============================================================================
async function main() {
  console.log("=".repeat(60));
  console.log("  MCG Demo Script Generator");
  console.log("=".repeat(60));
  console.log();

  const modules = [
    { fn: module01, name: "01_Infrastructure_Data_Sources", title: "Project Qlarity Demo Walkthrough — Module 1" },
    { fn: module02, name: "02_Connections_Spaces", title: "Project Qlarity Demo Walkthrough — Module 2" },
    { fn: module03, name: "03_Open_Lakehouse", title: "Project Qlarity Demo Walkthrough — Module 3" },
    { fn: module04, name: "04_Lineage_Profiling_Trust", title: "Project Qlarity Demo Walkthrough — Module 4" },
    { fn: module05, name: "05_Data_Products_API", title: "Project Qlarity Demo Walkthrough — Module 5" },
    { fn: module06, name: "06_Analytics_Apps", title: "Project Qlarity Demo Walkthrough — Module 6" },
    { fn: module07, name: "07_Alerting_Reporting", title: "Project Qlarity Demo Walkthrough — Module 7" },
    { fn: module08, name: "08_Qlik_Predict", title: "Project Qlarity Demo Walkthrough — Module 8" },
    { fn: module09, name: "09_Qlik_Answers", title: "Project Qlarity Demo Walkthrough — Module 9" },
    { fn: module10, name: "10_Stewardship", title: "Project Qlarity Demo Walkthrough — Module 10" },
    { fn: module11, name: "11_Business_Glossary", title: "Project Qlarity Demo Walkthrough — Module 11" },
    { fn: module12, name: "12_Automations", title: "Project Qlarity Demo Walkthrough — Module 12" },
    { fn: module13, name: "13_Discovery_Agent_MCP", title: "Project Qlarity Demo Walkthrough — Module 13" },
    { fn: module14, name: "14_Declarative_Pipelines_VSCode", title: "Project Qlarity Demo Walkthrough — Module 14" },
    { fn: module15, name: "15_Data_Product_Agent", title: "Project Qlarity Demo Walkthrough — Module 15" },
    { fn: module16, name: "16_Data_Quality_Agent", title: "Project Qlarity Demo Walkthrough — Module 16" },
    { fn: module17, name: "17_Catalog_Glossary_Agent", title: "Project Qlarity Demo Walkthrough — Module 17" },
    { fn: module18, name: "18_Talend_Agentic_Routes", title: "Project Qlarity Demo Walkthrough — Module 18" },
  ];

  // Rasterize the official Qlik logo once (best-effort; a failure just omits it).
  await ensureQlikLogo();

  for (const mod of modules) {
    // shot() returns an array (image + caption), so flatten one level.
    const sections = mod.fn().flat();
    const doc = buildQlikDocument(mod.title, sections, QLIK);
    const outPath = path.join(OUT_DIR, `${mod.name}.docx`);
    await saveDocument(doc, outPath);
  }

  console.log();
  console.log(`  Generated ${modules.length} demo script documents in:`);
  console.log(`  ${OUT_DIR}`);
  console.log();
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
