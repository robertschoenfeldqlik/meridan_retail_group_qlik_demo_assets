# Qlik Cloud Automation Configuration Guide

Step-by-step instructions for configuring each automation in the Qlik Cloud UI after the deployment script creates the automation shells.

---

## Prerequisites

1. **Qlik Cloud tenant** with Automations entitlement enabled
2. **Microsoft Teams** channel with an Incoming Webhook connector configured
3. **Qlik Answers assistant** and knowledge base deployed (for the Answers-based automation)
4. **Data connections** active and refreshing (PostgreSQL, Kafka, Salesforce)

### Getting a Teams Incoming Webhook URL

1. In Microsoft Teams, go to the target channel
2. Click the channel name > **Manage channel** > **Connectors** (or **Workflows** in newer Teams)
3. Search for **Incoming Webhook**, click **Configure**
4. Name it (e.g., "MCG Qlik Alerts"), optionally upload the MCG logo
5. Click **Create** and copy the webhook URL
6. Paste the URL into `config.json` under `automations.teamsWebhookUrl`

---

## Automation 1: MCG Daily App Reload

**Purpose:** Reload all analytics apps on a daily schedule so dashboards show fresh data.

### UI Configuration Steps

1. Navigate to **Automations** in the Qlik Cloud hub
2. Open **"MCG Daily App Reload"** (created by deploy script in disabled state)
3. Click **Edit** to open the Automation Designer

#### Block 1: Schedule Trigger
- Select **Scheduled Start** as the trigger
- Set schedule: **Daily at 06:00 UTC**
- Timezone: UTC (or adjust to your team's working hours)

#### Block 2: List Apps
- Add block: **Qlik Cloud > List Items**
- Filter: `resourceType = "app"`, `spaceId = "<MCG Demo - Development space ID>"`
- This retrieves all MCG analytics apps

#### Block 3: Loop
- Add block: **Control > For Each**
- Iterate over the app list from Block 2

#### Block 4: Reload App
- Inside the loop, add: **Qlik Cloud > Reload App**
- App ID: `{{current.resourceId}}`
- Wait for completion: **Yes**

#### Block 5: Error Handling (Optional)
- Add block: **Control > If/Else**
- Condition: Reload status != "succeeded"
- If failed: Add **Mail > Send Email** or **Microsoft Teams > Post Message** with error details

4. Click **Enable** when ready
5. Test with **Run Now** button

---

## Automation 2: MCG Cold Chain Alert to Teams

**Purpose:** Alert the cold chain team in Teams when IoT sensors detect temperature exceedances lasting 15+ minutes.

### UI Configuration Steps

1. Open **"MCG Cold Chain Alert → Teams"** in the Automation Designer

#### Block 1: Schedule Trigger
- Select **Scheduled Start**
- Schedule: **Every 5 minutes** (`*/5 * * * *`)

#### Block 2: Query Data Product
- Add block: **Qlik Cloud > Run Script** or use **REST API Call**
- Method: `GET`
- URL: `https://<tenant>/api/v1/data-products/<spoilage-risk-product-id>/data`
- Query parameter / filter: `exceedance_minutes >= 15`
- **Alternative:** Use the **Qlik Cloud > Query Data Source** block if available in your version, pointing at the `silver.iot_normalized` table

#### Block 3: Condition Check
- Add block: **Control > If/Else**
- Condition: `result_count > 0`
- If no results: End automation (no alerts needed)

#### Block 4: Loop Over Results
- Add block: **Control > For Each**
- Iterate over query results

#### Block 5: Post to Teams
- Add block: **Microsoft Teams > Post Adaptive Card**
- Webhook URL: Paste your Teams webhook URL
- Card JSON (paste into the Adaptive Card editor):

```json
{
  "type": "AdaptiveCard",
  "version": "1.4",
  "body": [
    {
      "type": "TextBlock",
      "text": "Cold Chain Alert - Temperature Exceedance",
      "weight": "bolder",
      "size": "large",
      "color": "attention"
    },
    {
      "type": "FactSet",
      "facts": [
        {"title": "Shipment", "value": "{{current.shipment_id}}"},
        {"title": "Route", "value": "{{current.route}}"},
        {"title": "Max Temp", "value": "{{current.max_temp_celsius}} C"},
        {"title": "Duration", "value": "{{current.exceedance_minutes}} min"},
        {"title": "Est. Loss", "value": "${{current.estimated_loss_usd}}"},
        {"title": "Product", "value": "{{current.product_type}}"}
      ]
    }
  ],
  "actions": [
    {
      "type": "Action.OpenUrl",
      "title": "Open Dashboard",
      "url": "https://<tenant>/sense/app/<cold-chain-app-id>"
    }
  ]
}
```

#### Block 6: Mark as Alerted (Optional)
- Add block: **REST API Call**
- Update the record to set `alert_sent = true` to prevent duplicate alerts

2. **Enable** and test with a manual run

---

## Automation 3: MCG Pipeline Health Daily Summary to Teams

**Purpose:** Post a daily health summary of all data pipelines to the data engineering Teams channel at 07:00 UTC.

### UI Configuration Steps

1. Open **"MCG Pipeline Health Daily Summary → Teams"**

#### Block 1: Schedule Trigger
- **Daily at 07:00 UTC**

#### Block 2: Query Pipeline Status
- Add block: **Qlik Cloud > REST API Call**
- Method: `GET`
- URL: `https://<tenant>/api/v1/data-connections`
- This returns all data connections with their status and last sync time

#### Block 3: Query Data Product
- Add block: **Qlik Cloud > REST API Call** or **Run Script**
- Query `gold.supply_chain_health` aggregated by `pipeline_status`
- Get: count of DCs per status, avg trust score, max sync lag

#### Block 4: Build Summary
- Add block: **Control > Variable** to compose the summary text
- Template:

```
Pipeline Health Summary:
- HEALTHY: {{healthy_count}} DCs
- DEGRADED: {{degraded_count}} DCs
- FAILED: {{failed_count}} DCs
- Avg Trust Score: {{avg_trust_score}}
- Max Sync Lag: {{max_sync_lag}} minutes
```

#### Block 5: Post to Teams
- Add block: **Microsoft Teams > Post Adaptive Card**
- Webhook URL: Your #mcg-data-engineering channel webhook
- Card body should include:
  - Title with date
  - Pipeline status breakdown (color-coded: green/yellow/red)
  - Data connection status table
  - Link to the Supply Chain Health dashboard

2. **Enable** and test

---

## Automation 4: WISMO Alert (Customer Service)

**Purpose:** Alert customer service when WISMO (Where Is My Order) rates exceed threshold for a carrier/region.

### UI Configuration Steps (Build from Scratch)

1. Create new automation: **"MCG WISMO Rate Alert"**

#### Block 1: Schedule Trigger
- **Every 30 minutes**

#### Block 2: Query WISMO Data
- Query `silver.order_delivery_timeline`
- Filter: `wismo_rate > 0.50` (50% threshold)
- Group by: `carrier`, `destination_region`

#### Block 3: Condition
- If any results exceed threshold, continue

#### Block 4: Post to Teams
- Channel: `#mcg-customer-ops`
- Card showing: carrier, region, WISMO rate, affected order count, link to dashboard

---

## Automation 5: Talend Address Correction — Automated Data Quality Remediation

**Purpose:** Close the data quality loop by automatically correcting addresses flagged in Stewardship campaigns. When a steward reviews and approves address records in the Address Cleanup campaign, this automation triggers the Talend Address Validation Service job to standardize, validate, and geocode the addresses, then writes the corrected data back to the Silver layer.

**Data Quality Story:** This automation is the final link in the MCG address quality chain:

```
Bronze (dirty addresses) → Data Flow 3 (standardization) → Silver (quality-scored)
    → Stewardship Campaign (human review of ambiguous matches)
    → THIS AUTOMATION (Talend job corrects approved records)
    → Silver updated (corrected addresses flow to Gold → Analytics → Predict)
```

**Nightmare tie-in:** #2 (Address Catastrophe) — 11% formatting issues, 6% truncation, 3.2% duplicates in Salesforce addresses. This automation reduces the manual effort of correcting ~8,500 flagged address records.

### UI Configuration Steps

1. Open **"MCG Address Correction — Talend Job Trigger"** in the Automation Designer

#### Block 1: Event Trigger — Stewardship Task Completed
- Select **Webhook** or **Scheduled Start** as the trigger
- **Option A (Event-driven):** Configure a webhook that fires when a stewardship task status changes to "Completed" or "Approved"
- **Option B (Scheduled):** Poll every 15 minutes for newly approved stewardship tasks in the Address Cleanup campaign
  - Query: `GET /api/data-governance/stewardship/tasks?campaign=address-cleanup&status=approved&since={{lastRunTimestamp}}`

#### Block 2: Collect Approved Records
- Add block: **Qlik Cloud > REST API Call**
- Method: `GET`
- Retrieve the record IDs and current address fields from the approved stewardship tasks
- Store results in a variable: `approvedRecords`

#### Block 3: Invoke Talend Job
- Add block: **Qlik Cloud > REST API Call** (or **Talend Cloud > Run Job**)
- Method: `POST`
- URL: `https://<tenant>/api/v1/talend/jobs/<address-validation-job-id>/run`
- Body:
```json
{
  "parameters": {
    "input_source": "stewardship_batch",
    "record_ids": "{{approvedRecords.ids}}",
    "source_table": "silver.addresses_standardized",
    "write_back": true
  }
}
```
- This runs the Talend Address Validation Service job with components:
  - **tAddressRowStandardize** — Parses and standardizes the address
  - **tAddressRowValidate** — Validates against postal reference databases
  - **tGeocode** — Adds latitude/longitude for map visualizations

#### Block 4: Wait for Job Completion
- Add block: **Control > Wait** + **REST API Call** to poll job status
- Poll every 30 seconds until job status = "completed" or "failed"
- Timeout: 10 minutes

#### Block 5: Verify Results
- Add block: **Qlik Cloud > REST API Call**
- Query the job execution results:
  - `records_processed`, `records_corrected`, `records_failed`
  - `avg_confidence_score` of corrected records

#### Block 6: Update Stewardship Tasks
- Add block: **Qlik Cloud > REST API Call**
- For each successfully corrected record, update the stewardship task status to "Resolved"
- For failed records, update status to "Needs Manual Review"

#### Block 7: Notify via Teams
- Add block: **Microsoft Teams > Post Adaptive Card**
- Webhook URL: Your `#mcg-data-engineering` or `#mcg-customer-ops` channel
- Card JSON:

```json
{
  "type": "AdaptiveCard",
  "version": "1.4",
  "body": [
    {
      "type": "TextBlock",
      "text": "Address Correction Complete",
      "weight": "bolder",
      "size": "large",
      "color": "good"
    },
    {
      "type": "FactSet",
      "facts": [
        {"title": "Records Processed", "value": "{{recordsProcessed}}"},
        {"title": "Corrected", "value": "{{recordsCorrected}}"},
        {"title": "Failed", "value": "{{recordsFailed}}"},
        {"title": "Avg Confidence", "value": "{{avgConfidence}}%"},
        {"title": "Campaign", "value": "Address Cleanup"},
        {"title": "Talend Job", "value": "MCG Address Validation Service"}
      ]
    }
  ],
  "actions": [
    {
      "type": "Action.OpenUrl",
      "title": "View Stewardship Campaign",
      "url": "https://<tenant>/stewardship/campaigns/<address-cleanup-id>"
    },
    {
      "type": "Action.OpenUrl",
      "title": "View Address Quality Dashboard",
      "url": "https://<tenant>/sense/app/<delivery-cx-app-id>/sheet/<address-quality-sheet>"
    }
  ]
}
```

#### Block 8: Trigger Downstream Refresh (Optional)
- If corrected addresses changed significantly, trigger a data flow refresh:
  - Reload `silver.order_delivery_timeline` table recipe
  - Reload `gold.last_mile_performance` (address quality affects delivery SLAs)
- This ensures the Predict SLA model picks up improved address quality scores

2. **Enable** and test with a small batch of approved stewardship records

### End-to-End Data Quality Loop

```
1. Source: Salesforce addresses arrive with 11% formatting issues
2. Pipeline: Data Flow 3 standardizes + scores (Bronze → Silver)
3. Governance: Semantic Types + AI Validation Rules flag quality issues
4. Stewardship: Address Cleanup campaign routes ambiguous records to stewards
5. Human Review: Steward approves/corrects flagged addresses
6. AUTOMATION: Talend job validates, standardizes, geocodes approved records
7. Silver Updated: Corrected addresses flow to Gold via table recipes
8. Analytics: Address Quality Score improves in dashboards
9. Predict: SLA model accuracy improves (address quality = #2 feature)
10. Business Impact: Fewer failed deliveries, lower WISMO rate, reduced costs
```

---

## Automation 5b: Talend Agentic Route — LLM-Assisted Address Correction (Preview)

> **Preview status:** Talend Agentic Routes and the Declarative Pipeline / MCP tooling they build on are in Qlik internal preview (June 2026). Present this as the roadmap evolution of Automation 5, not a shipping feature. No endpoints, model quotas, or accuracy figures are invented below — where a real value is needed, use the `[placeholder]` markers and fill them in against your own tenant.

**Purpose:** Automation 5 corrects addresses with the deterministic Talend components (`tAddressRowStandardize` → `tAddressRowValidate` → `tGeocode`). A **Talend Agentic Route** extends that same job by running an LLM step *inside the pipeline task* for the records those components leave as `AMBIGUOUS` — the ones that otherwise fall through to a human steward.

**Where it fits the existing loop:**

```
Automation 5 (deterministic):  approved records → tAddressRowStandardize → tAddressRowValidate → tGeocode → Silver
Automation 5b (agentic add-on):        AMBIGUOUS records ↑ → LLM reasoning step (RAG-grounded) → proposed correction → human review → Silver
```

The agentic route does not replace human review. It drafts a proposed correction with its reasoning; a steward still approves before the record is written back.

### What a Talend Agentic Route adds

A Talend Agentic Route brings three AI-native capabilities into a pipeline task:

| Capability | Use in the address-correction step |
|---|---|
| **LLM integration** | Reason over a malformed or truncated address (e.g., `Friedrichstraße 123, Hinterh` cut at 30 chars) and propose the most likely complete form. Cloud models: OpenAI, Anthropic Claude, Google Gemini, Amazon Bedrock. On-prem models: Ollama, Mistral, Gemma 3, Phi 4. |
| **RAG grounding** | Retrieve postal reference context (country postal rules, known street names) from a vector target — Pinecone, MongoDB, Snowflake, Databricks, Milvus, or Oracle — so the LLM proposal is grounded, not guessed. |
| **Agentic orchestration + MCP client** | Let the step call tools (the deterministic validator, a geocoder) and reach the Qlik MCP Server to check the current `address_quality_score` before deciding. |

Beyond addresses, the same route pattern supports sentiment analysis, entity extraction, content classification, and AI-assisted data quality inside any pipeline task.

### UI Configuration Notes (Preview)

1. Open the **MCG Address Validation Service** job (see `creation_guide.md` — Talend Job) in Qlik Talend Cloud.
2. Add an **LLM task / agentic route** on the `AMBIGUOUS` branch of `tAddressRowValidate`.
   - **Model connection:** select a configured LLM connection — `[placeholder — model + connection name]`.
   - **RAG source (optional):** point at your vector target — `[placeholder — vector target + index]`.
   - **Prompt:** instruct the model to return a structured correction (`street_clean`, `postal_clean`, `country_iso`, `confidence`, `reasoning`) and to abstain when it is not confident.
3. Route the model's proposal to the existing **Stewardship** review step rather than writing directly to `silver.addresses_standardized`. The steward approves; Automation 5 then handles the write-back as it does today.
4. Log the model, prompt version, and reasoning with each proposed correction for auditability.

**Demo talking point:** "The deterministic route fixes what it can prove. The agentic route takes a reasoned pass at what's left — grounded in postal reference data through RAG — and hands a proposed fix to the steward. Same job, same governed write-back, one AI step added inside the pipeline."

---

## General Automation Tips

### Available Block Types in Qlik Cloud Automations

| Category | Block | Use Case |
|----------|-------|----------|
| **Triggers** | Scheduled Start | Time-based (cron) |
| | App Reload Finished | React to reload completion |
| | Webhook | External event trigger |
| **Qlik Cloud** | Reload App | Trigger app reload |
| | List Items | Get spaces, apps, connections |
| | REST API Call | Call any Qlik Cloud API |
| | Run Script | Execute load script snippet |
| **Control** | For Each | Loop over arrays |
| | If/Else | Conditional branching |
| | Variable | Store/transform values |
| | Wait | Delay (seconds) |
| **Connectors** | Microsoft Teams | Post messages/cards |
| | Slack | Post messages |
| | Email (SMTP) | Send email alerts |
| | Generic REST | Call any HTTP endpoint |

### Adaptive Card Design Tips

- Use the [Adaptive Cards Designer](https://adaptivecards.io/designer/) to build cards visually
- Teams supports Adaptive Cards v1.4
- Use `FactSet` for key-value data (clean, scannable)
- Use `ColumnSet` for side-by-side metrics
- Add `Action.OpenUrl` buttons linking back to Qlik Cloud dashboards
- Color options: `default`, `dark`, `light`, `accent`, `good`, `warning`, `attention`

### Testing Automations

1. Always test with **Run Now** before enabling the schedule
2. Check the **Run History** tab for execution logs
3. Use the **Debug** panel to inspect block outputs
4. For Teams blocks, verify the webhook URL is correct (test with a manual curl first)

### Common Issues

| Issue | Resolution |
|-------|-----------|
| Teams card not posting | Verify webhook URL is active; check for JSON syntax errors in the card |
| Reload fails | Ensure the app owner has correct data connection credentials |
| REST API returns 401 | API key may have expired; regenerate in Qlik Cloud admin |
| Automation times out | Increase timeout in block settings; consider breaking into smaller automations |
| Duplicate alerts | Add a flag field (e.g., `alert_sent`) to your data and filter on it |
