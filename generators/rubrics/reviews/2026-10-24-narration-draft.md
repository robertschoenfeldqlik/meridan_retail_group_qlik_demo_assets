# Narration draft for Ingrid's asks 2, 3, 5 and 6 (2026-10-24)

Draft only — nothing here is applied to `series/*/script.md` yet. Each change names the criterion it
answers and the fact it rests on. Ask 1 (apps on the gold products) and ask 4 (recaptures) are not
narration; ANA-04 ("the apps read Supply Chain Health and Last Mile Performance") is held back until
ask 1 is done, because today the apps load QVD files and the line would be false.

Facts used:
- Preview: `MCG_Agentic_Data_Engineering.md` § GA vs preview — Declarative Data Pipelines **Preview**,
  Qlik MCP Server **Preview**.
- Owners and SLAs: `deploy/data_products.json` — Supply Chain Health: Henrik Jansen, 15 minutes,
  trustScoreTarget 0.85; Last Mile Performance: Sophie Müller, 30 minutes, 0.80.
  The tenant shows the Qlik Trust Score out of five, so 0.85 is stated as 4.25 / 5 and the Discovery
  Agent's 0.7 as 3.5 / 5.
- Predict: deployment "MCG Late Delivery Risk Deployment", model accuracy 0.816, 20,000 orders scored
  (MCG_Late_Delivery_Predictions.parquet).
- Engines: WMS is PostgreSQL, CRM is MySQL "Meridian CRM" (memory mysql-crm-source).

## s2 Integrations

**sc3** (INT-04, engines spoken)
- Now: "The warehouse management database, streaming change data capture through a data movement
  gateway. … And the Meridian CRM database, for contacts, orders and the product master."
- Draft: "The warehouse management database — PostgreSQL — streaming change data capture through a data
  movement gateway. Cold-chain telemetry off Kafka. And the Meridian CRM, a MySQL database, for contacts,
  orders and the product master."

**sc4** (INT-07, preview aloud)
- Now: "Both are declarative pipelines — plain YAML in version control, …"
- Draft: "Both are declarative pipelines — a preview capability today, and we say so — plain YAML in
  version control, …"

## s3 Governance

**sc6** (GOV-03, owner, SLA and target with values)
- Now: "Each has an owner with a name, a refresh schedule, a schema with semantic types, and a trust
  score target."
- Draft: "Each has a named owner, a refresh schedule, a schema with semantic types, and a trust target.
  Supply Chain Health belongs to Henrik Jansen, refreshes every fifteen minutes, and is held to four and a
  quarter out of five. Today it reads three point eight — under target, and the score is what tells us."
  *(Decision for you: this says out loud that the flagship product is below target.)*

**sc3 or sc9** (GOV-10, regulation named) — optional, a should
- Add after "…a four-hour recall and an eleven-day one.": "EC 178/2002 asks for one step back and one
  step forward, and the NVWA cited us after the lettuce recall."

## s4 Analytics

**sc2** (AI-07 / ANA-10, preview aloud)
- Now: "…authored conversationally, through the Qlik MCP server — an assistant calling live Qlik tools…"
- Draft: "…authored conversationally, through the Qlik MCP server — in preview today — an assistant
  calling live Qlik tools…"

**sc3** (ANA-05, a named role decides, with an outcome)
- Add after "The answer comes with the document attached.": "So the APAC logistics lead changed the
  Singapore promise on the website to three days that afternoon, and opened the carrier conversation
  with the amendment in hand."
  *(Decision for you: the outcome is narrative for the fictional company; no document records it.)*

**sc4** (ANA-06, cut the claim the tenant contradicts)
- Now: "What we expect that second model to confirm is the uncomfortable part: that a missing tracking
  number is one of the strongest predictors of a late delivery. The data gap itself predicts the
  failure."
- Draft: "That second model is deployed: twenty thousand orders scored for late-delivery risk, at about
  eighty-two percent accuracy — a starting point to test hunches against, not a verdict."

## s5 AI & Outcomes

**sc3** (AI-07, preview aloud)
- Now: "This is a real task in our batch pipeline, and it is just YAML in a git repository."
- Draft: "This is a real task in our batch pipeline — declarative pipelines are in preview — and it is
  just YAML in a git repository."

**sc4** (AI-05, thresholds on the tenant's scale and a named recipient)
- Now: "…trust score falling below zero point seven, sync lag over an hour, volume moving more than
  fifty percent. That is the Rotterdam failure again…"
- Draft: "…trust score falling below three and a half out of five, sync lag over an hour, volume moving
  more than fifty percent — and the alert goes to the product's owner: Henrik Jansen for Supply Chain
  Health, Sophie Müller for Last Mile. That is the Rotterdam failure again…"

**sc5** (AI-03 / AI-04 / AI-06, citations, MCP, approvers)
- Add after "…wait for a human to approve them.": "On the consumption side the same rule holds: Answers
  cites the document behind every answer, quality rules go live only when the data steward approves
  them, and the Qlik MCP server — also in preview — opens these governed products to any MCP-compatible
  assistant, not only ours."

## Ask 4 — tenant panels captured and ready (read-only captures, 2026-10-24 ~04:45 UTC)

Staged in the session scratchpad `recapture/panels/`, not yet copied into `series/qlik_panels/`.

| Panel | Shows | Replaces | Answers |
|---|---|---|---|
| `v2_pipeline_tasks.png` | `olh_mcg_demo_cdc` canvas (MySQL / PostgreSQL → landing → storage → Snowflake mirror) over the MCG Supply Chain Pipeline canvas (both mirrors → Silver Transform → Gold Transform) | s2 sc4 `v2_pipelines.png` (two empty project tiles) | INT-03 |
| `v3_catalog_gold.png` | Catalog filtered to MCG Demo - DI: `supply_chain_health` and `last_mile_performance`, Snowflake datasets | s2 sc5 `v3_catalog.png` (21 Sep, silver/gold CSV files) | INT-03 |
| `gov_dataset_profile.png` | Profile of the Snowflake gold `supply_chain_health`: LOCATION_ID DC-RTD-01…, SKU_POSITIONS, LOT_MISSING_COUNT, PHANTOM_SUSPECT_COUNT, AVG_TRUST_SCORE | s3 sc3/sc6 `v3_dataquality.png` (stock semantic types) | GOV-02 |
| `gov_dataset_overview.png` | Same dataset: AI description, 100% valid on 2 validation rules, Trust Score 3.8/5 with its dimensions | s3 sc4 trust-score panel | GOV-02, GOV-04 |
| `gov_lineage_gold.png` | Lineage: WMS Snowflake mirror (`olh_mcg_demo_cdc`) → Silver Transform → Gold Transform → `supply_chain_health` | s3 sc5 `dp_lineage.png` (one hop) | GOV-02 |

Still needs tenant changes, not captures: a stewardship sprint actually holding the 640 addresses,
approved glossary terms with stewards, and product owners in the tenant matching the narration
(today both show Robert Schoenfeld). s5 can use the existing `v4_answers.png` for its live AI surface.

## Not drafted — needs your call
- **Rotterdam figure**: `deploy/scenarios.md` says the pipeline failed silently for 72 hours *and* that
  it took 4.3 days to detect; the business case uses 4.3 days. The video says seventy-two hours.
- **Accuracy target**: the repo (apps, glossary) says 97%; Ingrid cites 96% from the business case. The
  video says ninety-seven.
- **CRM cadence** (s2 CDC vs s5 "fifteen minutes to thirty"): the s5 coding-agent example edits the old
  batch pipeline's `schedule.yaml`, which still reads INTERVAL=15.
