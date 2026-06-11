# Declarative Data Pipelines (QTCP Preview)

The MCG bronze → silver → gold pipeline, defined as **declarative YAML** (Qlik Talend Cloud Pipelines internal preview) and deployed automatically as **Step 13** of `npm run deploy`.

## What gets deployed

`mcg-pipeline/` is a complete QTCP project (`DATA_PIPELINE`, platform `QLIK_OPEN_LAKEHOUSE`) with six tasks:

| Task | Type | Source → Target | Schedule |
|---|---|---|---|
| MCG WMS CDC Landing | `LAKE_LANDING` | PostgreSQL CDC (3 tables) → `bronze` | Continuous CDC |
| MCG CRM Landing | `LAKE_LANDING` | Salesforce (Contact, MCG_Order__c, MCG_Product__c) → `bronze` | Every 15 min |
| MCG IoT Streaming Landing | `STREAMING_LAKE_LANDING` | Kafka `mcg.iot.*` topics → `bronze` | Streaming |
| MCG Silver Transform | `TRANSFORM` | bronze WMS + CRM → `silver` | Event: any input task |
| MCG IoT Streaming Transform | `STREAMING_TRANSFORM` | bronze IoT → `silver` | Event: any input task |
| MCG Gold Datamart | `DATAMART` | silver → `gold` | Event: any input task |

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

The CRM landing additionally carries a `transformationRules.yaml` that renames Salesforce objects to the documented bronze names (`Contact` → `sf_contacts`, `MCG_Order__c` → `sf_orders`, `MCG_Product__c` → `sf_products`).

SQL is written as portable ANSI (CASE/COALESCE/window functions); the lakehouse engine compiles it at prepare time. If an expression needs dialect tweaks, fix it in the QTCP UI and run `npm run deploy:export-pipeline` to round-trip the correction back here.

Environment-specific values (connection IDs, schemas, lakehouse clusters, warehouse) are **never hardcoded** — they are `{{binding}}` variables declared in `qtcp_bindings_definition.json`. At deploy time, Step 13:

1. Zips `mcg-pipeline/` (pure-Node, no dependencies — see `../zip-utils.js`)
2. Pre-validates via `POST /api/v1/di-projects/utils/actions/validate-project-definitions` (skipped gracefully if the tenant doesn't expose the preview endpoint)
3. Creates or reuses the DI project (`POST /api/v1/di-projects`)
4. Imports the ZIP (`POST /api/v1/di-projects/{id}/actions/import`)
5. Resolves bindings from `config.json` — connection names from `dataConnections.*` are looked up on the tenant and bound by ID, schemas follow the medallion convention (landing→`bronze`, transform→`silver`, datamart→`gold`), clusters come from `clusters.cdc` / `clusters.streaming` — and pushes them via `PUT /api/v1/di-projects/{id}/bindings`
6. Optionally prepares the project (`pipelines.prepare: true` in config)

Override any computed binding with an exact key in `config.json → pipelines.bindings`.

## Round-trip: refine in the UI, version in git

Build or refine the pipeline in the QTCP UI (transformation SQL, dataset rules, table recipes), then pull it back into the repo:

```bash
npm run deploy:export-pipeline   # exports the tenant project into mcg-pipeline/
git diff                          # review what the UI changed
```

Commit the result and the next `npm run deploy` reproduces it on any tenant. This is the recommended workflow for the silver/gold transformation logic, which is easier to author visually than by hand.

## Editing the YAML by hand

Schema-validated editing works in VS Code with the Red Hat YAML extension plus the QTCP schema kit (`schema/` + `.vscode/settings.json`). The kit ships with Qlik's **internal preview** materials (pending legal approval for public hosting) and therefore **must not be committed to this repository** — `.gitignore` blocks `deploy/pipelines/schema/` accordingly. Drop the kit into this folder locally to get hover docs, auto-complete, and validation.

Format ground rules (from the preview tester's guide):

- One object per YAML file; only properties that differ from defaults
- Every `{{variable}}` used anywhere must be declared in `qtcp_bindings_definition.json` (blank value is fine — the deployer fills it)
- Task IDs are `<name>-<4 digits>` and are referenced by `sourceTask` in downstream `sourceSelection.yaml` files as plain strings (no `{{ref(...)}}`)
- No comments in project YAML/JSON files

## Caveats

This targets a **preview** API surface. If an endpoint shape changes (e.g. import becomes async with a different action envelope), the deployer's DI methods in `deploy-to-qlik.js` (`DI PROJECTS` section) are the single place to adjust. Step 13 is fail-soft: with `continueOnError: true` the rest of the deployment proceeds even if the tenant doesn't have the preview enabled.
