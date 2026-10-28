/**
 * module-args.js — the `--module <key>` flag shared by the collateral generators.
 * ============================================================================
 * The four Project Qlarity modules are catalogued once, in deploy/modules.js.
 * The setup guide, the demo-script pack and the architecture deck each accept
 * `--module <key>` and build that module's slice into
 * documents/modules/<key>/; without the flag they build the combined output
 * exactly as before.
 *
 *   node generators/gen-setup-guide.js --module governance
 */

'use strict';

const catalog = require('../../deploy/modules.js');
const { doc } = require('./asset-paths');

/**
 * Read `--module <key>` (or `--module=<key>`) from argv. Returns null when the
 * flag is absent, so callers fall through to the combined build. Throws on a
 * missing or unknown value so a typo never silently builds the combined output.
 */
function moduleArg(argv = process.argv.slice(2)) {
  const i = argv.findIndex((a) => a === '--module' || a.startsWith('--module='));
  if (i < 0) return null;
  const raw = argv[i].includes('=') ? argv[i].slice(argv[i].indexOf('=') + 1) : argv[i + 1];
  if (!raw || raw.startsWith('--')) {
    throw new Error(`--module needs a value: one of ${catalog.ORDER.join(', ')}`);
  }
  const key = raw.trim().toLowerCase();
  if (!catalog.MODULES[key]) {
    throw new Error(`Unknown module "${raw}". Use one of: ${catalog.ORDER.join(', ')}.`);
  }
  return Object.assign({ key, index: catalog.ORDER.indexOf(key) }, catalog.MODULES[key]);
}

/** Absolute output path inside documents/modules/<key>/, creating the folder. */
function moduleDocPath(key, fileName) {
  return doc('modules', key, fileName);
}

module.exports = Object.assign({ moduleArg, moduleDocPath }, catalog);
