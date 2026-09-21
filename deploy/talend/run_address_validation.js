#!/usr/bin/env node
/**
 * run_address_validation.js - validate MCG addresses against a FREE validation service.
 *
 *   node deploy/talend/run_address_validation.js --limit 40
 *   node deploy/talend/run_address_validation.js --limit 200 --out validated.csv
 *
 * This is the runnable twin of the Talend job documented in BUILD_BULK_ADDRESS_JOB.md.
 * The job's tMap uses routines/AddressFormatValidator.java for the format pass and a
 * tRestClient for the service call; this script performs the same two steps so the
 * logic can be exercised, and the dataset scored, without Talend Studio installed.
 *
 * Services, both free and neither requiring an API key:
 *
 *   US  -> US Census Bureau Geocoder (geocoding.geo.census.gov). Free, no key, and it
 *          supports a 10,000-row batch endpoint. US addresses ONLY - it will not
 *          resolve anything outside the United States.
 *   EU  -> Nominatim / OpenStreetMap. Free, no key, worldwide. Rate limited to ONE
 *          request per second and requires a real User-Agent; both are honoured below.
 *          Exceeding the limit gets the caller blocked, so this is not parallelised.
 *
 * The MCG dataset is entirely EU (NL/DE/ES/IT/FR/PL), so a US-only run would reject
 * every row. Country routing is automatic: US rows go to Census, everything else to
 * Nominatim.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ADDRESSES = path.join(__dirname, '..', 'mockdata', 'out', 'silver_addresses_standardized.csv');
const UA = 'MCG-Demo-AddressValidation/1.0 (Qlik demo dataset; contact: demo@meridiancommerce.example)';

const argv = process.argv.slice(2);
const argVal = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const LIMIT = parseInt(argVal('--limit', '40'), 10);
const OUT = argVal('--out', path.join(__dirname, 'address_validation_results.csv'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- the format pass: a direct port of AddressFormatValidator.java ---------------
const POSTAL_PATTERNS = {
  US: /^\d{5}(-\d{4})?$/, NL: /^\d{4} ?[A-Z]{2}$/, DE: /^\d{5}$/, FR: /^\d{5}$/,
  ES: /^\d{5}$/, IT: /^\d{5}$/, PL: /^\d{2}-\d{3}$/, GB: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/,
  BE: /^\d{4}$/, AT: /^\d{4}$/, PT: /^\d{4}-\d{3}$/,
};
const US_STATES = new Set(('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS ' +
  'MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC PR VI GU AS MP').split(' '));

const up = (s) => (s || '').trim().toUpperCase();

function isValidPostalCode(pc, cc) {
  const p = up(pc); if (!p) return false;
  const re = POSTAL_PATTERNS[up(cc)];
  return re ? re.test(p) : true;           // no rule for a country is not a fault
}
function isValidState(st, cc) {
  return up(cc) !== 'US' ? true : US_STATES.has(up(st));
}
function formatScore(r) {
  let s = 0;
  if (r.city && r.city.trim().length >= 2) s += 0.40;
  if (isValidPostalCode(r.postal_code, r.country_iso)) s += 0.40;
  else if ((r.postal_code || '').trim()) s += 0.10;
  if (isValidState(r.state_region, r.country_iso)) s += 0.20;
  return Math.round(s * 100) / 100;
}
function explain(r) {
  const f = [];
  if (!r.city || r.city.trim().length < 2) f.push('city missing');
  if (!(r.postal_code || '').trim()) f.push('postal code missing');
  else if (!isValidPostalCode(r.postal_code, r.country_iso))
    f.push(`postal code does not match ${up(r.country_iso)} format`);
  if (!isValidState(r.state_region, r.country_iso)) f.push(`state '${r.state_region}' is not a US state code`);
  return f.join('; ');
}

// --- the service pass -------------------------------------------------------------
async function verifyNominatim(r) {
  const qs = new URLSearchParams({
    format: 'jsonv2', limit: '1', addressdetails: '1',
    city: r.city || '', postalcode: r.postal_code || '', country: r.country_iso || '',
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`,
    { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
  if (!res.ok) return { status: `HTTP_${res.status}`, lat: '', lon: '', matched: '' };
  const j = await res.json();
  if (!j.length) return { status: 'UNRESOLVED', lat: '', lon: '', matched: '' };
  return { status: 'RESOLVED', lat: j[0].lat, lon: j[0].lon, matched: j[0].display_name };
}

async function verifyCensus(r) {
  const qs = new URLSearchParams({
    street: r.street || r.city || '', city: r.city || '', state: r.state_region || '',
    zip: r.postal_code || '', benchmark: 'Public_AR_Current', format: 'json',
  });
  const res = await fetch(`https://geocoding.geo.census.gov/geocoder/locations/address?${qs}`,
    { headers: { 'User-Agent': UA } });
  if (!res.ok) return { status: `HTTP_${res.status}`, lat: '', lon: '', matched: '' };
  const j = await res.json();
  const m = j.result && j.result.addressMatches && j.result.addressMatches[0];
  if (!m) return { status: 'UNRESOLVED', lat: '', lon: '', matched: '' };
  return { status: 'RESOLVED', lat: m.coordinates.y, lon: m.coordinates.x, matched: m.matchedAddress };
}

// --- csv ---------------------------------------------------------------------------
function readCsv(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  const head = lines[0].replace(/^﻿/, '').split(',');
  return lines.slice(1).map((l) => {
    const c = l.split(',');
    return head.reduce((o, h, i) => (o[h] = c[i], o), {});
  });
}
const esc = (v) => /[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? '');

(async () => {
  if (!fs.existsSync(ADDRESSES)) {
    console.error(`No address extract at ${ADDRESSES}\nRun: node deploy/mockdata/gen-lakehouse-csv.js`);
    process.exit(1);
  }
  const all = readCsv(ADDRESSES);
  // Sample with a stride rather than taking the head. The unresolved/malformed rows are
  // written first by the generator, so slice(0, N) returns nothing but broken addresses
  // and reports a 0% format pass that says nothing about the dataset.
  const stride = Math.max(1, Math.floor(all.length / LIMIT));
  const rows = [];
  for (let i = 0; i < all.length && rows.length < LIMIT; i += stride) rows.push(all[i]);
  const byCountry = all.reduce((m, r) => (m[r.country_iso] = (m[r.country_iso] || 0) + 1, m), {});
  console.log(`Dataset: ${all.length} addresses  ${JSON.stringify(byCountry)}`);
  console.log(`Validating ${rows.length} (format pass, then a free service call each)\n`);

  const out = [];
  let resolved = 0, unresolved = 0, badFormat = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const score = formatScore(r);
    const why = explain(r);
    if (why) badFormat++;

    const isUS = up(r.country_iso) === 'US';
    let v;
    try {
      v = isUS ? await verifyCensus(r) : await verifyNominatim(r);
    } catch (e) {
      v = { status: 'ERROR', lat: '', lon: '', matched: String(e.message).slice(0, 80) };
    }
    if (v.status === 'RESOLVED') resolved++; else unresolved++;

    out.push({
      contact_id: r.contact_id, city: r.city, postal_code: r.postal_code,
      country_iso: r.country_iso, format_score: score, format_faults: why,
      service: isUS ? 'US_CENSUS' : 'NOMINATIM',
      validation_status: v.status, latitude: v.lat, longitude: v.lon, matched_address: v.matched,
    });

    process.stdout.write(`\r  ${i + 1}/${rows.length}  resolved ${resolved}  unresolved ${unresolved}`);
    // Nominatim's published limit is 1 req/sec. Going faster gets the caller blocked.
    if (!isUS && i < rows.length - 1) await sleep(1100);
  }

  const head = Object.keys(out[0]);
  fs.writeFileSync(OUT, [head.join(','), ...out.map((o) => head.map((h) => esc(o[h])).join(','))].join('\n'), 'utf8');

  console.log(`\n\nFormat pass : ${rows.length - badFormat}/${rows.length} structurally valid`);
  console.log(`Service pass: ${resolved} resolved, ${unresolved} unresolved`);
  console.log(`-> ${OUT}`);
})();
