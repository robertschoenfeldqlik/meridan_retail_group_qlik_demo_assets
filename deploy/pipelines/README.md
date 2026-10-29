# Declarative Data Pipelines (QTCP Preview)

The MCG bronze → silver → gold flow, defined as **declarative YAML** (Qlik Talend Cloud Pipelines internal preview) in **three projects**, deployed automatically as **Step 13** of `npm run deploy` (or `npm run deploy:integration`).

## What gets deployed

All three are `DATA_PIPELINE` projects. Two run on Qlik Open Lakehouse, one on Snowflake. An Open Lakehouse project can only hold landing, storage and mirror tasks for CDC sources. The tenant rejects TRANSFORM and DATAMART there (`DATA-APP-DESIGN-IMPORT-PROJECT-NOT-SUPPORTED-APP`). So silver and gold live in a Snowflake project that reads the lakehouse through a zero-copy mirror. Streaming is the exception: its transform runs inside the lakehouse.

The deployer imports the Open Lakehouse projects first. The Snowflake project reads the mirrors of **MCG Supply Chain Pipeline - CDC** (`olh-mcg-demo-cdc/`, built in the UI) through the binding `project.MCG Demo - DI$_$MCG Supply Chain Pipeline - CDC.projectId`; the deployer looks that project up by name in that space and stops before the import, with the name it could not find, if it does not exist. Each project deploys under the `projectName` in its `bindings.json` unless `config.json → pipelines.projects` names it.

### `mcg-batch-pipeline/`: MCG Batch Pipeline, Open Lakehouse (4 tasks)

| Task | Type | Source → Target | Schedule (one per task) |
|---|---|---|---|
| MCG WMS CDC Landing | `LAKE_LANDING` | PostgreSQL CDC (3 tables) → `landing` (CSV on the S3 landing bucket) | Continuous CDC (started, not scheduled) |
| MCG CRM Landing | `LAKE_LANDING` | MySQL CDC (crm_contacts, crm_orders, crm_products) → `landing` | Every 15 min |
| MCG Lakehouse Storage | `LAKEHOUSE_STORAGE` | landing → `bronze` as Apache Iceberg, on the CDC cluster | Started by the deployer (mini-batches every minute) |
| MCG Snowflake Mirror | `LAKEHOUSE_MIRROR` | bronze Iceberg → Snowflake external Iceberg tables (zero-copy) | Event: any input task |

### `mcg-snowflake-pipeline/`: MCG Supply Chain Pipeline - Transform, Snowflake (2 tasks)

| Task | Type | Source → Target | Schedule (one per task) |
|---|---|---|---|
| MCG Silver Transform | `TRANSFORM` | the CRM and WMS mirrors in `MCG Supply Chain Pipeline - CDC` (cross-project) → `silver` (7 datasets) | Event: any input task |
| MCG Gold Transform | `TRANSFORM` | silver → `gold` (2 SQL datasets, published to the catalog) | On demand (no schedule) |

### `mcg-streaming-pipeline/`: MCG Streaming Pipeline, Open Lakehouse (2 tasks)

| Task | Type | Source → Target | Schedule (one per task) |
|---|---|---|---|
| MCG IoT Streaming Landing | `STREAMING_LAKE_LANDING` | Kafka `mcg.iot.*` topics → `bronze` | Streaming (started, not scheduled) |
| MCG IoT Streaming Transform | `STREAMING_TRANSFORM` | bronze IoT → `silver` (1 dataset) as Iceberg, on the Streaming cluster | Event: any input task |

The Kafka brokers must be reachable from the VPC of the network integration that runs the streaming cluster. A broker on a laptop is not.

### Schemas

| Layer | Where | Schema |
|---|---|---|
| Raw landed CSV | S3 landing bucket | `landing` |
| Bronze | Open Lakehouse, Iceberg | `bronze` |
| Bronze (mirror) | Snowflake | `bronze` |
| Silver / Gold | Snowflake | `silver` / `gold` |

The deployer sets each binding variable from `config.json`:
- connections: `dataConnections.*`, including `dataConnections.snowflake`;
- clusters: `clusters.cdc` and `clusters.streaming`;
- Snowflake objects: `snowflake.database`, `warehouse`, `mirrorExternalVolume`, `catalogIntegration` and `icebergExternalVolume`.

### Conformance (validated against the preview schema kit)

- Task **folder names equal task names** exactly (e.g. `qtcp_tasks/MCG Silver Transform/`)
- **One schedule per task** (preview rule) — the gold daily run covers the daily-refresh requirement; silver cascades on landing events
- Each project ships the **rule-of-three bindings pair**: `qtcp_bindings_definition.json` (registry) + `bindings.json` (environment values, `{{id(connection, Space.Name)}}` lookups — the deployer overrides these via the bindings API at deploy time)
- `inputDatasets` reference upstream data by **`datasetId` + `taskId`**; IDs are stable contracts and never change
- Delta-only YAML, no comments, `<slug>-<suffix>` task IDs

## End-to-end deployment API map

Everything Step 13 (and the deploy UI) does on the integration side, with the verified Qlik Cloud REST endpoints:

| Stage | Endpoint | Notes |
|---|---|---|
| Create connections | `POST /api/v1/data-connections` (after `GET /api/v1/data-sources` discovery) | PostgreSQL / MySQL / Kafka source connections; idempotent by name |
| Validate definitions | `POST /api/v1/di-projects/utils/actions/validate-project-definitions` | Preview utility — multipart ZIP; soft-skips if the tenant lacks it |
| Create project | `POST /api/v1/di-projects` | `type: DATA_PIPELINE`, `platformType: QLIK_OPEN_LAKEHOUSE` |
| Upload pipeline | `POST /api/v1/di-projects/{id}/actions/import` | Multipart ZIP of this YAML project; 202 actions polled via `GET /api/v1/di-projects/actions/{actionId}` |
| Resolve bindings | `GET` / `PUT /api/v1/di-projects/{id}/bindings` | Connection IDs, schemas, clusters, warehouse — resolved from `config.json` |
| Prepare | `POST /api/v1/di-projects/{id}/actions/prepare` | Creates physical lakehouse artifacts (`pipelines.prepare: true`) |
| Run | `POST /api/v1/di-projects/{id}/di-tasks/{taskId}/runtime/actions/start` | Started in dependency order: landing → transform → datamart (`pipelines.run: true`); 409 = already running |
| Schedule daily | — (no REST endpoint) | Schedules are **declared in YAML** (`qtcp_tasks/*/schedule.yaml`, RFC-5545 RRULE) and activate when tasks start |
| Attach datasets | `PATCH /api/data-governance/data-products/{id}` (JSON-Patch `replace /datasetIds`) | Gold catalog datasets resolved via `GET /api/v1/items?resourceType=dataset` (fallback `GET /api/v1/data-sets`); `pipelines.attachDatasets` |
| Publish products | `POST /api/data-governance/data-products/{id}/actions/activate` | Makes products discoverable in the marketplace (`pipelines.publishDataProducts: true`) |
| Export (round-trip) | `POST /api/v1/di-projects/{id}/actions/export` | `npm run deploy:export-pipeline` syncs UI edits back to this repo |

## Transformation content (datasets)

The silver/gold logic from the creation guide is encoded declaratively in each task's `datasets/` folder:

| Dataset | Task | Technique | Implements |
|---|---|---|---|
| `inventory_reconciled` | silver-transform | `CUSTOM` SQL | UoM + storage-zone standardization (KALT/FROID → CHILLED…), phantom-inventory + negative-qty flags, lot compliance, 0.1–1.0 trust score (Nightmares #1/#3/#7) |
| `warehouse_events_clean` | silver-transform | `CUSTOM` SQL | event_type canonicalization (RCV/INBOUND_RECEIPT → RECEIVE…), bin-format normalization, per-DC timezone → UTC timestamps (Nightmare #5) |
| `shipments_canonical` | silver-transform | `CUSTOM` SQL | 6-carrier status vocabularies (EN/DE/PT) → 6 universal stages, country → ISO codes, lbs → kg, delivered-without-timestamp flag (Nightmares #2/#6) |
| `addresses_standardized` | silver-transform | `CUSTOM` SQL | City/state/postal/country normalization, 0–1 address quality score (Nightmare #2) |
| `products_harmonized` | silver-transform | `CUSTOM` SQL | Legacy SKU columns retained for resolution, weight imputation via category average (window fn), supplier canonicalization, origin-compliance flag (Nightmares #3/#7) |
| `suppliers_deduped` | silver-transform | `CUSTOM` SQL | Canonical supplier rollup with variant counts |
| `order_delivery_timeline` | silver-transform | `CUSTOM` SQL | Orders ⋈ shipments lifecycle, late-delivery + days-late + WISMO metrics (Nightmare #4) |
| `iot_normalized` | iot-streaming-transform | Column expressions | °F → °C conversion, GPS-gap / unregistered-sensor / low-battery flags (streaming-safe, no custom SQL) |
| `supply_chain_health` | gold-datamart | `CUSTOM` SQL | Per-DC inventory accuracy KPIs + cycle-count variance |
| `last_mile_performance` | gold-datamart | `CUSTOM` SQL | Per-carrier/country SLA, on-time rate, WISMO rate, address quality |

SQL is written as portable ANSI (CASE/COALESCE/window functions); the lakehouse engine compiles it at prepare time. If an expression needs dialect tweaks, fix it in the QTCP UI and run `npm run deploy:export-pipeline` to round-trip the correction back here.

Environment-specific values (connection IDs, schemas, lakehouse clusters, warehouse) are **never hardcoded** — they are `{{binding}}` variables declared in `qtcp_bindings_definition.json`. At deploy time, Step 13:

1. Zips each project under `pipelines/` (pure-Node, no dependencies — see `../zip-utils.js`)
2. Pre-validates via `POST /api/v1/di-projects/utils/actions/validate-project-definitions` (skipped gracefully if the tenant doesn't expose the preview endpoint)
3. Creates or reuses the DI project (`POST /api/v1/di-projects`)
4. Imports the ZIP (`POST /api/v1/di-projects/{id}/actions/import`)
5. Resolves bindings from `config.json` — connection names from `dataConnections.*` are looked up on the tenant and bound by ID, schemas follow the medallion convention (landing→`bronze`, transform→`silver`, datamart→`gold`), clusters come from `clusters.cdc` / `clusters.streaming` — and pushes them via `PUT /api/v1/di-projects/{id}/bindings`
6. Optionally prepares the project (`pipelines.prepare: true` in config)

Override any computed binding with an exact key in `config.json → pipelines.bindings`.

## Round-trip: refine in the UI, version in git

Build or refine the pipeline in the QTCP UI (transformation SQL, dataset rules, table recipes), then pull it back into the repo:

```bash
npm run deploy:export-pipeline   # exports both tenant projects into their source dirs
git diff                          # review what the UI changed
```

Commit the result and the next `npm run deploy` reproduces it on any tenant. This is the recommended workflow for the silver/gold transformation logic, which is easier to author visually than by hand.

## VS Code template & AI-assisted authoring

Each project ships as a ready-to-open VS Code workspace so pipelines can be authored declaratively — by hand or with an AI coding agent (Claude Code, GitHub Copilot) — with live schema validation. The tooling is committed with each project:

- `.vscode/settings.json` — maps every QTCP schema to its file pattern (the Red Hat YAML extension reads this)
- `.vscode/extensions.json` — recommends `redhat.vscode-yaml`
- `CLAUDE.md` and `.github/copilot-instructions.md` — point any coding agent at `schema/ai-instructions.md` as its source of truth

One local step activates validation. The Qlik **schema kit** (`schema/`) is internal-preview material pending legal approval for public hosting, so it is **not committed** (`.gitignore` blocks `deploy/pipelines/schema/`). Obtain the kit and drop it in:

```bash
npm run pipeline:template                                   # verify tooling + report schema status
npm run pipeline:template -- --schema <path-to-schema-kit>  # install the kit into both projects
```

Then open a project folder (e.g. `deploy/pipelines/mcg-batch-pipeline`) in VS Code, accept the recommended Red Hat YAML extension, and open `qtcp_project.yaml` — the schema title shows in the status bar, hover gives docs, and Problems = 0.

### Author a change with an AI agent (demo flow)

1. Open `deploy/pipelines/mcg-batch-pipeline` in VS Code with a coding agent (it reads `CLAUDE.md` → `schema/ai-instructions.md`).
2. Prompt: *"Change the CRM landing to sync every 30 minutes instead of 15."*
3. The agent edits one line in `qtcp_tasks/MCG CRM Landing/schedule.yaml` — `RRULE:FREQ=MINUTELY;INTERVAL=15` → `INTERVAL=30` — validated live against the schema.
4. `git diff` shows exactly one changed line; commit it.
5. Sync to the tenant via **Apply from Remote** (GitHub-connected project), `npm run deploy`, or a manual ZIP import. Rollback = `git revert`.

## Editing the YAML by hand

Format ground rules (from the preview tester's guide):

- One object per YAML file; only properties that differ from defaults
- Every `{{variable}}` used anywhere must be declared in `qtcp_bindings_definition.json` (blank value is fine — the deployer fills it)
- Task IDs are `<name>-<4 digits>` and are referenced by `sourceTask` in downstream `sourceSelection.yaml` files as plain strings (no `{{ref(...)}}`)
- No comments in project YAML/JSON files

## Separate project: `olh-mcg-demo-cdc/` (built in the UI, not deployed by Step 13)

`MCG Supply Chain Pipeline - CDC` (first exported as `olh_mcg_demo_cdc`, then renamed on the tenant) is an Open Lakehouse CDC project built in the Qlik Cloud UI (space `MCG Demo - DI`, project id `6adbc27420721cca309f1fb1`) and exported here unchanged. It is kept apart from the three projects above: it is not in `config.json → pipelines.projects`, so `npm run deploy` does not import it and `npm run deploy:export-pipeline` does not overwrite it. The Snowflake project depends on it, so on a new tenant build it first.

| Flow | Landing (`LAKE_LANDING`) | Storage (`LAKEHOUSE_STORAGE`) | Mirror (`LAKEHOUSE_MIRROR`) |
|---|---|---|---|
| CRM | `MCG_CRM_Lake_landing`: MySQL `rgs_olh_mcg_mysql`, `mcg_crm` (crm_contacts, crm_orders, crm_products) | `MCG_CRM_Storage` | `MCG Snowflake Mirror` → `RGS_E2E_DEMO_DB` |
| WMS | `MCG_WMS_Lake_landing`: PostgreSQL `rgs_olh_mcg_postgres`, `public` (inventory_positions, shipments, warehouse_events) | `MCG_WMS_Storage` | `MCG WMS Snowflake Mirror` → `RGS_E2E_DEMO_DB` |

Its bindings are the tenant's own export: connections are `{{id(connection, <Space>.<Connection>)}}`, the cluster is `{{id(lakehouseCluster, <Space>.<Cluster>)}}`, and the project's space is `ref{project.current.spaceId}`. To refresh it from the tenant, call `POST /api/v1/di-projects/6adbc27420721cca309f1fb1/actions/export` with `{"mode":"MINIMAL","includeBindings":true}` and unzip the result into this folder.

## Caveats

This targets a **preview** API surface. If an endpoint shape changes (e.g. import becomes async with a different action envelope), the deployer's DI methods in `deploy-to-qlik.js` (`DI PROJECTS` section) are the single place to adjust. Step 13 is fail-soft: with `continueOnError: true` the rest of the deployment proceeds even if the tenant doesn't have the preview enabled.
