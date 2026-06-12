# MCG Salesforce Pipeline via Talend — Address Validation & Geocoding

Two Talend Studio jobs (orchestrated in Talend Management Console) that pull Salesforce
every **15 minutes**, validate and geocode customer addresses, route bad records to
**Qlik Stewardship**, and land the clean result as a **QVD** consumed by the analytics apps.

This complements (does not replace) the declarative batch pipeline's CRM landing: the QTCP
pipeline lands raw Salesforce objects to bronze for the lakehouse story; this Talend leg
produces the *validated + geocoded* address dataset the Delivery & Customer Experience app
maps. It is also the job behind automation #5 (**MCG Address Correction Loop — Talend**),
which re-runs it for stewardship-approved corrections.

```
                       every 15 min (TMC schedule)
Salesforce ──► JOB 1: mcg_sf_address_validate
               ├── tSalesforceInput (Contact, incremental on LastModifiedDate)
               ├── tMap  — routines.AddressValidator (format check, Java)
               │     ├─ valid ────────────────────────────────► staging (validated)
               │     └─ invalid ─► tRESTClient (Nominatim geocode, 1 req/s)
               │           ├─ resolved (lat/lon + normalized) ─► staging (validated)
               │           └─ unresolved ─────────────────────► STEWARDSHIP route
               └── on-success ─► tRunJob: JOB 2
                   JOB 2: mcg_sf_address_to_qvd
               ├── tFileInputDelimited (staging, validated only)
               ├── tMap (final shape: contact grain + geo + audit columns)
               └── tQlikOutput ─► MCG_SF_Addresses_Validated.qvd  (Qlik Cloud DataFiles)

Qlik app reload task (cron, :05/:20/:35/:50) re-reads the QVD into
'MCG Delivery & Customer Experience'.
```

## Job 1 — `mcg_sf_address_validate`

| # | Component | Configuration |
|---|---|---|
| 1 | `tSalesforceInput` | Connection from context (`sf_*`); module `Contact`; columns `Id, FirstName, LastName, Email, MailingStreet, MailingCity, MailingState, MailingPostalCode, MailingCountry, LastModifiedDate`; SOQL condition `LastModifiedDate > ${context.sf_watermark}` (full pull on first run) |
| 2 | `tMap` (`map_validate`) | Output routing via **`routines.AddressValidator`** (below). Var `valid = AddressValidator.isValidFormat(row1.MailingStreet, row1.MailingCity, row1.MailingPostalCode, row1.MailingCountry)`. Output `out_valid` filter: `Var.valid`; output `out_invalid` filter: `!Var.valid`. `out_valid` adds `validation_status = "FORMAT_OK"`, `geo_confidence = 1.0` |
| 3 | `tFlowToIterate` + `tRESTClient` (`geo_nominatim`) | For `out_invalid` rows. GET `https://nominatim.openstreetmap.org/search`; query params `q = AddressValidator.buildNominatimQuery(street, city, postal, country)`, `format=json`, `limit=1`, `addressdetails=1`. HTTP header `User-Agent: MCG-Demo-Talend/1.0 (contact@mcg.example)`. **Throttle: `tSleep` 1100 ms per iteration** (Nominatim usage policy: max 1 req/s) |
| 4 | `tExtractJSONFields` | From the Nominatim response: `lat`, `lon`, `display_name`, `address.road`, `address.city` (fallback `address.town`/`address.village`), `address.postcode`, `address.country_code` |
| 5 | `tMap` (`map_geo_route`) | If `lat != null && lon != null` → `out_geocoded` (`validation_status = "GEOCODED"`, `geo_confidence = 0.8`, normalized fields from Nominatim). Else → `out_stewardship` (`validation_status = "UNRESOLVED"`) |
| 6 | `tUnite` → `tFileOutputDelimited` | `out_valid` + `out_geocoded` → `${context.staging_dir}/sf_addresses_validated.csv` (the Job 2 input) |
| 7 | `tFileOutputDelimited` + `tRESTClient` (stewardship route) | `out_stewardship` → `${context.staging_dir}/sf_addresses_stewardship.csv` **and** POST one summary to `${context.qlik_webhook_url}` (the deploy's *MCG Pipeline Health Alert* webhook) so the **Address Cleanup stewardship campaign** picks the batch up — `{"campaign":"Address Cleanup","source":"talend:mcg_sf_address_validate","count":<n>,"file":"sf_addresses_stewardship.csv"}` |
| 8 | `tRunJob` | On-subjob-OK → `mcg_sf_address_to_qvd` |

**TMC schedule:** every 15 minutes (`*/15 * * * *`), timezone UTC. Set the execution timeout
below 15 minutes so runs never overlap; Nominatim throttling bounds the invalid-row volume a
single run can geocode (~700/run) — backlog carries to the next run via the watermark.

## Job 2 — `mcg_sf_address_to_qvd`

| # | Component | Configuration |
|---|---|---|
| 1 | `tFileInputDelimited` | `${context.staging_dir}/sf_addresses_validated.csv` |
| 2 | `tMap` (`map_qvd_shape`) | Final schema: `contact_id, first_name, last_name, email, street_validated, city_validated, postal_code_validated, country_validated, latitude (Double), longitude (Double), geo_confidence (Double), validation_status, validated_at_utc = TalendDate.getDate("yyyy-MM-dd HH:mm:ss")` |
| 3 | `tQlikOutput` (Talend 8 Qlik components) | Qlik Cloud connection (tenant + API key from context); space `MCG Demo - Development`; write mode *overwrite*; output **`MCG_SF_Addresses_Validated.qvd`** in DataFiles |

> No Qlik components in your Studio build? Fallback: `tFileOutputDelimited` to
> `sf_addresses_validated_final.csv` + `qlik-cli`:
> `qlik raw post v1/temp-contents --query name=MCG_SF_Addresses_Validated.csv ...` —
> the app's load script will read either; QVD preferred for reload speed.

## The tMap routine

`routines/AddressValidator.java` — import into Talend Studio under *Code → Routines*.
Format rules: street must contain a number and a name; city non-empty alphabetic;
postal code must match the country pattern (NL `1234 AB`, DE/US 5-digit (US optional +4),
GB alphanumeric outward/inward, SG 6-digit, JP `123-4567`, BR `12345-678`); country must
resolve to a known ISO code. Anything failing goes down the Nominatim branch.

## Where the QVD lands in the apps

**`MCG Delivery & Customer Experience`** (app 2) loads the QVD as the `CustomerGeo` table,
linked to `CustomerAddresses` / `OrderTimeline` by `[Contact ID]`:

- **Address Quality Impact sheet** — the point-map layer ([Latitude]/[Longitude] colored by
  [Address Validation Status]) and the validated-vs-raw quality comparison
- **Last Mile Performance / WISMO sheets** — `[Address Validation Status]` and
  `[Geo Confidence]` as drill dimensions against late deliveries and WISMO rates

App 1 (Supply Chain Operations) does not consume the QVD — addresses are a CX-domain dataset.

## Keeping the dataset fresh end to end

1. **Talend (TMC):** Job 1 every 15 min → Job 2 rewrites the QVD (:00-ish).
2. **Qlik reload task:** the deploy's Step 12 creates *MCG Delivery Experience — Reload*
   with cron `0 5/15 * * * *` (:05/:20/:35/:50 UTC) — 5 minutes after each QVD drop, the
   app reload re-runs the QVS, which re-reads the QVD (guarded with `FileSize()` so the app
   still reloads cleanly before the first Talend run).
3. **Stewardship loop:** unresolved rows surface in the *Address Cleanup* campaign; approving
   a fix triggers automation #5, which re-runs Job 1 for the corrected records — the next
   QVD drop and app reload pick them up.

## Context variables (`contexts/mcg_talend_demo.properties`)

See the file for the full list: Salesforce credentials, Nominatim base URL + User-Agent,
staging directory, Qlik tenant/API key (Job 2), webhook URL, and the incremental watermark.
