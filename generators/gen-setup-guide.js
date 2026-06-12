#!/usr/bin/env node
// =============================================================================
// MCG Setup Guide Generator — Creates a professional Word document (.docx)
// covering the complete MCG demo environment setup process.
// =============================================================================
// Assumes the user already has .qvf files, generated documents, and access
// to a Qlik Cloud tenant. Screenshots are represented as descriptive callout
// placeholders for the user to replace with actual screenshots later.
//
// Usage:  node generators/gen-setup-guide.js
// Output: documents/MCG_Setup_Guide.docx
// =============================================================================

const {
  buildQlikDocument, saveDocument,
  metadataTable, dataTable,
  heading, para, labelValue, calloutBox, numberedItem,
  useQlikTheme,
} = require("./mcg-docx-builder");
const { Paragraph, TextRun, PageBreak } = require("docx");
const path = require("path");

// Switch to Qlik theme (Inter font, Qlik Colors 2024)
useQlikTheme();

const OUT_DIR = path.join(__dirname, "..", "documents");

// ─── HELPER: Page break paragraph ───
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ─── HELPER: Screenshot placeholder ───
function screenshot(description) {
  return calloutBox(`[Screenshot: ${description}]`, "info");
}

// ─── HELPER: Command box (monospace, indented) ───
function cmd(command) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    indent: { left: 400 },
    children: [
      new TextRun({ text: "$ ", font: "Consolas", size: 20, bold: true, color: "009845" }),
      new TextRun({ text: command, font: "Consolas", size: 20, color: "454659" }),
    ],
  });
}

// =============================================================================
// SECTION BUILDERS
// =============================================================================

function titleSection() {
  return [
    heading("MCG Demo Environment \u2014 Setup Guide"),
    metadataTable([
      ["Document Type", "Technical Setup Guide"],
      ["Version", "1.0"],
      ["Date", "March 2026"],
      ["Author", "Qlik Solutions Engineering"],
      ["Audience", "Solutions Consultants, Pre-Sales Engineers, Demo Administrators"],
      ["Classification", "CONFIDENTIAL \u2014 Internal Use Only"],
    ]),
    para("This guide provides step-by-step instructions for deploying the complete Meridian Commerce Group (MCG) demo environment on Qlik Cloud. It covers infrastructure setup, app imports, data connections, lakehouse configuration, analytics, AI/ML models, and automations."),
    calloutBox("This guide assumes you already have the .qvf app files, generated documents (.docx), and access to a Qlik Cloud tenant. If you need to generate the supporting documents first, run: npm run generate", "info"),
  ];
}

function sectionPrerequisites() {
  return [
    pageBreak(),
    heading("1. Prerequisites"),

    heading("1.1 Qlik Cloud Tenant", 2),
    para("You need access to a Qlik Cloud tenant with one of the following license types:"),
    para("Qlik Cloud Analytics (Enterprise edition)", { bullet: true }),
    para("Qlik Cloud Full Platform (preferred \u2014 includes Data Integration)", { bullet: true }),
    calloutBox("A Full Platform license is strongly recommended. It enables Qlik Replicate, Data Movement Gateway, Open Lakehouse, Qlik Predict, and Qlik Answers \u2014 all of which are demonstrated in this environment.", "warning"),

    heading("1.2 Required Roles", 2),
    para("Your user account must have the following roles assigned:"),
    dataTable(
      ["Role", "Purpose"],
      [
        ["Tenant Admin", "Full administrative access for space creation, theme uploads, and automation configuration"],
        ["Data Admin", "Required for Data Integration features (lakehouse, pipelines, data products)"],
        ["Analytics Admin", "Required for app management, theme deployment, and reload scheduling"],
      ]
    ),

    heading("1.3 API Key", 2),
    para("An API key is required for the automated deployment scripts. To generate one:"),
    numberedItem(1, "Log in to your Qlik Cloud tenant"),
    numberedItem(2, "Navigate to Settings (gear icon) \u2192 API keys"),
    numberedItem(3, "Click Create New API Key"),
    numberedItem(4, "Set expiration to at least 30 days"),
    numberedItem(5, "Copy and save the key immediately \u2014 it will not be shown again"),
    screenshot("Qlik Cloud Settings \u2192 API keys page with the 'Create New' button highlighted"),
    calloutBox("Store your API key securely. Do not commit it to version control. It will be stored in config.json, which is excluded via .gitignore.", "warning"),

    heading("1.4 Local Development Tools", 2),
    dataTable(
      ["Tool", "Version", "Purpose"],
      [
        ["Node.js", "18+ (LTS recommended)", "Runs generator scripts and the deployment UI"],
        ["npm", "9+ (included with Node.js)", "Package management"],
        ["Docker Desktop", "4.x+", "Runs Kafka, PostgreSQL, and simulator containers"],
        ["Git", "2.x+", "Clone and manage the demo repository"],
        ["Visual Studio Code", "Latest (recommended)", "Code editing \u2014 optional but recommended"],
      ]
    ),
  ];
}

function sectionQuickStart() {
  return [
    pageBreak(),
    heading("2. Quick Start (Automated Deployment)"),
    para("The fastest way to deploy the MCG demo environment is through the automated deployment UI, which walks you through an 11-step wizard covering all configuration steps."),

    heading("2.1 Clone and Install", 2),
    numberedItem(1, "Clone the repository:"),
    cmd("git clone <repo-url> mcg-demo"),
    cmd("cd mcg-demo"),
    numberedItem(2, "Install dependencies:"),
    cmd("npm install"),
    numberedItem(3, "Launch the deployment UI:"),
    cmd("npm run ui"),
    para("This opens a browser at http://localhost:3939 with the MCG Deployment Wizard."),
    screenshot("Deploy UI landing page at localhost:3939 showing the MCG Deployment Wizard with 11 setup steps listed on the left navigation panel"),

    heading("2.2 Deployment Wizard Pages", 2),
    dataTable(
      ["Page", "Step", "Description"],
      [
        ["1", "Connection & Authentication", "Tenant URL, API key, connection test"],
        ["2", "Docker Containers", "Start the local Kafka/PostgreSQL/simulator stack (optional DMG)"],
        ["3", "Spaces & Infrastructure", "Create shared and managed spaces"],
        ["4", "Data Connections", "Configure PostgreSQL, Kafka, and Salesforce connections"],
        ["5", "Pipelines", "Both declarative pipeline projects (batch + streaming): tasks, connection bindings, prepare, start"],
        ["6", "Build Apps & Theme", "Build analytics apps and apply the MCG theme"],
        ["7", "Knowledge Base & Documents", "Create the Qlik Answers knowledge base and upload documents"],
        ["8", "Automations", "Deploy Teams alerting automation templates"],
        ["9", "Data Products", "The two data products with their gold dataset attachment and marketplace publish toggles"],
        ["10", "Business Glossary", "Import business glossary terms"],
        ["11", "Deploy", "Review the plan and run the deployment with live logs"],
      ]
    ),

    heading("2.3 Alternative: CLI Deployment", 2),
    para("For automated or headless environments, you can run the deployment entirely from the command line:"),
    cmd("npm run deploy"),
    para("The CLI mode uses the same config.json file and performs all steps sequentially with console output."),
    calloutBox("Both the UI and CLI deployment methods produce identical results. Use the UI for first-time setup (it provides helpful guidance at each step) and the CLI for re-deployments or CI/CD pipelines.", "info"),
  ];
}

function sectionInfrastructure() {
  return [
    pageBreak(),
    heading("3. Infrastructure Setup (Docker)"),
    para("The MCG demo uses Docker containers to simulate on-premises data sources. This section covers starting the container stack, verifying services, and seeding the database."),

    heading("3.1 Starting the Simulator Stack", 2),
    para("Launch all infrastructure containers with a single command:"),
    cmd("npm run docker:up"),
    para("This starts the following services:"),
    dataTable(
      ["Service", "Image", "Purpose"],
      [
        ["Apache Kafka (Confluent)", "confluentinc/cp-kafka", "Streaming data source for IoT events"],
        ["ZooKeeper", "confluentinc/cp-zookeeper", "Kafka cluster coordination"],
        ["Schema Registry", "confluentinc/cp-schema-registry", "Avro/JSON schema management for Kafka topics"],
        ["Confluent Control Center", "confluentinc/cp-enterprise-control-center", "Kafka monitoring UI (localhost:9021)"],
        ["PostgreSQL", "postgres:15", "WMS database with MCG operational data"],
      ]
    ),

    heading("3.2 Starting with Data Movement Gateway", 2),
    para("If you plan to demonstrate Qlik Data Movement Gateway (DMG) for on-premises data replication, use:"),
    cmd("npm run docker:up:dmg"),
    para("This adds additional database containers for DMG demonstrations:"),
    dataTable(
      ["Service", "Purpose", "Notes"],
      [
        ["PostgreSQL (DMG)", "Source database for DMG CDC replication", "Separate instance from main PostgreSQL"],
        ["MySQL", "Additional source for multi-database DMG demo", "Pre-loaded with sample tables"],
        ["SQL Server", "Enterprise database source for DMG demo", "Developer edition container"],
      ]
    ),

    heading("3.3 Default Credentials", 2),
    calloutBox("The following credentials are for the local Docker environment only. Never use these passwords for production systems.", "warning"),
    dataTable(
      ["Service", "User", "Password", "Port"],
      [
        ["PostgreSQL (WMS)", "mcg_admin", "mcg_demo_2025", "5432"],
        ["Confluent Control Center", "\u2014", "\u2014", "9021"],
        ["PostgreSQL (DMG)", "postgres", "Qlik1234", "5432"],
        ["MySQL (DMG)", "root", "Qlik1234", "3306"],
        ["SQL Server (DMG)", "sa", "Qlik1234!", "1433"],
      ]
    ),

    heading("3.4 Verify Services", 2),
    para("Check that all containers are running:"),
    cmd("npm run docker:status"),
    para("All containers should show status 'Up' with healthy health checks. If any container is restarting or exited, check the Docker Desktop logs for that container."),
    screenshot("Docker Desktop showing all MCG containers in 'Running' state with green status indicators"),

    heading("3.5 Seed the Database", 2),
    para("Once PostgreSQL is running, create the schema and populate sample data:"),
    numberedItem(1, "Create database tables:"),
    cmd("npm run db:schema"),
    numberedItem(2, "Populate with sample data:"),
    cmd("npm run db:seed"),
    para("This inserts approximately 50,000 rows of realistic MCG data across all tables including orders, inventory, shipments, cold chain readings, and customer records."),
    calloutBox("If you receive a connection error, wait 10-15 seconds after docker:up for PostgreSQL to finish initializing, then retry.", "info"),

    heading("3.6 Confluent Control Center", 2),
    para("The Confluent Control Center provides a web UI for monitoring Kafka topics and consumer groups:"),
    numberedItem(1, "Open http://localhost:9021 in your browser"),
    numberedItem(2, "Navigate to Topics to verify the MCG topics exist"),
    numberedItem(3, "Expected topics: mcg.iot.cold-chain, mcg.iot.carrier-events"),
    screenshot("Confluent Control Center at localhost:9021 showing the Topics page with mcg.iot.cold-chain and mcg.iot.carrier-events listed"),
  ];
}

function sectionTenantConfig() {
  return [
    pageBreak(),
    heading("4. Qlik Cloud Tenant Configuration"),
    para("Before deploying any assets to Qlik Cloud, you must create a configuration file with your tenant details."),

    heading("4.1 Create config.json", 2),
    numberedItem(1, "Copy the example configuration file:"),
    cmd("cp config.example.json config.json"),
    numberedItem(2, "Open config.json in your editor and update the following fields:"),
    dataTable(
      ["Field", "Description", "Example Value"],
      [
        ["tenantHostname", "Your Qlik Cloud tenant URL (without https://)", "mcg-demo.us.qlikcloud.com"],
        ["region", "Qlik Cloud region identifier", "us-east-1"],
        ["apiKey", "API key generated in Section 1.3", "eyJhbGciOi..."],
        ["spaceNameShared", "Name for the shared development space", "MCG Demo - Development"],
        ["spaceNameManaged", "Name for the managed published space", "MCG Demo - Published"],
      ]
    ),
    calloutBox("config.json is listed in .gitignore and will not be committed to version control. This file contains your API key and must be kept secure.", "info"),
    screenshot("Qlik Cloud tenant settings page showing the API key generation interface"),
  ];
}

function sectionSpaces() {
  return [
    pageBreak(),
    heading("5. Create Spaces"),
    para("MCG uses two spaces to separate development assets from published production content."),

    heading("5.1 Shared Space (Development)", 2),
    numberedItem(1, "In Qlik Cloud, click the Spaces icon in the left navigation"),
    numberedItem(2, "Click Create Space"),
    numberedItem(3, "Select Shared as the space type"),
    numberedItem(4, "Name: MCG Demo - Development"),
    numberedItem(5, "Description: Development workspace for MCG demo apps, connections, and data assets"),
    numberedItem(6, "Click Create"),
    screenshot("Space creation dialog in Qlik Cloud with 'Shared' selected and 'MCG Demo - Development' as the name"),

    heading("5.2 Managed Space (Published)", 2),
    numberedItem(1, "Click Create Space again"),
    numberedItem(2, "Select Managed as the space type"),
    numberedItem(3, "Name: MCG Demo - Published"),
    numberedItem(4, "Description: Published MCG demo apps for audience-facing demonstrations"),
    numberedItem(5, "Click Create"),
    calloutBox("Managed spaces provide governance controls including publish workflows and access restrictions. Apps in this space will be read-only for consumers, ensuring demo integrity.", "info"),
  ];
}

function sectionImportApps() {
  return [
    pageBreak(),
    heading("6. Import Analytics Apps (.qvf)"),
    para("Upload the pre-built Qlik Analytics apps to the shared development space."),

    heading("6.1 Upload App Files", 2),
    numberedItem(1, "Navigate to the MCG Demo - Development space"),
    numberedItem(2, "Click Add new \u2192 Upload app"),
    numberedItem(3, "Select the .qvf files from the deploy/apps/ folder"),
    numberedItem(4, "Upload each app one at a time:"),
    dataTable(
      ["App File", "App Name", "Description"],
      [
        ["MCG_Supply_Chain_Operations.qvf", "MCG Supply Chain Operations", "WMS, inventory, fulfillment, and cold chain analytics"],
        ["MCG_Delivery_Customer_Experience.qvf", "MCG Delivery & Customer Experience", "Last-mile delivery, WISMO, and customer satisfaction analytics"],
      ]
    ),
    screenshot("App import dialog in Qlik Cloud showing the file selection prompt with a .qvf file selected"),

    heading("6.2 Apply MCG Dark Theme", 2),
    para("The MCG apps are designed to use a custom dark theme that provides the branded look and feel."),
    numberedItem(1, "Go to Settings \u2192 Themes (Tenant Admin required)"),
    numberedItem(2, "Click Upload Theme"),
    numberedItem(3, "Select the theme .zip file from deploy/themes/"),
    numberedItem(4, "Once uploaded, open each app \u2192 Sheet settings \u2192 Theme \u2192 select MCG Dark Theme"),
    screenshot("MCG Supply Chain Operations app with the dark theme applied, showing navy background with teal and green accent charts"),

    calloutBox("If the theme does not appear in the app's theme selector, verify it was uploaded at the tenant level (not just the space level). Themes must be uploaded by a Tenant Admin.", "warning"),
  ];
}

function sectionDataConnections() {
  return [
    pageBreak(),
    heading("7. Create Data Connections"),
    para("The MCG demo requires three data connections to feed the analytics apps and lakehouse pipelines."),

    heading("7.1 PostgreSQL Connection (WMS)", 2),
    para("This connection provides access to the MCG warehouse management system database running in Docker."),
    numberedItem(1, "Navigate to MCG Demo - Development space"),
    numberedItem(2, "Click Add new \u2192 Data connection"),
    numberedItem(3, "Select PostgreSQL as the connection type"),
    numberedItem(4, "Configure the connection:"),
    dataTable(
      ["Setting", "Value"],
      [
        ["Connection name", "MCG-WMS-PostgreSQL"],
        ["Host", "your-server-ip (or localhost for local Docker)"],
        ["Port", "5432"],
        ["Database", "mcg_wms"],
        ["Username", "mcg_admin"],
        ["Password", "(set during db:schema step)"],
      ]
    ),
    numberedItem(5, "Click Test Connection to verify, then Save"),
    screenshot("PostgreSQL connection dialog in Qlik Cloud with the connection settings filled in and the 'Test Connection' button visible"),
    calloutBox("For Docker-based setups: if Qlik Cloud cannot reach localhost, you will need either a publicly accessible server, a Qlik Data Gateway \u2014 Direct Access, or the Data Movement Gateway. See Qlik documentation for gateway setup.", "warning"),

    heading("7.2 Kafka Connection (IoT Streams)", 2),
    para("This connection provides real-time streaming data from the IoT cold chain and carrier event simulators."),
    numberedItem(1, "Click Add new \u2192 Data connection"),
    numberedItem(2, "Select Apache Kafka as the connection type"),
    numberedItem(3, "Configure the connection:"),
    dataTable(
      ["Setting", "Value"],
      [
        ["Connection name", "MCG-Kafka-IoT"],
        ["Bootstrap servers", "localhost:9092 (Docker) or your-kafka-broker:9092"],
        ["Security protocol", "PLAINTEXT (Docker) or SASL_SSL (cloud Kafka)"],
        ["Topics", "mcg.iot.cold-chain, mcg.iot.carrier-events"],
      ]
    ),
    screenshot("Kafka connection settings in Qlik Cloud with bootstrap servers and topic configuration"),
    calloutBox("Kafka connections from Qlik Cloud to an on-premises Kafka cluster require Data Gateway - Streaming. For cloud-hosted Kafka (e.g., Confluent Cloud), a direct connection is possible with SASL authentication.", "info"),

    heading("7.3 Salesforce Connection (CRM)", 2),
    para("This connection provides customer and order data from Salesforce CRM."),
    numberedItem(1, "Click Add new \u2192 Data connection"),
    numberedItem(2, "Select Salesforce as the connection type"),
    numberedItem(3, "Configure the connection:"),
    dataTable(
      ["Setting", "Value"],
      [
        ["Connection name", "MCG-Salesforce-CRM"],
        ["Username", "your-salesforce-username"],
        ["Password", "your-password + security-token"],
        ["Security token", "From Salesforce: Settings \u2192 Personal \u2192 Reset Security Token"],
      ]
    ),
    numberedItem(4, "After connecting, select these Salesforce objects:"),
    para("Contact", { bullet: true, indent: true }),
    para("MCG_Order__c (custom object)", { bullet: true, indent: true }),
    para("MCG_Product__c (custom object)", { bullet: true, indent: true }),
    screenshot("Salesforce connector configuration in Qlik Cloud showing the object selection screen with Contact, MCG_Order__c, and MCG_Product__c selected"),
    calloutBox("The MCG_Order__c and MCG_Product__c custom objects must exist in your Salesforce org. If you are using a fresh Developer Edition, run the Salesforce setup script first: npm run sf:setup", "info"),
  ];
}

function sectionLakehouse() {
  return [
    pageBreak(),
    heading("8. Set Up Open Lakehouse"),
    para("The Open Lakehouse is the central data platform for the MCG demo, organizing data into bronze (raw), silver (cleansed), and gold (business-ready) layers following the medallion architecture pattern."),

    heading("8.1 Create the Lakehouse", 2),
    numberedItem(1, "Navigate to Data Integration \u2192 Lakehouse in the left navigation"),
    numberedItem(2, "Click Create Lakehouse"),
    numberedItem(3, "Name: MCG Operations Lakehouse"),
    numberedItem(4, "Create three schemas within the lakehouse:"),
    dataTable(
      ["Schema", "Purpose", "Data Quality Level"],
      [
        ["bronze", "Raw ingested data from all sources \u2014 no transformations", "As-is from source"],
        ["silver", "Cleansed and standardized data with business rules applied", "Quality-checked, deduplicated"],
        ["gold", "Business-ready data products for analytics and API consumption", "Governed, trusted, API-shared"],
      ]
    ),

    heading("8.2 Deploy the Pipelines (Declarative Import — Primary Method)", 2),
    para("This is the primary way to deploy the MCG pipelines. Two Open Lakehouse projects are defined as version-controlled YAML under deploy/pipelines/ (QTCP declarative pipelines preview): mcg-batch-pipeline (WMS CDC + Salesforce CRM → silver → gold) and mcg-streaming-pipeline (Kafka IoT → silver). Both import as Step 13 of npm run deploy."),
    para("The deploy drives the full chain over REST APIs: create connections → validate definitions → create the DI project → import the YAML → resolve bindings → prepare → start every task in dependency order (landing → transform → datamart) → attach the gold datasets to their Data Products. Control it with four config.json flags (also exposed as toggles on the wizard's Data Products page):"),
    dataTable(
      ["Flag (config.json pipelines.*)", "Default", "Effect"],
      [
        ["prepare", "false", "Validate + prepare the project after import (creates lakehouse artifacts)"],
        ["run", "false", "Start all tasks in dependency order after prepare"],
        ["attachDatasets", "true", "Attach gold catalog datasets to the matching Data Products (soft-skips tables not yet in the catalog)"],
        ["publishDataProducts", "false", "Activate the Data Products in the marketplace"],
      ]
    ),
    para("Schedules are declared in each project's YAML (qtcp_tasks/*/schedule.yaml, one schedule per task): the CRM landing syncs every 15 minutes, the silver transform is event-triggered by its landings, and the gold datamart runs daily at 06:00 UTC. CDC and streaming landings run continuously once started. There is no REST endpoint for DI schedules — the YAML is the source of truth, and the schedules activate once tasks are started."),
    cmd("npm run pipeline:zip"),
    para("For a manual import without any tenant credentials, the command above packages one import ZIP per project for Data Integration → your project → Import. After refining transformations in the QTCP UI, round-trip them back into the repo:"),
    cmd("npm run deploy:export-pipeline"),
    calloutBox("Recommended flow: deploy with prepare=true and run=true on a fresh tenant, let the first pipeline run land data in the catalog, then re-run the deploy (or just Step 13) so attachDatasets links the gold datasets to their Data Products.", "success"),

    para("Sections 8.3–8.5 document what the declarative import creates — layer by layer. Use them as a reference, to demonstrate the build interactively, or to customize beyond what the YAML defines."),

    heading("8.3 Bronze Layer Reference (8 Pipelines)", 2),
    para("The bronze layer captures raw data from all three source systems. The declarative import creates the following pipelines:"),

    heading("CDC Pipelines (PostgreSQL \u2192 Bronze)", 3),
    para("These pipelines use Change Data Capture to replicate PostgreSQL tables in near real-time:"),
    dataTable(
      ["Pipeline Name", "Source Table", "Target Table", "Sync Method"],
      [
        ["WMS-Inventory", "mcg_wms.inventory_positions", "bronze.inventory_positions", "CDC (real-time)"],
        ["WMS-Events", "mcg_wms.warehouse_events", "bronze.warehouse_events", "CDC (real-time)"],
        ["WMS-Shipments", "mcg_wms.shipments", "bronze.shipments", "CDC (real-time)"],
      ]
    ),

    heading("API Pipelines (Salesforce \u2192 Bronze)", 3),
    para("These pipelines use REST API extraction to pull Salesforce data on a schedule. A rename rule maps the Salesforce objects to the bronze table names:"),
    dataTable(
      ["Pipeline Name", "Source Object", "Target Table", "Sync Method"],
      [
        ["SF-Contacts", "Contact", "bronze.sf_contacts", "API (every 15 min)"],
        ["SF-Orders", "MCG_Order__c", "bronze.sf_orders", "API (every 15 min)"],
        ["SF-Products", "MCG_Product__c", "bronze.sf_products", "API (every 15 min)"],
      ]
    ),

    heading("Streaming Pipelines (Kafka \u2192 Bronze)", 3),
    para("These pipelines consume real-time events from Kafka topics:"),
    dataTable(
      ["Pipeline Name", "Source Topic", "Target Table", "Sync Method"],
      [
        ["IoT-ColdChain", "mcg.iot.cold-chain", "bronze.iot_cold_chain", "Streaming (continuous)"],
        ["IoT-CarrierEvents", "mcg.iot.carrier-events", "bronze.iot_carrier_events", "Streaming (continuous)"],
      ]
    ),

    heading("8.4 Silver Layer Reference (8 Transformation Routes)", 2),
    para("The silver layer applies cleansing, standardization, and business rules to bronze data. The declarative import creates these transformation routes:"),
    dataTable(
      ["Silver Table", "Source (Bronze)", "Key Transformations"],
      [
        ["silver.inventory_reconciled", "bronze.inventory_positions", "UoM + storage-zone standardization, phantom/negative-qty flags, lot compliance, trust score"],
        ["silver.warehouse_events_clean", "bronze.warehouse_events", "Event-type canonicalization, bin normalization, per-DC timezone to UTC"],
        ["silver.shipments_canonical", "bronze.shipments", "6-carrier multilingual status mapping, ISO countries, lbs-to-kg"],
        ["silver.addresses_standardized", "bronze.sf_contacts", "City/state/postal/country normalization, address quality score"],
        ["silver.products_harmonized", "bronze.sf_products", "Legacy SKU resolution, weight imputation, supplier canonicalization"],
        ["silver.suppliers_deduped", "bronze.sf_products", "Canonical supplier rollup with variant counts"],
        ["silver.order_delivery_timeline", "bronze.sf_orders + bronze.shipments", "Order lifecycle join, late-delivery/days-late/WISMO metrics"],
        ["silver.iot_normalized", "bronze.iot_cold_chain", "Fahrenheit-to-Celsius, GPS-gap / unregistered-sensor / low-battery flags"],
      ]
    ),
    calloutBox("Use AI-Assisted SQL in the Qlik transformation editor to generate transformation logic. For example, describe the transformation in plain English: 'Standardize all dates to UTC, remove records with null order_id, and normalize status values to uppercase'. The AI will generate the SQL.", "success"),

    heading("8.5 Gold Layer Reference (2 Data Products)", 2),
    para("The gold layer contains the two business-ready, governed data products the pipeline creates — one per analytics domain app. Both ship in the declarative project as custom-SQL datamart datasets:"),
    dataTable(
      ["Gold Table", "Source (Silver)", "Owner", "Refresh", "Business Purpose"],
      [
        ["gold.supply_chain_health",      "inventory_reconciled + warehouse_events_clean",                           "Henrik Jansen",     "Daily 06:00 UTC", "Inventory accuracy, phantom inventory detection, and pipeline health KPIs per DC"],
        ["gold.last_mile_performance",    "order_delivery_timeline + shipments_canonical + addresses_standardized",  "Sophie Müller",     "Daily 06:00 UTC", "Carrier SLA metrics, address quality scoring, and WISMO correlation by region"],
      ]
    ),

  ];
}

function sectionDataProducts() {
  return [
    pageBreak(),
    heading("9. Data Products & Governance"),
    para("Register each gold layer table as a governed data product for discovery, sharing, and consumption across the organization."),

    heading("9.1 Register Data Products", 2),
    para("For each gold table:"),
    numberedItem(1, "Navigate to Data Integration \u2192 Data Products"),
    numberedItem(2, "Click Register Data Product"),
    numberedItem(3, "Select the gold table from the lakehouse"),
    numberedItem(4, "Set the owner (e.g., Data Engineering Team)"),
    numberedItem(5, "Add a description \u2014 use AI-generated descriptions for consistency"),
    numberedItem(6, "Set classification level (Internal for demo purposes)"),
    numberedItem(7, "Enable API Sharing to make the data product accessible via REST API"),
    screenshot("Data Product registration screen showing a gold table being registered with owner, description, and API sharing enabled"),
    calloutBox("Primary path: npm run deploy provisions both data products from data_products.json via the Data Products API, attaches each product's gold dataset from the catalog once the pipeline has run (pipelines.attachDatasets), and can activate products in the marketplace (pipelines.publishDataProducts). The manual steps above show the same workflow interactively.", "info"),

    heading("9.2 Configure Trust Score", 2),
    para("Each data product has a Trust Score composed of multiple dimensions:"),
    dataTable(
      ["Dimension", "Description", "Target Score"],
      [
        ["Freshness", "How recently the data was updated", "95%+"],
        ["Completeness", "Percentage of non-null values in key columns", "98%+"],
        ["Accuracy", "Data validation rule pass rate", "95%+"],
        ["Consistency", "Cross-source reconciliation match rate", "90%+"],
        ["Timeliness", "Pipeline execution within SLA", "99%+"],
      ]
    ),
    calloutBox("Trust Scores are calculated automatically by Qlik based on pipeline health, data profiling results, and lineage completeness. Higher scores indicate more reliable data products.", "info"),
  ];
}

function sectionQlikAnswers() {
  return [
    pageBreak(),
    heading("10. Qlik Answers (Knowledge Base)"),
    para("Qlik Answers provides AI-powered natural language Q&A over enterprise documents. Set up a knowledge base with the MCG documents."),

    heading("10.1 Create Knowledge Base", 2),
    numberedItem(1, "Navigate to Qlik Answers in the left navigation"),
    numberedItem(2, "Click Create Knowledge Base"),
    numberedItem(3, "Name: MCG Operations Knowledge Base"),
    numberedItem(4, "Description: Comprehensive documentation for Meridian Commerce Group operations, policies, SOPs, and governance frameworks"),

    heading("10.2 Upload Documents", 2),
    numberedItem(1, "Click Add Documents in the knowledge base"),
    numberedItem(2, "Upload all 25 documents from the documents/ folder"),
    numberedItem(3, "Exclude the demo-scripts/ subfolder (those are presenter guides, not knowledge content)"),
    para("Expected document categories:"),
    para("Standard Operating Procedures (SOPs) \u2014 warehouse, cold chain, quality assurance", { bullet: true }),
    para("Policies \u2014 data governance, compliance, security", { bullet: true }),
    para("Business Documents \u2014 carrier reports, incident analyses, operational reviews", { bullet: true }),
    para("Governance Frameworks \u2014 data quality rules, stewardship guides", { bullet: true }),
    screenshot("Knowledge Base document upload screen showing multiple .docx files being uploaded with progress indicators"),

    heading("10.3 Create Assistant", 2),
    numberedItem(1, "Navigate to Qlik Answers \u2192 Assistants"),
    numberedItem(2, "Click Create Assistant"),
    numberedItem(3, "Name: MCG Operations Assistant"),
    numberedItem(4, "Link to the MCG Operations Knowledge Base"),
    numberedItem(5, "Add the following conversation starters:"),
    dataTable(
      ["#", "Conversation Starter"],
      [
        ["1", "What is MCG's cold chain temperature monitoring policy?"],
        ["2", "How does MCG handle phantom inventory discrepancies?"],
        ["3", "What are the escalation procedures for delivery SLA breaches?"],
        ["4", "Explain MCG's data quality governance framework"],
        ["5", "What are the WISMO rate reduction strategies?"],
      ]
    ),

    heading("10.4 Test the Assistant", 2),
    para("Verify the assistant works by asking the sample questions above. The assistant should provide accurate answers sourced from the uploaded documents with proper citations."),
    calloutBox("If the assistant returns empty or irrelevant results, allow 5-10 minutes for document indexing to complete after upload. Large document sets may take longer.", "info"),
  ];
}

function sectionGlossary() {
  return [
    pageBreak(),
    heading("11. Business Glossary"),
    para("The business glossary provides standardized definitions for key MCG business terms, improving data literacy and ensuring consistent terminology across the organization."),

    heading("11.1 Import Glossary Terms", 2),
    numberedItem(1, "Navigate to Governance \u2192 Business Glossary"),
    numberedItem(2, "Click Import Terms"),
    numberedItem(3, "Select the file: deploy/glossary_terms.json"),
    numberedItem(4, "Map the fields and confirm import"),
    para("The import includes 25 terms organized into 5 categories:"),
    dataTable(
      ["Category", "# Terms", "Example Terms"],
      [
        ["Inventory & Warehouse", "5", "Phantom Inventory, Safety Stock, Cycle Count, IRA, Pick Wave"],
        ["Supply Chain & Logistics", "5", "Cold Chain, Last Mile, WISMO, SLA Breach, Carrier Scorecard"],
        ["Data Quality & Governance", "5", "Trust Score, Data Lineage, Data Product, Golden Record, Profiling"],
        ["Compliance & Regulatory", "5", "GDP Compliance, FSMA, Chain of Custody, Recall Readiness, Audit Trail"],
        ["Business Operations", "5", "Fulfillment Rate, Order Accuracy, Customer Churn, Net Promoter Score, Revenue Leakage"],
      ]
    ),
    screenshot("Glossary term creation screen in Qlik Cloud showing a term being defined with category, description, and related assets"),

    heading("11.2 Link Terms to Data Assets", 2),
    para("After importing, link glossary terms to their corresponding data assets:"),
    para("Link 'Phantom Inventory' to gold.inventory_health data product", { bullet: true }),
    para("Link 'Cold Chain' to gold.supply_chain_health data product", { bullet: true }),
    para("Link 'WISMO' to gold.last_mile_performance data product", { bullet: true }),
    para("Link 'Trust Score' to all data products (as a governance concept)", { bullet: true }),
    calloutBox("Linking glossary terms to data assets enables contextual help in analytics apps. When users hover over a field linked to a glossary term, the definition appears automatically.", "success"),
  ];
}

function sectionAutomations() {
  return [
    pageBreak(),
    heading("12. Automations"),
    para("Set up five automations that demonstrate Qlik's ability to trigger actions based on data events and schedules."),

    heading("12.1 Automation Overview", 2),
    dataTable(
      ["#", "Automation Name", "Trigger", "Action", "Schedule"],
      [
        ["1", "Daily App Reload", "Schedule", "Reload MCG analytics apps with latest data", "06:00 UTC daily"],
        ["2", "Cold Chain Alert \u2192 Teams", "Data threshold", "Send Teams alert when temperature exceeds 8\u00B0C", "Every 5 minutes"],
        ["3", "Pipeline Health Summary \u2192 Teams", "Schedule", "Post daily pipeline status summary to Teams", "07:00 UTC daily"],
        ["4", "WISMO Rate Alert \u2192 Teams", "Data threshold", "Alert when WISMO rate exceeds 40% for any carrier or region combination", "Every 30 minutes"],
        ["5", "Address Correction Loop \u2192 Talend", "Event", "Trigger Talend job for address standardization", "On new stewardship resolution"],
      ]
    ),

    heading("12.2 Import Templates", 2),
    numberedItem(1, "Navigate to Automations in the left navigation"),
    numberedItem(2, "Click Create Automation"),
    numberedItem(3, "Click Import and select the template files from deploy/automations/"),
    numberedItem(4, "Import each automation template individually"),
    screenshot("Automation builder in Qlik Cloud showing a multi-step automation flow with trigger, condition, and action blocks"),

    heading("12.3 Configure Webhooks", 2),
    para("Several automations send notifications to Microsoft Teams. Configure the webhook URLs:"),
    numberedItem(1, "In Microsoft Teams, create incoming webhooks for the target channel"),
    numberedItem(2, "Copy the webhook URL for each channel"),
    numberedItem(3, "In each Qlik automation, update the Teams webhook URL in the HTTP action block"),
    calloutBox("If you do not have Microsoft Teams configured, you can substitute Slack webhooks or email notifications. The automation templates include alternative action blocks for each.", "info"),
  ];
}

function sectionPredict() {
  return [
    pageBreak(),
    heading("13. Qlik Predict (AutoML)"),
    para("Qlik Predict enables no-code machine learning model training and deployment. Create two predictive models for the MCG demo."),

    heading("13.1 Model 1: Spoilage Risk Predictor", 2),
    numberedItem(1, "Navigate to Qlik Predict \u2192 Create Experiment"),
    numberedItem(2, "Configure the experiment:"),
    dataTable(
      ["Setting", "Value"],
      [
        ["Experiment name", "MCG Spoilage Risk Predictor"],
        ["Source", "silver.iot_normalized"],
        ["Target column", "spoilage_risk_score"],
        ["Problem type", "Regression"],
        ["Training split", "80/20"],
      ]
    ),
    numberedItem(3, "Click Train Model and wait for training to complete (typically 5-15 minutes)"),
    numberedItem(4, "Review the model performance metrics (R\u00B2, RMSE, feature importance)"),
    numberedItem(5, "Deploy the model and enable API sharing"),

    heading("13.2 Model 2: Delivery SLA Predictor", 2),
    numberedItem(1, "Create a new experiment:"),
    dataTable(
      ["Setting", "Value"],
      [
        ["Experiment name", "MCG Delivery SLA Predictor"],
        ["Source", "gold.last_mile_performance"],
        ["Target column", "sla_met"],
        ["Problem type", "Classification (binary)"],
        ["Training split", "80/20"],
      ]
    ),
    numberedItem(2, "Click Train Model"),
    numberedItem(3, "Review metrics (accuracy, precision, recall, AUC)"),
    numberedItem(4, "Deploy and enable API sharing"),
    screenshot("Qlik Predict model training results showing feature importance chart and performance metrics"),

    calloutBox("Both models must have API sharing enabled for the analytics apps to consume predictions in real-time. The apps use Qlik expressions to call the Predict API and display risk scores directly on dashboards.", "warning"),
  ];
}

function sectionStewardship() {
  return [
    pageBreak(),
    heading("14. Stewardship Campaigns"),
    para("Stewardship campaigns assign data quality issues to business users for manual review and resolution, closing the loop between automated detection and human judgment."),

    heading("14.1 Create Campaigns", 2),
    para("Create four stewardship campaigns that address MCG's primary data quality challenges:"),
    dataTable(
      ["#", "Campaign Name", "Source", "Candidates", "Assigned To"],
      [
        ["1", "Address Cleanup", "silver.addresses_standardized", "~640 records", "Customer Service Team"],
        ["2", "Supplier Deduplication", "silver.suppliers_deduped", "~80 suppliers", "Procurement Team"],
        ["3", "Missing Product Weights", "silver.products_harmonized", "~8,200 products", "Product Management Team"],
        ["4", "Lot Number Compliance", "silver.inventory_reconciled", "~2,400 items", "Quality Assurance Team"],
      ]
    ),

    heading("14.2 Campaign Setup Steps", 2),
    para("For each campaign:"),
    numberedItem(1, "Navigate to Data Integration \u2192 Stewardship"),
    numberedItem(2, "Click Create Campaign"),
    numberedItem(3, "Select the source table and define the filter criteria for candidate records"),
    numberedItem(4, "Set the campaign name and description"),
    numberedItem(5, "Assign reviewers (use your own account for demo purposes)"),
    numberedItem(6, "Set the review deadline (30 days from creation for demo)"),
    numberedItem(7, "Activate the campaign"),
    screenshot("Stewardship campaign setup screen showing the candidate record filter and reviewer assignment"),

    calloutBox("For demonstration purposes, resolve a few records in each campaign before the demo to show the workflow. Aim for 5-10 resolved records per campaign to demonstrate the before/after experience.", "success"),
  ];
}

function sectionVerification() {
  return [
    pageBreak(),
    heading("15. Post-Setup Verification"),
    para("After completing all setup steps, use this checklist to verify every component is correctly configured and operational."),

    dataTable(
      ["#", "Component", "Verification Step", "Expected Result"],
      [
        ["1", "Docker Containers", "npm run docker:status", "All containers show 'Up' status"],
        ["2", "PostgreSQL Database", "npm run db:verify", "All tables exist with row counts > 0"],
        ["3", "Kafka Topics", "Open localhost:9021 \u2192 Topics", "mcg.iot.cold-chain and mcg.iot.carrier-events exist"],
        ["4", "config.json", "npm run config:verify", "All required fields populated, API key valid"],
        ["5", "Shared Space", "Open MCG Demo - Development", "Space exists with correct permissions"],
        ["6", "Managed Space", "Open MCG Demo - Published", "Space exists with correct permissions"],
        ["7", "Analytics Apps", "Open each app in the shared space", "Apps load without errors, data is present"],
        ["8", "MCG Dark Theme", "Check app appearance", "Dark navy background with branded colors"],
        ["9", "PostgreSQL Connection", "Test connection in Qlik Cloud", "Connection test succeeds"],
        ["10", "Kafka Connection", "Test connection in Qlik Cloud", "Connection test succeeds"],
        ["11", "Salesforce Connection", "Test connection in Qlik Cloud", "Connection test succeeds"],
        ["12", "Lakehouse (Bronze)", "Check Data Integration \u2192 Lakehouse", "8 pipelines running, data flowing"],
        ["13", "Lakehouse (Silver)", "Check silver schema tables", "8 tables with transformed data"],
        ["14", "Lakehouse (Gold)", "Check gold schema tables", "2 data products with data"],
        ["15", "Data Products", "Data Integration \u2192 Data Products", "2 products registered with Trust Scores"],
        ["16", "Qlik Answers", "Ask a test question", "Returns relevant answer with citations"],
        ["17", "Business Glossary", "Governance \u2192 Business Glossary", "25 terms across 5 categories"],
        ["18", "Automations", "Check automation run history", "Automations executing on schedule"],
        ["19", "Qlik Predict", "Check model status", "Both models deployed and API-enabled"],
        ["20", "Stewardship", "Open stewardship campaigns", "4 campaigns active with candidates"],
      ]
    ),

    calloutBox("Run through this checklist before every demo session to ensure all components are healthy. Pay special attention to items 1-3 (infrastructure) and 12-14 (lakehouse pipelines), as these are most likely to require attention after restarts.", "warning"),
  ];
}

function sectionTroubleshooting() {
  return [
    pageBreak(),
    heading("16. Troubleshooting"),
    para("Common issues encountered during setup and their solutions."),

    dataTable(
      ["Issue", "Possible Cause", "Solution"],
      [
        [
          "Docker containers fail to start",
          "Port conflicts with existing services",
          "Check ports 5432, 9021, 9092, 2181 are free. Stop conflicting services or change ports in docker-compose.yml",
        ],
        [
          "npm run db:schema fails with connection error",
          "PostgreSQL not fully initialized",
          "Wait 15-20 seconds after docker:up, then retry. Check container logs: docker logs mcg-postgres",
        ],
        [
          "API key rejected by Qlik Cloud",
          "Key expired or incorrect tenant URL",
          "Generate a new API key in Qlik Cloud settings. Verify tenantHostname in config.json matches exactly (no https://, no trailing slash)",
        ],
        [
          "App import fails with 'unsupported version'",
          ".qvf built on newer Qlik Analytics version",
          "Ensure your tenant is on the same or newer version than the .qvf was exported from. Contact support if version mismatch persists",
        ],
        [
          "Kafka connection test fails",
          "No network path from Qlik Cloud to local Kafka",
          "Install Qlik Data Gateway \u2014 Direct Access or Data Movement Gateway. Local Kafka is not directly accessible from Qlik Cloud",
        ],
        [
          "Theme not appearing in app",
          "Theme uploaded to wrong scope",
          "Upload theme at tenant level (Settings \u2192 Themes), not at space or app level. Requires Tenant Admin role",
        ],
        [
          "Qlik Answers returns empty results",
          "Document indexing not complete",
          "Wait 10-15 minutes after document upload for indexing. Check knowledge base status shows 'Ready'",
        ],
        [
          "Lakehouse pipeline shows 'Error' status",
          "Source connection credentials changed or expired",
          "Re-test the source data connection. Update credentials if needed. Restart the pipeline",
        ],
        [
          "Predict model training fails",
          "Insufficient data or target column issues",
          "Verify gold table has at least 1,000 rows. Check target column for null values or single-class issues",
        ],
        [
          "Automations not triggering",
          "Incorrect schedule or disabled state",
          "Verify automation is in 'Enabled' state. Check the trigger configuration and timezone settings (UTC recommended)",
        ],
        [
          "Deploy UI not loading at localhost:3939",
          "Port 3939 in use or npm install incomplete",
          "Kill process on port 3939. Re-run npm install and npm run ui",
        ],
        [
          "Docker images fail to pull",
          "Network/proxy restrictions",
          "Configure Docker Desktop proxy settings. Alternatively, pre-pull images: docker-compose pull",
        ],
      ]
    ),

    calloutBox("For issues not covered here, check the project README and the Qlik Community forums. For urgent demo support, contact your Qlik Solutions Engineering team lead.", "info"),
  ];
}

// =============================================================================
// MAIN — Generate the Setup Guide DOCX
// =============================================================================
async function main() {
  console.log("=".repeat(60));
  console.log("  MCG Setup Guide Generator");
  console.log("=".repeat(60));
  console.log();

  const sections = [
    ...titleSection(),
    ...sectionPrerequisites(),
    ...sectionQuickStart(),
    ...sectionInfrastructure(),
    ...sectionTenantConfig(),
    ...sectionSpaces(),
    ...sectionImportApps(),
    ...sectionDataConnections(),
    ...sectionLakehouse(),
    ...sectionDataProducts(),
    ...sectionQlikAnswers(),
    ...sectionGlossary(),
    ...sectionAutomations(),
    ...sectionPredict(),
    ...sectionStewardship(),
    ...sectionVerification(),
    ...sectionTroubleshooting(),
  ];

  const doc = buildQlikDocument("SETUP GUIDE", sections);
  const outPath = path.join(OUT_DIR, "MCG_Setup_Guide.docx");
  await saveDocument(doc, outPath);

  console.log();
  console.log("  Generated setup guide:");
  console.log(`  ${outPath}`);
  console.log();
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
