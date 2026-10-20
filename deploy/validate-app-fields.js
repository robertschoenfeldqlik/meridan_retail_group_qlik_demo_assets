#!/usr/bin/env node
/**
 * validate-app-fields.js — prove every app field reference resolves.
 * ============================================================================
 * The analytics apps are described in two places and the load scripts are the
 * only thing that creates fields:
 *
 *   deploy/apps/load-scripts/*.qvs   aliases every raw lakehouse column to a
 *                                    display name: `location_id AS [Distribution Center]`
 *   deploy/apps/app-definitions.json the external app spec (build-apps.js
 *                                    PREFERS this when it exists)
 *   deploy/build-apps.js             the embedded fallback spec
 *
 * A measure that names a field the load script renamed away does not error in
 * Qlik — it evaluates to NULL and the KPI reads zero, silently, in front of the
 * audience. `deploy/fix-null-measures.js` exists because that already happened.
 *
 * So this is the gate: parse the field universe out of the load scripts, walk
 * both specs, and exit non-zero on any reference that cannot resolve. Run from
 * `npm run lint` and from CI.
 *
 * Usage:
 *   node deploy/validate-app-fields.js            # report + exit 1 on failure
 *   node deploy/validate-app-fields.js --list     # also print the field universe
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const LOAD_SCRIPT_DIR = path.join(SCRIPT_DIR, 'apps', 'load-scripts');
const APP_DEFS_PATH = path.join(SCRIPT_DIR, 'apps', 'app-definitions.json');
const BUILD_APPS_PATH = path.join(SCRIPT_DIR, 'build-apps.js');
const CSV_DIR = path.join(SCRIPT_DIR, 'mockdata', 'out');

// Which load script backs which app. The app spec carries no pointer to its
// own load script in every shape, so the name is the join.
const APPS = [
  { key: 'app1', match: /supply\s*chain/i, qvs: 'app1-supply-chain.qvs' },
  { key: 'app2', match: /delivery|customer/i, qvs: 'app2-delivery-experience.qvs' },
];

// Qlik built-ins and chart keywords that look like bare field refs but are not.
// Kept lowercase; the comparison lowercases the token.
const QLIK_RESERVED = new Set([
  'sum', 'count', 'avg', 'min', 'max', 'only', 'if', 'isnull', 'null', 'len', 'trim',
  'num', 'date', 'time', 'timestamp', 'interval', 'floor', 'ceil', 'round', 'fabs',
  'sign', 'mod', 'frac', 'sqrt', 'pow', 'exp', 'log', 'rand', 'pi', 'e',
  'aggr', 'total', 'distinct', 'firstsortedvalue', 'rangesum', 'rangeavg', 'rangemax',
  'rangemin', 'above', 'below', 'before', 'after', 'rank', 'class', 'dual', 'pick',
  'alt', 'coalesce', 'concat', 'text', 'left', 'right', 'mid', 'subfield', 'upper',
  'lower', 'capitalize', 'replace', 'purgechar', 'keepchar', 'index', 'substringcount',
  'wildmatch', 'match', 'mixmatch', 'like', 'and', 'or', 'not', 'xor',
  'year', 'month', 'monthname', 'monthstart', 'monthend', 'day', 'weekday', 'week',
  'quarter', 'quartername', 'yearstart', 'yearend', 'makedate', 'addmonths', 'addyears',
  'now', 'today', 'localtime', 'utc',
  'nullcount', 'fractile', 'median', 'mode', 'stdev', 'skew', 'kurtosis',
  'rgb', 'argb', 'hsl', 'color', 'colormix1', 'autonumber', 'evaluate',
  'fieldvalue', 'fieldindex', 'getselectedcount', 'getfieldselections',
  'getcurrentselections', 'getobjectfield', 'vartotal', 'set', 'asc', 'desc',
]);

// ---------------------------------------------------------------------------
//  The field universe, read out of the load scripts
// ---------------------------------------------------------------------------

function csvHeader(csvPath) {
  if (!fs.existsSync(csvPath)) return [];
  const first = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/)[0] || '';
  return first.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Every field name a load script puts into the data model:
 *   - `AS [Display Name]` and `AS BareName` aliases
 *   - INLINE table header fields
 *   - `LOAD *` pulls the raw column names straight through, so the matching
 *     CSV header in mockdata/out is the field list for that table
 *   - the generated master calendar fields
 */
function fieldUniverse(qvsPath) {
  const raw = fs.readFileSync(qvsPath, 'utf8');
  // Drop // comment lines: the scripts keep the equivalent SELECT commented out
  // beside each LOAD, and those column names are NOT fields in the model.
  const live = raw.split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n');

  const fields = new Set();

  for (const m of live.matchAll(/\bAS\s+\[([^\]]+)\]/gi)) fields.add(m[1]);
  for (const m of live.matchAll(/\bAS\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:,|;|$)/gim)) fields.add(m[1]);

  for (const m of live.matchAll(/INLINE\s*\[\s*\r?\n([^\r\n]+)/gi)) {
    m[1].split(',').forEach((f) => fields.add(f.trim()));
  }

  for (const m of live.matchAll(/LOAD\s+\*[\s\S]{0,400}?\/([A-Za-z0-9_]+)\.qvd/gi)) {
    csvHeader(path.join(CSV_DIR, m[1] + '.csv')).forEach((f) => fields.add(f));
  }

  // Master calendar: the Calendar table LOADs these as bare aliases already,
  // but Date is the generated key and is easy to miss.
  ['Date'].forEach((f) => fields.add(f));

  return fields;
}

// ---------------------------------------------------------------------------
//  Reference extraction
// ---------------------------------------------------------------------------

const EXPR_KEYS = new Set(['expression', 'definition', 'qDef', 'calcCondition']);
const FIELD_KEYS = new Set(['field']);

/** Bracketed [Field] refs in an expression, minus $(var) expansions. */
function bracketRefs(expr) {
  const out = [];
  for (const m of expr.matchAll(/\[([^\]\n]+)\]/g)) {
    if (!/^\$\(/.test(m[1])) out.push(m[1]);
  }
  return out;
}

/**
 * Bare snake_case refs — the raw lakehouse column names the load scripts alias
 * away. Qlik functions are never snake_case, so this is a high-signal test.
 * String literals and bracketed names are stripped first.
 */
function bareRefs(expr) {
  const stripped = expr
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/'[^']*'/g, ' ')
    .replace(/"[^"]*"/g, ' ');
  const out = [];
  for (const m of stripped.matchAll(/\b([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+)\b/g)) {
    if (!QLIK_RESERVED.has(m[1].toLowerCase())) out.push(m[1]);
  }
  return out;
}

/** A `field` value: a bare name, a [Bracketed] name, or an `=expression`. */
function fieldValueRefs(value) {
  if (/^=/.test(value)) {
    return [...bracketRefs(value), ...bareRefs(value)];
  }
  const br = bracketRefs(value);
  if (br.length) return br;
  return [value.trim()];
}

function collectFromJson(node, appKey, trail, sink) {
  if (Array.isArray(node)) {
    node.forEach((n, i) => collectFromJson(n, appKey, `${trail}[${i}]`, sink));
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    const where = `${trail}.${k}`;
    if (typeof v === 'string' && EXPR_KEYS.has(k)) {
      [...bracketRefs(v), ...bareRefs(v)].forEach((r) => sink.push({ appKey, where, ref: r, src: v }));
    } else if (typeof v === 'string' && FIELD_KEYS.has(k)) {
      fieldValueRefs(v).forEach((r) => sink.push({ appKey, where, ref: r, src: v }));
    } else {
      collectFromJson(v, appKey, where, sink);
    }
  }
}

/**
 * The embedded spec in build-apps.js, read as text. It is a JS literal inside
 * getAppDefinitions(), so it is scanned for `expression:` / `field:` string
 * values rather than parsed.
 */
function collectFromBuildApps(sink) {
  const lines = fs.readFileSync(BUILD_APPS_PATH, 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => /^function getAppDefinitions/.test(l));
  if (start < 0) return;
  let appKey = 'app1';
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    // The embedded array ends at the next top-level declaration.
    if (i > start && /^(function|class|const|module\.exports)\s/.test(line)) break;
    if (/name:\s*'MCG Delivery/.test(line)) appKey = 'app2';
    else if (/name:\s*'MCG Supply Chain/.test(line)) appKey = 'app1';

    for (const m of line.matchAll(/\b(expression|field):\s*'((?:[^'\\]|\\.)*)'/g)) {
      const value = m[2].replace(/\\'/g, "'");
      const refs = m[1] === 'field' ? fieldValueRefs(value) : [...bracketRefs(value), ...bareRefs(value)];
      refs.forEach((r) => sink.push({ appKey, where: `build-apps.js:${i + 1}`, ref: r, src: value }));
    }
  }
}

// ---------------------------------------------------------------------------
//  Main
// ---------------------------------------------------------------------------

function main() {
  const listOnly = process.argv.includes('--list');
  const universe = {};
  let setupError = false;

  for (const app of APPS) {
    const qvs = path.join(LOAD_SCRIPT_DIR, app.qvs);
    if (!fs.existsSync(qvs)) {
      console.error(`  MISSING load script: ${path.relative(SCRIPT_DIR, qvs)}`);
      setupError = true;
      universe[app.key] = new Set();
      continue;
    }
    universe[app.key] = fieldUniverse(qvs);
  }

  if (listOnly) {
    for (const app of APPS) {
      const f = [...universe[app.key]].sort();
      console.log(`\n=== ${app.key} field universe (${f.length}) — from ${app.qvs} ===`);
      console.log('  ' + f.map((s) => `[${s}]`).join(' '));
    }
    console.log('');
  }

  const refs = [];

  if (fs.existsSync(APP_DEFS_PATH)) {
    const defs = JSON.parse(fs.readFileSync(APP_DEFS_PATH, 'utf8'));
    for (const app of defs.apps || []) {
      const match = APPS.find((a) => a.match.test(app.name || ''));
      if (!match) {
        console.error(`  app-definitions.json: "${app.name}" matches no known load script`);
        setupError = true;
        continue;
      }
      collectFromJson(app, match.key, `app-definitions.json:${app.name}`, refs);
    }
  }

  if (fs.existsSync(BUILD_APPS_PATH)) collectFromBuildApps(refs);

  // Group unresolved refs by field name so the report is one line per problem,
  // not one per occurrence.
  const bad = new Map();
  for (const r of refs) {
    const known = universe[r.appKey];
    if (!known || known.has(r.ref)) continue;
    const key = `${r.appKey}|${r.ref}`;
    if (!bad.has(key)) bad.set(key, { appKey: r.appKey, ref: r.ref, hits: [] });
    bad.get(key).hits.push(r);
  }

  console.log(`\nApp field validation — ${refs.length} reference(s) checked against ${APPS.length} load script(s)`);
  for (const app of APPS) {
    console.log(`  ${app.key}: ${universe[app.key].size} field(s) in the model (${app.qvs})`);
  }

  if (!bad.size && !setupError) {
    console.log('\n  OK — every field reference resolves.\n');
    process.exit(0);
  }

  const rows = [...bad.values()].sort((a, b) => a.appKey.localeCompare(b.appKey) || a.ref.localeCompare(b.ref));
  console.log(`\n  ${rows.length} field name(s) referenced but never created by a load script:\n`);
  for (const row of rows) {
    console.log(`  [${row.appKey}] ${row.ref}   (${row.hits.length} reference${row.hits.length === 1 ? '' : 's'})`);
    for (const h of row.hits.slice(0, 3)) {
      console.log(`        ${h.where}`);
      console.log(`          ${h.src}`);
    }
    if (row.hits.length > 3) console.log(`        … and ${row.hits.length - 3} more`);
  }
  console.log('\n  These resolve to NULL in Qlik — no error, the KPI just reads zero.');
  console.log('  Fix the spec to use the load script\'s field name, or add the field to the load script.');
  console.log('  Print the available names with:  node deploy/validate-app-fields.js --list\n');
  process.exit(1);
}

main();
