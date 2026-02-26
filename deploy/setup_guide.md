# MCG Demo — Full Qlik Cloud Setup Guide

Complete setup guide for deploying the Meridian Commerce Group demo environment across all Qlik Cloud components. Covers infrastructure, data sources, Open Lakehouse, data flows, data products, analytics, AI, governance, and automation.

---

## Table of Contents

1. [Prerequisites & Infrastructure](#1-prerequisites--infrastructure)
2. [Three Data Sources](#2-three-data-sources)
3. [Open Lakehouse (Bronze/Silver/Gold)](#3-open-lakehouse-bronzesilvergold)
4. [Data Flows & Table Recipes](#4-data-flows--table-recipes)
5. [Data Products & API Sharing](#5-data-products--api-sharing)
6. [Shared Locations & Spaces](#6-shared-locations--spaces)
7. [Qlik Predict (AutoML)](#7-qlik-predict-automl)
8. [Qlik Answers](#8-qlik-answers)
9. [Qlik Stewardship](#9-qlik-stewardship)
10. [Business Glossary](#10-business-glossary)
11. [Automation — Microsoft Teams](#11-automation--microsoft-teams)
12. [Discovery Agent](#12-discovery-agent)
13. [MCP Server](#13-mcp-server)

---

## 1. Prerequisites & Infrastructure

### 1.1 Qlik Cloud Tenant

| Requirement | Detail |
|---|---|
| **Tenant** | Qlik Cloud Analytics or Qlik Cloud Enterprise |
| **License** | Full Platform license (Analytics + Data Integration + AI) |
| **Region** | US (`us.qlikcloud.com`), EU (`eu.qlikcloud.com`), or AP (`ap.qlikcloud.com`) |
| **Roles needed** | Tenant Admin (for setup), or Developer + Space Creator |
| **API Key** | Settings → API keys → Create New (requires "Manage API keys" permission) |

### 1.2 Data Movement Gateway (for PostgreSQL CDC)

The Data Movement Gateway enables CDC from on-prem or cloud-hosted databases.

**Installation:**
1. In Qlik Cloud: **Administration** → **Data Gateways** → **Create**
2. Download the gateway installer for your OS (Windows Server 2019+ or Linux RHEL 8+/Ubuntu 20+)
3. Install and register with the token provided by Qlik Cloud
4. Verify status shows "Connected" in Administration → Data Gateways

**Network requirements:**
- Outbound HTTPS (443) to `*.qlikcloud.com`
- Inbound access to PostgreSQL (5432)
- No inbound firewall rules needed from Qlik Cloud (gateway initiates outbound)

### 1.3 PostgreSQL Setup

**Option A: Docker (recommended for demos)**
```bash
docker run -d --name mcg-wms-db \
  -e POSTGRES_DB=mcg_wms \
  -e POSTGRES_USER=qlik_reader \
  -e POSTGRES_PASSWORD=<your-password> \
  -p 5432:5432 \
  postgres:16 \
  -c wal_level=logical \
  -c max_replication_slots=10 \
  -c max_wal_senders=10
```

**Option B: Amazon RDS**
- Create RDS PostgreSQL 16.x instance
- Parameter group: set `rds.logical_replication = 1`
- Security group: allow inbound 5432 from Data Movement Gateway IP

**After database is running:**
```sql
-- Create tables (from simulators/postgres_simulator.py schema)
-- Then create a publication for CDC
CREATE PUBLICATION mcg_wms_pub FOR ALL TABLES;

-- Create a replication slot (Qlik will use this)
SELECT pg_create_logical_replication_slot('qlik_cdc_slot', 'pgoutput');
```

**Load demo data:**
```bash
# Install Python dependencies and run the simulator
pip install psycopg2-binary
python simulators/postgres_simulator.py --host localhost --port 5432 \
  --database mcg_wms --user qlik_reader --password <your-password> \
  --mode seed    # Initial seed load
```

### 1.4 Apache Kafka Setup

**Option A: Confluent Cloud (recommended — free tier)**
1. Sign up at [confluent.cloud](https://confluent.cloud)
2. Create a Basic cluster in your preferred region
3. Create topics:
   - `mcg.iot.cold-chain` (6 partitions, 7-day retention)
   - `mcg.iot.carrier-events` (3 partitions, 7-day retention)
4. Create an API key (Cluster → API Keys → Create Key)

**Option B: Docker**
```bash
docker-compose up -d  # Use Confluent Platform docker-compose
# Or use Redpanda (Kafka-compatible, lighter):
docker run -d --name mcg-kafka -p 9092:9092 vectorized/redpanda
```

**Start IoT producer (during demo):**
```bash
pip install confluent-kafka
python simulators/mcg_iot_producer.py  # Generates live sensor readings
```

### 1.5 Salesforce Developer Edition

1. Sign up at [developer.salesforce.com](https://developer.salesforce.com/signup)
2. Create custom objects:
   - `MCG_Order__c` (12 fields — see `MCG_Three_Data_Feeds.md`)
   - `MCG_Product__c` (10 fields)
3. Create a Connected App for OAuth:
   - Setup → App Manager → New Connected App
   - Enable OAuth: `api`, `refresh_token`, `full`
   - Callback URL: `https://login.salesforce.com/services/oauth2/callback`
4. Load demo data:
   ```bash
   python simulators/salesforce_simulator.py --instance https://your-dev-org.my.salesforce.com
   ```

### 1.6 Remote Engine Gen2 (for Kafka)

- In Qlik Cloud: **Administration** → **Remote Engines** → **Create**
- Download and install on a machine with network access to your Kafka cluster
- Register with the pairing token from Qlik Cloud
- Verify status shows "Paired" in Administration → Remote Engines

---

## 2. Three Data Sources

### 2.1 PostgreSQL (WMS Database)

**In Qlik Talend Cloud → Connections → Add Connection:**

| Setting | Value |
|---|---|
| Connector type | PostgreSQL |
| Connection name | `MCG WMS Database` |
| Gateway | Select your Data Movement Gateway |
| Host | `<your-postgres-host>` |
| Port | `5432` |
| Database | `mcg_wms` |
| Schema | `public` |
| Username | `qlik_reader` |
| Password | `<your-password>` |
| CDC Method | Log-based (WAL) |

**Tables captured (3):**

| Table | Records | Nightmares Demonstrated | Key Quality Issues |
|---|---|---|---|
| `inventory_positions` | ~5,000 | #1, #3, #5, #7 | Phantom inventory, missing lot numbers, no-TZ timestamps, UoM chaos |
| `warehouse_events` | ~20,000 | #4, #5 | Silent pipeline gap (events stop for Rotterdam DC on Sep 24), format variants |
| `shipments` | ~8,000 | #5, #6 | 6 carrier status vocabularies, mixed datetime formats, weight unit chaos |

**Data landing task:**
1. Create a new Replicate task: **PostgreSQL → Open Lakehouse (Bronze)**
2. Select all 3 tables
3. Enable CDC (Full Load + ongoing changes)
4. Target tables: `bronze.inventory_raw`, `bronze.warehouse_events_raw`, `bronze.shipments_raw`

### 2.2 Apache Kafka (IoT Telemetry)

**In Qlik Talend Cloud → Connections → Add Connection:**

| Setting | Value |
|---|---|
| Connector type | Apache Kafka |
| Connection name | `MCG IoT Telemetry` |
| Engine | Remote Engine Gen2 |
| Bootstrap servers | `<your-kafka-broker>:9092` |
| Security protocol | SASL_SSL (Confluent Cloud) or PLAINTEXT (Docker) |
| SASL mechanism | PLAIN |
| Username / Password | Confluent Cloud API key/secret |

**Topics captured (2):**

| Topic | Msg/sec | Nightmares | Key Quality Issues |
|---|---|---|---|
| `mcg.iot.cold-chain` | ~1/5s per sensor | #4, #5 | Fahrenheit/Celsius mix (8% of sensors), 6-hour Lagos gap, missing shipment IDs |
| `mcg.iot.carrier-events` | ~1/min | #6 | Multi-language status codes, mixed timestamp formats, duplicates |

**Streaming landing task:**
1. Create streaming pipeline: **Kafka → Open Lakehouse (Bronze)**
2. Subscribe to both topics
3. JSON message parsing with schema inference
4. Target: `bronze.iot_cold_chain_raw`, `bronze.carrier_events_raw`

### 2.3 Salesforce (CRM + Orders)

**In Qlik Talend Cloud → Connections → Add Connection:**

| Setting | Value |
|---|---|
| Connector type | Salesforce (Standard) |
| Connection name | `MCG Salesforce CRM` |
| Authentication | OAuth 2.0 (or Username + Password + Security Token) |
| Instance URL | `https://your-dev-org.my.salesforce.com` |
| API version | v59.0+ |

**Objects captured (4):**

| Object | Records | Nightmares | Key Quality Issues |
|---|---|---|---|
| `Contact` (standard) | ~2,000 | #2 | Address truncation (6%), formatting chaos (11%), duplicates (3.2%) |
| `Account` (standard) | ~500 | #2 | Name variants ("de Vries" vs "De Vries" vs "DeVries") |
| `MCG_Order__c` | ~5,000 | #2, #6 | 42% missing tracking numbers, WISMO flags on 41% |
| `MCG_Product__c` | ~1,200 | #3, #7 | 3 SKU schemes, 8,200 missing weights, supplier name variants |

**Data landing task:**
1. Create SaaS landing task: **Salesforce → Open Lakehouse (Bronze)**
2. Select all 4 objects
3. Mode: Full + Incremental (SystemModstamp)
4. Target: `bronze.contacts_raw`, `bronze.accounts_raw`, `bronze.orders_raw`, `bronze.products_raw`

---

## 3. Open Lakehouse (Bronze/Silver/Gold)

### 3.1 Create the Lakehouse

1. In Qlik Cloud: **Data Integration** → **Open Lakehouse** → **Create Storage**
2. Name: `MCG Demo Lakehouse`
3. Storage: Qlik-managed (or bring your own S3/Azure Blob/GCS)
4. Create 3 schemas: `bronze`, `silver`, `gold`

### 3.2 Bronze Layer (Raw Landing)

Data arrives here first — dirty, as-is, preserving the original for lineage and audit.

| Table | Source | Format |
|---|---|---|
| `bronze.inventory_raw` | PostgreSQL CDC | Iceberg (append + CDC merge) |
| `bronze.warehouse_events_raw` | PostgreSQL CDC | Iceberg |
| `bronze.shipments_raw` | PostgreSQL CDC | Iceberg |
| `bronze.iot_cold_chain_raw` | Kafka streaming | Iceberg (append) |
| `bronze.carrier_events_raw` | Kafka streaming | Iceberg (append) |
| `bronze.contacts_raw` | Salesforce | Iceberg |
| `bronze.orders_raw` | Salesforce | Iceberg |
| `bronze.products_raw` | Salesforce | Iceberg |

**Total: 8 Bronze tables**

### 3.3 Silver Layer (Cleansed)

Created by the 8 transformation routes (Section 4). Each Silver table is the output of one or more data flows.

| Table | Created By (Route) | Key Transformations |
|---|---|---|
| `silver.inventory_reconciled` | Route 2 | WMS-ERP reconciliation, phantom inventory flagged, UoM standardized |
| `silver.customers_deduped` | Route 3 | Address standardized per country postal rules, fuzzy dedup |
| `silver.products_harmonized` | Route 4 | 3 SKU schemes merged to canonical MCG-* ID, weights filled |
| `silver.shipments_canonical` | Route 5 | All 6 carrier status vocabularies → MCG standard lifecycle |
| `silver.iot_normalized` | Route 6 | All temps in °C, timestamps in UTC, enriched with shipment context |
| `silver.orders_enriched` | Route 8 | Unified timeline from order → pick → ship → deliver |
| `silver.suppliers_deduped` | Route 7 | "Samsung" × 4 → 1 canonical record |
| `silver.timestamps_audit` | Route 1 | Cross-reference table mapping original → normalized timestamps |

**Total: 8 Silver tables**

### 3.4 Gold Layer (Business-Ready Data Products)

Aggregated, governed, SLA-backed data products for business consumption.

| Table | Input (Silver) | Consumers | Key Fields |
|---|---|---|---|
| `gold.supply_chain_health` | inventory_reconciled, timestamps_audit | Qlik Sense, Discovery Agent | DC, SKU, qty_wms, qty_erp, variance, trust_score, pipeline_status |
| `gold.last_mile_performance` | shipments_canonical, orders_enriched, customers_deduped | Qlik Sense, Predict | carrier, region, sla_target, sla_actual, on_time_pct, address_quality_score |
| `gold.spoilage_risk` | iot_normalized, shipments_canonical | Predict, Discovery Agent | shipment_id, route, carrier, avg_temp, max_temp, exceedance_min, spoilage_flag |
| `gold.customer_360` | customers_deduped, orders_enriched | Qlik Sense | customer_id, name, address_clean, total_orders, wismo_count, ltv |
| `gold.compliance_traceability` | products_harmonized, inventory_reconciled | Compliance, Qlik Sense | sku, lot_number, farm_origin, dc_receipt, store_receipt, trace_complete_flag |
| `gold.inventory_b2b_feed` | inventory_reconciled, products_harmonized | B2B API, flat file export | sku, product_name, dc, qty_available, uom, unit_price, trust_score |
| `gold.order_timeline` | orders_enriched, shipments_canonical, iot_normalized | Qlik Sense, Answers | order_id, customer, order_dt, pick_dt, ship_dt, deliver_dt, total_hours, sla_met |

**Total: 7 Gold tables**

---

## 4. Data Flows & Table Recipes

Each transformation route is built as a **Qlik Talend Cloud Data Flow** (Pipeline Designer). Below is the specification for each.

### Route 1: Timestamp Normalization (Cross-Cutting)

**Runs first — all other routes depend on normalized timestamps.**

| Property | Value |
|---|---|
| Input | `bronze.inventory_raw`, `bronze.warehouse_events_raw`, `bronze.shipments_raw`, `bronze.iot_cold_chain_raw` |
| Output | `silver.timestamps_audit` + timestamps updated in-place on Silver tables |
| Nightmare | #5 (Timestamp Tower of Babel) |
| Schedule | Triggered after every Bronze refresh |

**Table Recipe (Pipeline Designer steps):**
1. **tMap** — Read all timestamp columns from each Bronze table
2. **Timezone Lookup** — Join `warehouse_id` to a reference table mapping DC → timezone
3. **Normalize** — Convert all timestamps to UTC:
   - If ISO 8601 with offset → convert to UTC
   - If bare timestamp (no TZ) → apply DC timezone lookup, then convert to UTC
   - If Correios DD/MM/YYYY format → parse and convert
   - Preserve original value in `_original` column
4. **Truncated Millis** — IoT timestamps: preserve full `.382Z` precision in Silver
5. **Write** — Output to `silver.timestamps_audit` (original_value, source_system, detected_tz, normalized_utc)

**Demo talking point:** "Watch how 14 different timezone conventions collapse into one clean UTC standard."

### Route 2: Inventory Reconciliation & Quality

| Property | Value |
|---|---|
| Input | `bronze.inventory_raw` (normalized timestamps from Route 1) |
| Output | `silver.inventory_reconciled` |
| Nightmare | #1 (Phantom Inventory), #3 (Product Master), #7 (Compliance) |

**Table Recipe:**
1. **Profile** — Run data quality profiling: detect nulls, negative values, UoM variants
2. **UoM Standardize** — Map `CS`, `PAL`, `EACH`, `EA`, `ea` → canonical `EA`/`CS`/`PAL`
3. **Storage Zone Normalize** — Map `KALT`/`FROID`/`KÄLTE` → `CHILLED`, `GEFRIER` → `FROZEN`
4. **Phantom Flag** — Compare `quantity_on_hand` against ERP reference:
   - If WMS < ERP by >10%: flag `phantom_inventory = TRUE`
   - If WMS = 0 but ERP > 0: flag `phantom_critical = TRUE`
5. **Negative Check** — Flag rows where `quantity_on_hand < 0` as `logic_error = TRUE`
6. **Lot Compliance** — If `lot_number IS NULL` and product category = `Grocery/Fresh`: flag `lot_missing = TRUE`
7. **Trust Score** — Calculate per-row trust score (0.0-1.0):
   - 1.0 = all fields present, no flags
   - 0.7 = minor issues (UoM was corrected)
   - 0.3 = phantom inventory flagged
   - 0.1 = logic error (negative qty)
8. **Write** → `silver.inventory_reconciled`

**Data quality rules configured:**
- `quantity_on_hand >= 0` (validity)
- `lot_number IS NOT NULL` where category = Fresh/Grocery (completeness)
- `WMS qty within 5% of ERP qty` (consistency)

### Route 3: Address Standardization & Dedup

| Property | Value |
|---|---|
| Input | `bronze.contacts_raw`, `bronze.orders_raw` |
| Output | `silver.customers_deduped` |
| Nightmare | #2 (Address Catastrophe) |

**Table Recipe:**
1. **Country Normalize** — Map `Netherlands`/`Niederlande` → `NL`, `Singapore` → `SG`
2. **Postal Code Standardize** — Apply country-specific rules:
   - NL: `1017EJ` → `1017 EJ` (add space)
   - BR: `01304001` → `01304-001` (add hyphen)
   - US: Validate ZIP against USPS format
3. **Street Normalize** — Expand abbreviations: `Str.` → `Straße`, `Apt` → `Apartment`, `Ste` → `Suite`
4. **Accent Restore** — Where possible: `Sao Paulo` → `São Paulo`, `Muller` → `Müller`
5. **Truncation Detect** — Flag addresses that are exactly 30 characters (legacy POS truncation)
6. **Fuzzy Dedup** — Match on:
   - Name + postal code + street number (>85% match → candidate)
   - >90% → auto-merge to surviving record
   - 85-90% → route to Stewardship (Section 9)
7. **Address Quality Score** — Per-record score (0.0-1.0):
   - 1.0 = complete, validated, no truncation
   - 0.7 = minor format correction applied
   - 0.4 = truncated but correctable
   - 0.2 = incomplete / unvalidatable
8. **Write** → `silver.customers_deduped`

### Route 4: Product Master Harmonization

| Property | Value |
|---|---|
| Input | `bronze.products_raw` |
| Output | `silver.products_harmonized` |
| Nightmare | #3 (Product Master Mess) |

**Table Recipe:**
1. **SKU Resolution** — Create canonical mapping:
   - If `MCG-*` exists → use as canonical
   - If only `AM-*` or `EU-*` → create MCG mapping via GTIN/EAN match
   - Triple-SKU products: merge attributes, prefer MCG values
2. **Weight Validation** — Flag `weight_kg IS NULL`, `weight_kg = 0`, `weight_kg > 100` (implausible)
3. **Dimension Fix** — Detect inches-as-cm: if `length_cm < 30` AND `width_cm < 20` AND source = Americas → convert from inches
4. **Category Harmonize** — Map German/Dutch/French category names to English
5. **Supplier Name Normalize** — First pass of supplier grouping (full dedup in Route 7)
6. **Country of Origin** — Flag missing for food SKUs (NVWA compliance)
7. **Write** → `silver.products_harmonized`

### Route 5: Carrier Status Canonicalization

| Property | Value |
|---|---|
| Input | `bronze.shipments_raw`, `bronze.carrier_events_raw` |
| Output | `silver.shipments_canonical` |
| Nightmare | #6 (Carrier Data Black Hole) |

**Table Recipe:**
1. **Status Mapping** — Canonical lifecycle mapping:
   ```
   LABEL_CREATED/Paketankündigung/Pending Pickup/Objeto postado → LABEL_CREATED
   PICKED_UP/pickup/Abgeholt/Picked Up/Coletado → PICKED_UP
   IN_TRANSIT/transit/In Zustellung/Arrived at Hub/Em trânsito → IN_TRANSIT
   ON_VEHICLE/out_for_delivery/In Auslieferung/On Vehicle/Saiu para entrega → OUT_FOR_DELIVERY
   DELIVERED/delivered/Zugestellt/Completed/Objeto entregue → DELIVERED
   DELIVERY_EXCEPTION/failure/Zustellversuch/Pending Reschedule/Não entregue → FAILED_ATTEMPT
   ```
2. **Datetime Parse** — Normalize `status_datetime` string to TIMESTAMPTZ:
   - ISO 8601 → parse directly
   - `DD/MM/YYYY HH:MM` (Correios) → parse with BRT timezone
   - `Oct 18 2025` (Lagos courier) → parse with WAT timezone
   - Epoch milliseconds → convert to ISO
3. **Weight Normalize** — Map `lbs`/`lb`/`LBS` → convert to kg
4. **Country Normalize** — `Niederlande` → `NL`, `Netherlands` → `NL`
5. **Exception Code Normalize** — Map carrier-specific codes to MCG standard:
   - `ADDR_INCOMPLETE`/`ZS_FEHLER`/`CEP_INVALIDO` → `ADDRESS_INVALID`
   - `UNIT_MISSING`/`P/NOT IN` → `RECIPIENT_NOT_FOUND`
6. **Write** → `silver.shipments_canonical`

### Route 6: IoT Telemetry Normalization

| Property | Value |
|---|---|
| Input | `bronze.iot_cold_chain_raw` |
| Output | `silver.iot_normalized` |
| Nightmare | #4 (Silent Pipelines), #5 (Timestamps) |

**Table Recipe:**
1. **Temperature Normalize** — If `temperature_unit = 'F'`: convert to Celsius `(value - 32) × 5/9`
2. **Timestamp Normalize** — Apply Route 1 rules; fill millisecond precision
3. **Gap Detection** — Flag >30-minute gaps between consecutive readings for same sensor
4. **Shipment Enrich** — Join `shipment_id` to `silver.shipments_canonical` for route/carrier context
5. **Exceedance Flag** — Apply product-type thresholds:
   - Fresh produce: >8°C for 30+ min → `exceedance = TRUE`
   - Dairy: >8°C for 15+ min → `exceedance = TRUE`
   - Frozen: > -15°C any reading → `exceedance = TRUE`
6. **Battery Alert** — If `battery_level_pct < 10%` → `battery_low = TRUE`
7. **Dedup** — Remove Kafka at-least-once duplicates (same sensor_id + timestamp)
8. **Write** → `silver.iot_normalized`

### Route 7: Supplier Master Deduplication

| Property | Value |
|---|---|
| Input | `bronze.products_raw` (supplier fields) |
| Output | `silver.suppliers_deduped` |
| Nightmare | #3 (Product Master Mess) |

**Table Recipe:**
1. **Extract** — Pull unique supplier records from products and inventory
2. **Normalize** — Lowercase, strip suffixes (Ltd, PLC, Corp, S.A., Co., Inc.)
3. **Accent Normalize** — `Nestlé` → `nestle` for matching
4. **Fuzzy Match** — Jaro-Winkler similarity on normalized names:
   - >95% → auto-merge
   - 85-95% → route to Stewardship
   - <85% → treat as distinct
5. **Golden Record** — For each group, select surviving record:
   - Prefer SAP Global (`SUP-*`) ID as canonical
   - Merge attributes from all duplicates
6. **Cross-Reference** — Output mapping table: `source_supplier_id → canonical_supplier_id`
7. **Write** → `silver.suppliers_deduped`

### Route 8: Order-to-Delivery Unified Timeline

| Property | Value |
|---|---|
| Input | `silver.orders_enriched` (from Salesforce), `silver.shipments_canonical`, `silver.iot_normalized`, `silver.inventory_reconciled` |
| Output | `gold.order_timeline` |
| Nightmare | #5 (Timestamps), #6 (Carrier Black Hole) |

**Table Recipe:**
1. **Join** — Link orders → shipments via `order_id`
2. **Timeline Build** — For each order, extract milestone timestamps:
   - `order_placed_utc` (from Salesforce)
   - `picked_utc` (from warehouse_events via inventory)
   - `shipped_utc` (from shipments)
   - `delivered_utc` (from shipments)
3. **Duration Calc** — Order-to-delivery hours, pick-to-ship hours, ship-to-deliver hours
4. **SLA Check** — Compare actual delivery to promised delivery → `sla_met = TRUE/FALSE`
5. **IoT Enrich** — If cold chain shipment, attach max_temperature, exceedance_flag
6. **Write** → `gold.order_timeline`

---

## 5. Data Products & API Sharing

### 5.1 Register Gold Tables as Data Products

In **Data Integration → Data Products → Create**:

| Data Product | Source Table | Owner | Tags | SLA |
|---|---|---|---|---|
| Supply Chain Health | `gold.supply_chain_health` | Henrik Jansen (VP Warehouse Ops) | `inventory`, `phantom`, `pipeline-health` | Refreshed every 15 min |
| Last Mile Performance | `gold.last_mile_performance` | Sophie Müller (EU Logistics Mgr) | `carrier`, `sla`, `delivery` | Refreshed every 30 min |
| Spoilage Risk | `gold.spoilage_risk` | Thomas Brennan (VP Supply Chain) | `cold-chain`, `iot`, `risk` | Refreshed real-time (streaming) |
| Customer 360 | `gold.customer_360` | Lisa Park (Head of CX) | `customer`, `address`, `wismo` | Refreshed hourly |
| Compliance Traceability | `gold.compliance_traceability` | Dr. Elena Vasquez (CCO) | `compliance`, `nvwa`, `traceability` | Refreshed daily |
| B2B Inventory Feed | `gold.inventory_b2b_feed` | Carlos Rivera (Dir. Logistics) | `b2b`, `api`, `inventory` | Refreshed daily 06:00 UTC |
| Order Timeline | `gold.order_timeline` | Wei Lin Tan (APAC Logistics) | `order`, `timeline`, `sla` | Refreshed every 30 min |

### 5.2 Enable API Sharing

For each data product in the shared space:

1. Open the data product → **Settings** → **API Sharing** → **Enable**
2. This generates a REST API endpoint:
   ```
   GET https://<tenant>.qlikcloud.com/api/v1/data-products/<id>/data
   ```
3. API consumers can query with filters:
   ```
   GET .../data?filter=carrier eq 'FEDEX' and region eq 'EU'
   ```
4. Authentication: same API key or OAuth token used for other Qlik APIs

**Demo talking point:** "Any system — BI tools, custom apps, partner portals — can consume MCG's governed data products via API. The Trust Score travels with the data, so consumers know what to trust."

### 5.3 Predict Model API Sharing

Qlik Predict models (Section 7) also get API endpoints when published:
```
POST https://<tenant>.qlikcloud.com/api/v1/ml/predictions
Body: { "model_id": "<spoilage-model-id>", "features": { "route": "GRU-BA", "carrier": "TransFrio", ... } }
```

---

## 6. Shared Locations & Spaces

### 6.1 Space Architecture

| Space | Type | Purpose | Contents |
|---|---|---|---|
| `MCG Demo - Development` | Shared | Dev workspace for building apps and flows | Data connections, data flow drafts, dev apps |
| `MCG Demo - Published` | Managed | Production analytics for end users | Published Qlik Sense apps, scheduled reports |
| `MCG Demo - Data` | Shared | Data products + governance artifacts | Data products, glossary, stewardship campaigns, catalog |

### 6.2 Resource Assignment

| Resource | Space |
|---|---|
| PostgreSQL connection | MCG Demo - Development |
| Kafka connection | MCG Demo - Development |
| Salesforce connection | MCG Demo - Development |
| Open Lakehouse | MCG Demo - Data |
| Data Products (7) | MCG Demo - Data |
| Qlik Sense apps (dev) | MCG Demo - Development |
| Qlik Sense apps (published) | MCG Demo - Published |
| Knowledge Base | MCG Demo - Data |
| Assistant | MCG Demo - Published |
| Automations | MCG Demo - Development |

### 6.3 Create Spaces via Deploy Script

The `deploy_qlik.py` script creates spaces automatically:
```bash
python deploy/deploy_qlik.py
# Wizard will prompt for space names
```

Or manually in Qlik Cloud: **Administration → Spaces → Create Space**

---

## 7. Qlik Predict (AutoML)

### 7.1 Model 1: Spoilage Risk Predictor

**Business scenario:** Predict which cold chain shipments on the São Paulo→Buenos Aires corridor will experience spoilage, before it happens.

| Property | Value |
|---|---|
| **Name** | MCG Spoilage Risk Predictor |
| **Training data** | `gold.spoilage_risk` (historical shipments with known outcomes) |
| **Target variable** | `spoilage_flag` (binary: TRUE/FALSE) |
| **Feature columns** | `carrier`, `route`, `avg_temp_celsius`, `max_temp_celsius`, `exceedance_minutes`, `pre_cool_compliant`, `month`, `day_of_week`, `weight_kg` |
| **Algorithm** | Auto (Qlik selects best: typically gradient boosting for binary classification) |
| **Nightmare tie-in** | #6 (Carrier Data Black Hole) + INC-2025-05102 (TransFrio Spoilage) |

**Setup in Qlik Cloud:**
1. **AutoML** → **Create Experiment** → Select `gold.spoilage_risk` dataset
2. Set target: `spoilage_flag`
3. Select features (exclude IDs, timestamps)
4. Train → Review model performance (expect ~85% accuracy on demo data)
5. Deploy best model → Enable API sharing in the shared space

**Demo scenario:**
- Show the model's feature importance: `max_temp_celsius` and `pre_cool_compliant` are top predictors
- Run a live prediction on an active São Paulo→Buenos Aires shipment
- Show how the model flags at-risk shipments 6-12 hours before spoilage occurs
- Connect to Discovery Agent alert: "Model predicts 78% spoilage probability for SHP-GRU-BA-20251015"

### 7.2 Model 2: Delivery SLA Predictor

**Business scenario:** Predict which orders will miss their delivery SLA, enabling proactive customer communication.

| Property | Value |
|---|---|
| **Name** | MCG Delivery SLA Predictor |
| **Training data** | `gold.last_mile_performance` (historical deliveries with known SLA outcomes) |
| **Target variable** | `sla_met` (binary: TRUE/FALSE) |
| **Feature columns** | `carrier`, `destination_country`, `destination_region`, `weight_kg`, `address_quality_score`, `fulfillment_method`, `day_of_week`, `distance_km` |
| **Nightmare tie-in** | #2 (Address Catastrophe) + CARRIER-NV-2025 (NinjaVan SLA change) |

**Setup:**
1. Same process as Model 1 but with `gold.last_mile_performance`
2. Key insight: `address_quality_score` is a strong predictor — low-quality addresses predict delivery failure
3. Deploy and enable API sharing

**Demo talking point:** "The model shows that address quality is the #2 predictor of delivery failure, right after carrier selection. Fixing Nightmare #2 directly improves delivery SLAs."

---

## 8. Qlik Answers

### 8.1 Knowledge Base Setup

**Automated via deploy script:**
```bash
python deploy/deploy_qlik.py  # Creates KB + uploads all 25 documents
```

**Manual setup:**
1. **Qlik Answers** → **Knowledge Bases** → **Create**
2. Name: `MCG Operations Knowledge Base`
3. Add datasource → Upload files → Select all 25 `.docx` files from `documents/`
4. Wait for indexing to complete (~2-5 minutes for 25 docs)

### 8.2 Assistant Configuration

| Setting | Value |
|---|---|
| Name | MCG Operations Assistant |
| Knowledge bases | MCG Operations Knowledge Base |
| Description | AI assistant for MCG operations — procedures, incidents, policies, carrier contracts, and Project CLARITY |

**Conversation starters:**
1. "What is the procedure for goods receiving?"
2. "What happened during the Rotterdam pipeline failure?"
3. "What are the cold chain temperature requirements?"
4. "What is Project CLARITY and what's the ROI?"
5. "What was the lettuce recall and what went wrong?"

### 8.3 Demo Scenarios for Qlik Answers

**Scenario 1: Singapore SLA Decline**
- Ask: "Why did Singapore delivery promise accuracy drop to 69%?"
- Expected: References CARRIER-NV-2025 (NinjaVan AMD3 reclassification), MCG-POL-020 (Delivery Promise Policy), and the 3-week communication gap

**Scenario 2: Rotterdam Pipeline Failure**
- Ask: "What happened at Rotterdam DC in September 2025?"
- Expected: References INC-2025-04872, TRN-2025-001 (WMS-SAP training guide), and the 72-hour silent failure

**Scenario 3: Lettuce Recall Investigation**
- Ask: "How long did the lettuce recall take and what was the root cause?"
- Expected: References RCL-2025-003 (11 days vs 24-hour target), SUPP-2025-FreshDirect (undisclosed Farm NL-0042), COMP-2025-NVWA (5 NVWA findings)

**Scenario 4: Cold Chain Spoilage**
- Ask: "What caused the $2.48M spoilage on the São Paulo-Buenos Aires route?"
- Expected: References INC-2025-05102 (TransFrio fleet change), TRN-2025-002 (Thermo King X4 7500 startup procedure)

**Scenario 5: WISMO Call Handling**
- Ask: "What's the procedure for handling a Where Is My Order call?"
- Expected: References SOP-CS-001 (4-step WISMO procedure), cross-references carrier tracking systems

**Scenario 6: Project CLARITY ROI**
- Ask: "What is Project CLARITY and what's the expected return?"
- Expected: References PROJ-CLARITY-2025 ($12.4M investment, $52.7M conservative annual benefit, 952% 3-year ROI)

---

## 9. Qlik Stewardship

### 9.1 Stewardship Campaigns

Create 4 data stewardship campaigns tied to transformation route outputs:

**Campaign 1: Address Cleanup**

| Property | Value |
|---|---|
| Name | MCG Address Data Cleanup |
| Source | Route 3 output: fuzzy match candidates with 85-90% confidence |
| Record count | ~640 address pairs (3.2% of 20,000 customer records) |
| Assignee | Customer Data Team |
| Task type | Merge/Split decision |
| Deadline | 30 days |
| Nightmare | #2 (Address Catastrophe) |

Example task: "Are these the same customer? Jan de Vries (Keizersgracht 482, Apartment 4B, 1017 EJ) vs Jan De Vries (Keizersgracht 482, Apt 4B, 1017EJ). Match confidence: 88%."

**Campaign 2: Supplier Deduplication**

| Property | Value |
|---|---|
| Name | MCG Supplier Dedup |
| Source | Route 7 output: fuzzy match candidates with 85-95% confidence |
| Record count | ~80 supplier groups (Samsung ×4, Nestlé ×3, Unilever ×3, etc.) |
| Assignee | Procurement Team |
| Task type | Confirm merge / mark as distinct |
| Deadline | 14 days |
| Nightmare | #3 (Product Master Mess) |

**Campaign 3: Missing Product Weights**

| Property | Value |
|---|---|
| Name | MCG Product Weight Completion |
| Source | Route 4 output: products where `weight_kg IS NULL OR weight_kg = 0` |
| Record count | ~8,200 products |
| Assignee | Product Data Team (category managers) |
| Task type | Data enrichment (fill in missing weight) |
| Deadline | 60 days |
| Nightmare | #3 |

**Campaign 4: Lot Number Compliance**

| Property | Value |
|---|---|
| Name | MCG Lot Number Compliance |
| Source | Route 2 output: grocery/fresh inventory where `lot_number IS NULL` |
| Record count | ~750 inventory positions (15% of grocery) |
| Assignee | Warehouse Supervisors (per DC) |
| Task type | Investigation (find lot number from physical labels or supplier records) |
| Deadline | 30 days |
| Nightmare | #7 (Compliance Gap) |

### 9.2 Setup in Qlik Cloud

1. **Data Governance** → **Stewardship** → **Create Campaign**
2. Select the source dataset (Silver-layer table with flagged records)
3. Define task fields (what the steward sees and can edit)
4. Assign to user group
5. Set notification preferences (email + Teams via automation)

---

## 10. Business Glossary

### 10.1 Create Glossary

In **Data Governance** → **Business Glossary** → **Create**:

Name: `MCG Supply Chain Glossary`

### 10.2 Terms

Create the following ~25 terms. Each links to related datasets, nightmares, and data products.

**Inventory & Warehouse:**

| Term | Definition | Owner | Related Nightmare |
|---|---|---|---|
| Phantom Inventory | Inventory that appears in ERP/WMS but does not physically exist in the warehouse. Caused by sync failures between systems. | Henrik Jansen | #1 |
| IRA (Inventory Record Accuracy) | Percentage of SKU/location combinations where system quantity matches physical count. MCG current: 74%, target: 97%. | Henrik Jansen | #1 |
| Cycle Count | Physical count of inventory at a specific bin location to verify system accuracy. Performed per SOP-WH-002. | Warehouse Ops | #1 |
| Goods Receipt | Process of receiving and validating incoming merchandise at a DC. Per SOP-WH-001. | Warehouse Ops | #1, #7 |
| Lot Number | Unique identifier assigned to a batch of products from a single production run. Required for food traceability per EC 178/2002. | Quality | #7 |

**Supply Chain & Logistics:**

| Term | Definition | Owner | Related Nightmare |
|---|---|---|---|
| WISMO | "Where Is My Order" — customer inquiry about delivery status. 41% of MCG customer service calls. Cost: $2.30/call. | Lisa Park | #6 |
| SLA Breach | Failure to deliver within the promised delivery window. APAC current: 22% breach rate (target: <8%). | Thomas Brennan | #6 |
| Cold Chain Exceedance | Temperature reading outside acceptable range for the product type (e.g., >8°C for fresh produce for 30+ min). | Thomas Brennan | #4, #6 |
| Delivery Promise | Commitment shown to customer at checkout for delivery date. Governed by MCG-POL-020. | Sophie Müller | #6 |
| Pre-Cool Compliance | Whether transport unit reached target temperature (0°C) before loading. Updated requirement post-INC-2025-05102. | Thomas Brennan | #6 |

**Data & Technology:**

| Term | Definition | Owner | Related Nightmare |
|---|---|---|---|
| CDC (Change Data Capture) | Technology that captures row-level changes in a database and streams them to a target. Used by Qlik Replicate/Talend. | Marcus Chen | #4 |
| Data Movement Gateway | Qlik software installed on-premises that enables CDC from databases behind firewalls to Qlik Cloud. | IT Ops | #4 |
| Trust Score | Qlik-calculated score (0.0-1.0) indicating data reliability. Combines completeness, accuracy, timeliness, and consistency dimensions. | Priya Ramanathan | All |
| Data Product | A governed, documented, SLA-backed dataset published for consumption via API or analytics tools. | Priya Ramanathan | All |
| Table Recipe | A Qlik Talend Cloud data flow definition that transforms data between Lakehouse layers (Bronze → Silver → Gold). | Data Engineering | All |

**Governance & Compliance:**

| Term | Definition | Owner | Related Nightmare |
|---|---|---|---|
| NVWA | Netherlands Food and Consumer Product Safety Authority. Regulatory body that issued citation NVWA-2025-CIT-04412 to MCG. | Dr. Elena Vasquez | #7 |
| EC 178/2002 | EU General Food Law Regulation requiring "one step back, one step forward" traceability for food products. | Dr. Elena Vasquez | #7 |
| Sub-Tier Supplier | A supplier's supplier — e.g., the farm that supplies Fresh Direct NL, who supplies MCG. Currently 64% undocumented. | Procurement | #7 |
| GTIN/EAN | Global Trade Item Number / European Article Number. Universal product barcode. Missing for 9% of MCG products (all Americas legacy). | Product Data | #3 |

**Architecture:**

| Term | Definition | Owner | Related Nightmare |
|---|---|---|---|
| Bronze Layer | Raw landing zone in Open Lakehouse. Preserves original dirty data as-is from source systems. For audit and lineage. | Data Engineering | All |
| Silver Layer | Cleansed, standardized data in Open Lakehouse. Output of transformation routes. For analysts and data scientists. | Data Engineering | All |
| Gold Layer | Business-ready data products in Open Lakehouse. Aggregated, enriched, governed. For executives and downstream consumers. | Data Engineering | All |
| Carrier Status Canonical | MCG's standardized shipment lifecycle status codes, mapped from 6+ carrier-specific vocabularies. | Sophie Müller | #6 |
| Address Quality Score | Per-address score (0.0-1.0) calculated during address standardization. Predicts carrier delivery success rate. | Customer Data | #2 |

### 10.3 Import via API

Glossary terms can be loaded from `deploy/glossary_terms.json`:
```bash
python deploy/deploy_qlik.py  # Includes glossary import step
```

---

## 11. Automation — Microsoft Teams

### 11.1 Cold Chain Alert → Teams Channel

**Purpose:** When IoT sensors detect a temperature exceedance lasting 15+ minutes, post an alert to the `#mcg-cold-chain-alerts` Teams channel.

**Build in Qlik Application Automation:**

1. **Trigger:** Qlik Sense Reload Task Complete → check `gold.spoilage_risk` for new exceedance rows
   - Alternative trigger: Webhook from IoT pipeline when exceedance detected

2. **Condition Block:** Filter for `exceedance_minutes >= 15 AND alert_sent = FALSE`

3. **Microsoft Teams Block:** Post Adaptive Card to channel
   ```
   🚨 Cold Chain Alert — Temperature Exceedance
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Shipment: {shipment_id}
   Route: {route} ({carrier})
   Current Temp: {current_temp}°C (limit: {limit}°C)
   Duration: {exceedance_minutes} minutes
   Products at Risk: {product_count} SKUs
   Estimated Exposure: ${estimated_loss}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Action Required: Contact carrier immediately.
   📊 Dashboard: [Open Cold Chain Monitor]({dashboard_url})
   📋 Procedure: See SOP-SC-002 Section 4
   ```

4. **Update Block:** Set `alert_sent = TRUE` in the source table

**Teams setup:**
- Create a Teams channel: `#mcg-cold-chain-alerts`
- In Qlik Automation: Add Microsoft Teams connector (OAuth consent)
- Select workspace → channel → configure Adaptive Card template

### 11.2 Pipeline Health Daily Summary → Teams

**Purpose:** Daily summary of all data pipeline health statuses posted to `#mcg-data-engineering`.

**Automation flow:**
1. **Trigger:** Scheduled — daily at 07:00 UTC
2. **Qlik API Block:** Query pipeline health status for all 28 DC pipelines
3. **Aggregate:** Count healthy / degraded / failed pipelines
4. **Teams Post:**
   ```
   📊 MCG Pipeline Health — Daily Summary ({date})
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ✅ Healthy: {healthy_count}/28 pipelines
   ⚠️ Degraded: {degraded_count} (sync lag > 30 min)
   ❌ Failed: {failed_count}

   Data Freshness:
   • PostgreSQL (WMS): Last sync {pg_last_sync} ({pg_lag})
   • Kafka (IoT): Streaming ({kafka_status})
   • Salesforce (CRM): Last sync {sf_last_sync} ({sf_lag})

   Trust Scores:
   • Inventory: {inv_trust}  • Addresses: {addr_trust}
   • Products: {prod_trust}  • Shipments: {ship_trust}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   {failed_details}
   ```

### 11.3 Stewardship Task Assignment → Teams DM

**Purpose:** When a new stewardship task is created, send a direct message to the assigned steward.

**Automation flow:**
1. **Trigger:** Stewardship campaign task created
2. **Lookup:** Get steward's Teams user ID from user mapping
3. **Teams DM:**
   ```
   📋 New Data Stewardship Task Assigned
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Campaign: {campaign_name}
   Task: {task_description}
   Records to review: {record_count}
   Deadline: {deadline}
   Priority: {priority}

   🔗 Open in Stewardship: {stewardship_url}
   ```

---

## 12. Discovery Agent

### 12.1 Enable Discovery Agent

1. In Qlik Cloud: **Analytics** → **Discovery Agent** → **Enable**
2. Connect to data products:
   - `gold.supply_chain_health`
   - `gold.spoilage_risk`
   - `gold.last_mile_performance`
3. Set monitoring frequency: continuous (streaming data products) or 15-min intervals

### 12.2 Demo Scenario: TransFrio Spoilage Detection

**Narrative:** The Discovery Agent should detect the spoilage anomaly on the São Paulo→Buenos Aires route the same way Roberto Almeida's team eventually did — but in hours instead of weeks.

**What the Agent monitors:**
- `gold.spoilage_risk`: temperature exceedance rates by route and carrier
- `gold.supply_chain_health`: pipeline health and data freshness

**Expected Discovery Agent alert:**

> **Anomaly Detected: Spoilage Rate Spike on GRU-BA Route**
>
> Temperature exceedance rate on the São Paulo → Buenos Aires corridor has increased from 2.1% (Q2 baseline) to 8.8% over the past 3 weeks.
>
> **Key observations:**
> - Spike began approximately July 7, 2025
> - Affected carrier: TransFrio Logistics S.A.
> - 6 of 12 fleet vehicles show higher exceedance rates than others
> - Pre-cooling compliance dropped from 94% to 62% in the same period
>
> **Estimated impact:** 12 active shipments at risk. Projected weekly loss: ~$267K at current spoilage rate.
>
> **Recommended actions:**
> - Review carrier fleet data for vehicle changes
> - Check pre-cooling procedures
> - See related: INC-2025-05102, CARRIER-TransFrio contract
>
> [Open Spoilage Dashboard →] [Open Carrier Contract →]

**Demo talking point:** "The Discovery Agent correlated what took a human analyst 3 weeks to find — the connection between fleet vehicle changes and temperature exceedances. With connected data in the Lakehouse, the pattern was visible from Day 1."

### 12.3 Additional Discovery Agent Scenarios

**Scenario B: Rotterdam Pipeline Failure**
- Agent monitors `gold.supply_chain_health` pipeline freshness
- Detects: "Inventory data for DC-RTD-01 has not refreshed in 72 hours. Last sync: August 31, 02:12 UTC."
- Impact: "847 phantom inventory units estimated. 94 orders may be allocated against non-existent stock."

**Scenario C: NinjaVan SLA Drift**
- Agent monitors `gold.last_mile_performance` for Singapore
- Detects: "Singapore delivery promise accuracy declined from 88% to 69% over 4 weeks. Carrier: NinjaVan."
- Correlation: "NinjaVan contract amendment AMD3 (effective Oct 1) reclassified 5-10 kg parcels. Website SLA not updated."

---

## 13. MCP Server

### 13.1 What is the Qlik MCP Server?

The Model Context Protocol (MCP) server exposes Qlik Cloud data and analytics to AI agents (Claude, GPT, etc.) as structured tools. This enables AI to:
- Query data products via natural language
- Read dashboard metrics
- Trigger automations
- Access the business glossary

### 13.2 Installation

```bash
# Install via npm (global)
npm install -g @qlik/mcp-server

# Or run via npx (no install)
npx @qlik/mcp-server
```

### 13.3 Configuration for Claude Desktop

Edit `~/.config/claude/claude_desktop_config.json` (macOS/Linux) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "qlik": {
      "command": "npx",
      "args": ["-y", "@qlik/mcp-server"],
      "env": {
        "QLIK_TENANT_URL": "https://mcg-demo.us.qlikcloud.com",
        "QLIK_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### 13.4 Configuration for Claude Code

Edit `.claude/settings.json` in your project root:

```json
{
  "mcpServers": {
    "qlik": {
      "command": "npx",
      "args": ["-y", "@qlik/mcp-server"],
      "env": {
        "QLIK_TENANT_URL": "https://mcg-demo.us.qlikcloud.com",
        "QLIK_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### 13.5 Troubleshooting MCP Connection Issues

**Common reasons LLMs don't register the Qlik MCP connection:**

| Issue | Symptom | Fix |
|---|---|---|
| **npm/npx not in PATH** | MCP server process fails to start | Ensure Node.js 18+ is installed and `npx` is in system PATH |
| **API key invalid/expired** | Server starts but tools return 401 | Generate a new API key in Qlik Cloud Settings → API Keys |
| **Tenant URL wrong** | Connection timeout | Verify the full URL including region: `https://tenant.us.qlikcloud.com` (not just `tenant`) |
| **Package not found** | `@qlik/mcp-server` not found | Check the exact npm package name — it may be `@qlik-oss/qlik-mcp-server` or similar. Search npmjs.com |
| **Firewall blocking** | Timeout on MCP tool calls | Ensure outbound HTTPS (443) to `*.qlikcloud.com` is allowed |
| **Claude Desktop version** | MCP tools don't appear in tool list | Update Claude Desktop to latest version; MCP requires v0.7+ |
| **Config syntax error** | MCP server not listed in available tools | Validate JSON syntax in config file; common error: trailing commas |
| **Environment variable missing** | Server starts but can't authenticate | Both `QLIK_TENANT_URL` and `QLIK_API_KEY` must be set in the `env` block |
| **Permission scope** | Some operations fail with 403 | API key needs sufficient permissions: data access, app read, space access |

**Debug steps:**
1. Test the MCP server standalone:
   ```bash
   QLIK_TENANT_URL=https://mcg-demo.us.qlikcloud.com \
   QLIK_API_KEY=your-key \
   npx @qlik/mcp-server
   ```
2. Check Claude Desktop logs: **Help → Show Logs** → look for MCP connection errors
3. Verify API key works directly:
   ```bash
   curl -H "Authorization: Bearer your-key" \
     https://mcg-demo.us.qlikcloud.com/api/v1/users/me
   ```

### 13.6 Demo Scenario: Claude + Qlik MCP

**User prompt to Claude:**
> "What's the current inventory accuracy rate at Rotterdam DC, and what's causing the issues?"

**Claude's process (via MCP):**
1. Uses Qlik MCP tool to query `gold.supply_chain_health` filtered by `dc = 'DC-RTD-01'`
2. Gets: IRA = 74%, phantom_units = 847, pipeline_status = "RECOVERED"
3. Uses Qlik MCP to query `gold.order_timeline` for affected orders
4. Uses Qlik Answers to pull context from INC-2025-04872 (Rotterdam Pipeline Failure)

**Claude's response:**
> "Rotterdam DC's Inventory Record Accuracy is currently 74%, significantly below the 97% target. The primary cause was a silent pipeline failure (INC-2025-04872) where the WMS-to-SAP CDC sync stopped for 72 hours due to an expired TLS certificate. This created 847 units of phantom inventory across 143 SKUs, costing €30,500 in emergency transfers.
>
> The pipeline has been recovered, and automated monitoring has been deployed at Rotterdam. However, the remaining 27 DCs still rely on manual daily sync checks (855 person-hours/day total). Project CLARITY Phase 1 will extend automated monitoring to all DCs by Q2 2026."

**Demo talking point:** "Claude didn't just query a number — it combined real-time data from the Lakehouse with operational context from Qlik Answers documents, all through the MCP integration."

---

## Quick Reference: Component-to-Nightmare Matrix

| Component | N#1 Phantom | N#2 Address | N#3 Product | N#4 Pipeline | N#5 Timestamp | N#6 Carrier | N#7 Compliance |
|---|---|---|---|---|---|---|---|
| PostgreSQL Source | ★ | | ● | ★ | ★ | ★ | ● |
| Kafka Source | | | | ★ | ★ | ★ | |
| Salesforce Source | | ★ | ★ | | | ● | ● |
| Open Lakehouse | ★ | ★ | ★ | ★ | ★ | ★ | ★ |
| Data Flow Route 1 | | | | | ★ | | |
| Data Flow Route 2 | ★ | | ● | | | | ● |
| Data Flow Route 3 | | ★ | | | | | |
| Data Flow Route 4 | | | ★ | | | | ● |
| Data Flow Route 5 | | | | | ● | ★ | |
| Data Flow Route 6 | | | | ★ | ★ | | |
| Data Flow Route 7 | | | ★ | | | | |
| Data Flow Route 8 | | | | | ★ | ★ | |
| Data Products | ★ | ★ | ★ | ★ | | ★ | ★ |
| Predict (Spoilage) | | | | | | ★ | |
| Predict (SLA) | | ★ | | | | ★ | |
| Answers | ★ | | | ★ | | ★ | ★ |
| Stewardship | | ★ | ★ | | | | ★ |
| Glossary | ★ | ★ | ★ | ★ | ★ | ★ | ★ |
| Teams Automation | | | | ★ | | ★ | |
| Discovery Agent | ★ | | | ★ | | ★ | |
| MCP Server | ★ | | | | | | |

★ = Primary demonstration   ● = Supporting role

---

*MCG Demo — Full Qlik Cloud Setup Guide*
*Version 1.0 — February 2026*
