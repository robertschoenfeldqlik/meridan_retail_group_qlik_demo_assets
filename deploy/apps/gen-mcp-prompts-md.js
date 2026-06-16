#!/usr/bin/env node
// =============================================================================
// Generate MCP_Sheet_Prompts.md from mcp-sheet-prompts.json (the source of truth
// the deploy UI also surfaces with copy buttons). Keeps the human-readable doc in
// sync with the prompts. Run:  node deploy/apps/gen-mcp-prompts-md.js
// =============================================================================
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'mcp-sheet-prompts.json');
const OUT = path.join(__dirname, 'MCP_Sheet_Prompts.md');
const SERVER_DOC = 'https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikMCP/Qlik-MCP-server.htm';
const TOOLS_DOC = 'https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikMCP/Qlik-MCP-server-tools.htm';

const TOOLS = [
  ['qlik_create_sheet', 'Create a new empty sheet (dashboard) in the app'],
  ['qlik_add_chart', 'Add a visualization (bar, line, pie, table, KPI, etc.) to a sheet'],
  ['qlik_add_filter', 'Add a filter panel to a sheet for user-driven filtering'],
  ['qlik_create_measure', 'Create a reusable library measure with an expression'],
  ['qlik_create_dimension', 'Create a reusable library dimension'],
  ['qlik_list_measures / qlik_list_dimensions', 'List the library measures / dimensions in the app'],
  ['qlik_update_measure / qlik_update_dimension', 'Update an existing library measure / dimension'],
  ['qlik_create_data_object', 'Create a temporary calculation object for ad-hoc analytics'],
];

const cfg = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const L = [];
L.push('# MCG — Qlik MCP Sheet-Authoring Prompts');
L.push('');
L.push('Build the analytics **app sheets** conversationally with the **Qlik MCP server**. The deploy creates each app *empty* (load script only, mapped to its gold data product); you author the sheets by pasting the prompts below into an MCP client (Claude Desktop / Claude Code) connected to your tenant.');
L.push('');
L.push('> This file is generated from `deploy/apps/mcp-sheet-prompts.json` — edit that and re-run `node deploy/apps/gen-mcp-prompts-md.js`.');
L.push('');
L.push('**Qlik docs:** [Qlik MCP server](' + SERVER_DOC + ') · [Qlik MCP server tools](' + TOOLS_DOC + ')');
L.push('');
L.push('## Prerequisites');
L.push('- **Open Lakehouse + pipelines deployed** and the gold tables populated. The apps read the lakehouse **through Amazon Athena** — their load scripts `LIB CONNECT TO` the Athena connection (Glue catalog: bronze / silver / gold).');
L.push('- **Data products registered** and the **two apps created** (Build Apps step) — empty, load-script only.');
L.push('- **Qlik MCP server enabled** for your tenant (admin — see *Deploying Qlik MCP server for a tenant*). Users must approve sharing data with the AI client.');
L.push('- Field names in the prompts match `deploy/apps/load-scripts/*.qvs` exactly.');
L.push('');
L.push('## Connect your MCP client');
L.push('Streamable/SSE endpoint:');
L.push('```');
L.push((cfg.mcpSetup && cfg.mcpSetup.endpoint) || 'https://<your-tenant>.<region>.qlikcloud.com/api/ai/mcp');
L.push('```');
if (cfg.mcpSetup && cfg.mcpSetup.claudeDesktopConfig) {
  L.push('Add to `claude_desktop_config.json` (or your MCP client config), then restart the client:');
  L.push('```json');
  L.push(JSON.stringify(cfg.mcpSetup.claudeDesktopConfig, null, 2));
  L.push('```');
}
if (cfg.mcpSetup && cfg.mcpSetup.testPrompt) {
  L.push('Sanity check once connected:');
  L.push('```');
  L.push(cfg.mcpSetup.testPrompt);
  L.push('```');
}
L.push('');
L.push('## MCP tools the prompts use');
L.push('| Tool | What it does |');
L.push('| --- | --- |');
TOOLS.forEach((t) => L.push('| `' + t[0] + '` | ' + t[1] + ' |'));
L.push('');
L.push('## Prompts');
L.push('Paste one prompt at a time; review each sheet before moving on. Tip: prefix with *"Use the Qlik MCP server."* if the client needs nudging.');
L.push('');

(cfg.apps || []).forEach((app) => {
  L.push('### App: ' + app.appName);
  const meta = [];
  if (app.loadScript) meta.push('Load script: `' + app.loadScript + '`');
  if (app.dataProduct) meta.push('Data product: ' + app.dataProduct);
  if (meta.length) L.push('_' + meta.join(' · ') + '_');
  L.push('');
  (app.sheets || []).forEach((s, i) => {
    L.push('#### Sheet ' + (i + 1) + ' — ' + s.title);
    L.push('```text');
    L.push(s.prompt);
    L.push('```');
    L.push('');
  });
});

fs.writeFileSync(OUT, L.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
const sheets = (cfg.apps || []).reduce((n, a) => n + (a.sheets || []).length, 0);
console.log('Wrote', OUT, '—', (cfg.apps || []).length, 'apps,', sheets, 'sheet prompts');
