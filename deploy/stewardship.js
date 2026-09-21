#!/usr/bin/env node
// ---------------------------------------------------------------------------
//  stewardship.js
//  Qlik Cloud Data Stewardship — sprint creation and record loading.
//
//  One implementation, three callers:
//    - deploy-ui.js       (the /api/stewardship/* routes)
//    - deploy-to-qlik.js  (the deploy step)
//    - this file as a CLI (node deploy/stewardship.js --dry-run)
//
//  ⚠ This drives the product's INTERNAL API (/api/data-governance/*), recovered
//    from the tenant's own micro-frontend bundles. It is undocumented and
//    unsupported, and can change without notice. Fine for a demo; do not build
//    a customer deliverable on it without confirming with Qlik. Full evidence
//    trail: deploy/talend/STEWARDSHIP_API_FINDINGS.md
//
//  Note the routes carry NO /v1/ segment, and there is deliberately no
//  `GET /sprints` collection route — probing the bare path always 404s.
//
//  Usage:
//    node deploy/stewardship.js --list
//    node deploy/stewardship.js --dry-run
//    node deploy/stewardship.js
//    node deploy/stewardship.js --space shared     # override the config space
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const API_BASE = '/api/data-governance';

// ---------------------------------------------------------------------------
//  Default sprint definition
// ---------------------------------------------------------------------------

// The 12 columns the Talend job's UNRESOLVED branch emits. `*_raw` stay visible
// but locked so the steward can see what arrived; the repaired fields are the
// ones they can actually change. `reason` explains why the job gave up.
const DEFAULT_RECORD_SCHEMA = [
  { name: 'contact_id',   description: 'Salesforce Contact Id',      isVisible: true, isEditable: false },
  { name: 'street_raw',   description: 'Street as received',          isVisible: true, isEditable: false },
  { name: 'city_raw',     description: 'City as received',            isVisible: true, isEditable: false },
  { name: 'postal_raw',   description: 'Postal code as received',     isVisible: true, isEditable: false },
  { name: 'country_raw',  description: 'Country as received',         isVisible: true, isEditable: false },
  { name: 'reason',       description: 'Why automated repair failed', isVisible: true, isEditable: false },
  { name: 'street_clean', description: 'Corrected street',            isVisible: true, isEditable: true },
  { name: 'house_number', description: 'Corrected house number',      isVisible: true, isEditable: true },
  { name: 'city_clean',   description: 'Corrected city',              isVisible: true, isEditable: true },
  { name: 'postal_clean', description: 'Corrected postal code',       isVisible: true, isEditable: true },
  { name: 'country_iso',  description: 'ISO 3166-1 alpha-2 country',  isVisible: true, isEditable: true },
  { name: 'state_clean',  description: 'Corrected state / region',    isVisible: true, isEditable: true },
];

const DEFAULT_STEWARDSHIP = {
  name: 'Address Cleanup',
  description: 'Salesforce contact addresses the bulk validation job could not resolve to GPS. '
    + 'Fed by the UNRESOLVED branch of mcg_sf_address_validate_bulk.',
  // Sprints are expected to live in a DATA space. The create call returns
  // 403 NOT_ALLOWED_TO_CREATE_SPRINT against a shared space — the leading
  // hypothesis for that failure is exactly this. See STEWARDSHIP_API_FINDINGS.md.
  space: 'data',
  storageConnectionType: 'QLIK_CLOUD_STORAGE', // or SNOWFLAKE
  workflowType: 'ONE_STEP_VALIDATION',         // or TWO_STEPS_VALIDATION
  assignationStrategy: 'AUTO',                 // or MANUAL
  aiAssistance: false,
  recordDataSchema: DEFAULT_RECORD_SCHEMA,
  sprintId: '',                                // filled in on a successful create
};

// ---------------------------------------------------------------------------
//  Config
// ---------------------------------------------------------------------------

function configPath() {
  return path.join(SCRIPT_DIR, 'config.json');
}

function loadConfig() {
  const p = configPath();
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function stewardshipConfig(cfg) {
  return Object.assign({}, DEFAULT_STEWARDSHIP, (cfg && cfg.stewardship) || {});
}

// Persist the sprint id so automation #5 and later deploy steps can read it
// instead of polling an endpoint that does not exist.
function saveSprintId(sprintId) {
  const cfg = loadConfig();
  if (!cfg) return false;
  cfg.stewardship = Object.assign({}, DEFAULT_STEWARDSHIP, cfg.stewardship || {}, { sprintId });
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
  return true;
}

// ---------------------------------------------------------------------------
//  Auth
// ---------------------------------------------------------------------------

/**
 * Resolve { baseUrl, headers } from the STORED config only.
 *
 * Credentials are never accepted from a request body. deploy-ui.js's
 * /api/test-connection has to juggle masked secrets because it tests a tenant
 * the user is still typing in; by the time a sprint is created the tenant is
 * settled, so reading only from disk removes the "real key + attacker-supplied
 * host" pairing hazard that route has to defend against by hand.
 */
async function resolveAuth(cfg) {
  const tenant = (cfg && cfg.tenant) || {};
  const auth = (cfg && cfg.auth) || {};
  if (!tenant.hostname || !tenant.region) {
    return { error: 'Tenant hostname/region missing from config.json — complete Step 1 (Connection & Auth) first.' };
  }
  const baseUrl = 'https://' + tenant.hostname + '.' + tenant.region;

  if (auth.method === 'oauth') {
    const oauth = auth.oauth || {};
    if (!oauth.clientId || !oauth.clientSecret) {
      return { error: 'OAuth selected but clientId/clientSecret are missing from config.json.' };
    }
    const tokenUrl = oauth.tokenUrl || (baseUrl + '/oauth/token');
    let tokenRes;
    try {
      tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: oauth.clientId,
          client_secret: oauth.clientSecret,
          grant_type: 'client_credentials',
        }),
      });
    } catch (e) {
      return { error: 'OAuth token request failed: ' + e.message };
    }
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      return { error: 'OAuth token request failed (' + tokenRes.status + '): ' + t.slice(0, 200) };
    }
    const tok = await tokenRes.json();
    return { baseUrl, headers: { Authorization: 'Bearer ' + tok.access_token } };
  }

  if (!auth.apiKey) {
    return { error: 'API key missing from config.json — complete Step 1 (Connection & Auth) first.' };
  }
  return { baseUrl, headers: { Authorization: 'Bearer ' + auth.apiKey } };
}

// ---------------------------------------------------------------------------
//  Space resolution
// ---------------------------------------------------------------------------

/**
 * Turn a space alias ('data' | 'shared' | 'managed') or a literal space name
 * into a space id, by looking it up on the tenant.
 */
async function resolveSpaceId(baseUrl, headers, cfg, alias) {
  const spaces = (cfg && cfg.spaces) || {};
  const wanted = spaces[alias] || alias;
  if (!wanted) return { error: 'No space configured for "' + alias + '".' };

  let res;
  try {
    res = await fetch(baseUrl + '/api/v1/spaces?limit=100', { headers });
  } catch (e) {
    return { error: 'Space lookup failed: ' + e.message };
  }
  if (!res.ok) {
    const t = await res.text();
    return { error: 'Space lookup failed (' + res.status + '): ' + t.slice(0, 200) };
  }
  const body = await res.json();
  const match = (body.data || []).find((s) => s.name === wanted);
  if (!match) {
    return { error: 'Space "' + wanted + '" not found on the tenant.' };
  }
  return { spaceId: match.id, spaceName: match.name, spaceType: match.type };
}

// ---------------------------------------------------------------------------
//  Payload
// ---------------------------------------------------------------------------

/**
 * Build the createExternalSprint body. Shape recovered from the Stewardship UI
 * bundle (stewardship-ui 0.29.0) and confirmed to pass server-side validation —
 * an invalid body returns INVALID_INPUTS, and this one gets past that.
 */
function buildSprintPayload(st, spaceId, ownerId) {
  const owners = ownerId ? [ownerId] : [];
  return {
    name: st.name,
    spaceId,
    description: st.description,
    storageSettings: { connectionType: st.storageConnectionType },
    sprintOwnerIds: owners,
    stewardIds: owners,
    workflowType: st.workflowType,
    assignationStrategy: st.assignationStrategy,
    aiAssistance: { isEnabled: !!st.aiAssistance },
    rulesMappings: [],
    recordDataSchema: {
      items: (st.recordDataSchema || []).map((c) => ({
        name: c.name,
        description: c.description || '',
        isVisible: c.isVisible !== false,
        isEditable: !!c.isEditable,
        standardType: { name: c.type || 'STRING' },
      })),
    },
  };
}

// ---------------------------------------------------------------------------
//  Operations
// ---------------------------------------------------------------------------

async function currentUserId(baseUrl, headers) {
  try {
    const res = await fetch(baseUrl + '/api/v1/users/me', { headers });
    if (!res.ok) return '';
    const me = await res.json();
    return me.id || me.subject || '';
  } catch (_) {
    return '';
  }
}

/** List sprints already registered for external integration. */
async function listSprints(cfg) {
  const auth = await resolveAuth(cfg);
  if (auth.error) return { success: false, error: auth.error };

  let res;
  try {
    res = await fetch(auth.baseUrl + API_BASE + '/sprints/external-integrations/actions/list-sprints',
      { headers: auth.headers });
  } catch (e) {
    return { success: false, error: 'List sprints failed: ' + e.message };
  }
  const text = await res.text();
  if (!res.ok) {
    return { success: false, status: res.status, error: 'List sprints failed (' + res.status + '): ' + text.slice(0, 300) };
  }
  let body = {};
  try { body = JSON.parse(text); } catch (_) {}
  return { success: true, sprints: body.sprints || [] };
}

/**
 * Create the external sprint.
 *
 * A 403 NOT_ALLOWED_TO_CREATE_SPRINT here is the known open question, not a bug
 * in this code: the same payload passes validation, and the calling user holds
 * TenantAdmin + Steward + DataAdmin with every stewardship feature flag on. The
 * leading hypothesis is that sprints must live in a DATA space (the failing
 * call used a shared one). The result carries `hint` so the caller can say so.
 */
async function createSprint(cfg, opts) {
  const options = opts || {};
  const st = stewardshipConfig(cfg);
  const spaceAlias = options.space || st.space;

  const auth = await resolveAuth(cfg);
  if (auth.error) return { success: false, error: auth.error };

  const space = await resolveSpaceId(auth.baseUrl, auth.headers, cfg, spaceAlias);
  if (space.error) return { success: false, error: space.error };

  const ownerId = await currentUserId(auth.baseUrl, auth.headers);
  const payload = buildSprintPayload(st, space.spaceId, ownerId);

  if (options.dryRun) {
    return {
      success: true, dryRun: true,
      space: { alias: spaceAlias, name: space.spaceName, id: space.spaceId, type: space.spaceType },
      payload,
    };
  }

  let res;
  try {
    res = await fetch(auth.baseUrl + API_BASE + '/sprints/actions/create-external-sprint', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, auth.headers),
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return { success: false, error: 'Create sprint failed: ' + e.message };
  }

  const text = await res.text();
  let body = {};
  try { body = JSON.parse(text); } catch (_) {}

  if (!res.ok) {
    const code = body.errors && body.errors[0] && body.errors[0].code;
    const result = {
      success: false,
      status: res.status,
      code: code || '',
      error: 'Create sprint failed (' + res.status + '): ' + text.slice(0, 300),
      space: { alias: spaceAlias, name: space.spaceName, id: space.spaceId, type: space.spaceType },
    };
    if (code === 'NOT_ALLOWED_TO_CREATE_SPRINT') {
      result.hint = space.spaceType === 'data'
        ? 'Tried a data space, so the space-type hypothesis is ruled out. Next suspect is the '
          + 'stewardship EAP needing per-tenant provisioning rather than just the feature flag — '
          + 'that is a question for a Qlik contact.'
        : 'This is a "' + (space.spaceType || 'unknown') + '" space. Sprints are expected to live '
          + 'in a DATA space — retry against "' + ((cfg.spaces || {}).data || 'MCG Demo - DI') + '".';
    }
    return result;
  }

  const sprintId = body.id || body.sprintId || (body.sprint && body.sprint.id) || '';
  if (sprintId && !options.noPersist) saveSprintId(sprintId);

  return {
    success: true,
    sprintId,
    space: { alias: spaceAlias, name: space.spaceName, id: space.spaceId, type: space.spaceType },
    sprint: body,
  };
}

/**
 * Push records into an existing sprint. This is the per-run path that replaces
 * automation #5's call to GET /api/v1/stewardship/tasks, which 404s — that
 * endpoint matches no real API.
 */
async function pushRecords(cfg, records, opts) {
  const options = opts || {};
  const st = stewardshipConfig(cfg);
  const sprintId = options.sprintId || st.sprintId;
  if (!sprintId) return { success: false, error: 'No sprintId — create the sprint first.' };

  const auth = await resolveAuth(cfg);
  if (auth.error) return { success: false, error: auth.error };

  const url = auth.baseUrl + API_BASE + '/sprints/' + encodeURIComponent(sprintId)
    + '/external-integrations/records/actions/create-or-update';

  if (options.dryRun) return { success: true, dryRun: true, sprintId, count: records.length, url };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, auth.headers),
      body: JSON.stringify({ records }),
    });
  } catch (e) {
    return { success: false, error: 'Push records failed: ' + e.message };
  }
  const text = await res.text();
  if (!res.ok) {
    return { success: false, status: res.status, error: 'Push records failed (' + res.status + '): ' + text.slice(0, 300) };
  }
  return { success: true, sprintId, count: records.length };
}

module.exports = {
  API_BASE,
  DEFAULT_STEWARDSHIP,
  DEFAULT_RECORD_SCHEMA,
  stewardshipConfig,
  resolveAuth,
  resolveSpaceId,
  buildSprintPayload,
  listSprints,
  createSprint,
  pushRecords,
  saveSprintId,
};

// ---------------------------------------------------------------------------
//  CLI
// ---------------------------------------------------------------------------

if (require.main === module) {
  // Node 24 on Windows aborts with a libuv assertion (UV_HANDLE_CLOSING) if
  // process.exit() is called while undici still holds keep-alive sockets. Set
  // the exit code, close the dispatcher, and let the loop drain instead.
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
    if (!cfg) {
      console.error('No deploy/config.json — run `npm run ui` and complete Step 1 first.');
      return finish(1);
    }

    if (has('--list')) {
      const r = await listSprints(cfg);
      if (!r.success) { console.error(r.error); return finish(1); }
      if (r.sprints.length === 0) console.log('No sprints registered for external integration.');
      else for (const s of r.sprints) console.log(`${s.id || '(no id)'}  ${s.name || ''}`);
      return finish(0);
    }

    const r = await createSprint(cfg, { dryRun: has('--dry-run'), space: val('--space') });

    if (r.dryRun) {
      console.log('[dry-run] space: ' + r.space.name + ' (' + r.space.type + ', ' + r.space.id + ')');
      console.log('[dry-run] POST ' + API_BASE + '/sprints/actions/create-external-sprint');
      console.log(JSON.stringify(r.payload, null, 2));
      return finish(0);
    }

    if (!r.success) {
      console.error(r.error);
      if (r.hint) console.error('\nHint: ' + r.hint);
      return finish(1);
    }

    console.log('Created sprint "' + (cfg.stewardship || DEFAULT_STEWARDSHIP).name + '"');
    console.log('  sprintId : ' + (r.sprintId || '(not returned)'));
    console.log('  space    : ' + r.space.name + ' (' + r.space.type + ')');
    if (r.sprintId) console.log('  saved to deploy/config.json -> stewardship.sprintId');
    return finish(0);
  })().catch(async (e) => {
    console.error(e.stack || e.message);
    await finish(1);
  });
}
