#!/usr/bin/env node
// setup-vscode-template.js — provision the QTCP VS Code template for the MCG pipeline projects.
//
// The tooling files (.vscode/settings.json, .vscode/extensions.json, CLAUDE.md,
// .github/copilot-instructions.md) are committed with each project. The Qlik schema
// kit (schema/) is Qlik internal-preview material that must NOT be committed, so it is
// gitignored and dropped in locally. This script:
//   1. verifies the committed tooling is present in each project,
//   2. installs the schema kit into each project when you point it at a local copy
//      (--schema <dir> or the QTCP_SCHEMA_KIT env var), and
//   3. reports what to verify in VS Code.
//
// Usage:
//   node deploy/pipelines/setup-vscode-template.js                       # verify tooling + report schema status
//   node deploy/pipelines/setup-vscode-template.js --schema <kit-dir>    # install a local schema kit
//   QTCP_SCHEMA_KIT=<kit-dir> node deploy/pipelines/setup-vscode-template.js

const fs = require('fs');
const path = require('path');

const PIPELINES_DIR = __dirname;
const PROJECTS = ['mcg-batch-pipeline', 'mcg-streaming-pipeline', 'mcg-snowflake-pipeline'];
const TOOLING = [
  '.vscode/settings.json',
  '.vscode/extensions.json',
  'CLAUDE.md',
  '.github/copilot-instructions.md',
];

function parseArgs(argv) {
  const out = { schema: process.env.QTCP_SCHEMA_KIT || null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--schema' && argv[i + 1]) {
      out.schema = argv[i + 1];
      i++;
    }
  }
  return out;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// A valid schema kit ships ai-instructions.md plus the schema JSONs settings.json maps.
function missingFromKit(dir) {
  const required = ['ai-instructions.md', 'project.schema.json', 'task.schema.json'];
  return required.filter((f) => !fs.existsSync(path.join(dir, f)));
}

function main() {
  const args = parseArgs(process.argv);
  let problems = 0;

  console.log('\nQTCP VS Code template — MCG pipeline projects\n');

  for (const proj of PROJECTS) {
    const projDir = path.join(PIPELINES_DIR, proj);
    console.log(`  ${proj}`);

    if (!fs.existsSync(path.join(projDir, 'qtcp_project.yaml'))) {
      console.log('    !  not a pipeline project (no qtcp_project.yaml) — skipping');
      problems++;
      continue;
    }

    // 1. committed tooling
    for (const rel of TOOLING) {
      const ok = fs.existsSync(path.join(projDir, rel));
      console.log(`    ${ok ? 'ok      ' : 'MISSING '}${rel}`);
      if (!ok) problems++;
    }

    // 2. schema kit (local-only, gitignored)
    const schemaDest = path.join(projDir, 'schema');
    if (args.schema) {
      const srcKit = path.resolve(args.schema);
      const missing = missingFromKit(srcKit);
      if (missing.length) {
        console.log(`    !       --schema "${srcKit}" is missing ${missing.join(', ')} — not a QTCP schema kit`);
        problems++;
      } else {
        copyDir(srcKit, schemaDest);
        console.log(`    ok      installed schema kit -> schema/ (from ${srcKit})`);
      }
    } else {
      const missing = missingFromKit(schemaDest);
      console.log(missing.length
        ? '    --      schema/ not installed (hover + validation inactive until you install it)'
        : '    ok      schema/ present');
    }
    console.log('');
  }

  if (!args.schema) {
    console.log('  Schema kit: Qlik internal-preview material (intentionally not committed). To enable');
    console.log('  hover docs, auto-complete and validation, obtain the QTCP schema kit and run:');
    console.log('    node deploy/pipelines/setup-vscode-template.js --schema <path-to-schema-kit>\n');
  }

  console.log('  Verify in VS Code: open a project folder (e.g. deploy/pipelines/mcg-batch-pipeline),');
  console.log('  accept the recommended Red Hat YAML extension, then open qtcp_project.yaml — the schema');
  console.log('  title appears in the status bar and Problems = 0 across the project.\n');

  process.exit(problems > 0 ? 1 : 0);
}

main();
