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

const SCRIPT_DIR  = __dirname;
const PROJECT_DIR = path.resolve(SCRIPT_DIR, '..');

const DEFAULT_PORT = 3939;

let port = DEFAULT_PORT;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--port' && process.argv[i + 1]) {
    port = parseInt(process.argv[i + 1], 10) || DEFAULT_PORT;
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

  const send = (type, data) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
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

  child.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      let level = 'info';
      if (line.includes('ERROR')) level = 'error';
      else if (line.includes('WARN')) level = 'warn';
      else if (line.includes('OK')) level = 'success';
      else if (line.includes('====')) level = 'section';
      send('log', { level, text: line });
    }
  });

  child.stderr.on('data', (chunk) => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      send('log', { level: 'error', text: line });
    }
  });

  child.on('close', (code) => {
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
    send('log', { level: 'error', text: `Process error: ${err.message}` });
    send('status', { state: 'error', message: err.message });
    res.end();
  });

  res.on('close', () => {
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

  const send = (type, data) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
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

  child.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      let level = 'info';
      if (line.includes('ERROR')) level = 'error';
      else if (line.includes('WARN')) level = 'warn';
      else if (line.includes('OK')) level = 'success';
      else if (line.includes('====')) level = 'section';
      send('log', { level, text: line });
    }
  });

  child.stderr.on('data', (chunk) => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      send('log', { level: 'error', text: line });
    }
  });

  child.on('close', (code) => {
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
    send('log', { level: 'error', text: `Process error: ${err.message}` });
    send('status', { state: 'error', message: err.message });
    res.end();
  });

  res.on('close', () => {
    if (activeBuildAutoProcess === child) {
      child.kill('SIGTERM');
      activeBuildAutoProcess = null;
    }
  });
}

// ---------------------------------------------------------------------------
//  Docker infrastructure helpers
// ---------------------------------------------------------------------------

const INFRA_DIR = path.join(PROJECT_DIR, 'infrastructure');

function discoverDocker() {
  const result = {
    dockerAvailable: false,
    composeAvailable: false,
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
  const lines = [
    '# =============================================================================',
    '# MCG Demo — Environment Variables (generated by deploy-ui)',
    '# =============================================================================',
    '',
  ];
  for (const [k, v] of Object.entries(vars)) {
    lines.push(`${k}=${v}`);
  }
  fs.writeFileSync(path.join(INFRA_DIR, '.env'), lines.join('\n') + '\n', 'utf-8');
}

// Run a docker compose command with SSE streaming
let activeDockerProcess = null;

function runDockerCompose(res, options) {
  if (activeDockerProcess) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'A Docker operation is already running.' }));
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (type, data) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Save env vars if provided
  if (options.envVars) {
    saveEnvFile(options.envVars);
    send('log', { level: 'info', text: 'Saved environment variables to infrastructure/.env' });
  }

  // Build docker compose command
  const composeFile = options.composeFile;
  const action = options.action; // 'up', 'down', 'status'

  let cmd, args;
  if (action === 'status') {
    cmd = 'docker';
    args = ['compose', '-f', composeFile, 'ps', '--format', 'table'];
  } else if (action === 'down') {
    cmd = 'docker';
    args = ['compose', '-f', composeFile, 'down'];
  } else {
    // up
    cmd = 'docker';
    args = ['compose', '-f', composeFile, 'up', '-d'];
    if (options.build) args.push('--build');
    if (options.profiles) {
      for (const p of options.profiles) {
        args.push('--profile', p);
      }
    }
  }

  const cmdStr = [cmd, ...args].join(' ');
  send('status', { state: 'starting', message: `Running: ${cmdStr}` });
  send('log', { level: 'info', text: `> ${cmdStr}` });
  send('log', { level: 'info', text: `  cwd: ${INFRA_DIR}` });

  const child = spawn(cmd, args, {
    cwd: INFRA_DIR,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  activeDockerProcess = child;

  child.stdout.on('data', (chunk) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      send('log', { level: 'info', text: line });
    }
  });

  child.stderr.on('data', (chunk) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      // Docker compose outputs progress to stderr
      const level = line.includes('Error') || line.includes('error') ? 'error' : 'info';
      send('log', { level, text: line });
    }
  });

  child.on('close', (code) => {
    activeDockerProcess = null;
    send('status', {
      state: 'done',
      code,
      message: code === 0 ? `Docker ${action} completed.` : `Docker ${action} finished with exit code ${code}.`,
    });
    res.end();
  });

  child.on('error', (err) => {
    activeDockerProcess = null;
    send('log', { level: 'error', text: `Process error: ${err.message}` });
    send('status', { state: 'error', message: err.message });
    res.end();
  });

  res.on('close', () => {
    if (activeDockerProcess === child) {
      child.kill('SIGTERM');
      activeDockerProcess = null;
    }
  });
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

  const send = (type, data) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const args = [path.join(SCRIPT_DIR, 'deploy-to-qlik.js')];
  if (options.dryRun) args.push('--dry-run');
  if (options.verbose) args.push('--verbose');

  send('status', { state: 'starting', message: 'Starting deployment...' });
  send('log', { level: 'info', text: `> node ${args.join(' ')}` });

  // Write config with user's overrides
  let tempConfig = null;
  if (options.config) {
    try {
      tempConfig = path.join(SCRIPT_DIR, '.config-ui-temp.json');
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

  activeProcess = child;

  child.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      let level = 'info';
      if (line.includes('ERROR')) level = 'error';
      else if (line.includes('WARN')) level = 'warn';
      else if (line.includes('OK')) level = 'success';
      else if (line.includes('====')) level = 'section';
      send('log', { level, text: line });
    }
  });

  child.stderr.on('data', (chunk) => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      send('log', { level: 'error', text: line });
    }
  });

  child.on('close', (code) => {
    activeProcess = null;
    if (tempConfig && fs.existsSync(tempConfig)) {
      try { fs.unlinkSync(tempConfig); } catch (_) {}
    }
    send('status', {
      state: 'done',
      code,
      message: code === 0 ? 'Deployment completed successfully.' : `Deployment finished with exit code ${code}.`,
    });
    res.end();
  });

  child.on('error', (err) => {
    activeProcess = null;
    send('log', { level: 'error', text: `Process error: ${err.message}` });
    send('status', { state: 'error', message: err.message });
    res.end();
  });

  res.on('close', () => {
    if (activeProcess === child) {
      child.kill('SIGTERM');
      activeProcess = null;
    }
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
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  :root {
    --navy: #1B2A4A;
    --navy-light: #243557;
    --teal: #0D7C8F;
    --teal-dark: #0a6271;
    --gold: #C4922E;
    --gold-dark: #a67b26;
    --bg: #0f1923;
    --surface: #162230;
    --surface2: #1d2e3f;
    --border: #2a3f55;
    --text: #e0e6ed;
    --text-dim: #8899aa;
    --success: #34d399;
    --error: #f87171;
    --warn: #fbbf24;

    /* Qlik brand */
    --qlik-green: #009845;
    --qlik-green-dark: #007a38;
    --qlik-green-glow: rgba(0, 152, 69, 0.35);

    /* Spacing scale */
    --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px;
    --sp-4: 16px; --sp-5: 24px; --sp-6: 32px;
    --sp-7: 48px; --sp-8: 64px;

    /* Radius */
    --radius-sm: 4px;  --radius-md: 6px;
    --radius-lg: 10px; --radius-xl: 14px;
    --radius-full: 9999px;

    /* Shadows */
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.25);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.3);
    --shadow-lg: 0 8px 24px rgba(0,0,0,0.35);

    /* Transition */
    --transition: 0.2s ease;

    /* Semantic tokens (for theme switching) */
    --text-bright: #fff;
    --placeholder: #4a5f75;
    --switch-bg: #3a4f65;
    --switch-knob: #fff;
    --hover-overlay: rgba(255,255,255,0.06);
    --btn-sheen: rgba(255,255,255,0.08);
    --sidebar-gradient-end: rgba(13,124,143,0.04);
    --console-bg: #0b1219;
    --stop-hover: #e05555;
    --badge-teal-bg: rgba(13,124,143,0.2);
    --badge-teal-border: rgba(13,124,143,0.4);
    --badge-gold-bg: rgba(196,146,46,0.2);
    --badge-gold-border: rgba(196,146,46,0.4);
    --badge-red-bg: rgba(248,113,113,0.2);
    --badge-red-border: rgba(248,113,113,0.4);
    --dp-card-hover-border: rgba(13,124,143,0.3);
    --btn-dry-hover: rgba(196,146,46,0.1);
    --btn-save-hover: rgba(13,124,143,0.1);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
  }

  /* Header */
  .header {
    background: linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%);
    border-bottom: 2px solid transparent;
    border-image: linear-gradient(90deg, var(--qlik-green), var(--teal), var(--gold)) 1;
    padding: 14px 24px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
    position: relative;
    z-index: 10;
  }
  .header::after {
    content: '';
    position: absolute;
    bottom: -3px;
    left: 0;
    right: 0;
    height: 6px;
    background: linear-gradient(90deg, var(--qlik-green), var(--teal), var(--gold));
    opacity: 0.15;
    filter: blur(6px);
    pointer-events: none;
  }
  .header h1 { font-size: 20px; font-weight: 700; color: var(--text-bright); letter-spacing: -0.3px; }
  .header .subtitle { font-size: 13px; color: var(--text-dim); margin-left: auto; }
  .badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    backdrop-filter: blur(4px);
  }
  .badge-teal { background: var(--badge-teal-bg); color: var(--teal); border: 1px solid var(--badge-teal-border); }
  .badge-gold { background: var(--badge-gold-bg); color: var(--gold); border: 1px solid var(--badge-gold-border); }
  .badge-red  { background: var(--badge-red-bg); color: var(--error); border: 1px solid var(--badge-red-border); }

  /* Layout */
  .layout {
    display: grid;
    grid-template-columns: 420px 1fr;
    height: calc(100vh - 56px);
  }
  @media (max-width: 960px) {
    .layout { grid-template-columns: 1fr; height: auto; }
  }
  @media (min-width: 1400px) {
    .layout { grid-template-columns: 480px 1fr; }
  }

  /* Sidebar */
  .sidebar {
    background: linear-gradient(180deg, var(--surface) 0%, var(--sidebar-gradient-end) 100%);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Wizard nav */
  .wizard-nav {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    padding: var(--sp-2);
    gap: 2px;
  }
  .wizard-nav button {
    text-align: left;
    background: none;
    border: none;
    border-left: 3px solid transparent;
    color: var(--text-dim);
    padding: 8px 14px;
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: all var(--transition);
  }
  .wizard-nav button:hover { background: var(--hover-overlay); }
  .wizard-nav button.active {
    background: var(--surface2);
    border-left-color: var(--qlik-green);
    color: var(--text-bright);
    font-weight: 600;
  }
  .wizard-nav button .step-num {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--surface2);
    color: var(--text-dim);
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
    color: var(--text-bright);
    box-shadow: 0 0 10px var(--qlik-green-glow);
  }
  .wizard-nav button .step-check {
    margin-left: auto;
    font-size: 14px;
  }

  /* Wizard content */
  .wizard-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--sp-4);
  }
  .wizard-page { display: none; }
  .wizard-page.active { display: block; animation: fadeIn 0.25s ease-out; }

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
    font-size: 11px;
    font-weight: 600;
    color: var(--text-dim);
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }
  .field input, .field select, .field textarea {
    width: 100%;
    padding: 9px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
    font-size: 13px;
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

  /* Section divider */
  .section-divider {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-bright);
    margin: 20px 0 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
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
    background: linear-gradient(135deg, var(--qlik-green) 0%, var(--qlik-green-dark) 100%);
    color: var(--text-bright);
  }
  .btn-deploy:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px var(--qlik-green-glow);
  }
  .btn-dry {
    background: var(--surface2);
    border: 1px solid var(--gold);
    color: var(--gold);
  }
  .btn-dry:hover:not(:disabled) { background: var(--btn-dry-hover); }
  .btn-stop {
    background: var(--error);
    color: var(--text-bright);
  }
  .btn-stop:hover:not(:disabled) { background: var(--stop-hover); }
  .btn-save {
    background: var(--surface2);
    border: 1px solid var(--teal);
    color: var(--teal);
    font-size: 12px;
    padding: 6px 14px;
    width: auto;
  }
  .btn-save:hover { background: var(--btn-save-hover); }
  .btn-row { display: flex; gap: 8px; margin-top: 8px; }
  .btn-row .btn { flex: 1; }

  /* Console */
  .console-area {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: radial-gradient(ellipse at top left, rgba(0,152,69,0.03) 0%, var(--console-bg) 60%);
  }
  .console-toolbar {
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--surface);
    flex-shrink: 0;
  }
  .console-toolbar h2 { font-size: 14px; font-weight: 600; }
  .console-toolbar .status-text { margin-left: auto; font-size: 12px; }
  .console-toolbar button {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    cursor: pointer;
    transition: border-color var(--transition), color var(--transition);
  }
  .console-toolbar button:hover { border-color: var(--text-dim); color: var(--text); }

  #console {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
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
  .log-section { color: var(--teal); font-weight: 700; }
  .log-line .timestamp { color: var(--text-dim); margin-right: 4px; font-size: 11px; }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-dim);
    gap: 12px;
  }
  .empty-state .icon { font-size: 48px; opacity: 0.3; }
  .empty-state p { font-size: 14px; }

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
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    color: #fff;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-full);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    transition: all var(--transition);
    flex-shrink: 0;
  }
  .theme-toggle:hover {
    background: rgba(255,255,255,0.2);
    border-color: rgba(255,255,255,0.3);
  }

  /* Theme transition */
  body,
  .sidebar, .wizard-content, .field input,
  .field select, .field textarea, .dp-card,
  .file-item, .console-toolbar, .wizard-nav button,
  .badge, .btn, .toggle-row, .dp-card .dp-tags span {
    transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
  }

  /* Light theme overrides */
  body.light-theme {
    --bg: #f5f7fa;
    --surface: #ffffff;
    --surface2: #eef1f5;
    --border: #d1d9e0;
    --text: #1a2332;
    --text-dim: #5a6b7d;
    --text-bright: #0f1923;
    --placeholder: #9ca8b5;
    --switch-bg: #c0c8d0;
    --switch-knob: #fff;
    --hover-overlay: rgba(0,0,0,0.04);
    --btn-sheen: rgba(255,255,255,0.15);
    --sidebar-gradient-end: rgba(13,124,143,0.03);
    --console-bg: #0b1219;
    --dp-card-hover-border: rgba(13,124,143,0.4);
    --badge-teal-bg: rgba(13,124,143,0.1);
    --badge-teal-border: rgba(13,124,143,0.3);
    --badge-gold-bg: rgba(196,146,46,0.1);
    --badge-gold-border: rgba(196,146,46,0.3);
    --badge-red-bg: rgba(248,113,113,0.1);
    --badge-red-border: rgba(248,113,113,0.3);
    --btn-dry-hover: rgba(196,146,46,0.08);
    --btn-save-hover: rgba(13,124,143,0.08);
    --stop-hover: #dc4444;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
    --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
  }

  /* Console stays dark in light theme */
  body.light-theme .console-area {
    --bg: #0b1219;
    --surface: #162230;
    --border: #2a3f55;
    --text: #e0e6ed;
    --text-dim: #8899aa;
    --text-bright: #fff;
  }
  body.light-theme .console-area .console-toolbar button {
    color: #8899aa;
    border-color: #2a3f55;
  }
  body.light-theme .console-area .console-toolbar button:hover {
    color: #e0e6ed;
    border-color: #8899aa;
  }

  /* Header stays dark navy in light theme */
  body.light-theme .header {
    --text-bright: #fff;
    --text-dim: #8899aa;
    --border: #2a3f55;
  }

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
      gap: 10px;
    }
    .header h1 { font-size: 17px; }
    .header .subtitle { display: none; }

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
<body>

<div class="header">
  <h1>MCG Deploy</h1>
  <span class="badge badge-teal">Qlik Cloud</span>
  <span id="run-badge" class="badge badge-gold" style="display:none">RUNNING</span>
  <button class="theme-toggle" id="theme-toggle" onclick="toggleTheme()" title="Toggle light/dark theme">
    <span id="theme-icon">&#9790;</span>
  </button>
  <span class="subtitle">Meridian Commerce Group — Deployment Console</span>
</div>

<div class="layout">
  <!-- Sidebar: Wizard -->
  <div class="sidebar">
    <div class="wizard-nav" id="wizard-nav">
      <button class="active" onclick="showPage(0)"><span class="step-num">1</span>Connection & Auth<span class="step-check" id="check-0"></span></button>
      <button onclick="showPage(1)"><span class="step-num">2</span>Docker Containers<span class="step-check" id="check-1"></span></button>
      <button onclick="showPage(2)"><span class="step-num">3</span>Spaces & Infrastructure<span class="step-check" id="check-2"></span></button>
      <button onclick="showPage(3)"><span class="step-num">4</span>Build Apps & Theme<span class="step-check" id="check-3"></span></button>
      <button onclick="showPage(4)"><span class="step-num">5</span>Data Connections<span class="step-check" id="check-4"></span></button>
      <button onclick="showPage(5)"><span class="step-num">6</span>Knowledge Base & Docs<span class="step-check" id="check-5"></span></button>
      <button onclick="showPage(6)"><span class="step-num">7</span>Automations<span class="step-check" id="check-6"></span></button>
      <button onclick="showPage(7)"><span class="step-num">8</span>Data Products<span class="step-check" id="check-7"></span></button>
      <button onclick="showPage(8)"><span class="step-num">9</span>Glossary<span class="step-check" id="check-8"></span></button>
      <button onclick="showPage(9)"><span class="step-num">&#9654;</span>Deploy<span class="step-check" id="check-9"></span></button>
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
          <button class="btn btn-save" onclick="testConnection()" id="btn-test-conn" style="flex:1;font-size:13px;padding:9px 14px">
            &#9889; Test Connection
          </button>
        </div>
        <div id="test-conn-result" style="margin-top:8px;font-size:12px;line-height:1.5;display:none;padding:8px 12px;border-radius:var(--radius-md);border:1px solid var(--border)"></div>
      </div>

      <!-- Page 1: Docker Containers -->
      <div class="wizard-page" id="page-1">
        <div class="page-title">Docker Containers</div>
        <div class="page-desc">Launch simulator and Data Movement Gateway containers. Configure environment variables for Docker Compose.</div>

        <div class="toggle-row">
          <label>Enable Docker Containers</label>
          <label class="switch"><input type="checkbox" id="f-en-docker" checked><span class="slider"></span></label>
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

          <div class="field" style="margin-top:4px">
            <div class="hint">
              The DMG container requires the Qlik Gateway RPM.<br>
              Download from: <a href="https://github.com/qlik-download/saas-download-links/releases" target="_blank" style="color:var(--teal)">github.com/qlik-download/saas-download-links/releases</a><br>
              Place as: infrastructure/dmg/gateway/rpmfiles/gateway.rpm<br><br>
              DMG container source: <a href="https://github.com/robertschoenfeldqlik/qlik_data_movement_gateway_rdbms_container" target="_blank" style="color:var(--teal)">github.com/robertschoenfeldqlik/qlik_data_movement_gateway_rdbms_container</a>
            </div>
          </div>
        </div>

        <div class="section-divider">Actions</div>
        <div class="btn-row">
          <button class="btn btn-deploy" id="btn-docker-up" onclick="dockerAction('up')">Start Containers</button>
          <button class="btn btn-dry" id="btn-docker-status" onclick="dockerAction('status')">Status</button>
        </div>
        <div class="btn-row" style="margin-top:6px">
          <button class="btn btn-stop" id="btn-docker-down" onclick="dockerAction('down')">Stop Containers</button>
        </div>
      </div>

      <!-- Page 2: Spaces & Infrastructure -->
      <div class="wizard-page" id="page-2">
        <div class="page-title">Spaces & Infrastructure</div>
        <div class="page-desc">Configure Qlik Cloud spaces and optional Kafka infrastructure.</div>

        <div class="section-divider">Spaces</div>
        <div class="toggle-row">
          <label>Enable Spaces</label>
          <label class="switch"><input type="checkbox" id="f-en-spaces" checked><span class="slider"></span></label>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Shared Space Name</label>
            <input type="text" id="f-space-shared" placeholder="MCG Demo - Development">
          </div>
          <div class="field">
            <label>Managed Space Name</label>
            <input type="text" id="f-space-managed" placeholder="MCG Demo - Published">
          </div>
        </div>

        <div class="section-divider">Infrastructure (Kafka)</div>
        <div class="toggle-row">
          <label>Enable Infrastructure</label>
          <label class="switch"><input type="checkbox" id="f-en-infra" checked><span class="slider"></span></label>
        </div>
        <div class="toggle-row">
          <label>Use Docker Compose for Kafka</label>
          <label class="switch"><input type="checkbox" id="f-infra-docker" checked><span class="slider"></span></label>
        </div>
      </div>

      <!-- Page 3: Build Apps & Theme -->
      <div class="wizard-page" id="page-3">
        <div class="page-title">Build Apps & Theme</div>
        <div class="page-desc">Build Qlik Analytics apps via Engine API and upload the MCG custom theme.</div>

        <div class="section-divider">App Definitions</div>
        <div id="build-app-defs">
          <div style="font-size:12px;color:var(--text-dim)">Loading app definitions...</div>
        </div>

        <div class="section-divider">Build Options</div>
        <div class="toggle-row">
          <label>Verbose Logging</label>
          <label class="switch"><input type="checkbox" id="build-opt-verbose" checked><span class="slider"></span></label>
        </div>

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

      <!-- Page 4: Data Connections -->
      <div class="wizard-page" id="page-4">
        <div class="page-title">Data Connections</div>
        <div class="page-desc">Configure source system connections for PostgreSQL, Salesforce, Kafka, and S3.</div>

        <div class="toggle-row">
          <label>Enable Data Connections</label>
          <label class="switch"><input type="checkbox" id="f-en-connections" checked><span class="slider"></span></label>
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
            <input type="text" id="f-pg-username" placeholder="qlik_reader">
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" id="f-pg-password" placeholder="password">
          </div>
        </div>

        <div class="section-divider">Salesforce (CRM)</div>
        <div class="field">
          <label>Connection Name</label>
          <input type="text" id="f-sf-name" placeholder="MCG Salesforce CRM">
        </div>
        <div class="field-row-3">
          <div class="field">
            <label>Username</label>
            <input type="text" id="f-sf-username" placeholder="integration@mcg-demo.com">
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" id="f-sf-password" placeholder="password">
          </div>
          <div class="field">
            <label>Security Token</label>
            <input type="password" id="f-sf-token" placeholder="token">
          </div>
        </div>
        <div class="toggle-row" style="margin-top:4px">
          <label>Sandbox Environment</label>
          <label class="switch"><input type="checkbox" id="f-sf-sandbox" checked><span class="slider"></span></label>
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

      <!-- Page 5: Knowledge Base & Docs -->
      <div class="wizard-page" id="page-5">
        <div class="page-title">Knowledge Base & Documents</div>
        <div class="page-desc">Configure Qlik Answers knowledge base and select documents to upload.</div>

        <div class="toggle-row">
          <label>Enable Knowledge Base</label>
          <label class="switch"><input type="checkbox" id="f-en-knowledge" checked><span class="slider"></span></label>
        </div>

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

      <!-- Page 7: Data Products -->
      <div class="wizard-page" id="page-7">
        <div class="page-title">Data Products</div>
        <div class="page-desc">Gold-layer data product definitions to register in the Qlik Cloud catalog.</div>

        <div class="toggle-row">
          <label>Enable Data Products</label>
          <label class="switch"><input type="checkbox" id="f-en-dataproducts" checked><span class="slider"></span></label>
        </div>

        <div class="section-divider">Products from data_products.json</div>
        <div id="dp-list"><!-- populated by JS --></div>
      </div>

      <!-- Page 8: Glossary -->
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

      <!-- Page 9: Deploy -->
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
  </div>

  <!-- Console Output -->
  <div class="console-area">
    <div class="console-toolbar">
      <h2>Console Output</h2>
      <button onclick="clearConsole()">Clear</button>
      <button onclick="copyConsole()">Copy</button>
      <button onclick="downloadLog()">Download</button>
      <span class="status-text" id="status-text">Ready</span>
    </div>
    <div id="console">
      <div class="empty-state">
        <div class="icon">&#9654;</div>
        <p>Configure your deployment and click Deploy or Dry Run.</p>
      </div>
    </div>
  </div>
</div>

<div class="save-toast" id="save-toast">Configuration saved!</div>

<script>
  let eventSource = null;
  let isRunning = false;
  let discoveredFiles = {};
  let loadedConfig = null;

  // --- Theme Toggle ---
  function initTheme() {
    const saved = localStorage.getItem('mcg-deploy-theme');
    if (saved) {
      applyTheme(saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      applyTheme('light');
    }
  }

  function applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      document.getElementById('theme-icon').innerHTML = '&#9728;';
    } else {
      document.body.classList.remove('light-theme');
      document.getElementById('theme-icon').innerHTML = '&#9790;';
    }
  }

  function toggleTheme() {
    const isLight = document.body.classList.contains('light-theme');
    const newTheme = isLight ? 'dark' : 'light';
    applyTheme(newTheme);
    localStorage.setItem('mcg-deploy-theme', newTheme);
  }

  // --- Wizard Navigation ---
  function showPage(idx) {
    document.querySelectorAll('.wizard-page').forEach((p, i) => {
      p.classList.toggle('active', i === idx);
    });
    document.querySelectorAll('.wizard-nav button').forEach((b, i) => {
      b.classList.toggle('active', i === idx);
    });
    if (idx === 9) renderSummary();
    if (idx === 3) renderBuildAppsPage();
    if (idx === 6) renderBuildAutomationsPage();
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
    }

    // Infrastructure
    if (cfg.infrastructure) {
      setCheck('f-infra-docker', cfg.infrastructure.useDocker !== false);
    }

    // Enabled components
    const en = cfg.enabledComponents || {};
    setCheck('f-en-spaces', en.spaces !== false);
    setCheck('f-en-infra', en.infrastructure !== false);
    setCheck('f-en-connections', en.connections !== false);
    setCheck('f-en-theme', en.theme !== false);
    setCheck('f-en-knowledge', en.knowledge !== false);
    setCheck('f-en-assistant', en.assistant !== false);
    setCheck('f-en-automations', en.automations !== false);
    setCheck('f-en-dataproducts', en.dataproducts !== false);
    setCheck('f-en-glossary', en.glossary !== false);

    // Data Connections
    if (cfg.dataConnections) {
      const pg = cfg.dataConnections.postgresql || {};
      setVal('f-pg-name', pg.name);
      setVal('f-pg-host', pg.host);
      setVal('f-pg-port', pg.port);
      setVal('f-pg-database', pg.database);
      setVal('f-pg-username', pg.username);
      setVal('f-pg-password', pg.password);

      const sf = cfg.dataConnections.salesforce || {};
      setVal('f-sf-name', sf.name);
      setVal('f-sf-username', sf.username);
      setVal('f-sf-password', sf.password);
      setVal('f-sf-token', sf.securityToken);
      setCheck('f-sf-sandbox', sf.isSandbox !== false);

      const kf = cfg.dataConnections.kafka || {};
      setVal('f-kafka-name', kf.name);
      setVal('f-kafka-bootstrap', kf.bootstrapServers);
      setSelVal('f-kafka-protocol', kf.securityProtocol);
      setVal('f-kafka-sasl-user', kf.saslUsername);
      setVal('f-kafka-sasl-pass', kf.saslPassword);

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

  // --- Docker page ---
  function renderDockerPage(docker, cfg) {
    // Compose file status
    const infoEl = document.getElementById('docker-compose-info');
    const files = docker.composeFiles || [];
    let html = '<div style="font-size:12px;margin-bottom:8px">';
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
          rpmEl.innerHTML = '<div style="font-size:12px"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--success);margin-right:6px"></span>Gateway RPM found: ' + esc((g.rpmFiles || [])[0] || 'gateway.rpm') + '</div>';
        } else {
          rpmEl.innerHTML = '<div style="font-size:12px"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--error);margin-right:6px"></span>Gateway RPM not found — place it in infrastructure/dmg/gateway/rpmfiles/</div>';
        }
      } else {
        rpmEl.innerHTML = '<div style="font-size:12px"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--error);margin-right:6px"></span>DMG Dockerfile not found</div>';
      }
    }

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
    sel.addEventListener('change', toggleDmg);
    toggleDmg();
  }

  const COMPOSE_MAP = {
    'full-stack': 'docker-compose.full-stack.yml',
    'full-stack-dmg': 'docker-compose.full-stack-dmg.yml',
    'kafka': 'kafka/docker-compose.yml',
    'simulators': 'docker-compose.simulators.yml',
    'dmg': 'docker-compose.dmg.yml',
  };

  function dockerAction(action) {
    const profile = getVal('f-docker-profile');
    const composeFile = COMPOSE_MAP[profile];
    if (!composeFile) return;

    // Collect env vars
    const envVars = {
      TENANT_URL: getVal('f-docker-tenant-url'),
      KAFKA_BOOTSTRAP: getVal('f-docker-kafka-bootstrap'),
      POSTGRES_DB: getVal('f-docker-pg-db'),
      POSTGRES_USER: getVal('f-docker-pg-user'),
      POSTGRES_PASSWORD: getVal('f-docker-pg-pass'),
    };

    if (profile === 'dmg' || profile === 'full-stack-dmg') {
      envVars.DMG_POSTGRES_PASSWORD = getVal('f-docker-dmg-pg-pass');
      envVars.DMG_MYSQL_PASSWORD = getVal('f-docker-dmg-mysql-pass');
      envVars.DMG_MSSQL_PASSWORD = getVal('f-docker-dmg-mssql-pass');
    }

    // Show output in console
    const consoleEl = document.getElementById('console');
    consoleEl.innerHTML = '';

    const params = new URLSearchParams({
      action,
      composeFile,
      build: (profile === 'dmg' || profile === 'full-stack-dmg') ? '1' : '0',
      envVars: JSON.stringify(envVars),
    });

    const es = new EventSource('/api/docker/run?' + params.toString());

    es.addEventListener('log', (e) => {
      const data = JSON.parse(e.data);
      appendLog(data.level, data.text);
    });

    es.addEventListener('status', (e) => {
      const data = JSON.parse(e.data);
      const statusEl = document.getElementById('status-text');
      statusEl.textContent = data.message;

      if (data.state === 'done' || data.state === 'error') {
        es.close();
        if (data.code === 0) {
          statusEl.style.color = 'var(--success)';
        } else {
          statusEl.style.color = 'var(--error)';
        }
      }
    });

    es.onerror = () => {
      es.close();
      appendLog('error', 'Connection lost.');
    };
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
      html += '</div>';
    }

    el.innerHTML = html;
  }

  function startBuildApps(dryRun) {
    if (isBuildRunning) return;
    isBuildRunning = true;

    const consoleEl = document.getElementById('console');
    consoleEl.innerHTML = '';

    document.getElementById('btn-build-apps').disabled = true;
    document.getElementById('btn-build-dry').disabled = true;
    document.getElementById('build-stop-row').style.display = 'flex';
    document.getElementById('build-summary').style.display = 'none';

    const badge = document.getElementById('run-badge');
    badge.style.display = 'inline-block';
    badge.textContent = dryRun ? 'BUILD DRY RUN' : 'BUILDING';
    badge.className = 'badge ' + (dryRun ? 'badge-gold' : 'badge-red') + ' running-indicator';

    const statusEl = document.getElementById('status-text');
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
    document.getElementById('status-text').textContent = 'Stopped';
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

    const consoleEl = document.getElementById('console');
    consoleEl.innerHTML = '';

    document.getElementById('btn-build-autos').disabled = true;
    document.getElementById('btn-build-auto-dry').disabled = true;
    document.getElementById('build-auto-stop-row').style.display = 'flex';
    document.getElementById('build-auto-summary').style.display = 'none';

    const badge = document.getElementById('run-badge');
    badge.style.display = 'inline-block';
    badge.textContent = dryRun ? 'AUTO DRY RUN' : 'BUILDING AUTOS';
    badge.className = 'badge ' + (dryRun ? 'badge-gold' : 'badge-red') + ' running-indicator';

    const statusEl = document.getElementById('status-text');
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
    document.getElementById('status-text').textContent = 'Stopped';
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
      },
      enabledComponents: {
        docker: isChecked('f-en-docker'),
        infrastructure: isChecked('f-en-infra'),
        spaces: isChecked('f-en-spaces'),
        connections: isChecked('f-en-connections'),
        theme: isChecked('f-en-theme'),
        knowledge: isChecked('f-en-knowledge'),
        assistant: isChecked('f-en-assistant'),
        automations: isChecked('f-en-automations'),
        dataproducts: isChecked('f-en-dataproducts'),
        glossary: isChecked('f-en-glossary'),
      },
      infrastructure: {
        useDocker: isChecked('f-infra-docker'),
      },
      docker: {
        profile: getVal('f-docker-profile') || 'full-stack',
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
        salesforce: {
          name: getVal('f-sf-name') || 'MCG Salesforce CRM',
          securityToken: getVal('f-sf-token'),
          username: getVal('f-sf-username'),
          password: getVal('f-sf-password'),
          isSandbox: isChecked('f-sf-sandbox'),
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
      },
      assistant: {
        name: getVal('f-ast-name') || 'MCG Operations Assistant',
        description: getVal('f-ast-desc') || '',
        conversationStarters: [
          'What is the procedure for goods receiving?',
          'What happened during the Rotterdam pipeline failure?',
          'What are the cold chain temperature requirements?',
          'What is Project CLARITY?',
          'What was the lettuce recall and what went wrong?',
        ],
      },
      dataProducts: { sourceFile: './data_products.json' },
      glossary: { sourceFile: './glossary_terms.json' },
      automations: {
        templateDir: './automations',
        teamsWebhookUrl: getVal('f-teams-webhook'),
      },
      documents: { sourceDir: '../documents' },
      apps: { sourceDir: './apps' },
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

  function renderSummary() {
    renderPreflight();
    const el = document.getElementById('deploy-summary');
    const en = {
      docker: isChecked('f-en-docker'),
      infrastructure: isChecked('f-en-infra'),
      spaces: isChecked('f-en-spaces'),
      connections: isChecked('f-en-connections'),
      theme: isChecked('f-en-theme'),
      knowledge: isChecked('f-en-knowledge'),
      assistant: isChecked('f-en-assistant'),
      automations: isChecked('f-en-automations'),
      dataproducts: isChecked('f-en-dataproducts'),
      glossary: isChecked('f-en-glossary'),
    };

    const tenant = getVal('f-tenant-host') + '.' + getVal('f-tenant-region');
    const auth = getVal('f-auth-method');

    let html = '<div style="margin-bottom:12px">';
    html += '<div style="margin-bottom:4px"><strong>Tenant:</strong> ' + esc(tenant) + '</div>';
    html += '<div style="margin-bottom:4px"><strong>Auth:</strong> ' + esc(auth) + '</div>';
    html += '</div>';

    const steps = [
      ['docker', 'Docker Containers'],
      ['infrastructure', 'Infrastructure (Kafka)'],
      ['spaces', 'Spaces'],
      ['connections', 'Data Connections'],
      ['theme', 'Theme Upload'],
      ['knowledge', 'Knowledge Base & Docs'],
      ['assistant', 'Qlik Answers Assistant'],
      ['automations', 'Automations'],
      ['dataproducts', 'Data Products'],
      ['glossary', 'Business Glossary'],
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

    const consoleEl = document.getElementById('console');
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
        const statusEl = document.getElementById('status-text');
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
        document.getElementById('status-text').textContent = 'Disconnected';
      };
    });
  }

  function stopDeploy() {
    fetch('/api/stop', { method: 'POST' });
    if (eventSource) { eventSource.close(); eventSource = null; }
    isRunning = false;
    setRunningState(false);
    appendLog('warn', 'Deployment stopped by user.');
    document.getElementById('status-text').textContent = 'Stopped';
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

  function appendLog(level, text) {
    const consoleEl = document.getElementById('console');
    const div = document.createElement('div');
    div.className = 'log-line log-' + level;
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    div.innerHTML = '<span class="timestamp">' + ts + '</span>' + esc(text);
    consoleEl.appendChild(div);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  function clearConsole() {
    document.getElementById('console').innerHTML = '';
    document.getElementById('status-text').textContent = 'Ready';
    document.getElementById('status-text').style.color = '';
  }

  function copyConsole() {
    const text = document.getElementById('console').innerText;
    navigator.clipboard.writeText(text).then(() => {
      const btn = event.target;
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy', 1500);
    });
  }

  function downloadLog() {
    const text = document.getElementById('console').innerText;
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

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://localhost:${port}`);

  if (req.method === 'GET' && parsed.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
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
    res.end(JSON.stringify(loadConfig() || { error: 'config.json not found' }));
    return;
  }

  if (req.method === 'POST' && parsed.pathname === '/api/config') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const cfg = JSON.parse(body);
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
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const params = JSON.parse(body);
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
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
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

    const cfg = pendingDeployConfig || loadConfig();
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
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
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

    const cfg = pendingBuildConfig || loadConfig();
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
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
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

    const cfg = pendingBuildAutoConfig || loadConfig();
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

  if (req.method === 'GET' && parsed.pathname === '/api/docker/run') {
    const action = parsed.searchParams.get('action') || 'status';
    const composeFile = parsed.searchParams.get('composeFile');
    const build = parsed.searchParams.get('build') === '1';
    let envVars = null;
    try { envVars = JSON.parse(parsed.searchParams.get('envVars') || 'null'); } catch (_) {}

    if (!composeFile) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'composeFile is required' }));
      return;
    }

    runDockerCompose(res, { action, composeFile, build, envVars });
    return;
  }

  if (req.method === 'POST' && parsed.pathname === '/api/docker/stop') {
    if (activeDockerProcess) {
      activeDockerProcess.kill('SIGTERM');
      activeDockerProcess = null;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
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

server.listen(port, () => {
  console.log(`\n  MCG Deploy UI running at:\n`);
  console.log(`    http://localhost:${port}\n`);
  console.log(`  Press Ctrl+C to stop.\n`);
});
