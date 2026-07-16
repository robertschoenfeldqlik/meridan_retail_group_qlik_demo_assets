# MCG Talend Agentic Routes
## AI-native workflows inside Qlik Talend Cloud data tasks

---

> **Status: Qlik internal preview / roadmap (June 2026).** Talend Agentic Routes
> extend Qlik Talend Cloud for AI-native workflows. Treat the specifics here as
> forward-looking. Where an endpoint, model, or value is not grounded in an MCG
> asset, this document uses a visible `[placeholder]` rather than inventing one.
> This is one of the six **agentic data engineering** capabilities — see the
> build-side story in `../../MCG_Agentic_Data_Engineering.md`.

---

## What this is (and what it is *not*)

**Talend Agentic Routes** are AI capabilities that run **inside a Qlik Talend
Cloud data task** — an LLM call, a RAG lookup, or an orchestrated agent step in
the middle of a pipeline, alongside the usual transform components. They let a
task do sentiment analysis, entity extraction, content classification, and
AI-assisted data quality **as part of moving the data**, not as a separate
downstream app.

This is **distinct from** `../../MCG_Talend_Transformation_Routes.md`, which is
**SUPERSEDED** — that document described an earlier design in which Talend
performed all bronze → silver → gold transformations and produced an eight-product
gold layer. The current architecture moved those transformations into declarative
**Qlik Cloud Pipelines** (two QTCP projects, YAML) and narrowed Talend's standing
role to the **Salesforce address-validation + geocoding + stewardship** leg (see
`README.md`).

Talend Agentic Routes are not a return to that old model. They are a **new,
narrow AI surface** that MCG would add *to the address-validation job it already
has* — the one concrete Talend job still in the picture. Nothing here reopens the
superseded transformation-route design.

---

## The three tiers

Talend Agentic Routes come in three tiers of increasing autonomy. MCG would adopt
them bottom-up.

### Tier 1 — LLM integration in data tasks

Call a large language model from inside a task and use its output like any other
column: classify text, extract entities, normalize a messy field, score
confidence.

| | Models |
|---|---|
| **Cloud LLMs** | OpenAI, Anthropic Claude, Google Gemini, Amazon Bedrock |
| **On-prem LLMs** | Ollama, Mistral, Gemma 3, Phi 4 |

The on-prem options matter for MCG: customer PII (contact names, addresses,
emails) can be reasoned over by a **locally hosted** model (Ollama / Mistral /
Gemma 3 / Phi 4) so records never leave the tenant boundary during processing.

**What MCG would use it for**
- **Address normalization and correction** on the Salesforce job — the grounded
  example, detailed in `agentic-routes/address-correction-route.md`.
- **Carrier exception classification** — map free-text carrier status notes
  (multilingual: EN/DE/PT) to MCG's canonical exception set (`ADDRESS_INVALID`,
  `RECIPIENT_ABSENT`, `REFUSED_OR_CLOSED`).
- **Supplier-communication sentiment** — score supplier emails/notes for tone as
  an early signal on at-risk relationships.

### Tier 2 — RAG pipelines

Build retrieval-augmented tasks: embed content, write vectors to a vector target,
and retrieve grounded context at task time.

| | Vector targets |
|---|---|
| **Supported** | Pinecone, MongoDB, Snowflake, Databricks, Milvus, Oracle |

**What MCG would use it for**
- **Ground the address-correction LLM** against a retrieval index of known-good
  MCG delivery addresses and locality/postal reference data, so corrections
  prefer real MCG destinations over plausible-but-wrong guesses.
- **Enrich stewardship context** — when a record routes to a steward, retrieve
  the relevant carrier contract or SOP snippet so the steward sees the governing
  rule inline. (The same 25-document corpus the consumption-side Qlik Answers
  reads; here it grounds a build-side task.)

The specific vector target for MCG is a deployment choice — `[placeholder: choose
one of Pinecone / MongoDB / Snowflake / Databricks / Milvus / Oracle]`.

### Tier 3 — Agentic orchestration

Event-driven orchestration of agent steps, conversational AI, and extensible tool
use — including an **MCP client** so a Talend route can call out to MCP-exposed
tools and services.

**What MCG would use it for**
- **Close the address-correction loop end to end**: an event (new/updated
  Salesforce contact) triggers the route, the agent normalizes and scores, and
  low-confidence records are orchestrated into the existing **Address Cleanup
  stewardship campaign** — then, on approval, the job re-runs for the corrected
  records (this is automation #5, *MCG Address Correction Loop — Talend*, already
  in the demo).
- **MCP client to the Qlik MCP Server**: a route could, in future, use the
  **Qlik MCP Server** (preview) as a tool to read a data product's trust score or
  lineage mid-pipeline and branch on it. This pairs the two preview capabilities —
  Talend route as MCP *client*, Qlik MCP Server as *server*.

---

## How this relates to the existing Salesforce address-validation job

The current job (`README.md`) is a two-job Talend flow on a 15-minute TMC
schedule:

```
Salesforce ─► JOB 1: mcg_sf_address_validate
              ├── tSalesforceInput (Contact, incremental)
              ├── tMap — routines.AddressValidator (format check, Java)
              │     ├─ valid ───────────────────────► staging (validated)
              │     └─ invalid ─► tRESTClient (Nominatim geocode, 1 req/s)
              │           ├─ resolved ──────────────► staging (validated)
              │           └─ unresolved ────────────► STEWARDSHIP route
              └── on-success ─► JOB 2: mcg_sf_address_to_qvd ─► QVD
```

Today, a malformed multilingual address that the Java format check rejects goes
straight to Nominatim; if Nominatim cannot resolve it, it lands in stewardship
**uncorrected**. A Tier-1 Talend Agentic Route inserts an **LLM normalization and
correction step between the format check and the geocoder**, so many addresses are
repaired *before* geocoding — Nominatim then resolves them, and only genuinely
ambiguous records reach a human.

```
              ├── tMap — routines.AddressValidator (format check)
              │     ├─ valid ───────────────────────► staging (validated)
              │     └─ invalid ─► [NEW] Agentic Route: LLM normalize/correct
              │                        │  (multilingual → structured + confidence)
              │                        ├─ high confidence ─► tRESTClient (Nominatim)
              │                        └─ low confidence ──► STEWARDSHIP route
```

The route is **additive**: the Nominatim throttle, the stewardship webhook, the
QVD output, and automation #5 all stay exactly as documented. The LLM step raises
the share of records auto-repaired and lowers the share a steward must touch.

**Grounded example:** `agentic-routes/address-correction-route.md` specifies the
trigger, task steps, LLM prompt shape, and outputs for this route.

---

## Positioning notes (for decks and enablement)

- **Talend Agentic Routes are one of six agentic data engineering capabilities.**
  Lead with the build-side story (`../../MCG_Agentic_Data_Engineering.md`), then
  drill into routes as the "AI inside the pipeline task" capability.
- **Preview / roadmap.** Keep the forward-looking disclaimer. Do not quote
  throughput, accuracy, or cost numbers that are not grounded — use
  `[placeholder]`.
- **On-prem models are a governance feature, not a footnote.** For a supply-chain
  customer handling customer PII, "the LLM runs inside your tenant" (Ollama /
  Mistral / Gemma 3 / Phi 4) is often the deciding point.
- **Additive, not a rewrite.** The routes extend the existing address-validation
  job. They do not resurrect the superseded eight-route transformation design.

---

*Talend Agentic Routes positioning for Meridian Commerce Group*
*Three tiers: LLM-in-task | RAG pipelines | agentic orchestration (incl. MCP client)*
*Qlik internal preview / roadmap (June 2026) — forward-looking; specifics subject to change*
