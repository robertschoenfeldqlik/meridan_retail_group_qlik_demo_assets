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
// Second argument names the template file AND the connector family to prefer,
// e.g. `pull-connection-template.js "MCG CRM Database" mysql-source` writes
// templates/mysql-source.connection.json. Without it this script always wrote
// the postgres template, so pointing it at any other connection silently
// clobbered the PostgreSQL source definition.
const OUT_BASENAME = process.argv[3] || 'postgres-source';
// "mysql-source" -> /repsrc_mysql/i, "postgres-source" -> /repsrc_postgres/i
const TYPE_HINT = new RegExp('repsrc_' + OUT_BASENAME.replace(/-source$/, '').replace(/-/g, '_'), 'i');
// Only these vary per environment — everything else in the connect string is fixed.
const DYNAMIC = ['agentId', 'server', 'port', 'username', 'database', 'sslMode'];

function api(pathOrUrl) {
  const fullUrl = pathOrUrl.startsWith('http') ? pathOrUrl : base + pathOrUrl;
  return new Promise((resolve, reject) => {
    https.get(new URL(fullUrl), { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }, (r) => {
      let b = '';
      r.on('data', (d) => (b += d));
      r.on('end', () => {
        let body;
        try { body = JSON.parse(b || '{}'); } catch (e) { reject(e); return; }
        if (r.statusCode < 200 || r.statusCode >= 300) {
          reject(new Error(`Qlik API request failed (${r.statusCode}) for ${pathOrUrl} — check that the API key in config.json is valid and not expired: ${JSON.stringify(body).slice(0, 300)}`));
          return;
        }
        resolve(body);
      });
    }).on('error', reject);
  });
}

// Paginate via links.next.href — a single capped page could miss the target
// connection on a tenant with >100 connections.
async function fetchAllConnections() {
  const all = [];
  let next = '/api/v1/data-connections?limit=100';
  while (next) {
    const list = await api(next);
    all.push(...(list.data || []));
    next = (list.links && list.links.next && list.links.next.href) || null;
  }
  return all;
}

(async () => {
  const data = await fetchAllConnections();
  // Prefer an exact (trimmed) name match that is a replication source of the
  // expected family, then fall back to any connection with that name.
  const x = data.find((o) => (o.qName || '').trim() === CONN_NAME && TYPE_HINT.test(o.datasourceID || ''))
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
      `The matching buildXGatewaySource() in deploy-to-qlik.js fills the {{placeholders}} from deploy config ` +
      `(dataGateway.id and the dataConnections entry's {host,port,username,database,sslMode}). ` +
      `Refresh after changing the connection in Qlik: ` +
      `node deploy/pull-connection-template.js "${CONN_NAME}" ${OUT_BASENAME}`,
    datasourceID: x.datasourceID,
    qType: x.qType,
    placeholders: DYNAMIC,
    connectStringTemplate: tpl,
  };

  const dir = path.join(__dirname, 'templates');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${OUT_BASENAME}.connection.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
  console.log('Wrote', file);
  console.log('datasourceID:', x.datasourceID);
  console.log('template    :', tpl);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
