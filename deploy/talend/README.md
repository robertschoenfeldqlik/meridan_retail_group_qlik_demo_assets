# MCG Salesforce Pipeline via Talend — Address Standardization, Bulk Geocoding & Stewardship

A Talend Studio job (`mcg_sf_address_validate_bulk`, orchestrated in Talend Management Console)
that pulls Salesforce Contacts, repairs and scores every address, geocodes the batch in **one
bulk call**, and routes each row on a single gate — **did we get GPS?**

- **GPS resolved** → timestamped CSV to **S3**, loaded downstream into the Apache Iceberg table
  `silver.addresses_geocoded` in the Open Lakehouse
- **GPS unresolved** → the **Address Cleanup** stewardship **sprint** for a human

This complements (does not replace) the declarative batch pipeline's CRM landing: the QTCP
pipeline lands raw Salesforce objects to bronze for the lakehouse story; this Talend leg produces
the *validated + geocoded* address dataset. It is also the job behind automation #5
(**MCG Address Correction Loop — Talend**), which re-runs it for stewardship-approved corrections.

```
                        ┌──────────────────────────────────────┐
Salesforce Contacts ───► │ standardize (repair + score)         │
   (100–1000 rows)      │ ONE bulk call → GPS for the batch    │
                        └────────────────┬─────────────────────┘
                                         │
                        ┌────────────────┴─────────────────┐
                        ▼                                  ▼
                GPS resolved                        GPS not resolved
                        │                                  │
                        ▼                                  ▼
                ██ S3 ██                        ██ QLIK STEWARDSHIP ██
         s3://…/addresses_geocoded_<ts>.csv       "Address Cleanup" sprint
                    │                             (tDSOutput / records API)
                    ▼  (downstream load)
         Apache Iceberg — silver.addresses_geocoded
```

The routing gate is **GPS resolution**, nothing else: `latitude != null && longitude != null`.

## Where the detail lives

| Document | What it covers |
|---|---|
| **[BUILD_BULK_ADDRESS_JOB.md](BUILD_BULK_ADDRESS_JOB.md)** | The build spec — five subjobs, component by component, plus the S3 → Iceberg load options and the Iceberg component reference |
| **[STEWARDSHIP_API_FINDINGS.md](STEWARDSHIP_API_FINDINGS.md)** | The sprint API: how it was found, the full route table, the create payload, and why it must be a **data** space |
| `routines/*.java` | The four custom routines, compiled and unit-tested |
| `contexts/mcg_talend_demo.properties` | Context group `MCG_Demo` — Salesforce, Nominatim, S3/AWS, Iceberg, Qlik |

## The routines — free replacements for the paid components

These replace the subscription-only `tAddressRowStandardize` → `tAddressRowValidate` → `tGeocode`
chain. **No Talend Data Quality subscription, no licensed postal reference data, no API key.**

| Routine | Replaces | What it does |
|---|---|---|
| `AddressStandardizer.java` | `tAddressRowStandardize` | Repairs country→ISO, postal→canonical, expands street abbreviations, extracts unit/floor, scores 0.0–1.0, emits every change as JSON |
| `BulkGeocoder.java` | `tAddressRowValidate` + `tGeocode` | One bulk call geocodes the batch via `java.net.http.HttpClient`; shared 1 req/s limiter, dedupe cache, 429/503 backoff, wall-clock budget |
| `AddressBatch.java` | — | Holds the batch between subjobs; bounds- and null-safe typed getters for `tIterateToFlow` |
| `AddressValidator.java` | — | Original pass/fail gate, kept for compatibility; now delegates |

Verified: compiles clean on JDK 17 (`javac -Xlint:all`, zero warnings), 17/17 unit assertions
pass, live geocode confirmed against public Nominatim.

> `BulkGeocoder` uses `java.net.http` — **Java 11+**. Talend 8 ships Java 11/17, so it works as-is.

## Getting it into Studio

```bash
npm run talend:zip
```

Produces `deploy/talend/mcg_sf_address_validate_bulk.zip` (deterministic — same inputs, same
bytes). Three layers, described in the `IMPORT.md` inside it:

1. **`bundle/`** — the raw `.java` routines, the context group, the build spec and the Iceberg
   DDL. Always correct; this is the manual path, just packaged.
2. **`MCG_DEMO/`** — a synthesized Talend project tree so the routines import in one action.
   Not verified against a live Studio; fall back to layer 1 if it is rejected.
3. **`studio-export/`** — empty until you build the canvas once, **File → Export items**, and
   unpack the export into `deploy/talend/job/`. The script then packages it with no code change.

## The stewardship sprint

The `UNRESOLVED` branch feeds a Qlik Cloud Data Stewardship **sprint** (the newer product uses
*sprints*, not campaigns). Creating it is one-time setup and is **automated**:

```bash
node deploy/stewardship.js
```

The sprint must live in a **data** space — `createExternalSprint` returns
`403 NOT_ALLOWED_TO_CREATE_SPRINT` against a shared or managed space. The script defaults to the
`data` space from `config.json` and writes the resulting `sprintId` back to config. Use
`--dry-run` to print the payload, `--list` to see what exists.

Loading records every run is separate, and there are two ways in:

1. **`tDSOutput`** — the Studio component that loads records into a sprint as tasks. Subscription
   component; it replaced the deprecated `tDataStewardshipTaskOutput` in Studio 8.0 R2025-12.
2. **The records API** —
   `POST /api/data-governance/sprints/{sprintId}/external-integrations/records/actions/create-or-update`,
   with `.../actions/consume` to mark rows handled and `.../records` (GET) to read corrections back.

> ⚠️ **Gateway limit.** Those `/api/data-governance/*` calls work from any ordinary API-key client
> (this is exactly what `deploy/stewardship.js` does) but **not** from a Qlik Cloud Services
> *raw API request* block inside an automation — that block only routes `/api/v1/*` and returns
> 404 *Unknown Service* for anything else. Established by live runs. An automation that needs
> these calls must use the **API Key** connector against the public tenant hostname, or leave
> them to the Talend job.

## Keeping the dataset fresh end to end

1. **Talend (TMC):** the job runs on its schedule → new timestamped CSV in
   `s3://${s3_bucket}/${s3_prefix}/`.
2. **Downstream load:** S3 → Iceberg `silver.addresses_geocoded` (Athena `MERGE`, a Qlik Cloud
   Pipeline, or Spark/Trino — see BUILD_BULK_ADDRESS_JOB.md §4). `MERGE` matters: corrected
   records get reprocessed, so the same `contact_id` arrives more than once.
3. **Stewardship loop:** unresolved rows surface in the *Address Cleanup* sprint; a steward's fix
   is picked up by automation #5, which re-runs the job for those records.

Because the table is open Iceberg on S3, Athena, Spark, Trino and the Qlik analytics apps all read
the same copy — the point of the Open Lakehouse story.

## Context variables (`contexts/mcg_talend_demo.properties`)

See the file for the full list: Salesforce credentials, batch limit, Nominatim base URL +
User-Agent + throttle + budget, staging directories, S3 bucket/prefix/region, the downstream
Iceberg coordinates, and the Qlik tenant/API key/data-space id.
