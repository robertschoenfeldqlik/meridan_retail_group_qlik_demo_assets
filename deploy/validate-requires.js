#!/usr/bin/env node
/**
 * validate-requires.js — prove every local require() resolves in a clean checkout.
 * ============================================================================
 * `node -c` only parses a file; it never follows require(). So a tracked file
 * that requires a file nobody committed passes `lint:syntax` here and crashes
 * with MODULE_NOT_FOUND on every fresh clone and in CI. deploy-to-qlik.js and
 * generate-all.js both did exactly that with deploy/modules.js.
 *
 * This walks every .js file, follows each static require() of a ./ or ../
 * path, and fails when the target does not exist, or when a file git tracks
 * requires one git does not (staged files count as tracked).
 *
 * Usage:
 *   node deploy/validate-requires.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', '.chrome-profile', 'gateway']);
const REQUIRE_RE = /require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (e.name.endsWith('.js')) out.push(f);
  }
  return out;
}

/** Node's resolution for a relative path: as-is, .js, .json, then dir/index.js. */
function resolveLocal(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const c of [base, base + '.js', base + '.json', path.join(base, 'index.js')]) {
    try { if (fs.statSync(c).isFile()) return c; } catch (_) { /* try the next form */ }
  }
  return null;
}

/** Files in the git index (tracked or staged), or null outside a git checkout. */
function gitTracked() {
  try {
    const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    return new Set(out.split('\0').filter(Boolean).map((f) => path.resolve(ROOT, f)));
  } catch (_) {
    return null;
  }
}

function main() {
  const files = walk(ROOT, []);
  const tracked = gitTracked();
  const problems = [];
  let checked = 0;
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf-8');
    for (const m of src.matchAll(REQUIRE_RE)) {
      checked++;
      const rel = path.relative(ROOT, file);
      const target = resolveLocal(file, m[1]);
      if (!target) {
        problems.push(`${rel}: require('${m[1]}') — no such file`);
      } else if (tracked && tracked.has(file) && !tracked.has(target)) {
        problems.push(`${rel}: require('${m[1]}') — ${path.relative(ROOT, target)} is not tracked by git (git add it)`);
      }
    }
  }
  if (problems.length > 0) {
    console.error(`Local require check — ${problems.length} problem(s):`);
    for (const p of problems) console.error('  ' + p);
    process.exit(1);
  }
  console.log(`Requires OK: ${checked} local require(s) in ${files.length} JS file(s)${tracked ? '' : ' (no git index — existence only)'}`);
}

main();
