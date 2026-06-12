#!/usr/bin/env node
// ---------------------------------------------------------------------------
//  build-pipeline-zip.js
//  Packages every declarative QTCP pipeline project under deploy/pipelines/
//  into one ZIP each, for manual import via the Qlik Cloud UI
//  (Data Integration → project → Import) — no tenant credentials required.
//
//  Usage:
//    node deploy/build-pipeline-zip.js                # all projects
//    node deploy/build-pipeline-zip.js mcg-batch-pipeline   # one project
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');
const { zipDirectory } = require('./zip-utils');

const PIPELINES_DIR = path.join(__dirname, 'pipelines');

const only = process.argv[2];
const dirs = fs.readdirSync(PIPELINES_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name)
  .filter(d => fs.existsSync(path.join(PIPELINES_DIR, d, 'qtcp_project.yaml')))
  .filter(d => !only || d === only);

if (dirs.length === 0) {
  console.error(only
    ? `No declarative project named "${only}" under deploy/pipelines/`
    : 'No declarative projects found under deploy/pipelines/');
  process.exit(1);
}

for (const dir of dirs) {
  const src = path.join(PIPELINES_DIR, dir);
  const out = path.join(PIPELINES_DIR, `${dir}.zip`);
  const zip = zipDirectory(src, {
    exclude: ['README.md', 'schema', '.vscode', '.github', '.gitignore', 'CLAUDE.md'],
  });
  fs.writeFileSync(out, zip);
  console.log(`Wrote ${out} (${(zip.length / 1024).toFixed(1)} KB)`);
}
console.log('Import in Qlik Cloud: Data Integration → your project → Import project.');
