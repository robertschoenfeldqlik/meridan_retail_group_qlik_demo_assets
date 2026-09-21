# Meridian CRM (MySQL) — setup and verification

Replaces the old SaaS-CRM runbook, which documented an external org, an OAuth
application, a callback URL and a permission set — about forty minutes of
clicking, all of it expiring eventually. The CRM is now a container in this
repo, so the whole thing is one command.

---

## 1. Bring it up

```bash
npm run docker:up:simulators
```

That starts five services. Three of them are the CRM:

| Container | What it is |
|---|---|
| `mcg-mysql` | MySQL 8.4, host port **3307**, binary log on |
| `mcg-seed-data` | One-shot. Creates the schema, loads the demo population, exits 0 |
| `mcg-mysql-crm-simulator` | Long-running. Inserts, updates and deletes continuously |

Port 3307, not 3306: the Data Movement gateway container binds 3306. Inside the
compose network the database is plain `mysql:3306`, so the gateway connection is
unaffected by the host-side port.

> The npm scripts run through `deploy/compose.js`, which finds podman or docker
> automatically. Do not call `docker compose` directly — on a Podman host there
> is no `docker` executable and it fails with ENOENT.

## 2. Check it

```bash
npm run db:crm
```

```sql
SELECT COUNT(*) FROM crm_contacts;   -- ~120
SELECT COUNT(*) FROM crm_orders;     -- ~600
SELECT COUNT(*) FROM crm_products;   -- ~50

-- CDC prerequisites
SHOW VARIABLES LIKE 'log_bin';            -- ON
SHOW VARIABLES LIKE 'binlog_row_image';   -- FULL
SHOW BINARY LOG STATUS;                   -- a file and a position
```

The seeder is idempotent. Running it again on a populated database logs
`CRM already seeded … skipping` and changes nothing, so a restarted container
cannot silently double the dataset.

## 3. The schema

`simulators/mysql_schema.sql`. Three tables, snake_case, `mcg_crm` database.

| Table | Key | Nightmares |
|---|---|---|
| `crm_contacts` | `contact_id` VARCHAR(18) | #2 Address catastrophe |
| `crm_orders` | `order_id` VARCHAR(30) | #2, #6 Carrier data black hole |
| `crm_products` | `sku` VARCHAR(40) | #3 Product master mess, #7 Compliance gap |

Every table carries `last_modified_date DATETIME(3) ... ON UPDATE
CURRENT_TIMESTAMP(3)`. That is the watermark the 15-minute incremental landing
reads. Drop it and the incremental cycle quietly degrades into a full reload.

**The nullability is load-bearing.** The demo's data-quality story is built on
which values are genuinely absent:

| Column | Absent because |
|---|---|
| `mailing_state` | City-states (Singapore) have none |
| `weight_kg` NULL | Never captured |
| `weight_kg` 0.00 | Captured wrong — a *different* defect, and both must survive |
| `country_of_origin` | Missing on perishables — the compliance gap |
| `tracking_number` | ~42% of orders; the smaller carriers return nothing |

Never add `NOT NULL DEFAULT ''` to an optional column. The silver layer scores
quality with `IS NOT NULL AND TRIM(x) <> ''`; an empty-string default makes every
check pass and deletes the entire address-quality demo without any error.

## 4. What the simulator does

`simulators/mysql_crm_simulator.py`, one cycle every 10 seconds, gated by time of
day and day of week so the feed looks organic.

It inserts — and, unlike the SaaS feed it replaced, it also **changes** things:

1. **Order lifecycle.** Orders are born `PROCESSING` and walked forward:
   `SHIPPED` → `IN_TRANSIT` → `DELIVERED` or `DELIVERY_FAILED`. Tracking numbers
   appear at SHIPPED, delivery dates at DELIVERED.
2. **Address correction.** A dirty address variant is rewritten in place to the
   clean spelling of the same real address — `"Atlanta, GA"` becomes `"Atlanta"`.
   Nightmare #2 resolving on camera, with `address_quality_score` moving with it.
3. **Order deletion.** Rare (about 1 cycle in 200), old orders only. Contacts and
   products are never deleted; that would orphan the silver joins.

This matters more than it sounds. The old feed was insert-only, so its change
stream contained nothing but inserts and log-based CDC had nothing to
demonstrate. Prove the difference:

```sql
SHOW BINLOG EVENTS IN 'mysql-bin.000003';
```

Expect `Update_rows` and `Delete_rows` alongside `Write_rows`.

To watch it live, run this twice a minute apart:

```sql
SELECT order_status, COUNT(*) FROM crm_orders GROUP BY order_status;
SELECT COUNT(*) FROM crm_orders WHERE last_modified_date > created_date;
```

`--no-mutations` turns the change traffic off. It exists for debugging and makes
the CDC demo pointless; do not use it for a demo.

## 5. The Qlik connection

**`npm run deploy` creates it** once `dataGateway.id` is set in
`deploy/config.json`. It is a gateway-bound replication source
(`repsrc_mysql`), the same mechanism as the WMS — no interactive login, nothing
to paste back, so the deploy no longer has to skip a step.

To build it by hand instead — Data Integration → Create connection → MySQL:

| Field | Value |
|---|---|
| Name | `MCG CRM Database` (exactly — the pipeline binding resolves by name) |
| Space | `MCG Demo - DI` |
| Data gateway | `MCG_DATA_MOVEMENT` |
| Host | reachable **from the gateway container**: `mysql`, or the host IP |
| Port | `3306` inside the compose network, `3307` from the host |
| Database | `mcg_crm` |
| Username | `qlik_cdc` |
| Password | `MYSQL_PASSWORD` in `infrastructure/.env` |

`qlik_cdc` is created by `infrastructure/mysql-init/01-cdc-user.sql` on the
database's first boot. It holds `REPLICATION SLAVE`, `REPLICATION CLIENT`,
`RELOAD` and `SHOW DATABASES` globally plus `SELECT` on `mcg_crm` — enough to read
the binary log, and nothing more. The gateway's own bundled MySQL has no such
account and connects as root; this one does not.

After creating it by hand, capture the connect string so the deploy can rebuild
it anywhere:

```bash
node deploy/pull-connection-template.js "MCG CRM Database" mysql-source
```

That writes `deploy/templates/mysql-source.connection.json`. Do not hand-author
the connect string — pull it. The second argument is required; without it the
script writes the *PostgreSQL* template and overwrites a working file.

## 6. The pipeline

`deploy/pipelines/mcg-batch-pipeline/qtcp_tasks/MCG CRM Landing/`.

The task id `crm-landing-4102` and the folder name must not change (the folder
name has to equal the task name). Two things differ from the SaaS source it
replaced:

- **`sourceSelection.yaml` now carries a `schema:` key** on each table. MySQL is
  schema-qualified — the database *is* the schema — where the SaaS source was
  not. The variable `task.crm-landing-4102:null$_$mcg_crm.schema` is declared in
  both `bindings.json` and `qtcp_bindings_definition.json`, mirroring the WMS
  task's `…:null$_$public.schema`.
- **`transformationRules.yaml` is gone.** It existed only to rename the old
  source's objects into the bronze table names. The MySQL tables are named
  `crm_*` at source, so bronze gets the right names with no rule at all.

> Declarative pipeline import still fails on this tenant with
> `MISSING-CONNECTION-ID` — there is no platform or staging connection, which is
> unrelated to this change and was true before it. The analytics story runs on
> the CSV → QVD path in `deploy/mockdata/`, which reads neither the CRM nor the
> WMS and is unaffected either way.

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `mcg-mysql` never reports healthy | Still initialising the data directory on first boot | Give it ~30s; `podman logs mcg-mysql` |
| Seeder exits non-zero with a connection error | Raced the database | It retries 10 times with backoff; if it still fails the database did not come up — read its logs |
| Connection works from your laptop, fails from Qlik | You gave it `localhost:3307`, which means *the gateway container* to the gateway | Use `mysql:3306` on the compose network, or the host IP |
| Counts double after a restart | Would mean the idempotency guard was bypassed | `SELECT COUNT(*) FROM crm_contacts` before re-seeding; the guard checks that table |
| No `Update_rows` in the binlog | Simulator started with `--no-mutations`, or is not running | `podman logs mcg-mysql-crm-simulator` — the status line shows an Updates counter |
| Port 3306 conflict | The gateway container, or a stray container, holds it | Nothing here binds 3306; if something does, `podman ps` will name it |
