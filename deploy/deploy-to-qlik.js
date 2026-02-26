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
  const args = { configPath: DEFAULT_CONFIG_PATH, dryRun: false, verbose: false };
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
  --config <path>   Path to config JSON (default: deploy/config.json)
  --dry-run         Preview actions without making API calls
  --verbose         Enable detailed logging
  --help            Show this message
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
  for (const key of Object.keys(obj)) {
    if (key.startsWith('comment_')) {
      delete obj[key];
    } else {
      stripCommentKeys(obj[key]);
    }
  }
}

function applyEnvOverrides(cfg) {
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
function request(method, reqUrl, { headers = {}, body = null, rawBody = null, timeout = 60000 } = {}) {
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

      const data = res.body.data || res.body;
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
    const query = spaceId
      ? { filter: `name eq "${name}" and spaceId eq "${spaceId}"` }
      : { filter: `name eq "${name}"` };
    const apps = await this._getAll('/api/v1/items', { resourceType: 'app', ...query });
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
    const sources = await this._getAll('/api/v1/data-sources');
    // Match by sourceType or name (case-insensitive substring)
    const kw = keyword.toLowerCase();
    return sources.find((s) =>
      (s.sourceType || '').toLowerCase().includes(kw) ||
      (s.name || '').toLowerCase().includes(kw) ||
      (s.dataSourceType || '').toLowerCase().includes(kw)
    ) || null;
  }

  async createDataConnection(name, dataSourceId, connectionProperties, spaceId) {
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
      ...connectionProperties,
    };

    const res = await this._post('/api/v1/data-connections', payload);
    if (res.statusCode === 200 || res.statusCode === 201) {
      const connId = res.body.qID || res.body.id;
      this.log.success(`Created data connection "${name}" (${connId})`);
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
    // Check existing datasources on this KB
    const existingDs = await this._getAll(`/api/v1/knowledgebases/${kbId}/datasources`);
    const found = existingDs.find((ds) => ds.name === name);
    if (found) {
      this.log.success(`KB datasource already exists: "${name}" (${found.id}) — skipping.`);
      return found;
    }

    if (this.dryRun) {
      this.log.info(`DRY RUN: Would create file datasource "${name}" on KB ${kbId}`);
      return { id: 'dry-run-ds-id', name };
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
    throw new Error(`Failed to create KB datasource (${res.statusCode}): ${JSON.stringify(res.body)}`);
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
    connectionProperties: {
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      schema: cfg.schema || 'public',
      sslMode: 'require',
    },
  };
}

function buildSalesforceProperties(cfg) {
  return {
    connectionProperties: {
      username: cfg.username,
      password: cfg.password,
      securityToken: cfg.securityToken,
      isSandbox: cfg.isSandbox || false,
    },
  };
}

function buildKafkaProperties(cfg) {
  return {
    connectionProperties: {
      bootstrapServers: cfg.bootstrapServers,
      topic: cfg.topic,
      securityProtocol: cfg.securityProtocol || 'SASL_SSL',
      saslMechanism: cfg.saslMechanism || 'PLAIN',
      saslUsername: cfg.saslUsername,
      saslPassword: cfg.saslPassword,
    },
  };
}

function buildS3Properties(cfg) {
  return {
    connectionProperties: {
      bucketName: cfg.bucketName,
      region: cfg.region,
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      prefix: cfg.prefix || '',
    },
  };
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

  const client = new QlikClient(cfg, log, dryRun);
  log.info(`Target: ${client.baseUrl}`);

  // ---- Authenticate -------------------------------------------------------
  log.section('Step 1: Authentication');
  try {
    await client.authenticate();
    report.record('Authentication', 'OK', `method=${cfg.auth.method}`);
  } catch (err) {
    log.error(`Authentication failed: ${err.message}`);
    report.record('Authentication', 'FAIL', err.message);
    report.print(log);
    process.exit(EXIT_FAILURE);
  }

  // ---- Create Spaces ------------------------------------------------------
  log.section('Step 2: Create Spaces');
  let sharedSpace, managedSpace;

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

  // ---- Import & Publish Apps ----------------------------------------------
  log.section('Step 3: Import & Publish Apps');
  const appsDir = path.resolve(SCRIPT_DIR, (cfg.apps && cfg.apps.sourceDir) || './apps');
  const qvfFiles = findFiles(appsDir, '.qvf');

  if (qvfFiles.length === 0) {
    log.warn(`No .qvf files found in ${appsDir} — skipping app import.`);
    report.record('App import', 'SKIP', 'No .qvf files found');
  } else {
    log.info(`Found ${qvfFiles.length} .qvf file(s) to import.`);
    for (const qvf of qvfFiles) {
      const baseName = path.basename(qvf, '.qvf');
      try {
        const app = await client.importApp(qvf, sharedSpace ? sharedSpace.id : 'unknown');
        report.record(`Import "${baseName}"`, 'OK', `id=${app.id}`);

        // Publish to managed space
        if (managedSpace && !app.alreadyExisted) {
          const pub = await client.publishApp(app.id, baseName, managedSpace.id);
          report.record(`Publish "${baseName}"`, 'OK', `published`);
        } else if (app.alreadyExisted) {
          report.record(`Publish "${baseName}"`, 'SKIP', 'App already existed');
        }
      } catch (err) {
        log.error(`App "${baseName}": ${err.message}`);
        report.record(`App "${baseName}"`, 'FAIL', err.message);
        if (!continueOnError) { report.print(log); process.exit(EXIT_FAILURE); }
      }
    }
  }

  // ---- Create Data Connections --------------------------------------------
  log.section('Step 4: Create Data Connections');

  const connectionDefs = [
    {
      key: 'postgresql',
      keyword: 'postgres',
      buildProps: buildPostgresProperties,
      label: 'PostgreSQL (MCG WMS)',
    },
    {
      key: 'salesforce',
      keyword: 'salesforce',
      buildProps: buildSalesforceProperties,
      label: 'Salesforce (MCG CRM)',
    },
    {
      key: 'kafka',
      keyword: 'kafka',
      buildProps: buildKafkaProperties,
      label: 'Kafka (IoT Telemetry)',
    },
    {
      key: 's3',
      keyword: 's3',
      buildProps: buildS3Properties,
      label: 'S3 (Flat File Outputs)',
    },
  ];

  for (const def of connectionDefs) {
    const connCfg = cfg.dataConnections && cfg.dataConnections[def.key];
    if (!connCfg) {
      log.warn(`No config for ${def.label} — skipping.`);
      report.record(`Connection: ${def.label}`, 'SKIP', 'Not configured');
      continue;
    }

    try {
      // Step 4a: Discover the data source type
      log.info(`Discovering data source type for: ${def.keyword}`);
      const dataSource = await client.discoverDataSourceByType(def.keyword);
      const dataSourceId = dataSource ? (dataSource.dataSourceType || dataSource.sourceType || dataSource.id || def.keyword) : def.keyword;

      if (dataSource) {
        log.debug(`Found data source: ${dataSource.name || dataSource.dataSourceType} (id=${dataSourceId})`);
      } else {
        log.warn(`Data source type "${def.keyword}" not found via discovery — using keyword as fallback.`);
      }

      // Step 4b: Build connection properties from config
      const props = def.buildProps(connCfg);

      // Step 4c: Create the connection
      await client.createDataConnection(
        connCfg.name || `MCG ${def.label}`,
        dataSourceId,
        props,
        sharedSpace ? sharedSpace.id : undefined
      );
      report.record(`Connection: ${def.label}`, 'OK', connCfg.name);
    } catch (err) {
      log.error(`${def.label}: ${err.message}`);
      report.record(`Connection: ${def.label}`, 'FAIL', err.message);
      if (!continueOnError) { report.print(log); process.exit(EXIT_FAILURE); }
    }
  }

  // ---- Create Knowledge Base & Upload Documents ---------------------------
  log.section('Step 5: Create Knowledge Base for Qlik Answers');

  let knowledgeBase = null;
  let kbDatasource  = null;

  try {
    const kbName = (cfg.knowledgeBase && cfg.knowledgeBase.name) || 'MCG Operations Knowledge Base';
    const kbDesc = (cfg.knowledgeBase && cfg.knowledgeBase.description) || '';

    knowledgeBase = await client.createKnowledgeBase(kbName, kbDesc);
    report.record('Knowledge Base', 'OK', `"${kbName}" id=${knowledgeBase.id}`);

    // Create file-based datasource within the KB
    kbDatasource = await client.createKBFileDatasource(knowledgeBase.id, 'MCG Documents');
    report.record('KB Datasource', 'OK', `id=${kbDatasource.id}`);

    // Upload all .docx files from the documents directory
    const docsDir = path.resolve(SCRIPT_DIR, (cfg.documents && cfg.documents.sourceDir) || '../documents');
    const docxFiles = findFiles(docsDir, '.docx');

    if (docxFiles.length === 0) {
      log.warn(`No .docx files found in ${docsDir}`);
      report.record('Document Upload', 'SKIP', 'No .docx files found');
    } else {
      log.info(`Found ${docxFiles.length} .docx file(s) to upload.`);
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

    // Trigger sync / indexing
    log.info('Triggering knowledge base sync/indexing...');
    await client.syncKBDatasource(knowledgeBase.id, kbDatasource.id);
    report.record('KB Sync', 'OK', 'Indexing triggered');
  } catch (err) {
    log.error(`Knowledge base setup failed: ${err.message}`);
    report.record('Knowledge Base', 'FAIL', err.message);
    if (!continueOnError) { report.print(log); process.exit(EXIT_FAILURE); }
  }

  // ---- Create Assistant ---------------------------------------------------
  log.section('Step 6: Create Qlik Answers Assistant');

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

  // ---- Final Report -------------------------------------------------------
  const failures = report.print(log);

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
