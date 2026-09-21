# Staged: S3 → Iceberg address geocoding

**Nothing in this directory is deployed.** It sits outside `qtcp_tasks/` on purpose and is
excluded from `npm run pipeline:zip`, so importing the project today is unaffected.

## Why it is staged rather than wired

The GPS-resolved branch of `mcg_sf_address_validate_bulk` writes timestamped CSV to
`s3://mcg-open-lakehouse/talend/addresses/`. Landing that into the lakehouse needs three things
that do not exist yet:

1. the Open Lakehouse itself,
2. the S3 bucket, and
3. at least one run of the Talend job, so there is a file to land.

A `LAKE_LANDING` task pointed at a source connection that does not resolve fails at *prepare*,
which would break an otherwise-working pipeline import. So it waits here until the lakehouse
is up.

## Enabling it, once the lakehouse and bucket exist

1. **Create the S3 data connection** in Qlik Cloud, pointed at
   `s3://mcg-open-lakehouse/talend/addresses/` in `eu-west-1`. The values are already in
   `deploy/config.json` under `dataConnections.s3`.

   > Athena must sit in the **same region** as the bucket — `dataConnections.athena.region` is
   > already set to `eu-west-1` to match. Athena cannot query a bucket in another region.

2. **Move the task into the project:**

   ```bash
   mv "deploy/pipelines/mcg-batch-pipeline/staging-olh/MCG Address Geocoded Landing" "deploy/pipelines/mcg-batch-pipeline/qtcp_tasks/"
   ```

3. **Bind the source connection** — add `address-geo-landing-4103` to `bindings.json` alongside
   the existing landing tasks, pointing `sourceConnection` at the S3 connection from step 1.

4. **Add the task as a silver source.** In
   `qtcp_tasks/MCG Silver Transform/sourceSelection.yaml`, add:

   ```yaml
     - tablePattern: '%'
       sourceTask: 'address-geo-landing-4103'
       type: TABLE
   ```

5. **Join the real coordinates in.** `addresses_standardized.yaml` currently derives
   `address_quality_score` from a naive 0.25-per-populated-field rule and has no coordinates.
   Replace that with a `LEFT JOIN` onto the landed table — see `addresses_standardized.join.sql`
   in this directory for the exact SQL to paste into the dataset's `expressionStatement`.

6. **Create the Iceberg target** if you are loading through Athena rather than a landing task —
   `bundle/sql/create_silver_addresses_geocoded.sql` inside `mcg_sf_address_validate_bulk.zip`
   has the DDL, and §4 of `deploy/talend/BUILD_BULK_ADDRESS_JOB.md` has the `MERGE`.

   `MERGE`, not `INSERT`: stewardship-corrected records get reprocessed, so the same
   `contact_id` arrives more than once and must collapse to one row.

7. Re-import: `npm run pipeline:zip` (or `npm run deploy`).
