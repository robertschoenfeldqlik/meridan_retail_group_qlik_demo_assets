#!/usr/bin/env node
/**
 * Upload the generated lakehouse CSVs into a Qlik Cloud space's DataFiles connection.
 *
 *   QLIK_API_KEY=... node deploy/mockdata/upload-lakehouse-csv.js [--space <name>] [--dry-run]
 *
 * Pairs with gen-lakehouse-csv.js: that writes the stand-in gold/silver/bronze tables,
 * this puts them where the app load scripts can read them via lib://DataFiles.
 *
 * Re-running replaces files in place (the Data Files API 409s on a duplicate name, so an
 * existing file is deleted first) — safe to run after every regeneration.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const KEY = process.env.QLIK_API_KEY || CFG.auth.apiKey;
const BASE = `https://${CFG.tenant.hostname}.${CFG.tenant.region}`;
const OUT_DIR = path.join(__dirname, 'out');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const spaceArg = args.indexOf('--space');
const SPACE_NAME = spaceArg > -1 ? args[spaceArg + 1] : CFG.spaces.shared;

const auth = (extra = {}) => ({ Authorization: `Bearer ${KEY}`, ...extra });

async function json(url, opts = {}) {
  const r = await fetch(BASE + url, { ...opts, headers: auth(opts.headers) });
  const t = await r.text();
  let body = null;
  try { body = t ? JSON.parse(t) : null; } catch { body = t; }
  return { status: r.status, ok: r.ok, body };
}

async function findSpaceId(name) {
  const r = await json(`/api/v1/spaces?limit=100`);
  const s = (r.body.data || []).find((x) => x.name === name);
  if (!s) throw new Error(`Space "${name}" not found`);
  return s.id;
}

async function dataFilesConnectionId(spaceId) {
  const r = await json(`/api/v1/data-files/connections?spaceId=${spaceId}`);
  const list = r.body.data || r.body || [];
  const c = list.find((x) => x.name === 'DataFiles') || list[0];
  if (!c) throw new Error('No DataFiles connection on that space');
  return c.id;
}

async function existingFiles(connectionId) {
  const r = await json(`/api/v1/data-files?connectionId=${connectionId}&limit=1000`);
  const map = new Map();
  for (const f of (r.body.data || [])) map.set(f.name, f.id);
  return map;
}

async function uploadOne(connectionId, filePath, existing) {
  const name = path.basename(filePath);
  const sizeMb = (fs.statSync(filePath).size / 1048576).toFixed(2);

  if (DRY) {
    console.log(`  DRY  ${name.padEnd(42)} ${sizeMb} MB`);
    return true;
  }

  // The API rejects a duplicate name rather than overwriting, so clear it first.
  if (existing.has(name)) {
    const del = await fetch(`${BASE}/api/v1/data-files/${existing.get(name)}`, {
      method: 'DELETE', headers: auth(),
    });
    if (!del.ok && del.status !== 404) {
      console.log(`  FAIL ${name.padEnd(42)} could not replace (${del.status})`);
      return false;
    }
  }

  const form = new FormData();
  form.append('Json', JSON.stringify({ name, connectionId }));
  form.append('File', new Blob([fs.readFileSync(filePath)]), name);

  const r = await fetch(`${BASE}/api/v1/data-files`, { method: 'POST', headers: auth(), body: form });
  if (!r.ok) {
    console.log(`  FAIL ${name.padEnd(42)} ${r.status} ${(await r.text()).slice(0, 160)}`);
    return false;
  }
  console.log(`  OK   ${name.padEnd(42)} ${sizeMb} MB`);
  return true;
}

(async () => {
  if (!KEY) throw new Error('No API key — set QLIK_API_KEY or auth.apiKey in config.json');
  const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.csv')).sort();
  if (!files.length) throw new Error(`No CSVs in ${OUT_DIR} — run gen-lakehouse-csv.js first`);

  const spaceId = await findSpaceId(SPACE_NAME);
  const connectionId = await dataFilesConnectionId(spaceId);
  const existing = await existingFiles(connectionId);

  console.log(`Uploading ${files.length} file(s) to "${SPACE_NAME}" (${spaceId})`);
  console.log(`DataFiles connection: ${connectionId}${DRY ? '   [DRY RUN]' : ''}\n`);

  let ok = 0;
  for (const f of files) {
    if (await uploadOne(connectionId, path.join(OUT_DIR, f), existing)) ok++;
  }
  console.log(`\n${ok}/${files.length} uploaded.`);
  process.exit(ok === files.length ? 0 : 1);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
