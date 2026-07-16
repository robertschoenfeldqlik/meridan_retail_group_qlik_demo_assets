# MCG Qlik Cloud Deployment

Automated deployment of the Meridian Commerce Group demo environment to a Qlik Cloud tenant. Provisions spaces, imports apps, creates data connections, sets up a Qlik Answers knowledge base with 25 operational documents, creates an AI assistant, and scaffolds automations.

Three deployment interfaces are available — **Web UI** (recommended), **CLI**, and **Dry Run** preview.

## Prerequisites

- **Node.js** 18 or later (no external dependencies)
- A **Qlik Cloud tenant** with admin or developer-level access
- An **API key** or **OAuth M2M** client credentials for the target tenant
- (Optional) `.qvf` app export files placed in `deploy/apps/`

## Quick Start — Web UI (Recommended)

```bash
# From the project root
npm run ui
# or
node deploy/deploy-ui.js
```

Open `http://localhost:3939` in your browser. The wizard walks you through:
1. Tenant connection and authentication
2. Spaces and infrastructure setup
3. Docker container management (simulators, DMG gateway)
4. Data connections (PostgreSQL, Salesforce, Kafka, S3)
5. App import and theme upload
6. Knowledge base and document upload
7. Automations, data products, and glossary
8. Pre-flight checks and deployment

## Quick Start — CLI

```bash
# 1. Copy the example config and fill in your tenant details
cp deploy/config.example.json deploy/config.json

# 2. Edit deploy/config.json with your tenant hostname, region, and API key

# 3. Preview the deployment (no changes made)
npm run deploy:dry-run
# or: node deploy/deploy-to-qlik.js --dry-run

# 4. Run the deployment
npm run deploy
# or: node deploy/deploy-to-qlik.js
```

## Configuration

### Config file

Copy `config.example.json` to `config.json` and update:

| Field | Description | Example |
|---|---|---|
| `tenant.hostname` | Your Qlik Cloud tenant name | `mcg-demo` |
| `tenant.region` | Qlik Cloud region domain | `us.qlikcloud.com` |
| `auth.method` | Authentication method | `apikey` or `oauth` |
| `auth.apiKey` | API key (if method is `apikey`) | `eyJhbG...` |

The base URL is constructed as `https://{hostname}.{region}`.

### Environment variables

Environment variables override values in `config.json`:

| Variable | Overrides |
|---|---|
| `QLIK_TENANT_HOST` | `tenant.hostname` |
| `QLIK_REGION` | `tenant.region` |
| `QLIK_API_KEY` | `auth.apiKey` |
| `QLIK_AUTH_METHOD` | `auth.method` |
| `QLIK_OAUTH_CLIENT_ID` | `auth.oauth.clientId` |
| `QLIK_OAUTH_CLIENT_SECRET` | `auth.oauth.clientSecret` |
| `QLIK_OAUTH_TOKEN_URL` | `auth.oauth.tokenUrl` |

### Authentication methods

**API Key** (simplest for demos):

Generate an API key from your Qlik Cloud tenant: Settings > API keys > Create new.

```json
{
  "auth": {
    "method": "apikey",
    "apiKey": "your-api-key"
  }
}
```

**OAuth M2M** (recommended for CI/CD and production):

Create an OAuth client in Qlik Cloud Management Console > OAuth > Create New > Client type "Web" > Enable "Allow Machine-to-Machine (M2M)". Set consent method to "Trusted".

```json
{
  "auth": {
    "method": "oauth",
    "oauth": {
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret",
      "tokenUrl": "https://your-tenant.us.qlikcloud.com/oauth/token"
    }
  }
}
```

## What Gets Deployed

### 1. Spaces

| Space | Type | Purpose |
|---|---|---|
| MCG Demo - Development | shared | Development workspace for app authoring |
| MCG Demo - Published | managed | Published apps for end users |

### 2. Analytics Apps

Analytics apps are **not** created by the main `deploy-to-qlik.js` run — placing `.qvf` files in `deploy/apps/` does not get them auto-imported/published as part of `npm run deploy`. Apps are built from the JSON app definitions (`domainApps` in `config.json`) by the separate `deploy/build-apps.js` script, run via its own npm script:

```bash
npm run build-apps
# or preview first: npm run build-apps:dry-run
```

This creates each app in the shared space (empty, load-script-only, mapped to the gold data products); sheets are then authored via Qlik MCP prompting (or the legacy Engine-API sheet builder — see `apps.sheetsViaMcp` in `config.example.json`).

### 3. Data Connections

| Connection | Type | Source |
|---|---|---|
| MCG WMS Database | PostgreSQL | Warehouse Management System |
| MCG Salesforce CRM | Salesforce | Customer Relationship Management |
| MCG IoT Telemetry | Kafka | Real-time sensor data |
| MCG Flat File Outputs | S3 | CSV/file exports |

### 4. Theme

Uploads the MCG Dark Theme (navy/teal/gold brand colors with Inter font).

### 5. Knowledge Base (Qlik Answers)

Creates a knowledge base and uploads all 25 operational `.docx` files:

- 5 SOPs (goods receiving, cycle count, recall, cold chain, WISMO)
- 4 policies (food safety, cold chain, data quality, shipping)
- 3 carrier contracts (DPD, FedEx, NinjaVan)
- 2 incident reports (Rotterdam pipeline, TransFrio spoilage)
- 2 purchase orders, 2 supplier communications, 2 training guides
- 1 each: recall notice, meeting minutes, compliance plan, project brief, shipping manifest

After upload, triggers sync/indexing so documents are immediately searchable.

### 6. Assistant

Creates a Qlik Answers assistant linked to the knowledge base with conversation starters.

### 7. Automations

Creates automation scaffolds in disabled state:

| Automation | Purpose |
|---|---|
| MCG Daily App Reload | Scheduled daily reload at 06:00 UTC |
| MCG Pipeline Health Alert | Alert on CDC sync lag > 60 min |
| MCG Cold Chain Alert | Alert on IoT temperature exceedance > 15 min |

### 8. Data Products (Gold Layer)

Registers 2 data products from `data_products.json`: Supply Chain Health and Last Mile Performance.

### 9. Business Glossary

Creates 25 business glossary terms from `glossary_terms.json`.

## CLI Options

```
node deploy/deploy-to-qlik.js [OPTIONS]

  --config <path>           Path to config JSON (default: deploy/config.json)
  --dry-run                 Preview actions without making changes (see Dry Run note below)
  --verbose                 Enable detailed logging
  --cleanup-dataproducts    Delete all data products from tenant, then exit
  --export-pipeline         Export the tenant's declarative pipeline project (YAML)
                            into deploy/pipelines/, then exit
  --help                    Show usage
```

**Dry Run note:** `--dry-run` skips all calls that create, modify, or delete resources on your tenant — but some read-only GET calls (existence/idempotency checks, e.g. "does this space/connection/app already exist") still occur.

## Idempotency

The script is designed to be run multiple times safely:

- **Spaces**: Checks if a space with the same name exists before creating
- **Apps**: Checks if an app with the same name exists in the target space
- **Data connections**: Checks by connection name before creating
- **Knowledge base**: Checks by name; skips if already present
- **Documents**: Skips files that return 409 (already uploaded)
- **Assistant**: Checks by name before creating
- **Automations**: Checks by name before creating

Re-running after a partial failure picks up where it left off.

## Directory Structure

```
deploy/
  deploy-to-qlik.js     # Node.js deployment script
  deploy-ui.js           # Web UI for deployment (port 3939)
  config.json            # Your tenant config (git-ignored)
  config.example.json    # Template with placeholder values
  apps/                  # Place .qvf app exports here
  automations/           # Teams alert JSON templates
  themes/                # MCG dark theme
  data_products.json     # Gold-layer data product definitions
  glossary_terms.json    # Business glossary terms
  README.md              # This file
```

## Troubleshooting

**"Config file not found"** — Copy `config.example.json` to `config.json`, or use the Web UI which lets you configure and save interactively.

**Authentication fails (401)** — Verify your API key is valid. For OAuth, confirm client ID/secret and that consent method is set to "Trusted".

**Space creation fails (403)** — Your API key or OAuth client needs `TenantAdmin` or `SpaceCreator` role.

**App import fails (413)** — The `.qvf` file may exceed upload limits.

**Data connection fails** — Ensure the connector type is installed on your tenant.

**KB document upload fails (415)** — Verify files are valid `.docx`.

**"Already exists" warnings** — Expected on re-runs. The script skips existing resources.

## Security Notes

- Never commit `config.json` to version control (it contains secrets)
- `deploy/config.json` is in `.gitignore`
- For CI/CD, use environment variables instead of the config file
- API keys should have minimum required permissions
- Rotate credentials after demo events
