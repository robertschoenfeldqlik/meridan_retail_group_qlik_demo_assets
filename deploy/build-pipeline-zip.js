#!/usr/bin/env node
// ---------------------------------------------------------------------------
//  build-pipeline-zip.js
//  Packages the declarative QTCP pipeline project into a ZIP for manual
//  import via the Qlik Cloud UI (Data Integration → project → Import) —
//  no tenant credentials or deployment required.
//
//  Usage:
//    node deploy/build-pipeline-zip.js              # → deploy/pipelines/mcg-pipeline.zip
//    node deploy/build-pipeline-zip.js --out <path>
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');
const { zipDirectory } = require('./zip-utils');

const SCRIPT_DIR = __dirname;
const srcDir = path.join(SCRIPT_DIR, 'pipelines', 'mcg-pipeline');

let outPath = path.join(SCRIPT_DIR, 'pipelines', 'mcg-pipeline.zip');
const outFlag = process.argv.indexOf('--out');
if (outFlag !== -1 && process.argv[outFlag + 1]) {
  outPath = path.resolve(process.argv[outFlag + 1]);
}

if (!fs.existsSync(path.join(srcDir, 'qtcp_project.yaml'))) {
  console.error(`No declarative project found at ${srcDir}`);
  process.exit(1);
}

const zip = zipDirectory(srcDir, {
  exclude: ['README.md', 'schema', '.vscode', '.github', '.gitignore', 'CLAUDE.md'],
});
fs.writeFileSync(outPath, zip);
console.log(`Wrote ${outPath} (${(zip.length / 1024).toFixed(1)} KB)`);
console.log('Import it in Qlik Cloud: Data Integration → your project → Import project.');
