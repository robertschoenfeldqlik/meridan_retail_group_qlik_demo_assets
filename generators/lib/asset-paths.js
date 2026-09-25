/**
 * asset-paths.js — where built demo assets land.
 * ============================================================================
 * The decks and the document corpus are deliverables: a presenter opens them,
 * the knowledge base ingests them, nobody edits them by hand. They used to be
 * written into the repo root and into repo/documents, which mixed ~20 MB of
 * regenerable binaries in with the code that generates them.
 *
 * They now go to a single assets root outside the repo. Every generator reads
 * it from here rather than hardcoding `path.join(__dirname, '..', ...)`, so
 * moving the folder again is a one-line change.
 *
 * Override with MCG_ASSETS_DIR for a different machine or a CI run:
 *
 *   MCG_ASSETS_DIR=/srv/mcg-assets npm run generate
 *
 * The default is a sibling of the repo, so a clone two directories deep still
 * resolves without configuration.
 */

'use strict';

const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Two supported layouts, detected rather than assumed:
//   repo inside the assets root:  C:\Claude\MCG Demo\MCG Full Stack -> C:\Claude\MCG Demo
//   repo beside the assets root:  C:\Claude\MCG Full Stack           -> C:\Claude\MCG Demo
function resolveAssetsDir(repoRoot) {
  const parent = path.resolve(repoRoot, '..');
  return path.basename(parent) === 'MCG Demo' ? parent : path.join(parent, 'MCG Demo');
}
const DEFAULT_ASSETS_DIR = resolveAssetsDir(REPO_ROOT);

const ASSETS_DIR = process.env.MCG_ASSETS_DIR
  ? path.resolve(process.env.MCG_ASSETS_DIR)
  : DEFAULT_ASSETS_DIR;

// Decks sit at the top of the assets root; the document corpus keeps its own
// subtree because the knowledge base ingests it as a folder and the SOPs,
// policies and carrier contracts are already organised inside it.
const DECKS_DIR = ASSETS_DIR;
const DOCS_DIR = path.join(ASSETS_DIR, 'documents');

/** Create a directory if it is missing, and return it. */
function ensure(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Absolute path for a built deck, creating the assets root if needed. */
function deck(fileName) {
  return path.join(ensure(DECKS_DIR), fileName);
}

/** Absolute path inside the document corpus, creating the folder if needed. */
function doc(...segments) {
  const full = path.join(DOCS_DIR, ...segments);
  ensure(path.dirname(full));
  return full;
}

module.exports = { REPO_ROOT, ASSETS_DIR, DECKS_DIR, DOCS_DIR, ensure, deck, doc, resolveAssetsDir };
