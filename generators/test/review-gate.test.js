/**
 * review-gate.test.js — self-test for the video review gate and the listener.
 * ============================================================================
 *   node --test generators/test/review-gate.test.js      (npm run review:selftest)
 *
 * Every case runs against a throwaway copy of the fixtures in
 * generators/test/fixtures, with MCG_SERIES_DIR, MCG_ASSETS_DIR,
 * MCG_REVIEW_STATE_DIR and MCG_LOAD_SCRIPTS_DIR pointed at it. The real video
 * series folder has no git and is never touched; no case calls the API (the
 * Anthropic credentials are stripped from the child environment).
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const GEN = path.join(REPO, 'generators', 'gen-ceo-video-review.js');
const LISTENER = path.join(REPO, 'generators', 'review-pillars.js');
const FIX = path.join(__dirname, 'fixtures');
const LEGACY_VERDICTS = path.join(REPO, 'generators', 'rubrics', 'reviews', '2026-09-24-agentic.verdicts.json');
const LEGACY_MEMO = path.join(REPO, 'generators', 'rubrics', 'reviews', '2026-09-24-agentic.memo.md');
const GOOD_VERDICTS = path.join(FIX, 'verdicts', 'governance.good.json');

// ─── helpers ────────────────────────────────────────────────────────────────

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

/** Inputs an hour old, every capture/build.json a minute newer: a finished build. */
function settle(series) {
  const t0 = (Date.now() - 3600 * 1000) / 1000;
  const files = walk(series);
  files.forEach((f) => fs.utimesSync(f, t0, t0));
  files.filter((f) => f.endsWith(path.join('capture', 'build.json'))).forEach((f) => fs.utimesSync(f, t0 + 60, t0 + 60));
}

function sandbox(t, seriesName) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcg-review-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const d = {
    root,
    series: path.join(root, 'series'),
    assets: path.join(root, 'assets'),
    state: path.join(root, 'state'),
    work: path.join(root, 'work'),
    scripts: path.join(FIX, 'load-scripts', 'qvd'),
  };
  for (const k of ['assets', 'state', 'work']) fs.mkdirSync(d[k], { recursive: true });
  if (seriesName) {
    fs.cpSync(path.join(FIX, 'series', seriesName), d.series, { recursive: true });
    settle(d.series);
  } else {
    fs.mkdirSync(d.series, { recursive: true });
  }
  return d;
}

function run(script, args, d, { env = {}, input } = {}) {
  const childEnv = {
    ...process.env,
    MCG_SERIES_DIR: d.series,
    MCG_ASSETS_DIR: d.assets,
    MCG_REVIEW_STATE_DIR: d.state,
    MCG_LOAD_SCRIPTS_DIR: d.scripts,
  };
  for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'MCG_REVIEW_LISTENER']) delete childEnv[k];
  Object.assign(childEnv, env);
  const r = spawnSync(process.execPath, [script, ...args], { env: childEnv, input: input || '', encoding: 'utf8', cwd: d.work });
  return { code: r.status, out: r.stdout, err: r.stderr, all: `${r.stdout}\n${r.stderr}` };
}

function writeJson(d, name, obj) {
  const p = path.join(d.work, name);
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
  return p;
}

const goodVerdicts = () => JSON.parse(fs.readFileSync(GOOD_VERDICTS, 'utf8'));
const statePath = (d) => path.join(d.state, 'pillar-state.json');
const outputs = (d) => walk(d.assets);

/** Three scripts whose narration is exactly the evidence of the 2026-09-24 review. */
function legacySeries(d, verdicts) {
  const quotes = verdicts.filter((v) => v.evidence).map((v) => v.evidence);
  ['s2_integration', 's4_analytics', 's5_ai'].forEach((story, i) => {
    const mine = quotes.filter((_, j) => j % 3 === i);
    const scenes = mine.map((q, k) => `## ${k + 1} · Narrator · Scene ${k + 1}\nat: ${k}\n> ${q}\n`).join('\n');
    fs.mkdirSync(path.join(d.series, story), { recursive: true });
    fs.writeFileSync(path.join(d.series, story, 'script.md'), `---\ntitle: Legacy fixture ${story}\noutput: ${story}.mp4\n---\n\n${scenes}`, 'utf8');
  });
}

function legacyVerdicts() {
  return JSON.parse(fs.readFileSync(LEGACY_VERDICTS, 'utf8'));
}

// ─── legacy gate ────────────────────────────────────────────────────────────

test('legacy replay of the 2026-09-24 review passes against its own quotes', (t) => {
  const d = sandbox(t);
  const raw = legacyVerdicts();
  legacySeries(d, raw.verdicts);
  const r = run(GEN, ['--verdicts', LEGACY_VERDICTS, '--memo', LEGACY_MEMO], d);
  assert.equal(r.code, 0, r.all);
  assert.match(r.out, /13 covered, 6 partial, 3 missed/);
  const names = outputs(d).map((f) => path.basename(f)).sort();
  assert.deepEqual(names, ['CEO_Video_Review_agentic.docx', 'CEO_Video_Review_agentic.md']);
});

test('a broken quote in a legacy replay exits 1 and writes nothing', (t) => {
  const d = sandbox(t);
  const raw = legacyVerdicts();
  legacySeries(d, raw.verdicts);
  const v = raw.verdicts.find((x) => x.id === 'ADE-03');
  v.evidence = `${v.evidence} And the schema never sleeps.`;
  const r = run(GEN, ['--verdicts', writeJson(d, 'broken.json', raw), '--memo', LEGACY_MEMO], d);
  assert.equal(r.code, 1, r.all);
  assert.match(r.err, /not found verbatim/);
  assert.match(r.err, /ADE-03/);
  assert.deepEqual(outputs(d), []);
});

test('a duplicate id fails the legacy gate', (t) => {
  const d = sandbox(t);
  const raw = legacyVerdicts();
  legacySeries(d, raw.verdicts);
  raw.verdicts.push({ ...raw.verdicts[0] });
  const r = run(GEN, ['--verdicts', writeJson(d, 'dupe.json', raw), '--memo', LEGACY_MEMO], d);
  assert.equal(r.code, 1, r.all);
  assert.match(r.err, /duplicate ids: ADE-01/);
  assert.deepEqual(outputs(d), []);
});

test('a missed verdict that carries evidence fails the legacy gate', (t) => {
  const d = sandbox(t);
  const raw = legacyVerdicts();
  legacySeries(d, raw.verdicts);
  raw.verdicts.find((x) => x.id === 'ADE-02').evidence = raw.verdicts.find((x) => x.id === 'ADE-01').evidence;
  const r = run(GEN, ['--verdicts', writeJson(d, 'missed.json', raw), '--memo', LEGACY_MEMO], d);
  assert.equal(r.code, 1, r.all);
  assert.match(r.err, /missed verdict must carry evidence ""/);
  assert.match(r.err, /ADE-02/);
  assert.deepEqual(outputs(d), []);
});

// ─── probes ─────────────────────────────────────────────────────────────────

test('tenant_panels: the good fixture scores GOV-01 partial for the relabelled lineage panel', (t) => {
  const d = sandbox(t, 'good');
  const r = run(LISTENER, ['--facts', '--pillar', 'governance', '--json'], d);
  assert.equal(r.code, 0, r.all);
  const f = JSON.parse(r.out);
  const gov01 = f.probes.find((p) => p.id === 'GOV-01');
  assert.equal(gov01.verdict, 'partial');
  assert.match(gov01.gap, /sc3 uses dp_lineage\.png, edited after capture/);
  assert.ok(f.scene_map.some((m) => m.ref === 's3_governance#sc3:dp_lineage.png' && /edited/.test(m.flag)));
  assert.equal(f.precondition.ok, true);
});

// A fresh capture replaces the relabelled panel's bytes; the September marker can stay on disk.
// It lands before the build that used it, so the panel is dated a minute before build.json.
const recapture = (d) => {
  const panel = path.join(d.series, 'qlik_panels', 'dp_lineage.png');
  fs.writeFileSync(panel, 'a fresh capture, not the relabelled one');
  const built = fs.statSync(path.join(d.series, 's3_governance', 'capture', 'build.json')).mtimeMs / 1000 - 60;
  fs.utimesSync(panel, built, built);
};

test('tenant_panels: a fresh capture of the panel is covered even while the edit marker exists', (t) => {
  const d = sandbox(t, 'good');
  recapture(d);
  assert.ok(fs.existsSync(path.join(d.series, 'qlik_shots', '_dp_lineage_orig.png')));
  const f = JSON.parse(run(LISTENER, ['--facts', '--pillar', 'governance', '--json'], d).out);
  assert.equal(f.probes.find((p) => p.id === 'GOV-01').verdict, 'covered');
});

test('tenant_panels: the relabelled panel stays flagged when the edit marker is gone', (t) => {
  const d = sandbox(t, 'good');
  fs.rmSync(path.join(d.series, 'qlik_shots', '_dp_lineage_orig.png'));
  const f = JSON.parse(run(LISTENER, ['--facts', '--pillar', 'governance', '--json'], d).out);
  assert.equal(f.probes.find((p) => p.id === 'GOV-01').verdict, 'partial');
});

test('tenant_panels: the broken fixture gives GOV-01 missed, for each of its three faults', (t) => {
  const d = sandbox(t, 'broken');
  const r = run(LISTENER, ['--facts', '--pillar', 'governance', '--json'], d);
  assert.equal(r.code, 0, r.all);
  const gov01 = JSON.parse(r.out).probes.find((p) => p.id === 'GOV-01');
  assert.equal(gov01.verdict, 'missed');
  assert.match(gov01.gap, /sc1 embeds no qlik_panels/);
  assert.match(gov01.gap, /sc2 draws its content in the browser \(QlikApp\.app\(\)/);
  assert.match(gov01.gap, /sc3 references qlik_panels\/never_captured\.png, which does not exist/);
  assert.doesNotMatch(gov01.gap, /sc4/);
});

test('olh_live: a QVD read is missed with file:line; a warehouse read with commented QVDs is covered', (t) => {
  const d = sandbox(t, 'good');
  const bad = JSON.parse(run(LISTENER, ['--facts', '--pillar', 'integration', '--json'], d).out);
  const int02 = bad.probes.find((p) => p.id === 'INT-02');
  assert.equal(int02.verdict, 'missed');
  assert.match(int02.gap, /^app1-supply-chain\.qvs:7 reads lib:\/\/.*gold_supply_chain_health\.qvd/);
  const good = JSON.parse(run(LISTENER, ['--facts', '--pillar', 'analytics', '--json'], d, { env: { MCG_LOAD_SCRIPTS_DIR: path.join(FIX, 'load-scripts', 'live') } }).out);
  const ana02 = good.probes.find((p) => p.id === 'ANA-02');
  assert.equal(ana02.verdict, 'covered', ana02.gap);
});

// ─── pillar gate ────────────────────────────────────────────────────────────

test('pillar: good offline verdicts publish, with the bar computed in code', (t) => {
  const d = sandbox(t, 'good');
  const r = run(GEN, ['--pillar', 'governance', '--verdicts', GOOD_VERDICTS], d);
  assert.equal(r.code, 0, r.all);
  const names = outputs(d).map((f) => path.basename(f)).sort();
  assert.deepEqual(names, ['Pillar_Review_governance.docx', 'Pillar_Review_governance.md']);
  const md = fs.readFileSync(outputs(d).find((f) => f.endsWith('.md')), 'utf8');
  assert.match(md, /\*\*From:\*\* Priya Ramanathan, Chief Data Officer/);
  assert.match(md, /\*\*Bar:\*\* FAIL — 1 must\(s\) open \(GOV-01\)/);
  const st = JSON.parse(fs.readFileSync(statePath(d), 'utf8'));
  assert.equal(st.pillars.governance.bar, 'FAIL');
  assert.deepEqual(st.pillars.governance.open_musts, ['GOV-01']);
  assert.equal(st.pillars.governance.probes['GOV-01'], 'partial');
});

function pillarRejects(t, mutate, pattern) {
  const d = sandbox(t, 'good');
  const raw = goodVerdicts();
  mutate(raw, d);
  const r = run(GEN, ['--pillar', 'governance', '--verdicts', writeJson(d, 'v.json', raw)], d);
  assert.equal(r.code, 1, r.all);
  assert.match(r.err, pattern);
  assert.deepEqual(outputs(d), [], 'nothing may be written when the gate refuses');
  assert.equal(fs.existsSync(statePath(d)), false);
}

test('pillar: a quote that is not verbatim is refused', (t) => {
  pillarRejects(t, (raw) => { raw.verdicts.find((v) => v.id === 'GOV-03').evidence = 'Supply Chain Health is owned by Henrik Jansen.'; }, /not found verbatim.*GOV-03/);
});

test('pillar: covered on evidence quoted only from the also story is capped', (t) => {
  pillarRejects(t, (raw) => { raw.verdicts.find((v) => v.id === 'GOV-07').verdict = 'covered'; }, /only from an also story — at most partial: GOV-07 \(s5_ai\)/);
});

test('pillar: an auto criterion supplied as input is refused', (t) => {
  pillarRejects(t, (raw) => { raw.verdicts.push({ id: 'GOV-01', verdict: 'covered', evidence: '', gap: '' }); }, /auto criteria are measured by probes and cannot be supplied: GOV-01/);
});

test('pillar: a duplicate id is refused', (t) => {
  pillarRejects(t, (raw) => { raw.verdicts.push({ ...raw.verdicts[1] }); }, /duplicate ids: GOV-03/);
});

test('pillar: a screen verdict must reference a panel its scene embeds', (t) => {
  pillarRejects(t, (raw) => { raw.verdicts.find((v) => v.id === 'GOV-02').ref = 's3_governance#sc4:dp_products_list.png'; }, /GOV-02 \("s3_governance#sc4:dp_products_list\.png": sc4 does not embed dp_products_list\.png\)/);
});

test('pillar: inputs newer than capture/build.json mean rebuild first', (t) => {
  const d = sandbox(t, 'good');
  const script = path.join(d.series, 's3_governance', 'script.md');
  const now = Date.now() / 1000;
  fs.utimesSync(script, now, now);
  const r = run(GEN, ['--pillar', 'governance', '--verdicts', GOOD_VERDICTS], d);
  assert.equal(r.code, 1, r.all);
  assert.match(r.err, /rebuild first — governance: s3_governance\/script\.md is newer than s3_governance\/capture\/build\.json/);
  assert.deepEqual(outputs(d), []);
  assert.equal(fs.existsSync(statePath(d)), false);
});

// ─── judge ──────────────────────────────────────────────────────────────────

function reviewed(t, { edited = true } = {}) {
  const d = sandbox(t, 'good');
  if (!edited) recapture(d);
  const r = run(GEN, ['--pillar', 'governance', '--verdicts', GOOD_VERDICTS], d);
  assert.equal(r.code, 0, r.all);
  const memo = path.join(d.work, 'ceo.memo.md');
  fs.writeFileSync(memo, 'Governance is close. The lineage panel was edited after capture, and that alone keeps it from going outside.\n', 'utf8');
  return { d, memo };
}

const judge = (d, memo, rulings) => run(GEN, ['--judge', '--pillar', 'governance', '--memo', memo, '--rulings', writeJson(d, 'rulings.json', { rulings })], d);
const ceoFiles = (d) => outputs(d).filter((f) => path.basename(f).startsWith('CEO_Pillar_Review'));

test('judge: the CEO cannot pass a pillar that fails the computed bar', (t) => {
  const { d, memo } = reviewed(t);
  const r = judge(d, memo, [{ pillar: 'governance', ruling: 'pass', reason: 'Good enough.' }]);
  assert.equal(r.code, 1, r.all);
  assert.match(r.err, /the CEO cannot pass governance: it fails the computed bar \(open musts GOV-01/);
  assert.deepEqual(ceoFiles(d), []);
});

test('judge: a fail ruling on a failing pillar publishes the ruling table', (t) => {
  const { d, memo } = reviewed(t);
  const r = judge(d, memo, [{ pillar: 'governance', ruling: 'fail', reason: 'The lineage panel is not a live capture.' }]);
  assert.equal(r.code, 0, r.all);
  assert.deepEqual(ceoFiles(d).map((f) => path.basename(f)).sort(), ['CEO_Pillar_Review.docx', 'CEO_Pillar_Review.md']);
  const md = fs.readFileSync(ceoFiles(d).find((f) => f.endsWith('.md')), 'utf8');
  assert.match(md, /\| Pillar \| Reviewer \| Bar \| Score \| Ruling \| Open musts \|/);
  assert.match(md, /\| Governance \| Priya Ramanathan, Chief Data Officer \| FAIL \| [\d.]+\/\d+ \(\d+%\) \| FAIL — The lineage panel is not a live capture\. \| GOV-01 \|/);
  const st = JSON.parse(fs.readFileSync(statePath(d), 'utf8'));
  assert.equal(st.ceo.rulings[0].ruling, 'fail');
});

test('judge: a passing pillar may be held but not failed', (t) => {
  const { d, memo } = reviewed(t, { edited: false });
  const st = JSON.parse(fs.readFileSync(statePath(d), 'utf8'));
  assert.equal(st.pillars.governance.bar, 'PASS');
  const failed = judge(d, memo, [{ pillar: 'governance', ruling: 'fail', reason: 'No.' }]);
  assert.equal(failed.code, 1, failed.all);
  assert.match(failed.err, /passes the computed bar; to withhold sign-off rule it "hold"/);
  const held = judge(d, memo, [{ pillar: 'governance', ruling: 'hold', reason: 'Regulatory traceability is still unsaid.' }]);
  assert.equal(held.code, 0, held.all);
});

test('judge: refuses when the pillar verdicts are stale against the fingerprint', (t) => {
  const { d, memo } = reviewed(t);
  const script = path.join(d.series, 's3_governance', 'script.md');
  fs.appendFileSync(script, '\n## 5 · Narrator · Added later\nat: 50\n> A scene nobody has reviewed.\n', 'utf8');
  const r = judge(d, memo, [{ pillar: 'governance', ruling: 'fail', reason: 'x' }]);
  assert.equal(r.code, 1, r.all);
  assert.match(r.err, /stale — inputs changed since the review/);
  assert.deepEqual(ceoFiles(d), []);
});

// ─── pure functions ─────────────────────────────────────────────────────────

test('computeBar and gateRulings: the bar is code, and rulings only move one way', () => {
  const review = require('../lib/rubric-review');
  const rubric = { pass: { must: 'covered', should_missed_max: 1 }, dimensions: [{ criteria: [
    { id: 'X-01', weight: 'must' }, { id: 'X-02', weight: 'must' }, { id: 'X-03', weight: 'should' }, { id: 'X-04', weight: 'should' },
  ] }] };
  const bar = review.computeBar(rubric, [
    { id: 'X-01', verdict: 'covered' }, { id: 'X-02', verdict: 'partial' }, { id: 'X-03', verdict: 'missed' }, { id: 'X-04', verdict: 'covered' },
  ]);
  assert.equal(bar.pass, false);
  assert.deepEqual(bar.openMusts, ['X-02']);
  assert.equal(bar.score, '6.5/10 (65%)');
  const ok = review.computeBar(rubric, [
    { id: 'X-01', verdict: 'covered' }, { id: 'X-02', verdict: 'covered' }, { id: 'X-03', verdict: 'missed' }, { id: 'X-04', verdict: 'partial' },
  ]);
  assert.equal(ok.pass, true);
  const twoMissed = review.computeBar(rubric, [
    { id: 'X-01', verdict: 'covered' }, { id: 'X-02', verdict: 'covered' }, { id: 'X-03', verdict: 'missed' }, { id: 'X-04', verdict: 'missed' },
  ]);
  assert.equal(twoMissed.pass, false);

  const bars = { a: bar, b: ok };
  const g = (rulings) => review.gateRulings({ bars, rulings, pillars: ['a', 'b'] }).map((e) => e.code);
  assert.deepEqual(g([{ pillar: 'a', ruling: 'fail' }, { pillar: 'b', ruling: 'pass' }]), []);
  assert.deepEqual(g([{ pillar: 'a', ruling: 'pass' }, { pillar: 'b', ruling: 'pass' }]), ['pass-failing']);
  assert.deepEqual(g([{ pillar: 'a', ruling: 'hold', reason: 'x' }, { pillar: 'b', ruling: 'pass' }]), ['hold-failing']);
  assert.deepEqual(g([{ pillar: 'a', ruling: 'fail' }, { pillar: 'b', ruling: 'hold', reason: '' }]), ['hold-reason']);
  assert.deepEqual(g([{ pillar: 'a', ruling: 'fail' }]), ['missing']);
  assert.deepEqual(g([{ pillar: 'a', ruling: 'fail' }, { pillar: 'a', ruling: 'fail' }, { pillar: 'b', ruling: 'pass' }]), ['duplicate']);
});

// ─── listener hook ──────────────────────────────────────────────────────────

const hookIn = (event, extra = {}) => JSON.stringify({ hook_event_name: event, session_id: 'sess-1', cwd: REPO, ...extra });

/** A session that has started, then rebuilt the governance video. */
function rebuiltSession(t) {
  const d = sandbox(t, 'good');
  const start = run(LISTENER, ['--hook'], d, { input: hookIn('SessionStart', { source: 'startup' }) });
  assert.equal(start.code, 0, start.all);
  const future = Date.now() / 1000 + 30;
  fs.utimesSync(path.join(d.series, 's3_governance', 'capture', 'build.json'), future, future);
  return { d, start };
}

test('hook SessionStart: records the session and offers the review without blocking', (t) => {
  const { d, start } = rebuiltSession(t);
  const out = JSON.parse(start.out);
  assert.equal(out.decision, undefined);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(out.hookSpecificOutput.additionalContext, /governance/);
  assert.match(out.hookSpecificOutput.additionalContext, /Offer the user a review/);
  assert.match(out.systemMessage, /MCG pillar reviews/);
  const listener = JSON.parse(fs.readFileSync(path.join(d.state, '.listener.json'), 'utf8'));
  assert.ok(listener.sessions['sess-1'].start);
});

test('hook Stop: announces a pillar rebuilt this session once, then stays silent', (t) => {
  const { d } = rebuiltSession(t);
  const first = run(LISTENER, ['--hook'], d, { input: hookIn('Stop', { stop_hook_active: false }) });
  assert.equal(first.code, 0, first.all);
  const out = JSON.parse(first.out);
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /- governance — Priya Ramanathan, s3_governance/);
  assert.match(out.reason, /GOV-01 partial/);
  assert.ok(out.reason.includes(path.join(REPO, '.claude', 'agents', 'rubric-reviewer.md')), 'reason names the agent definition by absolute path');
  assert.match(out.reason, /gen-ceo-video-review\.js" --pillar governance --verdicts/);
  assert.match(out.reason, /reply with the PASS\/FAIL table/);
  assert.match(out.systemMessage, /governance rebuilt/);
  const second = run(LISTENER, ['--hook'], d, { input: hookIn('Stop', { stop_hook_active: false }) });
  assert.equal(second.code, 0, second.all);
  assert.equal(second.out.trim(), '');
});

test('hook Stop: silent while stop_hook_active is true', (t) => {
  const { d } = rebuiltSession(t);
  const active = run(LISTENER, ['--hook'], d, { input: hookIn('Stop', { stop_hook_active: true }) });
  assert.equal(active.code, 0, active.all);
  assert.equal(active.out.trim(), '');
  const control = run(LISTENER, ['--hook'], d, { input: hookIn('Stop', { stop_hook_active: false }) });
  assert.equal(JSON.parse(control.out).decision, 'block', 'the same session announces once the flag clears');
});

test('hook Stop: silent with the .listener-off file or MCG_REVIEW_LISTENER=off', (t) => {
  const { d } = rebuiltSession(t);
  const off = path.join(d.state, '.listener-off');
  fs.writeFileSync(off, '');
  assert.equal(run(LISTENER, ['--hook'], d, { input: hookIn('Stop') }).out.trim(), '');
  fs.rmSync(off);
  assert.equal(run(LISTENER, ['--hook'], d, { input: hookIn('Stop'), env: { MCG_REVIEW_LISTENER: 'off' } }).out.trim(), '');
  assert.equal(JSON.parse(run(LISTENER, ['--hook'], d, { input: hookIn('Stop') }).out).decision, 'block', 'and announces once switched back on');
});

test('hook: unreadable input never fails the session', (t) => {
  const d = sandbox(t, 'good');
  const r = run(LISTENER, ['--hook'], d, { input: '{not json' });
  assert.equal(r.code, 0, r.all);
  assert.equal(r.out.trim(), '');
});
