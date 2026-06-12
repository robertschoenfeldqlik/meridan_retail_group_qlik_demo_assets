#!/usr/bin/env node
// ---------------------------------------------------------------------------
//  build-apps.js
//  Builds MCG Qlik Analytics apps from scratch via Qlik Cloud REST + Engine APIs.
//
//  Creates apps programmatically (no .qvf import required) by:
//    1. Creating empty apps via REST API
//    2. Setting load scripts from deploy/apps/load-scripts/*.qvs
//    3. Connecting via Engine API (WebSocket) for master items & sheets
//    4. Creating master dimensions, master measures, and sheet objects
//    5. Applying the MCG Dark Theme
//    6. Optionally triggering a reload and publishing
//
//  Usage:
//    node deploy/build-apps.js                          # build all apps
//    node deploy/build-apps.js --dry-run                # preview without API calls
//    node deploy/build-apps.js --app "Supply Chain"     # build one app (substring match)
//    node deploy/build-apps.js --verbose                # detailed logging
//    node deploy/build-apps.js --config ./my-config.json
//    node deploy/build-apps.js --skip-publish           # build but do not publish
//    node deploy/build-apps.js --skip-reload            # build but do not trigger reload
//    node deploy/build-apps.js --help
//
//  Dependencies:
//    npm install ws   (for Engine WebSocket API — master items & sheets)
//
//  If 'ws' is not installed the script will still run but will skip
//  Engine API steps (master items, sheets) and log instructions.
//
//  Environment variable overrides (same as deploy-to-qlik.js):
//    QLIK_TENANT_HOST / QLIK_REGION / QLIK_API_KEY / QLIK_AUTH_METHOD
// ---------------------------------------------------------------------------

'use strict';

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

// Attempt to load 'ws' — gracefully degrade if not installed
let WebSocket;
try {
  WebSocket = require('ws');
} catch (_) {
  WebSocket = null;
}

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

const SCRIPT_DIR  = __dirname;
const PROJECT_DIR = path.resolve(SCRIPT_DIR, '..');

const DEFAULT_CONFIG_PATH = path.join(SCRIPT_DIR, 'config.json');
const APP_DEFS_PATH       = path.join(SCRIPT_DIR, 'apps', 'app-definitions.json');
const LOAD_SCRIPTS_DIR    = path.join(SCRIPT_DIR, 'apps', 'load-scripts');

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

// MCG brand colors for reference in object definitions
const MCG_COLORS = {
  navy:   '#1B2A4A',
  teal:   '#0D7C8F',
  gold:   '#C4922E',
  green:  '#059669',
  red:    '#DC2626',
  purple: '#93579C',
  bg:     '#0D2137',
  text:   '#FFFFFF',
  muted:  '#A8B8CC',
};

// ---------------------------------------------------------------------------
//  CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    configPath:  DEFAULT_CONFIG_PATH,
    dryRun:      false,
    verbose:     false,
    appFilter:   null,
    skipPublish: false,
    skipReload:  false,
  };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--config':
        args.configPath = path.resolve(argv[++i]);
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--verbose':
        args.verbose = true;
        break;
      case '--app':
        args.appFilter = argv[++i];
        break;
      case '--skip-publish':
        args.skipPublish = true;
        break;
      case '--build-sheets':
        args.buildSheets = true;
        break;
      case '--skip-reload':
        args.skipReload = true;
        break;
      case '--help':
        printUsage();
        process.exit(EXIT_SUCCESS);
        break;
      default:
        console.error(`Unknown argument: ${argv[i]}`);
        printUsage();
        process.exit(EXIT_FAILURE);
    }
  }
  return args;
}

function printUsage() {
  console.log(`
Usage: node build-apps.js [OPTIONS]

Options:
  --config <path>     Path to config JSON (default: deploy/config.json)
  --dry-run           Preview actions without making API calls
  --verbose           Enable detailed logging
  --app <name>        Build only the app matching this substring
  --skip-publish      Build apps but do not publish to managed space
  --skip-reload       Build apps but do not trigger data reload
  --build-sheets      Legacy: build master items + sheets via Engine API.
                      Default builds EMPTY apps (load script mapped to the
                      data products); sheets are authored via Qlik MCP
                      prompting — see apps/mcp-sheet-prompts.json
  --help              Show this message

Examples:
  node deploy/build-apps.js --dry-run
  node deploy/build-apps.js --app "Supply Chain" --verbose
  node deploy/build-apps.js --skip-reload --skip-publish
`);
}

// ---------------------------------------------------------------------------
//  Logger  (colored output with elapsed time)
// ---------------------------------------------------------------------------

class Logger {
  constructor(verbose = false) {
    this.verbose = verbose;
    this._startTime = Date.now();
  }

  _ts() {
    const elapsed = ((Date.now() - this._startTime) / 1000).toFixed(1);
    return `\x1b[90m[+${elapsed}s]\x1b[0m`;
  }

  info(msg)    { console.log(`${this._ts()}  \x1b[36mINFO\x1b[0m   ${msg}`); }
  success(msg) { console.log(`${this._ts()}  \x1b[32m OK \x1b[0m   ${msg}`); }
  warn(msg)    { console.warn(`${this._ts()}  \x1b[33mWARN\x1b[0m   ${msg}`); }
  error(msg)   { console.error(`${this._ts()}  \x1b[31mERROR\x1b[0m  ${msg}`); }
  debug(msg)   { if (this.verbose) console.log(`${this._ts()}  \x1b[90mDEBUG\x1b[0m  ${msg}`); }

  step(n, total, msg) {
    console.log(`${this._ts()}  \x1b[35m[${n}/${total}]\x1b[0m  ${msg}`);
  }

  section(title) {
    const bar = '='.repeat(64);
    console.log(`\n\x1b[1m${bar}\n  ${title}\n${bar}\x1b[0m`);
  }
}

// ---------------------------------------------------------------------------
//  Configuration loader  (reuses pattern from deploy-to-qlik.js)
// ---------------------------------------------------------------------------

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Config file not found: ${configPath}\n` +
      `Copy deploy/config.example.json to deploy/config.json and fill in your values.`
    );
  }
  const raw = fs.readFileSync(configPath, 'utf-8');
  const cfg = JSON.parse(raw);
  stripCommentKeys(cfg);
  return cfg;
}

function stripCommentKeys(obj) {
  if (obj === null || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('comment_')) {
      delete obj[key];
    } else {
      stripCommentKeys(obj[key]);
    }
  }
}

function applyEnvOverrides(cfg) {
  if (process.env.QLIK_TENANT_HOST) cfg.tenant.hostname = process.env.QLIK_TENANT_HOST;
  if (process.env.QLIK_REGION)      cfg.tenant.region   = process.env.QLIK_REGION;
  if (process.env.QLIK_API_KEY)     cfg.auth.apiKey     = process.env.QLIK_API_KEY;
  if (process.env.QLIK_AUTH_METHOD) cfg.auth.method     = process.env.QLIK_AUTH_METHOD;
  return cfg;
}

// ---------------------------------------------------------------------------
//  HTTP client  (zero-dependency)
// ---------------------------------------------------------------------------

function requestOnce(method, reqUrl, { headers = {}, body = null, rawBody = null, timeout = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(reqUrl);
    const transport = parsed.protocol === 'https:' ? https : http;

    const opts = {
      method,
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      headers:  { ...headers },
      timeout,
    };

    let payload = rawBody || null;
    if (body && !rawBody) {
      payload = JSON.stringify(body);
      opts.headers['Content-Type']   = opts.headers['Content-Type'] || 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = transport.request(opts, (res) => {
      // Follow 301/302/307/308 redirects (max 10)
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        const rc = (opts._redirectCount || 0) + 1;
        if (rc > 10) { res.resume(); reject(new Error(`Too many redirects (>10): ${reqUrl}`)); return; }
        const redirectUrl = new URL(res.headers.location, reqUrl).toString();
        res.resume(); // drain response
        resolve(requestOnce(method, redirectUrl, { headers, body, rawBody, timeout, _redirectCount: rc }));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        let parsed = raw;
        const ct = (res.headers['content-type'] || '').toLowerCase();
        if (ct.includes('application/json') && raw.length > 0) {
          try { parsed = JSON.parse(raw); } catch (_) { /* keep raw string */ }
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error(`Request timed out: ${method} ${reqUrl}`)); });
    req.on('error', reject);

    if (payload) req.write(payload);
    req.end();
  });
}

async function request(method, reqUrl, opts = {}, { maxRetries = 3, backoff = 2.0 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await requestOnce(method, reqUrl, opts);
      if ([429, 502, 503, 504].includes(res.statusCode) && attempt < maxRetries) {
        const retryAfter = parseFloat(res.headers['retry-after']) || backoff * Math.pow(2, attempt);
        console.warn(`  WARN  HTTP ${res.statusCode} — retrying in ${retryAfter.toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(retryAfter * 1000);
        continue;
      }
      return res;
    } catch (err) {
      if (attempt < maxRetries && (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.message.includes('timed out'))) {
        const wait = backoff * Math.pow(2, attempt);
        console.warn(`  WARN  ${err.code || 'Timeout'} — retrying in ${wait.toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(wait * 1000);
        continue;
      }
      throw err;
    }
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
//  App Definitions  (embedded — the canonical source of truth)
// ---------------------------------------------------------------------------
//
//  These definitions describe the two MCG domain apps, their master
//  dimensions, master measures, and sheet layouts.  They are derived from
//  the HTML mockups in deploy/apps/mockups/ and the load scripts in
//  deploy/apps/load-scripts/.
// ---------------------------------------------------------------------------

/**
 * Normalize an app definition from the external JSON format to the internal
 * format used by buildApp().  The external file (app-definitions.json) uses
 * property names like masterDimensions, masterMeasures, loadScript (path),
 * while the builder expects dimensions, measures, loadScriptFile (filename).
 */
function normalizeAppDef(raw) {
  // Map dimensions — external uses { title, field, label, tags, id }
  const dimensions = (raw.masterDimensions || raw.dimensions || []).map((d) => ({
    name:  d.title || d.name || d.label,
    field: d.field.startsWith('[') ? d.field : `[${d.label || d.title || d.field}]`,
    tags:  d.tags || [],
    description: d.description || '',
  }));

  // Map measures — external uses { title, expression, numberFormat, label, description, tags, id }
  const measures = (raw.masterMeasures || raw.measures || []).map((m) => ({
    name:        m.title || m.name,
    expression:  m.expression,
    format:      m.numberFormat || m.format || '',
    label:       m.label || m.title || m.name,
    description: m.description || '',
    tags:        m.tags || [],
  }));

  // Map sheets — external objects use { qType, props.measures, props.dimensions }
  // while internal uses { type, measure, dimension, measures, dimensions }
  const sheets = (raw.sheets || []).map((s) => {
    const objects = (s.objects || []).map((o) => {
      const obj = {
        type:        o.qType || o.type,
        title:       o.title,
        description: o.description || '',
      };
      // Extract dimensions from props
      if (o.props && o.props.dimensions && o.props.dimensions.length) {
        if (o.props.dimensions.length === 1) {
          obj.dimension = o.props.dimensions[0].label || o.props.dimensions[0].field;
        } else {
          obj.dimensions = o.props.dimensions.map((d) => d.label || d.field);
        }
      }
      // Extract measures from props
      if (o.props && o.props.measures && o.props.measures.length) {
        if (o.props.measures.length === 1) {
          obj.measure = o.props.measures[0].label || o.props.measures[0].expression;
        } else {
          obj.measures = o.props.measures.map((m) => m.label || m.expression);
        }
      }
      // Directly specified dimension/measure (internal format)
      if (o.dimension) obj.dimension = o.dimension;
      if (o.dimensions) obj.dimensions = o.dimensions;
      if (o.measure) obj.measure = o.measure;
      if (o.measures) obj.measures = o.measures;
      return obj;
    });

    return {
      id:          s.id,
      title:       s.title,
      description: s.description || '',
      objects,
    };
  });

  // Resolve loadScriptFile from external loadScript path
  let loadScriptFile = raw.loadScriptFile;
  if (!loadScriptFile && raw.loadScript) {
    // External format: "load-scripts/app1-supply-chain.qvs" — extract filename
    loadScriptFile = path.basename(raw.loadScript);
  }

  return {
    id:             raw.id || raw.appId || raw.name.toLowerCase().replace(/\s+/g, '-'),
    name:           raw.name,
    description:    raw.description || '',
    loadScriptFile: loadScriptFile,
    theme:          raw.theme || 'MCG Dark Theme',
    dimensions,
    measures,
    sheets,
  };
}

function getAppDefinitions() {
  // If an external definitions file exists, prefer it and normalize the format
  if (fs.existsSync(APP_DEFS_PATH)) {
    try {
      const ext = JSON.parse(fs.readFileSync(APP_DEFS_PATH, 'utf-8'));
      if (ext.apps && ext.apps.length) {
        return ext.apps.map(normalizeAppDef);
      }
    } catch (_) { /* fall through to embedded definitions */ }
  }

  return [
    // ==================================================================
    //  APP 1 — MCG Supply Chain Operations
    // ==================================================================
    {
      id: 'app1-supply-chain',
      name: 'MCG Supply Chain Operations',
      description: 'End-to-end supply chain visibility for Meridian Commerce Group. Covers inventory accuracy, cold chain monitoring, product data quality, compliance readiness, and cost impact analysis across all 7 data nightmares.',
      loadScriptFile: 'app1-supply-chain.qvs',
      theme: 'MCG Dark Theme',
      dimensions: [
        { name: 'Distribution Center', field: '[Distribution Center]', tags: ['$ascii', '$text'] },
        { name: 'SKU',                 field: '[SKU]',                 tags: ['$ascii', '$text'] },
        { name: 'Product Name',        field: '[Product Name]',        tags: ['$ascii', '$text'] },
        { name: 'Category',            field: '[Category]',            tags: ['$ascii', '$text'] },
        { name: 'Region',              field: '[Region]',              tags: ['$ascii', '$text'] },
        { name: 'Storage Zone',        field: '[Storage Zone]',        tags: ['$ascii', '$text'] },
        { name: 'Pipeline Status',     field: '[Pipeline Status]',     tags: ['$ascii', '$text'] },
        { name: 'Carrier',             field: '[Carrier]',             tags: ['$ascii', '$text'] },
        { name: 'Route',               field: '[Route]',               tags: ['$ascii', '$text'] },
        { name: 'Product Type',        field: '[Product Type]',        tags: ['$ascii', '$text'] },
        { name: 'Product Category',    field: '[Product Category]',    tags: ['$ascii', '$text'] },
        { name: 'Compliance Category', field: '[Compliance Category]', tags: ['$ascii', '$text'] },
        { name: 'Nightmare Name',      field: '[Nightmare Name]',      tags: ['$ascii', '$text'] },
        { name: 'Cost Category',       field: '[Cost Category]',       tags: ['$ascii', '$text'] },
        { name: 'Period',              field: '[Period]',              tags: ['$ascii', '$text'] },
        { name: 'Date',                field: '[Date]',                tags: ['$date'] },
        { name: 'Month',               field: '[Month Name]',          tags: ['$ascii', '$text'] },
        { name: 'Quarter',             field: '[Quarter]',             tags: ['$ascii', '$text'] },
      ],
      measures: [
        { name: 'IRA %',                        expression: 'Avg([IRA %])',                                          format: '#,##0.0%',  label: 'Inventory Record Accuracy' },
        { name: 'Phantom Inventory Units',       expression: 'Sum({<[Phantom Flag]={1}>} 1)',                         format: '#,##0',     label: 'Phantom Inventory Units' },
        { name: 'Avg Trust Score',               expression: 'Avg([Trust Score])',                                    format: '#,##0.00',  label: 'Average Trust Score' },
        { name: 'Active Pipelines Healthy',      expression: 'Count({<[Pipeline Status]={\"healthy\"}>} DISTINCT [Pipeline Status])', format: '#,##0', label: 'Healthy Pipelines' },
        { name: 'Sync Lag (min)',                expression: 'Avg([Sync Lag (min)])',                                 format: '#,##0.0',   label: 'Average Sync Lag' },
        { name: 'Active Exceedances',            expression: 'Sum({<[Exceedance Flag]={1}>} 1)',                      format: '#,##0',     label: 'Temperature Exceedances' },
        { name: 'Spoilage Probability (Max)',    expression: 'Max([Spoilage Probability])',                           format: '#,##0%',    label: 'Highest Spoilage Probability' },
        { name: 'Estimated Loss ($)',            expression: 'Sum([Estimated Loss ($)])',                             format: '$#,##0',    label: 'Estimated Spoilage Loss' },
        { name: 'Active Sensors',                expression: 'Sum([Sensor Count])',                                   format: '#,##0',     label: 'Active IoT Sensors' },
        { name: 'Exceedance Duration (avg)',     expression: 'Avg([Exceedance Duration (min)])',                      format: '#,##0.0',   label: 'Avg Exceedance Duration (min)' },
        { name: 'Product Completeness',          expression: 'Avg([Product Trust Score])',                            format: '#,##0%',    label: 'Product Data Completeness' },
        { name: 'Missing Weights',               expression: 'Sum({<[Weight Missing]={1}>} 1)',                       format: '#,##0',     label: 'Products with Missing Weight' },
        { name: 'Trace Completeness %',          expression: 'Avg([Trace Completeness %])',                           format: '#,##0%',    label: 'Farm-to-Shelf Traceability' },
        { name: 'Missing Lot Count',             expression: 'Sum({<[Lot Missing Flag]={1}>} 1)',                     format: '#,##0',     label: 'Items Without Lot ID' },
        { name: 'Total Cost ($)',                expression: 'Sum([Cost ($)])',                                       format: '$#,##0',    label: 'Total Annual Cost Impact' },
        { name: 'Incident Count',                expression: 'Sum([Incident Count])',                                 format: '#,##0',     label: 'Total Incidents' },
        { name: 'Remediation Progress',          expression: 'Avg([Remediation Progress %])',                         format: '#,##0%',    label: 'Avg Remediation Progress' },
      ],
      sheets: [
        {
          id: 'sheet-inventory-health',
          title: 'Inventory Health Overview',
          description: 'IRA metrics, phantom inventory detection, pipeline health, and trust scores across distribution centers.',
          objects: [
            { type: 'kpi',      title: 'Inventory Record Accuracy', measure: 'IRA %' },
            { type: 'kpi',      title: 'Phantom Inventory Units',   measure: 'Phantom Inventory Units' },
            { type: 'kpi',      title: 'Average Trust Score',       measure: 'Avg Trust Score' },
            { type: 'kpi',      title: 'Active Pipelines Healthy',  measure: 'Active Pipelines Healthy' },
            { type: 'barchart', title: 'Phantom Inventory by DC',   dimension: 'Distribution Center', measure: 'Phantom Inventory Units' },
            { type: 'linechart', title: 'IRA Trend (Monthly)',      dimension: 'Month', measure: 'IRA %' },
            { type: 'table',    title: 'Pipeline Status',           dimensions: ['Distribution Center', 'Pipeline Status'], measures: ['Sync Lag (min)', 'Avg Trust Score'] },
          ],
        },
        {
          id: 'sheet-cold-chain',
          title: 'Cold Chain Monitoring',
          description: 'Real-time temperature monitoring, exceedance alerts, spoilage probability, and sensor health.',
          objects: [
            { type: 'kpi',      title: 'Active Exceedances',       measure: 'Active Exceedances' },
            { type: 'kpi',      title: 'Highest Spoilage Risk',    measure: 'Spoilage Probability (Max)' },
            { type: 'kpi',      title: 'Active IoT Sensors',       measure: 'Active Sensors' },
            { type: 'linechart', title: 'Live Temperature Feed (Last 2 Hours)', dimension: 'Date', measure: 'Spoilage Probability (Max)', description: 'Near real-time temperature readings from IoT sensors.' },
            { type: 'barchart', title: 'Exceedance Rate by Route',  dimension: 'Route', measure: 'Active Exceedances' },
            { type: 'map',      title: 'GPS Tracking - Active Routes', description: 'Map visualization requires manual configuration with Qlik GeoAnalytics.' },
            { type: 'table',    title: 'At-Risk Shipments',         dimensions: ['Route', 'Carrier', 'Product Type'], measures: ['Spoilage Probability (Max)', 'Estimated Loss ($)', 'Exceedance Duration (avg)'] },
          ],
        },
        {
          id: 'sheet-product-quality',
          title: 'Product Data Quality',
          description: 'Product master harmonization status, SKU resolution, weight completeness, and trust scores by category.',
          objects: [
            { type: 'kpi',      title: 'Product Completeness',     measure: 'Product Completeness' },
            { type: 'kpi',      title: 'Missing Weights',          measure: 'Missing Weights' },
            { type: 'kpi',      title: 'Post-Harmonization Trust Score', measure: 'Avg Trust Score' },
            { type: 'piechart', title: 'SKU Resolution Status',    dimension: 'Product Category', measure: 'Product Completeness' },
            { type: 'barchart', title: 'Trust Score by Category',   dimension: 'Product Category', measure: 'Avg Trust Score' },
            { type: 'table',    title: 'Product Detail',            dimensions: ['Product Name', 'Product Category'], measures: ['Product Completeness', 'Missing Weights'] },
          ],
        },
        {
          id: 'sheet-compliance',
          title: 'Compliance & Recall Readiness',
          description: 'Lot traceability, farm-to-shelf completeness, NVWA compliance status, and recall simulation readiness.',
          objects: [
            { type: 'kpi',      title: 'Farm-to-Shelf Traceability', measure: 'Trace Completeness %' },
            { type: 'kpi',      title: 'Missing Lot Numbers',        measure: 'Missing Lot Count' },
            { type: 'kpi',      title: 'Open Compliance Findings',   measure: 'Incident Count' },
            { type: 'barchart', title: 'Recall Readiness by Category', dimension: 'Compliance Category', measure: 'Trace Completeness %' },
            { type: 'linechart', title: 'Lot Capture Rate Trend (Monthly)', dimension: 'Month', measure: 'Trace Completeness %' },
            { type: 'table',    title: 'NVWA Compliance Risk Assessment', dimensions: ['Compliance Category', 'Region'], measures: ['Trace Completeness %', 'Missing Lot Count'] },
          ],
        },
        {
          id: 'sheet-cost-impact',
          title: 'Executive Cost Impact',
          description: 'Annual cost attribution by data nightmare, remediation progress tracking, and DC-level cost drill-down.',
          objects: [
            { type: 'kpi',      title: 'Total Annual Impact',       measure: 'Total Cost ($)' },
            { type: 'kpi',      title: 'Worst Nightmare',           measure: 'Total Cost ($)', description: 'Dimension: Nightmare Name, sorted descending' },
            { type: 'kpi',      title: 'Remediation Progress',      measure: 'Remediation Progress' },
            { type: 'barchart', title: 'Cost by Data Nightmare (Annual Impact)', dimension: 'Nightmare Name', measure: 'Total Cost ($)' },
            { type: 'barchart', title: 'Cost by Distribution Center (Top 4)',    dimension: 'Distribution Center', measure: 'Total Cost ($)' },
            { type: 'combochart', title: 'Remediation Progress by Nightmare',   dimension: 'Nightmare Name', measures: ['Remediation Progress', 'Total Cost ($)'] },
          ],
        },
      ],
    },

    // ==================================================================
    //  APP 2 — MCG Delivery & Customer Experience
    // ==================================================================
    {
      id: 'app2-delivery-experience',
      name: 'MCG Delivery & Customer Experience',
      description: 'Last mile delivery performance, shipment tracking, WISMO analysis, order timeline, and address quality impact across all carriers and regions.',
      loadScriptFile: 'app2-delivery-experience.qvs',
      theme: 'MCG Dark Theme',
      dimensions: [
        { name: 'Carrier',              field: '[Carrier]',              tags: ['$ascii', '$text'] },
        { name: 'Carrier (Canonical)',   field: '[Carrier (Canonical)]',  tags: ['$ascii', '$text'] },
        { name: 'Country',              field: '[Country]',              tags: ['$ascii', '$text'] },
        { name: 'Region',               field: '[Region]',               tags: ['$ascii', '$text'] },
        { name: 'City',                 field: '[City]',                 tags: ['$ascii', '$text'] },
        { name: 'Shipment Status',      field: '[Shipment Status]',      tags: ['$ascii', '$text'] },
        { name: 'Status (Canonical)',    field: '[Status (Canonical)]',   tags: ['$ascii', '$text'] },
        { name: 'Exception Code',       field: '[Exception Code]',       tags: ['$ascii', '$text'] },
        { name: 'Customer Name',        field: '[Customer Name]',        tags: ['$ascii', '$text'] },
        { name: 'Customer Region',      field: '[Customer Region]',      tags: ['$ascii', '$text'] },
        { name: 'Customer City',        field: '[Customer City]',        tags: ['$ascii', '$text'] },
        { name: 'Timeline Carrier',     field: '[Timeline Carrier]',     tags: ['$ascii', '$text'] },
        { name: 'Timeline Region',      field: '[Timeline Region]',      tags: ['$ascii', '$text'] },
        { name: 'Timeline Country',     field: '[Timeline Country]',     tags: ['$ascii', '$text'] },
        { name: 'Date',                 field: '[Date]',                 tags: ['$date'] },
        { name: 'Month',                field: '[Month Name]',           tags: ['$ascii', '$text'] },
        { name: 'Quarter',              field: '[Quarter]',              tags: ['$ascii', '$text'] },
      ],
      measures: [
        { name: 'On-Time %',                  expression: 'Avg([On-Time Flag])',                                    format: '#,##0.0%',  label: 'On-Time Delivery Rate' },
        { name: 'SLA Met %',                  expression: 'Avg([SLA Met])',                                         format: '#,##0.0%',  label: 'SLA Compliance Rate' },
        { name: 'Avg SLA Actual (hrs)',        expression: 'Avg([SLA Actual (hrs)])',                                format: '#,##0.0',   label: 'Avg Delivery Time (hrs)' },
        { name: 'SLA Target (hrs)',            expression: 'Avg([SLA Target (hrs)])',                                format: '#,##0.0',   label: 'Avg SLA Target (hrs)' },
        { name: 'Delivery Attempts (avg)',     expression: 'Avg([Delivery Attempts])',                               format: '#,##0.0',   label: 'Avg Delivery Attempts' },
        { name: 'Failed Deliveries',           expression: 'Sum({<[On-Time Flag]={0}>} 1)',                          format: '#,##0',     label: 'Failed Deliveries' },
        { name: 'Address Quality Score',       expression: 'Avg([Address Quality Score])',                           format: '#,##0.0',   label: 'Avg Address Quality Score' },
        { name: 'Addr Quality Score (CX)',     expression: 'Avg([Addr Quality Score])',                              format: '#,##0.0',   label: 'Customer Address Quality' },
        { name: 'WISMO Count',                 expression: 'Sum([WISMO Count])',                                     format: '#,##0',     label: 'Total WISMO Inquiries' },
        { name: 'WISMO Rate',                  expression: 'Avg([WISMO Rate])',                                      format: '#,##0.0%',  label: 'WISMO Rate' },
        { name: 'Lifetime Value ($)',          expression: 'Sum([Lifetime Value ($)])',                              format: '$#,##0',    label: 'Customer Lifetime Value' },
        { name: 'LM Trust Score',              expression: 'Avg([LM Trust Score])',                                  format: '#,##0.00',  label: 'Last Mile Trust Score' },
        { name: 'Order-to-Pick (hrs)',         expression: 'Avg([Order-to-Pick (hrs)])',                             format: '#,##0.0',   label: 'Avg Order-to-Pick Time' },
        { name: 'Pick-to-Ship (hrs)',          expression: 'Avg([Pick-to-Ship (hrs)])',                              format: '#,##0.0',   label: 'Avg Pick-to-Ship Time' },
        { name: 'Ship-to-Deliver (hrs)',       expression: 'Avg([Ship-to-Deliver (hrs)])',                           format: '#,##0.0',   label: 'Avg Ship-to-Deliver Time' },
        { name: 'End-to-End (hrs)',            expression: 'Avg([End-to-End (hrs)])',                                format: '#,##0.0',   label: 'Avg End-to-End Time' },
        { name: 'Total Shipments',             expression: 'Count(DISTINCT [Shipment ID])',                          format: '#,##0',     label: 'Total Shipments' },
        { name: 'Total Orders',                expression: 'Sum([Total Orders])',                                    format: '#,##0',     label: 'Total Orders' },
      ],
      sheets: [
        {
          id: 'sheet-last-mile',
          title: 'Last Mile Performance',
          description: 'Carrier on-time rates, SLA comparison, regional performance, and delivery attempt analysis.',
          objects: [
            { type: 'kpi',      title: 'On-Time Delivery Rate',    measure: 'On-Time %' },
            { type: 'kpi',      title: 'Average Delivery Time',    measure: 'Avg SLA Actual (hrs)' },
            { type: 'kpi',      title: 'Total Shipments',          measure: 'Total Shipments' },
            { type: 'kpi',      title: 'Address Quality Score',    measure: 'Address Quality Score' },
            { type: 'barchart', title: 'On-Time Delivery % by Carrier',  dimension: 'Carrier (Canonical)', measure: 'On-Time %' },
            { type: 'barchart', title: 'Carrier SLA Comparison (Hours)', dimension: 'Carrier (Canonical)', measures: ['SLA Target (hrs)', 'Avg SLA Actual (hrs)'] },
            { type: 'barchart', title: 'On-Time Delivery by Region',     dimension: 'Region', measure: 'On-Time %' },
            { type: 'barchart', title: 'Failed Delivery Attempts',       dimension: 'Carrier (Canonical)', measure: 'Failed Deliveries' },
          ],
        },
        {
          id: 'sheet-shipment-tracking',
          title: 'Live Shipment Tracking',
          description: 'Real-time shipment status feed, carrier pipeline view, and exception monitoring.',
          objects: [
            { type: 'kpi',      title: 'In Transit',                measure: 'Total Shipments', description: 'Filter: Status = IN_TRANSIT' },
            { type: 'kpi',      title: 'Out for Delivery',          measure: 'Total Shipments', description: 'Filter: Status = OUT_FOR_DELIVERY' },
            { type: 'kpi',      title: 'Delivered Today',           measure: 'Total Shipments', description: 'Filter: Status = DELIVERED' },
            { type: 'kpi',      title: 'Exceptions',                measure: 'Failed Deliveries' },
            { type: 'table',    title: 'Live Shipment Status Feed', dimensions: ['Carrier (Canonical)', 'Status (Canonical)', 'Region'], measures: ['Avg SLA Actual (hrs)', 'LM Trust Score'] },
            { type: 'barchart', title: 'Shipment Status Pipeline',  dimension: 'Status (Canonical)', measure: 'Total Shipments' },
            { type: 'table',    title: 'Exception Monitor',         dimensions: ['Exception Code', 'Carrier (Canonical)', 'Region'], measures: ['Failed Deliveries'] },
          ],
        },
        {
          id: 'sheet-wismo',
          title: 'WISMO & Customer Impact',
          description: 'Where Is My Order analysis — WISMO rates by carrier and region, trend analysis, and high-WISMO hotspots.',
          objects: [
            { type: 'kpi',      title: 'WISMO Rate',                measure: 'WISMO Rate' },
            { type: 'kpi',      title: 'Total WISMO Inquiries',     measure: 'WISMO Count' },
            { type: 'kpi',      title: 'Customer Lifetime Value',   measure: 'Lifetime Value ($)' },
            { type: 'barchart', title: 'WISMO Rate by Carrier',     dimension: 'Carrier (Canonical)', measure: 'WISMO Rate' },
            { type: 'linechart', title: 'WISMO Rate Trend (Monthly)', dimension: 'Month', measure: 'WISMO Rate' },
            { type: 'barchart', title: 'WISMO Rate by Region',      dimension: 'Customer Region', measure: 'WISMO Rate' },
            { type: 'table',    title: 'High-WISMO Carrier-Region Combinations', dimensions: ['Carrier (Canonical)', 'Customer Region'], measures: ['WISMO Rate', 'WISMO Count', 'Total Orders'] },
          ],
        },
        {
          id: 'sheet-order-timeline',
          title: 'Order Timeline Analysis',
          description: 'End-to-end order lifecycle — order-to-pick, pick-to-ship, ship-to-deliver waterfall and SLA breach heatmap.',
          objects: [
            { type: 'kpi',        title: 'Avg End-to-End Time',     measure: 'End-to-End (hrs)' },
            { type: 'kpi',        title: 'SLA Compliance',          measure: 'SLA Met %' },
            { type: 'kpi',        title: 'Avg Order-to-Pick',       measure: 'Order-to-Pick (hrs)' },
            { type: 'waterfallchart', title: 'Order-to-Delivery Timeline Waterfall (Avg Hours)', measures: ['Order-to-Pick (hrs)', 'Pick-to-Ship (hrs)', 'Ship-to-Deliver (hrs)'] },
            { type: 'pivottable', title: 'SLA Breach Rate Heatmap (Carrier x Region)', dimensions: ['Timeline Carrier', 'Timeline Region'], measures: ['SLA Met %'] },
            { type: 'table',      title: 'Late Orders Detail (Sorted by Worst Delta)', dimensions: ['Timeline Carrier', 'Timeline Region', 'Timeline Country'], measures: ['End-to-End (hrs)', 'SLA Met %'] },
          ],
        },
        {
          id: 'sheet-address-quality',
          title: 'Address Quality Impact',
          description: 'Correlation between address quality scores and delivery success rates, hotspot analysis, and carrier breakdown.',
          objects: [
            { type: 'kpi',        title: 'Avg Address Quality',       measure: 'Addr Quality Score (CX)' },
            { type: 'kpi',        title: 'Address-Related Failures',  measure: 'Failed Deliveries' },
            { type: 'kpi',        title: 'Truncated Addresses',       measure: 'Total Orders', description: 'Filter: Address Truncated = 1' },
            { type: 'scatterplot', title: 'Delivery Success vs Address Quality Score', dimensions: ['Carrier (Canonical)'], measures: ['Addr Quality Score (CX)', 'On-Time %'] },
            { type: 'histogram',  title: 'Address Quality Score Distribution', dimension: 'Customer Region', measure: 'Addr Quality Score (CX)' },
            { type: 'barchart',   title: 'Address Quality Hotspots by Region', dimension: 'Customer Region', measure: 'Addr Quality Score (CX)' },
            { type: 'barchart',   title: 'Address Quality vs Delivery Success by Carrier', dimension: 'Carrier (Canonical)', measures: ['Addr Quality Score (CX)', 'On-Time %'] },
          ],
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
//  QlikAppBuilder  (main class)
// ---------------------------------------------------------------------------

class QlikAppBuilder {
  /**
   * @param {object} cfg     Full configuration object from config.json
   * @param {Logger} log     Logger instance
   * @param {object} options { dryRun, skipPublish, skipReload, sheetsViaMcp }
   */
  constructor(cfg, log, options = {}) {
    this.cfg     = cfg;
    this.log     = log;
    this.dryRun  = options.dryRun || false;
    this.skipPublish = options.skipPublish || false;
    this.skipReload  = options.skipReload  || false;
    // Default: create the empty app + load script only; sheets and master
    // items are authored via Qlik MCP prompting (deploy/apps/mcp-sheet-prompts.json).
    this.sheetsViaMcp = options.sheetsViaMcp !== false;

    this.baseUrl = `https://${cfg.tenant.hostname}.${cfg.tenant.region}`;
    this._token  = null;

    // Track results for summary
    this.results = { created: 0, failed: 0, skipped: 0, steps: [] };
  }

  // ---- Authentication ---------------------------------------------------

  async authenticate() {
    const method = this.cfg.auth.method;

    if (method === 'apikey') {
      this._token = this.cfg.auth.apiKey;
      if (!this._token || this._token === 'YOUR_API_KEY_HERE') {
        throw new Error('auth.apiKey is empty or placeholder. Set it in config.json or QLIK_API_KEY.');
      }
      this.log.success(`Authenticated via API key (ends ...${this._token.slice(-6)})`);
      return;
    }

    if (method === 'oauth') {
      const oauth = this.cfg.auth.oauth;
      if (!oauth || !oauth.clientId || !oauth.clientSecret) {
        throw new Error('OAuth client credentials are missing in config.');
      }

      if (this.dryRun) {
        this._token = 'DRY_RUN_TOKEN';
        this.log.success('DRY RUN: Skipped OAuth token request.');
        return;
      }

      const tokenUrl = oauth.tokenUrl || `${this.baseUrl}/oauth/token`;
      this.log.info(`Requesting OAuth M2M token from ${tokenUrl}`);

      const res = await request('POST', tokenUrl, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        rawBody: Buffer.from([
          `grant_type=client_credentials`,
          `client_id=${encodeURIComponent(oauth.clientId)}`,
          `client_secret=${encodeURIComponent(oauth.clientSecret)}`,
        ].join('&'), 'utf-8'),
      });

      if (res.statusCode !== 200) {
        throw new Error(`OAuth token request failed (${res.statusCode}): ${JSON.stringify(res.body)}`);
      }
      this._token = res.body.access_token;
      this.log.success('Authenticated via OAuth M2M token.');
      return;
    }

    throw new Error(`Unknown auth method: "${method}". Use "apikey" or "oauth".`);
  }

  // ---- REST API helpers --------------------------------------------------

  _authHeaders(extra = {}) {
    return {
      Authorization: `Bearer ${this._token}`,
      Accept: 'application/json',
      ...extra,
    };
  }

  async _get(apiPath, query = {}) {
    const qs = new URLSearchParams(query).toString();
    const fullUrl = `${this.baseUrl}${apiPath}${qs ? '?' + qs : ''}`;
    this.log.debug(`GET ${fullUrl}`);
    return request('GET', fullUrl, { headers: this._authHeaders() });
  }

  async _post(apiPath, body, extraHeaders = {}) {
    const fullUrl = `${this.baseUrl}${apiPath}`;
    this.log.debug(`POST ${fullUrl}`);
    return request('POST', fullUrl, { headers: this._authHeaders(extraHeaders), body });
  }

  async _put(apiPath, body, extraHeaders = {}) {
    const fullUrl = `${this.baseUrl}${apiPath}`;
    this.log.debug(`PUT ${fullUrl}`);
    return request('PUT', fullUrl, { headers: this._authHeaders(extraHeaders), body });
  }

  async _delete(apiPath) {
    const fullUrl = `${this.baseUrl}${apiPath}`;
    this.log.debug(`DELETE ${fullUrl}`);
    return request('DELETE', fullUrl, { headers: this._authHeaders() });
  }

  _record(step, status, detail = '') {
    this.results.steps.push({ step, status, detail, timestamp: new Date().toISOString() });
    if (status === 'OK')   this.results.created++;
    if (status === 'FAIL') this.results.failed++;
    if (status === 'SKIP') this.results.skipped++;
  }

  // ---- Space lookup ------------------------------------------------------

  async findSpaceByName(name) {
    const res = await this._get('/api/v1/spaces', { filter: `name eq "${name}"`, limit: 100 });
    if (res.statusCode !== 200) return null;
    const data = res.body.data || res.body;
    if (Array.isArray(data)) {
      return data.find((s) => s.name === name) || null;
    }
    return null;
  }

  // ---- App CRUD (REST API) -----------------------------------------------

  async findAppByName(name, spaceId) {
    const filter = spaceId
      ? `name eq "${name}" and spaceId eq "${spaceId}"`
      : `name eq "${name}"`;
    const res = await this._get('/api/v1/items', { filter, resourceType: 'app', limit: 100 });
    if (res.statusCode !== 200) return null;
    const data = res.body.data || res.body;
    if (Array.isArray(data)) {
      return data.find((a) => a.name === name) || null;
    }
    return null;
  }

  /**
   * Create a new empty app via POST /api/v1/apps.
   */
  async createApp(name, spaceId, description) {
    const existing = await this.findAppByName(name, spaceId);
    if (existing) {
      const appId = existing.resourceId || existing.id;
      this.log.success(`App already exists: "${name}" (${appId}) -- will update in place.`);
      return { id: appId, name, alreadyExisted: true };
    }

    if (this.dryRun) {
      this.log.info(`DRY RUN: Would create app "${name}" in space ${spaceId || 'personal'}`);
      return { id: 'dry-run-app-id', name };
    }

    const payload = {
      attributes: {
        name,
        description: description || '',
        spaceId: spaceId || undefined,
      },
    };

    const res = await this._post('/api/v1/apps', payload);

    if (res.statusCode === 200 || res.statusCode === 201) {
      const appId = res.body.attributes ? res.body.attributes.id : (res.body.id || res.body.appId);
      this.log.success(`Created app "${name}" (${appId})`);
      return { id: appId, name };
    }

    if (res.statusCode === 409) {
      this.log.warn(`App "${name}" was created concurrently.`);
      const found = await this.findAppByName(name, spaceId);
      return { id: found ? (found.resourceId || found.id) : 'unknown', name, alreadyExisted: true };
    }

    throw new Error(`Failed to create app "${name}" (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  /**
   * Set the load script via PUT /api/v1/apps/{appId}/script.
   * Falls back to the alternative endpoint if the primary fails.
   */
  async setLoadScript(appId, scriptContent) {
    if (this.dryRun) {
      this.log.info(`DRY RUN: Would set load script (${scriptContent.length} chars) on app ${appId}`);
      return;
    }

    // Primary endpoint
    let res = await this._put(`/api/v1/apps/${appId}/script`, {
      script: scriptContent,
    });

    // Some Qlik Cloud versions use the newer endpoint
    if (res.statusCode === 404) {
      this.log.debug('Primary script endpoint returned 404; trying alternative endpoint...');
      res = await this._put(`/api/v1/apps/${appId}/data/v1/script`, {
        script: scriptContent,
      });
    }

    if (res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 204) {
      this.log.success(`Load script set (${scriptContent.length} chars)`);
      return;
    }

    throw new Error(`Failed to set load script (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  /**
   * Trigger a data reload via POST /api/v1/reloads.
   */
  async reloadApp(appId) {
    if (this.dryRun) {
      this.log.info(`DRY RUN: Would trigger reload on app ${appId}`);
      return;
    }

    const res = await this._post('/api/v1/reloads', { appId });

    if (res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 202) {
      const reloadId = res.body.id || 'unknown';
      this.log.success(`Reload triggered (id=${reloadId}). Check status in Qlik Cloud.`);
      return res.body;
    }

    throw new Error(`Reload failed (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  /**
   * Publish app to managed space via POST /api/v1/apps/{appId}/publish.
   */
  async publishApp(appId, appName, managedSpaceId) {
    if (this.dryRun) {
      this.log.info(`DRY RUN: Would publish "${appName}" (${appId}) to managed space ${managedSpaceId}`);
      return;
    }

    const res = await this._post(`/api/v1/apps/${appId}/publish`, {
      spaceId: managedSpaceId,
      data: 'source',
    });

    if (res.statusCode === 200 || res.statusCode === 201) {
      const pubId = res.body.attributes ? res.body.attributes.id : res.body.id;
      this.log.success(`Published "${appName}" to managed space (published id: ${pubId})`);
      return res.body;
    }

    if (res.statusCode === 409) {
      this.log.warn(`App "${appName}" may already be published.`);
      return;
    }

    throw new Error(`Publish failed (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  // ---- Theme --------------------------------------------------------

  async findThemeByName(name) {
    const res = await this._get('/api/v1/themes');
    if (res.statusCode !== 200) return null;
    const data = res.body.data || res.body;
    if (Array.isArray(data)) {
      return data.find((t) => t.name === name) || null;
    }
    return null;
  }

  // ---- Engine API (WebSocket JSON-RPC) -----------------------------------
  //
  //  The Qlik Engine API runs over WebSocket at wss://{tenant}/app/{appId}.
  //  We use it for operations the REST API cannot perform:
  //    - Creating master dimensions
  //    - Creating master measures
  //    - Creating sheets and child visualization objects
  //    - Setting app properties (theme)
  //
  //  Protocol: JSON-RPC 1.0 with handle-based object addressing.
  //    Handle -1 = Global
  //    Handle  1 = Doc (after OpenDoc)
  //
  //  If the 'ws' module is not installed we skip these steps and
  //  log instructions for manual creation.
  // -----------------------------------------------------------------------

  /**
   * Open a WebSocket connection to the Engine API for a specific app.
   * Returns { ws, send, close } where send() is an async JSON-RPC caller.
   */
  async openEngineSession(appId) {
    if (!WebSocket) {
      throw new Error('ws module not available');
    }

    if (this.dryRun) {
      this.log.info(`DRY RUN: Would open Engine session for app ${appId}`);
      return null;
    }

    const wsUrl = `wss://${this.cfg.tenant.hostname}.${this.cfg.tenant.region}/app/${appId}`;
    this.log.debug(`Connecting Engine WebSocket: ${wsUrl}`);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, {
        headers: {
          Authorization: `Bearer ${this._token}`,
        },
      });

      let msgId = 0;
      const pending = new Map();

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.id !== undefined && pending.has(msg.id)) {
            const { resolve: res, reject: rej } = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) {
              rej(new Error(`Engine error: ${JSON.stringify(msg.error)}`));
            } else {
              res(msg.result || msg);
            }
          }
        } catch (e) {
          this.log.debug(`Engine WS parse error: ${e.message}`);
        }
      });

      ws.on('error', (err) => {
        this.log.error(`Engine WebSocket error: ${err.message}`);
        reject(err);
      });

      ws.on('open', () => {
        this.log.debug('Engine WebSocket connected.');

        const send = (handle, method, params = []) => {
          return new Promise((res, rej) => {
            const id = ++msgId;
            pending.set(id, { resolve: res, reject: rej });
            const msg = JSON.stringify({
              jsonrpc: '2.0',
              id,
              handle,
              method,
              params,
            });
            this.log.debug(`Engine >> ${method} (handle=${handle}, id=${id})`);
            ws.send(msg);

            // Timeout after 30s
            setTimeout(() => {
              if (pending.has(id)) {
                pending.delete(id);
                rej(new Error(`Engine RPC timeout: ${method}`));
              }
            }, 30000);
          });
        };

        const close = () => {
          return new Promise((res) => {
            ws.on('close', res);
            ws.close();
          });
        };

        resolve({ ws, send, close });
      });

      // Connection timeout
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.terminate();
          reject(new Error(`Engine WebSocket connection timed out for app ${appId}`));
        }
      }, 15000);
    });
  }

  /**
   * Create a master dimension via Engine API.
   */
  async engineCreateDimension(send, docHandle, dim) {
    const prop = {
      qInfo: { qType: 'dimension' },
      qDim: {
        qGrouping: 'N',
        qFieldDefs: [dim.field],
        qFieldLabels: [dim.name],
        title: dim.name,
      },
      qMetaDef: {
        title: dim.name,
        description: dim.description || '',
        tags: dim.tags || [],
      },
    };

    const result = await send(docHandle, 'CreateDimension', [prop]);
    const objId = result && result.qReturn ? result.qReturn.qGenericId : (result && result.qGenericId) || 'unknown';
    this.log.debug(`  Created dimension "${dim.name}" (${objId})`);
    return objId;
  }

  /**
   * Create a master measure via Engine API.
   */
  async engineCreateMeasure(send, docHandle, measure) {
    const prop = {
      qInfo: { qType: 'measure' },
      qMeasure: {
        qLabel: measure.label || measure.name,
        qDef: measure.expression,
        qGrouping: 'N',
        qExpressions: [],
        qActiveExpression: 0,
        isCustomFormatted: !!measure.format,
        numFormatFromTemplate: measure.format || undefined,
      },
      qMetaDef: {
        title: measure.name,
        description: measure.description || '',
        tags: measure.tags || [],
      },
    };

    const result = await send(docHandle, 'CreateMeasure', [prop]);
    const objId = result && result.qReturn ? result.qReturn.qGenericId : (result && result.qGenericId) || 'unknown';
    this.log.debug(`  Created measure "${measure.name}" (${objId})`);
    return objId;
  }

  /**
   * Build a HyperCubeDef from a visualization object definition.
   */
  _buildHyperCubeDef(obj) {
    const dims = [];
    const measures = [];

    // Single or multiple dimensions
    if (obj.dimension) {
      dims.push({
        qDef: { qFieldDefs: [obj.dimension], qFieldLabels: [obj.dimension] },
        qNullSuppression: true,
      });
    }
    if (obj.dimensions) {
      for (const d of obj.dimensions) {
        dims.push({
          qDef: { qFieldDefs: [d], qFieldLabels: [d] },
          qNullSuppression: true,
        });
      }
    }

    // Single or multiple measures
    if (obj.measure) {
      measures.push({
        qDef: { qDef: obj.measure, qLabel: obj.measure },
        qSortBy: { qSortByNumeric: -1 },
      });
    }
    if (obj.measures) {
      for (const m of obj.measures) {
        measures.push({
          qDef: { qDef: m, qLabel: m },
          qSortBy: { qSortByNumeric: -1 },
        });
      }
    }

    return {
      qDimensions: dims,
      qMeasures: measures,
      qInterColumnSortOrder: dims.map((_, i) => i).concat(measures.map((_, i) => dims.length + i)),
      qSuppressZero: false,
      qSuppressMissing: true,
      qInitialDataFetch: [{ qTop: 0, qLeft: 0, qWidth: dims.length + measures.length, qHeight: 500 }],
    };
  }

  /**
   * Map our visualization type names to Qlik Engine object types.
   */
  _mapObjectType(type) {
    const typeMap = {
      'kpi':            'kpi',
      'barchart':       'barchart',
      'linechart':      'linechart',
      'piechart':       'piechart',
      'combochart':     'combochart',
      'scatterplot':    'scatterplot',
      'table':          'table',
      'pivottable':     'pivot-table',
      'map':            'map',
      'waterfallchart': 'waterfallchart',
      'histogram':      'histogram',
      'gauge':          'gauge',
      'treemap':        'treemap',
      'text':           'text-image',
    };
    return typeMap[type] || type;
  }

  /**
   * Create a sheet and its child visualization objects via Engine API.
   */
  async engineCreateSheet(send, docHandle, sheetDef) {
    // Create the sheet object
    const sheetProp = {
      qInfo: { qType: 'sheet' },
      qMetaDef: {
        title: sheetDef.title,
        description: sheetDef.description || '',
      },
      rank: 0,
      thumbnail: { qStaticContentUrlDef: {} },
      columns: 24,
      rows: 12,
      cells: [],
      qChildListDef: {
        qData: { title: '/title', visualization: '/visualization', qInfo: '/qInfo' },
      },
    };

    const sheetResult = await send(docHandle, 'CreateObject', [sheetProp]);
    const sheetHandle = sheetResult && sheetResult.qReturn ? sheetResult.qReturn.qHandle : null;
    const sheetId = sheetResult && sheetResult.qReturn ? sheetResult.qReturn.qGenericId : 'unknown';
    this.log.debug(`  Created sheet "${sheetDef.title}" (${sheetId})`);

    if (!sheetHandle) {
      this.log.warn(`  Could not get handle for sheet "${sheetDef.title}" -- skipping child objects.`);
      return sheetId;
    }

    // Create child objects on the sheet
    const cols = 24;
    let currentRow = 0;

    for (let i = 0; i < sheetDef.objects.length; i++) {
      const obj = sheetDef.objects[i];
      const qType = this._mapObjectType(obj.type);

      // Calculate layout position (simple grid layout)
      let colSpan, rowSpan;
      if (obj.type === 'kpi') {
        // KPIs: divide into equal columns across the top
        const kpiObjects = sheetDef.objects.filter((o) => o.type === 'kpi');
        const kpiIdx = kpiObjects.indexOf(obj);
        colSpan = Math.floor(cols / kpiObjects.length);
        rowSpan = 2;
        if (kpiIdx === 0) currentRow = 0;
      } else if (obj.type === 'table' || obj.type === 'pivottable') {
        colSpan = cols;
        rowSpan = 4;
      } else {
        // Charts: 2 per row, or full width if single
        const chartObjects = sheetDef.objects.filter((o) => o.type !== 'kpi');
        const chartIdx = chartObjects.indexOf(obj);
        const isLastChart = chartIdx === chartObjects.length - 1 && chartIdx % 2 === 0;
        colSpan = isLastChart ? cols : Math.floor(cols / 2);
        rowSpan = 4;
      }

      // Build child object properties
      const childProp = {
        qInfo: { qType },
        qMetaDef: {
          title: obj.title,
          description: obj.description || '',
        },
        visualization: qType,
        title: obj.title,
      };

      // Add HyperCubeDef for chart types
      if (obj.type !== 'map' && (obj.dimension || obj.dimensions || obj.measure || obj.measures)) {
        childProp.qHyperCubeDef = this._buildHyperCubeDef(obj);
      }

      try {
        const childResult = await send(sheetHandle, 'CreateChild', [childProp]);
        const childId = childResult && childResult.qReturn
          ? childResult.qReturn.qGenericId
          : (childResult && childResult.qGenericId) || 'unknown';
        this.log.debug(`    + ${qType}: "${obj.title}" (${childId})`);
      } catch (err) {
        this.log.warn(`    Failed to create ${qType} "${obj.title}": ${err.message}`);
      }
    }

    return sheetId;
  }

  /**
   * Set app-level properties (theme) via Engine API.
   */
  async engineSetAppTheme(send, docHandle, themeId) {
    try {
      // Get current app properties
      const props = await send(docHandle, 'GetAppProperties', []);
      const currentProps = props.qProp || props || {};

      // Set theme
      currentProps.qTheme = themeId;

      await send(docHandle, 'SetAppProperties', [currentProps]);
      this.log.success(`Applied theme "${themeId}" to app.`);
    } catch (err) {
      this.log.warn(`Could not set theme: ${err.message}. Apply manually via App Settings.`);
    }
  }

  /**
   * Save the app via Engine API.
   */
  async engineSaveApp(send, docHandle) {
    try {
      await send(docHandle, 'DoSave', []);
      this.log.success('App saved.');
    } catch (err) {
      this.log.warn(`Save warning: ${err.message}`);
    }
  }

  // ---- High-level build orchestration ------------------------------------

  /**
   * Build a single app from its definition.
   * @param {object} appDef  App definition from getAppDefinitions()
   * @param {string} spaceId Target shared space ID
   * @param {string} managedSpaceId Target managed space ID (for publish)
   * @returns {object} { appId, success }
   */
  async buildApp(appDef, spaceId, managedSpaceId) {
    const totalSteps = 7;
    let stepNum = 0;

    this.log.section(`Building: ${appDef.name}`);

    // --- Step 1: Create app -----------------------------------------------
    stepNum++;
    this.log.step(stepNum, totalSteps, `Creating app "${appDef.name}"`);
    let app;
    try {
      app = await this.createApp(appDef.name, spaceId, appDef.description);
      this._record(`Create "${appDef.name}"`, 'OK', `id=${app.id}`);
    } catch (err) {
      this.log.error(`Failed to create app: ${err.message}`);
      this._record(`Create "${appDef.name}"`, 'FAIL', err.message);
      return { appId: null, success: false };
    }

    const appId = app.id;

    // --- Step 2: Set load script ------------------------------------------
    stepNum++;
    this.log.step(stepNum, totalSteps, 'Setting load script');
    try {
      const scriptFile = path.join(LOAD_SCRIPTS_DIR, appDef.loadScriptFile);
      if (!fs.existsSync(scriptFile)) {
        throw new Error(`Load script not found: ${scriptFile}`);
      }
      const scriptContent = fs.readFileSync(scriptFile, 'utf-8');
      await this.setLoadScript(appId, scriptContent);
      this._record(`Script "${appDef.loadScriptFile}"`, 'OK', `${scriptContent.length} chars`);
    } catch (err) {
      this.log.error(`Failed to set load script: ${err.message}`);
      this._record(`Script "${appDef.loadScriptFile}"`, 'FAIL', err.message);
      // Continue — script can be set manually
    }

    // --- Steps 3-5: Engine API (master items, sheets, theme) --------------
    let engineSession = null;
    const engineAvailable = WebSocket !== null && !this.dryRun;

    if (engineAvailable) {
      stepNum++;
      this.log.step(stepNum, totalSteps, 'Connecting to Engine API (WebSocket)');
      try {
        engineSession = await this.openEngineSession(appId);

        // Open the doc (handle = -1 for Global, OpenDoc returns doc handle)
        const openResult = await engineSession.send(-1, 'OpenDoc', [appId]);
        const docHandle = openResult && openResult.qReturn ? openResult.qReturn.qHandle : 1;
        this.log.debug(`Doc handle: ${docHandle}`);

        if (this.sheetsViaMcp) {
          // Empty-app mode (default): the app carries only the load script
          // mapped to the data products. Sheets and master items are authored
          // conversationally via the Qlik MCP server — copy the prompts from
          // the deploy UI's Build Apps page or deploy/apps/mcp-sheet-prompts.json.
          stepNum += 2;
          this.log.info('Skipping master items and sheets — create them via Qlik MCP prompting');
          this.log.info('  (prompts: deploy/apps/mcp-sheet-prompts.json, or the Build Apps page in the deploy UI)');
          this._record('Sheets', 'SKIP', 'authored via Qlik MCP prompting');
        } else {
          // --- Create master dimensions (legacy builder path) ---
          stepNum++;
          this.log.step(stepNum, totalSteps, `Creating ${appDef.dimensions.length} master dimensions`);
          let dimOk = 0, dimFail = 0;
          for (const dim of appDef.dimensions) {
            try {
              await this.engineCreateDimension(engineSession.send, docHandle, dim);
              dimOk++;
            } catch (err) {
              this.log.debug(`  Dimension "${dim.name}" may already exist: ${err.message}`);
              dimFail++;
            }
          }
          this.log.info(`Dimensions: ${dimOk} created, ${dimFail} skipped/failed`);
          this._record('Master dimensions', dimFail === 0 ? 'OK' : 'OK', `${dimOk} created, ${dimFail} skipped`);

          // --- Create master measures ---
          this.log.step(stepNum, totalSteps, `Creating ${appDef.measures.length} master measures`);
          let measOk = 0, measFail = 0;
          for (const measure of appDef.measures) {
            try {
              await this.engineCreateMeasure(engineSession.send, docHandle, measure);
              measOk++;
            } catch (err) {
              this.log.debug(`  Measure "${measure.name}" may already exist: ${err.message}`);
              measFail++;
            }
          }
          this.log.info(`Measures: ${measOk} created, ${measFail} skipped/failed`);
          this._record('Master measures', measFail === 0 ? 'OK' : 'OK', `${measOk} created, ${measFail} skipped`);

          // --- Create sheets ---
          stepNum++;
          this.log.step(stepNum, totalSteps, `Creating ${appDef.sheets.length} sheets with visualizations`);
          for (const sheet of appDef.sheets) {
            try {
              await this.engineCreateSheet(engineSession.send, docHandle, sheet);
              this.log.success(`  Sheet "${sheet.title}" created with ${sheet.objects.length} objects`);
              this._record(`Sheet "${sheet.title}"`, 'OK', `${sheet.objects.length} objects`);
            } catch (err) {
              this.log.error(`  Sheet "${sheet.title}" failed: ${err.message}`);
              this._record(`Sheet "${sheet.title}"`, 'FAIL', err.message);
            }
          }
        }

        // --- Apply theme ---
        if (appDef.theme) {
          this.log.info(`Applying theme: ${appDef.theme}`);
          const theme = await this.findThemeByName(appDef.theme);
          if (theme) {
            await this.engineSetAppTheme(engineSession.send, docHandle, theme.id || appDef.theme);
            this._record('Apply theme', 'OK', appDef.theme);
          } else {
            this.log.warn(`Theme "${appDef.theme}" not found. Upload it first via deploy-to-qlik.js.`);
            this._record('Apply theme', 'SKIP', 'Theme not found on tenant');
          }
        }

        // --- Save ---
        await this.engineSaveApp(engineSession.send, docHandle);

      } catch (err) {
        this.log.error(`Engine API error: ${err.message}`);
        this._record('Engine API', 'FAIL', err.message);
      } finally {
        if (engineSession) {
          try { await engineSession.close(); } catch (_) {}
          this.log.debug('Engine session closed.');
        }
      }
    } else if (!WebSocket) {
      // No ws module — skip engine steps but advance step counter
      stepNum += 3;
      this.log.warn('ws module not installed. Skipping Engine API steps (master items, sheets, theme).');
      this.log.info('Install it with: npm install ws');
      this.log.info('Then re-run this script to create master dimensions, measures, sheets, and apply theme.');
      this._record('Master dimensions', 'SKIP', 'ws module not installed');
      this._record('Master measures',   'SKIP', 'ws module not installed');
      this._record('Sheets',            'SKIP', 'ws module not installed');
      this._record('Apply theme',       'SKIP', 'ws module not installed');
    } else {
      stepNum += 3;
      this.log.info('DRY RUN: Skipping Engine API steps (master items, sheets, theme).');
      this._record('Master dimensions', 'SKIP', 'Dry run');
      this._record('Master measures',   'SKIP', 'Dry run');
      this._record('Sheets',            'SKIP', 'Dry run');
      this._record('Apply theme',       'SKIP', 'Dry run');
    }

    // --- Step 6: Reload ---------------------------------------------------
    stepNum++;
    this.log.step(stepNum, totalSteps, 'Triggering data reload');
    if (!this.skipReload) {
      try {
        await this.reloadApp(appId);
        this._record('Reload', 'OK', appDef.name);
      } catch (err) {
        this.log.warn(`Reload failed (data connections may not be configured yet): ${err.message}`);
        this._record('Reload', 'SKIP', err.message);
      }
    } else {
      this.log.info('Skipping reload (--skip-reload).');
      this._record('Reload', 'SKIP', 'Skipped by flag');
    }

    // --- Step 7: Publish --------------------------------------------------
    stepNum++;
    this.log.step(stepNum, totalSteps, 'Publishing app');
    if (!this.skipPublish && managedSpaceId) {
      try {
        await this.publishApp(appId, appDef.name, managedSpaceId);
        this._record(`Publish "${appDef.name}"`, 'OK', 'Published to managed space');
      } catch (err) {
        this.log.warn(`Publish failed: ${err.message}`);
        this._record(`Publish "${appDef.name}"`, 'FAIL', err.message);
      }
    } else {
      const reason = this.skipPublish ? 'Skipped by flag' : 'No managed space configured';
      this.log.info(`Skipping publish (${reason}).`);
      this._record(`Publish "${appDef.name}"`, 'SKIP', reason);
    }

    return { appId, success: true };
  }

  // ---- Summary -----------------------------------------------------------

  printSummary() {
    this.log.section('BUILD SUMMARY');

    const maxStep = Math.max(...this.results.steps.map((s) => s.step.length), 10);
    const header = `${'Step'.padEnd(maxStep + 2)}Status     Detail`;
    console.log(header);
    console.log('-'.repeat(header.length + 20));

    for (const s of this.results.steps) {
      const icon = s.status === 'OK' ? '\x1b[32mOK\x1b[0m  '
        : s.status === 'SKIP' ? '\x1b[33mSKIP\x1b[0m'
        : '\x1b[31mFAIL\x1b[0m';
      console.log(`${s.step.padEnd(maxStep + 2)}${icon}       ${s.detail}`);
    }

    console.log('-'.repeat(header.length + 20));
    console.log(
      `Total: ${this.results.steps.length} steps | ` +
      `\x1b[32mOK: ${this.results.created}\x1b[0m | ` +
      `\x1b[31mFailed: ${this.results.failed}\x1b[0m | ` +
      `\x1b[33mSkipped: ${this.results.skipped}\x1b[0m`
    );
    console.log('');

    return this.results.failed;
  }

  /**
   * Print manual steps that must be completed after the build.
   */
  printPostBuildChecklist() {
    this.log.section('POST-BUILD CHECKLIST');
    const items = [
      'Verify data connections are configured (PostgreSQL, Salesforce, Kafka, S3)',
      'Test a manual reload in each app to confirm data loads',
      'Set up scheduled reloads (every 15 min for Supply Chain, 30 min for Delivery)',
      'Apply MCG Dark Theme if not auto-applied (App Settings > Theme)',
      'Review sheet layouts and adjust object sizes as needed',
      'Configure filter panes for Distribution Center, Region, Carrier, Date',
      'Enable Qlik Answers Business Logic in each app',
      'Publish apps from Development space to Published space',
      'Configure Qlik AutoML experiments (Spoilage Risk, SLA Prediction)',
      'Set up alerting automations for critical KPI thresholds',
    ];

    if (!WebSocket) {
      items.unshift(
        'Install ws: npm install ws',
        'Re-run build-apps.js to create master dimensions, measures, and sheets'
      );
    }

    let idx = 1;
    for (const item of items) {
      console.log(`  ${String(idx).padStart(2)}. [ ] ${item}`);
      idx++;
    }
    console.log('');
  }
}

// ---------------------------------------------------------------------------
//  Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  const log  = new Logger(args.verbose);

  log.section('MCG App Builder — Qlik Cloud');
  log.info(`Config:       ${args.configPath}`);
  log.info(`Dry run:      ${args.dryRun}`);
  log.info(`App filter:   ${args.appFilter || '(all apps)'}`);
  log.info(`Skip publish: ${args.skipPublish}`);
  log.info(`Skip reload:  ${args.skipReload}`);
  log.info(`Engine API:   ${WebSocket ? 'ws module available' : 'ws module NOT installed — Engine steps will be skipped'}`);

  // ---- Load config -------------------------------------------------------
  let cfg;
  try {
    cfg = loadConfig(args.configPath);
    applyEnvOverrides(cfg);
  } catch (err) {
    log.error(err.message);
    process.exit(EXIT_FAILURE);
  }

  const builder = new QlikAppBuilder(cfg, log, {
    dryRun:      args.dryRun,
    skipPublish: args.skipPublish,
    skipReload:  args.skipReload,
    sheetsViaMcp: args.buildSheets ? false : ((cfg.apps && cfg.apps.sheetsViaMcp) !== false),
  });

  log.info(`Target: ${builder.baseUrl}`);
  if (args.dryRun) log.warn('DRY RUN MODE — no changes will be made to Qlik Cloud.');

  // ---- Authenticate ------------------------------------------------------
  log.section('Authentication');
  try {
    await builder.authenticate();

    // Verify connection
    if (!args.dryRun) {
      const res = await builder._get('/api/v1/users/me');
      if (res.statusCode === 200) {
        const name = res.body.name || res.body.subject || 'unknown';
        log.success(`Connected as: ${name}`);
      } else {
        throw new Error(`Connection check failed (${res.statusCode})`);
      }
    }
    builder._record('Authentication', 'OK', `method=${cfg.auth.method}`);
  } catch (err) {
    log.error(`Authentication failed: ${err.message}`);
    builder._record('Authentication', 'FAIL', err.message);
    builder.printSummary();
    process.exit(EXIT_FAILURE);
  }

  // ---- Resolve spaces ----------------------------------------------------
  log.section('Resolving Spaces');
  let sharedSpaceId  = null;
  let managedSpaceId = null;

  try {
    const sharedName  = (cfg.spaces && cfg.spaces.shared)  || 'MCG Demo - Development';
    const managedName = (cfg.spaces && cfg.spaces.managed) || 'MCG Demo - Published';

    if (!args.dryRun) {
      const shared = await builder.findSpaceByName(sharedName);
      if (shared) {
        sharedSpaceId = shared.id;
        log.success(`Shared space: "${sharedName}" (${shared.id})`);
      } else {
        log.warn(`Shared space "${sharedName}" not found. Apps will be created in personal space.`);
      }

      if (!args.skipPublish) {
        const managed = await builder.findSpaceByName(managedName);
        if (managed) {
          managedSpaceId = managed.id;
          log.success(`Managed space: "${managedName}" (${managed.id})`);
        } else {
          log.warn(`Managed space "${managedName}" not found. Publishing will be skipped.`);
        }
      }
    } else {
      log.info(`DRY RUN: Would use shared space "${sharedName}", managed space "${managedName}"`);
      sharedSpaceId  = 'dry-run-shared-id';
      managedSpaceId = 'dry-run-managed-id';
    }
  } catch (err) {
    log.warn(`Space resolution error: ${err.message}`);
  }

  // ---- Load app definitions -----------------------------------------------
  const allApps = getAppDefinitions();
  log.info(`Loaded ${allApps.length} app definition(s).`);

  // Filter if --app flag is set
  const apps = args.appFilter
    ? allApps.filter((a) => a.name.toLowerCase().includes(args.appFilter.toLowerCase()) ||
                            a.id.toLowerCase().includes(args.appFilter.toLowerCase()))
    : allApps;

  if (apps.length === 0) {
    log.error(`No apps match filter "${args.appFilter}". Available: ${allApps.map((a) => a.name).join(', ')}`);
    process.exit(EXIT_FAILURE);
  }

  log.info(`Building ${apps.length} app(s): ${apps.map((a) => a.name).join(', ')}`);

  // ---- Build each app ----------------------------------------------------
  for (const appDef of apps) {
    try {
      await builder.buildApp(appDef, sharedSpaceId, managedSpaceId);
    } catch (err) {
      log.error(`Unexpected error building "${appDef.name}": ${err.message}`);
      builder._record(`Build "${appDef.name}"`, 'FAIL', err.message);
    }
  }

  // ---- Summary -----------------------------------------------------------
  const failCount = builder.printSummary();
  builder.printPostBuildChecklist();

  process.exit(failCount > 0 ? EXIT_FAILURE : EXIT_SUCCESS);
}

// ---------------------------------------------------------------------------
//  Module exports (for deploy UI integration)
// ---------------------------------------------------------------------------

module.exports = { QlikAppBuilder, getAppDefinitions };

// ---------------------------------------------------------------------------
//  Run if executed directly
// ---------------------------------------------------------------------------

if (require.main === module) {
  main().catch((err) => {
    console.error(`\x1b[31mFATAL: ${err.message}\x1b[0m`);
    if (err.stack) console.error(err.stack);
    process.exit(EXIT_FAILURE);
  });
}
