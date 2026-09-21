# Qlik Stewardship — the sprint API, found and documented

Research for standing up the stewardship sprint that receives the `UNRESOLVED` branch of
`mcg_crm_address_validate_bulk`. Tested against the live MCG tenant, August 2026.

---

## Bottom line

| Question | Answer |
|---|---|
| Which product does this tenant have? | **Qlik Cloud Data Stewardship** — the newer one. Its unit of work is a **sprint**, not a campaign |
| Is there an API to create a sprint? | **Yes.** `POST /api/data-governance/sprints/actions/create-external-sprint` |
| Is it documented? | **No.** Internal API — absent from qlik.dev, the changelog and help.qlik.com |
| Is the payload known? | **Yes** — recovered from the UI bundle and confirmed against the live API |
| Does it work? | **Yes** — sprint `7f87296d-c00e-4171-b0df-46414d28624c` is live. It must be created in a **data** space; see [below](#the-403-resolved) |
| How do records get loaded? | **`tDSOutput`** in Studio, or the sprint's external-integration records API |

And one correction to the repo: **`GET /api/v1/stewardship/tasks`**, which
`deploy/automations/automation-definitions.json:500` calls, **returns 404 on the live tenant.**
It matches no real API. Automation #5 polls a path that does not exist, for tasks nothing creates.

---

## How the API was found

Guessing endpoint names failed — ~40 candidates, all 404, because **the sprint API has no `/v1/`
segment**. It was found instead by reading the tenant's own micro-frontend bundles, which needs
only an API key (no browser, no login):

1. `GET /data-stewardship` returns a QMFE shell that loads `/qlik-embed/main.js`
2. That loader reads a module registry at **`/qmfe/import-map.json`** — 150 modules, including
   `"@qmfe/stewardship-ui": "/qmfe/stewardship-ui/0.29.0/qmfe-stewardship-ui.js"`
3. The stewardship bundle imports `@qlik-trial/qmfe-api/data-governance/sprints`
4. `"@qlik-trial/qmfe-api": "/qmfe/@qlik-trial/qmfe-api/5.46.0/dist/qmfe-api.js"` (468 KB) holds
   the **full route registry** for every sprint operation
5. The create-sprint form and its exact payload construction live in the lazy chunk
   `/qmfe/stewardship-ui/0.29.0/stewardship-ui.574.js`

Confirmed live:

```
GET /api/data-governance/sprints/external-integrations/actions/list-sprints  -> 200 {"sprints":[]}
GET /api/data-governance/sprints/actions/create-external-sprint              -> 405 (POST-only)
GET /api/data-governance/trust-scores                                        -> 200
```

`/api/v1/trust-scores` **also** returns 200 — that is the separate, documented public API. The
`/api/data-governance/*` family is the internal one the Stewardship UI actually drives.

---

## Sprint routes

Suffix codes from the registry: `G` GET · `GQ` GET+query · `P` POST · `PQ` POST+query ·
`PBJ` POST+JSON body · `PQBJ` POST+query+JSON body · `UBJ` PUT+JSON body · `DQ` DELETE+query.

| Method | Path (under `/api/data-governance/`) | Operation |
|---|---|---|
| **POST** | `sprints/actions/create-external-sprint` | **`createExternalSprint`** ← stand up a sprint |
| POST | `sprints/actions/create-sprint-from-seed` | `createSprintFromSeed` |
| POST | `sprints/actions/register-datafile-as-sprint-creation-seed` | `registerDatafileAsSprintCreationSeed` |
| POST | `sprints/actions/list-connection-{database,schema,table}-names` | connection browsing |
| GET | `sprints/external-integrations/actions/list-sprints` | `listExternalSprints` |
| GET / PUT | `sprints/{sprintId}` | `getSprint` / `updateSprint` |
| POST | `sprints/{sprintId}/actions/{open,close,export}` | lifecycle |
| POST | `sprints/{sprintId}/actions/delete` | `deleteSprint` |
| POST | `sprints/{sprintId}/actions/move-to-another-space` | `moveSprintToAnotherSpace` |
| GET | `sprints/{sprintId}/allowed-actions` | `getAllowedActionsOnSprint` |
| POST | `sprints/{sprintId}/executions` | `execute` |
| GET | `sprints/{sprintId}/executions/{executionId}/result` | `getExecutionResult` |
| GET | `sprints/{sprintId}/executions/{executionId}/state` | `getExecutionState` |
| **GET** | `sprints/{sprintId}/external-integrations/records` | `getExternalSprintRecords` |
| **POST** | `sprints/{sprintId}/external-integrations/records/actions/create-or-update` | **`createOrUpdateExternalRecords`** ← push records in |
| POST | `sprints/{sprintId}/external-integrations/records/actions/consume` | `markRecordsAsConsumedInExternalSprint` |
| POST | `sprints/{sprintId}/external-integrations/records/actions/delete-by-id` | `deleteRecordsInExternalSprintById` |
| DELETE | `sprints/{sprintId}/external-integrations/records` | `deleteRecordsInExternalSprintByFilter` |
| GET | `sprints/{sprintId}/external-integrations/sprint-summary` | `getExternalSprintSummary` |

There is deliberately **no** `GET /sprints` collection route — which is why probing the bare path
always 404'd.

> ⚠️ **Undocumented and unsupported.** This is the product's internal API. It can change without
> notice. Fine for a demo; do not build a customer deliverable on it without confirming with Qlik.

---

## `createExternalSprint` request body

Recovered from `stewardship-ui.574.js` (form defaults + payload construction), then confirmed
against the live API — it passes validation.

```json
{
  "name": "Address Cleanup",
  "spaceId": "<DATA space id>",
  "description": "...",
  "storageSettings": { "connectionType": "QLIK_CLOUD_STORAGE" },
  "sprintOwnerIds": ["<userId>"],
  "stewardIds": ["<userId>"],
  "workflowType": "ONE_STEP_VALIDATION",
  "assignationStrategy": "AUTO",
  "aiAssistance": { "isEnabled": false },
  "rulesMappings": [],
  "recordDataSchema": { "items": [
    { "name": "contact_id", "description": "CRM contact id",
      "isVisible": true, "isEditable": false,
      "standardType": { "name": "STRING" } }
  ]}
}
```

Enum values, all lifted from the bundle:

| Field | Values |
|---|---|
| `storageSettings.connectionType` | `QLIK_CLOUD_STORAGE` · `SNOWFLAKE` |
| `workflowType` | `ONE_STEP_VALIDATION` · `TWO_STEPS_VALIDATION` |
| `assignationStrategy` | `AUTO` · `MANUAL` |
| `standardType.name` | `STRING` `INTEGER` `DOUBLE` `DECIMAL` `BOOLEAN` `DATE` `TIME` `DATETIME` `TIMESTAMP` `BINARY` `CUSTOM` |

Per-column flags: `isVisible` controls whether the steward sees the field, `isEditable` whether
they can change it. For address cleanup, keep the `*_raw` fields visible but locked and make
`street_clean` / `city_clean` / `postal_clean` / `country_iso` editable.

The UI strips these form-only fields before POSTing: `seedId`, `dataSchemaOverride`,
`recordDataSchemaForm`, `inputSchemaName`, `nbEditableColumn`, `workflowCheckBox`, `population`.

The job's 12-column schema is built by `deploy/stewardship.js` — run it with `--dry-run` to print the exact payload.

Use `connectionType: QLIK_CLOUD_STORAGE` — confirmed by tenant flag
`TLV_1946_SUPPORT_QLIK_CLOUD_AS_STORAGE_FOR_SPRINTS = true`.

---

## The 403, resolved

With a valid payload the API returns:

```
HTTP 403
{"errors":[{"code":"NOT_ALLOWED_TO_CREATE_SPRINT",
  "title":"You don't have permission to access this resource.",
  "detail":"You don't have permission to create a sprint.",
  "meta":{"category":"FORBIDDEN"}}]}
```

Not a schema problem — an invalid body returns `INVALID_INPUTS`, and this call got past that into
authorization.

**Not a role problem either.** The calling user holds `TenantAdmin`, `Steward`, `DataAdmin`,
`DataServicesContributor`, `DataProductManager`, and every stewardship feature flag is on:

```
TLV_1305_QLIK_CLOUD_STEWARDSHIP_EAP              = true
TLV_1946_SUPPORT_QLIK_CLOUD_AS_STORAGE_FOR_SPRINTS = true
TLV_1889_STEWARDSHIP_AI_RESOLUTION_SPRINT        = true
DGAI_5078_STEWARDSHIP_STUDIO_INTEGRATION         = true
DGAI_5302_STEWARDSHIP_VALIDATION_RULES           = true
PS_19075_STEWARD_ROLE                            = true
```

**It was the space type — confirmed.** The failing call used the **shared** space
`MCG Demo - Development`. Retried against the **data** space `MCG Demo - DI`
(`6a31b72af70980dd4048c444`) and it succeeded on the first attempt:

```
$ node deploy/stewardship.js
Created sprint "Address Cleanup"
  sprintId : 7f87296d-c00e-4171-b0df-46414d28624c
  space    : MCG Demo - DI (data)
```

```
$ node deploy/stewardship.js --list
7f87296d-c00e-4171-b0df-46414d28624c  Address Cleanup
```

**`createExternalSprint` requires a data space.** Nothing else changed — same payload, same
API key, same roles. `NOT_ALLOWED_TO_CREATE_SPRINT` against a shared or managed space is the
product enforcing that rule, not a permissions or provisioning gap. The EAP-provisioning theory
was wrong.

---

## Loading records into the sprint

Creating the sprint is **one-time setup**. Loading records happens every run, and is a separate
concern:

1. **`tDSOutput`** — the Studio component that loads data into sprints/campaigns as tasks. It
   replaced the deprecated `tDataStewardshipTaskOutput` in Studio 8.0 R2025-12. Subscription
   component. This is the chosen path.
2. **The records API** —
   `POST /api/data-governance/sprints/{sprintId}/external-integrations/records/actions/create-or-update`,
   with `.../actions/consume` to mark rows handled and `.../records` (GET) to read corrections back.

The records API is what closes the loop: after a steward fixes an address, read it back and
re-run the job for those `contact_id`s.

---

## Ruled out

- **Talend Cloud Data Stewardship (the classic product)** — real REST API at
  `https://tds.{region}.cloud.talend.com/data-stewardship/api/v1/`, campaign types Arbitration /
  Resolution / Grouping / Merging. **Wrong product for this tenant** — that one has *campaigns*,
  this tenant has *sprints*. Noted only to explain why the repo's "campaign" wording is misleading.
- **Qlik Cloud Data Quality API** (`/v1/data-qualities/computations`, `/global-results`) — real,
  but computes quality metrics only. No stewardship or remediation.
- **The Talend API portal** (`talend.qlik.dev/apis/`) — lists Dynamic Engine, Account, Connections,
  Monitoring, Security, Dataset, Orchestration, Processing, Sharing, SCIM, Seats & Subscription.
  No Data Stewardship API.

---

## Tenant reference

| Thing | Value |
|---|---|
| Tenant | `qppqtcenterprise.us.qlikcloud.com` |
| Licence | `plan-qca-enterprise-qtc-enterprise-backfill` |
| Shared space | `MCG Demo - Development` — `69b03b3dc1a23ac15330a2b3` |
| Managed space | `MCG Demo - Published` — `69c1f1f1174ec801381a7f1b` |
| **Data space** | `MCG Demo - DI` — `6a31b72af70980dd4048c444` |
| Stewardship UI module | `@qmfe/stewardship-ui` `0.29.0` |
| API client module | `@qlik-trial/qmfe-api` `5.46.0` |
| Sprints today | none (`{"sprints":[]}`) |

---

## Sources

- [Validating and correcting your data with data stewardship — Qlik Cloud Help](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/DataIntegration/DataStewardship/Governing-data-stewardship.htm)
- [tDataStewardshipTaskOutput — Talend Components for Jobs](https://help.qlik.com/talend/en-US/components/8.0/data-stewardship/tdatastewardshiptaskoutput)
- [tDSDelete / tDataStewardshipTaskDelete — Talend Components for Jobs](https://help.qlik.com/talend/en-US/components/8.0/data-stewardship/tdsdelete)
- [Campaigns and tasks — Talend Cloud Data Stewardship](https://help.qlik.com/talend/en-US/data-stewardship-user-guide/Cloud/campaigns-and-tasks) *(the other product)*
- [Creating a campaign using the API — Talend Cloud Data Stewardship](https://help.qlik.com/talend/en-US/data-stewardship-user-guide/Cloud/api-tds-create-campaign) *(the other product)*
- [Data Quality API — Qlik Developer Portal](https://qlik.dev/changelog/136-data-quality-api/)
- [REST APIs index — Qlik Developer Portal](https://qlik.dev/apis/rest/)
- [Talend APIs portal](https://talend.qlik.dev/apis/)
- Primary evidence: the tenant's own bundles — `/qmfe/import-map.json`,
  `/qmfe/@qlik-trial/qmfe-api/5.46.0/dist/qmfe-api.js`,
  `/qmfe/stewardship-ui/0.29.0/stewardship-ui.574.js`
