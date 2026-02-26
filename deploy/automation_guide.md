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
- **Alternative:** Use the **Qlik Cloud > Query Data Source** block if available in your version, pointing at the `gold.cold_chain_compliance` table

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
- Query `gold.customer_delivery_experience`
- Filter: `wismo_rate > 0.50` (50% threshold)
- Group by: `carrier`, `destination_region`

#### Block 3: Condition
- If any results exceed threshold, continue

#### Block 4: Post to Teams
- Channel: `#mcg-customer-ops`
- Card showing: carrier, region, WISMO rate, affected order count, link to dashboard

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
