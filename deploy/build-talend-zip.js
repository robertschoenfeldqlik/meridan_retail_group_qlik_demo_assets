#!/usr/bin/env node
// ---------------------------------------------------------------------------
//  build-talend-zip.js
//  Packages the Talend address-validation job into ONE importable ZIP:
//    deploy/talend/mcg_crm_address_validate_bulk.zip
//
//  The ZIP carries three layers, in descending order of certainty:
//
//    1. bundle/         — the raw .java routines, the context group, the build
//                         spec and the Iceberg DDL. Always correct; this is the
//                         manual path that works today, just packaged.
//    2. MCG_DEMO/       — a synthesized Talend "Export items" project tree so
//                         Studio can import the four routines in one action.
//                         UNVERIFIED against a live Studio — see IMPORT.md.
//    3. studio-export/  — whatever is in deploy/talend/job/, verbatim. Drop a
//                         real Studio export there and it ships as-is, with no
//                         change to this script.
//
//  Deterministic: same inputs produce a byte-identical ZIP (fixed timestamps
//  in zip-utils, content-derived GUIDs here).
//
//  Usage:
//    node deploy/build-talend-zip.js
//    node deploy/build-talend-zip.js --dry-run
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { zipFromEntries } = require('./zip-utils');

const TALEND_DIR   = path.join(__dirname, 'talend');
const ROUTINES_DIR = path.join(TALEND_DIR, 'routines');
const CONTEXTS_DIR = path.join(TALEND_DIR, 'contexts');
const EXPORT_DIR   = path.join(TALEND_DIR, 'job');
const SPEC_FILE    = path.join(TALEND_DIR, 'BUILD_BULK_ADDRESS_JOB.md');

const PROJECT  = 'MCG_DEMO';
const JOB_NAME = 'mcg_crm_address_validate_bulk';
const VERSION  = '0.1';
const OUT      = path.join(TALEND_DIR, JOB_NAME + '.zip');

const dryRun = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

// Content-derived GUIDs so a rebuild with unchanged inputs is byte-identical.
// Talend only requires these be unique and stable within the archive.
function guid(seed) {
  const h = crypto.createHash('sha1').update(seed).digest('hex');
  return '_' + h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) +
         '-' + h.slice(16, 20) + '-' + h.slice(20, 32);
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function walk(dir, base, into) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    if (item.isDirectory()) walk(full, base, into);
    else into[rel] = fs.readFileSync(full);
  }
}

// ---------------------------------------------------------------------------
//  Inputs
// ---------------------------------------------------------------------------

if (!fs.existsSync(ROUTINES_DIR)) {
  console.error('No routines directory at ' + ROUTINES_DIR);
  process.exit(1);
}

const routines = fs.readdirSync(ROUTINES_DIR)
  .filter((f) => f.endsWith('.java'))
  .sort()
  .map((f) => ({
    name: path.basename(f, '.java'),
    source: fs.readFileSync(path.join(ROUTINES_DIR, f), 'utf-8'),
  }));

if (routines.length === 0) {
  console.error('No .java routines found in ' + ROUTINES_DIR);
  process.exit(1);
}

const entries = {};

// ---------------------------------------------------------------------------
//  Layer 1 — the always-correct bundle
// ---------------------------------------------------------------------------

for (const r of routines) {
  entries['bundle/routines/' + r.name + '.java'] = r.source;
}

if (fs.existsSync(CONTEXTS_DIR)) {
  for (const f of fs.readdirSync(CONTEXTS_DIR).sort()) {
    entries['bundle/contexts/' + f] = fs.readFileSync(path.join(CONTEXTS_DIR, f));
  }
}

if (fs.existsSync(SPEC_FILE)) {
  entries['bundle/BUILD_BULK_ADDRESS_JOB.md'] = fs.readFileSync(SPEC_FILE);
}

// The Iceberg target the S3 branch eventually lands in. Kept with the job so
// the downstream load step (spec section 4) has its DDL in the same artifact.
entries['bundle/sql/create_silver_addresses_geocoded.sql'] = [
  '-- Iceberg target for the GPS-resolved branch of ' + JOB_NAME + '.',
  '-- The job writes timestamped CSV to s3://<s3_bucket>/<s3_prefix>/ and stops;',
  '-- loading those files into this table is the downstream step described in',
  '-- BUILD_BULK_ADDRESS_JOB.md section 4.',
  '',
  'CREATE TABLE IF NOT EXISTS silver.addresses_geocoded (',
  '  contact_id       string,',
  '  street_clean     string,',
  '  house_number     string,',
  '  unit_type        string,',
  '  unit_number      string,',
  '  floor            string,',
  '  city_clean       string,',
  '  state_clean      string,',
  '  postal_clean     string,',
  '  country_iso      string,',
  '  latitude         double,',
  '  longitude        double,',
  '  geo_confidence   double,',
  '  quality_score    double,',
  '  status           string,',
  '  corrections      string,',
  '  validated_at_utc timestamp',
  ')',
  "LOCATION 's3://mcg-open-lakehouse/warehouse/silver/addresses_geocoded/'",
  "TBLPROPERTIES ('table_type'='ICEBERG', 'format'='parquet');",
  '',
].join('\n');

// ---------------------------------------------------------------------------
//  Layer 2 — synthesized Talend project tree (routines + the job)
// ---------------------------------------------------------------------------

const authorId = guid(PROJECT + ':author');

entries[PROJECT + '/talend.project'] = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<xmi:XMI xmi:version="2.0"',
  '    xmlns:xmi="http://www.omg.org/XMI"',
  '    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
  '    xmlns:TalendProperties="http://www.talend.org/properties">',
  '  <TalendProperties:Project xmi:id="' + guid(PROJECT) + '" technicalLabel="' + PROJECT +
    '" label="' + PROJECT + '" language="java" local="true">',
  '    <author href="#' + authorId + '"/>',
  '  </TalendProperties:Project>',
  '  <TalendProperties:User xmi:id="' + authorId + '" login="demo@mcg.example"/>',
  '</xmi:XMI>',
  '',
].join('\n');

for (const r of routines) {
  const propId  = guid(r.name + ':property');
  const itemId  = guid(r.name + ':item');
  const stateId = guid(r.name + ':state');
  const idAttr  = guid(r.name + ':id');
  const stem    = PROJECT + '/code/routines/' + r.name + '_' + VERSION;

  // The .item for a routine is the Java source verbatim.
  entries[stem + '.item'] = r.source;

  entries[stem + '.properties'] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<xmi:XMI xmi:version="2.0"',
    '    xmlns:xmi="http://www.omg.org/XMI"',
    '    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '    xmlns:TalendProperties="http://www.talend.org/properties"',
    '    xmlns:CodeProperties="http://www.talend.org/code">',
    '  <TalendProperties:Property xmi:id="' + propId + '" id="' + idAttr + '"',
    '      label="' + xmlEscape(r.name) + '" displayName="' + xmlEscape(r.name) + '"',
    '      purpose="MCG address validation"',
    '      description="Packaged by deploy/build-talend-zip.js"',
    '      version="' + VERSION + '" statusCode="" item="' + itemId + '">',
    '    <author href="../../talend.project#' + authorId + '"/>',
    '  </TalendProperties:Property>',
    '  <TalendProperties:ItemState xmi:id="' + stateId + '" path=""/>',
    '  <CodeProperties:RoutineItem xmi:id="' + itemId + '" property="' + propId +
      '" state="' + stateId + '" builtIn="false">',
    '    <content href="' + r.name + '_' + VERSION + '.item#/"/>',
    '  </CodeProperties:RoutineItem>',
    '</xmi:XMI>',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
//  The job itself, generated by build-talend-job.js. Included so Studio imports the
//  routines AND the process in one action; without it the bundle is four routines and
//  a README telling someone to wire nine components by hand.
// ---------------------------------------------------------------------------
const JOB_DIR = path.join(TALEND_DIR, 'job');
if (fs.existsSync(JOB_DIR)) {
  for (const f of fs.readdirSync(JOB_DIR)) {
    const src = fs.readFileSync(path.join(JOB_DIR, f), 'utf8');
    entries[PROJECT + '/process/' + f] = src;
    entries['bundle/job/' + f] = src;
  }
}

// ---------------------------------------------------------------------------
//  Layer 3 — a real Studio export, if one has been dropped in
// ---------------------------------------------------------------------------

let exportedFiles = 0;
if (fs.existsSync(EXPORT_DIR)) {
  const found = {};
  walk(EXPORT_DIR, EXPORT_DIR, found);
  for (const rel of Object.keys(found)) {
    entries['studio-export/' + rel] = found[rel];
    exportedFiles++;
  }
}

// ---------------------------------------------------------------------------
//  IMPORT.md
// ---------------------------------------------------------------------------

const layer3 = exportedFiles > 0
  ? 'Present — ' + exportedFiles + ' file(s), packaged verbatim from `deploy/talend/job/`. ' +
    'Import this in preference to layer 2.'
  : 'Empty in this build. To populate it: build the job once in Studio, **File -> Export items**, ' +
    'unpack the export into `deploy/talend/job/`, and re-run `npm run talend:zip`. The script ' +
    'packages whatever is there — no code change needed, and layer 2 becomes redundant.';

entries['IMPORT.md'] = [
  '# Importing `' + JOB_NAME + '`',
  '',
  'Built by `deploy/build-talend-zip.js`. Three layers, most-certain first.',
  '',
  '## 1. `bundle/` — always correct',
  '',
  'Everything needed to build the job by hand, in one place:',
  '',
  '| Path | What |',
  '|---|---|',
  '| `bundle/routines/*.java` | The ' + routines.length +
    ' routines. Studio: **Repository -> Code -> Routines -> Import routines** |',
  '| `bundle/contexts/mcg_talend_demo.properties` | Import as context group **MCG_Demo** |',
  '| `bundle/BUILD_BULK_ADDRESS_JOB.md` | The canvas spec — five subjobs, component by component |',
  '| `bundle/sql/create_silver_addresses_geocoded.sql` | Iceberg target for the S3 branch |',
  '',
  'This path always works. If anything below fails, fall back to it.',
  '',
  '## 2. `' + PROJECT + '/` — synthesized project tree (routines only)',
  '',
  'A Talend "Export items" tree so the ' + routines.length +
    ' routines import in one action instead of',
  'four: **File -> Import items -> Select archive file**, pick this ZIP, tick the routines.',
  '',
  '> **Not verified against a live Talend Studio.** The XMI metadata is synthesized',
  '> from the `.java` sources rather than produced by Studio\'s own exporter, so Studio',
  '> may reject it or list nothing importable. That costs you nothing — import the',
  '> `.java` files from `bundle/routines/` instead, which is what you do today.',
  '>',
  '> It covers **routines only**. The job canvas is not in here; build it from the',
  '> spec, or see layer 3.',
  '',
  '## 3. `studio-export/` — the real thing',
  '',
  layer3,
  '',
].join('\n');

// ---------------------------------------------------------------------------
//  Write
// ---------------------------------------------------------------------------

const zip = zipFromEntries(entries);
const count = Object.keys(entries).length;

if (dryRun) {
  console.log('[dry-run] ' + OUT);
  console.log('[dry-run] ' + count + ' entries, ' + (zip.length / 1024).toFixed(1) + ' KB');
  for (const name of Object.keys(entries).sort()) console.log('  ' + name);
  process.exit(0);
}

fs.writeFileSync(OUT, zip);
console.log('Wrote ' + OUT + ' (' + count + ' entries, ' + (zip.length / 1024).toFixed(1) + ' KB)');
console.log('  routines packaged : ' + routines.length);
console.log('  studio export     : ' + (exportedFiles > 0 ? exportedFiles + ' file(s)' : 'none (see IMPORT.md layer 3)'));
console.log('Import in Talend Studio: File -> Import items -> Select archive file.');
