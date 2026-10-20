#!/usr/bin/env node
/**
 * compose.js — engine-aware wrapper for the docker:* and db:* npm scripts
 * ======================================================================
 * The npm scripts used to shell out to `docker compose` directly. That only
 * works on a machine with Docker Desktop installed. On a Podman host there is
 * no `docker` executable at all, so every one of those scripts died with
 * ENOENT even though a perfectly good Compose provider was present.
 *
 * deploy/container-engine.js already solves engine discovery for the deploy UI
 * — it finds podman or docker, finds a Compose provider (the built-in plugin
 * or the standalone docker-compose binary), and works out the DOCKER_HOST the
 * standalone binary needs to reach Podman's socket. This is a thin CLI over
 * that, so the scripts and the UI resolve the engine exactly one way.
 *
 * Usage:
 *   node deploy/compose.js -f docker-compose.simulators.yml up -d
 *   node deploy/compose.js exec mcg-mysql mysql -uroot -psecret -e "SELECT 1"
 *
 * Every argument is passed through untouched. Relative -f paths resolve
 * against infrastructure/, which is where all the compose files live and
 * where the scripts used to `cd` to.
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { resolveEngine, composeCmd, engineCmd, engineEnv } = require('./container-engine');

const INFRA_DIR = path.resolve(__dirname, '..', 'infrastructure');

// The Compose project name is pinned in container-engine.js (composeCmd), so
// the npm scripts and the deploy UI land in the same project. See the note
// there for why it is "infrastructure"; override with MCG_COMPOSE_PROJECT.

function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    console.log('Usage: node deploy/compose.js [-f <compose-file>] <compose args...>');
    console.log('       node deploy/compose.js exec <container> <command...>');
    console.log('');
    console.log('Runs Compose (or a direct engine command) through whichever container');
    console.log('engine is installed. Set MCG_CONTAINER_ENGINE=docker|podman to force one.');
    process.exit(0);
  }

  const engine = resolveEngine();

  if (!engine.available) {
    console.error(`\n  ${engine.error}`);
    console.error('  Install Podman (https://podman.io) or Docker Desktop, then retry.\n');
    process.exit(1);
  }

  // `exec` and other direct engine verbs bypass Compose entirely — they need
  // the engine binary, not the compose provider, and `docker-compose exec`
  // means something different (a service, not a container).
  const DIRECT_VERBS = new Set(['exec', 'ps', 'logs', 'inspect', 'rm', 'stop', 'start', 'kill', 'volume', 'image', 'network']);
  const direct = DIRECT_VERBS.has(argv[0]);

  let invocation;
  if (direct) {
    invocation = engineCmd(engine, ...argv);
  } else {
    if (!engine.compose.available) {
      console.error(`\n  ${engine.error}\n`);
      process.exit(1);
    }
    // Resolve a bare -f filename against infrastructure/ so the scripts do not
    // need a `cd`, which behaves differently across shells on Windows.
    const args = argv.slice();
    for (let i = 0; i < args.length; i++) {
      if ((args[i] === '-f' || args[i] === '--file') && args[i + 1] && !path.isAbsolute(args[i + 1])) {
        const candidate = path.join(INFRA_DIR, args[i + 1]);
        if (fs.existsSync(candidate)) args[i + 1] = candidate;
      }
    }
    invocation = composeCmd(engine, ...args);
  }

  const label = direct ? engine.name : engine.compose.kind;
  console.log(`[${label}] ${path.basename(invocation.cmd)} ${invocation.args.join(' ')}`);

  const result = spawnSync(invocation.cmd, invocation.args, {
    stdio: 'inherit',
    env: engineEnv(engine),
    // Compose resolves relative build contexts and include: paths against the
    // working directory, and every path in those files is written relative to
    // infrastructure/.
    cwd: INFRA_DIR,
  });

  if (result.error) {
    console.error(`\n  Failed to run ${invocation.cmd}: ${result.error.message}\n`);
    process.exit(1);
  }
  process.exit(result.status === null ? 1 : result.status);
}

main();
