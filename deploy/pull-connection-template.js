#!/usr/bin/env node
// =============================================================================
// Pull a data connection from Qlik Cloud and save it as a PARAMETERIZED TEMPLATE
// that deploy-to-qlik.js (buildPostgresGatewaySource) uses to recreate it exactly.
//
// The connect string created by the Qlik Data Integration UI is the source of
// truth — this captures it and replaces only the environment-specific values
// (agentId, server, port, username, database, sslMode) with {{placeholders}}.
//
// Usage:
//   node deploy/pull-connection-template.js                 # "MCG WMS Database"
//   node deploy/pull-connection-template.js "Other Name"    # a different connection
// =============================================================================
const fs = require('fs');
const path = require('path');
const https = require('https');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const base = `https://${cfg.tenant.hostname}.${cfg.tenant.region}`;
const token = cfg.auth.apiKey;
const CONN_NAME = process.argv[2] || 'MCG WMS Database';
// Only these vary per environment — everything else in the connect string is fixed.
const DYNAMIC = ['agentId', 'server', 'port', 'username', 'database', 'sslMode'];

function api(apiPath) {
  return new Promise((resolve, reject) => {
    https.get(new URL(base + apiPath), { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }, (r) => {
      let b = '';
      r.on('data', (d) => (b += d));
      r.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

(async () => {
  const list = await api('/api/v1/data-connections?limit=100');
  const data = list.data || [];
  // Prefer an exact (trimmed) name match that is a postgres replication source.
  const x = data.find((o) => (o.qName || '').trim() === CONN_NAME && /repsrc_postgres/i.test(o.datasourceID || ''))
         || data.find((o) => (o.qName || '').trim() === CONN_NAME);
  if (!x) {
    console.error(`Connection "${CONN_NAME}" not found. Available: ${data.map((o) => (o.qName || '').trim()).join(', ')}`);
    process.exit(1);
  }

  const m = /CUSTOM CONNECT TO "([\s\S]*)"/.exec(x.qConnectStatement || '');
  const inner = m ? m[1] : (x.qConnectStatement || '');
  const dyn = new Set(DYNAMIC);
  const tpl = inner.split(';').filter(Boolean).map((p) => {
    const i = p.indexOf('=');
    const k = p.slice(0, i);
    return dyn.has(k) ? `${k}={{${k}}}` : `${k}=${p.slice(i + 1)}`;
  }).join(';');

  const out = {
    _comment: `Pulled from Qlik Cloud data connection "${CONN_NAME}" (${x.datasourceID}) and parameterized. ` +
      `buildPostgresGatewaySource() in deploy-to-qlik.js fills the {{placeholders}} from deploy config ` +
      `(dataGateway.id, dataConnections.postgresql.{host,port,username,database,sslMode}). ` +
      `Refresh after changing the connection in Qlik: node deploy/pull-connection-template.js`,
    datasourceID: x.datasourceID,
    qType: x.qType,
    placeholders: DYNAMIC,
    connectStringTemplate: tpl,
  };

  const dir = path.join(__dirname, 'templates');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'postgres-source.connection.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
  console.log('Wrote', file);
  console.log('datasourceID:', x.datasourceID);
  console.log('template    :', tpl);
})();
