#!/usr/bin/env node
// =============================================================================
// MCG Creation Guide — Qlik Automations & Pipelines
// =============================================================================
// Generates a Qlik-themed Word document with step-by-step instructions for
// creating all data pipelines, transformation routes, and automations.
//
// Usage:  node generators/gen-creation-guide.js
// Output: documents/MCG_Creation_Guide_Automations_Pipelines.docx
// =============================================================================

const {
  buildQlikDocument, saveDocument,
  metadataTable, dataTable,
  heading, para, labelValue, calloutBox, numberedItem, figure,
  useQlikTheme,
} = require("./mcg-docx-builder");
const deckMedia = require("./lib/deck-media");
const path = require("path");
const { deck, doc, DOCS_DIR } = require("./lib/asset-paths");
const {
  Paragraph, TextRun, PageBreak,
} = require("docx");

const OUT = DOCS_DIR;

// ─── Reusable helpers ────────────────────────────────────────────────────────

/**
 * Screenshot. Resolves the description against generators/screenshots.json and
 * embeds the captured PNG when it exists, else falls back to the original text
 * callout — so the ~12 call sites below never change.
 *
 * Refresh captures with: node generators/capture-tenant-screenshots.js
 */
function screenshot(desc) {
  const hit = deckMedia.resolveShot(desc);
  if (hit) return figure(hit.path, hit.caption || desc);
  return calloutBox(`[Screenshot: ${desc}]`, "info");
}

/** Monospace command block */
function cmd(command) {
  return para(`$  ${command}`, { bold: true, size: 19 });
}

/** Page break */
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// =============================================================================
// DOCUMENT CONTENT
// =============================================================================

function buildCreationGuide() {
  useQlikTheme();

  const sections = [
    // ─── TITLE & METADATA ──────────────────────────────────────────────────
    heading("MCG Demo — Qlik Automations & Pipelines Creation Guide"),

    metadataTable([
      ["Document ID", "MCG-GUIDE-CREATION-001"],
      ["Version", "1.0"],
      ["Date", "March 2026"],
      ["Author", "MCG Data Engineering"],
      ["Classification", "Internal — Demo Setup"],
      ["Scope", "Data Pipelines (Bronze/Silver/Gold) and Qlik Automations"],
    ]),

    para("This guide provides step-by-step instructions for creating all data pipelines, transformation routes, table recipes, and automations in Qlik Cloud for the Meridian Commerce Group demo environment."),

    calloutBox("The primary deployment method for the MCG pipeline is the declarative import (section 1.9): the entire pipeline is version-controlled YAML, deployed over REST APIs by npm run deploy. The manual steps in this guide document the same build interactively — use them to learn the workflow, demo it, or customize beyond what the YAML defines.", "info"),

    calloutBox("Prerequisites: Ensure you have completed the initial setup (tenant configuration, Docker infrastructure, spaces, and data connections) as described in the MCG Setup Guide before following this document.", "warning"),

    // ═══════════════════════════════════════════════════════════════════════
    // PART 1: DATA PIPELINES
    // ═══════════════════════════════════════════════════════════════════════
    pageBreak(),
    heading("Part 1: Data Pipelines"),
    para("The MCG demo uses 8 data pipelines to ingest data from 3 source systems into the Bronze layer of the Open Lakehouse. These pipelines use CDC, streaming, and API-based ingestion methods."),

    // ─── 1.1 Open Lakehouse Creation ────────────────────────────────────
    heading("1.1 Create the Open Lakehouse", 2),
    para("Before creating pipelines, you must create the Open Lakehouse with its three-tier schema structure."),
    numberedItem("1", "Navigate to Data Integration → Data Spaces in the Qlik Cloud hub"),
    numberedItem("2", "Click Create data space and name it \"MCG Open Lakehouse\""),
    numberedItem("3", "Select Qlik-managed storage (or connect your own S3/Azure/GCS bucket)"),
    numberedItem("4", "Create three schemas within the lakehouse:"),
    para("bronze — Raw ingested data from all sources", { bullet: true, indent: true }),
    para("silver — Cleansed and transformed data", { bullet: true, indent: true }),
    para("gold — Governed, business-ready data products", { bullet: true, indent: true }),
    screenshot("Lakehouse creation dialog showing three schemas: bronze, silver, gold"),

    calloutBox("Storage Format: All lakehouse tables use Apache Iceberg format, which supports ACID transactions, time travel, and schema evolution — critical for CDC and streaming workloads.", "info"),

    // ─── 1.2 PostgreSQL CDC Pipelines ────────────────────────────────────
    pageBreak(),
    heading("1.2 PostgreSQL CDC Pipelines (3 Tables)", 2),
    para("These pipelines use Change Data Capture to replicate PostgreSQL WMS data in real-time via the Data Movement Gateway."),

    heading("Prerequisites", 3),
    para("Data Movement Gateway installed and registered with your Qlik Cloud tenant", { bullet: true }),
    para("PostgreSQL connection created and bound to the gateway (see Setup Guide Sections 3.7–3.8, or the steps below)", { bullet: true }),
    para("PostgreSQL configured with wal_level=logical (set in Docker Compose)", { bullet: true }),
    para("Publication mcg_wms_pub exists (created by schema.sql)", { bullet: true }),

    heading("Setting Up the Gateway & Source Connection", 3),
    para("The CDC pipelines below read from a PostgreSQL source connection that routes through the Data Movement gateway. Set that up first — a one-time gateway registration plus a gateway-bound connection created in the Data Integration UI."),
    para("1. Register the Data Movement gateway:", { bold: true }),
    numberedItem(1, "In the MCG Deploy UI → Local Stack & Gateway, click Register Gateway / Get Token to print the registration token (or run agentctl inside the mcg-qlik-dmg container):"),
    cmd('podman exec -it mcg-qlik-dmg bash -lc "cd /opt/qlik/gateway/movement/bin && ./agentctl qcs get_registration"'),
    numberedItem(2, "In Qlik Cloud → Administration → Data Gateways → Register, paste the token, name the gateway, and wait for status Connected."),
    para("2. Create the gateway-bound PostgreSQL connection:", { bold: true }),
    numberedItem(1, "Data Integration → your project → Create connection → PostgreSQL."),
    numberedItem(2, "Select the mcg-qlik-dmg Data Movement gateway, enter the WMS database host/port/database/credentials, then test and save."),
    calloutBox("A Data Movement gateway connection can only be created in the Data Integration UI by selecting the gateway — the public REST API cannot create it, so the MCG deploy script skips it and prints this guidance. Kafka sources need a Data Gateway - Streaming instead. Gateway setup: https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Gateways/dm-gateway-setting-up.htm", "warning"),

    heading("Pipeline 1: inventory_positions", 3),
    numberedItem("1", "Navigate to Data Integration → Data pipelines → Create pipeline"),
    numberedItem("2", "Select \"Replicate data\" as the pipeline type"),
    numberedItem("3", "Choose source: PostgreSQL (MCG WMS) connection"),
    numberedItem("4", "Select table: public.inventory_positions"),
    numberedItem("5", "Set target: MCG Open Lakehouse → bronze schema"),
    numberedItem("6", "Target table name: bronze.inventory_positions"),
    numberedItem("7", "Configure CDC settings:"),
    para("Method: Log-based (WAL)", { bullet: true, indent: true }),
    para("Replication slot: qlik_cdc_slot", { bullet: true, indent: true }),
    para("Plugin: pgoutput", { bullet: true, indent: true }),
    para("Publication: mcg_wms_pub", { bullet: true, indent: true }),
    numberedItem("8", "Set schedule: Full load initially, then continuous CDC replication"),
    numberedItem("9", "Click Save and Run"),
    screenshot("Pipeline configuration for inventory_positions showing CDC settings and target lakehouse"),

    dataTable(
      ["Setting", "Value"],
      [
        ["Source", "PostgreSQL: public.inventory_positions (~8,000 rows)"],
        ["Target", "bronze.inventory_positions (Iceberg)"],
        ["Method", "Log-based CDC (WAL)"],
        ["Schedule", "Real-time CDC + Scheduled merge"],
        ["Data Quality Issues", "Phantom inventory, missing lot numbers, no-TZ timestamps, UoM variants"],
        ["Nightmares Addressed", "#1 Phantom Inventory, #3 Product Master, #5 Timestamps, #7 Compliance"],
      ]
    ),

    heading("Pipeline 2: warehouse_events", 3),
    para("Repeat the same steps as Pipeline 1 with these settings:"),
    dataTable(
      ["Setting", "Value"],
      [
        ["Source", "PostgreSQL: public.warehouse_events (~15,000 rows)"],
        ["Target", "bronze.warehouse_events (Iceberg)"],
        ["Method", "Log-based CDC (WAL)"],
        ["Schedule", "Real-time CDC + Scheduled merge"],
        ["Data Quality Issues", "Silent pipeline gap (events stop Sep 24 for Rotterdam), format variants"],
        ["Nightmares Addressed", "#4 Silent Failures, #5 Timestamps"],
      ]
    ),

    heading("Pipeline 3: shipments", 3),
    para("Repeat the same steps with these settings:"),
    dataTable(
      ["Setting", "Value"],
      [
        ["Source", "PostgreSQL: public.shipments (~3,000 rows)"],
        ["Target", "bronze.shipments (Iceberg)"],
        ["Method", "Log-based CDC (WAL)"],
        ["Schedule", "Real-time CDC + Scheduled merge"],
        ["Data Quality Issues", "6 carrier status vocabularies, mixed datetime formats, weight unit chaos"],
        ["Nightmares Addressed", "#5 Timestamps, #6 Carrier Data"],
      ]
    ),

    calloutBox("Verification: After all 3 CDC pipelines are running, check the Data Movement Gateway status page. You should see 3 active replication tasks with \"Full Load Complete, CDC Active\" status. Use podman exec -i mcg-postgres psql -U mcg_admin -d mcg_wms -c \"SELECT * FROM pg_replication_slots;\" to verify the replication slot is active.", "success"),

    // ─── 1.3 Kafka Streaming Pipelines ──────────────────────────────────
    pageBreak(),
    heading("1.3 Kafka Streaming Pipelines (2 Topics)", 2),
    para("These pipelines stream IoT sensor data from Apache Kafka topics in real-time using the Data Gateway - Streaming."),

    heading("Prerequisites", 3),
    para("Data Gateway - Streaming deployed and connected to Qlik Cloud", { bullet: true }),
    para("Kafka connection created (see Setup Guide Section 7.2)", { bullet: true }),
    para("Docker Kafka stack running: npm run docker:up", { bullet: true }),
    para("IoT simulator producing messages: verify in Confluent Control Center at localhost:9021", { bullet: true }),

    heading("Pipeline 4: Cold Chain IoT (mcg.iot.cold-chain)", 3),
    numberedItem("1", "Navigate to Data Integration → Data pipelines → Create pipeline"),
    numberedItem("2", "Select \"Stream data\" as the pipeline type"),
    numberedItem("3", "Choose source: Apache Kafka (MCG IoT) connection"),
    numberedItem("4", "Select topic: mcg.iot.cold-chain"),
    numberedItem("5", "Set target: MCG Open Lakehouse → bronze schema"),
    numberedItem("6", "Target table name: bronze.iot_cold_chain"),
    numberedItem("7", "Configure streaming settings:"),
    para("Consumer group: qlik-cold-chain-consumer", { bullet: true, indent: true }),
    para("Offset reset: earliest (for initial load)", { bullet: true, indent: true }),
    para("Batch size: 100 messages", { bullet: true, indent: true }),
    para("Flush interval: 5 seconds", { bullet: true, indent: true }),
    numberedItem("8", "Click Save and Run"),
    screenshot("Kafka streaming pipeline for cold chain topic showing real-time message ingestion"),

    dataTable(
      ["Setting", "Value"],
      [
        ["Source", "Kafka topic: mcg.iot.cold-chain (~1 msg per 5 sec per sensor)"],
        ["Target", "bronze.iot_cold_chain (Iceberg append)"],
        ["Method", "Real-time streaming"],
        ["Message Format", "JSON: sensor_id, shipment_id, temperature, humidity, gps, timestamp"],
        ["Data Quality Issues", "5% Fahrenheit readings, 3% bare timestamps, 2% Lagos GPS blackouts"],
        ["Nightmares Addressed", "#4 Silent Failures, #5 Timestamps"],
      ]
    ),

    heading("Pipeline 5: Carrier Events (mcg.iot.carrier-events)", 3),
    para("Repeat the same steps with these settings:"),
    dataTable(
      ["Setting", "Value"],
      [
        ["Source", "Kafka topic: mcg.iot.carrier-events (~1 msg per min)"],
        ["Target", "bronze.iot_carrier_events (Iceberg append)"],
        ["Method", "Real-time streaming"],
        ["Message Format", "JSON: carrier_code, tracking_number, status, timestamp, location"],
        ["Data Quality Issues", "Multi-language status codes, mixed timestamp formats, duplicates"],
        ["Nightmares Addressed", "#6 Carrier Data Black Hole"],
      ]
    ),

    // ─── 1.4 Meridian CRM Pipelines ───────────────────────────────────
    pageBreak(),
    heading("1.4 Meridian CRM Pipelines (3 Objects)", 2),
    para("These pipelines use the MySQL CDC connector to poll data every 15 minutes using last_modified_date for incremental sync."),

    heading("Prerequisites", 3),
    para("MySQL 8.4 running with the crm_* tables created and seeded (npm run docker:up:simulators)", { bullet: true }),
    para("Meridian CRM connection created (see Setup Guide Section 7.3)", { bullet: true }),

    heading("Pipeline 6: Contacts (crm_contacts)", 3),
    numberedItem("1", "Navigate to Data Integration → Data pipelines → Create pipeline"),
    numberedItem("2", "Select \"Replicate data\" as the pipeline type"),
    numberedItem("3", "Choose source: MySQL (Meridian CRM) connection"),
    numberedItem("4", "Select object: Contact"),
    numberedItem("5", "Set target: MCG Open Lakehouse → bronze schema"),
    numberedItem("6", "Target table name: bronze.crm_contacts"),
    numberedItem("7", "Configure sync settings:"),
    para("Initial load: Full", { bullet: true, indent: true }),
    para("Incremental field: last_modified_date", { bullet: true, indent: true }),
    para("Refresh interval: 15 minutes", { bullet: true, indent: true }),
    numberedItem("8", "Click Save and Run"),
    screenshot("Meridian CRM pipeline showing Contact object selection and incremental sync settings"),

    dataTable(
      ["Setting", "Value"],
      [
        ["Source", "Meridian CRM: crm_contacts (~2,000 rows)"],
        ["Target", "bronze.crm_contacts (Iceberg)"],
        ["Method", "Full + Incremental (last_modified_date)"],
        ["Schedule", "Every 15 minutes"],
        ["Data Quality Issues", "11% address format issues, 6% truncated addresses, 3.2% duplicates"],
        ["Nightmares Addressed", "#2 Address Catastrophe"],
      ]
    ),

    heading("Pipeline 7: Orders (crm_orders)", 3),
    para("Repeat with these settings:"),
    dataTable(
      ["Setting", "Value"],
      [
        ["Source", "Meridian CRM: crm_orders (~5,000 rows)"],
        ["Target", "bronze.crm_orders (Iceberg)"],
        ["Method", "Full + Incremental (last_modified_date)"],
        ["Schedule", "Every 15 minutes"],
        ["Data Quality Issues", "42% missing tracking numbers, 41% with WISMO flags"],
        ["Nightmares Addressed", "#2 Address Catastrophe, #6 Carrier Data"],
      ]
    ),

    heading("Pipeline 8: Products (crm_products)", 3),
    para("Repeat with these settings:"),
    dataTable(
      ["Setting", "Value"],
      [
        ["Source", "Meridian CRM: crm_products (~1,200 rows)"],
        ["Target", "bronze.crm_products (Iceberg)"],
        ["Method", "Full + Incremental (last_modified_date)"],
        ["Schedule", "Every 15 minutes"],
        ["Data Quality Issues", "3 SKU schemes, 8,200 missing weights, supplier name variants"],
        ["Nightmares Addressed", "#3 Product Master Mess, #7 Compliance"],
      ]
    ),

    calloutBox("Pipeline Summary: You should now have 8 active pipelines — 3 CDC (real-time), 2 streaming (real-time), and 3 API (15-min polling). All pipelines feed into the bronze schema of the Open Lakehouse.", "success"),

    heading("1.9 Primary Deployment Method: Declarative Pipeline Import (Pipelines as Code)", 2),
    para("This is how the MCG pipelines are actually deployed. Everything in Parts 1–3 of this guide ships as version-controlled YAML under deploy/pipelines/ in two Open Lakehouse projects — mcg-batch-pipeline (WMS CDC + CRM → silver → gold) and mcg-streaming-pipeline (Kafka IoT → silver) — covering landing tasks, all 8 transformation routes with custom SQL, schedules, and connection bindings, deployed without any manual UI work (QTCP declarative pipelines preview)."),
    para("Step 13 of npm run deploy drives the full chain over REST APIs: create connections → validate definitions → create the DI project → import the YAML → resolve bindings → prepare → start every task in dependency order (landing → transform → datamart) → attach the gold datasets to their Data Products. Four config.json flags control it (pipelines.prepare, pipelines.run, pipelines.attachDatasets, pipelines.publishDataProducts), all exposed as toggles on the deploy UI's Data Products page."),
    para("Schedules are declared in each project's YAML, one per task: the CRM landing syncs every 15 minutes, the silver transform is event-triggered, and the gold datamart runs daily at 06:00 UTC — there is no REST endpoint for DI schedules, so the YAML is the source of truth. For a credential-free manual import, npm run pipeline:zip packages one ZIP per project for Data Integration → Import; after refining transformations in the UI, npm run deploy:export-pipeline round-trips them back into the repo."),
    calloutBox("Use the declarative import to stand up a fresh tenant in minutes or reset a demo environment to a known-good state. The manual walkthroughs in Parts 1–3 teach the same build interactively — ideal for learning the Pipeline Designer or customizing beyond the YAML.", "success"),

    // ═══════════════════════════════════════════════════════════════════════
    // PART 2: TRANSFORMATION ROUTES (SILVER LAYER)
    // ═══════════════════════════════════════════════════════════════════════
    pageBreak(),
    heading("Part 2: Transformation Routes (Silver Layer)"),
    para("The Silver layer contains 8 transformation routes (data flows) that cleanse, normalize, and join Bronze data. These are created using Qlik's visual Pipeline Designer with AI-Assisted SQL."),

    heading("2.1 Overview of 8 Transformation Routes", 2),
    dataTable(
      ["Route", "Name", "Input (Bronze)", "Output (Silver)", "Nightmare"],
      [
        ["1", "Timestamp Normalization", "warehouse_events", "warehouse_events_clean", "#5"],
        ["2", "Inventory Reconciliation", "inventory_positions", "inventory_reconciled", "#1, #3, #7"],
        ["3", "Address Standardization", "crm_contacts", "addresses_standardized", "#2"],
        ["4", "Product Harmonization", "crm_products", "products_harmonized", "#3"],
        ["5", "Carrier Canonicalization", "shipments, iot_carrier_events", "shipments_canonical", "#6"],
        ["6", "IoT Normalization", "iot_cold_chain", "iot_normalized", "#4, #5"],
        ["7", "Supplier Deduplication", "crm_products", "suppliers_deduped", "#3"],
        ["8", "Order-to-Delivery Timeline", "crm_orders, shipments", "order_delivery_timeline", "#5, #6"],
      ]
    ),

    // ─── Route 1 ────────────────────────────────────────────────────────
    heading("2.2 Route 1: Timestamp Normalization", 2),
    para("Normalizes all 14 different timestamp conventions found across the 3 source systems into a single UTC standard with source tracking."),

    heading("Create the Data Flow", 3),
    numberedItem("1", "Navigate to Data Integration → Transformations → Create transformation"),
    numberedItem("2", "Name: \"Route 1 — Timestamp Normalization\""),
    numberedItem("3", "Source table: Select bronze.warehouse_events (the event stream carrying all 9 DCs' local-time stamps)"),
    numberedItem("4", "Use AI-Assisted SQL or visual designer to apply transformations"),
    numberedItem("5", "Target: silver.warehouse_events_clean"),

    heading("Transformation Logic", 3),
    para("The following transformations are applied:"),
    para("ISO 8601 with offset (e.g., 2025-10-18T14:32:00+02:00) → Convert to UTC directly", { bullet: true }),
    para("Bare timestamp without timezone (e.g., 2025-10-18 14:32:00) → Apply DC timezone lookup table, then convert to UTC", { bullet: true }),
    para("Correios format (DD/MM/YYYY HH:MM) → Parse with BRT timezone, convert to UTC", { bullet: true }),
    para("Epoch milliseconds → Convert to ISO 8601 UTC", { bullet: true }),
    para("IoT timestamps → Preserve millisecond precision during conversion", { bullet: true }),

    heading("Key Output Columns", 3),
    dataTable(
      ["Column", "Type", "Description"],
      [
        ["event_id", "VARCHAR", "Event identifier from the WMS"],
        ["event_type", "VARCHAR", "Canonicalized event type (RECEIVE/PICK/ADJUST/CYCLE_COUNT/SHIP)"],
        ["event_timestamp", "TIMESTAMP", "Original local-time stamp as recorded by the DC"],
        ["tz_offset_hours", "INTEGER", "Timezone offset applied per warehouse (audit trail)"],
        ["event_timestamp_utc", "TIMESTAMP", "Final normalized UTC timestamp"],
        ["location_bin", "VARCHAR", "Bin reference normalized to dash-separated format"],
      ]
    ),
    screenshot("Timestamp normalization data flow showing bronze.warehouse_events transformed into silver.warehouse_events_clean with UTC audit columns"),

    // ─── Route 2 ────────────────────────────────────────────────────────
    heading("2.3 Route 2: Inventory Reconciliation", 2),
    para("Reconciles WMS inventory positions with ERP data, detects phantom inventory, and calculates trust scores."),

    heading("Transformation Steps", 3),
    numberedItem("1", "Profile: Detect nulls, negative values, UoM variants"),
    numberedItem("2", "UoM Standardize: CS, PAL, EACH, EA, ea → canonical EA/CS/PAL"),
    numberedItem("3", "Storage Zone Normalize: KALT/FROID → CHILLED, GEFRIER → FROZEN"),
    numberedItem("4", "Phantom Flag: If WMS < ERP by >10% → phantom_inventory = TRUE; If WMS = 0 but ERP > 0 → phantom_critical = TRUE"),
    numberedItem("5", "Lot Compliance: If lot_number IS NULL AND category is perishable → lot_missing = TRUE"),
    numberedItem("6", "Trust Score: 1.0 = all fields OK; 0.7 = minor issues; 0.3 = phantom flagged; 0.1 = logic error"),

    dataTable(
      ["Column", "Type", "Description"],
      [
        ["location_id", "VARCHAR(20)", "Warehouse location identifier"],
        ["sku", "VARCHAR(30)", "Product SKU"],
        ["qty_wms", "INTEGER", "WMS quantity on hand"],
        ["qty_erp", "INTEGER", "ERP expected quantity"],
        ["variance", "INTEGER", "qty_wms - qty_erp"],
        ["variance_pct", "DECIMAL", "Variance as percentage"],
        ["phantom_inventory", "BOOLEAN", "TRUE if variance > 10%"],
        ["phantom_critical", "BOOLEAN", "TRUE if WMS=0 but ERP>0"],
        ["uom_standard", "VARCHAR(5)", "Standardized unit of measure"],
        ["storage_zone_standard", "VARCHAR(15)", "Standardized zone name"],
        ["lot_missing", "BOOLEAN", "TRUE if perishable with NULL lot"],
        ["trust_score", "DECIMAL(3,2)", "Row-level data quality score (0.0-1.0)"],
      ]
    ),

    // ─── Route 3 ────────────────────────────────────────────────────────
    heading("2.4 Route 3: Address Standardization & Deduplication", 2),
    para("Normalizes customer addresses from Meridian CRM, detects truncation artifacts, and deduplicates customer records using fuzzy matching."),

    heading("Transformation Steps", 3),
    numberedItem("1", "Country Normalize: Netherlands/Niederlande → NL, Singapore → SG"),
    numberedItem("2", "Postal Code Rules: NL: 1017EJ → 1017 EJ; BR: 01304001 → 01304-001"),
    numberedItem("3", "Street Normalize: Str. → Straße, Apt → Apartment, Ste → Suite"),
    numberedItem("4", "Accent Restore: Sao Paulo → São Paulo, Muller → Müller"),
    numberedItem("5", "Truncation Detect: Flag addresses exactly 30 characters (legacy POS truncation)"),
    numberedItem("6", "Fuzzy Dedup: >90% match → auto-merge; 85-90% → route to Stewardship; <85% → distinct"),

    heading("Route 3a: Talend Address Validation Job (Reusable Service)", 3),
    para("This route uses a Talend Cloud job as a callable service for advanced address validation:"),
    para("AddressStandardizer (custom Java routine) — parse free-text address, repair country to ISO 3166, canonicalize postal codes, expand abbreviations, score 0.0-1.0", { bullet: true }),
    para("BulkGeocoder (custom Java routine) — one bulk call geocodes the batch via public OSM Nominatim behind a 1 req/s limiter, with dedupe cache and retry backoff", { bullet: true }),
    para("Routing gate — GPS resolved goes to S3 then Iceberg silver.addresses_geocoded; unresolved goes to the Address Cleanup stewardship sprint", { bullet: true }),
    para("These replace the subscription-only tAddressRowStandardize / tAddressRowValidate / tGeocode chain — no Talend Data Quality subscription and no licensed postal reference data required.", { bullet: true }),
    calloutBox("The Talend Address Validation job is also invoked by Automation 5 (Address Correction Loop) when stewardship tasks are approved.", "info"),

    // ─── Route 4 ────────────────────────────────────────────────────────
    heading("2.5 Route 4: Product Master Harmonization", 2),
    para("Resolves SKU conflicts across 3 legacy schemes, standardizes weights and dimensions, and harmonizes product categories across languages."),

    heading("Transformation Steps", 3),
    numberedItem("1", "SKU Resolution: If MCG-* exists → use as canonical; Otherwise create mapping via GTIN/EAN match"),
    numberedItem("2", "Weight Validation: Flag NULL, zero, or implausible values (>100 kg)"),
    numberedItem("3", "Dimension Fix: Detect inches-as-cm (if length<30 AND width<20 AND source=Americas → convert)"),
    numberedItem("4", "Category Harmonize: Map German/Dutch/French categories → English"),
    numberedItem("5", "Supplier Normalize: Standardize supplier names for dedup"),

    dataTable(
      ["Column", "Type", "Description"],
      [
        ["canonical_sku", "VARCHAR(30)", "MCG canonical SKU identifier"],
        ["legacy_sku_am", "VARCHAR(30)", "Americas legacy SKU"],
        ["legacy_sku_eu", "VARCHAR(30)", "Europe legacy SKU"],
        ["product_name_en", "VARCHAR(100)", "English product name"],
        ["weight_kg", "DECIMAL(8,2)", "Standardized weight in kilograms"],
        ["weight_missing_flag", "BOOLEAN", "TRUE if weight was NULL/zero"],
        ["supplier_id", "VARCHAR(20)", "Canonical supplier identifier"],
        ["country_of_origin", "VARCHAR(3)", "ISO 3166-1 alpha-2 country code"],
        ["trust_score", "DECIMAL(3,2)", "Row-level data quality score"],
      ]
    ),

    // ─── Route 5 ────────────────────────────────────────────────────────
    heading("2.6 Route 5: Carrier Status Canonicalization", 2),
    para("Maps 6 different carrier status vocabularies (FedEx English, DPD German, Correios Portuguese, NinjaVan, Aramex, local Lagos courier) into a single MCG canonical standard."),

    heading("Status Mapping Table", 3),
    dataTable(
      ["MCG Canonical", "FedEx", "DPD (German)", "Correios (Portuguese)", "NinjaVan"],
      [
        ["LABEL_CREATED", "LABEL_CREATED", "Paketankündigung", "Objeto postado", "Pending Pickup"],
        ["PICKED_UP", "pickup", "Abgeholt", "Coletado", "Picked Up"],
        ["IN_TRANSIT", "transit", "In Zustellung", "Em trânsito", "Arrived at Hub"],
        ["OUT_FOR_DELIVERY", "out_for_delivery", "In Auslieferung", "Saiu para entrega", "On Vehicle"],
        ["DELIVERED", "delivered", "Zugestellt", "Objeto entregue", "Completed"],
        ["FAILED_ATTEMPT", "failure", "Zustellversuch", "Não entregue", "Pending Reschedule"],
      ]
    ),

    heading("Additional Transformations", 3),
    para("Datetime Parse: ISO 8601 → parse directly; DD/MM/YYYY HH:MM (Correios) → parse with BRT; Epoch ms → convert", { bullet: true }),
    para("Exception Code Normalize: ADDR_INCOMPLETE/ZS_FEHLER/CEP_INVALIDO → ADDRESS_INVALID", { bullet: true }),
    para("Weight Normalize: Convert lbs → kg where carrier = FedEx", { bullet: true }),
    para("Country Normalize: Full name → ISO 3166-1 alpha-2", { bullet: true }),

    // ─── Route 6 ────────────────────────────────────────────────────────
    heading("2.7 Route 6: IoT Telemetry Normalization", 2),
    para("Normalizes IoT cold chain sensor data, detects measurement gaps, and flags temperature exceedances with product-specific thresholds."),

    heading("Transformation Steps", 3),
    numberedItem("1", "Temperature Normalize: If temperature_unit='F' → convert: (value - 32) × 5/9"),
    numberedItem("2", "Timestamp Normalize: Apply Route 1 logic to IoT timestamps"),
    numberedItem("3", "Gap Detection: Flag >30-minute gaps between consecutive readings for same sensor"),
    numberedItem("4", "Shipment Enrich: Join shipment_id to silver.shipments_canonical for route/carrier context"),
    numberedItem("5", "Exceedance Flag (product-specific thresholds):"),
    para("Fresh produce: >8°C for 30+ minutes → exceedance = TRUE", { bullet: true, indent: true }),
    para("Dairy: >8°C for 15+ minutes → exceedance = TRUE", { bullet: true, indent: true }),
    para("Frozen: > -15°C any reading → exceedance = TRUE", { bullet: true, indent: true }),
    numberedItem("6", "Battery Alert: If battery_level_pct < 10% → battery_low = TRUE"),
    numberedItem("7", "Kafka Dedup: Remove at-least-once delivery duplicates (same sensor_id + timestamp)"),

    // ─── Route 7 ────────────────────────────────────────────────────────
    heading("2.8 Route 7: Supplier Master Deduplication", 2),
    para("Deduplicates supplier records using Jaro-Winkler fuzzy matching and selects golden records."),

    heading("Transformation Steps", 3),
    numberedItem("1", "Extract: Pull supplier names and IDs from bronze.crm_products"),
    numberedItem("2", "Normalize: Lowercase, strip suffixes (Ltd, PLC, Corp, S.A., Co., Inc.)"),
    numberedItem("3", "Accent Normalize: Nestlé → nestle for matching purposes"),
    numberedItem("4", "Fuzzy Match (Jaro-Winkler similarity): >95% → auto-merge; 85-95% → route to Stewardship; <85% → distinct"),
    numberedItem("5", "Golden Record Selection: Prefer SAP Global (SUP-*) ID as canonical"),
    numberedItem("6", "Output: Mapping table (source_supplier_id → canonical_supplier_id)"),

    // ─── Route 8 ────────────────────────────────────────────────────────
    heading("2.9 Route 8: Order-to-Delivery Timeline", 2),
    para("Assembles end-to-end order lifecycle from order placement through delivery, joining data from 4 Silver tables."),

    heading("Transformation Steps", 3),
    numberedItem("1", "Join: orders → shipments via order_id"),
    numberedItem("2", "Timeline Build (4 milestones): order_placed_utc (Meridian CRM), picked_utc (warehouse_events), shipped_utc (shipments), delivered_utc (shipments)"),
    numberedItem("3", "Duration Calc: Order-to-delivery hours, pick-to-ship hours, ship-to-deliver hours"),
    numberedItem("4", "SLA Check: Compare actual to promised delivery → sla_met = TRUE/FALSE"),
    numberedItem("5", "IoT Enrich: If cold chain shipment, attach max_temperature, exceedance_flag, spoilage_probability"),

    screenshot("Order-to-Delivery Timeline data flow showing 4 Silver source joins and timeline assembly"),

    // ═══════════════════════════════════════════════════════════════════════
    // PART 3: GOLD LAYER TABLE RECIPES
    // ═══════════════════════════════════════════════════════════════════════
    pageBreak(),
    heading("Part 3: Gold Layer Table Recipes"),
    para("The Gold layer contains 2 governed data products created from Silver sources using Qlik Table Recipes. Each product is registered with an owner, AI-generated description, and API sharing enabled."),

    heading("3.1 Creating Table Recipes", 2),
    numberedItem("1", "Navigate to Data Integration → Transformations → Create transformation"),
    numberedItem("2", "Select \"Table recipe\" as the type"),
    numberedItem("3", "Choose Silver source tables as inputs"),
    numberedItem("4", "Define aggregations, joins, and filters"),
    numberedItem("5", "Set target in the gold schema"),
    numberedItem("6", "Configure refresh schedule"),
    screenshot("Table Recipe builder showing Silver inputs, transformation logic, and Gold output"),

    heading("3.2 Two Gold Data Products", 2),
    para("The pipeline creates one gold mart per analytics domain app — these are the demo's two data products, matching the gold-datamart datasets in the declarative project:"),
    dataTable(
      ["Gold Table", "Source Silver Tables", "Refresh", "Owner", "Key Metrics"],
      [
        ["supply_chain_health",      "inventory_reconciled, warehouse_events_clean",                            "Daily 06:00 UTC", "Henrik Jansen",  "IRA %, phantom_units, pipeline_status, trust_score by DC"],
        ["last_mile_performance",    "order_delivery_timeline, shipments_canonical, addresses_standardized",   "Daily 06:00 UTC", "Sophie Müller",  "on_time_pct, sla_met, address_quality_score, wismo_flag by carrier/region"],
      ]
    ),

    heading("3.3 Register as Data Products", 2),
    para("After creating each Gold table recipe, register it as a governed data product:"),
    numberedItem("1", "Open the Gold table in the Data Catalog"),
    numberedItem("2", "Click \"Register as Data Product\""),
    numberedItem("3", "Set the product owner (see table above)"),
    numberedItem("4", "Click \"Generate AI Description\" to auto-generate metadata from schema and data"),
    numberedItem("5", "Review and confirm semantic types (auto-detected: currency, percentage, temperature, timestamp, etc.)"),
    numberedItem("6", "Enable API Sharing to make the product available via REST API"),
    numberedItem("7", "Publish to the Data Marketplace for self-service discovery"),
    screenshot("Data Product registration showing AI-generated description, semantic types, and API sharing toggle"),

    calloutBox("Trust Score: Each data product automatically receives a Qlik Trust Score based on 5 dimensions: Freshness (how recently data was updated), Completeness (null rate on key fields), Accuracy (validation rule pass rate), Consistency (cross-table reconciliation), and Timeliness (pipeline SLA adherence). The Trust Score is visible in the Data Marketplace and helps consumers evaluate data fitness for use.", "info"),

    // ═══════════════════════════════════════════════════════════════════════
    // PART 4: QLIK AUTOMATIONS
    // ═══════════════════════════════════════════════════════════════════════
    pageBreak(),
    heading("Part 4: Qlik Automations"),
    para("The MCG demo includes 5 automations that demonstrate real-time alerting, scheduled operations, and closed-loop data quality workflows. All automations are built using Qlik Automate's no-code block-based designer."),

    heading("4.1 Prerequisites", 2),
    para("Qlik Cloud tenant with Automations entitlement enabled", { bullet: true }),
    para("Microsoft Teams connector configured in Qlik Automate", { bullet: true }),
    para("Teams channels created: #mcg-cold-chain-alerts, #mcg-data-engineering, #mcg-customer-ops", { bullet: true }),
    para("Teams Incoming Webhook connector configured for each channel (see Section 4.7)", { bullet: true }),
    para("All data connections active and refreshing", { bullet: true }),
    para("Gold layer data products populated", { bullet: true }),

    heading("4.2 Automation Overview", 2),
    dataTable(
      ["#", "Automation", "Trigger", "Action", "Target Channel"],
      [
        ["1", "Daily App Reload", "Schedule: 06:00 UTC daily", "Reload both analytics apps", "N/A (Qlik Cloud)"],
        ["2", "Cold Chain Alert", "Every 5 min: temp > 8°C for 15+ min", "Post Adaptive Card to Teams", "#mcg-cold-chain-alerts"],
        ["3", "Pipeline Health Summary", "Schedule: 07:00 UTC daily", "Post summary card to Teams", "#mcg-data-engineering"],
        ["4", "Stewardship Sprint Summary", "Schedule: 07:00 UTC daily", "Read the Address Cleanup sprint summary", "Run title / digest"],
        ["5", "Address Correction Loop", "Stewardship task approved", "Trigger Talend job, update, notify", "#mcg-data-engineering"],
      ]
    ),

    // ─── Automation 1 ───────────────────────────────────────────────────
    pageBreak(),
    heading("4.3 Automation 1: Daily App Reload", 2),
    para("Reloads both MCG analytics apps (Supply Chain Operations and Delivery & Customer Experience) every morning at 06:00 UTC before business hours."),

    heading("Create the Automation", 3),
    numberedItem("1", "Navigate to Automations → Create automation"),
    numberedItem("2", "Name: \"MCG Daily App Reload\""),
    numberedItem("3", "Add blocks in this order:"),
    screenshot("Automation builder showing the 5-block Daily App Reload flow"),

    heading("Block Configuration", 3),
    dataTable(
      ["Block #", "Type", "Configuration"],
      [
        ["1", "Scheduled Start", "Cron: 0 6 * * * (Daily at 06:00 UTC)"],
        ["2", "Qlik Cloud → List Items", "Filter: resourceType=\"app\", spaceId=<Development space ID>"],
        ["3", "Control → For Each", "Iterate over the app list from Block 2"],
        ["4", "Qlik Cloud → Reload App", "App ID: {{current.resourceId}}, Wait for completion: YES"],
        ["5", "Control → If/Else", "If status != \"succeeded\" → send error notification via Teams or Email"],
      ]
    ),

    calloutBox("Testing: Use the \"Run Now\" button to test before enabling the schedule. Check the Run History tab for execution logs. If a reload fails, verify that the app owner has valid data connection credentials.", "info"),

    // ─── Automation 2 ───────────────────────────────────────────────────
    heading("4.4 Automation 2: Cold Chain Alert → Teams", 2),
    para("Monitors IoT cold chain data every 5 minutes. When a temperature exceedance lasting 15+ minutes is detected, an Adaptive Card is posted to the #mcg-cold-chain-alerts Teams channel."),

    heading("Create the Automation", 3),
    numberedItem("1", "Navigate to Automations → Create automation"),
    numberedItem("2", "Name: \"MCG Cold Chain Alert → Teams\""),
    numberedItem("3", "Add 5 blocks as described below"),

    heading("Block Configuration", 3),
    dataTable(
      ["Block #", "Type", "Configuration"],
      [
        ["1", "Scheduled Start", "Cron: */5 * * * * (Every 5 minutes)"],
        ["2", "Qlik Cloud → Query Data", "Silver Table: silver.iot_normalized; Filter: exceedance_minutes >= 15 AND alert_sent = false; Fields: shipment_id, route, carrier, max_temp_celsius, exceedance_minutes, estimated_loss_usd, product_type"],
        ["3", "Control → Condition", "If result_count > 0 → continue; else → end"],
        ["4", "Control → Loop", "Iterate over query results"],
        ["5", "Microsoft Teams → Post Adaptive Card", "See card template below"],
      ]
    ),

    heading("Adaptive Card Template", 3),
    para("The Teams Adaptive Card displays the following information:"),
    para("Header: Cold Chain Alert — Temperature Exceedance (with warning icon)", { bullet: true }),
    para("Shipment ID, Route, Carrier (dynamic from query results)", { bullet: true }),
    para("Max Temperature (highlighted in red if > 8°C)", { bullet: true }),
    para("Duration of exceedance in minutes", { bullet: true }),
    para("Estimated exposure cost in USD", { bullet: true }),
    para("Action note: \"Contact carrier immediately. See SOP-SC-002 Section 4.\"", { bullet: true }),
    para("Action buttons: Open Cold Chain Dashboard, View Procedure (SOP-SC-002)", { bullet: true }),

    heading("Post-Alert: Mark as Alerted", 3),
    para("After sending the alert, update the data product to prevent duplicate alerts:"),
    para("Add a 6th block: Qlik Cloud → Update Data", { bullet: true }),
    para("Set alert_sent = true WHERE shipment_id = '${shipment_id}'", { bullet: true }),

    calloutBox("The automation JSON template is available at deploy/automations/teams_cold_chain_alert.json. You can import this directly into the automation builder as a starting point.", "info"),
    screenshot("Cold Chain Alert automation showing all 6 blocks with condition and loop logic"),

    // ─── Automation 3 ───────────────────────────────────────────────────
    heading("4.5 Automation 3: Pipeline Health Summary → Teams", 2),
    para("Posts a daily pipeline health summary to the #mcg-data-engineering Teams channel at 07:00 UTC, showing connection status, data freshness, and trust scores."),

    heading("Block Configuration", 3),
    dataTable(
      ["Block #", "Type", "Configuration"],
      [
        ["1", "Scheduled Start", "Cron: 0 7 * * * (Daily at 07:00 UTC)"],
        ["2", "Qlik Cloud → REST API", "GET /api/v1/data-connections — Retrieve all connection statuses and last sync times"],
        ["3", "Qlik Cloud → Query Data", "Data Product: Supply Chain Health; Aggregate: COUNT by pipeline_status, AVG(trust_score), MAX(sync_lag_minutes)"],
        ["4", "Control → Variable", "Compose the summary template from Block 2 and Block 3 results"],
        ["5", "Microsoft Teams → Post Adaptive Card", "Channel: #mcg-data-engineering; See card structure below"],
      ]
    ),

    heading("Adaptive Card Contents", 3),
    para("Header: MCG Pipeline Health — Daily Summary", { bullet: true }),
    para("Status counts: Healthy (count), Degraded (count), Failed (count)", { bullet: true }),
    para("Data freshness: PostgreSQL last sync, Kafka last sync, Meridian CRM last sync", { bullet: true }),
    para("Trust Scores: Inventory, Addresses, Products, Shipments (each with score)", { bullet: true }),
    para("Action button: Open Pipeline Monitor dashboard", { bullet: true }),

    calloutBox("The automation JSON template is available at deploy/automations/teams_pipeline_health.json.", "info"),

    // ─── Automation 4 ───────────────────────────────────────────────────
    heading("4.6 Automation 4: Stewardship Sprint Summary", 2),
    para("Reads the Address Cleanup sprint summary once a day and titles the run with it. This is the read-only half of the address-correction loop - safe to enable in a demo, and it proves the sprint is live without mutating anything."),

    heading("Block Configuration", 3),
    dataTable(
      ["Block #", "Type", "Configuration"],
      [
        ["1", "Scheduled Start", "Cron: 0 7 * * * (Daily at 07:00 UTC)"],
        ["2", "API Key connector → Raw API request", "GET data-governance/sprints/<sprintId>/external-integrations/sprint-summary"],
        ["3", "Update run title", "Title the run with the sprint state"],
      ]
    ),

    // ─── Automation 5 ───────────────────────────────────────────────────
    pageBreak(),
    heading("4.7 Automation 5: Address Correction Loop (Talend)", 2),
    para("This is the most complex automation — a closed-loop workflow that triggers a Talend Address Validation job when stewardship tasks are approved, then updates data and notifies the team."),

    heading("Block Configuration", 3),
    dataTable(
      ["Block #", "Type", "Configuration"],
      [
        ["1", "Event Trigger", "Stewardship Task Completed (webhook or 15-min polling)"],
        ["2", "Qlik Cloud → REST API", "Collect approved record IDs from stewardship batch"],
        ["3", "Talend → Run Job", "POST /api/v1/talend/jobs/<address-validation-job-id>/run with parameters: input_source=stewardship_batch, record_ids, source_table=silver.addresses_standardized"],
        ["4", "Control → Wait + Poll", "Every 30 seconds, timeout 10 minutes, check job status"],
        ["5", "Control → Verify", "Check records_processed, records_corrected, avg_confidence_score"],
        ["6", "Qlik Cloud → Update", "Mark stewardship tasks as \"Resolved\" or \"Needs Manual Review\""],
        ["7", "Microsoft Teams → Post Card", "Post results to #mcg-data-engineering with correction count and confidence"],
        ["8", "Qlik Cloud → Trigger Refresh", "Refresh downstream tables: silver.order_delivery_timeline, gold.last_mile_performance"],
      ]
    ),

    heading("Talend Job Parameters", 3),
    dataTable(
      ["Parameter", "Value"],
      [
        ["input_source", "stewardship_batch"],
        ["record_ids", "{{approvedRecords.ids}} (from Block 2)"],
        ["source_table", "silver.addresses_standardized"],
        ["write_back", "true"],
        ["validation_services", "PostNL, USPS, Correios"],
      ]
    ),

    calloutBox("This automation demonstrates the closed-loop data quality cycle: Stewardship → Talend Validation → Silver Update → Gold Refresh → Predict Model Retrain. It's the most impactful demo for showing how human-in-the-loop governance connects to automated correction.", "info"),
    calloutBox("Full Talend job design: deploy/talend/BUILD_BULK_ADDRESS_JOB.md — mcg_crm_address_validate_bulk, five subjobs scheduled in TMC. It pulls CRM contacts, repairs and scores each address with the AddressStandardizer routine, geocodes the whole batch in ONE bulk call via public OSM Nominatim (1 req/s, dedupe cache, retry backoff, wall-clock budget), then routes on GPS resolution: resolved rows are written as timestamped CSV to S3 and loaded downstream into the Apache Iceberg table silver.addresses_geocoded; unresolved rows go to the Address Cleanup stewardship sprint. Run npm run talend:zip to produce the Studio import bundle.", "success"),
    screenshot("Address Correction Loop automation showing all 8 blocks from stewardship trigger through Gold refresh"),

    // ─── Teams Webhook Setup ────────────────────────────────────────────
    heading("4.8 Microsoft Teams Webhook Setup", 2),
    para("All Teams-connected automations require an Incoming Webhook configured for each target channel."),

    heading("Steps to Create a Webhook", 3),
    numberedItem("1", "In Microsoft Teams, navigate to the target channel (e.g., #mcg-cold-chain-alerts)"),
    numberedItem("2", "Click the channel name → Manage channel → Connectors (or Workflows in newer Teams versions)"),
    numberedItem("3", "Search for \"Incoming Webhook\" and click Configure"),
    numberedItem("4", "Name the webhook (e.g., \"MCG Qlik Alerts\") and optionally upload the MCG logo"),
    numberedItem("5", "Click Create and copy the generated webhook URL"),
    numberedItem("6", "Paste the webhook URL into the automation's Teams block configuration"),
    numberedItem("7", "Also add the URL to deploy/config.json under automations.teamsWebhookUrl"),

    calloutBox("Create separate webhooks for each Teams channel: one for #mcg-cold-chain-alerts (Automation 2), one for #mcg-data-engineering (Automations 3 and 5), and one for #mcg-customer-ops (Automation 4).", "warning"),
    screenshot("Teams channel connector settings showing Incoming Webhook configuration"),

    // ─── Testing ────────────────────────────────────────────────────────
    heading("4.9 Testing Automations", 2),
    numberedItem("1", "Always test with Run Now before enabling the schedule"),
    numberedItem("2", "Check the Run History tab for execution logs and block-level outputs"),
    numberedItem("3", "Use the Debug panel to inspect individual block inputs and outputs"),
    numberedItem("4", "For Teams blocks, verify the webhook URL by testing with a manual curl command first"),
    numberedItem("5", "Start all automations in Disabled state, test manually, then enable schedules"),

    // ═══════════════════════════════════════════════════════════════════════
    // PART 5: VERIFICATION & TROUBLESHOOTING
    // ═══════════════════════════════════════════════════════════════════════
    pageBreak(),
    heading("Part 5: Verification & Troubleshooting"),

    heading("5.1 Complete Pipeline Checklist", 2),
    dataTable(
      ["Component", "Expected Status", "Verification Step"],
      [
        ["CDC Pipeline 1 (inventory)", "Full Load Complete, CDC Active", "Check DMG status page"],
        ["CDC Pipeline 2 (events)", "Full Load Complete, CDC Active", "Check DMG status page"],
        ["CDC Pipeline 3 (shipments)", "Full Load Complete, CDC Active", "Check DMG status page"],
        ["Streaming Pipeline 4 (cold chain)", "Running, messages flowing", "Check Confluent Control Center"],
        ["Streaming Pipeline 5 (carrier events)", "Running, messages flowing", "Check Confluent Control Center"],
        ["Meridian CRM Pipeline 6 (contacts)", "Last sync < 15 min ago", "Check connection status in hub"],
        ["Meridian CRM Pipeline 7 (orders)", "Last sync < 15 min ago", "Check connection status in hub"],
        ["Meridian CRM Pipeline 8 (products)", "Last sync < 15 min ago", "Check connection status in hub"],
        ["Silver Routes 1-8", "All transformations completed", "Check Data Integration > Transformations"],
        ["Gold Table Recipes (2)", "All recipes producing output", "Check Data Catalog for row counts"],
        ["Data Products (2)", "All registered with Trust Score", "Check Data Marketplace"],
        ["Automation 1 (Reload)", "Disabled (or scheduled)", "Check Automations > Run History"],
        ["Automation 2 (Cold Chain)", "Disabled (test first)", "Run Now > verify Teams card"],
        ["Automation 3 (Pipeline Health)", "Disabled (test first)", "Run Now > verify Teams card"],
        ["Automation 4 (WISMO)", "Disabled (test first)", "Run Now > verify Teams message"],
        ["Automation 5 (Address Loop)", "Disabled (test first)", "Run Now > verify Talend trigger"],
      ]
    ),

    heading("5.2 Common Issues & Solutions", 2),
    dataTable(
      ["Issue", "Likely Cause", "Solution"],
      [
        ["CDC not capturing changes", "WAL level not set to logical", "Set wal_level=logical in PostgreSQL config; restart container"],
        ["Replication slot not active", "Gateway not connected", "Check DMG agent status; re-register if needed"],
        ["Kafka messages not flowing", "Consumer group offset issue", "Reset consumer group offset to earliest; check topic permissions"],
        ["Meridian CRM sync fails", "Gateway cannot reach the database", "Check the host resolves FROM the gateway container, and that qlik_cdc still has REPLICATION CLIENT"],
        ["Teams card not posting", "Webhook URL invalid", "Recreate webhook connector in Teams channel"],
        ["Automation times out", "Query too slow", "Increase timeout in block settings; optimize Gold table query"],
        ["Talend job fails", "Wrong job ID or credentials", "Verify Talend API endpoint and job ID in automation block"],
        ["Duplicate alerts", "Missing alert_sent flag", "Add update block to set alert_sent = true after sending"],
        ["Gold table empty", "Silver dependencies not ready", "Verify all upstream Silver tables have data before running recipe"],
        ["Trust Score low", "Data quality issues upstream", "Check Silver data profiling; resolve Bronze data quality issues"],
      ]
    ),
  ];

  // screenshot() returns an array (image + caption), so flatten one level.
  return buildQlikDocument("CREATION GUIDE", sections.flat());
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log("\n  Generating MCG Creation Guide — Automations & Pipelines...\n");
  const doc = buildCreationGuide();
  await saveDocument(doc, path.join(OUT, "MCG_Creation_Guide_Automations_Pipelines.docx"));
  console.log("\n  Done.\n");
}

main().catch(err => {
  console.error("ERROR:", err);
  process.exit(1);
});
