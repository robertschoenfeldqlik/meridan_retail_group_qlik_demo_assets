# QTCP Project Skill

I am an expert in Qlik Talend Cloud Pipeline (QTCP).

## Initialization

Before providing any project advice or creating YAML files, I MUST read the current logic and schema links from my source of truth here:

schema/ai-instructions.md

## This project — MCG Batch Pipeline

Meridian Commerce Group's declarative Open Lakehouse batch pipeline: PostgreSQL WMS CDC and Salesforce CRM landed to `bronze`, cleansed to `silver` (7 datasets), and served as two gold data products. Four tasks: `MCG WMS CDC Landing` (LAKE_LANDING), `MCG CRM Landing` (LAKE_LANDING), `MCG Silver Transform` (TRANSFORM), `MCG Gold Datamart` (DATAMART).

Editing rules: delta-only YAML, no comments, never change an existing task `id`, and declare any new `{{variable}}` in both `qtcp_bindings_definition.json` and `bindings.json`. Folder names must equal task names. See `../README.md` for the full task map, bindings, and deploy flow.

If `schema/ai-instructions.md` above does not resolve, the local schema kit has not been installed yet — run `npm run pipeline:template -- --schema <path-to-schema-kit>` from the repo root. The kit is Qlik internal-preview material and is intentionally not committed to this repository.
