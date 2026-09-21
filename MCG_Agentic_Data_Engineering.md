# Meridian Commerce Group -- Agentic Data Engineering
## The Build Side of MCG's AI Story: Author the Pipeline, Govern the Data

---

> **Status: Qlik internal preview (June 2026).** The capabilities in this
> document describe Qlik's **agentic data engineering** direction. **Declarative
> Data Pipelines** and the **Qlik MCP Server** tooling are in **preview** and
> subject to change; treat their specifics as forward-looking. The three
> conversational agents (**Data Product Agent**, **Data Quality Agent**,
> **Catalog and Business Glossary Agent**) are **Qlik Answers capabilities, not
> separate products** — do not present them as standalone SKUs. Where a value is
> needed but not yet grounded in an MCG asset, this document shows a visible
> `[placeholder]` rather than inventing a number.

---

## Two AI stories, one platform

MCG's demo already tells a **consumption-side** AI story: the Discovery Agent
surfaces anomalies, Qlik Answers reasons over the 25-document knowledge base,
Qlik Predict scores Cold Chain Exceedance and Late Delivery, and an MCP client
authors app sheets. That story is about **using** trusted data.

Agentic data engineering is the **build-side** counterpart: the AI that helps you
**author the pipeline and govern the data** in the first place. It is the same
platform, one step upstream — the work that turns raw source data into the
governed gold products the consumption side depends on.

The through-line is a single artifact. **One underlying pipeline definition**
(YAML) can be edited three ways — **visually** in the Qlik Talend Cloud UI,
**programmatically** in an IDE, or **agentically** by an AI coding agent. All
three paths write the same file, validated against the same schema, versioned in
the same Git history. The result is **a path from raw data to trusted, AI-ready
data product that keeps human expertise in the loop at each stage.**

For MCG that pipeline is real and already in the repo: two QTCP projects with six
tasks landing WMS, CRM, and IoT data through the medallion (bronze → silver →
gold) on Apache Iceberg, packaged as two governed data products. Agentic data
engineering is how MCG would **build and evolve** that pipeline going forward.

---

## The six capabilities, mapped to MCG

| # | Capability | What it does | MCG asset it maps to | Status |
|---|---|---|---|---|
| 1 | **Declarative Data Pipelines** | Code-first pipeline definition in YAML, authorable in the Qlik Talend Cloud UI, third-party IDEs (VS Code), and AI coding agents; Git version control + CI/CD; export/import; schema-validated; agent-friendly | The **two QTCP `DATA_PIPELINE` projects** (`mcg-batch-pipeline`, `mcg-streaming-pipeline`) shipped as a VS Code template under `deploy/pipelines/` | **Preview** |
| 2 | **Data Product Agent** | Create and manage data products through natural-language interaction — CRUD, conversational discovery, review and improve product quality/completeness | The **two gold data products**: *Supply Chain Health* and *Last Mile Performance* | Qlik Answers capability |
| 3 | **Data Quality Agent** | Helps data stewards assess, define, and enforce data-quality rules conversationally — assess DQ across datasets, create/manage/map DQ rules, run DQ metric calculations | The **silver transform DQ logic** (UoM/zone standardization, phantom-inventory flags, trust scores) across the 7 silver datasets | Qlik Answers capability |
| 4 | **Catalog and Business Glossary Agent** | Discover assets, understand context and relationships, define consistent terminology — NL queries against the Qlik Cloud Catalog, generate glossaries, standardize terms and synonyms | The **MCG Business Glossary** plus the catalog metadata behind the **25-document Qlik Answers knowledge base** | Qlik Answers capability |
| 5 | **Talend Agentic Routes** | Extends Qlik Talend Cloud for AI-native workflows: LLM integration in data tasks, RAG pipelines, and agentic orchestration (incl. MCP client) | The existing **CRM address-validation Talend job** — the concrete surface for an LLM-assisted address-correction route | See `deploy/talend/MCG_Talend_Agentic_Routes.md` |
| 6 | **Qlik MCP Server** | An MCP-compliant server exposing Qlik Cloud's analytical and data-governance capabilities (data products, quality metrics, lineage, catalog) to any MCP-compatible AI assistant | MCG's governance surface — the two data products, their trust-score SLAs, lineage, and catalog — exposed to Claude, Copilot, or any MCP client | **Preview** |

**A note on framing.** Capabilities 2, 3, and 4 are conversational agents that
Qlik delivers **as Qlik Answers capabilities, not separate products**. Capabilities
1 and 6 are in **preview**. Capability 5 (Talend Agentic Routes) is documented on
its own in `deploy/talend/MCG_Talend_Agentic_Routes.md`.

---

## How it works: raw → trusted in seven steps

Each MCG asset already exists somewhere in this flow. Agentic data engineering is
what connects them into one governed path.

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  1. DESIGN                                                                 │
  │     Author the pipeline declaratively in an IDE + AI coding agent,         │
  │     commit to Git.                                                         │
  │     MCG: deploy/pipelines/ — two QTCP projects, VS Code template,          │
  │          CLAUDE.md + copilot-instructions.md per project.                  │
  └───────────────────────────────┬──────────────────────────────────────────┘
                                  ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  2. DATA MOVEMENT                                                          │
  │     CI/CD deploys the definition; ingestion tasks land raw data.          │
  │     MCG: WMS CDC + CRM landing → bronze; IoT streaming landing → bronze.   │
  └───────────────────────────────┬──────────────────────────────────────────┘
                                  ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  3. QUALITY                                                                │
  │     Data Quality Agent profiles and validates.                            │
  │     MCG: DQ rules over the 7 silver datasets — negative-qty, missing-lot,  │
  │          stale-snapshot flags; 0.1–1.0 trust scores.                       │
  └───────────────────────────────┬──────────────────────────────────────────┘
                                  ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  4. PACKAGING                                                              │
  │     Data Product Agent packages datasets with governance metadata.        │
  │     MCG: gold → Supply Chain Health + Last Mile Performance, each with a   │
  │          trust-score SLA and apiSharing.                                   │
  └───────────────────────────────┬──────────────────────────────────────────┘
                                  ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  5. DISCOVERY / GOVERNANCE                                                 │
  │     Catalog and Business Glossary Agent makes assets findable and          │
  │     consistently named.                                                    │
  │     MCG: catalog + Business Glossary behind the 25-doc knowledge base.     │
  └───────────────────────────────┬──────────────────────────────────────────┘
                                  ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  6. AI ENHANCEMENT                                                         │
  │     Talend Agentic Routes inject LLM / RAG / orchestration into tasks.     │
  │     MCG: the CRM address-validation job gains an LLM-assisted       │
  │          address-correction route.                                        │
  └───────────────────────────────┬──────────────────────────────────────────┘
                                  ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  7. AI-READY OUTPUT                                                        │
  │     Trusted data products with trust scores + provenance, ready for the    │
  │     consumption-side AI (Discovery Agent, Qlik Answers, Qlik Predict) and  │
  │     for third-party agents via the Qlik MCP Server.                        │
  └──────────────────────────────────────────────────────────────────────────┘
```

The hand-off is clean: step 7's outputs are exactly what MCG's existing
consumption-side story reads. Build side produces trust; consumption side spends
it.

---

## The human-in-the-loop coding-agent loop

Declarative pipelines are agent-friendly by design, but the human stays in
control. Authoring a change is a four-step loop, not a hand-off:

```
   ┌────────────────────┐        ┌────────────────────┐
   │ 1. Developer        │        │ 2. Agent            │
   │    Prompts          │ ─────► │    Generates        │
   │  "sync CRM every    │        │  edits the YAML     │
   │   30 min not 15"    │        │  (schedule.yaml)    │
   └────────────────────┘        └─────────┬──────────┘
             ▲                              │
             │                              ▼
   ┌─────────┴──────────┐        ┌────────────────────┐
   │ 4. Developer        │        │ 3. Schema           │
   │    Reviews          │ ◄───── │    Validates        │
   │  git diff = 1 line, │        │  Red Hat YAML ext   │
   │  commit / revert    │        │  Problems = 0       │
   └────────────────────┘        └────────────────────┘
```

MCG's template makes this loop concrete. The demo edit lives in
`deploy/pipelines/mcg-batch-pipeline/qtcp_tasks/MCG CRM Landing/schedule.yaml`:
an agent changes one RRULE field (`FREQ=MINUTELY;INTERVAL=15` → `INTERVAL=30`); the
Red Hat YAML extension validates it live against the schema, `git diff` shows
exactly one changed line, and the developer commits it and syncs with
**Apply from Remote**. Rollback is `git revert`. The agent does the typing; the
schema catches the mistakes; the human owns the decision.

See `deploy/pipelines/README.md` for the full VS Code template setup (the schema
kit drops in locally via `npm run pipeline:template -- --schema <path>`), the per-project `CLAUDE.md`
and `.github/copilot-instructions.md` that point any coding agent at the schema,
and the round-trip export workflow.

---

## GA vs preview status

Honesty about maturity is part of the pitch. This is where each capability stands
for MCG's purposes.

| Capability | Status | What that means for the demo |
|---|---|---|
| **Declarative Data Pipelines** | **Preview** (Qlik internal preview, June 2026) | Real and demoable via the `deploy/pipelines/` template; keep a forward-looking disclaimer on decks. The schema kit is internal-preview material and is not committed to the repo. |
| **Data Product Agent** | Qlik Answers capability | Frame as a conversational capability of Qlik Answers, not a separate SKU. Maps to the two gold data products. |
| **Data Quality Agent** | Qlik Answers capability | Same framing. Bridges business and technical users over the silver DQ rules. |
| **Catalog and Business Glossary Agent** | Qlik Answers capability | Same framing. Generated glossary terms are **DRAFT by default and require human review** before they are trusted. |
| **Talend Agentic Routes** | See route doc | LLM-in-task, RAG, and agentic orchestration inside pipeline tasks. Detailed in `deploy/talend/MCG_Talend_Agentic_Routes.md`; grounded example under `deploy/talend/agentic-routes/`. |
| **Qlik MCP Server** | **Preview** | Bridges Qlik governance to third-party AI agents (Claude, Copilot). Preview tooling — label as roadmap and keep the disclaimer. |

---

## Where this lives in the repo

| Artifact | Path | Role |
|---|---|---|
| This story bible | `MCG_Agentic_Data_Engineering.md` | The build-side narrative and capability map |
| Declarative pipeline template | `deploy/pipelines/` | The two QTCP projects as a VS Code + AI-agent workspace (capability 1) |
| Pipeline template guide | `deploy/pipelines/README.md` | Setup, schema kit, round-trip export, the demo edit |
| Talend Agentic Routes | `deploy/talend/MCG_Talend_Agentic_Routes.md` | Positioning for capability 5 |
| Grounded route example | `deploy/talend/agentic-routes/address-correction-route.md` | LLM-assisted address correction on the CRM address job |
| Existing Talend job | `deploy/talend/README.md` | `mcg_crm_address_validate_bulk` — standardize, bulk-geocode, then route on GPS to Iceberg or the Address Cleanup sprint. The route upgrades the unresolved branch. |

---

## Demo talking points

1. **"Same pipeline, three ways to author it."** The YAML MCG deploys is the same
   file whether a person edits it in the UI, a developer edits it in VS Code, or
   an AI agent edits it from a prompt. One definition, one schema, one Git
   history.

2. **"The agent types; the human decides."** The coding-agent loop keeps a human
   review gate on every change. The `git diff` is the audit trail — one line
   changed, reviewed, committed, revertable.

3. **"Build side produces the trust the consumption side spends."** Agentic data
   engineering is upstream of the demo's existing AI. It is what makes *Supply
   Chain Health* and *Last Mile Performance* trustworthy enough for Qlik Answers
   and Qlik Predict to rely on.

4. **"Preview, and we say so."** Declarative Pipelines and the MCP Server are
   preview. The three agents are Qlik Answers capabilities, not new products. The
   demo is honest about what is shipping today versus what is roadmap.

5. **"AI reaches inside the pipeline, not just the dashboard."** Talend Agentic
   Routes put LLM calls, RAG, and orchestration *inside* a data task — so MCG's
   address-correction logic can reason over malformed multilingual addresses
   before the record ever reaches gold.

---

*Agentic Data Engineering narrative for Meridian Commerce Group*
*Six capabilities | 7-step raw → trusted flow | build-side counterpart to the consumption-side AI*
*Qlik internal preview (June 2026) — forward-looking; preview capabilities subject to change*
