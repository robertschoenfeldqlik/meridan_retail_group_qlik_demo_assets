#!/usr/bin/env node
/**
 * zip-utils.js — zero-dependency ZIP create/extract for the deploy tooling.
 *
 * Creating: STORED (no compression) entries — declarative pipeline projects
 * are a few KB of YAML, so compression buys nothing and STORED keeps the
 * writer simple and dependency-free.
 *
 * Extracting: supports STORED (method 0) and DEFLATE (method 8, via zlib)
 * so we can unpack ZIPs exported by Qlik Cloud.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------------------------------------------------------------------------
//  CRC-32 (standard polynomial 0xEDB88320)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ---------------------------------------------------------------------------
//  Create
// ---------------------------------------------------------------------------

/**
 * Build a ZIP buffer from { 'relative/path.yaml': Buffer|string, ... }.
 * Paths use forward slashes; entries are STORED.
 */
function zipFromEntries(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  // Fixed DOS date/time (2026-01-01 00:00) — content-addressed, not time-addressed.
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

  for (const [name, value] of Object.entries(entries)) {
    const nameBuf = Buffer.from(name.replace(/\\/g, '/'), 'utf-8');
    const data = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf-8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);   // local file header signature
    local.writeUInt16LE(20, 4);           // version needed
    local.writeUInt16LE(0x0800, 6);       // flags: UTF-8 names
    local.writeUInt16LE(0, 8);            // method: STORED
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);           // extra length

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central dir signature
    central.writeUInt16LE(20, 4);         // version made by
    central.writeUInt16LE(20, 6);         // version needed
    central.writeUInt16LE(0x0800, 8);     // flags: UTF-8 names
    central.writeUInt16LE(0, 10);         // method: STORED
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);    // local header offset

    localParts.push(local, nameBuf, data);
    centralParts.push(central, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }

  const centralStart = offset;
  const centralBuf = Buffer.concat(centralParts);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);                       // EOCD signature
  eocd.writeUInt16LE(Object.keys(entries).length, 8);      // entries on disk
  eocd.writeUInt16LE(Object.keys(entries).length, 10);     // entries total
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(centralStart, 16);

  return Buffer.concat([...localParts, centralBuf, eocd]);
}

/**
 * Zip a directory tree into a Buffer. Paths inside the ZIP are relative to
 * `dir`. Entries matching `exclude` (relative path prefixes or exact names)
 * are skipped.
 */
function zipDirectory(dir, { exclude = [] } = {}) {
  const entries = {};

  function walk(current) {
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, item.name);
      const rel = path.relative(dir, full).replace(/\\/g, '/');
      const excluded = exclude.some((e) => rel === e || rel.startsWith(e.endsWith('/') ? e : e + '/'));
      if (excluded) continue;
      if (item.isDirectory()) walk(full);
      else entries[rel] = fs.readFileSync(full);
    }
  }

  walk(dir);
  return zipFromEntries(entries);
}

// ---------------------------------------------------------------------------
//  Extract
// ---------------------------------------------------------------------------

/**
 * Parse a ZIP buffer into [{ name, data }] via the central directory.
 * Supports STORED and DEFLATE entries; directories are skipped.
 */
function unzipBuffer(buf) {
  // Locate EOCD (scan back past any comment, max 64KB + 22 bytes)
  let eocd = -1;
  const scanFloor = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= scanFloor; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a ZIP file (end-of-central-directory record not found)');

  const count = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);
  const files = [];

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('Corrupt ZIP: bad central directory entry');
    const method      = buf.readUInt16LE(pos + 10);
    const compSize    = buf.readUInt32LE(pos + 20);
    const nameLen     = buf.readUInt16LE(pos + 28);
    const extraLen    = buf.readUInt16LE(pos + 30);
    const commentLen  = buf.readUInt16LE(pos + 32);
    const localOffset = buf.readUInt32LE(pos + 42);
    const name        = buf.slice(pos + 46, pos + 46 + nameLen).toString('utf-8');

    if (!name.endsWith('/')) {
      const localNameLen  = buf.readUInt16LE(localOffset + 26);
      const localExtraLen = buf.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;
      const raw = buf.slice(dataStart, dataStart + compSize);

      let data;
      if (method === 0)      data = raw;
      else if (method === 8) data = zlib.inflateRawSync(raw);
      else throw new Error(`Unsupported ZIP compression method ${method} for "${name}"`);

      files.push({ name, data });
    }
    pos += 46 + nameLen + extraLen + commentLen;
  }

  return files;
}

/**
 * Extract a ZIP buffer to a directory, guarding against path traversal.
 */
function unzipToDirectory(buf, destDir) {
  const files = unzipBuffer(buf);
  for (const { name, data } of files) {
    const target = path.resolve(destDir, name);
    if (!target.startsWith(path.resolve(destDir) + path.sep) && target !== path.resolve(destDir)) {
      throw new Error(`ZIP entry escapes destination directory: ${name}`);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }
  return files.map((f) => f.name);
}

module.exports = { zipFromEntries, zipDirectory, unzipBuffer, unzipToDirectory, crc32 };
