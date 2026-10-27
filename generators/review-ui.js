#!/usr/bin/env node
/**
 * review-ui.js — run the AI assessment from a local page.
 * ============================================================================
 * One page over the rubric reviews: the four pillar videos and Ingrid's ruling
 * (gen-ceo-video-review.js) and the slide decks (review-deck.js). Each card says
 * whether its review is current and what it last scored. Run starts the review,
 * streams it into the page and publishes through the same gates as the CLI — the
 * app never writes a review itself.
 *
 * Engines:
 *   agent    headless Claude Code — `claude -p --agent rubric-reviewer` on this
 *            machine's Claude login; every review kind. A long-lived token from
 *            `claude setup-token` saved to MCG_CLAUDE_TOKEN_FILE is used instead
 *            when present.
 *   api      the Anthropic API through gen-ceo-video-review.js — pillars and the
 *            ruling (decks have no API classifier). Key read from MCG_ANTHROPIC_KEY_FILE.
 *   offline  re-gate or re-publish the recorded verdicts; no model call.
 *
 * Usage:
 *   node generators/review-ui.js [--port 3940]      # then open http://localhost:3940
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');

const review = require('./lib/rubric-review');
const { REPO_ROOT, doc, deck: deckPath } = require('./lib/asset-paths');

const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const PORT = Number(val('--port', process.env.PORT || 3940));
const HOST = '127.0.0.1';
const PAGE = path.join(__dirname, 'review-ui.html');
const GEN = path.join(__dirname, 'gen-ceo-video-review.js');
const DECK_CLI = path.join(__dirname, 'review-deck.js');
const DECK_RUBRICS = path.join(review.RUBRICS_DIR, 'decks');
const OUT_DIR = path.dirname(doc('reviews', 'Deck_Review.md'));
const DUMP_DIR = path.join(os.tmpdir(), 'mcg-deck-review');
const KEY_FILE = process.env.MCG_ANTHROPIC_KEY_FILE || path.join(os.homedir(), 'OneDrive - QlikTech Inc', 'Desktop', 'claude api key.txt');
const TOKEN_FILE = process.env.MCG_CLAUDE_TOKEN_FILE || path.join(os.homedir(), '.claude', 'mcg-review-token.txt');
// What the headless reviewer may do without a prompt: read anything, write its
// verdicts and memo, and run node (the gates, the dump, the facts) plus the shell
// reads it uses to verify a .docx. Nothing else is pre-approved.
const AGENT_TOOLS = ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash(node:*)', 'Bash(cd:*)', 'Bash(unzip:*)', 'Bash(ls:*)', 'Bash(cat:*)', 'Bash(grep:*)', 'Bash(head:*)', 'Bash(tail:*)', 'Bash(date:*)'];
const MAX_LINES = 6000;

const readJson = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const mtimeMs = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return null; } };
const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());
const today = () => new Date().toISOString().slice(0, 10);
const firstMatch = (file, re) => { try { const m = fs.readFileSync(file, 'utf8').match(re); return m && m[0]; } catch { return null; } };
const apiKey = () => firstMatch(KEY_FILE, /sk-ant-[A-Za-z0-9_-]+/);
const agentToken = () => firstMatch(TOKEN_FILE, /sk-ant-[A-Za-z0-9_-]+/);

function httpError(code, message) { const e = new Error(message); e.status = code; return e; }

// ─── Board ──────────────────────────────────────────────────────────────────

function pillarCard(s) {
  const e = s.entry;
  return {
    kind: 'pillar', key: s.key, label: `${review.PILLAR_LABEL[s.key]} video`,
    rubric: `${s.rubric.id} v${s.rubric.version}`, title: s.rubric.title, story: s.rubric.story,
    persona: { name: s.persona.name, role: s.persona.role },
    status: s.status, problems: s.pre.problems, warnings: s.pre.warnings, fingerprint: s.fp.short,
    probes: s.probes.map(({ id, verdict, gap }) => ({ id, verdict, gap })),
    last: e && {
      reviewed: e.reviewed, bar: e.bar, score: e.score, openMusts: e.open_musts || [], shouldMissed: e.should_missed || [],
      reviewer: e.reviewer, verdicts: e.verdicts, outputs: (e.outputs || []).filter((p) => fs.existsSync(p)),
    },
  };
}

function ingrid(personas) {
  const p = personas.ingrid || { name: 'Ingrid van der Berg', role: 'Chief Executive Officer' };
  return { name: p.name, role: p.role };
}

function ceoCard(state, statuses, personas) {
  const c = state.ceo;
  const fp = new Map(statuses.map((s) => [s.key, s.fp.hash]));
  const fresh = !!c && c.rulings.every((r) => fp.get(r.pillar) === r.fingerprint);
  return {
    kind: 'judge', key: 'ceo', label: 'Executive ruling', persona: ingrid(personas),
    status: !c ? 'never' : fresh ? 'fresh' : 'stale',
    waiting: statuses.filter((s) => s.status !== 'fresh').map((s) => s.key),
    last: c && {
      reviewed: c.ruled,
      rulings: c.rulings.map(({ pillar, ruling, reason, bar, score }) => ({ pillar, label: review.PILLAR_LABEL[pillar], ruling, reason, bar, score })),
      memo: c.memo, rulingsFile: c.rulings_file, outputs: (c.outputs || []).filter((p) => fs.existsSync(p)),
    },
  };
}

function deckRubrics() {
  if (!fs.existsSync(DECK_RUBRICS)) return [];
  return fs.readdirSync(DECK_RUBRICS).filter((f) => f.endsWith('.json')).sort()
    .map((f) => ({ key: f.slice(0, -5), path: path.join(DECK_RUBRICS, f), rubric: readJson(path.join(DECK_RUBRICS, f)) }))
    .filter((d) => d.rubric);
}

/** Newest recorded verdicts for a deck rubric: 2026-10-26b sorts after 2026-10-26. */
function latestDeckVerdicts(key) {
  const files = fs.readdirSync(review.STATE_DIR).filter((f) => f.endsWith(`-${key}-deck.verdicts.json`)).sort();
  return files.length ? path.join(review.STATE_DIR, files[files.length - 1]) : null;
}

/** The published deck review, read back from its markdown header. */
function publishedDeck(key) {
  const md = doc('reviews', `Deck_Review_${key}.md`);
  if (!fs.existsSync(md)) return null;
  const text = fs.readFileSync(md, 'utf8');
  const field = (name) => (text.match(new RegExp(`^\\*\\*${name}:\\*\\*\\s*(.+)$`, 'm')) || [])[1] || '';
  const bar = field('Bar');
  return {
    md, docx: md.replace(/\.md$/, '.docx'), date: field('Date'), bar: (bar.match(/^(PASS|FAIL)/) || [])[1] || '',
    barLine: bar, score: field('Score').replace(/\s*—.*$/, ''), material: field('Material reviewed'), mtime: mtimeMs(md),
  };
}

function deckCard(d, chosen, personas) {
  const { key, rubric } = d;
  const persona = personas[rubric.persona] || { name: rubric.persona, role: '' };
  const def = deckPath(rubric.deck);
  const file = chosen ? path.resolve(chosen) : def;
  const pub = publishedDeck(key);
  const dm = mtimeMs(file);
  const latest = latestDeckVerdicts(key);
  const data = latest && readJson(latest);
  const newer = pub && [dm, mtimeMs(d.path)].some((t) => t != null && t > pub.mtime);
  return {
    kind: 'deck', key, label: `${review.PILLAR_LABEL[rubric.pillar] || rubric.pillar} deck`,
    rubric: `${rubric.id} v${rubric.version}`, title: rubric.title, slides: rubric.slides,
    persona: { name: persona.name, role: persona.role },
    deck: { file, default: def, exists: dm != null, modified: iso(dm) },
    status: dm == null ? 'missing' : !pub ? 'never' : newer ? 'stale' : 'fresh',
    last: pub && {
      reviewed: pub.date, bar: pub.bar, score: pub.score, barLine: pub.barLine, material: pub.material,
      openMusts: data ? review.computeBar(rubric, data.verdicts).openMusts : [],
      verdicts: latest && review.relPath(latest), outputs: [pub.md, pub.docx].filter((p) => fs.existsSync(p)),
    },
  };
}

function board(query) {
  const personas = review.loadPersonas();
  const statuses = review.PILLARS.map((k) => review.pillarStatus(k, personas));
  const state = review.readState();
  return {
    checkout: REPO_ROOT, series: review.SERIES_DIR, outputs: OUT_DIR, warning: review.checkoutWarning(state),
    pillars: statuses.map(pillarCard),
    ceo: ceoCard(state, statuses, personas),
    decks: deckRubrics().map((d) => deckCard(d, query.get(`deck.${d.key}`), personas)),
  };
}

// ─── Detail ─────────────────────────────────────────────────────────────────

function criteriaRows(rubric, byId) {
  return review.criteriaOf(rubric).map((c) => {
    const v = byId.get(c.id) || { verdict: 'missed', evidence: '', gap: 'no verdict recorded', ref: '' };
    return { id: c.id, name: c.name, weight: c.weight, judge_on: c.judge_on, expect: c.expect, verdict: v.verdict, evidence: v.evidence || '', gap: v.gap || '', ref: v.ref || '' };
  });
}

function pillarDetail(key) {
  if (!review.PILLARS.includes(key)) throw httpError(404, `no pillar "${key}"`);
  const s = review.pillarStatus(key);
  const file = s.entry && review.resolveRecorded(s.entry.verdicts);
  const data = (file && readJson(file)) || { verdicts: [] };
  const recorded = (s.entry && s.entry.probes) || {};
  // Auto criteria are measured, never supplied: show the verdict recorded with the review.
  const probes = s.probes.map((p) => ({ id: p.id, verdict: recorded[p.id] || p.verdict, evidence: `Measured by the ${p.probe} probe. ${p.facts.join(' ')}`, gap: p.gap || '', ref: '' }));
  const all = [...data.verdicts, ...probes];
  return {
    kind: 'pillar', key, label: `${review.PILLAR_LABEL[key]} video`, title: s.rubric.title, rubric: `${s.rubric.id} v${s.rubric.version}`,
    persona: { name: s.persona.name, role: s.persona.role },
    reviewed: s.entry && s.entry.reviewed, reviewer: data.reviewer || (s.entry && s.entry.reviewer) || '',
    note: data.note || '', scope: data.scope || '', verdictsFile: file && review.relPath(file),
    bar: review.computeBar(s.rubric, all), criteria: criteriaRows(s.rubric, new Map(all.map((v) => [v.id, v]))),
    outputs: ((s.entry && s.entry.outputs) || []).filter((p) => fs.existsSync(p)),
  };
}

function judgeDetail() {
  const personas = review.loadPersonas();
  const c = review.readState().ceo;
  if (!c) throw httpError(404, 'no ruling recorded yet');
  const memoFile = c.memo && review.resolveRecorded(c.memo);
  return {
    kind: 'judge', key: 'ceo', label: 'Executive ruling', title: 'Ruling on the pillar video reviews', persona: ingrid(personas),
    reviewed: c.ruled, rulings: c.rulings.map((r) => ({ ...r, label: review.PILLAR_LABEL[r.pillar] })),
    memo: memoFile && fs.existsSync(memoFile) ? fs.readFileSync(memoFile, 'utf8') : '', memoFile: c.memo,
    outputs: (c.outputs || []).filter((p) => fs.existsSync(p)),
  };
}

function deckDetail(key) {
  const d = deckRubrics().find((x) => x.key === key);
  if (!d) throw httpError(404, `no deck rubric "${key}"`);
  const personas = review.loadPersonas();
  const persona = personas[d.rubric.persona] || { name: d.rubric.persona, role: '' };
  const file = latestDeckVerdicts(key);
  const data = (file && readJson(file)) || { verdicts: [] };
  const pub = publishedDeck(key);
  return {
    kind: 'deck', key, label: `${review.PILLAR_LABEL[d.rubric.pillar] || d.rubric.pillar} deck`, title: d.rubric.title, rubric: `${d.rubric.id} v${d.rubric.version}`,
    persona: { name: persona.name, role: persona.role }, reviewed: pub && pub.date, reviewer: data.reviewer || '',
    note: data.note || '', scope: data.scope || '', verdictsFile: file && review.relPath(file),
    bar: review.computeBar(d.rubric, data.verdicts), criteria: criteriaRows(d.rubric, new Map(data.verdicts.map((v) => [v.id, v]))),
    outputs: pub ? [pub.md, pub.docx].filter((p) => fs.existsSync(p)) : [],
  };
}

// ─── Engines ────────────────────────────────────────────────────────────────

/** The reviewer must use its own Claude login, not the session that started this server. */
function agentEnv() {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!/^(CLAUDE|ANTHROPIC)/i.test(k)) env[k] = v;
  const token = agentToken();
  if (token) env.CLAUDE_CODE_OAUTH_TOKEN = token;
  return env;
}

function apiEnv() {
  const env = { ...process.env, ANTHROPIC_API_KEY: apiKey() };
  delete env.ANTHROPIC_BASE_URL; // a Claude Code shell points this at its own proxy
  delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
}

const engines = { agent: { state: 'checking' }, api: { state: 'checking' } };
let checking = null;

async function checkApi() {
  const k = apiKey();
  if (!k) return { ok: false, detail: `no key found in ${KEY_FILE}` };
  try {
    const r = await fetch('https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': k, 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(20000) });
    if (r.ok) return { ok: true, detail: `key accepted (${k.slice(0, 10)}…)` };
    const body = await r.json().catch(() => ({}));
    return { ok: false, detail: `api.anthropic.com answered ${r.status} "${(body.error && body.error.message) || r.statusText}" for the key in ${KEY_FILE} (it starts ${k.slice(0, 10)}…; Console API keys start sk-ant-api03-)` };
  } catch (e) {
    return { ok: false, detail: `could not reach api.anthropic.com: ${e.message}` };
  }
}

function checkAgent() {
  return new Promise((resolve) => {
    let out = '';
    let child;
    try {
      child = spawn('claude', ['-p', '--output-format', 'json'], { cwd: REPO_ROOT, env: agentEnv(), windowsHide: true });
    } catch (e) {
      resolve({ ok: false, detail: `claude CLI not found: ${e.message}` });
      return;
    }
    const timer = setTimeout(() => child.kill(), 90000);
    child.stdout.on('data', (c) => { out += c; });
    child.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, detail: `claude CLI not found: ${e.message}` }); });
    child.on('close', () => {
      clearTimeout(timer);
      let r = null;
      try { r = JSON.parse(out.trim().split('\n').pop()); } catch { /* reported below */ }
      if (!r) { resolve({ ok: false, detail: `no answer from claude -p${out ? `: ${out.slice(0, 160)}` : ''}` }); return; }
      if (r.is_error) { resolve({ ok: false, login: /authenticat|expired|log ?in|401/i.test(r.result || ''), detail: r.result || 'claude -p failed' }); return; }
      resolve({ ok: true, detail: `Claude Code login works${agentToken() ? ` (token from ${TOKEN_FILE})` : ''}` });
    });
    child.stdin.end('Reply with exactly: ok');
  });
}

function checkEngines() {
  if (checking) return checking;
  engines.agent = { ...engines.agent, state: 'checking' };
  engines.api = { ...engines.api, state: 'checking' };
  checking = Promise.all([checkAgent(), checkApi()]).then(([agent, api]) => {
    const at = new Date().toISOString();
    engines.agent = { ...agent, state: agent.ok ? 'ready' : 'down', checked: at, tokenFile: TOKEN_FILE };
    engines.api = { ...api, state: api.ok ? 'ready' : 'down', checked: at, keyFile: KEY_FILE };
  }).finally(() => { checking = null; });
  return checking;
}

// ─── Jobs ───────────────────────────────────────────────────────────────────

const jobs = [];
const queue = [];
let running = null;
let seq = 0;

function summary(j) {
  const { id, kind, key, engine, action, label, deck, status, created, started, ended, exit, published } = j;
  return { id, kind, key, engine, action, label, deck, status, created, started, ended, exit, published, lines: j.lines.length };
}

function send(res, type, data) { res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`); }
function broadcast(job, type, data) { for (const res of job.clients) send(res, type, data); }

function say(job, text, cls = 'out') {
  for (const t of String(text).replace(/\r/g, '').split('\n')) {
    if (job.lines.length >= MAX_LINES) return;
    const line = { text: t, cls };
    job.lines.push(line);
    broadcast(job, 'line', line);
  }
}

function labelFor(kind, key, action, engine) {
  const what = kind === 'pillar' ? `${review.PILLAR_LABEL[key]} video` : kind === 'judge' ? 'Executive ruling' : `${key} deck`;
  const how = action === 'run' ? `AI review (${engine === 'api' ? 'Anthropic API' : 'Claude Code agent'})` : action === 'check' ? 'gate check' : 're-publish recorded';
  return `${what} · ${how}`;
}

function validate(b) {
  const kind = String(b.kind || '');
  const action = String(b.action || 'run');
  const engine = action === 'run' ? String(b.engine || 'agent') : 'offline';
  if (!['pillar', 'judge', 'deck'].includes(kind)) throw httpError(400, 'kind must be pillar, judge or deck');
  if (!['run', 'replay', 'check'].includes(action)) throw httpError(400, 'action must be run, replay or check');
  if (action === 'check' && kind !== 'deck') throw httpError(400, 'a gate check is for decks; pillars re-gate when re-published');
  if (action === 'run' && !['agent', 'api'].includes(engine)) throw httpError(400, 'engine must be agent or api');
  if (action === 'run' && engine === 'api' && kind === 'deck') throw httpError(400, 'decks have no API classifier — use the Claude Code agent');
  const key = kind === 'judge' ? 'ceo' : String(b.key || '');
  if (kind === 'pillar' && !review.PILLARS.includes(key)) throw httpError(400, `pillar must be one of ${review.PILLARS.join(', ')}`);
  let deck = null;
  if (kind === 'deck') {
    const d = deckRubrics().find((x) => x.key === key);
    if (!d) throw httpError(400, `no deck rubric "${key}"`);
    deck = path.resolve(String(b.deck || deckPath(d.rubric.deck)));
    if (!/\.pptx$/i.test(deck) || !fs.existsSync(deck)) throw httpError(400, `deck file not found: ${deck}`);
  }
  const busy = [...queue, ...(running ? [running] : [])].find((j) => j.kind === kind && j.key === key);
  if (busy) throw httpError(409, `${busy.label} is already ${busy.status}`);
  return { kind, key, action, engine, deck, label: labelFor(kind, key, action, engine) };
}

function enqueue(spec) {
  const job = { id: String(++seq), ...spec, status: 'queued', created: new Date().toISOString(), lines: [], clients: new Set() };
  jobs.push(job);
  queue.push(job);
  while (jobs.length > 60 && jobs[0].ended) jobs.shift();
  pump();
  return job;
}

function pump() {
  if (running || !queue.length) return;
  running = queue.shift();
  const job = running;
  try {
    start(job);
  } catch (e) {
    say(job, e.message, 'err');
    finish(job, 1);
  }
}

function finish(job, code) {
  if (job.ended) return;
  job.ended = new Date().toISOString();
  job.exit = code;
  job.status = job.cancelled ? 'cancelled' : code === 0 ? 'done' : 'failed';
  delete job.child;
  broadcast(job, 'status', summary(job));
  broadcast(job, 'end', summary(job));
  for (const res of job.clients) res.end();
  job.clients.clear();
  if (running === job) running = null;
  pump();
}

function agentPrompt(job, date) {
  const head = 'You are running headless from the review app (generators/review-ui.js): nobody can answer a question, so decide, and say what you decided in the report.';
  const keep = (name) => `Write the verdicts as generators/rubrics/reviews/${name}; if that file already exists, put a letter after the date (${date}b, ${date}c …) — never overwrite a recorded review.`;
  if (job.kind === 'pillar') {
    return [`Mode: pillar. Pillar: ${job.key}. Today is ${date} (UTC).`, head,
      `Score the ${review.PILLAR_LABEL[job.key]} video against generators/rubrics/pillars/${job.key}.json as its persona. ${keep(`${date}-${job.key}.verdicts.json`)} Publish through the gate, verify the .docx, and report.`].join('\n\n');
  }
  if (job.kind === 'judge') {
    return [`Mode: judge. Rule on every pillar. Today is ${date} (UTC).`, head,
      `Write the rulings and the memo as generators/rubrics/reviews/${date}-ceo.rulings.json and ${date}-ceo.memo.md; if either exists, put a letter after the date (${date}b …) — never overwrite a recorded ruling. Publish through the gate, verify the .docx, and report.`].join('\n\n');
  }
  return [`Mode: deck. Rubric: ${job.key}. Deck: ${job.deck}. Today is ${date} (UTC).`, head,
    `Score the slides against generators/rubrics/decks/${job.key}.json as its persona. ${keep(`${date}-${job.key}-deck.verdicts.json`)} Gate it with --dry-run, publish, verify the .docx, and report.`].join('\n\n');
}

/** What a job runs: the agent, the API generator, or a gate over recorded verdicts. */
function plan(job) {
  const show = (args) => `node ${args.map((a) => (path.isAbsolute(a) ? `"${review.relPath(a)}"` : a)).join(' ')}`;
  if (job.action === 'run' && job.engine === 'agent') {
    fs.mkdirSync(DUMP_DIR, { recursive: true });
    const dirs = [review.SERIES_DIR, OUT_DIR, DUMP_DIR, ...(job.deck ? [path.dirname(job.deck)] : [])];
    return {
      exe: 'claude',
      args: ['-p', '--agent', 'rubric-reviewer', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits', '--add-dir', ...dirs, '--allowedTools', ...AGENT_TOOLS],
      stdin: agentPrompt(job, today()), env: agentEnv(), parse: 'agent',
      show: `claude -p --agent rubric-reviewer   (${job.kind} mode${job.deck ? `, ${path.basename(job.deck)}` : ''})`,
    };
  }
  if (job.action === 'run' && job.engine === 'api') {
    if (!apiKey()) throw new Error(`no API key in ${KEY_FILE}`);
    const args = [GEN, ...(job.kind === 'pillar' ? ['--pillar', job.key] : ['--judge'])];
    return { exe: process.execPath, args, env: apiEnv(), parse: 'text', show: show(args) };
  }
  const state = review.readState();
  let args;
  if (job.kind === 'pillar') {
    const e = state.pillars[job.key];
    if (!e) throw new Error(`${job.key} has no recorded review to re-publish`);
    args = [GEN, '--pillar', job.key, '--verdicts', review.resolveRecorded(e.verdicts)];
  } else if (job.kind === 'judge') {
    const c = state.ceo;
    if (!c || !c.memo || !c.rulings_file) throw new Error('no recorded ruling to re-publish');
    args = [GEN, '--judge', '--memo', review.resolveRecorded(c.memo), '--rulings', review.resolveRecorded(c.rulings_file)];
    if (c.pillars && c.pillars.length === 1) args.push('--pillar', c.pillars[0]);
  } else {
    const v = latestDeckVerdicts(job.key);
    if (!v) throw new Error(`${job.key} has no recorded verdicts`);
    args = [DECK_CLI, '--rubric', job.key, '--verdicts', v, '--deck', job.deck];
    if (job.action === 'check') args.push('--dry-run');
  }
  return { exe: process.execPath, args, env: process.env, parse: 'text', show: show(args) };
}

function outputFile(job) {
  if (job.kind === 'pillar') return doc('reviews', `Pillar_Review_${job.key}.md`);
  if (job.kind === 'judge') return doc('reviews', 'CEO_Pillar_Review.md');
  return doc('reviews', `Deck_Review_${job.key}.md`);
}

function resultText(content) {
  if (typeof content === 'string') return content;
  return (content || []).map((c) => (c.type === 'text' ? c.text : c.type === 'image' ? '[image]' : '')).filter(Boolean).join('\n');
}

function clip(text, n) {
  const lines = String(text).replace(/\s+$/, '').split('\n');
  return lines.length <= n ? lines.join('\n') : `${lines.slice(0, n).join('\n')}\n… (+${lines.length - n} lines)`;
}

function toolLine(b) {
  const i = b.input || {};
  const rel = (p) => (p ? review.relPath(p) : '');
  switch (b.name) {
    case 'Bash': return `$ ${i.command}`;
    case 'PowerShell': return `PS> ${i.command}`;
    case 'Read': return `read   ${rel(i.file_path)}`;
    case 'Write': return `write  ${rel(i.file_path)}`;
    case 'Edit': return `edit   ${rel(i.file_path)}`;
    case 'Glob': return `glob   ${i.pattern}${i.path ? `  in ${rel(i.path)}` : ''}`;
    case 'Grep': return `grep   ${i.pattern}${i.path ? `  in ${rel(i.path)}` : ''}`;
    default: return `${b.name} ${JSON.stringify(i).slice(0, 200)}`;
  }
}

const LOGIN_HINT = `Claude Code's login on this machine is not usable from here. Run \`claude auth login\` in a terminal — or run \`claude setup-token\` and save the token to ${TOKEN_FILE} — then press Re-check.`;

function agentEvent(job, line) {
  let ev;
  try { ev = JSON.parse(line); } catch { if (line.trim()) say(job, line, 'out'); return; }
  if (ev.type === 'system' && ev.subtype === 'init') { say(job, `session ${ev.session_id} · model ${ev.model} · permissions ${ev.permissionMode || '?'}`, 'meta'); return; }
  const blocks = (ev.message && Array.isArray(ev.message.content)) ? ev.message.content : [];
  if (ev.type === 'assistant') {
    for (const b of blocks) {
      if (b.type === 'text' && b.text.trim()) say(job, b.text.trim(), 'say');
      if (b.type === 'tool_use') say(job, toolLine(b), 'tool');
    }
    return;
  }
  if (ev.type === 'user') {
    for (const b of blocks) {
      if (b.type !== 'tool_result') continue;
      const t = resultText(b.content);
      if (t.trim()) say(job, clip(t, 8), b.is_error ? 'err' : 'out');
    }
    return;
  }
  if (ev.type === 'result') {
    job.agentError = !!ev.is_error;
    const mins = ev.duration_ms ? (ev.duration_ms / 60000).toFixed(1) : '?';
    const cost = typeof ev.total_cost_usd === 'number' ? `, $${ev.total_cost_usd.toFixed(2)}` : '';
    say(job, `${ev.is_error ? 'agent failed' : 'agent finished'} — ${ev.num_turns} turn(s), ${mins} min${cost}`, ev.is_error ? 'err' : 'meta');
    for (const d of ev.permission_denials || []) say(job, `permission denied: ${d.tool_name} ${JSON.stringify(d.tool_input || {}).slice(0, 200)}`, 'err');
    if (ev.is_error && ev.result) say(job, ev.result, 'err');
    if (ev.is_error && /authenticat|expired|log ?in|401/i.test(ev.result || '')) say(job, LOGIN_HINT, 'err');
  }
}

function textClass(line) {
  if (/^\s*✗|^error|FAILED|refused/i.test(line)) return 'err';
  if (/^\s*✓/.test(line)) return 'ok';
  if (/^\$ /.test(line)) return 'cmd';
  return 'out';
}

function start(job) {
  job.status = 'running';
  job.started = new Date().toISOString();
  broadcast(job, 'status', summary(job));
  if (job.kind === 'judge' && job.action === 'run') {
    const waiting = review.PILLARS.filter((k) => review.pillarStatus(k).status !== 'fresh');
    if (waiting.length) throw new Error(`the ruling needs every pillar review current — not yet: ${waiting.join(', ')}`);
  }
  const p = plan(job);
  const out = outputFile(job);
  const before = mtimeMs(out);
  say(job, `$ ${p.show}`, 'cmd');
  const child = spawn(p.exe, p.args, { cwd: REPO_ROOT, env: p.env, windowsHide: true });
  job.child = child;
  child.stdin.on('error', () => { /* the child may exit before reading stdin */ });
  child.stdin.end(p.stdin || '');
  let buf = '';
  const handle = (line) => { if (p.parse === 'agent') agentEvent(job, line); else if (line.trim()) say(job, line, textClass(line)); };
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) { handle(buf.slice(0, i)); buf = buf.slice(i + 1); }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (c) => c.split(/\r?\n/).filter((l) => l.trim()).forEach((l) => say(job, l, textClass(l) === 'ok' ? 'ok' : 'err')));
  child.on('error', (e) => { say(job, `could not start ${p.exe}: ${e.message}`, 'err'); finish(job, 1); });
  child.on('close', (code) => {
    if (job.ended) return;
    if (buf.trim()) handle(buf);
    const after = mtimeMs(out);
    job.published = job.action !== 'check' && after != null && (before == null || after > before);
    if (job.action !== 'check') say(job, job.published ? `published: ${out}` : 'nothing was published', job.published ? 'ok' : 'meta');
    finish(job, code === 0 && !job.agentError ? 0 : (code || 1));
  });
}

function cancel(id) {
  const job = jobs.find((j) => j.id === id);
  if (!job) throw httpError(404, `no run ${id}`);
  if (job.status === 'queued') {
    queue.splice(queue.indexOf(job), 1);
    job.cancelled = true;
    say(job, 'cancelled before it started', 'meta');
    finish(job, 1);
  } else if (job.child) {
    job.cancelled = true;
    say(job, 'cancelling…', 'meta');
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(job.child.pid), '/T', '/F'], { windowsHide: true });
    else job.child.kill('SIGTERM');
  }
  return summary(job);
}

function runDue(engine) {
  const personas = review.loadPersonas();
  const statuses = review.PILLARS.map((k) => review.pillarStatus(k, personas));
  const made = statuses.filter((s) => s.status === 'stale' || s.status === 'never')
    .map((s) => enqueue(validate({ kind: 'pillar', key: s.key, engine, action: 'run' })));
  const ceo = ceoCard(review.readState(), statuses, personas);
  if (made.length || ceo.status !== 'fresh') made.push(enqueue(validate({ kind: 'judge', engine, action: 'run' })));
  return made;
}

// ─── HTTP ───────────────────────────────────────────────────────────────────

function json(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch { reject(httpError(400, 'body is not JSON')); } });
    req.on('error', reject);
  });
}

/** Only review outputs are served or opened. */
function allowedFile(p) {
  const abs = path.resolve(String(p || ''));
  const roots = [OUT_DIR, review.STATE_DIR].map((d) => `${path.resolve(d).toLowerCase()}${path.sep}`);
  if (!roots.some((r) => abs.toLowerCase().startsWith(r)) || !/\.(md|docx|json)$/i.test(abs)) throw httpError(403, 'only review outputs can be opened');
  if (!fs.existsSync(abs)) throw httpError(404, `${abs} does not exist`);
  return abs;
}

function events(req, res, id) {
  const job = jobs.find((j) => j.id === id);
  if (!job) throw httpError(404, `no run ${id}`);
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive' });
  send(res, 'status', summary(job));
  for (const l of job.lines) send(res, 'line', l);
  if (job.ended) { send(res, 'end', summary(job)); res.end(); return; }
  job.clients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => { clearInterval(ping); job.clients.delete(res); });
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  // A custom header forces a CORS preflight, which this server never answers: no other site can start a run.
  if (req.method === 'POST' && req.headers['x-review-ui'] !== '1') throw httpError(403, 'missing x-review-ui header');
  const r = `${req.method} ${url.pathname}`;
  let m;
  if (r === 'GET /') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(fs.readFileSync(PAGE));
    return;
  }
  if (r === 'GET /api/board') return json(res, 200, board(url.searchParams));
  if (r === 'GET /api/detail') {
    const kind = url.searchParams.get('kind');
    const key = url.searchParams.get('key');
    if (kind === 'pillar') return json(res, 200, pillarDetail(key));
    if (kind === 'judge') return json(res, 200, judgeDetail());
    if (kind === 'deck') return json(res, 200, deckDetail(key));
    throw httpError(400, 'kind must be pillar, judge or deck');
  }
  if (r === 'GET /api/engines') return json(res, 200, engines);
  if (r === 'POST /api/engines/check') { await checkEngines(); return json(res, 200, engines); }
  if (r === 'GET /api/jobs') return json(res, 200, jobs.map(summary).reverse());
  if (r === 'POST /api/jobs') return json(res, 201, summary(enqueue(validate(await readBody(req)))));
  if (r === 'POST /api/run-due') { const b = await readBody(req); return json(res, 201, runDue(b.engine === 'api' ? 'api' : 'agent').map(summary)); }
  if (req.method === 'GET' && (m = url.pathname.match(/^\/api\/jobs\/(\d+)\/events$/))) return events(req, res, m[1]);
  if (req.method === 'POST' && (m = url.pathname.match(/^\/api\/jobs\/(\d+)\/cancel$/))) return json(res, 200, cancel(m[1]));
  if (r === 'GET /api/file') {
    const abs = allowedFile(url.searchParams.get('p'));
    const isDocx = /\.docx$/i.test(abs);
    res.writeHead(200, {
      'content-type': isDocx ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain; charset=utf-8',
      'content-disposition': `${isDocx ? 'attachment' : 'inline'}; filename="${path.basename(abs)}"`,
      'cache-control': 'no-store',
    });
    fs.createReadStream(abs).pipe(res);
    return;
  }
  if (r === 'POST /api/open') {
    const abs = allowedFile((await readBody(req)).p);
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '""', abs], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [abs], { detached: true, stdio: 'ignore' }).unref();
    return json(res, 200, { opened: abs });
  }
  throw httpError(404, `${r} — not found`);
}

const server = http.createServer((req, res) => {
  route(req, res).catch((e) => {
    if (res.headersSent) { res.end(); return; }
    json(res, typeof e.status === 'number' ? e.status : 500, { error: e.message });
  });
});

server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `port ${PORT} is in use — pass --port <n>` : e.message);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Qlarity AI assessment — http://localhost:${PORT}`);
  console.log(`checkout ${REPO_ROOT}`);
  console.log(`series   ${review.SERIES_DIR}`);
  console.log(`outputs  ${OUT_DIR}`);
  checkEngines().then(() => {
    for (const [k, e] of Object.entries(engines)) console.log(`engine ${k.padEnd(5)} ${e.ok ? 'ready' : 'not ready'} — ${e.detail}`);
  });
});
