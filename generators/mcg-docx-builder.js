// MCG DOCX Builder - Creates professional documents with MCG letterhead
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle,
  ShadingType, WidthType, PageNumber, Tab, TabStopPosition,
  TabStopType, convertInchesToTwip, ImageRun, PageBreak,
  HorizontalPositionAlign, VerticalPositionAlign,
} = require("docx");
const fs = require("fs");
const path = require("path");
const { MCG, styles, margins } = require("./mcg-styles");

// ─── LETTERHEAD HEADER ───
function createHeader(docType) {
  return new Header({
    children: [
      // Company Name Bar
      new Paragraph({
        spacing: { after: 0 },
        children: [
          new TextRun({ text: "MERIDIAN", font: MCG.fonts.heading, size: 28, bold: true, color: MCG.colors.navy }),
          new TextRun({ text: " COMMERCE ", font: MCG.fonts.heading, size: 28, bold: false, color: MCG.colors.navy }),
          new TextRun({ text: "GROUP", font: MCG.fonts.heading, size: 28, bold: true, color: MCG.colors.teal }),
        ],
      }),
      // Tagline
      new Paragraph({
        spacing: { after: 0 },
        children: [
          new TextRun({ text: MCG.tagline, font: MCG.fonts.body, size: 16, italics: true, color: MCG.colors.medGray }),
        ],
      }),
      // Accent line
      new Paragraph({
        spacing: { after: 0 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: MCG.colors.teal, space: 4 },
        },
        children: [new TextRun({ text: "", size: 4 })],
      }),
      // Doc type label (right-aligned)
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 60, after: 0 },
        children: [
          new TextRun({
            text: docType || "",
            font: MCG.fonts.heading,
            size: 18,
            bold: true,
            color: MCG.colors.gold,
            allCaps: true,
          }),
        ],
      }),
    ],
  });
}

// ─── FOOTER ───
function createFooter() {
  return new Footer({
    children: [
      new Paragraph({
        border: {
          top: { style: BorderStyle.SINGLE, size: 3, color: MCG.colors.teal, space: 4 },
        },
        spacing: { before: 0 },
        children: [
          new TextRun({ text: "", size: 4 }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: "Meridian Commerce Group  •  ",
            font: MCG.fonts.body, size: 14, color: MCG.colors.medGray,
          }),
          new TextRun({
            text: MCG.hq,
            font: MCG.fonts.body, size: 14, color: MCG.colors.medGray,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: `${MCG.phone}  •  ${MCG.web}  •  ${MCG.email}`,
            font: MCG.fonts.body, size: 14, color: MCG.colors.medGray,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 0 },
        children: [
          new TextRun({
            text: "CONFIDENTIAL — ",
            font: MCG.fonts.body, size: 13, bold: true, color: MCG.colors.gold,
          }),
          new TextRun({
            text: "Page ",
            font: MCG.fonts.body, size: 13, color: MCG.colors.medGray,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: MCG.fonts.body, size: 13, color: MCG.colors.medGray,
          }),
        ],
      }),
    ],
  });
}

// ─── HELPER: Metadata table (2-column key-value) ───
function metadataTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([key, val]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: MCG.colors.navy },
            margins: { top: 40, bottom: 40, left: 100, right: 100 },
            children: [
              new Paragraph({
                spacing: { after: 0 },
                children: [new TextRun({ text: key, font: MCG.fonts.body, size: 20, bold: true, color: MCG.colors.white })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: MCG.colors.lightGray },
            margins: { top: 40, bottom: 40, left: 100, right: 100 },
            children: [
              new Paragraph({
                spacing: { after: 0 },
                children: [new TextRun({ text: val, font: MCG.fonts.body, size: 20, color: MCG.colors.darkText })],
              }),
            ],
          }),
        ],
      })
    ),
  });
}

// ─── HELPER: Data table with header row ───
function dataTable(headers, rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) =>
      new TableCell({
        shading: { type: ShadingType.SOLID, color: MCG.colors.teal },
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [
          new Paragraph({
            spacing: { after: 0 },
            children: [new TextRun({ text: h, font: MCG.fonts.body, size: 19, bold: true, color: MCG.colors.white })],
          }),
        ],
      })
    ),
  });

  const dataRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map((cell) =>
        new TableCell({
          shading: ri % 2 === 0 ? { type: ShadingType.SOLID, color: MCG.colors.lightGray } : undefined,
          margins: { top: 30, bottom: 30, left: 80, right: 80 },
          children: [
            new Paragraph({
              spacing: { after: 0 },
              children: [new TextRun({ text: String(cell), font: MCG.fonts.body, size: 19, color: MCG.colors.darkText })],
            }),
          ],
        })
      ),
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

// ─── HELPER: Section heading ───
function heading(text, level = 1) {
  const config = {
    1: { size: 30, color: MCG.colors.navy, before: 360, after: 160, border: true },
    2: { size: 26, color: MCG.colors.teal, before: 280, after: 120, border: false },
    3: { size: 22, color: MCG.colors.navy, before: 200, after: 100, border: false },
  }[level] || { size: 22, color: MCG.colors.navy, before: 200, after: 100, border: false };

  return new Paragraph({
    spacing: { before: config.before, after: config.after },
    border: config.border ? { bottom: { style: BorderStyle.SINGLE, size: 2, color: MCG.colors.teal, space: 4 } } : undefined,
    children: [new TextRun({ text, font: MCG.fonts.heading, size: config.size, bold: true, color: config.color })],
  });
}

// ─── HELPER: Body paragraph ───
function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after || 120 },
    alignment: opts.align || AlignmentType.LEFT,
    indent: opts.indent ? { left: convertInchesToTwip(0.3) } : undefined,
    bullet: opts.bullet ? { level: opts.bulletLevel || 0 } : undefined,
    children: [
      new TextRun({
        text,
        font: MCG.fonts.body,
        size: opts.size || 21,
        bold: opts.bold || false,
        italics: opts.italics || false,
        color: opts.color || MCG.colors.darkText,
      }),
    ],
  });
}

// ─── HELPER: Bold-label + value paragraph ───
function labelValue(label, value) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${label}: `, font: MCG.fonts.body, size: 21, bold: true, color: MCG.colors.navy }),
      new TextRun({ text: value, font: MCG.fonts.body, size: 21, color: MCG.colors.darkText }),
    ],
  });
}

// ─── HELPER: Callout/highlight box ───
function calloutBox(text, type = "info") {
  const colors = {
    info: MCG.colors.teal,
    warning: MCG.colors.gold,
    critical: MCG.colors.red,
    success: MCG.colors.green,
  };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 1, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: colors[type] || colors.info },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: " ", size: 10 })] })],
          }),
          new TableCell({
            width: { size: 99, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: MCG.colors.lightGray },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({
                spacing: { after: 0 },
                children: [new TextRun({ text, font: MCG.fonts.body, size: 20, color: MCG.colors.darkText })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ─── HELPER: Numbered list item ───
function numberedItem(num, text, bold = false) {
  return new Paragraph({
    spacing: { after: 80 },
    indent: { left: convertInchesToTwip(0.3) },
    children: [
      new TextRun({ text: `${num}. `, font: MCG.fonts.body, size: 21, bold: true, color: MCG.colors.teal }),
      new TextRun({ text, font: MCG.fonts.body, size: 21, bold, color: MCG.colors.darkText }),
    ],
  });
}

// ─── HELPER: Signature block ───
function signatureBlock(name, title, dept) {
  return [
    new Paragraph({ spacing: { before: 400, after: 0 }, children: [] }),
    new Paragraph({
      spacing: { after: 0 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: MCG.colors.medGray, space: 1 } },
      children: [new TextRun({ text: "                                                          ", size: 20 })],
    }),
    new Paragraph({
      spacing: { after: 0 },
      children: [new TextRun({ text: name, font: MCG.fonts.body, size: 20, bold: true, color: MCG.colors.navy })],
    }),
    new Paragraph({
      spacing: { after: 0 },
      children: [new TextRun({ text: title, font: MCG.fonts.body, size: 19, color: MCG.colors.medGray })],
    }),
    new Paragraph({
      spacing: { after: 0 },
      children: [new TextRun({ text: dept || "Meridian Commerce Group", font: MCG.fonts.body, size: 19, italics: true, color: MCG.colors.medGray })],
    }),
  ];
}

// ─── BUILD DOCUMENT ───
function buildDocument(docType, sections) {
  return new Document({
    styles: styles,
    sections: [
      {
        properties: {
          page: {
            margin: margins,
          },
        },
        headers: { default: createHeader(docType) },
        footers: { default: createFooter() },
        children: sections,
      },
    ],
  });
}

// ─── SAVE DOCUMENT ───
async function saveDocument(doc, outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`  ✓ ${path.basename(outputPath)}`);
}

module.exports = {
  MCG, buildDocument, saveDocument,
  createHeader, createFooter,
  metadataTable, dataTable,
  heading, para, labelValue, calloutBox, numberedItem, signatureBlock,
};
