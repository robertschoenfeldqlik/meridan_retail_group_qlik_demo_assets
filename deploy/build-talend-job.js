#!/usr/bin/env node
// ---------------------------------------------------------------------------
//  build-talend-job.js
//  Emits the Talend Studio job `mcg_crm_address_validate_bulk` as a ProcessType
//  .item plus its .properties sidecar, ready to drop into the synthesized project
//  tree that build-talend-zip.js produces.
//
//    node deploy/build-talend-job.js            # writes deploy/talend/job/
//
//  Topology (see deploy/talend/BUILD_BULK_ADDRESS_JOB.md):
//
//    tFileInputDelimited_1   read the address extract
//            |
//    tJavaRow_1              standardize + format-validate + geocode
//            |               (routines: AddressStandardizer, AddressFormatValidator,
//            |                BulkGeocoder)
//    tFilterRow_1            gate on GPS resolution: lat != null && lon != null
//         /       \
//   FILTER         REJECT
//      |               |
//  tFileOutput_1   tFileOutput_2
//   geocoded        stewardship queue
//
//  Deliberately built from low-complexity components. A tMap stores its mapping in a
//  separate .mapper file with its own schema graph; hand-authoring one that Studio will
//  open is far more fragile than a tJavaRow that calls the same routines. The routines
//  are where the logic lives either way.
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'talend', 'job');
const JOB = 'mcg_crm_address_validate_bulk';
const VERSION = '0.1';

// Deterministic ids: the same input must produce the same job, or every rebuild shows
// up as a wholesale change in git and Studio treats it as a different item.
function guid(seed) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    h1 = Math.imul(h1 ^ seed.charCodeAt(i), 16777619) >>> 0;
    h2 = Math.imul(h2 + seed.charCodeAt(i) * (i + 7), 2246822519) >>> 0;
  }
  const hx = (n) => n.toString(16).padStart(8, '0');
  const a = hx(h1), b = hx(h2), c = hx((h1 ^ h2) >>> 0), d = hx((h1 + h2) >>> 0);
  return `_${a}-${b.slice(0, 4)}-${b.slice(4)}-${c.slice(0, 4)}-${c.slice(4)}${d}`;
}

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// --- schema -----------------------------------------------------------------
const IN_COLS = [
  'contact_id', 'first_name', 'last_name', 'email',
  'city', 'state_region', 'postal_code', 'country_iso', 'address_quality_score',
];
const OUT_COLS = IN_COLS.concat([
  'postal_code_normalized', 'format_score', 'format_faults',
  'latitude', 'longitude', 'geo_confidence', 'validation_status',
]);

const column = (name) =>
  `        <column comment="" key="false" length="255" name="${esc(name)}" nullable="true"` +
  ` pattern="" precision="0" sourceType="" type="id_String" usefulColumn="true"/>`;

const param = (field, name, value) =>
  `    <elementParameter field="${field}" name="${name}" value="${esc(value)}"/>`;

// --- subjob logic, as it appears inside each component ----------------------
// Kept in one place so the job and the Node twin (run_address_validation.js) can be
// compared line for line when either changes.

// Subjob 1, tJavaFlex main: standardize, score the FORMAT, park the row in the batch.
// No network call here - the geocode is one bulk pass in subjob 2, because the service
// is capped at one request per second and per-row calls would serialise the whole job.
const JAVA_FLEX_MAIN = [
  'AddressStandardizer.Result r = AddressStandardizer.standardize(',
  '    input_row.contact_id, input_row.first_name, input_row.last_name, input_row.email,',
  '    null, input_row.city, input_row.state_region,',
  '    input_row.postal_code, input_row.country_iso);',
  '',
  'r.qualityScore = AddressFormatValidator.formatScore(',
  '    input_row.city, input_row.state_region, input_row.postal_code, input_row.country_iso);',
  '',
  'AddressBatch.add(r);',
].join('\n');

// Subjob 2, tJava: one bulk pass over everything subjob 1 collected. geocodeAll mutates
// each Result in place and honours both the throttle and the wall-clock budget - rows it
// cannot reach in time keep null GPS and fall through to stewardship, so the job never
// stalls waiting on a public endpoint.
const JAVA_GEOCODE = [
  'BulkGeocoder.Summary s = BulkGeocoder.geocodeAll(',
  '    AddressBatch.all(),',
  '    context.nominatim_base_url,',
  '    context.nominatim_user_agent,',
  '    Long.parseLong(context.nominatim_throttle_ms),',
  '    1,',
  '    Long.parseLong(context.geocode_budget_ms));',
  'System.out.println("geocoded " + s.resolved + "/" + s.total);',
].join('\n');

// Subjob 3, tIterateToFlow: turn the geocoded batch back into a flow. AddressBatch has
// indexed typed getters for exactly this; the index is tLoop's current value.
const IDX = '((Integer)globalMap.get(\"tLoop_1_CURRENT_VALUE\"))';
const ITERATE_ROW = [
  'output_row.contact_id     = AddressBatch.contactId(' + IDX + ');',
  'output_row.first_name     = AddressBatch.firstName(' + IDX + ');',
  'output_row.last_name      = AddressBatch.lastName(' + IDX + ');',
  'output_row.email          = AddressBatch.email(' + IDX + ');',
  'output_row.city           = AddressBatch.city(' + IDX + ');',
  'output_row.state_region   = AddressBatch.state(' + IDX + ');',
  'output_row.postal_code    = AddressBatch.postalCode(' + IDX + ');',
  'output_row.country_iso    = AddressBatch.countryIso(' + IDX + ');',
  'output_row.postal_code_normalized = AddressBatch.postalCode(' + IDX + ');',
  'output_row.address_quality_score  = String.valueOf(AddressBatch.qualityScore(' + IDX + '));',
  'output_row.format_score   = String.valueOf(AddressBatch.qualityScore(' + IDX + '));',
  'output_row.format_faults  = AddressBatch.reason(' + IDX + ');',
  'output_row.latitude       = String.valueOf(AddressBatch.latitude(' + IDX + '));',
  'output_row.longitude      = String.valueOf(AddressBatch.longitude(' + IDX + '));',
  'output_row.geo_confidence = String.valueOf(AddressBatch.geoConfidence(' + IDX + '));',
  'output_row.validation_status = AddressBatch.hasGps(' + IDX + ') ? "RESOLVED" : "UNRESOLVED";',
].join('\n');

// --- nodes ------------------------------------------------------------------
function nodeInput() {
  return [
    `  <node componentName="tFileInputDelimited" componentVersion="0.102" offsetLabelX="0" offsetLabelY="0"` +
    ` posX="96" posY="128" xmi:id="${guid('n-in')}">`,
    param('TEXT', 'UNIQUE_NAME', 'tFileInputDelimited_1'),
    param('FILE', 'FILENAME', 'context.address_extract_path'),
    param('TEXT', 'ROWSEPARATOR', '"\\n"'),
    param('TEXT', 'FIELDSEPARATOR', '","'),
    param('CHECK', 'CSV_OPTION', 'true'),
    param('TEXT', 'HEADER', '1'),
    param('TEXT', 'LIMIT', 'context.crm_batch_limit'),
    param('CHECK', 'REMOVE_EMPTY_ROW', 'true'),
    param('TEXT', 'ENCODING', '"UTF-8"'),
    `    <metadata connector="FLOW" label="tFileInputDelimited_1" name="tFileInputDelimited_1">`,
    IN_COLS.map(column).join('\n'),
    '    </metadata>',
    '  </node>',
  ].join('\n');
}

function nodeJavaFlex() {
  return [
    `  <node componentName="tJavaFlex" componentVersion="0.102" offsetLabelX="0" offsetLabelY="0"` +
    ` posX="320" posY="128" xmi:id="${guid('n-flex')}">`,
    param('TEXT', 'UNIQUE_NAME', 'tJavaFlex_1'),
    // Start/end are empty: AddressBatch is a static collector, so there is nothing to
    // open or close per subjob beyond the reset that tJava_0 does before the flow runs.
    param('MEMO_JAVA', 'START_CODE', ''),
    param('MEMO_JAVA', 'MAIN_CODE', JAVA_FLEX_MAIN),
    param('MEMO_JAVA', 'END_CODE', ''),
    param('CHECK', 'IS_AUTO_PROPAGATE', 'false'),
    '  </node>',
  ].join('\n');
}

function nodeJavaReset() {
  return [
    `  <node componentName="tJava" componentVersion="0.101" offsetLabelX="0" offsetLabelY="0"` +
    ` posX="96" posY="32" xmi:id="${guid('n-reset')}">`,
    param('TEXT', 'UNIQUE_NAME', 'tJava_0'),
    param('MEMO_JAVA', 'CODE', 'AddressBatch.reset();'),
    '  </node>',
  ].join('\n');
}

function nodeJavaGeocode() {
  return [
    `  <node componentName="tJava" componentVersion="0.101" offsetLabelX="0" offsetLabelY="0"` +
    ` posX="96" posY="256" xmi:id="${guid('n-geo')}">`,
    param('TEXT', 'UNIQUE_NAME', 'tJava_1'),
    param('MEMO_JAVA', 'CODE', JAVA_GEOCODE),
    '  </node>',
  ].join('\n');
}

function nodeLoop() {
  return [
    `  <node componentName="tLoop" componentVersion="0.101" offsetLabelX="0" offsetLabelY="0"` +
    ` posX="96" posY="384" xmi:id="${guid('n-loop')}">`,
    param('TEXT', 'UNIQUE_NAME', 'tLoop_1'),
    param('CLOSED_LIST', 'LOOP_TYPE', 'FOR'),
    param('TEXT', 'FROM', '0'),
    // size()-1 because the getters are zero-indexed.
    param('TEXT', 'TO', 'AddressBatch.size() - 1'),
    param('TEXT', 'STEP', '1'),
    param('CHECK', 'VALUE_IS_INCREASED', 'true'),
    '  </node>',
  ].join('\n');
}

function nodeIterateToFlow() {
  return [
    `  <node componentName="tIterateToFlow" componentVersion="0.101" offsetLabelX="0" offsetLabelY="0"` +
    ` posX="320" posY="384" xmi:id="${guid('n-iter')}">`,
    param('TEXT', 'UNIQUE_NAME', 'tIterateToFlow_1'),
    param('MEMO_JAVA', 'MAPPING', ITERATE_ROW),
    `    <metadata connector="FLOW" label="tIterateToFlow_1" name="tIterateToFlow_1">`,
    OUT_COLS.map(column).join('\n'),
    '    </metadata>',
    '  </node>',
  ].join('\n');
}


function nodeFilter() {
  return [
    `  <node componentName="tFilterRow" componentVersion="0.101" offsetLabelX="0" offsetLabelY="0"` +
    ` posX="560" posY="384" xmi:id="${guid('n-filter')}">`,
    param('TEXT', 'UNIQUE_NAME', 'tFilterRow_1'),
    param('CHECK', 'USE_ADVANCED', 'true'),
    // The routing gate is GPS resolution and nothing else, per the build spec. The
    // "null" string check matters: the flow carries lat/lon as String.valueOf(Double),
    // so an unresolved row arrives as the four characters n-u-l-l, not as an empty cell.
    param('MEMO', 'ADVANCED_COND',
      'row2.latitude != null && !row2.latitude.isEmpty() ' +
      '&& !"null".equals(row2.latitude) ' +
      '&& row2.longitude != null && !row2.longitude.isEmpty() ' +
      '&& !"null".equals(row2.longitude)'),
    `    <metadata connector="FILTER" label="tFilterRow_1" name="tFilterRow_1">`,
    OUT_COLS.map(column).join('\n'),
    '    </metadata>',
    `    <metadata connector="REJECT" label="reject" name="reject">`,
    OUT_COLS.map(column).join('\n'),
    '    </metadata>',
    '  </node>',
  ].join('\n');
}

function nodeOutput(id, unique, y, fileCtx) {
  return [
    `  <node componentName="tFileOutputDelimited" componentVersion="0.102" offsetLabelX="0" offsetLabelY="0"` +
    ` posX="816" posY="${y}" xmi:id="${guid(id)}">`,
    param('TEXT', 'UNIQUE_NAME', unique),
    param('FILE', 'FILENAME', fileCtx),
    param('TEXT', 'ROWSEPARATOR', '"\n"'),
    param('TEXT', 'FIELDSEPARATOR', '","'),
    param('CHECK', 'INCLUDEHEADER', 'true'),
    param('CHECK', 'APPEND', 'false'),
    param('TEXT', 'ENCODING', '"UTF-8"'),
    `    <metadata connector="FLOW" label="${unique}" name="${unique}">`,
    OUT_COLS.map(column).join('\n'),
    '    </metadata>',
    '  </node>',
  ].join('\n');
}


const CONTEXT_VARS = [
  ['address_extract_path', '"deploy/mockdata/out/silver_addresses_standardized.csv"'],
  ['crm_batch_limit', '500'],
  ['nominatim_throttle_ms', '1100'],
  ['nominatim_base_url', '"https://nominatim.openstreetmap.org/search"'],
  ['nominatim_user_agent', '"MCG-Demo-AddressValidation/1.0 (Qlik demo dataset)"'],
  ['geocode_budget_ms', '900000'],
  ['geocoded_output_path', '"out/addresses_geocoded.csv"'],
  ['stewardship_output_path', '"out/addresses_stewardship.csv"'],
];

function buildItem() {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<talendfile:ProcessType xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI"',
    '    xmlns:talendfile="platform:/resource/org.talend.model/model/TalendFile.xsd"',
    '    defaultContext="Default" jobType="Standard">',
    '  <context confirmationNeeded="false" name="Default">',
    CONTEXT_VARS.map(([n, v]) =>
      `    <contextParameter comment="" name="${esc(n)}" prompt="${esc(n)}?" promptNeeded="false"` +
      ` type="id_String" value="${esc(v)}"/>`).join('\n'),
    '  </context>',
    nodeJavaReset(),
    nodeInput(),
    nodeJavaFlex(),
    nodeJavaGeocode(),
    nodeLoop(),
    nodeIterateToFlow(),
    nodeFilter(),
    nodeOutput('n-out-geo', 'tFileOutputDelimited_1', 320, 'context.geocoded_output_path'),
    nodeOutput('n-out-stw', 'tFileOutputDelimited_2', 448, 'context.stewardship_output_path'),

    // Subjob 1: clear the collector, read the extract, standardize each row into it.
    `  <connection connectorName="SUBJOB_OK" label="OnSubjobOk" lineStyle="0" metaname="tJava_0"` +
    ` offsetLabelX="0" offsetLabelY="0" source="tJava_0" target="tFileInputDelimited_1"/>`,
    `  <connection connectorName="FLOW" label="row1" lineStyle="0" metaname="tFileInputDelimited_1"` +
    ` offsetLabelX="0" offsetLabelY="0" source="tFileInputDelimited_1" target="tJavaFlex_1"/>`,

    // Subjob 2: only once the whole batch is collected, geocode it in one pass.
    `  <connection connectorName="SUBJOB_OK" label="OnSubjobOk" lineStyle="0" metaname="tFileInputDelimited_1"` +
    ` offsetLabelX="0" offsetLabelY="0" source="tFileInputDelimited_1" target="tJava_1"/>`,

    // Subjob 3: replay the geocoded batch as a flow and split it on GPS resolution.
    `  <connection connectorName="SUBJOB_OK" label="OnSubjobOk" lineStyle="0" metaname="tJava_1"` +
    ` offsetLabelX="0" offsetLabelY="0" source="tJava_1" target="tLoop_1"/>`,
    `  <connection connectorName="ITERATE" label="Iterate" lineStyle="2" metaname="tLoop_1"` +
    ` offsetLabelX="0" offsetLabelY="0" source="tLoop_1" target="tIterateToFlow_1"/>`,
    `  <connection connectorName="FLOW" label="row2" lineStyle="0" metaname="tIterateToFlow_1"` +
    ` offsetLabelX="0" offsetLabelY="0" source="tIterateToFlow_1" target="tFilterRow_1"/>`,
    `  <connection connectorName="FILTER" label="geocoded" lineStyle="0" metaname="tFilterRow_1"` +
    ` offsetLabelX="0" offsetLabelY="0" source="tFilterRow_1" target="tFileOutputDelimited_1"/>`,
    `  <connection connectorName="REJECT" label="stewardship" lineStyle="0" metaname="reject"` +
    ` offsetLabelX="0" offsetLabelY="0" source="tFilterRow_1" target="tFileOutputDelimited_2"/>`,

    '  <parameters>',
    param('CHECK', 'STATS_PORT', 'false'),
    param('CHECK', 'TRACES_PORT', 'false'),
    param('TEXT', 'COMMENT', 'MCG address validation: format pass, free geocode, GPS gate to stewardship.'),
    '  </parameters>',
    '</talendfile:ProcessType>',
  ].join('\n') + '\n';
}

function buildProperties() {
  const propId = guid('p-' + JOB), itemId = guid('i-' + JOB), stateId = guid('s-' + JOB);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<xmi:XMI xmi:version="2.0"',
    '    xmlns:xmi="http://www.omg.org/XMI"',
    '    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '    xmlns:TalendProperties="http://www.talend.org/properties"',
    '    xmlns:TalendProcess="http://www.talend.org/process">',
    `  <TalendProperties:Property xmi:id="${propId}" id="${guid('pid-' + JOB)}"`,
    `      label="${JOB}" displayName="${JOB}"`,
    '      purpose="Validate and geocode MCG addresses using free services"',
    '      description="Format pass via AddressFormatValidator, geocode via BulkGeocoder, GPS gate to the Address Cleanup stewardship sprint. Generated by deploy/build-talend-job.js."',
    `      version="${VERSION}" statusCode="" item="${itemId}">`,
    '    <author href="../../talend.project#_97729080-2dda-bddc-33a3-3beb1b5442b5"/>',
    '  </TalendProperties:Property>',
    `  <TalendProperties:ItemState xmi:id="${stateId}" path=""/>`,
    `  <TalendProcess:ProcessItem xmi:id="${itemId}" property="${propId}" state="${stateId}">`,
    `    <process href="${JOB}_${VERSION}.item#/"/>`,
    '  </TalendProcess:ProcessItem>',
    '</xmi:XMI>',
  ].join('\n') + '\n';
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const itemPath = path.join(OUT_DIR, `${JOB}_${VERSION}.item`);
const propPath = path.join(OUT_DIR, `${JOB}_${VERSION}.properties`);
fs.writeFileSync(itemPath, buildItem(), 'utf8');
fs.writeFileSync(propPath, buildProperties(), 'utf8');

console.log(`Job:        ${JOB} v${VERSION}`);
console.log('Subjob 1:   tJava_0 (reset) -> tFileInputDelimited_1 -> tJavaFlex_1 (standardize + score)');
console.log('Subjob 2:   tJava_1  BulkGeocoder.geocodeAll over the whole batch, throttled');
console.log('Subjob 3:   tLoop_1 -> tIterateToFlow_1 -> tFilterRow_1 -> 2x tFileOutputDelimited');
console.log(`Gate:       latitude/longitude resolved -> geocoded, else -> stewardship`);
console.log(`Context:    ${CONTEXT_VARS.length} variables`);
console.log(`Schema:     ${IN_COLS.length} in, ${OUT_COLS.length} out`);
console.log(`\n  ${itemPath}`);
console.log(`  ${propPath}`);
console.log(`\nImport: Studio -> File -> Import items -> pick deploy/talend/job/`);
console.log('Import the routines FIRST (AddressStandardizer, AddressFormatValidator,');
console.log('BulkGeocoder, AddressBatch) or the Java components will not compile.');
