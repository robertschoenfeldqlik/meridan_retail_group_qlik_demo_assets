#!/usr/bin/env node
/**
 * review-pillars.js — which pillar video reviews are due, and the listener.
 * ============================================================================
 * Each pillar video (02 Integration, 03 Governance, 04 Analytics, 05 AI) is
 * reviewed against its own rubric by the executive who owns that area, then
 * Ingrid rules on all of them (gen-ceo-video-review.js --pillar / --judge).
 * A review is current while the pillar's fingerprint — rubric, persona,
 * narration, deck, panels, build record, probe inputs — matches the one
 * recorded in generators/rubrics/reviews/pillar-state.json.
 *
 * No servers. The listener is two Claude Code hooks that call --hook:
 *   SessionStart  records when the session began; offers a review when stale.
 *   Stop          once per build: when a pillar's video was rebuilt during this
 *                 session and that fingerprint has not been announced, it blocks
 *                 the stop with instructions to run the reviews.
 * Off switch: MCG_REVIEW_LISTENER=off, or generators/rubrics/reviews/.listener-off.
 *
 * Usage:
 *   node generators/review-pillars.js [--status]            # table; exit 3 if any stale
 *   node generators/review-pillars.js --facts --pillar <p> [--json]
 *   node generators/review-pillars.js --hook < hook-input.json
 *   node generators/review-pillars.js --run [--pillar <p>]  # API: stale pillars, then the judge
 *   node generators/review-pillars.js --replay              # republish recorded reviews offline
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const review = require('./lib/rubric-review');

const GEN = path.join(__dirname, 'gen-ceo-video-review.js');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const posix = (p) => p.split(path.sep).join('/');

const STATE_LABEL = {
  fresh: 'fresh',
  stale: 'STALE (inputs changed since review)',
  never: 'STALE (never reviewed)',
  rebuild: 'REBUILD FIRST',
};

function allStatuses() {
  const personas = review.loadPersonas();
  return review.PILLARS.map((k) => review.pillarStatus(k, personas));
}

function probeSummary(s) {
  return s.probes.map((p) => `${p.id} ${p.verdict}`).join(', ') || '—';
}

function ceoLine(state, statuses) {
  if (!state.ceo) return 'CEO ruling: none recorded';
  const fresh = state.ceo.rulings.every((r) => {
    const s = statuses.find((x) => x.key === r.pillar);
    return s && s.fp.hash === r.fingerprint;
  });
  const rows = state.ceo.rulings.map((r) => `${r.pillar} ${r.ruling.toUpperCase()} (bar ${r.bar})`).join(', ');
  return `CEO ruling ${String(state.ceo.ruled).slice(0, 10)}: ${rows}${fresh ? '' : ' — STALE, inputs changed since'}`;
}

// ─── --status ───────────────────────────────────────────────────────────────

function status() {
  const statuses = allStatuses();
  const state = review.readState();
  const warn = review.checkoutWarning(state);
  console.log(`Pillar reviews — checkout ${review.REPO_ROOT}`);
  console.log(`series: ${review.SERIES_DIR}`);
  console.log(`state : ${review.relPath(review.STATE_PATH)}${fs.existsSync(review.STATE_PATH) ? '' : ' (none yet)'}`);
  if (warn) console.log(warn);
  console.log('');
  const rows = statuses.map((s) => [
    s.key,
    s.persona.name,
    s.rubric.story,
    probeSummary(s),
    s.fp.short,
    s.entry ? `${String(s.entry.reviewed).slice(0, 10)} ${s.entry.bar} ${s.entry.score}` : 'never',
    STATE_LABEL[s.status],
  ]);
  const head = ['Pillar', 'Reviewer', 'Story', 'Probes', 'Fingerprint', 'Last review', 'State'];
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (r) => `| ${r.map((c, i) => String(c).padEnd(w[i])).join(' | ')} |`;
  console.log(line(head));
  console.log(`|${w.map((n) => '-'.repeat(n + 2)).join('|')}|`);
  rows.forEach((r) => console.log(line(r)));
  statuses.filter((s) => s.status === 'rebuild').forEach((s) => console.log(`\n${s.key}: rebuild first — ${s.pre.problems.join('; ')}`));
  statuses.forEach((s) => s.pre.warnings.forEach((x) => console.log(`warning: ${x}`)));
  console.log(`\n${ceoLine(state, statuses)}`);
  const stale = statuses.filter((s) => s.status !== 'fresh');
  if (stale.length) {
    console.log(`\n${stale.length} of ${statuses.length} pillar review(s) due. Facts: node generators/review-pillars.js --facts --pillar <pillar>`);
    process.exitCode = 3;
  }
}

// ─── --facts ────────────────────────────────────────────────────────────────

function facts() {
  const key = String(val('--pillar', '') || '').toLowerCase();
  if (!review.PILLARS.includes(key)) {
    console.error(`--facts needs --pillar <${review.PILLARS.join('|')}>`);
    process.exit(2);
  }
  const s = review.pillarStatus(key);
  const map = review.sceneMap(s.rubric.story);
  const crit = review.criteriaOf(s.rubric);
  if (has('--json')) {
    process.stdout.write(`${JSON.stringify({
      pillar: key,
      rubric: { id: s.rubric.id, version: s.rubric.version, path: review.relPath(s.rubric._path) },
      persona: { key: s.rubric.persona, name: s.persona.name, role: s.persona.role },
      story: s.rubric.story,
      also: s.rubric.also,
      series: review.SERIES_DIR,
      status: s.status,
      precondition: s.pre,
      probes: s.probes.map(({ id, probe, verdict, gap, facts: f }) => ({ id, probe, verdict, gap, facts: f })),
      scene_map: map,
      fingerprint: s.fp,
      last_review: s.entry,
      to_judge: crit.filter((c) => c.judge_on !== 'auto').map((c) => ({ id: c.id, judge_on: c.judge_on, weight: c.weight })),
    }, null, 2)}\n`);
    return;
  }
  console.log(`pillar      : ${key} (${s.rubric.id} v${s.rubric.version}) — ${review.relPath(s.rubric._path)}`);
  console.log(`reviewer    : ${s.persona.name}, ${s.persona.role} (${s.rubric.persona})`);
  console.log(`stories     : ${s.rubric.story} (primary)${s.rubric.also.length ? ` + ${s.rubric.also.join(', ')} (also: evidence caps at partial)` : ''}`);
  console.log(`series      : ${review.SERIES_DIR}`);
  console.log(`precondition: ${s.pre.ok ? 'ok — inputs are not newer than capture/build.json' : `REBUILD FIRST — ${s.pre.problems.join('; ')}`}`);
  s.pre.warnings.forEach((x) => console.log(`warning     : ${x}`));
  console.log('\nprobes (auto criteria — computed, never supplied):');
  if (!s.probes.length) console.log('  (none)');
  s.probes.forEach((p) => {
    console.log(`  ${p.id} ${p.probe} → ${p.verdict}`);
    if (p.gap) console.log(`    gap: ${p.gap}`);
    p.facts.forEach((f) => console.log(`    - ${f}`));
  });
  console.log(`\nscene → panel map (${s.rubric.story}/deck_anim.html) — use these as screen refs:`);
  if (!map.length) console.log('  (no deck)');
  map.forEach((m) => console.log(`  ${m.ref}${m.flag ? `   [${m.flag}]` : ''}`));
  console.log('\ncriteria to judge:');
  crit.filter((c) => c.judge_on !== 'auto').forEach((c) => console.log(`  ${c.id.padEnd(7)} ${c.weight.padEnd(6)} ${c.judge_on.padEnd(9)} ${c.name}`));
  console.log(`\nfingerprint : ${s.fp.hash}`);
  s.fp.parts.forEach((p) => console.log(`  ${p.label.padEnd(44)} ${p.sha}  ${p.bytes} bytes`));
  console.log(`\nlast review : ${s.entry ? `${s.entry.reviewed} — ${s.entry.bar} ${s.entry.score}, verdicts ${s.entry.verdicts}` : 'never'}`);
  console.log(`state       : ${STATE_LABEL[s.status]}`);
}

// ─── --hook ─────────────────────────────────────────────────────────────────

function readStdin() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function dueText(s) {
  const probes = s.probes.map((p) => `${p.id} ${p.verdict}${p.gap ? ` (${p.gap})` : ''}`).join('; ') || 'no probes';
  return `${s.key} — ${s.persona.name}, ${s.rubric.story}, fingerprint ${s.fp.short}, ${STATE_LABEL[s.status]}. Probes: ${probes}`;
}

function commandsFor(keys) {
  const repo = posix(review.REPO_ROOT);
  const dir = posix(review.STATE_DIR);
  const date = new Date().toISOString().slice(0, 10);
  const lines = [];
  for (const k of keys) {
    lines.push(`   node "${repo}/generators/review-pillars.js" --facts --pillar ${k}`);
    lines.push(`   node "${repo}/generators/gen-ceo-video-review.js" --pillar ${k} --verdicts "${dir}/${date}-${k}.verdicts.json"`);
  }
  return {
    pillars: lines.join('\n'),
    judge: `   node "${repo}/generators/gen-ceo-video-review.js" --judge --memo "${dir}/${date}-ceo.memo.md" --rulings "${dir}/${date}-ceo.rulings.json"`,
    status: `   node "${repo}/generators/review-pillars.js" --status`,
    run: `   node "${repo}/generators/review-pillars.js" --run`,
  };
}

function stopMessage(due, statuses) {
  const keys = due.map((s) => s.key);
  const others = statuses.filter((s) => s.status !== 'fresh' && !keys.includes(s.key));
  const c = commandsFor(keys);
  const reason = [
    `The MCG video build in this session changed the inputs of ${keys.length === 1 ? 'one pillar' : `${keys.length} pillars`}, so the per-pillar rubric review is due (the listener announces each build once).`,
    '',
    'Due:',
    ...due.map((s) => `- ${dueText(s)}`),
    ...(others.length ? ['', `Also not current (the CEO ruling needs every pillar fresh): ${others.map((s) => `${s.key} (${STATE_LABEL[s.status]})`).join(', ')}`] : []),
    '',
    'Do this now:',
    `1. Dispatch one rubric-reviewer agent per due pillar, in parallel, in pillar mode. Agent definition: ${review.AGENT_PATH}`,
    '   Each reads its facts, writes the dated verdicts JSON, and publishes through the gate:',
    c.pillars,
    `2. When ${'`'}--status${'`'} shows every pillar fresh, dispatch one rubric-reviewer in judge mode for Ingrid's ruling:`,
    c.status,
    c.judge,
    '3. Then reply with the PASS/FAIL table: Pillar | Reviewer | Bar | Score | Ruling | Open musts.',
    '',
    'API alternative (needs ANTHROPIC_API_KEY, with ANTHROPIC_BASE_URL unset):',
    c.run,
    `To silence the listener: MCG_REVIEW_LISTENER=off, or create ${posix(review.LISTENER_OFF_PATH)}.`,
  ].join('\n');
  return {
    decision: 'block',
    reason,
    systemMessage: `MCG review listener: ${keys.join(', ')} rebuilt — pillar review requested (MCG_REVIEW_LISTENER=off to silence)`,
  };
}

function sessionStartMessage(stale) {
  const c = commandsFor(stale.filter((s) => s.status !== 'rebuild').map((s) => s.key));
  const context = [
    `MCG pillar video reviews are not current: ${stale.map((s) => `${s.key} (${STATE_LABEL[s.status]})`).join(', ')}.`,
    ...stale.map((s) => `- ${dueText(s)}${s.status === 'rebuild' ? ` — ${s.pre.problems.join('; ')}` : ''}`),
    '',
    'Offer the user a review; do not start one unprompted. When they agree: dispatch one rubric-reviewer agent per stale pillar in parallel (pillar mode), then one in judge mode.',
    `Agent definition: ${review.AGENT_PATH}`,
    'Status table:',
    c.status,
  ].join('\n');
  return {
    systemMessage: `MCG pillar reviews: ${stale.length} of ${review.PILLARS.length} not current (${stale.map((s) => s.key).join(', ')}) — ask Claude to run them, or MCG_REVIEW_LISTENER=off to silence`,
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
  };
}

function hook() {
  const input = readStdin();
  if (review.listenerOff()) return;
  const event = input.hook_event_name || '';
  const sid = String(input.session_id || 'unknown');
  const listener = review.readListener();

  if (event === 'SessionStart') {
    // resume/compact keep the session id: keep its original start, so a build
    // made before the compaction still counts as this session's build.
    if (!listener.sessions[sid]) listener.sessions[sid] = { start: new Date().toISOString(), source: input.source || null };
    review.writeListener(listener);
    const stale = allStatuses().filter((s) => s.status !== 'fresh');
    if (stale.length) process.stdout.write(`${JSON.stringify(sessionStartMessage(stale))}\n`);
    return;
  }

  if (event === 'Stop' || event === 'SubagentStop') {
    if (event === 'SubagentStop' || input.stop_hook_active) return;
    const session = listener.sessions[sid];
    if (!session) {
      // Hook installed mid-session: start counting from now.
      listener.sessions[sid] = { start: new Date().toISOString(), source: 'stop' };
      review.writeListener(listener);
      return;
    }
    const start = Date.parse(session.start);
    const statuses = allStatuses();
    const due = statuses.filter((s) => (s.status === 'stale' || s.status === 'never')
      && s.builds.some((b) => b.mtime != null && b.mtime > start)
      && listener.announced[s.key] !== s.fp.hash);
    if (!due.length) return;
    due.forEach((s) => { listener.announced[s.key] = s.fp.hash; });
    review.writeListener(listener);
    process.stdout.write(`${JSON.stringify(stopMessage(due, statuses))}\n`);
  }
}

// ─── --run / --replay ───────────────────────────────────────────────────────

function gen(args) {
  console.log(`\n$ node ${review.relPath(GEN)} ${args.join(' ')}`);
  const r = spawnSync(process.execPath, [GEN, ...args], { stdio: 'inherit' });
  return r.status === 0;
}

function run() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('--run calls the Anthropic API: set ANTHROPIC_API_KEY. Without one, dispatch the rubric-reviewer agents instead (see --status).');
    process.exit(2);
  }
  if (process.env.ANTHROPIC_BASE_URL) {
    console.error(`ANTHROPIC_BASE_URL is set (${process.env.ANTHROPIC_BASE_URL}) — a Claude Code shell points it at its own proxy, which will not serve this key. Unset it to reach api.anthropic.com, then re-run.`);
    process.exit(2);
  }
  const only = val('--pillar', null);
  const statuses = allStatuses();
  const blocked = statuses.filter((s) => s.status === 'rebuild' && (!only || s.key === only));
  blocked.forEach((s) => console.log(`${s.key}: rebuild first — ${s.pre.problems.join('; ')}`));
  const targets = only ? [only] : statuses.filter((s) => s.status === 'stale' || s.status === 'never').map((s) => s.key);
  if (only && !review.PILLARS.includes(only)) { console.error(`--pillar must be one of ${review.PILLARS.join(', ')}`); process.exit(2); }
  let ok = true;
  for (const k of targets) ok = gen(['--pillar', k]) && ok;
  if (!ok) { console.error('\nnot every pillar published — the judge needs all of them fresh'); process.exit(1); }
  if (!gen(['--judge'])) process.exit(1);
}

function replay() {
  const state = review.readState();
  const keys = Object.keys(state.pillars);
  if (!keys.length) { console.error(`nothing recorded in ${review.relPath(review.STATE_PATH)}`); process.exit(1); }
  let ok = true;
  for (const k of keys) ok = gen(['--pillar', k, '--verdicts', review.resolveRecorded(state.pillars[k].verdicts)]) && ok;
  if (state.ceo && state.ceo.memo && state.ceo.rulings_file) {
    const args = ['--judge', '--memo', review.resolveRecorded(state.ceo.memo), '--rulings', review.resolveRecorded(state.ceo.rulings_file)];
    if (state.ceo.pillars && state.ceo.pillars.length === 1) args.push('--pillar', state.ceo.pillars[0]);
    ok = gen(args) && ok;
  }
  if (!ok) process.exit(1);
}

// ─── Main ───────────────────────────────────────────────────────────────────

try {
  if (has('--hook')) {
    try { hook(); } catch (e) {
      // A broken listener must never block or break the session.
      process.stderr.write(`review-pillars --hook: ${e.message}\n`);
    }
    process.exit(0);
  } else if (has('--facts')) facts();
  else if (has('--run')) run();
  else if (has('--replay')) replay();
  else status();
} catch (e) {
  console.error('FAILED:', e.message);
  process.exit(1);
}
