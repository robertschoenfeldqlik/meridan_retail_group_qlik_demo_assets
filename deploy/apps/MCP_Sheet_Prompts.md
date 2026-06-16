# MCG — Qlik MCP Sheet-Authoring Prompts

Build the analytics **app sheets** conversationally with the **Qlik MCP server**. The deploy creates each app *empty* (load script only, mapped to its gold data product); you author the sheets by pasting the prompts below into an MCP client (Claude Desktop / Claude Code) connected to your tenant.

> This file is generated from `deploy/apps/mcp-sheet-prompts.json` — edit that and re-run `node deploy/apps/gen-mcp-prompts-md.js`.

**Qlik docs:** [Qlik MCP server](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikMCP/Qlik-MCP-server.htm) · [Qlik MCP server tools](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikMCP/Qlik-MCP-server-tools.htm)

## Prerequisites
- **Open Lakehouse + pipelines deployed** and the gold tables populated. The apps read the lakehouse **through Amazon Athena** — their load scripts `LIB CONNECT TO` the Athena connection (Glue catalog: bronze / silver / gold).
- **Data products registered** and the **two apps created** (Build Apps step) — empty, load-script only.
- **Qlik MCP server enabled** for your tenant (admin — see *Deploying Qlik MCP server for a tenant*). Users must approve sharing data with the AI client.
- Field names in the prompts match `deploy/apps/load-scripts/*.qvs` exactly.

## Connect your MCP client
Streamable/SSE endpoint:
```
https://<your-tenant>.<region>.qlikcloud.com/api/ai/mcp
```
Add to `claude_desktop_config.json` (or your MCP client config), then restart the client:
```json
{
  "mcpServers": {
    "qlik": {
      "url": "https://<your-tenant>.<region>.qlikcloud.com/api/ai/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_API_KEY>"
      }
    }
  }
}
```
Sanity check once connected:
```
List the Qlik apps in my tenant and confirm you can see 'MCG Supply Chain Operations' and 'MCG Delivery & Customer Experience'.
```

## MCP tools the prompts use
| Tool | What it does |
| --- | --- |
| `qlik_create_sheet` | Create a new empty sheet (dashboard) in the app |
| `qlik_add_chart` | Add a visualization (bar, line, pie, table, KPI, etc.) to a sheet |
| `qlik_add_filter` | Add a filter panel to a sheet for user-driven filtering |
| `qlik_create_measure` | Create a reusable library measure with an expression |
| `qlik_create_dimension` | Create a reusable library dimension |
| `qlik_list_measures / qlik_list_dimensions` | List the library measures / dimensions in the app |
| `qlik_update_measure / qlik_update_dimension` | Update an existing library measure / dimension |
| `qlik_create_data_object` | Create a temporary calculation object for ad-hoc analytics |

## Prompts
Paste one prompt at a time; review each sheet before moving on. Tip: prefix with *"Use the Qlik MCP server."* if the client needs nudging.

### App: MCG Supply Chain Operations
_Load script: `app1-supply-chain.qvs` · Data product: Supply Chain Health (gold.supply_chain_health)_

#### Sheet 1 — Inventory Health Overview
```text
In the Qlik app 'MCG Supply Chain Operations', create a sheet named 'Inventory Health Overview'. Add four KPI objects across the top: 'Inventory Record Accuracy' = Avg([IRA %]) formatted as a percentage, 'Phantom Suspect Positions' = Sum([Phantom Suspect Count]), 'Average Trust Score' = Avg([Avg Trust Score]) with two decimals, and 'Negative Qty Positions' = Sum([Negative Qty Count]). Below them add a bar chart 'Phantom Inventory by DC' with dimension [Distribution Center] and measure Sum([Phantom Suspect Count]) sorted descending, and a combo chart 'IRA vs Trust by DC' with dimension [Distribution Center], bars Avg([IRA %]) and line Avg([Avg Trust Score]). At the bottom add a straight table 'DC Health Detail' with [Distribution Center], Sum([SKU Positions]), Sum([Total On Hand]), Sum([Lot Missing Count]), Avg([Avg Cycle Count Variance]), and Avg([IRA %]).
```

#### Sheet 2 — Cold Chain Monitoring
```text
In the Qlik app 'MCG Supply Chain Operations', create a sheet named 'Cold Chain Monitoring'. Add KPIs: 'Active Temp Alerts' = Sum({<[Temp Alert Flag]={1}>} 1), 'Avg Temperature (°C)' = Avg([Temperature (°C)]) with one decimal, 'GPS Gaps' = Sum({<[GPS Gap Flag]={1}>} 1), and 'Low Battery Sensors' = Count({<[Battery Low Flag]={1}>} DISTINCT [Sensor ID]). Add a line chart 'Temperature Over Time by Route' with dimensions [Reading Time] and [Route] and measure Avg([Temperature (°C)]), plus a reference line at 8. Add a scatter plot 'Sensor Health' with dimension [Sensor ID], x-axis Avg([Battery %]), y-axis Avg([Temperature (°C)]). Add a filter pane with [Route], [Distribution Center], and [Temp Unit].
```

#### Sheet 3 — Product Data Quality
```text
In the Qlik app 'MCG Supply Chain Operations', create a sheet named 'Product Data Quality'. Add KPIs: 'Products with Imputed Weight' = Sum({<[Weight Imputed Flag]={1}>} 1), 'Origin Compliance Risks' = Sum({<[Origin Compliance Risk]={1}>} 1), and 'Distinct Suppliers (Canonical)' = Count(DISTINCT [Supplier]). Add a pie chart 'Products by Category' with dimension [Category] and measure Count([SKU]). Add a bar chart 'Supplier Consolidation' with dimension [Supplier] and measures Count(DISTINCT [Supplier (Raw)]) and Count([SKU]), sorted by raw-name count descending. Add a table 'SKU Resolution' with [SKU], [Legacy SKU (Americas)], [Legacy SKU (EU)], [Product Name], [Weight (kg)], and [Weight Imputed Flag].
```

#### Sheet 4 — Compliance & Recall
```text
In the Qlik app 'MCG Supply Chain Operations', create a sheet named 'Compliance & Recall'. Add KPIs: 'Lot Capture Rate' = 1 - (Sum([Lot Missing Count]) / Sum([SKU Positions])) formatted as a percentage, and 'Positions Missing Lot' = Sum({<[Lot Missing Flag]={1}>} 1). Add a bar chart 'Lot Compliance by DC' with dimension [Distribution Center] and measure Sum([Lot Missing Count]). Add a table 'Trace Detail' with [Distribution Center], [SKU], [Lot Number], [Storage Zone], [Qty On Hand], and [Position Trust Score], sorted so rows with null [Lot Number] appear first. Add a filter pane with [Category] and [Country of Origin].
```

#### Sheet 5 — Executive Cost Impact
```text
In the Qlik app 'MCG Supply Chain Operations', create a sheet named 'Executive Cost Impact'. Add a KPI 'Total Annual Impact' = Sum([AnnualCost]) formatted as $#,##0. Add a treemap 'Cost by Nightmare' with dimension [NightmareName] and measure Sum([AnnualCost]). Add a bar chart 'Nightmare Cost Ranking' with dimension [NightmareName] and measure Sum([AnnualCost]) sorted descending, and a text & image object summarizing: 'Seven data quality nightmares cost MCG $127M annually — this app tracks the operational fixes.' Add a table with [NightmareID], [NightmareName], [Description], and Sum([AnnualCost]).
```

### App: MCG Delivery & Customer Experience
_Load script: `app2-delivery-experience.qvs` · Data product: Last Mile Performance (gold.last_mile_performance)_

#### Sheet 1 — Last Mile Performance
```text
In the Qlik app 'MCG Delivery & Customer Experience', create a sheet named 'Last Mile Performance'. Add KPIs: 'On-Time Rate' = Avg([On-Time Rate]) formatted as a percentage, 'Total Orders' = Sum([Orders]), 'Late Deliveries' = Sum([Late Deliveries]), and 'Avg Days Late' = Avg([Avg Days Late]) with one decimal. Add a bar chart 'On-Time Rate by Carrier' with dimension [Carrier] and measure Avg([On-Time Rate]) sorted ascending so the worst carrier is first, with a reference line at 0.92 labeled 'SLA target'. Add a heatmap-style pivot 'Carrier × Country' with dimensions [Carrier] and [Country] and measure Avg([On-Time Rate]). Add a table with [Carrier], [Country], Sum([Orders]), Sum([Delivered Orders]), Avg([WISMO Rate]), and Avg([Avg Address Quality]).
```

#### Sheet 2 — Live Shipment Tracking
```text
In the Qlik app 'MCG Delivery & Customer Experience', create a sheet named 'Live Shipment Tracking'. Add KPIs: 'Active Shipments' = Count(DISTINCT [Shipment ID]), 'Delivered w/o Timestamp' = Sum({<[Delivered w/o Timestamp Flag]={1}>} 1), and 'Avg Delivery Attempts' = Avg([Ship Delivery Attempts]) with one decimal. Add a funnel or bar chart 'Shipments by Canonical Status' with dimension [Status (Canonical)] and measure Count([Shipment ID]) in lifecycle order CREATED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED. Add a table 'Status Vocabulary Mapping' with [Ship Carrier], [Status (Raw)], [Status (Canonical)], and Count([Shipment ID]) — this shows six carrier vocabularies collapsing into one. Add a filter pane with [Ship Carrier] and [Ship-To Country].
```

#### Sheet 3 — WISMO & Customer Impact
```text
In the Qlik app 'MCG Delivery & Customer Experience', create a sheet named 'WISMO & Customer Impact'. Add KPIs: 'WISMO Inquiries' = Sum([WISMO Inquiries]), 'WISMO Rate' = Avg([WISMO Rate]) formatted as a percentage, and 'Est. WISMO Cost' = Sum([WISMO Inquiries]) * 2.30 formatted as $#,##0 (at $2.30 per inquiry). Add a bar chart 'WISMO Rate by Carrier' with dimension [Carrier] and measure Avg([WISMO Rate]) sorted descending. Add a scatter plot 'Tracking Gaps Drive WISMO' with dimension [Carrier], x-axis Sum([Tracking Missing Count]), y-axis Avg([WISMO Rate]) — the correlation is the story. Add a table of order-level drivers: [Order ID], [Carrier], [Order Status], [Days Late], [WISMO Flag], and [Tracking Missing Flag] filtered to [WISMO Flag] = 1.
```

#### Sheet 4 — Order Timeline
```text
In the Qlik app 'MCG Delivery & Customer Experience', create a sheet named 'Order Timeline'. Add KPIs: 'Delivered Late' = Sum({<[Delivered Late Flag]={1}>} 1), 'Max Days Late' = Max([Days Late]), and 'Orders In Flight' = Count({<[Actual Delivery]={"=Len([Actual Delivery])=0"}>} DISTINCT [Order ID]). Add a line chart 'Orders by Order Date' with dimension [Order Date] and measures Count([Order ID]) and Sum([Delivered Late Flag]). Add a table 'Order Lifecycle' with [Order ID], [Order Date], [Promised Delivery], [Actual Delivery], [Days Late], [Carrier], and [Carrier Status], sorted by [Days Late] descending. Add a filter pane with [Fulfillment Method], [Month Name], and [Quarter].
```

#### Sheet 5 — Address Quality Impact
```text
In the Qlik app 'MCG Delivery & Customer Experience', create a sheet named 'Address Quality Impact'. Add KPIs: 'Avg Address Quality' = Avg([Address Quality Score]) with two decimals, 'Low-Quality Addresses' = Count({<[Address Quality Score]={"<0.75"}>} DISTINCT [Contact ID]), and 'Geocoded by Talend' = Count({<[Address Validation Status]={'GEOCODED'}>} DISTINCT [Contact ID]). Add a map with a point layer using [Latitude] and [Longitude] (from the Talend-validated QVD), colored by [Address Validation Status] (FORMAT_OK green, GEOCODED amber) and sized by Count([Order ID]) — this is the customer hotspot map. Add a scatter plot 'Address Quality vs Lateness' with dimension [Carrier], x-axis Avg([Avg Address Quality]), y-axis Avg([Avg Days Late]). Add a table with [Customer City], [Country (Validated)], [Postal Code (Validated)], [Address Validation Status], [Geo Confidence], Avg([Address Quality Score]), and Count(DISTINCT [Contact ID]) sorted by quality ascending.
```
