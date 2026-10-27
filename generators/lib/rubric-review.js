/**
 * rubric-review.js — the deterministic half of the video reviews.
 * ============================================================================
 * Everything here runs without a model: finding the series folder, reading the
 * narration and the decks, the probes that measure what a reviewer must not be
 * asked to judge, the gate that refuses a review whose verdicts do not hold up,
 * the pass bar, the per-pillar fingerprint and the state the listener keeps.
 *
 * gen-ceo-video-review.js (the publisher) and review-pillars.js (status, facts,
 * the Claude Code hook) both read from here, so a check cannot drift between the
 * tool that publishes a review and the tool that says whether one is due.
 *
 * Environment overrides, used by the self-test so it never touches real files:
 *   MCG_SERIES_DIR        the video series folder (it has no git — never write to it)
 *   MCG_REVIEW_STATE_DIR  where pillar-state.json / .listener.json live
 *   MCG_LOAD_SCRIPTS_DIR  the app load scripts the olh_live probe reads
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { REPO_ROOT } = require('./asset-paths');

// ─── Where things are ───────────────────────────────────────────────────────

// The video sources live beside the repo, not inside it — the series folder is
// its own project, and it gets moved (it has already been archived once). Try
// the places it is known to live rather than hardcoding one, and let
// MCG_SERIES_DIR override when it lands somewhere else again.
const SERIES_CANDIDATES = [
  path.resolve(REPO_ROOT, '..', 'MCG Video Voiceover', 'series'),              // repo and videos side by side
  path.resolve(REPO_ROOT, '..', 'MCG Demo', 'MCG Video Voiceover', 'series'),  // videos inside MCG Demo, repo beside it
  path.resolve(REPO_ROOT, '..', 'Archive', 'MCG Video Voiceover', 'series'),
];
const SERIES_DIR = process.env.MCG_SERIES_DIR
  ? path.resolve(process.env.MCG_SERIES_DIR)
  : (SERIES_CANDIDATES.find((d) => fs.existsSync(d)) || SERIES_CANDIDATES[0]);

const RUBRICS_DIR = path.join(__dirname, '..', 'rubrics');
const PILLAR_DIR = path.join(RUBRICS_DIR, 'pillars');
const PERSONAS_PATH = path.join(RUBRICS_DIR, 'personas.json');
const STATE_DIR = process.env.MCG_REVIEW_STATE_DIR
  ? path.resolve(process.env.MCG_REVIEW_STATE_DIR)
  : path.join(RUBRICS_DIR, 'reviews');
const STATE_PATH = path.join(STATE_DIR, 'pillar-state.json');       // tracked: what was reviewed, against what
const LISTENER_PATH = path.join(STATE_DIR, '.listener.json');       // gitignored: per-session hook memory
const LISTENER_OFF_PATH = path.join(STATE_DIR, '.listener-off');    // gitignored: off switch
const LOAD_SCRIPTS_DIR = process.env.MCG_LOAD_SCRIPTS_DIR
  ? path.resolve(process.env.MCG_LOAD_SCRIPTS_DIR)
  : path.join(REPO_ROOT, 'deploy', 'apps', 'load-scripts');
const AGENT_PATH = path.join(REPO_ROOT, '.claude', 'agents', 'rubric-reviewer.md');

const PILLARS = ['integration', 'governance', 'analytics', 'ai'];
const PILLAR_LABEL = { integration: 'Integration', governance: 'Governance', analytics: 'Analytics', ai: 'AI' };

/** Repo-relative with forward slashes when inside the repo, absolute otherwise. */
function relPath(p) {
  const abs = path.resolve(p);
  const rel = path.relative(REPO_ROOT, abs);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel.split(path.sep).join('/') : abs;
}
function resolveRecorded(p) {
  return path.isAbsolute(p) ? p : path.join(REPO_ROOT, p);
}
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const mtime = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return null; } };

// ─── Narration ──────────────────────────────────────────────────────────────

/**
 * Pull the narration out of a story's script.md.
 *
 * The format is recut.py's: a YAML front-matter block, then one `## n · Speaker
 * · Title` heading per scene, an `at:` offset, and the narration as a blockquote.
 * Anything else in the file is a comment and is not spoken, so it is not a
 * talking point and must not be scored.
 */
function readScript(story) {
  const p = path.join(SERIES_DIR, story, 'script.md');
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf8');

  const titleMatch = raw.match(/^title:\s*(.+)$/m);
  const outputMatch = raw.match(/^output:\s*(.+)$/m);

  const scenes = [];
  const sceneRe = /^##\s+(.+)$/gm;
  let m;
  const heads = [];
  while ((m = sceneRe.exec(raw)) !== null) heads.push({ title: m[1].trim(), at: m.index + m[0].length });
  heads.forEach((h, i) => {
    const body = raw.slice(h.at, i + 1 < heads.length ? heads[i + 1].at : raw.length);
    const offset = (body.match(/^at:\s*([\d.]+)/m) || [])[1];
    // Blockquote lines are the spoken words; join them into one paragraph.
    const spoken = body
      .split('\n')
      .filter((l) => l.trimStart().startsWith('>'))
      .map((l) => l.replace(/^\s*>\s?/, '').trim())
      .join(' ')
      .trim();
    if (spoken) scenes.push({ scene: h.title, at: offset ? Number(offset) : null, narration: spoken });
  });

  return {
    story,
    title: titleMatch ? titleMatch[1].trim() : story,
    output: outputMatch ? outputMatch[1].trim() : null,
    path: p,
    scenes,
  };
}

/** The normalisation the evidence check has always used: whitespace and smart quotes. */
const norm = (s) => s.replace(/\s+/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();

/** One normalised string of everything a script says, for substring checks. */
function flatNarration(script) {
  return script ? norm(script.scenes.map((x) => x.narration).join(' ')) : '';
}

// ─── Decks ──────────────────────────────────────────────────────────────────

// Panels known to have been edited after capture. With `sha256`, the deck's
// qlik_panels copy is flagged only while its bytes are one of the known edited
// images, so a fresh capture clears the flag even if the marker (the untouched
// original kept in qlik_shots) is still on disk. Without it, the marker alone decides.
const EDITED_PANELS = [
  {
    panel: 'dp_lineage.png',
    marker: path.join('qlik_shots', '_dp_lineage_orig.png'),
    sha256: [
      '7acb530c62625de0978fe8c7118a641abb5b25e80c462f498bcd852674d3bc85', // qlik_panels copy used until 2026-10-23
      'b816a9d7d5bde73041051759326be7f200ba6097525ec1623623a67b1f4ab82a', // qlik_shots/dp_lineage.png, the relabelled shot
    ],
    why: 'an Open Lakehouse label was painted on after capture (relabel_lineage.py)',
  },
];

function editedPanels() {
  const out = new Map();
  for (const e of EDITED_PANELS) {
    if (e.sha256) {
      const p = path.join(SERIES_DIR, 'qlik_panels', e.panel);
      if (fs.existsSync(p) && e.sha256.includes(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'))) out.set(e.panel, e);
    } else if (fs.existsSync(path.join(SERIES_DIR, e.marker))) {
      out.set(e.panel, e);
    }
  }
  return out;
}

const DRAWN_RE = /QlikApp\.app\s*\(|barSvg\s*\(/g;
const lineAt = (text, idx) => text.slice(0, idx).split('\n').length;
const blank = (m) => m.replace(/[^\n]/g, ' ');

/**
 * Parse deck_anim.html into its scenes and the qlik_panels PNGs each embeds.
 * A scene is a `<div class="scene…" id="scN">` block, running to the next scene
 * or, for the last one, to the first <script> after it. Drawn content —
 * QlikApp.app() / barSvg() — is attributed to a scene when it sits in the
 * scene's markup or the deck script targets an element inside the scene.
 */
function readDeck(story) {
  const p = path.join(SERIES_DIR, story, 'deck_anim.html');
  if (!fs.existsSync(p)) return null;
  const html = fs.readFileSync(p, 'utf8');
  const clean = html.replace(/<!--[\s\S]*?-->/g, blank);   // same offsets, comments gone

  const starts = [];
  const tagRe = /<div\b[^>]*>/gi;
  let m;
  while ((m = tagRe.exec(clean)) !== null) {
    const tag = m[0];
    if (!/\bclass\s*=\s*"scene(?:\s[^"]*)?"/i.test(tag)) continue;
    const id = (tag.match(/\bid\s*=\s*"([^"]+)"/i) || [])[1] || `scene${starts.length + 1}`;
    starts.push({ id, at: m.index });
  }

  const scenes = starts.map((s, i) => {
    let end = i + 1 < starts.length ? starts[i + 1].at : clean.length;
    if (i + 1 === starts.length) {
      const sc = clean.indexOf('<script', s.at);
      if (sc >= 0) end = sc;
    }
    const block = clean.slice(s.at, end);
    const names = [...new Set([...block.matchAll(/qlik_panels\/([A-Za-z0-9_.\- ]+?\.png)/gi)].map((x) => x[1]))];
    const drawn = [...block.matchAll(DRAWN_RE)].map((x) => `${x[0].replace(/\s*\($/, '(')}) at deck_anim.html:${lineAt(clean, s.at + x.index)}`);
    const elementIds = [...block.matchAll(/\bid\s*=\s*"([^"]+)"/gi)].map((x) => x[1]);
    return {
      id: s.id,
      n: Number((s.id.match(/(\d+)/) || [])[1]) || i + 1,
      line: lineAt(clean, s.at),
      panels: names.map((name) => ({ name, exists: fs.existsSync(path.join(SERIES_DIR, 'qlik_panels', name)) })),
      drawn,
      elementIds,
    };
  });

  // Inline deck script: attribute each drawing call to the scene whose element
  // it fills. A call no scene can be tied to is still drawn content.
  const unattributedDrawn = [];
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  while ((m = scriptRe.exec(clean)) !== null) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    const bodyAt = m.index + m[0].indexOf('>') + 1;
    const body = m[2].replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:])\/\/[^\n]*/g, (x, pre) => pre + blank(x.slice(pre.length)));
    for (const d of body.matchAll(DRAWN_RE)) {
      const lineStart = body.lastIndexOf('\n', d.index) + 1;
      const lineEnd = body.indexOf('\n', d.index);
      const text = body.slice(lineStart, lineEnd < 0 ? body.length : lineEnd);
      const refs = [...text.matchAll(/\bS\(\s*['"]([\w-]+)['"]\s*\)|getElementById\(\s*['"]([\w-]+)['"]\s*\)|querySelector(?:All)?\(\s*['"]#([\w-]+)/g)]
        .map((r) => r[1] || r[2] || r[3]);
      const call = `${d[0].replace(/\s*\($/, '(')})`;
      const where = `deck_anim.html:${lineAt(clean, bodyAt + d.index)}`;
      const owners = scenes.filter((sc) => refs.some((r) => r === sc.id || sc.elementIds.includes(r)));
      if (owners.length) owners.forEach((sc) => sc.drawn.push(`${call} at ${where}`));
      else unattributedDrawn.push({ call, where });
    }
  }

  return { story, path: p, scenes, unattributedDrawn };
}

/** "s3_governance#sc5:dp_lineage.png" lines, one per embedded panel, with edit flags. */
function sceneMap(story) {
  const deck = readDeck(story);
  if (!deck) return [];
  const edited = editedPanels();
  const lines = [];
  for (const sc of deck.scenes) {
    if (!sc.panels.length) lines.push({ ref: `${story}#${sc.id}`, scene: sc.id, panel: null, flag: 'no tenant panel' });
    for (const p of sc.panels) {
      const flags = [];
      if (!p.exists) flags.push('file missing');
      if (edited.has(p.name)) flags.push('edited after capture');
      lines.push({ ref: `${story}#${sc.id}:${p.name}`, scene: sc.id, panel: p.name, flag: flags.join(', ') });
    }
    if (sc.drawn.length) lines.push({ ref: `${story}#${sc.id}`, scene: sc.id, panel: null, flag: `drawn: ${sc.drawn.join('; ')}` });
  }
  return lines;
}

// ─── Probes ─────────────────────────────────────────────────────────────────

/** Every scene embeds a real qlik_panels PNG; drawn content fails, an edited panel is partial. */
function probeTenantPanels(story) {
  const deckPath = path.join(SERIES_DIR, story, 'deck_anim.html');
  const deck = readDeck(story);
  if (!deck) {
    return { probe: 'tenant_panels', verdict: 'missed', gap: `${story}/deck_anim.html not found`, facts: [], inputs: [deckPath] };
  }
  const edited = editedPanels();
  const problems = [];
  const edits = [];
  const facts = [];
  if (!deck.scenes.length) problems.push('no <div class="scene"> blocks found in deck_anim.html');
  for (const sc of deck.scenes) {
    if (!sc.panels.length) problems.push(`${sc.id} embeds no qlik_panels/*.png`);
    for (const p of sc.panels) {
      if (!p.exists) problems.push(`${sc.id} references qlik_panels/${p.name}, which does not exist`);
      if (edited.has(p.name)) {
        const e = edited.get(p.name);
        edits.push(`${sc.id} uses ${p.name}, edited after capture — ${e.why} (${e.marker.split(path.sep).join('/')} exists)`);
      }
    }
    for (const d of sc.drawn) problems.push(`${sc.id} draws its content in the browser (${d})`);
    facts.push(`${sc.id}: ${sc.panels.length ? sc.panels.map((p) => p.name + (p.exists ? '' : ' [missing]') + (edited.has(p.name) ? ' [edited]' : '')).join(', ') : '(no panel)'}${sc.drawn.length ? ' [drawn]' : ''}`);
  }
  for (const u of deck.unattributedDrawn) problems.push(`${u.where} draws content with ${u.call} outside any one scene`);
  const distinct = new Set(deck.scenes.flatMap((sc) => sc.panels.map((p) => p.name)));
  facts.unshift(`${deck.scenes.length} scenes, ${distinct.size} distinct panels in ${story}/deck_anim.html`);

  const verdict = problems.length ? 'missed' : edits.length ? 'partial' : 'covered';
  const gap = problems.length ? problems.join('; ') : edits.join('; ');
  const inputs = [deckPath, ...[...distinct].map((n) => path.join(SERIES_DIR, 'qlik_panels', n))];
  return { probe: 'tenant_panels', verdict, gap, facts, inputs };
}

function olhFiles() {
  if (!fs.existsSync(LOAD_SCRIPTS_DIR)) return [];
  return fs.readdirSync(LOAD_SCRIPTS_DIR)
    .filter((f) => /^(app1-.*|app2-.*|lakehouse-ingest)\.qvs$/i.test(f))
    .sort()
    .map((f) => path.join(LOAD_SCRIPTS_DIR, f));
}

/** Blank out Qlik comments (// line, block, REM) while keeping every offset and line. */
function stripQlikComments(text) {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, blank);
  // `//` starts a comment unless it is the scheme separator of lib:// or http://.
  out = out.split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, (x, pre) => pre + blank(x.slice(pre.length)))).join('\n');
  out = out.replace(/(^|[;\n])([ \t]*REM\b[^;]*;)/gi, (x, pre, rem) => pre + blank(rem));
  return out;
}

/** The app load scripts read the warehouse/lakehouse over SQL, not lib:// QVD or CSV files. */
function probeOlhLive() {
  const files = olhFiles();
  const apps = files.filter((f) => /^app[12]-/i.test(path.basename(f)));
  if (!apps.length) {
    return { probe: 'olh_live', verdict: 'missed', gap: `no app1-*.qvs / app2-*.qvs load scripts in ${relPath(LOAD_SCRIPTS_DIR)}`, facts: [], inputs: files };
  }
  const offending = [];
  const facts = [];
  const sqlOk = new Map();
  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8');
    const text = stripQlikComments(raw);
    const reads = [];
    const fromRe = /\bFROM\s*(\[\s*lib:\/\/[^\]]*\]|'lib:\/\/[^']*'|"lib:\/\/[^"]*"|lib:\/\/[^\s;]+)/gi;
    let m;
    while ((m = fromRe.exec(text)) !== null) {
      const target = m[1].replace(/^[[\s'"]+|[\]\s'"]+$/g, '');
      const ext = (target.match(/\.(qvd|csv)$/i) || [])[1];
      if (ext) reads.push({ file: path.basename(f), line: lineAt(text, m.index), target, ext: ext.toLowerCase() });
    }
    const connect = /\bLIB\s+CONNECT\s+TO\b/i.test(text);
    const ident = '(?:"[^"\\n]+"|\\[[^\\]\\n]+\\]|[A-Za-z_][\\w$]*)';
    const sqlRe = new RegExp(`\\bSELECT\\b[^;]*?\\bFROM\\s+(${ident}(?:\\.${ident})+)`, 'gi');
    const tables = [...text.matchAll(sqlRe)].map((x) => x[1]).filter((t) => !/lib:\/\//i.test(t));
    sqlOk.set(f, connect && tables.length > 0);
    offending.push(...reads);
    const q = reads.filter((r) => r.ext === 'qvd').length;
    const c = reads.filter((r) => r.ext === 'csv').length;
    facts.push(`${path.basename(f)}: ${reads.length} lib:// file read(s) (${q} .qvd, ${c} .csv), LIB CONNECT ${connect ? 'yes' : 'no'}, ${tables.length} SQL table read(s)${tables.length ? ` (${[...new Set(tables)].slice(0, 4).join(', ')})` : ''}`);
  }
  const appsWithoutSql = apps.filter((f) => !sqlOk.get(f)).map((f) => path.basename(f));
  let verdict = 'covered';
  let gap = '';
  if (offending.length || appsWithoutSql.length) {
    verdict = 'missed';
    const parts = [];
    if (offending.length) {
      const first = offending[0];
      parts.push(`${first.file}:${first.line} reads ${first.target} — a .${first.ext} file, not the lakehouse or warehouse`);
      parts.push(`${offending.length} active lib:// .qvd/.csv read(s) across ${new Set(offending.map((o) => o.file)).size} script(s)`);
    }
    if (appsWithoutSql.length) parts.push(`no LIB CONNECT + SELECT FROM schema.table in ${appsWithoutSql.join(', ')}`);
    gap = parts.join('; ');
  }
  return { probe: 'olh_live', verdict, gap, facts, inputs: files };
}

const PROBES = { tenant_panels: (rubric) => probeTenantPanels(rubric.story), olh_live: () => probeOlhLive() };

// ─── Rubrics and personas ───────────────────────────────────────────────────

const JUDGE_ON = new Set(['narration', 'screen', 'auto']);
const WEIGHTS = new Set(['must', 'should', 'nice']);

function loadPillar(key) {
  if (!PILLARS.includes(key)) throw new Error(`unknown pillar "${key}" — one of: ${PILLARS.join(', ')}`);
  const p = path.join(PILLAR_DIR, `${key}.json`);
  if (!fs.existsSync(p)) throw new Error(`pillar rubric missing: ${relPath(p)}`);
  const raw = fs.readFileSync(p, 'utf8');
  const r = JSON.parse(raw);
  const where = relPath(p);
  for (const f of ['id', 'version', 'pillar', 'story', 'persona']) if (!r[f]) throw new Error(`${where}: missing "${f}"`);
  if (r.pillar !== key) throw new Error(`${where}: pillar is "${r.pillar}", expected "${key}"`);
  if (!Array.isArray(r.also)) throw new Error(`${where}: "also" must be an array`);
  if (!r.pass || r.pass.must !== 'covered' || typeof r.pass.should_missed_max !== 'number') throw new Error(`${where}: pass must be {must:"covered", should_missed_max:<n>}`);
  if (!Array.isArray(r.dimensions) || r.dimensions.length !== 1) throw new Error(`${where}: exactly one dimension expected`);
  const seen = new Set();
  for (const c of r.dimensions[0].criteria || []) {
    if (seen.has(c.id)) throw new Error(`${where}: duplicate criterion id ${c.id}`);
    seen.add(c.id);
    if (!c.id.startsWith(`${r.id}-`)) throw new Error(`${where}: ${c.id} does not carry the ${r.id}- prefix`);
    if (!WEIGHTS.has(c.weight)) throw new Error(`${where}: ${c.id} weight "${c.weight}"`);
    if (!JUDGE_ON.has(c.judge_on)) throw new Error(`${where}: ${c.id} judge_on "${c.judge_on}"`);
    if (c.judge_on === 'auto' && !PROBES[c.probe]) throw new Error(`${where}: ${c.id} names unknown probe "${c.probe}"`);
  }
  if (!seen.size) throw new Error(`${where}: no criteria`);
  Object.defineProperty(r, '_raw', { value: raw, enumerable: false });
  Object.defineProperty(r, '_path', { value: p, enumerable: false });
  return r;
}

/** All four rubrics; `tolerant` skips a broken file instead of throwing (legacy mode). */
function loadPillars({ tolerant = false } = {}) {
  const out = {};
  for (const k of PILLARS) {
    try { out[k] = loadPillar(k); } catch (e) { if (!tolerant) throw e; }
  }
  return out;
}

function loadPersonas() {
  return JSON.parse(fs.readFileSync(PERSONAS_PATH, 'utf8')).personas;
}

const criteriaOf = (rubric) => rubric.dimensions.flatMap((d) => d.criteria);
const storiesOf = (rubric) => [rubric.story, ...rubric.also];

/** Run every auto criterion's probe. Returns verdict-shaped rows plus the facts behind them. */
function runProbes(rubric) {
  const cache = new Map();
  return criteriaOf(rubric).filter((c) => c.judge_on === 'auto').map((c) => {
    if (!cache.has(c.probe)) cache.set(c.probe, PROBES[c.probe](rubric));
    const r = cache.get(c.probe);
    return { id: c.id, verdict: r.verdict, evidence: '', gap: r.gap, ref: '', probe: c.probe, facts: r.facts, inputs: r.inputs };
  });
}

// ─── Bar ────────────────────────────────────────────────────────────────────

const POINTS = { must: 3, should: 2, nice: 1 };
const CREDIT = { covered: 1, partial: 0.5, missed: 0 };

/**
 * The pass bar, computed in code: every must criterion (auto ones included) at
 * the rubric's `pass.must` verdict, and no more than `pass.should_missed_max`
 * should criteria missed. The score is informational only.
 */
function computeBar(rubric, verdicts) {
  const by = new Map(verdicts.map((v) => [v.id, v]));
  const pass = rubric.pass || { must: 'covered', should_missed_max: 1 };
  let points = 0;
  let max = 0;
  const openMusts = [];
  const shouldMissed = [];
  const counts = { covered: 0, partial: 0, missed: 0 };
  for (const c of criteriaOf(rubric)) {
    const verdict = by.has(c.id) ? by.get(c.id).verdict : 'missed';
    counts[verdict] += 1;
    const w = POINTS[c.weight] || 0;
    max += w;
    points += w * (CREDIT[verdict] || 0);
    if (c.weight === 'must' && verdict !== pass.must) openMusts.push(c.id);
    if (c.weight === 'should' && verdict === 'missed') shouldMissed.push(c.id);
  }
  const ok = openMusts.length === 0 && shouldMissed.length <= pass.should_missed_max;
  const pct = max ? Math.round((100 * points) / max) : 0;
  const pts = Number.isInteger(points) ? String(points) : points.toFixed(1);
  return {
    pass: ok,
    label: ok ? 'PASS' : 'FAIL',
    openMusts,
    shouldMissed,
    shouldMissedMax: pass.should_missed_max,
    points,
    max,
    pct,
    score: `${pts}/${max} (${pct}%)`,
    counts,
  };
}

// ─── Gate ───────────────────────────────────────────────────────────────────

const err = (code, ids, message) => ({ code, ids, message });

/**
 * Check a set of verdicts before anything is published. Returns a list of
 * errors (empty when the verdicts hold up); callers throw, or re-ask once.
 *
 * mode 'legacy': criteria = every criterion scored; narration = one flat string.
 * mode 'pillar': criteria = the rubric's criteria (auto ones are probe-owned);
 *   narrationByStory = { story: flat string }, primary = the pillar's story,
 *   deck = readDeck(primary) for screen refs.
 */
function gateVerdicts({ mode, criteria, verdicts, narration, narrationByStory, primary, deck }) {
  const errors = [];
  const autoIds = new Set(mode === 'pillar' ? criteria.filter((c) => c.judge_on === 'auto').map((c) => c.id) : []);
  const scored = criteria.filter((c) => !autoIds.has(c.id));
  const byId = new Map(criteria.map((c) => [c.id, c]));

  const suppliedAuto = verdicts.filter((v) => autoIds.has(v.id)).map((v) => v.id);
  if (suppliedAuto.length) errors.push(err('auto', suppliedAuto, `auto criteria are measured by probes and cannot be supplied: ${suppliedAuto.join(', ')}`));

  // The classifier must return every criterion. A short list means a silent
  // miss, and a review built on it would understate the gaps.
  const known = new Set(scored.map((c) => c.id));
  const returned = new Set(verdicts.map((v) => v.id));
  const absent = [...known].filter((id) => !returned.has(id));
  const unknown = [...returned].filter((id) => !known.has(id) && !autoIds.has(id));
  if (absent.length) errors.push(err('skipped', absent, `classifier skipped ${absent.length} criteria: ${absent.join(', ')}`));
  if (unknown.length) errors.push(err('invented', unknown, `classifier invented ids: ${unknown.join(', ')}`));

  const counts = new Map();
  verdicts.forEach((v) => counts.set(v.id, (counts.get(v.id) || 0) + 1));
  const dupes = [...counts].filter(([, n]) => n > 1).map(([id]) => id);
  if (dupes.length) errors.push(err('duplicate', dupes, `duplicate ids: ${dupes.join(', ')}`));

  const fabricated = [];
  const emptyEvidence = [];
  const missedWithEvidence = [];
  const alsoOnly = [];
  const badRef = [];
  const screenNoEvidence = [];
  const stories = narrationByStory ? Object.keys(narrationByStory) : [];

  for (const v of verdicts) {
    const c = byId.get(v.id);
    if (!c || autoIds.has(v.id)) continue;
    const on = mode === 'pillar' ? c.judge_on : 'narration';
    const evidence = (v.evidence || '').trim();

    if (v.verdict === 'missed' && evidence) missedWithEvidence.push(v.id);

    if (on === 'narration') {
      if (v.verdict !== 'missed' && !evidence) emptyEvidence.push(v.id);
      if (evidence && v.verdict !== 'missed') {
        // Evidence must actually appear in the narration, or the verdict is a story.
        const q = norm(evidence);
        if (mode === 'pillar') {
          const found = stories.filter((s) => narrationByStory[s].includes(q));
          if (!found.length) fabricated.push(v.id);
          else if (v.verdict === 'covered' && !found.includes(primary)) alsoOnly.push(`${v.id} (${found.join(', ')})`);
        } else if (!narration.includes(q)) {
          fabricated.push(v.id);
        }
      }
    }

    if (mode === 'pillar') {
      const ref = (v.ref || '').trim();
      const needRef = on === 'screen' && v.verdict !== 'missed';
      if (needRef && !ref) badRef.push(`${v.id} (no ref)`);
      if (ref) {
        const problem = checkRef(ref, primary, deck);
        if (problem) badRef.push(`${v.id} (${problem})`);
      }
      if (on === 'screen' && v.verdict !== 'missed' && !evidence) screenNoEvidence.push(v.id);
    }
  }

  if (fabricated.length) errors.push(err('verbatim', fabricated, `${fabricated.length} evidence quote(s) not found verbatim in the narration — ${fabricated.join(', ')}`));
  if (emptyEvidence.length) errors.push(err('empty', emptyEvidence, `covered/partial narration verdicts need a verbatim evidence quote — ${emptyEvidence.join(', ')}`));
  if (missedWithEvidence.length) errors.push(err('missed-evidence', missedWithEvidence, `a missed verdict must carry evidence "" — ${missedWithEvidence.join(', ')}`));
  if (alsoOnly.length) errors.push(err('also-cap', alsoOnly.map((s) => s.split(' ')[0]), `covered on evidence quoted only from an also story — at most partial: ${alsoOnly.join(', ')}`));
  if (badRef.length) errors.push(err('ref', badRef.map((s) => s.split(' ')[0]), `screen verdicts need a ref to a panel embedded in a ${primary} scene, as ${primary}#scN:panel.png — ${badRef.join(', ')}`));
  if (screenNoEvidence.length) errors.push(err('screen-evidence', screenNoEvidence, `covered/partial screen verdicts need evidence describing what the referenced panel shows — ${screenNoEvidence.join(', ')}`));
  return errors;
}

/** "story#scN:panel.png" must name a scene of the primary deck that embeds that panel. */
function checkRef(ref, primary, deck) {
  const m = ref.match(/^([\w-]+)#([\w-]+)(?::(?:\.\.\/)?(?:qlik_panels\/)?(.+))?$/);
  if (!m) return `"${ref}" is not story#scN:panel.png`;
  const [, story, sceneId, panel] = m;
  if (story !== primary) return `"${ref}" is not a ${primary} scene — screen criteria judge the pillar's own video`;
  if (!deck) return `no deck_anim.html for ${primary}`;
  const sc = deck.scenes.find((s) => s.id === sceneId);
  if (!sc) return `"${ref}": no scene ${sceneId} in ${primary}/deck_anim.html`;
  if (!panel) return `"${ref}" names no panel`;
  if (!sc.panels.some((p) => p.name === panel)) return `"${ref}": ${sceneId} does not embed ${panel}`;
  return null;
}

const RULINGS = new Set(['pass', 'hold', 'fail']);

/**
 * The CEO's ruling only ever moves one way. A pillar that fails the computed
 * bar is ruled "fail"; one that passes may be passed or held (with a reason).
 */
function gateRulings({ bars, rulings, pillars }) {
  const errors = [];
  const seen = new Map();
  rulings.forEach((r) => seen.set(r.pillar, (seen.get(r.pillar) || 0) + 1));
  const dupes = [...seen].filter(([, n]) => n > 1).map(([p]) => p);
  const unknown = [...seen.keys()].filter((p) => !pillars.includes(p));
  const missing = pillars.filter((p) => !seen.has(p));
  if (dupes.length) errors.push(err('duplicate', dupes, `duplicate rulings: ${dupes.join(', ')}`));
  if (unknown.length) errors.push(err('unknown', unknown, `rulings for pillars not under review: ${unknown.join(', ')}`));
  if (missing.length) errors.push(err('missing', missing, `no ruling for: ${missing.join(', ')}`));
  for (const r of rulings) {
    const bar = bars[r.pillar];
    if (!bar) continue;
    if (!RULINGS.has(r.ruling)) { errors.push(err('value', [r.pillar], `${r.pillar}: ruling must be pass, hold or fail`)); continue; }
    if (!bar.pass && r.ruling === 'pass') {
      errors.push(err('pass-failing', [r.pillar], `the CEO cannot pass ${r.pillar}: it fails the computed bar (open musts ${bar.openMusts.join(', ') || 'none'}; shoulds missed ${bar.shouldMissed.length} of max ${bar.shouldMissedMax})`));
    } else if (!bar.pass && r.ruling === 'hold') {
      errors.push(err('hold-failing', [r.pillar], `${r.pillar} fails the computed bar, so it is ruled "fail", not "hold"`));
    } else if (bar.pass && r.ruling === 'fail') {
      errors.push(err('fail-passing', [r.pillar], `${r.pillar} passes the computed bar; to withhold sign-off rule it "hold" and say why`));
    } else if (r.ruling === 'hold' && !(r.reason || '').trim()) {
      errors.push(err('hold-reason', [r.pillar], `${r.pillar}: a hold needs a reason`));
    }
  }
  return errors;
}

// ─── Fingerprint and precondition ───────────────────────────────────────────

function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

function buildPath(story) { return path.join(SERIES_DIR, story, 'capture', 'build.json'); }

/**
 * sha256 over everything a pillar verdict depends on: its rubric and persona,
 * the normalised narration of its stories, its deck and the panels the deck
 * embeds (plus edit markers), the build record and the mp4's size/mtime, and the
 * inputs of its probes. Any change means the last verdict no longer describes
 * what the video is.
 */
function fingerprint(rubric, personas) {
  const parts = [];
  const add = (label, data) => parts.push([label, Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8')]);
  const readOr = (p) => (fs.existsSync(p) ? fs.readFileSync(p) : 'MISSING');

  add('rubric', rubric._raw || JSON.stringify(rubric));
  add(`persona:${rubric.persona}`, stable((personas || loadPersonas())[rubric.persona] || null));
  for (const story of storiesOf(rubric)) {
    const s = readScript(story);
    add(`narration:${story}`, s ? s.scenes.map((x) => `${x.scene}\n${norm(x.narration)}`).join('\n\n') : 'MISSING');
  }
  const primary = rubric.story;
  add(`deck:${primary}`, readOr(path.join(SERIES_DIR, primary, 'deck_anim.html')));
  const deck = readDeck(primary);
  const panels = deck ? [...new Set(deck.scenes.flatMap((sc) => sc.panels.map((p) => p.name)))].sort() : [];
  for (const n of panels) add(`panel:${n}`, readOr(path.join(SERIES_DIR, 'qlik_panels', n)));
  for (const e of EDITED_PANELS) add(`marker:${e.marker.split(path.sep).join('/')}`, fs.existsSync(path.join(SERIES_DIR, e.marker)) ? 'present' : 'absent');
  add(`build:${primary}`, readOr(buildPath(primary)));
  const script = readScript(primary);
  const mp4 = script && script.output ? path.join(SERIES_DIR, primary, script.output) : null;
  let mp4Info = 'MISSING';
  if (mp4 && fs.existsSync(mp4)) { const st = fs.statSync(mp4); mp4Info = `${st.size}:${Math.floor(st.mtimeMs)}`; }
  add(`mp4:${primary}`, mp4Info);
  const probes = new Set(criteriaOf(rubric).filter((c) => c.judge_on === 'auto').map((c) => c.probe));
  if (probes.has('olh_live')) for (const f of olhFiles()) add(`probe:olh_live:${path.basename(f)}`, fs.readFileSync(f));

  const h = crypto.createHash('sha256');
  for (const [label, buf] of parts) { h.update(`${label}\0${buf.length}\0`); h.update(buf); }
  const hash = h.digest('hex');
  return { hash, short: hash.slice(0, 12), parts: parts.map(([label, buf]) => ({ label, sha: sha256(buf).slice(0, 12), bytes: buf.length })) };
}

/**
 * A pillar can only be reviewed against a finished build: its script, deck and
 * embedded panels — and the scripts of its also stories — must not be newer
 * than the capture/build.json that recorded the last build.
 */
function precondition(rubric) {
  const problems = [];
  const warnings = [];
  const rel = (p) => path.relative(SERIES_DIR, p).split(path.sep).join('/');
  const primary = rubric.story;
  const bp = buildPath(primary);
  const bt = mtime(bp);
  if (bt == null) {
    problems.push(`${rel(bp)} is missing — build the video first`);
  } else {
    const deck = readDeck(primary);
    const inputs = [path.join(SERIES_DIR, primary, 'script.md'), path.join(SERIES_DIR, primary, 'deck_anim.html')];
    if (deck) for (const n of new Set(deck.scenes.flatMap((sc) => sc.panels.map((p) => p.name)))) inputs.push(path.join(SERIES_DIR, 'qlik_panels', n));
    for (const p of inputs) { const t = mtime(p); if (t != null && t > bt) problems.push(`${rel(p)} is newer than ${rel(bp)}`); }

    const script = readScript(primary);
    let placements = null;
    try { placements = (JSON.parse(fs.readFileSync(bp, 'utf8')).placements || []).length; } catch { /* unreadable build.json is a mismatch below */ }
    const nScript = script ? script.scenes.length : 0;
    const nDeck = deck ? deck.scenes.length : 0;
    if (deck && nScript !== nDeck) warnings.push(`${primary}: script.md has ${nScript} narrated scenes, deck_anim.html has ${nDeck}`);
    if (placements != null && placements !== nScript) warnings.push(`${primary}: build.json has ${placements} placements for ${nScript} narrated scenes`);
  }
  for (const story of rubric.also) {
    const sp = path.join(SERIES_DIR, story, 'script.md');
    const st = mtime(sp);
    const at = mtime(buildPath(story));
    if (st != null && at != null && st > at) problems.push(`${rel(sp)} is newer than ${rel(buildPath(story))}`);
  }
  return { ok: problems.length === 0, problems, warnings };
}

// ─── State ──────────────────────────────────────────────────────────────────

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, p);
}

function readState() {
  const s = readJson(STATE_PATH, null) || {};
  if (!s.pillars) s.pillars = {};
  return s;
}
function writeState(state) {
  writeJson(STATE_PATH, { ...state, checkout: REPO_ROOT, updated: new Date().toISOString() });
}

/** Two checkouts on this machine drift silently; say so when the state was written by the other one. */
function checkoutWarning(state) {
  if (!state || !state.checkout) return null;
  if (path.resolve(state.checkout).toLowerCase() === path.resolve(REPO_ROOT).toLowerCase()) return null;
  return `warning: pillar-state.json was written from ${state.checkout}, but this is ${REPO_ROOT} — two checkouts drift silently (there is a stale clone at C:\\Claude\\MCG Demo\\MCG Full Stack); review from one of them only`;
}

function readListener() {
  const l = readJson(LISTENER_PATH, null) || {};
  if (!l.sessions) l.sessions = {};
  if (!l.announced) l.announced = {};
  return l;
}
function writeListener(l) {
  const cutoff = Date.now() - 14 * 24 * 3600 * 1000;
  for (const [id, s] of Object.entries(l.sessions)) if (!s || Date.parse(s.start) < cutoff) delete l.sessions[id];
  writeJson(LISTENER_PATH, l);
}

function listenerOff() {
  return String(process.env.MCG_REVIEW_LISTENER || '').toLowerCase() === 'off' || fs.existsSync(LISTENER_OFF_PATH);
}

/** Everything --status, --facts and the hook need to know about one pillar. */
function pillarStatus(key, personas) {
  const rubric = loadPillar(key);
  personas = personas || loadPersonas();
  const persona = personas[rubric.persona] || { name: rubric.persona, role: '' };
  const fp = fingerprint(rubric, personas);
  const pre = precondition(rubric);
  const probes = runProbes(rubric);
  const state = readState();
  const entry = state.pillars[key] || null;
  let status;
  if (!pre.ok) status = 'rebuild';
  else if (!entry) status = 'never';
  else if (entry.fingerprint !== fp.hash) status = 'stale';
  else status = 'fresh';
  const builds = storiesOf(rubric).map((s) => ({ story: s, path: buildPath(s), mtime: mtime(buildPath(s)) }));
  return { key, rubric, persona, fp, pre, probes, entry, status, builds };
}

module.exports = {
  REPO_ROOT, SERIES_CANDIDATES, SERIES_DIR, RUBRICS_DIR, PILLAR_DIR, PERSONAS_PATH,
  STATE_DIR, STATE_PATH, LISTENER_PATH, LISTENER_OFF_PATH, LOAD_SCRIPTS_DIR, AGENT_PATH,
  PILLARS, PILLAR_LABEL, EDITED_PANELS,
  relPath, resolveRecorded, sha256,
  readScript, norm, flatNarration, readDeck, sceneMap, editedPanels,
  probeTenantPanels, probeOlhLive, stripQlikComments, olhFiles, runProbes,
  loadPillar, loadPillars, loadPersonas, criteriaOf, storiesOf,
  computeBar, gateVerdicts, gateRulings, checkRef,
  fingerprint, precondition, buildPath,
  readState, writeState, checkoutWarning, readListener, writeListener, listenerOff,
  pillarStatus,
};
