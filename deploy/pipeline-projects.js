// ---------------------------------------------------------------------------
//  pipeline-projects.js
//  Which declarative pipeline projects Step 13 deploys, and the DI project name
//  each folder deploys as. One list for deploy-to-qlik.js, deploy-ui.js and
//  test-window.js, so a project renamed on the tenant changes one place.
// ---------------------------------------------------------------------------
'use strict';

const fs = require('fs');
const path = require('path');

// Deployed when config.json lists no pipelines.projects. The Snowflake project
// reads the mirrors of "MCG Supply Chain Pipeline - CDC" (pipelines/
// olh-mcg-demo-cdc), which is built in the Qlik UI and must already exist.
const DEFAULT_PIPELINE_DIRS = [
  './pipelines/mcg-batch-pipeline',
  './pipelines/mcg-streaming-pipeline',
  './pipelines/mcg-snowflake-pipeline',
];

/**
 * The DI project name a pipeline folder deploys as: the projectName its
 * bindings.json records (the tenant export writes it there), else a literal
 * name in qtcp_project.yaml. A `{{projectName}}` template is not a name.
 * `sourceDir` is relative to deploy/, as in config.json.
 */
function pipelineProjectName(sourceDir) {
  const dir = path.resolve(__dirname, sourceDir || '.');
  try {
    const b = JSON.parse(fs.readFileSync(path.join(dir, 'bindings.json'), 'utf-8'));
    const n = b && b.variables && b.variables.projectName;
    if (typeof n === 'string' && n.trim()) return n.trim();
  } catch (_) { /* no bindings.json */ }
  try {
    const m = fs.readFileSync(path.join(dir, 'qtcp_project.yaml'), 'utf-8').match(/^\s*name:\s*['"]?(.+?)['"]?\s*$/m);
    if (m && !m[1].includes('{{')) return m[1];
  } catch (_) { /* no qtcp_project.yaml */ }
  return '';
}

/** pipelines.projects[] when set, else the legacy single-project fields, else the defaults. */
function pipelineProjectDefs(pCfg) {
  const p = pCfg || {};
  if (Array.isArray(p.projects) && p.projects.length > 0) return p.projects;
  if (p.projectName || p.sourceDir) {
    return [{ projectName: p.projectName || pipelineProjectName(p.sourceDir) || 'MCG Batch Pipeline', sourceDir: p.sourceDir }];
  }
  return DEFAULT_PIPELINE_DIRS.map((sourceDir) => ({ projectName: pipelineProjectName(sourceDir), sourceDir }));
}

module.exports = { DEFAULT_PIPELINE_DIRS, pipelineProjectName, pipelineProjectDefs };
