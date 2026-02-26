# Meridian Commerce Group -- Talend Transformation Routes
## ELT Architecture: Source → Open Lakehouse → Transform → Downstream

---

## Architecture Overview

**Key Design Decision**: Data lands RAW in the Open Lakehouse Bronze layer first (Extract-Load). Qlik Talend Cloud then reads FROM Bronze, applies transformations, and writes cleansed data back to Silver and Gold layers within the Lakehouse (Transform). Gold-tier data products are then exported downstream as flat files for B2B consumers.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                           SOURCE LAYER                                        │
│                                                                               │
│   PostgreSQL (WMS)         Kafka (IoT)           Salesforce (CRM/Orders)      │
│   ┌──────────────┐     ┌──────────────┐        ┌──────────────┐              │
│   │ inventory     │     │ cold-chain   │        │ Contact      │              │
│   │ wh_events     │     │ carrier-evts │        │ MCG_Order__c │              │
│   │ shipments     │     │              │        │ MCG_Product  │              │
│   └──────┬───────┘     └──────┬───────┘        └──────┬───────┘              │
│          │ CDC                │ Stream                 │ API (Full+Incr)      │
└──────────┼────────────────────┼────────────────────────┼──────────────────────┘
           │                    │                        │
           ▼                    ▼                        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│              QLIK TALEND CLOUD -- INGESTION LAYER (EL)                        │
│                                                                               │
│   Raw data replicated as-is with no transformation.                           │
│   CDC for PostgreSQL, streaming for Kafka, API pull for Salesforce.           │
│   Data Movement Gateway handles on-prem PostgreSQL connection.                │
│                                                                               │
│   Pipeline health monitoring: freshness checks, row counts, schema drift.     │
│                                                                               │
└──────────────────────────────────┬────────────────────────────────────────────┘
                                   │
                                   ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                     QLIK OPEN LAKEHOUSE                                       │
│                     Apache Iceberg Tables                                     │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  BRONZE LAYER (raw landing -- preserves original for lineage/audit)     │  │
│  │  bronze.inventory_raw | bronze.iot_raw | bronze.contacts_raw |          │  │
│  │  bronze.orders_raw | bronze.products_raw | bronze.shipments_raw |       │  │
│  │  bronze.carrier_events_raw                                              │  │
│  │                                                                         │  │
│  │  *** DATA LANDS HERE FIRST -- dirty, as-is, warts and all ***           │  │
│  └──────────────────────────────────┬──────────────────────────────────────┘  │
│                                     │                                         │
│            Qlik Talend Cloud reads from Bronze, transforms, writes back       │
│                                     │                                         │
│                                     ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  TRANSFORMATION ROUTES (8 Pipelines -- Talend reads/writes OLH)        │  │
│  │                                                                         │  │
│  │  Route 1: Timestamp Normalization (cross-cutting, runs first)           │  │
│  │  Route 2: Inventory Reconciliation & Quality                            │  │
│  │  Route 3: Address Standardization & Dedup                               │  │
│  │  Route 4: Product Master Harmonization                                  │  │
│  │  Route 5: Carrier Status Canonicalization                               │  │
│  │  Route 6: IoT Telemetry Normalization & Enrichment                      │  │
│  │  Route 7: Supplier Master Deduplication                                 │  │
│  │  Route 8: Order-to-Delivery Unified Timeline                            │  │
│  │                                                                         │  │
│  │  + Data Quality Rules Engine | Trust Score Calculation | Data Catalog    │  │
│  └──────────────────────────────────┬──────────────────────────────────────┘  │
│                                     │                                         │
│                                     ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  SILVER LAYER (cleansed, standardized, deduplicated)                    │  │
│  │  silver.inventory_clean | silver.iot_normalized | silver.customers |     │  │
│  │  silver.orders_clean | silver.products_harmonized | silver.shipments |   │  │
│  │  silver.carrier_canonical | silver.suppliers_deduped                     │  │
│  └──────────────────────────────────┬──────────────────────────────────────┘  │
│                                     │                                         │
│                                     ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  GOLD LAYER (business-ready data products)                              │  │
│  │  gold.supply_chain_health | gold.last_mile_performance |                │  │
│  │  gold.spoilage_risk | gold.customer_360 | gold.compliance_traceability |│  │
│  │  gold.inventory_b2b_feed | gold.order_timeline                          │  │
│  └──────────────────────────────────┬──────────────────────────────────────┘  │
│                                     │                                         │
└─────────────────────────────────────┼─────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼──────────────────────────┐
          ▼                           ▼                          ▼
┌──────────────────┐  ┌───────────────────────┐  ┌──────────────────────────┐
│  QLIK ANALYTICS  │  │  QLIK AI LAYER        │  │  DOWNSTREAM OUTPUTS      │
│                  │  │                       │  │                          │
│  Qlik Sense      │  │  Qlik Answers (RAG)   │  │  B2B Inventory Feed      │
│  Dashboards      │  │  Discovery Agent      │  │  (CSV / flat file)       │
│  Trust Score     │  │  AutoML / Predict     │  │                          │
│  visualizations  │  │  MCP Server           │  │  Compliance Reports      │
│                  │  │                       │  │  (scheduled PDF/CSV)     │
│                  │  │                       │  │                          │
│                  │  │                       │  │  Carrier Reconciliation   │
│                  │  │                       │  │  (EDI / flat file)       │
└──────────────────┘  └───────────────────────┘  └──────────────────────────┘
```

---

## ELT Flow: Why Data Lands in OLH Before Transformation

The architecture follows an **ELT (Extract-Load-Transform)** pattern, NOT a traditional ETL pattern:

| Step | What Happens | Where It Runs |
|---|---|---|
| **Extract** | CDC captures changes from PostgreSQL; Kafka streams IoT events; Salesforce API pulls CRM data | Qlik Talend Cloud ingestion pipelines |
| **Load** | Raw data is written directly to Open Lakehouse Bronze layer as Apache Iceberg tables -- no transformation applied | Qlik Talend Cloud → OLH Bronze |
| **Transform** | Talend reads FROM Bronze, applies 8 transformation routes, writes cleansed data to Silver and Gold layers | Qlik Talend Cloud reading/writing OLH |

**Why ELT instead of ETL?**
1. **Raw data is always preserved**: Bronze layer is the audit trail. Regulators (NVWA) or data engineers can always query the original dirty data.
2. **Transformations are replayable**: If a transformation route has a bug, fix it and re-run from Bronze. No need to re-ingest from source.
3. **Compute scales independently**: OLH handles storage, Talend handles compute. They scale independently.
4. **Downstream flexibility**: Different Gold-tier products can be built from the same Silver data without re-ingestion.

## Lakehouse Layer Strategy (Bronze / Silver / Gold)

| Layer | Purpose | Data State | Who Consumes It |
|---|---|---|---|
| **Bronze** | Raw landing zone -- exact copy of source data, warts and all. Data arrives here FIRST via Talend ingestion pipelines. | Dirty, as-is from source | Data engineers (debugging, lineage, audit) |
| **Silver** | Cleansed, standardized, type-converted, deduplicated. Created by Talend transformation routes reading from Bronze. | Clean, consistent, trustworthy | Analysts, data scientists, Qlik Sense |
| **Gold** | Business-ready data products -- pre-aggregated, enriched, governed. Created by Talend routes reading from Silver. | Curated, documented, SLA-backed | Executives, Qlik Answers, Discovery Agent, AutoML, Downstream outputs |

**Key principle:** Bronze preserves the original dirty data so you can always demonstrate the "before" state. Silver is where the transformation magic happens. Gold is what the business and downstream consumers receive.

## Downstream Outputs (Gold → External)

Gold-tier data products are exported from the Open Lakehouse for downstream consumers via Talend Cloud output pipelines.

### Output 1: B2B Inventory Feed (Flat File)

**Purpose**: Provide MCG's B2B wholesale customers with daily inventory availability data so they can plan purchases.

**Schedule**: Daily at 06:00 UTC (before business hours in all regions)

**Format**: CSV (pipe-delimited), UTF-8, with header row

**Target**: SFTP drop to `sftp://b2b-feeds.mcg-logistics.com/inventory/daily/`

**File naming**: `MCG_INVENTORY_FEED_{YYYY-MM-DD}.csv`

#### Schema

| Column | Type | Source (Gold) | Example | Notes |
|---|---|---|---|---|
| `SKU` | VARCHAR(20) | gold.inventory_b2b_feed.sku | MCG-4420 | MCG SKU number |
| `PRODUCT_NAME` | VARCHAR(100) | gold.inventory_b2b_feed.product_name | Meridian Bluetooth Speaker | English product name |
| `CATEGORY` | VARCHAR(50) | gold.inventory_b2b_feed.category | Consumer Electronics | Standardized category |
| `WAREHOUSE_CODE` | VARCHAR(10) | gold.inventory_b2b_feed.warehouse_code | DC-RTD-01 | MCG DC code |
| `WAREHOUSE_COUNTRY` | VARCHAR(2) | gold.inventory_b2b_feed.warehouse_country | NL | ISO 3166-1 alpha-2 |
| `QUANTITY_AVAILABLE` | INTEGER | gold.inventory_b2b_feed.qty_available | 487 | Available to promise |
| `UNIT_OF_MEASURE` | VARCHAR(3) | gold.inventory_b2b_feed.uom | EA | Standardized: EA, CS, PAL |
| `UNIT_PRICE_EUR` | DECIMAL(10,2) | gold.inventory_b2b_feed.unit_price_eur | 24.99 | EUR wholesale price |
| `LAST_UPDATED_UTC` | TIMESTAMP | gold.inventory_b2b_feed.last_updated | 2025-10-15T06:00:00Z | Always UTC |
| `TRUST_SCORE` | DECIMAL(3,2) | gold.inventory_b2b_feed.trust_score | 0.82 | Qlik Trust Score (0-1) |
| `DATA_QUALITY_FLAG` | VARCHAR(20) | gold.inventory_b2b_feed.dq_flag | CLEAN \| ESTIMATED \| STALE | DQ status indicator |

#### Intentional Data Quality Issues in the Feed (for demo)

The B2B feed inherits data quality issues from upstream, demonstrating that even "Gold" outputs can carry quality signals:

| Issue | Example | Frequency | Qlik Trust Score Impact |
|---|---|---|---|
| **STALE data** | Inventory qty not updated for 24+ hours due to pipeline delay | 5-8% of rows | Trust Score drops to 0.45 |
| **ESTIMATED quantities** | When WMS data is missing, uses last known + forecast adjustment | 3% of rows | Trust Score at 0.65, DQ_FLAG = "ESTIMATED" |
| **Negative available qty** | Oversold SKUs where orders exceed physical stock | 1-2% of rows | Trust Score at 0.30, QTY_AVAILABLE shows negative |
| **Missing price** | New SKUs without confirmed wholesale pricing | 1% of rows | UNIT_PRICE_EUR = NULL |
| **Mixed UoM** | Occasionally a case (CS) quantity leaks through as each (EA) | 0.5% of rows | Trust Score at 0.50 |

**Demo value**: Show how Qlik Trust Score propagates through to downstream consumers. A B2B customer receiving this feed can filter by TRUST_SCORE > 0.80 to only use high-confidence data, or they can see the DQ_FLAG to understand what's wrong.

### Output 2: Compliance Traceability Report (Scheduled CSV)

**Purpose**: Automated weekly report for compliance team showing lot-to-store traceability status.

**Schedule**: Weekly (Monday 08:00 CET)

**Format**: CSV + PDF summary

**Target**: Email to compliance team + archive to SharePoint

#### Key Fields
- Product SKU, Lot Number, Supplier, Farm of Origin
- DC Receipt Date, DC Receipt Lot Captured (Y/N)
- Store Delivery Date, Store Receipt Scanned (Y/N)
- Traceability Chain Complete (Y/N)
- Days Since Receipt (for retention tracking)

### Output 3: Carrier Reconciliation File (Weekly EDI/CSV)

**Purpose**: Reconcile MCG shipment records against carrier billing to identify discrepancies.

**Schedule**: Weekly (per carrier billing cycle)

**Format**: CSV (for DPD/NinjaVan) or UN/EDIFACT IFTSTA (for FedEx)

#### Key Fields
- Shipment ID, Carrier, Service Level
- MCG Expected SLA, Actual Delivery Time, SLA Met (Y/N)
- MCG Billed Rate, Carrier Invoice Rate, Variance
- Surcharges Applied, Disputed Amount

---

## Route 1: Timestamp Normalization (Cross-Cutting)

**Nightmare addressed:** #5 (Timestamp Tower of Babel)
**Source:** ALL Bronze tables in OLH (`bronze.inventory_raw`, `bronze.iot_raw`, `bronze.contacts_raw`, etc.)
**Target:** Adds normalized timestamp columns to Silver tables
**Priority:** Must run FIRST -- every downstream route depends on consistent timestamps

### Transformation Logic

```
INPUT: Raw timestamps from Bronze layer tables in Open Lakehouse
OUTPUT: Two columns -- original_timestamp (preserved) + normalized_timestamp_utc (TIMESTAMPTZ)

Rules:
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. If timestamp has 'Z' suffix → already UTC, parse directly           │
│ 2. If timestamp has offset (e.g., +01:00) → convert to UTC             │
│ 3. If timestamp has NO timezone indicator:                              │
│    a. Look up source system:                                            │
│       - PostgreSQL WMS tables → apply warehouse local timezone          │
│       - Kafka IoT (TIVE-*) → assume UTC                                │
│       - Kafka IoT (SENS-*) → assume warehouse local timezone            │
│    b. Convert to UTC                                                    │
│ 4. If timestamp is non-ISO format:                                      │
│    a. 'DD/MM/YYYY HH:MM' (Brazilian) → parse as BRT (UTC-3)           │
│    b. 'Oct 18 2025' (informal) → parse as WAT (UTC+1), set time 12:00 │
│    c. Epoch milliseconds → convert directly                             │
│ 5. Truncate milliseconds for consistency (preserve in _raw column)      │
│ 6. Store result as TIMESTAMPTZ in Iceberg                               │
└─────────────────────────────────────────────────────────────────────────┘
```

### Talend Pipeline Design

```
Source Dataset (any)
    │
    ├── tMap: Extract timestamp columns
    │     │
    │     ├── original_timestamp → pass through (preserve for lineage)
    │     │
    │     └── Apply timezone resolution logic:
    │           │
    │           ├── CASE: has 'Z' → parseISO(ts)
    │           ├── CASE: has '+/-' → parseISO(ts).toUTC()
    │           ├── CASE: matches 'DD/MM/YYYY' → parseBrazilian(ts, 'BRT')
    │           ├── CASE: matches 'Mon DD YYYY' → parseInformal(ts, warehouse_tz)
    │           └── CASE: no TZ → lookup(source_system, warehouse_id) → applyOffset → toUTC()
    │
    ├── tMap: Add metadata columns
    │     │
    │     ├── _tz_source = 'EXPLICIT' | 'INFERRED_WAREHOUSE' | 'INFERRED_UTC'
    │     ├── _tz_confidence = 'HIGH' | 'MEDIUM' | 'LOW'
    │     └── _tz_original_format = 'ISO_UTC' | 'ISO_OFFSET' | 'BARE_LOCAL' | 'BRAZILIAN' | 'INFORMAL'
    │
    └── Output: normalized_timestamp_utc (TIMESTAMPTZ)
```

### Iceberg Table Output

| Column | Type | Example | Notes |
|---|---|---|---|
| `normalized_timestamp_utc` | TIMESTAMPTZ | `2025-10-15T13:22:47+00:00` | Always UTC |
| `original_timestamp_raw` | VARCHAR | `2025-10-15T14:22:47` | Preserved as-is |
| `tz_resolution_method` | VARCHAR | `INFERRED_WAREHOUSE` | How timezone was determined |
| `tz_confidence` | VARCHAR | `MEDIUM` | HIGH if explicit, MEDIUM if inferred, LOW if guessed |

---

## Route 2: Inventory Reconciliation & Quality

**Nightmare addressed:** #1 (Phantom Inventory), #4 (Silent Pipelines)
**Source:** OLH `bronze.inventory_raw` + `bronze.warehouse_events_raw` (already landed via ingestion)
**Target:** `silver.inventory_reconciled` + `gold.supply_chain_health` + `gold.inventory_b2b_feed`

### Transformation Logic

```
Step 1: READ FROM BRONZE (OLH)
  └── Talend reads bronze.inventory_raw + bronze.warehouse_events_raw from Open Lakehouse

Step 2: DATA QUALITY RULES
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ Rule DQ-INV-001: quantity_on_hand must be >= 0                         │
  │   Action: Flag negative values, route to exception table               │
  │                                                                        │
  │ Rule DQ-INV-002: unit_of_measure must be in ('EA','CS','PAL')          │
  │   Action: Map variants → canonical ('EACH'→'EA', 'UNIT'→'EA',         │
  │           'PK'→'EA', 'CASE'→'CS')                                     │
  │                                                                        │
  │ Rule DQ-INV-003: storage_zone must be in ('AMBIENT','CHILLED','FROZEN')│
  │   Action: Map variants → canonical ('KALT'→'CHILLED', 'FROID'→       │
  │           'CHILLED', 'ROOM_TEMP'→'AMBIENT', 'AMB'→'AMBIENT',          │
  │           'FRZ'→'FROZEN')                                              │
  │                                                                        │
  │ Rule DQ-INV-004: snapshot_timestamp must be within 24 hours of current │
  │   Action: Flag stale records (>24h = potential pipeline failure)        │
  │                                                                        │
  │ Rule DQ-INV-005: lot_number must NOT be NULL for perishable SKUs       │
  │   Action: Flag for compliance stewardship task (Nightmare #7)          │
  │                                                                        │
  │ Rule DQ-INV-006: SKU must exist in product master                      │
  │   Action: Attempt cross-reference via legacy SKU mapping table.        │
  │           If no match, route to exception queue.                        │
  └─────────────────────────────────────────────────────────────────────────┘

Step 3: SKU HARMONIZATION
  └── Join with silver.product_master (from Route 4) on:
        sku = product_master.sku
        OR sku = product_master.legacy_sku_americas
        OR sku = product_master.legacy_sku_eu
      Output: canonical golden_sku for every record

Step 4: TIMESTAMP NORMALIZATION
  └── Apply Route 1 to snapshot_timestamp and last_count_date

Step 5: FRESHNESS CHECK (Nightmare #4)
  └── Compare MAX(snapshot_timestamp) per warehouse against current_time
      If gap > 1 hour → flag as STALE
      If gap > 24 hours → flag as PIPELINE_FAILURE_SUSPECTED
      → Write alert record to gold.pipeline_health_alerts

Step 6: WRITE TO SILVER
  └── silver.inventory_reconciled
      (clean quantities, canonical UoM, canonical zones,
       UTC timestamps, golden_sku, quality flags)

Step 7: AGGREGATE TO GOLD
  └── gold.supply_chain_health
      Aggregation per warehouse + category:
        - total_skus_in_stock
        - total_units_on_hand
        - pct_negative_inventory (quality metric)
        - pct_missing_lot_numbers (compliance metric)
        - avg_inventory_freshness_hours
        - data_quality_score (0-100)
```

### Talend Pipeline Components

```
tPostgresqlCDC → tMap (quality rules) → tMap (SKU harmonize)
                                            │
                    ┌───────────────────────┤
                    │                       │
                    ▼                       ▼
          tIcebergOutput              tIcebergOutput
          (silver.inventory)          (bronze.inventory_raw)
                    │
                    ▼
          tAggregateRow (per warehouse/category)
                    │
                    ▼
          tIcebergOutput (gold.supply_chain_health)
                    │
                    ▼
          tMap (freshness check) → tIcebergOutput (gold.pipeline_health_alerts)
```

---

## Route 3: Address Standardization & Deduplication

**Nightmare addressed:** #2 (Address Catastrophe)
**Source:** Salesforce `Contact` / `Account`
**Target:** `silver.customers` + `gold.customer_360`

### Transformation Logic

```
Step 1: INGEST (Bronze)
  └── Salesforce API → bronze.contacts_raw (all address chaos preserved)

Step 2: ADDRESS PARSING
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ Parse MailingStreet into structured components:                         │
  │   - street_number                                                      │
  │   - street_name                                                        │
  │   - unit_type ('Apt', 'Suite', '#', 'Conjunto')                       │
  │   - unit_number                                                        │
  │   - building_name                                                      │
  │   - floor                                                              │
  │                                                                        │
  │ Normalize unit_type:                                                   │
  │   'Apt' | 'Apartment' | 'Apartamento' | '#' → 'APT'                  │
  │   'Ste' | 'Suite' → 'STE'                                            │
  │   'Cj' | 'Conjunto' → 'STE' (Brazilian equivalent)                   │
  │   '3. OG' | '3rd Floor' → 'FL 3'                                     │
  └─────────────────────────────────────────────────────────────────────────┘

Step 3: COUNTRY NORMALIZATION
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ Map all country representations to ISO 3166-1 alpha-2:                 │
  │   'Netherlands' | 'Niederlande' | 'Pays-Bas' → 'NL'                  │
  │   'Deutschland' | 'Germany' | 'Allemagne'    → 'DE'                  │
  │   'United States' | 'USA' | 'Estados Unidos' → 'US'                  │
  │   'Singapore' | 'Singapur' | 'Singapour'     → 'SG'                  │
  │   'Brasil' | 'Brazil'                         → 'BR'                  │
  │   'Nigeria'                                    → 'NG'                  │
  └─────────────────────────────────────────────────────────────────────────┘

Step 4: POSTAL CODE STANDARDIZATION
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ Apply country-specific postal code formatting:                         │
  │   NL: 'NNNN LL' format → add space if missing ('1017EJ' → '1017 EJ') │
  │   BR: 'NNNNN-NNN' format → add hyphen if missing                     │
  │   DE: 5 digits (validate)                                              │
  │   US: 5 digits or 5+4 (normalize to 5)                               │
  │   SG: 6 digits (validate)                                              │
  └─────────────────────────────────────────────────────────────────────────┘

Step 5: PHONE NORMALIZATION
  └── Convert all phone numbers to E.164 format:
      '+31205550147' → '+31 20 555 0147'
      '(404) 555-0188' → '+1 404 555 0188'
      '08015550166' (NG local) → '+234 801 555 0166'

Step 6: DUPLICATE DETECTION (Fuzzy Matching)
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ Match candidates on:                                                    │
  │   - Normalized postal_code + street_number (exact)                     │
  │   - Last name (Jaro-Winkler similarity > 0.85)                        │
  │   - Email domain match                                                  │
  │                                                                        │
  │ Confidence scoring:                                                     │
  │   > 95%: Auto-merge (keep most complete record as master)              │
  │   85-95%: Route to Data Stewardship for manual review                  │
  │   < 85%: Treat as distinct customers                                   │
  └─────────────────────────────────────────────────────────────────────────┘

Step 7: TRUNCATION REPAIR
  └── Where address appears truncated (exactly 30 chars, ends mid-word):
      Flag as TRUNCATED, set address_quality = 'NEEDS_REVIEW'
      Route to stewardship queue for manual correction

Step 8: WRITE TO SILVER
  └── silver.customers
      (parsed address components, ISO country code, E.164 phone,
       dedup_group_id, match_confidence, quality_flags)

Step 9: AGGREGATE TO GOLD
  └── gold.customer_360
      (master customer record, merged address, lifetime value,
       order history linkage, address_quality_score)
```

---

## Route 4: Product Master Harmonization

**Nightmare addressed:** #3 (Product Master Data Mess)
**Source:** Salesforce `MCG_Product__c` + PostgreSQL `inventory_positions` (for SKU cross-reference)
**Target:** `silver.product_master` + `gold.product_catalog`

### Transformation Logic

```
Step 1: INGEST (Bronze)
  └── Salesforce → bronze.products_raw

Step 2: SKU CROSS-REFERENCE TABLE
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ Build a master SKU mapping:                                             │
  │                                                                        │
  │   golden_sku  │ legacy_americas │ legacy_eu   │ source                 │
  │   MCG-4420    │ AM-BT-SPKR-001 │ EU-44200    │ product_master         │
  │   MCG-4421    │ AM-HDPH-002    │ EU-44210    │ product_master         │
  │   MCG-4430    │ AM-CHRG-010    │ EU-44300    │ product_master         │
  │                                                                        │
  │ Every downstream table can JOIN on ANY of the three SKU columns        │
  │ to resolve to the golden_sku.                                          │
  └─────────────────────────────────────────────────────────────────────────┘

Step 3: CATEGORY HARMONIZATION
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ Normalize category hierarchies to a standard 3-level English taxonomy: │
  │                                                                        │
  │   German input:              Normalized output:                        │
  │   L1: Elektronik          → L1: Electronics                           │
  │   L2: Audio               → L2: Audio                                 │
  │   L3: Tragbare Lautspr.   → L3: Portable Speakers                    │
  │   L4: Bluetooth           → (mapped into L3 as attribute)             │
  │   L5: Unter 50 EUR        → (dropped -- price tier, not category)     │
  │                                                                        │
  │ Use a reference mapping table for German/Dutch/French → English.       │
  └─────────────────────────────────────────────────────────────────────────┘

Step 4: WEIGHT/DIMENSION QUALITY
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ Rule DQ-PROD-001: weight_kg must NOT be NULL or 0 for shippable items  │
  │   Action: Flag for stewardship. Set weight_quality = 'MISSING'.        │
  │                                                                        │
  │ Rule DQ-PROD-002: If weight_kg > 50 for category 'Electronics',       │
  │   likely data error (phone case weighing 45kg)                         │
  │   Action: Flag as IMPLAUSIBLE.                                         │
  │                                                                        │
  │ Rule DQ-PROD-003: Check for imperial/metric confusion.                 │
  │   If length_cm < 3.0 for a product category where avg > 10cm,         │
  │   likely stored in inches.                                              │
  │   Action: Flag as SUSPECTED_IMPERIAL. Create conversion candidate.     │
  └─────────────────────────────────────────────────────────────────────────┘

Step 5: SUPPLIER NAME STANDARDIZATION (feeds into Route 7)
  └── Extract supplier_name → send to Route 7 for dedup
      Receive back canonical supplier_id

Step 6: COMPLIANCE CHECK (Nightmare #7)
  └── For category = 'Grocery' or 'Fresh':
        If country_of_origin IS NULL → flag COMPLIANCE_GAP
        Route to compliance stewardship task

Step 7: WRITE TO SILVER + GOLD
  └── silver.product_master (harmonized, flagged)
  └── gold.product_catalog (curated, complete records only)
  └── gold.sku_crossref (the lookup table all other routes use)
```

---

## Route 5: Carrier Status Canonicalization

**Nightmare addressed:** #6 (Carrier Data Black Hole)
**Source:** PostgreSQL `shipments` + Kafka `mcg.iot.carrier-events`
**Target:** `silver.shipments_unified` + `gold.last_mile_performance`

### Transformation Logic

```
Step 1: INGEST (Bronze)
  └── PostgreSQL CDC + Kafka → bronze.shipments_raw

Step 2: STATUS CODE MAPPING
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ Canonical lifecycle:                                                    │
  │   LABEL_CREATED → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY →         │
  │   DELIVERED | DELIVERY_FAILED                                           │
  │                                                                        │
  │ Carrier-specific mapping:                                               │
  │                                                                        │
  │ FedEx:                                                                  │
  │   LABEL_CREATED → LABEL_CREATED                                        │
  │   PICKED_UP → PICKED_UP                                                │
  │   IN_TRANSIT → IN_TRANSIT                                               │
  │   ON_VEHICLE → OUT_FOR_DELIVERY                                        │
  │   DELIVERED → DELIVERED                                                 │
  │   DELIVERY_EXCEPTION → DELIVERY_FAILED                                 │
  │                                                                        │
  │ DPD (German):                                                           │
  │   Paketankündigung → LABEL_CREATED                                     │
  │   Abgeholt → PICKED_UP                                                 │
  │   In Zustellung → IN_TRANSIT                                           │
  │   In Auslieferung → OUT_FOR_DELIVERY                                   │
  │   Zugestellt → DELIVERED                                                │
  │   Zustellversuch → DELIVERY_FAILED                                     │
  │                                                                        │
  │ Correios (Portuguese):                                                  │
  │   Objeto postado → LABEL_CREATED                                       │
  │   Coletado → PICKED_UP                                                 │
  │   Em trânsito → IN_TRANSIT                                             │
  │   Saiu para entrega → OUT_FOR_DELIVERY                                 │
  │   Objeto entregue ao destinatário → DELIVERED                          │
  │   Não entregue → DELIVERY_FAILED                                       │
  │                                                                        │
  │ (Similar mappings for DHL, NinjaVan, LOCAL-LOS)                        │
  │                                                                        │
  │ UNMAPPED status codes → route to exception queue for manual mapping    │
  └─────────────────────────────────────────────────────────────────────────┘

Step 3: EXCEPTION CODE NORMALIZATION
  └── Map carrier-specific exception codes to canonical set:
        ADDR_INVALID | ADDR_FALSCH | CEP_INVALIDO | bad address → ADDRESS_INVALID
        NO_ACCESS | EMPF_NICHT_DA | AUSENTE | no one home → RECIPIENT_ABSENT
        BUSINESS_CLOSED | refused | REFUSED → REFUSED_OR_CLOSED

Step 4: WEIGHT NORMALIZATION
  └── If weight_unit IN ('lbs', 'LBS', 'lb') → convert weight_value * 0.4536 to kg
      Set weight_unit = 'kg' universally
      Flag original unit for lineage

Step 5: COUNTRY NORMALIZATION
  └── Apply same ISO 3166 mapping as Route 3

Step 6: TIMESTAMP NORMALIZATION
  └── Apply Route 1 to status_datetime, estimated_delivery, actual_delivery
      NOTE: status_datetime is stored as VARCHAR -- must handle all formats

Step 7: SLA CALCULATION
  └── Join with carrier rate/contract reference data:
        sla_hours = lookup(carrier_code, service_level, origin_zone, dest_zone)
        actual_hours = actual_delivery_utc - ship_datetime_utc
        sla_met = (actual_hours <= sla_hours)
        sla_breach_hours = MAX(0, actual_hours - sla_hours)

Step 8: WRITE TO SILVER + GOLD
  └── silver.shipments_unified (canonical status, UTC timestamps, kg weights, SLA calc)
  └── gold.last_mile_performance (aggregated: by carrier, by region, by day)
```

---

## Route 6: IoT Telemetry Normalization & Enrichment

**Nightmare addressed:** #5 (Timestamps), #4 (Silent Pipelines), contributes to spoilage model
**Source:** Kafka `mcg.iot.cold-chain`
**Target:** `silver.iot_telemetry` + `gold.spoilage_risk`

### Transformation Logic

```
Step 1: STREAM INGEST (Bronze)
  └── Kafka consumer → bronze.iot_raw (all readings, including gaps)

Step 2: TEMPERATURE UNIT NORMALIZATION
  └── If temperature_unit = 'F':
        temperature_celsius = (temperature_value - 32) * 5/9
      Else:
        temperature_celsius = temperature_value
      Always output in Celsius.

Step 3: TIMESTAMP NORMALIZATION
  └── Apply Route 1 (handle missing TZ, truncated milliseconds)

Step 4: SHIPMENT LINKAGE REPAIR
  └── Where shipment_id IS NULL (12% -- sensor reused without re-registration):
        Attempt to infer shipment from:
          - sensor_id → last known shipment assignment (lookup table)
          - route_id + date → active shipment on that route
        If resolved → set shipment_id, set linkage_method = 'INFERRED'
        If unresolved → set linkage_method = 'UNLINKED'

Step 5: GAP DETECTION (Nightmare #4)
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ For each sensor_id, track expected vs actual reading frequency.         │
  │                                                                        │
  │ If gap between consecutive readings > 30 minutes:                      │
  │   Insert a synthetic GAP record:                                        │
  │     gap_start, gap_end, gap_duration_minutes, sensor_id                │
  │                                                                        │
  │ Specific detection: Lagos DC sensors (SENS-LOS-*)                      │
  │   Expected: readings every 5 minutes                                    │
  │   If gap > 60 min → flag as CONNECTIVITY_DROPOUT                       │
  │   Write to gold.pipeline_health_alerts                                 │
  └─────────────────────────────────────────────────────────────────────────┘

Step 6: THRESHOLD ENRICHMENT
  └── Join with silver.product_master to get storage_temp_requirement:
        temp_threshold_min (e.g., 2.0°C for chilled)
        temp_threshold_max (e.g., 6.0°C for chilled)
      Calculate:
        temp_exceedance = temperature_celsius > temp_threshold_max
                       OR temperature_celsius < temp_threshold_min
        exceedance_severity = ABS(temperature_celsius - nearest_threshold)

Step 7: SPOILAGE RISK SCORING (feeds AutoML)
  └── Aggregate per shipment:
        - max_temperature_celsius
        - count_exceedance_events
        - total_exceedance_minutes
        - avg_humidity
        - time_in_transit_hours
      → gold.spoilage_risk (input for AutoML model)

Step 8: WRITE TO SILVER + GOLD
  └── silver.iot_telemetry (normalized temps, UTC timestamps, linked shipments)
  └── gold.spoilage_risk (aggregated risk features per shipment)
  └── gold.pipeline_health_alerts (gap detections)
```

---

## Route 7: Supplier Master Deduplication

**Nightmare addressed:** #3 (Product Master -- supplier name variants)
**Source:** Salesforce `MCG_Product__c.Supplier_Name__c` + PostgreSQL (referenced in POs)
**Target:** `silver.supplier_master` + `gold.supplier_scorecard`

### Transformation Logic

```
Step 1: COLLECT all supplier name variants from all sources
  └── Union: SF product supplier_name + PG shipments (inferred) + reference data

Step 2: FUZZY MATCHING
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ Algorithm: Jaro-Winkler + Token Set Ratio                              │
  │                                                                        │
  │ Pre-processing:                                                        │
  │   - Uppercase all                                                       │
  │   - Strip legal suffixes: Ltd, PLC, Corp, Inc, S.A., B.V., Co.        │
  │   - Strip punctuation                                                   │
  │   - Normalize accents: é→e, ü→u, ñ→n                                  │
  │                                                                        │
  │ Match groups:                                                           │
  │   'SAMSUNG ELECTRONICS CO' ↔ 'SAMSUNG ELEC' ↔ 'SAMSUNG'              │
  │     → score 92-98% → AUTO-MERGE → canonical: 'Samsung Electronics'    │
  │                                                                        │
  │   'UNILEVER PLC' ↔ 'UNILEVER' ↔ 'UNILEVER PLC'                      │
  │     → score 95%+ → AUTO-MERGE → canonical: 'Unilever'                │
  │                                                                        │
  │   'NESTLE SA' ↔ 'NESTLÉ S.A.' ↔ 'NESTLÉ'                            │
  │     → score 90%+ → AUTO-MERGE → canonical: 'Nestlé'                  │
  │                                                                        │
  │ Ambiguous matches (< 90%):                                             │
  │   → Route to Data Stewardship for human review                         │
  └─────────────────────────────────────────────────────────────────────────┘

Step 3: ASSIGN CANONICAL SUPPLIER ID
  └── Each dedup group gets one golden supplier_id
      All variant records point to the golden ID via lookup table

Step 4: COUNTRY CODE NORMALIZATION
  └── 'GB' vs 'UK' → standardize to ISO 3166 ('GB')
      'US' vs 'USA' → 'US'

Step 5: WRITE TO SILVER + GOLD
  └── silver.supplier_master (canonical IDs, all variants preserved as array)
  └── silver.supplier_xref (lookup: any variant → canonical ID)
  └── gold.supplier_scorecard (consolidated spend, performance metrics)
```

---

## Route 8: Order-to-Delivery Unified Timeline

**Nightmare addressed:** #5 (Timestamps), #6 (Carrier), #2 (Addresses) -- THE CROSS-CUTTING ROUTE
**Source:** ALL silver tables
**Target:** `gold.order_timeline` + `gold.last_mile_performance`

### Transformation Logic

```
Step 1: JOIN across silver tables to build unified order journey:

  silver.orders (from Salesforce)
    JOIN silver.shipments_unified ON order_id
    JOIN silver.customers ON customer_id
    JOIN silver.product_master ON sku (via crossref)
    LEFT JOIN silver.iot_telemetry ON shipment_id (if cold-chain applicable)

Step 2: BUILD EVENT TIMELINE per order:

  Event 1: ORDER_PLACED     → orders.order_datetime_utc
  Event 2: ORDER_ALLOCATED  → orders.allocation_datetime_utc (if available)
  Event 3: PICKED           → warehouse_events.event_timestamp_utc (event_type=PICK)
  Event 4: PACKED           → warehouse_events.event_timestamp_utc (event_type=PACK)
  Event 5: SHIPPED          → shipments.ship_datetime_utc
  Event 6: IN_TRANSIT       → shipments (first IN_TRANSIT status)
  Event 7: OUT_FOR_DELIVERY → shipments (first OUT_FOR_DELIVERY status)
  Event 8: DELIVERED        → shipments.actual_delivery_utc
      OR   FAILED           → shipments (DELIVERY_FAILED status)

  ALL timestamps are now UTC (thanks to Route 1).

Step 3: CALCULATE METRICS

  - order_to_ship_hours = SHIPPED - ORDER_PLACED
  - ship_to_deliver_hours = DELIVERED - SHIPPED
  - total_order_to_deliver_hours = DELIVERED - ORDER_PLACED
  - sla_target_hours (from carrier contract)
  - sla_met (boolean)
  - sla_breach_hours (if applicable)
  - address_quality_flag (from customer record)
  - delivery_attempt_count
  - wismo_flag (did customer call?)

Step 4: WRITE TO GOLD
  └── gold.order_timeline (event-level, one row per event per order)
  └── gold.last_mile_performance (aggregated KPIs per carrier/region/day)
  └── gold.wismo_analysis (WISMO calls correlated with data quality issues)
```

---

## Pipeline Dependency Order

Routes must execute in this order (some are parallelizable):

```
                    ┌─── Route 1: Timestamp Normalization ───┐
                    │         (must run first)                │
                    └────────────┬───────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────────┐
              │                  │                      │
              ▼                  ▼                      ▼
    Route 2: Inventory    Route 3: Address     Route 6: IoT Telemetry
    Route 4: Product      (parallel OK)        (parallel OK)
    (parallel OK)                │
              │                  │
              ▼                  │
    Route 7: Supplier Dedup     │
    (depends on Route 4)        │
              │                  │
              └──────────┬───────┘
                         │
                         ▼
              Route 5: Carrier Status
              (depends on Routes 1, 4)
                         │
                         ▼
              Route 8: Order Timeline
              (depends on ALL above)
```

**Parallel execution groups:**
- **Group A (parallel):** Routes 2, 3, 4, 6 (all depend only on Route 1)
- **Group B:** Route 7 (depends on Route 4)
- **Group C:** Route 5 (depends on Routes 1, 4)
- **Group D:** Route 8 (depends on everything)

---

## Open Lakehouse Target Tables -- Complete Catalog

### Bronze Layer (Raw)

| Table | Source | Description |
|---|---|---|
| `bronze.inventory_raw` | PostgreSQL CDC | Raw inventory positions, all quality issues intact |
| `bronze.warehouse_events_raw` | PostgreSQL CDC | Raw warehouse events |
| `bronze.shipments_raw` | PostgreSQL CDC + Kafka | Raw shipment tracking, all carrier formats |
| `bronze.iot_raw` | Kafka streaming | Raw IoT telemetry, mixed units and formats |
| `bronze.contacts_raw` | Salesforce API | Raw customer contacts, address chaos |
| `bronze.orders_raw` | Salesforce API | Raw e-commerce orders |
| `bronze.products_raw` | Salesforce API | Raw product catalog, all SKU variants |

### Silver Layer (Cleansed)

| Table | Route | Description |
|---|---|---|
| `silver.inventory_reconciled` | Route 2 | Clean inventory: canonical UoM, zones, UTC timestamps |
| `silver.customers` | Route 3 | Parsed addresses, ISO countries, E.164 phones, dedup groups |
| `silver.product_master` | Route 4 | Harmonized SKUs, 3-level English categories, quality flags |
| `silver.sku_crossref` | Route 4 | Golden SKU ↔ legacy SKU lookup table |
| `silver.shipments_unified` | Route 5 | Canonical statuses, UTC timestamps, kg weights, SLA calc |
| `silver.iot_telemetry` | Route 6 | Celsius temps, UTC timestamps, linked shipments, gap flags |
| `silver.supplier_master` | Route 7 | Deduplicated suppliers, canonical IDs |
| `silver.supplier_xref` | Route 7 | Variant name → canonical ID lookup |

### Gold Layer (Business-Ready Data Products)

| Table | Route(s) | Consumers | Description |
|---|---|---|---|
| `gold.supply_chain_health` | 2 | Qlik Sense, Discovery Agent | Per-warehouse inventory KPIs |
| `gold.customer_360` | 3 | Qlik Sense, Qlik Answers | Master customer records with quality scores |
| `gold.product_catalog` | 4 | Qlik Sense, Qlik Answers | Curated product data (complete records only) |
| `gold.last_mile_performance` | 5, 8 | Qlik Sense, Discovery Agent | Carrier SLA KPIs per region/day |
| `gold.spoilage_risk` | 6 | AutoML, Discovery Agent | ML feature table for spoilage prediction |
| `gold.supplier_scorecard` | 7 | Qlik Sense, Qlik Answers | Consolidated supplier spend and performance |
| `gold.order_timeline` | 8 | Qlik Sense, Qlik Answers | Full order journey with all timestamps |
| `gold.wismo_analysis` | 8 | Qlik Sense | WISMO correlation with data quality |
| `gold.pipeline_health_alerts` | 2, 6 | Discovery Agent | Pipeline freshness and gap alerts |
| `gold.compliance_traceability` | 2, 4 | Qlik Sense, Qlik Answers | Food product farm-to-shelf lineage |

### Trust Score Summary Table

| Table | Route | Description |
|---|---|---|
| `meta.trust_scores` | All | Trust Score per dataset, updated after each pipeline run |
| `meta.trust_score_history` | All | Historical Trust Score values for trend tracking |
| `meta.data_quality_exceptions` | All | All flagged quality issues pending resolution |
| `meta.stewardship_tasks` | 3, 4, 7 | Tasks assigned to data stewards for manual resolution |

---

## Demo Talking Points for Transformation Routes

1. **"Bronze preserves the mess."** We never throw away the raw data. When the EU auditor asks "show me the original source record," we have it. When the CDO asks "what did the data look like before we fixed it?" -- bronze is the answer.

2. **"Silver is where trust is built."** Every transformation is a rule: timestamps get normalized, addresses get parsed, status codes get canonicalized. Every rule is auditable. Every change is traceable.

3. **"Gold is what the business sees."** Executives don't need to know about Nightmare #5 or carrier format chaos. They need `gold.last_mile_performance` and `gold.supply_chain_health`. Clean, curated, governed.

4. **"The transformation routes ARE the data quality story."** Route 1 solves Nightmare #5. Route 3 solves Nightmare #2. Route 5 solves Nightmare #6. Each route is a chapter in MCG's transformation journey.

5. **"Every route feeds the Trust Score."** Before and after each route, the Trust Score is recalculated. You can literally watch the score go from 61 to 91 as data flows through the pipeline.

---

*Talend Transformation Route Design for Meridian Commerce Group*
*8 Routes | 3 Lakehouse Layers | 25+ Target Tables*
*Version 1.0 -- February 2026*
