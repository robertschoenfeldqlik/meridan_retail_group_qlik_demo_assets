#!/usr/bin/env node
/**
 * Repoint the two app load scripts between the real lakehouse and the CSV stand-in.
 *
 *   node deploy/mockdata/repoint-load-scripts.js qvd       # read DataFiles QVDs (default)
 *   node deploy/mockdata/repoint-load-scripts.js csv       # read the raw DataFiles CSVs
 *   node deploy/mockdata/repoint-load-scripts.js lakehouse # restore Athena/Iceberg reads
 *
 * The rewrite is mechanical and reversible: every `SELECT … FROM <schema>.<table>;` becomes
 * a `FROM [lib://<space>:DataFiles/<schema>_<table>.csv]` clause, with the original SELECT
 * preserved verbatim in a comment so the lakehouse form is never lost and the script still
 * reads as a lakehouse consumer. Field names and aliases are untouched, so nothing
 * downstream of the LOAD changes.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SCRIPTS = [
  path.join(__dirname, '..', 'apps', 'load-scripts', 'app1-supply-chain.qvs'),
  path.join(__dirname, '..', 'apps', 'load-scripts', 'app2-delivery-experience.qvs'),
];

// The lib path must name the space explicitly. A bare `lib://DataFiles/...` resolves to
// the personal DataFiles connection even for an app that lives in a shared space, and the
// reload fails with "File not found" despite the file being right there on the space's
// own connection.
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const SPACE = (CFG.spaces && CFG.spaces.shared) || 'MCG Demo - Development';

// Written inline per table rather than via a variable: a Qlik SET cannot hold the
// nested single quotes in `delimiter is ','` without truncating, and inline reads
// better on screen — each table visibly declares its own source.
const csvFrom = (t) =>
  `FROM [lib://${SPACE}:DataFiles/${t}.csv]
(txt, utf8, embedded labels, delimiter is ',', msq)`;

// QVDs are the staging format the apps actually read: they load roughly an order of
// magnitude faster than delimited text and carry their field types, so no reparse.
//
// They are read through a connection NAMED for the lakehouse rather than through the
// space's raw DataFiles connection. The bytes are identical — it points at the same
// store — but the lib path is what the load script, the catalog and the lineage graph
// all render, so every one of them reads as a lakehouse consumer instead of advertising
// a pile of QVDs. Swap this back to `${SPACE}:DataFiles` to see the plumbing again.
// Space-qualified for the same reason the DataFiles path is: a bare `lib://<name>/`
// is resolved against the personal connections, not the space's, and the reload fails
// with "Connection not found" even though the connection is plainly there.
const LAKEHOUSE_CONN = `${SPACE}:MCG Open Lakehouse`;
const qvdFrom = (t) => `FROM [lib://${LAKEHOUSE_CONN}/${t}.qvd]
(qvd)`;

const MODE = (process.argv[2] || 'qvd').toLowerCase();
if (!['csv', 'qvd', 'lakehouse'].includes(MODE)) {
  console.error('Usage: repoint-load-scripts.js [qvd|csv|lakehouse]');
  process.exit(2);
}
const fileFrom = MODE === 'qvd' ? qvdFrom : csvFrom;
const EXT = MODE === 'qvd' ? 'qvd' : 'csv';

const HEADER_START = '// >>> MCG lakehouse source switch — generated, do not hand-edit <<<';
const HEADER_END = '// <<< end lakehouse source switch >>>';

// The on-screen header deliberately does not narrate the stand-in. The substitution is
// documented here, in this file's header, and in the project memory — where a developer
// will find it — rather than in a script that gets filmed and screenshotted.
const CSV_HEADER = `${HEADER_START}
// Analytics reads come from the Qlik Open Lakehouse connection: bronze, silver and
// gold, one table per LOAD. Table names, column names and grain match the catalog.
${HEADER_END}`;

const LAKEHOUSE_HEADER = `${HEADER_START}
// Analytics reads go through Amazon Athena: the lakehouse's Iceberg tables
// are queried via the Glue catalog (databases: bronze / silver / gold).
LIB CONNECT TO 'MCG Lakehouse (Athena)';
${HEADER_END}`;

// The original connect line, as it appears in the pristine scripts.
const ORIGINAL_CONNECT = /\/\/ Analytics reads go through Amazon Athena:[\s\S]*?LIB CONNECT TO 'MCG Lakehouse \(Athena\)';/;

function toFileMode(src) {
  let out = src;

  // 1. Swap the Athena connect block for the CSV switch header.
  if (out.includes(HEADER_START)) {
    out = out.replace(new RegExp(`${HEADER_START}[\\s\\S]*?${HEADER_END}`), CSV_HEADER);
  } else {
    out = out.replace(ORIGINAL_CONNECT, CSV_HEADER);
  }

  // 2. `LOAD …;` + `SELECT … FROM schema.table;`  ->  `LOAD …` + the CSV FROM clause.
  //    The SELECT is kept as a comment so the lakehouse form survives the rewrite.
  out = out.replace(
    /;?\r?\n(SELECT\b[\s\S]*?\bFROM\s+([a-z]+)\.([a-z_]+);)/g,
    (_m, select, schema, table) => {
      const commented = select.split(/\r?\n/).map((l) => '// ' + l).join('\n');
      return `\n${commented}\n${fileFrom(`${schema}_${table}`)};`;
    }
  );

  // 3. `LOAD *;` + `SELECT * FROM schema.table;` (the bronze passthrough).
  out = out.replace(
    /LOAD \*;\r?\n(SELECT \* FROM ([a-z]+)\.([a-z_]+);)/g,
    (_m, select, schema, table) => `LOAD *\n// ${select}\n${fileFrom(`${schema}_${table}`)};`
  );

  // 4. The one pre-existing DataFiles read is a .qvd; the generator emits .csv.
  //    Its FileSize() existence guard has to move too, or the block silently never
  //    runs and the reload still reports success with the table quietly absent.
  out = out.replace(
    /FileSize\('lib:\/\/[^']*DataFiles\/MCG_SF_Addresses_Validated\.qvd'\)/g,
    `FileSize('lib://${SPACE}:DataFiles/MCG_SF_Addresses_Validated.${EXT}')`
  );
  out = out.replace(
    /FROM \[lib:\/\/[^\]]*DataFiles\/MCG_SF_Addresses_Validated\.qvd\]\s*\(qvd\)/g,
    fileFrom('MCG_SF_Addresses_Validated')
  );
  out = out.replace(
    /FROM \[lib:\/\/[^\]]*DataFiles\/MCG_SF_Addresses_Validated\.qvd\]/g,
    fileFrom('MCG_SF_Addresses_Validated')
  );

  // 5. A script already in a file mode just needs its clause swapped to the target
  //    format. Doing it directly keeps the rewrite idempotent and lets csv <-> qvd
  //    switch without a round trip through the lakehouse form, which only restores
  //    the SELECTs it can still recognise and silently leaves the rest behind.
  if (MODE === 'qvd') {
    out = out.replace(
      /FROM \[lib:\/\/[^\]]*(?:DataFiles|Open Lakehouse)\/([A-Za-z0-9_]+)\.csv\]\r?\n\(txt[^)]*\)/g,
      (_m, t) => qvdFrom(t)
    );
    out = out.replace(
      /FileSize\('lib:\/\/[^']*DataFiles\/([A-Za-z0-9_]+)\.csv'\)/g,
      (_m, t) => `FileSize('lib://${LAKEHOUSE_CONN}/${t}.qvd')`
    );
  } else {
    out = out.replace(
      /FROM \[lib:\/\/[^\]]*DataFiles\/([A-Za-z0-9_]+)\.qvd\]\r?\n\(qvd\)/g,
      (_m, t) => csvFrom(t)
    );
    out = out.replace(
      /FileSize\('lib:\/\/[^']*DataFiles\/([A-Za-z0-9_]+)\.qvd'\)/g,
      (_m, t) => `FileSize('lib://${SPACE}:DataFiles/${t}.csv')`
    );
  }

  // 6. Finally, normalise EVERY DataFiles-style lib path to the target connection.
  //    Steps 2-5 only rewrite clauses whose format is changing; a script already in
  //    qvd mode but pointing at the old connection would otherwise keep the old name,
  //    which is exactly the string the demo is trying not to show.
  if (MODE === 'qvd') {
    out = out.replace(/lib:\/\/[^\]']*?\/([A-Za-z0-9_]+)\.qvd/g,
                      (_m, t) => `lib://${LAKEHOUSE_CONN}/${t}.qvd`);
  }

  return out;
}

function toLakehouse(src) {
  let out = src;
  out = out.replace(new RegExp(`${HEADER_START}[\\s\\S]*?${HEADER_END}`), LAKEHOUSE_HEADER);
  // The bronze passthrough first — its shape is a subset of the general case below.
  out = out.replace(
    /LOAD \*\r?\n\/\/ (SELECT \* FROM [a-z]+\.[a-z_]+;)\r?\nFROM \[lib:\/\/[^\]]*DataFiles\/[A-Za-z0-9_]+\.(?:csv|qvd)\]\r?\n\((?:txt[^)]*|qvd)\);/g,
    (_m, select) => `LOAD *;\n${select}`
  );
  // Uncomment the preserved SELECT and drop the CSV FROM clause it replaced.
  out = out.replace(
    /((?:^\/\/ [^\n]*\r?\n)+)FROM \[lib:\/\/[^\]]*DataFiles\/[A-Za-z0-9_]+\.(?:csv|qvd)\]\r?\n\((?:txt[^)]*|qvd)\);/gm,
    (_m, commented) => commented.split(/\r?\n/).filter(Boolean)
      .map((l) => l.replace(/^\/\/ ?/, '')).join('\n')
  );
  return out;
}

let changed = 0;
for (const file of SCRIPTS) {
  const src = fs.readFileSync(file, 'utf8');
  let out = MODE === 'lakehouse' ? toLakehouse(src) : toFileMode(src);
  // Match the file's existing line endings so a repoint shows only real changes.
  if (src.includes('\r\n')) out = out.replace(/\r?\n/g, '\r\n');
  if (out === src) {
    console.log(`  unchanged  ${path.basename(file)}`);
    continue;
  }
  fs.writeFileSync(file, out, 'utf8');
  const n = (out.match(MODE === 'csv' ? /lib:\/\/[^\]]*DataFiles\//g : /\bFROM [a-z]+\.[a-z_]+;/g) || []).length;
  const label = { csv: 'to CSV      ', qvd: 'to QVD      ', lakehouse: 'to lakehouse' }[MODE];
  console.log(`  ${label}  ${path.basename(file)}  (${n} source(s))`);
  changed++;
}
console.log(`\n${changed} script(s) rewritten to ${MODE}.`);
