#!/usr/bin/env node
// ---------------------------------------------------------------------------
//  generate-all.js
//  Runs all MCG content generators in the correct dependency order.
//
//  Usage:
//    node generators/generate-all.js          # run all generators
//    node generators/generate-all.js --list   # list generators without running
//    node generators/generate-all.js --only sops,carriers  # run specific groups
// ---------------------------------------------------------------------------

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_DIR = path.resolve(__dirname, '..');
const GEN_DIR = __dirname;

// ---------------------------------------------------------------------------
//  Generator registry — ordered by dependency
// ---------------------------------------------------------------------------

const GENERATORS = [
  // Phase 0: Rasterize Qlik line-art icons (SVG → square PNG) for deck diagrams
  {
    name: 'icons',
    script: 'lib/render-icons.js',
    label: 'Qlik Line-Art Icons (SVG → PNG)',
    group: 'assets',
  },

  // Phase 1: Logos and base assets (no dependencies)
  {
    name: 'logos',
    script: 'gen-mcg-logo.js',
    label: 'MCG Logos & Brand Assets',
    group: 'assets',
  },

  // Phase 2: Core business documents (depend on logos/assets)
  {
    name: 'sops',
    script: 'gen-sops-enriched.js',
    label: 'Standard Operating Procedures (enriched)',
    group: 'documents',
  },
  {
    name: 'policies',
    script: 'gen-policies-v2.js',
    label: 'Company Policies (v2)',
    group: 'documents',
  },
  {
    name: 'carriers',
    script: 'gen-carriers-enriched.js',
    label: 'Carrier Contracts & Incidents (enriched)',
    group: 'documents',
  },
  {
    name: 'governance',
    script: 'gen-governance-v2.js',
    label: 'Governance & Compliance Documents',
    group: 'documents',
  },
  {
    name: 'business',
    script: 'gen-business-v2.js',
    label: 'Business Documents (v2)',
    group: 'documents',
  },

  // Phase 3: Glossary and data reference
  {
    name: 'glossary',
    script: 'gen-glossary-excel.js',
    label: 'Business Glossary (Excel)',
    group: 'data',
  },

  // Phase 4: Demo scripts and guides (depend on documents existing)
  {
    name: 'demo-scripts',
    script: 'gen-demo-scripts.js',
    label: 'Demo Walkthrough Scripts (18 topics)',
    group: 'demos',
  },
  {
    name: 'setup-guide',
    script: 'gen-setup-guide.js',
    label: 'Setup Guide (DOCX)',
    group: 'demos',
  },
  {
    name: 'creation-guide',
    script: 'gen-creation-guide.js',
    label: 'Automations & Pipelines Creation Guide (DOCX)',
    group: 'demos',
  },

  // Phase 5: Presentations (depend on assets + documents)
  {
    name: 'architecture',
    script: 'gen-architecture.js',
    label: 'Technology Architecture Deck',
    group: 'presentations',
  },
  {
    name: 'demo-overview',
    script: 'gen-demo-overview.js',
    label: 'Demo Overview Presentation',
    group: 'presentations',
  },
  {
    name: 'agentic-engineering',
    script: 'gen-agentic-engineering.js',
    label: 'Agentic Data Engineering Deck',
    group: 'presentations',
  },
  {
    name: 'project-qlarity',
    script: 'gen-project-qlarity-summary.js',
    label: 'Project Qlarity Summary Deck',
    group: 'presentations',
  },
  {
    name: 'company-profile',
    script: 'gen-pptx.js',
    label: 'Company Profile & Data Quality Deck',
    group: 'presentations',
  },
];

// ---------------------------------------------------------------------------
//  CLI parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const listOnly = args.includes('--list');
let onlyGroups = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--only' && args[i + 1]) {
    onlyGroups = args[i + 1].split(',').map(s => s.trim().toLowerCase());
  }
}

// ---------------------------------------------------------------------------
//  Execution
// ---------------------------------------------------------------------------

const BAR = '='.repeat(60);

function log(msg) { console.log(msg); }
function logOK(msg) { console.log(`  \x1b[32mOK\x1b[0m  ${msg}`); }
function logFAIL(msg) { console.error(`  \x1b[31mFAIL\x1b[0m  ${msg}`); }
function logSKIP(msg) { console.log(`  \x1b[33mSKIP\x1b[0m  ${msg}`); }

log(`\n${BAR}`);
log('  MCG Content Generator — All-in-One');
log(`${BAR}\n`);

// Filter generators
let generators = GENERATORS.filter(g => {
  const scriptPath = path.join(GEN_DIR, g.script);
  if (!fs.existsSync(scriptPath)) {
    logSKIP(`${g.label} — script not found: ${g.script}`);
    return false;
  }
  if (onlyGroups && !onlyGroups.includes(g.group) && !onlyGroups.includes(g.name)) {
    return false;
  }
  return true;
});

if (listOnly) {
  log('Available generators:\n');
  const groups = {};
  for (const g of GENERATORS) {
    if (!groups[g.group]) groups[g.group] = [];
    groups[g.group].push(g);
  }
  for (const [group, gens] of Object.entries(groups)) {
    log(`  ${group.toUpperCase()}`);
    for (const g of gens) {
      const exists = fs.existsSync(path.join(GEN_DIR, g.script));
      const status = exists ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      log(`    ${status}  ${g.name.padEnd(16)} ${g.label}`);
      log(`       ${g.script}`);
    }
    log('');
  }
  log(`Total: ${GENERATORS.length} generators`);
  log(`\nUsage: node generators/generate-all.js --only sops,carriers,demos`);
  process.exit(0);
}

if (onlyGroups && generators.length === 0) {
  const validNames = GENERATORS.map(g => g.name).sort();
  const validGroups = [...new Set(GENERATORS.map(g => g.group))].sort();
  logFAIL(`--only "${onlyGroups.join(',')}" matched no generators.`);
  log(`\n  Valid group names: ${validGroups.join(', ')}`);
  log(`  Valid generator names: ${validNames.join(', ')}`);
  log('');
  process.exit(1);
}

log(`Running ${generators.length} generator(s)...\n`);

const startTime = Date.now();
let passed = 0;
let failed = 0;
const failures = [];

for (let i = 0; i < generators.length; i++) {
  const g = generators[i];
  const stepNum = `[${i + 1}/${generators.length}]`;
  const scriptPath = path.join(GEN_DIR, g.script);

  log(`${BAR}`);
  log(`  ${stepNum} ${g.label}`);
  log(`  > node ${g.script}`);
  log(`${BAR}`);

  try {
    execSync(`node "${scriptPath}"`, {
      cwd: PROJECT_DIR,
      stdio: 'inherit',
      timeout: 120000, // 2 minute timeout per generator
    });
    logOK(`${g.label} completed.`);
    passed++;
  } catch (err) {
    logFAIL(`${g.label} failed: ${err.message}`);
    failed++;
    failures.push(g.name);
  }

  log('');
}

// Summary
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

log(`${BAR}`);
log('  Generation Summary');
log(`${BAR}`);
log(`  Total:    ${generators.length}`);
log(`  Passed:   \x1b[32m${passed}\x1b[0m`);
log(`  Failed:   ${failed > 0 ? `\x1b[31m${failed}\x1b[0m` : '0'}`);
if (failures.length) log(`  Failures: ${failures.join(', ')}`);
log(`  Duration: ${elapsed}s`);
log('');

process.exit(failed > 0 ? 1 : 0);
