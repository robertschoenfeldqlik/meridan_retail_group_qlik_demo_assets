# MCG Demo — Scenario Playbook

Six presenter-ready demo scenarios. Each traverses multiple Qlik Cloud components to tell a complete MCG business story.

---

## Scenario 1: The Silent Pipeline Failure (Rotterdam DC)

**Duration:** 8-10 minutes
**Nightmares:** #1 (Phantom Inventory), #4 (Silent Pipeline Failures)
**Components:** PostgreSQL → Lakehouse → Data Flow → Stewardship → Qlik Analytics → Discovery Agent → Teams Automation → Qlik Answers

### The Business Problem

Rotterdam DC's WMS-to-SAP CDC pipeline silently failed for 72 hours. SAP showed 500 units of MCG-4420 (Bluetooth Speaker) while the warehouse had 287. Nobody noticed for 3 days. 94 orders were allocated against phantom stock.

### Demo Walk-Through

**Step 1 — Show the raw data (Bronze)**
- Open Lakehouse → `bronze.inventory_positions`
- Filter to `location_id = 'DC-RTD-01'`, `sku = 'MCG-4420'`
- Point out: `snapshot_timestamp` stops advancing on Sep 24 — data is frozen
- The timestamp shows `14:32` with no timezone indicator (Nightmare #5)

**Step 2 — Show the transformation (Data Flow Route 2)**
- Open Pipeline Designer → Inventory Reconciliation route
- Walk through: timestamp normalization (Route 1 first), then WMS-ERP comparison
- Show the `phantom_inventory = TRUE` flag being set
- Show Trust Score dropping from 0.92 → 0.31 for affected rows

**Step 3 — Show the alert (Discovery Agent)**
- Discovery Agent dashboard: "Inventory data for DC-RTD-01 has not refreshed in 72 hours"
- Show correlation: 847 phantom units, 143 SKUs affected
- Point out: "This took MCG 4.3 days to detect manually. The Agent found it in 15 minutes."

**Step 4 — Show the Teams notification (Automation)**
- Open Teams → `#mcg-data-engineering` channel
- Show the Pipeline Health alert that fired at 07:00 UTC
- Shows: "❌ Failed: 1 (DC-RTD-01 — last sync 72h ago)"

**Step 5 — Show the dashboard (Qlik Analytics)**
- Open Supply Chain Health dashboard → Rotterdam DC panel
- Red indicator for IRA: 74%
- Drill into phantom inventory: see the 847-unit discrepancy

**Step 6 — Ask Qlik Answers**
- "What happened at Rotterdam DC in September?"
- Answers pulls from INC-2025-04872, TRN-2025-001, references the TLS certificate root cause

**Talking Points:**
- "Without unified pipeline monitoring, this failure cost €30,500 and took 4.3 days to find"
- "With Qlik, the Discovery Agent detects it in minutes, Teams notifies the team, and the dashboard shows real-time impact"
- "Project CLARITY Phase 1 deploys this monitoring to all 28 DCs"

---

## Scenario 2: The Address Catastrophe (Global)

**Duration:** 8-10 minutes
**Nightmares:** #2 (Address Catastrophe), #6 (Carrier Data Black Hole)
**Components:** Salesforce → Lakehouse → Data Flow → Stewardship → Business Glossary → Qlik Analytics → Predict

### The Business Problem

18.4M customer addresses, 11% with formatting inconsistencies, 6% truncated by a legacy POS system's 30-character field limit. Results in 4.7% carrier rejection rate costing $3.1M/year.

### Demo Walk-Through

**Step 1 — Show the dirty addresses (Bronze)**
- Open `bronze.sf_contacts` → filter to demonstrate:
  - `Jan de Vries` vs `Jan De Vries` (capitalization)
  - `Keizersgracht 482, Apartment 4B` vs `Keizersgracht 482, Apt 4B` (abbreviation)
  - `Friedrichstraße 123, Hinterh` — truncated at exactly 30 characters
  - `Sao Paulo` (accent stripped) vs `São Paulo`

**Step 2 — Show Data Quality Profiling**
- Run profiling on `bronze.sf_contacts`
- Show: 11% format inconsistency, 6% truncation (exactly 30 chars), 3.2% potential duplicates

**Step 3 — Show the transformation (Data Flow Route 3)**
- Walk through Address Standardization pipeline:
  - Country normalization: `Netherlands` → `NL`
  - Postal code standardization: `1017EJ` → `1017 EJ`
  - Abbreviation expansion: `Apt` → `Apartment`
  - Fuzzy dedup: Jan de Vries × 2 records → merged with 88% confidence

**Step 4 — Show Stewardship**
- Open Stewardship → Address Cleanup campaign
- Show a task: "These two records are 88% similar. Same customer?"
- Show the before/after: 3.2% duplicates → resolved to unique customers

**Step 5 — Show the glossary**
- Open Business Glossary → "Address Quality Score"
- Shows the definition, formula, owner (Customer Data Team), related nightmare (#2)

**Step 6 — Show Predict model**
- Open the Delivery SLA Predictor
- Show feature importance: `address_quality_score` is the #2 predictor
- Run prediction: "This order to Friedrichstraße 123, Hinterh (truncated) has 72% chance of delivery failure"

**Step 7 — Show Qlik Analytics dashboard**
- Open Last Mile Performance → Address Quality heatmap
- Show carrier rejection hotspots by postal code region
- Before/after Trust Score: 0.42 → 0.89 after standardization

**Talking Points:**
- "A 30-character field limit from a legacy POS system causes $3.1M in annual losses"
- "The Predict model proves that fixing addresses directly improves delivery SLAs"
- "Stewardship gives the Customer Data Team a workflow to resolve the 3.2% ambiguous matches"

---

## Scenario 3: The $2.48M Cold Chain Spoilage

**Duration:** 10-12 minutes
**Nightmares:** #4 (Silent Pipelines), #5 (Timestamps), #6 (Carrier Data Black Hole)
**Components:** Kafka → Lakehouse → Data Flow → Predict → Discovery Agent → Teams → Qlik Analytics → Qlik Answers → MCP

### The Business Problem

TransFrio Logistics replaced 6 trucks with new Thermo King X4 7500 reefer units but didn't tell MCG. Drivers used the old startup procedure, causing 30-45 minute cooling delays. $2.48M in spoilage over Q3 2025. It took 3 weeks to find the root cause because IoT data and fleet data lived in different systems.

### Demo Walk-Through

**Step 1 — Show live IoT data (Kafka → Bronze)**
- Start the IoT producer simulator
- Show `bronze.iot_cold_chain` — live sensor readings flowing in
- Point out: São Paulo sensors showing temperature exceedances (8-14°C)
- Point out: one sensor shows `temperature_unit: "F"` (Nightmare #5 — Fahrenheit mix)

**Step 2 — Show IoT normalization (Data Flow Route 6)**
- Pipeline: Fahrenheit → Celsius conversion, timestamp normalization
- Exceedance flagging: "This reading of 11.2°C on the GRU-BA route exceeds the 8°C threshold for fresh produce"
- Show the 6-hour Lagos gap in sensor data (connectivity blackout)

**Step 3 — Show the Predict model**
- Open Spoilage Risk Predictor → feature importance chart
- Top features: `max_temp_celsius`, `pre_cool_compliant`, `route`
- Run live prediction: "This active shipment on GRU-BA has 78% spoilage probability"

**Step 4 — Show Discovery Agent**
- Agent insight: "Spoilage rate on GRU-BA route increased 4x since July 7"
- Correlation: "6 of 12 fleet vehicles show consistently higher exceedance rates"
- "This is what took Roberto Almeida's team 3 weeks to discover manually"

**Step 5 — Show Teams alert (Automation)**
- `#mcg-cold-chain-alerts` channel → Adaptive Card:
  - "🚨 Shipment SHP-GRU-BA-20251015: 11.2°C for 42 minutes. Estimated exposure: $18K"
  - Links to dashboard and SOP-SC-002

**Step 6 — Show Qlik Analytics**
- Cold Chain Monitor dashboard:
  - Map showing the São Paulo→Buenos Aires route with red temperature dots
  - Trend chart: spoilage rate climbing week over week since July 7
  - Carrier performance comparison: TransFrio vs others

**Step 7 — Ask Qlik Answers**
- "What caused the TransFrio spoilage on the São Paulo-Buenos Aires route?"
- Answers references INC-2025-05102: fleet change, Thermo King X4 7500, driver retraining gap
- Follow-up: "What is the correct startup procedure for the Thermo King X4 7500?"
- Answers references TRN-2025-002: "Press and HOLD START for 3 seconds..."

**Step 8 — Show MCP integration (optional)**
- Open Claude → "What's the spoilage risk for active TransFrio shipments?"
- Claude uses Qlik MCP to query `silver.iot_normalized` + Qlik Answers for context
- Returns combined data + operational procedure guidance

**Talking Points:**
- "The data to identify this problem existed from Day 1 — IoT sensors recorded every temperature exceedance"
- "But because IoT and carrier fleet data lived in disconnected systems, nobody could see the correlation"
- "With the Qlik Lakehouse connecting all sources, the Discovery Agent found the pattern immediately"

---

## Scenario 4: The Lettuce Recall (Compliance Traceability)

**Duration:** 8-10 minutes
**Nightmares:** #7 (Compliance Gap), #3 (Product Master)
**Components:** Lakehouse → Data Flow → Stewardship → Qlik Analytics → Qlik Answers → Business Glossary

### The Business Problem

Listeria detected in organic butter lettuce from an undisclosed backup farm (FARM-NL-0042). Full traceability took 11 days across 4 disconnected systems. EU regulations require 24 hours. NVWA issued citation NVWA-2025-CIT-04412.

### Demo Walk-Through

**Step 1 — Show the traceability gap (Bronze)**
- `bronze.inventory_positions`: filter to grocery items → show 15% with `lot_number = NULL`
- `bronze.sf_products`: show `country_of_origin = NULL` for 12% of food SKUs
- "If this lettuce batch is contaminated, we can't tell which stores have it"

**Step 2 — Show the compliance data product (Gold)**
- `silver.inventory_reconciled`: query `sku = 'MCG-GRO-LET-001'`
- Some rows have complete farm-to-store tracing. Others have gaps.
- `trace_complete_flag = FALSE` for 30% of lettuce records

**Step 3 — Show Stewardship**
- Open Lot Number Compliance campaign
- 750 grocery inventory records need lot numbers assigned
- Show a steward task: "Locate lot number for MCG-GRO-LET-001 at STR-MUN-042"

**Step 4 — Show Business Glossary**
- Look up "EC 178/2002": definition, traceability requirement, link to NVWA
- Look up "Lot Number": definition, NVWA compliance requirement

**Step 5 — Show Qlik Analytics**
- Compliance Traceability dashboard:
  - Map showing store locations color-coded by traceability completeness
  - Trend chart: lot capture rate improving from 85% → 93%
  - Recall simulation: "If batch FARM-NL-2025-09-B42 is contaminated, these 210 stores are affected"

**Step 6 — Ask Qlik Answers**
- "How long did the lettuce recall take and why?"
- Answers: "11 days vs 24-hour target. Required manual cross-referencing across SAP, WMS, TMS, and Salesforce."
- Follow-up: "What is MCG's corrective action plan for the NVWA citation?"
- Answers references COMP-2025-NVWA: 5 actions, 3 on track, 1 at risk (sub-tier supplier mapping at 36%)

---

## Scenario 5: The NinjaVan SLA Crisis (APAC)

**Duration:** 6-8 minutes
**Nightmares:** #6 (Carrier Data Black Hole), #2 (Address Catastrophe)
**Components:** Salesforce → Lakehouse → Data Flow → Qlik Analytics → Predict → Qlik Answers → Automation

### The Business Problem

NinjaVan contract amendment AMD3 reclassified 5-10 kg parcels from 2-day to 3-day delivery (effective Oct 1). The change wasn't communicated to the e-commerce team for 3+ weeks. The website kept promising 2-day delivery to 14,000 customers/month. Singapore delivery promise accuracy dropped to 69%.

### Demo Walk-Through

**Step 1 — Show the order data (Bronze → Silver)**
- `silver.orders_enriched`: filter `carrier = 'NinjaVan'`, `destination_country = 'SG'`
- Show `promised_delivery` vs `actual_delivery` — gap widening after Oct 1
- WISMO flag: 52% of Singapore orders have `wismo_flag = TRUE`

**Step 2 — Show carrier status normalization (Data Flow Route 5)**
- NinjaVan statuses: `Pending Pickup` → `PICKED_UP`, `Completed` → `DELIVERED`
- Show tracking data availability: only 71% (target 99%)

**Step 3 — Show Qlik Analytics**
- Last Mile Performance dashboard → APAC tab:
  - Singapore SLA chart: drops from 88% → 69% in October
  - WISMO rate spike: 30% → 52%
  - Filter by weight band: 5-10 kg parcels are the problem

**Step 4 — Show Predict model**
- Delivery SLA Predictor: "5-10 kg parcel via NinjaVan to SG → 31% chance of on-time delivery"
- Compare: "2 kg parcel via NinjaVan to SG → 89% chance of on-time delivery"
- The weight threshold maps exactly to the AMD3 reclassification

**Step 5 — Ask Qlik Answers**
- "Why did Singapore delivery promise accuracy drop?"
- Answers references CARRIER-NV-2025: AMD3 amendment, reclassification details, 3-week communication gap
- "What is MCG's policy for carrier SLA changes?"
- Answers references MCG-POL-020: 24-hour notification requirement that was violated

---

## Scenario 6: Project CLARITY — The Full Platform Story

**Duration:** 12-15 minutes
**Nightmares:** All 7
**Components:** All — Sources → Lakehouse → Flows → Products → Predict → Answers → Agent → MCP → Stewardship → Glossary → Teams

### The Business Problem

MCG's data quality crisis costs $127M annually. Project CLARITY is a $12.4M Qlik platform investment with a projected 952% 3-year ROI. This scenario shows how every Qlik component addresses one or more of the 7 nightmares.

### Demo Walk-Through

**Step 1 — The Problem Landscape (2 min)**
- Show the PowerPoint: 7 Data Quality Nightmares, $127M annual impact
- Or use Qlik Analytics dashboard: Trust Score overview showing red/amber across all data domains

**Step 2 — Data Integration: "Connect Everything" (3 min)**
- Show all 3 source connections in Talend Cloud:
  - PostgreSQL CDC: live inventory changes streaming
  - Kafka: live IoT sensor readings
  - Salesforce: customer and order data
- Show Pipeline Health monitoring: all green (or one amber for demo)

**Step 3 — Open Lakehouse: "One Source of Truth" (2 min)**
- Show Bronze: the raw dirty data from all 3 sources
- Show Silver: cleansed, standardized (walk through one transformation)
- Show Gold: business-ready data products

**Step 4 — Data Quality: "Trust Your Data" (2 min)**
- Show Trust Scores before and after transformation
- Before: Inventory 0.31, Addresses 0.42, Products 0.55
- After: Inventory 0.89, Addresses 0.87, Products 0.91
- Show the Data Quality rule dashboard: violations trending down

**Step 5 — Governance: "Manage at Scale" (2 min)**
- Business Glossary: look up "Phantom Inventory" — definition, owner, related datasets
- Stewardship: show active campaigns — 640 addresses, 80 suppliers, 8,200 products in progress
- Data Products: show the 7 governed products with API sharing enabled

**Step 6 — Analytics: "See What Matters" (2 min)**
- Qlik Analytics: Supply Chain Command Center
- 4 panels: Inventory Health, Cold Chain, Last Mile, Compliance
- Drill from global overview → Rotterdam DC → specific SKU

**Step 7 — AI: "Intelligence Everywhere" (3 min)**
- Predict: spoilage risk model flags at-risk shipment
- Discovery Agent: proactive alert about GRU-BA route anomaly
- Qlik Answers: "What is Project CLARITY's expected ROI?" → $52.7M conservative, 952% over 3 years
- MCP (optional): Claude queries data products and answers in one integrated response

**Step 8 — Automation: "Act Immediately" (1 min)**
- Teams channel: cold chain alert fires
- Pipeline health summary posted at 07:00
- Steward gets a DM about a new data quality task

**Closing talking point:**
"Every dollar of that $127M in data quality costs is addressable. Project CLARITY's $12.4M investment pays back in under 4 months. What you've seen today is not a concept — it's a working demo using real Qlik Cloud capabilities connected to realistic supply chain data."

---

## Pre-Demo Checklist

| # | Check | Status |
|---|---|---|
| 1 | PostgreSQL running with demo data loaded | ☐ |
| 2 | Kafka running, IoT producer script ready (don't start yet) | ☐ |
| 3 | Salesforce developer org with demo data loaded | ☐ |
| 4 | All 3 source connections tested in Talend Cloud | ☐ |
| 5 | Open Lakehouse Bronze tables populated | ☐ |
| 6 | Data flows run successfully (Silver + Gold populated) | ☐ |
| 7 | Qlik Analytics dashboards loaded with data | ☐ |
| 8 | Predict models trained and deployed | ☐ |
| 9 | Knowledge Base indexed (25 documents) | ☐ |
| 10 | Assistant configured with conversation starters | ☐ |
| 11 | Teams automations connected and tested | ☐ |
| 12 | Discovery Agent monitoring enabled | ☐ |
| 13 | MCP server configured (if showing MCP scenario) | ☐ |

---

*MCG Demo — Scenario Playbook*
*Version 1.0 — February 2026*
