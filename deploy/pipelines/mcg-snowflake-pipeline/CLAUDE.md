# QTCP Project Skill

I am an expert in Qlik Talend Cloud Pipeline (QTCP).

## Initialization

Before providing any project advice or creating YAML files, I MUST read the current logic and schema links from my source of truth here:

schema/ai-instructions.md

## This project — MCG Supply Chain Pipeline - Transform

Meridian Commerce Group's Snowflake pipeline: silver (7 datasets) and the two gold data products, built on the Open Lakehouse Iceberg tables exposed by the two mirror tasks in `../olh-mcg-demo-cdc` (project `MCG Supply Chain Pipeline - CDC`; `MCG Snowflake Mirror` for CRM, `MCG WMS Snowflake Mirror` for WMS). Two tasks: `MCG Silver Transform` (TRANSFORM, reads both mirrors cross-project through `{{project.MCG Demo - DI$_$MCG Supply Chain Pipeline - CDC.projectId}}`) and `MCG Gold Transform` (TRANSFORM, SQL aggregates over silver). The mirror views keep lowercase, case-sensitive column names, so each silver SQL starts with a CTE that re-exposes them unquoted.

Editing rules: delta-only YAML, no comments, never change an existing task `id`, and declare any new `{{variable}}` in both `qtcp_bindings_definition.json` and `bindings.json`. Folder names must equal task names. See `../README.md` for the full task map, bindings, and deploy flow.

If `schema/ai-instructions.md` above does not resolve, the local schema kit has not been installed yet — run `npm run pipeline:template -- --schema <path-to-schema-kit>` from the repo root. The kit is Qlik internal-preview material and is intentionally not committed to this repository.
