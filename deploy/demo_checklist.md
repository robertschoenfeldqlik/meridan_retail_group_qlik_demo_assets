# MCG End-to-End Demo — Complete Setup Checklist

Master checklist of everything required to stand up the full Meridian Commerce Group demo on Qlik Cloud. Check off items as you go.

---

## Phase 1: Infrastructure & Data Sources

### Qlik Cloud Tenant
- [ ] Tenant provisioned on Qlik Cloud (US, EU, or AP region)
- [ ] Admin user created with Developer role
- [ ] API key generated (Profile > API keys > Generate new)
- [ ] Verify entitlements: Qlik Sense, Talend Cloud, Qlik Answers, Qlik Predict, Automations

### Data Movement Gateway
- [ ] Download and install DMG on a VM or container with network access to PostgreSQL
- [ ] Register gateway in Qlik Cloud (Administration > Gateways)
- [ ] Verify gateway status shows "Connected" in the hub

### PostgreSQL Database
- [ ] PostgreSQL instance running (Docker, RDS, or local)
- [ ] Database `mcg_wms` created
- [ ] Read user `qlik_reader` created with SELECT + REPLICATION permissions
- [ ] Logical replication enabled (`wal_level = logical` in postgresql.conf)
- [ ] Run simulator: `python simulators/postgres_simulator.py` — verify 3 tables created (`inventory_positions`, `warehouse_events`, `shipments`)
- [ ] Let simulator run for 10-15 minutes to seed initial data volume

### Apache Kafka
- [ ] Kafka cluster running (Confluent Cloud, Docker, or local)
- [ ] Topic `mcg.iot.cold-chain` created (6 partitions recommended)
- [ ] Topic `mcg.iot.carrier-events` created (3 partitions recommended)
- [ ] SASL credentials created for Qlik connector user
- [ ] Optional: Run Kafka producer script from `MCG_Three_Data_Feeds.md` Section 2 to seed IoT data

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
- [ ] PostgreSQL connection created via DMG
  - [ ] Test connection successful
  - [ ] Tables visible: `inventory_positions`, `warehouse_events`, `shipments`
- [ ] Salesforce connection created via Standard connector
  - [ ] Test connection successful
  - [ ] Objects visible: `Contact`, `MCG_Order__c`, `MCG_Product__c`
- [ ] Kafka connection created via Remote Engine Gen2
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
- [ ] Data flow: **Timestamp Normalization** → `silver.warehouse_events_clean`
- [ ] Data flow: **Inventory Reconciliation** → `silver.inventory_reconciled`
- [ ] Data flow: **Address Standardization** → `silver.addresses_standardized`
- [ ] Data flow: **Product Master Harmonization** → `silver.products_harmonized`
- [ ] Data flow: **Carrier Status Canonicalization** → `silver.shipments_canonical`
- [ ] Data flow: **IoT Telemetry Normalization** → `silver.iot_telemetry_normalized`
- [ ] Data flow: **Supplier Master Dedup** → `silver.suppliers_deduped`
- [ ] Data flow: **Order-to-Delivery Timeline** → `silver.order_delivery_timeline`
- [ ] Verify all 8 Silver tables have transformed data

### Gold Layer — Data Products
- [ ] Table recipe: `gold.supply_chain_health` (15 min refresh)
- [ ] Table recipe: `gold.last_mile_performance` (30 min refresh)
- [ ] Table recipe: `gold.cold_chain_compliance` (5 min refresh)
- [ ] Table recipe: `gold.product_master_360` (1 hour refresh)
- [ ] Table recipe: `gold.customer_delivery_experience` (1 hour refresh)
- [ ] Table recipe: `gold.compliance_readiness` (1 hour refresh)
- [ ] Table recipe: `gold.operational_cost_impact` (daily refresh)
- [ ] Verify all 7 Gold tables have aggregated data

---

## Phase 4: Data Products & API Sharing

### Register Data Products
- [ ] "Supply Chain Health" registered with tags and owner (Henrik Jansen)
- [ ] "Last Mile Performance" registered (Sophie Muller)
- [ ] "Cold Chain Compliance" registered (Henrik Jansen)
- [ ] "Product Master 360" registered (Thomas Berger)
- [ ] "Customer Delivery Experience" registered (Lisa Park)
- [ ] "Compliance Readiness" registered (Maria Santos)
- [ ] "Operational Cost Impact" registered (CFO Office)

### API Sharing
- [ ] API sharing enabled for "Supply Chain Health"
- [ ] API sharing enabled for "Last Mile Performance"
- [ ] API sharing enabled for "Cold Chain Compliance"
- [ ] API sharing enabled for "Product Master 360"
- [ ] Test API endpoint returns data (curl or Postman)

---

## Phase 5: Analytics Apps (Qlik Sense)

### Build or Import Apps
- [ ] Supply Chain Health Dashboard (connect to `gold.supply_chain_health`)
- [ ] Last Mile Performance Dashboard (connect to `gold.last_mile_performance`)
- [ ] Cold Chain Monitoring Dashboard (connect to `gold.cold_chain_compliance`)
- [ ] Product Master 360 Dashboard (connect to `gold.product_master_360`)
- [ ] Customer Delivery Experience Dashboard (connect to `gold.customer_delivery_experience`)
- [ ] Compliance & Recall Readiness Dashboard (connect to `gold.compliance_readiness`)
- [ ] Executive Cost Impact Dashboard (connect to `gold.operational_cost_impact`)

### App Publishing
- [ ] All apps published to "MCG Demo - Published" managed space
- [ ] Verify app reloads work on schedule
- [ ] Place .qvf export files in `deploy/apps/` directory (for automated re-deployment)

---

## Phase 6: Qlik Predict (AutoML)

### Model 1: Spoilage Risk Predictor
- [ ] Create ML experiment in Qlik Cloud
- [ ] Data source: `gold.cold_chain_compliance`
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
  - Data source: `silver.addresses_standardized`
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
  - Reloads all MCG apps
- [ ] **MCG Cold Chain Alert → Teams** — configured and enabled
  - Schedule: Every 5 minutes
  - Posts Adaptive Card on temperature exceedance
- [ ] **MCG Pipeline Health Daily Summary → Teams** — configured and enabled
  - Schedule: Daily 07:00 UTC
  - Posts health summary to data engineering channel
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

## Phase 12: MCP Server (AI Agent Integration)

- [ ] Install Qlik MCP server: `npx @qlik/mcp-server`
- [ ] Set environment variables: `QLIK_TENANT_URL`, `QLIK_API_KEY`
- [ ] Configure Claude Desktop or Claude Code (see `setup_guide.md` Section 13)
- [ ] Test MCP connection: Ask Claude "List the spaces in my Qlik tenant"
- [ ] Test data product query: Ask Claude "What is the current inventory accuracy at DC-RTD-01?"

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
- [ ] Qlik Answers returns coherent answers to test questions
- [ ] Predict models show predictions when queried
- [ ] Stewardship campaigns show records needing review
- [ ] Business glossary terms visible and linked
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
| **Simulators** | `simulators/postgres_simulator.py` | PostgreSQL WMS data generator |
| | `simulators/salesforce_simulator.py` | Salesforce CRM data generator |
| **Deploy** | `deploy/deploy_qlik.py` | Python deployment automation script |
| | `deploy/config.example.json` | Template configuration |
| | `deploy/setup_guide.md` | 13-section Qlik Cloud setup guide |
| | `deploy/scenarios.md` | 6 demo scenario playbooks |
| | `deploy/data_model.md` | Full data model reference |
| | `deploy/automation_guide.md` | Automation UI config instructions |
| | `deploy/demo_checklist.md` | This checklist |
| | `deploy/data_products.json` | 7 Gold-layer data product definitions |
| | `deploy/glossary_terms.json` | 25 business glossary terms |
| | `deploy/automations/teams_cold_chain_alert.json` | Teams alert template |
| | `deploy/automations/teams_pipeline_health.json` | Teams health summary template |
| **Reference** | `MCG_Nightmare_to_Dataset_Map.md` | 7 nightmares mapped to datasets |
| | `MCG_Three_Data_Feeds.md` | PostgreSQL/Kafka/Salesforce specs |
| | `MCG_Talend_Transformation_Routes.md` | 8 transformation route specs |
| | `Meridian_Commerce_Group_Demo_Profile.md` | Company profile |
