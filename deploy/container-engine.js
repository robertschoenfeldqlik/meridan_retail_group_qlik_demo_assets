'use strict';
// ---------------------------------------------------------------------------
//  container-engine.js
//  Resolves which container engine drives the infrastructure stacks, and how
//  Compose is invoked against it.
//
//  The MCG stacks were originally Docker-only: deploy-ui.js and
//  deploy-to-qlik.js each spawned a literal 'docker'. This host now runs
//  Podman, so engine selection lives here rather than being baked into every
//  spawn site.
//
//  Compose provider: the stacks use `include:`, `depends_on.condition` and
//  profiles. podman-compose (the Python implementation) does not implement
//  those faithfully, so we drive the Docker Compose v2 binary — a standalone
//  CLI that is NOT part of Docker Desktop — against Podman's Docker-compatible
//  socket. `podman compose` does exactly that delegation itself, so it is the
//  preferred form; talking to the compose binary directly is the fallback for
//  when Podman cannot locate a provider on its own.
// ---------------------------------------------------------------------------

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

// Probe a binary by asking for its version. Returns the first output line, or
// null when the binary is absent/unrunnable. shell:true so PATHEXT resolution
// (podman.exe, docker-compose.exe) works the same way it does for the real
// spawns further down.
function probe(bin, args) {
  try {
    const r = spawnSync(bin, args, { encoding: 'utf-8', shell: true, windowsHide: true });
    if (r.error || r.status !== 0) return null;
    const line = String(r.stdout || r.stderr || '').split('\n')[0].trim();
    return line || null;
  } catch (_) {
    return null;
  }
}

// Installers put podman and the compose CLI on the PATH of *new* shells, but the
// UI is often launched from a long-lived parent (an IDE, a service, a terminal
// opened before the install) whose PATH predates them. Falling back to the
// known install locations keeps "engine missing" from being reported when the
// engine is in fact installed.
function wellKnownPaths(binName) {
  const out = [];
  if (process.platform === 'win32') {
    const pf    = process.env.ProgramFiles || 'C:\\Program Files';
    const local = process.env.LOCALAPPDATA || '';
    if (binName === 'podman') out.push(path.join(pf, 'RedHat', 'Podman', 'podman.exe'));
    if (binName === 'docker') out.push(path.join(pf, 'Docker', 'Docker', 'resources', 'bin', 'docker.exe'));
    if (binName === 'docker-compose') {
      out.push(path.join(pf, 'Docker', 'Docker', 'resources', 'bin', 'docker-compose.exe'));
      // winget installs into a versioned package directory; match by prefix.
      const pkgRoot = local && path.join(local, 'Microsoft', 'WinGet', 'Packages');
      try {
        for (const d of fs.readdirSync(pkgRoot)) {
          if (d.startsWith('Docker.DockerCompose')) out.push(path.join(pkgRoot, d, 'docker-compose.exe'));
        }
      } catch (_) { /* no winget packages dir */ }
    }
  } else {
    for (const dir of ['/usr/local/bin', '/usr/bin', '/opt/homebrew/bin']) out.push(path.join(dir, binName));
  }
  return out.filter((p) => { try { return fs.existsSync(p); } catch (_) { return false; } });
}

// Resolve a binary to something spawnable: its bare name when the PATH already
// finds it, otherwise an absolute path from a known install location.
function locate(binName, versionArgs) {
  const onPath = probe(binName, versionArgs);
  if (onPath) return { bin: binName, version: onPath };
  for (const candidate of wellKnownPaths(binName)) {
    const v = probe(`"${candidate}"`, versionArgs);
    if (v) return { bin: `"${candidate}"`, version: v };
  }
  return null;
}

// Podman publishes a Docker-compatible API socket. A compose binary invoked
// directly (rather than via `podman compose`) needs DOCKER_HOST pointed at it,
// otherwise it looks for a Docker daemon that no longer exists on this host.
function podmanDockerHost(podmanBin) {
  const fromEnv = process.env.DOCKER_HOST;
  if (fromEnv) return fromEnv;
  const machine = probe(podmanBin || 'podman', ['machine', 'inspect', '--format', '{{.ConnectionInfo.PodmanPipe.Path}}']);
  if (machine && machine !== '<no value>') {
    return machine.startsWith('npipe://') ? machine : 'npipe://' + machine.replace(/\\/g, '/');
  }
  return process.platform === 'win32'
    ? 'npipe:////./pipe/podman-machine-default'
    : null;
}

let cached = null;

// Resolve the engine once per process. `override` accepts the same values as
// the MCG_CONTAINER_ENGINE env var ('podman' | 'docker' | '' for auto).
function resolveEngine(override) {
  if (cached && !override) return cached;

  const want = String(override || process.env.MCG_CONTAINER_ENGINE || '').trim().toLowerCase();
  const candidates = want ? [want] : ['podman', 'docker'];

  let name = null, version = null, bin = null;
  for (const c of candidates) {
    const found = locate(c, ['--version']);
    if (found) { name = c; bin = found.bin; version = found.version; break; }
  }

  // Nothing usable. Still return a descriptor so callers can render a clear
  // "engine missing" message instead of spawning a command that ENOENTs.
  if (!name) {
    cached = {
      name: want || 'podman', bin: want || 'podman', available: false, version: null,
      compose: { available: false, cmd: null, args: [], kind: null }, env: {},
      error: want
        ? `Container engine '${want}' is not installed or could not be located.`
        : 'Neither podman nor docker could be located.',
    };
    return cached;
  }

  const engine = { name, bin, available: true, version, env: {}, error: null };

  // Compose resolution. `<engine> compose` is preferred for both engines: on
  // Docker it is the built-in v2 plugin, on Podman it delegates to the compose
  // binary with the socket already wired up.
  const standalone = locate('docker-compose', ['version']);
  if (probe(bin, ['compose', 'version'])) {
    engine.compose = { available: true, cmd: bin, args: ['compose'], kind: name + ' compose' };
  } else if (standalone) {
    // Standalone compose binary driven straight at the engine socket.
    engine.compose = { available: true, cmd: standalone.bin, args: [], kind: 'docker-compose (standalone)' };
    if (name === 'podman') {
      const host = podmanDockerHost(bin);
      if (host) engine.env.DOCKER_HOST = host;
    }
  } else {
    engine.compose = { available: false, cmd: null, args: [], kind: null };
    engine.error = name === 'podman'
      ? 'Podman is installed but no Compose provider was found. Install the Docker Compose v2 CLI (winget install Docker.DockerCompose) — it is standalone and does not require Docker Desktop.'
      : 'Docker is installed but `docker compose` is unavailable.';
  }

  cached = engine;
  return cached;
}

// Build a Compose invocation: composeCmd(engine, '-f', file, 'up', '-d')
function composeCmd(engine, ...rest) {
  return { cmd: engine.compose.cmd, args: [...engine.compose.args, ...rest] };
}

// Build a direct engine invocation: engineCmd(engine, 'exec', name, ...)
function engineCmd(engine, ...rest) {
  return { cmd: engine.bin, args: [...rest] };
}

// Env for spawning engine/compose children — process env plus whatever the
// engine needs (DOCKER_HOST for the standalone-compose-on-Podman path).
function engineEnv(engine, extra) {
  return { ...process.env, ...(engine.env || {}), ...(extra || {}) };
}

module.exports = { resolveEngine, composeCmd, engineCmd, engineEnv };
