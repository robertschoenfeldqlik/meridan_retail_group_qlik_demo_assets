# MCG Qlik Cloud Deployment

Automated deployment of the Meridian Commerce Group demo environment to a Qlik Cloud tenant. Provisions spaces, imports apps, creates data connections, sets up a Qlik Answers knowledge base with all 25 operational documents, creates an AI assistant, and scaffolds automations.

Two scripts are provided — **Python (recommended)** with an interactive setup wizard, and **Node.js** for zero-dependency environments.

## Prerequisites

### Python script (recommended)
- **Python** 3.8 or later
- `pip install -r deploy/requirements.txt` (installs `requests`)

### Node.js script (alternative)
- **Node.js** 18 or later (no external dependencies)

### Common
- A **Qlik Cloud tenant** with admin or developer-level access
- An **API key** or **OAuth M2M** client credentials for the target tenant
- (Optional) `.qvf` app export files placed in `deploy/apps/`

## Quick Start — Python (Interactive Wizard)

```bash
# 1. Install dependencies
pip install -r deploy/requirements.txt

# 2. Run the interactive wizard — prompts for tenant, API key, spaces, etc.
python deploy/deploy_qlik.py

# 3. Or preview first without making changes
python deploy/deploy_qlik.py --dry-run
```

The wizard will prompt you for:
- Tenant hostname and region
- Authentication method (API Key or OAuth M2M)
- API key or OAuth credentials
- Shared and managed space names
- Which components to deploy (spaces, connections, apps, KB, assistant, automations)
- Data connection credentials (PostgreSQL, Salesforce, S3)
- Knowledge base and assistant configuration

Configuration is saved to `deploy/config.json` so subsequent runs can reuse it.

### Re-running with saved config

```bash
# Use saved config without prompts
python deploy/deploy_qlik.py --skip-prompts

# Update a few settings, keep the rest
python deploy/deploy_qlik.py  # select "Use existing config? Y" then "Update settings? y"
```

## Quick Start — Node.js

```bash
# 1. Copy the example config and fill in your tenant details
cp deploy/config.example.json deploy/config.json

# 2. Edit deploy/config.json with your tenant hostname, region, and API key

# 3. Preview the deployment (no changes made)
node deploy/deploy-to-qlik.js --dry-run

# 4. Run the deployment
node deploy/deploy-to-qlik.js
```

## Configuration

### Config file

Both scripts share the same `config.json` format. Copy `config.example.json` to `config.json` and update:

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

Generate an API key from your Qlik Cloud tenant: Settings > API keys > Create new. Note: as of February 2026, API key creation requires the "Manage API keys" permission via custom roles.

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

Any `.qvf` files placed in `deploy/apps/` are imported into the shared space and then published to the managed space. Checks for existing apps by name to avoid duplicates.

### 3. Data Connections

| Connection | Type | Source |
|---|---|---|
| MCG WMS Database | PostgreSQL | Warehouse Management System |
| MCG Salesforce CRM | Salesforce | Customer Relationship Management |
| MCG IoT Telemetry | Kafka | Real-time sensor data (Node.js only) |
| MCG Flat File Outputs | S3 | CSV/file exports |

Uses the Qlik Cloud data source discovery workflow:
1. `GET /api/v1/data-sources` — discover available connector types
2. `POST /api/v1/data-connections` — create with credentials from config

Connections without credentials in the config are skipped with a warning.

### 4. Knowledge Base (Qlik Answers)

Creates a knowledge base named "MCG Operations Knowledge Base" and uploads all 25 `.docx` files:

- 5 SOPs (goods receiving, cycle count, recall, cold chain, WISMO)
- 4 policies (food safety, cold chain, data quality, shipping)
- 3 carrier contracts (DPD, FedEx, NinjaVan)
- 2 incident reports (Rotterdam pipeline, TransFrio spoilage)
- 2 purchase orders, 2 supplier communications, 2 training guides
- 1 each: recall notice, meeting minutes, compliance plan, project brief, shipping manifest

After upload, triggers sync/indexing so documents are immediately searchable.

### 5. Assistant

Creates a Qlik Answers assistant linked to the knowledge base with conversation starters:

- "What is the procedure for goods receiving?"
- "What happened during the Rotterdam pipeline failure?"
- "What are the cold chain temperature requirements?"
- "What is Project CLARITY and what problem does it solve?"
- "What was the lettuce recall and what went wrong?"

### 6. Automations (Python script only)

Creates three automation scaffolds in disabled state:

| Automation | Purpose |
|---|---|
| MCG Daily App Reload | Scheduled daily reload at 06:00 UTC |
| MCG Pipeline Health Alert | Alert on CDC sync lag > 60 min |
| MCG Cold Chain Alert | Alert on IoT temperature exceedance > 15 min |

Automations are created disabled — configure triggers and workflow blocks in the Qlik Cloud console.

## CLI Options

### Python

```
python deploy/deploy_qlik.py [OPTIONS]

  --config <path>    Path to config JSON (default: deploy/config.json)
  --dry-run          Preview actions without making API calls
  --verbose          Enable detailed HTTP logging
  --skip-prompts     Use config.json as-is, no interactive prompts
  --help             Show usage
```

### Node.js

```
node deploy/deploy-to-qlik.js [OPTIONS]

  --config <path>   Path to config JSON (default: deploy/config.json)
  --dry-run         Preview actions without making API calls
  --verbose         Enable detailed logging
  --help            Show usage
```

## Qlik Cloud APIs Used

| Area | Endpoint | Method |
|---|---|---|
| Auth (M2M) | `POST /oauth/token` | OAuth2 client credentials |
| Verify | `GET /api/v1/users/me` | Connection check |
| Spaces | `POST /api/v1/spaces` | Create shared/managed |
| Apps (import) | `POST /api/v1/apps/import` | Binary upload |
| Apps (publish) | `POST /api/v1/apps/{id}/publish` | First publish |
| Apps (republish) | `PUT /api/v1/apps/{id}/publish` | Update existing |
| Data Sources | `GET /api/v1/data-sources` | Discover connector types |
| Data Connections | `POST /api/v1/data-connections` | Create with credentials |
| Knowledge Bases | `POST /api/v1/knowledgebases` | Create KB |
| KB Datasources | `POST /api/v1/knowledgebases/{id}/datasources` | Add file source |
| KB Files | `POST .../datasources/{id}/files` | Upload documents |
| KB Sync | `POST .../datasources/{id}/actions/sync` | Trigger indexing |
| Assistants | `POST /api/v1/assistants` | Create with KB link |
| Automations | `POST /api/v1/automations` | Create scaffold |
| Data Products | `POST /api/data-governance/data-products` | Create (Talend Enterprise) |

## Idempotency

Both scripts are designed to be run multiple times safely:

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
  deploy_qlik.py        # Python deployment script (interactive wizard)
  deploy-to-qlik.js     # Node.js deployment script
  config.json            # Your tenant config (git-ignored)
  config.example.json    # Template with placeholder values
  requirements.txt       # Python dependencies
  apps/                  # Place .qvf app exports here
  README.md              # This file
```

## Troubleshooting

**"requests not installed"** — Run `pip install -r deploy/requirements.txt`.

**"Config file not found"** — Copy `config.example.json` to `config.json`, or run the Python wizard which creates it interactively.

**Authentication fails (401)** — Verify your API key is valid. For OAuth, confirm client ID/secret and that consent method is set to "Trusted".

**Space creation fails (403)** — Your API key or OAuth client needs `TenantAdmin` or `SpaceCreator` role.

**App import fails (413)** — The `.qvf` file may exceed upload limits.

**Data connection fails** — Ensure the connector type is installed on your tenant. Some connectors require additional setup in Management Console.

**KB document upload fails (415)** — Verify files are valid `.docx`. The script sets correct MIME types automatically.

**"Already exists" warnings** — Expected on re-runs. The script skips existing resources.

## Security Notes

- Never commit `config.json` to version control (it contains secrets)
- Add `deploy/config.json` to your `.gitignore`
- For CI/CD, use environment variables instead of the config file
- API keys should have minimum required permissions
- Rotate credentials after demo events
- The Python wizard uses `getpass` for secret inputs (not echoed to terminal)
