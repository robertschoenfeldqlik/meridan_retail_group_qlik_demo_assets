#!/usr/bin/env node
/**
 * review-deck.js — score a built slide deck against its rubric, as the
 * executive who owns that pillar, and publish the review.
 * ============================================================================
 * The deck counterpart of gen-ceo-video-review.js --pillar. The rubric lives in
 * `rubrics/decks/<key>.json`, the reviewer in `rubrics/personas.json`, and the
 * verdicts are supplied as a file (offline, like --pillar --verdicts). Nothing
 * is published until every verdict holds up against the deck on disk:
 *
 *   - one verdict per criterion, covered / partial / missed;
 *   - every `ref` names slides inside the rubric's slide range;
 *   - `slide` verdicts: every "double-quoted" phrase in the evidence is printed
 *     on one of the referenced slides;
 *   - `screen` verdicts: every referenced slide carries a picture.
 *
 * Usage:
 *   node generators/review-deck.js --verdicts v.json [--rubric integration] [--deck file.pptx]
 *   node generators/review-deck.js --verdicts v.json --dry-run    # gate + score, write nothing
 *   node generators/review-deck.js --dump [--rubric integration] [--deck file.pptx] [--out dir]
 *       # what a reviewer reads: the rubric's slides as text + notes, every picture extracted to --out
 */

'use strict';

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const { doc, deck: deckPath } = require('./lib/asset-paths');
const review = require('./lib/rubric-review');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const KEY = String(val('--rubric', 'integration')).toLowerCase();
const VERDICTS_IN = val('--verdicts', null);
const DRY = has('--dry-run');
const DUMP = has('--dump');
const RUBRIC_PATH = path.join(review.RUBRICS_DIR, 'decks', `${KEY}.json`);
const MARK = { covered: '✓', partial: '~', missed: '✗' };
const VERDICTS = ['covered', 'partial', 'missed'];

// ─── Deck text ──────────────────────────────────────────────────────────────

const unxml = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');

/** Paragraph text of one slide or notes part: runs joined, paragraphs on new lines. */
function partText(xml) {
  return (xml.match(/<a:p>[\s\S]*?<\/a:p>/g) || [])
    .map((p) => (p.match(/<a:t>([\s\S]*?)<\/a:t>/g) || []).map((t) => unxml(t.replace(/<\/?a:t>/g, ''))).join(''))
    .filter((t) => t.trim())
    .join('\n');
}

const relTarget = (rels, id) => { const m = rels.match(new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`)) || rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${id}"`)); return m && m[1]; };

/** Slides in presentation order: { n, text, notes, pictures, media } — media are the zip paths of the pictures. */
async function readDeck(file, zip) {
  zip = zip || await JSZip.loadAsync(fs.readFileSync(file));
  const read = (p) => (zip.file(p) ? zip.file(p).async('string') : Promise.resolve(''));
  const pres = await read('ppt/presentation.xml');
  const presRels = await read('ppt/_rels/presentation.xml.rels');
  const ids = [...pres.matchAll(/<p:sldId [^>]*r:id="([^"]+)"/g)].map((m) => m[1]);
  const slides = [];
  for (const [i, rid] of ids.entries()) {
    const target = relTarget(presRels, rid);
    const part = path.posix.join('ppt', target.replace(/^\/?ppt\//, ''));
    const xml = await read(part);
    const rels = await read(path.posix.join(path.posix.dirname(part), '_rels', `${path.posix.basename(part)}.rels`));
    const notesTarget = (rels.match(/Target="([^"]*notesSlide[^"]*)"/) || [])[1];
    const notes = notesTarget ? partText(await read(path.posix.normalize(path.posix.join(path.posix.dirname(part), notesTarget)))) : '';
    const media = (xml.match(/<p:pic>[\s\S]*?<\/p:pic>/g) || [])
      .map((pic) => { const id = (pic.match(/r:embed="([^"]+)"/) || [])[1]; const t = id && relTarget(rels, id); return t && path.posix.normalize(path.posix.join(path.posix.dirname(part), t)); })
      .filter(Boolean);
    slides.push({ n: i + 1, text: partText(xml), notes: notes.replace(/^\d+$/m, '').trim(), pictures: (xml.match(/<p:pic>/g) || []).length, media });
  }
  return slides;
}

// ─── Gate ───────────────────────────────────────────────────────────────────

const norm = (s) => String(s).replace(/[ \s]+/g, ' ').trim().toLowerCase();

/** "deck#s19,s22" → [19, 22]; null when the ref is malformed. */
function parseRef(ref) {
  const m = /^deck#(s\d+(?:,s\d+)*)$/.exec(String(ref || '').replace(/\s+/g, ''));
  return m ? m[1].split(',').map((s) => Number(s.slice(1))) : null;
}

function gate(rubric, slides, data) {
  const errors = [];
  const crit = review.criteriaOf(rubric);
  const [lo, hi] = rubric.slides;
  const byN = new Map(slides.map((s) => [s.n, s]));
  const seen = new Map();
  for (const v of data.verdicts) {
    if (seen.has(v.id)) errors.push(`${v.id}: given twice`);
    seen.set(v.id, v);
  }
  for (const c of crit) {
    const v = seen.get(c.id);
    if (!v) { errors.push(`${c.id}: no verdict`); continue; }
    if (!VERDICTS.includes(v.verdict)) { errors.push(`${c.id}: verdict "${v.verdict}" is not ${VERDICTS.join(' / ')}`); continue; }
    if (v.verdict !== 'covered' && !String(v.gap || '').trim()) errors.push(`${c.id}: ${v.verdict} needs a gap`);
    if (v.verdict === 'missed' && !v.ref) continue; // nothing on the slides to point at
    const ns = parseRef(v.ref);
    if (!ns) { errors.push(`${c.id}: ref "${v.ref || ''}" is not deck#sN[,sM]`); continue; }
    const outside = ns.filter((n) => n < lo || n > hi || !byN.has(n));
    if (outside.length) { errors.push(`${c.id}: slide(s) ${outside.join(', ')} outside the rubric's range ${lo}–${hi}`); continue; }
    if (c.judge_on === 'screen') {
      const bare = ns.filter((n) => byN.get(n).pictures < 2); // every content slide carries the Qlik logo
      if (bare.length) errors.push(`${c.id}: slide(s) ${bare.join(', ')} carry no capture`);
    }
    if (c.judge_on === 'slide') {
      const quotes = [...String(v.evidence || '').matchAll(/"([^"]{3,})"/g)].map((m) => m[1]);
      if (v.verdict !== 'missed' && !quotes.length) errors.push(`${c.id}: ${v.verdict} slide verdict quotes nothing from the slides`);
      const hay = ns.map((n) => norm(`${byN.get(n).text}\n${byN.get(n).notes}`));
      quotes.filter((q) => !hay.some((h) => h.includes(norm(q)))).forEach((q) => errors.push(`${c.id}: "${q}" is not on ${v.ref}`));
    }
  }
  for (const id of seen.keys()) if (!crit.find((c) => c.id === id)) errors.push(`${id}: not a criterion of ${rubric.id}`);
  if (!String(data.note || '').trim()) errors.push('the review carries no persona note');
  return errors;
}

// ─── Output ─────────────────────────────────────────────────────────────────

const cell = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
const today = () => new Date().toISOString().slice(0, 10);
const noteFor = (v) => [v.evidence, v.ref ? `(${v.ref})` : '', v.gap].filter(Boolean).join(' ');
const barLine = (bar) => `${bar.label} — ${bar.openMusts.length ? `${bar.openMusts.length} must(s) open (${bar.openMusts.join(', ')})` : 'every must covered'}; ${bar.shouldMissed.length} should(s) missed (max ${bar.shouldMissedMax})`;

function buildMarkdown(r) {
  const { rubric, persona, bar, data, verdicts, deckFile } = r;
  const label = review.PILLAR_LABEL[rubric.pillar] || rubric.pillar;
  const rows = review.criteriaOf(rubric).map((c) => {
    const v = verdicts.get(c.id);
    return `| ${MARK[v.verdict]} | ${c.id} | ${cell(c.name)} | ${c.weight} | ${c.judge_on} | ${v.verdict} | ${cell(noteFor(v))} |`;
  }).join('\n');
  return `# Deck review — ${label}

**From:** ${persona.name}, ${persona.role}
**To:** Ingrid van der Berg, Chief Executive Officer
**Subject:** ${label} pillar — slide deck review
**Date:** ${today()}
**Material reviewed:** ${path.basename(deckFile)}, slides ${rubric.slides[0]}–${rubric.slides[1]}
**Bar:** ${barLine(bar)}
**Score:** ${bar.score} — informational

---

${data.note.trim()}

---

## Criteria

Scored against \`generators/rubrics/decks/${KEY}.json\` v${rubric.version}. ${data.scope || ''}

| | ID | Criterion | Weight | Judged on | Verdict | Evidence / note |
|---|---|---|---|---|---|---|
${rows}
`;
}

function docxBody(r, B) {
  const { rubric, persona, bar, data, verdicts, deckFile } = r;
  const label = review.PILLAR_LABEL[rubric.pillar] || rubric.pillar;
  const body = [
    B.heading(`Deck Review — ${label}`),
    B.metadataTable([
      ['From', `${persona.name}, ${persona.role}`],
      ['To', 'Ingrid van der Berg, Chief Executive Officer'],
      ['Subject', `${label} pillar — slide deck review`],
      ['Date', today()],
      ['Material Reviewed', `${path.basename(deckFile)}, slides ${rubric.slides[0]}–${rubric.slides[1]}`],
      ['Bar', barLine(bar)],
      ['Score', `${bar.score} — informational`],
    ]),
    B.calloutBox(`Bar ${barLine(bar)}.`, bar.pass ? 'success' : 'warning'),
  ];
  data.note.split(/\n{2,}/).map((t) => t.trim()).filter(Boolean).forEach((t) => body.push(B.para(t.replace(/\*\*/g, ''))));
  body.push(B.heading('Criteria', 2));
  body.push(B.para(`Scored against the ${label} deck rubric v${rubric.version}. ${data.scope || ''}`));
  body.push(B.dataTable(
    ['ID', 'Criterion', 'Weight', 'Judged on', 'Verdict', 'Evidence / note'],
    review.criteriaOf(rubric).map((c) => { const v = verdicts.get(c.id); return [c.id, c.name, c.weight, c.judge_on, v.verdict, noteFor(v)]; }),
  ));
  body.push(...B.signatureBlock(persona.name, persona.role, `${label} pillar reviewer, Project Qlarity`));
  return body;
}

// ─── Dump ───────────────────────────────────────────────────────────────────

// Written into every dump folder. A folder is only ever emptied when it carries
// this marker, so `--out .` or `--out <assets root>` can never wipe real files.
const DUMP_MARKER = '.mcg-deck-dump';

/** Empty `out` for a fresh dump: only a folder that is missing, empty, or an earlier dump. */
function prepareDumpDir(out) {
  if (fs.existsSync(out)) {
    const entries = fs.readdirSync(out);
    if (entries.length > 0 && !entries.includes(DUMP_MARKER)) {
      throw new Error(`--out ${out} is not empty and is not an earlier deck dump — refusing to clear it. Pick an empty or new folder.`);
    }
    fs.rmSync(out, { recursive: true, force: true });
  }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, DUMP_MARKER), 'Pictures written by generators/review-deck.js --dump. Safe to delete.\n');
}

/** The rubric's slides as a reviewer reads them; pictures are written to `out` so they can be opened. */
async function dump(rubric, deckFile) {
  const out = path.resolve(val('--out', path.join(require('os').tmpdir(), 'mcg-deck-review', KEY)));
  const zip = await JSZip.loadAsync(fs.readFileSync(deckFile));
  const slides = await readDeck(deckFile, zip);
  const [lo, hi] = rubric.slides;
  prepareDumpDir(out);
  console.log(`rubric  : ${rubric.id} v${rubric.version} — scores slides ${lo}–${hi}`);
  console.log(`deck    : ${deckFile} (${slides.length} slides, modified ${fs.statSync(deckFile).mtime.toISOString()})`);
  console.log(`pictures: ${out}`);
  for (const s of slides.filter((x) => x.n >= lo && x.n <= hi)) {
    const files = [];
    for (const [i, m] of s.media.entries()) {
      const f = zip.file(m);
      if (!f) continue;
      const name = `s${String(s.n).padStart(2, '0')}-${i + 1}${path.posix.extname(m)}`;
      fs.writeFileSync(path.join(out, name), await f.async('nodebuffer'));
      files.push(name);
    }
    console.log(`\n── slide ${s.n} · ${s.pictures} picture(s)`);
    console.log(s.text || '(no text)');
    if (s.notes) console.log(`\nnotes: ${s.notes}`);
    if (files.length) console.log(`\npictures: ${files.map((f) => path.join(out, f)).join('\n          ')}`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!VERDICTS_IN && !DUMP) { console.error('usage: node generators/review-deck.js --verdicts v.json [--rubric integration] [--deck file.pptx] [--dry-run]\n       node generators/review-deck.js --dump [--rubric integration] [--deck file.pptx] [--out dir]'); process.exit(2); }
  const rubric = JSON.parse(fs.readFileSync(RUBRIC_PATH, 'utf8'));
  const persona = review.loadPersonas()[rubric.persona];
  if (!persona) throw new Error(`persona "${rubric.persona}" is not in ${review.relPath(review.PERSONAS_PATH)}`);
  const deckFile = path.resolve(val('--deck', deckPath(rubric.deck)));
  if (DUMP) { await dump(rubric, deckFile); return; }
  const slides = await readDeck(deckFile);
  const data = JSON.parse(fs.readFileSync(VERDICTS_IN, 'utf8'));
  if (data.rubric && data.rubric !== rubric.id) throw new Error(`${VERDICTS_IN}: verdicts are for ${data.rubric}, not ${rubric.id}`);

  console.log(`rubric  : ${rubric.id} v${rubric.version}, ${review.criteriaOf(rubric).length} criteria — ${review.relPath(RUBRIC_PATH)}`);
  console.log(`reviewer: ${persona.name}, ${persona.role}`);
  console.log(`deck    : ${deckFile} (${slides.length} slides; scoring ${rubric.slides[0]}–${rubric.slides[1]})`);

  const errors = gate(rubric, slides, data);
  if (errors.length) { errors.forEach((e) => console.error(`  ✗ ${e}`)); throw new Error(`${errors.length} verdict problem(s) — nothing published`); }

  const verdicts = new Map(data.verdicts.map((v) => [v.id, v]));
  const bar = review.computeBar(rubric, data.verdicts);
  console.log(`  ${bar.counts.covered} covered, ${bar.counts.partial} partial, ${bar.counts.missed} missed — bar ${bar.label}, score ${bar.score}`);
  data.verdicts.filter((v) => v.verdict !== 'covered').forEach((v) => console.log(`  ${MARK[v.verdict]} ${v.id}  ${v.gap}`));
  if (DRY) { console.log('dry run — nothing written'); return; }

  const r = { rubric, persona, bar, data, verdicts, deckFile };
  const B = require('./mcg-docx-builder');
  const { Packer } = require('docx');
  const outMd = doc('reviews', `Deck_Review_${KEY}.md`);
  const outDocx = outMd.replace(/\.md$/, '.docx');
  const buf = await Packer.toBuffer(B.buildDocument('DECK REVIEW', docxBody(r, B)));
  fs.writeFileSync(outMd, buildMarkdown(r), 'utf8');
  fs.writeFileSync(outDocx, buf);
  console.log(`  ✓ ${outMd}\n  ✓ ${outDocx}`);
}

main().catch((e) => { console.error(`error: ${e.message}`); process.exit(1); });
