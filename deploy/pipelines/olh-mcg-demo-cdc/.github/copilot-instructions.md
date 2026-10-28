# QTCP Project Skill

I am an expert in Qlik Talend Cloud Pipeline (QTCP).

## Initialization

Before providing any project advice or creating YAML files, I MUST read the current logic and schema links from my source of truth here:

schema/ai-instructions.md

## This project — olh_mcg_demo_cdc

Meridian Commerce Group's Open Lakehouse CDC project, built in the Qlik Cloud UI in space `MCG Demo - DI` and exported here. Two independent flows, each landing → Apache Iceberg storage → zero-copy Snowflake mirror into database `RGS_E2E_DEMO_DB`:

| Flow | Source | LAKE_LANDING | LAKEHOUSE_STORAGE | LAKEHOUSE_MIRROR | Tables |
|---|---|---|---|---|---|
| CRM | MySQL `rgs_olh_mcg_mysql`, schema `mcg_crm` | `MCG_CRM_Lake_landing` | `MCG_CRM_Storage` | `MCG Snowflake Mirror` | crm_contacts, crm_orders, crm_products |
| WMS | PostgreSQL `rgs_olh_mcg_postgres`, schema `public` | `MCG_WMS_Lake_landing` | `MCG_WMS_Storage` | `MCG WMS Snowflake Mirror` | inventory_positions, shipments, warehouse_events |

Both storage tasks run on lakehouse cluster `rgs-olh-mcg-cluster`. Both mirrors use warehouse `LOAD_WH`, external volume `MCG_OLH_MIRROR_VOL` and catalog integration `MCG_OLH_GLUE_CATALOG`. The project uses `MCG Glue Catalog` as its platform connection and `MCG S3 Landing CDC` for cloud staging, on AWS. An Open Lakehouse project holds only landing, storage and mirror tasks for CDC sources, so there is no TRANSFORM or DATAMART here.

This project is kept separate from `../mcg-batch-pipeline`, `../mcg-streaming-pipeline` and `../mcg-snowflake-pipeline`. It is not listed in `deploy/config.json → pipelines.projects`, so the deployer neither imports nor exports it.

Editing rules: delta-only YAML, no comments, never change an existing task `id` or dataset `id`, and declare any new `{{variable}}` in both `qtcp_bindings_definition.json` and `bindings.json`. Folder names must equal task names; they keep the names given in the UI, underscores and spaces included. See `../README.md` for the bindings format and the export call.

If `schema/ai-instructions.md` above does not resolve, the local schema kit has not been installed in this folder yet. Copy the QTCP schema kit into `schema/` here (`npm run pipeline:template -- --schema` installs it only into the three MCG projects). The kit is Qlik internal-preview material and is intentionally not committed to this repository.
