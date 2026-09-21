# Meridian Commerce Group -- Slide Deck Content
## Qlik End-to-End Platform Demo Presentation

Use this content to build slides in PowerPoint, Google Slides, or Canva. Each section = one slide. Speaker notes included.

---

## SLIDE 1: Title Slide

**Title:** Meridian Commerce Group
**Subtitle:** Transforming a Global Retail Supply Chain with the Qlik Platform
**Tagline:** From data chaos to trusted intelligence -- an end-to-end journey
**Visual:** World map with dots on Rotterdam, Atlanta, Singapore, Sao Paulo

**Speaker Notes:**
Today we'll walk through the story of Meridian Commerce Group -- a fictional but deeply realistic global retailer. Their challenges mirror what we see across hundreds of enterprise customers: fragmented data, quality problems, and an inability to answer basic supply chain questions in real time. We'll show how the entire Qlik platform -- from integration to AI -- solves these problems end to end.

---

## SLIDE 2: Company Snapshot

**Layout:** Left side = key stats, Right side = world map with store locations

| | |
|---|---|
| **Founded** | 1987, Rotterdam, Netherlands |
| **Revenue** | $14.2B USD |
| **Employees** | 62,000 across 23 countries |
| **Stores** | 1,140 locations (Meridian Market + MCG Express) |
| **E-Commerce** | $3.8B online revenue, 38 countries |
| **Fulfillment** | 28 regional DCs, 6 mega-hubs |
| **Categories** | Home goods, electronics, apparel, grocery & fresh, health & wellness |

**Visual callouts on map:**
- Rotterdam (Global HQ)
- Atlanta (Americas HQ)
- Singapore (APAC HQ)
- Sao Paulo (LATAM HQ)

**Speaker Notes:**
Meridian is a $14 billion omni-channel retailer. Think of them as a company that grew from a European home goods chain into a global multi-category retailer through decades of acquisitions. They have a strong brick-and-mortar footprint AND a rapidly growing e-commerce business. Their brand promise is consistency -- whether you're in Amsterdam or Austin, the experience should be the same. That promise is under pressure.

---

## SLIDE 3: The Brand Promise

**Title:** "The Neighborhood Store with Global Reach"

**Three pillars (visual icons):**
1. **Consistent** -- Same experience in every channel, every country
2. **Personal** -- Know the customer, anticipate their needs
3. **Reliable** -- If we say it's in stock, it's in stock. If we say Tuesday delivery, it's Tuesday.

**Bottom callout (red):** That promise is breaking down.

**Speaker Notes:**
Meridian's entire brand is built on three pillars: consistency, personalization, and reliability. But by Q3 2025, all three were eroding. And the root cause wasn't a strategy problem or a people problem -- it was a data problem.

---

## SLIDE 4: The Wake-Up Call -- Q3 2025 Board Meeting

**Title:** Five Numbers That Changed Everything
**Layout:** Five large stat callouts, each with a red/warning indicator

| Metric | Value | Trend |
|---|---|---|
| Out-of-stock events | **+34% YoY** | European stores showing empty shelves while ERP says "in stock" |
| Last-mile SLA breaches | **22% in APAC** | Up from 8% -- customer NPS dropped 18 points |
| Spoilage losses | **$48M/year** | Cold-chain monitoring gaps in grocery & fresh |
| Food traceability gaps | **12% of SKUs** | EU regulatory audit citation -- can't trace product origins |
| WISMO calls | **41% of all CS contacts** | "Where is my package?" at $2.30 per call |

**Quote at bottom:**
> *"Why can't we see what's happening in our own supply chain?"*
> -- CEO Ingrid van der Berg

**Speaker Notes:**
At the Q3 board meeting, five metrics told the story. Shelves going empty despite the ERP saying there's plenty of inventory. Deliveries arriving late in APAC despite promises made at checkout. $48 million in spoiled groceries. A regulatory citation for not being able to trace food products back to their farm of origin. And 41% of all customer service calls being "where is my package?" The CEO asked a simple question: why can't we see what's happening? The answer turned out to be a data problem -- specifically, seven data quality nightmares.

---

## SLIDE 5: The Data Landscape

**Title:** 30 Years of Growth = A Tangled Data Estate
**Visual:** Spaghetti diagram or messy connection map showing all systems

**Key numbers in large font:**
- **47** distinct source systems
- **6** ERP instances
- **3** WMS platforms
- **2** POS systems
- **42** last-mile carriers
- **14** spreadsheet-based trackers
- **0** unified view of the supply chain

**System logos/names around the edges:**
SAP S/4HANA | Oracle WMS | Manhattan Associates | Meridian Storefront | Blue Yonder | Kinaxis | Descartes | Tive/Sensitech IoT | Shopify POS | Oracle Xstore | Snowflake | Legacy SQL Server | Excel/Google Sheets

**Speaker Notes:**
Three decades of acquisitions, organic growth, and digital transformation created this. 47 systems. Six ERP instances from different eras. Three warehouse management platforms that don't talk to each other. Two point-of-sale systems with different data models. 42 last-mile carriers, each with their own tracking format. And 14 rogue spreadsheets that became the de facto monitoring tools. No one has a single, trusted view of the supply chain. Let's look at the specific data quality nightmares this created.

---

## SLIDE 6: Nightmare #1 -- Phantom Inventory

**Title:** The Phantom Inventory Problem
**Visual:** Three boxes showing the same SKU at the same warehouse with different numbers

```
SAP ERP says:        Oracle WMS says:      Physical count:
   500 units            312 units              287 units
```

**Root cause:** A batch integration job between SAP and Oracle WMS failed silently on September 24. Inventory adjustments stopped syncing. No alert was generated. It went undetected for **3 weeks.**

**Business impact:**
- Store shelves go empty while the system shows "in stock"
- 34% increase in out-of-stock events
- $31M in phantom inventory write-offs
- Store managers spend 45 minutes every morning manually reconciling in spreadsheets

**Datasets affected:** Inventory Positions, Warehouse Operations, Purchase Orders, POS Transactions, Demand Forecasts, Financial/Cost Data

**Speaker Notes:**
This is the number one pain point. SAP says they have 500 units of this Bluetooth speaker in Rotterdam. The warehouse management system says 312. A physical count reveals 287. Why? A batch job failed three weeks ago and nobody noticed. SAP kept recording new receipts and sales deductions, but none of that ever reached the WMS. No alert fired. Multiply this by dozens of SKUs across multiple DCs, and you understand why shelves are empty while systems show green. Store managers have resorted to counting inventory by hand every single morning -- 855 hours of manual labor across the chain, every day.

---

## SLIDE 7: Nightmare #2 -- The Address Catastrophe

**Title:** 18.4 Million Addresses, Millions of Problems
**Layout:** Show example addresses side by side

**The same customer, stored 3 different ways:**

| System | address_line_2 | postal_code | country |
|---|---|---|---|
| Commerce Cloud | `Apartment 4B` | `1017 EJ` | `NL` |
| Meridian CRM | `Apt 4B` | `1017EJ` | `Netherlands` |
| Xstore POS | `#4B` | `1017 EJ` | `NL` |

**Key stats:**
- **11%** inconsistent formatting
- **6%** truncated street names (30-char legacy field limits)
- **3.2%** duplicate addresses with slight variations
- **4.7%** carrier rejection rate on first delivery attempt

**Business impact:**
- Re-routing delays add 1-3 days to delivery
- WISMO calls: 41% of all CS volume at $2.30/call
- NPS decline in every region

**Speaker Notes:**
Eighteen million customer addresses captured across five different systems with no standardization at the point of entry. The same apartment shows up as "Apartment 4B," "Apt 4B," and "#4B." Postal codes have inconsistent spacing. Country codes versus full country names. Legacy POS systems truncate German and Brazilian street names at 30 characters. The result? Carriers reject nearly 5% of addresses on first attempt. That's tens of thousands of failed deliveries every week, each one generating a customer service call and a delayed package.

---

## SLIDE 8: Nightmare #3 -- Product Master Data Mess

**Title:** One Product, Three Identities
**Visual:** Single product image (Bluetooth speaker) with three SKU cards

| | Global | Americas Legacy | EU Legacy |
|---|---|---|---|
| **SKU** | `MCG-4420` | `AM-BT-SPKR-001` | `EU-44200` |
| **Name** | Meridian Bluetooth Speaker | BT Speaker - Portable | Tragbarer Bluetooth-Lautsprecher |
| **Weight** | 0.45 kg | **null** | 0.45 kg |
| **Category depth** | 3 levels | 3 levels | **5 levels** |
| **GTIN** | 8710103944201 | **null** | 8710103944201 |

**Additional stats:**
- **8,200 products** missing weight/dimension data = shipping cost miscalculations
- **"Samsung"** appears as 4 different suppliers: Samsung Elec. / Samsung Electronics Co. / SAMSUNG / Samsung Corp
- Procurement thinks they spend $12M with Samsung. Reality: **$47M** (across all 4 records)

**Speaker Notes:**
Five acquisitions, zero master data management. The same physical Bluetooth speaker exists under three different SKU numbers, three different names, and in some cases different languages for the category hierarchy. Over 8,000 products are missing weight data, which means carrier rate lookups default to the highest bracket -- costing MCG over $4 million a year in shipping overcharges. And the supplier duplication is hiding their true spend -- they think Samsung is a $12 million relationship, but when you consolidate all four records, it's actually $47 million. That's a massive missed negotiation opportunity.

---

## SLIDE 9: Nightmare #4 -- Silent Pipeline Failures

**Title:** When Data Stops Flowing and Nobody Knows
**Visual:** Pipeline flow diagram with a red "X" break and a clock showing 4.3 days

**Key stats:**
- **23** pipeline failures per week
- **60%** auto-recover on retry
- **25%** fail silently -- no notification, data simply stops
- **15%** produce partial/corrupted data that propagates downstream
- **4.3 days** average time to detect a silent failure
- **2.1 days** additional time to remediate

**Example scenario:**
> The nightly SAP-to-Snowflake inventory batch job hangs at 2:14 AM. No error is thrown. No alert fires. For the next 4 days, every dashboard, report, and demand plan is built on stale data. A supply chain analyst notices "the numbers look off" on Thursday and files a ticket.

**Speaker Notes:**
This is the nightmare that amplifies every other nightmare. Twenty-three pipeline failures per week across MCG's patchwork integration layer. Sixty percent recover on their own, which gives a false sense of security. But 25% fail completely silently -- the job doesn't error, it just... stops. Data stops flowing and nobody notices for an average of four and a half days. During those four days, every decision is being made on stale data. And 15% of failures are even worse -- they produce partial data, so the reports look roughly right but are actually missing half the transactions. Management makes decisions based on 50% of reality.

---

## SLIDE 10: Nightmare #5 -- The Timestamp Tower of Babel

**Title:** 14 Time Zones, Zero Standards
**Visual:** World map with clocks showing different times, arrows pointing to a confused analyst

**The same event, recorded 4 ways:**

| System | Timestamp | Convention |
|---|---|---|
| Meridian CRM (order placed) | `2025-10-15T09:14:00Z` | UTC |
| Oracle WMS (picked) | `2025-10-15T14:22:47` | Local warehouse time, **no timezone indicator** |
| SAP (shipped) | `2025-10-15T15:30:00Z` | UTC |
| DPD carrier (delivered) | `2025-10-18T11:23:00+01:00` | Recipient local time with offset |

**Question:** How long did delivery actually take?
**Answer:** Depends who you ask and whether they remembered to convert timezones.

**Bonus chaos:** October 26, 2025 = EU daylight saving time change. Records spanning that date are off by 1 hour with no way to tell which convention was used.

**Speaker Notes:**
SAP stores everything in UTC. The warehouse management system uses local warehouse time -- and doesn't even include a timezone indicator. IoT sensors send UTC with millisecond precision, but the ETL truncates the milliseconds and drops the timezone marker. Carriers return timestamps in the recipient's local time. Try calculating order-to-delivery time across these four systems. It requires manual cross-referencing. Now throw in a daylight saving time transition and it gets even worse. This is why nobody trusts the delivery performance reports.

---

## SLIDE 11: Nightmare #6 -- The Carrier Data Black Hole

**Title:** 42 Carriers, 42 Different Languages
**Visual:** Table of carrier status codes for "Delivered"

| Carrier | "Delivered" Status |
|---|---|
| FedEx | `DELIVERED` |
| DHL | `delivered` |
| DPD (Germany) | `Zugestellt` |
| NinjaVan (APAC) | `Completed` |
| Correios (Brazil) | `Objeto entregue ao destinatário` |
| Local courier (Lagos) | `delivered ok` (from an email) |

**Additional pain points:**
- 7 carriers have **no API** -- they send daily CSV files via SFTP (sometimes late, sometimes not at all)
- One carrier sends **WhatsApp photos** of delivery receipts (not machine-readable)
- Real-time tracking visibility exists for only **58%** of in-transit packages
- Status codes, date formats, delimiters, and character encodings all vary per carrier

**Speaker Notes:**
Forty-two last-mile carriers across the globe. Each one has their own status taxonomy, their own date format, their own data delivery method. "Delivered" is expressed six different ways just in this sample. Seven carriers have no API at all -- they upload CSV files to an SFTP server, sometimes late, sometimes never. One carrier in Nairobi sends WhatsApp photos of delivery receipts. You cannot build a unified tracking view on this foundation. That's why only 58% of in-transit packages have real-time visibility, and why "where is my package?" is 41% of customer service calls.

---

## SLIDE 12: Nightmare #7 -- The Compliance Traceability Gap

**Title:** 11 Days to Answer a 24-Hour Question
**Visual:** Timeline showing the lettuce recall investigation

**The recall scenario:**
Contaminated lettuce traced to Farm FARM-NL-0042. EU regulation requires identifying all affected stores within **24 hours.**

**MCG's reality:**
- Day 1-2: Find batch in traceability database (exists for some SKUs)
- Day 3-5: 15% of grocery inventory has **no lot number** -- can't confirm or exclude
- Day 5-8: 30% of store-level receipt data is missing -- must manually call DCs who check paper manifests
- Day 8-11: Stores with untracked inventory pull ALL lettuce as precaution (2x waste)
- **Total: 11 days.** Regulatory citation issued.

**Key gaps:**
- 340 direct suppliers documented
- ~1,200 sub-tier suppliers **estimated but largely unknown**
- 12% of food SKUs have no traceable origin
- Traceability data lives in **4 separate systems** with no unified lineage

**Speaker Notes:**
This is the nightmare that keeps the Chief Compliance Officer up at night. EU food safety regulations require farm-to-shelf traceability. When contaminated lettuce was traced to a specific Dutch farm, MCG needed to identify every store that received that batch within 24 hours. It took 11 days. Why? Fifteen percent of grocery inventory has no lot number at all. Thirty percent of store-level receiving data is missing. Traceability data is scattered across four systems with no connection between them. And MCG doesn't even know who their sub-tier suppliers are -- the farms that grow the food that their processors send to their DCs. The regulatory citation was inevitable.

---

## SLIDE 13: The Human Cost

**Title:** These Are Not Just Data Problems -- They're People Problems
**Layout:** Four persona cards

**Persona 1: Store Manager (Munich)**
- Spends 45 min every morning reconciling inventory in a spreadsheet
- Across 1,140 stores = **855 hours of manual labor daily**
- Still can't trust the numbers

**Persona 2: Supply Chain Analyst**
- Spends 70% of time finding and cleaning data
- Only 30% on actual analysis
- "I'm a highly paid data janitor"

**Persona 3: Customer Service Agent**
- Toggles between 5 screens to answer "where is my package?"
- 41% of all calls are WISMO
- $2.30 per call, millions of calls per year

**Persona 4: Regional VP**
- Receives a weekly PowerPoint deck that's already stale
- Every region's report tells a different story
- "I don't trust any of these numbers"

**Speaker Notes:**
Let's make this human. The store manager in Munich starts every morning counting inventory because she can't trust the system. Multiply that by 1,140 stores. The supply chain analyst with a master's degree spends 70% of his time just finding and cleaning data. The customer service agent has to open five different screens to answer a simple tracking question. And the regional VP receives a PowerPoint deck every Monday that she knows is already wrong. These are smart, capable people spending their time working around data problems instead of solving business problems.

---

## SLIDE 14: The Transformation -- Enter Qlik

**Title:** One Platform. End to End. From Data Chaos to Trusted Intelligence.
**Visual:** The Qlik platform stack diagram

```
┌─────────────────────────────────────────────────────────────┐
│  EXPERIENCE LAYER                                            │
│  Qlik Answers | Discovery Agent | Qlik Analytics Dashboards     │
├─────────────────────────────────────────────────────────────┤
│  AI & PREDICTION LAYER                                       │
│  Qlik AutoML | Qlik Predict | MCP Server                    │
├─────────────────────────────────────────────────────────────┤
│  ANALYTICS ENGINE                                            │
│  Qlik Cloud Analytics (Associative Engine)                   │
│  Data Products for Analytics                                 │
├─────────────────────────────────────────────────────────────┤
│  STORAGE LAYER                                               │
│  Qlik Open Lakehouse (Apache Iceberg)                        │
├─────────────────────────────────────────────────────────────┤
│  DATA QUALITY & GOVERNANCE                                   │
│  Trust Score | Data Catalog | Lineage | Stewardship          │
├─────────────────────────────────────────────────────────────┤
│  DATA INTEGRATION                                            │
│  Qlik Talend Cloud (CDC, ETL/ELT, API, File)                │
│  Qlik Replicate | Pipeline Orchestration                     │
├─────────────────────────────────────────────────────────────┤
│  47 SOURCE SYSTEMS                                           │
│  SAP | Oracle WMS | Manhattan | SFCC | Blue Yonder | ...     │
└─────────────────────────────────────────────────────────────┘
```

**Speaker Notes:**
MCG selected Qlik as their strategic data platform partner. Not a point solution for one problem -- a platform that addresses every layer, from integration through governance, analytics, prediction, and AI-powered conversation. Let me walk you through each layer and how it resolves the nightmares we just discussed.

---

## SLIDE 15: Phase 1 -- Connect & Integrate

**Title:** Qlik Talend Cloud + Qlik Replicate
**Subtitle:** Replacing the patchwork with a unified integration platform

**Three key capabilities:**

**1. Real-Time CDC from ERP & WMS**
- Every SAP inventory adjustment streams in real-time
- Eliminates the batch lag that created phantom inventory
- Agentless = no performance impact on production systems

**2. Universal Source Connectivity**
- Pre-built connectors to SFCC, Blue Yonder, Kinaxis, Descartes, Shopify
- API integration for modern carriers + SFTP file monitors for legacy carriers
- All 42 carrier feeds ingested through one platform

**3. Pipeline Monitoring That Actually Works**
- Every pipeline has health checks and SLA tracking
- If Correios CSV doesn't arrive by 06:30 BRT, alert fires in < 1 minute
- Silent failures become impossible: detection drops from **4.3 days → < 15 minutes**

**Nightmares addressed:** #1 (Phantom Inventory), #4 (Silent Pipelines), #6 (Carrier Black Hole)

**Speaker Notes:**
Phase one is getting the data flowing reliably. Real-time change data capture from SAP and the WMS platforms means every inventory movement streams continuously -- no more nightly batches that can silently fail. Pre-built connectors handle the SaaS sources. The carrier chaos gets tamed by ingesting all 42 feeds through one platform -- webhooks, REST APIs, SOAP, SFTP files, all orchestrated centrally. And critically, pipeline monitoring replaces the hope-and-prayer approach. If a carrier file doesn't arrive on time, an alert fires in under a minute. The 4.3-day detection window becomes 15 minutes.

---

## SLIDE 16: Phase 2 -- Trust & Govern

**Title:** Qlik Talend Cloud -- Data Quality, Trust Score & Governance
**Subtitle:** Cleaning the data before it corrupts everything downstream

**Three key capabilities:**

**1. Automated Profiling**
- On first connect, Qlik profiles every source
- Automatically discovers: 11% address issues, 8,200 missing product weights, supplier duplicates
- No one had to write rules -- the platform found the problems

**2. Quality Rules + Standardization**
- Address normalization: "Apt 4B" / "Apartment 4B" / "#4B" → canonical form
- Supplier matching: "Samsung Elec." / "SAMSUNG" / "Samsung Corp" → single record
- Inventory reconciliation: ERP vs WMS gap > 2% triggers immediate flag

**3. Trust Score + Trust Score for AI**
- Every dataset gets a Trust Score: completeness, validity, timeliness, usage
- AI-specific dimensions: Diversity (bias detection), Timeliness (data freshness), Accuracy (business rule compliance)
- Trust Score Historization tracks improvement over time (72 → 96 for traceability data)

**Nightmares addressed:** #2 (Addresses), #3 (Product Master), #7 (Compliance)

**Speaker Notes:**
Phase two is where data quality happens. The platform automatically profiles every data source on first connect and discovers the problems -- the address formatting chaos, the missing product weights, the supplier duplicates. Then you apply standardization rules and matching algorithms. Fuzzy matching groups four Samsung records into one. Address normalization handles international formats. And the Trust Score gives every dataset a quantified grade. Not just for humans -- the Trust Score for AI adds dimensions specifically designed to validate whether data is ready for machine learning. You can track this over time: when the EU audit cited MCG for traceability gaps, their Trust Score for that dataset was 72. Six months later, it's 96.

---

## SLIDE 17: Phase 3 -- Store & Optimize

**Title:** Qlik Open Lakehouse
**Subtitle:** Open, fast, and cost-effective -- powered by Apache Iceberg

**Three key capabilities:**

**1. Unified Storage on Open Standards**
- Structured (ERP transactions), semi-structured (carrier JSON/XML), and IoT streams -- all in Iceberg tables
- No vendor lock-in. Open format. Portable.

**2. Multi-Engine Access**
- Same Iceberg tables queried from Snowflake (BI), Spark (ML), Athena (ad hoc)
- MCG's existing Snowflake investment is preserved
- Data science and BI teams share the same data, no duplication

**3. Real-Time + Cost Optimized**
- CDC streams flow continuously into Iceberg tables
- Automated compaction and partition optimization
- Projected **40% reduction in cloud compute spend**

**Speaker Notes:**
All that integrated, cleansed data needs to live somewhere. The Qlik Open Lakehouse built on Apache Iceberg gives MCG a unified, open-standard storage layer. Structured ERP data, carrier JSON feeds, and IoT sensor streams all land in the same place. And because it's Iceberg, MCG isn't locked in -- Snowflake, Spark, and Athena can all query the same tables. Their data science team uses Spark for model training. Their BI team uses Snowflake. Same data, zero duplication.

---

## SLIDE 18: Phase 4 -- Analyze & Visualize

**Title:** Qlik Cloud Analytics (Qlik Analytics)
**Subtitle:** From stale PowerPoints to real-time, interactive intelligence

**Four dashboard examples:**

**1. Global Inventory Health**
- Heat map of all 1,140 stores and 28 DCs
- Real-time ERP vs WMS vs physical count reconciliation
- Red/yellow/green replaces the morning spreadsheet ritual

**2. Last-Mile Delivery Performance**
- Live SLA tracking across 42 carriers and 38 countries
- Drill: Global → Region → Country → Carrier → Shipment
- The 22% APAC breach is visible as it develops

**3. Spoilage Risk Monitor**
- IoT temperature data + inventory age + demand forecast
- Flags at-risk items BEFORE they spoil
- Targeting the $48M annual loss

**4. Compliance Traceability Map**
- Visual product lineage: farm → processor → DC → store
- EU audit-ready at the click of a button

**Bonus: Associative Discovery**
- Analyst exploring late German deliveries discovers 78% trace to a Vietnamese sub-tier supplier whose port lead times increased -- a connection across 4 datasets nobody thought to query

**Nightmares addressed:** All seven -- this is the visibility layer

**Speaker Notes:**
Now the data is integrated, cleansed, and stored -- let's put it to work. The Qlik Analytics dashboards replace stale PowerPoint decks with real-time, interactive intelligence. The global inventory health map replaces the morning spreadsheet ritual. The last-mile dashboard shows SLA performance as it develops, not next week. And the Associative Engine is the secret weapon -- it lets analysts explore connections they didn't know existed. In the demo, an analyst investigating late German deliveries discovers that 78% trace back to a single sub-tier supplier in Vietnam whose port lead times increased. Four datasets, one click, an insight no one thought to look for.

---

## SLIDE 19: Phase 5 -- Predict & Act

**Title:** Qlik AutoML + Qlik Predict
**Subtitle:** From reactive dashboards to predictive intelligence

**Three ML models in production:**

**1. Delivery Delay Predictor**
- Predicts SLA breach probability for every in-transit shipment
- Inputs: carrier, route, weather, historical performance
- Proactive re-routing before the customer ever notices

**2. Spoilage Risk Scoring**
- Every fresh/grocery item scored based on cold-chain data, transit time, demand velocity
- HIGH risk items trigger markdown or redistribution recommendations
- Targeting $29M annual spoilage reduction

**3. Demand Forecast Accuracy**
- Trained on 3 years of sales, weather, promotions, and local events
- Code-free interface: supply chain analysts build models, not just data scientists
- Model drift monitored continuously -- auto-retrains for seasonal shifts

**Trust Score for AI validates every training dataset before model deployment**

**Nightmares addressed:** #1 (Inventory), #5 (Timestamps -- normalized for ML), #6 (Carrier -- standardized for ML)

**Speaker Notes:**
With trusted data, MCG can move from reactive to predictive. Three ML models: a delivery delay predictor that tells you which packages will be late before they're late, a spoilage risk model that scores every fresh item in every DC, and an improved demand forecast. The code-free AutoML interface means supply chain analysts build and iterate on these models, not just data scientists. And before any model goes into production, the Trust Score for AI validates the training data -- checking for bias, freshness, and accuracy. No model runs on bad data.

---

## SLIDE 20: Phase 6 -- Converse & Discover

**Title:** Qlik Answers + Discovery Agent (Agentic AI)
**Subtitle:** AI that works for you -- proactively, conversationally, with trust

**Qlik Answers (conversational):**

> **APAC VP asks:** "Why are our Singapore delivery SLAs declining?"
>
> **Qlik Answers responds:** "SLA performance in Singapore dropped 12% after NinjaVan's contract tier changed on Oct 1. 68% of affected orders are electronics > 5kg, reclassified to a slower service tier. Recommendation: renegotiate weight thresholds or add a secondary carrier."
>
> *Sources cited. Reasoning explained. Governed data.*

**Discovery Agent (proactive):**

> **Monday 06:00 UTC** -- "Inventory discrepancy at Rotterdam DC growing for 3 consecutive days. 847 units across 42 SKUs. Likely cause: CDC pipeline partial load since Friday."
>
> **Wednesday 14:30 UTC** -- "Cold-chain temperature exceedance on Sao Paulo-to-Buenos Aires route. 12 shipments affected. Spoilage model estimates $180K exposure."
>
> **Friday 16:00 UTC** -- "Trust Score for APAC Product Catalog dropped from 89 to 71. Root cause: 340 new SKUs from Thailand expansion missing category mappings."

**Speaker Notes:**
This is where the magic happens. Qlik Answers gives any user in the organization a conversational interface to their data. The APAC VP doesn't need to build a dashboard -- she asks a question in plain English, and the system combines structured data with carrier contract documents to give a blended answer with citations. The Discovery Agent goes further -- it doesn't wait to be asked. It continuously monitors data and proactively surfaces anomalies, risks, and opportunities. Monday morning it catches a pipeline issue. Wednesday afternoon it identifies a cold-chain risk. Friday it flags data quality degradation. This is the shift from passive reporting to proactive, embedded intelligence.

---

## SLIDE 21: The Transformation -- By the Numbers

**Title:** 12-Month Outcomes
**Layout:** Before/After comparison with arrows

| Metric | Before Qlik | After Qlik | Impact |
|---|---|---|---|
| Inventory accuracy | 74% | **96%** | -$31M in write-offs |
| Last-mile SLA compliance | 82% | **94%** | NPS +22 points |
| Spoilage loss | $48M/yr | **$19M/yr** | $29M saved |
| Pipeline failure detection | 4.3 days | **< 15 min** | 99.5% faster |
| Food traceability readiness | 88% | **99.7%** | Audit compliant |
| Analyst time on data prep | 70% | **20%** | 3.5x more analysis time |
| Store manager reconciliation | 45 min/day | **5 min** | 760 hours saved daily |
| Demand forecast error (WMAPE) | 38% | **18%** | $85M less safety stock |
| Board question response time | 3-5 days | **Real-time** | Strategic agility |
| Average data Trust Score | 61 | **91** | AI-ready foundation |

**Speaker Notes:**
Twelve months in, here are the results. Inventory accuracy from 74% to 96% -- $31 million in phantom inventory eliminated. Spoilage costs cut from $48 to $19 million. Pipeline failures detected in minutes, not days. Food traceability at 99.7%, fully audit-compliant. Supply chain analysts went from spending 70% of their time cleaning data to 20%, tripling their analytical capacity. And the average Trust Score across all datasets went from 61 to 91 -- a foundation that's not just good for BI, it's ready for AI.

---

## SLIDE 22: The Journey from Chaos to Intelligence

**Title:** Four Stages of Maturity
**Visual:** Ascending staircase or maturity curve

**Stage 1: Chaos (Before Qlik)**
- "We found out 4 days late"
- Manual reconciliation, stale reports, firefighting

**Stage 2: Visibility (Qlik Talend + Qlik Analytics)**
- "We can see it in real-time dashboards"
- Integrated data, quality rules, interactive analytics

**Stage 3: Proactive (Discovery Agent + Trust Score)**
- "The system tells us before we ask"
- Anomaly detection, proactive alerts, continuous quality monitoring

**Stage 4: Intelligent (Qlik Answers + AutoML + Predict)**
- "The system recommends the action"
- Conversational AI, predictive models, governed automation

**Speaker Notes:**
The journey MCG took is the journey every data-driven organization follows. From chaos to visibility -- that's integration and dashboards. From visibility to proactive -- that's Discovery Agent and Trust Score continuously monitoring. From proactive to intelligent -- that's Qlik Answers giving every employee a conversational interface, AutoML predicting problems before they happen, and the MCP Server allowing custom AI agents to work from the same governed foundation. Each stage builds on the one before. You can't predict on bad data. You can't converse with data you can't trust.

---

## SLIDE 23: Why Qlik -- The Full-Stack Differentiator

**Title:** One Platform, Not 10 Point Solutions

| Capability | Qlik Product | Alternative (What MCG Would Need Otherwise) |
|---|---|---|
| Real-time data integration | Qlik Talend Cloud + Replicate | Fivetran + Airbyte + custom scripts |
| Data quality & governance | Qlik Talend DQ + Trust Score | Informatica + Great Expectations + custom |
| Open lakehouse | Qlik Open Lakehouse | Self-managed Iceberg + Tabular |
| Analytics & visualization | Qlik Analytics / Qlik Cloud | Tableau or Power BI + custom data model |
| Machine learning | Qlik AutoML + Predict | DataRobot or SageMaker + glue code |
| Conversational AI | Qlik Answers | Custom RAG application + LLM orchestration |
| Proactive monitoring | Discovery Agent | Custom anomaly detection + alerting |
| Extensibility | MCP Server | Custom API layer |

**Key point:** Every layer is integrated. Trust Score flows into AI validation. Data Products feed Qlik Analytics AND Qlik Answers. CDC streams land in the Lakehouse AND trigger Discovery Agent alerts. **It's one platform, not 10 tools glued together.**

**Speaker Notes:**
The key differentiator is integration. MCG could have bought eight separate point solutions to address each layer. But every integration between point solutions is another potential failure point, another data copy, another governance gap. With Qlik, the Trust Score that validates data quality is the same Trust Score that validates AI training data. The CDC pipeline that feeds the lakehouse also triggers Discovery Agent alerts. The Data Products that serve dashboards also serve Qlik Answers. It's one platform. That's not a marketing statement -- for MCG, it's the difference between solving the problem and recreating it.

---

## SLIDE 24: Closing Slide

**Title:** Meridian Commerce Group + Qlik
**Subtitle:** From "Why can't we see?" to "We already knew."

**Three lines:**
- **Trusted data** -- because AI on bad data is just faster bad decisions
- **Proactive intelligence** -- because waiting for someone to ask the right question isn't enough
- **Open architecture** -- because your data belongs to you, not your vendor

**Call to action:** [Your CTA here -- e.g., "Let us show you what this looks like with YOUR data"]

**Speaker Notes:**
MCG's story started with a CEO asking why she can't see what's happening in her own supply chain. It ended with a platform that not only shows what's happening, but tells you what's about to happen and recommends what to do about it. The foundation is trusted data -- because AI on bad data is just faster bad decisions. The differentiator is proactive intelligence -- because waiting for someone to ask the right question isn't a strategy. And the architecture is open -- because your data should belong to you, not your vendor. That's the Qlik platform. Let me show you what this looks like with your data.

---

*Slide deck content for Meridian Commerce Group Qlik demo*
*24 slides, ~25 minute presentation*
*Version 1.0 -- February 2026*
