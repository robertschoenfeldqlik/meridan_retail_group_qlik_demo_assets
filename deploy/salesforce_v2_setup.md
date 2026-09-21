# Salesforce V2 — Setup Runbook (MCG Demo)

Covers the Salesforce side of the MCG demo end to end: the simulator that generates
CRM data, and the Qlik Talend Cloud **Salesforce V2** connector that lands it into
the Open Lakehouse.

Verified against `testsandbox-c2-dev-ed.develop.my.salesforce.com` (Developer
Edition) and the `qppqtcenterprise` Qlik tenant on **2026-08-18**. Every "verified"
note below was confirmed live, not inferred.

---

## 1. Current state of the org

| Item | State |
|---|---|
| Org type | **Developer Edition** — `testsandbox-c2-dev-ed.develop.my.salesforce.com` |
| Running user | Robert Schoenfeld, profile **System Administrator** |
| Permissions | `ModifyAllData`, `CustomizeApplication`, `AuthorApex` |
| API versions | up to **v67.0** (simulator pinned to **61.0**) |
| `crm_orders` | created — 12 custom fields |
| `crm_products` | created — 10 custom fields |
| Field-level security | granted via permission set `MCG_Simulator_Access` |
| External Client App **"Qlik"** | exists — `0xIak0000000OTlEAM`, DistributionState `Local`, created 2025-02-03 |
| ↳ its OAuth settings | **absent** — `ExtlClntAppOauthSettings` has 0 records, so no Consumer Key/Secret exists yet |
| Connected App "Qlik Data Integration" | exists — `0H4ak000007UqGTCA0` (legacy / V1-era) |

---

## 2. Org setup (automated)

Objects, fields and field-level security are all created by one idempotent script.
Re-running is safe — it reports what already exists and changes nothing.

```bash
podman run --rm --env-file infrastructure/.env \
  -v "$PWD/simulators/mysql_schema.sql:/app/setup.py:ro" \
  infrastructure-mysql-crm-simulator python /app/setup.py
```

Expected on a clean org: `12 created` / `10 created`, then `22 granted`.
Expected on a configured org: `0 created, 12 already present` and `0 granted, 22 already set`.

### Why the script does two passes

**Fields created through the Metadata API carry no field-level security — not even
for System Administrator.** Skipping the second pass leaves the fields existing but
invisible: the Tooling API lists all 22 while `describe()` returns only the 9
standard fields, and every insert fails with:

```
INVALID_FIELD: No such column 'Order_ID__c' on sobject of type crm_orders
```

This is the single most time-consuming failure mode in this setup. If you ever see
`No such column` for a field you know exists, it is FLS, not a missing field.

---

## 3. Simulator configuration

Set in `infrastructure/.env`:

| Variable | Value | Notes |
|---|---|---|
| `SF_USERNAME` | *(your integration user)* | |
| `SF_PASSWORD` | *(password)* | |
| `SF_SECURITY_TOKEN` | *(security token)* | Setup → Reset My Security Token |
| `SF_DOMAIN` | **`login`** | **Not `test`** — see below |
| `SF_API_VERSION` | `61.0` | REST API version, pinned |

### Two traps

**`SF_DOMAIN` must be `login`, not `test`.** The username reads sandbox-ish
(`…@test.sandbox`), but this is a *Developer Edition* org and Dev Edition
authenticates at `login.salesforce.com`. Using `test` fails with
`INVALID_LOGIN: Invalid username, password, security token; or user locked out` —
a message that points at credentials when the real fault is the endpoint.

**`SF_DOMAIN` must actually reach the container.** The compose services originally
forwarded only username/password/token, so the variable was silently ignored and
the simulator always used its `login` default. Both `docker-compose.simulators.yml`
and `docker-compose.simulators-dmg.yml` now pass `SF_DOMAIN` and `SF_API_VERSION`.

### Run it

```bash
cd infrastructure
docker-compose -f docker-compose.full-stack-dmg.yml --profile salesforce up -d mysql-crm-simulator
```

`--profile salesforce` is required — the service is profile-gated. Note that
`--profile` is a **root** Compose flag and must precede the subcommand; placing it
after `up -d` makes Compose reject the whole invocation.

### The duplicate rule

The simulator emits near-duplicate contacts **on purpose** — that is the "Address
Catastrophe" data-quality scenario. Salesforce's `Standard_Contact_Duplicate_Rule`
rejects them with `DUPLICATES_DETECTED`.

The fix is in code, not org config: every create call sends
`Sforce-Duplicate-Rule-Header: allowSave=true`. Do **not** deactivate the duplicate
rule org-wide — the rule firing is realistic, and suppressing it removes signal the
demo depends on.

### Verifying it works

Record counts should climb on all three objects:

| Object | Sample 1 | Sample 2 (+45s) | Δ |
|---|---|---|---|
| Contact | 246 | 248 | +2 |
| `crm_orders` | 4 | 6 | +2 |
| `crm_products` | 0 | 1 | +1 |

Spot-check that the data is *deliberately messy* — e.g. a product landing with
supplier `Samsung Corp` where others carry `Samsung Electronics Co.`, `Samsung Elec.`
or `SAMSUNG`. That variance is the Product Master Data Mess scenario, not a bug.

---

## 4. Object naming — settled

Qlik's V2 documentation lists core objects in lowercase (`account`, `contact`, …).
That is documentation style, **not** a naming change. Verified directly against the org:

- `describe()` reports the canonical API name as **`Contact`** (capital C)
- SOQL is **case-insensitive** on object names — `Contact`, `contact` and `CONTACT`
  all return identical row counts
- Custom objects report as `crm_orders` / `crm_products`

**The pipeline's existing `Contact` is correct.** No change is required to
`sourceSelection.yaml` or `transformationRules.yaml`.

---

## 5. V1 → V2 connector differences

| | V1 | V2 |
|---|---|---|
| App type | Connected App | **External Client App** |
| Instance / Login Domain fields | required | **removed** |
| Required fields | Instance, Login Domain, Client Id, Secret | Client Id, Client Secret, Environment, **API Type** |
| Data gateway | `$$qlikManagedGateway$$` | **optional**, defaults to `None` |
| Callback URL | — | `https://connector.qlik.com/auth/oauth/v3.htm` |

`deploy/config.json`, the deploy UI form and the deployer's UI hints have all been
migrated to the V2 shape. The config keys are now `clientId`, `clientSecret`,
`environment`, `apiType`, `dataGateway`, `startDate`,
`replicateNewFieldsAutomatically`, `maxApiQuotaPct`, `maxApiQuotaPerRunPct`.

---

## 6. Creating the Qlik connection

There are two auth mechanisms. The connector's `authenticator` property accepts
either — check with:

```bash
curl -s -H "Authorization: Bearer $QLIK_API_KEY" \
  "https://<tenant>/api/v1/data-sources/sfdc/api-specs" | jq '.connectionProperties.properties.authenticator'
```

```json
{ "type": "string", "enum": ["salesforce", "oauth"], "description": "Authentication Mechanism" }
```

### 6a. Scripted — `authenticator: salesforce` (recommended)

**No External Client App, no Consumer Secret, no browser round-trip.** This uses
the same username / password / security token the simulator already authenticates
with, read straight from `infrastructure/.env`.

```bash
npm run deploy:dry-run   # prints the payload, credentials redacted
npm run deploy           # creates it
```

The script asserts the two load-bearing values itself — space `MCG Demo - DI` and
name `MCG CRM Database` — and is idempotent: if a connection of that name already
exists it reports the id and changes nothing, so it will never create the duplicate
that would make the pipeline binding ambiguous.

### 6b. Manual — `authenticator: oauth` (only if OAuth is required)

Use this only when the connection must authenticate as an OAuth app rather than a
named user — e.g. an org policy that forbids storing user passwords in a connection.
It cannot be scripted: it needs an interactive Salesforce login with an
authentication code pasted back, which Qlik exchanges for a refresh token.

An External Client App named **Qlik** already exists in the org
(`0xIak0000000OTlEAM`, DistributionState `Local`) — but with **no OAuth settings**,
so it has no Consumer Key or Secret yet.

*Setup → External Client App Manager → **Qlik** → Edit → OAuth Settings*

| Setting | Value |
|---|---|
| Enable OAuth | ✅ |
| Callback URL | `https://connector.qlik.com/auth/oauth/v3.htm` |
| Scopes | `api`, `refresh_token,offline_access`, `openid`, `full` |
| Flow Enablement | Enable Client Credentials Flow |
| Require Secret | Web Server Flow only |
| Permitted Users | All users can self-authorize |
| IP Relaxation | Relax IP restrictions |
| Refresh token policy | Valid until revoked |

Then *Qlik Cloud → Data Integration → Create connection → Salesforce*, in space
**MCG Demo - DI**, named exactly **`MCG CRM Database`**, with the Consumer Key and
Secret, Environment **Production** (Developer Edition authenticates at `login`), and
Data gateway `None`. Record the same key/secret in `deploy/config.json` under
`dataConnections.salesforce` so the deployer and UI stay in sync — that file is
gitignored.

> **The connection name and space are load-bearing, whichever route you take.** The
> pipeline binds by *space + name*
> (`{{id(connection, MCG Demo - DI.MCG CRM Database)}}`). Any other name or space
> and the CRM landing task silently fails to bind.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `INVALID_LOGIN` | `SF_DOMAIN=test` on a Dev Edition org | set `SF_DOMAIN=login` |
| `No such column 'X__c'` | Metadata-API fields have no FLS | re-run `mysql_schema.sql` |
| `NOT_FOUND` on `crm_orders` | custom objects absent | run `mysql_schema.sql` |
| `DUPLICATES_DETECTED` | duplicate rule blocking intentional dupes | ensure the `Sforce-Duplicate-Rule-Header` is sent |
| Simulator logs empty but container up | Python stdout buffering | `PYTHONUNBUFFERED=1` (set in the image) |
| Compose rejects the command | `--profile` placed after `up -d` | it is a root flag — put it before the subcommand |
| CRM landing task won't bind | connection name/space mismatch | must be `MCG CRM Database` in `MCG Demo - DI` |

---

## 8. Repeatability — what is scripted

Everything except the optional OAuth route is a single command, so a rebuild (or a
different org) does not mean redoing any of this by hand.

| Step | Command | Idempotent |
|---|---|---|
| Custom objects, 22 fields, field-level security | `python mysql_schema.sql` (see §2 for the container form) | yes — reports "already present" |
| Qlik data connection | `npm run deploy` | yes — skips if the name exists |
| Preview the connection payload | `npm run deploy:dry-run` | read-only, credentials redacted |
| Verify the whole stack | `npm run deploy:dry-run` | read-only |

Both scripts read their inputs from files rather than arguments —
`deploy/config.json` for the tenant and API key, `infrastructure/.env` for the
Salesforce credentials — so pointing them at a different org or tenant is a config
change, not a code change. Neither ever prints a secret.
