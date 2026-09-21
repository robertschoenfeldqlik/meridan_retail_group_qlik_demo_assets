# Meridian Commerce Group (MCG)
## Qlik End-to-End Platform Demo -- Company Profile & Use Case

---

## 1. Company Overview

| Attribute | Detail |
|---|---|
| **Company Name** | Meridian Commerce Group (MCG) |
| **Founded** | 1987, Rotterdam, Netherlands |
| **Headquarters** | Rotterdam, NL (Global HQ); Regional HQs in Atlanta GA, Singapore, and Sao Paulo |
| **Industry** | Omni-channel Retail (Brick & Mortar + E-Commerce) |
| **Revenue** | ~$14.2B USD (FY2025) |
| **Employees** | 62,000 across 23 countries |
| **Store Count** | 1,140 physical locations (branded as "Meridian Market" and "MCG Express") |
| **E-Commerce** | meridiancommerce.com -- serves 38 countries, ~$3.8B in online revenue |
| **Product Categories** | Home goods, electronics, apparel, grocery & fresh, health & wellness |
| **Fulfillment Centers** | 28 regional DCs, 6 mega-fulfillment hubs |
| **CEO** | Ingrid van der Berg |
| **CIO** | Marcus Chen |
| **CDO (Chief Data Officer)** | Priya Ramanathan |

### Brand Identity

Meridian Commerce Group positions itself as "the neighborhood store with global reach." Their promise: whether a customer walks into a Meridian Market in Amsterdam, orders online from Lagos, or picks up curbside in Austin, the experience should feel consistent, personal, and reliable.

That promise is breaking down.

---

## 2. The Story -- What's Going Wrong

### 2.1 The Board Meeting That Changed Everything

In Q3 2025, MCG's board reviewed a troubling quarter:

- **Out-of-stock events** increased 34% YoY across European stores, yet warehouses showed adequate inventory levels in the ERP.
- **Last-mile delivery SLA breaches** hit 22% in APAC markets -- up from 8% the prior year -- with customer NPS dropping 18 points.
- **Spoilage losses** in the grocery/fresh category exceeded $48M, partly due to cold-chain monitoring gaps.
- A **regulatory audit** in the EU flagged MCG for inability to trace product origins for 12% of SKUs in their food category -- a compliance violation under EU food safety regulations.
- Online order **"where is my package" (WISMO) calls** now represent 41% of all customer service contacts, costing $2.30 per call.

CEO Ingrid van der Berg asked the CIO a simple question: *"Why can't we see what's happening in our own supply chain?"*

The answer was more complicated than anyone expected.

### 2.2 The Data Landscape -- A Tangled Web

Over 30 years of growth through acquisitions, organic expansion, and rapid digital transformation, MCG accumulated a fragmented data estate:

| System | Purpose | Region | Technology |
|---|---|---|---|
| SAP S/4HANA | Core ERP (financials, procurement) | Global | On-prem, migrating to cloud |
| Oracle WMS | Warehouse management | Americas, EU | On-prem |
| Manhattan Associates | Warehouse management | APAC | Cloud |
| Meridian Storefront | E-commerce platform | Global | Cloud |
| Blue Yonder | Demand planning & forecasting | Americas | Cloud |
| Kinaxis | Supply chain planning | EU, APAC | Cloud |
| Descartes | Transportation management | Global | Cloud |
| Tive / Sensitech | IoT cold-chain sensors | EU, Americas | Cloud + Edge |
| Shopify POS | In-store point-of-sale | Express format stores | Cloud |
| Oracle Retail Xstore | POS for full-format stores | Full-format stores | On-prem |
| Snowflake | Cloud data warehouse | Global (partial) | Cloud |
| Legacy SQL Server instances | Regional reporting | Various | On-prem |
| 14 spreadsheet-based trackers | Ad-hoc supply chain monitoring | Various | Excel/Google Sheets |

**Total: 47 distinct source systems, 6 ERP instances, 3 WMS platforms, 2 POS systems, and an unknown number of shadow IT data flows.**

### 2.3 The Seven Data Quality Nightmares

MCG's CDO, Priya Ramanathan, commissioned a data health assessment. The findings were sobering:

#### Nightmare #1: The Phantom Inventory Problem
SAP shows 500 units of SKU #MCG-4420 (Bluetooth speaker) in the Rotterdam DC. Oracle WMS says 312. The actual physical count: 287. The discrepancy traces back to a failed integration batch job three weeks ago that silently stopped syncing inventory adjustments. **No alert was ever generated.**

#### Nightmare #2: The Address Catastrophe
MCG's customer database contains 18.4 million delivery addresses across systems. Data profiling reveals:
- 11% have inconsistent formatting (mixing local formats with US-style)
- 6% contain truncated street names (field length limits in legacy POS)
- 3.2% are duplicates with slight variations ("Apt 4B" vs "Apartment 4B" vs "#4B")
- Last-mile carriers reject 4.7% of addresses on first attempt, triggering re-routing delays

#### Nightmare #3: The Product Master Data Mess
After five acquisitions, MCG has no single product master:
- The same product exists under 3 different SKU numbering schemes
- Product category hierarchies differ between the EU catalog (5 levels) and Americas catalog (3 levels)
- 8,200 products have missing or incorrect weight/dimension data -- causing shipping cost miscalculations
- Supplier codes are not standardized -- the same supplier appears as "Samsung Elec.", "Samsung Electronics Co.", "SAMSUNG", and "Samsung Corp" across systems

#### Nightmare #4: The Silent Pipeline Failures
Data pipelines between systems fail an average of 23 times per week. Of these:
- 60% recover automatically on retry
- 25% fail silently with no notification -- data simply stops flowing
- 15% produce partial or corrupted data that propagates downstream
- Average time to detect a silent failure: **4.3 days**
- Average time to remediate: **2.1 additional days**

#### Nightmare #5: The Timestamp Tower of Babel
MCG operates across 14 time zones. Systems record timestamps inconsistently:
- SAP uses UTC
- Oracle WMS uses local warehouse time
- IoT sensors use UTC but with millisecond precision that gets truncated
- Carrier APIs return delivery timestamps in the recipient's local time
- Result: Calculating true order-to-delivery time requires manual cross-referencing across 4 systems

#### Nightmare #6: The Carrier Data Black Hole
MCG works with 42 last-mile carriers globally. Each provides tracking data in different formats:
- Some push via webhook, others require polling via API
- Status codes are not standardized ("delivered" vs "DEL" vs "DLVRD" vs "Complete")
- 7 carriers have no API -- they send daily CSV files via SFTP (sometimes late, sometimes not at all)
- Real-time visibility exists for only 58% of in-transit packages

#### Nightmare #7: The Compliance Traceability Gap
EU regulations require farm-to-shelf traceability for food products. MCG's fresh/grocery supply chain involves:
- 340 direct suppliers
- ~1,200 sub-tier suppliers (estimated -- actual number unknown)
- Traceability data is captured in 4 different systems with no unified lineage
- During the last recall event (contaminated lettuce), it took MCG **11 days** to identify all affected stores -- the regulatory target is 24 hours

### 2.4 The Human Impact

These aren't just data problems. They're business problems:

- **Store managers** manually reconcile inventory in spreadsheets every morning -- ~45 minutes per store, per day. Across 1,140 stores, that's **855 hours of manual labor daily**.
- **Supply chain analysts** spend 70% of their time finding and cleaning data, and only 30% actually analyzing it.
- **Customer service agents** have no single view of an order's journey -- they toggle between 5 screens to answer a WISMO call.
- **Regional VPs** receive weekly PowerPoint decks that are already stale by the time they're presented. No one trusts the numbers because every region's report tells a different story from the same underlying data.
- **The CFO** cannot accurately forecast inventory carrying costs because the data foundation is unreliable.

---

## 3. The Qlik Transformation -- End-to-End Platform Mapping

MCG selects Qlik as its strategic data platform partner. Here is how every layer of the Qlik stack addresses MCG's challenges:

---

### Phase 1: CONNECT & INTEGRATE -- Qlik Talend Cloud (Data Integration)

**Challenge addressed:** 47 fragmented source systems, silent pipeline failures, inconsistent data formats

#### Qlik Talend Cloud -- Data Integration

| Capability | MCG Application |
|---|---|
| **Change Data Capture (CDC)** | Real-time CDC from SAP S/4HANA and Oracle WMS captures every inventory adjustment, PO receipt, and shipment event as it happens -- eliminating the batch lag that created phantom inventory. Agentless CDC means no performance impact on production ERP. |
| **SaaS Connectors** | Pre-built connectors to Meridian Storefront, Blue Yonder, Kinaxis, Descartes, and Shopify POS pull order, forecast, and shipment data into a unified pipeline. |
| **API & File Integration** | Carrier data from 42 providers is ingested via a mix of webhook listeners, API polling jobs, and SFTP file monitors -- all orchestrated in a single platform. Standardized status code mapping transforms "DEL"/"DLVRD"/"Complete" into a canonical delivery status. |
| **Pipeline Orchestration & Monitoring** | Replaces the silent-failure problem. Every pipeline has health monitoring, SLA tracking, and automated alerting. If a carrier SFTP file doesn't arrive by 06:00 UTC, the operations team is notified immediately -- not 4.3 days later. |
| **Hybrid Deployment** | On-prem agents connect to legacy SQL Server instances and Oracle databases behind MCG's firewall, while cloud-native pipelines handle SaaS sources. No rip-and-replace required. |

#### Qlik Replicate

| Capability | MCG Application |
|---|---|
| **Real-Time Data Replication** | Continuously replicates transactional data from SAP and Oracle WMS into Snowflake and the Qlik Open Lakehouse, ensuring the analytics layer always reflects current state. |
| **Heterogeneous Replication** | Bridges the gap between MCG's two WMS platforms (Oracle in Americas/EU, Manhattan in APAC) by landing both into a common schema in the lakehouse. |

---

### Phase 2: TRUST & GOVERN -- Qlik Talend Cloud (Data Quality & Governance)

**Challenge addressed:** The Seven Data Quality Nightmares

#### Data Quality & Profiling

| Capability | MCG Application |
|---|---|
| **Automated Data Profiling** | On first connect, Qlik Talend profiles every source -- revealing the 11% address formatting issues, 3.2% duplicates, and 8,200 products with missing weight/dimensions before they corrupt downstream analytics. |
| **Data Quality Rules** | Business rules engine enforces standards: inventory quantities must reconcile within 2% between ERP and WMS; addresses must pass postal validation; product weights must be non-null and within category norms. |
| **Standardization & Matching** | Address standardization normalizes "Apt 4B" / "Apartment 4B" / "#4B" into a canonical form. Fuzzy matching deduplicates supplier names ("Samsung Elec." / "Samsung Electronics Co." / "SAMSUNG" → single master record). |
| **Data Stewardship Workflows** | When automated rules can't resolve an issue (e.g., two conflicting supplier records), a stewardship task is routed to the appropriate data owner for manual resolution -- with SLA tracking. |

#### Qlik Talend Trust Score & Trust Score for AI

| Capability | MCG Application |
|---|---|
| **Trust Score** | Every dataset in MCG's ecosystem receives a Trust Score combining completeness, validity, timeliness, and usage metrics. Store managers can see at a glance that their inventory data has a Trust Score of 94 (reliable) vs. their carrier data at 67 (needs attention). |
| **Trust Score for AI -- Diversity** | Before MCG feeds demand forecasting data into ML models, the Diversity dimension flags that their training data over-represents European buying patterns and under-represents APAC -- preventing biased demand forecasts. |
| **Trust Score for AI -- Timeliness** | Flags that cold-chain IoT sensor data for the Lagos DC has a 6-hour lag -- unacceptable for freshness-sensitive AI models predicting spoilage risk. |
| **Trust Score for AI -- Accuracy** | Detects that 4% of historical delivery timestamps fall outside business-rule bounds (e.g., "delivered" timestamps before "shipped" timestamps) -- data that would corrupt delivery-time prediction models. |
| **Trust Score Historization** | Tracks Trust Score trends over time. After the data quality initiative, MCG can demonstrate to EU regulators that their food traceability data quality improved from 72 to 96 over six months. |

#### Data Catalog & Lineage

| Capability | MCG Application |
|---|---|
| **Talend Data Catalog** | A searchable, governed catalog lets any MCG employee find trusted data assets. A supply chain analyst searching "delivery performance" immediately finds the curated, governed dataset -- not one of the 14 rogue spreadsheets. |
| **End-to-End Lineage** | For the EU compliance audit: click on any food product SKU and trace its data lineage from farm supplier → sub-tier supplier → DC receipt → store shelf. What took 11 days during the lettuce recall can now be answered in minutes. |
| **Data Products** | Curated, reusable "Supply Chain Health" and "Last-Mile Performance" data products are published with built-in quality markers, stewardship ownership, and access controls -- ensuring both human analysts and AI agents work from the same trusted source. |

---

### Phase 3: STORE & OPTIMIZE -- Qlik Open Lakehouse

**Challenge addressed:** Fragmented storage, high query costs, vendor lock-in, need for ML-ready data

| Capability | MCG Application |
|---|---|
| **Managed Apache Iceberg** | All integrated supply chain data lands in an open Iceberg lakehouse -- structured (ERP transactions), semi-structured (carrier JSON/XML), and unstructured (IoT sensor streams) in one place. No vendor lock-in. |
| **Real-Time Ingestion** | CDC streams from SAP and WMS flow continuously into Iceberg tables. When a warehouse worker scans a pallet receipt, the lakehouse reflects it within seconds. |
| **Multi-Engine Access** | MCG's existing Snowflake investment isn't wasted -- Snowflake, Amazon Athena, and Apache Spark can all query the same Iceberg tables. The data science team uses Spark for ML training while the BI team uses Snowflake for reporting. Same data, no duplication. |
| **Cost Optimization** | Automated compaction and partition optimization deliver faster queries at lower infrastructure cost. MCG projects 40% reduction in cloud compute spend vs. their prior multi-warehouse approach. |

---

### Phase 4: ANALYZE & VISUALIZE -- Qlik Cloud Analytics (Qlik Analytics)

**Challenge addressed:** Stale PowerPoint decks, no single source of truth, analysts spending 70% of time on data prep

#### Executive Supply Chain Command Center

A Qlik Analytics application provides MCG's leadership with a real-time, interactive view:

- **Global Inventory Health Dashboard:** Heat map of all 1,140 stores and 28 DCs showing real-time inventory accuracy (ERP vs. WMS vs. physical count reconciliation). Red/yellow/green indicators replace the morning spreadsheet ritual.
- **Last-Mile Delivery Performance:** Live SLA tracking across all 42 carriers and 38 countries. Drill from global view → region → country → carrier → individual shipment. The 22% APAC SLA breach rate is visible *as it develops*, not in next week's PowerPoint.
- **Spoilage Risk Monitor:** Combines IoT cold-chain temperature data with inventory age and demand forecasts. Flags at-risk fresh inventory *before* it spoils -- targeting the $48M annual loss.
- **Compliance Traceability Map:** Visual, interactive product lineage from supplier origin through the supply chain. EU audit-ready at the click of a button.
- **WISMO Reduction Tracker:** Tracks the correlation between data quality improvements and customer service call volume reduction.

#### Associative Analytics Engine

The Qlik Associative Engine enables discoveries that traditional query-based BI misses:

- An analyst exploring late deliveries in Germany discovers an unexpected association: 78% of the late orders were for items sourced from a specific sub-tier supplier in Vietnam whose lead times increased after a port infrastructure change -- a connection across 4 datasets that no one thought to query.
- Store managers in Brazil notice that out-of-stock events for health & wellness products correlate with a specific demand planning model override pattern in Blue Yonder -- revealing a process issue, not a data issue.

---

### Phase 5: PREDICT & ACT -- Qlik AutoML & Qlik Predict

**Challenge addressed:** Reactive decision-making, inability to forecast disruptions

| Capability | MCG Application |
|---|---|
| **Demand Forecast Accuracy Model** | AutoML trains on 3 years of historical sales, weather, promotional calendar, and local event data to predict SKU-level demand at each store. Code-free interface means supply chain analysts (not just data scientists) build and iterate on models. |
| **Delivery Delay Predictor** | Predicts the probability of last-mile SLA breach for each in-transit shipment based on carrier, route, weather, and historical performance. Proactive re-routing decisions replace reactive firefighting. |
| **Spoilage Risk Scoring** | ML model scores every fresh/grocery item in every DC based on cold-chain data, time-in-transit, and demand velocity. Items above the risk threshold trigger automated markdown or redistribution recommendations. |
| **Qlik Predict Integration** | ML predictions surface directly inside Qlik Analytics dashboards. A store manager doesn't need to understand the model -- they see "Spoilage Risk: HIGH" on a specific product and the recommended action (markdown/transfer/reorder). |
| **Model Monitoring & Retraining** | AutoML continuously monitors model drift. When APAC carrier performance patterns shift due to monsoon season, the delivery delay model automatically triggers retraining with fresh data. |
| **AI Trust Score Validation** | Before any model is deployed, the Trust Score for AI validates that training data meets Diversity, Timeliness, and Accuracy thresholds. No model goes into production on questionable data. |

---

### Phase 6: CONVERSE & DISCOVER -- Qlik Answers & Discovery Agent (Agentic AI)

**Challenge addressed:** Insights locked behind technical barriers, reactive monitoring, slow response to anomalies

#### Qlik Answers (Conversational AI)

Natural language interface that combines structured data, unstructured documents, and LLM reasoning:

| User | Question | What Happens |
|---|---|---|
| **Regional VP, APAC** | *"Why are our Singapore delivery SLAs declining?"* | Qlik Answers queries the curated Last-Mile Performance data product, combines it with a recent carrier contract amendment PDF, and responds: "SLA performance in Singapore dropped 12% after NinjaVan's contract tier changed on Oct 1. 68% of affected orders are electronics > 5kg, which were reclassified to a slower service tier. Recommendation: renegotiate weight thresholds or add a secondary carrier for heavy parcels." Full citation of data sources and document references provided. |
| **Store Manager, Munich** | *"Which products should I reorder before the weekend?"* | Combines real-time inventory, demand forecast, supplier lead times, and upcoming local event data (Munich Oktoberfest spillover) to generate a prioritized reorder list with confidence levels. |
| **Supply Chain Analyst** | *"Show me all suppliers with lead time increases > 20% in the last 90 days"* | Queries across SAP procurement data, carrier transit data, and supplier scorecards to produce an interactive table with drill-down capability. |
| **Chief Compliance Officer** | *"Are we ready for the EU food safety audit next month?"* | Assesses traceability completeness across all food SKUs, flags the 3.2% still missing sub-tier supplier documentation, and generates a remediation task list. |

#### Discovery Agent (Proactive Insight Generation)

The Discovery Agent continuously monitors MCG's data and proactively surfaces anomalies:

- **Monday 06:00 UTC:** *"Unusual pattern detected: Inventory discrepancy between SAP and Oracle WMS for Rotterdam DC has been growing for 3 consecutive days. Current gap: 847 units across 42 SKUs. Likely cause: CDC pipeline for WMS Adjustment transactions has been producing partial loads since Friday. Recommended action: Escalate to data engineering team."*

- **Wednesday 14:30 UTC:** *"Emerging risk: Cold-chain temperature exceedance events in the Sao Paulo-to-Buenos Aires corridor increased 340% this week. 12 shipments currently in transit are affected. Spoilage model estimates $180K exposure. Recommended action: Reroute perishable shipments to air freight; notify DC Buenos Aires to prepare expedited receiving inspection."*

- **Thursday 09:00 UTC:** *"Opportunity identified: Carrier XpressBees in India has delivered 99.2% on-time for the past 60 days, outperforming current primary carrier (91.3%) at 15% lower cost per parcel. Recommendation: Increase allocation to XpressBees for Tier 2 cities."*

- **Friday 16:00 UTC:** *"Data quality alert: Trust Score for the APAC Product Catalog dataset dropped from 89 to 71 this week. Root cause: 340 new SKUs onboarded from the recent Meridian Express expansion in Thailand are missing category hierarchy mappings. Stewardship task auto-created and assigned to APAC Product Data team."*

#### MCP Server (Extensibility)

MCG's internal engineering team builds custom AI assistants using their preferred frameworks. The Qlik MCP Server exposes MCG's governed data products to these tools, ensuring that even custom-built AI applications work from the same trusted, governed data foundation.

---

## 4. Transformation Outcomes -- 12-Month Projection

| Metric | Before Qlik | After Qlik (12 mo.) | Impact |
|---|---|---|---|
| Inventory accuracy (ERP vs. physical) | 74% | 96% | -$31M in phantom inventory write-offs |
| Last-mile SLA compliance (global) | 82% | 94% | NPS +22 points; WISMO calls -55% |
| Fresh/grocery spoilage loss | $48M/year | $19M/year | $29M annual savings |
| Time to detect data pipeline failure | 4.3 days | < 15 minutes | 99.5% reduction |
| EU food traceability audit readiness | 88% of SKUs | 99.7% of SKUs | Regulatory compliance achieved |
| Analyst time spent on data prep | 70% | 20% | 3.5x more time for actual analysis |
| Store manager daily reconciliation | 45 min/day | 5 min (exception-only) | 760 hours saved daily across chain |
| Demand forecast accuracy (WMAPE) | 38% | 18% | Reduced safety stock by $85M |
| Time to answer board-level questions | 3-5 days (manual) | Real-time (conversational) | Strategic agility |
| Data quality Trust Score (avg.) | 61 | 91 | Foundation for AI readiness |

---

## 5. Qlik Product Stack -- Complete Mapping Summary

```
                    +-------------------------------------------------+
                    |           MCG USER EXPERIENCE LAYER              |
                    |                                                   |
                    |  Qlik Answers    Discovery Agent    Qlik Analytics   |
                    |  (Conversational) (Proactive Alerts) (Dashboards)|
                    +-------------------------------------------------+
                                         |
                    +-------------------------------------------------+
                    |              AI & PREDICTION LAYER               |
                    |                                                   |
                    |  Qlik AutoML     Qlik Predict    MCP Server     |
                    |  (Model Build)   (Embedded ML)   (Extensibility)|
                    +-------------------------------------------------+
                                         |
                    +-------------------------------------------------+
                    |          ANALYTICS ENGINE LAYER                  |
                    |                                                   |
                    |  Qlik Cloud Analytics (Associative Engine)       |
                    |  Data Products for Analytics                     |
                    +-------------------------------------------------+
                                         |
                    +-------------------------------------------------+
                    |            STORAGE LAYER                         |
                    |                                                   |
                    |  Qlik Open Lakehouse (Apache Iceberg)           |
                    |  + Snowflake / Athena / Spark access            |
                    +-------------------------------------------------+
                                         |
                    +-------------------------------------------------+
                    |        DATA QUALITY & GOVERNANCE LAYER           |
                    |                                                   |
                    |  Trust Score / Trust Score for AI                |
                    |  Data Catalog    Data Lineage    Data Stewardship|
                    |  Data Quality Rules & Profiling                  |
                    +-------------------------------------------------+
                                         |
                    +-------------------------------------------------+
                    |         DATA INTEGRATION LAYER                   |
                    |                                                   |
                    |  Qlik Talend Cloud (CDC, ETL/ELT, API, File)    |
                    |  Qlik Replicate (Real-Time Replication)          |
                    |  Pipeline Orchestration & Monitoring             |
                    +-------------------------------------------------+
                                         |
                    +-------------------------------------------------+
                    |              MCG SOURCE SYSTEMS                  |
                    |                                                   |
                    |  SAP | Oracle WMS | Manhattan | SFCC | Blue     |
                    |  Yonder | Kinaxis | Descartes | IoT Sensors    |
                    |  Shopify POS | Xstore | Carriers (42) | ...    |
                    +-------------------------------------------------+
```

---

## 6. Demo Walkthrough Script (Suggested Flow)

| Step | Duration | Qlik Product | Demo Action |
|---|---|---|---|
| 1 | 3 min | **Qlik Talend Cloud** | Show CDC pipeline from SAP capturing real-time inventory movements. Show pipeline monitoring dashboard -- highlight a simulated carrier SFTP delay triggering an alert. |
| 2 | 3 min | **Data Quality & Trust Score** | Profile a raw carrier data feed -- show the address anomalies and duplicate supplier records discovered automatically. Show Trust Score dashboard with historization trending upward. |
| 3 | 2 min | **Trust Score for AI** | Evaluate an ML training dataset. Show Diversity, Timeliness, and Accuracy dimensions. Flag the APAC data gap before it biases a model. |
| 4 | 2 min | **Qlik Open Lakehouse** | Show the Iceberg table catalog. Demonstrate multi-engine access: same inventory table queried from both Snowflake (BI) and Spark (ML). |
| 5 | 5 min | **Qlik Analytics** | Walk through the Supply Chain Command Center: global inventory health → drill to problem DC → last-mile carrier performance → spoilage risk map. Show associative discovery finding the Vietnam port connection. |
| 6 | 3 min | **Qlik AutoML / Predict** | Show the delivery delay prediction model. Open Qlik Analytics and show embedded ML predictions on in-transit shipments. Highlight model monitoring detecting drift. |
| 7 | 4 min | **Qlik Answers** | Ask natural language questions: "Why are Singapore SLAs declining?" Show the blended structured + unstructured answer with citations. Then: "Which Munich products need reorder before the weekend?" |
| 8 | 3 min | **Discovery Agent** | Show the proactive alert feed: pipeline failure detection, cold-chain risk, carrier opportunity, and Trust Score degradation -- all surfaced without anyone asking a question. |
| **Total** | **~25 min** | **Full Stack** | |

---

## 7. Key Talking Points for the Demo

1. **Data Quality is the Foundation, Not an Afterthought:** MCG's story proves that even the best analytics and AI are worthless on bad data. Qlik's approach puts quality and trust *first* -- profiling, rules, stewardship, and Trust Scores before a single dashboard is built.

2. **From Reactive to Proactive to Autonomous:** The journey moves from "we found out 4 days late" (before Qlik) → "we see it in real-time dashboards" (Qlik Analytics) → "the system tells us before we ask" (Discovery Agent) → "the system recommends the action" (Qlik Answers + AutoML).

3. **Open, Not Locked In:** Qlik Open Lakehouse on Apache Iceberg means MCG's data is accessible from any compute engine. Their Snowflake investment is preserved. The MCP Server means their custom AI tools can access governed data. No walled garden.

4. **Business Users, Not Just Data Teams:** Store managers get actionable insights (not raw data). Regional VPs get conversational answers (not reports). Analysts get clean data (not prep work). The CFO gets trustable forecasts (not best guesses).

5. **Compliance as a Byproduct:** When your data integration, lineage, and quality are handled properly, regulatory compliance (EU food safety, product traceability) becomes a natural output -- not a fire drill.

---

*Document prepared for Qlik End-to-End Platform Demo*
*Fictional company -- Meridian Commerce Group (MCG)*
*Version 1.0 -- February 2026*
