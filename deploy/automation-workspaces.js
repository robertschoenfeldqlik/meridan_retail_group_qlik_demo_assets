#!/usr/bin/env node
// ---------------------------------------------------------------------------
//  automation-workspaces.js
//  Authors REAL block graphs for the MCG automations and pushes them into the
//  Qlik Cloud tenant.
//
//  Why this exists: deploy-to-qlik.js's createAutomation() posts only
//  { name, description, state } — every MCG automation in the tenant today has
//  `workspace: null`, i.e. it is an empty shell whose blocks were meant to be
//  dragged in by hand. This module fills the workspace in.
//
//  The block schema and the connector/endpoint GUIDs below were recovered from
//  the tenant itself:
//    - GET /api/v1/automations/{id}         -> workspace of a working automation
//    - GET /api/v1/automations/connectors   -> connector catalog (76 connectors)
//    - GET /api/v1/automations/connectors/{connectorGuid}
//                                           -> 153 endpoints, each with a GUID
//    - GET /api/v1/automations/connectors/{connectorGuid}/endpoints/{guid}
//                                           -> that endpoint's parameter GUIDs
//  (route shapes read out of /qmfe/automations/3.80.2/qmfe-automations.js —
//  guessing them fails, exactly as it did for the stewardship API).
//
//  EndpointBlock inputs are keyed by opaque PARAMETER GUIDs, not names, which
//  is why those constants are spelled out rather than inlined.
//
//  Usage:
//    node deploy/automation-workspaces.js --list
//    node deploy/automation-workspaces.js --dry-run
//    node deploy/automation-workspaces.js                  # push all
//    node deploy/automation-workspaces.js --only address_correction
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCRIPT_DIR = __dirname;

// ---------------------------------------------------------------------------
//  Tenant constants (harvested — see header)
// ---------------------------------------------------------------------------

const QCS_CONNECTOR = '61a87510-c7a3-11ea-95da-0fb0c241e75c'; // Qlik Cloud Services

// "raw API request" on Qlik Cloud Services — kept for `/api/v1/*` calls.
//
// ⚠ ROUTING LIMIT, established by live runs: this block reaches `/api/v1/*`
//   ONLY. `v1/spaces` runs green; `data-governance/sprints/...` comes back
//   404 "Unknown Service", because the automations runtime resolves the
//   tenant's internal alias host, which does not route the data-governance
//   service. Absolute URLs and `../` escapes were tried and fail the same way.
//   The identical paths work from an ordinary API-key client
//   (deploy/stewardship.js proves it) — a gateway boundary, not permissions.
//
//   Anything under /api/data-governance therefore uses apiKeyBlock() and the
//   API Key connector below, which addresses the PUBLIC tenant hostname.
const EP_RAW_API = {
  guid: '72d48530-bbb0-11f0-875a-b322bf237aeb',
  role: 'create',
  params: {
    path:             '734cbcc0-bbb0-11f0-b998-f73920377683',
    HTTP_method:      '7322a550-bbb0-11f0-9c8c-43f143a32456',
    body:             '73000fe0-bbb0-11f0-8a80-59ece3571bd9',
    query_parameters: '736fae60-bbb0-11f0-ad62-c98a0046f418',
  },
};

// ---------------------------------------------------------------------------
//  Block authoring helpers
// ---------------------------------------------------------------------------

// Block ids are uppercase GUIDs. Derive them from the automation + block name
// so re-running produces the same graph instead of orphaning blocks.
function blockId(seed) {
  const h = crypto.createHash('sha1').update(seed).digest('hex').toUpperCase();
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' +
         h.slice(16, 20) + '-' + h.slice(20, 32);
}

function input(id, type, value) {
  return { id, type, value: value === undefined ? null : value, structure: [] };
}

// Every endpoint block carries these two; blendr_on_error=stop means a failed
// API call aborts the run rather than silently continuing with empty data.
function endpointSettings(onError) {
  return [
    input('blendr_on_error', 'select', onError || 'stop'),
    input('automations_censor_data', 'checkbox', false),
  ];
}

function startBlock(auto, childId, runMode) {
  return {
    x: 0, y: 0,
    id: blockId(auto + ':Start'),
    name: 'Start',
    type: 'StartBlock',
    inputs: [input('run_mode', 'select', runMode || 'manual')],
    childId,
    comment: null,
    disabled: false,
    settings: [],
    collapsed: [{ name: 'loop', isCollapsed: false }],
    displayName: 'Start',
  };
}

/** A "raw API request" EndpointBlock against Qlik Cloud Services. */
function rawApiBlock(auto, name, opts) {
  const o = opts || {};
  return {
    x: o.x || 0, y: o.y || 0,
    id: blockId(auto + ':' + name),
    name,
    type: 'EndpointBlock',
    inputs: [
      input(EP_RAW_API.params.path, 'string', o.path),
      input(EP_RAW_API.params.HTTP_method, 'select', o.method || 'GET'),
      input(EP_RAW_API.params.body, 'string', o.body === undefined ? null : o.body),
      input(EP_RAW_API.params.query_parameters, 'string', o.query === undefined ? null : o.query),
    ],
    childId: o.childId || null,
    comment: o.comment || null,
    disabled: false,
    settings: endpointSettings(o.onError),
    collapsed: [{ name: 'loop', isCollapsed: false }],
    displayName: 'Raw API request',
    endpoint_guid: EP_RAW_API.guid,
    endpoint_role: EP_RAW_API.role,
    datasourcetype_guid: QCS_CONNECTOR,
  };
}

function ifElseBlock(auto, name, opts) {
  const o = opts || {};
  return {
    x: o.x || 0, y: o.y || 0,
    id: blockId(auto + ':' + name),
    name,
    type: 'IfElseBlock',
    inputs: [input('conditions', 'custom', {
      mode: o.mode || 'all',
      conditions: o.conditions || [],
    })],
    childId: null,
    comment: o.comment || null,
    disabled: false,
    settings: [],
    collapsed: [
      { name: 'both', isCollapsed: false },
      { name: 'yes', isCollapsed: false },
      { name: 'no', isCollapsed: false },
    ],
    childTrueId: o.childTrueId || null,
    displayName: 'Condition',
    childFalseId: o.childFalseId || null,
  };
}

function updateJobBlock(auto, name, title, childId) {
  return {
    x: 0, y: 0,
    id: blockId(auto + ':' + name),
    name,
    type: 'UpdateJobBlock',
    inputs: [input('title', 'string', title)],
    childId: childId || null,
    comment: null,
    disabled: false,
    settings: [],
    collapsed: [{ name: 'loop', isCollapsed: false }],
    displayName: 'Update run title',
  };
}

// ---------------------------------------------------------------------------
//  The workspaces
// ---------------------------------------------------------------------------

/**
 * MCG Address Correction Loop — Talend.
 *
 * Replaces the fictional endpoints in automation-definitions.json:
 *   GET /api/v1/stewardship/tasks          -> 404, matches no real API
 *   PUT /api/v1/stewardship/tasks/{taskId} -> 404
 * with the real external-integration records API on the sprint created by
 * deploy/stewardship.js.
 */
function addressCorrectionWorkspace(cfg) {
  const auto = 'address_correction';
  const sprintId = ((cfg && cfg.stewardship) || {}).sprintId || '';
  if (!sprintId) return { error: 'No stewardship.sprintId in config.json — run `node deploy/stewardship.js` first.' };

  // NOTE: the block builds <tenant>/api/ + path, so the path must be RELATIVE —
  // no leading slash and no /api prefix. Both mistakes were caught by live runs:
  // '/api/data-governance/...' -> /api//api/... , '/data-governance/...' -> /api//... ,
  // both 404 "Unknown Service".
  const recordsPath = 'data-governance/sprints/' + sprintId + '/external-integrations/records';

  const ids = {
    fetch: blockId(auto + ':FetchStewardRecords'),
    consume: blockId(auto + ':MarkRecordsConsumed'),
  };

  // WHY THERE IS NO COUNT CONDITION HERE.
  //
  // The obvious shape is fetch -> if(count > 0) -> consume. It is not built that
  // way for two reasons, both established by live runs:
  //
  //   1. Block-output expressions (`{ $.FetchStewardRecords.data | length }`)
  //      resolve to empty in this tenant, so the condition always took the true
  //      branch and tried to consume an empty sprint. Several syntaxes were
  //      tried; none bound the upstream block's output.
  //   2. More importantly, consuming here would be WRONG even if it worked.
  //      "Consume" means "these corrections are handled" — but at this point in
  //      the flow Talend has not applied them yet. Acknowledging first means a
  //      Talend failure silently loses the steward's work.
  //
  // So the automation's job is to SURFACE the corrected records; applying them
  // and then consuming them belongs to the Talend job, where a plain API key
  // works (deploy/stewardship.js pushRecords proves the call) and the ordering
  // is correct. The consume block is kept, wired and documented but DISABLED so
  // the full loop is visible in the designer without running out of order.
  const consume = apiKeyBlock(auto, 'MarkRecordsConsumed', {
    x: 0, y: 440,
    path: recordsPath + '/actions/consume',
    method: 'POST',
    body: '{ "recordIds": [] }',
    // A json_object body still needs the header spelled out — without it the
    // API answers 415 Unsupported Media Type. Caught by a live run.
    headers: '{ "Content-Type": "application/json" }',
    comment: 'Acknowledge corrections AFTER Talend has applied them. Disabled here on purpose — the Talend job owns this call so a failed apply cannot lose a steward fix.',
  });
  consume.disabled = true;

  const blocks = [
    startBlock(auto, ids.fetch, 'scheduled'),

    apiKeyBlock(auto, 'FetchStewardRecords', {
      x: 0, y: 220,
      path: recordsPath,
      method: 'GET',
      comment: 'Read steward-corrected address records out of the Address Cleanup sprint. This is the hand-off point for the Talend job.',
      childId: ids.consume,
    }),

    consume,
  ];

  return {
    workspace: { blocks, variables: [] },
    connectorIds: [APIKEY_CONNECTOR],
    endpointIds: [EP_APIKEY_RAW.guid],
  };
}

/**
 * MCG Stewardship Sprint Summary — reads the sprint summary and titles the run
 * with it. Small on purpose: it is the read-only half of the loop, safe to
 * enable in a demo, and proves the sprint is live without mutating anything.
 */
function sprintSummaryWorkspace(cfg) {
  const auto = 'sprint_summary';
  const sprintId = ((cfg && cfg.stewardship) || {}).sprintId || '';
  if (!sprintId) return { error: 'No stewardship.sprintId in config.json — run `node deploy/stewardship.js` first.' };

  const ids = { title: blockId(auto + ':ReportSummary') };
  const blocks = [
    startBlock(auto, blockId(auto + ':FetchSprintSummary'), 'scheduled'),
    apiKeyBlock(auto, 'FetchSprintSummary', {
      x: 0, y: 220,
      path: 'data-governance/sprints/' + sprintId + '/external-integrations/sprint-summary',
      method: 'GET',
      comment: 'Read the Address Cleanup sprint summary.',
      childId: ids.title,
    }),
    updateJobBlock(auto, 'ReportSummary', 'Address Cleanup sprint summary read'),
  ];

  return {
    workspace: { blocks, variables: [] },
    connectorIds: [APIKEY_CONNECTOR],
    endpointIds: [EP_APIKEY_RAW.guid],
  };
}

/**
 * MCG Daily App Reload.
 *
 * Uses the Qlik Cloud Services block, not the API Key one: `v1/reloads` is on
 * the /api/v1 surface that block can reach (proven — a `v1/spaces` probe runs
 * green), so no extra connection is needed.
 *
 * Targets the apps in the SHARED space. The published copies in the managed
 * space are republished from these, so reloading them directly would be both
 * redundant and wrong.
 */
function dailyAppReloadWorkspace(cfg, ctx) {
  const auto = 'daily_app_reload';
  const apps = (ctx && ctx.apps) || [];
  if (!apps.length) {
    return { error: 'No MCG apps found in the shared space — deploy the apps first.' };
  }

  const blocks = [];
  const blockName = (a) => 'Reload' + a.name.replace(/[^A-Za-z0-9]/g, '');

  // Chain the reloads: Start -> reload app 1 -> reload app 2 -> ...
  blocks.push(startBlock(auto, blockId(auto + ':' + blockName(apps[0])), 'scheduled'));
  apps.forEach((a, i) => {
    const next = apps[i + 1];
    blocks.push(rawApiBlock(auto, blockName(a), {
      x: 0, y: 220 * (i + 1),
      path: 'v1/reloads',
      method: 'POST',
      body: JSON.stringify({ appId: a.id }),
      comment: 'Reload "' + a.name + '"',
      childId: next ? blockId(auto + ':' + blockName(next)) : null,
    }));
  });

  return {
    workspace: { blocks, variables: [] },
    connectorIds: [QCS_CONNECTOR],
    endpointIds: [EP_RAW_API.guid],
  };
}

/** Resolve the MCG apps in the shared space, newest name-match wins. */
async function prepareDailyAppReload(cfg) {
  const res = await fetch(tenantBase(cfg) + '/api/v1/items?resourceType=app&limit=100',
    { headers: authHeaders(cfg) });
  if (!res.ok) return { apps: [] };
  const body = await res.json();
  const sharedName = (cfg.spaces || {}).shared;
  const spaces = await fetch(tenantBase(cfg) + '/api/v1/spaces?limit=100', { headers: authHeaders(cfg) })
    .then((r) => r.json()).catch(() => ({ data: [] }));
  const shared = (spaces.data || []).find((sp) => sp.name === sharedName);
  const sharedId = shared ? shared.id : '';

  const apps = (body.data || [])
    .filter((a) => /^MCG /.test(a.name || '') && (!sharedId || a.spaceId === sharedId))
    .map((a) => ({ id: a.resourceId, name: a.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { apps };
}

// ---------------------------------------------------------------------------
//  Microsoft Teams
// ---------------------------------------------------------------------------

// Teams is an OAUTH connector — its only connection parameter is `permissions`,
// so a connection is authorized through a browser consent flow, not an API call.
// That is a genuine user action (it grants access to their Teams account), so
// these two workspaces are authored either way: if an authorized connection
// exists the send block is live, otherwise it ships disabled with a comment
// saying what to do. Nothing else about the graph changes.
const TEAMS_CONNECTOR = '0d87af8f-27c0-11ea-921c-022e6b5ea1e2';

const EP_TEAMS_SEND = {
  guid: 'ce5ffe30-d33a-11eb-b284-3955388e8c59',
  role: 'create',
  params: {
    team_id:    'ce80c8c0-d33a-11eb-a1be-fb85dcd48977',
    channel_id: 'ce8be4d0-d33a-11eb-aa74-37bc58fc7293',
    content:    'ce9788f0-d33a-11eb-a754-31a1e548ae07',
    attachment: 'cebb4240-d33a-11eb-86c4-cf0a4f744ace',
  },
};

/** Is there an authorized (connected) Microsoft Teams connection? */
async function teamsConnection(cfg) {
  const conns = await listConnections(cfg);
  return conns.find((c) => c.connectorId === TEAMS_CONNECTOR && c.isConnected) || null;
}

function teamsSendBlock(auto, name, opts) {
  const o = opts || {};
  const b = {
    x: o.x || 0, y: o.y || 0,
    id: blockId(auto + ':' + name),
    name,
    type: 'EndpointBlock',
    inputs: [
      input(EP_TEAMS_SEND.params.team_id, 'string', o.teamId || null),
      input(EP_TEAMS_SEND.params.channel_id, 'string', o.channelId || null),
      input(EP_TEAMS_SEND.params.content, 'string', o.content || null),
      input(EP_TEAMS_SEND.params.attachment, 'string', null),
    ],
    childId: o.childId || null,
    comment: o.comment || null,
    disabled: !!o.disabled,
    settings: endpointSettings(o.onError),
    collapsed: [{ name: 'loop', isCollapsed: false }],
    displayName: 'Send message',
    endpoint_guid: EP_TEAMS_SEND.guid,
    endpoint_role: EP_TEAMS_SEND.role,
    datasourcetype_guid: TEAMS_CONNECTOR,
  };
  return b;
}

/** Shared shape for the two Teams alert automations. */
function teamsAlertWorkspace(auto, cfg, ctx, spec) {
  const authorized = !!(ctx && ctx.teamsConnected);
  const tcfg = (cfg.automations || {});
  const blocks = [
    startBlock(auto, blockId(auto + ':' + spec.queryName), 'scheduled'),
    rawApiBlock(auto, spec.queryName, {
      x: 0, y: 220,
      // The QCS block validates `path` against a fixed resource list and rejects
      // an inline query string ("Invalid resource: reloads?limit=5"). Query
      // parameters belong in their own input.
      path: spec.path,
      method: 'GET',
      query: spec.query || null,
      comment: spec.queryComment,
      childId: blockId(auto + ':PostToTeams'),
    }),
    teamsSendBlock(auto, 'PostToTeams', {
      x: 0, y: 440,
      teamId: tcfg.teamsTeamId || null,
      channelId: tcfg.teamsChannelId || null,
      content: spec.message,
      disabled: !authorized,
      comment: authorized
        ? 'Posts the alert to the MCG ops channel.'
        : 'DISABLED: no authorized Microsoft Teams connection. Teams uses OAuth, so it must be '
          + 'connected once in Automations -> Connections -> Microsoft Teams. Then set '
          + 'automations.teamsTeamId / teamsChannelId in config.json and re-run '
          + 'npm run automations:workspaces to enable this block.',
    }),
  ];
  return {
    workspace: { blocks, variables: [] },
    connectorIds: authorized ? [QCS_CONNECTOR, TEAMS_CONNECTOR] : [QCS_CONNECTOR],
    endpointIds: authorized ? [EP_RAW_API.guid, EP_TEAMS_SEND.guid] : [EP_RAW_API.guid],
  };
}

function coldChainAlertWorkspace(cfg, ctx) {
  return teamsAlertWorkspace('cold_chain_alert', cfg, ctx, {
    queryName: 'QueryColdChainBreaches',
    path: 'v1/reloads',
    query: '{ "limit": 5 }',
    queryComment: 'Placeholder read on the /api/v1 surface. Point this at the cold-chain gold '
      + 'dataset once the Open Lakehouse is up — the block only routes /api/v1/*.',
    message: 'MCG cold chain: temperature exceedance detected. Check the Supply Chain Operations app.',
  });
}

function pipelineHealthWorkspace(cfg, ctx) {
  return teamsAlertWorkspace('pipeline_health', cfg, ctx, {
    queryName: 'QueryPipelineHealth',
    path: 'v1/reloads',
    query: '{ "limit": 10 }',
    queryComment: 'Reads recent reload outcomes as the pipeline-health signal.',
    message: 'MCG pipeline health: daily summary. Check recent reload outcomes.',
  });
}

async function prepareTeams(cfg) {
  const conn = await teamsConnection(cfg);
  return { teamsConnected: !!conn, teamsConnectionId: conn ? conn.id : '' };
}

const WORKSPACES = {
  address_correction: {
    automationName: 'MCG Address Correction — Talend Job Trigger',
    build: addressCorrectionWorkspace,
  },
  sprint_summary: {
    automationName: 'MCG Stewardship Sprint Summary',
    build: sprintSummaryWorkspace,
  },
  daily_app_reload: {
    automationName: 'MCG Daily App Reload',
    build: dailyAppReloadWorkspace,
    prepare: prepareDailyAppReload,
  },
  cold_chain_alert: {
    automationName: 'MCG Cold Chain Alert → Teams',
    build: coldChainAlertWorkspace,
    prepare: prepareTeams,
  },
  pipeline_health: {
    automationName: 'MCG Pipeline Health Daily Summary → Teams',
    build: pipelineHealthWorkspace,
    prepare: prepareTeams,
  },
};

// ---------------------------------------------------------------------------
//  Tenant I/O
// ---------------------------------------------------------------------------

function loadConfig() {
  const p = path.join(SCRIPT_DIR, 'config.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function tenantBase(cfg) {
  return 'https://' + cfg.tenant.hostname + '.' + cfg.tenant.region;
}

function authHeaders(cfg) {
  return { Authorization: 'Bearer ' + cfg.auth.apiKey, 'Content-Type': 'application/json' };
}

async function listAutomations(cfg) {
  const res = await fetch(tenantBase(cfg) + '/api/v1/automations?limit=100', { headers: authHeaders(cfg) });
  if (!res.ok) throw new Error('List automations failed (' + res.status + ')');
  return (await res.json()).data || [];
}

// ---------------------------------------------------------------------------
//  The API Key connection — how automations reach /api/data-governance/*
// ---------------------------------------------------------------------------

// The generic "API Key" connector. Unlike Qlik Cloud Services it is not
// internal, so it takes a full base_url and can address the PUBLIC tenant
// hostname — which is the only way an automation block reaches the
// data-governance service.
const APIKEY_CONNECTOR = '3730c770-7f52-11ed-a7dc-2f9bb7b5fbf1';

const APIKEY_PARAMS = {
  connector_name:      'a1738770-96e8-11ed-aba8-61845d7176e2',
  type:                '550f6d20-8121-11ed-884c-bbb59944270b',
  authentication_name: '001478a0-962c-11ed-bf31-6989bed85e10',
  api_key:             '2e479bc0-8121-11ed-83a9-29c0b8e2465d',
  base_url:            '9e3a3870-8122-11ed-8598-5b004f8cc064',
};

const EP_APIKEY_RAW = {
  guid: 'edd752f0-eb6f-11ee-9c28-69caf710219b',
  role: 'create',
  params: {
    path:             'ede413c0-eb6f-11ee-b9e3-df1b224663e6',
    method:           'edeee720-eb6f-11ee-bf78-3503aff7cb86',
    query_parameters: 'edf7e380-eb6f-11ee-8426-9fb29b4bf44a',
    request_body:     'ee016880-eb6f-11ee-bf28-a794c9af8769',
    headers:          'ee0896f0-eb6f-11ee-8ffc-6ffdbfcbdb05',
  },
};

const APIKEY_CONNECTION_NAME = 'MCG Qlik Data Governance (API Key)';

// Shown whenever the connection exists but is not connected. Kept as one string
// so the CLI, the deploy step and the admin UI all say exactly the same thing.
// Fallback only. Creation is fully automated (see ensureApiKeyConnection), so
// this is shown just when a connection somehow lands unconnected — e.g. the
// stored key was rotated and no longer authenticates.
const MANUAL_CONNECTION_STEPS = [
  'This connection exists but is not connected. Re-run with --recreate, or fix it in the UI:',
  '  Automations -> Connections -> ' + APIKEY_CONNECTION_NAME + ' -> Edit',
  '  connector_name      = MCG Qlik Data Governance',
  '  type                = httpheader',
  '  authentication_name = Authorization',
  '  api_key             = Bearer <your Qlik API key>   (the "Bearer " prefix is part of the value)',
  '  base_url            = <tenant>/api/                (no https://, trailing slash)',
].join('\n');

async function listConnections(cfg) {
  const res = await fetch(tenantBase(cfg) + '/api/v1/automation-connections?limit=100', { headers: authHeaders(cfg) });
  if (!res.ok) throw new Error('List connections failed (' + res.status + ')');
  return (await res.json()).data || [];
}

/**
 * Create the API Key connection if it does not already exist.
 *
 * The API key is read from config.json and posted straight to the tenant's own
 * connection store — it is never logged, echoed, or passed on a command line.
 */
async function ensureApiKeyConnection(cfg, opts) {
  const options = opts || {};
  let existing = (await listConnections(cfg)).find((c) => c.name === APIKEY_CONNECTION_NAME);

  // Only replace on an explicit --recreate. An unconnected connection is the
  // NORMAL state until a human finishes it in the UI (see below) — deleting it
  // automatically would throw away their work on the next run.
  if (existing && options.recreate && !options.dryRun) {
    const del = await deleteConnection(cfg, existing.id);
    if (!del.success) return del;
    existing = undefined;
  }
  if (existing) return { success: true, action: 'exists', id: existing.id, name: existing.name, connected: !!existing.isConnected };

  if (!cfg.auth || !cfg.auth.apiKey) {
    return { success: false, error: 'No auth.apiKey in config.json.' };
  }

  // Param VALUES, keyed by the connector's parameter NAMES. The ids in the
  // connector catalog are not the ids a created connection carries — each
  // connection gets its own param instance ids — so values are matched by name
  // after the connection exists.
  //
  // Field rules come from the connector's own documentation:
  //   type      must be `httpheader` or `querystring` (not `bearer`)
  //   api_key   is the whole header VALUE, so it includes the "Bearer " prefix
  //   base_url  excludes the scheme — "host/api/", not "https://host/api"
  const values = {
    connector_name: 'MCG Qlik Data Governance',
    type: 'httpheader',
    authentication_name: 'Authorization',
    api_key: 'Bearer ' + cfg.auth.apiKey,
    base_url: cfg.tenant.hostname + '.' + cfg.tenant.region + '/api/',
  };

  if (options.dryRun) {
    return { success: true, dryRun: true, body: {
      name: APIKEY_CONNECTION_NAME,
      connectorId: APIKEY_CONNECTOR,
      params: Object.assign({}, values, { api_key: 'Bearer <config.auth.apiKey>' }),
    } };
  }

  // The payload shape matters, and it is not the obvious one. The Add Connection
  // modal posts { connectorId, spaceId, name, params } where `params` is the
  // connector's OWN parameter objects — guid, name, fieldType, isOptional,
  // documentation and all — each with `.value` filled in. Posting bare
  // { id, value } pairs is accepted with a 201 but silently stores nothing, and
  // the connection comes back isConnected:false. So: fetch the connector, set
  // values on its params by name, and send them back whole.
  const base = tenantBase(cfg);

  const connector = await (await fetch(base + '/api/v1/automations/connectors/' + APIKEY_CONNECTOR,
    { headers: authHeaders(cfg) })).json();
  const connectorParams = (connector.params || []).map((prm) => {
    const p = Object.assign({}, prm);
    if (Object.prototype.hasOwnProperty.call(values, p.name)) p.value = values[p.name];
    return p;
  });

  const missing = connectorParams.filter((p) => !p.value && (p.isOptional === false || p.isoptional === false));
  if (missing.length) {
    return { success: false, error: 'Connector params with no value: ' + missing.map((p) => p.name).join(', ') };
  }

  const createRes = await fetch(base + '/api/v1/automation-connections', {
    method: 'POST', headers: authHeaders(cfg),
    body: JSON.stringify({
      name: APIKEY_CONNECTION_NAME,
      connectorId: APIKEY_CONNECTOR,
      spaceId: '',
      params: connectorParams,
    }),
  });
  const createText = await createRes.text();
  if (!createRes.ok) {
    // Never echo the request body back — it holds the key.
    return { success: false, status: createRes.status,
             error: 'Create connection failed (' + createRes.status + '): ' + createText.slice(0, 300) };
  }
  let created = {};
  try { created = JSON.parse(createText); } catch (_) {}
  const id = created.id || '';
  if (!id) return { success: false, error: 'Connection created but no id returned.' };

  const after = await (await fetch(base + '/api/v1/automation-connections/' + id, { headers: authHeaders(cfg) })).json();
  return {
    success: true, action: 'created', id, name: APIKEY_CONNECTION_NAME,
    connected: !!after.isConnected,
    manualStep: after.isConnected ? '' : MANUAL_CONNECTION_STEPS,
  };
}

/** Delete a connection by id — used by --recreate to replace a broken one. */
async function deleteConnection(cfg, connectionId) {
  const res = await fetch(tenantBase(cfg) + '/api/v1/automation-connections/' + connectionId, {
    method: 'DELETE', headers: authHeaders(cfg),
  });
  if (!res.ok && res.status !== 404) {
    return { success: false, error: 'Delete connection failed (' + res.status + ')' };
  }
  return { success: true };
}

/** Set a connection's parameter values, matching the connector's param names. */
async function fillConnectionParams(cfg, connectionId, values) {
  const base = tenantBase(cfg);
  const url = base + '/api/v1/automation-connections/' + connectionId;

  const current = await (await fetch(url, { headers: authHeaders(cfg) })).json();
  const params = (current.params || []).map((p) => ({
    id: p.id,
    value: Object.prototype.hasOwnProperty.call(values, p.name) ? values[p.name] : p.value,
  }));

  const res = await fetch(url, {
    method: 'PUT', headers: authHeaders(cfg),
    body: JSON.stringify({ name: current.name, connectorId: current.connectorId, params }),
  });
  const text = await res.text();
  if (!res.ok) {
    return { success: false, status: res.status,
             error: 'Set connection params failed (' + res.status + '): ' + text.slice(0, 300) };
  }
  const after = await (await fetch(url, { headers: authHeaders(cfg) })).json();
  return { success: true, connected: !!after.isConnected };
}

/** A "raw API request" EndpointBlock against the API Key connector. */
function apiKeyBlock(auto, name, opts) {
  const o = opts || {};
  return {
    x: o.x || 0, y: o.y || 0,
    id: blockId(auto + ':' + name),
    name,
    type: 'EndpointBlock',
    inputs: [
      input(EP_APIKEY_RAW.params.path, 'string', o.path),
      input(EP_APIKEY_RAW.params.method, 'select', o.method || 'GET'),
      input(EP_APIKEY_RAW.params.query_parameters, 'string', o.query === undefined ? null : o.query),
      input(EP_APIKEY_RAW.params.request_body, 'string', o.body === undefined ? null : o.body),
      input(EP_APIKEY_RAW.params.headers, 'string', o.headers === undefined ? null : o.headers),
    ],
    childId: o.childId || null,
    comment: o.comment || null,
    disabled: false,
    settings: endpointSettings(o.onError),
    collapsed: [{ name: 'loop', isCollapsed: false }],
    displayName: 'Raw API request',
    endpoint_guid: EP_APIKEY_RAW.guid,
    endpoint_role: EP_APIKEY_RAW.role,
    datasourcetype_guid: APIKEY_CONNECTOR,
  };
}

/** PATCH the workspace onto an existing automation, creating it if absent. */
async function pushWorkspace(cfg, key, opts) {
  const options = opts || {};
  const spec = WORKSPACES[key];
  if (!spec) return { key, success: false, error: 'Unknown workspace "' + key + '"' };

  // Some workspaces need tenant lookups (app ids, etc.) before they can be
  // authored. Those declare an async prepare(); the rest are pure.
  let ctx = {};
  if (typeof spec.prepare === 'function') {
    try { ctx = await spec.prepare(cfg); }
    catch (e) { return { key, success: false, error: 'prepare failed: ' + e.message }; }
  }

  const built = spec.build(cfg, ctx);
  if (built.error) return { key, success: false, error: built.error };

  if (options.dryRun) {
    return { key, success: true, dryRun: true, name: spec.automationName,
             blocks: built.workspace.blocks.length, workspace: built.workspace };
  }

  const existing = (await listAutomations(cfg)).find((a) => a.name === spec.automationName);
  const base = tenantBase(cfg);
  const spaceId = options.spaceId || '';

  const body = {
    name: spec.automationName,
    description: options.description || spec.automationName,
    workspace: built.workspace,
    connectorIds: built.connectorIds,
    endpointIds: built.endpointIds,
  };
  if (spaceId) body.spaceId = spaceId;

  let res;
  if (existing) {
    // The route accepts GET, HEAD, PUT, DELETE — PATCH returns 405.
    res = await fetch(base + '/api/v1/automations/' + existing.id, {
      method: 'PUT', headers: authHeaders(cfg), body: JSON.stringify(body),
    });
  } else {
    res = await fetch(base + '/api/v1/automations', {
      method: 'POST', headers: authHeaders(cfg),
      body: JSON.stringify(Object.assign({ state: 'available' }, body)),
    });
  }

  const text = await res.text();
  if (!res.ok) {
    return { key, success: false, status: res.status,
             error: (existing ? 'PATCH' : 'POST') + ' failed (' + res.status + '): ' + text.slice(0, 300) };
  }
  let parsed = {};
  try { parsed = JSON.parse(text); } catch (_) {}
  return {
    key, success: true, name: spec.automationName,
    id: (existing && existing.id) || parsed.id || '',
    action: existing ? 'updated' : 'created',
    blocks: built.workspace.blocks.length,
  };
}

module.exports = {
  QCS_CONNECTOR, EP_RAW_API, WORKSPACES,
  APIKEY_CONNECTOR, EP_APIKEY_RAW, APIKEY_CONNECTION_NAME, MANUAL_CONNECTION_STEPS,
  listConnections, ensureApiKeyConnection, fillConnectionParams, deleteConnection,
  blockId, startBlock, rawApiBlock, apiKeyBlock, ifElseBlock, updateJobBlock,
  addressCorrectionWorkspace, sprintSummaryWorkspace, dailyAppReloadWorkspace,
  coldChainAlertWorkspace, pipelineHealthWorkspace, teamsConnection, TEAMS_CONNECTOR, EP_TEAMS_SEND,
  listAutomations, pushWorkspace,
};

// ---------------------------------------------------------------------------
//  CLI
// ---------------------------------------------------------------------------

if (require.main === module) {
  const finish = async (code) => {
    process.exitCode = code;
    const d = globalThis[Symbol.for('undici.globalDispatcher.1')];
    if (d && typeof d.close === 'function') { try { await d.close(); } catch (_) {} }
  };

  (async () => {
    const argv = process.argv.slice(2);
    const has = (f) => argv.includes(f);
    const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };

    const cfg = loadConfig();
    if (!cfg) { console.error('No deploy/config.json.'); return finish(1); }

    if (has('--list')) {
      const items = await listAutomations(cfg);
      for (const a of items) {
        const managed = Object.values(WORKSPACES).some((w) => w.automationName === a.name);
        console.log((managed ? '* ' : '  ') + a.id + '  ' + a.name);
      }
      console.log('\n* = has an authored workspace in this module');
      return finish(0);
    }

    const conn = await ensureApiKeyConnection(cfg, { dryRun: has('--dry-run'), recreate: has('--recreate') });
    if (!conn.success) { console.error('Connection: ' + conn.error); return finish(1); }
    if (conn.dryRun) {
      console.log('[dry-run] connection ' + APIKEY_CONNECTION_NAME + ':');
      console.log(JSON.stringify(conn.body, null, 2));
    }
    else {
      console.log('connection  ' + conn.action.padEnd(8) + APIKEY_CONNECTION_NAME + '  (' + conn.id + ', connected=' + conn.connected + ')');
      if (!conn.connected) console.log('\n' + MANUAL_CONNECTION_STEPS + '\n');
    }

    const only = val('--only');
    const keys = only ? [only] : Object.keys(WORKSPACES);
    const dryRun = has('--dry-run');
    let failed = 0;

    for (const key of keys) {
      const r = await pushWorkspace(cfg, key, { dryRun, spaceId: (cfg.spaces && cfg.spaces.sharedId) || '' });
      if (!r.success) { console.error('FAIL ' + key + ': ' + r.error); failed++; continue; }
      if (r.dryRun) {
        console.log('[dry-run] ' + r.name + ' — ' + r.blocks + ' blocks');
        console.log(JSON.stringify(r.workspace, null, 2));
      } else {
        console.log(r.action.toUpperCase().padEnd(8) + r.name + '  (' + r.blocks + ' blocks, ' + r.id + ')');
      }
    }
    return finish(failed ? 1 : 0);
  })().catch(async (e) => {
    console.error(e.stack || e.message);
    await finish(1);
  });
}
