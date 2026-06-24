#!/usr/bin/env node
// ---------------------------------------------------------------------------
//  build-automations.js
//  Creates MCG Qlik Cloud automations from definitions via REST API.
//
//  Creates automation shells and logs block configuration for manual setup
//  in the Qlik Cloud Automation Designer.
//
//  Usage:
//    node deploy/build-automations.js                          # build all
//    node deploy/build-automations.js --dry-run                # preview
//    node deploy/build-automations.js --automation "Cold Chain" # one only
//    node deploy/build-automations.js --verbose                # detailed
//    node deploy/build-automations.js --config ./my-config.json
//    node deploy/build-automations.js --help
//
//  Dependencies:  None (zero-dependency, uses built-in Node.js modules)
// ---------------------------------------------------------------------------

'use strict';

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

const SCRIPT_DIR  = __dirname;
const PROJECT_DIR = path.resolve(SCRIPT_DIR, '..');

const DEFAULT_CONFIG_PATH = path.join(SCRIPT_DIR, 'config.json');
const AUTO_DEFS_PATH      = path.join(SCRIPT_DIR, 'automations', 'automation-definitions.json');

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

// ---------------------------------------------------------------------------
//  CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    configPath:       DEFAULT_CONFIG_PATH,
    dryRun:           false,
    verbose:          false,
    automationFilter: null,
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
      case '--automation':
        args.automationFilter = argv[++i];
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
Usage: node build-automations.js [OPTIONS]

Options:
  --config <path>        Path to config JSON (default: deploy/config.json)
  --dry-run              Preview actions without making API calls
  --verbose              Enable detailed logging
  --automation <name>    Build only the automation matching this substring
  --help                 Show this message

Examples:
  node deploy/build-automations.js --dry-run
  node deploy/build-automations.js --automation "Cold Chain" --verbose
  node deploy/build-automations.js --config ./my-config.json
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
//  Configuration loader
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
//  HTTP client  (zero-dependency, with retry)
// ---------------------------------------------------------------------------

function requestOnce(method, reqUrl, { headers = {}, body = null, timeout = 60000 } = {}) {
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

    let payload = null;
    if (body) {
      payload = JSON.stringify(body);
      opts.headers['Content-Type']   = opts.headers['Content-Type'] || 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = transport.request(opts, (res) => {
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
//  Automation Definitions loader
// ---------------------------------------------------------------------------

function getAutomationDefinitions() {
  if (!fs.existsSync(AUTO_DEFS_PATH)) {
    throw new Error(`Automation definitions not found: ${AUTO_DEFS_PATH}`);
  }
  const raw = JSON.parse(fs.readFileSync(AUTO_DEFS_PATH, 'utf-8'));
  return raw.automations || [];
}

// ---------------------------------------------------------------------------
//  QlikAutomationBuilder class
// ---------------------------------------------------------------------------

class QlikAutomationBuilder {
  constructor(cfg, log, options = {}) {
    this.cfg     = cfg;
    this.log     = log;
    this.dryRun  = options.dryRun || false;
    this.baseUrl = `https://${cfg.tenant.hostname}.${cfg.tenant.region}`;
    this._token  = null;
    this.results = { created: 0, skipped: 0, failed: 0, steps: [] };
  }

  // -------------------------------------------------------------------------
  //  Authentication
  // -------------------------------------------------------------------------

  async authenticate() {
    const auth = this.cfg.auth;
    if (!auth) throw new Error('No auth config found.');

    const method = auth.method || 'apikey';

    if (method === 'apikey') {
      if (!auth.apiKey) throw new Error('auth.apiKey is required for apikey method.');
      this._token = auth.apiKey;
      this.log.success(`Authenticated via API key (last 4: ...${auth.apiKey.slice(-4)})`);
    } else if (method === 'oauth') {
      if (!auth.oauthClientId || !auth.oauthClientSecret) {
        throw new Error('auth.oauthClientId and auth.oauthClientSecret are required for oauth method.');
      }
      const tokenUrl = `${this.baseUrl}/oauth/token`;
      this.log.debug(`Requesting OAuth token from ${tokenUrl}`);
      const res = await requestOnce('POST', tokenUrl, {
        headers: { 'Content-Type': 'application/json' },
        body: {
          client_id:     auth.oauthClientId,
          client_secret: auth.oauthClientSecret,
          grant_type:    'client_credentials',
        },
      });
      if (res.statusCode !== 200) {
        throw new Error(`OAuth failed (${res.statusCode}): ${JSON.stringify(res.body)}`);
      }
      this._token = res.body.access_token;
      this.log.success('Authenticated via OAuth M2M (client_credentials)');
    } else {
      throw new Error(`Unknown auth method: ${method}`);
    }
  }

  // -------------------------------------------------------------------------
  //  REST helpers
  // -------------------------------------------------------------------------

  _authHeaders(extra = {}) {
    const h = { Authorization: `Bearer ${this._token}`, ...extra };
    return h;
  }

  async _get(apiPath, query = {}) {
    const url = new URL(apiPath, this.baseUrl);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    return request('GET', url.toString(), { headers: this._authHeaders() });
  }

  async _post(apiPath, body, extraHeaders = {}) {
    const url = new URL(apiPath, this.baseUrl);
    return request('POST', url.toString(), { headers: this._authHeaders(extraHeaders), body });
  }

  async _put(apiPath, body, extraHeaders = {}) {
    const url = new URL(apiPath, this.baseUrl);
    return request('PUT', url.toString(), { headers: this._authHeaders(extraHeaders), body });
  }

  _record(step, status, detail = '') {
    this.results.steps.push({ step, status, detail });
    if (status === 'OK')   this.results.created++;
    if (status === 'SKIP') this.results.skipped++;
    if (status === 'FAIL') this.results.failed++;
  }

  // -------------------------------------------------------------------------
  //  Space lookup
  // -------------------------------------------------------------------------

  async findSpaceByName(name) {
    const res = await this._get('/api/v1/spaces', { name, limit: '10' });
    if (res.statusCode === 200 && res.body.data) {
      return res.body.data.find((s) => s.name === name) || null;
    }
    return null;
  }

  // -------------------------------------------------------------------------
  //  Automation API methods
  // -------------------------------------------------------------------------

  async findAutomationByName(name) {
    // Page through all automations — a single capped page could miss the target
    // on a tenant with >100 automations and create a duplicate on re-run.
    let url = null;
    let first = true;
    while (first || url) {
      const res = first
        ? await this._get('/api/v1/automations', { limit: '100' })
        : await request('GET', url, { headers: this._authHeaders() });
      first = false;
      if (res.statusCode !== 200) return null;
      const items = res.body.data || (Array.isArray(res.body) ? res.body : []);
      const hit = items.find((a) => a.name === name);
      if (hit) return hit;
      const href = res.body.links && res.body.links.next && res.body.links.next.href;
      url = href ? (href.startsWith('http') ? href : new URL(href, this.baseUrl).toString()) : null;
    }
    return null;
  }

  async createAutomation(autoDef, spaceId) {
    const name = autoDef.name;
    const description = autoDef.description;
    const log = this.log;

    // Check if already exists
    if (!this.dryRun) {
      const existing = await this.findAutomationByName(name);
      if (existing) {
        log.success(`Automation already exists: "${name}" (${existing.id})`);
        this._record(`Automation: ${name}`, 'SKIP', `Already exists (${existing.id})`);
        return existing;
      }
    }

    // Dry run
    if (this.dryRun) {
      log.info(`DRY RUN: Would create automation "${name}"`);
      log.info(`  Description: ${description}`);
      log.info(`  Trigger: ${autoDef.trigger.type} — ${autoDef.trigger.schedule || 'event-based'}`);
      log.info(`  Blocks: ${autoDef.blocks.length} steps`);
      log.info(`  State: ${autoDef.state}`);
      if (autoDef.variables && autoDef.variables.length > 0) {
        log.info(`  Variables: ${autoDef.variables.join(', ')}`);
      }
      this._record(`Automation: ${name}`, 'OK', 'DRY RUN');
      return { id: 'dry-run-auto-id', name };
    }

    // Create the automation via API
    const payload = {
      name,
      description,
      state: autoDef.state || 'disabled',
    };
    if (spaceId) payload.spaceId = spaceId;

    log.debug(`POST /api/v1/automations — ${JSON.stringify(payload)}`);
    const res = await this._post('/api/v1/automations', payload);

    if (res.statusCode === 200 || res.statusCode === 201) {
      log.success(`Created automation "${name}" (${res.body.id})`);
      this._record(`Automation: ${name}`, 'OK', `Created (${res.body.id})`);
      return res.body;
    }

    const errMsg = `Failed to create automation "${name}" (${res.statusCode}): ${JSON.stringify(res.body)}`;
    log.error(errMsg);
    this._record(`Automation: ${name}`, 'FAIL', errMsg);
    throw new Error(errMsg);
  }

  // -------------------------------------------------------------------------
  //  Build a single automation
  // -------------------------------------------------------------------------

  async buildAutomation(autoDef, spaceId) {
    const log = this.log;

    log.section(`Automation: ${autoDef.name}`);
    log.info(`ID:          ${autoDef.id}`);
    log.info(`Description: ${autoDef.description}`);
    log.info(`Trigger:     ${autoDef.trigger.type} — ${autoDef.trigger.schedule || 'event-based'} (${autoDef.trigger.description})`);
    log.info(`Blocks:      ${autoDef.blocks.length} steps`);
    log.info(`State:       ${autoDef.state}`);

    // Step 1: Create the automation shell
    const auto = await this.createAutomation(autoDef, spaceId);

    // Step 2: Log block configuration reference
    this.logBlockDetails(autoDef);

    // Step 3: Log setup instructions
    this.logSetupInstructions(autoDef);

    // Step 4: Log variables
    if (autoDef.variables && autoDef.variables.length > 0) {
      log.info('');
      log.info(`Variables to configure in Automation Designer:`);
      for (const v of autoDef.variables) {
        log.info(`  • ${v}`);
      }
    }

    return auto;
  }

  logBlockDetails(autoDef) {
    const log = this.log;
    log.info('');
    log.info('Block Configuration Reference:');
    log.info('─'.repeat(50));

    for (const block of autoDef.blocks) {
      const typeLabel = block.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      log.info(`  Step ${block.step}: [${typeLabel}] ${block.description}`);

      if (log.verbose && block.config) {
        const cfg = block.config;
        if (cfg.endpoint)     log.debug(`    Endpoint: ${cfg.endpoint}`);
        if (cfg.dataProduct)  log.debug(`    Data Product: ${cfg.dataProduct}`);
        if (cfg.filter)       log.debug(`    Filter: ${cfg.filter}`);
        if (cfg.condition)    log.debug(`    Condition: ${cfg.condition}`);
        if (cfg.iterateOver)  log.debug(`    Iterate Over: ${cfg.iterateOver}`);
        if (cfg.action)       log.debug(`    Action: ${cfg.action}`);
        if (cfg.channel)      log.debug(`    Channel: ${cfg.channel}`);
        if (cfg.method)       log.debug(`    HTTP Method: ${cfg.method}`);
        if (cfg.url)          log.debug(`    URL: ${cfg.url}`);
        if (cfg.schedule)     log.debug(`    Schedule: ${cfg.schedule}`);
        if (cfg.aggregation)  log.debug(`    Aggregation: ${JSON.stringify(cfg.aggregation)}`);
      }
    }
    log.info('─'.repeat(50));
  }

  logSetupInstructions(autoDef) {
    if (!autoDef.setupInstructions) return;
    const log = this.log;

    if (autoDef.setupInstructions.prerequisites && autoDef.setupInstructions.prerequisites.length > 0) {
      log.info('');
      log.info('Prerequisites:');
      for (const p of autoDef.setupInstructions.prerequisites) {
        log.info(`  ✓ ${p}`);
      }
    }

    if (autoDef.setupInstructions.buildSteps && autoDef.setupInstructions.buildSteps.length > 0) {
      log.info('');
      log.info('Manual Setup Steps (Automation Designer):');
      for (const s of autoDef.setupInstructions.buildSteps) {
        log.info(`  ${s}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  //  Summary
  // -------------------------------------------------------------------------

  printSummary() {
    const log = this.log;
    log.section('Summary');

    const maxStepLen = Math.max(...this.results.steps.map(s => s.step.length), 10);

    for (const s of this.results.steps) {
      const padded = s.step.padEnd(maxStepLen);
      let color;
      switch (s.status) {
        case 'OK':   color = '\x1b[32m'; break;
        case 'SKIP': color = '\x1b[33m'; break;
        case 'FAIL': color = '\x1b[31m'; break;
        default:     color = '\x1b[90m';
      }
      const detail = s.detail ? ` — ${s.detail}` : '';
      console.log(`  ${padded}  ${color}${s.status}\x1b[0m${detail}`);
    }

    console.log('');
    log.info(`Created: ${this.results.created}  |  Skipped: ${this.results.skipped}  |  Failed: ${this.results.failed}`);

    return this.results.failed;
  }

  printPostBuildChecklist() {
    const log = this.log;

    log.section('Post-Build Checklist');
    log.info('Automations are created in DISABLED state. Complete these steps:');
    log.info('');
    log.info('  1. Open each automation in Qlik Cloud > Automations');
    log.info('  2. Configure block details per the logged reference above');
    log.info('  3. For Teams automations: Connect Microsoft Teams connector (OAuth)');
    log.info('  4. Set Teams webhook URL or connector for each channel');
    log.info('  5. For Talend automation: Set Talend Cloud API credentials');
    log.info('  6. Configure variables (tenant_url, app IDs, etc.)');
    log.info('  7. Test each automation with "Run Now"');
    log.info('  8. Enable scheduled triggers when ready');
    log.info('');
    log.info('Documentation: See MCG_Creation_Guide_Automations_Pipelines.docx');
  }
}

// ---------------------------------------------------------------------------
//  Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  const log  = new Logger(args.verbose);

  log.section('MCG Automation Builder — Qlik Cloud');
  log.info(`Config:       ${args.configPath}`);
  log.info(`Dry run:      ${args.dryRun}`);
  log.info(`Filter:       ${args.automationFilter || '(all automations)'}`);

  // Load config
  let cfg;
  try {
    cfg = loadConfig(args.configPath);
    applyEnvOverrides(cfg);
  } catch (err) {
    log.error(err.message);
    process.exit(EXIT_FAILURE);
  }

  const builder = new QlikAutomationBuilder(cfg, log, { dryRun: args.dryRun });

  log.info(`Target:       ${builder.baseUrl}`);
  if (args.dryRun) log.warn('DRY RUN MODE — no changes will be made to Qlik Cloud.');

  // Authenticate
  log.section('Authentication');
  try {
    if (!args.dryRun) {
      await builder.authenticate();
      const res = await builder._get('/api/v1/users/me');
      if (res.statusCode === 200) {
        log.success(`Connected as: ${res.body.name || res.body.subject || 'unknown'}`);
      } else {
        throw new Error(`Connection check failed (${res.statusCode})`);
      }
    } else {
      log.info('DRY RUN: Skipping authentication.');
    }
    builder._record('Authentication', 'OK', `method=${(cfg.auth && cfg.auth.method) || 'apikey'}`);
  } catch (err) {
    log.error(`Authentication failed: ${err.message}`);
    builder._record('Authentication', 'FAIL', err.message);
    builder.printSummary();
    process.exit(EXIT_FAILURE);
  }

  // Resolve space
  log.section('Resolving Spaces');
  let spaceId = null;
  try {
    const spaceName = (cfg.spaces && cfg.spaces.shared) || 'MCG Demo - Development';
    if (!args.dryRun) {
      const space = await builder.findSpaceByName(spaceName);
      if (space) {
        spaceId = space.id;
        log.success(`Space: "${spaceName}" (${space.id})`);
      } else {
        log.warn(`Space "${spaceName}" not found. Automations will be created in personal space.`);
      }
    } else {
      log.info(`DRY RUN: Would use space "${spaceName}"`);
      spaceId = 'dry-run-space-id';
    }
    builder._record('Space Resolution', 'OK', spaceName);
  } catch (err) {
    log.warn(`Space resolution error: ${err.message}`);
    builder._record('Space Resolution', 'SKIP', err.message);
  }

  // Load automation definitions
  log.section('Loading Automation Definitions');
  let allAutos;
  try {
    allAutos = getAutomationDefinitions();
    log.info(`Loaded ${allAutos.length} automation definition(s) from:`);
    log.info(`  ${AUTO_DEFS_PATH}`);
  } catch (err) {
    log.error(err.message);
    builder._record('Load Definitions', 'FAIL', err.message);
    builder.printSummary();
    process.exit(EXIT_FAILURE);
  }

  // Filter if needed
  const autos = args.automationFilter
    ? allAutos.filter(a =>
        a.name.toLowerCase().includes(args.automationFilter.toLowerCase()) ||
        a.id.toLowerCase().includes(args.automationFilter.toLowerCase())
      )
    : allAutos;

  if (autos.length === 0) {
    log.error(`No automations match filter "${args.automationFilter}".`);
    log.info(`Available automations: ${allAutos.map(a => a.name).join(', ')}`);
    process.exit(EXIT_FAILURE);
  }

  log.info(`Building ${autos.length} automation(s):`);
  for (const a of autos) {
    log.info(`  • ${a.name} (${a.trigger.schedule || a.trigger.type})`);
  }

  // Build each automation
  for (let i = 0; i < autos.length; i++) {
    const autoDef = autos[i];
    try {
      log.step(i + 1, autos.length, `Building: ${autoDef.name}`);
      await builder.buildAutomation(autoDef, spaceId);
    } catch (err) {
      log.error(`Error building "${autoDef.name}": ${err.message}`);
      builder._record(`Automation: ${autoDef.name}`, 'FAIL', err.message);
    }
  }

  // Summary and checklist
  const failCount = builder.printSummary();
  builder.printPostBuildChecklist();

  process.exit(failCount > 0 ? EXIT_FAILURE : EXIT_SUCCESS);
}

// ---------------------------------------------------------------------------
//  Module exports  (for use from deploy-ui.js)
// ---------------------------------------------------------------------------

module.exports = { QlikAutomationBuilder, getAutomationDefinitions };

// ---------------------------------------------------------------------------
//  Run if invoked directly
// ---------------------------------------------------------------------------

if (require.main === module) {
  main().catch((err) => {
    console.error(`\x1b[31mFATAL: ${err.message}\x1b[0m`);
    if (err.stack) console.error(err.stack);
    process.exit(EXIT_FAILURE);
  });
}
