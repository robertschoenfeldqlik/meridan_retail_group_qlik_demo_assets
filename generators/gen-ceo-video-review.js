#!/usr/bin/env node
/**
 * gen-ceo-video-review.js — have MCG's CEO review the agentic videos.
 * ============================================================================
 * An LLM classifies the narration actually in the videos against the rubric in
 * `rubrics/agentic-video-rubric.json`, then writes the feedback as a memo from
 * Ingrid van der Berg, CEO of Meridian Commerce Group.
 *
 * Two calls, deliberately separate:
 *
 *   1. CLASSIFY — structured output, one verdict per rubric criterion
 *      (covered / partial / missed) with the quote that justifies it. A
 *      classifier that also writes prose starts grading on eloquence; keeping
 *      it schema-bound keeps the verdicts auditable.
 *   2. REVIEW  — the CEO memo, written from those verdicts plus the business
 *      context. It cannot invent a gap the classifier did not find, because it
 *      is handed the verdict table, not the scripts.
 *
 * The talking points are read from the video scripts on disk — `script.md` in
 * each story folder — so the review scores what the videos say today, not what
 * an earlier cut said.
 *
 * Usage:
 *   node generators/gen-ceo-video-review.js --dry-run      # inputs + prompts, no API call
 *   node generators/gen-ceo-video-review.js                # both dimensions
 *   node generators/gen-ceo-video-review.js --topic engineering
 *   node generators/gen-ceo-video-review.js --json out.json # also dump raw verdicts
 *
 * Needs ANTHROPIC_API_KEY (or an `ant auth login` profile) for anything but
 * --dry-run.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { z } = require('zod');

const { REPO_ROOT, doc } = require('./lib/asset-paths');

// The video sources live beside the repo, not inside it — the series folder is
// its own project. Override for a different checkout.
const SERIES_DIR = process.env.MCG_SERIES_DIR
  ? path.resolve(process.env.MCG_SERIES_DIR)
  : path.resolve(REPO_ROOT, '..', 'MCG Video Voiceover', 'series');

const RUBRIC_PATH = path.join(__dirname, 'rubrics', 'agentic-video-rubric.json');
const MODEL = 'claude-opus-5';

// Which stories carry which dimension. s5_ai spans both: its first half is the
// build side, its later scenes are what the consumption side experiences.
const DIMENSION_SOURCES = {
  ADE: ['s2_integration', 's5_ai'],
  AAX: ['s4_analytics', 's5_ai'],
};

// Business context for the memo. Trimmed to the parts a CEO would have in her
// head; the classifier does not see these, only the reviewer does.
const CONTEXT_FILES = [
  'Meridian_Commerce_Group_Demo_Profile.md',
  path.join('documents', 'project_briefs', 'PROJ-CLARITY-2025_Business_Case.md'),
];

// ─── CLI ────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const DRY = has('--dry-run');
const TOPIC = (val('--topic', 'both') || 'both').toLowerCase();
const JSON_OUT = val('--json', null);

// Offline path: supply verdicts and memo that were produced elsewhere — by a
// human reviewer, by an assistant with the sources in front of it, or by an
// earlier run whose --json was kept. The validation below is the same either
// way, so a hand-written review cannot skip criteria or cite absent quotes.
const VERDICTS_IN = val('--verdicts', null);
const MEMO_IN = val('--memo', null);
const OFFLINE = Boolean(VERDICTS_IN || MEMO_IN);
if (OFFLINE && !(VERDICTS_IN && MEMO_IN)) {
  console.error('--verdicts and --memo must be given together');
  process.exit(2);
}

const TOPIC_MAP = { engineering: ['ADE'], analytics: ['AAX'], both: ['ADE', 'AAX'] };
if (!TOPIC_MAP[TOPIC]) {
  console.error(`--topic must be one of: ${Object.keys(TOPIC_MAP).join(', ')}`);
  process.exit(2);
}
const WANTED = TOPIC_MAP[TOPIC];

// ─── Inputs ─────────────────────────────────────────────────────────────────

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

function loadContext() {
  return CONTEXT_FILES.map((rel) => {
    const p = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(p)) return null;
    return { name: path.basename(rel), text: fs.readFileSync(p, 'utf8') };
  }).filter(Boolean);
}

// ─── Prompts ────────────────────────────────────────────────────────────────

function renderTalkingPoints(scripts) {
  return scripts.map((s) => {
    const head = `### ${s.title}\n(${s.output || s.story} — ${s.scenes.length} narrated scenes)`;
    const body = s.scenes
      .map((sc, i) => `[${s.story}#${i + 1}] ${sc.scene}${sc.at != null ? ` — at ${sc.at}s` : ''}\n${sc.narration}`)
      .join('\n\n');
    return `${head}\n\n${body}`;
  }).join('\n\n---\n\n');
}

function renderCriteria(dims) {
  return dims.map((d) => {
    const rows = d.criteria
      .map((c) => `- **${c.id}** (${c.weight}) ${c.name}\n  Expected: ${c.expect}`)
      .join('\n');
    return `## ${d.id} — ${d.name}\n${d.framing}\n\n${rows}`;
  }).join('\n\n');
}

const CLASSIFY_SYSTEM = `You assess whether a video's narration covers a set of expected talking points.

You are given the complete spoken narration of one or more videos and a rubric of criteria. For every criterion, decide whether the narration covers it.

Rules that decide the verdict:
- "covered" requires the point to be stated explicitly enough that a first-time viewer takes it away. Judge the spoken words only.
- "partial" means it is touched, named or implied, but a viewer could reasonably miss it.
- "missed" means it is absent from the narration.
- Quote verbatim. The evidence field must be an exact substring of the narration, or empty when the verdict is "missed". Never paraphrase into the evidence field.
- Do not credit a point because it is obviously true of the product, because a related point was made, or because it appears on screen. You only have the narration; score the narration.
- Do not soften a verdict to be agreeable. A rubric that always returns "covered" is useless.
- For "partial" and "missed", say specifically what a viewer would not learn — the concrete absent idea, not a restatement of the criterion.`;

function classifyPrompt(dims, scripts) {
  return `Here is the complete narration of the video(s) under review.

<narration>
${renderTalkingPoints(scripts)}
</narration>

Assess it against every criterion below.

<rubric>
${renderCriteria(dims)}
</rubric>

Return one verdict per criterion, for all ${dims.reduce((n, d) => n + d.criteria.length, 0)} of them, using the criterion ids exactly as written.`;
}

const REVIEW_SYSTEM = `You are Ingrid van der Berg, Chief Executive Officer of Meridian Commerce Group, writing a short review memo after watching an internal video assessment.

You are the executive sponsor of Project Qlarity. You asked the original question that started it — why you could not see what was happening in your own supply chain — and you carry the cost figure to the board.

How you write:
- Direct, specific, unsentimental. You are reviewing work you sponsored, so you are invested but not soft.
- You care whether a viewer who is not technical would understand what changes for the business. Capability that is not tied to a decision someone makes is, to you, unfinished.
- You quote the narration when you praise or criticise it.
- You name the gaps that matter to you and say why they matter, in business terms. You do not list every gap the analysis found — you triage.
- No corporate filler, no "exciting journey", no thanking the team for their hard work at length.
- British-leaning business English. First person. Around 700-900 words.

You are handed a coverage analysis, not the raw videos. Work from its verdicts — do not claim something was missed that the analysis marked covered, and do not invent numbers that are not in the material you are given.`;

function reviewPrompt(dims, verdicts, context, scripts) {
  const byId = new Map();
  dims.forEach((d) => d.criteria.forEach((c) => byId.set(c.id, { ...c, dim: d })));

  const table = verdicts.map((v) => {
    const c = byId.get(v.id);
    return [
      `${v.id} — ${c ? c.name : ''} [${c ? c.weight : '?'}] → ${v.verdict.toUpperCase()}`,
      c ? `   expected: ${c.expect}` : '',
      v.evidence ? `   said: "${v.evidence}"` : '',
      v.gap ? `   not conveyed: ${v.gap}` : '',
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  const counts = verdicts.reduce((a, v) => ((a[v.verdict] = (a[v.verdict] || 0) + 1), a), {});

  return `You have just watched ${scripts.length === 1 ? 'a video' : `${scripts.length} videos`} covering ${dims.map((d) => d.name).join(' and ')}, together with a coverage analysis of the talking points.

<coverage_analysis>
Scored ${verdicts.length} criteria: ${counts.covered || 0} covered, ${counts.partial || 0} partial, ${counts.missed || 0} missed.

${table}
</coverage_analysis>

<company_context>
${context.map((c) => `--- ${c.name} ---\n${c.text}`).join('\n\n')}
</company_context>

Write your review memo. Cover, in your own structure and your own words:
- your overall read on whether this lands with a business audience;
- what genuinely works, quoted;
- the gaps that matter to you, with why each one matters to Meridian specifically — weight the "must" criteria far above the rest;
- what you want changed before this is shown outside the company, as clear instructions.

Write only the memo body. No subject line, no To/From block — those are added around your text.`;
}

// ─── Schema ─────────────────────────────────────────────────────────────────

const VerdictSchema = z.object({
  verdicts: z.array(
    z.object({
      id: z.string().describe('The criterion id, exactly as given, e.g. ADE-03'),
      verdict: z.enum(['covered', 'partial', 'missed']),
      evidence: z.string().describe('Exact substring of the narration, or "" when missed'),
      gap: z.string().describe('For partial/missed: the specific idea a viewer would not take away. "" when covered'),
    }),
  ),
});

// ─── Output ─────────────────────────────────────────────────────────────────

const MARK = { covered: '✓', partial: '~', missed: '✗' };

function buildMarkdown({ dims, verdicts, memo, scripts, counts, scope }) {
  const byId = new Map();
  dims.forEach((d) => d.criteria.forEach((c) => byId.set(c.id, c)));
  const today = new Date().toISOString().slice(0, 10);

  const sections = dims.map((d) => {
    const rows = d.criteria.map((c) => {
      const v = verdicts.find((x) => x.id === c.id);
      const verdict = v ? v.verdict : 'missed';
      return `| ${MARK[verdict]} | ${c.id} | ${c.name} | ${c.weight} | ${verdict} | ${(v && (v.gap || v.evidence)) || ''} |`;
    }).join('\n');
    return `### ${d.name}\n\n| | ID | Criterion | Weight | Verdict | Note |\n|---|---|---|---|---|---|\n${rows}`;
  }).join('\n\n');

  return `# Executive review — Project Qlarity video assessment

**From:** Ingrid van der Berg, Chief Executive Officer
**Subject:** ${dims.map((d) => d.name).join(' and ')} — talking-point review
**Date:** ${today}
**Material reviewed:** ${scripts.map((s) => s.output || s.story).join(', ')}
**Coverage:** ${counts.covered} covered, ${counts.partial} partial, ${counts.missed} missed of ${verdicts.length} criteria

---

${memo}

---

## Appendix — coverage analysis

Scored against \`generators/rubrics/agentic-video-rubric.json\`. ${scope}

${sections}
`;
}

async function writeDocx({ dims, verdicts, memo, scripts, counts, outMd, scope }) {
  const {
    buildDocument, saveDocument, metadataTable, dataTable,
    heading, para, calloutBox, signatureBlock,
  } = require('./mcg-docx-builder');

  const today = new Date().toISOString().slice(0, 10);
  const body = [
    heading('Executive Review — Project Qlarity Video Assessment'),
    metadataTable([
      ['From', 'Ingrid van der Berg, Chief Executive Officer'],
      ['Subject', `${dims.map((d) => d.name).join(' and ')} — talking-point review`],
      ['Date', today],
      ['Material Reviewed', scripts.map((s) => s.output || s.story).join(', ')],
      ['Coverage', `${counts.covered} covered · ${counts.partial} partial · ${counts.missed} missed of ${verdicts.length}`],
      ['Classification', 'Internal — Project Qlarity steering'],
    ]),
    calloutBox(
      `${counts.missed} of ${verdicts.length} expected talking points are absent from the narration and ${counts.partial} land only partially. Detail in the appendix.`,
      counts.missed > 0 ? 'warning' : 'info',
    ),
  ];

  memo.split(/\n{2,}/).forEach((p) => {
    const t = p.trim();
    if (!t) return;
    if (/^#{1,3}\s/.test(t)) body.push(heading(t.replace(/^#{1,3}\s*/, ''), 2));
    else body.push(para(t.replace(/\*\*/g, '')));
  });

  body.push(heading('Appendix — Coverage Analysis', 2));
  body.push(para(`Scored against the agentic video rubric. ${scope}`));
  for (const d of dims) {
    body.push(heading(d.name, 3));
    body.push(dataTable(
      ['ID', 'Criterion', 'Weight', 'Verdict', 'Note'],
      d.criteria.map((c) => {
        const v = verdicts.find((x) => x.id === c.id);
        return [c.id, c.name, c.weight, v ? v.verdict : 'missed', (v && (v.gap || v.evidence)) || ''];
      }),
    ));
  }
  body.push(...signatureBlock('Ingrid van der Berg', 'Chief Executive Officer', 'Executive Sponsor, Project Qlarity'));

  const outDocx = outMd.replace(/\.md$/, '.docx');
  await saveDocument(buildDocument('EXECUTIVE REVIEW', body), outDocx);
  return outDocx;
}

// ─── Main ───────────────────────────────────────────────────────────────────

(async () => {
  const rubric = JSON.parse(fs.readFileSync(RUBRIC_PATH, 'utf8'));
  const dims = rubric.dimensions.filter((d) => WANTED.includes(d.id));
  if (!dims.length) throw new Error(`rubric has no dimensions matching ${WANTED.join(', ')}`);

  const stories = [...new Set(dims.flatMap((d) => DIMENSION_SOURCES[d.id] || []))];
  const scripts = stories.map(readScript).filter(Boolean);
  const missing = stories.filter((s) => !scripts.find((x) => x.story === s));

  const nCriteria = dims.reduce((n, d) => n + d.criteria.length, 0);
  const nScenes = scripts.reduce((n, s) => n + s.scenes.length, 0);

  console.log(`rubric  : ${rubric.id} v${rubric.version} — ${nCriteria} criteria across ${dims.length} dimension(s)`);
  console.log(`scripts : ${SERIES_DIR}`);
  scripts.forEach((s) => console.log(`          ${s.story.padEnd(16)} ${String(s.scenes.length).padStart(2)} scenes  ${s.output || ''}`));
  if (missing.length) console.log(`          MISSING: ${missing.join(', ')}`);
  if (!nScenes) throw new Error('no narration found — check MCG_SERIES_DIR');

  const context = loadContext();
  console.log(`context : ${context.map((c) => c.name).join(', ') || '(none found)'}`);

  if (DRY) {
    console.log(`\n${'='.repeat(70)}\nDRY RUN — no API call. Prompts that would be sent:\n`);
    console.log(`--- classify system (${CLASSIFY_SYSTEM.length} chars) ---\n${CLASSIFY_SYSTEM}\n`);
    const cp = classifyPrompt(dims, scripts);
    console.log(`--- classify user (${cp.length} chars) ---\n${cp}\n`);
    console.log(`--- review system (${REVIEW_SYSTEM.length} chars) ---\n${REVIEW_SYSTEM}\n`);
    const ctxChars = context.reduce((n, c) => n + c.text.length, 0);
    console.log(`--- review user: verdict table + ${ctxChars} chars of company context ---`);
    console.log(`\nmodel: ${MODEL}`);
    return;
  }

  let verdicts;
  let memo;
  // What the verdicts were actually formed from. The API path sees the
  // narration and nothing else; an offline review may also have watched the
  // slides, so it can say so in its own file.
  let scope = 'Verdicts are classified from the spoken narration only; on-screen content is not scored.';

  if (OFFLINE) {
    const raw = JSON.parse(fs.readFileSync(VERDICTS_IN, 'utf8'));
    verdicts = Array.isArray(raw) ? raw : raw.verdicts;
    if (!Array.isArray(verdicts)) throw new Error(`${VERDICTS_IN}: expected an array, or an object with a "verdicts" array`);
    const parsed = VerdictSchema.safeParse({ verdicts });
    if (!parsed.success) throw new Error(`${VERDICTS_IN}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
    verdicts = parsed.data.verdicts;
    if (raw && raw.scope) scope = String(raw.scope);
    memo = fs.readFileSync(MEMO_IN, 'utf8').trim();
    if (!memo) throw new Error(`${MEMO_IN} is empty`);
    console.log(`\noffline: ${verdicts.length} verdicts from ${path.basename(VERDICTS_IN)}, memo from ${path.basename(MEMO_IN)}`);
  } else {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      throw new Error(
        'no Anthropic credential — set ANTHROPIC_API_KEY, or run `ant auth login`.\n' +
        '         --dry-run shows what would be sent; --verdicts/--memo take a review made elsewhere.',
      );
    }
    // A Claude Code shell exports ANTHROPIC_BASE_URL pointing at its own proxy,
    // which is not the public API and will not serve this key. Say so rather
    // than failing later with an opaque 401.
    if (process.env.ANTHROPIC_BASE_URL) {
      console.log(`  note: ANTHROPIC_BASE_URL is set (${process.env.ANTHROPIC_BASE_URL}) — unset it to reach api.anthropic.com`);
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');
    const client = new Anthropic();

    console.log(`\nclassifying ${nCriteria} criteria against ${nScenes} narrated scenes...`);
    const classified = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: zodOutputFormat(VerdictSchema) },
      system: CLASSIFY_SYSTEM,
      messages: [{ role: 'user', content: classifyPrompt(dims, scripts) }],
    });

    if (!classified.parsed_output) throw new Error('classifier returned no parsed output');
    verdicts = classified.parsed_output.verdicts;
  }

  // The classifier must return every criterion. A short list means a silent
  // miss, and a review built on it would understate the gaps.
  const known = new Set(dims.flatMap((d) => d.criteria.map((c) => c.id)));
  const returned = new Set(verdicts.map((v) => v.id));
  const absent = [...known].filter((id) => !returned.has(id));
  const unknown = [...returned].filter((id) => !known.has(id));
  if (absent.length) throw new Error(`classifier skipped ${absent.length} criteria: ${absent.join(', ')}`);
  if (unknown.length) throw new Error(`classifier invented ids: ${unknown.join(', ')}`);

  // Evidence must actually appear in the narration, or the verdict is a story.
  const allNarration = scripts.flatMap((s) => s.scenes.map((x) => x.narration)).join(' ');
  const norm = (s) => s.replace(/\s+/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();
  const flatNarration = norm(allNarration);
  const fabricated = verdicts.filter((v) => v.evidence && !flatNarration.includes(norm(v.evidence)));
  if (fabricated.length) {
    console.log(`  warning: ${fabricated.length} evidence quote(s) not found verbatim — ${fabricated.map((v) => v.id).join(', ')}`);
  }

  const counts = { covered: 0, partial: 0, missed: 0 };
  verdicts.forEach((v) => { counts[v.verdict] = (counts[v.verdict] || 0) + 1; });
  console.log(`  ${counts.covered} covered, ${counts.partial} partial, ${counts.missed} missed`);
  verdicts.filter((v) => v.verdict !== 'covered').forEach((v) => {
    console.log(`  ${MARK[v.verdict]} ${v.id}  ${v.gap}`);
  });

  if (!OFFLINE) {
    console.log('\nwriting the CEO review...');
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic();
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      system: REVIEW_SYSTEM,
      messages: [{ role: 'user', content: reviewPrompt(dims, verdicts, context, scripts) }],
    });
    const final = await stream.finalMessage();
    memo = final.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!memo) throw new Error('reviewer returned no text');
  }

  const slug = TOPIC === 'both' ? 'agentic' : TOPIC;
  const outMd = doc('reviews', `CEO_Video_Review_${slug}.md`);
  fs.writeFileSync(outMd, buildMarkdown({ dims, verdicts, memo, scripts, counts, scope }), 'utf8');
  console.log(`  ✓ ${path.basename(outMd)}`);
  const outDocx = await writeDocx({ dims, verdicts, memo, scripts, counts, outMd, scope });

  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify({
      rubric: rubric.id, version: rubric.version, model: MODEL,
      generated: new Date().toISOString(), counts, verdicts,
    }, null, 2), 'utf8');
    console.log(`  ✓ ${JSON_OUT}`);
  }

  console.log(`\n${path.dirname(outMd)}`);
  console.log(`  ${path.basename(outMd)}\n  ${path.basename(outDocx)}`);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
