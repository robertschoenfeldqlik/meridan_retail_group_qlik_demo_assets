/**
 * separate-tables.js — keep adjacent docx tables apart.
 * ============================================================================
 * calloutBox(), dataTable(), promptBox() and friends all return a docx Table.
 * When two of them sit next to each other with no paragraph between, Word
 * renders them as ONE table: the callout inherits the data table's column grid
 * and comes out squeezed into the first column. A 2-pt empty paragraph between
 * them keeps each table its own shape.
 *
 * Applied by the setup guide, the demo scripts and the creation guide just
 * before buildQlikDocument(). The shared builder is left alone on purpose so
 * the other generators' outputs stay byte-for-byte as they are.
 */

'use strict';

const { Paragraph, TextRun, Table } = require('docx');

function spacer() {
  return new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: '', size: 4 })] });
}

/** Return `children` with a spacer paragraph between any two consecutive tables. */
function separateTables(children) {
  const out = [];
  children.forEach((child, i) => {
    if (i > 0 && child instanceof Table && children[i - 1] instanceof Table) out.push(spacer());
    out.push(child);
  });
  return out;
}

module.exports = { separateTables };
