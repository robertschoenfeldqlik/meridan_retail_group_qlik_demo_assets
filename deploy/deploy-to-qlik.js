#!/usr/bin/env node
// ---------------------------------------------------------------------------
//  deploy-to-qlik.js
//  Qlik Cloud deployment automation for the Meridian Commerce Group demo.
//
//  Usage:
//    node deploy/deploy-to-qlik.js                       # uses deploy/config.json
//    node deploy/deploy-to-qlik.js --config ./my.json    # custom config path
//    node deploy/deploy-to-qlik.js --dry-run             # preview without changes
//    node deploy/deploy-to-qlik.js --verbose             # extra logging
//    node deploy/deploy-to-qlik.js --export-pipeline     # pull the tenant's declarative
//                                                        # pipeline project back into the repo
//
//  Environment variable overrides (take precedence over config.json):
//    QLIK_TENANT_HOST   — tenant hostname  (e.g. "my-tenant")
//    QLIK_REGION        — region           (e.g. "us.qlikcloud.com")
//    QLIK_API_KEY       — API key
//    QLIK_AUTH_METHOD   — "apikey" | "oauth"
//    QLIK_OAUTH_CLIENT_ID / QLIK_OAUTH_CLIENT_SECRET / QLIK_OAUTH_TOKEN_URL
// ---------------------------------------------------------------------------

'use strict';

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');
const { spawn, spawnSync } = require('child_process');
const { zipDirectory, unzipToDirectory } = require('./zip-utils');

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

const SCRIPT_DIR  = __dirname;
const PROJECT_DIR = path.resolve(SCRIPT_DIR, '..');

const DEFAULT_CONFIG_PATH = path.join(SCRIPT_DIR, 'config.json');

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

// ---------------------------------------------------------------------------
//  CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { configPath: DEFAULT_CONFIG_PATH, dryRun: false, verbose: false, cleanupDataProducts: false, exportPipeline: false };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--config':
        if (i + 1 >= argv.length) { console.error('--config requires a path argument'); process.exit(EXIT_FAILURE); }
        args.configPath = path.resolve(argv[++i]);
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--verbose':
        args.verbose = true;
        break;
      case '--cleanup-dataproducts':
        args.cleanupDataProducts = true;
        break;
      case '--export-pipeline':
        args.exportPipeline = true;
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
Usage: node deploy-to-qlik.js [OPTIONS]

Options:
  --config <path>           Path to config JSON (default: deploy/config.json)
  --dry-run                 Preview actions without making API calls
  --verbose                 Enable detailed logging
  --cleanup-dataproducts    Delete all data products from tenant, then exit
  --export-pipeline         Export the tenant's declarative pipeline project (YAML)
                            into deploy/pipelines/, then exit
  --help                    Show this message
`);
}

// ---------------------------------------------------------------------------
//  Logger
// ---------------------------------------------------------------------------

class Logger {
  constructor(verbose = false) {
    this.verbose = verbose;
    this._startTime = Date.now();
  }

  _ts() {
    const elapsed = ((Date.now() - this._startTime) / 1000).toFixed(1);
    return `[+${elapsed}s]`;
  }

  info(msg)    { console.log(`${this._ts()}  INFO   ${msg}`); }
  success(msg) { console.log(`${this._ts()}  OK     ${msg}`); }
  warn(msg)    { console.warn(`${this._ts()}  WARN   ${msg}`); }
  error(msg)   { console.error(`${this._ts()}  ERROR  ${msg}`); }
  debug(msg)   { if (this.verbose) console.log(`${this._ts()}  DEBUG  ${msg}`); }

  section(title) {
    const bar = '='.repeat(60);
    console.log(`\n${bar}\n  ${title}\n${bar}`);
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
  // Strip JSON comments (keys starting with "comment_")
  const cfg = JSON.parse(raw);
  stripCommentKeys(cfg);
  return cfg;
}

function stripCommentKeys(obj) {
  if (obj === null || typeof obj !== 'object') return;
  if (Array.isArray(obj)) { obj.forEach(stripCommentKeys); return; }
  for (const key of Object.keys(obj)) {
    if (key.startsWith('comment_')) {
      delete obj[key];
    } else {
      stripCommentKeys(obj[key]);
    }
  }
}

function applyEnvOverrides(cfg) {
  cfg.tenant = cfg.tenant || {};
  cfg.auth = cfg.auth || {};
  if (process.env.QLIK_TENANT_HOST)        cfg.tenant.hostname = process.env.QLIK_TENANT_HOST;
  if (process.env.QLIK_REGION)             cfg.tenant.region   = process.env.QLIK_REGION;
  if (process.env.QLIK_API_KEY)            cfg.auth.apiKey     = process.env.QLIK_API_KEY;
  if (process.env.QLIK_AUTH_METHOD)        cfg.auth.method     = process.env.QLIK_AUTH_METHOD;
  if (process.env.QLIK_OAUTH_CLIENT_ID)    cfg.auth.oauth = cfg.auth.oauth || {},
                                           cfg.auth.oauth.clientId     = process.env.QLIK_OAUTH_CLIENT_ID;
  if (process.env.QLIK_OAUTH_CLIENT_SECRET) cfg.auth.oauth = cfg.auth.oauth || {},
                                             cfg.auth.oauth.clientSecret = process.env.QLIK_OAUTH_CLIENT_SECRET;
  if (process.env.QLIK_OAUTH_TOKEN_URL)    cfg.auth.oauth = cfg.auth.oauth || {},
                                            cfg.auth.oauth.tokenUrl     = process.env.QLIK_OAUTH_TOKEN_URL;
  return cfg;
}

// ---------------------------------------------------------------------------
//  HTTP client  (zero-dependency — uses built-in https/http)
// ---------------------------------------------------------------------------

/**
 * Make an HTTP(S) request and return { statusCode, headers, body }.
 * `body` is parsed as JSON when the response Content-Type is application/json.
 */
function requestOnce(method, reqUrl, { headers = {}, body = null, rawBody = null, timeout = 60000, binary = false } = {}) {
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

    // Serialize body
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
        resolve(requestOnce(method, redirectUrl, { headers, body, rawBody, timeout, binary, _redirectCount: rc }));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        if (binary) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) });
          return;
        }
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

/**
 * HTTP request with retry on transient failures (429, 502, 503, 504).
 */
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
  throw new Error(`Request failed after ${maxRetries} retries: ${method} ${reqUrl}`);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
//  Multipart form-data builder (zero-dependency)
// ---------------------------------------------------------------------------

function buildMultipart(fields) {
  const boundary = `----QlikDeploy${Date.now()}${Math.random().toString(36).slice(2)}`;
  const parts = [];

  for (const field of fields) {
    let header = `--${boundary}\r\n`;
    if (field.filename) {
      header += `Content-Disposition: form-data; name="${field.name}"; filename="${field.filename}"\r\n`;
      header += `Content-Type: ${field.contentType || 'application/octet-stream'}\r\n\r\n`;
    } else {
      header += `Content-Disposition: form-data; name="${field.name}"\r\n\r\n`;
    }
    parts.push(Buffer.from(header, 'utf-8'));
    parts.push(Buffer.isBuffer(field.value) ? field.value : Buffer.from(String(field.value), 'utf-8'));
    parts.push(Buffer.from('\r\n', 'utf-8'));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf-8'));
  const payload = Buffer.concat(parts);
  return { boundary, payload };
}

// ---------------------------------------------------------------------------
//  Qlik Cloud API client
// ---------------------------------------------------------------------------

class QlikClient {
  /**
   * @param {object} cfg   — full config object
   * @param {Logger} log
   * @param {boolean} dryRun
   */
  constructor(cfg, log, dryRun) {
    this.cfg    = cfg;
    this.log    = log;
    this.dryRun = dryRun;
    this.baseUrl = `https://${cfg.tenant.hostname}.${cfg.tenant.region}`;
    this._token  = null;
  }

  // ---- Auth ---------------------------------------------------------------

  async authenticate() {
    const method = this.cfg.auth.method;

    if (method === 'apikey') {
      this._token = this.cfg.auth.apiKey;
      if (!this._token) throw new Error('auth.apiKey is empty — set it in config.json or QLIK_API_KEY env var.');
      this.log.success(`Authenticated via API key (token ends ...${this._token.slice(-6)})`);
      return;
    }

    if (method === 'oauth') {
      const oauth = this.cfg.auth.oauth;
      if (!oauth || !oauth.clientId || !oauth.clientSecret) {
        throw new Error('OAuth client credentials are missing in config.');
      }
      const tokenUrl = oauth.tokenUrl || `${this.baseUrl}/oauth/token`;
      this.log.info(`Requesting OAuth M2M token from ${tokenUrl}`);

      if (this.dryRun) {
        this._token = 'DRY_RUN_TOKEN';
        this.log.success('DRY RUN: Skipped OAuth token request.');
        return;
      }

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

  // ---- Low-level API helpers ----------------------------------------------

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

  async _postRaw(apiPath, rawBody, extraHeaders = {}) {
    const fullUrl = `${this.baseUrl}${apiPath}`;
    this.log.debug(`POST ${fullUrl} (raw, ${rawBody.length} bytes)`);
    return request('POST', fullUrl, { headers: this._authHeaders(extraHeaders), rawBody });
  }

  async _put(apiPath, body, extraHeaders = {}) {
    const fullUrl = `${this.baseUrl}${apiPath}`;
    this.log.debug(`PUT ${fullUrl}`);
    return request('PUT', fullUrl, { headers: this._authHeaders(extraHeaders), body });
  }

  async _patch(apiPath, body, extraHeaders = {}) {
    const fullUrl = `${this.baseUrl}${apiPath}`;
    this.log.debug(`PATCH ${fullUrl}`);
    return request('PATCH', fullUrl, { headers: this._authHeaders(extraHeaders), body });
  }

  async _delete(apiPath) {
    const fullUrl = `${this.baseUrl}${apiPath}`;
    this.log.debug(`DELETE ${fullUrl}`);
    return request('DELETE', fullUrl, { headers: this._authHeaders() });
  }

  // ---- Pagination helper --------------------------------------------------

  async _getAll(apiPath, query = {}) {
    const items = [];
    let nextLink = null;
    let pageQuery = { ...query, limit: 100 };

    do {
      const fetchUrl = nextLink || undefined;
      const res = nextLink
        ? await (async () => {
            this.log.debug(`GET ${nextLink}`);
            return request('GET', nextLink, { headers: this._authHeaders() });
          })()
        : await this._get(apiPath, pageQuery);

      if (res.statusCode !== 200) {
        throw new Error(`GET ${apiPath} failed (${res.statusCode}): ${JSON.stringify(res.body)}`);
      }

      // Detect the array of items — APIs may wrap in data, dataSources, automations, etc.
      let data = res.body.data || res.body;
      if (!Array.isArray(data) && typeof res.body === 'object' && res.body !== null) {
        const arrayKey = Object.keys(res.body).find(k => Array.isArray(res.body[k]));
        if (arrayKey) data = res.body[arrayKey];
      }
      if (Array.isArray(data)) items.push(...data);

      // Handle Qlik pagination via links.next.href
      nextLink = null;
      if (res.body.links && res.body.links.next && res.body.links.next.href) {
        const href = res.body.links.next.href;
        nextLink = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
      }
    } while (nextLink);

    return items;
  }

  // ========================================================================
  //  SPACES
  // ========================================================================

  async findSpaceByName(name) {
    const spaces = await this._getAll('/api/v1/spaces', { filter: `name eq "${name}"` });
    return spaces.find((s) => s.name === name) || null;
  }

  async createSpace(name, type) {
    const existing = await this.findSpaceByName(name);
    if (existing) {
      this.log.success(`Space already exists: "${name}" (${existing.id}, type=${existing.type})`);
      return existing;
    }

    if (this.dryRun) {
      this.log.info(`DRY RUN: Would create ${type} space "${name}"`);
      return { id: 'dry-run-space-id', name, type };
    }

    const res = await this._post('/api/v1/spaces', { name, type, description: `Auto-created by MCG deploy script.` });
    if (res.statusCode === 201 || res.statusCode === 200) {
      this.log.success(`Created ${type} space "${name}" (${res.body.id})`);
      return res.body;
    }

    // 409 Conflict means it was created between our check and our create — fetch it
    if (res.statusCode === 409) {
      this.log.warn(`Space "${name}" was created concurrently — fetching it.`);
      return this.findSpaceByName(name);
    }

    throw new Error(`Failed to create space "${name}" (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  // ========================================================================
  //  APPS
  // ========================================================================

  async findAppByName(name, spaceId) {
    const filter = spaceId
      ? `name eq "${name}" and resourceType eq "app" and spaceId eq "${spaceId}"`
      : `name eq "${name}" and resourceType eq "app"`;
    const apps = await this._getAll('/api/v1/items', { filter });
    return apps.find((a) => a.name === name) || null;
  }

  async importApp(filePath, spaceId) {
    const fileName = path.basename(filePath);
    const appName  = path.basename(filePath, '.qvf');

    // Check for existing app by name in the target space
    const existing = await this.findAppByName(appName, spaceId);
    if (existing) {
      const appId = existing.resourceId || existing.id;
      this.log.success(`App already exists: "${appName}" (${appId}) — skipping import.`);
      return { id: appId, name: appName, alreadyExisted: true };
    }

    if (this.dryRun) {
      this.log.info(`DRY RUN: Would import "${fileName}" into space ${spaceId}`);
      return { id: 'dry-run-app-id', name: appName };
    }

    const fileBuffer = fs.readFileSync(filePath);
    const { boundary, payload } = buildMultipart([
      { name: 'file', filename: fileName, contentType: 'application/x-qlik-app', value: fileBuffer },
    ]);

    const res = await this._postRaw(
      `/api/v1/apps/import?spaceId=${encodeURIComponent(spaceId)}&name=${encodeURIComponent(appName)}`,
      payload,
      { 'Content-Type': `multipart/form-data; boundary=${boundary}` }
    );

    if (res.statusCode === 200 || res.statusCode === 201) {
      const appId = res.body.attributes ? res.body.attributes.id : res.body.id;
      this.log.success(`Imported app "${appName}" (${appId})`);
      return { id: appId, name: appName };
    }

    throw new Error(`Failed to import app "${fileName}" (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  async publishApp(appId, appName, managedSpaceId) {
    if (this.dryRun) {
      this.log.info(`DRY RUN: Would publish app "${appName}" (${appId}) to managed space ${managedSpaceId}`);
      return { id: 'dry-run-published-id' };
    }

    const res = await this._post(`/api/v1/apps/${appId}/publish`, {
      spaceId: managedSpaceId,
      data: 'source',
    });

    if (res.statusCode === 200 || res.statusCode === 201) {
      const pubId = res.body.attributes ? res.body.attributes.id : res.body.id;
      this.log.success(`Published app "${appName}" to managed space (published id: ${pubId})`);
      return res.body;
    }

    // 409 often means already published
    if (res.statusCode === 409) {
      this.log.warn(`App "${appName}" may already be published — ${JSON.stringify(res.body)}`);
      return { id: appId, alreadyPublished: true };
    }

    throw new Error(`Failed to publish app "${appName}" (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  // ========================================================================
  //  DATA CONNECTIONS  (discovery workflow)
  // ========================================================================

  async findDataConnectionByName(name) {
    const conns = await this._getAll('/api/v1/data-connections');
    return conns.find((c) => c.qName === name || c.name === name) || null;
  }

  /**
   * Discovery workflow:
   *   1. GET /api/v1/data-sources  — list available connector types
   *   2. GET /api/v1/data-sources/{id}/api-specs — get the schema
   *   3. POST /api/v1/data-connections — create with properties
   */
  async discoverDataSourceByType(keyword) {
    const res = await this._get('/api/v1/data-sources', { limit: 100 });
    if (res.statusCode !== 200) {
      this.log.warn(`Data sources discovery failed (${res.statusCode})`);
      return null;
    }
    // API returns { dataSources: [...] }, not { data: [...] }
    const sources = res.body.dataSources || res.body.data || (Array.isArray(res.body) ? res.body : []);
    const kw = keyword.toLowerCase();
    return sources.find((s) =>
      (s.dataSourceId || '').toLowerCase() === kw ||
      (s.sourceType || '').toLowerCase().includes(kw) ||
      (s.dataSourceName || '').toLowerCase().includes(kw) ||
      (s.dataSourceType || '').toLowerCase().includes(kw)
    ) || null;
  }

  async createDataConnection(name, dataSourceId, connectionProperties, spaceId, dataSource) {
    const existing = await this.findDataConnectionByName(name);
    if (existing) {
      this.log.success(`Data connection already exists: "${name}" (${existing.qID || existing.id}) — skipping.`);
      return existing;
    }

    if (this.dryRun) {
      this.log.info(`DRY RUN: Would create data connection "${name}" (dataSourceId=${dataSourceId})`);
      return { id: 'dry-run-conn-id', name };
    }

    const payload = {
      datasourceID: dataSourceId,
      qName: name,
      type: dataSourceId,
      qConnectStatement: '',
      space: spaceId || undefined,
    };
    // Add qType from the discovered data source provider (required for ODBC connectors)
    if (dataSource && dataSource.provider) {
      payload.qType = dataSource.provider;
    }
    // Merge connection-specific properties (may override qConnectStatement, add qUsername, etc.)
    const { _configureInUI: configureInUI, ...cleanProps } = connectionProperties;
    Object.assign(payload, cleanProps);

    const res = await this._post('/api/v1/data-connections', payload);
    if (res.statusCode === 200 || res.statusCode === 201) {
      const connId = res.body.qID || res.body.id;
      this.log.success(`Created data connection "${name}" (${connId})`);
      if (configureInUI) {
        this.log.info(`  → Configure connection details in Qlik Cloud UI: Manage → Data connections → "${name}"`);
      }
      return res.body;
    }

    // 409 = already exists (race condition)
    if (res.statusCode === 409) {
      this.log.warn(`Data connection "${name}" already exists (409).`);
      return this.findDataConnectionByName(name);
    }

    throw new Error(`Failed to create data connection "${name}" (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  // ========================================================================
  //  KNOWLEDGE BASES  (Qlik Answers)
  // ========================================================================

  async findKnowledgeBaseByName(name) {
    const kbs = await this._getAll('/api/v1/knowledgebases');
    return kbs.find((kb) => kb.name === name) || null;
  }

  async createKnowledgeBase(name, description) {
    const existing = await this.findKnowledgeBaseByName(name);
    if (existing) {
      this.log.success(`Knowledge base already exists: "${name}" (${existing.id}) — skipping creation.`);
      return existing;
    }

    if (this.dryRun) {
      this.log.info(`DRY RUN: Would create knowledge base "${name}"`);
      return { id: 'dry-run-kb-id', name };
    }

    const res = await this._post('/api/v1/knowledgebases', { name, description });
    if (res.statusCode === 200 || res.statusCode === 201) {
      this.log.success(`Created knowledge base "${name}" (${res.body.id})`);
      return res.body;
    }
    if (res.statusCode === 409) {
      this.log.warn(`Knowledge base "${name}" already exists (409).`);
      return this.findKnowledgeBaseByName(name);
    }
    throw new Error(`Failed to create knowledge base (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  async createKBFileDatasource(kbId, name) {
    if (this.dryRun) {
      this.log.info(`DRY RUN: Would create file datasource "${name}" on KB ${kbId}`);
      return { id: 'dry-run-ds-id', name };
    }

    // Check existing datasources on this KB
    const existingDs = await this._getAll(`/api/v1/knowledgebases/${kbId}/datasources`);
    const found = existingDs.find((ds) => ds.name === name);
    if (found) {
      this.log.success(`KB datasource already exists: "${name}" (${found.id}) — skipping.`);
      return found;
    }

    const res = await this._post(`/api/v1/knowledgebases/${kbId}/datasources`, {
      name,
      type: 'file',
    });
    if (res.statusCode === 200 || res.statusCode === 201) {
      this.log.success(`Created KB file datasource "${name}" (${res.body.id})`);
      return res.body;
    }
    if (res.statusCode === 409) {
      this.log.warn(`KB datasource "${name}" already exists (409).`);
      const all = await this._getAll(`/api/v1/knowledgebases/${kbId}/datasources`);
      return all.find((ds) => ds.name === name);
    }
    // Handle tenant-side configuration issues (e.g., fileconfig not found)
    const bodyStr = JSON.stringify(res.body);
    if (bodyStr.includes('fileconfig') || res.statusCode === 500) {
      this.log.warn(`KB datasource creation returned ${res.statusCode}: ${bodyStr}`);
      this.log.warn('This is typically a tenant-side configuration issue. KB datasource will be skipped.');
      return { id: null, name, notAvailable: true };
    }
    throw new Error(`Failed to create KB datasource (${res.statusCode}): ${bodyStr}`);
  }

  async uploadDocumentToKB(kbId, dsId, filePath) {
    const fileName = path.basename(filePath);

    if (this.dryRun) {
      this.log.info(`DRY RUN: Would upload "${fileName}" to KB datasource`);
      return { name: fileName };
    }

    const fileBuffer = fs.readFileSync(filePath);
    const contentType = fileName.endsWith('.docx')
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/octet-stream';

    const { boundary, payload } = buildMultipart([
      { name: 'file', filename: fileName, contentType, value: fileBuffer },
    ]);

    const res = await this._postRaw(
      `/api/v1/knowledgebases/${kbId}/datasources/${dsId}/files`,
      payload,
      { 'Content-Type': `multipart/form-data; boundary=${boundary}` }
    );

    if (res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 204) {
      this.log.debug(`Uploaded "${fileName}" to KB datasource`);
      return res.body || { name: fileName };
    }

    // 409 = file already uploaded
    if (res.statusCode === 409) {
      this.log.debug(`File "${fileName}" already uploaded — skipping.`);
      return { name: fileName, alreadyExists: true };
    }

    throw new Error(`Failed to upload "${fileName}" to KB (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  async syncKBDatasource(kbId, dsId) {
    if (this.dryRun) {
      this.log.info(`DRY RUN: Would trigger sync/index on KB datasource ${dsId}`);
      return;
    }

    const res = await this._post(`/api/v1/knowledgebases/${kbId}/datasources/${dsId}/actions/sync`, {});
    if (res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 202 || res.statusCode === 204) {
      this.log.success(`Triggered sync/indexing for KB datasource ${dsId}`);
      return res.body;
    }
    throw new Error(`Failed to trigger KB sync (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  // ========================================================================
  //  ASSISTANTS  (Qlik Answers)
  // ========================================================================

  async findAssistantByName(name) {
    const assistants = await this._getAll('/api/v1/assistants');
    return assistants.find((a) => a.name === name) || null;
  }

  async createAssistant({ name, description, knowledgeBaseId, conversationStarters }) {
    const existing = await this.findAssistantByName(name);
    if (existing) {
      this.log.success(`Assistant already exists: "${name}" (${existing.id}) — skipping.`);
      return existing;
    }

    if (this.dryRun) {
      this.log.info(`DRY RUN: Would create assistant "${name}"`);
      return { id: 'dry-run-assistant-id', name };
    }

    const payload = {
      name,
      description,
      knowledgebases: knowledgeBaseId ? [knowledgeBaseId] : [],
      conversationStarters: (conversationStarters || []).map((text) => ({ text })),
    };

    const res = await this._post('/api/v1/assistants', payload);
    if (res.statusCode === 200 || res.statusCode === 201) {
      this.log.success(`Created assistant "${name}" (${res.body.id})`);
      return res.body;
    }
    if (res.statusCode === 409) {
      this.log.warn(`Assistant "${name}" already exists (409).`);
      return this.findAssistantByName(name);
    }
    throw new Error(`Failed to create assistant (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  // ========================================================================
  //  CONNECTION VERIFICATION
  // ========================================================================

  async verifyConnection() {
    if (this.dryRun) {
      this.log.success('DRY RUN: Skipped connection verification.');
      return true;
    }
    const res = await this._get('/api/v1/users/me');
    if (res.statusCode === 200) {
      const name = res.body.name || res.body.subject || 'unknown';
      this.log.success(`Connected as: ${name}`);
      return true;
    }
    this.log.error(`Connection check failed (${res.statusCode}): ${JSON.stringify(res.body).slice(0, 200)}`);
    return false;
  }

  // ========================================================================
  //  THEMES
  // ========================================================================

  async findThemeByName(name) {
    const themes = await this._getAll('/api/v1/themes');
    return themes.find((t) => t.name === name) || null;
  }

  async uploadTheme(filePath) {
    const fileName = path.basename(filePath);
    const themeName = path.basename(filePath, path.extname(filePath))
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    let existing = await this.findThemeByName(themeName);
    if (!existing) existing = await this.findThemeByName(path.basename(filePath, path.extname(filePath)));
    if (existing) {
      this.log.success(`Theme already exists: "${existing.name || themeName}" (${existing.id || '?'}) — skipping.`);
      return existing;
    }

    if (this.dryRun) {
      this.log.info(`DRY RUN: Would upload theme "${fileName}"`);
      return { id: 'dry-run-theme-id', name: themeName };
    }

    const fileBuffer = fs.readFileSync(filePath);
    const { boundary, payload } = buildMultipart([
      { name: 'file', filename: fileName, contentType: 'application/zip', value: fileBuffer },
    ]);

    const res = await this._postRaw('/api/v1/themes', payload,
      { 'Content-Type': `multipart/form-data; boundary=${boundary}` });

    if (res.statusCode === 200 || res.statusCode === 201) {
      this.log.success(`Uploaded theme "${res.body.name || themeName}" (${res.body.id || '?'})`);
      return res.body;
    }
    if (res.statusCode === 409) {
      this.log.warn(`Theme "${fileName}" already exists (409).`);
      return { name: themeName, alreadyExists: true };
    }
    throw new Error(`Theme upload failed (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  // ========================================================================
  //  AUTOMATIONS
  // ========================================================================

  async findAutomationByName(name) {
    const autos = await this._getAll('/api/v1/automations');
    return autos.find((a) => a.name === name) || null;
  }

  async createAutomation(name, description, spaceId) {
    const existing = await this.findAutomationByName(name);
    if (existing) {
      this.log.success(`Automation already exists: "${name}" (${existing.id}) — skipping.`);
      return existing;
    }

    if (this.dryRun) {
      this.log.info(`DRY RUN: Would create automation "${name}"`);
      return { id: 'dry-run-auto-id', name };
    }

    const payload = { name, description, state: 'disabled' };
    if (spaceId) payload.spaceId = spaceId;

    const res = await this._post('/api/v1/automations', payload);
    if (res.statusCode === 200 || res.statusCode === 201) {
      this.log.success(`Created automation "${name}" (${res.body.id})`);
      return res.body;
    }
    if (res.statusCode === 409) {
      this.log.warn(`Automation "${name}" already exists (409).`);
      return this.findAutomationByName(name);
    }
    throw new Error(`Automation create failed (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  // ========================================================================
  //  DATA PRODUCTS
  // ========================================================================

  async findDataProductByName(name, spaceId) {
    // Primary: try the Data Governance API
    try {
      const products = await this._getAll('/api/data-governance/data-products');
      this.log.debug(`Data products lookup: found ${products.length} existing product(s)`);
      const match = products.find((dp) => dp.name === name);
      if (match) return match;
    } catch (err) {
      this.log.debug(`Data products API lookup failed (${err.message}) — trying Items API fallback.`);
    }
    // Fallback: use the Items API with name filter (works even when Data Governance GET returns 405)
    try {
      const filter = spaceId
        ? `name eq "${name}" and resourceType eq "dataproduct" and spaceId eq "${spaceId}"`
        : `name eq "${name}" and resourceType eq "dataproduct"`;
      const res = await this._get(`/api/v1/items?${new URLSearchParams({ filter, limit: '100' })}`);
      const items = (res.body && res.body.data) || [];
      this.log.debug(`Items API fallback: found ${items.length} data product item(s) matching "${name}"`);
      if (items.length > 0) {
        const match = items[0];
        return { id: match.resourceId || match.id, name: match.name, alreadyExists: true };
      }
    } catch (err2) {
      this.log.debug(`Items API fallback also failed: ${err2.message}`);
    }
    return null;
  }

  async createDataProduct({ name, description, tags, owner, sla, schema, apiSharing, spaceId }) {
    const existing = await this.findDataProductByName(name, spaceId);
    if (existing) {
      this.log.success(`Data product already exists: "${name}" (${existing.id || '?'}) — skipping.`);
      return { ...existing, alreadyExists: true };
    }

    if (this.dryRun) {
      this.log.info(`DRY RUN: Would create data product "${name}"`);
      return { id: 'dry-run-dp-id', name };
    }

    const payload = { name, description };
    if (spaceId) payload.spaceId = spaceId;
    // Note: tags are omitted — API expects tag UUIDs but we have string names.
    // Tags can be assigned manually in the Qlik Cloud UI after deployment.
    if (tags && tags.length) this.log.debug(`Skipping ${tags.length} tag(s) for "${name}" (require UUIDs).`);
    if (owner) payload.owner = owner;
    if (sla) payload.sla = sla;
    if (schema) payload.schema = schema;
    if (apiSharing) payload.apiSharing = { enabled: true };

    const res = await this._post('/api/data-governance/data-products', payload);
    if (res.statusCode === 200 || res.statusCode === 201) {
      this.log.success(`Created data product "${name}" (${res.body.id || '?'})`);
      return res.body;
    }
    if (res.statusCode === 409) {
      this.log.warn(`Data product "${name}" already exists (409).`);
      return (await this.findDataProductByName(name)) || { name, alreadyExists: true };
    }
    if (res.statusCode === 404) {
      this.log.warn(`Data products API not available (404). Talend Enterprise tier may be required for "${name}".`);
      return { name, notAvailable: true };
    }
    throw new Error(`Data product create failed (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  async deleteDataProduct(id) {
    const res = await this._delete(`/api/data-governance/data-products/${id}`);
    if (res.statusCode === 200 || res.statusCode === 204) {
      this.log.success(`Deleted data product ${id}`);
      return true;
    }
    if (res.statusCode === 404) {
      this.log.warn(`Data product ${id} not found (already deleted?)`);
      return false;
    }
    throw new Error(`Failed to delete data product ${id} (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  async listAllDataProducts() {
    // Try governance API first
    try {
      const products = await this._getAll('/api/data-governance/data-products');
      return products || [];
    } catch (err) {
      this.log.debug(`Data governance API list failed: ${err.message}`);
    }
    // Fallback: Items API
    try {
      const res = await this._get('/api/v1/items?resourceType=dataproduct&limit=100');
      const items = (res.body && res.body.data) || [];
      return items.map(it => ({ id: it.resourceId || it.id, name: it.name }));
    } catch (err2) {
      this.log.debug(`Items API fallback failed: ${err2.message}`);
    }
    return [];
  }

  async deleteAllDataProducts(keepNames = []) {
    const all = await this.listAllDataProducts();
    this.log.info(`Found ${all.length} data product(s) in tenant`);
    let deleted = 0, kept = 0;
    for (const dp of all) {
      if (keepNames.includes(dp.name)) {
        this.log.info(`  Keeping: "${dp.name}" (${dp.id})`);
        kept++;
        continue;
      }
      this.log.info(`  Deleting: "${dp.name}" (${dp.id})`);
      await this.deleteDataProduct(dp.id);
      deleted++;
    }
    return { deleted, kept, total: all.length };
  }

  // ========================================================================
  //  BUSINESS GLOSSARY
  // ========================================================================

  async findGlossaryByName(name) {
    try {
      const glossaries = await this._getAll('/api/data-governance/glossaries');
      return glossaries.find((g) => g.name === name) || null;
    } catch (_) {
      return null;
    }
  }

  async createGlossary(name, description) {
    const existing = await this.findGlossaryByName(name);
    if (existing) {
      this.log.success(`Glossary already exists: "${name}" (${existing.id || '?'}) — skipping.`);
      return existing;
    }

    if (this.dryRun) {
      this.log.info(`DRY RUN: Would create glossary "${name}"`);
      return { id: 'dry-run-glossary-id', name };
    }

    const res = await this._post('/api/data-governance/glossaries', { name, description });
    if (res.statusCode === 200 || res.statusCode === 201) {
      this.log.success(`Created glossary "${name}" (${res.body.id || '?'})`);
      return res.body;
    }
    if (res.statusCode === 409) {
      this.log.warn(`Glossary "${name}" may already exist.`);
      return (await this.findGlossaryByName(name)) || { name, alreadyExists: true };
    }
    if (res.statusCode === 404) {
      this.log.warn('Glossaries API not available (404). Talend Enterprise tier may be required.');
      return { name, notAvailable: true };
    }
    throw new Error(`Glossary create failed (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  async listGlossaryTerms(glossaryId) {
    try {
      return await this._getAll(`/api/data-governance/glossaries/${glossaryId}/terms`);
    } catch (_) {
      return [];
    }
  }

  async createGlossaryTerm(glossaryId, { name, definition, category, tags }, existingTerms) {
    // Check if term already exists (by name)
    if (existingTerms && existingTerms.length > 0) {
      const found = existingTerms.find((t) => t.name === name);
      if (found) {
        this.log.debug(`Term "${name}" already exists (${found.id || '?'}) — skipping.`);
        return { ...found, alreadyExists: true };
      }
    }

    if (this.dryRun) {
      this.log.debug(`DRY RUN: Would create glossary term "${name}"`);
      return { id: 'dry-run-term-id', name };
    }

    const payload = { name, definition };
    if (category) payload.category = category;
    // Tags omitted — API expects UUIDs, not string names

    const res = await this._post(`/api/data-governance/glossaries/${glossaryId}/terms`, payload);
    if (res.statusCode === 200 || res.statusCode === 201) {
      this.log.debug(`Created term "${name}" (${res.body.id || '?'})`);
      return res.body;
    }
    if (res.statusCode === 409) {
      this.log.debug(`Term "${name}" already exists — skipping.`);
      return { name, alreadyExists: true };
    }
    throw new Error(`Term "${name}" create failed (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  // ========================================================================
  //  WEBHOOKS  (/api/v1/webhooks)
  // ========================================================================

  async findWebhookByName(name) {
    try {
      const hooks = await this._getAll('/api/v1/webhooks');
      return hooks.find((h) => h.name === name) || null;
    } catch (err) {
      this.log.debug(`Webhook list failed: ${err.message}`);
      return null;
    }
  }

  async createWebhook({ name, url, eventTypes, description, enabled = true }) {
    const existing = await this.findWebhookByName(name);
    if (existing) {
      this.log.success(`Webhook already exists: "${name}" (${existing.id}) — skipping.`);
      return existing;
    }
    if (this.dryRun) {
      this.log.info(`DRY RUN: Would create webhook "${name}" → ${url}`);
      return { id: 'dry-run-webhook-id', name };
    }
    const payload = { name, url, eventTypes, description: description || '', enabled };
    const res = await this._post('/api/v1/webhooks', payload);
    if (res.statusCode === 200 || res.statusCode === 201) {
      this.log.success(`Created webhook "${name}" (${res.body.id}) for events: ${eventTypes.join(', ')}`);
      return res.body;
    }
    if (res.statusCode === 409) {
      this.log.warn(`Webhook "${name}" already exists (409).`);
      return this.findWebhookByName(name);
    }
    throw new Error(`Webhook create failed (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  // ========================================================================
  //  RELOAD TASKS  (/api/v1/reload-tasks)
  // ========================================================================

  async findReloadTaskByName(name) {
    try {
      const tasks = await this._getAll('/api/v1/reload-tasks');
      return tasks.find((t) => t.name === name) || null;
    } catch (err) {
      this.log.debug(`Reload task list failed: ${err.message}`);
      return null;
    }
  }

  async createReloadTask({ name, appId, cronExpression, timeZone, description }) {
    const existing = await this.findReloadTaskByName(name);
    if (existing) {
      this.log.success(`Reload task already exists: "${name}" (${existing.id}) — skipping.`);
      return existing;
    }
    if (this.dryRun) {
      this.log.info(`DRY RUN: Would create reload task "${name}" for app ${appId}`);
      return { id: 'dry-run-task-id', name };
    }
    const payload = {
      name,
      appId,
      description: description || '',
      recurrence: {
        type: 'recurrence',
        cronExpression,
        timeZone: timeZone || 'UTC',
      },
      partial: false,
    };
    const res = await this._post('/api/v1/reload-tasks', payload);
    if (res.statusCode === 200 || res.statusCode === 201) {
      this.log.success(`Created reload task "${name}" (${res.body.id}) cron: ${cronExpression}`);
      return res.body;
    }
    if (res.statusCode === 409) {
      this.log.warn(`Reload task "${name}" already exists (409).`);
      return this.findReloadTaskByName(name);
    }
    throw new Error(`Reload task create failed (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  // ========================================================================
  //  DI PROJECTS — Declarative Data Pipelines (preview API)
  // ========================================================================

  async findDiProjectByName(name, spaceId) {
    try {
      const query = spaceId ? { spaceId } : {};
      const projects = await this._getAll('/api/v1/di-projects', query);
      return projects.find((p) => p.name === name) || null;
    } catch (err) {
      this.log.debug(`DI project list failed: ${err.message}`);
      return null;
    }
  }

  async createDiProject({ name, description, spaceId, platformType }) {
    const existing = await this.findDiProjectByName(name, spaceId);
    if (existing) {
      this.log.success(`DI project already exists: "${name}" (${existing.id}) — reusing.`);
      return existing;
    }
    if (this.dryRun) {
      this.log.info(`DRY RUN: Would create DI project "${name}" (${platformType})`);
      return { id: 'dry-run-di-project-id', name };
    }
    const payload = {
      name,
      type: 'DATA_PIPELINE',
      platformType: platformType || 'QLIK_OPEN_LAKEHOUSE',
      description: description || '',
    };
    if (spaceId) payload.space = spaceId;
    const res = await this._post('/api/v1/di-projects', payload);
    if (res.statusCode === 200 || res.statusCode === 201) {
      this.log.success(`Created DI project "${name}" (${res.body.id})`);
      return res.body;
    }
    if (res.statusCode === 409) {
      this.log.warn(`DI project "${name}" already exists (409) — fetching.`);
      const found = await this.findDiProjectByName(name, spaceId);
      if (found) return found;
    }
    throw new Error(`DI project create failed (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }

  /**
   * Pre-import structural validation of a project definitions ZIP.
   * Preview utility endpoint — returns { available: false } when the tenant
   * does not expose it yet, so callers can continue without it.
   */
  async validateProjectDefinitions(zipBuffer) {
    const { boundary, payload } = buildMultipart([
      { name: 'zip', filename: 'project.zip', contentType: 'application/zip', value: zipBuffer },
    ]);
    const res = await this._postRaw(
      '/api/v1/di-projects/utils/actions/validate-project-definitions',
      payload,
      { 'Content-Type': `multipart/form-data; boundary=${boundary}` }
    );
    if ([404, 405, 501].includes(res.statusCode)) return { available: false };
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const issues = (res.body && (res.body.errors || res.body.issues)) || [];
      if (Array.isArray(issues) && issues.length > 0) {
        return { available: true, ok: false, detail: JSON.stringify(issues).slice(0, 800) };
      }
      return { available: true, ok: true };
    }
    return { available: true, ok: false, detail: `HTTP ${res.statusCode}: ${JSON.stringify(res.body).slice(0, 800)}` };
  }

  async importDiProject(projectId, zipBuffer) {
    if (this.dryRun) {
      this.log.info(`DRY RUN: Would import ${zipBuffer.length} bytes of definitions into DI project ${projectId}`);
      return { status: 'dry-run' };
    }
    const { boundary, payload } = buildMultipart([
      { name: 'zip', filename: 'project.zip', contentType: 'application/zip', value: zipBuffer },
    ]);
    const res = await this._postRaw(
      `/api/v1/di-projects/${projectId}/actions/import`,
      payload,
      { 'Content-Type': `multipart/form-data; boundary=${boundary}` }
    );
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const actionId = res.body && (res.body.actionId || res.body.id);
      if (res.statusCode === 202 && actionId) return this._pollDiAction(actionId, 'import');
      return res.body || { status: 'imported' };
    }
    throw new Error(`DI project import failed (${res.statusCode}): ${JSON.stringify(res.body).slice(0, 800)}`);
  }

  async _pollDiAction(actionId, label, { timeoutMs = 300000, intervalMs = 3000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await this._get(`/api/v1/di-projects/actions/${actionId}`);
      if (res.statusCode === 200 && res.body) {
        const status = String(res.body.status || res.body.state || '').toUpperCase();
        if (['COMPLETED', 'SUCCESS', 'SUCCEEDED', 'DONE'].includes(status)) return res.body;
        if (['FAILED', 'ERROR', 'CANCELLED'].includes(status)) {
          throw new Error(`DI ${label} action ${actionId} failed: ${JSON.stringify(res.body).slice(0, 500)}`);
        }
        this.log.debug(`DI ${label} action ${actionId}: ${status || 'in progress'}…`);
      }
      await sleep(intervalMs);
    }
    throw new Error(`DI ${label} action ${actionId} timed out after ${timeoutMs / 1000}s`);
  }

  async getDiProjectBindings(projectId) {
    const res = await this._get(`/api/v1/di-projects/${projectId}/bindings`, { recalculate: 'true' });
    if (res.statusCode === 200) return res.body || {};
    throw new Error(`DI bindings fetch failed (${res.statusCode}): ${JSON.stringify(res.body).slice(0, 400)}`);
  }

  async updateDiProjectBindings(projectId, variables) {
    if (this.dryRun) {
      this.log.info(`DRY RUN: Would set ${Object.keys(variables).length} binding variable(s) on DI project ${projectId}`);
      return;
    }
    const res = await this._put(`/api/v1/di-projects/${projectId}/bindings`, { variables });
    if (res.statusCode >= 200 && res.statusCode < 300) return res.body;
    throw new Error(`DI bindings update failed (${res.statusCode}): ${JSON.stringify(res.body).slice(0, 800)}`);
  }

  async exportDiProject(projectId, { mode = 'MINIMAL', includeBindings = true } = {}) {
    const fullUrl = `${this.baseUrl}/api/v1/di-projects/${projectId}/actions/export`;
    this.log.debug(`POST ${fullUrl} (export, mode=${mode})`);
    const res = await request('POST', fullUrl, {
      headers: this._authHeaders({ Accept: 'application/zip, application/json' }),
      body: { mode, includeBindings },
      binary: true,
      timeout: 300000,
    });
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const ct = String(res.headers['content-type'] || '').toLowerCase();
      if (ct.includes('zip') || ct.includes('octet-stream') || (res.body.length > 4 && res.body.readUInt32LE(0) === 0x04034b50)) {
        return res.body; // ZIP bytes
      }
      throw new Error(`DI export returned unexpected content-type "${ct}" (${res.body.length} bytes)`);
    }
    throw new Error(`DI project export failed (${res.statusCode}): ${res.body.toString('utf-8').slice(0, 800)}`);
  }

  async prepareDiProject(projectId) {
    if (this.dryRun) {
      this.log.info(`DRY RUN: Would prepare DI project ${projectId}`);
      return;
    }
    const res = await this._post(`/api/v1/di-projects/${projectId}/actions/prepare`, { allowRecreate: false });
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const actionId = res.body && (res.body.actionId || res.body.id);
      if (res.statusCode === 202 && actionId) return this._pollDiAction(actionId, 'prepare');
      return res.body;
    }
    throw new Error(`DI project prepare failed (${res.statusCode}): ${JSON.stringify(res.body).slice(0, 800)}`);
  }

  async listDiTasks(projectId) {
    const res = await this._get(`/api/v1/di-projects/${projectId}/di-tasks`);
    if (res.statusCode !== 200) {
      throw new Error(`DI task list failed (${res.statusCode}): ${JSON.stringify(res.body).slice(0, 400)}`);
    }
    const body = res.body || {};
    return body.data || body.tasks || (Array.isArray(body) ? body : []);
  }

  async getDiTaskState(projectId, taskId) {
    const res = await this._get(`/api/v1/di-projects/${projectId}/di-tasks/${taskId}/runtime/state`);
    if (res.statusCode === 200) return res.body || {};
    return { unavailable: true, statusCode: res.statusCode };
  }

  async startDiTask(projectId, taskId, label) {
    if (this.dryRun) {
      this.log.info(`DRY RUN: Would start DI task "${label || taskId}"`);
      return { status: 'dry-run' };
    }
    const res = await this._post(`/api/v1/di-projects/${projectId}/di-tasks/${taskId}/runtime/actions/start`, {});
    if (res.statusCode >= 200 && res.statusCode < 300) {
      this.log.success(`Started DI task "${label || taskId}"`);
      return res.body || { status: 'started' };
    }
    // 409 = already running — treat as success for idempotent re-deploys
    if (res.statusCode === 409) {
      this.log.info(`DI task "${label || taskId}" already running (409).`);
      return { status: 'already-running' };
    }
    throw new Error(`DI task start failed for "${label || taskId}" (${res.statusCode}): ${JSON.stringify(res.body).slice(0, 400)}`);
  }

  async stopDiTask(projectId, taskId, label) {
    if (this.dryRun) {
      this.log.info(`DRY RUN: Would stop DI task "${label || taskId}"`);
      return { status: 'dry-run' };
    }
    const res = await this._post(`/api/v1/di-projects/${projectId}/di-tasks/${taskId}/runtime/actions/stop`, {});
    if (res.statusCode >= 200 && res.statusCode < 300) return res.body || { status: 'stopped' };
    throw new Error(`DI task stop failed for "${label || taskId}" (${res.statusCode}): ${JSON.stringify(res.body).slice(0, 400)}`);
  }

  // ========================================================================
  //  CATALOG DATASETS  (for data product attachment)
  // ========================================================================

  async findDatasetByName(name, spaceId) {
    // Primary: Items API with resourceType filter (consistent with other lookups)
    try {
      const params = { resourceType: 'dataset', name, limit: '100' };
      if (spaceId) params.spaceId = spaceId;
      const res = await this._get(`/api/v1/items?${new URLSearchParams(params)}`);
      const items = (res.body && res.body.data) || [];
      // Exact match first, then case-insensitive, then suffix match (schema-qualified names)
      const exact = items.find((it) => it.name === name)
        || items.find((it) => (it.name || '').toLowerCase() === name.toLowerCase())
        || items.find((it) => (it.name || '').toLowerCase().endsWith(`.${name.toLowerCase()}`));
      if (exact) return { id: exact.resourceId || exact.id, name: exact.name, itemId: exact.id };
    } catch (err) {
      this.log.debug(`Items dataset lookup failed for "${name}": ${err.message}`);
    }
    // Fallback: data-sets API
    try {
      const res = await this._get(`/api/v1/data-sets?${new URLSearchParams({ filter: `name eq "${name}"`, limit: '50' })}`);
      const sets = (res.body && res.body.data) || [];
      if (sets.length > 0) return { id: sets[0].id, name: sets[0].name };
    } catch (err2) {
      this.log.debug(`data-sets lookup failed for "${name}": ${err2.message}`);
    }
    return null;
  }

  async setDataProductDatasets(dataProductId, datasetIds, { apiConsumable = false } = {}) {
    if (this.dryRun) {
      this.log.info(`DRY RUN: Would attach ${datasetIds.length} dataset(s) to data product ${dataProductId}`);
      return { status: 'dry-run' };
    }
    const ops = [{ op: 'replace', path: '/datasetIds', value: datasetIds }];
    if (apiConsumable) {
      ops.push({ op: 'replace', path: '/apiConsumableDatasetIds', value: datasetIds });
    }
    const res = await this._patch(`/api/data-governance/data-products/${dataProductId}`, ops, {
      'Content-Type': 'application/json-patch+json',
    });
    if (res.statusCode >= 200 && res.statusCode < 300) return res.body || { status: 'updated' };
    throw new Error(`Data product dataset attach failed (${res.statusCode}): ${JSON.stringify(res.body).slice(0, 400)}`);
  }

  async activateDataProduct(dataProductId, { name, description, spaceId }) {
    if (this.dryRun) {
      this.log.info(`DRY RUN: Would activate (publish) data product "${name}"`);
      return { status: 'dry-run' };
    }
    const payload = { name };
    if (description) payload.description = description;
    if (spaceId) payload.spaceId = spaceId;
    const res = await this._post(`/api/data-governance/data-products/${dataProductId}/actions/activate`, payload);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      this.log.success(`Activated data product "${name}" — visible in the marketplace.`);
      return res.body || { status: 'activated' };
    }
    if (res.statusCode === 409) {
      this.log.info(`Data product "${name}" already active (409).`);
      return { status: 'already-active' };
    }
    throw new Error(`Data product activate failed (${res.statusCode}): ${JSON.stringify(res.body).slice(0, 400)}`);
  }
}

// ---------------------------------------------------------------------------
//  File discovery helpers
// ---------------------------------------------------------------------------

function findFiles(dir, ext) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(full, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
//  Build data connection properties from config
// ---------------------------------------------------------------------------

function buildPostgresProperties(cfg) {
  return {
    qConnectStatement: [
      `CUSTOM CONNECT TO "provider=QvOdbcConnectorPackage.exe;`,
      `driver=postgresql;`,
      `server=${cfg.host};`,
      `port=${cfg.port};`,
      `database=${cfg.database};`,
      `sslmode=require"`,
    ].join(''),
    qUsername: cfg.username,
    qPassword: cfg.password,
  };
}

// Salesforce, Kafka, and S3 connectors use REST-based data sources whose
// property schemas are defined server-side. We create the connection shell
// with an empty connectionProperties object (API requires at least one of
// qConnectStatement or connectionProperties). Users configure credentials
// in the Qlik Cloud UI after deployment.
function buildSalesforceProperties(/* cfg */) {
  return { connectionProperties: {}, _configureInUI: true };
}

function buildKafkaProperties(cfg) {
  // Kafka connections use qConnectStatement like ODBC connectors
  const parts = [
    `CUSTOM CONNECT TO "provider=QlikConnectorsCommonService.exe;`,
    `connectstr=kafka;`,
    `bootstrapservers=${cfg.bootstrapServers || 'localhost:9092'};`,
    `securityprotocol=${cfg.securityProtocol || 'PLAINTEXT'}"`,
  ];
  const props = { qConnectStatement: parts.join('') };
  if (cfg.saslUsername) props.qUsername = cfg.saslUsername;
  if (cfg.saslPassword) props.qPassword = cfg.saslPassword;
  return props;
}

function buildS3Properties(/* cfg */) {
  return { connectionProperties: {}, _configureInUI: true };
}

// ---------------------------------------------------------------------------
//  Declarative pipeline binding resolution
// ---------------------------------------------------------------------------

/**
 * Compute values for the {{...}} binding variables declared in the project's
 * qtcp_bindings_definition.json. Connection variables resolve to live
 * connection IDs on the tenant; schemas/clusters/warehouse come from config
 * conventions. cfg.pipelines.bindings entries override any computed value.
 */
async function resolvePipelineBindings(client, cfg, log, srcDir) {
  const bindingsPath = path.join(srcDir, 'qtcp_bindings_definition.json');
  if (!fs.existsSync(bindingsPath)) {
    log.warn('No qtcp_bindings_definition.json found — skipping binding resolution.');
    return {};
  }
  const defs = JSON.parse(fs.readFileSync(bindingsPath, 'utf-8'));
  const names = Object.keys(defs.variables || {});
  const pCfg = cfg.pipelines || {};
  const dc = cfg.dataConnections || {};
  const clusters = cfg.clusters || {};
  const lakehouseName = (cfg.lakehouse && cfg.lakehouse.name) || '';

  const connIdCache = {};
  async function connectionValue(connName) {
    if (!connName) return '';
    if (!(connName in connIdCache)) {
      try {
        const conn = await client.findDataConnectionByName(connName);
        connIdCache[connName] = conn ? (conn.id || connName) : connName;
        if (!conn) log.warn(`Connection "${connName}" not found on tenant — binding falls back to the name.`);
      } catch (err) {
        log.debug(`Connection lookup failed for "${connName}": ${err.message}`);
        connIdCache[connName] = connName;
      }
    }
    return connIdCache[connName];
  }

  // Medallion tier by task reference: datamarts → gold, transforms → silver,
  // landings (everything else) → bronze.
  function schemaForTask(taskRef) {
    if (/gold|datamart/.test(taskRef)) return 'gold';
    if (/transform/.test(taskRef)) return 'silver';
    return 'bronze';
  }

  const resolved = {};
  for (const name of names) {
    const m = name.match(/^task\.([^.]+)\.(.+)$/);
    if (!m) continue;
    const [, taskRefRaw, prop] = m;
    const schemaMatch = taskRefRaw.match(/:null\$_\$(.+)$/);
    const taskRef = taskRefRaw.replace(/:null\$_\$.+$/, '');
    let value = '';

    if (schemaMatch && prop === 'schema') {
      value = schemaMatch[1];
    } else if (prop === 'sourceConnection') {
      let connName = '';
      if (/wms|postgres/.test(taskRef))        connName = (dc.postgresql && dc.postgresql.name) || '';
      else if (/crm|salesforce|sf/.test(taskRef)) connName = (dc.salesforce && dc.salesforce.name) || '';
      else if (/iot|kafka|stream/.test(taskRef))  connName = (dc.kafka && dc.kafka.name) || '';
      value = await connectionValue(connName);
    } else if (prop === 'taskSchema') {
      value = schemaForTask(taskRef);
    } else if (prop === 'internalSchema') {
      value = `${schemaForTask(taskRef)}__internal`;
    } else if (prop === 'databaseName') {
      value = pCfg.databaseName || lakehouseName;
    } else if (prop === 'warehouseName') {
      value = pCfg.warehouseName || '';
    } else if (prop === 'lakehouseCluster') {
      const cluster = /iot|stream/.test(taskRef) ? clusters.streaming : clusters.cdc;
      value = (cluster && cluster.name) || '';
    }

    if (value) resolved[name] = value;
  }

  for (const [k, v] of Object.entries(pCfg.bindings || {})) {
    if (v !== undefined && v !== null && v !== '') resolved[k] = v;
  }
  return resolved;
}

// ---------------------------------------------------------------------------
//  Deployment report
// ---------------------------------------------------------------------------

class DeploymentReport {
  constructor() {
    this.steps = [];
    this._startTime = Date.now();
  }

  record(step, status, detail = '') {
    this.steps.push({ step, status, detail, timestamp: new Date().toISOString() });
  }

  print(log) {
    const elapsed = ((Date.now() - this._startTime) / 1000).toFixed(1);
    log.section('DEPLOYMENT SUMMARY');

    const maxStep = Math.max(...this.steps.map((s) => s.step.length), 10);
    const header = `${'Step'.padEnd(maxStep + 2)}Status     Detail`;
    console.log(header);
    console.log('-'.repeat(header.length + 20));

    let okCount = 0, failCount = 0, skipCount = 0;
    for (const s of this.steps) {
      const icon = s.status === 'OK' ? 'OK' : s.status === 'SKIP' ? 'SKIP' : 'FAIL';
      console.log(`${s.step.padEnd(maxStep + 2)}${icon.padEnd(11)}${s.detail}`);
      if (s.status === 'OK')   okCount++;
      if (s.status === 'FAIL') failCount++;
      if (s.status === 'SKIP') skipCount++;
    }

    console.log('-'.repeat(header.length + 20));
    console.log(`Total: ${this.steps.length} steps | OK: ${okCount} | Failed: ${failCount} | Skipped: ${skipCount} | Duration: ${elapsed}s`);
    console.log('');

    return failCount;
  }
}

// ---------------------------------------------------------------------------
//  Post-deployment checklist
// ---------------------------------------------------------------------------

function printChecklist(report, enabled, log) {
  log.section('POST-DEPLOYMENT CHECKLIST');

  const okSteps = new Set(report.steps.filter((s) => s.status === 'OK').map((s) => s.step.toLowerCase()));

  const manualSteps = {
    spaces: [
      'Assign users/groups to shared and managed spaces',
      'Verify space permissions for demo presenters',
    ],
    connections: [
      "Test each data connection (click 'Test Connection' in the UI)",
      'Verify tables/topics are visible through each connection',
      'Configure CDC Cluster for PostgreSQL + Salesforce pipelines',
      'Configure Streaming Cluster for Kafka IoT pipelines',
    ],
    theme: [
      'Apply MCG Dark Theme to both analytics apps (App Settings → Theme)',
      'Verify MCG logo appears in app headers',
    ],
    apps: [
      'Open both domain apps and verify data loads correctly:',
      '  • MCG Supply Chain Operations (5 Gold tables + streaming IoT)',
      '  • MCG Delivery & Customer Experience (3 Gold tables + streaming carrier events)',
      'Set up scheduled reloads (every 5 min for streaming data)',
      'Configure Business Logic for Qlik Answers in each app',
      'Publish apps from Development → Published space',
    ],
    knowledge: [
      'Wait for document indexing to complete (5-10 min)',
      'Verify upload count matches expected 25 documents',
    ],
    assistant: [
      'Test each conversation starter in the Qlik Answers UI',
      'Verify answers reference correct source documents',
    ],
    automations: [
      'Open each automation in the Automation Designer',
      'Configure block details (see deploy/automation_guide.md)',
      'Set Teams webhook URLs in webhook blocks',
      'Configure Talend Address Correction automation trigger',
      "Enable automations and test with 'Run Now'",
    ],
    dataproducts: [
      'Verify data products have data flowing from Gold tables',
      'Enable API sharing for key data products (governance capability)',
      'Review AI-Driven Descriptions and column-level metadata',
      'Review Semantic Types and AI-Suggested Validation Rules',
      'Configure refresh schedules',
    ],
    glossary: [
      'Review and approve glossary terms',
      'Link terms to relevant data products and datasets',
    ],
  };

  const alwaysManual = [
    ['Open Lakehouse',     'Configure Bronze/Silver/Gold layers in Qlik Cloud UI (see creation_guide.md §1)'],
    ['Data Flows',         'Build 8 transformation flows + Talend address validation job (see creation_guide.md §1.3)'],
    ['Table Recipes',      'Create 7 Gold-layer table recipes from Silver tables (see creation_guide.md §1.4)'],
    ['Qlik Predict',       'Create AutoML experiments for Spoilage Risk & SLA Prediction (see creation_guide.md §4)'],
    ['Stewardship',        'Create 4 stewardship campaigns (see demo_checklist.md Phase 8)'],
    ['Discovery Agent',    'Enable Discovery Agent on data products and set alert thresholds'],
    ['MCP Server',         'Install and configure Qlik MCP server (see setup_guide.md §13)'],
  ];

  const components = [
    ['spaces',       'Create Spaces (shared + managed)'],
    ['connections',  'Create Data Connections (PostgreSQL, Salesforce, Kafka, S3)'],
    ['theme',        'Upload MCG Dark Theme Extension'],
    ['apps',         'Import & Publish Analytics Apps (.qvf)'],
    ['knowledge',    'Create Qlik Answers Knowledge Base + Upload Documents'],
    ['assistant',    'Create Qlik Answers Assistant'],
    ['automations',  'Create Automations (scheduled reloads, alerts, Talend address correction)'],
    ['dataproducts', 'Create Data Products (Gold layer definitions)'],
    ['glossary',     'Create Business Glossary Terms'],
    ['webhooks',     'Create Webhooks (app reload + pipeline health events)'],
    ['reloadtasks',  'Create Reload Tasks (scheduled app refreshes)'],
  ];

  let idx = 1;

  for (const [key, label] of components) {
    if (!enabled[key]) continue;
    const steps = manualSteps[key] || [];
    const componentOk = [...okSteps].some((s) => s.includes(key));
    if (!steps.length || !componentOk) continue;
    console.log(`\n  ${label}:`);
    for (const step of steps) {
      console.log(`    ${String(idx).padStart(2)}. [ ] ${step}`);
      idx++;
    }
  }

  console.log('\n  Manual Configuration (UI-only — not automated):');
  for (const [label, desc] of alwaysManual) {
    console.log(`    ${String(idx).padStart(2)}. [ ] ${label}: ${desc}`);
    idx++;
  }

  console.log(`\n  Total manual steps remaining: ${idx - 1}`);
  console.log('  See deploy/demo_checklist.md for the full 13-phase checklist.\n');
}

// ---------------------------------------------------------------------------
//  Main deployment orchestrator
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  const log  = new Logger(args.verbose);
  const report = new DeploymentReport();

  log.section('MCG Qlik Cloud Deployment');
  log.info(`Config:  ${args.configPath}`);
  log.info(`Dry run: ${args.dryRun}`);
  log.info(`Verbose: ${args.verbose}`);

  // ---- Load config --------------------------------------------------------
  let cfg;
  try {
    cfg = loadConfig(args.configPath);
    applyEnvOverrides(cfg);
    // CLI flags override config
    if (args.dryRun)  cfg.options = cfg.options || {}, cfg.options.dryRun  = true;
    if (args.verbose) cfg.options = cfg.options || {}, cfg.options.verbose = true;
  } catch (err) {
    log.error(err.message);
    process.exit(EXIT_FAILURE);
  }

  const dryRun = cfg.options && cfg.options.dryRun;
  const continueOnError = cfg.options && cfg.options.continueOnError;
  if (cfg.options && cfg.options.verbose) log.verbose = true;

  const enabled = cfg.enabledComponents || {};
  const client = new QlikClient(cfg, log, dryRun);
  log.info(`Target: ${client.baseUrl}`);
  if (dryRun) log.warn('DRY RUN MODE — no changes will be made to Qlik Cloud.');

  // ---- Authenticate -------------------------------------------------------
  log.section('Step 1: Authentication');
  try {
    await client.authenticate();
    if (!(await client.verifyConnection())) {
      throw new Error('Could not verify connection to Qlik Cloud tenant.');
    }
    report.record('Authentication', 'OK', `method=${cfg.auth.method}`);
  } catch (err) {
    log.error(`Authentication failed: ${err.message}`);
    report.record('Authentication', 'FAIL', err.message);
    report.print(log);
    process.exit(EXIT_FAILURE);
  }

  // ---- Standalone cleanup mode ---------------------------------------------
  if (args.cleanupDataProducts) {
    log.section('Cleanup: Delete All Data Products');
    try {
      const { deleted, total } = await client.deleteAllDataProducts([]);
      log.success(`Deleted ${deleted} of ${total} data product(s) from tenant.`);
    } catch (err) {
      log.error(`Cleanup failed: ${err.message}`);
    }
    process.exit(EXIT_SUCCESS);
  }

  // ---- Standalone pipeline export mode --------------------------------------
  // Pulls the tenant's declarative pipeline project (YAML definitions) back
  // into the repo, so a project refined in the QTCP UI can be committed and
  // redeployed to any tenant.
  if (args.exportPipeline) {
    log.section('Export: Declarative Pipeline Projects');
    const pCfg = cfg.pipelines || {};
    const projectDefs = (Array.isArray(pCfg.projects) && pCfg.projects.length > 0)
      ? pCfg.projects
      : (pCfg.projectName || pCfg.sourceDir)
        ? [{ projectName: pCfg.projectName || 'MCG Batch Pipeline', sourceDir: pCfg.sourceDir }]
        : [
            { projectName: 'MCG Batch Pipeline',     sourceDir: './pipelines/mcg-batch-pipeline' },
            { projectName: 'MCG Streaming Pipeline', sourceDir: './pipelines/mcg-streaming-pipeline' },
          ];
    let failures = 0;
    for (const def of projectDefs) {
      try {
        const destDir = path.resolve(SCRIPT_DIR, def.sourceDir || '.');
        const project = await client.findDiProjectByName(def.projectName);
        if (!project) throw new Error(`DI project "${def.projectName}" not found on tenant.`);
        log.info(`Exporting "${def.projectName}" (${project.id}) → ${destDir}`);
        const zipBuf = await client.exportDiProject(project.id);
        const files = unzipToDirectory(zipBuf, destDir);
        log.success(`Exported ${files.length} file(s) for "${def.projectName}".`);
      } catch (err) {
        log.error(`Export failed for "${def.projectName}": ${err.message}`);
        failures++;
      }
    }
    log.info('Review the changes with git diff, then commit to version the pipelines.');
    process.exit(failures === 0 ? EXIT_SUCCESS : EXIT_FAILURE);
  }

  // ---- Docker Containers ---------------------------------------------------
  // Compose files live in infrastructure/ (not infrastructure/kafka/).
  // Each "profile" maps to a separate compose file:
  //   full-stack     → docker-compose.full-stack.yml   (Kafka + simulators)
  //   full-stack-dmg → docker-compose.full-stack-dmg.yml (Kafka + sims + DMG)
  //   kafka          → kafka/docker-compose.yml        (Kafka only)
  //   simulators     → docker-compose.simulators.yml   (simulators only)
  //   dmg            → docker-compose.dmg.yml          (DMG gateway only)
  const COMPOSE_FILES = {
    'full-stack':       'docker-compose.full-stack.yml',
    'full-stack-dmg':   'docker-compose.full-stack-dmg.yml',
    'kafka':            'kafka/docker-compose.yml',
    'simulators':       'docker-compose.simulators.yml',
    'simulators-dmg':   'docker-compose.simulators-dmg.yml',
    'dmg':              'docker-compose.dmg.yml',
  };

  if (enabled.docker !== false) {
    log.section('Step 2: Docker Containers');
    try {
      const infraDir = path.resolve(SCRIPT_DIR, '..', 'infrastructure');
      const profile = cfg.docker && cfg.docker.profile || 'full-stack';
      const composeFile = COMPOSE_FILES[profile];
      if (!composeFile) {
        throw new Error(`Unknown Docker profile: "${profile}". Valid: ${Object.keys(COMPOSE_FILES).join(', ')}`);
      }
      const composePath = path.join(infraDir, composeFile);
      if (!fs.existsSync(composePath)) {
        throw new Error(`Compose file not found: ${composePath}`);
      }
      if (dryRun) {
        log.success(`[DRY RUN] Would start Docker stack "${profile}" via ${composeFile}`);
      } else {
        // Check if containers are already running
        const psResult = spawnSync('docker', ['compose', '-f', composeFile, 'ps', '--status', 'running', '-q'], {
          cwd: infraDir, encoding: 'utf-8', timeout: 15000,
        });
        const runningIds = (psResult.stdout || '').trim().split('\n').filter(Boolean);

        if (runningIds.length > 0) {
          // Containers already up — report and continue
          const psNames = spawnSync('docker', ['compose', '-f', composeFile, 'ps', '--status', 'running', '--format', '{{.Name}}'], {
            cwd: infraDir, encoding: 'utf-8', timeout: 15000,
          });
          const names = (psNames.stdout || '').trim().split('\n').filter(Boolean);
          log.success(`Docker containers already running (${names.length} containers)`);
          for (const n of names) { log.info(`  ✓ ${n}`); }
        } else {
          // Clean up any stale/stopped containers to avoid name conflicts
          const psAllResult = spawnSync('docker', ['compose', '-f', composeFile, 'ps', '-a', '-q'], {
            cwd: infraDir, encoding: 'utf-8', timeout: 15000,
          });
          const staleIds = (psAllResult.stdout || '').trim().split('\n').filter(Boolean);
          if (staleIds.length > 0) {
            log.warn(`Found ${staleIds.length} stale container(s) — removing before fresh deploy...`);
            spawnSync('docker', ['compose', '-f', composeFile, 'down', '--remove-orphans'], {
              cwd: infraDir, encoding: 'utf-8', timeout: 60000,
            });
            log.info('Stale containers removed.');
          }
          // --- RPM resolution for DMG profiles ---
          const isDmg = (profile === 'dmg' || profile === 'full-stack-dmg');
          if (isDmg) {
            const rpmDir = path.join(infraDir, 'dmg', 'gateway', 'rpmfiles');
            const rpmDest = path.join(rpmDir, 'gateway.rpm');
            const rpmPath = cfg.docker && cfg.docker.rpmPath || '';
            const rpmUrl = cfg.docker && cfg.docker.rpmUrl || '';

            if (fs.existsSync(rpmDest) && fs.statSync(rpmDest).size > 0) {
              log.info('Gateway RPM already in build context — skipping download');
            } else if (rpmPath) {
              log.info(`Resolving RPM from local path: ${rpmPath}`);
              if (!fs.existsSync(rpmPath)) {
                throw new Error(`RPM file not found at: ${rpmPath}`);
              }
              if (!fs.existsSync(rpmDir)) fs.mkdirSync(rpmDir, { recursive: true });
              fs.copyFileSync(rpmPath, rpmDest);
              log.success(`Copied RPM to build context: ${rpmDest}`);
            } else if (rpmUrl) {
              log.info(`Downloading RPM from: ${rpmUrl}`);
              if (!fs.existsSync(rpmDir)) fs.mkdirSync(rpmDir, { recursive: true });
              await new Promise((resolve, reject) => {
                const dl = spawn('curl', ['-L', '-f', '-o', rpmDest, '--progress-bar', rpmUrl], {
                  cwd: infraDir, stdio: ['ignore', 'pipe', 'pipe'],
                });
                dl.stderr.on('data', (d) => {
                  d.toString().trim().split('\n').forEach(l => l.trim() && log.info(l.trim()));
                });
                dl.on('close', (code) => {
                  if (code === 0) resolve();
                  else reject(new Error(`RPM download failed (curl exit code ${code})`));
                });
                dl.on('error', reject);
              });
              log.success(`RPM downloaded to build context: ${rpmDest}`);
            } else if (!fs.existsSync(rpmDest)) {
              const rpmFiles = fs.existsSync(rpmDir) ? fs.readdirSync(rpmDir).filter(f => f.endsWith('.rpm')) : [];
              if (rpmFiles.length === 0) {
                throw new Error('Gateway RPM not found. Provide a file path or download URL in Docker config.');
              }
              log.info(`Found RPM in build context: ${rpmFiles[0]}`);
            } else {
              log.info('Gateway RPM found in build context');
            }
          }

          const dockerArgs = ['compose', '-f', composeFile, 'up', '-d'];
          if (isDmg) dockerArgs.push('--build');

          log.info(`Starting Docker Compose (${profile})... this may take several minutes on first pull`);
          log.info(`Compose file: ${composeFile}`);
          await new Promise((resolve, reject) => {
            const child = spawn('docker', dockerArgs, {
              cwd: infraDir, stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stderr = '';
            child.stdout.on('data', (d) => { d.toString().trim().split('\n').forEach(l => l.trim() && log.info(l.trim())); });
            child.stderr.on('data', (d) => { const s = d.toString(); stderr += s; s.trim().split('\n').forEach(l => l.trim() && log.info(l.trim())); });
            child.on('close', (code) => {
              if (code === 0) { resolve(); }
              else { reject(new Error(`docker compose exited with code ${code}\n${stderr.slice(-500)}`)); }
            });
            child.on('error', reject);
          });
          log.success(`Docker containers started (${profile})`);
        }
      }
      report.record('Docker Containers', 'OK', `profile=${profile}`);
    } catch (err) {
      log.error(`Docker step failed: ${err.message}`);
      report.record('Docker Containers', 'FAIL', err.message);
      if (!continueOnError) { report.print(log); process.exit(EXIT_FAILURE); }
    }
  } else {
    log.section('Step 2: Docker Containers');
    log.info('Skipped (disabled).');
    report.record('Docker Containers', 'SKIP', 'disabled');
  }

  // ---- Create Spaces ------------------------------------------------------
  let sharedSpace, managedSpace;

  if (enabled.spaces !== false) {
    log.section('Step 3: Create Spaces');
    try {
      const sharedName  = (cfg.spaces && cfg.spaces.shared)  || 'MCG Demo - Development';
      const managedName = (cfg.spaces && cfg.spaces.managed)  || 'MCG Demo - Published';

      sharedSpace  = await client.createSpace(sharedName, 'shared');
      report.record('Space (shared)', 'OK', `"${sharedName}" id=${sharedSpace.id}`);

      managedSpace = await client.createSpace(managedName, 'managed');
      report.record('Space (managed)', 'OK', `"${managedName}" id=${managedSpace.id}`);
    } catch (err) {
      log.error(`Space creation failed: ${err.message}`);
      report.record('Spaces', 'FAIL', err.message);
      if (!continueOnError) { report.print(log); process.exit(EXIT_FAILURE); }
    }
  } else {
    log.section('Step 3: Create Spaces');
    log.info('Skipped (disabled).');
    report.record('Spaces', 'SKIP', 'disabled');
  }

  // ---- Create Data Connections --------------------------------------------
  if (enabled.connections !== false) {
    log.section('Step 4: Create Data Connections');

    const connectionDefs = [
      { key: 'postgresql', keyword: 'postgres',   buildProps: buildPostgresProperties,   label: 'PostgreSQL (MCG WMS)',    required: ['host', 'database'] },
      { key: 'salesforce', keyword: 'sfdc',        buildProps: buildSalesforceProperties, label: 'Salesforce (MCG CRM)',   required: ['username', 'password'] },
      { key: 'kafka',      keyword: 'kafka',      buildProps: buildKafkaProperties,      label: 'Kafka (IoT Telemetry)',  required: ['bootstrapServers'] },
      { key: 's3',         keyword: 's3',          buildProps: buildS3Properties,          label: 'S3 (Flat File Outputs)', required: ['bucketName', 'region'] },
    ];

    for (const def of connectionDefs) {
      const connCfg = cfg.dataConnections && cfg.dataConnections[def.key];
      if (!connCfg) {
        log.warn(`No config for ${def.label} — skipping.`);
        report.record(`Connection: ${def.label}`, 'SKIP', 'Not configured');
        continue;
      }
      // Skip if required credential fields are empty
      const missing = (def.required || []).filter(f => !connCfg[f]);
      if (missing.length > 0) {
        log.warn(`${def.label}: missing required fields (${missing.join(', ')}) — skipping. Configure in Qlik Cloud UI.`);
        report.record(`Connection: ${def.label}`, 'SKIP', `Missing: ${missing.join(', ')}`);
        continue;
      }

      try {
        log.info(`Discovering data source type for: ${def.keyword}`);
        const dataSource = await client.discoverDataSourceByType(def.keyword);
        const dataSourceId = dataSource ? (dataSource.dataSourceId || dataSource.dataSourceType || dataSource.sourceType || def.keyword) : def.keyword;

        if (dataSource) {
          log.debug(`Found data source: ${dataSource.dataSourceName || dataSource.name || dataSourceId} (id=${dataSourceId}, provider=${dataSource.provider || 'n/a'})`);
        } else {
          log.warn(`Data source type "${def.keyword}" not found via discovery — using keyword as fallback.`);
        }

        const props = def.buildProps(connCfg);
        await client.createDataConnection(
          connCfg.name || `MCG ${def.label}`,
          dataSourceId,
          props,
          sharedSpace ? sharedSpace.id : undefined,
          dataSource
        );
        report.record(`Connection: ${def.label}`, 'OK', connCfg.name);
      } catch (err) {
        log.error(`${def.label}: ${err.message}`);
        report.record(`Connection: ${def.label}`, 'FAIL', err.message);
        if (!continueOnError) { report.print(log); process.exit(EXIT_FAILURE); }
      }
    }
  } else {
    log.section('Step 4: Create Data Connections');
    log.info('Skipped (disabled).');
    report.record('Data Connections', 'SKIP', 'disabled');
  }

  // ---- Upload Theme -------------------------------------------------------
  if (enabled.theme !== false) {
    log.section('Step 5: Upload MCG Dark Theme');

    const themeZip = path.resolve(SCRIPT_DIR, (cfg.theme && cfg.theme.sourceFile) || './themes/mcg-dark-theme.zip');
    if (fs.existsSync(themeZip)) {
      try {
        await client.uploadTheme(themeZip);
        report.record('Theme Upload', 'OK', path.basename(themeZip));
      } catch (err) {
        log.error(`Theme upload failed: ${err.message}`);
        report.record('Theme Upload', 'FAIL', err.message);
        if (!continueOnError) { report.print(log); process.exit(EXIT_FAILURE); }
      }
    } else {
      log.warn(`Theme file not found: ${themeZip}`);
      report.record('Theme Upload', 'SKIP', 'mcg-dark-theme.zip not found');
    }
  } else {
    log.section('Step 5: Upload MCG Dark Theme');
    log.info('Skipped (disabled).');
    report.record('Theme Upload', 'SKIP', 'disabled');
  }

  // ---- Create Knowledge Base & Upload Documents ---------------------------
  let knowledgeBase = null;
  let kbDatasource  = null;

  if (enabled.knowledge !== false) {
    log.section('Step 6: Create Knowledge Base for Qlik Answers');

    try {
      const kbName = (cfg.knowledgeBase && cfg.knowledgeBase.name) || 'MCG Operations Knowledge Base';
      const kbDesc = (cfg.knowledgeBase && cfg.knowledgeBase.description) || '';

      knowledgeBase = await client.createKnowledgeBase(kbName, kbDesc);
      report.record('Knowledge Base', 'OK', `"${kbName}" id=${knowledgeBase.id}`);

      kbDatasource = await client.createKBFileDatasource(knowledgeBase.id, 'MCG Documents');
      if (kbDatasource.notAvailable) {
        report.record('KB Datasource', 'SKIP', 'Tenant configuration issue — skipping uploads');
      } else {
        report.record('KB Datasource', 'OK', `id=${kbDatasource.id}`);

      const docsDir = path.resolve(SCRIPT_DIR, (cfg.documents && cfg.documents.sourceDir) || '../documents');
      const allDocxFiles = findFiles(docsDir, '.docx');

      // Filter: only operational documents (exclude demo-scripts and top-level guides)
      const docxFiles = allDocxFiles.filter(f => {
        const rel = path.relative(docsDir, f).replace(/\\/g, '/');
        if (rel.startsWith('demo-scripts/')) return false;
        const base = path.basename(f);
        if (!rel.includes('/') && (base.startsWith('MCG_Setup_Guide') || base.startsWith('MCG_Creation_Guide'))) return false;
        return true;
      });

      if (docxFiles.length === 0) {
        log.warn(`No operational .docx files found in ${docsDir}`);
        report.record('Document Upload', 'SKIP', 'No operational .docx files found');
      } else {
        log.info(`Found ${docxFiles.length} operational .docx file(s) to upload (${allDocxFiles.length} total, ${allDocxFiles.length - docxFiles.length} excluded).`);
        let uploaded = 0;
        let failed   = 0;

        for (const docPath of docxFiles) {
          try {
            await client.uploadDocumentToKB(knowledgeBase.id, kbDatasource.id, docPath);
            uploaded++;
          } catch (err) {
            log.error(`Upload failed for "${path.basename(docPath)}": ${err.message}`);
            failed++;
            if (!continueOnError) throw err;
          }
        }
        log.success(`Uploaded ${uploaded}/${docxFiles.length} documents (${failed} failed).`);
        report.record('Document Upload', failed === 0 ? 'OK' : 'FAIL', `${uploaded} uploaded, ${failed} failed`);
      }

      log.info('Triggering knowledge base sync/indexing...');
      await client.syncKBDatasource(knowledgeBase.id, kbDatasource.id);
      report.record('KB Sync', 'OK', 'Indexing triggered');
      } // end if !notAvailable
    } catch (err) {
      log.error(`Knowledge base setup failed: ${err.message}`);
      report.record('Knowledge Base', 'FAIL', err.message);
      if (!continueOnError) { report.print(log); process.exit(EXIT_FAILURE); }
    }
  } else {
    log.section('Step 6: Create Knowledge Base for Qlik Answers');
    log.info('Skipped (disabled).');
    report.record('Knowledge Base', 'SKIP', 'disabled');
  }

  // ---- Create Assistant ---------------------------------------------------
  if (enabled.assistant !== false) {
    log.section('Step 7: Create Qlik Answers Assistant');

    try {
      const astCfg = cfg.assistant || {};
      const assistant = await client.createAssistant({
        name: astCfg.name || 'MCG Operations Assistant',
        description: astCfg.description || 'AI assistant for Meridian Commerce Group operations.',
        knowledgeBaseId: knowledgeBase ? knowledgeBase.id : undefined,
        conversationStarters: astCfg.conversationStarters || [
          'What is the procedure for goods receiving?',
          'What happened during the Rotterdam pipeline failure?',
          'What are the cold chain temperature requirements?',
          'What is Project CLARITY?',
          'What was the lettuce recall and what went wrong?',
        ],
      });
      report.record('Assistant', 'OK', `"${assistant.name}" id=${assistant.id}`);
    } catch (err) {
      log.error(`Assistant creation failed: ${err.message}`);
      report.record('Assistant', 'FAIL', err.message);
      if (!continueOnError) { report.print(log); process.exit(EXIT_FAILURE); }
    }
  } else {
    log.section('Step 7: Create Qlik Answers Assistant');
    log.info('Skipped (disabled).');
    report.record('Assistant', 'SKIP', 'disabled');
  }

  // ---- Create Automations -------------------------------------------------
  if (enabled.automations !== false) {
    log.section('Step 8: Create Automations');

    const spaceId = sharedSpace ? sharedSpace.id : undefined;

    const automationDefs = [
      ['MCG Daily App Reload',
       'Scheduled daily reload of MCG analytics apps at 06:00 UTC.'],
      ['MCG Address Correction — Talend Job Trigger',
       'Triggered by new Stewardship tasks in the Address Cleanup campaign. '
       + 'Runs the Talend Address Validation Service job on flagged records, writes corrected '
       + 'addresses back to silver.customers_deduped, and resolves the stewardship task.'],
    ];

    // Load additional automations from JSON templates
    const autoDir = path.resolve(SCRIPT_DIR, (cfg.automations && cfg.automations.templateDir) || './automations');
    if (fs.existsSync(autoDir)) {
      const templates = fs.readdirSync(autoDir).filter((f) => f.endsWith('.json')).sort();
      if (templates.length) log.info(`Found ${templates.length} automation template(s) in ${path.basename(autoDir)}/`);
      for (const tplFile of templates) {
        try {
          const tpl = JSON.parse(fs.readFileSync(path.join(autoDir, tplFile), 'utf-8'));
          const tplName = tpl.name || path.basename(tplFile, '.json');
          const tplDesc = tpl.description || '';
          if (!automationDefs.some(([n]) => n === tplName)) {
            automationDefs.push([tplName, tplDesc]);
            log.debug(`Loaded template: "${tplName}" from ${tplFile}`);
          }
        } catch (err) {
          log.warn(`Could not parse automation template "${tplFile}": ${err.message}`);
        }
      }
    }

    for (const [autoName, autoDesc] of automationDefs) {
      try {
        await client.createAutomation(autoName, autoDesc, spaceId);
        report.record(`Automation: ${autoName}`, 'OK', 'Created (disabled)');
      } catch (err) {
        log.error(`Automation "${autoName}": ${err.message}`);
        report.record(`Automation: ${autoName}`, 'FAIL', err.message);
        if (!continueOnError) { report.print(log); process.exit(EXIT_FAILURE); }
      }
    }
    log.info('Automations created in DISABLED state — configure triggers in Qlik Cloud console.');
  } else {
    log.section('Step 8: Create Automations');
    log.info('Skipped (disabled).');
    report.record('Automations', 'SKIP', 'disabled');
  }

  // ---- Create Data Products -----------------------------------------------
  if (enabled.dataproducts !== false) {
    log.section('Step 9: Create Data Products (Gold Layer)');

    const dpFile = path.resolve(SCRIPT_DIR, (cfg.dataProducts && cfg.dataProducts.sourceFile) || './data_products.json');
    if (fs.existsSync(dpFile)) {
      try {
        const dpData = JSON.parse(fs.readFileSync(dpFile, 'utf-8'));
        const products = dpData.dataProducts || [];
        log.info(`Found ${products.length} data product definition(s) in ${path.basename(dpFile)}`);
        const spaceId = sharedSpace ? sharedSpace.id : undefined;

        // Clean up stale data products not in current definitions
        const desiredNames = products.map(p => p.name);
        try {
          const { deleted: staleDeleted } = await client.deleteAllDataProducts(desiredNames);
          if (staleDeleted > 0) {
            log.success(`Removed ${staleDeleted} stale data product(s) not in current definitions.`);
          }
        } catch (cleanupErr) {
          log.warn(`Data product cleanup failed (non-fatal): ${cleanupErr.message}`);
        }

        let created = 0, skipped = 0, failedDp = 0;
        for (const dpDef of products) {
          try {
            const result = await client.createDataProduct({
              name: dpDef.name,
              description: dpDef.description || '',
              tags: dpDef.tags,
              owner: dpDef.owner,
              sla: dpDef.sla,
              schema: dpDef.schema,
              apiSharing: dpDef.apiSharing || false,
              spaceId,
            });
            if (result.notAvailable || result.alreadyExists) skipped++;
            else created++;
          } catch (err) {
            log.error(`Data product "${dpDef.name}": ${err.message}`);
            failedDp++;
            if (!continueOnError) throw err;
          }
        }
        log.success(`Data products: ${created} created, ${skipped} skipped, ${failedDp} failed.`);
        report.record('Data Products', failedDp === 0 ? 'OK' : 'FAIL',
          `${created} created, ${skipped} skipped, ${failedDp} failed`);
      } catch (err) {
        log.error(`Data products step failed: ${err.message}`);
        report.record('Data Products', 'FAIL', err.message);
        if (!continueOnError) { report.print(log); process.exit(EXIT_FAILURE); }
      }
    } else {
      log.warn(`${path.basename(dpFile)} not found — skipping data products.`);
      report.record('Data Products', 'SKIP', 'No definitions file found');
    }
  } else {
    log.section('Step 9: Create Data Products (Gold Layer)');
    log.info('Skipped (disabled).');
    report.record('Data Products', 'SKIP', 'disabled');
  }

  // ---- Create Business Glossary -------------------------------------------
  if (enabled.glossary !== false) {
    log.section('Step 10: Create Business Glossary Terms');

    const glFile = path.resolve(SCRIPT_DIR, (cfg.glossary && cfg.glossary.sourceFile) || './glossary_terms.json');
    if (fs.existsSync(glFile)) {
      try {
        const glData = JSON.parse(fs.readFileSync(glFile, 'utf-8'));
        const glMeta = glData.glossary || {};
        const terms  = glData.terms || [];
        log.info(`Found ${terms.length} glossary term(s) in ${path.basename(glFile)}`);

        const glossary = await client.createGlossary(
          glMeta.name || 'MCG Supply Chain Glossary',
          glMeta.description || ''
        );

        if (glossary.notAvailable) {
          log.warn('Glossary API not available — skipping terms.');
          report.record('Glossary', 'SKIP', 'API not available (requires Talend Enterprise)');
        } else {
          const glossaryId = glossary.id || '';
          report.record('Glossary', glossaryId ? 'OK' : 'SKIP',
            `"${glMeta.name || ''}" id=${glossaryId}`);

          if (glossaryId && glossaryId !== 'dry-run-glossary-id') {
            const existingTerms = await client.listGlossaryTerms(glossaryId);
            if (existingTerms.length > 0) {
              log.info(`Found ${existingTerms.length} existing term(s) in glossary — will skip duplicates.`);
            }
            let createdT = 0, skippedT = 0, failedT = 0;
            for (const term of terms) {
              try {
                const result = await client.createGlossaryTerm(glossaryId, {
                  name: term.name,
                  definition: term.definition || '',
                  category: term.category || '',
                  tags: term.tags,
                }, existingTerms);
                if (result.alreadyExists) skippedT++;
                else createdT++;
              } catch (err) {
                log.error(`Term "${term.name}": ${err.message}`);
                failedT++;
                if (!continueOnError) throw err;
              }
            }
            log.success(`Glossary terms: ${createdT} created, ${skippedT} skipped, ${failedT} failed.`);
            report.record('Glossary Terms', failedT === 0 ? 'OK' : 'FAIL',
              `${createdT} created, ${skippedT} skipped`);
          } else if (glossaryId === 'dry-run-glossary-id') {
            log.info(`DRY RUN: Would create ${terms.length} glossary terms.`);
            report.record('Glossary Terms', 'OK', `DRY RUN: ${terms.length} terms`);
          }
        }
      } catch (err) {
        log.error(`Glossary step failed: ${err.message}`);
        report.record('Glossary', 'FAIL', err.message);
        if (!continueOnError) { report.print(log); process.exit(EXIT_FAILURE); }
      }
    } else {
      log.warn(`${path.basename(glFile)} not found — skipping glossary.`);
      report.record('Glossary', 'SKIP', 'No definitions file found');
    }
  } else {
    log.section('Step 10: Create Business Glossary Terms');
    log.info('Skipped (disabled).');
    report.record('Glossary', 'SKIP', 'disabled');
  }

  // ---- Step 11: Webhooks --------------------------------------------------
  if (enabled.webhooks !== false) {
    log.section('Step 11: Create Webhooks');

    const webhookDefs = (cfg.webhooks && cfg.webhooks.definitions) || [
      {
        name: 'MCG App Reload Completed',
        url: (cfg.webhooks && cfg.webhooks.targetUrl) || 'https://your-endpoint.example.com/hooks/qlik-reload',
        eventTypes: ['com.qlik.v1.app.reload.finished'],
        description: 'Fires after any MCG analytics app reload completes — triggers downstream refresh notifications',
        enabled: true,
      },
      {
        name: 'MCG Pipeline Health Alert',
        url: (cfg.webhooks && cfg.webhooks.targetUrl) || 'https://your-endpoint.example.com/hooks/qlik-pipeline',
        eventTypes: ['com.qlik.v1.datafile.created', 'com.qlik.v1.datafile.updated'],
        description: 'Fires on data file events — used as proxy for pipeline health monitoring',
        enabled: true,
      },
    ];

    for (const hook of webhookDefs) {
      try {
        await client.createWebhook(hook);
        report.record('Webhook', 'OK', hook.name);
      } catch (err) {
        log.warn(`Webhook "${hook.name}": ${err.message} — skipping (non-fatal).`);
        report.record('Webhook', 'WARN', `${hook.name}: ${err.message}`);
      }
    }
  } else {
    log.section('Step 11: Create Webhooks');
    log.info('Skipped (disabled).');
    report.record('Webhooks', 'SKIP', 'disabled');
  }

  // ---- Step 12: Reload Tasks ----------------------------------------------
  if (enabled.reloadtasks !== false) {
    log.section('Step 12: Create Reload Tasks');

    const reloadTaskDefs = (cfg.reloadtasks && cfg.reloadtasks.definitions) || [];

    if (reloadTaskDefs.length === 0) {
      log.info('No reload task definitions found in config — using defaults (app IDs must be set in config.reloadtasks.definitions).');
      log.info('Example config entry:');
      log.info('  "reloadtasks": { "definitions": [{ "name": "MCG Supply Chain Reload", "appId": "<app-id>", "cronExpression": "0 */15 * * * *", "timeZone": "UTC" }] }');
      report.record('Reload Tasks', 'SKIP', 'No definitions configured — add app IDs to config.reloadtasks.definitions');
    } else {
      for (const task of reloadTaskDefs) {
        if (!task.appId) {
          log.warn(`Reload task "${task.name}" missing appId — skipping.`);
          report.record('Reload Task', 'SKIP', `${task.name}: no appId`);
          continue;
        }
        try {
          await client.createReloadTask(task);
          report.record('Reload Task', 'OK', `${task.name} (cron: ${task.cronExpression})`);
        } catch (err) {
          log.warn(`Reload task "${task.name}": ${err.message} — skipping (non-fatal).`);
          report.record('Reload Task', 'WARN', `${task.name}: ${err.message}`);
        }
      }
    }
  } else {
    log.section('Step 12: Create Reload Tasks');
    log.info('Skipped (disabled).');
    report.record('Reload Tasks', 'SKIP', 'disabled');
  }

  // ---- Step 13: Declarative Data Pipeline -----------------------------------
  if (enabled.pipelines !== false) {
    log.section('Step 13: Import Declarative Data Pipelines');
    const pCfg = cfg.pipelines || {};

    // Project list: pipelines.projects[] (preferred), legacy single-project
    // fields, or the two repo defaults (batch + streaming).
    const projectDefs = (Array.isArray(pCfg.projects) && pCfg.projects.length > 0)
      ? pCfg.projects
      : (pCfg.projectName || pCfg.sourceDir)
        ? [{ projectName: pCfg.projectName || 'MCG Batch Pipeline', sourceDir: pCfg.sourceDir }]
        : [
            { projectName: 'MCG Batch Pipeline',     sourceDir: './pipelines/mcg-batch-pipeline' },
            { projectName: 'MCG Streaming Pipeline', sourceDir: './pipelines/mcg-streaming-pipeline' },
          ];

    // Resolve the target space once for all projects + dataset attachment.
    let spaceId = sharedSpace ? sharedSpace.id : undefined;
    if (!spaceId && !dryRun && cfg.spaces && cfg.spaces.shared) {
      try {
        const found = await client.findSpaceByName(cfg.spaces.shared);
        if (found) spaceId = found.id;
      } catch (err) {
        log.debug(`Space lookup failed: ${err.message}`);
      }
    }

    const rank = (t) => {
      const ty = String(t.type || '').toUpperCase();
      const nm = String(t.name || '').toLowerCase();
      if (ty.includes('LANDING') || /landing/.test(nm)) return 0;
      if (ty.includes('STORAGE') || /storage/.test(nm)) return 1;
      if (ty.includes('TRANSFORM') || /transform/.test(nm)) return 2;
      return 3; // datamart and everything downstream
    };

    for (const def of projectDefs) {
      const projectName = def.projectName || path.basename(def.sourceDir || 'pipeline');
      const reportKey = `Pipeline: ${projectName}`;
      try {
        const srcDir = path.resolve(SCRIPT_DIR, def.sourceDir || '.');
        if (!fs.existsSync(path.join(srcDir, 'qtcp_project.yaml'))) {
          log.warn(`No declarative project found at ${srcDir} — skipping "${projectName}".`);
          report.record(reportKey, 'SKIP', 'qtcp_project.yaml not found');
          continue;
        }
        const zipBuf = zipDirectory(srcDir, {
          exclude: ['README.md', 'schema', '.vscode', '.github', '.gitignore', 'CLAUDE.md'],
        });
        log.info(`Packaged "${projectName}" (${(zipBuf.length / 1024).toFixed(1)} KB) from ${path.relative(PROJECT_DIR, srcDir)}`);

        if (dryRun) {
          log.info(`DRY RUN: Would validate, create/find DI project "${projectName}", import, resolve bindings${pCfg.prepare ? ', prepare' : ''}${pCfg.run ? ', start tasks' : ''}.`);
          report.record(reportKey, 'OK', 'dry run — packaged only');
          continue;
        }

        // 1. Pre-validate the definitions ZIP (preview utility endpoint)
        const validation = await client.validateProjectDefinitions(zipBuf);
        if (validation.available === false) {
          log.warn('Validate-definitions API not available on this tenant — continuing without pre-validation.');
        } else if (validation.ok === false) {
          throw new Error(`Project definitions failed validation: ${validation.detail}`);
        } else {
          log.success(`"${projectName}" definitions validated.`);
        }

        // 2. Create (or reuse) the DI project in the shared space
        const project = await client.createDiProject({
          name: projectName,
          description: def.description || `MCG declarative pipeline — imported from ${path.basename(srcDir)} YAML definitions.`,
          spaceId,
          platformType: def.platformType || pCfg.platformType || 'QLIK_OPEN_LAKEHOUSE',
        });

        // 3. Import the YAML definitions
        await client.importDiProject(project.id, zipBuf);
        log.success(`Imported definitions into "${projectName}" (${project.id}).`);

        // 4. Resolve binding variables against this tenant and push them
        const variables = await resolvePipelineBindings(client, cfg, log, srcDir);
        if (Object.keys(variables).length > 0) {
          await client.updateDiProjectBindings(project.id, variables);
          log.success(`Set ${Object.keys(variables).length} binding variable(s) (connections, schemas, clusters).`);
        } else {
          log.warn('No binding variables resolved — set them in the QTCP UI or cfg.pipelines.bindings.');
        }

        // 5. Optionally prepare (creates physical artifacts on the platform)
        if (pCfg.prepare === true) {
          await client.prepareDiProject(project.id);
          log.success(`"${projectName}" prepared — tasks are ready to run.`);
        } else {
          log.info('Skipping prepare (set pipelines.prepare=true to prepare tasks automatically).');
        }

        // 6. Optionally start tasks in dependency order (landing → transform → datamart).
        //    Schedules are declared in the YAML (qtcp_tasks/*/schedule.yaml) and
        //    become active once tasks are running.
        if (pCfg.run === true && pCfg.prepare === true) {
          const tasks = await client.listDiTasks(project.id);
          const ordered = [...tasks].sort((a, b) => rank(a) - rank(b));
          log.info(`Starting ${ordered.length} task(s) in dependency order…`);
          for (const t of ordered) {
            try {
              await client.startDiTask(project.id, t.id, t.name);
            } catch (err) {
              log.warn(`  Could not start "${t.name}": ${err.message}`);
            }
          }
        } else if (pCfg.run === true) {
          log.warn('pipelines.run=true requires pipelines.prepare=true — skipping task start.');
        }

        report.record(reportKey, 'OK',
          `imported${pCfg.prepare ? ' + prepared' : ''}${pCfg.run && pCfg.prepare ? ' + started' : ''}`);
      } catch (err) {
        log.error(`Pipeline "${projectName}" deployment failed: ${err.message}`);
        report.record(reportKey, 'FAIL', err.message);
        if (!continueOnError) { report.print(log); process.exit(EXIT_FAILURE); }
      }
    }

    // Attach gold datasets to their data products (and optionally publish).
    // Runs once after all projects; dataset items exist in the catalog after
    // prepare/run, so misses are soft — re-deploy after the first pipeline run.
    if (pCfg.attachDatasets !== false) {
      if (dryRun) {
        log.info('DRY RUN: Would attach gold catalog datasets to their data products.');
        report.record('Dataset Attachment', 'OK', 'dry run');
      } else {
        try {
          const dpFile = path.join(SCRIPT_DIR, 'data_products.json');
          if (fs.existsSync(dpFile)) {
            const dpDefs = JSON.parse(fs.readFileSync(dpFile, 'utf-8'));
            const products = dpDefs.dataProducts || dpDefs;
            let attached = 0, missing = 0;
            for (const product of products) {
              const tables = product.sourceTables || (product.sourceTable ? [product.sourceTable] : []);
              if (tables.length === 0) continue;
              const datasetIds = [];
              for (const table of tables) {
                const bare = String(table).replace(/^(gold|silver|bronze)\./, '');
                const ds = await client.findDatasetByName(bare, spaceId);
                if (ds) datasetIds.push(ds.id);
                else { missing++; log.warn(`  Dataset "${bare}" not in catalog yet (pipeline not run?) — skipping for "${product.name}".`); }
              }
              if (datasetIds.length === 0) continue;
              const dp = await client.findDataProductByName(product.name, spaceId);
              if (!dp || !dp.id) {
                log.warn(`  Data product "${product.name}" not found — run the Data Products step first.`);
                continue;
              }
              await client.setDataProductDatasets(dp.id, datasetIds, { apiConsumable: !!product.apiSharing });
              log.success(`  Attached ${datasetIds.length} dataset(s) to "${product.name}".`);
              attached++;
              if (pCfg.publishDataProducts === true) {
                await client.activateDataProduct(dp.id, {
                  name: product.name,
                  description: product.description,
                  spaceId,
                });
              }
            }
            report.record('Dataset Attachment', 'OK',
              `${attached} product(s)${missing ? `, ${missing} table(s) not in catalog yet` : ''}`);
          } else {
            log.info('No data_products.json — skipping dataset attachment.');
            report.record('Dataset Attachment', 'SKIP', 'no data_products.json');
          }
        } catch (err) {
          log.error(`Dataset attachment failed: ${err.message}`);
          report.record('Dataset Attachment', 'FAIL', err.message);
          if (!continueOnError) { report.print(log); process.exit(EXIT_FAILURE); }
        }
      }
    }
  } else {
    log.section('Step 13: Import Declarative Data Pipelines');
    log.info('Skipped (disabled).');
    report.record('Declarative Pipelines', 'SKIP', 'disabled');
  }

  // ---- Final Report -------------------------------------------------------
  const failures = report.print(log);

  // ---- Post-Deployment Checklist ------------------------------------------
  printChecklist(report, enabled, log);

  if (failures > 0) {
    log.warn(`Deployment completed with ${failures} failure(s). Review the log above.`);
    process.exit(EXIT_FAILURE);
  } else {
    log.success('Deployment completed successfully.');
    process.exit(EXIT_SUCCESS);
  }
}

// ---------------------------------------------------------------------------
//  Entry point
// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(EXIT_FAILURE);
});
