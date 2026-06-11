# MCG Full Stack Demo — Complete Setup Checklist

Master checklist of everything required to stand up the full Meridian Commerce Group demo on Qlik Cloud. Check off items as you go.

---

## Phase 1: Infrastructure & Data Sources

### Qlik Cloud Tenant
- [ ] Tenant provisioned on Qlik Cloud (US, EU, or AP region)
- [ ] Admin user created with Developer role
- [ ] API key generated (Profile > API keys > Generate new)
- [ ] Verify entitlements: Qlik Analytics, Qlik Cloud Data Integration, Qlik Answers, Qlik Predict, Automations

### PostgreSQL Database
- [ ] PostgreSQL instance running (Docker, RDS, or local)
- [ ] Database `mcg_wms` created
- [ ] User `mcg_admin` has SELECT + REPLICATION permissions (or create a dedicated read user)
- [ ] Logical replication enabled (`wal_level = logical` in postgresql.conf)
- [ ] Run simulator: `python simulators/postgres_simulator.py` — verify 3 tables created (`inventory_positions`, `warehouse_events`, `shipments`)
- [ ] Let simulator run for 10-15 minutes to seed initial data volume

### Apache Kafka (Confluent)

**Option A — Docker Compose (recommended for demos):**
- [ ] Docker Desktop installed and running
- [ ] Start Confluent stack: `cd infrastructure/kafka && docker compose up -d`
- [ ] Verify broker healthy: `docker compose ps` (should show `kafka` as healthy)
- [ ] Verify topics created: `docker compose exec kafka kafka-topics --bootstrap-server kafka:9092 --list`
- [ ] Control Center accessible at http://localhost:9021
- [ ] Note: deploy script prompts to start Docker automatically during deployment

**Option B — External Kafka cluster (Confluent Cloud, MSK, self-managed):**
- [ ] Kafka cluster running and accessible
- [ ] Create topics via standalone script: `python infrastructure/kafka/create_topics.py --bootstrap-servers your-broker:9092`
- [ ] Or create topics manually: `mcg.iot.cold-chain` (3 partitions, 7d retention) and `mcg.iot.carrier-events` (3 partitions, 30d retention)
- [ ] SASL credentials created for Qlik connector user

**Kafka IoT Simulator:**
- [ ] Install dependency: `pip install confluent-kafka`
- [ ] Run continuous: `python simulators/kafka_iot_simulator.py --bootstrap-servers localhost:9092`
- [ ] Or run scheduled (every 15 min): `python simulators/kafka_iot_simulator.py --bootstrap-servers localhost:9092 --scheduled --interval 900`
- [ ] Or single batch: `python simulators/kafka_iot_simulator.py --bootstrap-servers localhost:9092 --batch-only --batch-duration 60`
- [ ] Verify messages flowing in Control Center or via consumer

### Salesforce
- [ ] Salesforce Developer Edition org created (free at developer.salesforce.com)
- [ ] Custom object `MCG_Order__c` created with all fields (see `data_model.md` Section 3.2)
- [ ] Custom object `MCG_Product__c` created with all fields (see `data_model.md` Section 3.3)
- [ ] API user created with API Enabled permission
- [ ] Security token generated (Settings > Reset My Security Token)
- [ ] Run simulator: `python simulators/salesforce_simulator.py` — verify Contacts, Orders, Products populating
- [ ] Let simulator run for 10 minutes to seed initial records

---

## Phase 2: Qlik Cloud Connections & Spaces

### Spaces
- [ ] Create shared space: **"MCG Demo - Development"**
- [ ] Create managed space: **"MCG Demo - Published"**
- [ ] Create data space: **"MCG Data - Lakehouse"** (if using separate data space)

### Data Connections
- [ ] PostgreSQL connection created
  - [ ] Test connection successful
  - [ ] Tables visible: `inventory_positions`, `warehouse_events`, `shipments`
- [ ] Salesforce connection created via Standard connector
  - [ ] Test connection successful
  - [ ] Objects visible: `Contact`, `MCG_Order__c`, `MCG_Product__c`
- [ ] Kafka connection created via Data Gateway - Streaming
  - [ ] Test connection successful
  - [ ] Topics visible: `mcg.iot.cold-chain`, `mcg.iot.carrier-events`
- [ ] S3/Cloud Storage connection created (for Lakehouse target)
  - [ ] Test connection successful

---

## Phase 3: Open Lakehouse (Bronze / Silver / Gold)

### Bronze Layer — Raw Ingestion
- [ ] CDC pipeline: PostgreSQL → `bronze.inventory_positions` (real-time)
- [ ] CDC pipeline: PostgreSQL → `bronze.warehouse_events` (real-time)
- [ ] CDC pipeline: PostgreSQL → `bronze.shipments` (real-time)
- [ ] Connector pipeline: Salesforce → `bronze.sf_contacts` (15 min)
- [ ] Connector pipeline: Salesforce → `bronze.sf_orders` (15 min)
- [ ] Connector pipeline: Salesforce → `bronze.sf_products` (15 min)
- [ ] Streaming pipeline: Kafka → `bronze.iot_cold_chain` (streaming)
- [ ] Streaming pipeline: Kafka → `bronze.iot_carrier_events` (streaming)
- [ ] Verify all 8 Bronze tables have data flowing

### Silver Layer — Transformation Routes

> **Integration Capabilities:** Transformation Flows (visual Pipeline Designer), AI-Assisted SQL, Datamart Automation, Talend Job (address validation)

- [ ] Data flow: **Timestamp Normalization** → `silver.timestamps_audit`
- [ ] Data flow: **Inventory Reconciliation** → `silver.inventory_reconciled`
- [ ] Data flow: **Address Standardization** → `silver.customers_deduped`
- [ ] **Talend Job: Address Validation Service** — deployed as callable service (tAddressRowStandardize, tAddressRowValidate, tGeocode)
- [ ] Data flow: **Product Master Harmonization** → `silver.products_harmonized`
- [ ] Data flow: **Carrier Status Canonicalization** → `silver.shipments_canonical`
- [ ] Data flow: **IoT Telemetry Normalization** → `silver.iot_normalized`
- [ ] Data flow: **Supplier Master Dedup** → `silver.suppliers_deduped`
- [ ] Data flow: **Order-to-Delivery Timeline** → `silver.orders_enriched`
- [ ] Verify all 8 Silver tables have transformed data

### Gold Layer — Data Products
- [ ] Table recipe: `gold.supply_chain_health` (15 min refresh)
- [ ] Table recipe: `gold.last_mile_performance` (30 min refresh)
- [ ] Verify all 2 Gold tables have aggregated data

---

## Phase 3b: Lineage, Impact Analysis & Profiling

### Data Lineage
- [ ] Verify field-level lineage visible from source → Bronze → Silver → Gold
- [ ] Walk through lineage for `gold.supply_chain_health` (traces back to PostgreSQL CDC)
- [ ] Walk through lineage for `gold.last_mile_performance` (traces back to carrier shipment data)
- [ ] Verify data flow routes appear in lineage graphs

### Impact Analysis
- [ ] Test impact analysis on `silver.inventory_reconciled` → should show downstream Gold tables + apps
- [ ] Test impact analysis on a Bronze table → should show all Silver routes and Gold products affected
- [ ] Verify ML experiment dependencies appear in impact analysis

### Data Profiling
- [ ] Run profiling on `bronze.sf_contacts` → verify 11% format issues, 6% truncation detected
- [ ] Run profiling on `bronze.inventory_positions` → verify null lot numbers flagged for perishables
- [ ] Run profiling on `silver.products_harmonized` → verify missing weight_kg identified
- [ ] Capture profiling results for demo screenshots

### Trust Score
- [ ] Enable Trust Score on both Gold-layer data products
- [ ] Verify Trust Score dimensions: Validity, Completeness, Discoverability, Usage
- [ ] Enable Trust Score for AI (Accuracy, Diversity, Timeliness) if Enterprise edition
- [ ] Verify Trust Score drops visibly when pipeline failure is simulated (DC-RTD-01 scenario)
- [ ] Configure Trust Score historization for trend tracking

---

## Phase 4: Data Products & API Sharing

### Register Data Products (with AI-Driven Descriptions)
- [ ] "Supply Chain Health" registered with tags and owner (Henrik Jansen)
- [ ] "Last Mile Performance" registered (Sophie Müller)
- [ ] **AI-Driven Descriptions** — For each data product:
  - [ ] Click **Generate Description** to auto-create metadata from schema + sample data
  - [ ] Review and refine AI-generated product-level descriptions
  - [ ] Review AI-generated **column-level descriptions** for each field
  - [ ] Publish descriptions for Data Marketplace discoverability

### Semantic Types & AI-Suggested Validation Rules
- [ ] Review AI-detected semantic types on both data products (e.g., `dc_id` → Identifier, `ira_pct` → Percentage, `carrier` → Categorical)
- [ ] Confirm or override detected types for key columns (see `creation_guide.md` Section 2.2 for 10 examples)
- [ ] Review AI-suggested validation rules:
  - [ ] Range constraints (e.g., `ira_pct` between 0.0 – 1.0)
  - [ ] Pattern matching (e.g., `dc_id` matches `DC-[A-Z]{3}-\d{2}`)
  - [ ] Referential integrity (FK relationships)
  - [ ] Completeness rules (not-null for critical fields)
- [ ] Accept/modify/reject suggested rules
- [ ] Enable rule enforcement → violations route to Stewardship campaigns

### API Sharing (Governance Capability)
- [ ] API sharing enabled for "Supply Chain Health" (Discovery Agent, MCP Server, external dashboards)
- [ ] API sharing enabled for "Last Mile Performance" (Predict model training, partner portals)
- [ ] Test API endpoint returns data (curl or Postman)
- [ ] Verify API sharing maintains lineage, audit trails, and Trust Score visibility

### Data Marketplace
- [ ] Enable Data Marketplace on Gold-layer data products
- [ ] Verify both data products appear in self-service portal with AI-generated descriptions
- [ ] Test: business user can browse, search by tag, and request access to data products

---

## Phase 5: Analytics Apps (Qlik Analytics)

### Build or Import Apps (Domain-Based Design — 2 Apps)
- [ ] **MCG Supply Chain Operations** app created
  - Gold table: `supply_chain_health`
  - Streaming: `mcg.iot.cold-chain` via `silver.iot_normalized`, `mcg.iot.carrier-events` via `bronze.iot_carrier_events`
  - Sheets: Inventory Health, Cold Chain Monitoring (streaming), Pipeline Health
- [ ] **MCG Delivery & Customer Experience** app created
  - Gold table: `last_mile_performance`
  - Streaming: `mcg.iot.carrier-events` via `bronze.iot_carrier_events`, `silver.shipments_canonical`
  - Sheets: Last Mile Performance, Live Shipment Tracking (streaming), WISMO & Customer Impact, Address Quality Impact

### Qlik Answers & Business Logic (Agentic Analytics — GA Feb 2026)
- [ ] Configure Business Logic Logical Model in each app (define dimensions, measures, relationships)
- [ ] Configure Business Logic Vocabulary (map: "phantom" → phantom_count, "WISMO" → wismo_rate, "IRA" → ira_pct, etc.)
- [ ] Test Qlik Answers conversational analytics: "Show inventory accuracy by distribution center"
- [ ] Test multi-step agentic reasoning: "Which carriers miss SLAs most in APAC and what does the contract say?"
- [ ] Verify chain-of-thought reasoning blends structured data + unstructured documents
- [ ] Add Natural Language Insights (NLI) objects to key sheets (auto-generated narrative summaries)

### Section Access (Row-Level Security)
- [ ] Configure Section Access in MCG Supply Chain Operations app (regional VPs see only their DCs via REGION field)
- [ ] Configure Section Access in MCG Delivery & Customer Experience app (carrier partners see only their shipments via CARRIER field)
- [ ] Test with demo user accounts to verify data reduction works correctly

### Custom Theme & Extensions
- [ ] Upload MCG dark theme: `deploy/themes/mcg-dark-theme.zip` (Navy #1B2A4A, Teal #0D7C8F, Gold #C4922E, Inter font)
- [ ] Upload at tenant level: Administration → Themes → Upload
- [ ] Apply MCG Dark Theme to both analytics apps (App Settings → Theme)
- [ ] Verify MCG logo appears in app headers (mcg_logo.png, mcg_icon.png included in theme package)

### App Publishing
- [ ] Both apps published to "MCG Demo - Published" managed space
- [ ] Verify app reloads work on schedule (every 5 minutes for streaming data)
- [ ] Place .qvf export files in `deploy/apps/` directory (for automated re-deployment)

---

## Phase 5b: Native Alerting & Reporting

### Native Data Alerts
- [ ] Create alert: "IRA Below 85%" on MCG Supply Chain Operations app (triggers when IRA drops below 85% for any DC)
- [ ] Create alert: "WISMO Rate Spike" on MCG Delivery & Customer Experience app (triggers when WISMO > 40% for any carrier)
- [ ] Create alert: "Cold Chain Exceedance" on MCG Supply Chain Operations app (triggers on temperature > 8°C for 15+ min)
- [ ] Configure notification channels: web, email (push if mobile app installed)
- [ ] Share alerts with relevant team members
- [ ] Test alerts by simulating a pipeline failure / temperature exceedance

### Reporting Service
- [ ] Create PixelPerfect report template: "Weekly Compliance Summary" (PDF, banded layout)
- [ ] Create Tabular report template: "Daily Inventory Summary" (Excel export by DC)
- [ ] Configure subscription: Weekly compliance PDF emailed to regulatory team (Monday 08:00)
- [ ] Configure subscription: Daily inventory Excel emailed to DC managers (06:30 UTC)
- [ ] Test on-demand report: user sets selections in app → downloads formatted report

---

## Phase 6: Qlik Predict (AutoML)

### Model 1: Spoilage Risk Predictor
- [ ] Create ML experiment in Qlik Cloud
- [ ] Data source: `silver.iot_normalized`
- [ ] Target: `spoilage_risk_score` (regression)
- [ ] Features: max_temp_celsius, exceedance_minutes, humidity_avg, product_category, route_id, season
- [ ] Train model and select best performer
- [ ] Deploy model to production
- [ ] Enable API sharing for predictions

### Model 2: Delivery SLA Predictor
- [ ] Create ML experiment
- [ ] Data source: `gold.last_mile_performance`
- [ ] Target: `sla_met` (classification)
- [ ] Features: carrier, destination_region, address_quality_score, weight_kg, promised_sla_hours, day_of_week
- [ ] Train model and select best performer
- [ ] Deploy model to production
- [ ] Enable API sharing for predictions

---

## Phase 7: Qlik Answers

### Knowledge Base
- [ ] Create knowledge base: "MCG Operations Knowledge Base"
- [ ] Create datasource: "MCG Documents" (file type)
- [ ] Upload all 25 DOCX documents from `documents/` directory
- [ ] Verify upload count: 5 SOPs + 3 carrier contracts + 4 policies + 2 POs + 2 supplier comms + 1 recall + 1 shipping manifest + 2 incident reports + 2 training docs + 1 meeting minutes + 1 compliance plan + 1 project brief = 25
- [ ] Trigger sync/indexing
- [ ] Wait for indexing to complete (may take 5-10 minutes)

### Assistant
- [ ] Create assistant: "MCG Operations Assistant"
- [ ] Link to knowledge base
- [ ] Configure conversation starters (5 provided in config)
- [ ] Test each starter question and verify quality of answers

### Knowledge Mart (RAG Pipeline Automation)
- [ ] Create Knowledge Mart task to automate document vectorization and incremental loading
- [ ] Configure structured-to-document transformation for Gold-layer data (if applicable)
- [ ] Verify incremental sync keeps Qlik Answers grounded in fresh data
- [ ] Test: ask about data that was updated after initial indexing → verify Answers reflects latest

### Test Scenarios
- [ ] "What is the procedure for goods receiving?" → Should reference SOP-WH-001
- [ ] "What happened during the Rotterdam pipeline failure?" → Should reference INC-2025-04872
- [ ] "What are the cold chain temperature requirements?" → Should reference SOP-SC-002 and MCG-POL-012
- [ ] "What is Project CLARITY?" → Should reference PROJ-CLARITY-2025
- [ ] "What was the lettuce recall?" → Should reference RCL-2025-003

---

## Phase 8: Qlik Stewardship

### Campaigns
- [ ] **Address Cleanup** campaign created
  - Data source: `silver.customers_deduped`
  - Filter: `quality_score < 0.7`
  - Owner: Sophie Muller
- [ ] **Supplier Dedup** campaign created
  - Data source: `silver.suppliers_deduped`
  - Filter: `confidence < 0.9`
  - Owner: Thomas Berger
- [ ] **Missing Weights** campaign created
  - Data source: `silver.products_harmonized`
  - Filter: `weight_kg IS NULL OR weight_kg = 0`
  - Owner: Product Data Team
- [ ] **Lot Number Compliance** campaign created
  - Data source: `silver.inventory_reconciled`
  - Filter: `perishable = true AND lot_number IS NULL`
  - Owner: Quality Team

---

## Phase 9: Business Glossary

- [ ] Create glossary: "MCG Supply Chain Glossary"
- [ ] Import 25 terms from `deploy/glossary_terms.json` (via deploy script or manual)
- [ ] Verify terms across 5 categories:
  - [ ] Inventory & Warehouse (5 terms)
  - [ ] Supply Chain & Logistics (5 terms)
  - [ ] Data Quality & Governance (5 terms)
  - [ ] Compliance & Regulatory (5 terms)
  - [ ] Business Operations (5 terms)
- [ ] Link terms to relevant data products and datasets

---

## Phase 10: Automations

### Microsoft Teams Setup
- [ ] Teams incoming webhook URL obtained for `#mcg-cold-chain-alerts`
- [ ] Teams incoming webhook URL obtained for `#mcg-data-engineering`
- [ ] Teams incoming webhook URL obtained for `#mcg-customer-ops` (optional)

### Automation Configuration (see `automation_guide.md` for step-by-step)
- [ ] **MCG Daily App Reload** — configured and enabled
  - Schedule: Daily 06:00 UTC
  - Reloads both MCG analytics apps
- [ ] **MCG Cold Chain Alert → Teams** — configured and enabled
  - Schedule: Every 5 minutes
  - Posts Adaptive Card on temperature exceedance
- [ ] **MCG Pipeline Health Daily Summary → Teams** — configured and enabled
  - Schedule: Daily 07:00 UTC
  - Posts health summary to data engineering channel
- [ ] **WISMO Rate Alert → Customer Ops** — configured and enabled
  - Trigger: WISMO rate exceeds 40% for any carrier
  - Posts alert to `#mcg-customer-ops` channel
- [ ] **MCG Address Correction — Talend Job Trigger** — configured and enabled
  - Trigger: Stewardship task approved in Address Cleanup campaign (event or 15-min poll)
  - Runs Talend Address Validation Service (tAddressRowStandardize → tAddressRowValidate → tGeocode)
  - Writes corrected addresses back to `silver.customers_deduped`
  - Resolves stewardship tasks and posts results to Teams
  - Closes the data quality loop: Stewardship → Talend Job → Silver → Gold → Predict
- [ ] Test each automation with "Run Now" and verify Teams messages

---

## Phase 11: Discovery Agent

- [ ] Enable Discovery Agent on relevant data products
- [ ] Configure alert thresholds:
  - Trust Score drops below 0.70
  - Sync lag exceeds 60 minutes
  - Anomalous data volume (spike or drop > 50%)
- [ ] Verify Discovery Agent scenario: TransFrio spoilage detection
  - Trigger: temperature readings on GRU-BA route exceed 8C for 15+ min
  - Expected: Agent flags anomaly, links to spoilage risk data product

---

## Phase 12: MCP Server & Agentic AI

### MCP Server
- [ ] Generate API key: Qlik Cloud Profile → API Keys → Generate new key
- [ ] Add SSE MCP server to Claude Desktop config (`claude_desktop_config.json`):
  ```json
  { "mcpServers": { "qlik": { "url": "https://your-tenant.us.qlikcloud.com/api/ai/mcp", "headers": { "Authorization": "Bearer YOUR_API_KEY" } } } }
  ```
- [ ] Restart Claude Desktop — no local install required (cloud-hosted SSE endpoint)
- [ ] Test MCP connection: Ask Claude "Search my Qlik tenant for supply chain apps"
- [ ] Test data product query: Ask Claude "What is the current inventory accuracy at DC-RTD-01?"
- [ ] Verify MCP tool catalog: 71 tools across App Discovery, Lineage, Data Products, Business Glossary, and more

### Agentic Analytics (GA February 2026)
- [ ] Enable Agentic Analytics experience in Qlik Cloud (delivered via Qlik Answers)
- [ ] Test unified conversational interface: "Show me the inventory accuracy trend for Rotterdam, and what does the incident report say about it?"
- [ ] Verify agentic reasoning across structured data (Qlik engine) + unstructured documents (knowledge base)
- [ ] Confirm citations and explainability in Qlik Answers responses
- [ ] Test contextual side-panel assistant within Qlik Cloud hub

---

## Phase 13: Pre-Demo Verification

### Data Flow Health Check
- [ ] All 3 source simulators running (PostgreSQL, Kafka producer, Salesforce)
- [ ] All 8 Bronze tables receiving data
- [ ] All 8 Silver transformation routes executing successfully
- [ ] All 7 Gold table recipes refreshing on schedule
- [ ] No FAILED pipelines in the pipeline health view

### Component Verification
- [ ] Analytics apps load with data (no "missing data" errors)
- [ ] Qlik Answers responds to natural language questions with citations
- [ ] NLI objects display narrative summaries on key sheets
- [ ] Native data alerts trigger correctly on test conditions
- [ ] Reporting subscriptions deliver to email
- [ ] Qlik Answers returns coherent answers to test questions
- [ ] Predict models show predictions when queried
- [ ] Stewardship campaigns show records needing review
- [ ] Business glossary terms visible and linked
- [ ] Data Lineage traces field-level paths from source to Gold
- [ ] Trust Scores populated on Gold-layer data products
- [ ] Automations execute without errors
- [ ] Discovery Agent alerts populate
- [ ] MCP connection responds from Claude

### Demo Environment
- [ ] Browser logged into Qlik Cloud with demo user
- [ ] Teams channels visible with webhook test messages
- [ ] Presenter notes / scenario playbook printed (`deploy/scenarios.md`)
- [ ] Backup screenshots captured in case of connectivity issues

---

## File Inventory

Files generated for this demo:

| Category | File | Description |
|----------|------|-------------|
| **Documents** | `documents/**/*.docx` (25 files) | DOCX docs for Qlik Answers KB |
| **Presentation** | `MCG_Company_Profile_Data_Quality.pptx` | Executive overview deck |
| | `MCG_Demo_Overview_Four_Stories.pptx` | Demo deck: Integration, Governance, Analytics, AI |
| **Simulators** | `simulators/postgres_simulator.py` | PostgreSQL WMS data generator |
| | `simulators/salesforce_simulator.py` | Salesforce CRM data generator |
| | `simulators/kafka_iot_simulator.py` | Kafka IoT cold-chain & carrier event generator (continuous, scheduled, or batch) |
| **Infrastructure** | `infrastructure/kafka/docker-compose.yml` | Confluent Kafka stack (ZooKeeper, Broker, Schema Registry, Control Center) |
| | `infrastructure/kafka/.env` | Docker Compose environment defaults (version, ports) |
| | `infrastructure/kafka/create_topics.py` | Standalone topic creation for external Kafka clusters |
| **Deploy** | `deploy/deploy_qlik.py` | Python deployment automation script |
| | `deploy/config.example.json` | Template configuration |
| | `deploy/setup_guide.md` | 13-section Qlik Cloud setup guide |
| | `deploy/creation_guide.md` | Lakehouse, Data Products, Analytics Apps & Predict creation guide |
| | `deploy/scenarios.md` | 6 demo scenario playbooks |
| | `deploy/data_model.md` | Full data model reference |
| | `deploy/automation_guide.md` | Automation UI config instructions |
| | `deploy/demo_checklist.md` | This checklist |
| | `deploy/data_products.json` | 7 Gold-layer data product definitions |
| | `deploy/glossary_terms.json` | 25 business glossary terms |
| | `deploy/automations/teams_cold_chain_alert.json` | Teams alert template |
| | `deploy/automations/teams_pipeline_health.json` | Teams health summary template |
| **Theme** | `deploy/themes/mcg-dark-theme.zip` | MCG Dark Theme extension (ready to upload) |
| | `deploy/themes/mcg-dark-theme/theme.json` | Theme definition (Navy/Teal/Gold, Inter font) |
| | `deploy/themes/mcg-dark-theme/mcg-dark-theme.qext` | Extension manifest |
| | `deploy/themes/mcg-dark-theme/mcg_logo.png` | MCG logo for theme (dark variant) |
| | `deploy/themes/mcg-dark-theme/mcg_icon.png` | MCG icon for theme (square variant) |
| **Generators** | `generators/gen-mcg-logo.js` | MCG logo PNG generator (Inter font, brand colors) |
| | `generators/assets/mcg_logo_*.png` | 4 MCG logo variants (light, dark, square, large) |
| **Reference** | `MCG_Nightmare_to_Dataset_Map.md` | 7 nightmares mapped to datasets |
| | `MCG_Three_Data_Feeds.md` | PostgreSQL/Kafka/Salesforce specs |
| | `MCG_Talend_Transformation_Routes.md` | 8 transformation route specs |
| | `Meridian_Commerce_Group_Demo_Profile.md` | Company profile |
