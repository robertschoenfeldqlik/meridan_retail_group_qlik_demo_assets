#!/usr/bin/env node
// ---------------------------------------------------------------------------
//  test-window.js
//  Bookkeeping for a live Open Lakehouse test window. The AWS spend cap for
//  this demo is about $30/month, so the lakehouse clusters, the network
//  integration's gateway instance and the Kafka EC2 run only inside a window.
//  This tool records when a window opens and closes, shows the tenant-side
//  state of the clusters and pipeline tasks, and stops the pipeline tasks
//  before the clusters go down.
//
//  It does NOT start or stop clusters: the Lakehouse cluster start/stop route
//  is not documented, so that stays in the Qlik UI (Administration →
//  Lakehouse clusters → row menu) until the real route is recorded.
//
//  Usage:
//    node deploy/test-window.js status       # clusters, integrations, task states
//    node deploy/test-window.js open         # log the window start
//    node deploy/test-window.js stop-tasks   # stop every pipeline task, downstream first
//    node deploy/test-window.js close        # log the window end and its cost estimate
//    node deploy/test-window.js report       # hours and estimated cost per window
//
//  Credentials: config.json auth.apiKey, or QLIK_API_KEY (wins).
// ---------------------------------------------------------------------------
'use strict';

const fs = require('fs');
const path = require('path');
const { pipelineProjectName, pipelineProjectDefs } = require('./pipeline-projects');

const SCRIPT_DIR = __dirname;
const LOG_PATH = path.join(SCRIPT_DIR, 'cost-log.csv');

// Every project whose tasks can run on the clusters: the ones config.json
// deploys, plus every exported folder under pipelines/ — the CDC project
// (pipelines/olh-mcg-demo-cdc) is built in the UI and never in that list, yet
// its storage tasks are what run on rgs-olh-mcg-cluster.
function projectNames(cfg) {
  const names = pipelineProjectDefs(cfg.pipelines).map((d) => d.projectName || pipelineProjectName(d.sourceDir));
  const root = path.join(SCRIPT_DIR, 'pipelines');
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (e.isDirectory() && fs.existsSync(path.join(root, e.name, 'qtcp_project.yaml'))) {
      names.push(pipelineProjectName('./pipelines/' + e.name));
    }
  }
  return [...new Set(names.filter(Boolean))];
}

// Hourly rates measured on 2026-10-22 in us-east-1 (Spot, latest quote; the
// gateway instance is On-Demand). Estimates only — the AWS bill is the truth.
const RATES = {
  'rgs-olh-mcg-cluster': 0.26,     // r8a.2xlarge Spot
  'rgs_olh_mcg_streaming': 0.23,   // r8i-flex.2xlarge Spot
  'rgs-olh-mcg-gateway': 0.26394,  // r8i-flex.xlarge On-Demand (network integration)
  'kafka-ec2': 0.0077,             // t3.small Spot
};

function loadConfig() {
  const cfg = JSON.parse(fs.readFileSync(path.join(SCRIPT_DIR, 'config.json'), 'utf-8'));
  if (process.env.QLIK_API_KEY) cfg.auth = Object.assign({}, cfg.auth, { apiKey: process.env.QLIK_API_KEY });
  return cfg;
}

function base(cfg) {
  return 'https://' + cfg.tenant.hostname + '.' + cfg.tenant.region;
}

async function api(cfg, method, route) {
  const res = await fetch(base(cfg) + route, {
    method,
    headers: { Authorization: 'Bearer ' + cfg.auth.apiKey, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch (_) { body = { raw: text.slice(0, 300) }; }
  return { status: res.status, body };
}

const items = (body) => body.data || body.items || (Array.isArray(body) ? body : []);

// A failed call has to stop the run: treating a 401 as "no projects" or "no
// tasks" used to report nothing to stop, exit 0, and leave CDC tasks running
// while the clusters went down.
async function apiOk(cfg, method, route) {
  const r = await api(cfg, method, route);
  if (r.status < 200 || r.status >= 300) {
    throw new Error(`${method} ${route.split('?')[0]} — HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);
  }
  return r;
}

async function listProjects(cfg) {
  return items((await apiOk(cfg, 'GET', '/api/v1/di-projects?limit=100')).body);
}

const isRunning = (state) => {
  const s = (state && state.body) || {};
  return (s.runReadiness && s.runReadiness.state === 'ALREADY_RUNNING') || (s.lastRun && s.lastRun.state === 'RUNNING');
};
const stateText = (st) => {
  if (st.status !== 200) return `HTTP ${st.status}`;
  const b = st.body || {};
  return (b.lastRun && b.lastRun.state) || b.state || b.status || JSON.stringify(b).slice(0, 60);
};

async function status(cfg) {
  const clusters = await api(cfg, 'GET', '/api/v1/lakehouse-clusters?sort=-creationTime');
  console.log('\nLakehouse clusters');
  if (clusters.status !== 200) console.log(`  (HTTP ${clusters.status})`, JSON.stringify(clusters.body).slice(0, 200));
  for (const c of items(clusters.body)) {
    console.log(`  ${String(c.name).padEnd(28)} ${String(c.status || c.state || '?').padEnd(12)} ${c.capabilitiesType || c.capabilities || ''}`);
  }
  const nis = await api(cfg, 'GET', '/api/v1/network-integrations?sort=-creationTime');
  console.log('\nNetwork integrations');
  if (nis.status !== 200) console.log(`  (HTTP ${nis.status})`, JSON.stringify(nis.body).slice(0, 200));
  for (const n of items(nis.body)) {
    console.log(`  ${String(n.name).padEnd(28)} ${String(n.status || n.state || '?')}`);
  }
  console.log('\nPipeline tasks');
  const projects = await listProjects(cfg);
  for (const name of projectNames(cfg)) {
    const p = projects.find((x) => x.name === name);
    if (!p) { console.log(`  ${name}: not on tenant`); continue; }
    const tasks = items((await apiOk(cfg, 'GET', `/api/v1/di-projects/${p.id}/di-tasks`)).body);
    if (tasks.length === 0) console.log(`  ${name}: no tasks yet`);
    for (const t of tasks) {
      const st = await api(cfg, 'GET', `/api/v1/di-projects/${p.id}/di-tasks/${t.id}/runtime/state`);
      console.log(`  ${name} / ${String(t.name).padEnd(30)} ${stateText(st)}`);
    }
  }
}

// Downstream first, so nothing keeps feeding a task that is about to stop.
const STOP_RANK = (t) => {
  const ty = String(t.type || '').toUpperCase();
  if (ty.includes('DATAMART')) return 0;
  if (ty.includes('TRANSFORM')) return 1;
  if (ty.includes('MIRROR')) return 2;
  if (ty.includes('STORAGE')) return 3;
  return 4;
};

async function stopTasks(cfg) {
  // Gather every task first and rank them across projects, so the Snowflake
  // transforms stop before the CDC project's mirrors, storage and landing.
  const projects = await listProjects(cfg);
  const all = [];
  for (const name of projectNames(cfg)) {
    const p = projects.find((x) => x.name === name);
    if (!p) { console.log(`  ${name}: not on tenant`); continue; }
    for (const t of items((await apiOk(cfg, 'GET', `/api/v1/di-projects/${p.id}/di-tasks`)).body)) all.push({ p, name, t });
  }
  all.sort((a, b) => STOP_RANK(a.t) - STOP_RANK(b.t));
  let failed = 0;
  for (const { p, name, t } of all) {
    const st = await api(cfg, 'GET', `/api/v1/di-projects/${p.id}/di-tasks/${t.id}/runtime/state`);
    if (st.status === 200 && !isRunning(st)) { console.log(`  not running  ${name} / ${t.name} (${stateText(st)})`); continue; }
    const r = await api(cfg, 'POST', `/api/v1/di-projects/${p.id}/di-tasks/${t.id}/runtime/actions/stop`);
    const ok = r.status >= 200 && r.status < 300;
    if (!ok) failed++;
    console.log(`  ${ok ? 'stopped' : 'HTTP ' + r.status}  ${name} / ${t.name}`);
  }
  if (failed > 0) {
    console.error(`\n${failed} task(s) did not stop — do not stop the clusters yet.`);
    process.exitCode = 1;
  }
}

function appendLog(event, note) {
  if (!fs.existsSync(LOG_PATH)) fs.writeFileSync(LOG_PATH, 'timestamp_utc,event,note\n');
  fs.appendFileSync(LOG_PATH, `${new Date().toISOString()},${event},"${String(note || '').replace(/"/g, "'")}"\n`);
}

function report() {
  if (!fs.existsSync(LOG_PATH)) { console.log('No windows logged yet.'); return; }
  const rows = fs.readFileSync(LOG_PATH, 'utf-8').trim().split('\n').slice(1).map((l) => {
    const [ts, event] = l.split(',');
    return { ts: new Date(ts), event };
  });
  const hourly = Object.values(RATES).reduce((a, b) => a + b, 0);
  let open = null, totalH = 0;
  console.log('\nWindows (estimate: every metered resource up for the whole window)');
  for (const r of rows) {
    if (r.event === 'open') open = r.ts;
    if (r.event === 'close' && open) {
      const h = (r.ts - open) / 3.6e6;
      totalH += h;
      console.log(`  ${open.toISOString()} → ${r.ts.toISOString()}  ${h.toFixed(2)} h  ~$${(h * hourly).toFixed(2)}`);
      open = null;
    }
  }
  if (open) console.log(`  ${open.toISOString()} → (still open)`);
  console.log(`  Total ${totalH.toFixed(2)} h, ~$${(totalH * hourly).toFixed(2)} at $${hourly.toFixed(3)}/h`);
}

async function main() {
  const cmd = process.argv[2] || 'status';
  if (cmd === 'report') return report();
  if (cmd === 'open') { appendLog('open', process.argv.slice(3).join(' ')); console.log('Window opened — logged to deploy/cost-log.csv'); return; }
  if (cmd === 'close') { appendLog('close', process.argv.slice(3).join(' ')); report(); return; }
  const cfg = loadConfig();
  if (cmd === 'status') return status(cfg);
  if (cmd === 'stop-tasks') return stopTasks(cfg);
  console.error('Usage: node deploy/test-window.js status|open|stop-tasks|close|report');
  process.exit(2);
}

// exitCode, not exit(): exiting while fetch's sockets are closing trips a libuv
// assertion on Windows and turns the error into exit code 127.
main().catch((err) => { console.error(err.message); process.exitCode = 1; });
