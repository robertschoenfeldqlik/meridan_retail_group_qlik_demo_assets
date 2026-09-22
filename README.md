# Meridian Commerce Group — MCG Full Stack

A complete, deployable demo environment showcasing the full Qlik platform — from data ingestion and transformation through analytics, AI, and governance. Built around **Meridian Commerce Group (MCG)**, a fictional global logistics company facing seven real-world data quality challenges.

## What's Included

| Layer | Components |
|---|---|
| **Data Sources** | PostgreSQL WMS simulator, Kafka IoT sensors, Meridian CRM simulator |
| **Infrastructure** | Docker Compose stacks for Kafka (Confluent 7.7), PostgreSQL, and the Qlik Data Movement Gateway |
| **Deployment** | Automated scripts (Python + Node.js + Web UI) to provision a full Qlik Cloud tenant |
| **Analytics** | Dashboard mockups, Qlik theme, app definitions for Supply Chain & Delivery |
| **AI / NLP** | Qlik Answers knowledge base with 25 operational documents + AI assistant |
| **Governance** | Business glossary (25 terms), 2 Gold-layer data products, data lineage |
| **Data Pipelines** | Declarative QTCP pipeline (YAML) — bronze/silver/gold tasks imported via the DI Projects API |
| **Automations** | Teams alerting for cold-chain breaches and pipeline health |
| **Content Generation** | 18 Node.js generators for documents, presentations, SOPs, and glossaries |
| **Demo Scripts** | 13 guided walkthrough scripts covering every platform capability |

## Quick Start

```bash
# 1. Clone the repo (with DMG gateway submodule)
git clone --recurse-submodules <repo-url>
cd "MCG Full Stack"

# 2. Install Node.js dependencies (for generators and deploy UI)
npm install

# 3. Launch the deployment web UI
npm run ui

# 4. Open http://localhost:3939 in your browser
#    Configure your tenant, select components, and deploy.
```

### Alternative: CLI Deployment

```bash
# 1. Copy the example config and fill in your tenant details
cp deploy/config.example.json deploy/config.json
# (Windows PowerShell: Copy-Item deploy\config.example.json deploy\config.json)

# 2. Preview deployment without making changes
npm run deploy:dry-run

# 3. Run the full deployment
npm run deploy
```

## Project Structure

```
MCG Full Stack/
├── deploy/                     # Qlik Cloud deployment
│   ├── deploy-to-qlik.js       # Node.js deployer
│   ├── deploy-ui.js            # Web UI for deployment (port 3939)
│   ├── config.example.json     # Configuration template
│   ├── apps/                   # .qvf app files + HTML mockups
│   ├── automations/            # Teams alert JSON templates
│   ├── themes/                 # MCG dark theme (.zip + source)
│   ├── pipelines/              # Declarative QTCP pipeline project (YAML)
│   ├── zip-utils.js            # Zero-dependency ZIP create/extract
│   ├── data_products.json      # 2 Gold-layer data product definitions
│   └── glossary_terms.json     # 25 business glossary terms
│
├── generators/                 # Content generation scripts
│   ├── gen-demo-scripts.js     # 18 demo walkthrough documents
│   ├── gen-sops-enriched.js    # Standard operating procedures
│   ├── gen-carriers-enriched.js # Carrier contracts
│   ├── gen-architecture.js     # Technology architecture PPTX
│   ├── gen-demo-overview.js    # Demo overview presentation
│   ├── gen-glossary-excel.js   # Business glossary Excel
│   ├── generate-all.js         # Run all generators in order
│   └── ...                     # 12 more specialized generators
│
├── simulators/                 # Python data simulators
│   ├── postgres_simulator.py   # WMS inventory events
│   ├── kafka_iot_simulator.py  # Cold-chain sensors + carrier events
│   ├── mysql_crm_simulator.py # CRM data generation
│   └── seed_data.py            # Initial database population
│
├── infrastructure/             # Docker Compose configurations
│   ├── kafka/                  # Confluent Kafka 7.7 stack
│   ├── dmg/gateway/            # Qlik Data Movement Gateway (submodule)
│   ├── docker-compose.full-stack.yml
│   ├── docker-compose.full-stack-dmg.yml
│   ├── docker-compose.simulators.yml
│   ├── docker-compose.simulators-dmg.yml
│   └── docker-compose.dmg.yml
│
└── package.json
```

### Built assets live outside the repo

The decks and the document corpus are deliverables, not source: generated, never
hand-edited, and about 20 MB of binaries that churn on every run. They are
written to an **assets root** beside the repo rather than into it.

```
C:\Claude\MCG Demo\
├── MCG_Technology_Architecture.pptx     # 7 decks
├── MCG_Demo_Overview_Four_Stories.pptx
├── ...
└── documents/                            # 45 .docx + glossary .xlsx
    ├── carrier_contracts/                # DPD, FedEx, NinjaVan agreements
    ├── compliance/                       # NVWA corrective action plans
    ├── demo-scripts/                     # 18 guided demo walkthroughs
    ├── incident_reports/                 # Rotterdam, TransFrio incidents
    ├── policies/                         # Cold chain, data quality, shipping
    ├── sops/                             # WISMO, goods receiving, cycle count
    └── ...                               # training, purchase orders, recalls
```

One module decides that path — `generators/lib/asset-paths.js`. Override it with
`MCG_ASSETS_DIR` for a different machine or a CI run:

```bash
MCG_ASSETS_DIR=/srv/mcg-assets npm run generate
```

`deploy/config.json` → `documents.sourceDir` points the knowledge-base upload at
the same corpus; move one and move the other.


## npm Scripts

| Command | Description |
|---|---|
| `npm run ui` | Launch the deployment web UI on port 3939 |
| `npm run deploy` | Run the Node.js deployer (uses `deploy/config.json`) |
| `npm run deploy:dry-run` | Preview deployment without making changes (some read-only checks still occur) |
| `npm run deploy:verbose` | Run the Node.js deployer with detailed logging |
| `npm run deploy:export-pipeline` | Export the tenant's declarative pipeline project back into `deploy/pipelines/` |
| `npm run pipeline:zip` | Zip declarative pipeline project(s) for manual import |
| `npm run pipeline:template` | Verify the VS Code pipeline tooling; add `-- --schema <path>` to install the schema kit |
| `npm run build-apps` | Build analytics apps from JSON app definitions (`deploy/build-apps.js`) |
| `npm run build-apps:dry-run` | Preview app builds without making changes |
| `npm run build-automations` | Create/update automation scaffolds from templates |
| `npm run build-automations:dry-run` | Preview automation builds without making changes |
| `npm run generate` | Run all document/presentation generators |
| `npm run generate:list` | List available generators without running them |
| `npm run generate:docs` | Run only the `documents` generator group |
| `npm run generate:presentations` | Run only the `presentations` generator group |
| `npm run generate:demos` | Run only the `demos` generator group |
| `npm run docker:up` | Start full stack (Kafka + simulators) |
| `npm run docker:up:dmg` | Start full stack with DMG gateway |
| `npm run docker:up:kafka` | Start Kafka only |
| `npm run docker:up:simulators` | Start simulators only |
| `npm run docker:up:simulators-dmg` | Start simulators + DMG gateway |
| `npm run docker:up:dmg-only` | Start DMG gateway only |
| `npm run docker:down` | Stop the full-stack containers |
| `npm run docker:down:dmg` | Stop the full-stack + DMG containers |
| `npm run docker:status` | Show running container status |
| `npm run docker:logs` | Tail the last 50 lines of container logs |
| `npm run db:schema` | Load `simulators/schema.sql` into the Postgres container |
| `npm run db:seed` | Seed the Postgres container via `seed_data.py` |
| `npm run lint` | Syntax-check (`node -c`) the deploy/ scripts |

## Docker Infrastructure

### Simulator Stack (no gateway)
```bash
npm run docker:up
```
Starts: Kafka broker, ZooKeeper, Schema Registry, Control Center, PostgreSQL, PG simulator, Kafka IoT simulator.

### Full Stack + Data Movement Gateway
```bash
npm run docker:up:dmg
```
Adds: Qlik Data Movement Gateway container with PostgreSQL 15, MySQL 8.0, and SQL Server 2022. (Note: the standalone simulator stack above runs Postgres 16 on the `postgres:16-alpine` image, whereas this DMG co-located container ships Postgres 15.)

**Prerequisites for DMG:**
1. `git submodule update --init`
2. Download the Gateway RPM from [Qlik releases](https://github.com/qlik-download/saas-download-links/releases)
3. Place it as `infrastructure/dmg/gateway/rpmfiles/gateway.rpm`
4. Set `TENANT_URL` in `infrastructure/.env`

**Default credentials:**

| Service | User | Password | Port |
|---|---|---|---|
| PostgreSQL (simulator) | mcg_admin | mcg_demo_2025 | 5432 |
| PostgreSQL (DMG) | postgres | Qlik1234 | 5432 |
| MySQL (DMG) | root | Qlik1234 | 3306 |
| SQL Server (DMG) | sa | Qlik1234! | 1433 |
| Confluent Control Center | — | — | 9021 |

## Content Generators

All business documents, SOPs, carrier contracts, demo scripts, and presentations are generated programmatically from Node.js scripts. This ensures consistency and makes it easy to regenerate after changes.

```bash
# Generate everything
npm run generate

# Generate specific content
node generators/gen-demo-scripts.js     # 18 demo walkthroughs
node generators/gen-sops-enriched.js    # Standard operating procedures
node generators/gen-architecture.js     # Technology architecture deck
node generators/gen-glossary-excel.js   # Business glossary Excel
```

## Deployment Guide

See [`deploy/README.md`](deploy/README.md) for detailed deployment documentation, including:
- [Setup Guide](deploy/setup_guide.md) — Full environment setup
- [Creation Guide](deploy/creation_guide.md) — App and space creation
- [Demo Checklist](deploy/demo_checklist.md) — Pre-demo verification
- [Scenarios](deploy/scenarios.md) — Demo talking points
- [Automation Guide](deploy/automation_guide.md) — Teams alerts setup

## The MCG Story

Meridian Commerce Group is a fictional European logistics company operating 12 warehouses across 6 countries. The demo is structured around **seven data quality "nightmares"** that showcase Qlik's platform capabilities:

1. **The Phantom Inventory Problem** — A silent batch-job failure leaves SAP, WMS, and physical counts disagreeing for weeks
2. **The Address Catastrophe** — Inconsistent, truncated, and duplicate addresses across 5+ systems drive carrier rejections
3. **The Product Master Data Mess** — Three SKU schemes, mismatched category hierarchies, missing weights, and duplicate suppliers
4. **The Silent Pipeline Failures** — Integrations fail without alerts, going undetected for days on stale or partial data
5. **The Timestamp Tower of Babel** — 14 time zones and inconsistent timestamp conventions corrupt cross-system metrics
6. **The Carrier Data Black Hole** — 42 carriers with no standard status codes and only 58% real-time tracking visibility
7. **The Compliance Traceability Gap** — Broken farm-to-shelf lineage and unknown sub-tier suppliers stall food recalls

## License

MIT — See [LICENSE](LICENSE) for details.
