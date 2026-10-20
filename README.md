# Meridian Commerce Group — MCG Full Stack

A complete, deployable demo environment showcasing the full Qlik platform — from data ingestion and transformation through analytics, AI, and governance. Built around **Meridian Commerce Group (MCG)**, a fictional global logistics company facing seven real-world data quality challenges.

## What's Included

| Layer | Components |
|---|---|
| **Data Sources** | PostgreSQL WMS simulator, Kafka IoT sensors, Meridian CRM simulator |
| **Infrastructure** | Compose stacks (Podman on the reference host) for Kafka (Confluent 7.7), PostgreSQL, and the Qlik Data Movement Gateway |
| **Deployment** | Automated scripts (Python + Node.js + Web UI) to provision a full Qlik Cloud tenant |
| **Analytics** | Dashboard mockups, Qlik theme, app definitions for Supply Chain & Delivery |
| **AI / NLP** | Qlik Answers knowledge base with 25 operational documents + AI assistant |
| **Governance** | Business glossary (25 terms), 2 Gold-layer data products, data lineage |
| **Data Pipelines** | Declarative QTCP pipeline (YAML) — bronze/silver/gold tasks imported via the DI Projects API |
| **Automations** | Teams alerting for cold-chain breaches and pipeline health |
| **Content Generation** | 16 Node.js generators for documents, presentations, SOPs, and glossaries (`npm run generate:list`) |
| **Demo Scripts** | 18 guided walkthrough scripts covering every platform capability |

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
├── infrastructure/             # Compose configurations (Podman/Docker)
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

The decks, the document corpus and the videos are deliverables, not source:
generated, never hand-edited, and binaries that churn on every run. They live in
an **assets root**, `C:\Claude\MCG Demo`, which also holds this repo and the video
toolchain, so everything MCG sits in one folder:

```
C:\Claude\MCG Demo\
├── MCG Full Stack\                       # this repo
├── MCG Video Voiceover\                  # video toolchain and sources (series\, intro\)
├── 01_MCG_Company_Profile_1080p.mp4      # 5 videos, 01–05
├── ...
├── MCG_Technology_Architecture.pptx      # 7 decks
├── ...
└── documents\                            # 46 .docx + glossary .xlsx
    ├── carrier_contracts\                # DPD, FedEx, NinjaVan agreements
    ├── compliance\                       # NVWA corrective action plans
    ├── demo-scripts\                     # 18 guided demo walkthroughs
    ├── incident_reports\                 # Rotterdam, TransFrio incidents
    ├── policies\                         # Cold chain, data quality, shipping
    ├── reviews\                          # CEO review of the videos (kept out of the KB)
    ├── sops\                             # WISMO, goods receiving, cycle count
    └── ...                               # training, purchase orders, recalls
```

One module decides that path — `generators/lib/asset-paths.js`. It uses the
repo's parent when that folder is named `MCG Demo`, and a sibling `MCG Demo`
folder otherwise, so a clone beside the assets root works too. Override it with
`MCG_ASSETS_DIR` for a different machine or a CI run:

```bash
MCG_ASSETS_DIR=/srv/mcg-assets npm run generate
```

The knowledge-base upload reads the same corpus, so moving the assets root needs
no other change. Set `documents.sourceDir` in `deploy/config.json` only to point
at a different corpus. `documents/reviews/` is never uploaded: it reviews the
demo, it is not MCG content.

### Where each asset is uploaded

| Asset | Local | Uploaded to |
|---|---|---|
| Code, generators, deploy | `MCG Demo\MCG Full Stack` | GitHub, `main` |
| 7 decks | `MCG Demo\*.pptx` | GitHub release [`assets-2026-09-25`](https://github.com/robertschoenfeldqlik/meridan_retail_group_qlik_demo_assets/releases/tag/assets-2026-09-25) |
| 5 videos | `MCG Demo\*_1080p.mp4` | Same release |
| Document corpus | `MCG Demo\documents` | Same release, as `MCG_Documents.zip`, and the Qlik tenant (below) |
| Video generation assets | `MCG Demo\MCG Video Voiceover` | Same release, as `MCG_Video_Voiceover.zip` |

In the tenant, `npm run deploy` uploads every corpus `.docx` to the
`MCG Demo - Development` DataFiles folder `MCG Documents/`. The **MCG Operations
Knowledge Base** indexes them through two datasources: **MCG Documents** (the 25
operational documents) and **MCG Documents — Demo & Guides** (the 18 demo scripts
and the two guides). The deploy does not manage the second one, so a new demo
script has to be added to it by hand.

The release is a snapshot. After regenerating, replace the changed files:

```bash
gh release upload assets-2026-09-25 <files> --clobber
```

`MCG_Video_Voiceover.zip` leaves out the capture browser profile
(`series/.qlik-profile`, which holds a Qlik login), `.claude/settings.local.json`,
`__pycache__`, and the ffmpeg intermediates in `series/work`, which
`build_video.py` rewrites on every run.


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
| `npm run engine` | Show the resolved container engine and compose provider; non-zero if either is missing |
| `npm run docker:up` | Start full stack (Kafka + simulators). Alias: `stack:up` |
| `npm run docker:up:dmg` | Start full stack with DMG gateway. Alias: `stack:up:dmg` |
| `npm run docker:up:kafka` | Start Kafka only |
| `npm run docker:up:simulators` | Start simulators only |
| `npm run docker:up:simulators-dmg` | Start simulators + DMG gateway |
| `npm run docker:up:dmg-only` | Start DMG gateway only |
| `npm run docker:down` | Stop the full-stack containers. Alias: `stack:down` |
| `npm run docker:down:dmg` | Stop the full-stack + DMG containers |
| `npm run docker:status` | Show running container status. Alias: `stack:status` |
| `npm run docker:logs` | Tail the last 50 lines of container logs. Alias: `stack:logs` |
| `npm run db:schema` | Load `simulators/schema.sql` into the Postgres container |
| `npm run db:seed` | Seed the Postgres container via `seed_data.py` |
| `npm run lint` | Both checks below — the one command CI runs |
| `npm run lint:syntax` | `node -c` every `.js` in the repo (walks the tree; no file list to drift) |
| `npm run lint:app-fields` | Prove every app measure/dimension names a field a load script actually creates — a mismatch reads as zero in Qlik, with no error. Add `-- --list` to print the available field names |
| `npm run deploy:qvd` | Deploy in QVD mode (analytics read uploaded QVDs; no gateway needed) |
| `npm run deploy:gateway` | Deploy in gateway mode (analytics read live Postgres/MySQL via the DMG) |
| `npm run data:qvd` | Regenerate the lakehouse CSVs, upload them, and repoint the load scripts at QVDs |
| `npm run talend:zip` / `:dry-run` | Build the Talend job import package |
| `npm run stewardship:sprint` | Run a data-stewardship sprint against the tenant (`:dry-run`, `:list`) |
| `npm run automations:workspaces` | Create the automation workspaces and the API Key connection (`:dry-run`) |
| `npm run screenshots` | Capture tenant screenshots with Puppeteer (`:login` to sign in first, `:report` for the summary) |
| `npm run db:crm` | Open a MySQL shell on the CRM container |
| `npm run review:video` | Score the videos against the rubric and publish the CEO review (`:dry`, `:replay`) |

## Container Infrastructure

### Container engine — Podman

Docker Desktop is **not** installed on the reference host. The stacks run on
**Podman** (5.8.x), with the standalone **Docker Compose v2 CLI** as the compose
provider — `podman compose` delegates to it, and that binary ships on its own,
independent of Docker Desktop.

Nothing calls `docker` directly. Every stack command goes through
`deploy/compose.js` → `deploy/container-engine.js`, which probes for
`podman` then `docker`, falls back to the known install paths when the parent
shell's PATH predates the install, and points `DOCKER_HOST` at Podman's
Docker-compatible socket when it has to drive the compose binary itself.

Check what it resolved:

```bash
npm run engine
```

```
engine:    podman (podman version 5.8.3)
binary:    podman
compose:   podman compose
```

It exits non-zero if either the engine or a compose provider is missing, so it
works as a pre-flight check. Force a specific engine with
`MCG_CONTAINER_ENGINE=podman` (or `docker`).

The `docker:*` script names are kept for compatibility — they are engine-neutral
despite the name. `stack:up`, `stack:up:dmg`, `stack:down`, `stack:status` and
`stack:logs` are aliases for the five you actually type. Do **not** run
`docker compose` or `podman compose` by hand: the stacks use `include:`,
`depends_on.condition` and profiles, which `podman-compose` (the Python one)
does not implement faithfully.

**Podman prerequisites on Windows:** WSL 2.7+ with systemd, an initialised
rootful machine (`podman machine init --rootful`), and the compose CLI
(`winget install Docker.DockerCompose`).

### Simulator Stack (no gateway)
```bash
npm run docker:up        # or: npm run stack:up
```
Starts: Kafka broker, ZooKeeper, Schema Registry, Control Center, PostgreSQL, PG simulator, Kafka IoT simulator.

### Full Stack + Data Movement Gateway
```bash
npm run docker:up:dmg    # or: npm run stack:up:dmg
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

Meridian Commerce Group is a fictional European logistics company. The demo is structured around **seven data quality "nightmares"** that showcase Qlik's platform capabilities:

1. **The Phantom Inventory Problem** — A silent batch-job failure leaves SAP, WMS, and physical counts disagreeing for weeks
2. **The Address Catastrophe** — Inconsistent, truncated, and duplicate addresses across 5+ systems drive carrier rejections
3. **The Product Master Data Mess** — Three SKU schemes, mismatched category hierarchies, missing weights, and duplicate suppliers
4. **The Silent Pipeline Failures** — Integrations fail without alerts, going undetected for days on stale or partial data
5. **The Timestamp Tower of Babel** — 14 time zones and inconsistent timestamp conventions corrupt cross-system metrics
6. **The Carrier Data Black Hole** — 42 carriers with no standard status codes and only 58% real-time tracking visibility
7. **The Compliance Traceability Gap** — Broken farm-to-shelf lineage and unknown sub-tier suppliers stall food recalls

### The company profile vs. what is in the tenant

The nightmares above describe MCG the **business**: 28 distribution centres, 42
carriers, 1,140 stores, 38 countries. Those figures live in the narrative
documents and the decks, and they are what an executive hears.

The data loaded into the tenant is a **sample of that estate**, and it is
deliberately smaller so a demo reloads in seconds:

| | Company profile | In the tenant |
|---|---|---|
| Distribution centres | 28 | **12** (NL, DE, FR, ES, IT, PL) |
| Carriers | 42 | **6** (DPD, DHL, FedEx, GLS, NinjaVan, TransFrio) |
| SKU positions | — | 45,000 |
| Contacts / orders | — | 20,000 each |

Say "28 DCs" over a chart that shows 12 and the room notices. The app and data
product descriptions quote the **tenant** figures; the business case documents
quote the company profile. Both are correct — they are answering different
questions.

Two separate DC sets also exist across the two data paths: the QVD/lakehouse
path (`deploy/mockdata/gen-lakehouse-csv.js`) ships the 12 European centres
above, while the live Postgres/Kafka simulators ship 9 global ones
(`DC-RTD-01`, `DC-ATL-01`, `DC-SIN-01` …). Only `DC-RTD-01` — Rotterdam, the
hero of nightmares #1 and #4 — exists in both, which is why every scripted
walkthrough uses Rotterdam.

## License

MIT — See [LICENSE](LICENSE) for details.
