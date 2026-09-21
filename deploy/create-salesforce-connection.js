#!/usr/bin/env node
'use strict';
// ---------------------------------------------------------------------------
//  create-salesforce-connection.js
//  Creates the "MCG Salesforce CRM" data connection in the Qlik tenant.
//
//  Why this exists as a script rather than a deploy step: the Salesforce
//  connection carries live Salesforce credentials, so it is kept as an explicit,
//  reviewable, operator-run action instead of running inside `npm run deploy`.
//
//  Auth mechanism: the connector's `authenticator` property accepts either
//  "oauth" (External Client App + an interactive auth-code paste) or
//  "salesforce" (username + password + security token). This uses the latter,
//  which needs no External Client App and no browser round-trip — the same
//  credentials the simulator already authenticates with.
//
//  Reads:
//    deploy/config.json      — tenant hostname/region + Qlik API key
//    infrastructure/.env     — SF_USERNAME / SF_PASSWORD / SF_SECURITY_TOKEN
//
//  Idempotent: exits without changes if a connection of the same name exists.
//
//  Usage:
//    node deploy/create-salesforce-connection.js
//    node deploy/create-salesforce-connection.js --dry-run
// ---------------------------------------------------------------------------

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const SCRIPT_DIR  = __dirname;
const PROJECT_DIR = path.resolve(SCRIPT_DIR, '..');
const DRY_RUN     = process.argv.includes('--dry-run');

// The DI space the pipeline binds against. bindings.json resolves the
// connection by space + name — change either and the CRM landing task stops
// binding — so both are asserted here rather than left to the caller.
const SPACE_NAME      = 'MCG Demo - DI';
const CONNECTION_NAME = 'MCG Salesforce CRM';

function loadEnv(file) {
  const vars = {};
  if (!fs.existsSync(file)) return vars;
  for (const line of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    vars[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return vars;
}

const cfg = JSON.parse(fs.readFileSync(path.join(SCRIPT_DIR, 'config.json'), 'utf-8'));
const env = loadEnv(path.join(PROJECT_DIR, 'infrastructure', '.env'));

const HOST   = `${cfg.tenant.hostname}.${cfg.tenant.region}`;
const APIKEY = cfg.auth.apiKey;
const sfCfg  = (cfg.dataConnections && cfg.dataConnections.salesforce) || {};

function req(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { Authorization: 'Bearer ' + APIKEY, 'Content-Type': 'application/json' };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    const r = https.request({ host: HOST, path: pathname, method, headers }, (res) => {
      let s = '';
      res.on('data', (d) => { s += d; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(s); } catch (_) { parsed = s; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function fail(msg) { console.error('ERROR: ' + msg); process.exit(1); }

(async () => {
  if (!cfg.tenant.hostname) fail('tenant.hostname is empty in deploy/config.json.');
  if (!APIKEY)              fail('auth.apiKey is empty in deploy/config.json.');
  for (const k of ['SF_USERNAME', 'SF_PASSWORD', 'SF_SECURITY_TOKEN']) {
    if (!env[k]) fail(`${k} is not set in infrastructure/.env.`);
  }

  console.log(`Tenant     : https://${HOST}`);
  console.log(`Connection : "${CONNECTION_NAME}"`);
  console.log(`Space      : ${SPACE_NAME}`);
  console.log(`Auth       : salesforce (username/password/token — no External Client App needed)`);
  console.log();

  // Resolve the DI space by name.
  const spaces = await req('GET', `/api/v1/spaces?filter=${encodeURIComponent(`name eq "${SPACE_NAME}"`)}&limit=10`);
  if (spaces.status !== 200) fail(`space lookup failed (${spaces.status}): ${JSON.stringify(spaces.body).slice(0, 200)}`);
  const space = ((spaces.body && spaces.body.data) || []).find((s) => s.name === SPACE_NAME);
  if (!space) fail(`space "${SPACE_NAME}" not found — run the deployer's space step first.`);
  console.log(`Resolved space: ${space.id}`);

  // Idempotency: never create a second connection of the same name, since the
  // pipeline binds by name and duplicates make the binding ambiguous.
  const existing = await req('GET', '/api/v1/data-connections?limit=100');
  const dupe = ((existing.body && existing.body.data) || [])
    .find((c) => (c.qName || c.name) === CONNECTION_NAME);
  if (dupe) {
    console.log(`\nConnection "${CONNECTION_NAME}" already exists (${dupe.id}) — nothing to do.`);
    return;
  }

  const payload = {
    datasourceID: 'sfdc',
    type: 'sfdc',
    qType: 'QvSalesforceConnector.exe',
    qName: CONNECTION_NAME,
    space: space.id,
    qConnectStatement: '',
    connectionProperties: {
      authenticator: 'salesforce',
      // A Developer Edition org authenticates against login.salesforce.com, so it
      // is "production" here even though the username reads sandbox-ish.
      sfEnvironment: sfCfg.environment === 'sandbox' ? 'sandbox' : 'production',
      apiVersion: env.SF_API_VERSION || '61.0',
      mode: (sfCfg.apiType || 'BULK').toUpperCase() === 'SOAP' ? 'SOAP' : 'BULK',
      username: env.SF_USERNAME,
      password: env.SF_PASSWORD,
      sftoken: env.SF_SECURITY_TOKEN,
      credentialsName: `${CONNECTION_NAME} credentials`,
    },
  };

  if (DRY_RUN) {
    const redacted = JSON.parse(JSON.stringify(payload));
    redacted.connectionProperties.password = '<REDACTED>';
    redacted.connectionProperties.sftoken  = '<REDACTED>';
    console.log('\nDRY RUN — would POST /api/v1/data-connections:');
    console.log(JSON.stringify(redacted, null, 2));
    return;
  }

  const res = await req('POST', '/api/v1/data-connections', payload);
  if (res.status === 200 || res.status === 201) {
    const id = (res.body && (res.body.id || res.body.qID)) || '(id not returned)';
    console.log(`\nCreated "${CONNECTION_NAME}" (${id}) in ${SPACE_NAME}.`);
    console.log('\nNext: confirm the CRM landing task binds, then run the pipeline.');
  } else {
    fail(`create failed (${res.status}): ${JSON.stringify(res.body).slice(0, 500)}`);
  }
})().catch((e) => fail(e.message));
