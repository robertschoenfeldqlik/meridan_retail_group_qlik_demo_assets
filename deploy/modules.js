// ---------------------------------------------------------------------------
//  modules.js
//  The four Project Qlarity modules. Each one can be deployed, documented and
//  demoed on its own. This file is the single catalog shared by
//  deploy-to-qlik.js (--module), the automation workspaces, and the
//  generators that split the collateral per module.
//
//  `components` are keys of cfg.enabledComponents, i.e. the deploy steps.
//  `spaces` (Step 3) is CORE: every module runs it. It is find-or-create, so a
//  module deployed on its own still resolves the spaces it needs.
//
//  `setupSections` refers to the combined Setup Guide's section numbers, so
//  the per-module guides keep the same numbering and cross-references.
//  `demoScripts` are the NN_ prefixes of documents/demo-scripts/*.docx.
//  `video` is the series story folder under MCG Video Voiceover/series.
// ---------------------------------------------------------------------------
'use strict';

const CORE = ['spaces'];

const MODULES = {
  integration: {
    label: 'Data Integration',
    short: 'Integration',
    color: 'qlikGreen',
    components: ['docker', 'connections', 'pipelines'],
    workspaces: [],
    scope: 'Qlik pipelines on Open Lakehouse (CDC landing, Iceberg storage, Snowflake mirror, streaming), Talend Studio job',
    setupSections: [3, 7, 8],
    demoScripts: ['01', '02', '03', '14', '18'],
    video: 's2_integration',
  },
  governance: {
    label: 'Governance',
    short: 'Governance',
    color: 'qlikTeal',
    components: ['glossary', 'dataproducts', 'attach', 'stewardship'],
    workspaces: ['address_correction', 'sprint_summary'],
    scope: 'Data products, stewardship, Trust Score, Data Quality agent, glossary, lineage',
    setupSections: [9, 11, 14],
    demoScripts: ['04', '05', '10', '11', '15', '16', '17'],
    video: 's3_governance',
  },
  analytics: {
    label: 'Analytics',
    short: 'Analytics',
    color: 'qlikBlue',
    components: ['theme', 'automations', 'predict', 'webhooks', 'reloadtasks'],
    workspaces: ['daily_app_reload', 'cold_chain_alert', 'pipeline_health'],
    scope: 'Analytics apps, automations, Qlik Predict',
    setupSections: [6, 12, 13],
    demoScripts: ['06', '07', '08', '12'],
    video: 's4_analytics',
  },
  ai: {
    label: 'AI',
    short: 'AI',
    color: 'qlikLightGreen',
    components: ['knowledge', 'assistant'],
    workspaces: [],
    scope: 'Qlik MCP, Qlik Answers, Discovery / Insight agent',
    setupSections: [10, 17],
    demoScripts: ['09', '13'],
    video: 's5_ai',
  },
};

const ORDER = ['integration', 'governance', 'analytics', 'ai'];

// Setup Guide sections every module pack carries (prerequisites, spaces,
// security, troubleshooting).
const COMMON_SETUP_SECTIONS = [1, 2, 4, 5, 15, 16];

/**
 * Parse a --module value ("all", "governance", "integration,ai") into a list
 * of module keys. Throws on an unknown name so a typo never silently deploys
 * nothing.
 */
function parseModules(value) {
  if (!value || value === 'all') return ORDER.slice();
  const keys = String(value).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const unknown = keys.filter((k) => !MODULES[k]);
  if (unknown.length) {
    throw new Error(`Unknown module "${unknown.join(', ')}". Use one of: ${ORDER.join(', ')}, all.`);
  }
  return ORDER.filter((k) => keys.includes(k));
}

function isAll(modules) {
  return ORDER.every((k) => modules.includes(k));
}

/**
 * Turn the user's enabledComponents into the effective set for the selected
 * modules. Components outside the selection are forced off; inside it, the
 * user's own `false` still wins. With every module selected the input is
 * returned unchanged in effect, so a plain run behaves exactly as before.
 */
function applyModuleMask(enabled, modules) {
  const out = Object.assign({}, enabled || {});
  if (isAll(modules)) return out;
  const allowed = new Set(CORE);
  modules.forEach((m) => MODULES[m].components.forEach((c) => allowed.add(c)));
  const every = new Set(CORE);
  ORDER.forEach((m) => MODULES[m].components.forEach((c) => every.add(c)));
  every.forEach((c) => { if (!allowed.has(c)) out[c] = false; });
  return out;
}

/** Module that owns a given automation workspace key, or null. */
function moduleForWorkspace(key) {
  return ORDER.find((m) => MODULES[m].workspaces.includes(key)) || null;
}

module.exports = {
  MODULES, ORDER, CORE, COMMON_SETUP_SECTIONS,
  parseModules, isAll, applyModuleMask, moduleForWorkspace,
};
