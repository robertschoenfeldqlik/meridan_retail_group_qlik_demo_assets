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
 * Pillar mode scores one module video against its own rubric
 * (`rubrics/pillars/<pillar>.json`) as the executive who owns that area
 * (`rubrics/personas.json`), with deterministic probes for what a reviewer must
 * not be asked to judge. Judge mode is Ingrid ruling on the pillar reviews: the
 * pass bar is computed here, and she may hold a passing pillar but never pass a
 * failing one.
 *
 * Usage:
 *   node generators/gen-ceo-video-review.js --dry-run      # inputs + prompts, no API call
 *   node generators/gen-ceo-video-review.js                # both dimensions
 *   node generators/gen-ceo-video-review.js --topic engineering
 *   node generators/gen-ceo-video-review.js --json out.json # also dump raw verdicts
 *   node generators/gen-ceo-video-review.js --verdicts v.json --memo m.md   # offline replay
 *
 *   node generators/gen-ceo-video-review.js --pillar governance [--dry-run]
 *   node generators/gen-ceo-video-review.js --pillar governance --verdicts v.json   # offline
 *   node generators/gen-ceo-video-review.js --pillar all          # API, every pillar
 *   node generators/gen-ceo-video-review.js --judge               # API ruling
 *   node generators/gen-ceo-video-review.js --judge --memo m.md --rulings r.json  # offline
 *
 * Needs ANTHROPIC_API_KEY (or an `ant auth login` profile) for anything but
 * --dry-run and the offline paths.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { z } = require('zod');

const { REPO_ROOT, doc } = require('./lib/asset-paths');
const review = require('./lib/rubric-review');

// Series discovery (MCG_SERIES_DIR overrides) and the narration reader live in
// lib/rubric-review.js, shared with the listener.
const { SERIES_DIR, readScript } = review;

const RUBRIC_PATH = path.join(__dirname, 'rubrics', 'agentic-video-rubric.json');
const PILLAR_DIR = review.PILLAR_DIR;
const MODEL = 'claude-opus-5-5';

// ─── CLI ────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const DRY = has('--dry-run');
const TOPIC = (val('--topic', 'both') || 'both').toLowerCase();
const JSON_OUT = val('--json', null);

const PILLAR_ARG = has('--pillar') ? String(val('--pillar', '') || '').toLowerCase() : null;
const JUDGE = has('--judge');
const MODE = JUDGE ? 'judge' : PILLAR_ARG != null ? 'pillar' : 'legacy';

// Offline path: supply verdicts and memo that were produced elsewhere — by a
// human reviewer, by an assistant with the sources in front of it, or by an
// earlier run whose --json was kept. The validation below is the same either
// way, so a hand-written review cannot skip criteria or cite absent quotes.
const VERDICTS_IN = val('--verdicts', null);
const MEMO_IN = val('--memo', null);
const RULINGS_IN = val('--rulings', null);
const OFFLINE = MODE === 'legacy' ? Boolean(VERDICTS_IN || MEMO_IN)
  : MODE === 'pillar' ? Boolean(VERDICTS_IN)
    : Boolean(MEMO_IN || RULINGS_IN);

const usage = (msg) => { console.error(msg); process.exit(2); };
if (MODE !== 'legacy' && has('--topic')) usage('--pillar/--judge and --topic are mutually exclusive');
if (MODE === 'legacy' && RULINGS_IN) usage('--rulings belongs to --judge');
if (MODE === 'legacy' && OFFLINE && !(VERDICTS_IN && MEMO_IN)) {
  console.error('--verdicts and --memo must be given together');
  process.exit(2);
}

const TOPIC_MAP = { engineering: ['ADE'], analytics: ['AAX'], both: ['ADE', 'AAX'] };
if (!TOPIC_MAP[TOPIC]) {
  console.error(`--topic must be one of: ${Object.keys(TOPIC_MAP).join(', ')}`);
  process.exit(2);
}
const WANTED = TOPIC_MAP[TOPIC];

const PILLAR_CHOICES = [...review.PILLARS, 'all'];
if (MODE === 'pillar') {
  if (!PILLAR_CHOICES.includes(PILLAR_ARG)) usage(`--pillar must be one of: ${PILLAR_CHOICES.join(', ')}`);
  if (MEMO_IN || RULINGS_IN) usage('--memo/--rulings belong to --judge; a pillar review carries its persona note inside the verdicts JSON');
  if (VERDICTS_IN && PILLAR_ARG === 'all') usage('--verdicts holds one pillar — name it: --pillar <pillar> --verdicts <file>');
}
if (MODE === 'judge') {
  if (VERDICTS_IN) usage('--judge reads the published pillar verdicts from pillar-state.json; give it --memo and --rulings, not --verdicts');
  if (OFFLINE && !(MEMO_IN && RULINGS_IN)) usage('--memo and --rulings must be given together');
  if (PILLAR_ARG != null && !PILLAR_CHOICES.includes(PILLAR_ARG)) usage(`--pillar must be one of: ${PILLAR_CHOICES.join(', ')}`);
}

// ─── Sources ────────────────────────────────────────────────────────────────

// The pillar rubrics, read from PILLAR_DIR. Legacy runs do not depend on them,
// so a broken pillar file must not stop a legacy replay.
const PILLAR_RUBRICS = review.loadPillars({ tolerant: MODE === 'legacy' });

// Which stories carry which dimension. s5_ai spans both: its first half is the
// build side, its later scenes are what the consumption side experiences. The
// pillar entries come from each rubric's story + also (GOV reads s3_governance).
const DIMENSION_SOURCES = {
  ADE: ['s2_integration', 's5_ai'],
  AAX: ['s4_analytics', 's5_ai'],
  ...Object.fromEntries(Object.values(PILLAR_RUBRICS).map((r) => [r.id, review.storiesOf(r)])),
};

// The pillar's own video. Evidence found only in another story caps a narration
// verdict at partial, and screen refs must point into this story's deck.
const PRIMARY_STORY = Object.fromEntries(Object.values(PILLAR_RUBRICS).map((r) => [r.id, r.story]));

// Business context for the memo. Trimmed to the parts a CEO would have in her
// head; the classifier does not see these, only the reviewer does.
const CONTEXT_FILES = [
  'Meridian_Commerce_Group_Demo_Profile.md',
  path.join('documents', 'project_briefs', 'PROJ-CLARITY-2025_Business_Case.md'),
];

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

// Ingrid's voice, shared by the legacy memo and the pillar ruling.
const HOW_YOU_WRITE = `How you write:
- Direct, specific, unsentimental. You are reviewing work you sponsored, so you are invested but not soft.
- You care whether a viewer who is not technical would understand what changes for the business. Capability that is not tied to a decision someone makes is, to you, unfinished.
- You quote the narration when you praise or criticise it.
- You name the gaps that matter to you and say why they matter, in business terms. You do not list every gap the analysis found — you triage.
- No corporate filler, no "exciting journey", no thanking the team for their hard work at length.
- British-leaning business English. First person. Around 700-900 words.`;

const REVIEW_SYSTEM = `You are Ingrid van der Berg, Chief Executive Officer of Meridian Commerce Group, writing a short review memo after watching an internal video assessment.

You are the executive sponsor of Project Qlarity. You asked the original question that started it — why you could not see what was happening in your own supply chain — and you carry the cost figure to the board.

${HOW_YOU_WRITE}

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

// ─── Pillar prompts ─────────────────────────────────────────────────────────

/** The reviewing executive, then the classifier rules verbatim, then what a pillar review adds. */
function personaClassifySystem(persona, rubric) {
  const also = rubric.also.join(', ') || 'no other story';
  return `You are ${persona.name}, ${persona.role} of Meridian Commerce Group, reviewing the ${review.PILLAR_LABEL[rubric.pillar]} pillar video (${rubric.story}) before it goes to the CEO, Ingrid van der Berg.

What you care about:
${persona.cares_about.map((x) => `- ${x}`).join('\n')}

What you are skeptical of:
${persona.skeptical_of.map((x) => `- ${x}`).join('\n')}

Your voice: ${persona.voice}

${CLASSIFY_SYSTEM}

Rules for this pillar review, which refine the rules above:
- Each criterion says what it is judged on. [narration] criteria follow the rules above exactly: the spoken words only, evidence verbatim, \`ref\` left empty.
- [screen] criteria are judged on what the video actually shows — the panel images and the scene→panel map — not on the narration. For them, \`evidence\` is a short description of what the referenced panel visibly shows (it is not checked against the narration) and \`ref\` names the scene and panel exactly as the map gives it, story#scN:panel.png. "covered" and "partial" need a ref; for "missed", leave evidence empty. A panel the facts mark as edited after capture is not a live capture.
- [auto] criteria are measured by deterministic probes and shown in <facts>. Do not return verdicts for them.
- Narration from ${also} is context. Quote it when it is the only support, but a point the pillar's own video never makes is at most "partial"; the gate rejects "covered" on evidence quoted only from ${also}.
- The gate also rejects narration evidence that is not an exact substring of the narration, a "covered" or "partial" narration verdict with empty evidence, and a "missed" verdict with any evidence.
- Write \`note\`: two to four sentences in your own voice, to the CEO, on whether this pillar is ready to show and what must change first.`;
}

function renderPillarCriteria(rubric, probes) {
  const measured = new Map(probes.map((p) => [p.id, p]));
  return rubric.dimensions.map((d) => {
    const rows = d.criteria.map((c) => {
      if (c.judge_on === 'auto') {
        const m = measured.get(c.id);
        return `- **${c.id}** (${c.weight}, auto — measured ${m ? m.verdict : '?'}; do not return) ${c.name}\n  Expected: ${c.expect}`;
      }
      return `- **${c.id}** (${c.weight}, [${c.judge_on}]) ${c.name}\n  Expected: ${c.expect}`;
    }).join('\n');
    return `## ${d.id} — ${d.name}\n${d.framing}\n\n${rows}`;
  }).join('\n\n');
}

function renderFacts(probes) {
  if (!probes.length) return '(no probes for this pillar)';
  return probes.map((p) => [
    `- ${p.id} (${p.probe}) → ${p.verdict}${p.gap ? `: ${p.gap}` : ''}`,
    ...p.facts.map((f) => `  - ${f}`),
  ].join('\n')).join('\n');
}

function pillarClassifyPrompt(p, { images }) {
  const toJudge = review.criteriaOf(p.rubric).filter((c) => c.judge_on !== 'auto');
  const map = p.map.map((m) => `- ${m.ref}${m.flag ? `  — ${m.flag}` : ''}`).join('\n') || '(no deck_anim.html)';
  return `Here is the narration of the pillar video under review (${p.rubric.story}), followed by narration from ${p.rubric.also.join(', ') || 'no other story'}, which you may quote but which on its own supports at most "partial".

<narration>
${renderTalkingPoints(p.scripts)}
</narration>

<facts>
Measured by deterministic probes. They are not yours to score; they are here so your screen verdicts agree with them.
${renderFacts(p.probes)}
</facts>

<screen>
Scene → panel map for ${p.rubric.story}/deck_anim.html. Screen refs must use these exactly.
${map}
${images ? 'Each panel is attached as an image above, labelled with its ref.' : 'Open each panel PNG under qlik_panels/ and look at it before you judge a screen criterion.'}
</screen>

Assess the video against every criterion below.

<rubric>
${renderPillarCriteria(p.rubric, p.probes)}
</rubric>

Return one verdict for each of the ${toJudge.length} narration and screen criteria (${toJudge.map((c) => c.id).join(', ')}), using the ids exactly as written, plus your note.`;
}

const CEO_JUDGE_SYSTEM = `You are Ingrid van der Berg, Chief Executive Officer of Meridian Commerce Group, ruling on the pillar reviews of the Project Qlarity videos. Each pillar video was reviewed, against its own rubric, by the executive who owns that area.

You are the executive sponsor of Project Qlarity. You asked the original question that started it — why you could not see what was happening in your own supply chain — and you carry the cost figure to the board.

${HOW_YOU_WRITE}

How you rule:
- Each pillar arrives with a pass bar computed in code from its verdicts: every must criterion covered, and no more than the allowed number of should criteria missed. You do not recompute it.
- The ruling only moves one way. A pillar that passes the bar you may "pass", or "hold" — withhold sign-off — when you judge it not ready, with a one-sentence reason. A pillar that fails the bar is ruled "fail". You may never pass a failing pillar; the gate rejects it.
- Say where you disagree with a reviewer and why, but rule on the verdicts you were given — do not claim a criterion was met that the review marked otherwise.

You are handed the reviews, not the raw videos. Work from their verdicts and notes, and do not invent numbers that are not in the material you are given.`;

function judgePrompt(items, context) {
  const blocks = items.map((it) => {
    const crit = new Map(review.criteriaOf(it.p.rubric).map((c) => [c.id, c]));
    const rows = it.full.map((v) => {
      const c = crit.get(v.id);
      return [
        `${v.id} — ${c.name} [${c.weight}, ${c.judge_on}] → ${v.verdict.toUpperCase()}`,
        v.evidence ? `   ${c.judge_on === 'screen' ? 'on screen' : 'said'}: "${v.evidence}"${v.ref ? ` (${v.ref})` : ''}` : '',
        v.gap ? `   ${c.judge_on === 'auto' ? 'measured' : 'not conveyed'}: ${v.gap}` : '',
      ].filter(Boolean).join('\n');
    }).join('\n\n');
    return `## ${review.PILLAR_LABEL[it.key]} — reviewed by ${it.persona.name}, ${it.persona.role}
Bar: ${it.bar.label} (open musts: ${it.bar.openMusts.join(', ') || 'none'}; shoulds missed: ${it.bar.shouldMissed.length} of max ${it.bar.shouldMissedMax}). Score ${it.bar.score}, informational.
Reviewer's note: "${it.note}"

${rows}`;
  }).join('\n\n---\n\n');

  return `You have the pillar reviews of the Project Qlarity videos in front of you — ${items.length === 1 ? 'one pillar' : `${items.length} pillars`}, each scored by the executive who owns that area. The pass bar was computed in code.

<pillar_reviews>
${blocks}
</pillar_reviews>

<company_context>
${context.map((c) => `--- ${c.name} ---\n${c.text}`).join('\n\n')}
</company_context>

Rule on each pillar: ${items.map((it) => `${it.key} (bar ${it.bar.label})`).join(', ')}. A pillar whose bar is PASS is "pass" or "hold"; a pillar whose bar is FAIL is "fail". Give each ruling a one-sentence reason.

Then write your memo to the team. Cover, in your own structure and your own words: your overall read; what genuinely works, quoted; the open musts that matter most to Meridian and why; and what you want changed before the videos are shown outside the company, as clear instructions. Write only the memo body — no subject line, no To/From block.`;
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

// A pillar verdict adds the screen ref and the reviewing executive's note.
const PillarVerdictSchema = z.object({
  note: z.string().describe("Two to four sentences in the reviewer's own voice, to the CEO"),
  verdicts: z.array(
    z.object({
      id: z.string().describe('The criterion id, exactly as given, e.g. GOV-03'),
      verdict: z.enum(['covered', 'partial', 'missed']),
      evidence: z.string().describe('Narration criteria: exact substring of the narration, "" when missed. Screen criteria: what the referenced panel visibly shows'),
      gap: z.string().describe('For partial/missed: the specific idea a viewer would not take away. "" when covered'),
      ref: z.string().describe('Screen criteria: story#scN:panel.png from the scene→panel map. "" for narration criteria'),
    }),
  ),
});

// What an offline pillar verdicts file may carry around the verdicts.
const PillarFileSchema = z.object({
  reviewer: z.string().optional(),
  persona: z.string().optional(),
  pillar: z.string().optional(),
  scope: z.string().optional(),
  note: z.string(),
  verdicts: z.array(
    z.object({
      id: z.string(),
      verdict: z.enum(['covered', 'partial', 'missed']),
      evidence: z.string(),
      gap: z.string(),
      ref: z.string().default(''),
    }),
  ),
});

const CeoRulingSchema = z.object({
  note: z.string().optional(),
  rulings: z.array(z.object({
    pillar: z.string(),
    ruling: z.enum(['pass', 'hold', 'fail']),
    reason: z.string().default(''),
  })),
});

const JudgeOutputSchema = z.object({
  rulings: z.array(z.object({
    pillar: z.string().describe('The pillar key exactly as given: integration, governance, analytics or ai'),
    ruling: z.enum(['pass', 'hold', 'fail']),
    reason: z.string().describe('One sentence'),
  })),
  memo: z.string().describe('The memo body, plain paragraphs'),
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

// ─── Pillar output ──────────────────────────────────────────────────────────

const cell = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
const today = () => new Date().toISOString().slice(0, 10);

function noteFor(v, c) {
  if (c.judge_on === 'screen') return [v.evidence, v.ref ? `(${v.ref})` : '', v.gap].filter(Boolean).join(' ');
  return v.gap || v.evidence || '';
}

function materialLine(p) {
  const primary = p.scripts.find((s) => s.story === p.rubric.story);
  const others = p.scripts.filter((s) => s.story !== p.rubric.story);
  return `${primary ? primary.output || primary.story : p.rubric.story}${others.length ? `; narration also from ${others.map((s) => s.output || s.story).join(', ')}` : ''}`;
}

function barLine(bar) {
  return `${bar.label} — ${bar.openMusts.length ? `${bar.openMusts.length} must(s) open (${bar.openMusts.join(', ')})` : 'every must covered'}; ${bar.shouldMissed.length} should(s) missed (max ${bar.shouldMissedMax})`;
}

function buildPillarMarkdown(r) {
  const { p, full, bar, note, scope, persona } = r;
  const crit = review.criteriaOf(p.rubric);
  const by = new Map(full.map((v) => [v.id, v]));
  const rows = crit.map((c) => {
    const v = by.get(c.id);
    return `| ${MARK[v.verdict]} | ${c.id} | ${cell(c.name)} | ${c.weight} | ${c.judge_on} | ${v.verdict} | ${cell(noteFor(v, c))} |`;
  }).join('\n');
  const facts = p.probes.map((pr) => [
    `- **${pr.id}** \`${pr.probe}\` → ${pr.verdict}${pr.gap ? ` — ${pr.gap}` : ''}`,
    ...pr.facts.map((f) => `  - ${f}`),
  ].join('\n')).join('\n') || '- (no probes)';

  return `# Pillar review — ${review.PILLAR_LABEL[p.key]}

**From:** ${persona.name}, ${persona.role}
**To:** Ingrid van der Berg, Chief Executive Officer
**Subject:** ${review.PILLAR_LABEL[p.key]} pillar — talking-point and screen review
**Date:** ${today()}
**Material reviewed:** ${materialLine(p)}
**Bar:** ${barLine(bar)}
**Score:** ${bar.score} — informational
**Inputs fingerprint:** ${p.fp.short}

---

${note.trim()}

---

## Probe facts

${facts}

## Criteria

Scored against \`generators/rubrics/pillars/${p.key}.json\` v${p.rubric.version}. ${scope}

| | ID | Criterion | Weight | Judged on | Verdict | Evidence / note |
|---|---|---|---|---|---|---|
${rows}
`;
}

function pillarDocxBody(r, B) {
  const { p, full, bar, note, scope, persona } = r;
  const crit = review.criteriaOf(p.rubric);
  const by = new Map(full.map((v) => [v.id, v]));
  const body = [
    B.heading(`Pillar Review — ${review.PILLAR_LABEL[p.key]}`),
    B.metadataTable([
      ['From', `${persona.name}, ${persona.role}`],
      ['To', 'Ingrid van der Berg, Chief Executive Officer'],
      ['Subject', `${review.PILLAR_LABEL[p.key]} pillar — talking-point and screen review`],
      ['Date', today()],
      ['Material Reviewed', materialLine(p)],
      ['Bar', barLine(bar)],
      ['Score', `${bar.score} — informational`],
      ['Inputs Fingerprint', p.fp.short],
    ]),
    B.calloutBox(`Bar ${barLine(bar)}.`, bar.pass ? 'success' : 'warning'),
  ];
  note.split(/\n{2,}/).map((t) => t.trim()).filter(Boolean).forEach((t) => body.push(B.para(t.replace(/\*\*/g, ''))));
  body.push(B.heading('Probe Facts', 2));
  p.probes.forEach((pr) => {
    body.push(B.para(`${pr.id} (${pr.probe}) → ${pr.verdict}${pr.gap ? ` — ${pr.gap}` : ''}`));
    pr.facts.forEach((f) => body.push(B.para(f, { bullet: true })));
  });
  body.push(B.heading('Criteria', 2));
  body.push(B.para(`Scored against the ${review.PILLAR_LABEL[p.key]} pillar rubric v${p.rubric.version}. ${scope}`));
  body.push(B.dataTable(
    ['ID', 'Criterion', 'Weight', 'Judged on', 'Verdict', 'Evidence / note'],
    crit.map((c) => { const v = by.get(c.id); return [c.id, c.name, c.weight, c.judge_on, v.verdict, noteFor(v, c)]; }),
  ));
  body.push(...B.signatureBlock(persona.name, persona.role, `${review.PILLAR_LABEL[p.key]} pillar reviewer, Project Qlarity`));
  return body;
}

async function docxBuffer(title, bodyFn) {
  const B = require('./mcg-docx-builder');
  const { Packer } = require('docx');
  return Packer.toBuffer(B.buildDocument(title, bodyFn(B)));
}

// ─── API helpers ────────────────────────────────────────────────────────────

function apiPreflight() {
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
}

/** Assistant content in a form that can be sent back unchanged on a re-ask. */
function replayable(content) {
  return content.map((b) => {
    if (b.type === 'thinking') return { type: 'thinking', thinking: b.thinking, signature: b.signature };
    if (b.type === 'redacted_thinking') return { type: 'redacted_thinking', data: b.data };
    if (b.type === 'text') return { type: 'text', text: b.text };
    return null;
  }).filter(Boolean);
}

function reaskPrompt(errors) {
  return `The gate that publishes this review rejected your answer:
${errors.map((e) => `- ${e.message}`).join('\n')}

Fix exactly those ids — re-read the narration and copy each quote character for character, cap evidence from another story at partial, give screen verdicts a ref from the scene→panel map — and return the complete answer again.`;
}

/** One structured call, and one re-ask naming the offending ids if the gate refuses it. */
async function parseWithReask({ client, system, content, schema, maxTokens, gate, label }) {
  const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');
  const params = {
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: zodOutputFormat(schema) },
    system,
  };
  const first = await client.messages.parse({ ...params, messages: [{ role: 'user', content }] });
  if (first.stop_reason === 'refusal') throw new Error(`${label} refused the request`);
  if (!first.parsed_output) throw new Error(`${label} returned no parsed output`);
  const errors = gate(first.parsed_output);
  if (!errors.length) return first.parsed_output;
  console.log(`  gate refused ${label}: ${errors.map((e) => e.message).join('; ')}\n  asking once more...`);
  const second = await client.messages.parse({
    ...params,
    messages: [
      { role: 'user', content },
      { role: 'assistant', content: replayable(first.content) },
      { role: 'user', content: reaskPrompt(errors) },
    ],
  });
  if (second.stop_reason === 'refusal') throw new Error(`${label} refused the request`);
  if (!second.parsed_output) throw new Error(`${label} returned no parsed output`);
  return second.parsed_output;   // the caller's gate decides; a second refusal fails
}

async function panelImages(p) {
  const out = [];
  if (!p.deck) return out;
  const sharp = require('sharp');
  const names = [...new Set(p.deck.scenes.flatMap((sc) => sc.panels.filter((x) => x.exists).map((x) => x.name)))];
  for (const name of names) {
    let buf = fs.readFileSync(path.join(SERIES_DIR, 'qlik_panels', name));
    let media = 'image/png';
    const meta = await sharp(buf).metadata();
    // Keep each image under the API's per-image limits: long edge 1568, a few MB.
    if (buf.length > 3.5 * 1024 * 1024 || Math.max(meta.width || 0, meta.height || 0) > 1568) {
      buf = await sharp(buf).resize({ width: 1568, height: 1568, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
      if (buf.length > 3.5 * 1024 * 1024) { buf = await sharp(buf).jpeg({ quality: 85 }).toBuffer(); media = 'image/jpeg'; }
    }
    const refs = p.map.filter((m) => m.panel === name).map((m) => m.ref);
    out.push({ type: 'text', text: `Panel ${refs.join(', ')}` });
    out.push({ type: 'image', source: { type: 'base64', media_type: media, data: buf.toString('base64') } });
  }
  return out;
}

// ─── Pillar mode ────────────────────────────────────────────────────────────

function preparePillar(key, personas) {
  const rubric = PILLAR_RUBRICS[key] || review.loadPillar(key);
  const persona = personas[rubric.persona];
  if (!persona) throw new Error(`${key}: persona "${rubric.persona}" is not in ${review.relPath(review.PERSONAS_PATH)}`);
  const stories = DIMENSION_SOURCES[rubric.id] || review.storiesOf(rubric);
  const scripts = stories.map(readScript).filter(Boolean);
  const missing = stories.filter((s) => !scripts.find((x) => x.story === s));
  return {
    key,
    rubric,
    persona,
    personaKey: rubric.persona,
    primary: PRIMARY_STORY[rubric.id] || rubric.story,
    scripts,
    missing,
    deck: review.readDeck(rubric.story),
    probes: review.runProbes(rubric),
    fp: review.fingerprint(rubric, personas),
    pre: review.precondition(rubric),
    map: review.sceneMap(rubric.story),
    narrationByStory: Object.fromEntries(scripts.map((s) => [s.story, review.flatNarration(s)])),
  };
}

function printPillarHeader(p) {
  const crit = review.criteriaOf(p.rubric);
  const n = (on) => crit.filter((c) => c.judge_on === on).length;
  console.log(`pillar  : ${p.key} — ${p.rubric.id} v${p.rubric.version}, ${crit.length} criteria (${n('auto')} auto, ${n('screen')} screen, ${n('narration')} narration)`);
  console.log(`reviewer: ${p.persona.name}, ${p.persona.role}`);
  console.log(`scripts : ${SERIES_DIR}`);
  p.scripts.forEach((s) => console.log(`          ${s.story.padEnd(16)} ${String(s.scenes.length).padStart(2)} scenes  ${s.output || ''}${s.story === p.primary ? '' : '  (also)'}`));
  if (p.missing.length) console.log(`          MISSING: ${p.missing.join(', ')}`);
  const panels = p.deck ? new Set(p.deck.scenes.flatMap((sc) => sc.panels.map((x) => x.name))).size : 0;
  console.log(`deck    : ${p.deck ? `${p.deck.scenes.length} scenes, ${panels} distinct panels` : 'MISSING'}`);
  p.probes.forEach((r) => console.log(`probe   : ${r.id} ${r.probe} → ${r.verdict}${r.gap ? ` — ${r.gap}` : ''}`));
  console.log(`inputs  : fingerprint ${p.fp.short}`);
  if (!p.pre.ok) console.log(`          REBUILD FIRST: ${p.pre.problems.join('; ')}`);
  p.pre.warnings.forEach((w) => console.log(`  warning: ${w}`));
}

function gatePillar(p, verdicts, note) {
  const errors = review.gateVerdicts({
    mode: 'pillar',
    criteria: review.criteriaOf(p.rubric),
    verdicts,
    narrationByStory: p.narrationByStory,
    primary: p.primary,
    deck: p.deck,
  });
  if (!String(note || '').trim()) errors.push({ code: 'note', ids: [], message: 'the review carries no persona note' });
  return errors;
}

/** Probe rows plus supplied verdicts, in rubric order. */
function fullVerdicts(p, verdicts) {
  const probe = new Map(p.probes.map((r) => [r.id, r]));
  const given = new Map(verdicts.map((v) => [v.id, v]));
  return review.criteriaOf(p.rubric).map((c) => {
    if (probe.has(c.id)) { const r = probe.get(c.id); return { id: c.id, verdict: r.verdict, evidence: '', gap: r.gap, ref: '' }; }
    const v = given.get(c.id);
    return { id: c.id, verdict: v.verdict, evidence: v.evidence || '', gap: v.gap || '', ref: v.ref || '' };
  });
}

/** Parse and check an offline pillar verdicts file. */
function readPillarFile(p, file, personas) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const parsed = PillarFileSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`${file}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  const data = parsed.data;
  if (data.pillar && data.pillar !== p.key) throw new Error(`${file}: verdicts are for pillar "${data.pillar}", not "${p.key}"`);
  let personaKey = p.personaKey;
  if (data.persona && data.persona !== p.personaKey) {
    const alt = personas[data.persona];
    if (!alt || alt.duty !== 'alternate') throw new Error(`${file}: persona "${data.persona}" may not review ${p.key} — use "${p.personaKey}" or an alternate`);
    personaKey = data.persona;
  }
  return { ...data, personaKey };
}

const PILLAR_SCOPE = 'Narration criteria are classified from the spoken narration; screen criteria from the panels the deck embeds; auto criteria are measured by deterministic probes.';

async function runPillars() {
  const keys = PILLAR_ARG === 'all' ? review.PILLARS : [PILLAR_ARG];
  const personas = review.loadPersonas();
  const state = review.readState();
  const warn = review.checkoutWarning(state);
  if (warn) console.log(`  ${warn}`);

  const prepared = keys.map((k) => preparePillar(k, personas));
  prepared.forEach((p, i) => { if (i) console.log(''); printPillarHeader(p); });
  for (const p of prepared) {
    if (!p.scripts.find((s) => s.story === p.primary)) throw new Error(`no narration found for ${p.primary} — check MCG_SERIES_DIR`);
  }

  if (DRY) {
    for (const p of prepared) {
      console.log(`\n${'='.repeat(70)}\nDRY RUN — ${p.key} — no API call. Prompts that would be sent:\n`);
      const sys = personaClassifySystem(p.persona, p.rubric);
      console.log(`--- classify system (${sys.length} chars) ---\n${sys}\n`);
      const up = pillarClassifyPrompt(p, { images: true });
      console.log(`--- classify user (${up.length} chars) ---\n${up}\n`);
      const names = p.deck ? [...new Set(p.deck.scenes.flatMap((sc) => sc.panels.filter((x) => x.exists).map((x) => x.name)))] : [];
      console.log(`--- attached images: ${names.length} panel(s) — ${names.join(', ') || 'none'} ---`);
    }
    console.log(`\nmodel: ${MODEL}`);
    return;
  }

  const stale = prepared.filter((p) => !p.pre.ok);
  if (stale.length) throw new Error(`rebuild first — ${stale.map((p) => `${p.key}: ${p.pre.problems.join('; ')}`).join(' | ')}`);

  let client = null;
  if (!OFFLINE) {
    apiPreflight();
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic();
  }

  const failures = [];
  for (const p of prepared) {
    try {
      // ── validate everything for this pillar before writing anything ──
      let verdicts;
      let note;
      let scope = PILLAR_SCOPE;
      let personaKey = p.personaKey;
      let reviewer = MODEL;
      let verdictsPath;
      let verdictsBytes = null;

      if (OFFLINE) {
        const data = readPillarFile(p, VERDICTS_IN, personas);
        verdicts = data.verdicts;
        note = data.note;
        if (data.scope) scope = data.scope;
        personaKey = data.personaKey;
        reviewer = data.reviewer || 'offline';
        verdictsPath = path.resolve(VERDICTS_IN);
        console.log(`\noffline: ${verdicts.length} verdicts for ${p.key} from ${path.basename(VERDICTS_IN)}`);
      } else {
        console.log(`\nclassifying ${p.key} as ${p.persona.name}...`);
        const images = await panelImages(p);
        const content = [...images, { type: 'text', text: pillarClassifyPrompt(p, { images: images.length > 0 }) }];
        const out = await parseWithReask({
          client,
          system: personaClassifySystem(p.persona, p.rubric),
          content,
          schema: PillarVerdictSchema,
          maxTokens: 16000,
          gate: (o) => gatePillar(p, o.verdicts, o.note),
          label: `the ${p.key} classifier`,
        });
        verdicts = out.verdicts;
        note = out.note;
        verdictsPath = path.join(review.STATE_DIR, `${today()}-${p.key}.verdicts.json`);
      }

      const errors = gatePillar(p, verdicts, note);
      if (errors.length) throw new Error(errors.map((e) => e.message).join('; '));

      const persona = personas[personaKey];
      const full = fullVerdicts(p, verdicts);
      const bar = review.computeBar(p.rubric, full);
      console.log(`  ${bar.counts.covered} covered, ${bar.counts.partial} partial, ${bar.counts.missed} missed — bar ${bar.label}, score ${bar.score}`);
      full.filter((v) => v.verdict !== 'covered').forEach((v) => console.log(`  ${MARK[v.verdict]} ${v.id}  ${v.gap}`));

      if (!OFFLINE) {
        verdictsBytes = Buffer.from(`${JSON.stringify({
          reviewer: MODEL, persona: personaKey, pillar: p.key, scope, note,
          verdicts: verdicts.map(({ id, verdict, evidence, gap, ref }) => ({ id, verdict, evidence, gap, ref })),
        }, null, 2)}\n`, 'utf8');
      }
      const r = { p, full, bar, note, scope, persona };
      const md = buildPillarMarkdown(r);
      const docxBuf = await docxBuffer('PILLAR REVIEW', (B) => pillarDocxBody(r, B));

      // ── writes ──
      const outMd = doc('reviews', `Pillar_Review_${p.key}.md`);
      const outDocx = outMd.replace(/\.md$/, '.docx');
      fs.writeFileSync(outMd, md, 'utf8');
      console.log(`  ✓ ${path.basename(outMd)}`);
      fs.writeFileSync(outDocx, docxBuf);
      console.log(`  ✓ ${path.basename(outDocx)}`);
      if (verdictsBytes) {
        fs.mkdirSync(path.dirname(verdictsPath), { recursive: true });
        fs.writeFileSync(verdictsPath, verdictsBytes);
        console.log(`  ✓ ${review.relPath(verdictsPath)}`);
      }
      const bytes = verdictsBytes || fs.readFileSync(verdictsPath);
      const st = review.readState();
      st.pillars[p.key] = {
        fingerprint: p.fp.hash,
        reviewed: new Date().toISOString(),
        rubric: `${p.rubric.id} v${p.rubric.version}`,
        persona: personaKey,
        reviewer,
        verdicts: review.relPath(verdictsPath),
        verdicts_sha256: review.sha256(bytes),
        bar: bar.label,
        score: bar.score,
        open_musts: bar.openMusts,
        should_missed: bar.shouldMissed,
        probes: Object.fromEntries(p.probes.map((x) => [x.id, x.verdict])),
        outputs: [outMd, outDocx],
      };
      review.writeState(st);
      console.log(`  ✓ ${review.relPath(review.STATE_PATH)} (${p.key} @ ${p.fp.short})`);

      if (JSON_OUT) {
        const target = keys.length > 1 ? JSON_OUT.replace(/(\.json)?$/, `.${p.key}.json`) : JSON_OUT;
        fs.writeFileSync(target, JSON.stringify({
          pillar: p.key, rubric: p.rubric.id, version: p.rubric.version, model: MODEL,
          generated: new Date().toISOString(), bar, note, verdicts: full,
        }, null, 2), 'utf8');
        console.log(`  ✓ ${target}`);
      }
      console.log(`\n${path.dirname(outMd)}\n  ${path.basename(outMd)}\n  ${path.basename(outDocx)}`);
    } catch (e) {
      if (keys.length === 1) throw e;
      console.error(`  ✗ ${p.key}: ${e.message}`);
      failures.push(p.key);
    }
  }
  if (failures.length) throw new Error(`${failures.length} pillar(s) not published: ${failures.join(', ')}`);
}

// ─── Judge mode ─────────────────────────────────────────────────────────────

function buildCeoMarkdown({ items, rulings, memo }) {
  const by = new Map(rulings.map((r) => [r.pillar, r]));
  const tally = rulings.reduce((a, r) => ((a[r.ruling] = (a[r.ruling] || 0) + 1), a), {});
  const table = items.map((it) => {
    const r = by.get(it.key);
    return `| ${review.PILLAR_LABEL[it.key]} | ${cell(`${it.persona.name}, ${it.persona.role}`)} | ${it.bar.label} | ${it.bar.score} | ${r.ruling.toUpperCase()}${r.reason ? ` — ${cell(r.reason)}` : ''} | ${it.bar.openMusts.join(', ') || '—'} |`;
  }).join('\n');
  const appendices = items.map((it, i) => {
    const crit = review.criteriaOf(it.p.rubric);
    const vb = new Map(it.full.map((v) => [v.id, v]));
    const rows = crit.map((c) => { const v = vb.get(c.id); return `| ${MARK[v.verdict]} | ${c.id} | ${cell(c.name)} | ${c.weight} | ${c.judge_on} | ${v.verdict} | ${cell(noteFor(v, c))} |`; }).join('\n');
    return `## Appendix ${String.fromCharCode(65 + i)} — ${review.PILLAR_LABEL[it.key]} (${it.persona.name}, ${it.persona.role})

Bar ${barLine(it.bar)}. Score ${it.bar.score}. Reviewed ${it.entry.reviewed.slice(0, 10)} against \`generators/rubrics/pillars/${it.key}.json\` v${it.p.rubric.version}, inputs ${it.p.fp.short}.

> ${it.note.trim().replace(/\n+/g, '\n> ')}

| | ID | Criterion | Weight | Judged on | Verdict | Evidence / note |
|---|---|---|---|---|---|---|
${rows}`;
  }).join('\n\n');

  return `# Executive ruling — Project Qlarity pillar reviews

**From:** Ingrid van der Berg, Chief Executive Officer
**Subject:** Pillar videos — ruling on ${items.map((it) => review.PILLAR_LABEL[it.key]).join(', ')}
**Date:** ${today()}
**Reviewers:** ${items.map((it) => `${it.persona.name} (${review.PILLAR_LABEL[it.key]})`).join(', ')}
**Result:** ${['pass', 'hold', 'fail'].map((k) => `${tally[k] || 0} ${k}`).join(', ')}

---

## Ruling

| Pillar | Reviewer | Bar | Score | Ruling | Open musts |
|---|---|---|---|---|---|
${table}

The bar is computed in code from each pillar's verdicts: every must covered, shoulds missed within the rubric's allowance. A ruling may hold a passing pillar; it cannot pass a failing one.

---

${memo.trim()}

---

${appendices}
`;
}

function ceoDocxBody({ items, rulings, memo }, B) {
  const by = new Map(rulings.map((r) => [r.pillar, r]));
  const tally = rulings.reduce((a, r) => ((a[r.ruling] = (a[r.ruling] || 0) + 1), a), {});
  const body = [
    B.heading('Executive Ruling — Project Qlarity Pillar Reviews'),
    B.metadataTable([
      ['From', 'Ingrid van der Berg, Chief Executive Officer'],
      ['Subject', `Pillar videos — ruling on ${items.map((it) => review.PILLAR_LABEL[it.key]).join(', ')}`],
      ['Date', today()],
      ['Reviewers', items.map((it) => `${it.persona.name} (${review.PILLAR_LABEL[it.key]})`).join(', ')],
      ['Result', ['pass', 'hold', 'fail'].map((k) => `${tally[k] || 0} ${k}`).join(' · ')],
      ['Classification', 'Internal — Project Qlarity steering'],
    ]),
    B.heading('Ruling', 2),
    B.dataTable(
      ['Pillar', 'Reviewer', 'Bar', 'Score', 'Ruling', 'Open musts'],
      items.map((it) => {
        const r = by.get(it.key);
        return [review.PILLAR_LABEL[it.key], `${it.persona.name}, ${it.persona.role}`, it.bar.label, it.bar.score,
          `${r.ruling.toUpperCase()}${r.reason ? ` — ${r.reason}` : ''}`, it.bar.openMusts.join(', ') || '—'];
      }),
    ),
    B.calloutBox('The bar is computed in code from each pillar\'s verdicts. A ruling may hold a passing pillar; it cannot pass a failing one.', (tally.fail || 0) > 0 ? 'warning' : 'info'),
  ];
  memo.split(/\n{2,}/).forEach((p) => {
    const t = p.trim();
    if (!t) return;
    if (/^#{1,3}\s/.test(t)) body.push(B.heading(t.replace(/^#{1,3}\s*/, ''), 2));
    else body.push(B.para(t.replace(/\*\*/g, '')));
  });
  items.forEach((it, i) => {
    const crit = review.criteriaOf(it.p.rubric);
    const vb = new Map(it.full.map((v) => [v.id, v]));
    body.push(B.heading(`Appendix ${String.fromCharCode(65 + i)} — ${review.PILLAR_LABEL[it.key]} (${it.persona.name})`, 2));
    body.push(B.para(`Bar ${barLine(it.bar)}. Score ${it.bar.score}. Reviewed ${it.entry.reviewed.slice(0, 10)}, inputs ${it.p.fp.short}.`));
    it.note.split(/\n{2,}/).map((t) => t.trim()).filter(Boolean).forEach((t) => body.push(B.para(t, { indent: true })));
    body.push(B.dataTable(
      ['ID', 'Criterion', 'Weight', 'Judged on', 'Verdict', 'Evidence / note'],
      crit.map((c) => { const v = vb.get(c.id); return [c.id, c.name, c.weight, c.judge_on, v.verdict, noteFor(v, c)]; }),
    ));
  });
  body.push(...B.signatureBlock('Ingrid van der Berg', 'Chief Executive Officer', 'Executive Sponsor, Project Qlarity'));
  return body;
}

async function runJudge() {
  const keys = PILLAR_ARG && PILLAR_ARG !== 'all' ? [PILLAR_ARG] : review.PILLARS;
  const personas = review.loadPersonas();
  const ceo = personas.ingrid;
  const state = review.readState();
  const warn = review.checkoutWarning(state);
  if (warn) console.log(`  ${warn}`);
  console.log(`judge   : ${ceo.name}, ${ceo.role} — ${keys.length} pillar(s): ${keys.join(', ')}`);
  console.log(`scripts : ${SERIES_DIR}`);
  console.log(`state   : ${review.relPath(review.STATE_PATH)}`);

  // Every pillar must have a published review that still describes the video.
  const items = [];
  const problems = [];
  for (const key of keys) {
    const p = preparePillar(key, personas);
    const entry = state.pillars[key];
    if (!entry) { problems.push(`${key}: no published pillar review — run --pillar ${key} first`); continue; }
    if (entry.fingerprint !== p.fp.hash) {
      problems.push(`${key}: stale — inputs changed since the review of ${String(entry.reviewed).slice(0, 10)} (reviewed ${String(entry.fingerprint).slice(0, 12)}, now ${p.fp.short}); re-run --pillar ${key}`);
      continue;
    }
    const vp = review.resolveRecorded(entry.verdicts);
    if (!fs.existsSync(vp)) { problems.push(`${key}: published verdicts ${entry.verdicts} not found`); continue; }
    const bytes = fs.readFileSync(vp);
    if (entry.verdicts_sha256 && review.sha256(bytes) !== entry.verdicts_sha256) {
      problems.push(`${key}: ${entry.verdicts} changed after it was published — re-run --pillar ${key}`);
      continue;
    }
    let data;
    try { data = readPillarFile(p, vp, personas); } catch (e) { problems.push(`${key}: ${e.message}`); continue; }
    const errors = gatePillar(p, data.verdicts, data.note);
    if (errors.length) { problems.push(`${key}: ${errors.map((e) => e.message).join('; ')}`); continue; }
    const full = fullVerdicts(p, data.verdicts);
    const bar = review.computeBar(p.rubric, full);
    items.push({ key, p, entry, full, bar, note: data.note, persona: personas[data.personaKey] });
  }
  items.forEach((it) => console.log(`          ${it.key.padEnd(12)} ${it.persona.name.padEnd(20)} ${it.bar.label}  ${it.bar.score.padEnd(13)} open musts: ${it.bar.openMusts.join(', ') || 'none'}`));
  problems.forEach((x) => console.log(`          ✗ ${x}`));

  const context = loadContext();
  console.log(`context : ${context.map((c) => c.name).join(', ') || '(none found)'}`);

  if (DRY) {
    console.log(`\n${'='.repeat(70)}\nDRY RUN — no API call. Prompts that would be sent:\n`);
    console.log(`--- judge system (${CEO_JUDGE_SYSTEM.length} chars) ---\n${CEO_JUDGE_SYSTEM}\n`);
    if (items.length) {
      const jp = judgePrompt(items, context);
      console.log(`--- judge user (${jp.length} chars) ---\n${jp.slice(0, jp.indexOf('<company_context>'))}<company_context>… ${context.reduce((n, c) => n + c.text.length, 0)} chars …</company_context>\n`);
    }
    if (problems.length) console.log(`(a real run would refuse: ${problems.length} pillar(s) missing or stale)`);
    console.log(`\nmodel: ${MODEL}`);
    return;
  }
  if (problems.length) throw new Error(`cannot rule — pillar verdicts are missing or stale:\n  ${problems.join('\n  ')}`);

  const bars = Object.fromEntries(items.map((it) => [it.key, it.bar]));
  const gate = (rs) => review.gateRulings({ bars, rulings: rs, pillars: keys });

  let rulings;
  let memo;
  let memoPath = null;
  let rulingsPath = null;
  let memoBytes = null;
  let rulingsBytes = null;
  if (OFFLINE) {
    const parsed = CeoRulingSchema.safeParse(JSON.parse(fs.readFileSync(RULINGS_IN, 'utf8')));
    if (!parsed.success) throw new Error(`${RULINGS_IN}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
    rulings = parsed.data.rulings;
    memo = fs.readFileSync(MEMO_IN, 'utf8').trim();
    if (!memo) throw new Error(`${MEMO_IN} is empty`);
    memoPath = path.resolve(MEMO_IN);
    rulingsPath = path.resolve(RULINGS_IN);
    console.log(`\noffline: ${rulings.length} ruling(s) from ${path.basename(RULINGS_IN)}, memo from ${path.basename(MEMO_IN)}`);
  } else {
    apiPreflight();
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic();
    console.log('\nIngrid is ruling...');
    const out = await parseWithReask({
      client,
      system: CEO_JUDGE_SYSTEM,
      content: judgePrompt(items, context),
      schema: JudgeOutputSchema,
      maxTokens: 16000,
      gate: (o) => gate(o.rulings),
      label: 'the judge',
    });
    rulings = out.rulings;
    memo = String(out.memo || '').trim();
    if (!memo) throw new Error('the judge returned no memo');
    memoPath = path.join(review.STATE_DIR, `${today()}-ceo.memo.md`);
    rulingsPath = path.join(review.STATE_DIR, `${today()}-ceo.rulings.json`);
    memoBytes = Buffer.from(`${memo}\n`, 'utf8');
    rulingsBytes = Buffer.from(`${JSON.stringify({ rulings }, null, 2)}\n`, 'utf8');
  }

  const errors = gate(rulings);
  if (errors.length) throw new Error(errors.map((e) => e.message).join('; '));
  rulings.forEach((r) => console.log(`  ${r.pillar.padEnd(12)} bar ${bars[r.pillar].label} → ${r.ruling.toUpperCase()}${r.reason ? `  ${r.reason}` : ''}`));

  const md = buildCeoMarkdown({ items, rulings, memo });
  const docxBuf = await docxBuffer('EXECUTIVE RULING', (B) => ceoDocxBody({ items, rulings, memo }, B));

  // ── writes ──
  const outMd = doc('reviews', 'CEO_Pillar_Review.md');
  const outDocx = outMd.replace(/\.md$/, '.docx');
  fs.writeFileSync(outMd, md, 'utf8');
  console.log(`  ✓ ${path.basename(outMd)}`);
  fs.writeFileSync(outDocx, docxBuf);
  console.log(`  ✓ ${path.basename(outDocx)}`);
  if (memoBytes) { fs.mkdirSync(path.dirname(memoPath), { recursive: true }); fs.writeFileSync(memoPath, memoBytes); console.log(`  ✓ ${review.relPath(memoPath)}`); }
  if (rulingsBytes) { fs.writeFileSync(rulingsPath, rulingsBytes); console.log(`  ✓ ${review.relPath(rulingsPath)}`); }
  const st = review.readState();
  st.ceo = {
    ruled: new Date().toISOString(),
    pillars: keys,
    memo: review.relPath(memoPath),
    rulings_file: review.relPath(rulingsPath),
    rulings: rulings.map((r) => ({
      pillar: r.pillar, ruling: r.ruling, reason: r.reason || '',
      bar: bars[r.pillar].label, score: bars[r.pillar].score,
      fingerprint: items.find((it) => it.key === r.pillar).p.fp.hash,
    })),
    outputs: [outMd, outDocx],
  };
  review.writeState(st);
  console.log(`  ✓ ${review.relPath(review.STATE_PATH)} (ruling)`);
  console.log(`\n${path.dirname(outMd)}\n  ${path.basename(outMd)}\n  ${path.basename(outDocx)}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

(async () => {
  if (MODE === 'pillar') return runPillars();
  if (MODE === 'judge') return runJudge();

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

  // The gate: every criterion exactly once, no invented ids, evidence verbatim
  // from the narration, and evidence present exactly when the verdict needs it.
  const allNarration = review.norm(scripts.flatMap((s) => s.scenes.map((x) => x.narration)).join(' '));
  const gate = (vs) => review.gateVerdicts({ mode: 'legacy', criteria: dims.flatMap((d) => d.criteria), verdicts: vs, narration: allNarration });

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
    apiPreflight();
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic();

    console.log(`\nclassifying ${nCriteria} criteria against ${nScenes} narrated scenes...`);
    const classified = await parseWithReask({
      client,
      system: CLASSIFY_SYSTEM,
      content: classifyPrompt(dims, scripts),
      schema: VerdictSchema,
      maxTokens: 16000,
      gate: (o) => gate(o.verdicts),
      label: 'classifier',
    });
    verdicts = classified.verdicts;
  }

  const gateErrors = gate(verdicts);
  if (gateErrors.length) throw new Error(gateErrors.map((e) => e.message).join('; '));

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
