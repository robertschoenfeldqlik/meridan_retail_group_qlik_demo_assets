# Meridian Commerce Group -- Nightmare-to-Dataset Traceability Map
## Where Every Data Quality Nightmare Lives in the Data

This document maps each of the Seven Data Quality Nightmares from the MCG profile to the **exact datasets, fields, and records** where the problem manifests. Use this as a blueprint for building synthetic demo data with intentional quality issues.

---

## How to Read This Document

Each nightmare is broken down into:
- **Root Cause:** Why the problem exists
- **Affected Datasets:** Which of the 15 datasets contain the bad data
- **Specific Field Manifestations:** The exact columns where you'll see the issue
- **Example Bad Records:** What the dirty data actually looks like (side-by-side good vs bad)
- **Downstream Impact Chain:** How the bad data cascades through the business
- **Qlik Resolution:** Which Qlik product detects and fixes it

---

## Nightmare #1: The Phantom Inventory Problem

> *SAP shows 500, Oracle WMS shows 312, physical count is 287. A failed batch job went undetected for 3 weeks.*

### Root Cause
A nightly batch integration job between SAP S/4HANA (ERP) and Oracle WMS failed silently on September 24, 2025. SAP continued recording inventory adjustments (receipts, sales deductions, transfers), but those changes never propagated to the WMS. Neither system flagged the discrepancy.

### Affected Datasets

| Dataset | Role in the Problem |
|---|---|
| **#1 Inventory Positions** | PRIMARY -- this is where the mismatch lives |
| **#10 Warehouse Operations** | CONTRIBUTING -- WMS events stop syncing to ERP |
| **#2 Purchase Orders & Receipts** | CONTRIBUTING -- new receipts recorded in ERP but not reflected in WMS |
| **#3 Sales Transactions (POS)** | CONTRIBUTING -- POS sales deduct from ERP, WMS doesn't see them |
| **#9 Demand Forecasts** | DOWNSTREAM VICTIM -- forecasts built on wrong inventory baseline |
| **#13 Financial / Cost Data** | DOWNSTREAM VICTIM -- carrying costs calculated on phantom stock |

### Specific Field Manifestations

#### Dataset #1: Inventory Positions

| Field | SAP Record (Wrong) | Oracle WMS Record (Stale) | Physical Truth |
|---|---|---|---|
| `sku` | `MCG-4420` | `MCG-4420` | `MCG-4420` |
| `location_id` | `DC-RTD-01` | `DC-RTD-01` | `DC-RTD-01` |
| `quantity_on_hand` | **500** | **312** | **287** |
| `quantity_available` | **463** | **275** | **250** |
| `quantity_reserved` | 37 | 37 | 37 |
| `snapshot_timestamp` | `2025-10-15T06:00:00Z` | `2025-10-15T06:00:00+01:00` | (physical count 10/14) |
| `last_count_date` | `2025-09-20T08:30:00Z` | `2025-09-24T14:00:00+01:00` | `2025-10-14T08:30:00Z` |

**What to inject in synthetic data:**
- Create 42 SKUs at Rotterdam DC where SAP `quantity_on_hand` exceeds WMS by 15-60%
- Set the WMS `last_count_date` to freeze at September 24 (the failure date) while SAP dates continue advancing
- Include a few SKUs where SAP shows positive stock but WMS shows zero (items fully consumed but ERP doesn't know)
- Include one SKU where WMS shows more than SAP (a return was processed in WMS but never posted to ERP)
- Show the `snapshot_timestamp` timezone mismatch (UTC vs +01:00) that makes reconciliation harder

#### Dataset #10: Warehouse Operations

| Field | Expected Record | What's Missing |
|---|---|---|
| `event_type` | `ADJUSTMENT` | Events exist in WMS but never transmitted to SAP after 9/24 |
| `event_timestamp` | `2025-10-01T09:15:22` | Timestamps present in WMS, but no corresponding SAP posting |
| `cycle_count_variance` | `-13` | Variance detected in WMS but SAP doesn't know about it |

**What to inject in synthetic data:**
- Generate warehouse adjustment events after September 24 that exist in WMS but have no corresponding record in the ERP feed
- Show cycle count variances that were captured locally but never reconciled upstream

#### Dataset #2: Purchase Orders & Receipts

| Field | SAP Record | WMS Reality |
|---|---|---|
| `quantity_received` | **487** (ERP goods receipt posted) | **487** (WMS received, but subsequent adjustments lost) |
| `actual_receipt_date` | `2025-09-28T14:22:00Z` | `2025-09-28T11:45:00+01:00` |

**What to inject:** Receipt dates that differ by hours between ERP posting time and actual WMS scan time. A few POs where `quantity_received` in ERP doesn't match WMS because a quality hold reduced usable stock in WMS but ERP still shows full receipt.

### Downstream Impact Chain

```
Failed batch job (9/24)
    │
    ├── SAP inventory inflated ──► Demand planning trusts wrong numbers
    │                                  │
    │                                  └── No reorder triggered for MCG-4420
    │                                       │
    │                                       └── Store shelves go empty (out-of-stock)
    │                                            │
    │                                            └── 34% YoY increase in OOS events
    │
    ├── WMS inventory frozen ──► Pick operations work from stale data
    │                              │
    │                              └── Pickers sent to empty bins
    │
    └── Financial data wrong ──► Carrying cost reports overstated by ~$31M
                                   │
                                   └── CFO can't trust inventory valuation
```

### Qlik Resolution
| Qlik Product | Action |
|---|---|
| **Qlik Talend Cloud (CDC)** | Replace nightly batch with real-time CDC. Every SAP and WMS transaction streams continuously. |
| **Qlik Talend Cloud (Pipeline Monitoring)** | Detects the batch job failure within minutes, not 4.3 days. Automated alert to data engineering. |
| **Data Quality Rules** | Reconciliation rule: if ERP vs. WMS quantity gap exceeds 2% for any SKU/location, flag immediately. |
| **Trust Score** | Inventory dataset Trust Score drops when reconciliation failures are detected -- visible on dashboards. |
| **Discovery Agent** | Proactively surfaces: "Inventory discrepancy growing for 3 consecutive days at DC-RTD-01." |
| **Qlik Analytics** | Global Inventory Health Dashboard shows red indicator for Rotterdam DC. |

---

## Nightmare #2: The Address Catastrophe

> *18.4M addresses. 11% inconsistent formatting. 6% truncated. 3.2% duplicates. 4.7% carrier rejection rate.*

### Root Cause
Customer addresses are captured in 5+ systems (Salesforce Commerce Cloud, Oracle Xstore POS, Shopify POS, Salesforce CRM, legacy migration databases) with no standardization rules at point of entry. Legacy POS systems have 30-character field limits that truncate long street names. International address formats were never normalized.

### Affected Datasets

| Dataset | Role in the Problem |
|---|---|
| **#8 Customer & Address Data** | PRIMARY -- the master address records |
| **#4 E-Commerce Orders** | PRIMARY -- addresses submitted at checkout |
| **#5 Shipment & Carrier Tracking** | DOWNSTREAM VICTIM -- carriers reject bad addresses |
| **#12 Returns & Reverse Logistics** | DOWNSTREAM VICTIM -- return pickups fail at bad addresses |
| **#3 Sales Transactions (POS)** | CONTRIBUTING -- loyalty sign-up captures incomplete addresses |

### Specific Field Manifestations

#### Dataset #8: Customer & Address Data -- Formatting Chaos (11%)

| customer_id | address_line_1 | address_line_2 | city | postal_code | country | Issue Type |
|---|---|---|---|---|---|---|
| `CUST-00482910` | `Keizersgracht 482` | `Apartment 4B` | `Amsterdam` | `1017 EJ` | `NL` | **CLEAN (baseline)** |
| `CUST-00482911` | `Keizersgracht 482` | `Apt 4B` | `Amsterdam` | `1017 EJ` | `Netherlands` | Abbreviation variant + country code vs name |
| `CUST-00482912` | `Keizersgracht 482, #4B` | `null` | `Amsterdam` | `1017EJ` | `NL` | Apt merged into line 1, postal code no space |
| `CUST-00519200` | `15 Orchard Road` | `#08-01 Wheelock Place` | `Singapore` | `238862` | `SG` | Correct for SG format |
| `CUST-00519201` | `15 Orchard Rd, #08-01` | `Wheelock Place` | `Singapore` | `238862` | `Singapore` | Building name split to line 2, country name |
| `CUST-00610300` | `Rua Augusta, 1500` | `Conjunto 42, Cerqueira César` | `São Paulo` | `01304-001` | `BR` | Correct for BR format |
| `CUST-00610301` | `R. Augusta 1500 Cj 42` | `null` | `Sao Paulo` | `01304001` | `BR` | Abbreviated, merged, accent stripped, no hyphen |
| `CUST-00387400` | `4521 Peachtree Rd NE` | `Suite 200` | `Atlanta` | `30319` | `US` | Correct for US format |
| `CUST-00387401` | `4521 Peachtree Road Northeast` | `Ste 200` | `Atlanta, GA` | `30319-3219` | `US` | Long form street + state in city + ZIP+4 |

#### Dataset #8: Customer & Address Data -- Truncation (6%)

| customer_id | address_line_1 (full) | address_line_1 (as stored) | Source | Issue |
|---|---|---|---|---|
| `CUST-00442100` | `Friedrichstraße 123, Hinterhaus` | `Friedrichstraße 123, Hinterh` | Legacy Xstore POS | Truncated at 30 chars |
| `CUST-00442200` | `Av. Presidente Juscelino Kubitschek, 1909` | `Av. Presidente Juscelino Kub` | Legacy Xstore POS | Truncated at 30 chars |
| `CUST-00442300` | `Shop 2, Ground Floor, Riverside Shopping Centre` | `Shop 2, Ground Floor, Rivers` | Legacy Xstore POS | Truncated at 30 chars |

#### Dataset #8: Customer & Address Data -- Duplicates (3.2%)

| Record A | Record B | Match Confidence | Issue |
|---|---|---|---|
| `CUST-00482910`: `Apartment 4B` | `CUST-00482911`: `Apt 4B` | 95% likely same | Abbreviation variant |
| `CUST-00610300`: `São Paulo`, `01304-001` | `CUST-00610301`: `Sao Paulo`, `01304001` | 92% likely same | Accent + format variant |
| `CUST-00387400`: `Suite 200` | `CUST-00387401`: `Ste 200` | 97% likely same | Abbreviation + expanded street |

#### Dataset #4: E-Commerce Orders -- Address at Checkout

| order_id | address_line_1 | city | postal_code | country_code | carrier_result |
|---|---|---|---|---|---|
| `WEB-2025-10-0094827` | `Keizersgracht 482` | `Amsterdam` | `1017 EJ` | `NL` | ACCEPTED |
| `WEB-2025-10-0094950` | `R. Augusta 1500 Cj 42` | `Sao Paulo` | `01304001` | `BR` | **REJECTED -- postal code format** |
| `WEB-2025-10-0095102` | `Friedrichstraße 123, Hinterh` | `Berlin` | `10117` | `DE` | **REJECTED -- incomplete address** |
| `WEB-2025-10-0095200` | `15 Orchard Rd` | `Singapore` | `238862` | `SG` | **REJECTED -- missing unit number** |

#### Dataset #5: Shipment & Carrier Tracking -- Rejection Events

| tracking_number | carrier_code | exception_code | exception_detail | delivery_attempt_count |
|---|---|---|---|---|
| `DPD-DE-20251016-4210` | `DPD` | `ADDR_INCOMPLETE` | `Straßenname unvollständig` | 1 |
| `COR-BR-20251016-8821` | `CORREIOS` | `CEP_INVALIDO` | `CEP não encontrado` | 1 |
| `NV-SG-20251016-1102` | `NINJAVAN` | `UNIT_MISSING` | `Cannot locate unit - contact customer` | 2 |

**What to inject in synthetic data:**
- 11% of address records with format inconsistencies across the patterns above
- 6% with truncated street names (exactly 30 characters, cut mid-word)
- 3.2% near-duplicate pairs with the variations shown
- 4.7% of shipment records with carrier rejection exceptions tied to address quality
- Mix of regional address formats (NL, DE, BR, SG, US, NG, JP) to show global complexity

### Downstream Impact Chain

```
Bad address captured at checkout / loyalty signup
    │
    ├── E-Commerce order shipped with bad address
    │     │
    │     ├── Carrier rejects (4.7%) ──► Re-routing delay (+1-3 days)
    │     │                                │
    │     │                                └── SLA breach ──► NPS drop
    │     │
    │     └── Carrier "corrects" address ──► Delivered to wrong location
    │                                          │
    │                                          └── WISMO call ($2.30/call)
    │
    ├── Duplicate customer records
    │     │
    │     └── Customer gets 2 loyalty accounts ──► LTV calculation wrong
    │                                               │
    │                                               └── Marketing sends double emails
    │
    └── Return pickup fails at bad address ──► Customer keeps product + refund
                                                │
                                                └── $3.2M annual return loss
```

### Qlik Resolution
| Qlik Product | Action |
|---|---|
| **Data Quality (Profiling)** | Automatically detects the 11%/6%/3.2% anomalies on first profile scan |
| **Data Quality (Standardization)** | Normalizes "Apt"/"Apartment"/"#" into canonical form per country postal standard |
| **Data Quality (Matching/Dedup)** | Fuzzy matching identifies the 3.2% duplicate pairs with confidence scores |
| **Data Stewardship** | Ambiguous matches (< 90% confidence) routed to stewards for manual resolution |
| **Trust Score** | Address dataset Trust Score reflects improvement as standardization progresses |
| **Qlik Analytics** | Delivery failure heat map shows carrier rejection rate by region/postal code |

---

## Nightmare #3: The Product Master Data Mess

> *3 SKU schemes. Category hierarchies don't match. 8,200 products missing weights. "Samsung" spelled 4 ways.*

### Root Cause
Five acquisitions over 15 years, each with its own product catalog and numbering system. No MDM (Master Data Management) project was ever completed. The "golden record" project was funded in 2019 and abandoned in 2021.

### Affected Datasets

| Dataset | Role in the Problem |
|---|---|
| **#6 Product Master Data** | PRIMARY -- the fragmented product catalog |
| **#7 Supplier Master & Performance** | PRIMARY -- duplicate supplier records |
| **#1 Inventory Positions** | DOWNSTREAM VICTIM -- can't aggregate inventory across SKU schemes |
| **#5 Shipment & Carrier Tracking** | DOWNSTREAM VICTIM -- wrong weight = wrong shipping cost |
| **#14 Carrier Rate & Contract Data** | DOWNSTREAM VICTIM -- rate lookup fails on bad weights |
| **#9 Demand Forecasts** | DOWNSTREAM VICTIM -- forecast fragmented across 3 SKU identities |
| **#15 Traceability & Compliance** | DOWNSTREAM VICTIM -- can't trace product across naming schemes |
| **#2 Purchase Orders & Receipts** | CONTRIBUTING -- POs use supplier's SKU, not MCG's |

### Specific Field Manifestations

#### Dataset #6: Product Master Data -- Triple SKU Identity

The **same physical product** (Meridian Bluetooth Speaker) exists as three different records:

| Field | MCG Global Record | Americas Legacy | EU Legacy |
|---|---|---|---|
| `sku` | `MCG-4420` | `AM-BT-SPKR-001` | `EU-44200` |
| `product_name` | `Meridian Bluetooth Speaker` | `BT Speaker - Portable` | `Tragbarer Bluetooth-Lautsprecher` |
| `category_l1` | `Electronics` | `Electronics` | `Elektronik` |
| `category_l2` | `Audio` | `Audio & Speakers` | `Audio` |
| `category_l3` | `Portable Speakers` | `Bluetooth` | `Tragbare Lautsprecher` |
| `category_l4` | (n/a -- 3 levels) | (n/a -- 3 levels) | `Bluetooth` |
| `category_l5` | (n/a) | (n/a) | `Unter 50 EUR` |
| `weight_kg` | `0.45` | `null` | `0.45` |
| `length_cm` | `18.5` | `7.28` (inches, mislabeled as cm) | `18.5` |
| `gtin/ean` | `8710103944201` | `null` | `8710103944201` |
| `supplier_id` | `SUP-003291` | `VNDR-SAM-001` | `LIEF-003291` |
| `active_flag` | `true` | `true` | `true` |

**What to inject in synthetic data:**
- ~15% of products should have 2-3 SKU identity records
- Americas legacy products: weight_kg frequently null, dimensions in inches but column says cm
- EU legacy products: category names in local language (German, Dutch, French)
- GTIN/EAN missing for 9% of products (all from Americas legacy)
- ~500 products where all 3 records exist but with conflicting attribute values

#### Dataset #6: Product Master Data -- Missing Weight/Dimensions (8,200 products)

| sku | product_name | weight_kg | length_cm | width_cm | height_cm | Impact |
|---|---|---|---|---|---|---|
| `AM-BT-SPKR-001` | `BT Speaker - Portable` | `null` | `7.28` | `4.72` | `3.15` | Shipping cost lookup fails |
| `AM-KIT-MIX-042` | `Kitchen Mixer Pro` | `null` | `null` | `null` | `null` | No dims at all |
| `MCG-APP-JKT-881` | `Winter Jacket - Large` | `0.00` | `null` | `null` | `null` | Zero weight (invalid) |
| `EU-GRO-OLV-220` | `Olive Oil 500ml` | `0.52` | `null` | `null` | `null` | Partial -- weight but no dims |
| `MCG-4420` | `Meridian Bluetooth Speaker` | `0.45` | `18.5` | `12.0` | `8.0` | **Complete (baseline)** |

**What to inject:**
- 8,200 products with `weight_kg` = null, zero, or implausible values
- ~3,000 additional products with dimensions in inches stored in _cm columns
- ~1,200 products with zero in both weight and dimensions
- A handful with obviously wrong data (e.g., a phone case weighing 45kg)

#### Dataset #7: Supplier Master -- The "Samsung" Problem

| supplier_id | supplier_name | supplier_country | Source System | Duplicate Group |
|---|---|---|---|---|
| `SUP-003291` | `Samsung Electronics Co.` | `KR` | SAP (Global) | **GROUP A** |
| `VNDR-SAM-001` | `Samsung Elec.` | `KR` | SAP (Americas legacy) | **GROUP A** |
| `LIEF-003291` | `SAMSUNG` | `KR` | SAP (EU legacy) | **GROUP A** |
| `SUP-009104` | `Samsung Corp` | `KR` | Procurement portal | **GROUP A** |
| `SUP-004510` | `Unilever plc` | `GB` | SAP (Global) | **GROUP B** |
| `VNDR-UNI-001` | `Unilever` | `GB` | SAP (Americas legacy) | **GROUP B** |
| `LIEF-004510` | `Unilever PLC` | `UK` | SAP (EU legacy) | **GROUP B** (also: GB vs UK) |
| `SUP-008820` | `Nestlé S.A.` | `CH` | SAP (Global) | **GROUP C** |
| `VNDR-NST-001` | `Nestle SA` | `CH` | SAP (Americas legacy) | **GROUP C** (accent stripped) |
| `LIEF-008820` | `NESTLÉ` | `CH` | SAP (EU legacy) | **GROUP C** |

**What to inject:**
- ~80 suppliers with 2-4 duplicate records each
- Variations: abbreviations, ALL CAPS, accent stripping, Ltd/PLC/Corp suffixes
- Different supplier_id formats per ERP instance (SUP- vs VNDR- vs LIEF-)
- Country code inconsistencies (GB vs UK, US vs USA)

### Downstream Impact Chain

```
No single product master
    │
    ├── 3 SKU schemes ──► Inventory can't be aggregated
    │     │                  │
    │     │                  └── "How much Speaker MCG-4420 do we have globally?"
    │     │                       Answer: depends which system you ask
    │     │
    │     └── Demand forecast fragmented across 3 identities
    │           │
    │           └── Under-forecasting (only sees 1/3 of demand signal)
    │
    ├── 8,200 missing weights ──► Shipping cost calculation fails
    │     │
    │     ├── Carrier rate lookup returns default (highest) rate
    │     │     │
    │     │     └── $4.2M annual shipping cost overcharge
    │     │
    │     └── Carrier invoices don't match expected cost ──► Invoice dispute backlog
    │
    └── 4 "Samsung" records ──► Supplier spend fragmented
          │
          ├── Procurement thinks they spend $12M with Samsung
          │     (actual: $47M when all 4 records combined)
          │     │
          │     └── Missed volume discount negotiation opportunity
          │
          └── Supplier risk assessment incomplete
```

### Qlik Resolution
| Qlik Product | Action |
|---|---|
| **Data Quality (Profiling)** | Discovers the 3 SKU populations, null weight patterns, and supplier name clusters |
| **Data Quality (Matching)** | Fuzzy matching groups "Samsung Elec." / "SAMSUNG" / "Samsung Corp" into one entity |
| **Data Stewardship** | Ambiguous product matches (is EU-44200 really the same as AM-BT-SPKR-001?) routed to product data team |
| **Data Catalog** | Publishes the "Golden Product Master" as a governed data product |
| **Qlik Analytics** | Supplier spend dashboard shows consolidated view after dedup -- revealing the true $47M Samsung relationship |

---

## Nightmare #4: The Silent Pipeline Failures

> *23 failures/week. 25% fail silently. 4.3 days average detection time. 2.1 days to remediate.*

### Root Cause
MCG's integration layer is a patchwork of custom scripts, scheduled jobs, middleware (MuleSoft, TIBCO), cron jobs, and manual SFTP transfers. No centralized monitoring. No SLA enforcement. Individual teams built integrations in isolation.

### Affected Datasets

**This nightmare is CROSS-CUTTING -- it can affect ANY dataset. The pipeline itself is the problem, not the data content.**

| Dataset Most Frequently Affected | Pipeline Type | Failure Mode |
|---|---|---|
| **#1 Inventory Positions** | SAP → Snowflake nightly batch | Silent failure -- job hangs, no error thrown |
| **#5 Shipment & Carrier Tracking** | Carrier SFTP → Staging DB | File arrives late or not at all; no alert |
| **#11 Cold-Chain IoT Telemetry** | IoT Platform → Data Lake | Streaming connection drops; buffer fills and data lost |
| **#10 Warehouse Operations** | Oracle WMS → SAP | Batch job produces partial load (50% of records); no completeness check |
| **#2 Purchase Orders & Receipts** | Supplier EDI → SAP | EDI parser fails on new supplier's format; records silently dropped |
| **#9 Demand Forecasts** | Blue Yonder → Snowflake | API token expired; job returns empty result set instead of error |

### Specific Field Manifestations

This nightmare doesn't manifest as bad field values -- it manifests as **missing records** and **stale timestamps.**

#### Detection Signatures in the Data

| What to Look For | Dataset | Field | Symptom |
|---|---|---|---|
| Record count drops to zero | Any | (row count) | Pipeline completely stopped |
| Record count drops by >50% | #10 Warehouse Ops | (row count) | Partial load -- only half the events came through |
| Timestamp gap | #1 Inventory | `snapshot_timestamp` | Latest record is from 3 days ago |
| Timestamp gap | #11 IoT Telemetry | `timestamp` | 6-hour gap in sensor readings (Lagos DC) |
| Empty result set treated as success | #9 Demand Forecasts | `forecasted_quantity` | Table exists but zero rows for current week |
| File arrival gap | #5 Carrier Tracking | (file metadata) | Correios CSV expected at 06:00 BRT; it's 14:00 and no file |

**What to inject in synthetic data:**
- Inventory records that suddenly stop on a specific date for one DC (the "silent failure" moment)
- IoT telemetry with a clean 6-hour gap (no records between 02:00 and 08:00 UTC for Lagos sensors)
- A demand forecast table where the current week simply has no rows
- Carrier tracking where one carrier's records stop for 2 days then resume with a backlog dump
- Warehouse operations where a batch contains exactly 50% of the expected records (partial load)

### Downstream Impact Chain

```
Pipeline fails silently
    │
    ├── No one knows for 4.3 days
    │     │
    │     ├── During those 4.3 days, decisions made on stale data
    │     │     │
    │     │     ├── Inventory dashboards show "green" when reality is "red"
    │     │     │
    │     │     └── Demand plans built on last-week's actuals
    │     │
    │     └── Data engineering discovers the failure by accident (someone notices a report looks off)
    │
    ├── 2.1 days to remediate
    │     │
    │     ├── Historical gap must be backfilled
    │     │     │
    │     │     └── Backfill may introduce duplicate records if not handled carefully
    │     │
    │     └── Downstream systems that consumed stale data must be refreshed
    │
    └── 15% of failures produce corrupted data that propagates
          │
          └── Partial loads ──► Reports show half the real transaction volume
                │
                └── Management makes decisions on 50% of reality
```

### Qlik Resolution
| Qlik Product | Action |
|---|---|
| **Qlik Talend Cloud (Pipeline Orchestration)** | Centralized pipeline management with health checks, SLA enforcement, and automated retry |
| **Qlik Talend Cloud (Monitoring & Alerting)** | If Correios CSV doesn't arrive by 06:30 BRT, alert fires in < 1 minute |
| **Data Quality Rules** | Completeness rules: "Inventory snapshot must have > 95% of expected record count" |
| **Trust Score** | Dataset Trust Score drops immediately when freshness or completeness degrades |
| **Discovery Agent** | "Inventory data for DC-RTD-01 has not refreshed in 3 days. Pipeline failure suspected." |

---

## Nightmare #5: The Timestamp Tower of Babel

> *14 time zones. SAP uses UTC. WMS uses local time. IoT uses UTC with truncated milliseconds. Carriers use recipient local time.*

### Root Cause
No enterprise-wide timestamp standard was ever established. Each system team chose whatever made sense locally. When calculating cross-system metrics (like order-to-delivery time), analysts must manually convert between conventions.

### Affected Datasets

**This nightmare is PERVASIVE -- it touches almost every dataset, but the pain is worst when joining data across these:**

| Dataset | Timestamp Convention | Example |
|---|---|---|
| **#1 Inventory Positions** | SAP: UTC / WMS: local warehouse time | `06:00:00Z` vs `06:00:00+01:00` (1 hour off) |
| **#4 E-Commerce Orders** | UTC (Salesforce Commerce Cloud) | `2025-10-15T09:14:00Z` |
| **#5 Shipment & Carrier Tracking** | Varies per carrier (see below) | Carrier-dependent |
| **#10 Warehouse Operations** | Local warehouse time | `2025-10-15T14:22:47` (no timezone offset) |
| **#11 Cold-Chain IoT Telemetry** | UTC with milliseconds | `2025-10-15T14:22:47.382Z` (truncated to seconds downstream) |
| **#3 Sales Transactions (POS)** | Xstore: local store time / Shopify: UTC | Two conventions for same data type |
| **#13 Financial / Cost Data** | Local fiscal calendar (varies) | Fiscal month boundary differs by region |

### Specific Field Manifestations

#### The Order-to-Delivery Calculation Problem

To calculate how long it took to deliver order `WEB-2025-10-0094827`, an analyst must join 4 timestamps from 4 systems:

| Event | Source | Timestamp as Stored | Actual UTC | Problem |
|---|---|---|---|---|
| Order placed | SFCC | `2025-10-15T09:14:00Z` | `2025-10-15T09:14:00Z` | Clean -- already UTC |
| Picked in DC | Oracle WMS | `2025-10-15T14:22:47` | `2025-10-15T13:22:47Z` | **No timezone indicator. Is this UTC? CET? CEST?** |
| Shipped | SAP | `2025-10-15T15:30:00Z` | `2025-10-15T15:30:00Z` | Clean -- already UTC |
| Delivered | DPD carrier | `2025-10-18T11:23:00+01:00` | `2025-10-18T10:23:00Z` | Offset included but differs from SAP convention |

**Naive calculation (ignoring timezone):** Delivered at "11:23" minus ordered at "09:14" = 3 days, 2 hours, 9 minutes
**Correct calculation (normalized to UTC):** Delivered at "10:23 UTC" minus ordered at "09:14 UTC" = 3 days, 1 hour, 9 minutes

The 1-hour error seems small, but at scale across millions of orders it creates systematic bias in SLA reporting.

#### The Worse Case: No Timezone Indicator At All

| Dataset | Field | Stored Value | Question |
|---|---|---|---|
| #10 Warehouse Operations | `event_timestamp` | `2025-10-15T14:22:47` | Is this UTC? CET? CEST? It's October, so CEST is ending -- did someone account for DST? |
| #3 Sales Transactions (Xstore) | `transaction_datetime` | `2025-10-15T14:23:47` | Local store time. But which store? You need the store_id to look up the timezone. |
| #11 IoT Telemetry | `timestamp` | `2025-10-15T14:22:47.382Z` | UTC with milliseconds. But downstream ETL truncates to `2025-10-15T14:22:47` and drops the Z. |

**What to inject in synthetic data:**
- SAP records: always include `Z` suffix (UTC)
- WMS records: no timezone indicator (bare timestamps)
- IoT records: include `.382Z` millisecond precision, then show the same record downstream with milliseconds and `Z` stripped
- Carrier records: mix of UTC, local time with offset, and bare local time with no offset
- POS records: Xstore in local time (no offset), Shopify in UTC
- Include records that span a DST transition (October 26, 2025 in EU) to show the extra confusion

### Qlik Resolution
| Qlik Product | Action |
|---|---|
| **Qlik Talend Cloud (Transformation)** | Timestamp normalization layer: all timestamps converted to UTC at ingestion, with original value preserved |
| **Data Quality Rules** | "Every timestamp field must include timezone offset or be explicitly tagged as UTC" |
| **Qlik Open Lakehouse** | Canonical Iceberg tables store all timestamps as `TIMESTAMPTZ` (UTC with offset) |
| **Qlik Analytics** | Dashboards display in user's local timezone, but calculations always use normalized UTC |

---

## Nightmare #6: The Carrier Data Black Hole

> *42 carriers. No standard status codes. 7 carriers with no API. Real-time visibility for only 58% of packages.*

### Root Cause
MCG's carrier portfolio grew organically as they expanded into new markets. Each carrier was onboarded with a point-to-point integration. No one ever built a canonical data model for shipment tracking.

### Affected Datasets

| Dataset | Role in the Problem |
|---|---|
| **#5 Shipment & Carrier Tracking** | PRIMARY -- the format chaos lives here |
| **#4 E-Commerce Orders** | DOWNSTREAM VICTIM -- order status can't be updated in real-time |
| **#14 Carrier Rate & Contract Data** | CONTRIBUTING -- SLA definitions differ per carrier contract |
| **#8 Customer & Address Data** | DOWNSTREAM VICTIM -- WISMO calls driven by tracking visibility gaps |

### Specific Field Manifestations

#### Dataset #5: The Status Code Chaos

The same real-world event ("package was delivered") represented differently by each carrier:

| Carrier | `shipment_status` Value | `status_datetime` Format | `exception_code` Format |
|---|---|---|---|
| FedEx | `DELIVERED` | `2025-10-18T15:23:00Z` | `DELIVERY_EXCEPTION` |
| DHL Express | `delivered` | `2025-10-18T15:23:00+00:00` | `DE` |
| DPD (EU) | `Zugestellt` | `2025-10-18T16:23:00+01:00` | `ZS_FEHLER` |
| NinjaVan | `Completed` | `2025-10-18T23:23:00+08:00` | `FAIL_DELIVER` |
| Correios (Brazil) | `Objeto entregue ao destinatário` | `18/10/2025 12:23` | `BDE - Entrega não efetuada` |
| Royal Mail | `DELIVERED` | `2025-10-18T15:23:00Z` | `P/NOT IN` |
| Local courier (Lagos) | `delivered ok` | `Oct 18 2025` | (free text in email body) |

#### Full Status Code Mapping Problem

Every carrier has its own lifecycle terminology:

| Lifecycle Stage | FedEx | DHL | DPD (DE) | NinjaVan | Correios (BR) |
|---|---|---|---|---|---|
| Label created | `LABEL_CREATED` | `shipment_info` | `Paketankündigung` | `Pending Pickup` | `Objeto postado` |
| Picked up | `PICKED_UP` | `pickup` | `Abgeholt` | `Picked Up` | `Coletado` |
| In transit | `IN_TRANSIT` | `transit` | `In Zustellung` | `Arrived at Hub` | `Em trânsito` |
| Out for delivery | `ON_VEHICLE` | `out_for_delivery` | `In Auslieferung` | `On Vehicle` | `Saiu para entrega` |
| Delivered | `DELIVERED` | `delivered` | `Zugestellt` | `Completed` | `Objeto entregue` |
| Failed attempt | `DELIVERY_EXCEPTION` | `failure` | `Zustellversuch` | `Pending Reschedule` | `Não entregue` |

#### Dataset #5: The SFTP/No-API Carriers

| Carrier | Data Method | File Format | Delivery Schedule | Reality |
|---|---|---|---|---|
| Correios (Brazil) | SFTP CSV | Semicolon-delimited, ISO-8859-1 encoding | Daily by 06:00 BRT | Late 30% of the time. Sometimes 2 days late. |
| Local courier (Lagos) | Email attachment | Excel (.xlsx), inconsistent column order | "Twice daily" | Once daily if lucky. Sometimes skipped. |
| Regional courier (Jakarta) | SFTP CSV | Comma-delimited, UTF-8 | Daily by 08:00 WIB | Reliable but data limited (no tracking events, only final status) |
| Regional courier (Mumbai) | SFTP CSV | Pipe-delimited, mixed encoding | Daily by 07:00 IST | 15% of records have garbled characters |
| Courier service (Nairobi) | WhatsApp messages | Screenshots of delivery receipts | Ad hoc | **Not machine-readable at all** |
| Local express (Bangkok) | SFTP Excel | Thai column headers, Thai dates | Daily by 09:00 ICT | Requires manual translation |
| Courier (Buenos Aires) | SFTP CSV | Comma-delimited, UTF-8 | Daily by 08:00 ART | Generally reliable |

**What to inject in synthetic data:**
- 5-6 carrier feeds with different status vocabularies for the same lifecycle events
- CSV files with different delimiters (comma, semicolon, pipe)
- Mixed character encodings (UTF-8, ISO-8859-1, mixed)
- Date formats varying per carrier (ISO 8601, DD/MM/YYYY, local text)
- Some carrier files with column order that changes between deliveries
- Records from "no-API" carriers that arrive as daily batch dumps with 24-48 hour latency

### Downstream Impact Chain

```
42 carrier formats, no standard
    │
    ├── Can't build unified tracking view
    │     │
    │     └── Customer asks "where is my package?" ──► Agent checks 5 screens
    │           │
    │           └── 41% of CS calls are WISMO ($2.30/call × millions)
    │
    ├── SLA measurement impossible
    │     │
    │     └── Can't compare carrier performance apples-to-apples
    │           │
    │           └── Contract negotiations based on incomplete data
    │
    └── 42% of packages have no real-time visibility
          │
          └── Proactive delivery issue detection impossible
                │
                └── Customer finds out about delay before MCG does
```

### Qlik Resolution
| Qlik Product | Action |
|---|---|
| **Qlik Talend Cloud (API + File Integration)** | Unified ingestion: REST APIs, SOAP, SFTP, webhook -- all into one pipeline |
| **Qlik Talend Cloud (Transformation)** | Canonical status mapping: all carrier-specific codes normalized to MCG standard lifecycle |
| **Data Quality (Standardization)** | Status code normalization ("DELIVERED"/"Zugestellt"/"Completed" → `DELIVERED`) |
| **Qlik Talend Cloud (Monitoring)** | SFTP file arrival SLA: alert if Correios CSV not received by 06:30 BRT |
| **Qlik Analytics** | Unified last-mile dashboard with carrier-agnostic SLA tracking |
| **Discovery Agent** | "Correios CSV for today has not arrived. 1,247 Brazil shipments have no tracking update." |

---

## Nightmare #7: The Compliance Traceability Gap

> *340 direct suppliers. ~1,200 sub-tier suppliers (unknown). 4 systems with traceability data. Lettuce recall took 11 days.*

### Root Cause
EU food safety regulations (General Food Law Regulation EC 178/2002) require "one step back, one step forward" traceability. MCG can trace from their DC to their stores (one step forward) but cannot reliably trace back to the farm of origin (one step back) -- especially through sub-tier suppliers who provide raw ingredients to MCG's direct suppliers.

### Affected Datasets

| Dataset | Role in the Problem |
|---|---|
| **#15 Traceability & Compliance** | PRIMARY -- the traceability records with gaps |
| **#7 Supplier Master & Performance** | PRIMARY -- sub-tier suppliers unknown |
| **#6 Product Master Data** | CONTRIBUTING -- country_of_origin missing for 12% of food SKUs |
| **#2 Purchase Orders & Receipts** | CONTRIBUTING -- lot/batch not always captured on PO receipt |
| **#10 Warehouse Operations** | CONTRIBUTING -- lot tracking breaks at pick/pack stage |
| **#1 Inventory Positions** | CONTRIBUTING -- lot_number missing for 15% of grocery items |

### Specific Field Manifestations

#### Dataset #15: Traceability -- The Contaminated Lettuce Scenario

A recall is triggered for lettuce from Farm FARM-NL-0042, batch `FARM-NL-2025-09-B42`. MCG needs to identify every store that received this batch within 24 hours.

**Record with COMPLETE traceability (what it should look like):**

| Field | Value | Status |
|---|---|---|
| `product_sku` | `MCG-GRO-LET-001` | Present |
| `batch_lot_id` | `FARM-NL-2025-09-B42` | Present |
| `farm_origin_id` | `FARM-NL-0042` | Present |
| `farm_country` | `NL` | Present |
| `harvest_date` | `2025-09-28` | Present |
| `processing_facility_id` | `PROC-NL-007` | Present |
| `processing_date` | `2025-09-29` | Present |
| `dc_receipt_date` | `2025-10-01` | Present |
| `dc_id` | `DC-RTD-01` | Present |
| `store_receipt_date` | `2025-10-02` | Present |
| `store_id` | `STR-AMS-001` | Present |
| `shelf_date` | `2025-10-02` | Present |
| `expiry_date` | `2025-10-09` | Present |

**Records with BROKEN traceability (reality for 12% of food SKUs):**

| Field | Record A (partial) | Record B (worse) | Record C (worst) |
|---|---|---|---|
| `product_sku` | `MCG-GRO-LET-001` | `MCG-GRO-MIX-015` | `EU-GRO-SPR-330` |
| `batch_lot_id` | `FARM-NL-2025-09-B42` | `LOT-2025-10-4821` | `null` |
| `farm_origin_id` | `FARM-NL-0042` | `null` | `null` |
| `farm_country` | `NL` | `null` | `null` |
| `harvest_date` | `2025-09-28` | `null` | `null` |
| `processing_facility_id` | `PROC-NL-007` | `PROC-ES-012` | `null` |
| `processing_date` | `2025-09-29` | `2025-10-02` | `null` |
| `dc_receipt_date` | `2025-10-01` | `2025-10-05` | `2025-10-08` |
| `dc_id` | `DC-RTD-01` | `DC-MAD-01` | `DC-SIN-01` |
| `store_receipt_date` | `null` | `2025-10-06` | `null` |
| `store_id` | `null` | `STR-MAD-012` | `null` |
| `shelf_date` | `null` | `null` | `null` |
| `expiry_date` | `2025-10-09` | `2025-10-12` | `null` |
| **Gap Assessment** | Store-level tracking missing | Farm origin unknown | Almost nothing |

#### Dataset #7: Supplier Master -- The Sub-Tier Black Hole

| supplier_id | supplier_name | supplier_tier | known_sub_suppliers | sub_supplier_count |
|---|---|---|---|---|
| `SUP-001200` | `Fresh Direct NL` | `TIER_1` | `["FARM-NL-0042","FARM-NL-0051"]` | 2 of ~8 known |
| `SUP-001340` | `Iberia Fresh S.L.` | `TIER_1` | `null` | **Unknown** |
| `SUP-002100` | `AgriPack Asia` | `TIER_1` | `null` | **Unknown** |
| `SUP-002250` | `Lagos Fresh Foods` | `TIER_1` | `null` | **Unknown** |

MCG knows they have ~340 direct (Tier 1) food suppliers. They estimate ~1,200 sub-tier suppliers exist, but only ~180 are documented. For 47% of direct food suppliers, MCG has **zero visibility into sub-tier sourcing.**

#### Dataset #1: Inventory Positions -- Missing Lot Numbers

| location_id | sku | quantity_on_hand | lot_number | Impact |
|---|---|---|---|---|
| `STR-AMS-001` | `MCG-GRO-LET-001` | `24` | `FARM-NL-2025-09-B42` | Traceable |
| `STR-MUN-042` | `MCG-GRO-LET-001` | `18` | `null` | **Cannot trace -- is this the recalled batch?** |
| `STR-ATL-015` | `MCG-GRO-MIX-015` | `36` | `null` | **Cannot trace** |
| `STR-SIN-008` | `EU-GRO-SPR-330` | `12` | `null` | **Cannot trace** |

**What to inject in synthetic data:**
- 88% of food SKU traceability records: complete (farm → store)
- 8% of food SKU traceability records: partial (missing farm origin, harvest date, or store-level tracking)
- 4% of food SKU traceability records: minimal (only DC receipt date and product SKU)
- 15% of grocery inventory records: `lot_number` = null
- 47% of Tier 1 food suppliers: `known_sub_suppliers` = null
- Certification records: 12% with expired certification dates that no one noticed

### Downstream Impact Chain

```
Lettuce recall triggered (contaminated batch at FARM-NL-0042)
    │
    ├── Step 1: Find all batches from FARM-NL-0042
    │     │
    │     ├── Traceability DB has the batch ──► Found in 2 hours
    │     │
    │     └── 15% of inventory has no lot_number ──► Can't confirm/exclude
    │           │
    │           └── Must assume ALL untracked lettuce is potentially affected
    │
    ├── Step 2: Find all stores that received those batches
    │     │
    │     ├── DC-to-store tracking exists for 70% ──► 4 hours
    │     │
    │     └── 30% has no store_receipt_date ──► Must manually call each DC
    │           │
    │           └── DCs cross-reference paper manifests ──► 3-5 additional days
    │
    ├── Step 3: Pull product from shelves
    │     │
    │     └── Stores with untracked inventory pull ALL lettuce (precautionary)
    │           │
    │           └── 2x product waste vs. targeted recall
    │
    └── Total time: 11 days (target: 24 hours)
          │
          └── EU regulatory citation issued
              │
              └── Potential fine + reputational damage
```

### Qlik Resolution
| Qlik Product | Action |
|---|---|
| **Qlik Talend Cloud** | Unified ingestion from all 4 traceability systems into a single lineage model |
| **Data Quality Rules** | "Every food SKU receipt must include lot_number and farm_origin_id" -- violations flagged at ingestion |
| **Data Catalog + Lineage** | Visual farm-to-shelf lineage for any food product. Click a SKU, see every node in its journey. |
| **Trust Score** | Traceability completeness tracked: Trust Score improved from 72 → 96 over 6 months |
| **Data Stewardship** | Missing traceability data generates stewardship tasks assigned to supplier management team |
| **Qlik Analytics** | Compliance Traceability Map: audit-ready visualization of all food product lineage |
| **Qlik Answers** | "Which stores received lettuce batch FARM-NL-2025-09-B42?" -- answered in seconds, not days |
| **Discovery Agent** | "12 food SKUs received this week are missing farm_origin_id. Compliance gap detected." |

---

## Master Cross-Reference Matrix

A single view of which nightmares appear in which datasets:

| Dataset | NM#1 Phantom Inventory | NM#2 Address | NM#3 Product Master | NM#4 Silent Pipelines | NM#5 Timestamps | NM#6 Carrier Black Hole | NM#7 Compliance |
|---|---|---|---|---|---|---|---|
| #1 Inventory Positions | **PRIMARY** | | downstream | affected | **affected** | | contributing |
| #2 Purchase Orders | contributing | | contributing | affected | | | contributing |
| #3 Sales Transactions (POS) | contributing | contributing | | | **affected** | | |
| #4 E-Commerce Orders | | **PRIMARY** | | | | downstream | |
| #5 Shipment & Carrier Tracking | | downstream | downstream | affected | **affected** | **PRIMARY** | |
| #6 Product Master Data | | | **PRIMARY** | | | | contributing |
| #7 Supplier Master | | | **PRIMARY** | | | | **PRIMARY** |
| #8 Customer & Address Data | | **PRIMARY** | | | | | |
| #9 Demand Forecasts | downstream | | downstream | affected | | | |
| #10 Warehouse Operations | contributing | | | affected | **affected** | | contributing |
| #11 Cold-Chain / IoT Telemetry | | | | **affected** | **affected** | | |
| #12 Returns & Reverse Logistics | | downstream | | | | | |
| #13 Financial / Cost Data | downstream | | downstream | | **affected** | | |
| #14 Carrier Rate & Contract Data | | | downstream | | | contributing | |
| #15 Traceability & Compliance | | | | | | | **PRIMARY** |

**Legend:**
- **PRIMARY** = The nightmare's main residence -- this is where you see it most clearly
- **contributing** = This dataset feeds bad data that creates/worsens the nightmare
- **downstream** = This dataset is a victim -- it receives corrupted data because of the nightmare
- **affected** = This dataset is touched by the cross-cutting nightmare (pipelines, timestamps)

---

*Nightmare-to-Dataset Traceability Map for Meridian Commerce Group demo build*
*Version 1.0 -- February 2026*
