# Build: `mcg_sf_address_validate_bulk`

Free address ingestion → validation → **bulk** geocoding → GPS-based routing.
No Talend Data Quality subscription, no licensed postal reference data, no API key.

**Replaces** the subscription-only chain `tAddressRowStandardize` → `tAddressRowValidate`
→ `tGeocode` with four custom Java routines that are already compiled and unit-tested.

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
                    ▼  (downstream load, §4)
         Apache Iceberg — silver.addresses_geocoded
```

The routing gate is **GPS resolution**, nothing else: `latitude != null && longitude != null`.

---

## 1. Import the routines

Studio → **Repository → Code → Routines** → right-click → **Import routines**, pick all four
from `deploy/talend/routines/`:

| Routine | Replaces | What it does |
|---|---|---|
| `AddressStandardizer.java` | `tAddressRowStandardize` | Repairs country→ISO, postal→canonical, expands street abbreviations, extracts unit/floor, scores 0.0–1.0 |
| `BulkGeocoder.java` | `tAddressRowValidate` + `tGeocode` | One bulk call geocodes the batch via `java.net.http.HttpClient`; sets lat/lon/confidence |
| `AddressBatch.java` | — | Holds the batch between subjobs; typed getters for `tIterateToFlow` |
| `AddressValidator.java` | — | Original pass/fail gate, kept for compatibility; now delegates |

Verified: compiles clean on JDK 17 (`javac -Xlint:all`, zero warnings), 17/17 unit assertions pass,
live geocode confirmed against public Nominatim.

> `BulkGeocoder` uses `java.net.http` — **Java 11+**. Talend 8 ships Java 11/17, so it works as-is.

## 2. Context group

Import `deploy/talend/contexts/mcg_talend_demo.properties` as context group **`MCG_Demo`**.
Key values for a demo run:

| Variable | Value | Why |
|---|---|---|
| `sf_batch_limit` | `500` | Demo scale. 100 rows ≈ 2 min, 1000 ≈ 18 min |
| `nominatim_throttle_ms` | `1100` | OSM policy floor — **do not lower** |
| `geocode_max_concurrent` | `1` | Public Nominatim caps you at 1 req/s regardless |
| `geocode_budget_ms` | `900000` | 15-min ceiling; leftovers go to stewardship, job never stalls |
| `s3_bucket` / `s3_prefix` | `mcg-open-lakehouse` / `talend/addresses` | Where the GPS-resolved rows land |
| `aws_region` | `eu-west-1` | Leave the key/secret blank to use the instance/role credential chain |

---

## 3. The canvas

Five subjobs, linked **OnSubjobOk**. `tLogRow` after every stage so the data is visible as it moves.

```
[tJava init_batch]
      │ OnSubjobOk
      ▼
[tSalesforceInput] ─► [tLogRow ① RAW] ─► [tJavaRow standardize] ─► [tLogRow ② STANDARDIZED]
      │ OnSubjobOk
      ▼
[tJava bulk_geocode]                    ◄── the single bulk API call
      │ OnSubjobOk
      ▼
[tLoop] ═iterate═► [tIterateToFlow] ─► [tLogRow ③ GEOCODED] ─► [tMap map_route]
                                                                    ├─► [tLogRow ④ →S3] ─────────► [tFileOutputDelimited] ─► [tS3Put]
                                                                    └─► [tLogRow ⑤ →STEWARDSHIP] ─► [tFileOutputDelimited stewardship]
```

The S3 leg needs a connection subjob ahead of everything and a close at the end:

```
[tS3Connection] ──OnSubjobOk──► (the five subjobs above) ──OnSubjobOk──► [tS3Close]
```

Set every `tLogRow` to **Table (print values in cells of a table)** and tick **Print header**.

---

### 3.1 `tJava` — `init_batch`

```java
routines.AddressBatch.reset();
routines.BulkGeocoder.clearCache();
System.out.println("=== MCG address validation — batch limit " + context.sf_batch_limit + " ===");
```

### 3.2 `tSalesforceInput` — `sf_contacts`

- Connection: `context.sf_login_url` / `sf_username` / `sf_password` + `sf_security_token`
- Module: **Contact**
- Columns: `Id, FirstName, LastName, Email, MailingStreet, MailingCity, MailingState, MailingPostalCode, MailingCountry, LastModifiedDate`
- Condition: `LastModifiedDate > ${context.sf_watermark} LIMIT ${context.sf_batch_limit}`

### 3.3 `tLogRow` ① — `log_raw`

Shows what Salesforce actually holds — the dirty input. This is the "before" in the demo.

### 3.4 `tJavaRow` — `standardize`

Output schema (`row2`) — add these columns:

| Column | Type | | Column | Type |
|---|---|---|---|---|
| `contact_id` | String | | `city_clean` | String |
| `street_raw` | String | | `state_clean` | String |
| `city_raw` | String | | `postal_clean` | String |
| `postal_raw` | String | | `country_iso` | String |
| `country_raw` | String | | `quality_score` | Double |
| `street_clean` | String | | `status` | String |
| `house_number` | String | | `corrections` | String |
| `unit_type` | String | | `unit_number` | String |
| `floor` | String | | | |

Code:

```java
routines.AddressStandardizer.Result r = routines.AddressStandardizer.standardize(
        row1.Id, row1.MailingStreet, row1.MailingCity,
        row1.MailingState, row1.MailingPostalCode, row1.MailingCountry);
r.firstName = row1.FirstName;
r.lastName  = row1.LastName;
r.email     = row1.Email;
routines.AddressBatch.add(r);

row2.contact_id   = r.contactId;
row2.street_raw   = r.streetRaw;
row2.city_raw     = r.cityRaw;
row2.postal_raw   = r.postalRaw;
row2.country_raw  = r.countryRaw;
row2.street_clean = r.streetClean;
row2.house_number = r.houseNumber;
row2.unit_type    = r.unitType;
row2.unit_number  = r.unitNumber;
row2.floor        = r.floor;
row2.city_clean   = r.cityClean;
row2.state_clean  = r.stateClean;
row2.postal_clean = r.postalClean;
row2.country_iso  = r.countryIso;
row2.quality_score= r.qualityScore;
row2.status       = r.status;
row2.corrections  = r.correctionsJson();
```

### 3.5 `tLogRow` ② — `log_standardized`

The repair step made visible: `1017ej` → `1017 EJ`, `Nederland` → `NL`, `Cj 42` → `STE 42`,
`Kurfurstenstr.` → `Kurfurstenstraße`, `3. OG` → floor `3`. The `corrections` column
spells out every change as JSON — this is the demo money shot.

### 3.6 `tJava` — `bulk_geocode` ← **the bulk API call**

```java
routines.BulkGeocoder.Summary s = routines.BulkGeocoder.geocodeAll(
        routines.AddressBatch.all(),
        context.nominatim_base_url,
        context.nominatim_user_agent,
        context.nominatim_throttle_ms,
        context.geocode_max_concurrent,
        context.geocode_budget_ms);

System.out.println("=== BULK GEOCODE ===");
System.out.println("  " + s);
globalMap.put("batch_size", Integer.valueOf(routines.AddressBatch.size()));
```

One call for the whole batch. Internally it dedupes identical addresses, respects the
1 req/s policy with a shared rate limiter, retries `429`/`503` with backoff, and gives up
gracefully at `geocode_budget_ms`. It never throws — anything it can't resolve simply
arrives without GPS and lands in stewardship.

Console prints e.g.
`BulkGeocoder: 500 in, 471 geocoded, 29 unresolved, 118 cache hits, 382 HTTP requests, 421033 ms`

### 3.7 `tLoop` — `loop_rows`

- Type: **For**
- From `0`, to `((Integer)globalMap.get("batch_size")).intValue() - 1`, step `1`

### 3.8 `tIterateToFlow` — `emit_rows`

Schema = everything from §3.4 **plus** `latitude` (Double), `longitude` (Double),
`geo_confidence` (Double), `reason` (String).

Every expression takes the loop index. Define it once as the repeated fragment
`(Integer)globalMap.get("tLoop_1_CURRENT_VALUE")` (adjust the component number if yours differs):

```java
routines.AddressBatch.contactId((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.streetRaw((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.cityRaw((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.postalRaw((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.countryRaw((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.street((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.houseNumber((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.unitType((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.unitNumber((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.floor((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.city((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.state((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.postalCode((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.countryIso((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.qualityScore((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.status((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.corrections((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.latitude((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.longitude((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.geoConfidence((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
routines.AddressBatch.reason((Integer)globalMap.get("tLoop_1_CURRENT_VALUE"))
```

All getters are bounds- and null-safe — an out-of-range index yields `null`, not an exception.

### 3.9 `tLogRow` ③ — `log_geocoded`

The full batch with GPS attached. `status` now reads `GEOCODED` or `UNRESOLVED`.

### 3.10 `tMap` — `map_route` ← **the routing gate**

Two outputs, filters are exact complements so no row is lost or duplicated:

| Output | Filter expression | Destination |
|---|---|---|
| `out_olh` | `row3.latitude != null && row3.longitude != null` | Open Lakehouse |
| `out_stewardship` | `row3.latitude == null \|\| row3.longitude == null` | Qlik Stewardship |

`out_olh` columns: `contact_id, street_clean, house_number, unit_type, unit_number, floor,
city_clean, state_clean, postal_clean, country_iso, latitude, longitude, geo_confidence,
quality_score, status, corrections` + `validated_at_utc` =
`TalendDate.getDate("yyyy-MM-dd HH:mm:ss")`

`out_stewardship` columns: raw fields **and** the repaired ones, plus `reason` — so the steward
sees what came in, what the job managed to fix, and precisely why it still needs a human.

### 3.11 `tLogRow` ④ / ⑤ + outputs

| Branch | tLogRow | Output |
|---|---|---|
| `out_olh` | `log_to_s3` | `tFileOutputDelimited` → **`tS3Put`** (see §3.12) |
| `out_stewardship` | `log_to_stewardship` | `tFileOutputDelimited` → `${context.stewardship_dir}/addresses_for_review.csv` |

### 3.12 Writing to S3

The Open Lakehouse branch writes **files to S3**. Loading those files into the Iceberg table is
a separate downstream step (§4) — the job itself never talks to Iceberg, which keeps it free of
the Iceberg Feature Manager install and any JDBC driver setup.

**Components** (all standard, no extra install):

| # | Component | Configuration |
|---|---|---|
| 1 | `tS3Connection` (`s3_conn`) | First subjob. Region `${context.aws_region}`. Leave keys blank to use the instance/role credential chain, otherwise `${context.aws_access_key_id}` / `${context.aws_secret_access_key}` |
| 2 | `tFileOutputDelimited` (`write_olh_file`) | `${context.olh_staging_dir}/addresses_geocoded_<ts>.csv` — CSV, **header on**, UTF-8, quote all |
| 3 | `tS3Put` (`put_olh`) | On-subjob-OK. Bucket `${context.s3_bucket}`, key `${context.s3_prefix}/addresses_geocoded_<ts>.csv`, file = the local file from step 2 |
| 4 | `tS3Close` (`s3_close`) | Final subjob |

Use a timestamped filename so every run lands a new object and the downstream load is a simple
"read what's new" — never an in-place overwrite.

> Set the timestamp once in the `init_batch` `tJava` so every component agrees:
> ```java
> globalMap.put("jobtimestamp", TalendDate.getDate("yyyyMMddHHmmss"));
> ```
> then reference it as `((String)globalMap.get("jobtimestamp"))`.

**Why CSV.** It is available in every Studio edition and Athena, Spark and Trino all read it
directly. If your Studio has Parquet output available, prefer `tFileOutputParquet` — typed,
columnar, and the format Iceberg stores natively, so the load step gets cheaper.

The stewardship branch is unchanged: `tFileOutputDelimited` →
`${context.stewardship_dir}/addresses_for_review.csv`.

### 3.13 Reference: the Iceberg component family

Not used by this job — we write S3 and load separately — but recorded here since it is the
alternative if you ever want Talend to write Iceberg directly.

The family is **not shipped with Studio by default**; install it via **Feature Manager**
(Help → Feature Manager). Needs Studio **8.0.1-R2023-10+**; `tIcebergCatalog` needs R2024-02+,
the Spark variants R2024-04+.

| Component | Purpose |
|---|---|
| `tIcebergConnection` | Connects to an Iceberg-compatible database **through JDBC** |
| `tIcebergOutput` | Writes rows to an Iceberg table (appends; *Use insert overwrite* for full refresh) |
| `tIcebergInput` | Reads from an Iceberg table |
| `tIcebergMerge` | MERGE / upsert — the right choice for re-processed `contact_id`s |
| `tIcebergRow` | Executes arbitrary SQL |
| `tIcebergTable` | Creates / truncates / deletes tables (via Hive or Impala) |
| `tIcebergCatalog` | Custom catalog — **Hadoop / Hive / Custom only, no built-in AWS Glue type** |
| `tIcebergSQL` | SQL for Polaris and Snowflake Open Catalog managed tables |
| `tIcebergClose` | Closes the connection |

Two things bite if you go that route: these components reach Iceberg *over JDBC*, so they need an
engine (Athena, Hive, Impala, Trino) in front of the tables; and there is no Glue catalog type, so
a direct `tIcebergCatalog` needs **Custom** with implementation
`org.apache.iceberg.aws.glue.GlueCatalog`. Going through Athena avoids both, since Athena already
resolves the Glue catalog.

## 4. Landing the two branches

**S3 → Open Lakehouse.** The job drops a timestamped CSV in
`s3://${s3_bucket}/${s3_prefix}/` (§3.12) and stops there. Loading it into the Iceberg table
`silver.addresses_geocoded` is a downstream step you own. Three ways to do it:

1. **Athena** — point an external table at the S3 prefix, then `INSERT INTO … SELECT`:
   ```sql
   CREATE EXTERNAL TABLE IF NOT EXISTS staging.addresses_geocoded_raw (
     contact_id string, street_clean string, house_number string,
     unit_type string, unit_number string, floor string,
     city_clean string, state_clean string, postal_clean string, country_iso string,
     latitude double, longitude double, geo_confidence double,
     quality_score double, status string, corrections string, validated_at_utc string
   ) ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.OpenCSVSerde'
   LOCATION 's3://mcg-open-lakehouse/talend/addresses/'
   TBLPROPERTIES ('skip.header.line.count'='1');

   MERGE INTO silver.addresses_geocoded t
   USING staging.addresses_geocoded_raw s ON t.contact_id = s.contact_id
   WHEN MATCHED THEN UPDATE SET
     latitude = s.latitude, longitude = s.longitude, geo_confidence = s.geo_confidence,
     street_clean = s.street_clean, city_clean = s.city_clean,
     postal_clean = s.postal_clean, country_iso = s.country_iso,
     quality_score = s.quality_score, status = s.status,
     corrections = s.corrections, validated_at_utc = s.validated_at_utc
   WHEN NOT MATCHED THEN INSERT (…) VALUES (…);
   ```
   `MERGE` matters here: stewardship-corrected records get re-processed, so the same
   `contact_id` arrives more than once. Merging keeps one row per contact.

2. **A Qlik Cloud Pipeline** — add an S3 landing task to the batch project, which is the most
   consistent option given `deploy/pipelines/` already owns bronze→silver.

3. **Spark / Trino** — `INSERT INTO … SELECT` against the same external table.

Create the Iceberg target once:

```sql
CREATE TABLE IF NOT EXISTS silver.addresses_geocoded (
  contact_id string, street_clean string, house_number string,
  unit_type string, unit_number string, floor string,
  city_clean string, state_clean string, postal_clean string, country_iso string,
  latitude double, longitude double, geo_confidence double,
  quality_score double, status string, corrections string, validated_at_utc timestamp
) LOCATION 's3://mcg-open-lakehouse/warehouse/silver/addresses_geocoded/'
TBLPROPERTIES ('table_type'='ICEBERG', 'format'='parquet');
```

Once loaded, the batch pipeline's `addresses_standardized` dataset can `LEFT JOIN` it on
`contact_id` to pick up real `latitude` / `longitude` / `geo_confidence`, replacing the naive
0.25-per-field score it computes today — see
[addresses_standardized.yaml](deploy/pipelines/mcg-batch-pipeline/qtcp_tasks/MCG%20Silver%20Transform/datasets/addresses_standardized.yaml).

Because the table is open Iceberg on S3, Athena, Spark, Trino and the Qlik analytics apps all
read the same copy — the point of the Open Lakehouse story.

**Stewardship.** The `UNRESOLVED` rows go to a Qlik Cloud Data Stewardship **sprint**
(the newer product uses *sprints*, not campaigns). Two ways in:

1. **`tDSOutput`** — the Studio component that loads records into a sprint as tasks. Subscription
   component; it replaced the deprecated `tDataStewardshipTaskOutput` in Studio 8.0 R2025-12.
2. **The sprint's external-integration API** —
   `POST /api/data-governance/sprints/{sprintId}/external-integrations/records/actions/create-or-update`.

Standing the sprint up is a **one-time** setup, separate from the per-run load. Full API details,
payload schema and the current blocker are in
**[STEWARDSHIP_API_FINDINGS.md](deploy/talend/STEWARDSHIP_API_FINDINGS.md)**.

> ⚠️ **`GET /api/v1/stewardship/tasks` is not a real endpoint.** It returns **404 on the live
> tenant**. Automation #5 (`automation-definitions.json:500`) polls a path that does not exist,
> for tasks nothing creates. It needs replacing with the real records API:
> `GET /api/data-governance/sprints/{sprintId}/external-integrations/records`.

---

## 5. Run it

**Run** → watch the console. You get five tables in sequence: raw → standardized → geocoded →
lakehouse branch → stewardship branch, plus the `BulkGeocoder` summary line between ② and ③.

Verified behaviour from the live test (3 addresses, real Nominatim):

```
  g1   GEOCODED     lat=52.36541     lon=4.88698    conf=0.8   -> OPEN LAKEHOUSE
  g2   GEOCODED     lat=51.50321     lon=-0.12713   conf=0.8   -> OPEN LAKEHOUSE
  g3   UNRESOLVED   lat=-            lon=-          conf=0.0   -> STEWARDSHIP
  BulkGeocoder: 3 in, 2 geocoded, 1 unresolved, 0 cache hits, 3 HTTP requests, 3189 ms
```

3 requests in 3.19 s confirms the 1.1 s policy gate is being honoured.

---

## 6. Status

### Done

1. **The stewardship sprint exists.** `node deploy/stewardship.js` creates it via
   `POST /api/data-governance/sprints/actions/create-external-sprint`. The 403 was the **space
   type** — sprints must live in a **data** space; a shared space returns
   `NOT_ALLOWED_TO_CREATE_SPRINT`. Sprint `7f87296d-c00e-4171-b0df-46414d28624c` ("Address
   Cleanup") is live in `MCG Demo - DI`, and the id is persisted to `config.json`. See
   [STEWARDSHIP_API_FINDINGS.md](STEWARDSHIP_API_FINDINGS.md).
2. **`automation-definitions.json` no longer calls a nonexistent endpoint.** The fictional
   `GET /api/v1/stewardship/tasks` and `PUT /api/v1/stewardship/tasks/{id}` are replaced with the
   real records API (`.../external-integrations/records` and `.../records/actions/consume`).
3. **Doc reconciliation.** `creation_guide.md`, `setup_guide.md`, `demo_checklist.md`,
   `automation_guide.md`, `scenarios.md`, `deploy/talend/README.md` and the generators that
   produce them now describe the free routines instead of the paid `tAddressRow*` chain, and say
   "sprint" throughout (104 replacements). Fixes went into the **generators** as well as the
   checked-in markdown, so a regenerate does not undo them.
4. **An import bundle exists.** `npm run talend:zip` produces
   `deploy/talend/mcg_sf_address_validate_bulk.zip` — deterministic, with the four routines as
   raw `.java` *and* as a synthesized Studio project tree, the context group, this spec and the
   Iceberg DDL.

5. **Deploy + admin UI wiring.** `deploy-to-qlik.js` gained **Step 15** (sprint + automation
   workspaces, gated on `enabledComponents.stewardship`), and the deploy UI gained a
   **Stewardship** wizard page (step 11 of 11) that creates the sprint, edits the record schema,
   and authors the workspaces. New npm scripts: `stewardship:sprint`, `stewardship:sprint:list`,
   `stewardship:sprint:dry-run`, `automations:workspaces`, `talend:zip`.
6. **S3 config.** `config.json` now carries the bucket (`mcg-open-lakehouse`), prefix
   (`talend/addresses`) and region, and Athena was moved to `eu-west-1` to match — Athena cannot
   query a bucket in another region, and the two were previously contradictory.
7. **All five MCG automations have real block graphs and finish green.** They were empty shells
   (`workspace: null`). Now: *Daily App Reload* (verified — it queued real reloads of both MCG
   apps, both SUCCEEDED), *Address Correction*, *Stewardship Sprint Summary*, *Cold Chain Alert*
   and *Pipeline Health*. A junk automation literally named `automation-definitions` was deleted
   and its cause fixed — the template loader was treating the definitions CATALOG as a single
   automation template.
8. **Automation #5 runs green against the real stewardship API.** The Qlik Cloud Services
   *raw API request* block cannot reach `/api/data-governance/*` (404 *Unknown Service* — the
   automations runtime resolves the tenant's internal alias host; absolute URLs and `../` escapes
   fail identically). The stewardship blocks were therefore moved to the **API Key** connector,
   which addresses the public hostname, and that connection is now created **entirely over the
   API**. The trick: `POST /api/v1/automation-connections` wants the connector's OWN parameter
   objects with `.value` filled in — posting bare `{id, value}` pairs returns 201 and silently
   stores nothing (`isConnected: false`). Recovered from the Add Connection modal in
   `/qmfe/automation-connections/1.5.6/*`. Both automations now finish successfully.

### Still open

9. **The job canvas has no `.item`/`.properties` artifact.** The five-subjob canvas is still
   assembled in Studio from §3 — that step needs Studio itself. To close it: build it once,
   **File → Export items**, unpack the export into `deploy/talend/job/`, and re-run
   `npm run talend:zip`, which packages whatever is there with no code change.
10. **S3 → Iceberg waits on the lakehouse.** The load is fully specified and the artifacts are
   staged in `deploy/pipelines/mcg-batch-pipeline/staging-olh/` — a `LAKE_LANDING` task, the
   `LEFT JOIN` SQL that replaces the naive 0.25-per-field quality score with real
   latitude/longitude, and a step-by-step enable guide. It is deliberately outside `qtcp_tasks/`
   and excluded from `npm run pipeline:zip`: a landing task pointed at a source connection that
   does not resolve fails at *prepare* and would break an otherwise-working import. Enable it
   once the lakehouse, the bucket and one Talend run exist.

11. **The two Teams automations cannot post until Teams is authorized.** Microsoft Teams is an
    OAuth connector — its only connection parameter is `permissions`, so it is connected through
    a browser consent flow, not an API call. Both graphs are authored and run green; their send
    block ships **disabled** with a comment saying what to do. Connect Teams once under
    Automations → Connections, set `automations.teamsTeamId` / `teamsChannelId` in `config.json`,
    and re-run `npm run automations:workspaces` — the block enables itself.

### Known behaviour, not a defect

Block-output expressions (`{ $.SomeBlock.field }`) resolve to empty in this tenant, so the
address-correction automation does **not** branch on a record count. That turned out to be the
right shape anyway: "consume" means *these corrections are handled*, and at that point in the
flow Talend has not applied them yet — acknowledging first would let a Talend failure silently
lose a steward's work. The automation surfaces the records; the Talend job applies them and then
consumes them, where a plain API key works. The consume block is wired and documented in the
graph but **disabled**, so the full loop is visible in the designer without running out of order.
