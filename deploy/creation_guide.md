# MCG Full Stack Demo — Qlik Cloud Creation Guide

Step-by-step creation instructions for building Lakehouse tables, Data Products, Analytics Apps (Qlik Analytics), and Predict model deployments in Qlik Cloud. This guide assumes prerequisites from `setup_guide.md` Section 1 are complete and data sources are connected.

> **Reference:** The demo PowerPoint deck (`MCG_Demo_Overview_Four_Stories.pptx`) provides visual prototypes and slide designs for each component described below. Use the deck's 4-story structure (Integration, Governance, Analytics, AI) as the presentation framework for the built environment.

---

## Table of Contents

1. [Open Lakehouse Tables](#1-open-lakehouse-tables)
   - [1.1 Create Lakehouse Storage](#11-create-lakehouse-storage)
   - [1.2 Bronze Layer — Raw Ingestion Pipelines](#12-bronze-layer--raw-ingestion-pipelines)
   - [1.3 Silver Layer — Transformation Data Flows](#13-silver-layer--transformation-data-flows)
   - [1.4 Gold Layer — Table Recipes](#14-gold-layer--table-recipes)
2. [Data Products](#2-data-products)
   - [2.1 Register Data Products](#21-register-data-products)
   - [2.2 Enable API Sharing](#22-enable-api-sharing)
   - [2.3 Data Marketplace](#23-data-marketplace)
3. [Analytics Apps (Qlik Analytics)](#3-analytics-apps-qlik-sense)
   - [3.1 Data Flows & Table Recipes in Analytics](#31-data-flows--table-recipes-in-analytics)
   - [3.2 App Architecture — Domain-Based Design](#32-app-architecture--domain-based-design)
   - [3.3 App 1: MCG Supply Chain Operations](#33-app-1-mcg-supply-chain-operations)
   - [3.4 App 2: MCG Delivery & Customer Experience](#34-app-2-mcg-delivery--customer-experience)
   - [3.5 Business Logic & Qlik Answers](#35-business-logic--qlik-answers)
   - [3.6 Theme, Section Access & Publishing](#36-theme-section-access--publishing)
4. [Qlik Predict Deployments](#4-qlik-predict-deployments)
   - [4.1 Model 1: Cold Chain Exceedance](#41-model-1-cold-chain-exceedance)
   - [4.2 Model 2: Late Delivery Predictor](#42-model-2-late-delivery-predictor)
   - [4.3 Model API Sharing](#43-model-api-sharing)
5. [Agentic Data Engineering — Build-Side AI (Preview)](#5-agentic-data-engineering--build-side-ai-preview)
   - [5.1 Declarative Data Pipelines in VS Code](#51-declarative-data-pipelines-in-vs-code)
   - [5.2 Data Product Agent](#52-data-product-agent)
   - [5.3 Data Quality Agent](#53-data-quality-agent)
   - [5.4 Catalog and Business Glossary Agent](#54-catalog-and-business-glossary-agent)

---

## 1. Open Lakehouse Tables

### 1.1 Create Lakehouse Storage

**Navigate to:** Data Integration → Open Lakehouse → Create Storage

| Setting | Value |
|---|---|
| **Name** | `MCG Demo Lakehouse` |
| **Storage type** | Qlik-managed (or bring your own S3/Azure Blob/GCS) |
| **Region** | Same region as your Qlik Cloud tenant |

**Create three schemas:**

1. Click **Create Schema** → Name: `bronze` → Description: "Raw landing zone — dirty data as-is from source systems"
2. Click **Create Schema** → Name: `silver` → Description: "Cleansed, standardized data — output of transformation routes"
3. Click **Create Schema** → Name: `gold` → Description: "Business-ready data products — aggregated and governed"

**Verify:** All three schemas appear under your Lakehouse storage in the left panel.

---

### 1.2 Bronze Layer — Raw Ingestion Pipelines

Create 8 landing pipelines that replicate source data into the Bronze layer without transformation.

> **Cluster Architecture:** MCG uses two separate Qlik data pipeline clusters:
> - **CDC Cluster** — Handles PostgreSQL change data capture (Pipelines 1-3) and Meridian CRM incremental sync (Pipelines 6-8)
> - **Streaming Cluster** — Handles real-time Kafka ingestion from IoT topics `mcg.iot.cold-chain` and `mcg.iot.carrier-events` (Pipelines 4-5)

#### Pipeline 1-3: PostgreSQL CDC → Bronze (CDC Cluster)

**Navigate to:** Data Integration → Data Pipelines → Create Pipeline

| Setting | Value |
|---|---|
| **Pipeline type** | Replicate (Change Data Capture) |
| **Cluster** | CDC Cluster |
| **Source connection** | `MCG WMS Database` (PostgreSQL) |
| **Target** | `MCG Demo Lakehouse` → Schema: `bronze` |
| **Mode** | Full Load + CDC (ongoing changes) |

**Step-by-step:**

1. Click **Create Pipeline** → Select source: `MCG WMS Database`
2. Select target: `MCG Demo Lakehouse`
3. Select tables to replicate:

| Source Table | Target Table | Notes |
|---|---|---|
| `public.inventory_positions` | `bronze.inventory_positions` | Real-time CDC |
| `public.warehouse_events` | `bronze.warehouse_events` | Real-time CDC |
| `public.shipments` | `bronze.shipments` | Real-time CDC |

4. Under **Task Settings**:
   - Full Load: Enabled (initial snapshot)
   - CDC: Enabled (ongoing WAL-based changes)
   - Store changes: Apply changes to target (merge mode)
5. Click **Save & Run**
6. Wait for Full Load to complete → verify row counts match source

#### Pipeline 4-5: Kafka Streaming → Bronze (Streaming Cluster)

**Navigate to:** Data Integration → Data Pipelines → Create Streaming Pipeline

| Setting | Value |
|---|---|
| **Pipeline type** | Streaming |
| **Cluster** | Streaming Cluster |
| **Source connection** | `MCG IoT Telemetry` (Kafka) |
| **Target** | `MCG Demo Lakehouse` → Schema: `bronze` |
| **Mode** | Continuous streaming (append) |

**Step-by-step:**

1. Click **Create Pipeline** → Select source: `MCG IoT Telemetry` (Kafka)
2. Select target: `MCG Demo Lakehouse`
3. Subscribe to topics:

| Kafka Topic | Target Table | Notes |
|---|---|---|
| `mcg.iot.cold-chain` | `bronze.iot_cold_chain` | ~1 msg/5s per sensor |
| `mcg.iot.carrier-events` | `bronze.iot_carrier_events` | ~1 msg/min |

4. Under **Message Parsing**:
   - Format: JSON
   - Schema inference: Enabled (auto-detect fields from first messages)
   - Nested field handling: Flatten to columns
5. Click **Save & Run**
6. Verify messages are flowing by checking the target table row count

#### Pipeline 6-8: Meridian CRM (MySQL CDC) → Bronze (CDC Cluster)

**Navigate to:** Data Integration → Data Pipelines → Create Landing Pipeline

| Setting | Value |
|---|---|
| **Pipeline type** | SaaS Landing |
| **Cluster** | CDC Cluster |
| **Source connection** | `MCG CRM Database` (MySQL, gateway-bound) |
| **Target** | `MCG Demo Lakehouse` → Schema: `bronze` |
| **Mode** | Full + Incremental (based on `last_modified_date`) |

**Step-by-step:**

1. Click **Create Pipeline** → Select source: `MCG CRM Database`
2. Select target: `MCG Demo Lakehouse`
3. Select objects to land:

| CRM table | Target Table | Refresh |
|---|---|---|
| `crm_contacts` | `bronze.crm_contacts` | Every 15 min |
| `crm_orders` | `bronze.crm_orders` | Every 15 min |
| `crm_products` | `bronze.crm_products` | Every 15 min |

4. Under **Scheduling**:
   - Mode: Incremental (use `last_modified_date` for change detection)
   - Interval: 15 minutes
   - Initial load: Full snapshot first, then incremental
5. Click **Save & Run**
6. Verify initial full load completes → check record counts

#### Bronze Verification Checklist

| Table | Expected Records | Verify |
|---|---|---|
| `bronze.inventory_positions` | ~5,000 | Row count in Lakehouse browser |
| `bronze.warehouse_events` | ~20,000 | Row count |
| `bronze.shipments` | ~8,000 | Row count |
| `bronze.iot_cold_chain` | Growing (streaming) | New rows arriving |
| `bronze.iot_carrier_events` | Growing (streaming) | New rows arriving |
| `bronze.crm_contacts` | ~2,000 | Row count |
| `bronze.crm_orders` | ~5,000 | Row count |
| `bronze.crm_products` | ~1,200 | Row count |

**Total: 8 Bronze tables**

---

### 1.3 Silver Layer — Transformation Data Flows

Create 8 data flows (plus 1 Talend job) in the Pipeline Designer that transform Bronze data into cleansed Silver tables. Each data flow implements one transformation route.

> **Integration Capabilities Used:**
> - **Transformation Flows** — Visual data flow designer for building Bronze → Silver → Gold pipelines
> - **AI-Assisted SQL** — Use Qlik's AI SQL assistant to generate transformation SQL from natural language (e.g., "normalize all timestamps to UTC" → generates the SQL conversion logic)
> - **Datamart Automation** — Automate the creation and refresh of Silver and Gold datamarts from transformation outputs. Configure via Data Integration → Datamart → Create:
>   - Select Silver/Gold tables as datamart targets
>   - Set refresh schedule aligned with upstream pipeline cadence
>   - Enable automated schema evolution (new Bronze columns propagate to Silver)
>   - Monitor datamart health in the pipeline dashboard
> - **Talend Job** — Reusable address validation service (see Data Flow 3a below)

#### Data Flow 1: Timestamp Normalization (Cross-Cutting)

**Runs first — all other routes depend on normalized timestamps.**

**Navigate to:** Data Integration → Data Flows → Create Data Flow

| Setting | Value |
|---|---|
| **Name** | `MCG - Timestamp Normalization` |
| **Input tables** | `bronze.inventory_positions`, `bronze.warehouse_events`, `bronze.shipments`, `bronze.iot_cold_chain` |
| **Output table** | `silver.warehouse_events_clean` |
| **Schedule** | Triggered after every Bronze refresh |

**Pipeline Designer Steps:**

1. **Add Sources** — Drag 4 Bronze tables onto the canvas
2. **Add tMap component** — Read all timestamp columns from each source
3. **Add Lookup** — Join `warehouse_id` / `location_id` to a reference table:

   | DC ID | Timezone | UTC Offset |
   |---|---|---|
   | DC-RTD-01 | Europe/Amsterdam | +1 |
   | DC-MUN-01 | Europe/Berlin | +1 |
   | DC-LON-01 | Europe/London | +0 |
   | DC-ATL-01 | America/New_York | -5 |
   | DC-CHI-01 | America/Chicago | -6 |
   | DC-SIN-01 | Asia/Singapore | +8 |
   | DC-TYO-01 | Asia/Tokyo | +9 |
   | DC-GRU-01 | America/Sao_Paulo | -3 |
   | DC-LOS-01 | Africa/Lagos | +1 |

4. **Add Normalize component** — Convert all timestamps to UTC:
   - If ISO 8601 with offset → convert to UTC
   - If bare timestamp (no TZ) → apply DC timezone lookup, then convert
   - If Correios `DD/MM/YYYY HH:MM` → parse with BRT timezone
   - If LOCAL-LOS informal `Oct 15 2025` → parse with WAT timezone
   - Preserve original value in `_original` column
5. **Add Output** — Write to `silver.warehouse_events_clean`:
   - Columns: `source_table`, `source_column`, `original_value`, `detected_timezone`, `normalized_utc`, `conversion_method`
6. **Save & Run**

#### Data Flow 2: Inventory Reconciliation & Quality

| Setting | Value |
|---|---|
| **Name** | `MCG - Inventory Reconciliation` |
| **Input** | `bronze.inventory_positions` (with normalized timestamps) |
| **Output** | `silver.inventory_reconciled` |
| **Nightmares** | #1 (Phantom Inventory), #3 (Product Master), #7 (Compliance) |

**Pipeline Designer Steps:**

1. **Source** — `bronze.inventory_positions`
2. **UoM Standardize** — Map unit of measure variants:
   - `CS`, `cs`, `Case` → `CS`
   - `PAL`, `Pallet`, `PLT` → `PAL`
   - `EACH`, `EA`, `ea`, `UNIT`, `PK` → `EA`
3. **Storage Zone Normalize** — Map zone variants:
   - `KALT`, `FROID`, `KÄLTE` → `CHILLED`
   - `GEFRIER`, `FRZ`, `FROZEN` → `FROZEN`
   - `AMB`, `ROOM_TEMP`, `AMBIENT` → `AMBIENT`
4. **Phantom Flag** — Add calculated column:
   - `phantom_inventory = TRUE` when `quantity_on_hand` exceeds ERP reference by >10%
   - `phantom_critical = TRUE` when WMS=0 but ERP > 0
5. **Negative Check** — Flag `logic_error = TRUE` where `quantity_on_hand < 0`
6. **Lot Compliance** — Flag `lot_missing = TRUE` where `lot_number IS NULL` AND product is Grocery/Fresh
7. **Trust Score** — Add calculated column (0.0 – 1.0):
   - 1.0 = all fields present, no flags
   - 0.7 = minor issues (UoM was corrected)
   - 0.3 = phantom inventory flagged
   - 0.1 = logic error (negative qty)
8. **Output** → `silver.inventory_reconciled`

**Output columns:** All original columns + `unit_of_measure_clean`, `storage_zone_clean`, `phantom_inventory`, `phantom_critical`, `logic_error`, `lot_missing`, `trust_score`

#### Data Flow 3: Address Standardization & Dedup

| Setting | Value |
|---|---|
| **Name** | `MCG - Address Standardization` |
| **Input** | `bronze.crm_contacts`, `bronze.crm_orders` |
| **Output** | `silver.addresses_standardized` |
| **Nightmare** | #2 (Address Catastrophe) |

**Pipeline Designer Steps:**

1. **Sources** — `bronze.crm_contacts` joined with `bronze.crm_orders` on `contact_id`
2. **Country Normalize** — Map variants to ISO 3166 codes:
   - `Netherlands`, `Niederlande`, `Nederland`, `NL` → `NL`
   - `Singapore`, `SG` → `SG`
   - `Brazil`, `Brasil`, `BR` → `BR`
3. **Postal Code Standardize** — Apply country-specific rules:
   - NL: `1017EJ` → `1017 EJ` (insert space after 4 digits)
   - BR: `01304001` → `01304-001` (insert hyphen)
   - US: Validate ZIP format (5 or 9 digits)
4. **Street Normalize** — Expand abbreviations:
   - `Str.` → `Straße`, `Apt` → `Apartment`, `Ste` → `Suite`
5. **Accent Restore** — Where possible:
   - `Sao Paulo` → `São Paulo`, `Muller` → `Müller`
6. **Truncation Detect** — Flag addresses exactly 30 characters (legacy POS truncation)
7. **Fuzzy Dedup** — Match on name + postal code + street number:
   - \>90% confidence → auto-merge to surviving record
   - 85-90% → route to Stewardship sprint
   - <85% → treat as distinct
8. **Address Quality Score** — Per-record score (0.0 – 1.0):
   - 1.0 = complete, validated, no truncation
   - 0.7 = minor format correction applied
   - 0.4 = truncated but correctable
   - 0.2 = incomplete / unvalidatable
9. **Output** → `silver.addresses_standardized`

#### Talend Job: Address Validation Service

> **Integration Feature:** This is a dedicated **Talend job** that provides address validation as a reusable service, called by Data Flow 3 and available for other flows.

| Setting | Value |
|---|---|
| **Name** | `MCG - Address Validation Service` |
| **Type** | Talend Job (Qlik Talend Cloud) |
| **Input** | Raw address fields from any source (street, city, state, postal, country) |
| **Output** | Validated address + quality score + geocoordinates |
| **Called by** | Data Flow 3 (Address Standardization), Data Flow 8 (Order Timeline) |

**Talend Job Design:**

1. **tMysqlInput** — pull Contact records (incremental on `last_modified_date`, batch-limited)
2. **`AddressStandardizer`** (custom Java routine, `tJavaRow`):
   - Parse free-text address into structured components
   - Repair country names to ISO 3166
   - Canonicalize postal codes per country rules
   - Expand abbreviations (`Str.` → `Straße`, `Cj` → `STE`), extract unit/floor
   - Score the result 0.0 – 1.0 and emit a JSON list of every correction applied
3. **`BulkGeocoder`** (custom Java routine, `tJava`) — **one bulk call for the whole batch**:
   - Public OSM Nominatim, no API key, behind a shared 1 req/s rate limiter
   - Dedupes identical addresses, retries 429/503 with backoff, honours a wall-clock budget
   - Never throws — anything it cannot resolve simply arrives without GPS
4. **Routing gate** (`tMap`, filters are exact complements so no row is lost or duplicated):
   - `latitude != null && longitude != null` → S3 → Iceberg `silver.addresses_geocoded`
   - otherwise → the **Address Cleanup** stewardship sprint
5. **tOutput** — Return validated record:
   - `street_clean`, `city_clean`, `state_clean`, `postal_clean`, `country_iso`
   - `validation_status`, `confidence_score`, `geocode_lat`, `geocode_lon`
   - `corrections_applied` (JSON array of changes made)

> Replaces the subscription-only `tAddressRowStandardize` → `tAddressRowValidate` → `tGeocode`
> chain: no Talend Data Quality subscription, no licensed postal reference data, no API key.
> The routines compile clean on JDK 17 and are unit-tested.

**Deployment:**
- `npm run talend:zip` packages the routines, the context group, the build spec and the Iceberg
  DDL into `deploy/talend/mcg_crm_address_validate_bulk.zip`
- Import in Studio: **File → Import items → Select archive file** (see `IMPORT.md` in the zip)
- Build the five-subjob canvas from `deploy/talend/BUILD_BULK_ADDRESS_JOB.md` §3
- Schedule in TMC; can be reused by any future flow that processes addresses

**Automation Integration — Closing the Data Quality Loop:**
This Talend job is also triggered automatically by the **MCG Address Correction automation** (see `automation_guide.md` Automation 5). When a steward approves address records in the Address Cleanup stewardship sprint, the automation:
1. Reads corrected records from `GET /api/data-governance/sprints/{sprintId}/external-integrations/records`
2. Invokes this Talend job with those records as input
3. Writes corrected addresses back to `silver.addresses_standardized`
4. Marks the records consumed via `.../records/actions/consume` and notifies Teams

> **Gateway limit:** the Qlik Cloud Services *raw API request* block only routes `/api/v1/*`.
> `/api/data-governance/*` returns 404 *Unknown Service* from inside an automation, so those two
> calls must go through the **API Key** connector against the public tenant hostname (or be made
> by the Talend job itself, where a plain API key works). Verified by live runs.

This creates a complete data quality remediation loop:
```
Source (dirty) → Data Flow 3 (standardize) → Stewardship (human review)
    → Automation (trigger Talend job) → Silver (corrected) → Gold → Predict
```

#### Data Flow 4: Product Master Harmonization

| Setting | Value |
|---|---|
| **Name** | `MCG - Product Master Harmonization` |
| **Input** | `bronze.crm_products` |
| **Output** | `silver.products_harmonized` |
| **Nightmare** | #3 (Product Master Mess) |

**Pipeline Designer Steps:**

1. **Source** — `bronze.crm_products`
2. **SKU Resolution** — Create canonical mapping:
   - If `sku` starts with `MCG-` → use as canonical
   - If only `legacy_sku_americas` (`AM-*`) or `legacy_sku_eu` (`EU-*`) → create MCG mapping
   - Triple-SKU products: merge attributes, prefer MCG values
   - Output column: `canonical_sku`
3. **Weight Validation** — Flag issues:
   - `weight_missing = TRUE` where `weight_kg IS NULL`
   - `weight_invalid = TRUE` where `weight_kg = 0` or `> 100`
4. **Category Harmonize** — Map German/Dutch category names to English:
   - `Kabellose Kopfhörer` → `Wireless Headphones`
   - Product names: preserve original in `product_name_original`, add `product_name_en`
5. **Supplier Name Normalize** — First-pass grouping:
   - Strip suffixes: `Ltd`, `PLC`, `Corp`, `S.A.`, `Co.`, `Inc.`
   - Lowercase for matching
6. **Country of Origin** — Flag `origin_missing = TRUE` for food SKUs where `country_of_origin IS NULL`
7. **Output** → `silver.products_harmonized`

#### Data Flow 5: Carrier Status Canonicalization

| Setting | Value |
|---|---|
| **Name** | `MCG - Carrier Status Canonicalization` |
| **Input** | `bronze.shipments`, `bronze.iot_carrier_events` |
| **Output** | `silver.shipments_canonical` |
| **Nightmare** | #6 (Carrier Data Black Hole) |

**Pipeline Designer Steps:**

1. **Sources** — `bronze.shipments` joined with `bronze.iot_carrier_events` on `tracking_number + carrier_code`
2. **Status Mapping** — Map all 6 carrier vocabularies to MCG canonical lifecycle:

   | MCG Canonical | FEDEX | DHL | DPD | NINJAVAN | CORREIOS | LOCAL-LOS |
   |---|---|---|---|---|---|---|
   | `LABEL_CREATED` | LABEL_CREATED | shipment_info | Paketankündigung | Pending Pickup | Objeto postado | registered |
   | `PICKED_UP` | PICKED_UP | pickup | Abgeholt | Picked Up | Coletado | collected |
   | `IN_TRANSIT` | IN_TRANSIT | transit | In Zustellung | Arrived at Hub | Em trânsito | moving |
   | `OUT_FOR_DELIVERY` | ON_VEHICLE | out_for_delivery | In Auslieferung | On Vehicle | Saiu para entrega | on the way |
   | `DELIVERED` | DELIVERED | delivered | Zugestellt | Completed | Objeto entregue | delivered ok |
   | `FAILED_ATTEMPT` | DELIVERY_EXCEPTION | failure | Zustellversuch | Pending Reschedule | Não entregue | not delivered |

3. **Datetime Parse** — Normalize `status_datetime` string to TIMESTAMPTZ:
   - ISO 8601 → parse directly
   - `DD/MM/YYYY HH:MM` (Correios) → parse with BRT timezone
   - `Oct 18 2025` (LOCAL-LOS) → parse with WAT timezone
   - Epoch milliseconds → convert to ISO
4. **Weight Normalize** — Convert `lbs`/`lb`/`LBS` to kg
5. **Country Normalize** — `Niederlande` → `NL`, `Netherlands` → `NL`
6. **Exception Code Map** — Carrier codes to MCG standard:
   - `ADDR_INCOMPLETE`/`ZS_FEHLER`/`CEP_INVALIDO` → `ADDRESS_INVALID`
   - `UNIT_MISSING`/`P/NOT IN` → `RECIPIENT_NOT_FOUND`
7. **Output** → `silver.shipments_canonical`

#### Data Flow 6: IoT Telemetry Normalization

| Setting | Value |
|---|---|
| **Name** | `MCG - IoT Telemetry Normalization` |
| **Input** | `bronze.iot_cold_chain` |
| **Output** | `silver.iot_normalized` |
| **Nightmares** | #4 (Silent Pipelines), #5 (Timestamps) |

**Pipeline Designer Steps:**

1. **Source** — `bronze.iot_cold_chain`
2. **Temperature Normalize** — If `temperature_unit = 'F'`: convert to Celsius `(value - 32) × 5/9`; set all to `°C`
3. **Timestamp Normalize** — Apply timezone rules from Data Flow 1; fill millisecond precision
4. **Gap Detection** — Flag `data_gap = TRUE` for >30-minute gaps between consecutive readings for same `sensor_id`
5. **Shipment Enrich** — Join `shipment_id` to `silver.shipments_canonical` for route/carrier context
6. **Exceedance Flag** — Apply product-type temperature thresholds:
   - Fresh produce: >8°C for 30+ min → `exceedance = TRUE`
   - Dairy: >8°C for 15+ min → `exceedance = TRUE`
   - Frozen: > -15°C any reading → `exceedance = TRUE`
7. **Battery Alert** — `battery_low = TRUE` where `battery_level_pct < 10`
8. **Kafka Dedup** — Remove at-least-once duplicates (same `sensor_id` + `timestamp`)
9. **Output** → `silver.iot_normalized`

#### Data Flow 7: Supplier Master Deduplication

| Setting | Value |
|---|---|
| **Name** | `MCG - Supplier Master Dedup` |
| **Input** | `bronze.crm_products` (supplier fields) |
| **Output** | `silver.suppliers_deduped` |
| **Nightmare** | #3 (Product Master Mess) |

**Pipeline Designer Steps:**

1. **Source** — Extract unique supplier records from `bronze.crm_products` (`supplier_name`)
2. **Normalize** — Lowercase, strip legal suffixes (`Ltd`, `PLC`, `Corp`, `S.A.`, `Co.`, `Inc.`)
3. **Accent Normalize** — `Nestlé` → `nestle` for matching purposes
4. **Fuzzy Match** — Jaro-Winkler similarity on normalized names:
   - \>95% → auto-merge
   - 85-95% → route to Stewardship sprint
   - <85% → treat as distinct
5. **Golden Record** — For each group, select surviving record:
   - Prefer SAP Global (`SUP-*`) ID as canonical
   - Merge attributes from all duplicates
6. **Cross-Reference** — Output mapping: `source_supplier_name → canonical_supplier_id → canonical_name`
7. **Output** → `silver.suppliers_deduped`

**Expected result:** ~80 supplier groups reduced from ~200 raw variants (e.g., Samsung ×4, Nestlé ×3, Unilever ×3)

#### Data Flow 8: Order-to-Delivery Unified Timeline

| Setting | Value |
|---|---|
| **Name** | `MCG - Order to Delivery Timeline` |
| **Input** | `bronze.crm_orders`, `silver.shipments_canonical`, `silver.iot_normalized`, `silver.inventory_reconciled` |
| **Output** | `silver.order_delivery_timeline` |
| **Nightmares** | #5 (Timestamps), #6 (Carrier Black Hole) |

**Pipeline Designer Steps:**

1. **Join** — Link orders → shipments via `order_id`
2. **Timeline Build** — For each order, extract milestone timestamps:
   - `order_placed_utc` (from Meridian CRM `order_date`)
   - `picked_utc` (from `warehouse_events` via inventory)
   - `shipped_utc` (from `shipments_canonical`)
   - `delivered_utc` (from `shipments_canonical`)
3. **Duration Calc** — Add calculated columns:
   - `order_to_delivery_hours` = `delivered_utc - order_placed_utc`
   - `pick_to_ship_hours` = `shipped_utc - picked_utc`
   - `ship_to_deliver_hours` = `delivered_utc - shipped_utc`
4. **SLA Check** — Compare `actual_delivery` to `promised_delivery`:
   - `sla_met = TRUE` if delivered on or before promise
   - `sla_met = FALSE` if delivered late or undelivered
5. **IoT Enrich** — If cold chain shipment, attach `max_temperature`, `exceedance_flag` from `silver.iot_normalized`
6. **Output** → `silver.order_delivery_timeline`

#### Silver Verification Checklist

| Table | Created By | Expected Result |
|---|---|---|
| `silver.warehouse_events_clean` | Data Flow 1 | Cross-reference of all timestamp conversions |
| `silver.inventory_reconciled` | Data Flow 2 | Inventory with phantom flags, trust scores |
| `silver.addresses_standardized` | Data Flow 3 | Deduplicated customers with address quality scores |
| `silver.products_harmonized` | Data Flow 4 | Unified product catalog with canonical SKUs |
| `silver.shipments_canonical` | Data Flow 5 | Shipments with standardized lifecycle stages |
| `silver.iot_normalized` | Data Flow 6 | IoT readings in Celsius/UTC with exceedance flags |
| `silver.suppliers_deduped` | Data Flow 7 | Deduplicated supplier master |
| `silver.order_delivery_timeline` | Data Flow 8 | Unified order timelines with SLA calculations |

**Total: 8 Silver tables**

---

### 1.4 Gold Layer — Table Recipes

Gold tables aggregate Silver data into business-ready data products. Each is built as a **Table Recipe** in the Lakehouse.

**Navigate to:** Data Integration → Open Lakehouse → `gold` schema → Create Table Recipe

#### Table Recipe 1: `gold.supply_chain_health`

| Setting | Value |
|---|---|
| **Description** | Inventory accuracy + pipeline health KPIs per DC and SKU |
| **Input** | `silver.inventory_reconciled`, `silver.warehouse_events_clean` |
| **Refresh** | Every 15 minutes |
| **Consumers** | Supply Chain Operations App, Discovery Agent |

**Recipe Steps:**

1. **Aggregate** `silver.inventory_reconciled` by `location_id`:
   - `total_skus = COUNT(DISTINCT sku)`
   - `phantom_count = SUM(phantom_inventory)`
   - `ira_pct = 1 - (phantom_count / total_skus)`
   - `negative_qty_count = SUM(logic_error)`
   - `avg_trust_score = AVG(trust_score)`
2. **Join** pipeline health status from `silver.warehouse_events_clean`:
   - `last_sync_utc` = MAX(normalized_utc) per source
   - `pipeline_status` = `HEALTHY` if last sync < 30 min ago, `DEGRADED` if 30-60 min, `FAILED` if > 60 min
3. **Output columns:** `dc_id`, `dc_name`, `region`, `total_skus`, `phantom_count`, `ira_pct`, `negative_qty_count`, `lot_missing_count`, `avg_trust_score`, `pipeline_status`, `last_sync_utc`, `snapshot_timestamp`

#### Table Recipe 2: `gold.last_mile_performance`

| Setting | Value |
|---|---|
| **Description** | Carrier SLA metrics + address quality by region |
| **Input** | `silver.shipments_canonical`, `silver.order_delivery_timeline`, `silver.addresses_standardized` |
| **Refresh** | Every 30 minutes |
| **Consumers** | Delivery & Customer Experience App, Predict Model 2 |

**Recipe Steps:**

1. **Join** shipments → orders → customers on `order_id` and `contact_id`
2. **Aggregate** by `carrier_code` + `destination_country`:
   - `total_shipments = COUNT(*)`
   - `on_time_count = SUM(sla_met)`
   - `on_time_pct = on_time_count / total_shipments`
   - `avg_delivery_hours = AVG(ship_to_deliver_hours)`
   - `failed_attempts = SUM(delivery_attempts > 1)`
   - `avg_address_quality = AVG(address_quality_score)`
3. **Output columns:** `carrier`, `destination_country`, `destination_region`, `total_shipments`, `on_time_pct`, `avg_delivery_hours`, `failed_attempts`, `avg_address_quality`, `wismo_rate`, `sla_target_hours`, `snapshot_timestamp`

#### Gold Verification Checklist

| Table | Refresh | Key Metric to Verify |
|---|---|---|
| `gold.supply_chain_health` | 15 min | IRA percentage per DC |
| `gold.last_mile_performance` | 30 min | On-time delivery % by carrier |

**Total: 2 Gold tables**

---

## 2. Data Products

### 2.1 Register Data Products

**Navigate to:** Data Integration → Data Products → Create

Register each Gold table as a governed Data Product with metadata, ownership, and SLA.

| # | Data Product Name | Source Table | Owner | Tags | SLA |
|---|---|---|---|---|---|
| 1 | **Supply Chain Health** | `gold.supply_chain_health` | Henrik Jansen (VP Warehouse Ops) | `inventory`, `phantom`, `pipeline-health` | Every 15 min |
| 2 | **Last Mile Performance** | `gold.last_mile_performance` | Sophie Müller (EU Logistics Mgr) | `carrier`, `sla`, `delivery` | Every 30 min |

**For each data product:**

1. Click **Create Data Product**
2. Enter name and description
3. Select source table from Gold layer
4. Set **Owner** (business owner, not technical)
5. Add **Tags** for discoverability
6. Set **SLA** (refresh frequency commitment)
7. Add **Description** (business context, what questions this data answers)
8. **AI-Driven Descriptions** — Use Qlik's AI-generated metadata:
   - Click **Generate Description** to auto-create a rich description from the data product's schema and sample data
   - AI analyzes column names, types, distributions, and relationships to produce business-friendly descriptions
   - Review and refine the AI-generated text, then publish
   - AI also suggests **column-level descriptions** for each field (e.g., `ira_pct` → "Inventory Record Accuracy — percentage of SKU/location combinations where system count matches physical")
9. Enable **Trust Score** — verify dimensions populate:
   - Validity, Completeness, Discoverability, Usage
   - Enterprise: also Accuracy, Diversity, Timeliness

### 2.2 Semantic Types & AI-Suggested Validation Rules

**Navigate to:** Data Product → Schema → Semantic Types

Qlik automatically detects **semantic types** for data product columns. Review and confirm for governance:

| Column Example | Detected Semantic Type | AI-Suggested Validation Rule |
|---|---|---|
| `dc_id` | Identifier | Not null, matches pattern `DC-[A-Z]{3}-\d{2}` |
| `ira_pct` | Percentage | Range 0.0 – 1.0 |
| `avg_temp_celsius` | Temperature | Range -40.0 – 60.0 |
| `carrier` | Categorical | Must be one of: FEDEX, DHL-EXPRESS, DPD, NINJAVAN, CORREIOS, LOCAL-LOS |
| `destination_country` | Country Code (ISO 3166) | 2-letter ISO code, not null |
| `weight_kg` | Weight (metric) | Positive numeric, > 0 |
| `exceedance_probability` | Score | Range 0.0 – 1.0 (Predict model output) |
| `tracking_number` | Tracking ID | Pattern varies by carrier |
| `lot_number` | Batch ID | Required for perishable products |
| `email` | Email Address | Valid email format |

**Step-by-step:**

1. Open a data product → **Schema** tab
2. Review AI-detected semantic types for each column
3. Confirm or override incorrect detections
4. Review **AI-suggested validation rules** — Qlik analyzes data distributions and suggests:
   - Range constraints (min/max for numerics)
   - Pattern matching (regex for IDs, codes)
   - Referential integrity (FK relationships)
   - Completeness requirements (not-null for critical fields)
5. Accept, modify, or reject each suggested rule
6. Enable rule enforcement → violations route to **Stewardship sprints** (see `setup_guide.md` Section 9)

### 2.3 Enable API Sharing

API sharing is a key governance capability — it provides controlled, governed access to data products for external consumers while maintaining lineage, audit trails, and Trust Score visibility.

For data products that need external consumption:

**Navigate to:** Data Product → Settings → API Sharing → Enable

| Data Product | API Sharing | Use Case |
|---|---|---|
| Supply Chain Health | ✅ Enable | Discovery Agent, MCP Server, external dashboards |
| Last Mile Performance | ✅ Enable | Predict model training, partner portals |

**API endpoint format:**
```
GET https://<tenant>.qlikcloud.com/api/v1/data-products/<id>/data
```

**Test with curl:**
```bash
curl -H "Authorization: Bearer <api-key>" \
  "https://<tenant>.qlikcloud.com/api/v1/data-products/<id>/data?filter=dc_id eq 'DC-RTD-01'"
```

### 2.4 Data Marketplace

**Navigate to:** Data Governance → Data Marketplace

1. Enable the Data Marketplace on your tenant
2. Verify both data products appear in the self-service portal
3. Add rich descriptions for business user discoverability:
   - **Supply Chain Health:** "Real-time inventory accuracy, phantom inventory alerts, and pipeline health for all 9 DCs"
   - **Last Mile Performance:** "Carrier SLA metrics, delivery success rates, and address quality scores by region"
4. Test: business user can browse, search by tag, and request access

---

## 3. Analytics Apps (Qlik Analytics)

### 3.1 Data Flows & Table Recipes in Analytics

Data Flows and Table Recipes are central to the analytics experience — they define how data moves from Bronze through Silver to Gold, and are visible to analysts within the Qlik Cloud analytics environment.

**Data Flows (Transformation Flows):**
- Built in the Pipeline Designer (visual drag-and-drop)
- 8 transformation flows feed the Silver layer (see Section 1.3 above)
- Analysts can view flow lineage, execution history, and data freshness from within the analytics hub
- Flows appear in Impact Analysis when tracing data product origins

**Table Recipes:**
- Built in the Lakehouse → Gold schema
- 7 table recipes aggregate Silver data into Gold data products (see Section 1.4 above)
- Table Recipes are visible in the app data model, showing how Gold tables are derived
- Analysts can trace from a dashboard KPI → Gold table → Table Recipe → Silver table → Data Flow → Bronze source

**AI-Assisted SQL in Analytics:**
- When building custom Table Recipes, use the **AI SQL Assistant** to generate transformation SQL from natural language prompts
- Example: "Calculate the average delivery time by carrier and region for the last 90 days" → generates the SQL join + aggregation
- AI SQL is available in the Pipeline Designer and the Data Load Editor within Qlik Analytics apps

> **Demo tip:** Show the full lineage path in the analytics hub: Bronze → Data Flow → Silver → Table Recipe → Gold → Data Product → Analytics App → Dashboard KPI. This demonstrates the full stack from raw data to business insight.

### 3.2 App Architecture — Domain-Based Design

Instead of one app per data product, MCG uses a **domain-based architecture** with two analytics apps. Each app connects to multiple Gold-layer data products and streaming Lakehouse tables, providing a holistic view within its business domain.

| App | Domain | Data Sources | Primary Users |
|---|---|---|---|
| **MCG Supply Chain Operations** | Internal operations: inventory, pipeline health | **Gold:** `supply_chain_health` | VP Warehouse Ops, Supply Chain Team |
| | | **Streaming:** `mcg.iot.cold-chain`, `mcg.iot.carrier-events` (via Bronze/Silver for real-time monitoring) | |
| **MCG Delivery & Customer Experience** | External delivery: last mile, SLA, address quality | **Gold:** `last_mile_performance` | Logistics Managers, Customer Experience, Regional VPs |
| | | **Streaming:** `mcg.iot.carrier-events` (via Bronze for live tracking updates) | |

**Benefits of domain-based design:**
- Fewer apps to manage and govern
- Cross-functional analysis within a domain (e.g., inventory issues → compliance impact)
- Shared selections propagate across sheets within the same app
- Simpler business logic configuration for Qlik Answers
- **Real-time streaming data** from `mcg.iot.cold-chain` and `mcg.iot.carrier-events` feeds directly into app visualizations via Bronze/Silver Lakehouse tables

---

### 3.3 App 1: MCG Supply Chain Operations

**Create:** Hub → Create → Analytics App → Name: `MCG Supply Chain Operations`

**Data Model — Add Data Sources:**

Connect to Gold tables plus streaming IoT data:

```
// Data Load Editor

LIB CONNECT TO 'MCG Demo Lakehouse';

// ─── Gold Tables (aggregated, governed) ───
LOAD * FROM [gold.supply_chain_health];

// ─── Streaming IoT Data (real-time from Lakehouse) ───
// Cold chain sensor readings — live temperature, humidity, GPS, alerts
// Source: Kafka topic mcg.iot.cold-chain → bronze.iot_cold_chain → silver.iot_normalized
LOAD * FROM [silver.iot_normalized];

// Carrier tracking events — live shipment status updates
// Source: Kafka topic mcg.iot.carrier-events → bronze.iot_carrier_events
LOAD * FROM [bronze.iot_carrier_events];
```

> **Streaming Architecture Note:** The `mcg.iot.cold-chain` and `mcg.iot.carrier-events` Kafka topics flow through the **Streaming Cluster** into Bronze tables in real-time. The Silver-layer `iot_normalized` table provides cleansed streaming data (Celsius-normalized, UTC timestamps, exceedance flags). Configure frequent reloads (every 5 minutes) for near-real-time IoT monitoring.

**Sheets to Create:**

#### Sheet 1: Inventory Health Overview

| Object | Type | Data |
|---|---|---|
| IRA Gauge | KPI | `Avg(ira_pct)` — target line at 97% |
| Phantom Inventory by DC | Bar chart | `phantom_count` by `dc_id` |
| IRA Trend | Line chart | `ira_pct` over `snapshot_timestamp` by DC |
| Trust Score Distribution | Histogram | `avg_trust_score` frequency |
| Pipeline Status | Table | `dc_id`, `pipeline_status`, `last_sync_utc` — conditional colors |
| DC Map | Map | Bubble size = `phantom_count`, color = `ira_pct` |

**Filter pane:** Region, DC, SKU Category, Date Range

#### Sheet 2: Cold Chain Monitoring (Streaming: `mcg.iot.cold-chain`)

> **Data source:** Real-time IoT telemetry from Kafka topic `mcg.iot.cold-chain` via `silver.iot_normalized`

| Object | Type | Data |
|---|---|---|
| Active Exceedances | KPI | Count where `exceedance_minutes > 0` and shipment active |
| **Live Temperature Feed** | Line chart (streaming) | `temperature_value` over `timestamp` by `sensor_id` — `silver.iot_normalized`, auto-refreshes |
| Temperature Heatmap | Pivot table | `route_id` × `hour` → avg temp, red cells for exceedance |
| **Sensor Health** | Table | `sensor_id`, `battery_level_pct`, `last_reading_utc`, `data_gap` — Lakehouse query for real-time status |
| Route Performance | Bar chart | Exceedance rate by `route_id` |
| **GPS Tracking Map** | Map | Live `gps_latitude`/`gps_longitude` from `silver.iot_normalized` — shipment positions with alert colors |

**Filter pane:** Route, Carrier, Product Category, Sensor ID, Date Range

#### Sheet 3: Pipeline Health

| Object | Type | Data |
|---|---|---|
| Pipeline Status | KPI | Count of `pipeline_status = HEALTHY` vs DEGRADED/FAILED |
| Sync Lag by DC | Bar chart | `sync_lag_minutes` by `dc_id` |
| Pipeline Status Timeline | Line chart | `pipeline_status` changes over `last_sync_utc` |
| Trust Score Distribution | Histogram | `trust_score` frequency across DCs |

**Filter pane:** Region, DC, Pipeline Status, Date Range

---

### 3.4 App 2: MCG Delivery & Customer Experience

**Create:** Hub → Create → Analytics App → Name: `MCG Delivery & Customer Experience`

**Data Model — Add Data Sources:**

```
// Data Load Editor

LIB CONNECT TO 'MCG Demo Lakehouse';

// ─── Gold Tables (aggregated, governed) ───
LOAD * FROM [gold.last_mile_performance];

// ─── Streaming Carrier Events (real-time via Lakehouse query) ───
// Live carrier tracking updates from Kafka topic mcg.iot.carrier-events
// Carrier tracking events — live from Kafka Streaming Cluster
// Source: Kafka topic mcg.iot.carrier-events → bronze.iot_carrier_events
LOAD * FROM [bronze.iot_carrier_events];

// Canonical shipment status — Silver normalization of carrier data
LOAD * FROM [silver.shipments_canonical];
```

> **Streaming Architecture Note:** The `mcg.iot.carrier-events` Kafka topic provides real-time carrier webhook pushes (status changes, location updates, exceptions) via the **Streaming Cluster**. Configure frequent reloads (every 5 minutes) to keep shipment tracking near-real-time.

**Sheets to Create:**

#### Sheet 1: Last Mile Performance Overview

| Object | Type | Data |
|---|---|---|
| Global On-Time Rate | KPI | `Sum(on_time_count) / Sum(total_shipments)` — target 92% |
| On-Time by Carrier | Bar chart | `on_time_pct` by `carrier` — benchmark line at 92% |
| On-Time by Region | Map | Countries colored by `on_time_pct` |
| Avg Delivery Days | KPI | `Avg(avg_delivery_hours / 24)` |
| Carrier SLA Comparison | Combo | Actual vs target SLA hours by carrier |
| Failed Delivery Attempts | Bar | `failed_attempts` by carrier + region |

**Filter pane:** Carrier, Region, Country, Date Range

#### Sheet 2: Live Shipment Tracking (Streaming: `mcg.iot.carrier-events`)

> **Data source:** Real-time carrier events from Kafka topic `mcg.iot.carrier-events` via Lakehouse query on `bronze.iot_carrier_events` + `silver.shipments_canonical`

| Object | Type | Data |
|---|---|---|
| Active Shipments | KPI | Count of shipments in `IN_TRANSIT` or `OUT_FOR_DELIVERY` status |
| **Live Status Feed** | Table (auto-refresh) | `tracking_number`, `carrier_code`, `canonical_status`, `event_timestamp`, `location_description` — Lakehouse query, sorted by most recent |
| Status Pipeline | Funnel / bar | Count of shipments at each lifecycle stage (`LABEL_CREATED` → `PICKED_UP` → `IN_TRANSIT` → `OUT_FOR_DELIVERY` → `DELIVERED`) |
| **Exception Monitor** | Table (filtered) | Shipments where `exception_code IS NOT NULL` — shows carrier, exception type, location, timestamp |
| Carrier Event Volume | Line chart (streaming) | Event count per carrier over last 24 hours — Lakehouse query for real-time |
| Delivery Completion Rate | KPI | `DELIVERED / (DELIVERED + FAILED_ATTEMPT)` over rolling 24h window |
| **Raw Carrier Payload** | Text object | Selected shipment's `raw_carrier_payload` — for debugging multi-language status codes |

**Filter pane:** Carrier, Status, Exception Code, Date Range

> **Demo tip:** This sheet demonstrates the value of the Streaming Cluster — carrier webhook events from 6 carriers in 5 languages appear in real-time. Select a shipment to see its raw carrier payload alongside the MCG canonical status.

#### Sheet 3: WISMO & Customer Impact

| Object | Type | Data |
|---|---|---|
| Overall WISMO Rate | KPI | `Sum(wismo_count) / Sum(total_orders)` — 41% headline |
| WISMO Rate by Carrier | Bar chart | `wismo_rate` by `carrier` — red threshold at 40% |
| WISMO Rate by Region | Bar chart | `wismo_rate` by `destination_region` |
| WISMO Cost | KPI | `Sum(wismo_count) × $2.30` |
| WISMO Trend | Line chart | `wismo_rate` over time |
| High-WISMO Carrier-Region Combos | Table | Carrier × region where WISMO > 40% — sortable |

**Filter pane:** Carrier, Region, WISMO Flag, Date Range

#### Sheet 4: Order Timeline Analysis

| Object | Type | Data |
|---|---|---|
| Avg Order-to-Delivery | KPI | `Avg(order_to_delivery_hours)` |
| SLA Breach Rate | KPI | `Sum(NOT sla_met) / Count(*)` — target <8% |
| Timeline Waterfall | Waterfall chart | Avg hours: Order → Pick → Ship → Deliver (by stage) |
| SLA by Carrier × Region | Heatmap | `sla_breach_rate` by carrier rows × region columns |
| Late Orders Detail | Table | Orders where `sla_met = FALSE` — shows promise vs actual |
| Cold Chain Orders | Filtered table | Orders with IoT data: `max_temperature`, `exceedance_flag` |

**Filter pane:** Carrier, Region, SLA Met, Fulfillment Method, Date Range

#### Sheet 5: Address Quality Impact

| Object | Type | Data |
|---|---|---|
| Avg Address Quality | KPI | `Avg(avg_address_quality)` |
| Delivery Success by Address Quality | Scatter | X: address quality score, Y: on-time pct |
| Quality Score Distribution | Histogram | Frequency of address quality scores |
| Low-Quality Hotspots | Map | Countries/regions with avg quality < 0.5 |
| Address Issues → Delivery Failures | Combo | Failed deliveries overlaid with low address quality regions |
| Correlation Table | Table | Carrier × quality band → delivery success rate |

**Filter pane:** Country, Quality Score Range, Carrier

---

### 3.5 Business Logic & Qlik Answers

Configure Business Logic in each app to enable Qlik Answers conversational analytics.

#### App 1: Supply Chain Operations — Business Logic

**Navigate to:** App → Business Logic → Logical Model

**Dimensions:**
| Field | Group | Label |
|---|---|---|
| `dc_id` | Geography | Distribution Center |
| `region` | Geography | Region |
| `canonical_sku` | Product | SKU |
| `category_l1` | Product | Product Category |
| `carrier` | Logistics | Carrier |
| `route_id` | Logistics | Route |
| `nightmare_name` | Analysis | Nightmare Category |

**Measures:**
| Expression | Label | Format |
|---|---|---|
| `Avg(ira_pct)` | Inventory Record Accuracy | Percentage |
| `Sum(phantom_count)` | Phantom Inventory Count | DECIMAL(8,2) |
| `Avg(trust_score)` | Trust Score | 0.00 |
| `Avg(exceedance_probability)` | Cold Chain Exceedance Risk | 0.00 |
| `Sum(exceedance_minutes)` | Exceedance Duration (min) | DECIMAL(8,2) |
| `Sum(annual_projected)` | Annual Cost Impact | Currency |
| `Avg(recall_readiness_score)` | Recall Readiness | 0.00 |

**Vocabulary:**
| User Term | Maps To |
|---|---|
| "phantom" | phantom_count, phantom_inventory |
| "accuracy" or "IRA" | ira_pct |
| "spoilage" or "exceedance" | exceedance_probability, alert_flag |
| "cold chain" | cold_chain_compliance fields |
| "compliance" | compliance_readiness fields |
| "cost" or "impact" | operational_cost_impact fields |

#### App 2: Delivery & Customer Experience — Business Logic

**Dimensions:**
| Field | Group | Label |
|---|---|---|
| `carrier` | Logistics | Carrier |
| `destination_country` | Geography | Country |
| `destination_region` | Geography | Region |
| `fulfillment_method` | Orders | Fulfillment Method |

**Measures:**
| Expression | Label | Format |
|---|---|---|
| `Sum(on_time_count)/Sum(total_shipments)` | On-Time Delivery Rate | Percentage |
| `Sum(wismo_count)/Sum(total_orders)` | WISMO Rate | Percentage |
| `Avg(avg_delivery_hours)/24` | Avg Delivery Days | 0.0 |
| `Sum(wismo_count)*2.30` | WISMO Call Cost | Currency |
| `Avg(avg_address_quality)` | Address Quality Score | 0.00 |

**Vocabulary:**
| User Term | Maps To |
|---|---|
| "WISMO" or "where is my order" | wismo_rate, wismo_count |
| "SLA" or "on time" | on_time_pct, sla_met |
| "address quality" | avg_address_quality |
| "late" or "delayed" | sla_met = FALSE |

**Test Qlik Answers prompts:**
- "Show inventory accuracy by distribution center" (App 1)
- "Which carriers miss SLAs most in APAC?" (App 2)
- "What is the spoilage risk on the São Paulo to Buenos Aires route?" (App 1)
- "Show me the WISMO trend for the last 3 months" (App 2)

---

### 3.6 Theme, Section Access & Publishing

#### Custom Theme

Apply the MCG dark theme to both apps (see `deploy/themes/mcg-dark-theme/` for the theme package).

1. **Administration → Themes → Upload** — Upload `mcg-dark-theme.zip`
2. Open each app → **App Settings → Theme → MCG Dark Theme**

#### Section Access (Row-Level Security)

**App 1: Supply Chain Operations**

```
SECTION ACCESS;
LOAD * INLINE [
  ACCESS, USERID,           REGION
  ADMIN,  ADMIN,            *
  USER,   HENRIK_JANSEN,    EU
  USER,   CARLOS_RIVERA,    AMER
  USER,   WEI_LIN_TAN,      APAC
  USER,   MARIA_SANTOS,     LATAM
  USER,   KWAME_MENSAH,     AFRICA
];

SECTION APPLICATION;
```

**App 2: Delivery & Customer Experience**

```
SECTION ACCESS;
LOAD * INLINE [
  ACCESS, USERID,           CARRIER
  ADMIN,  ADMIN,            *
  USER,   SOPHIE_MULLER,    *
  USER,   FEDEX_PARTNER,    FEDEX
  USER,   DHL_PARTNER,      DHL-EXPRESS
  USER,   NINJAVAN_PARTNER,  NINJAVAN
];

SECTION APPLICATION;
```

#### Publishing

1. **Publish** both apps to the `MCG Demo - Published` managed space
2. Verify app reloads work on schedule
3. Export `.qvf` files and place in `deploy/apps/` for backup

---

## 4. Qlik Predict Deployments

### 4.1 Model 1: Cold Chain Exceedance

**Business scenario:** Predict which cold chain sensor readings — especially on the São Paulo→Buenos Aires corridor — will breach the temperature threshold, before product spoils.

**Navigate to:** Qlik Cloud → AutoML → Create Experiment

#### Step 1: Create Experiment

| Setting | Value |
|---|---|
| **Name** | `MCG Cold Chain Exceedance` |
| **Description** | Predicts temperature-exceedance probability for cold chain shipments from live IoT telemetry — temperature, battery, GPS, route, and environmental factors |
| **Space** | `MCG Demo - Development` |

#### Step 2: Select Training Data

| Setting | Value |
|---|---|
| **Dataset** | `silver.iot_normalized` (Open Lakehouse catalog dataset, streaming pipeline) |
| **Filter** | Historical readings with known outcomes (`alert_flag IS NOT NULL`) |
| **Min rows** | 5,000+ for reliable model |

#### Step 3: Configure Target & Features

| Setting | Value |
|---|---|
| **Target variable** | `alert_flag` (binary: TRUE/FALSE — temperature exceedance) |
| **Problem type** | Binary Classification |

**Feature columns (select these):**

| Feature | Type | Why It Matters |
|---|---|---|
| `route_id` | Categorical | GRU-BA route has known exceedance issues |
| `warehouse_id` | Categorical | Origin DC fleet quality varies |
| `temperature_c` | Numeric | Normalized temperature — strongest predictor |
| `humidity_pct` | Numeric | Humidity correlates with cold-chain risk |
| `battery_level_pct` | Numeric | Low battery → unreliable cooling |
| `battery_low` | Boolean | Flags the failing-sensor population |
| `gps_gap` | Boolean | Telemetry gaps (reliability indicator) |
| `shock_detected` | Boolean | Handling events that break the cold chain |

**Exclude these columns** (IDs, timestamps, leakage):
- `sensor_id`, `shipment_id`, `timestamp`, `temperature_value` (raw pre-normalization)

#### Step 4: Train Model

1. Click **Run Experiment**
2. Qlik AutoML will try multiple algorithms (gradient boosting, random forest, logistic regression, neural network)
3. Training typically takes 5-15 minutes on demo data
4. Review results:
   - **Expected accuracy:** ~85% on demo data
   - **Key metric:** AUC-ROC (area under the curve) — target >0.80

#### Step 5: Review Results

| What to Look For | Where | Expected |
|---|---|---|
| Model comparison | Leaderboard tab | Top model = gradient boosting |
| Feature importance | Feature Importance tab | `temperature_c` #1, `battery_low` #2 |
| Confusion matrix | Model Details | Low false negatives (missed exceedances) |
| SHAP values | Explainability tab | Temperature- and battery-driven predictions |

#### Step 6: Deploy Model

1. Select the best model from the leaderboard
2. Click **Deploy** → Select deployment space: `MCG Demo - Published`
3. Enable **Real-Time Predictions** (API endpoint)
4. Enable **API Sharing** in the space settings

**Demo scenario walkthrough:**
1. Show feature importance chart — `temperature_c` and `battery_low` are top predictors, with `route_id = GRU-BA` surfacing the TransFrio fleet issue
2. Run a live prediction on an active GRU-BA reading:
   - Input: `route_id=GRU-BA, temperature_c=11.2, battery_level_pct=9, battery_low=TRUE, gps_gap=FALSE`
   - Output: `exceedance_probability=0.78` → "78% chance of a cold-chain breach"
3. Show how this connects to Discovery Agent alert and cold chain automation

---

### 4.2 Model 2: Late Delivery Predictor

**Business scenario:** Predict at ship time which orders will deliver late, enabling proactive customer communication.

**Navigate to:** Qlik Cloud → AutoML → Create Experiment

#### Step 1: Create Experiment

| Setting | Value |
|---|---|
| **Name** | `MCG Late Delivery Predictor` |
| **Description** | Predicts late-delivery probability at ship time to enable proactive SLA management |
| **Space** | `MCG Demo - Development` |

#### Step 2: Select Training Data

| Setting | Value |
|---|---|
| **Dataset** | `silver.order_delivery_timeline` (Open Lakehouse catalog dataset, batch pipeline) |
| **Filter** | Historical orders with known outcomes (`delivered_late IS NOT NULL`) |

#### Step 3: Configure Target & Features

| Setting | Value |
|---|---|
| **Target variable** | `delivered_late` (binary: TRUE/FALSE) |
| **Problem type** | Binary Classification |

**Feature columns:**

| Feature | Type | Why It Matters |
|---|---|---|
| `carrier_code` | Categorical | Carrier reliability varies by 30%+ |
| `fulfillment_method` | Categorical | Home delivery vs BOPIS vs curbside |
| `tracking_missing` | Boolean | No tracking number strongly predicts lateness |
| `delivery_attempts` | Numeric | Repeat attempts signal address/access problems |
| `exception_code` | Categorical | Carrier exception reason |
| `order_date` | Date | AutoML derives month/weekday seasonality |

**Exclude:** `order_id`, `tracking_number`, `actual_delivery`, `days_late` (derived from target)

#### Step 4: Train & Review

1. Click **Run Experiment**
2. Expected results:
   - **Accuracy:** ~80% on demo data
   - **Key insight:** `tracking_missing` is the #2 predictor after `carrier_code` — the data gap itself predicts the failure
   - For a richer model, add average address quality per contact via an Athena view over the lakehouse (joins `silver.addresses_standardized`) — address quality then surfaces as a top-3 predictor, linking Nightmare #2 to outcomes

#### Step 5: Deploy Model

1. Select best model → **Deploy** to `MCG Demo - Published`
2. Enable **Real-Time Predictions**
3. Enable **API Sharing**

**Demo talking point:** "The model proves that address quality is the second-strongest predictor of delivery failure, right after carrier selection. Fixing Nightmare #2 directly improves delivery SLAs — data governance drives business outcomes."

---

### 4.3 Model API Sharing

Both deployed models get REST API endpoints for real-time predictions.

**Endpoint format:**
```
POST https://<tenant>.qlikcloud.com/api/v1/ml/predictions
```

**Request body (Cold Chain Exceedance model example):**
```json
{
  "model_id": "<exceedance-model-deployment-id>",
  "features": {
    "route_id": "GRU-BA-001",
    "warehouse_id": "DC-GRU-01",
    "temperature_c": 11.2,
    "humidity_pct": 71,
    "battery_level_pct": 9,
    "battery_low": true,
    "gps_gap": false,
    "shock_detected": false
  }
}
```

**Response:**
```json
{
  "prediction": true,
  "probability": 0.78,
  "explanation": {
    "top_features": [
      {"feature": "temperature_c", "contribution": 0.34},
      {"feature": "battery_low", "contribution": 0.22},
      {"feature": "route_id", "contribution": 0.18}
    ]
  }
}
```

**Integration points:**
- **Discovery Agent** queries the Predict API to enrich anomaly alerts with exceedance probability
- **Automations** call the Predict API to trigger proactive alerts (e.g., "SHP-GRU-BA-20251015 has 78% cold-chain exceedance risk")
- **MCP Server** allows Claude to query predictions via natural language ("What's the cold-chain exceedance risk for active São Paulo shipments?")
- **Qlik Analytics** embeds prediction results as calculated fields in the analytics apps

---

## 5. Agentic Data Engineering — Build-Side AI (Preview)

> **Preview status:** Declarative Data Pipelines and the Qlik MCP Server tooling are in Qlik internal preview (June 2026). Treat this section as forward-looking. The three conversational agents below (Data Product, Data Quality, Catalog & Business Glossary) are **Qlik Answers capabilities, not separate products** — do not present them as standalone SKUs.

Sections 1-4 build the MCG environment through the visual UI. The same pipelines, data products, rules, and glossary can also be authored and governed with AI. This is the **build-side** counterpart to the consumption-side AI you already have (Discovery Agent, Qlik Answers, Qlik Predict, MCP-authored app sheets): instead of asking questions *about* trusted data, you use agents to help *produce* it.

The through-line is one artifact. Each MCG pipeline is a single declarative definition (YAML) you can edit three ways — visually in the Qlik Talend Cloud UI, programmatically in an IDE, or agentically with an AI coding agent — with human review at each stage. A path from raw data to a trusted, AI-ready data product that keeps human expertise in the loop.

### 5.1 Declarative Data Pipelines in VS Code

The two MCG Open Lakehouse pipeline projects ship as a VS Code template under `deploy/pipelines/`:

| Project | platformType | Tasks | Task types |
|---|---|---|---|
| `mcg-batch-pipeline` | `QLIK_OPEN_LAKEHOUSE` | 4 | MCG WMS CDC Landing (LAKE_LANDING), MCG CRM Landing (LAKE_LANDING), MCG Silver Transform (TRANSFORM, 7 datasets), MCG Gold Datamart (DATAMART, 2 datasets) |
| `mcg-streaming-pipeline` | `QLIK_OPEN_LAKEHOUSE` | 2 | MCG IoT Streaming Landing (STREAMING_LAKE_LANDING), MCG IoT Streaming Transform (STREAMING_TRANSFORM) |

Each project folder carries its own agent context so any AI coding agent picks up the house rules:
- `.vscode/settings.json` — editor settings + YAML-to-schema associations
- `CLAUDE.md` — project conventions for Claude / Claude Code
- `.github/copilot-instructions.md` — the same conventions for GitHub Copilot

**Drop in the schema kit:**
```bash
npm run pipeline:template                                   # verify tooling + report schema status
npm run pipeline:template -- --schema <path-to-schema-kit>  # install the kit
```
The kit is Qlik internal-preview material and is deliberately **not committed** — point `--schema` at your local copy. (The bare command only verifies the tooling and reports whether the kit is present.) Once installed, VS Code validates every YAML edit against the schema as you type, so invalid structure is caught before it ever reaches Git.

**The human-in-the-loop coding-agent loop (4 steps):**
1. **Developer Prompts** — describe the change in natural language ("run the CRM landing every 30 minutes instead of 15")
2. **Agent Generates** — the AI coding agent edits the YAML
3. **Schema Validates** — the local schema kit checks the edit and flags anything out of spec
4. **Developer Reviews** — you read the diff and commit

Because the definition is code, it version-controls in Git and deploys through CI/CD. Export/import moves a pipeline between tenants.

**Demo edit (grounded, one line):** In `mcg-batch-pipeline`, open the **MCG CRM Landing** task and change its schedule from `RRULE:FREQ=MINUTELY;INTERVAL=15` to `INTERVAL=30`. The result is a one-line git diff — reviewable, reversible, and deployable back to the tenant with **Apply-from-Remote**.

> **Demo tip:** Open the same task in the Qlik Talend Cloud UI and in VS Code side by side. Editing it in either surface changes one underlying definition, not two copies.

### 5.2 Data Product Agent

A **Qlik Answers capability** (not a separate product) for creating and managing data products through natural-language conversation. A steward or engineer can:
- Create, read, update, and delete data products conversationally (CRUD)
- Discover and interact with existing products by asking for them
- Review and improve a product's quality and completeness

**MCG use:** package the Gold outputs — **Supply Chain Health** and **Last Mile Performance** — as governed data products, or ask the agent to check whether either is missing an owner, tag, description, or SLA before publishing. The agent works against the same registration surface as Section 2, so anything it creates carries the same Trust Score, lineage, and API-sharing settings.

### 5.3 Data Quality Agent

A **Qlik Answers capability** that supports data stewards in assessing, defining, and enforcing data-quality rules conversationally. It bridges business and technical users — a steward describes the rule in plain language and the agent maps it to the dataset. It can:
- Assess data quality across datasets
- Create, manage, and map DQ rules
- Run DQ metric calculations

**MCG use:** the Silver tables already carry hand-built rules (`quantity_on_hand >= 0`, lot-number completeness for perishables, `ira_pct` range 0.0–1.0 — see Section 2.2). Use the Data Quality Agent to assess `silver.inventory_reconciled` or `silver.addresses_standardized` and propose or map the equivalent rules by conversation instead of clicking through the schema editor. Violations still route to the Stewardship sprints from `setup_guide.md` Section 9.

### 5.4 Catalog and Business Glossary Agent

A **Qlik Answers capability** for discovering data assets, understanding their context and relationships, and defining consistent business terminology. It can:
- Answer natural-language queries against the Qlik Cloud Catalog metadata
- Generate glossaries from apps, data products, datasets, or a whole domain
- Standardize terms and synonyms across the catalog

**MCG use:** generate first-draft glossary terms for the supply-chain domain to seed or extend the 25-term MCG Supply Chain Glossary (`setup_guide.md` Section 10).

> **Human review required:** generated glossary terms are **DRAFT status by default**. A term owner (e.g., Henrik Jansen for inventory terms, Sophie Müller for logistics) reviews and approves before the term is published. The agent drafts; a human decides.

---

## Quick Reference: Complete Object Inventory

| Layer | Object | Count | Refresh |
|---|---|---|---|
| **Bronze** | Landing pipelines | 8 | Real-time / 15 min |
| **Silver** | Transformation data flows | 8 | Triggered / scheduled |
| **Gold** | Table recipes | 7 | 5 min – daily |
| **Data Products** | Registered + governed | 7 | Matches Gold refresh |
| **Analytics Apps** | Domain-based Qlik Analytics | 2 | Reload schedule |
| **Predict Models** | AutoML deployments | 2 | On-demand / batch |
| **Total** | | **34 objects** | |

---

## Appendix: Data Flow Execution Order

Some data flows have dependencies. Execute in this order:

```
1. Timestamp Normalization (Route 1)      ← runs first, all others depend on it
   ├── 2. Inventory Reconciliation (Route 2)
   ├── 3. Address Standardization (Route 3)
   ├── 4. Product Master Harmonization (Route 4)
   ├── 5. Carrier Status Canonicalization (Route 5)
   ├── 6. IoT Telemetry Normalization (Route 6)
   └── 7. Supplier Master Deduplication (Route 7)
              └── 8. Order-to-Delivery Timeline (Route 8)  ← runs last, consumes Silver outputs
```

Configure this dependency chain in the data flow scheduler or use a Qlik Automation to orchestrate.
