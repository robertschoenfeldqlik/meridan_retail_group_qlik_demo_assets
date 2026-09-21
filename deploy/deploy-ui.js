#!/usr/bin/env node
// ---------------------------------------------------------------------------
//  deploy-ui.js
//  Standalone web UI for the MCG Qlik Cloud deployment tool.
//
//  Usage:
//    node deploy/deploy-ui.js              # opens http://localhost:3939
//    node deploy/deploy-ui.js --port 8080  # custom port
// ---------------------------------------------------------------------------

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { resolveEngine, composeCmd, engineCmd, engineEnv } = require('./container-engine');
const stewardship = require('./stewardship');
const automationWorkspaces = require('./automation-workspaces');

const SCRIPT_DIR  = __dirname;
const PROJECT_DIR = path.resolve(SCRIPT_DIR, '..');

const DEFAULT_PORT = 3939;

// Parse a port value strictly (digits only, positive) — returns null if invalid,
// so an invalid PORT/--port value can be diagnosed instead of silently ignored.
function parsePortValue(raw) {
  if (raw === undefined || raw === null || !/^\d+$/.test(String(raw).trim())) return null;
  const n = parseInt(raw, 10);
  return (Number.isInteger(n) && n > 0) ? n : null;
}

let port = DEFAULT_PORT;
if (process.env.PORT !== undefined && process.env.PORT !== '') {
  const envPort = parsePortValue(process.env.PORT);
  if (envPort !== null) {
    port = envPort;
  } else {
    console.error(`Warning: PORT env var "${process.env.PORT}" is not a valid positive integer — using default port ${DEFAULT_PORT}.`);
  }
}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--port' && process.argv[i + 1]) {
    const argPort = parsePortValue(process.argv[i + 1]);
    if (argPort !== null) {
      port = argPort;
    } else {
      console.error(`Warning: --port value "${process.argv[i + 1]}" is not a valid positive integer — using default port ${DEFAULT_PORT}.`);
      port = DEFAULT_PORT;
    }
  }
}

// ---------------------------------------------------------------------------
//  File discovery helpers
// ---------------------------------------------------------------------------

// Recursively find files with a given extension
function findFilesRecursive(dir, ext) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFilesRecursive(full, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext) && !entry.name.startsWith('~$')) {
      results.push(full);
    }
  }
  return results;
}

function discoverFiles() {
  const result = {
    config: { exists: false, path: '' },
    configExample: { exists: false, path: '' },
    documents: [],
    apps: [],
    themes: [],
    automations: [],
    dataProducts: { exists: false, path: '', count: 0, items: [] },
    glossary: { exists: false, path: '', count: 0, items: [] },
  };

  const cfgPath = path.join(SCRIPT_DIR, 'config.json');
  result.config = { exists: fs.existsSync(cfgPath), path: cfgPath };

  const cfgExPath = path.join(SCRIPT_DIR, 'config.example.json');
  result.configExample = { exists: fs.existsSync(cfgExPath), path: cfgExPath };

  const docsDir = path.resolve(SCRIPT_DIR, '..', 'documents');
  if (fs.existsSync(docsDir)) {
    result.documents = findFilesRecursive(docsDir, '.docx')
      .sort()
      .map(f => {
        const rel = path.relative(docsDir, f).replace(/\\/g, '/');
        return { name: path.basename(f), folder: path.dirname(rel) === '.' ? '' : path.dirname(rel), rel, path: f, size: fs.statSync(f).size };
      });
  }

  const appsDir = path.join(SCRIPT_DIR, 'apps');
  if (fs.existsSync(appsDir)) {
    result.apps = fs.readdirSync(appsDir)
      .filter(f => f.endsWith('.qvf'))
      .sort()
      .map(f => ({ name: f, path: path.join(appsDir, f), size: fs.statSync(path.join(appsDir, f)).size }));
  }

  const themesDir = path.join(SCRIPT_DIR, 'themes');
  if (fs.existsSync(themesDir)) {
    result.themes = fs.readdirSync(themesDir)
      .filter(f => f.endsWith('.zip'))
      .sort()
      .map(f => ({ name: f, path: path.join(themesDir, f), size: fs.statSync(path.join(themesDir, f)).size }));
  }

  const autoDir = path.join(SCRIPT_DIR, 'automations');
  if (fs.existsSync(autoDir)) {
    result.automations = fs.readdirSync(autoDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .map(f => {
        const full = path.join(autoDir, f);
        let meta = { name: f };
        try {
          const d = JSON.parse(fs.readFileSync(full, 'utf-8'));
          meta.displayName = d.name || f;
          meta.description = d.description || '';
        } catch (_) {}
        return { ...meta, path: full, size: fs.statSync(full).size };
      });
  }

  const dpPath = path.join(SCRIPT_DIR, 'data_products.json');
  result.dataProducts = { exists: fs.existsSync(dpPath), path: dpPath, count: 0, items: [] };
  if (result.dataProducts.exists) {
    try {
      const d = JSON.parse(fs.readFileSync(dpPath, 'utf-8'));
      const items = d.dataProducts || [];
      result.dataProducts.count = items.length;
      result.dataProducts.items = items.map(p => ({
        name: p.name,
        description: p.description || '',
        owner: p.owner || '',
        tags: p.tags || [],
        sourceTable: p.sourceTable || '',
      }));
    } catch (_) {}
  }

  // Declarative pipeline projects — parse task YAML for the Pipelines page
  const pipelinesRoot = path.join(SCRIPT_DIR, 'pipelines');
  result.pipeline = { exists: false, projects: [] };
  const projectDirs = fs.existsSync(pipelinesRoot)
    ? fs.readdirSync(pipelinesRoot, { withFileTypes: true })
        .filter(e => e.isDirectory() && fs.existsSync(path.join(pipelinesRoot, e.name, 'qtcp_project.yaml')))
        .map(e => e.name)
    : [];
  for (const projDir of projectDirs) {
    const pipeDir = path.join(pipelinesRoot, projDir);
    const proj = { dir: projDir, name: projDir, tasks: [] };
    try {
      const projRaw = fs.readFileSync(path.join(pipeDir, 'qtcp_project.yaml'), 'utf-8');
      const nm = projRaw.match(/^\s*name:\s*(.+?)\s*$/m);
      if (nm) proj.name = nm[1];
    } catch (_) {}
    const tasksDir = path.join(pipeDir, 'qtcp_tasks');
    if (fs.existsSync(tasksDir)) {
      const rank = (t) => {
        const ty = String(t.type).toUpperCase();
        if (ty.includes('LANDING')) return 0;
        if (ty.includes('STORAGE')) return 1;
        if (ty.includes('TRANSFORM')) return 2;
        return 3; // datamart last
      };
      proj.tasks = fs.readdirSync(tasksDir)
        .filter(d => { try { return fs.statSync(path.join(tasksDir, d)).isDirectory(); } catch (_) { return false; } })
        .map(d => {
          const t = { folder: d, name: d, type: '', schedule: '', datasets: 0 };
          try {
            const raw = fs.readFileSync(path.join(tasksDir, d, 'task.yaml'), 'utf-8');
            const nm = raw.match(/^\s*name:\s*(.+?)\s*$/m);
            const ty = raw.match(/^\s*type:\s*(.+?)\s*$/m);
            if (nm) t.name = nm[1];
            if (ty) t.type = ty[1];
          } catch (_) {}
          const schedFile = path.join(tasksDir, d, 'schedule.yaml');
          const parts = [];
          if (fs.existsSync(schedFile)) {
            try {
              const s = fs.readFileSync(schedFile, 'utf-8');
              if (/EVENT_BASED/.test(s)) parts.push('event-triggered');
              const daily = s.match(/FREQ=DAILY;BYHOUR=(\d+);BYMINUTE=(\d+)/);
              if (daily) parts.push('daily ' + String(daily[1]).padStart(2, '0') + ':' + String(daily[2]).padStart(2, '0') + ' UTC');
              else if (/FREQ=MINUTELY;INTERVAL=15/.test(s)) parts.push('every 15 min');
              else if (/TIME_BASED/.test(s)) parts.push('scheduled');
            } catch (_) {}
          } else {
            parts.push(String(t.type).toUpperCase().includes('STREAM') ? 'continuous (streaming)' : 'continuous (CDC)');
          }
          t.schedule = parts.join(' + ');
          const dsDir = path.join(tasksDir, d, 'datasets');
          if (fs.existsSync(dsDir)) {
            try { t.datasets = fs.readdirSync(dsDir).filter(f => f.endsWith('.yaml')).length; } catch (_) {}
          }
          return t;
        })
        .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    }
    result.pipeline.projects.push(proj);
  }
  result.pipeline.exists = result.pipeline.projects.length > 0;

  // Qlik MCP sheet-authoring prompts (for the Build Apps page)
  const promptsPath = path.join(SCRIPT_DIR, 'apps', 'mcp-sheet-prompts.json');
  result.mcpPrompts = { exists: false, apps: [] };
  if (fs.existsSync(promptsPath)) {
    try {
      const mp = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'));
      result.mcpPrompts = {
        exists: true,
        endpoint: (mp.mcpSetup && mp.mcpSetup.endpoint) || '',
        testPrompt: (mp.mcpSetup && mp.mcpSetup.testPrompt) || '',
        apps: mp.apps || [],
      };
    } catch (_) {}
  }

  const glPath = path.join(SCRIPT_DIR, 'glossary_terms.json');
  result.glossary = { exists: fs.existsSync(glPath), path: glPath, count: 0, items: [] };
  if (result.glossary.exists) {
    try {
      const g = JSON.parse(fs.readFileSync(glPath, 'utf-8'));
      const items = g.terms || [];
      result.glossary.count = items.length;
      result.glossary.items = items.map(t => ({
        name: t.name,
        definition: (t.definition || '').slice(0, 120),
        category: t.category || '',
      }));
    } catch (_) {}
  }

  return result;
}

function loadConfig() {
  const cfgPath = path.join(SCRIPT_DIR, 'config.json');
  if (!fs.existsSync(cfgPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  } catch (e) {
    return { error: e.message };
  }
}

function saveConfig(cfg) {
  const cfgPath = path.join(SCRIPT_DIR, 'config.json');
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
//  Security & I/O helpers
// ---------------------------------------------------------------------------

// Secret fields that must never be sent to the browser in cleartext. GET
// /api/config masks these; the POST handlers restore them from the stored
// config so a masked round-trip never wipes a real secret (see unredactSecrets).
const SECRET_MASK = '__MCG_REDACTED__';
const SECRET_KEY_RE = /^(apiKey|clientSecret|password|saslPassword|secretAccessKey|accessKeyId|teamsWebhookUrl)$/;

function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'string' && v && SECRET_KEY_RE.test(k)) out[k] = SECRET_MASK;
      else out[k] = redactSecrets(v);
    }
    return out;
  }
  return value;
}

// Replace SECRET_MASK sentinels in `incoming` with the real values from the
// stored `existing` config. Non-masked values pass through, so a user can still
// set a brand-new secret.
function unredactSecrets(incoming, existing) {
  if (Array.isArray(incoming)) {
    return incoming.map((v, i) => unredactSecrets(v, Array.isArray(existing) ? existing[i] : undefined));
  }
  if (incoming && typeof incoming === 'object') {
    const out = {};
    const ex = (existing && typeof existing === 'object') ? existing : {};
    for (const [k, v] of Object.entries(incoming)) {
      if (v === SECRET_MASK) out[k] = (ex[k] != null ? ex[k] : '');
      else out[k] = unredactSecrets(v, ex[k]);
    }
    return out;
  }
  if (incoming === SECRET_MASK) return (existing != null ? existing : '');
  return incoming;
}

// Buffer a byte stream into complete lines — a single log line split across two
// 'data' chunks is emitted once, not as two partial lines.
function makeLineBuffer(onLine) {
  let buf = '';
  return {
    push(chunk) {
      buf += chunk.toString();
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).replace(/\r$/, '');
        buf = buf.slice(nl + 1);
        if (line.length) onLine(line);
      }
    },
    flush() { const l = buf.replace(/\r$/, ''); buf = ''; if (l.length) onLine(l); },
  };
}

// Classify a child-process log line by anchored tokens, so 'OK' doesn't match
// inside other words (LOOKUP, BROKEN, TOKEN…).
function classifyLevel(line) {
  if (/\bERROR\b/.test(line)) return 'error';
  if (/\bWARN(?:ING)?\b/.test(line)) return 'warn';
  if (/\bOK\b/.test(line)) return 'success';
  if (/====/.test(line)) return 'section';
  return 'info';
}

// Terminate a child AND its descendants. SIGTERM to a shell:true child only
// reaps the shell wrapper, orphaning the real docker/build process — so on
// Windows use taskkill /T, and on POSIX signal the detached process group.
function killProcessTree(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try { process.kill(-child.pid, 'SIGTERM'); }
      catch (_) { child.kill('SIGTERM'); }
    }
  } catch (_) { /* best effort */ }
}

// Validate an operator-supplied RPM download URL before handing it to curl, to
// block SSRF (cloud-metadata / internal hosts) and non-HTTP schemes.
function validateRpmUrl(raw) {
  let u;
  try { u = new URL(raw); } catch (_) { return { ok: false, error: 'Not a valid URL.' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: 'Only http(s) URLs are allowed.' };
  }
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost') return { ok: false, error: 'Loopback host is not allowed.' };
  if (host.includes(':')) { // IPv6 literal — reject loopback/link-local/unique-local
    if (host === '::1' || host.startsWith('fe80') || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('::ffff:')) {
      return { ok: false, error: 'Private/loopback IPv6 hosts are not allowed.' };
    }
  }
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    if (a === 127 || a === 10 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254)) {
      return { ok: false, error: 'Private/loopback IPs are not allowed.' };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
//  App definitions helper
// ---------------------------------------------------------------------------

function loadAppDefinitions() {
  const defPath = path.join(SCRIPT_DIR, 'apps', 'app-definitions.json');
  if (!fs.existsSync(defPath)) return { exists: false, apps: [] };
  try {
    const data = JSON.parse(fs.readFileSync(defPath, 'utf-8'));
    const apps = (data.apps || []).map(app => ({
      name: app.name || 'Untitled',
      description: app.description || '',
      loadScript: app.loadScript || '',
      theme: app.theme || '',
      dimensions: (app.masterDimensions || []).length,
      measures: (app.masterMeasures || []).length,
      sheets: (app.sheets || []).length,
      objects: (app.sheets || []).reduce((sum, s) => sum + (s.objects || []).length, 0),
    }));
    return { exists: true, apps };
  } catch (e) {
    return { exists: false, apps: [], error: e.message };
  }
}

// ---------------------------------------------------------------------------
//  SSE-based build-apps runner
// ---------------------------------------------------------------------------

let activeBuildProcess = null;

function runBuildApps(res, options) {
  if (activeBuildProcess) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'A build is already running.' }));
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let clientOpen = true;
  const send = (type, data) => {
    if (!clientOpen) return;
    try {
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (_) { clientOpen = false; }
  };

  const args = [path.join(SCRIPT_DIR, 'build-apps.js')];
  if (options.dryRun) args.push('--dry-run');
  if (options.verbose) args.push('--verbose');

  send('status', { state: 'starting', message: 'Starting app build...' });
  send('log', { level: 'info', text: `> node ${args.join(' ')}` });

  // Write config if provided
  let tempConfig = null;
  if (options.config) {
    try {
      tempConfig = path.join(SCRIPT_DIR, '.config-build-temp.json');
      fs.writeFileSync(tempConfig, JSON.stringify(options.config, null, 2));
      args.push('--config', tempConfig);
    } catch (e) {
      send('log', { level: 'warn', text: `Could not write temp config: ${e.message}` });
    }
  }

  const child = spawn('node', args, {
    cwd: PROJECT_DIR,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  activeBuildProcess = child;

  const stdoutBuf = makeLineBuffer((line) => send('log', { level: classifyLevel(line), text: line }));
  const stderrBuf = makeLineBuffer((line) => send('log', { level: 'error', text: line }));
  child.stdout.on('data', (chunk) => stdoutBuf.push(chunk));
  child.stderr.on('data', (chunk) => stderrBuf.push(chunk));

  child.on('close', (code) => {
    stdoutBuf.flush(); stderrBuf.flush();
    activeBuildProcess = null;
    if (tempConfig && fs.existsSync(tempConfig)) {
      try { fs.unlinkSync(tempConfig); } catch (_) {}
    }
    send('status', {
      state: 'done',
      code,
      message: code === 0 ? 'App build completed successfully.' : `App build finished with exit code ${code}.`,
    });
    res.end();
  });

  child.on('error', (err) => {
    activeBuildProcess = null;
    if (tempConfig && fs.existsSync(tempConfig)) {
      try { fs.unlinkSync(tempConfig); } catch (_) {}
    }
    send('log', { level: 'error', text: `Process error: ${err.message}` });
    send('status', { state: 'error', message: err.message });
    res.end();
  });

  res.on('close', () => {
    clientOpen = false;
    if (activeBuildProcess === child) {
      child.kill('SIGTERM');
      activeBuildProcess = null;
    }
  });
}

// ---------------------------------------------------------------------------
//  Automation definitions helper
// ---------------------------------------------------------------------------

function loadAutomationDefinitions() {
  const defPath = path.join(SCRIPT_DIR, 'automations', 'automation-definitions.json');
  if (!fs.existsSync(defPath)) return { exists: false, automations: [] };
  try {
    const data = JSON.parse(fs.readFileSync(defPath, 'utf-8'));
    const automations = (data.automations || []).map(auto => ({
      id: auto.id || 'unknown',
      name: auto.name || 'Untitled',
      description: auto.description || '',
      state: auto.state || 'disabled',
      triggerType: auto.trigger ? auto.trigger.type : 'unknown',
      triggerSchedule: auto.trigger ? (auto.trigger.schedule || 'event-based') : '',
      triggerDescription: auto.trigger ? (auto.trigger.description || '') : '',
      blocks: (auto.blocks || []).length,
      variables: auto.variables || [],
    }));
    return { exists: true, automations };
  } catch (e) {
    return { exists: false, automations: [], error: e.message };
  }
}

// ---------------------------------------------------------------------------
//  SSE-based build-automations runner
// ---------------------------------------------------------------------------

let activeBuildAutoProcess = null;

function runBuildAutomations(res, options) {
  if (activeBuildAutoProcess) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'An automation build is already running.' }));
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let clientOpen = true;
  const send = (type, data) => {
    if (!clientOpen) return;
    try {
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (_) { clientOpen = false; }
  };

  const args = [path.join(SCRIPT_DIR, 'build-automations.js')];
  if (options.dryRun) args.push('--dry-run');
  if (options.verbose) args.push('--verbose');

  send('status', { state: 'starting', message: 'Starting automation build...' });
  send('log', { level: 'info', text: `> node ${args.join(' ')}` });

  let tempConfig = null;
  if (options.config) {
    try {
      tempConfig = path.join(SCRIPT_DIR, '.config-build-auto-temp.json');
      fs.writeFileSync(tempConfig, JSON.stringify(options.config, null, 2));
      args.push('--config', tempConfig);
    } catch (e) {
      send('log', { level: 'warn', text: `Could not write temp config: ${e.message}` });
    }
  }

  const child = spawn('node', args, {
    cwd: PROJECT_DIR,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  activeBuildAutoProcess = child;

  const stdoutBuf = makeLineBuffer((line) => send('log', { level: classifyLevel(line), text: line }));
  const stderrBuf = makeLineBuffer((line) => send('log', { level: 'error', text: line }));
  child.stdout.on('data', (chunk) => stdoutBuf.push(chunk));
  child.stderr.on('data', (chunk) => stderrBuf.push(chunk));

  child.on('close', (code) => {
    stdoutBuf.flush(); stderrBuf.flush();
    activeBuildAutoProcess = null;
    if (tempConfig && fs.existsSync(tempConfig)) {
      try { fs.unlinkSync(tempConfig); } catch (_) {}
    }
    send('status', {
      state: 'done',
      code,
      message: code === 0 ? 'Automation build completed successfully.' : `Automation build finished with exit code ${code}.`,
    });
    res.end();
  });

  child.on('error', (err) => {
    activeBuildAutoProcess = null;
    if (tempConfig && fs.existsSync(tempConfig)) {
      try { fs.unlinkSync(tempConfig); } catch (_) {}
    }
    send('log', { level: 'error', text: `Process error: ${err.message}` });
    send('status', { state: 'error', message: err.message });
    res.end();
  });

  res.on('close', () => {
    clientOpen = false;
    if (activeBuildAutoProcess === child) {
      child.kill('SIGTERM');
      activeBuildAutoProcess = null;
    }
  });
}

// ---------------------------------------------------------------------------
//  Container infrastructure helpers
// ---------------------------------------------------------------------------

const INFRA_DIR = path.join(PROJECT_DIR, 'infrastructure');

// Which engine drives the stacks (podman here; docker still works if installed).
// Resolved once at startup so every spawn below targets the same engine and the
// same Compose provider. Override with MCG_CONTAINER_ENGINE=docker|podman.
const ENGINE = resolveEngine();

function discoverDocker() {
  const result = {
    engine: {
      name: ENGINE.name,
      version: ENGINE.version,
      compose: ENGINE.compose.kind,
      error: ENGINE.error,
    },
    dockerAvailable: ENGINE.available,
    composeAvailable: ENGINE.compose.available,
    composeFiles: [],
    dmgGateway: {
      dockerfileExists: false,
      rpmExists: false,
      rpmDir: path.join(INFRA_DIR, 'dmg', 'gateway', 'rpmfiles'),
    },
    envExample: { exists: false, path: '' },
    envFile: { exists: false, path: '' },
  };

  // Check Docker compose files
  const composeFiles = [
    { file: 'kafka/docker-compose.yml', label: 'Kafka Stack', desc: 'ZooKeeper + Broker + Schema Registry + Control Center' },
    { file: 'docker-compose.simulators.yml', label: 'Simulators', desc: 'PostgreSQL + PG Simulator + Kafka IoT Simulator' },
    { file: 'docker-compose.dmg.yml', label: 'DMG Gateway', desc: 'Qlik Data Movement Gateway + PostgreSQL/MySQL/MSSQL' },
    { file: 'docker-compose.full-stack.yml', label: 'Full Stack', desc: 'Kafka + Simulators (all-in-one)' },
    { file: 'docker-compose.full-stack-dmg.yml', label: 'Full Stack + DMG', desc: 'Kafka + Simulators + Data Movement Gateway' },
    { file: 'docker-compose.simulators-dmg.yml', label: 'Simulators (DMG)', desc: 'Simulator stack for DMG integration' },
  ];

  for (const cf of composeFiles) {
    cf.exists = fs.existsSync(path.join(INFRA_DIR, cf.file));
    cf.path = path.join(INFRA_DIR, cf.file);
  }
  result.composeFiles = composeFiles;

  // DMG gateway
  result.dmgGateway.dockerfileExists = fs.existsSync(path.join(INFRA_DIR, 'dmg', 'gateway', 'Dockerfile'));
  const rpmDir = result.dmgGateway.rpmDir;
  if (fs.existsSync(rpmDir)) {
    const rpmFiles = fs.readdirSync(rpmDir).filter(f => f.endsWith('.rpm'));
    result.dmgGateway.rpmExists = rpmFiles.length > 0;
    result.dmgGateway.rpmFiles = rpmFiles;
  }

  // .env files
  result.envExample = { exists: fs.existsSync(path.join(INFRA_DIR, '.env.example')), path: path.join(INFRA_DIR, '.env.example') };
  result.envFile = { exists: fs.existsSync(path.join(INFRA_DIR, '.env')), path: path.join(INFRA_DIR, '.env') };

  return result;
}

function loadEnvFile() {
  const envPath = path.join(INFRA_DIR, '.env');
  if (!fs.existsSync(envPath)) {
    // Try to load from .env.example
    const exPath = path.join(INFRA_DIR, '.env.example');
    if (fs.existsSync(exPath)) return parseEnv(fs.readFileSync(exPath, 'utf-8'));
    return {};
  }
  return parseEnv(fs.readFileSync(envPath, 'utf-8'));
}

function parseEnv(text) {
  const vars = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    vars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return vars;
}

function saveEnvFile(vars) {
  // Merge with existing env vars so manual additions are preserved
  const existing = loadEnvFile();
  const merged = { ...existing, ...vars };
  const lines = [
    '# =============================================================================',
    '# MCG Demo — Environment Variables (generated by deploy-ui)',
    '# =============================================================================',
    '',
  ];
  for (const [k, v] of Object.entries(merged)) {
    // Strip CR/LF from values so a newline-containing value can't inject bogus
    // extra KEY=VALUE lines into the .env file.
    const safeV = String(v).replace(/[\r\n]+/g, '');
    lines.push(`${k}=${safeV}`);
  }
  fs.writeFileSync(path.join(INFRA_DIR, '.env'), lines.join('\n') + '\n', 'utf-8');
}

// Run a docker compose command as a detached, log-backed background job.
//
// The build's lifetime is fully independent of any browser connection. All
// output is appended to an in-memory buffer (dockerJob.lines) that the client
// polls via GET /api/docker/status. A dropped console, a page reload, or a
// throttled background tab can never interrupt or "lose" the build — at worst
// the client misses a poll and catches up on the next one. The only way to
// cancel is the explicit Stop button (POST /api/docker/stop).
let activeDockerProcess = null;
let dockerJob = null; // { running, action, code, error, lines:[{level,text}], droppedCount, startedAt }

// Cap the in-memory log buffer so a very long-running job can't grow it without
// bound. Older lines are dropped; droppedCount lets /api/docker/status keep its
// offset-based polling protocol correct (see below) even after a drop.
const DOCKER_LOG_CAP = 5000;

function pushDockerLog(level, text) {
  if (!dockerJob) return;
  dockerJob.lines.push({ level: level, text: text });
  if (dockerJob.lines.length > DOCKER_LOG_CAP) {
    const excess = dockerJob.lines.length - DOCKER_LOG_CAP;
    dockerJob.lines.splice(0, excess);
    dockerJob.droppedCount = (dockerJob.droppedCount || 0) + excess;
  }
  dockerJob.lastOutputAt = Date.now();  // for the client keepalive / "waiting for update" indicator
}

function fmtMs(ms) {
  const s = Math.max(0, Math.round((ms || 0) / 1000));
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60), r = s % 60;
  return m + 'm' + (r < 10 ? '0' : '') + r + 's';
}

// Sanity-check the stack: parse `compose ps` and report per-service
// running/health state plus a one-line summary, into the job log.
async function dockerSanityCheck(composeFile) {
  pushDockerLog('section', `\n── Sanity check: ${ENGINE.compose.kind} ps ──`);
  await new Promise((resolve) => {
    let out = '', errOut = '';
    const ps = composeCmd(ENGINE, '-f', composeFile, 'ps', '--format', 'json');
    const child = spawn(ps.cmd, ps.args, {
      cwd: INFRA_DIR, env: engineEnv(ENGINE), stdio: ['ignore', 'pipe', 'pipe'], shell: true,
    });
    activeDockerProcess = child;
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { errOut += d.toString(); });
    child.on('close', () => {
      activeDockerProcess = null;
      let rows = [];
      const trimmed = out.trim();
      // Newer docker emits one JSON object per line; some versions emit a JSON array.
      if (trimmed.startsWith('[')) {
        try { rows = JSON.parse(trimmed); } catch (_) {}
      } else {
        rows = trimmed.split('\n').map((l) => l.trim()).filter(Boolean)
          .map((l) => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
      }
      if (!rows.length) {
        pushDockerLog('warn', 'No services reported — the stack does not appear to be running.' + (errOut.trim() ? ' ' + errOut.trim() : ''));
        return resolve();
      }
      let up = 0, healthy = 0, unhealthy = 0;
      for (const r of rows) {
        const name = r.Name || r.Service || '(unknown)';
        const state = r.State || '';
        const status = r.Status || '';
        const health = r.Health || '';
        const running = /running|up/i.test(state) || /\bUp\b/.test(status);
        const isUnhealthy = /unhealthy/i.test(health) || /unhealthy/i.test(status);
        const isHealthy = !isUnhealthy && (/healthy/i.test(health) || /\(healthy\)/i.test(status));
        if (running) up++;
        if (isHealthy) healthy++;
        if (isUnhealthy) unhealthy++;
        const mark = running && !isUnhealthy ? '✓' : '✗';
        pushDockerLog(running && !isUnhealthy ? 'success' : 'error',
          `  ${mark} ${name} — ${status || state || 'unknown'}`);
      }
      const total = rows.length;
      const ok = up === total && unhealthy === 0;
      pushDockerLog(ok ? 'success' : 'warn',
        `Sanity check: ${up}/${total} running${healthy ? `, ${healthy} healthy` : ''}${unhealthy ? `, ${unhealthy} UNHEALTHY` : ''}.`
        + (ok ? ' Stack looks healthy.' : ' Some services may still be starting — re-run Status in a moment.'));
      resolve();
    });
    child.on('error', (e) => { activeDockerProcess = null; pushDockerLog('error', 'Sanity check could not run: ' + e.message); resolve(); });
  });
}

// After a DMG gateway comes up, retrieve and print its registration token so the
// user can register it in Qlik Cloud → Administration → Data Gateways (the gateway
// needs admin onboarding before data connections can bind to it).
async function dockerGatewayRegistrationToken(containerName) {
  pushDockerLog('section', '\n── Data Movement Gateway: registration token ──');
  // Pass as ONE pre-quoted command string (not a spawn args array). With shell:true,
  // an args array doesn't re-quote, so the `bash -lc "cd … && …"` arg gets split and
  // agentctl never runs. A single string keeps the inner quotes intact cross-platform.
  const cmdStr = `${ENGINE.bin} exec ${containerName} bash -lc "cd /opt/qlik/gateway/movement/bin && ./agentctl qcs get_registration"`;
  const tryGet = () => new Promise((resolve) => {
    let out = '';
    const child = spawn(cmdStr, { env: engineEnv(ENGINE), stdio: ['ignore', 'pipe', 'pipe'], shell: true });
    activeDockerProcess = child;
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { out += d.toString(); });
    child.on('close', () => { activeDockerProcess = null; resolve(out); });
    child.on('error', (e) => { activeDockerProcess = null; resolve('ERR ' + e.message); });
  });
  let token = '', noContainer = false;
  for (let i = 0; i < 6; i++) {
    const out = await tryGet();
    const m = out.match(/\{"agentType"[\s\S]*\}/);
    if (m) { token = m[0].trim(); break; }
    if (/no such container|is not running/i.test(out)) { noContainer = true; break; }
    if (i === 0) pushDockerLog('info', 'Waiting for the gateway to finish initializing…');
    await new Promise((r) => setTimeout(r, 5000));
  }
  if (token) {
    pushDockerLog('success', 'Registration token — copy this and register the gateway in Qlik Cloud → Administration → Data Gateways → Register:');
    pushDockerLog('info', token);
    pushDockerLog('info', 'After it shows "Connected", your Postgres/Kafka data connections can bind to this gateway.');
    pushDockerLog('info', 'Step-by-step: https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Gateways/dm-gateway-setting-up.htm');
  } else if (noContainer) {
    pushDockerLog('error', `Gateway container "${containerName}" is not running. Deploy a DMG profile (Full Stack + DMG, or DMG Gateway) first, then try again.`);
  } else {
    pushDockerLog('warn', 'Gateway still initializing — retrieve the token shortly with:');
    pushDockerLog('info', `${ENGINE.bin} exec ${containerName} bash -lc "cd /opt/qlik/gateway/movement/bin && ./agentctl qcs get_registration"`);
  }
}

// Start or stop ONLY the gateway container (mcg-qlik-dmg), independent of the whole
// compose stack. Stopping it makes the gateway go Disconnected in Qlik Cloud; starting
// it reconnects after ~a minute. Used by the Start/Stop Gateway buttons.
async function dockerGatewayLifecycle(action, containerName) {
  const verb = action === 'gateway-stop' ? 'stop' : 'start';
  pushDockerLog('section', `\n── Data Movement Gateway: ${verb} container ──`);
  const run = (cmdStr) => new Promise((resolve) => {
    let out = '';
    const child = spawn(cmdStr, { env: engineEnv(ENGINE), stdio: ['ignore', 'pipe', 'pipe'], shell: true });
    activeDockerProcess = child;
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { out += d.toString(); });
    child.on('close', (c) => { activeDockerProcess = null; resolve({ code: c, out }); });
    child.on('error', (e) => { activeDockerProcess = null; resolve({ code: 1, out: e.message }); });
  });
  pushDockerLog('info', `$ ${ENGINE.bin} ${verb} ${containerName}`);
  const r = await run(`${ENGINE.bin} ${verb} ${containerName}`);
  if (r.out && r.out.trim()) pushDockerLog('info', r.out.trim());
  if (r.code !== 0) {
    pushDockerLog('error', `${ENGINE.bin} ${verb} ${containerName} failed (exit ${r.code}). Is the gateway deployed? Use Deploy (Full Stack + DMG, or DMG Gateway) first.`);
    return r.code;
  }
  const ps = await run(`${ENGINE.bin} ps -a --filter name=${containerName} --format "{{.Status}}"`);
  const state = (ps.out || '').trim();
  if (verb === 'start') {
    pushDockerLog('success', `Gateway container started${state ? ' — ' + state : ''}.`);
    pushDockerLog('info', 'It may take ~a minute to reconnect — watch the state in Qlik Cloud → Administration → Data Gateways.');
  } else {
    pushDockerLog('success', `Gateway container stopped${state ? ' — ' + state : ''}.`);
    pushDockerLog('info', 'It will show as Disconnected in Qlik Cloud → Administration → Data Gateways until you start it again.');
  }
  return 0;
}

// Idempotent — the natural-completion path and the explicit Stop route can both
// race to finalize the same job; only the first call should take effect.
function finishDockerJob(code, error) {
  if (!dockerJob || dockerJob.finalized) return;
  dockerJob.finalized = true;
  dockerJob.running = false;
  dockerJob.code = (typeof code === 'number') ? code : null;
  dockerJob.error = error || null;
  activeDockerProcess = null;
}

// Start the job and return immediately — the work runs detached. The HTTP
// request that triggers this gets a tiny JSON ack, not a long-lived stream.
function startDockerJob(options) {
  if (dockerJob && dockerJob.running) {
    return { started: false, error: 'A Docker operation is already running. Please wait for it to finish.' };
  }
  dockerJob = { running: true, finalized: false, action: options.action, code: null, error: null, lines: [], droppedCount: 0, startedAt: Date.now(), lastOutputAt: Date.now() };
  runDockerJob(options).catch((err) => {
    const msg = (err && err.message) ? err.message : String(err);
    pushDockerLog('error', 'Internal error: ' + msg);
    finishDockerJob(null, msg);
  });
  return { started: true };
}

async function runDockerJob(options) {
  // Gateway registration token — a standalone action (no compose), used by the
  // "Register Gateway" button to fetch the token on demand without redeploying.
  if (options.action === 'gateway-token') {
    await dockerGatewayRegistrationToken('mcg-qlik-dmg');
    finishDockerJob(0, null);
    return;
  }

  // Start/stop just the gateway container — standalone, no compose file needed.
  if (options.action === 'gateway-start' || options.action === 'gateway-stop') {
    const code = await dockerGatewayLifecycle(options.action, 'mcg-qlik-dmg');
    finishDockerJob(code, code === 0 ? null : `Gateway ${options.action === 'gateway-stop' ? 'stop' : 'start'} failed`);
    return;
  }

  // Save env vars if provided (skip for prune — no need to overwrite .env)
  if (options.envVars && options.action !== 'prune') {
    saveEnvFile(options.envVars);
    pushDockerLog('info', 'Saved environment variables to infrastructure/.env');
  }

  // --- RPM resolution for DMG builds ---
  // Only DMG profiles ship a gateway RPM. A forced rebuild of a non-DMG profile
  // (via the Deploy button) sets build=1 too, so gate this on the compose file
  // being a DMG one — otherwise we'd wrongly demand a gateway RPM for Kafka/sims.
  if (options.build && options.action === 'up' && /dmg/i.test(options.composeFile)) {
    const rpmDir = path.join(INFRA_DIR, 'dmg', 'gateway', 'rpmfiles');
    const rpmDest = path.join(rpmDir, 'gateway.rpm');

    if (options.rpmPath) {
      // Local file path — copy into build context
      pushDockerLog('info', `Resolving RPM from local path: ${options.rpmPath}`);
      if (!/\.rpm$/i.test(options.rpmPath)) {
        pushDockerLog('error', `Path does not end in .rpm: ${options.rpmPath}`);
        finishDockerJob(null, 'RPM path must end in .rpm.');
        return;
      }
      if (!fs.existsSync(options.rpmPath)) {
        pushDockerLog('error', `RPM file not found at: ${options.rpmPath}`);
        finishDockerJob(null, 'RPM file not found at the specified path.');
        return;
      }
      try {
        if (!fs.existsSync(rpmDir)) fs.mkdirSync(rpmDir, { recursive: true });
        fs.copyFileSync(options.rpmPath, rpmDest);
        pushDockerLog('info', `Copied RPM to build context: ${rpmDest}`);
      } catch (err) {
        pushDockerLog('error', `Failed to copy RPM: ${err.message}`);
        finishDockerJob(null, `RPM copy failed: ${err.message}`);
        return;
      }
    } else if (options.rpmUrl) {
      // Download URL — fetch via curl. Validate first to block SSRF (cloud
      // metadata / internal hosts) and non-HTTP schemes.
      const v = validateRpmUrl(options.rpmUrl);
      if (!v.ok) {
        pushDockerLog('error', `Invalid RPM URL: ${v.error}`);
        finishDockerJob(null, `Invalid RPM URL: ${v.error}`);
        return;
      }
      pushDockerLog('info', `Downloading RPM from: ${options.rpmUrl}`);
      if (!fs.existsSync(rpmDir)) fs.mkdirSync(rpmDir, { recursive: true });
      // Download to a temp file and promote to gateway.rpm only on success, so an
      // aborted/partial transfer never leaves a corrupt RPM a later build trusts.
      const rpmPart = rpmDest + '.part';
      try {
        await new Promise((resolve, reject) => {
          // -L is required: release assets (e.g. GitHub) 302 to a CDN, and without
          // it curl writes the redirect body to gateway.rpm and exits 0. --proto-redir
          // constrains where a redirect may land; the initial URL is vetted by
          // validateRpmUrl() above.
          const dl = spawn('curl', ['-L', '--max-redirs', '3', '--proto', '=http,https', '--proto-redir', '=https', '-f', '-o', rpmPart, '--progress-bar', options.rpmUrl], {
            cwd: INFRA_DIR, stdio: ['ignore', 'pipe', 'pipe'],
          });
          activeDockerProcess = dl;
          dl.stdout.on('data', (d) => {
            for (const l of d.toString().split('\n').filter(Boolean)) pushDockerLog('info', l);
          });
          dl.stderr.on('data', (d) => {
            for (const l of d.toString().split('\n').filter(Boolean)) pushDockerLog('info', l);
          });
          dl.on('close', (code) => {
            activeDockerProcess = null;
            if (code === 0) resolve();
            else reject(new Error(`curl exited with code ${code}`));
          });
          dl.on('error', (e) => { activeDockerProcess = null; reject(e); });
        });
        fs.renameSync(rpmPart, rpmDest);
        pushDockerLog('info', `RPM downloaded to build context: ${rpmDest}`);
      } catch (err) {
        try { if (fs.existsSync(rpmPart)) fs.unlinkSync(rpmPart); } catch (_) {}
        pushDockerLog('error', `RPM download failed: ${err.message}`);
        finishDockerJob(null, `RPM download failed: ${err.message}`);
        return;
      }
    } else {
      // Neither provided — check if RPM already exists
      if (!fs.existsSync(rpmDest)) {
        const rpmFiles = fs.existsSync(rpmDir) ? fs.readdirSync(rpmDir).filter(f => f.endsWith('.rpm')) : [];
        if (rpmFiles.length === 0) {
          pushDockerLog('error', 'No RPM file found in build context and no path/URL provided.');
          pushDockerLog('error', `Expected at: ${rpmDest}`);
          finishDockerJob(null, 'Gateway RPM not found. Provide a file path or download URL.');
          return;
        }
        // If there's an RPM with a different name, use it
        pushDockerLog('info', `Found RPM in build context: ${rpmFiles[0]}`);
      } else {
        pushDockerLog('info', 'Gateway RPM found in build context');
      }
    }
  }

  // Build docker compose command
  const composeFile = options.composeFile;
  const action = options.action; // 'up', 'down', 'status'

  // --- Prune: multi-step cleanup ---
  if (action === 'prune') {
    const down  = composeCmd(ENGINE, '-f', composeFile, 'down', '--remove-orphans');
    const prune = engineCmd(ENGINE, 'system', 'prune', '-a', '-f', '--volumes');
    const steps = [
      { label: 'Stopping containers', cmd: down.cmd, args: down.args },
      { label: 'Removing images, volumes & build cache', cmd: prune.cmd, args: prune.args },
    ];

    try {
      for (const step of steps) {
        const cmdStr = [step.cmd, ...step.args].join(' ');
        pushDockerLog('info', `\n── ${step.label} ──`);
        pushDockerLog('info', `> ${cmdStr}`);

        await new Promise((resolve, reject) => {
          const child = spawn(step.cmd, step.args, {
            cwd: INFRA_DIR, env: engineEnv(ENGINE),
            stdio: ['ignore', 'pipe', 'pipe'], shell: true,
            detached: process.platform !== 'win32', // own process group so Stop can kill the tree
          });
          activeDockerProcess = child;
          child.stdout.on('data', (chunk) => {
            for (const line of chunk.toString().split('\n').filter(Boolean)) pushDockerLog('info', line);
          });
          child.stderr.on('data', (chunk) => {
            for (const line of chunk.toString().split('\n').filter(Boolean)) pushDockerLog(line.includes('Error') ? 'error' : 'info', line);
          });
          child.on('close', (code) => {
            activeDockerProcess = null;
            if (code === 0) resolve();
            else reject(new Error(`${step.label} failed (exit code ${code})`));
          });
          child.on('error', (err) => { activeDockerProcess = null; reject(err); });
        });

        pushDockerLog('info', `✓ ${step.label} — done`);
      }
      pushDockerLog('info', 'Docker cleanup completed. Ready for fresh rebuild.');
      finishDockerJob(0, null);
    } catch (err) {
      pushDockerLog('error', err.message);
      finishDockerJob(null, err.message);
    }
    return;
  }

  let cmd, args;
  if (action === 'status') {
    ({ cmd, args } = composeCmd(ENGINE, '-f', composeFile, 'ps', '--format', 'table'));
  } else if (action === 'down') {
    ({ cmd, args } = composeCmd(ENGINE, '-f', composeFile, 'down'));
  } else {
    // up. `--profile` is a ROOT compose flag, not a flag of `up`, so it has to
    // precede the subcommand — appending it after `up -d` makes compose reject
    // the whole invocation. Nothing in the stack is profile-gated today (every
    // simulator is a default service), but the plumbing is kept because
    // startDockerJob's only caller never passes options.profiles, so a
    // profile-gated service would be unreachable from this UI if one is added.
    const profileArgs = [];
    for (const p of (options.profiles || [])) profileArgs.push('--profile', p);
    ({ cmd, args } = composeCmd(ENGINE, ...profileArgs, '-f', composeFile, 'up', '-d'));
    if (options.build) args.push('--build');
  }

  const cmdStr = [cmd, ...args].join(' ');
  pushDockerLog('info', `> ${cmdStr}`);
  pushDockerLog('info', `  cwd: ${INFRA_DIR}`);

  // Download/build monitor: the DMG image build transfers a large RPM (~850 MB)
  // and then installs it — Docker can go silent for minutes during those steps.
  // Emit a clean console line every few seconds of silence so the download is
  // visibly monitored and never looks stopped. Captures the latest transfer/pull
  // progress line when available.
  let lastProgress = '';
  let lastRealAt = Date.now();  // last time Docker itself emitted a line (not our heartbeat)
  // BuildKit emits hundreds of near-duplicate per-layer progress lines while it
  // pulls/transfers the large DMG image. Suppress those from the console and
  // surface only the latest in the 30s heartbeat — keeps the log readable.
  const NOISE_RE = /(transferring context|transferring dockerfile|Downloading|Download complete|Downloaded|Pulling fs layer|Pull complete|Pulling|Extracting|Waiting|Verifying Checksum|Already exists|exporting (layers|manifest|config|attestation)|sending tarball|resolve docker\.io)/i;
  // Heartbeat on a FIXED 30s cadence while running, so the console keeps updating
  // during the long, quiet image pull/transfer/install — without the per-layer noise.
  const monitor = setInterval(() => {
    if (!dockerJob || !dockerJob.running) return;
    const idleSec = Math.round((Date.now() - lastRealAt) / 1000);
    pushDockerLog('info', `⏳ ${action} in progress — ${fmtMs(Date.now() - (dockerJob.startedAt || Date.now()))} elapsed`
      + (lastProgress ? ` · ${lastProgress}` : '')
      + (idleSec >= 20 ? ` · quiet for ${idleSec}s` : ''));
  }, 30000);

  const onLine = (line, level) => {
    lastRealAt = Date.now();
    if (level !== 'error' && NOISE_RE.test(line)) {
      // Keep the latest progress for the heartbeat, but don't flood the console.
      lastProgress = line.replace(/^#\d+\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 110);
      return;
    }
    pushDockerLog(level, line);
  };

  const exitCode = await new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: INFRA_DIR,
      env: engineEnv(ENGINE),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      detached: process.platform !== 'win32', // own process group so Stop can kill the tree
    });

    activeDockerProcess = child;

    child.stdout.on('data', (chunk) => {
      for (const line of chunk.toString().split('\n').filter(Boolean)) onLine(line, 'info');
    });

    child.stderr.on('data', (chunk) => {
      for (const line of chunk.toString().split('\n').filter(Boolean)) {
        // Docker compose outputs progress to stderr
        const level = line.includes('Error') || line.includes('error') ? 'error' : 'info';
        onLine(line, level);
      }
    });

    child.on('close', (code) => {
      pushDockerLog(code === 0 ? 'info' : 'error',
        code === 0 ? `Docker ${action} completed.` : `Docker ${action} finished with exit code ${code}.`);
      activeDockerProcess = null;
      resolve(code);
    });

    child.on('error', (err) => {
      pushDockerLog('error', `Process error: ${err.message}`);
      activeDockerProcess = null;
      resolve(null);
    });
  });

  clearInterval(monitor);

  // After bringing the stack up (or on an explicit Status check), run a sanity
  // check so the console confirms whether the containers are actually healthy.
  if ((action === 'up' && exitCode === 0) || action === 'status') {
    try { await dockerSanityCheck(composeFile); } catch (_) {}
  }
  // DMG profiles: surface the gateway registration token so it can be registered in Qlik Cloud.
  if (action === 'up' && exitCode === 0 && /dmg/i.test(composeFile)) {
    try { await dockerGatewayRegistrationToken('mcg-qlik-dmg'); } catch (_) {}
  }
  finishDockerJob(exitCode, exitCode === null ? 'Process error' : null);
}

// ---------------------------------------------------------------------------
//  SSE-based deploy runner
// ---------------------------------------------------------------------------

let activeProcess = null;

function runDeploy(res, options) {
  if (activeProcess) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'A deployment is already running.' }));
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let clientOpen = true;
  const send = (type, data) => {
    if (!clientOpen) return;
    try {
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (_) {
      clientOpen = false;  // socket already gone — stop writing to it
    }
  };

  const args = [path.join(SCRIPT_DIR, 'deploy-to-qlik.js')];
  if (options.dryRun) args.push('--dry-run');
  if (options.verbose) args.push('--verbose');

  send('status', { state: 'starting', message: 'Starting deployment...' });
  send('log', { level: 'info', text: `> node ${args.join(' ')}` });

  // Write config with user's overrides — save to both config.json (persist) and temp file (deploy)
  let tempConfig = null;
  if (options.config) {
    try {
      // Save to config.json so form selections persist across reloads
      const mainConfig = path.join(SCRIPT_DIR, 'config.json');
      fs.writeFileSync(mainConfig, JSON.stringify(options.config, null, 2));
      // Also write temp copy for the deploy process
      tempConfig = path.join(SCRIPT_DIR, '.config-ui-temp.json');
      fs.writeFileSync(tempConfig, JSON.stringify(options.config, null, 2));
      args.push('--config', tempConfig);
    } catch (e) {
      send('log', { level: 'warn', text: `Could not write config: ${e.message}` });
    }
  }

  const child = spawn('node', args, {
    cwd: PROJECT_DIR,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  activeProcess = child;

  // SSE heartbeat — keeps the connection alive during long operations (e.g. Docker pulls)
  const heartbeat = setInterval(() => {
    if (!clientOpen) return;
    try { res.write(':heartbeat\n\n'); } catch (_) { clientOpen = false; }
  }, 10000);

  const stdoutBuf = makeLineBuffer((line) => send('log', { level: classifyLevel(line), text: line }));
  const stderrBuf = makeLineBuffer((line) => send('log', { level: 'error', text: line }));
  child.stdout.on('data', (chunk) => stdoutBuf.push(chunk));
  child.stderr.on('data', (chunk) => stderrBuf.push(chunk));

  child.on('close', (code) => {
    stdoutBuf.flush(); stderrBuf.flush();
    clearInterval(heartbeat);
    activeProcess = null;
    if (tempConfig && fs.existsSync(tempConfig)) {
      try { fs.unlinkSync(tempConfig); } catch (_) {}
    }
    send('status', {
      state: 'done',
      code,
      message: code === 0 ? 'Deployment completed successfully.' : `Deployment finished with exit code ${code}.`,
    });
    if (clientOpen) { try { res.end(); } catch (_) {} }
  });

  child.on('error', (err) => {
    clearInterval(heartbeat);
    activeProcess = null;
    if (tempConfig && fs.existsSync(tempConfig)) {
      try { fs.unlinkSync(tempConfig); } catch (_) {}
    }
    send('log', { level: 'error', text: `Process error: ${err.message}` });
    send('status', { state: 'error', message: err.message });
    if (clientOpen) { try { res.end(); } catch (_) {} }
  });

  // A dropped console must NOT abort a running deployment — a transient SSE
  // disconnect (tab refresh, network blip, a burst of Docker build output)
  // would otherwise leave the tenant half-provisioned. Stop the heartbeat and
  // mark the client gone (so we stop writing to a dead socket), but let the
  // deploy run to completion. Cancel deliberately with Stop (POST /api/stop).
  res.on('close', () => {
    clientOpen = false;
    clearInterval(heartbeat);
  });
}

// ---------------------------------------------------------------------------
//  HTML UI — Multi-screen wizard
// ---------------------------------------------------------------------------

function getHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MCG Deploy — Qlik Cloud</title>
<style>
  /* Fonts use the local system stack (IBM Plex / Inter if installed, else system-ui)
     — no remote @import, so the console renders instantly and works fully offline. */

  /* =========================================================================
     Soft Enterprise — light-first design system (MCG Deploy redesign)
     Light is the default (:root). Dark mode = body.dark-theme.
     ========================================================================= */
  :root {
    /* Header / legacy brand aliases (kept so existing rules resolve) */
    --navy: #ffffff;
    --navy-light: #f7f8fa;
    --teal: #0d7c8f;
    --teal-dark: #0a6271;
    --gold: #c4922e;
    --gold-dark: #a67b26;

    /* Surfaces & text */
    --bg: #f5f6f9;          /* page */
    --surface: #ffffff;     /* panel  */
    --surface2: #fafbfc;    /* panel2 */
    --border: #eaecf1;      /* line   */
    --text: #1b2330;        /* txt    */
    --text-dim: #69727f;    /* muted  */
    --text-faint: #9aa2af;  /* faint  */
    --success: #10b981;
    --error: #ef4444;
    --warn: #f59e0b;

    /* Accent (emerald) + secondary (indigo) */
    --qlik-green: #10b981;
    --qlik-green-dark: #0e9f6e;
    --qlik-green-glow: rgba(16,185,129,0.28);
    --accent2: #6366f1;
    --accent-txt: #06231a;  /* text on the emerald primary button */

    /* Spacing scale */
    --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px;
    --sp-4: 16px; --sp-5: 24px; --sp-6: 32px;
    --sp-7: 48px; --sp-8: 64px;

    /* Radius (softer) */
    --radius-sm: 6px;  --radius-md: 8px;
    --radius-lg: 12px; --radius-xl: 16px;
    --radius-full: 9999px;

    /* Shadows (soft enterprise) */
    --shadow-sm: 0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.08);
    --shadow-md: 0 4px 14px rgba(16,24,40,0.08);
    --shadow-lg: 0 12px 32px rgba(16,24,40,0.12);

    --transition: 0.18s ease;

    --text-bright: #0f172a;
    --placeholder: #9aa2af;
    --switch-bg: #d7dce3;
    --switch-knob: #ffffff;
    --hover-overlay: rgba(16,24,40,0.04);
    --btn-sheen: rgba(255,255,255,0.15);
    --sidebar-gradient-end: #f5f6f9;
    --console-bg: #ffffff;
    --field: #ffffff;
    --field-line: #dfe3ea;
    --stop-hover: #dc4444;
    --badge-teal-bg: rgba(13,124,143,0.1);
    --badge-teal-border: rgba(13,124,143,0.3);
    --badge-gold-bg: rgba(196,146,46,0.1);
    --badge-gold-border: rgba(196,146,46,0.3);
    --badge-red-bg: rgba(239,68,68,0.1);
    --badge-red-border: rgba(239,68,68,0.3);
    --dp-card-hover-border: rgba(16,185,129,0.35);
    --btn-dry-hover: rgba(99,102,241,0.08);
    --btn-save-hover: rgba(16,185,129,0.08);
  }

  /* Dark mode */
  body.dark-theme {
    --navy: #1b1f27;
    --navy-light: #21262f;
    --bg: #13161c;
    --surface: #1b1f27;
    --surface2: #21262f;
    --border: #2c323d;
    --text: #eef1f5;
    --text-dim: #98a1ae;
    --text-faint: #69717e;
    --text-bright: #ffffff;
    --qlik-green: #10b981;
    --qlik-green-dark: #0e9f6e;
    --qlik-green-glow: rgba(16,185,129,0.30);
    --accent2: #818cf8;
    --accent-txt: #06231a;
    --placeholder: #69717e;
    --switch-bg: #2c323d;
    --hover-overlay: rgba(255,255,255,0.05);
    --sidebar-gradient-end: #13161c;
    --console-bg: #13161c;
    --field: #21262f;
    --field-line: #363d49;
    --badge-teal-bg: rgba(13,124,143,0.2);
    --badge-teal-border: rgba(13,124,143,0.4);
    --badge-gold-bg: rgba(196,146,46,0.2);
    --badge-gold-border: rgba(196,146,46,0.4);
    --badge-red-bg: rgba(239,68,68,0.2);
    --badge-red-border: rgba(239,68,68,0.4);
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
    --shadow-md: 0 4px 14px rgba(0,0,0,0.4);
    --shadow-lg: 0 12px 32px rgba(0,0,0,0.5);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'IBM Plex Sans', 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    transition: background-color 0.3s ease, color 0.3s ease;
  }

  /* Header */
  .header {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 0 20px;
    height: 56px;
    display: flex;
    align-items: center;
    gap: 22px;
    position: relative;
    z-index: 10;
  }
  .brand { display: flex; align-items: center; gap: 10px; }
  .logo-square {
    width: 30px; height: 30px; border-radius: 9px;
    background: var(--qlik-green); color: var(--accent-txt);
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 16px;
    box-shadow: 0 2px 8px var(--qlik-green-glow);
  }
  .header h1 { font-size: 16px; font-weight: 700; color: var(--text-bright); letter-spacing: -0.2px; }
  .header-right { margin-left: auto; display: flex; align-items: center; gap: 14px; }
  .org-name { font-size: 13px; color: var(--text-dim); }
  .avatar {
    width: 30px; height: 30px; border-radius: 50%;
    background: var(--accent2); color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; flex-shrink: 0;
  }
  .badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .badge-teal { background: var(--badge-teal-bg); color: var(--teal); border: 1px solid var(--badge-teal-border); }
  .badge-gold { background: var(--badge-gold-bg); color: var(--gold); border: 1px solid var(--badge-gold-border); }
  .badge-red  { background: var(--badge-red-bg); color: var(--error); border: 1px solid var(--badge-red-border); }

  /* ---- Top-level mode switch: underline tabs (Tenant Deployment vs Local Stack) ---- */
  .mode-switch { display: inline-flex; height: 100%; gap: 20px; }
  .mode-switch button {
    background: none; border: none; border-bottom: 2px solid transparent;
    color: var(--text-dim); padding: 0 2px; font-size: 14px; font-weight: 600;
    cursor: pointer; white-space: nowrap; height: 100%;
    transition: color var(--transition), border-color var(--transition);
  }
  .mode-switch button.active { color: var(--text-bright); border-bottom-color: var(--qlik-green); }
  .mode-switch button:not(.active):hover { color: var(--text); }
  /* Show only the active mode's nav items, console pane and status text */
  body.mode-tenant .wizard-nav button.nav-local { display: none; }
  /* Local Stack & Gateway hides the left step rail entirely (like Help) and uses the
     freed space for the form + console. */
  body.mode-local  .wizard-nav { display: none; }
  body.mode-local  .layout { grid-template-columns: minmax(440px, 1.1fr) minmax(380px, 1fr); }
  .console-pane { display: none; }
  body.mode-tenant #console-tenant { display: block; }
  body.mode-local  #console-local  { display: block; }
  body.mode-tenant #status-text-local  { display: none; }
  body.mode-local  #status-text-tenant { display: none; }

  /* Help view (third mode) — full-width scrollable reference; hides the 3-col layout */
  #help-view { display: none; overflow-y: auto; height: calc(100vh - 56px); }
  body.mode-help .layout { display: none; }
  body.mode-help #help-view { display: block; }
  .help-wrap { max-width: 880px; margin: 0 auto; padding: 30px 28px 64px; color: var(--text); }
  .help-wrap h1 { font-size: 24px; font-weight: 700; color: var(--text-bright); margin: 0 0 6px; }
  .help-lead { color: var(--text-dim); font-size: 14px; margin: 0 0 22px; line-height: 1.55; }
  .help-wrap h2 { font-size: 16px; font-weight: 700; color: var(--qlik-green); margin: 30px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
  .help-wrap h3 { font-size: 13px; font-weight: 700; margin: 16px 0 5px; color: var(--text-bright); }
  .help-wrap p, .help-wrap li { font-size: 13px; line-height: 1.6; }
  .help-wrap ul, .help-wrap ol { margin: 6px 0 10px 20px; }
  .help-wrap code { background: var(--surface2); padding: 1px 5px; border-radius: 4px; font-family: monospace; font-size: 12px; }
  .help-wrap table { width: 100%; border-collapse: collapse; margin: 10px 0 14px; font-size: 12.5px; }
  .help-wrap th, .help-wrap td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
  .help-wrap th { color: var(--text-dim); font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.4px; }
  .help-wrap a { color: var(--qlik-green); }
  .help-callout { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--qlik-green); border-radius: 6px; padding: 10px 14px; margin: 12px 0; font-size: 12.5px; line-height: 1.55; }

  /* Layout — three columns: step rail · form · console */
  .layout {
    display: grid;
    grid-template-columns: 268px minmax(440px, 1.1fr) minmax(380px, 1fr);
    height: calc(100vh - 56px);
  }
  @media (max-width: 1180px) {
    .layout { grid-template-columns: 248px 1fr; height: auto; min-height: calc(100vh - 56px); }
    .console-area { grid-column: 1 / -1; border-top: 1px solid var(--border); min-height: 340px; }
  }
  @media (max-width: 760px) {
    .layout { grid-template-columns: 1fr; }
  }

  /* Step rail (left column) */
  .wizard-nav {
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px 14px;
    overflow-y: auto;
  }
  .rail-progress { padding: 2px 8px 14px; border-bottom: 1px solid var(--border); margin-bottom: 10px; }
  .rail-progress .rp-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 9px; }
  .rail-progress .rp-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-faint); }
  .rail-progress .rp-step { font-size: 12px; font-weight: 700; color: var(--qlik-green); }
  .rail-progress .rp-bar { height: 6px; border-radius: 999px; background: var(--surface2); overflow: hidden; }
  .rail-progress .rp-fill { height: 100%; background: var(--qlik-green); border-radius: 999px; transition: width 0.3s ease; }
  body.mode-local .rail-progress { display: none; }

  .wizard-nav button {
    text-align: left;
    background: none;
    border: 1px solid transparent;
    color: var(--text-dim);
    padding: 9px 12px;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: all var(--transition);
  }
  .wizard-nav button:hover { background: var(--surface2); color: var(--text); }
  .wizard-nav button.active {
    background: var(--surface);
    border-color: var(--border);
    color: var(--text-bright);
    font-weight: 600;
    box-shadow: var(--shadow-sm);
  }
  .wizard-nav button .step-num {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--surface2);
    color: var(--text-dim);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
    transition: all var(--transition);
  }
  .wizard-nav button.active .step-num {
    background: var(--qlik-green);
    color: var(--accent-txt);
    border-color: transparent;
  }
  .wizard-nav button .step-check { margin-left: auto; font-size: 14px; color: var(--qlik-green); }
  /* Deploy step set apart as the terminal action */
  .wizard-nav button[onclick*="showPage(12)"] {
    margin-top: 10px;
    background: var(--surface);
    border-color: var(--border);
    box-shadow: var(--shadow-sm);
    color: var(--text-bright);
    font-weight: 600;
  }
  .wizard-nav button[onclick*="showPage(12)"] .step-num { background: var(--accent2); color: #fff; border-color: transparent; }

  /* Form (middle column) */
  .wizard-content {
    overflow-y: auto;
    padding: 26px 30px;
    background: var(--bg);
  }
  .wizard-page { display: none; }
  .wizard-page.active {
    display: block;
    animation: fadeIn 0.25s ease-out;
    max-width: 660px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    padding: 24px 26px;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .page-title {
    font-size: 17px;
    font-weight: 700;
    margin-bottom: 4px;
    color: var(--text-bright);
    letter-spacing: -0.2px;
  }
  .page-desc {
    font-size: 12px;
    color: var(--text-dim);
    margin-bottom: var(--sp-4);
    line-height: 1.5;
  }

  /* Form elements */
  .field {
    margin-bottom: 14px;
  }
  .field label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 6px;
    letter-spacing: 0;
  }
  .field input, .field select, .field textarea {
    width: 100%;
    padding: 10px 13px;
    background: var(--field);
    border: 1px solid var(--field-line);
    border-radius: var(--radius-md);
    color: var(--text);
    font-size: 13.5px;
    font-family: inherit;
    outline: none;
    transition: border-color var(--transition), box-shadow var(--transition);
  }
  .field input:focus, .field select:focus, .field textarea:focus {
    border-color: var(--qlik-green);
    box-shadow: 0 0 0 3px var(--qlik-green-glow);
  }
  .field input::placeholder, .field textarea::placeholder {
    color: var(--placeholder);
  }
  .field textarea {
    resize: vertical;
    min-height: 60px;
    font-family: 'Cascadia Code', 'Fira Code', monospace;
    font-size: 12px;
  }
  .field .hint {
    font-size: 11px;
    color: var(--placeholder);
    margin-top: 3px;
    line-height: 1.4;
  }
  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .field-row-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
  }
  /* RPM source toggle (local file vs GitHub URL) */
  .rpm-source-toggle { display: inline-flex; border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; margin: 2px 0 12px; }
  .rpm-source-toggle button { background: var(--surface); border: none; color: var(--text-dim); padding: 7px 16px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all var(--transition); }
  .rpm-source-toggle button + button { border-left: 1px solid var(--border); }
  .rpm-source-toggle button.active { background: var(--qlik-green); color: var(--accent-txt); }
  .rpm-source-toggle button:not(.active):hover { background: var(--surface2); color: var(--text); }

  /* Section divider */
  .section-divider {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-bright);
    margin: 22px 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 8px;
    letter-spacing: 0;
  }
  .wizard-page > .section-divider:first-of-type { margin-top: 4px; }
  .section-divider::before {
    content: '';
    width: 3px;
    height: 14px;
    background: var(--qlik-green);
    border-radius: 2px;
    flex-shrink: 0;
  }

  /* Toggle switches */
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 13px;
  }
  .toggle-row > label:not(.switch) {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }
  .switch {
    position: relative;
    width: 36px;
    height: 20px;
    flex-shrink: 0;
    flex-grow: 0;
  }
  .switch input { opacity: 0; width: 0; height: 0; }
  .slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background: var(--switch-bg);
    border-radius: 20px;
    transition: 0.2s;
  }
  .slider::before {
    content: '';
    position: absolute;
    height: 14px;
    width: 14px;
    left: 3px;
    bottom: 3px;
    background: var(--switch-knob);
    border-radius: 50%;
    transition: 0.2s;
  }
  .switch input:checked + .slider { background: var(--qlik-green); box-shadow: 0 0 8px var(--qlik-green-glow); }
  .switch input:checked + .slider::before { transform: translateX(16px); }

  /* File items */
  .file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    margin-bottom: 6px;
    font-size: 12px;
    transition: border-color var(--transition);
  }
  .file-item:hover { border-color: var(--teal); }
  .file-item input[type="checkbox"] { accent-color: var(--qlik-green); flex-shrink: 0; }
  .file-item .fname { flex: 1; overflow: hidden; text-overflow: ellipsis; }
  .file-item .fsize { color: var(--text-dim); font-variant-numeric: tabular-nums; flex-shrink: 0; }
  .file-item .fmeta { color: var(--text-dim); font-size: 11px; }

  /* Data product / glossary cards */
  .dp-card {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 12px 14px;
    margin-bottom: 8px;
    transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
  }
  .dp-card:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
    border-color: var(--dp-card-hover-border);
  }
  .dp-card .dp-name {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 3px;
  }
  .dp-card .dp-meta {
    font-size: 11px;
    color: var(--text-dim);
    line-height: 1.4;
  }
  .dp-card .dp-tags {
    margin-top: 5px;
  }
  .dp-card .dp-tags span {
    display: inline-block;
    padding: 2px 7px;
    background: var(--surface2);
    border-radius: var(--radius-sm);
    font-size: 10px;
    color: var(--text-dim);
    margin-right: 4px;
    margin-top: 2px;
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 20px;
    border: none;
    border-radius: var(--radius-md);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition);
    width: 100%;
    position: relative;
    overflow: hidden;
  }
  .btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--btn-sheen) 0%, transparent 60%);
    opacity: 0;
    transition: opacity var(--transition);
    pointer-events: none;
  }
  .btn:hover::after { opacity: 1; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn:disabled::after { display: none; }
  .btn-deploy {
    background: var(--qlik-green);
    color: var(--accent-txt);
    box-shadow: 0 6px 16px var(--qlik-green-glow);
  }
  .btn-deploy:hover:not(:disabled) {
    transform: translateY(-1px);
    background: var(--qlik-green-dark);
    box-shadow: 0 8px 20px var(--qlik-green-glow);
  }
  .btn-dry {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
  }
  .btn-dry:hover:not(:disabled) { background: var(--surface2); border-color: var(--text-faint); }
  .btn-stop {
    background: var(--error);
    color: #fff;
  }
  .btn-stop:hover:not(:disabled) { background: var(--stop-hover); }
  .btn-save {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 12px;
    padding: 7px 14px;
    width: auto;
  }
  .btn-save:hover { background: var(--surface2); border-color: var(--text-faint); }
  .btn-row { display: flex; gap: 8px; margin-top: 8px; }
  .btn-row .btn { flex: 1; }

  /* Console (right column) */
  .console-area {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--console-bg);
    border-left: 1px solid var(--border);
  }
  .console-toolbar {
    padding: 9px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--surface);
    flex-shrink: 0;
  }
  .console-tabs { display: flex; gap: 16px; }
  .console-tabs .ctab {
    background: none; border: none; border-bottom: 2px solid transparent;
    padding: 4px 2px; font-size: 13px; font-weight: 600; color: var(--text-dim);
    cursor: pointer; transition: color var(--transition), border-color var(--transition);
  }
  .console-tabs .ctab.active { color: var(--text-bright); border-bottom-color: var(--qlik-green); }
  .console-tabs .ctab[disabled] { opacity: 0.45; cursor: default; }
  .console-actions { margin-left: auto; display: flex; gap: 6px; }
  .status-pill {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12px; color: var(--text-dim);
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: var(--radius-full); padding: 3px 10px; flex-shrink: 0;
  }
  .status-pill .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--qlik-green); box-shadow: 0 0 6px var(--qlik-green-glow); flex-shrink: 0; }
  .console-toolbar button {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 4px 11px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    cursor: pointer;
    transition: border-color var(--transition), color var(--transition), background var(--transition);
  }
  .console-toolbar button:hover { border-color: var(--text-faint); color: var(--text); background: var(--surface2); }

  .console-pane {
    flex: 1;
    overflow-y: auto;
    padding: 14px 16px;
    font-family: 'IBM Plex Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
    font-size: 12.5px;
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .log-line { padding: 0; }
  .log-info    { color: var(--text); }
  .log-success { color: var(--success); }
  .log-warn    { color: var(--warn); }
  .log-error   { color: var(--error); }
  .log-section { color: var(--accent2); font-weight: 700; }
  .log-line .timestamp { color: var(--text-faint); margin-right: 4px; font-size: 11px; }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-dim);
    gap: 10px;
    text-align: center;
    padding: 24px;
  }
  .empty-state .icon {
    width: 56px; height: 56px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: var(--surface2); border: 1px solid var(--border);
    font-size: 22px; color: var(--qlik-green);
  }
  .empty-state .es-title { font-size: 15px; font-weight: 700; color: var(--text-bright); }
  .empty-state p { font-size: 13px; max-width: 260px; line-height: 1.5; }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--teal); }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .running-indicator { animation: pulse 1.5s infinite; }

  .save-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(80px);
    background: var(--qlik-green);
    color: var(--text-bright);
    padding: 10px 24px;
    border-radius: var(--radius-lg);
    font-size: 13px;
    font-weight: 600;
    opacity: 0;
    transition: all 0.3s;
    z-index: 100;
  }
  .save-toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
    box-shadow: 0 4px 20px var(--qlik-green-glow);
  }

  /* Theme toggle button */
  .theme-toggle {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-dim);
    height: 32px;
    padding: 0 12px;
    border-radius: var(--radius-full);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 600;
    transition: all var(--transition);
    flex-shrink: 0;
  }
  .theme-toggle:hover { background: var(--surface2); border-color: var(--text-faint); color: var(--text); }
  .theme-toggle #theme-icon { font-size: 14px; }

  /* Theme transition */
  body,
  .sidebar, .wizard-content, .field input,
  .field select, .field textarea, .dp-card,
  .file-item, .console-toolbar, .wizard-nav button,
  .badge, .btn, .toggle-row, .dp-card .dp-tags span {
    transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
  }

  /* Light is the default theme (:root); dark is body.dark-theme. The console
     and header now follow the active theme — no forced-dark overrides. */

  /* Keyboard focus-visible */
  *:focus-visible {
    outline: 2px solid var(--qlik-green);
    outline-offset: 2px;
  }
  *:focus:not(:focus-visible) {
    outline: none;
  }

  /* Mobile responsive (≤768px) */
  @media (max-width: 768px) {
    .header {
      padding: 10px 16px;
      gap: 10px 16px;
      flex-wrap: wrap;
      height: auto;
    }
    .header h1 { font-size: 16px; }
    .header .org-name { display: none; }
    .header .mode-switch { flex-basis: 100%; height: auto; order: 3; }
    .header .mode-switch button { flex: 1; height: auto; padding: 8px 2px; justify-content: center; }
    .header-right { gap: 10px; }

    .wizard-nav {
      flex-direction: row;
      overflow-x: auto;
      white-space: nowrap;
      -webkit-overflow-scrolling: touch;
      padding: 6px 8px;
      gap: 4px;
      scrollbar-width: none;
    }
    .wizard-nav::-webkit-scrollbar { display: none; }
    .wizard-nav button {
      flex-shrink: 0;
      padding: 6px 10px;
      font-size: 0;
      border-left: none;
      border-radius: var(--radius-md);
      border-bottom: 2px solid transparent;
    }
    .wizard-nav button.active {
      border-left: none;
      border-bottom-color: var(--qlik-green);
    }
    .wizard-nav button .step-num {
      font-size: 11px;
    }
    .wizard-nav button .step-check { display: none; }

    .wizard-content { padding: 12px; }

    .field-row,
    .field-row-3 {
      grid-template-columns: 1fr;
    }

    .btn { padding: 12px 16px; }
    .btn-row { flex-direction: column; }
    .btn-row .btn { flex: none; width: 100%; }

    .console-area { min-height: 300px; }
  }
</style>
</head>
<body class="mode-tenant">

<div class="header">
  <div class="brand">
    <span class="logo-square">M</span>
    <h1>MCG Deploy</h1>
  </div>
  <div class="mode-switch" id="mode-switch">
    <button id="mode-btn-tenant" class="active" onclick="setMode('tenant')">Tenant Deployment</button>
    <button id="mode-btn-local" onclick="setMode('local')">Local Stack &amp; Gateway</button>
    <button id="mode-btn-help" onclick="setMode('help')">Help</button>
  </div>
  <span id="run-badge" class="badge badge-gold" style="display:none">RUNNING</span>
  <div class="header-right">
    <button class="theme-toggle" id="theme-toggle" onclick="toggleTheme()" title="Toggle light/dark theme">
      <span id="theme-icon">&#9790;</span><span id="theme-label">Dark</span>
    </button>
    <span class="org-name">Meridian Commerce Group</span>
    <span class="avatar">MC</span>
  </div>
</div>

<div class="layout">

    <!-- Step rail -->
    <div class="wizard-nav" id="wizard-nav">
      <div class="rail-progress" id="rail-progress">
        <div class="rp-row"><span class="rp-label">Setup progress</span><span class="rp-step" id="rp-step">Step 1 of 11</span></div>
        <div class="rp-bar"><div class="rp-fill" id="rp-fill" style="width:10%"></div></div>
      </div>
      <button class="active" onclick="showPage(0)"><span class="step-num">1</span>Connection & Auth<span class="step-check" id="check-0"></span></button>
      <button class="nav-local" onclick="showPage(1)"><span class="step-num">&#9632;</span>Local Stack &amp; Gateway<span class="step-check" id="check-1"></span></button>
      <button onclick="showPage(2)"><span class="step-num">2</span>Spaces<span class="step-check" id="check-2"></span></button>
      <button onclick="showPage(3)"><span class="step-num">3</span>Data Connections<span class="step-check" id="check-3"></span></button>
      <button onclick="showPage(4)"><span class="step-num">4</span>Pipelines<span class="step-check" id="check-4"></span></button>
      <button onclick="showPage(5)"><span class="step-num">5</span>Data Products<span class="step-check" id="check-8"></span></button>
      <button onclick="showPage(6)"><span class="step-num">6</span>Build Apps & Theme<span class="step-check" id="check-5"></span></button>
      <button onclick="showPage(7)"><span class="step-num">7</span>Knowledge Base & Docs<span class="step-check" id="check-6"></span></button>
      <button onclick="showPage(8)"><span class="step-num">8</span>Automations<span class="step-check" id="check-7"></span></button>
      <button onclick="showPage(9)"><span class="step-num">9</span>Qlik Predict<span class="step-check" id="check-predict"></span></button>
      <button onclick="showPage(10)"><span class="step-num">10</span>Glossary<span class="step-check" id="check-9"></span></button>
      <button onclick="showPage(11)"><span class="step-num">11</span>Stewardship<span class="step-check" id="check-stewardship"></span></button>
      <button onclick="showPage(12)"><span class="step-num">&#9654;</span>Deploy<span class="step-check" id="check-10"></span></button>
    </div>

    <div class="wizard-content">

      <!-- Page 0: Connection & Auth -->
      <div class="wizard-page active" id="page-0">
        <div class="page-title">Connection & Authentication</div>
        <div class="page-desc">Configure your Qlik Cloud tenant connection and credentials.</div>

        <div class="section-divider">Tenant</div>
        <div class="field-row">
          <div class="field">
            <label>Hostname</label>
            <input type="text" id="f-tenant-host" placeholder="your-tenant">
            <div class="hint">e.g. my-company</div>
          </div>
          <div class="field">
            <label>Region</label>
            <select id="f-tenant-region">
              <option value="us.qlikcloud.com">us.qlikcloud.com</option>
              <option value="eu.qlikcloud.com">eu.qlikcloud.com</option>
              <option value="ap.qlikcloud.com">ap.qlikcloud.com</option>
              <option value="staging.qlikdev.com">staging.qlikdev.com</option>
            </select>
          </div>
        </div>

        <div class="section-divider">Authentication</div>
        <div class="field">
          <label>Method</label>
          <select id="f-auth-method" onchange="toggleAuthFields()">
            <option value="apikey">API Key</option>
            <option value="oauth">OAuth M2M (Client Credentials)</option>
          </select>
        </div>

        <div id="auth-apikey-fields">
          <div class="field">
            <label>API Key</label>
            <input type="password" id="f-api-key" placeholder="Enter your Qlik Cloud API key">
            <div class="hint">Generated in Qlik Cloud > Management Console > API Keys</div>
          </div>
        </div>

        <div id="auth-oauth-fields" style="display:none">
          <div class="field-row">
            <div class="field">
              <label>Client ID</label>
              <input type="text" id="f-oauth-client-id" placeholder="OAuth client ID">
            </div>
            <div class="field">
              <label>Client Secret</label>
              <input type="password" id="f-oauth-client-secret" placeholder="OAuth client secret">
            </div>
          </div>
          <div class="field">
            <label>Token URL</label>
            <input type="text" id="f-oauth-token-url" placeholder="https://tenant.region/oauth/token">
            <div class="hint">Leave blank to auto-construct from tenant hostname + region</div>
          </div>
        </div>

        <div class="btn-row" style="margin-top:16px">
          <button class="btn btn-deploy" onclick="testConnection()" id="btn-test-conn" style="flex:1;font-size:13px;padding:11px 14px">
            &#9889; Test Connection
          </button>
        </div>
        <div id="test-conn-result" style="margin-top:8px;font-size:12px;line-height:1.5;display:none;padding:8px 12px;border-radius:var(--radius-md);border:1px solid var(--border)"></div>
      </div>

      <!-- Page 1: Docker Containers -->
      <div class="wizard-page" id="page-1">
        <div class="page-title">Local Stack &amp; Gateway</div>
        <div class="page-desc">Deploy and manage the local data sources (Kafka, PostgreSQL, simulators) and the optional Data Movement Gateway on this machine.</div>

        <div class="hint" style="background:rgba(13,124,143,0.12);border:1px solid var(--teal);border-radius:6px;padding:8px 12px;margin-bottom:10px">
          <strong>Deployed separately from the tenant.</strong> These containers run locally and are <strong>not</strong> part of the tenant <em>Deploy</em> step — start/stop them here on their own timeline. The Data Movement Gateway image build can take several minutes; closing this page won't cancel it (it builds in the container engine).
        </div>

        <div class="section-divider">Stack Selection</div>
        <div class="field">
          <label>Compose Profile</label>
          <select id="f-docker-profile">
            <option value="full-stack">Full Stack (Kafka + Simulators)</option>
            <option value="full-stack-dmg">Full Stack + DMG Gateway</option>
            <option value="kafka">Kafka Only</option>
            <option value="simulators">Simulators Only</option>
            <option value="dmg">DMG Gateway Only</option>
          </select>
          <div class="hint">Choose which containers to start. Full Stack + DMG includes the Data Movement Gateway with all databases.</div>
        </div>
        <div id="docker-compose-info" style="margin-top:8px"><!-- populated by JS --></div>

        <div class="section-divider">Environment Variables</div>

        <div class="field-row">
          <div class="field">
            <label>Tenant URL</label>
            <input type="text" id="f-docker-tenant-url" placeholder="your-tenant.us.qlikcloud.com">
            <div class="hint">Qlik Cloud tenant (for DMG registration)</div>
          </div>
          <div class="field">
            <label>Kafka Bootstrap</label>
            <input type="text" id="f-docker-kafka-bootstrap" value="kafka:9092">
          </div>
        </div>

        <div style="font-size:12px;font-weight:600;color:var(--text-dim);margin:10px 0 6px;text-transform:uppercase;letter-spacing:0.5px">PostgreSQL (Simulator)</div>
        <div class="field-row-3">
          <div class="field">
            <label>Database</label>
            <input type="text" id="f-docker-pg-db" value="mcg_wms">
          </div>
          <div class="field">
            <label>User</label>
            <input type="text" id="f-docker-pg-user" value="mcg_admin">
          </div>
          <div class="field">
            <label>Password</label>
            <input type="text" id="f-docker-pg-pass" value="mcg_demo_2025">
          </div>
        </div>

        <div id="dmg-settings" style="display:none">
          <div style="font-size:12px;font-weight:600;color:var(--text-dim);margin:10px 0 6px;text-transform:uppercase;letter-spacing:0.5px">DMG Gateway Databases</div>
          <div class="field-row-3">
            <div class="field">
              <label>PG Password</label>
              <input type="text" id="f-docker-dmg-pg-pass" value="Qlik1234">
            </div>
            <div class="field">
              <label>MySQL Password</label>
              <input type="text" id="f-docker-dmg-mysql-pass" value="Qlik1234">
            </div>
            <div class="field">
              <label>MSSQL SA Password</label>
              <input type="text" id="f-docker-dmg-mssql-pass" value="Qlik1234!">
            </div>
          </div>

          <div id="dmg-rpm-status" style="margin:8px 0"><!-- populated by JS --></div>

          <div style="font-size:12px;font-weight:600;color:var(--text-dim);margin:10px 0 6px;text-transform:uppercase;letter-spacing:0.5px">Gateway RPM Source</div>
          <div class="rpm-source-toggle" id="rpm-source-toggle">
            <button type="button" class="active" data-src="local" onclick="setRpmSource('local')">Local file</button>
            <button type="button" data-src="github" onclick="setRpmSource('github')">GitHub URL</button>
          </div>
          <div class="field" id="rpm-field-local">
            <label>RPM File Path <span style="font-weight:400;color:var(--text-dim)">(local — takes precedence)</span></label>
            <input type="text" id="f-docker-rpm-path" placeholder="C:\\Users\\you\\Downloads\\qlik-data-gateway-data-movement.rpm">
            <div class="hint">Absolute path to the RPM on this machine — it is copied into the image build context and used as-is.</div>
          </div>
          <div class="field" id="rpm-field-github" style="display:none">
            <label>RPM Download URL</label>
            <input type="text" id="f-docker-rpm-url" placeholder="https://github.com/qlik-download/saas-download-links/releases/download/...">
            <div class="hint">Direct download URL — fetched automatically before building.<br>
              Browse releases: <a href="https://github.com/qlik-download/saas-download-links/releases" target="_blank" style="color:var(--teal)">github.com/qlik-download/saas-download-links/releases</a>
            </div>
          </div>
        </div>

        <div class="section-divider">Deploy</div>
        <div class="btn-row">
          <button class="btn btn-deploy" id="btn-docker-deploy" onclick="dockerAction('up', true)" style="flex:1;font-size:14px;font-weight:700;padding:12px">Deploy Local Stack</button>
        </div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:6px;padding-left:2px">
          Builds and starts the selected profile's containers (and the gateway image for DMG profiles) on <strong>this machine</strong>. This Deploy is specific to the local stack &amp; gateway — it is <strong>separate from the tenant <em>Deploy</em> step</strong> and never touches your Qlik Cloud tenant.
        </div>

        <div class="section-divider">Manage Containers</div>
        <div class="btn-row">
          <button class="btn btn-dry" id="btn-docker-up" onclick="dockerAction('up')">Start Containers</button>
          <button class="btn btn-stop" id="btn-docker-down" onclick="dockerAction('down')">Stop Containers</button>
        </div>
        <div class="btn-row" style="margin-top:6px">
          <button class="btn btn-dry" id="btn-docker-status" onclick="dockerAction('status')">Status</button>
          <button class="btn btn-stop" id="btn-docker-prune" onclick="dockerAction('prune')" style="background:rgba(196,146,46,0.15);border-color:var(--gold);color:var(--gold)">Clean All Artifacts</button>
        </div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:6px;padding-left:2px">
          <strong>Start Containers</strong> only starts the existing containers; <strong>Stop Containers</strong> stops them. Neither rebuilds — use <strong>Deploy</strong> above to (re)build. <strong>Status</strong> shows what's running. <strong>Clean All Artifacts</strong> removes images, volumes, and build cache for a fresh rebuild.
        </div>

        <div class="section-divider">Data Movement Gateway</div>
        <div class="btn-row">
          <button class="btn btn-dry" id="btn-docker-gateway-start" onclick="dockerAction('gateway-start')">Start Gateway</button>
          <button class="btn btn-stop" id="btn-docker-gateway-stop" onclick="dockerAction('gateway-stop')">Stop Gateway</button>
        </div>
        <div class="btn-row" style="margin-top:6px">
          <button class="btn btn-primary" id="btn-docker-gateway-token" onclick="dockerAction('gateway-token')" style="background:rgba(99,102,241,0.15);border-color:var(--accent2);color:var(--accent2)">Register Gateway / Get Token</button>
        </div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:6px;padding-left:2px">
          <strong>Start / Stop Gateway</strong> control just the <code>mcg-qlik-dmg</code> container — the gateway goes Connected / Disconnected in Qlik Cloud accordingly, independent of <strong>Start / Stop Containers</strong> above. <strong>Register Gateway / Get Token</strong> retrieves the registration token from the running container and prints it to the console — copy it, then in Qlik Cloud go to <strong>Administration → Data Gateways → Register</strong> and paste it. <a href="https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Gateways/dm-gateway-setting-up.htm" target="_blank" rel="noopener" style="color:var(--accent)">Setup guide ↗</a>
        </div>
      </div>

      <!-- Page 2: Spaces -->
      <div class="wizard-page" id="page-2">
        <div class="page-title">Spaces</div>
        <div class="page-desc">Configure the Qlik Cloud spaces the demo deploys into.</div>

        <div class="section-divider">Spaces</div>
        <div class="toggle-row">
          <label>Enable Spaces</label>
          <label class="switch"><input type="checkbox" id="f-en-spaces" checked><span class="slider"></span></label>
        </div>
        <div class="field-row-3">
          <div class="field">
            <label>Shared Space Name</label>
            <input type="text" id="f-space-shared" placeholder="MCG Demo - Development">
          </div>
          <div class="field">
            <label>Managed Space Name</label>
            <input type="text" id="f-space-managed" placeholder="MCG Demo - Published">
          </div>
          <div class="field">
            <label>Data Space Name</label>
            <input type="text" id="f-space-data" placeholder="MCG Demo - DI">
          </div>
        </div>
        <div class="hint" style="margin-top:4px;padding-left:2px">
          <strong>Shared</strong> = where you build (analytics dev). <strong>Managed</strong> = governed / published content. <strong>Data</strong> = Data Integration source connections (gateway-bound DB sources, Kafka).
        </div>

        <div class="hint" style="margin-top:12px">
          Local containers (Kafka + simulators) and the Data Movement Gateway deploy separately from the
          <strong>Local Stack &amp; Gateway</strong> tab using its <strong>Deploy</strong> button — they are never part of the tenant deployment.
        </div>
      </div>

      <!-- Page 3: Data Connections -->
      <div class="wizard-page" id="page-3">
        <div class="page-title">Data Connections</div>
        <div class="page-desc">Configure source system connections for PostgreSQL, MySQL, Kafka, and S3.</div>

        <div class="toggle-row">
          <label>Enable Data Connections</label>
          <label class="switch"><input type="checkbox" id="f-en-connections" checked><span class="slider"></span></label>
        </div>

        <div id="docker-prefill-banner" style="display:none;margin:8px 0 12px;padding:10px 14px;border-radius:var(--radius);background:rgba(13,124,143,0.12);border:1px solid rgba(13,124,143,0.3);font-size:12px;color:var(--teal)">
          &#9432; Docker containers are enabled — PostgreSQL and Kafka fields have been pre-filled with Docker-local values. You can override them if connecting to external services.
        </div>

        <div class="section-divider">Data Gateway</div>
        <div class="field">
          <label>Data Gateway ID <span style="color:var(--text-dim);font-weight:400">(Data Movement)</span></label>
          <input type="text" id="f-data-gateway-id" placeholder="paste your Data gateway ID — see below">
          <div class="hint">
            Required for <strong>all gateway-bound source &amp; target connections</strong> (PostgreSQL, MySQL, SQL Server, Kafka, …) — it routes them through your on-prem Data Movement gateway.
            <strong>How to find it:</strong> in Qlik Cloud go to <strong>Administration → Data Gateways</strong>, find your Data Movement gateway, and click its <strong>Data gateway ID</strong> value to select &amp; copy it.
            Leave blank to skip auto-create and build connections in the Data Integration UI instead.
            <a href="https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Gateways/dm-gateway-setting-up.htm" target="_blank" rel="noopener" style="color:var(--accent)">Gateway help ↗</a>
          </div>
        </div>

        <div class="section-divider">PostgreSQL (WMS)</div>
        <div class="field">
          <label>Connection Name</label>
          <input type="text" id="f-pg-name" placeholder="MCG WMS Database">
        </div>
        <div class="field-row">
          <div class="field">
            <label>Host</label>
            <input type="text" id="f-pg-host" placeholder="your-postgres-host.example.com">
          </div>
          <div class="field">
            <label>Port</label>
            <input type="number" id="f-pg-port" value="5432">
          </div>
        </div>
        <div class="field-row-3">
          <div class="field">
            <label>Database</label>
            <input type="text" id="f-pg-database" placeholder="mcg_wms">
          </div>
          <div class="field">
            <label>Username</label>
            <input type="text" id="f-pg-username" placeholder="mcg_admin">
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" id="f-pg-password" placeholder="password">
          </div>
        </div>

        <div class="section-divider">Meridian CRM (MySQL)</div>
        <div class="field">
          <label>Connection Name</label>
          <input type="text" id="f-crm-name" placeholder="MCG CRM Database">
        </div>
        <div class="field-row">
          <div class="field">
            <label>Host</label>
            <input type="text" id="f-crm-host" placeholder="your-mysql-host.example.com">
          </div>
          <div class="field">
            <label>Port</label>
            <input type="number" id="f-crm-port" value="3307">
          </div>
        </div>
        <div class="field-row-3">
          <div class="field">
            <label>Database</label>
            <input type="text" id="f-crm-database" placeholder="mcg_crm">
          </div>
          <div class="field">
            <label>Username</label>
            <input type="text" id="f-crm-username" placeholder="qlik_cdc">
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" id="f-crm-password" placeholder="password">
          </div>
        </div>
        <div class="hint">
          The CRM is a <strong>MySQL replication source</strong> bound to the Data Movement gateway, exactly like the
          WMS above — so the deploy creates it for you as long as <strong>Data Gateway ID</strong> is set on the
          Connection page. It replaces a SaaS CRM connector that needed an interactive OAuth login and therefore could
          never be created headlessly.
          <br><br>
          <strong>Host</strong> must be reachable <em>from the gateway container</em>, not from your laptop — use the
          compose service name (<code>mysql</code>) when the gateway runs in the same stack, or the host IP otherwise.
          <strong>Port 3307</strong> is the host-side port: the gateway container already binds 3306, so the CRM is
          published one port up. Inside the compose network it is still <code>mysql:3306</code>.
          <br><br>
<code>qlik_cdc</code> owns the <code>mcg_crm</code> database and additionally holds the global
          replication grants CDC needs — applied by
          <code>infrastructure/mysql-init/01-cdc-grants.sh</code>, so the gateway never connects as root. The
          connection name must match <code>MCG CRM Database</code> or the pipeline binding in
          <code>bindings.json</code> will not resolve.
        </div>

        <div class="section-divider">Kafka (IoT Telemetry)</div>
        <div class="field">
          <label>Connection Name</label>
          <input type="text" id="f-kafka-name" placeholder="MCG IoT Telemetry">
        </div>
        <div class="field-row">
          <div class="field">
            <label>Bootstrap Servers</label>
            <input type="text" id="f-kafka-bootstrap" placeholder="localhost:9092">
          </div>
          <div class="field">
            <label>Security Protocol</label>
            <select id="f-kafka-protocol">
              <option value="PLAINTEXT">PLAINTEXT</option>
              <option value="SASL_SSL">SASL_SSL</option>
            </select>
          </div>
        </div>
        <div class="field-row" id="kafka-sasl-fields" style="display:none">
          <div class="field">
            <label>SASL Username</label>
            <input type="text" id="f-kafka-sasl-user" placeholder="kafka user">
          </div>
          <div class="field">
            <label>SASL Password</label>
            <input type="password" id="f-kafka-sasl-pass" placeholder="kafka password">
          </div>
        </div>

        <div class="section-divider">Amazon Athena (Analytics reads — Open Lakehouse)</div>
        <div class="hint">The analytics apps read the Open Lakehouse through Athena: the lakehouse's Iceberg tables are queried via the Glue catalog (databases bronze / silver / gold). The QVS load scripts <code>LIB CONNECT TO</code> this connection by name. IAM credentials are completed in the Qlik Cloud UI after deploy.</div>
        <div class="field">
          <label>Connection Name</label>
          <input type="text" id="f-athena-name" placeholder="MCG Lakehouse (Athena)">
        </div>
        <div class="field-row-3">
          <div class="field">
            <label>Region</label>
            <input type="text" id="f-athena-region" placeholder="us-east-1">
          </div>
          <div class="field">
            <label>Workgroup</label>
            <input type="text" id="f-athena-workgroup" placeholder="primary">
          </div>
          <div class="field">
            <label>S3 Output Location</label>
            <input type="text" id="f-athena-output" placeholder="s3://mcg-athena-results/">
          </div>
        </div>

        <div class="section-divider">S3 (Flat File Outputs)</div>
        <div class="field">
          <label>Connection Name</label>
          <input type="text" id="f-s3-name" placeholder="MCG Flat File Outputs">
        </div>
        <div class="field-row-3">
          <div class="field">
            <label>Bucket Name</label>
            <input type="text" id="f-s3-bucket" placeholder="mcg-demo-outputs">
          </div>
          <div class="field">
            <label>Region</label>
            <input type="text" id="f-s3-region" placeholder="eu-west-1">
          </div>
          <div class="field">
            <label>Prefix</label>
            <input type="text" id="f-s3-prefix" placeholder="exports/">
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Access Key ID</label>
            <input type="password" id="f-s3-access-key" placeholder="AWS access key">
          </div>
          <div class="field">
            <label>Secret Access Key</label>
            <input type="password" id="f-s3-secret-key" placeholder="AWS secret key">
          </div>
        </div>
      </div>

      <!-- Page: Pipelines (declarative import — primary deployment method) -->
      <div class="wizard-page" id="page-pipelines">
        <div class="page-title">Pipelines</div>
        <div class="page-desc">Deploy both Open Lakehouse pipelines from version-controlled YAML (deploy/pipelines/) via the DI Projects API — the primary deployment method.</div>

        <div class="toggle-row">
          <label>Import Declarative Pipeline Projects</label>
          <label class="switch"><input type="checkbox" id="f-en-pipelines" checked><span class="slider"></span></label>
        </div>

        <div class="section-divider">Pipeline Projects (from YAML)</div>
        <div class="hint">Each project below imports as its own DI project; tasks start in dependency order (landing &rarr; transform &rarr; datamart).</div>
        <div id="pipeline-task-list"><!-- populated by JS --></div>

        <div class="section-divider">Connection Bindings</div>
        <div class="hint">The pipeline's landing tasks bind to the connections from the Data Connections page by name. Bindings are resolved to connection IDs automatically at deploy time (Step 13).</div>
        <div id="pipeline-conn-map"><!-- populated by JS --></div>

        <div class="section-divider">Deployment Options</div>
        <div class="toggle-row">
          <label>Prepare project after import</label>
          <label class="switch"><input type="checkbox" id="f-pipelines-prepare"><span class="slider"></span></label>
        </div>
        <div class="toggle-row">
          <label>Start tasks after prepare (landing &rarr; transform &rarr; datamart)</label>
          <label class="switch"><input type="checkbox" id="f-pipelines-run"><span class="slider"></span></label>
        </div>
        <div class="hint">Schedules are declared in each project's YAML (one per task): the silver transform is event-triggered by its landings, the gold datamart runs daily at 06:00 UTC, and CDC/streaming landings run continuously once started. Dataset attachment to Data Products is configured on the Data Products page. Round-trip UI edits back into the repo with <code>npm run deploy:export-pipeline</code>; build credential-free import packages with <code>npm run pipeline:zip</code>.</div>
      </div>

      <!-- Page (index 5): Data Products (immediately after Pipelines) -->
      <div class="wizard-page" id="page-dataproducts">
        <div class="page-title">Data Products</div>
        <div class="page-desc">Gold-layer data product definitions to register in the Qlik Cloud catalog.</div>

        <div class="toggle-row">
          <label>Enable Data Products</label>
          <label class="switch"><input type="checkbox" id="f-en-dataproducts" checked><span class="slider"></span></label>
        </div>

        <div class="section-divider">Products from data_products.json</div>
        <div id="dp-list"><!-- populated by JS --></div>

        <div class="section-divider">Dataset Attachment (from the pipeline)</div>
        <div class="toggle-row">
          <label>Attach gold datasets to Data Products</label>
          <label class="switch"><input type="checkbox" id="f-pipelines-attach" checked><span class="slider"></span></label>
        </div>
        <div class="toggle-row">
          <label>Publish (activate) Data Products to the marketplace</label>
          <label class="switch"><input type="checkbox" id="f-pipelines-publish"><span class="slider"></span></label>
        </div>
        <div class="hint">Each product above shows the gold dataset the pipeline creates for it. Attachment happens via the Data Products API (JSON-Patch datasetIds) after the pipeline has run; tables not in the catalog yet are skipped with a warning — re-deploy after the first run to attach them.</div>

      </div>

      <!-- Page: Build Apps & Theme -->
      <div class="wizard-page" id="page-4">
        <div class="page-title">Build Apps & Theme</div>
        <div class="page-desc">Create the analytics apps with load scripts that read the Open Lakehouse — gold data products and silver datasets — through the Amazon Athena connection, then author the sheets via Qlik MCP. Includes the MCG theme upload.</div>

        <div class="section-divider">App Definitions</div>
        <div id="build-app-defs">
          <div style="font-size:12px;color:var(--text-dim)">Loading app definitions...</div>
        </div>

        <div class="section-divider">Build Options</div>
        <div class="toggle-row">
          <label>Verbose Logging</label>
          <label class="switch"><input type="checkbox" id="build-opt-verbose" checked><span class="slider"></span></label>
        </div>
        <div class="toggle-row">
          <label>Create sheets via Qlik MCP (build empty apps only)</label>
          <label class="switch"><input type="checkbox" id="f-apps-sheets-mcp" checked><span class="slider"></span></label>
        </div>
        <div class="hint">ON (recommended): the build creates each app empty — just the load script, mapped to the gold data products and silver datasets in the Open Lakehouse and read through the <b>Amazon Athena</b> connection (Data Connections page) — and you author the sheets conversationally with the Qlik MCP prompts below. OFF: the legacy builder creates master items and sheets from app-definitions via the Engine API.</div>

        <div class="section-divider">Sheet Prompts (Qlik MCP)</div>
        <div class="hint">Connect Claude Desktop/Code to your tenant's MCP endpoint (<code>https://&lt;tenant&gt;/api/ai/mcp</code> with an API key), then copy one prompt per sheet. Field names match the QVS load scripts exactly, which load from the pipeline's data products.</div>
        <div id="mcp-prompts-list"><!-- populated by JS --></div>

        <div class="section-divider">Actions</div>
        <div class="btn-row">
          <button class="btn btn-deploy" id="btn-build-apps" onclick="startBuildApps(false)">Build Apps</button>
          <button class="btn btn-dry" id="btn-build-dry" onclick="startBuildApps(true)">Build (Dry Run)</button>
        </div>
        <div class="btn-row" id="build-stop-row" style="display:none;margin-top:6px">
          <button class="btn btn-stop" onclick="stopBuildApps()">Stop Build</button>
        </div>

        <div id="build-summary" style="margin-top:12px;display:none">
          <div class="section-divider">Build Result</div>
          <div id="build-summary-content" style="font-size:12px"></div>
        </div>

        <div class="section-divider" style="margin-top:20px">Theme Upload</div>
        <div class="toggle-row">
          <label>Enable Theme Upload</label>
          <label class="switch"><input type="checkbox" id="f-en-theme" checked><span class="slider"></span></label>
        </div>
        <div class="field">
          <label>Theme Name</label>
          <input type="text" id="f-theme-name" placeholder="MCG Dark Theme">
        </div>
        <div id="theme-files"><!-- populated by JS --></div>
      </div>

      <!-- Page 5: Knowledge Base & Docs -->
      <div class="wizard-page" id="page-5">
        <div class="page-title">Knowledge Base & Documents</div>
        <div class="page-desc">Configure Qlik Answers knowledge base and select documents to upload.</div>

        <div class="toggle-row">
          <label>Enable Knowledge Base</label>
          <label class="switch"><input type="checkbox" id="f-en-knowledge" checked><span class="slider"></span></label>
        </div>

        <div class="field">
          <label>Space <span style="color:var(--text-dim);font-weight:400">(Knowledge Base &amp; Assistant)</span></label>
          <select id="f-answers-space">
            <option value="shared">Shared (MCG Demo - Development)</option>
            <option value="data">Data (MCG Demo - DI)</option>
          </select>
        </div>
        <div class="hint">The Qlik Answers knowledge base and assistant are created in this framework space — not your personal space. Shared is recommended. If one already exists in your personal space from a prior run, delete it first, then re-deploy.</div>

        <div class="section-divider">Knowledge Base</div>
        <div class="field">
          <label>Knowledge Base Name</label>
          <input type="text" id="f-kb-name" placeholder="MCG Operations Knowledge Base">
        </div>
        <div class="field">
          <label>Description</label>
          <input type="text" id="f-kb-desc" placeholder="Operational documents for Meridian Commerce Group">
        </div>

        <div class="section-divider">Qlik Answers Assistant</div>
        <div class="toggle-row">
          <label>Enable Assistant</label>
          <label class="switch"><input type="checkbox" id="f-en-assistant" checked><span class="slider"></span></label>
        </div>
        <div class="field">
          <label>Assistant Name</label>
          <input type="text" id="f-ast-name" placeholder="MCG Operations Assistant">
        </div>
        <div class="field">
          <label>Description</label>
          <input type="text" id="f-ast-desc" placeholder="AI assistant for Meridian Commerce Group operations.">
        </div>

        <div class="section-divider">Documents (.docx)</div>
        <div id="doc-files"><!-- populated by JS --></div>
        <div id="doc-count" style="margin-top:6px;font-size:11px;color:var(--text-dim)"></div>
        <div class="field" style="margin-top:4px">
          <div class="hint">Documents are loaded recursively from the documents/ directory and all subdirectories.</div>
        </div>
      </div>

      <!-- Page 6: Automations -->
      <div class="wizard-page" id="page-6">
        <div class="page-title">Automations</div>
        <div class="page-desc">Configure automation templates and Teams webhook integration.</div>

        <div class="toggle-row">
          <label>Enable Automations</label>
          <label class="switch"><input type="checkbox" id="f-en-automations" checked><span class="slider"></span></label>
        </div>

        <div class="field">
          <label>Teams Webhook URL</label>
          <input type="password" id="f-teams-webhook" placeholder="https://outlook.office.com/webhook/...">
          <div class="hint">Microsoft Teams incoming webhook for alert automations.</div>
        </div>

        <div class="section-divider">Automation Templates (JSON)</div>
        <div id="auto-files"><!-- populated by JS --></div>

        <div class="section-divider">Automation Definitions (Build via API)</div>
        <div id="build-auto-defs">
          <div style="font-size:12px;color:var(--text-dim)">Loading automation definitions...</div>
        </div>

        <div class="section-divider">Build Options</div>
        <div class="toggle-row">
          <label>Verbose Logging</label>
          <label class="switch"><input type="checkbox" id="build-auto-opt-verbose" checked><span class="slider"></span></label>
        </div>

        <div class="section-divider">Actions</div>
        <div class="btn-row">
          <button class="btn btn-deploy" id="btn-build-autos" onclick="startBuildAutomations(false)">Build Automations</button>
          <button class="btn btn-dry" id="btn-build-auto-dry" onclick="startBuildAutomations(true)">Build (Dry Run)</button>
        </div>
        <div class="btn-row" id="build-auto-stop-row" style="display:none;margin-top:6px">
          <button class="btn btn-stop" onclick="stopBuildAutomations()">Stop Build</button>
        </div>

        <div id="build-auto-summary" style="margin-top:12px;display:none">
          <div class="section-divider">Build Result</div>
          <div id="build-auto-summary-content" style="font-size:12px"></div>
        </div>

        <div class="field" style="margin-top:8px">
          <div class="hint">Automations are created in DISABLED state. Configure block details and triggers in the Qlik Cloud Automation Designer.</div>
        </div>
      </div>

      <!-- Page (index 9): Qlik Predict -->
      <div class="wizard-page" id="page-predict">
        <div class="page-title">Qlik Predict (ML)</div>
        <div class="page-desc">Create the Qlik Predict (AutoML) experiment, deployment, and prediction configuration over the gold data.</div>

        <div class="toggle-row">
          <label>Enable Qlik Predict</label>
          <label class="switch"><input type="checkbox" id="f-en-predict" checked><span class="slider"></span></label>
        </div>

        <div class="section-divider">Experiment</div>
        <div class="field">
          <label>Experiment Name</label>
          <input type="text" id="f-predict-experiment" placeholder="MCG Delivery Risk">
        </div>
        <div class="field">
          <label>Description</label>
          <input type="text" id="f-predict-description" placeholder="Predicts late-delivery risk from the gold last_mile_performance features.">
        </div>
        <div class="field">
          <label>Space</label>
          <select id="f-predict-space">
            <option value="shared">Shared (MCG Demo - Development)</option>
            <option value="data">Data (MCG Demo - DI)</option>
          </select>
        </div>

        <div class="section-divider">Deployment</div>
        <div class="field-row">
          <div class="field">
            <label>Deployment Name</label>
            <input type="text" id="f-predict-deployment" placeholder="MCG Delivery Risk Deployment">
          </div>
          <div class="field">
            <label>Model ID <span style="color:var(--text-dim);font-weight:400">(optional)</span></label>
            <input type="text" id="f-predict-modelid" placeholder="trained model id — else resolved from a ready version">
          </div>
        </div>
        <div class="toggle-row" style="margin-top:4px">
          <label>Enable Predictions on the deployment</label>
          <label class="switch"><input type="checkbox" id="f-predict-enable-predictions" checked><span class="slider"></span></label>
        </div>

        <div class="hint">
          The deploy creates the <strong>experiment</strong> via the <code>/api/v1/ml</code> API (idempotent). The <strong>deployment + model activation + prediction configuration</strong> run once a trained model exists — train the experiment on the gold feature dataset (needs the <strong>Open Lakehouse</strong> deployed) or set a <strong>Model ID</strong>, then re-deploy; otherwise the step skips with guidance. Advanced <code>trainingVersion</code> / <code>batchPrediction</code> request bodies live in <code>config.json → predict</code>. See <strong>Help → §6 Analytics</strong>. (The legacy automl-* APIs were removed ~Feb 2026.)
        </div>
      </div>

      <!-- Page (index 10): Glossary -->
      <div class="wizard-page" id="page-8">
        <div class="page-title">Business Glossary</div>
        <div class="page-desc">Business glossary terms from glossary_terms.json to load into Qlik Cloud.</div>

        <div class="toggle-row">
          <label>Enable Glossary</label>
          <label class="switch"><input type="checkbox" id="f-en-glossary" checked><span class="slider"></span></label>
        </div>

        <div class="section-divider">Terms (<span id="gl-count">0</span> total)</div>
        <div id="gl-list" style="max-height:400px;overflow-y:auto"><!-- populated by JS --></div>
      </div>

      <!-- Page (index 11): Stewardship -->
      <div class="wizard-page" id="page-stewardship">
        <div class="page-title">Stewardship</div>
        <div class="page-desc">Create the Address Cleanup stewardship sprint that receives the UNRESOLVED branch of the Talend address job, and author the automation block graphs that close the loop.</div>

        <div class="section-divider">Sprint</div>
        <div class="field">
          <label>Sprint name</label>
          <input type="text" id="f-sw-name" placeholder="Address Cleanup">
        </div>
        <div class="field">
          <label>Space</label>
          <select id="f-sw-space">
            <option value="data">Data space (required)</option>
            <option value="shared">Shared space</option>
            <option value="managed">Managed space</option>
          </select>
        </div>
        <div style="margin:8px 0 12px;padding:10px 14px;border-radius:var(--radius);background:rgba(196,146,46,0.12);border:1px solid rgba(196,146,46,0.3);font-size:12px;line-height:1.55">
          <strong>Sprints must live in a data space.</strong> Creating one in a shared or managed space returns
          <code>403 NOT_ALLOWED_TO_CREATE_SPRINT</code> — that is the product enforcing the rule, not a permissions gap.
        </div>
        <div class="field">
          <label>Workflow</label>
          <select id="f-sw-workflow">
            <option value="ONE_STEP_VALIDATION">One-step validation</option>
            <option value="TWO_STEPS_VALIDATION">Two-step validation</option>
          </select>
        </div>
        <div class="field">
          <label>Assignment</label>
          <select id="f-sw-assign">
            <option value="AUTO">Auto</option>
            <option value="MANUAL">Manual</option>
          </select>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-dry" id="btn-sw-dry" onclick="createSprint(true)" style="flex:0 0 auto">Dry Run</button>
          <button class="btn btn-deploy" id="btn-sw-create" onclick="createSprint(false)" style="flex:1;white-space:nowrap">Create Sprint</button>
        </div>
        <div id="sw-result" style="margin-top:8px;font-size:12px;line-height:1.55;display:none;padding:8px 12px;border-radius:var(--radius-md);border:1px solid var(--border);white-space:pre-wrap"></div>

        <div class="section-divider">Record schema</div>
        <div class="page-desc" style="margin-bottom:8px">The 12 columns the job's UNRESOLVED branch emits. Raw fields stay visible but locked so the steward sees what arrived; the repaired fields are editable.</div>
        <div id="sw-schema" style="max-height:320px;overflow-y:auto"><!-- populated by JS --></div>

        <div class="section-divider">Automation workspaces</div>
        <div class="page-desc" style="margin-bottom:8px">Fills in the block graphs. Without this, the automations exist in the tenant as empty shells with <code>workspace: null</code>.</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-dry" onclick="pushWorkspaces(true)">Dry Run</button>
          <button class="btn btn-deploy" id="btn-sw-ws" onclick="pushWorkspaces(false)" style="flex:1">Author Workspaces</button>
        </div>
        <div id="sw-ws-result" style="margin-top:8px;font-size:12px;line-height:1.55;display:none;padding:8px 12px;border-radius:var(--radius-md);border:1px solid var(--border);white-space:pre-wrap"></div>
      </div>

      <!-- Page (index 12): Deploy -->
      <div class="wizard-page" id="page-9">
        <div class="page-title">Deploy</div>
        <div class="page-desc">Review your configuration, run pre-flight checks, and launch the deployment.</div>

        <div class="section-divider">Pre-Flight Checks</div>
        <div id="preflight-checks" style="font-size:12px"><!-- populated by JS --></div>

        <div class="section-divider">Options</div>
        <div class="toggle-row">
          <label>Verbose Logging</label>
          <label class="switch"><input type="checkbox" id="opt-verbose" checked><span class="slider"></span></label>
        </div>
        <div class="toggle-row">
          <label>Continue on Error</label>
          <label class="switch"><input type="checkbox" id="opt-continue" checked><span class="slider"></span></label>
        </div>

        <div class="section-divider">Enabled Components</div>
        <div id="deploy-summary" style="font-size:13px"><!-- populated by JS --></div>

        <div class="section-divider">Actions</div>
        <div class="btn-row">
          <button class="btn btn-save" onclick="saveCurrentConfig()" style="flex:0 0 auto;width:auto">Save Config</button>
        </div>
        <div class="btn-row" style="margin-top:12px">
          <button class="btn btn-dry" id="btn-dry" onclick="startDeploy(true)">Dry Run</button>
          <button class="btn btn-deploy" id="btn-deploy" onclick="startDeploy(false)">Deploy</button>
        </div>
        <div class="btn-row" id="stop-row" style="display:none">
          <button class="btn btn-stop" onclick="stopDeploy()">Stop</button>
        </div>
      </div>

    </div>

  <!-- Console Output -->
  <div class="console-area">
    <div class="console-toolbar">
      <div class="console-tabs">
        <button class="ctab active">Output</button>
      </div>
      <div class="console-actions">
        <button onclick="clearConsole()">Clear</button>
        <button onclick="copyConsole()">Copy</button>
        <button onclick="downloadLog()">Download</button>
      </div>
      <span class="status-pill"><span class="dot"></span><span class="status-text" id="status-text-tenant">Ready</span><span class="status-text" id="status-text-local">Ready</span></span>
    </div>
    <div id="console-tenant" class="console-pane">
      <div class="empty-state">
        <div class="icon">&#9654;</div>
        <div class="es-title">No output yet</div>
        <p>Configure your tenant deployment and click <strong>Deploy</strong> or <strong>Dry Run</strong> to stream live logs here.</p>
      </div>
    </div>
    <div id="console-local" class="console-pane">
      <div class="empty-state">
        <div class="icon">&#9654;</div>
        <div class="es-title">No output yet</div>
        <p>Pick a compose profile and click <strong>Deploy Local Stack</strong> to stream live logs here.</p>
      </div>
    </div>
  </div>
</div>

<div id="help-view">
  <div class="help-wrap">
    <h1>MCG Deploy — Help &amp; Reference</h1>
    <p class="help-lead">How to stand up and run the Meridian Commerce Group (MCG) Qlik Cloud demo — what each asset is for, how the pieces connect, the setup order, and where things commonly trip up.</p>

    <h2>1 · What this demo is</h2>
    <p>MCG is an end-to-end Qlik Cloud demo. Intentionally messy operational data from three sources flows through <strong>Qlik Talend Data Integration</strong> into an <strong>Open Lakehouse</strong>, is governed and published as <strong>data products</strong>, and is consumed by <strong>analytics apps</strong> and <strong>AI</strong>. It is organized around four stories:</p>
    <ul>
      <li><strong>Integrations</strong> — three very different sources (database CDC, IoT streaming, SaaS API) unified into one lakehouse.</li>
      <li><strong>Governance</strong> — lineage, trust scores, stewardship, glossary, and data products.</li>
      <li><strong>Analytics</strong> — two domain apps reading governed gold tables via Athena.</li>
      <li><strong>AI &amp; Outcomes</strong> — Qlik Predict, Qlik Answers, and the agentic experience.</li>
    </ul>

    <h2>2 · Demo assets &amp; their intent</h2>
    <table>
      <tr><th>Asset</th><th>What it is</th><th>Why it is in the demo</th></tr>
      <tr><td>Local stack (Docker)</td><td>Kafka + simulators + the DMG container, started from <em>Local Stack &amp; Gateway</em></td><td>Generates realistic, intentionally-flawed source data on your machine</td></tr>
      <tr><td>Data Movement gateway</td><td>The <code>mcg-qlik-dmg</code> container (PostgreSQL/MySQL/SQL Server + the gateway agent)</td><td>Lets Qlik Cloud reach the local databases for log-based CDC</td></tr>
      <tr><td>Spaces</td><td>Development (shared), Published (managed), MCG Demo - DI (data)</td><td>Separate where you build, where governed content is published, and where DI source connections live</td></tr>
      <tr><td>Data connections</td><td>PostgreSQL, Kafka, MySQL sources + Amazon Athena read-back</td><td>The inputs to the pipeline and the read path analytics uses</td></tr>
      <tr><td>Pipelines (QTCP)</td><td>Landing &rarr; transform &rarr; datamart tasks</td><td>Bronze &rarr; Silver &rarr; Gold medallion transforms with data-quality fixes</td></tr>
      <tr><td>Data products</td><td>Gold-layer tables registered as products</td><td>Governed, shareable, analytics-ready datasets with trust scores</td></tr>
      <tr><td>Apps</td><td>Supply Chain Operations + Delivery &amp; Customer Experience</td><td>Demonstrate analytics over the governed gold products</td></tr>
      <tr><td>Knowledge base + Assistant</td><td>Operational docs + a Qlik Answers assistant</td><td>Document intelligence and conversational AI over MCG content</td></tr>
      <tr><td>Automations</td><td>Teams alerts, pipeline-health automation</td><td>Operational alerting / closed-loop actions</td></tr>
      <tr><td>Glossary</td><td>Business glossary terms</td><td>Shared vocabulary tied to the governed data</td></tr>
      <tr><td>Theme</td><td>MCG dark theme</td><td>Branded look for the demo apps</td></tr>
    </table>

    <h2>3 · Architecture at a glance</h2>
    <p><strong>Sources</strong> (PostgreSQL WMS · Kafka IoT · Meridian CRM) &rarr; <strong>gateway / connectivity</strong> &rarr; <strong>Data Integration project</strong> (landing &rarr; transform &rarr; datamart) &rarr; <strong>Open Lakehouse</strong> (Apache Iceberg on S3 — bronze/silver/gold) &rarr; <strong>Amazon Athena</strong> &rarr; <strong>analytics apps + AI</strong>.</p>
    <p>Each source uses the right gateway type:</p>
    <table>
      <tr><th>Gateway</th><th>Used for</th><th>In this demo</th></tr>
      <tr><td>Data Movement gateway</td><td>Database CDC sources (Postgres/MySQL/SQL Server)</td><td>The on-prem <code>mcg-qlik-dmg</code> container — PostgreSQL source</td></tr>
      <tr><td>Streaming (network integration)</td><td>Kafka / streaming sources</td><td>The Kafka IoT source (<code>external_data_provider</code>)</td></tr>
      <tr><td>Qlik-hosted egress</td><td>SaaS sources reachable from Qlik Cloud</td><td>Amazon S3, Amazon Athena (credentialed, no gateway)</td></tr>
      <tr><td>Direct Access gateway</td><td>Analytics data loads via a gateway</td><td>Not used here</td></tr>
    </table>

    <h2>4 · Setup order</h2>
    <ol>
      <li><strong>Deploy the local stack</strong> — <em>Local Stack &amp; Gateway</em> &rarr; pick a profile (Full Stack + DMG) &rarr; <strong>Deploy Local Stack</strong>.</li>
      <li><strong>Register the Data Movement gateway</strong> — <strong>Register Gateway / Get Token</strong> prints the token &rarr; Qlik Cloud &rarr; <strong>Administration &rarr; Data Gateways &rarr; Register</strong> &rarr; wait for <strong>Connected</strong>.</li>
      <li><strong>Copy the Data gateway ID</strong> into <em>Tenant Deployment &rarr; Data Connections &rarr; Data Gateway ID</em> (see §5).</li>
      <li><strong>Create the source connections</strong> in the <strong>MCG Demo - DI</strong> data space — PostgreSQL <em>and MySQL</em> are auto-created by the deploy once a Data Gateway ID is set; Kafka is created in the Data Integration UI.</li>
      <li><strong>Run the tenant deploy</strong> — spaces, pipelines, data products, apps, knowledge base, automations, glossary.</li>
    </ol>

    <h2>5 · Gateway &amp; connections</h2>
    <h3>Register the gateway</h3>
    <p>On <em>Local Stack &amp; Gateway</em>, click <strong>Register Gateway / Get Token</strong> (or run <code>agentctl qcs get_registration</code> inside the <code>mcg-qlik-dmg</code> container). Paste the token in Qlik Cloud &rarr; <strong>Administration &rarr; Data Gateways &rarr; Register</strong> and wait for <strong>Connected</strong>.</p>
    <h3>Find the Data gateway ID</h3>
    <p>Qlik Cloud &rarr; <strong>Administration &rarr; Data Gateways</strong> &rarr; your Data Movement gateway &rarr; click the <strong>Data gateway ID</strong> value to copy it, then paste it into the <strong>Data Gateway ID</strong> field on the Data Connections page.</p>
    <h3>Per-source notes</h3>
    <ul>
      <li><strong>PostgreSQL</strong> — created by the deploy as a gateway-bound replication source (<code>repsrc_postgresql</code>) in MCG Demo - DI. Needs the Data Gateway ID.</li>
      <li><strong>Kafka (IoT)</strong> — a streaming source (<code>external_data_provider</code>) over a network integration, <em>not</em> the Data Movement gateway. Created in the DI UI.</li>
      <li><strong>Meridian CRM (MySQL)</strong> — a gateway-bound replication source (<code>repsrc_mysql</code>), created automatically by the deploy just like the WMS. Needs Host, Port, Database, Username and Password; the host must resolve <em>from the gateway container</em>, and the port is <code>3307</code> because the gateway itself binds 3306. Name it <code>MCG CRM Database</code> in <strong>MCG Demo - DI</strong> so the pipeline binding resolves.</li>
      <li><strong>Amazon S3 / Athena</strong> — credentialed connectors created in the UI (IAM keys).</li>
    </ul>

    <h2>6 · Analytics apps &amp; sheets (Qlik MCP)</h2>
    <p>The two domain apps — <strong>MCG Supply Chain Operations</strong> and <strong>MCG Delivery &amp; Customer Experience</strong> — read the gold data products <strong>through Amazon Athena</strong> over the Open Lakehouse. The Build Apps step creates each app <em>empty</em> (load script only, mapped to its gold product); the <strong>sheets are authored conversationally with the Qlik MCP server</strong>.</p>
    <p>All sheet-authoring prompts (5 per app) live in <code>deploy/apps/MCP_Sheet_Prompts.md</code> (generated from <code>deploy/apps/mcp-sheet-prompts.json</code> — the Build Apps page also surfaces them with copy buttons). Connect Claude Desktop / Code to your tenant's MCP endpoint (<code>/api/ai/mcp</code>) with a Bearer API key, then paste each prompt.</p>
    <table>
      <tr><th>App</th><th>Sheets (authored via MCP)</th></tr>
      <tr><td>Supply Chain Operations</td><td>Inventory Health Overview · Cold Chain Monitoring · Product Data Quality · Compliance &amp; Recall · Executive Cost Impact</td></tr>
      <tr><td>Delivery &amp; Customer Experience</td><td>Last Mile Performance · Live Shipment Tracking · WISMO &amp; Customer Impact · Order Timeline · Address Quality Impact</td></tr>
    </table>
    <p>Docs: <a href="https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikMCP/Qlik-MCP-server.htm" target="_blank" rel="noopener">Qlik MCP server &#8599;</a> · <a href="https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikMCP/Qlik-MCP-server-tools.htm" target="_blank" rel="noopener">MCP server tools &#8599;</a></p>

    <h2>7 · Credentials &amp; ports (local)</h2>
    <table>
      <tr><th>Service</th><th>Host : Port</th><th>Database</th><th>User / Password</th></tr>
      <tr><td>PostgreSQL (WMS)</td><td>localhost : 5432</td><td>mcg_wms</td><td>mcg_admin / mcg_demo_2025 (also postgres / Qlik1234)</td></tr>
      <tr><td>MySQL (DMG)</td><td>localhost : 3306</td><td>—</td><td>root / Qlik1234</td></tr>
      <tr><td>SQL Server (DMG)</td><td>localhost : 1433</td><td>—</td><td>sa / Qlik1234!</td></tr>
      <tr><td>Kafka broker</td><td>localhost : 9092</td><td>—</td><td>PLAINTEXT (no auth)</td></tr>
      <tr><td>Confluent Control Center</td><td>localhost : 9021</td><td>—</td><td>—</td></tr>
    </table>
    <div class="help-callout">WMS tables live in the <code>public</code> schema (<code>inventory_positions</code>, <code>warehouse_events</code>, <code>shipments</code>). The WMS Postgres is the DMG container's bundled instance.</div>

    <h2>8 · Troubleshooting</h2>
    <ul>
      <li><strong>Can't see <code>mcg_wms</code> in DBeaver</strong> — set the connection's Database to <code>mcg_wms</code> (or tick "Show all databases"), and use <code>mcg_admin</code> / <code>mcg_demo_2025</code>. The default <code>postgres</code> database won't list it.</li>
      <li><strong>CDC isn't capturing changes</strong> — PostgreSQL needs <code>wal_level = logical</code>. The gateway container sets this on a fresh build; if it still shows <code>replica</code>, rebuild the gateway.</li>
      <li><strong>Gateway shows Disconnected</strong> — use <strong>Start Gateway</strong> on Local Stack &amp; Gateway, or check the <code>mcg-qlik-dmg</code> container.</li>
      <li><strong>"Gateway not found" when creating a connection</strong> — use the connect-string path with <code>agentId=&lt;Data gateway ID&gt;</code> + <code>allowManagedGateway=true</code> (the deploy does this automatically).</li>
      <li><strong>Kafka source won't consume</strong> — the local broker is open PLAINTEXT; match the streaming source's auth instead of using SASL with a placeholder user.</li>
    </ul>

    <h2>9 · Documentation &amp; demo collateral</h2>
    <p>All materials live in the repo (<code>documents/</code> and the project root). Regenerate the generated ones with <code>node generators/generate-all.js</code>.</p>

    <h3>Setup &amp; build guides (Word)</h3>
    <ul>
      <li><strong>MCG Setup Guide</strong> — <code>documents/MCG_Setup_Guide.docx</code> — full environment setup, incl. gateway registration &amp; the source connections (§3.7–3.8).</li>
      <li><strong>Creation Guide — Automations &amp; Pipelines</strong> — <code>documents/MCG_Creation_Guide_Automations_Pipelines.docx</code> — building the CDC pipelines, automations, and data products.</li>
      <li><strong>MCP Sheet Prompts</strong> — <code>deploy/apps/MCP_Sheet_Prompts.md</code> — the Qlik MCP prompts that build each app's sheets (see §6).</li>
    </ul>

    <h3>Demo scripts (Word — 13)</h3>
    <p>In <code>documents/demo-scripts/</code> — each is a Tell → Show → Tell walkthrough of one topic:</p>
    <table>
      <tr><th>#</th><th>Demo script</th><th>What it covers</th></tr>
      <tr><td>01</td><td>Infrastructure &amp; Data Sources</td><td>Stand up the local stack and the three intentionally-messy sources: PostgreSQL WMS, Kafka IoT, Meridian CRM.</td></tr>
      <tr><td>02</td><td>Connections &amp; Spaces</td><td>Create the Qlik Cloud spaces and the gateway-bound source connections.</td></tr>
      <tr><td>03</td><td>Open Lakehouse</td><td>Land the sources into the Open Lakehouse (bronze → silver → gold, Apache Iceberg on S3); analytics reads it back via <strong>Amazon Athena</strong>.</td></tr>
      <tr><td>04</td><td>Lineage / Profiling / Trust</td><td>End-to-end lineage, data profiling, and trust scores across the medallion layers.</td></tr>
      <tr><td>05</td><td>Data Products API</td><td>Register the gold tables as governed data products (via API) with trust scores.</td></tr>
      <tr><td>06</td><td>Analytics Apps</td><td>Build the two domain apps over the gold products; sheets are authored via the Qlik MCP server (see §6).</td></tr>
      <tr><td>07</td><td>Alerting &amp; Reporting</td><td>Data alerts, reports, and subscriptions on the governed data.</td></tr>
      <tr><td>08</td><td>Qlik Predict</td><td>AutoML predictions (e.g. late-delivery / risk) on the supply-chain data.</td></tr>
      <tr><td>09</td><td>Qlik Answers</td><td>Document intelligence — ask natural-language questions over the MCG knowledge base.</td></tr>
      <tr><td>10</td><td>Stewardship</td><td>Human-in-the-loop data-quality stewardship workflows.</td></tr>
      <tr><td>11</td><td>Business Glossary</td><td>Publish the business glossary and apply data security / classification.</td></tr>
      <tr><td>12</td><td>Automations</td><td>Qlik Automations — Teams alerts, pipeline-health, closed-loop actions.</td></tr>
      <tr><td>13</td><td>Discovery Agent &amp; MCP</td><td>Enable the Discovery Agent and the Qlik MCP server for conversational / agentic analytics.</td></tr>
    </table>

    <h3>Presentations (PowerPoint — 4)</h3>
    <ul>
      <li><strong>Demo Overview — Four Stories</strong> — <code>MCG_Demo_Overview_Four_Stories.pptx</code> (incl. the gateway &amp; source-connections slide).</li>
      <li><strong>Technology Architecture</strong> — <code>MCG_Technology_Architecture.pptx</code> (incl. the Gateway &amp; Source Connections flow slide).</li>
      <li><strong>Marketecture</strong> — <code>MCG_Marketecture.pptx</code>.</li>
      <li><strong>Company Profile &amp; Data Quality</strong> — <code>MCG_Company_Profile_Data_Quality.pptx</code> (business / "7 Nightmares" deck).</li>
    </ul>

    <h3>Data reference</h3>
    <ul>
      <li><strong>Business Glossary</strong> — <code>documents/MCG_Business_Glossary.xlsx</code> (also loaded as a Qlik glossary).</li>
    </ul>

    <h3>Operational &amp; business documents (Word — 25)</h3>
    <p>The MCG corpus under <code>documents/</code> — loaded into the <strong>Knowledge Base</strong> and answered by the <strong>Assistant</strong> (Qlik Answers):</p>
    <table>
      <tr><th>Folder</th><th>Documents</th></tr>
      <tr><td>sops/ (5)</td><td>Goods Receiving · Cycle Count · Product Recall · Cold Chain Monitoring · WISMO Call Handling</td></tr>
      <tr><td>policies/ (4)</td><td>Cold Chain Management · EU Food Safety Compliance · Data Quality Standards · Shipping &amp; Delivery Promise</td></tr>
      <tr><td>carrier_contracts/ (3)</td><td>DPD Service Agreement · FedEx Rate Card · NinjaVan Contract Amendment</td></tr>
      <tr><td>incident_reports/ (2)</td><td>Rotterdam Pipeline Failure · TransFrio Spoilage</td></tr>
      <tr><td>supplier_comms/ (2)</td><td>FreshDirect Performance Review · TransFrio Contract Review</td></tr>
      <tr><td>training/ (2)</td><td>WMS↔SAP Integration Guide · Cold Chain Monitoring for Drivers</td></tr>
      <tr><td>purchase_orders/ (2)</td><td>Samsung Electronics · NinjaVan Packaging</td></tr>
      <tr><td>compliance · recall_notices · project_briefs · meeting_minutes · shipping (1 each)</td><td>NVWA Corrective Action Plan · Lettuce Recall · Project Qlarity Business Case · Q3 Supply Chain Review · Delivery Manifest</td></tr>
    </table>

    <h3>Source repositories (GitHub)</h3>
    <ul>
      <li><strong><a href="https://github.com/robertschoenfeldqlik/qlik_data_movement_gateway_rdbms_container" target="_blank" rel="noopener">qlik_data_movement_gateway_rdbms_container &#8599;</a></strong> — the <code>mcg-qlik-dmg</code> container (Oracle Linux 9 + systemd) bundling the Qlik Data Movement gateway with PostgreSQL / MySQL / SQL Server. Built &amp; run by <em>Local Stack &amp; Gateway → Deploy</em>; vendored here as the <code>infrastructure/dmg/gateway</code> submodule. <strong>Use:</strong> the on-prem gateway + databases the DB CDC sources route through (§5).</li>
      <li><strong><a href="https://github.com/robertschoenfeldqlik/OLH_Terra_Utility" target="_blank" rel="noopener">OLH_Terra_Utility &#8599;</a></strong> — a wizard-driven tool (AWS CLI + Terraform) that <strong>speeds up creating a Qlik Open Lakehouse cluster</strong> by provisioning the AWS resources it needs (S3, KMS, IAM, Kinesis, Glue Catalog, SSM Parameter Store). Run <code>run_qlik_deploy_gui.bat</code> (Windows) or <code>qlik_deploy_olh.sh</code> (Mac/Linux). <strong>Use:</strong> quickly stand up the Open Lakehouse cluster and the AWS infrastructure it lands into and that <strong>Amazon Athena</strong> reads (§3, §6) — before deploying the pipelines.</li>
    </ul>

    <h2>Links</h2>
    <ul>
      <li><a href="https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Gateways/dm-gateway-setting-up.htm" target="_blank" rel="noopener">Set up the Data Movement gateway &#8599;</a></li>
      <li><a href="https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Gateways/setting-up-gateways.htm" target="_blank" rel="noopener">Data gateways overview (types) &#8599;</a></li>
      <li><a href="https://qlik.dev/apis/rest/data-connections/" target="_blank" rel="noopener">Data Connections REST API &#8599;</a></li>
      <li><a href="https://github.com/robertschoenfeldqlik/qlik_data_movement_gateway_rdbms_container" target="_blank" rel="noopener">GitHub — qlik_data_movement_gateway_rdbms_container (gateway container) &#8599;</a></li>
      <li><a href="https://github.com/robertschoenfeldqlik/OLH_Terra_Utility" target="_blank" rel="noopener">GitHub — OLH_Terra_Utility (speeds up creating an Open Lakehouse cluster) &#8599;</a></li>
    </ul>
  </div>
</div>

<div class="save-toast" id="save-toast">Configuration saved!</div>

<script>
  let eventSource = null;
  let isRunning = false;
  let discoveredFiles = {};
  let loadedConfig = null;

  // --- Top-level mode (Tenant Deployment vs Local Stack & Gateway) ---
  // currentMode = which area is VISIBLE; _logPane = which console an in-flight
  // operation writes to (so a build's logs stay in their own pane even if the
  // user switches modes mid-run). _lastTenantPage remembers the wizard step to
  // return to when switching back from Local mode.
  let currentMode = 'tenant';
  let _logPane = 'tenant';
  let _lastTenantPage = 0;
  function logConsoleEl()  { return document.getElementById('console-' + _logPane); }
  function logStatusEl()   { return document.getElementById('status-text-' + _logPane); }
  function viewConsoleEl() { return document.getElementById('console-' + currentMode); }
  function viewStatusEl()  { return document.getElementById('status-text-' + currentMode); }
  function setMode(mode) {
    currentMode = mode;
    document.body.classList.toggle('mode-tenant', mode === 'tenant');
    document.body.classList.toggle('mode-local', mode === 'local');
    document.body.classList.toggle('mode-help', mode === 'help');
    document.getElementById('mode-btn-tenant').classList.toggle('active', mode === 'tenant');
    document.getElementById('mode-btn-local').classList.toggle('active', mode === 'local');
    var hb = document.getElementById('mode-btn-help');
    if (hb) hb.classList.toggle('active', mode === 'help');
    if (mode === 'local') showPage(1);
    else if (mode === 'help') { /* Help is a static view shown via CSS — no wizard page */ }
    else showPage(_lastTenantPage);
  }

  // --- Theme Toggle ---
  function initTheme() {
    // Light-first: default to light; only honor an explicit saved choice.
    const saved = localStorage.getItem('mcg-deploy-theme');
    applyTheme(saved === 'dark' ? 'dark' : 'light');
  }

  function applyTheme(theme) {
    const dark = theme === 'dark';
    document.body.classList.toggle('dark-theme', dark);
    const icon = document.getElementById('theme-icon');
    if (icon) icon.innerHTML = dark ? '&#9728;' : '&#9790;';  // sun when dark (→light), moon when light (→dark)
    const lbl = document.getElementById('theme-label');
    if (lbl) lbl.textContent = dark ? 'Light' : 'Dark';
  }

  function toggleTheme() {
    const newTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem('mcg-deploy-theme', newTheme);
  }

  // --- Wizard Navigation ---
  function showPage(idx) {
    if (idx !== 1) _lastTenantPage = idx;  // idx 1 is the Local Stack page (its own mode)
    document.querySelectorAll('.wizard-page').forEach((p, i) => {
      p.classList.toggle('active', i === idx);
    });
    document.querySelectorAll('.wizard-nav button').forEach((b, i) => {
      b.classList.toggle('active', i === idx);
    });
    if (idx === 11) renderStewardshipPage();
    if (idx === 12) renderSummary();
    if (idx === 3) prefillFromDocker();
    if (idx === 4) renderPipelinesPage();
    if (idx === 6) renderBuildAppsPage();
    if (idx === 8) renderBuildAutomationsPage();
    updateRailProgress(idx);
    var wc = document.querySelector('.wizard-content');
    if (wc) wc.scrollTop = 0;  // start each page/mode at the top, not mid-scroll
  }

  // Rail "Step X of 11" + progress bar. The 11 config steps are showPage 0,2..11;
  // Deploy (12) is the terminal action; Local Stack (1) has its own mode.
  var TENANT_STEP = { 0:1, 2:2, 3:3, 4:4, 5:5, 6:6, 7:7, 8:8, 9:9, 10:10, 11:11, 12:11 };
  function updateRailProgress(idx) {
    if (idx === 1) return;  // local page — not part of tenant progress
    var stepEl = document.getElementById('rp-step'), fill = document.getElementById('rp-fill');
    if (!stepEl || !fill) return;
    var n = TENANT_STEP[idx] || 1;
    if (idx === 12) { stepEl.textContent = 'Deploy'; fill.style.width = '100%'; }
    else { stepEl.textContent = 'Step ' + n + ' of 11'; fill.style.width = Math.round(n / 11 * 100) + '%'; }
  }

  // --- Pipelines page: per-project task lists + live connection-binding map ---
  function renderPipelinesPage() {
    const tl = document.getElementById('pipeline-task-list');
    if (tl) {
      const p = (discoveredFiles && discoveredFiles.pipeline) || { exists: false, projects: [] };
      if (!p.exists || (p.projects || []).length === 0) {
        tl.innerHTML = '<div style="font-size:12px;color:var(--text-dim)">No declarative projects found under deploy/pipelines/</div>';
      } else {
        tl.innerHTML = p.projects.map(proj =>
          '<div style="font-size:13px;font-weight:700;color:var(--text);margin:10px 0 6px">' + esc(proj.name) +
          ' <span style="font-weight:400;color:var(--text-dim);font-size:11px">(deploy/pipelines/' + esc(proj.dir) + ' &mdash; ' + proj.tasks.length + ' tasks)</span></div>' +
          proj.tasks.map(t =>
            '<div class="dp-card">' +
            '<div class="dp-name">' + esc(t.name) + '</div>' +
            '<div class="dp-meta">' + esc(t.type) + ' &mdash; ' + esc(t.schedule) +
              (t.datasets ? ' &mdash; ' + t.datasets + ' dataset' + (t.datasets > 1 ? 's' : '') : '') + '</div>' +
            '</div>'
          ).join('')
        ).join('');
      }
    }
    const el = document.getElementById('pipeline-conn-map');
    if (!el) return;
    const rows = [
      ['MCG WMS CDC Landing (PostgreSQL)', getVal('f-pg-name') || 'MCG WMS Database'],
      ['MCG CRM Landing (MySQL CDC)', getVal('f-crm-name') || 'MCG CRM Database'],
      ['MCG IoT Streaming Landing (Kafka)', getVal('f-kafka-name') || 'MCG IoT Telemetry'],
      ['Analytics Apps (Athena over Open Lakehouse)', getVal('f-athena-name') || 'MCG Lakehouse (Athena)'],
    ];
    el.innerHTML = rows.map(r =>
      '<div class="dp-card">' +
      '<div class="dp-name">' + esc(r[0]) + '</div>' +
      '<div class="dp-meta">binds to connection: <b>' + esc(r[1]) + '</b></div>' +
      '</div>'
    ).join('');
  }

  // --- Init ---
  let dockerInfo = {};
  let appDefs = { exists: false, apps: [] };
  let autoDefs = { exists: false, automations: [] };

  window.addEventListener('DOMContentLoaded', async () => {
    try {
      const [filesRes, cfgRes, dockerRes, appDefsRes, autoDefsRes] = await Promise.all([
        fetch('/api/files').then(r => r.json()),
        fetch('/api/config').then(r => r.json()),
        fetch('/api/docker').then(r => r.json()),
        fetch('/api/app-definitions').then(r => r.json()),
        fetch('/api/automation-definitions').then(r => r.json()),
      ]);
      discoveredFiles = filesRes;
      loadedConfig = cfgRes;
      dockerInfo = dockerRes;
      appDefs = appDefsRes;
      autoDefs = autoDefsRes;
      populateFields(cfgRes);
      renderFileSelections(filesRes);
      setupKafkaProtocolToggle();
      renderDockerPage(dockerRes, cfgRes);
      renderBuildAppsPage();
      renderBuildAutomationsPage();
      initTheme();
    } catch (e) {
      console.error('Init failed:', e);
    }
  });

  function populateFields(cfg) {
    if (!cfg || cfg.error) return;

    // Tenant
    setVal('f-tenant-host', cfg.tenant && cfg.tenant.hostname);
    setSelVal('f-tenant-region', cfg.tenant && cfg.tenant.region);

    // Auth
    if (cfg.auth) {
      setSelVal('f-auth-method', cfg.auth.method);
      setVal('f-api-key', cfg.auth.apiKey);
      if (cfg.auth.oauth) {
        setVal('f-oauth-client-id', cfg.auth.oauth.clientId);
        setVal('f-oauth-client-secret', cfg.auth.oauth.clientSecret);
        setVal('f-oauth-token-url', cfg.auth.oauth.tokenUrl);
      }
      toggleAuthFields();
    }

    // Spaces
    if (cfg.spaces) {
      setVal('f-space-shared', cfg.spaces.shared);
      setVal('f-space-managed', cfg.spaces.managed);
      setVal('f-space-data', cfg.spaces.data);
    }

    // Qlik Predict
    if (cfg.predict) {
      const pr = cfg.predict;
      setVal('f-predict-experiment', pr.experimentName);
      setVal('f-predict-description', pr.description);
      setVal('f-predict-space', pr.space || 'shared');
      setVal('f-predict-deployment', pr.deploymentName);
      setVal('f-predict-modelid', pr.modelId);
      setCheck('f-predict-enable-predictions', pr.enablePredictions !== false);
    }

    // Docker
    if (cfg.docker) {
      setSelVal('f-docker-profile', cfg.docker.profile || 'full-stack');
      setVal('f-docker-rpm-path', cfg.docker.rpmPath || '');
      setVal('f-docker-rpm-url', cfg.docker.rpmUrl || '');
    }

    // Enabled components
    const en = cfg.enabledComponents || {};
    setCheck('f-en-docker', en.docker !== false);
    setCheck('f-en-spaces', en.spaces !== false);
    setCheck('f-en-connections', en.connections !== false);
    setCheck('f-en-theme', en.theme !== false);
    setCheck('f-en-knowledge', en.knowledge !== false);
    setCheck('f-en-assistant', en.assistant !== false);
    setCheck('f-en-automations', en.automations !== false);
    setCheck('f-en-dataproducts', en.dataproducts !== false);
    setCheck('f-en-predict', en.predict !== false);
    setCheck('f-en-glossary', en.glossary !== false);
    setCheck('f-en-pipelines', en.pipelines !== false);

    // Apps
    if (cfg.apps) {
      setCheck('f-apps-sheets-mcp', cfg.apps.sheetsViaMcp !== false);
    }

    // Pipelines
    if (cfg.pipelines) {
      setCheck('f-pipelines-prepare', cfg.pipelines.prepare === true);
      setCheck('f-pipelines-run', cfg.pipelines.run === true);
      setCheck('f-pipelines-attach', cfg.pipelines.attachDatasets !== false);
      setCheck('f-pipelines-publish', cfg.pipelines.publishDataProducts === true);
    }

    // Data Connections
    if (cfg.dataConnections) {
      const pg = cfg.dataConnections.postgresql || {};
      setVal('f-pg-name', pg.name);
      setVal('f-pg-host', pg.host);
      setVal('f-pg-port', pg.port);
      setVal('f-pg-database', pg.database);
      setVal('f-pg-username', pg.username);
      setVal('f-pg-password', pg.password);
      setVal('f-data-gateway-id', (cfg.dataGateway && cfg.dataGateway.id) || '');

      const crm = cfg.dataConnections.mysql || {};
      setVal('f-crm-name', crm.name);
      setVal('f-crm-host', crm.host);
      setVal('f-crm-port', crm.port || 3307);
      setVal('f-crm-database', crm.database);
      setVal('f-crm-username', crm.username);
      setVal('f-crm-password', crm.password);

      const kf = cfg.dataConnections.kafka || {};
      setVal('f-kafka-name', kf.name);
      setVal('f-kafka-bootstrap', kf.bootstrapServers);
      setSelVal('f-kafka-protocol', kf.securityProtocol);
      setVal('f-kafka-sasl-user', kf.saslUsername);
      setVal('f-kafka-sasl-pass', kf.saslPassword);

      const ath = cfg.dataConnections.athena || {};
      setVal('f-athena-name', ath.name);
      setVal('f-athena-region', ath.region);
      setVal('f-athena-workgroup', ath.workgroup);
      setVal('f-athena-output', ath.s3OutputLocation);

      const s3 = cfg.dataConnections.s3 || {};
      setVal('f-s3-name', s3.name);
      setVal('f-s3-bucket', s3.bucketName);
      setVal('f-s3-region', s3.region);
      setVal('f-s3-prefix', s3.prefix);
      setVal('f-s3-access-key', s3.accessKeyId);
      setVal('f-s3-secret-key', s3.secretAccessKey);
    }

    // Theme
    if (cfg.theme) {
      setVal('f-theme-name', cfg.theme.name);
    }

    // KB & Assistant
    if (cfg.knowledgeBase) {
      setVal('f-kb-name', cfg.knowledgeBase.name);
      setVal('f-kb-desc', cfg.knowledgeBase.description);
    }
    if (cfg.assistant) {
      setVal('f-ast-name', cfg.assistant.name);
      setVal('f-ast-desc', cfg.assistant.description);
    }
    // Qlik Answers space (KB + assistant share one selector)
    setVal('f-answers-space',
      (cfg.assistant && cfg.assistant.space) ||
      (cfg.knowledgeBase && cfg.knowledgeBase.space) || 'shared');

    // Automations
    if (cfg.automations) {
      setVal('f-teams-webhook', cfg.automations.teamsWebhookUrl);
    }

    // Options
    if (cfg.options) {
      setCheck('opt-verbose', cfg.options.verbose !== false);
      setCheck('opt-continue', cfg.options.continueOnError !== false);
    }
  }

  function renderFileSelections(files) {
    // Documents — grouped by folder, excluding demo-scripts and top-level guides
    const docEl = document.getElementById('doc-files');
    const countEl = document.getElementById('doc-count');
    // Filter: exclude demo-scripts folder and top-level guide docs
    const operationalDocs = (files.documents || []).filter(f => {
      if (f.folder === 'demo-scripts') return false;
      if (!f.folder && (f.name.startsWith('MCG_Setup_Guide') || f.name.startsWith('MCG_Creation_Guide'))) return false;
      return true;
    });
    if (operationalDocs.length === 0) {
      docEl.innerHTML = '<div style="font-size:12px;color:var(--text-dim)">No operational .docx files found in documents/</div>';
    } else {
      // Group by folder
      const grouped = {};
      for (const f of operationalDocs) {
        const folder = f.folder || '(root)';
        if (!grouped[folder]) grouped[folder] = [];
        grouped[folder].push(f);
      }
      let html = '';
      for (const [folder, docs] of Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]))) {
        const folderLabel = folder === '(root)' ? 'General' : folder.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        html += '<div style="margin-top:8px;margin-bottom:2px;font-size:11px;font-weight:600;color:var(--teal);text-transform:uppercase;letter-spacing:0.5px">' + esc(folderLabel) + ' <span style="color:var(--text-dim);font-weight:400">(' + docs.length + ')</span></div>';
        for (const f of docs) {
          const idx = files.documents.indexOf(f);
          html += '<div class="file-item">' +
            '<input type="checkbox" checked data-doc="' + idx + '">' +
            '<span class="fname">' + esc(f.name) + '</span>' +
            '<span class="fsize">' + fmtSize(f.size) + '</span>' +
            '</div>';
        }
      }
      docEl.innerHTML = html;
      countEl.textContent = operationalDocs.length + ' operational document(s) selected for Knowledge Base upload';
    }

    // Themes
    const themeEl = document.getElementById('theme-files');
    if (files.themes.length === 0) {
      themeEl.innerHTML = '<div style="font-size:12px;color:var(--text-dim)">No theme .zip files found in deploy/themes/</div>';
    } else {
      themeEl.innerHTML = files.themes.map((f, i) =>
        '<div class="file-item">' +
        '<input type="radio" name="theme-sel" checked data-theme="' + i + '">' +
        '<span class="fname">' + esc(f.name) + '</span>' +
        '<span class="fsize">' + fmtSize(f.size) + '</span>' +
        '</div>'
      ).join('');
    }

    // Automations
    const autoEl = document.getElementById('auto-files');
    if (files.automations.length === 0) {
      autoEl.innerHTML = '<div style="font-size:12px;color:var(--text-dim)">No automation templates in deploy/automations/</div>';
    } else {
      autoEl.innerHTML = files.automations.map((f, i) =>
        '<div class="file-item">' +
        '<input type="checkbox" checked data-auto="' + i + '">' +
        '<span class="fname">' + esc(f.displayName || f.name) + '</span>' +
        '<span class="fmeta">' + esc(f.name) + '</span>' +
        '</div>'
      ).join('');
    }

    // Data Products
    const dpEl = document.getElementById('dp-list');
    if (!files.dataProducts.exists || files.dataProducts.items.length === 0) {
      dpEl.innerHTML = '<div style="font-size:12px;color:var(--text-dim)">No data_products.json found</div>';
    } else {
      dpEl.innerHTML = files.dataProducts.items.map(p =>
        '<div class="dp-card">' +
        '<div class="dp-name">' + esc(p.name) + '</div>' +
        '<div class="dp-meta">' + esc(p.sourceTable) + ' &mdash; Owner: ' + esc(p.owner) + '</div>' +
        '<div class="dp-meta">attaches dataset: <b>' + esc(String(p.sourceTable || '').replace(/^gold\./, '')) + '</b> (created by the pipeline’s gold datamart task in the Open Lakehouse; apps read it via Athena)</div>' +
        '<div class="dp-tags">' + (p.tags || []).slice(0, 5).map(t => '<span>' + esc(t) + '</span>').join('') + '</div>' +
        '</div>'
      ).join('');
    }

    // Glossary
    const glEl = document.getElementById('gl-list');
    document.getElementById('gl-count').textContent = files.glossary.count || 0;
    if (!files.glossary.exists || files.glossary.items.length === 0) {
      glEl.innerHTML = '<div style="font-size:12px;color:var(--text-dim)">No glossary_terms.json found</div>';
    } else {
      glEl.innerHTML = files.glossary.items.map(t =>
        '<div class="dp-card">' +
        '<div class="dp-name">' + esc(t.name) + '</div>' +
        '<div class="dp-meta">' + esc(t.category) + '</div>' +
        '<div style="font-size:11px;color:var(--text-dim);margin-top:2px">' + esc(t.definition) + '</div>' +
        '</div>'
      ).join('');
    }
  }

  // --- Auth toggle ---
  function toggleAuthFields() {
    const method = document.getElementById('f-auth-method').value;
    document.getElementById('auth-apikey-fields').style.display = method === 'apikey' ? 'block' : 'none';
    document.getElementById('auth-oauth-fields').style.display = method === 'oauth' ? 'block' : 'none';
  }

  // --- Test Connection ---
  async function testConnection() {
    const btn = document.getElementById('btn-test-conn');
    const resultDiv = document.getElementById('test-conn-result');
    btn.disabled = true;
    btn.innerHTML = '&#8987; Testing...';
    resultDiv.style.display = 'block';
    resultDiv.style.background = 'var(--surface2)';
    resultDiv.style.borderColor = 'var(--border)';
    resultDiv.style.color = 'var(--text-dim)';
    resultDiv.textContent = 'Connecting to Qlik Cloud...';

    const host = document.getElementById('f-tenant-host').value.trim();
    const region = document.getElementById('f-tenant-region').value;
    const method = document.getElementById('f-auth-method').value;

    const body = { host, region, method };
    if (method === 'apikey') {
      body.apiKey = document.getElementById('f-api-key').value.trim();
    } else {
      body.clientId = document.getElementById('f-oauth-client-id').value.trim();
      body.clientSecret = document.getElementById('f-oauth-client-secret').value.trim();
      body.tokenUrl = document.getElementById('f-oauth-token-url').value.trim();
    }

    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        resultDiv.style.background = 'rgba(0,152,69,0.1)';
        resultDiv.style.borderColor = 'var(--qlik-green)';
        resultDiv.style.color = 'var(--success)';
        resultDiv.innerHTML = '&#10004; Connected successfully!<br><span style="color:var(--text-dim);font-size:11px">'
          + 'Tenant: ' + esc(data.tenantId || host) + ' &middot; User: ' + esc(data.userName || 'unknown') + '</span>';
      } else {
        resultDiv.style.background = 'rgba(248,113,113,0.1)';
        resultDiv.style.borderColor = 'var(--error)';
        resultDiv.style.color = 'var(--error)';
        resultDiv.innerHTML = '&#10008; Connection failed<br><span style="color:var(--text-dim);font-size:11px">' + esc(data.error || 'Unknown error') + '</span>';
      }
    } catch (e) {
      resultDiv.style.background = 'rgba(248,113,113,0.1)';
      resultDiv.style.borderColor = 'var(--error)';
      resultDiv.style.color = 'var(--error)';
      resultDiv.innerHTML = '&#10008; Request failed<br><span style="color:var(--text-dim);font-size:11px">' + esc(e.message) + '</span>';
    }
    btn.disabled = false;
    btn.innerHTML = '&#9889; Test Connection';
  }

  function setupKafkaProtocolToggle() {
    const sel = document.getElementById('f-kafka-protocol');
    sel.addEventListener('change', () => {
      document.getElementById('kafka-sasl-fields').style.display =
        sel.value === 'SASL_SSL' ? 'grid' : 'none';
    });
    // Init
    document.getElementById('kafka-sasl-fields').style.display =
      sel.value === 'SASL_SSL' ? 'grid' : 'none';
  }

  // --- Docker → Data Connections prefill ---
  function prefillFromDocker() {
    // The local stack is the demo default; prefill empty connection fields with
    // its localhost values. (Docker is deployed separately from the tenant now,
    // so this is purely a convenience — users override for external sources.)
    const dockerEnabled = true;
    const banner = document.getElementById('docker-prefill-banner');
    if (!dockerEnabled) {
      if (banner) banner.style.display = 'none';
      return;
    }

    const profile = document.getElementById('f-docker-profile') ? document.getElementById('f-docker-profile').value : '';
    const hasPostgres = ['full-stack', 'full-stack-dmg', 'kafka'].indexOf(profile) !== -1 || profile === 'full-stack' || profile === 'full-stack-dmg';
    const hasKafka = ['full-stack', 'full-stack-dmg', 'kafka'].indexOf(profile) !== -1;

    // Prefill PostgreSQL fields from Docker env values (only if currently empty or placeholder-like)
    if (hasPostgres || profile === 'full-stack' || profile === 'full-stack-dmg') {
      const pgHost = document.getElementById('f-pg-host');
      const pgPort = document.getElementById('f-pg-port');
      const pgDb   = document.getElementById('f-pg-database');
      const pgUser = document.getElementById('f-pg-username');
      const pgPass = document.getElementById('f-pg-password');
      const pgName = document.getElementById('f-pg-name');

      const dockerPgDb   = document.getElementById('f-docker-pg-db')   ? document.getElementById('f-docker-pg-db').value   : 'mcg_wms';
      const dockerPgUser = document.getElementById('f-docker-pg-user') ? document.getElementById('f-docker-pg-user').value : 'mcg_admin';
      const dockerPgPass = document.getElementById('f-docker-pg-pass') ? document.getElementById('f-docker-pg-pass').value : 'mcg_demo_2025';

      if (!pgHost.value) pgHost.value = 'localhost';
      if (!pgPort.value || pgPort.value === '5432') pgPort.value = '5432';
      if (!pgDb.value)   pgDb.value = dockerPgDb;
      if (!pgUser.value) pgUser.value = dockerPgUser;
      if (!pgPass.value) pgPass.value = dockerPgPass;
      if (!pgName.value) pgName.value = 'MCG WMS Database';
    }

    // Prefill Kafka fields from Docker env values
    if (hasKafka) {
      const kafkaBootstrap = document.getElementById('f-kafka-bootstrap');
      const kafkaProtocol  = document.getElementById('f-kafka-protocol');
      const kafkaName      = document.getElementById('f-kafka-name');

      if (!kafkaBootstrap.value) kafkaBootstrap.value = 'localhost:9092';
      if (!kafkaName.value) kafkaName.value = 'MCG IoT Telemetry';
      if (kafkaProtocol) kafkaProtocol.value = 'PLAINTEXT';
      // Hide SASL fields for Docker local
      document.getElementById('kafka-sasl-fields').style.display = 'none';
    }

    if (banner) banner.style.display = 'block';
  }

  // --- Docker page ---
  function renderDockerPage(docker, cfg) {
    // Compose file status
    const infoEl = document.getElementById('docker-compose-info');
    const files = docker.composeFiles || [];
    let html = '';

    // Which engine will actually run these stacks. Surfaced because the host may
    // have podman, docker, or neither, and a missing engine is otherwise only
    // discovered when a deploy fails several clicks later.
    const eng = docker.engine || {};
    if (eng.name) {
      const ok = docker.dockerAvailable && docker.composeAvailable;
      const dot = '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--' + (ok ? 'success' : 'error') + ');margin-right:6px"></span>';
      html += '<div style="font-size:12px;margin-bottom:8px">' + dot + '<strong>Engine: ' + esc(eng.name) + '</strong>'
            + (eng.version ? ' <span style="color:var(--text-dim)">— ' + esc(eng.version) + '</span>' : '')
            + (eng.compose ? ' <span style="color:var(--text-dim)">· compose via ' + esc(eng.compose) + '</span>' : '')
            + (eng.error ? '<div style="color:var(--error);margin-top:4px">' + esc(eng.error) + '</div>' : '')
            + '</div>';
    }

    html += '<div style="font-size:12px;margin-bottom:8px">';
    for (const cf of files) {
      const dot = cf.exists
        ? '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--success);margin-right:6px"></span>'
        : '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--error);margin-right:6px"></span>';
      html += '<div style="padding:2px 0">' + dot + '<strong>' + esc(cf.label) + '</strong> <span style="color:var(--text-dim)">— ' + esc(cf.desc) + '</span></div>';
    }
    html += '</div>';
    infoEl.innerHTML = html;

    // DMG RPM status
    const rpmEl = document.getElementById('dmg-rpm-status');
    if (docker.dmgGateway) {
      const g = docker.dmgGateway;
      if (g.dockerfileExists) {
        if (g.rpmExists) {
          rpmEl.innerHTML = '<div style="font-size:12px"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--success);margin-right:6px"></span>Gateway RPM found in build context: ' + esc((g.rpmFiles || [])[0] || 'gateway.rpm') + '</div>';
        } else {
          rpmEl.innerHTML = '<div style="font-size:12px"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--warning);margin-right:6px"></span>No RPM in build context — provide a file path or download URL below</div>';
        }
      } else {
        rpmEl.innerHTML = '<div style="font-size:12px"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--error);margin-right:6px"></span>DMG Dockerfile not found</div>';
      }
    }

    // Populate RPM source fields from config
    const dockerCfg = (cfg && cfg.docker) || {};
    setVal('f-docker-rpm-path', dockerCfg.rpmPath || '');
    setVal('f-docker-rpm-url', dockerCfg.rpmUrl || '');

    // Populate env vars from .env or config
    const env = docker.envVars || {};
    if (cfg && cfg.tenant) {
      setVal('f-docker-tenant-url', env.TENANT_URL || (cfg.tenant.hostname + '.' + (cfg.tenant.region || 'us.qlikcloud.com')));
    } else {
      setVal('f-docker-tenant-url', env.TENANT_URL || '');
    }
    setVal('f-docker-kafka-bootstrap', env.KAFKA_BOOTSTRAP || 'kafka:9092');
    setVal('f-docker-pg-db', env.POSTGRES_DB || 'mcg_wms');
    setVal('f-docker-pg-user', env.POSTGRES_USER || 'mcg_admin');
    setVal('f-docker-pg-pass', env.POSTGRES_PASSWORD || 'mcg_demo_2025');
    setVal('f-docker-dmg-pg-pass', env.DMG_POSTGRES_PASSWORD || 'Qlik1234');
    setVal('f-docker-dmg-mysql-pass', env.DMG_MYSQL_PASSWORD || 'Qlik1234');
    setVal('f-docker-dmg-mssql-pass', env.DMG_MSSQL_PASSWORD || 'Qlik1234!');

    // Show/hide DMG fields based on profile
    const sel = document.getElementById('f-docker-profile');
    const toggleDmg = () => {
      const v = sel.value;
      document.getElementById('dmg-settings').style.display =
        (v === 'dmg' || v === 'full-stack-dmg') ? 'block' : 'none';
    };
    sel.addEventListener('change', () => { toggleDmg(); updateDeployLabel(); prefillFromDocker(); });
    toggleDmg();
    updateDeployLabel();

    // Also trigger prefill when Docker enable toggle changes
    const dockerToggle = document.getElementById('f-en-docker');
    if (dockerToggle) {
      dockerToggle.addEventListener('change', () => { prefillFromDocker(); });
    }

    // If a gateway/stack build is already running on the server, re-attach to
    // its live log so a page reload or re-navigation can't lose visibility.
    resumeDockerIfRunning();
  }

  const COMPOSE_MAP = {
    'full-stack': 'docker-compose.full-stack.yml',
    'full-stack-dmg': 'docker-compose.full-stack-dmg.yml',
    'kafka': 'kafka/docker-compose.yml',
    'simulators': 'docker-compose.simulators.yml',
    'dmg': 'docker-compose.dmg.yml',
  };

  const DOCKER_BTNS = ['btn-docker-deploy', 'btn-docker-up', 'btn-docker-down', 'btn-docker-status', 'btn-docker-prune', 'btn-docker-gateway-token', 'btn-docker-gateway-start', 'btn-docker-gateway-stop'];

  function setDockerBtns(disabled) {
    DOCKER_BTNS.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) { el.disabled = disabled; el.style.opacity = disabled ? '0.5' : '1'; }
    });
  }

  // Make the prominent Deploy button name the selected profile, so it reads as
  // "Deploy Gateway (DMG)" / "Deploy Full Stack" etc. rather than something generic.
  var DEPLOY_LABELS = {
    'full-stack': 'Deploy Full Stack',
    'full-stack-dmg': 'Deploy Full Stack + Gateway',
    'kafka': 'Deploy Kafka Stack',
    'simulators': 'Deploy Simulators',
    'dmg': 'Deploy Gateway (DMG)',
  };
  function updateDeployLabel() {
    var sel = document.getElementById('f-docker-profile');
    var btn = document.getElementById('btn-docker-deploy');
    if (!sel || !btn) return;
    btn.textContent = DEPLOY_LABELS[sel.value] || 'Deploy Local Stack';
  }

  // Gateway RPM source: 'local' (a file path on this machine — default, takes
  // precedence) or 'github' (a download URL). One input shows at a time.
  let _rpmSource = 'local';
  function setRpmSource(src) {
    _rpmSource = src;
    var lf = document.getElementById('rpm-field-local'), gh = document.getElementById('rpm-field-github');
    if (lf) lf.style.display = src === 'local' ? 'block' : 'none';
    if (gh) gh.style.display = src === 'github' ? 'block' : 'none';
    var btns = document.querySelectorAll('#rpm-source-toggle button');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].getAttribute('data-src') === src);
  }

  function dockerAction(action, forceBuild) {
    // Gateway actions are profile-independent — they always target the running
    // mcg-qlik-dmg container, so they need no compose file or env vars.
    if (action === 'gateway-token' || action === 'gateway-start' || action === 'gateway-stop') {
      var gMsg = action === 'gateway-start' ? 'Starting the gateway container…'
               : action === 'gateway-stop'  ? 'Stopping the gateway container…'
               :                               'Retrieving gateway registration token…';
      _logPane = 'local';
      _dockerLastTotal = 0; _dockerKeepaliveBucket = 0;
      var gConsoleEl = logConsoleEl();
      if (gConsoleEl) gConsoleEl.innerHTML = '';
      setDockerBtns(true);
      var gStatusEl = logStatusEl();
      gStatusEl.style.color = 'var(--text-dim)';
      gStatusEl.textContent = gMsg;
      var gMethod = (action === 'gateway-start' || action === 'gateway-stop') ? 'POST' : 'GET';
      fetch('/api/docker/run?action=' + action, { method: gMethod, cache: 'no-store' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (!d || !d.started) {
            var msg = (d && d.error) || 'Could not start the gateway operation.';
            appendLog('error', msg);
            gStatusEl.textContent = msg;
            gStatusEl.style.color = 'var(--error)';
            setDockerBtns(false);
            return;
          }
          pollDockerStatus(0, 0);
        })
        .catch(function() {
          appendLog('error', 'Could not reach the deploy server for the gateway operation.');
          gStatusEl.textContent = 'Server unreachable.';
          gStatusEl.style.color = 'var(--error)';
          setDockerBtns(false);
        });
      return;
    }

    const profile = getVal('f-docker-profile');
    const composeFile = COMPOSE_MAP[profile];
    if (!composeFile) return;

    const isDmg = (profile === 'dmg' || profile === 'full-stack-dmg');

    const params = new URLSearchParams({ action, composeFile });

    // Only send build flag and envVars for non-prune actions
    if (action !== 'prune') {
      const envVars = {
        TENANT_URL: getVal('f-docker-tenant-url'),
        KAFKA_BOOTSTRAP: getVal('f-docker-kafka-bootstrap'),
        POSTGRES_DB: getVal('f-docker-pg-db'),
        POSTGRES_USER: getVal('f-docker-pg-user'),
        POSTGRES_PASSWORD: getVal('f-docker-pg-pass'),
      };
      if (isDmg) {
        envVars.DMG_POSTGRES_PASSWORD = getVal('f-docker-dmg-pg-pass');
        envVars.DMG_MYSQL_PASSWORD = getVal('f-docker-dmg-mysql-pass');
        envVars.DMG_MSSQL_PASSWORD = getVal('f-docker-dmg-mssql-pass');
      }
      params.set('envVars', JSON.stringify(envVars));
      // Build (rebuild images) ONLY on an explicit Deploy click (forceBuild).
      // "Start Containers" never builds — it just starts the existing instance.
      params.set('build', (action === 'up' && forceBuild) ? '1' : '0');
    }

    // Pass RPM source info only for an explicit DMG Deploy (build). Start
    // Containers never builds, so it never needs to resolve a gateway RPM.
    // Only the selected source is sent (Local file takes precedence by default).
    if (isDmg && action === 'up' && forceBuild) {
      if (_rpmSource === 'github') {
        const rpmUrl = getVal('f-docker-rpm-url');
        if (rpmUrl) params.set('rpmUrl', rpmUrl);
      } else {
        const rpmPath = getVal('f-docker-rpm-path');
        if (rpmPath) params.set('rpmPath', rpmPath);
      }
    }

    // This is a Local Stack operation — its logs belong to the local console.
    _logPane = 'local';
    _dockerLastTotal = 0; _dockerKeepaliveBucket = 0;
    // Clear console and disable buttons
    var consoleEl = logConsoleEl();
    if (consoleEl) consoleEl.innerHTML = '';
    setDockerBtns(true);

    var statusEl = logStatusEl();
    statusEl.style.color = 'var(--text-dim)';
    statusEl.textContent = 'Starting…';

    // Kick off the job (tiny JSON ack), then switch to polling. We never hold a
    // long-lived stream, so a dropped console can't interrupt or lose the build.
    var runMethod = (action === 'status') ? 'GET' : 'POST';
    fetch('/api/docker/run?' + params.toString(), { method: runMethod, cache: 'no-store' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d || !d.started) {
          var msg = (d && d.error) || 'Could not start the Docker operation.';
          appendLog('error', msg);
          statusEl.textContent = msg;
          statusEl.style.color = 'var(--error)';
          setDockerBtns(false);
          return;
        }
        pollDockerStatus(0, 0);
      })
      .catch(function() {
        appendLog('error', 'Could not reach the deploy server to start the operation.');
        statusEl.textContent = 'Server unreachable.';
        statusEl.style.color = 'var(--error)';
        setDockerBtns(false);
      });
  }

  // Poll the server-side job log. A failed poll is harmless — the build keeps
  // running on the server — so we just retry; we never show "Connection lost".
  let dockerPollTimer = null;
  let _dockerLastTotal = 0;        // last seen server line count (to detect new output)
  let _dockerKeepaliveBucket = 0;  // which 20s silence-bucket we've already announced
  function stopDockerPoll() {
    if (dockerPollTimer) { clearTimeout(dockerPollTimer); dockerPollTimer = null; }
  }
  function fmtDuration(ms) {
    var s = Math.max(0, Math.round((ms || 0) / 1000));
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60), r = s % 60;
    return m + 'm' + (r < 10 ? '0' : '') + r + 's';
  }

  function pollDockerStatus(offset, missed) {
    stopDockerPoll();
    fetch('/api/docker/status?offset=' + offset, { cache: 'no-store' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var statusEl = logStatusEl();
        if (d.lines && d.lines.length) {
          for (var i = 0; i < d.lines.length; i++) appendLog(d.lines[i].level, d.lines[i].text);
        }
        var newOffset = (typeof d.total === 'number') ? d.total : offset;

        if (d.running) {
          // The live status (updated every poll) shows it's alive; periodic console
          // lines come from the server's single 30s heartbeat — no duplicate notices here.
          var idleSec = Math.round((d.idleMs || 0) / 1000);
          statusEl.style.color = 'var(--text-dim)';
          statusEl.textContent = '⏳ Working… ' + fmtDuration(d.runningMs) + ' elapsed'
            + (idleSec >= 5 ? ' · waiting for Docker ' + idleSec + 's' : '')
            + ' — safe to leave; the build continues on the server.';
          setDockerBtns(true);
          dockerPollTimer = setTimeout(function() { pollDockerStatus(newOffset, 0); }, 1500);
        } else {
          var ok = (d.code === 0 && !d.error);
          statusEl.style.color = ok ? 'var(--success)' : 'var(--error)';
          if (d.idle) statusEl.textContent = 'Idle.';
          else if (d.error) statusEl.textContent = d.error;
          else statusEl.textContent = ok ? 'Completed.' : ('Finished with exit code ' + d.code + '.');
          setDockerBtns(false);
        }
      })
      .catch(function() {
        // Transient network/poll failure — retry with light backoff. The build
        // is unaffected; this is purely the status channel reconnecting.
        var m = (missed || 0) + 1;
        var statusEl = logStatusEl();
        statusEl.style.color = 'var(--gold)';
        statusEl.textContent = 'Reconnecting… (the gateway build continues on the server)';
        var delay = Math.min(1500 + m * 1000, 8000);
        dockerPollTimer = setTimeout(function() { pollDockerStatus(offset, m); }, delay);
      });
  }

  // If a build is already running (e.g. after a page reload or re-navigation),
  // re-attach to it and replay its log from the start. Closing/reopening the
  // page therefore can't lose visibility of an in-flight gateway build.
  function resumeDockerIfRunning() {
    fetch('/api/docker/status?offset=0', { cache: 'no-store' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d && d.running) {
          // A local build is in flight — switch to Local mode so the user sees it
          // and route its logs to the local pane.
          setMode('local');
          _logPane = 'local';
          _dockerLastTotal = 0; _dockerKeepaliveBucket = 0;
          var consoleEl = logConsoleEl();
          if (consoleEl) consoleEl.innerHTML = '';
          appendLog('info', '↻ Reattached to a Docker operation already running on the server.');
          pollDockerStatus(0, 0);
        }
      })
      .catch(function() {});
  }

  // --- Build Apps page ---
  let buildEventSource = null;
  let isBuildRunning = false;

  function renderBuildAppsPage() {
    const el = document.getElementById('build-app-defs');
    if (!appDefs || !appDefs.exists || appDefs.apps.length === 0) {
      el.innerHTML = '<div style="font-size:12px;color:var(--text-dim)">No app-definitions.json found in deploy/apps/</div>';
      return;
    }

    let html = '';
    for (const app of appDefs.apps) {
      html += '<div class="dp-card" style="border-left:3px solid var(--teal)">';
      html += '<div class="dp-name" style="color:var(--teal)">' + esc(app.name) + '</div>';
      html += '<div style="font-size:11px;color:var(--text-dim);margin:4px 0">' + esc(app.description) + '</div>';
      html += '<div style="font-size:12px;margin-top:6px">';
      html += '<span style="color:var(--gold);font-weight:600">' + app.sheets + '</span> sheets &middot; ';
      html += '<span style="color:var(--gold);font-weight:600">' + app.dimensions + '</span> dimensions &middot; ';
      html += '<span style="color:var(--gold);font-weight:600">' + app.measures + '</span> measures &middot; ';
      html += '<span style="color:var(--gold);font-weight:600">' + app.objects + '</span> visualizations';
      html += '</div>';
      if (app.loadScript) {
        html += '<div style="font-size:11px;color:var(--text-dim);margin-top:4px;font-family:monospace">Load: ' + esc(app.loadScript) + '</div>';
      }
      html += '<div style="font-size:11px;color:var(--text-dim);margin-top:2px">reads Open Lakehouse (gold/silver) via <b>' + esc(getVal('f-athena-name') || 'MCG Lakehouse (Athena)') + '</b></div>';
      html += '</div>';
    }

    el.innerHTML = html;
    renderMcpPrompts();
  }

  // --- Qlik MCP sheet prompts (Build Apps page) ---
  let mcpPromptTexts = [];
  function renderMcpPrompts() {
    const el = document.getElementById('mcp-prompts-list');
    if (!el) return;
    const mp = (discoveredFiles && discoveredFiles.mcpPrompts) || { exists: false, apps: [] };
    if (!mp.exists || mp.apps.length === 0) {
      el.innerHTML = '<div style="font-size:12px;color:var(--text-dim)">No mcp-sheet-prompts.json found in deploy/apps/</div>';
      return;
    }
    mcpPromptTexts = [];
    let html = '';
    if (mp.testPrompt) {
      const ti = mcpPromptTexts.push(mp.testPrompt) - 1;
      html += '<div class="dp-card"><div class="dp-name">Connection test</div>' +
        '<div class="dp-meta">' + esc(mp.testPrompt) + '</div>' +
        '<button class="btn btn-dry" style="margin-top:6px;font-size:11px;padding:3px 10px" onclick="copyMcpPrompt(' + ti + ', this)">Copy prompt</button></div>';
    }
    for (const app of mp.apps) {
      html += '<div style="font-size:13px;font-weight:700;color:var(--text);margin:10px 0 6px">' + esc(app.appName) +
        ' <span style="font-weight:400;color:var(--text-dim);font-size:11px">(' + esc(app.dataProduct || '') + ')</span></div>';
      for (const sheet of (app.sheets || [])) {
        const i = mcpPromptTexts.push(sheet.prompt) - 1;
        html += '<div class="dp-card">' +
          '<div class="dp-name">' + esc(sheet.title) + '</div>' +
          '<div class="dp-meta" style="white-space:normal">' + esc(sheet.prompt.slice(0, 180)) + '&hellip;</div>' +
          '<button class="btn btn-dry" style="margin-top:6px;font-size:11px;padding:3px 10px" onclick="copyMcpPrompt(' + i + ', this)">Copy prompt</button>' +
          '</div>';
      }
    }
    el.innerHTML = html;
  }

  function copyMcpPrompt(i, btn) {
    const text = mcpPromptTexts[i] || '';
    navigator.clipboard.writeText(text).then(() => {
      const old = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = old; }, 1500);
    });
  }

  function startBuildApps(dryRun) {
    if (isBuildRunning) return;
    isBuildRunning = true;
    _logPane = 'tenant';

    const consoleEl = logConsoleEl();
    consoleEl.innerHTML = '';

    document.getElementById('btn-build-apps').disabled = true;
    document.getElementById('btn-build-dry').disabled = true;
    document.getElementById('build-stop-row').style.display = 'flex';
    document.getElementById('build-summary').style.display = 'none';

    const badge = document.getElementById('run-badge');
    badge.style.display = 'inline-block';
    badge.textContent = dryRun ? 'BUILD DRY RUN' : 'BUILDING';
    badge.className = 'badge ' + (dryRun ? 'badge-gold' : 'badge-red') + ' running-indicator';

    const statusEl = logStatusEl();
    statusEl.textContent = dryRun ? 'Build dry run starting...' : 'Build starting...';
    statusEl.style.color = '';

    const cfg = buildConfig();

    // POST config then start SSE
    fetch('/api/build-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    }).then(() => {
      const params = new URLSearchParams({
        dryRun: dryRun ? '1' : '0',
        verbose: isChecked('build-opt-verbose') ? '1' : '0',
      });

      buildEventSource = new EventSource('/api/build-apps?' + params.toString());

      buildEventSource.addEventListener('log', (e) => {
        const data = JSON.parse(e.data);
        appendLog(data.level, data.text);
      });

      buildEventSource.addEventListener('status', (e) => {
        const data = JSON.parse(e.data);
        statusEl.textContent = data.message;

        if (data.state === 'done' || data.state === 'error') {
          isBuildRunning = false;
          document.getElementById('btn-build-apps').disabled = false;
          document.getElementById('btn-build-dry').disabled = false;
          document.getElementById('build-stop-row').style.display = 'none';
          badge.style.display = 'none';

          if (buildEventSource) { buildEventSource.close(); buildEventSource = null; }

          const summaryEl = document.getElementById('build-summary');
          const summaryContent = document.getElementById('build-summary-content');
          summaryEl.style.display = 'block';

          if (data.code === 0) {
            appendLog('success', '\\n=== App build completed successfully ===');
            statusEl.style.color = 'var(--success)';
            summaryContent.innerHTML = '<div style="color:var(--success);font-weight:600">Build completed successfully.</div>';
          } else {
            appendLog('error', '\\n=== App build finished with errors (exit ' + data.code + ') ===');
            statusEl.style.color = 'var(--error)';
            summaryContent.innerHTML = '<div style="color:var(--error);font-weight:600">Build finished with exit code ' + data.code + '.</div>';
          }
        }
      });

      buildEventSource.onerror = () => {
        isBuildRunning = false;
        document.getElementById('btn-build-apps').disabled = false;
        document.getElementById('btn-build-dry').disabled = false;
        document.getElementById('build-stop-row').style.display = 'none';
        badge.style.display = 'none';
        if (buildEventSource) { buildEventSource.close(); buildEventSource = null; }
        appendLog('error', 'Connection to server lost.');
        statusEl.textContent = 'Disconnected';
      };
    });
  }

  function stopBuildApps() {
    fetch('/api/build-apps/stop', { method: 'POST' });
    if (buildEventSource) { buildEventSource.close(); buildEventSource = null; }
    isBuildRunning = false;
    document.getElementById('btn-build-apps').disabled = false;
    document.getElementById('btn-build-dry').disabled = false;
    document.getElementById('build-stop-row').style.display = 'none';
    document.getElementById('run-badge').style.display = 'none';
    appendLog('warn', 'Build stopped by user.');
    logStatusEl().textContent = 'Stopped';
  }

  // --- Build Automations UI ---
  let buildAutoEventSource = null;
  let isBuildAutoRunning = false;

  function renderBuildAutomationsPage() {
    const el = document.getElementById('build-auto-defs');
    if (!autoDefs || !autoDefs.exists || autoDefs.automations.length === 0) {
      el.innerHTML = '<div style="font-size:12px;color:var(--text-dim)">No automation-definitions.json found in deploy/automations/</div>';
      return;
    }

    let html = '';
    for (const auto of autoDefs.automations) {
      html += '<div class="dp-card" style="border-left:3px solid var(--gold)">';
      html += '<div class="dp-name" style="color:var(--gold)">' + esc(auto.name) + '</div>';
      html += '<div style="font-size:11px;color:var(--text-dim);margin:4px 0">' + esc(auto.description) + '</div>';
      html += '<div style="font-size:12px;margin-top:6px">';
      html += '<span style="color:var(--teal);font-weight:600">' + esc(auto.triggerType) + '</span>';
      if (auto.triggerSchedule) {
        html += ' &middot; <span style="font-family:monospace;font-size:11px">' + esc(auto.triggerSchedule) + '</span>';
      }
      if (auto.triggerDescription) {
        html += ' &middot; <span style="color:var(--text-dim)">' + esc(auto.triggerDescription) + '</span>';
      }
      html += ' &middot; <span style="color:var(--gold);font-weight:600">' + auto.blocks + '</span> blocks';
      if (auto.variables.length > 0) {
        html += ' &middot; <span style="color:var(--text-dim)">' + auto.variables.length + ' var(s)</span>';
      }
      html += '</div>';
      html += '</div>';
    }

    el.innerHTML = html;
  }

  function startBuildAutomations(dryRun) {
    if (isBuildAutoRunning) return;
    isBuildAutoRunning = true;
    _logPane = 'tenant';

    const consoleEl = logConsoleEl();
    consoleEl.innerHTML = '';

    document.getElementById('btn-build-autos').disabled = true;
    document.getElementById('btn-build-auto-dry').disabled = true;
    document.getElementById('build-auto-stop-row').style.display = 'flex';
    document.getElementById('build-auto-summary').style.display = 'none';

    const badge = document.getElementById('run-badge');
    badge.style.display = 'inline-block';
    badge.textContent = dryRun ? 'AUTO DRY RUN' : 'BUILDING AUTOS';
    badge.className = 'badge ' + (dryRun ? 'badge-gold' : 'badge-red') + ' running-indicator';

    const statusEl = logStatusEl();
    statusEl.textContent = dryRun ? 'Automation dry run starting...' : 'Automation build starting...';
    statusEl.style.color = '';

    const cfg = buildConfig();

    fetch('/api/build-auto-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    }).then(() => {
      const params = new URLSearchParams({
        dryRun: dryRun ? '1' : '0',
        verbose: isChecked('build-auto-opt-verbose') ? '1' : '0',
      });

      buildAutoEventSource = new EventSource('/api/build-automations?' + params.toString());

      buildAutoEventSource.addEventListener('log', (e) => {
        const data = JSON.parse(e.data);
        appendLog(data.level, data.text);
      });

      buildAutoEventSource.addEventListener('status', (e) => {
        const data = JSON.parse(e.data);
        statusEl.textContent = data.message;

        if (data.state === 'done' || data.state === 'error') {
          isBuildAutoRunning = false;
          document.getElementById('btn-build-autos').disabled = false;
          document.getElementById('btn-build-auto-dry').disabled = false;
          document.getElementById('build-auto-stop-row').style.display = 'none';
          badge.style.display = 'none';

          if (buildAutoEventSource) { buildAutoEventSource.close(); buildAutoEventSource = null; }

          const summaryEl = document.getElementById('build-auto-summary');
          const summaryContent = document.getElementById('build-auto-summary-content');
          summaryEl.style.display = 'block';

          if (data.code === 0) {
            appendLog('success', '\\n=== Automation build completed successfully ===');
            statusEl.style.color = 'var(--success)';
            summaryContent.innerHTML = '<div style="color:var(--success);font-weight:600">Automation build completed successfully.</div>';
          } else {
            appendLog('error', '\\n=== Automation build finished with errors (exit ' + data.code + ') ===');
            statusEl.style.color = 'var(--error)';
            summaryContent.innerHTML = '<div style="color:var(--error);font-weight:600">Automation build finished with exit code ' + data.code + '.</div>';
          }
        }
      });

      buildAutoEventSource.onerror = () => {
        isBuildAutoRunning = false;
        document.getElementById('btn-build-autos').disabled = false;
        document.getElementById('btn-build-auto-dry').disabled = false;
        document.getElementById('build-auto-stop-row').style.display = 'none';
        badge.style.display = 'none';
        if (buildAutoEventSource) { buildAutoEventSource.close(); buildAutoEventSource = null; }
        appendLog('error', 'Connection to server lost.');
        statusEl.textContent = 'Disconnected';
      };
    });
  }

  function stopBuildAutomations() {
    fetch('/api/build-automations/stop', { method: 'POST' });
    if (buildAutoEventSource) { buildAutoEventSource.close(); buildAutoEventSource = null; }
    isBuildAutoRunning = false;
    document.getElementById('btn-build-autos').disabled = false;
    document.getElementById('btn-build-auto-dry').disabled = false;
    document.getElementById('build-auto-stop-row').style.display = 'none';
    document.getElementById('run-badge').style.display = 'none';
    appendLog('warn', 'Automation build stopped by user.');
    logStatusEl().textContent = 'Stopped';
  }

  // --- Build config from form ---
  function buildConfig() {
    const cfg = {
      tenant: {
        hostname: getVal('f-tenant-host'),
        region: getVal('f-tenant-region'),
      },
      auth: {
        method: getVal('f-auth-method'),
        apiKey: getVal('f-api-key'),
        oauth: {
          clientId: getVal('f-oauth-client-id'),
          clientSecret: getVal('f-oauth-client-secret'),
          tokenUrl: getVal('f-oauth-token-url'),
        },
      },
      spaces: {
        shared: getVal('f-space-shared') || 'MCG Demo - Development',
        managed: getVal('f-space-managed') || 'MCG Demo - Published',
        data: getVal('f-space-data') || 'MCG Demo - DI',
      },
      predict: {
        ...((loadedConfig && loadedConfig.predict) || {}),
        experimentName: getVal('f-predict-experiment') || 'MCG Delivery Risk',
        description: getVal('f-predict-description') || '',
        space: getVal('f-predict-space') || 'shared',
        deploymentName: getVal('f-predict-deployment') || '',
        modelId: getVal('f-predict-modelid') || '',
        enablePredictions: isChecked('f-predict-enable-predictions'),
      },
      enabledComponents: {
        docker: false,  // Local stack + DMG gateway deploy separately (Local Stack & Gateway tab), never as part of the tenant deploy
        infrastructure: false,  // Kafka/simulators run as local containers, deployed from the Local Stack & Gateway tab — not the tenant deploy
        spaces: isChecked('f-en-spaces'),
        connections: isChecked('f-en-connections'),
        theme: isChecked('f-en-theme'),
        knowledge: isChecked('f-en-knowledge'),
        assistant: isChecked('f-en-assistant'),
        automations: isChecked('f-en-automations'),
        dataproducts: isChecked('f-en-dataproducts'),
        predict: isChecked('f-en-predict'),
        glossary: isChecked('f-en-glossary'),
        pipelines: isChecked('f-en-pipelines'),
      },
      pipelines: {
        projects: ((discoveredFiles && discoveredFiles.pipeline && discoveredFiles.pipeline.projects) || [])
          .map(p => ({ projectName: p.name, sourceDir: './pipelines/' + p.dir })),
        platformType: 'QLIK_OPEN_LAKEHOUSE',
        prepare: isChecked('f-pipelines-prepare'),
        run: isChecked('f-pipelines-run'),
        attachDatasets: isChecked('f-pipelines-attach'),
        publishDataProducts: isChecked('f-pipelines-publish'),
        bindings: {},
      },
      docker: {
        profile: getVal('f-docker-profile') || 'full-stack',
        rpmPath: getVal('f-docker-rpm-path') || '',
        rpmUrl: getVal('f-docker-rpm-url') || '',
      },
      dataGateway: {
        id: getVal('f-data-gateway-id') || '',
        name: 'MCG_DATA_MOVEMENT',
      },
      dataConnections: {
        postgresql: {
          name: getVal('f-pg-name') || 'MCG WMS Database',
          host: getVal('f-pg-host'),
          port: parseInt(getVal('f-pg-port')) || 5432,
          database: getVal('f-pg-database'),
          username: getVal('f-pg-username'),
          password: getVal('f-pg-password'),
          schema: 'public',
        },
        mysql: {
          name: getVal('f-crm-name') || 'MCG CRM Database',
          host: getVal('f-crm-host'),
          // 3307 on the host: the gateway container already binds 3306.
          port: parseInt(getVal('f-crm-port')) || 3307,
          database: getVal('f-crm-database') || 'mcg_crm',
          username: getVal('f-crm-username') || 'qlik_cdc',
          password: getVal('f-crm-password'),
          // MySQL's database IS its schema, so the two always match.
          schema: getVal('f-crm-database') || 'mcg_crm',
          sslMode: 'PREFERRED',
        },
        kafka: {
          name: getVal('f-kafka-name') || 'MCG IoT Telemetry',
          bootstrapServers: getVal('f-kafka-bootstrap') || 'localhost:9092',
          topics: ['mcg.iot.cold-chain', 'mcg.iot.carrier-events'],
          securityProtocol: getVal('f-kafka-protocol'),
          saslMechanism: 'PLAIN',
          saslUsername: getVal('f-kafka-sasl-user'),
          saslPassword: getVal('f-kafka-sasl-pass'),
        },
        athena: {
          name: getVal('f-athena-name') || 'MCG Lakehouse (Athena)',
          region: getVal('f-athena-region') || 'us-east-1',
          workgroup: getVal('f-athena-workgroup') || 'primary',
          s3OutputLocation: getVal('f-athena-output'),
        },
        s3: {
          name: getVal('f-s3-name') || 'MCG Flat File Outputs',
          bucketName: getVal('f-s3-bucket'),
          region: getVal('f-s3-region'),
          accessKeyId: getVal('f-s3-access-key'),
          secretAccessKey: getVal('f-s3-secret-key'),
          prefix: getVal('f-s3-prefix'),
        },
      },
      theme: {
        name: getVal('f-theme-name') || 'MCG Dark Theme',
        sourceFile: './themes/mcg-dark-theme.zip',
      },
      knowledgeBase: {
        name: getVal('f-kb-name') || 'MCG Operations Knowledge Base',
        description: getVal('f-kb-desc') || '',
        space: getVal('f-answers-space') || 'shared',
      },
      assistant: {
        name: getVal('f-ast-name') || 'MCG Operations Assistant',
        description: getVal('f-ast-desc') || '',
        space: getVal('f-answers-space') || 'shared',
        conversationStarters: [
          'What is the procedure for goods receiving?',
          'What happened during the Rotterdam pipeline failure?',
          'What are the cold chain temperature requirements?',
          'What is Project Qlarity?',
          'What was the lettuce recall and what went wrong?',
        ],
      },
      dataProducts: { sourceFile: './data_products.json' },
      glossary: { sourceFile: './glossary_terms.json' },
      // Preserve reload-task definitions across UI saves; default to the
      // appName-resolved pair (deploy Step 12 looks the IDs up by name).
      // The Delivery app reloads at :05/:20/:35/:50 — 5 min after each
      // Talend CRM QVD drop (deploy/talend).
      reloadtasks: (loadedConfig && loadedConfig.reloadtasks) || {
        definitions: [
          { name: 'MCG Supply Chain Operations — Reload', appName: 'MCG Supply Chain Operations', cronExpression: '0 0 * * * *', timeZone: 'UTC' },
          { name: 'MCG Delivery Experience — Reload', appName: 'MCG Delivery & Customer Experience', cronExpression: '0 5/15 * * * *', timeZone: 'UTC' },
        ],
      },
      automations: {
        templateDir: './automations',
        teamsWebhookUrl: getVal('f-teams-webhook'),
      },
      documents: { sourceDir: '../documents' },
      apps: { sourceDir: './apps', sheetsViaMcp: isChecked('f-apps-sheets-mcp') },
      options: {
        dryRun: false,
        verbose: isChecked('opt-verbose'),
        continueOnError: isChecked('opt-continue'),
      },
    };
    return cfg;
  }

  // --- Deploy Summary ---
  function renderPreflight() {
    const el = document.getElementById('preflight-checks');
    const checks = [];

    // Tenant
    const host = getVal('f-tenant-host');
    if (!host || host === 'your-tenant') {
      checks.push({ ok: false, msg: 'Tenant hostname not configured', fix: 'Go to Step 1' });
    } else {
      checks.push({ ok: true, msg: 'Tenant: ' + host + '.' + getVal('f-tenant-region') });
    }

    // Auth
    const authMethod = getVal('f-auth-method');
    if (authMethod === 'apikey') {
      const key = getVal('f-api-key');
      if (!key || key.includes('YOUR_')) {
        checks.push({ ok: false, msg: 'API key not set', fix: 'Go to Step 1' });
      } else {
        checks.push({ ok: true, msg: 'API key configured (ends ...' + key.slice(-4) + ')' });
      }
    } else {
      const cid = getVal('f-oauth-client-id');
      const csec = getVal('f-oauth-client-secret');
      if (!cid || !csec) {
        checks.push({ ok: false, msg: 'OAuth credentials incomplete', fix: 'Go to Step 1' });
      } else {
        checks.push({ ok: true, msg: 'OAuth client configured' });
      }
    }

    // Config file
    if (discoveredFiles.config && discoveredFiles.config.exists) {
      checks.push({ ok: true, msg: 'config.json exists' });
    } else {
      checks.push({ ok: 'warn', msg: 'config.json not yet created — fill in connection details on page 1 and click Save Config', fix: 'Optional for dry-run' });
    }

    // Files
    const allDocCount = (discoveredFiles.documents || []).length;
    const opDocCount = (discoveredFiles.documents || []).filter(f => f.folder !== 'demo-scripts' && !((!f.folder) && (f.name.startsWith('MCG_Setup_Guide') || f.name.startsWith('MCG_Creation_Guide')))).length;
    const themeCount = (discoveredFiles.themes || []).length;

    // App definitions (Build Apps)
    if (appDefs && appDefs.exists && appDefs.apps.length > 0) {
      const totalObjs = appDefs.apps.reduce((s, a) => s + a.objects, 0);
      checks.push({ ok: true, msg: appDefs.apps.length + ' app definition(s) ready to build (' + totalObjs + ' objects via Build Apps)' });
    }
    // Automation definitions (Build Automations)
    if (autoDefs && autoDefs.exists && autoDefs.automations.length > 0) {
      checks.push({ ok: true, msg: autoDefs.automations.length + ' automation definition(s) ready to build' });
    }
    if (isChecked('f-en-knowledge') && opDocCount === 0) {
      checks.push({ ok: false, msg: 'Knowledge base enabled but no operational .docx files found', fix: 'Add documents or disable' });
    }
    if (isChecked('f-en-theme') && themeCount === 0) {
      checks.push({ ok: false, msg: 'Theme enabled but no .zip theme files found', fix: 'Add theme or disable' });
    }

    // Summary counts
    if (opDocCount > 0) checks.push({ ok: true, msg: opDocCount + ' operational document(s) ready for Knowledge Base upload' });
    if (themeCount > 0) checks.push({ ok: true, msg: themeCount + ' theme(s) found' });

    const dpCount = discoveredFiles.dataProducts && discoveredFiles.dataProducts.count || 0;
    const glCount = discoveredFiles.glossary && discoveredFiles.glossary.count || 0;
    if (dpCount > 0) checks.push({ ok: true, msg: dpCount + ' data product(s) defined' });
    if (glCount > 0) checks.push({ ok: true, msg: glCount + ' glossary term(s) defined' });

    const hasErrors = checks.some(c => c.ok === false);

    let html = '';
    for (const c of checks) {
      const color = c.ok === true ? 'var(--success)' : c.ok === 'warn' ? 'var(--warn)' : 'var(--error)';
      const dot = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + color + ';margin-right:8px;flex-shrink:0"></span>';
      html += '<div style="display:flex;align-items:center;padding:3px 0">' + dot + esc(c.msg);
      if (c.fix) html += ' <span style="color:var(--text-dim);margin-left:6px">(' + esc(c.fix) + ')</span>';
      html += '</div>';
    }

    if (hasErrors) {
      html += '<div style="margin-top:8px;padding:6px 10px;background:rgba(248,113,113,0.1);border:1px solid var(--error);border-radius:6px;font-size:11px;color:var(--error)">Resolve issues above before deploying. Dry Run will still work.</div>';
    }

    el.innerHTML = html;
  }

  // ---- Stewardship page ---------------------------------------------------
  // NOTE: this whole block lives inside getHTML()'s template literal, so an
  // in-string newline escape must be DOUBLE-backslashed here. A single one is
  // consumed when the HTML is built and lands as a real newline inside a JS
  // string literal, breaking the entire script block. The same applies to any
  // such escape written in a comment.

  var _swSchema = [];

  function swSetResult(elId, ok, text) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.style.display = 'block';
    el.style.borderColor = ok ? 'var(--teal)' : '#c0392b';
    el.textContent = text;
  }

  function renderStewardshipPage() {
    fetch('/api/stewardship/sprints')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var c = (d && d.configured) || {};
        if (c.name) document.getElementById('f-sw-name').value = c.name;
        if (c.space) document.getElementById('f-sw-space').value = c.space;
        _swSchema = c.schema || [];
        renderSwSchema();

        if (d && d.success && d.sprints && d.sprints.length) {
          var lines = d.sprints.map(function (sp) { return '  ' + sp.id + '  ' + (sp.name || ''); });
          swSetResult('sw-result', true, 'Existing sprint(s):\\n' + lines.join('\\n'));
          var chk = document.getElementById('check-stewardship');
          if (chk) chk.textContent = '\\u2713';
        } else if (d && !d.success) {
          swSetResult('sw-result', false, d.error || 'Could not list sprints.');
        }
      })
      .catch(function (e) { swSetResult('sw-result', false, e.message); });
  }

  function renderSwSchema() {
    var host = document.getElementById('sw-schema');
    if (!host) return;
    if (!_swSchema.length) { host.innerHTML = '<div class="page-desc">No schema configured.</div>'; return; }
    var rows = _swSchema.map(function (col, i) {
      return '<tr>' +
        '<td style="padding:4px 8px"><code>' + col.name + '</code></td>' +
        '<td style="padding:4px 8px;font-size:11px;opacity:.8">' + (col.description || '') + '</td>' +
        '<td style="padding:4px 8px;text-align:center"><input type="checkbox" data-sw-vis="' + i + '"' + (col.isVisible !== false ? ' checked' : '') + '></td>' +
        '<td style="padding:4px 8px;text-align:center"><input type="checkbox" data-sw-edit="' + i + '"' + (col.isEditable ? ' checked' : '') + '></td>' +
        '</tr>';
    }).join('');
    host.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
      '<thead><tr style="text-align:left;opacity:.7">' +
      '<th style="padding:4px 8px">Column</th><th style="padding:4px 8px">Description</th>' +
      '<th style="padding:4px 8px;text-align:center">Visible</th><th style="padding:4px 8px;text-align:center">Editable</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function collectSwSchema() {
    return _swSchema.map(function (col, i) {
      var v = document.querySelector('[data-sw-vis="' + i + '"]');
      var e = document.querySelector('[data-sw-edit="' + i + '"]');
      return Object.assign({}, col, {
        isVisible: v ? v.checked : col.isVisible !== false,
        isEditable: e ? e.checked : !!col.isEditable
      });
    });
  }

  function createSprint(dryRun) {
    var btn = document.getElementById(dryRun ? 'btn-sw-dry' : 'btn-sw-create');
    if (btn) btn.disabled = true;
    swSetResult('sw-result', true, dryRun ? 'Building payload...' : 'Creating sprint...');

    var settings = {
      name: document.getElementById('f-sw-name').value || 'Address Cleanup',
      space: document.getElementById('f-sw-space').value,
      workflowType: document.getElementById('f-sw-workflow').value,
      assignationStrategy: document.getElementById('f-sw-assign').value,
      recordDataSchema: collectSwSchema()
    };

    fetch('/api/stewardship/sprint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: !!dryRun, settings: settings, space: settings.space })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (btn) btn.disabled = false;
        if (!d.success) {
          var msg = d.error || 'Failed.';
          if (d.hint) msg += '\\n\\nHint: ' + d.hint;
          swSetResult('sw-result', false, msg);
          return;
        }
        if (d.dryRun) {
          swSetResult('sw-result', true,
            'Dry run - space ' + d.space.name + ' (' + d.space.type + ')\\n\\n' +
            JSON.stringify(d.payload, null, 2));
          return;
        }
        swSetResult('sw-result', true,
          'Created sprint "' + settings.name + '"\\n' +
          '  sprintId : ' + (d.sprintId || '(not returned)') + '\\n' +
          '  space    : ' + d.space.name + ' (' + d.space.type + ')\\n' +
          '  saved to config.json -> stewardship.sprintId');
        var chk = document.getElementById('check-stewardship');
        if (chk) chk.textContent = '\\u2713';
      })
      .catch(function (e) {
        if (btn) btn.disabled = false;
        swSetResult('sw-result', false, e.message);
      });
  }

  function pushWorkspaces(dryRun) {
    var btn = document.getElementById('btn-sw-ws');
    if (btn) btn.disabled = true;
    swSetResult('sw-ws-result', true, dryRun ? 'Building block graphs...' : 'Authoring workspaces...');

    fetch('/api/stewardship/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: !!dryRun })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (btn) btn.disabled = false;
        if (d.error) { swSetResult('sw-ws-result', false, d.error); return; }
        var lines = (d.results || []).map(function (r) {
          return r.success
            ? '  [ok] ' + (r.name || r.key) + ' - ' + r.blocks + ' blocks' + (r.action ? ' (' + r.action + ')' : '')
            : '  [!!] ' + (r.key || '?') + ' - ' + r.error;
        });
        var txt = lines.join('\\n');
        if (d.manualStep) txt += '\\n\\n' + d.manualStep;
        swSetResult('sw-ws-result', !!d.success, txt);
      })
      .catch(function (e) {
        if (btn) btn.disabled = false;
        swSetResult('sw-ws-result', false, e.message);
      });
  }

  function renderSummary() {
    renderPreflight();
    const el = document.getElementById('deploy-summary');
    const en = {
      docker: false,
      infrastructure: false,
      spaces: isChecked('f-en-spaces'),
      connections: isChecked('f-en-connections'),
      theme: isChecked('f-en-theme'),
      knowledge: isChecked('f-en-knowledge'),
      assistant: isChecked('f-en-assistant'),
      automations: isChecked('f-en-automations'),
      dataproducts: isChecked('f-en-dataproducts'),
      predict: isChecked('f-en-predict'),
      glossary: isChecked('f-en-glossary'),
      pipelines: isChecked('f-en-pipelines'),
    };

    const tenant = getVal('f-tenant-host') + '.' + getVal('f-tenant-region');
    const auth = getVal('f-auth-method');

    let html = '<div style="margin-bottom:12px">';
    html += '<div style="margin-bottom:4px"><strong>Tenant:</strong> ' + esc(tenant) + '</div>';
    html += '<div style="margin-bottom:4px"><strong>Auth:</strong> ' + esc(auth) + '</div>';
    html += '</div>';

    const steps = [
      ['spaces', 'Spaces'],
      ['connections', 'Data Connections'],
      ['theme', 'Theme Upload'],
      ['knowledge', 'Knowledge Base & Docs'],
      ['assistant', 'Qlik Answers Assistant'],
      ['automations', 'Automations'],
      ['predict', 'Qlik Predict (ML)'],
      ['glossary', 'Business Glossary'],
      ['pipelines', 'Declarative Pipeline'],
      ['dataproducts', 'Data Products'],
    ];

    html += '<table style="width:100%;font-size:12px;border-collapse:collapse">';
    for (const [key, label] of steps) {
      const on = en[key];
      html += '<tr style="border-bottom:1px solid var(--border)">';
      html += '<td style="padding:4px 0">' + esc(label) + '</td>';
      html += '<td style="padding:4px 0;text-align:right;color:' + (on ? 'var(--success)' : 'var(--text-dim)') + '">' + (on ? 'Enabled' : 'Skipped') + '</td>';
      html += '</tr>';
    }
    html += '</table>';

    // File counts
    html += '<div style="margin-top:12px;font-size:12px;color:var(--text-dim)">';
    const qvfCount = (discoveredFiles.apps || []).length;
    const apiAppCount = (appDefs && appDefs.apps) ? appDefs.apps.length : 0;
    html += 'Apps: ' + apiAppCount + ' (API build)' + (qvfCount > 0 ? ' + ' + qvfCount + ' .qvf' : '') + ' &nbsp;|&nbsp; ';
    const opDocs = (discoveredFiles.documents || []).filter(f => f.folder !== 'demo-scripts' && !((!f.folder) && (f.name.startsWith('MCG_Setup_Guide') || f.name.startsWith('MCG_Creation_Guide'))));
    html += 'Docs: ' + opDocs.length + ' operational .docx &nbsp;|&nbsp; ';
    html += 'Products: ' + (discoveredFiles.dataProducts && discoveredFiles.dataProducts.count || 0) + ' &nbsp;|&nbsp; ';
    html += 'Terms: ' + (discoveredFiles.glossary && discoveredFiles.glossary.count || 0);
    html += '</div>';

    el.innerHTML = html;
  }

  // --- Save Config ---
  async function saveCurrentConfig() {
    const cfg = buildConfig();
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      if (res.ok) {
        showToast('Configuration saved to config.json!');
      } else {
        showToast('Failed to save: ' + (await res.text()));
      }
    } catch (e) {
      showToast('Error: ' + e.message);
    }
  }

  function showToast(msg) {
    const el = document.getElementById('save-toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
  }

  // --- Deploy ---
  function startDeploy(dryRun) {
    if (isRunning) return;
    isRunning = true;
    _logPane = 'tenant';

    const consoleEl = logConsoleEl();
    consoleEl.innerHTML = '';

    const cfg = buildConfig();
    if (dryRun) cfg.options.dryRun = true;

    setRunningState(true, dryRun);

    const params = new URLSearchParams({
      dryRun: dryRun ? '1' : '0',
      verbose: isChecked('opt-verbose') ? '1' : '0',
    });

    // POST config then start SSE
    fetch('/api/deploy-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    }).then(() => {
      eventSource = new EventSource('/api/deploy?' + params.toString());

      eventSource.addEventListener('log', (e) => {
        const data = JSON.parse(e.data);
        appendLog(data.level, data.text);
      });

      eventSource.addEventListener('status', (e) => {
        const data = JSON.parse(e.data);
        const statusEl = logStatusEl();
        statusEl.textContent = data.message;

        if (data.state === 'done' || data.state === 'error') {
          isRunning = false;
          setRunningState(false);
          if (eventSource) { eventSource.close(); eventSource = null; }

          if (data.code === 0) {
            appendLog('success', '\\n=== Deployment completed successfully ===');
            statusEl.style.color = 'var(--success)';
          } else {
            appendLog('error', '\\n=== Deployment finished with errors (exit ' + data.code + ') ===');
            statusEl.style.color = 'var(--error)';
          }
        }
      });

      eventSource.onerror = () => {
        isRunning = false;
        setRunningState(false);
        if (eventSource) { eventSource.close(); eventSource = null; }
        appendLog('error', 'Connection to server lost.');
        logStatusEl().textContent = 'Disconnected';
      };
    });
  }

  function stopDeploy() {
    fetch('/api/stop', { method: 'POST' });
    if (eventSource) { eventSource.close(); eventSource = null; }
    isRunning = false;
    setRunningState(false);
    appendLog('warn', 'Deployment stopped by user.');
    logStatusEl().textContent = 'Stopped';
  }

  function setRunningState(running, dryRun) {
    document.getElementById('btn-deploy').disabled = running;
    document.getElementById('btn-dry').disabled = running;
    document.getElementById('stop-row').style.display = running ? 'flex' : 'none';

    const badge = document.getElementById('run-badge');
    if (running) {
      badge.style.display = 'inline-block';
      badge.textContent = dryRun ? 'DRY RUN' : 'DEPLOYING';
      badge.className = 'badge ' + (dryRun ? 'badge-gold' : 'badge-red') + ' running-indicator';
    } else {
      badge.style.display = 'none';
    }
  }

  // --- Batched log appender (prevents page freeze from rapid SSE messages) ---
  const LOG_MAX_LINES = 500;
  let _logQueue = [];
  let _logRafId = null;

  function appendLog(level, text) {
    _logQueue.push({ level, text, ts: new Date().toLocaleTimeString('en-US', { hour12: false }) });
    if (!_logRafId) {
      _logRafId = requestAnimationFrame(_flushLogs);
    }
  }

  function _flushLogs() {
    _logRafId = null;
    if (_logQueue.length === 0) return;
    const consoleEl = logConsoleEl();
    if (!consoleEl) return;
    const frag = document.createDocumentFragment();
    const batch = _logQueue.splice(0);
    for (const entry of batch) {
      const div = document.createElement('div');
      div.className = 'log-line log-' + entry.level;
      div.innerHTML = '<span class="timestamp">' + entry.ts + '</span>' + esc(entry.text);
      frag.appendChild(div);
    }
    consoleEl.appendChild(frag);
    // Trim old lines if over cap
    var kids = consoleEl.children;
    while (kids.length > LOG_MAX_LINES) {
      consoleEl.removeChild(kids[0]);
    }
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  function clearConsole() {
    viewConsoleEl().innerHTML = '';
    var s = viewStatusEl();
    s.textContent = 'Ready';
    s.style.color = '';
  }

  function copyConsole() {
    const text = viewConsoleEl().innerText;
    navigator.clipboard.writeText(text).then(() => {
      const btn = event.target;
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy', 1500);
    });
  }

  function downloadLog() {
    const text = viewConsoleEl().innerText;
    if (!text.trim()) return;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mcg-deploy-' + ts + '.log';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // --- Helpers ---
  function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  function getVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }
  function setVal(id, v) { const el = document.getElementById(id); if (el && v) el.value = v; }
  function setSelVal(id, v) { const el = document.getElementById(id); if (el && v) el.value = v; }
  function isChecked(id) { const el = document.getElementById(id); return el ? el.checked : false; }
  function setCheck(id, v) { const el = document.getElementById(id); if (el) el.checked = v; }
</script>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
//  HTTP Server
// ---------------------------------------------------------------------------

let pendingDeployConfig = null;
let pendingBuildConfig = null;
let pendingBuildAutoConfig = null;

// Bind to loopback only by default — this console serves the live tenant API
// key and can trigger real deploys, so it must not be reachable from the LAN.
// Set MCG_UI_HOST=0.0.0.0 to deliberately expose it on the network.
const HOST = process.env.MCG_UI_HOST || '127.0.0.1';

// Cap request bodies so a POST handler never buffers an unbounded string.
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB

// Accumulate a request body up to MAX_BODY_BYTES, then invoke onBody(body).
// If the cap is exceeded, respond 413 and stop reading/processing further data.
function readRequestBody(req, res, onBody) {
  let body = '';
  let rejected = false;
  req.on('data', (chunk) => {
    if (rejected) return;
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      rejected = true;
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request body too large.' }));
      req.destroy();
    }
  });
  req.on('end', () => {
    if (rejected) return;
    onBody(body);
  });
}

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://localhost:${port}`);

  // Anti-DNS-rebinding: reject any request whose Host header doesn't match this
  // server's own bind address:port. A page on the public internet that DNS-binds
  // a hostname to 127.0.0.1 could otherwise reach this loopback-only server.
  // Skipped only when the operator has deliberately exposed the server on the
  // network (MCG_UI_HOST override) — in that case we can't know every valid
  // hostname/IP the machine may be reached by, and Sec-Fetch-Site below still applies.
  if (HOST === '127.0.0.1') {
    const hostHeader = String(req.headers['host'] || '').toLowerCase();
    const allowedHosts = new Set(['127.0.0.1:' + port, 'localhost:' + port, '[::1]:' + port]);
    if (!allowedHosts.has(hostHeader)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid Host header.' }));
      return;
    }
  }

  // CSRF / cross-origin defense: browsers stamp Sec-Fetch-Site on every request
  // (including <img>/<script> and fetch) and page JS cannot forge it, so an
  // explicit 'cross-site' / 'same-site' value is a reliable signal to reject.
  //
  // A MISSING header is deliberately allowed. Safari before 16.4 and other
  // non-Chromium clients omit Fetch Metadata entirely, and rejecting them would
  // 403 every button in the console while buying no security: any local process
  // can simply set the header itself. The real defenses are the Host check above
  // (anti-DNS-rebinding) and the loopback bind.
  const sfs = req.headers['sec-fetch-site'];
  if (parsed.pathname.startsWith('/api/') && (sfs === 'cross-site' || sfs === 'same-site')) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Cross-site request blocked.' }));
    return;
  }

  if (req.method === 'GET' && parsed.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(getHTML());
    return;
  }

  if (req.method === 'GET' && parsed.pathname === '/api/files') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(discoverFiles()));
    return;
  }

  if (req.method === 'GET' && parsed.pathname === '/api/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    // Mask secrets so the browser never receives the live tenant key / OAuth
    // secret / webhook URL in cleartext.
    res.end(JSON.stringify(redactSecrets(loadConfig() || { error: 'config.json not found' })));
    return;
  }

  if (req.method === 'POST' && parsed.pathname === '/api/config') {
    readRequestBody(req, res, (body) => {
      try {
        // Restore any masked secrets from the stored config before saving, so an
        // untouched (masked) field is never persisted over a real secret.
        const cfg = unredactSecrets(JSON.parse(body), loadConfig() || {});
        saveConfig(cfg);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Test connection to Qlik Cloud
  if (req.method === 'POST' && parsed.pathname === '/api/test-connection') {
    readRequestBody(req, res, async (body) => {
      try {
        const params = JSON.parse(body);
        // Restore masked secrets from the stored config (the form may submit the
        // redacted sentinel if the user did not retype the key). Whenever a real
        // stored secret is restored this way, the destination (host/region, and
        // tokenUrl for oauth) MUST also come from the stored config — never from
        // the request body — so a caller can't pair a real secret with an
        // attacker-controlled host by sending {apiKey:"__MCG_REDACTED__", host:"evil"}.
        const stored = loadConfig() || {};
        const storedHost = (stored.tenant && stored.tenant.hostname) || '';
        const storedRegion = (stored.tenant && stored.tenant.region) || '';

        // The stored secret belongs to the STORED tenant, and the form prefills the
        // mask on every page load. So an operator who types a new hostname without
        // retyping the key would otherwise silently probe the OLD tenant and be told
        // "Connected" for a tenant they aren't even looking at. Make them retype it.
        const usingStoredSecret = params.apiKey === SECRET_MASK || params.clientSecret === SECRET_MASK;
        if (usingStoredSecret &&
            ((params.host && params.host !== storedHost) ||
             (params.region && params.region !== storedRegion))) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'Tenant changed to ' + params.host + '.' + params.region +
                   ' — re-enter the API key for that tenant before testing.',
          }));
          return;
        }

        if (params.apiKey === SECRET_MASK) {
          params.apiKey = (stored.auth && stored.auth.apiKey) || '';
          params.host = storedHost;
          params.region = storedRegion;
        }
        if (params.clientSecret === SECRET_MASK) {
          params.clientSecret = (stored.auth && stored.auth.oauth && stored.auth.oauth.clientSecret) || '';
          params.host = (stored.tenant && stored.tenant.hostname) || '';
          params.region = (stored.tenant && stored.tenant.region) || '';
          params.tokenUrl = (stored.auth && stored.auth.oauth && stored.auth.oauth.tokenUrl) || '';
        }
        const baseUrl = 'https://' + params.host + '.' + params.region;
        let headers = {};

        if (params.method === 'oauth') {
          // Get access token via client credentials
          const tokenUrl = params.tokenUrl || (baseUrl + '/oauth/token');
          const tokenRes = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: params.clientId,
              client_secret: params.clientSecret,
              grant_type: 'client_credentials',
            }),
          });
          if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'OAuth token request failed (' + tokenRes.status + '): ' + errText.slice(0, 200) }));
            return;
          }
          const tokenData = await tokenRes.json();
          headers['Authorization'] = 'Bearer ' + tokenData.access_token;
        } else {
          headers['Authorization'] = 'Bearer ' + params.apiKey;
        }

        // Call /api/v1/users/me to verify
        const meRes = await fetch(baseUrl + '/api/v1/users/me', { headers });
        if (!meRes.ok) {
          const errText = await meRes.text();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'API call failed (' + meRes.status + '): ' + errText.slice(0, 200) }));
          return;
        }
        const me = await meRes.json();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, userName: me.name || me.email || me.subject, tenantId: me.tenantId || '' }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // Store config for upcoming deploy
  if (req.method === 'POST' && parsed.pathname === '/api/deploy-config') {
    if (activeProcess) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'A deployment is already running.' }));
      return;
    }
    readRequestBody(req, res, (body) => {
      try {
        pendingDeployConfig = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && parsed.pathname === '/api/deploy') {
    const dryRun  = parsed.searchParams.get('dryRun') === '1';
    const verbose = parsed.searchParams.get('verbose') === '1';

    const existing = loadConfig();
    const cfg = pendingDeployConfig ? unredactSecrets(pendingDeployConfig, existing || {}) : existing;
    pendingDeployConfig = null;

    if (!cfg || cfg.error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No valid config available.' }));
      return;
    }

    if (dryRun) cfg.options = { ...cfg.options, dryRun: true };
    if (verbose) cfg.options = { ...cfg.options, verbose: true };

    runDeploy(res, { dryRun, verbose, config: cfg });
    return;
  }

  // App definitions API
  if (req.method === 'GET' && parsed.pathname === '/api/app-definitions') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loadAppDefinitions()));
    return;
  }

  // Build apps APIs
  if (req.method === 'POST' && parsed.pathname === '/api/build-config') {
    if (activeBuildProcess) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'A build is already running.' }));
      return;
    }
    readRequestBody(req, res, (body) => {
      try {
        pendingBuildConfig = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && parsed.pathname === '/api/build-apps') {
    const dryRun  = parsed.searchParams.get('dryRun') === '1';
    const verbose = parsed.searchParams.get('verbose') === '1';

    const existing = loadConfig();
    const cfg = pendingBuildConfig ? unredactSecrets(pendingBuildConfig, existing || {}) : existing;
    pendingBuildConfig = null;

    runBuildApps(res, { dryRun, verbose, config: cfg });
    return;
  }

  if (req.method === 'POST' && parsed.pathname === '/api/build-apps/stop') {
    if (activeBuildProcess) {
      activeBuildProcess.kill('SIGTERM');
      activeBuildProcess = null;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Automation definitions API
  if (req.method === 'GET' && parsed.pathname === '/api/automation-definitions') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loadAutomationDefinitions()));
    return;
  }

  // Build automations APIs
  if (req.method === 'POST' && parsed.pathname === '/api/build-auto-config') {
    if (activeBuildAutoProcess) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'An automation build is already running.' }));
      return;
    }
    readRequestBody(req, res, (body) => {
      try {
        pendingBuildAutoConfig = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && parsed.pathname === '/api/build-automations') {
    const dryRun  = parsed.searchParams.get('dryRun') === '1';
    const verbose = parsed.searchParams.get('verbose') === '1';

    const existing = loadConfig();
    const cfg = pendingBuildAutoConfig ? unredactSecrets(pendingBuildAutoConfig, existing || {}) : existing;
    pendingBuildAutoConfig = null;

    runBuildAutomations(res, { dryRun, verbose, config: cfg });
    return;
  }

  if (req.method === 'POST' && parsed.pathname === '/api/build-automations/stop') {
    if (activeBuildAutoProcess) {
      activeBuildAutoProcess.kill('SIGTERM');
      activeBuildAutoProcess = null;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Docker infrastructure APIs
  if (req.method === 'GET' && parsed.pathname === '/api/docker') {
    const info = discoverDocker();
    info.envVars = loadEnvFile();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(info));
    return;
  }

  if ((req.method === 'GET' || req.method === 'POST') && parsed.pathname === '/api/docker/run') {
    const action = parsed.searchParams.get('action') || 'status';

    // Actions that mutate Docker/container state must be POST — a GET (e.g. an
    // <img>/<script> tag on a page the operator merely visits) must never be
    // able to trigger prune/build/start/stop. Read-only status/token lookups
    // may remain GET.
    const MUTATING_DOCKER_ACTIONS = new Set(['up', 'down', 'prune', 'gateway-start', 'gateway-stop']);
    if (MUTATING_DOCKER_ACTIONS.has(action) && req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed — use POST for this action.' }));
      return;
    }

    const composeFile = parsed.searchParams.get('composeFile');
    const build = parsed.searchParams.get('build') === '1';
    let envVars = null;
    try { envVars = JSON.parse(parsed.searchParams.get('envVars') || 'null'); } catch (_) {}

    // Validate compose file name — must be one of our known files.
    // The gateway-token action is profile-independent (it targets the running
    // mcg-qlik-dmg container directly), so it needs no compose file.
    const VALID_COMPOSE = new Set([
      'docker-compose.full-stack.yml', 'docker-compose.full-stack-dmg.yml',
      'kafka/docker-compose.yml', 'docker-compose.simulators.yml',
      'docker-compose.dmg.yml', 'docker-compose.simulators-dmg.yml',
    ]);
    if (!action.startsWith('gateway-') && (!composeFile || !VALID_COMPOSE.has(composeFile))) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid or missing composeFile' }));
      return;
    }

    const rpmPath = parsed.searchParams.get('rpmPath') || '';
    const rpmUrl = parsed.searchParams.get('rpmUrl') || '';
    const result = startDockerJob({ action, composeFile, build, envVars, rpmPath, rpmUrl });
    res.writeHead(result.started ? 200 : 409, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(result));
    return;
  }

  // Poll endpoint — returns new log lines since `offset` plus running state.
  // The client polls this instead of holding a long-lived stream, so a dropped
  // or throttled connection can never "lose" the gateway build.
  if (req.method === 'GET' && parsed.pathname === '/api/docker/status') {
    const offset = parseInt(parsed.searchParams.get('offset') || '0', 10) || 0;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    if (!dockerJob) {
      res.end(JSON.stringify({ idle: true, running: false, code: null, error: null, lines: [], total: 0 }));
      return;
    }
    // `total` is a monotonically increasing logical count across the job's
    // lifetime even though `lines` may have had its oldest entries dropped
    // (DOCKER_LOG_CAP) — droppedCount keeps the offset math correct.
    const dropped = dockerJob.droppedCount || 0;
    const total = dropped + dockerJob.lines.length;
    const lines = offset < total ? dockerJob.lines.slice(Math.max(0, offset - dropped)) : [];
    const now = Date.now();
    res.end(JSON.stringify({
      idle: false,
      running: dockerJob.running,
      action: dockerJob.action,
      code: dockerJob.code,
      error: dockerJob.error,
      lines: lines,
      total: total,
      runningMs: now - (dockerJob.startedAt || now),
      idleMs: now - (dockerJob.lastOutputAt || now),  // ms since last Docker output (for keepalive)
    }));
    return;
  }

  if (req.method === 'POST' && parsed.pathname === '/api/docker/stop') {
    if (activeDockerProcess) {
      killProcessTree(activeDockerProcess);
      activeDockerProcess = null;
    }
    if (dockerJob && dockerJob.running) {
      pushDockerLog('error', 'Stopped by user.');
      finishDockerJob(null, 'Stopped by user.');
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // ---- Stewardship --------------------------------------------------------
  // Credentials are NEVER taken from the request body here. /api/test-connection
  // has to juggle masked secrets because it probes a tenant the user is still
  // typing in; by the time a sprint is created the tenant is settled, so these
  // read auth from the stored config only. That removes the "real key paired
  // with an attacker-supplied host" hazard rather than defending against it.

  if (req.method === 'GET' && parsed.pathname === '/api/stewardship/sprints') {
    (async () => {
      try {
        const cfg = loadConfig();
        if (!cfg || cfg.error) throw new Error(cfg && cfg.error ? cfg.error : 'No config.json yet — save Step 1 first.');
        const r = await stewardship.listSprints(cfg);
        const st = stewardship.stewardshipConfig(cfg);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(Object.assign({}, r, {
          configured: { name: st.name, space: st.space, sprintId: st.sprintId, schema: st.recordDataSchema },
        })));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    })();
    return;
  }

  if (req.method === 'POST' && parsed.pathname === '/api/stewardship/sprint') {
    readRequestBody(req, res, async (body) => {
      try {
        const opts = body ? JSON.parse(body) : {};
        const cfg = loadConfig();
        if (!cfg || cfg.error) throw new Error(cfg && cfg.error ? cfg.error : 'No config.json yet — save Step 1 first.');

        // Persist any sprint settings the form changed before creating.
        if (opts.settings) {
          cfg.stewardship = Object.assign({}, stewardship.DEFAULT_STEWARDSHIP, cfg.stewardship || {}, opts.settings);
          saveConfig(cfg);
        }
        const r = await stewardship.createSprint(cfg, { dryRun: !!opts.dryRun, space: opts.space });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(r));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && parsed.pathname === '/api/stewardship/workspaces') {
    readRequestBody(req, res, async (body) => {
      try {
        const opts = body ? JSON.parse(body) : {};
        const cfg = loadConfig();
        if (!cfg || cfg.error) throw new Error(cfg && cfg.error ? cfg.error : 'No config.json yet — save Step 1 first.');

        const conn = await automationWorkspaces.ensureApiKeyConnection(cfg, { dryRun: !!opts.dryRun });
        const results = [];
        for (const key of Object.keys(automationWorkspaces.WORKSPACES)) {
          results.push(await automationWorkspaces.pushWorkspace(cfg, key, { dryRun: !!opts.dryRun }));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: results.every((r) => r.success),
          connection: { connected: !!conn.connected, id: conn.id || '', error: conn.error || '' },
          manualStep: conn.connected ? '' : automationWorkspaces.MANUAL_CONNECTION_STEPS,
          results,
        }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && parsed.pathname === '/api/stop') {
    if (activeProcess) {
      activeProcess.kill('SIGTERM');
      activeProcess = null;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(port, HOST, () => {
  console.log(`\n  MCG Deploy UI running at:\n`);
  console.log(`    http://localhost:${port}\n`);
  console.log(`  Bound to ${HOST} (loopback). Set MCG_UI_HOST=0.0.0.0 to expose on your network.\n`);
  console.log(`  Press Ctrl+C to stop.\n`);
});
