# Agentic Route: LLM-Assisted Address Correction
## Upgrading the Salesforce address-validation job with an in-task LLM step

---

> **Status: Qlik internal preview / roadmap (June 2026).** This is a grounded,
> concrete example of a **Tier-1 Talend Agentic Route** (LLM integration in a data
> task). It is **additive** to the existing job in `../README.md` — it does not
> replace it. Endpoint and model details that are not yet grounded appear as a
> visible `[placeholder]`. Positioning: `../MCG_Talend_Agentic_Routes.md`;
> build-side story: `../../../MCG_Agentic_Data_Engineering.md`.

---

## Problem this route solves

The existing `mcg_sf_address_validate` job runs a Java format check
(`routines.AddressValidator`) and sends anything that fails straight to Nominatim
geocoding. Malformed **multilingual** addresses — a Brazilian `Conjunto`
abbreviated three ways, a German `3. OG` floor marker, a truncated street, a
postal code missing its country's separator — often fail *both* the format check
*and* Nominatim, and land in stewardship **uncorrected**. A steward then retypes
the address by hand.

This route inserts an **LLM normalization/correction step between the format check
and the geocoder**. The LLM repairs and structures the address, emits a
confidence score, and only genuinely ambiguous records go to a human. Nominatim,
the stewardship webhook, the QVD output, and automation #5 are unchanged.

```
  invalid (format check)
        │
        ▼
  ┌───────────────────────────────────────────────┐
  │  LLM normalize / correct (this route)          │
  │   raw multilingual address → structured JSON   │
  │   + correction notes + confidence 0.0–1.0      │
  └───────────────┬───────────────────────────────┘
                  │
        ┌─────────┴───────────┐
        ▼                     ▼
  confidence ≥ τ         confidence < τ
  (default τ = 0.75)     (or model abstains)
        │                     │
        ▼                     ▼
  tRESTClient           STEWARDSHIP route
  (Nominatim geocode)   (Address Cleanup sprint,
                         LLM suggestion attached)
```

`τ` (the routing threshold) is tunable: `[placeholder: default 0.75 — confirm
with the stewardship team]`.

---

## Trigger

Same cadence as the host job — **no new schedule.**

- **Primary:** runs in line inside JOB 1 (`mcg_sf_address_validate`) on its
  existing **TMC 15-minute** schedule (`*/15 * * * *`, UTC). The route only
  processes the `out_invalid` branch, so the per-run volume is bounded the same
  way Nominatim throttling already bounds it (~700 invalid rows/run; backlog
  carries via the watermark).
- **Re-run (stewardship loop):** when a steward approves a correction in the
  **Address Cleanup** sprint, automation #5 (*MCG Address Correction Loop —
  Talend*) re-runs JOB 1 for the corrected records — this route runs again for
  them with no change to that loop.

---

## Task steps

Inserted between step 2 (`tMap map_validate`) and step 3 (Nominatim) of JOB 1.

| # | Component | Configuration |
|---|---|---|
| 1 | **Route input** (from `out_invalid`) | The rows the Java format check rejected: `Id, FirstName, LastName, MailingStreet, MailingCity, MailingState, MailingPostalCode, MailingCountry` |
| 2 | **Batch shaping** (`tMap`) | Assemble a compact JSON object per row for the model: the raw address fields plus a `source_country_hint` derived from `MailingCountry`. Batch size `[placeholder: e.g. 20 rows/request]` to respect model rate limits |
| 3 | **LLM call** (Agentic Route — LLM-in-task) | Model: on-prem preferred for PII — `[placeholder: Ollama / Mistral / Gemma 3 / Phi 4]`; cloud alternative `[placeholder: Anthropic Claude / OpenAI / Google Gemini / Amazon Bedrock]`. Endpoint: `[placeholder]`. Temperature low (`[placeholder: 0.0–0.2]`) for deterministic normalization. Prompt shape below |
| 4 | **Parse + validate** (`tExtractJSONFields`) | Parse the model's JSON response into columns: `street_corrected, city_corrected, postal_corrected, country_iso, unit_type, unit_number, floor, correction_notes, confidence`. Reject non-JSON / schema-invalid responses → treat as `confidence = 0.0` |
| 5 | **Confidence routing** (`tMap map_llm_route`) | `confidence >= τ` → `out_corrected` (`validation_status = "LLM_CORRECTED"`, `geo_confidence` seeded from `confidence`); else → `out_stewardship_llm` (`validation_status = "LLM_LOW_CONFIDENCE"`, LLM suggestion retained for the steward) |
| 6 | **Hand-off to existing flow** | `out_corrected` → the existing **Nominatim** branch (step 3 of JOB 1) using the corrected fields — geocoding now succeeds far more often. `out_stewardship_llm` → the existing **stewardship** route (step 7), with the LLM's suggested correction and notes added to the stewardship CSV so the steward accepts/edits rather than retypes |
| 7 | **Provenance** | Every routed row carries `llm_model`, `llm_confidence`, and `correction_notes` for audit/lineage — preserved through to the QVD alongside the existing `validated_at_utc` column |

**Guardrails baked in**
- The LLM **corrects and structures only** — it never invents a destination. The
  prompt instructs it to abstain (low confidence) rather than guess when the
  input is too degraded, and low-confidence rows always reach a human.
- **On-prem model preferred** so customer PII stays inside the tenant boundary.
- The route is **fail-soft**: if the LLM endpoint is unreachable, rows fall
  through to the original behavior (straight to Nominatim, then stewardship) — the
  job never blocks on the AI step.

---

## LLM prompt shape

Illustrative structure, not a tuned production prompt. The exact wording and
model are `[placeholder]`.

**System**
```
You normalize and correct malformed international mailing addresses for a
logistics company. Input addresses may be in English, German, Portuguese, Dutch,
or French and may be abbreviated, truncated, or missing a country. Return a
structured, corrected address. Preserve the real destination — do NOT invent a
street, city, or postcode. If the input is too degraded to correct confidently,
lower your confidence and explain why. Respond with JSON only.
```

**User (per record)**
```
Raw address:
  street:  "R. Haddock Lobo 595, Cj 42"
  city:    "Sao Paulo"
  state:   "SP"
  postal:  "01414000"
  country: "Brasil"
  country_hint: "BR"

Return JSON:
{
  "street_corrected":  string,
  "city_corrected":    string,
  "postal_corrected":  string,   // country-formatted, e.g. BR "01414-000"
  "country_iso":       string,   // ISO 3166-1 alpha-2
  "unit_type":         string,   // canonical: APT | STE | FL | null  (Cj -> STE)
  "unit_number":       string,
  "floor":             string,
  "correction_notes":  string,   // what you changed and why
  "confidence":        number    // 0.0–1.0; low if you had to guess
}
```

**Example response**
```json
{
  "street_corrected": "Rua Haddock Lobo 595",
  "city_corrected": "São Paulo",
  "postal_corrected": "01414-000",
  "country_iso": "BR",
  "unit_type": "STE",
  "unit_number": "42",
  "floor": null,
  "correction_notes": "Expanded 'R.' to 'Rua'; mapped 'Cj 42' (Conjunto) to suite 42; inserted BR postal hyphen; normalized country 'Brasil' to BR.",
  "confidence": 0.92
}
```

The canonical `unit_type` values (`APT` / `STE` / `FL`) and the country-specific
postal formats reuse MCG's existing address-standardization vocabulary, so the
LLM output slots into the same downstream shape the rest of the pipeline expects.

---

## Outputs

| Output | Goes to | Contents |
|---|---|---|
| `out_corrected` | Existing Nominatim branch → `staging (validated)` → JOB 2 QVD | Corrected, structured address; `validation_status = "LLM_CORRECTED"`; `llm_confidence`, `llm_model`, `correction_notes` for provenance |
| `out_stewardship_llm` | Existing stewardship route (`sf_addresses_stewardship.csv` + Address Cleanup webhook) | Original address **plus** the LLM's suggested correction and notes, so the steward accepts/edits instead of retyping; `validation_status = "LLM_LOW_CONFIDENCE"` |
| Provenance columns | Carried to `silver.addresses_geocoded` | `llm_model`, `llm_confidence`, `correction_notes` alongside `validated_at_utc` — visible in the *Address Quality Impact* sheet as a drill dimension |

**Net effect for the demo:** more malformed multilingual addresses are
auto-repaired before geocoding, fewer records reach a human, and every steward who
does get a record starts from a proposed fix rather than a blank field — with a
full audit trail of what the model changed and how confident it was.

---

## What is grounded vs `[placeholder]`

**Grounded (reused MCG facts):** the host job and its two-job structure, the
15-minute TMC schedule, the Nominatim throttle, the stewardship webhook and
Address Cleanup sprint, automation #5, the QVD output and the *Address Quality
Impact* sheet, the canonical `unit_type` vocabulary and country postal formats,
and the list of Tier-1 cloud/on-prem models.

**`[placeholder]` (not yet grounded — do not invent):** the specific model
chosen, its endpoint, the confidence threshold `τ`, batch size, temperature, and
any throughput/accuracy/cost figures.

---

*LLM-assisted address-correction Agentic Route for Meridian Commerce Group*
*Tier-1 (LLM-in-task), additive to `mcg_sf_address_validate` — see `../README.md`*
*Qlik internal preview / roadmap (June 2026) — forward-looking; specifics subject to change*
