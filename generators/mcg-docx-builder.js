// MCG DOCX Builder - Creates professional documents with MCG letterhead
// Supports switchable themes: MCG (Calibri) or Qlik (Inter)
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

// ─── Asset paths ───
const ASSETS = path.join(__dirname, "assets");
const QLIK_LOGO = path.join(ASSETS, "qlik_template_image2.png");
const QLIK_STYLES = path.join(ASSETS, "qlik_word_styles.xml");

// ─── Qlik theme constants (mirrors MCG structure for easy switching) ───
const QLIK = {
  fonts: { heading: "Inter", body: "Inter", mono: "Consolas" },
  colors: {
    navy: "19416C",       // qlikBlue — replaces MCG navy
    teal: "006580",       // qlikTeal — replaces MCG teal
    gold: "009845",       // qlikGreen — replaces MCG gold accent
    green: "009845",      // qlikGreen
    lightGray: "F6F7F8",  // lt2 background
    medGray: "6B7280",    // secondary text
    darkText: "454659",   // dk1 primary text
    white: "FFFFFF",
    red: "19416C",        // no reds — use blue for emphasis
  },
};

// ─── Qlik document styles (Inter font, Qlik colors) ───
const qlikDocStyles = {
  default: {
    document: {
      run: { font: "Inter", size: 22, color: "454659" },
      paragraph: { spacing: { after: 120, line: 276 } },
    },
    heading1: {
      run: { font: "Inter", size: 32, bold: true, color: "19416C" },
      paragraph: { spacing: { before: 360, after: 200 } },
    },
    heading2: {
      run: { font: "Inter", size: 26, bold: true, color: "006580" },
      paragraph: { spacing: { before: 300, after: 160 } },
    },
    heading3: {
      run: { font: "Inter", size: 22, bold: true, color: "19416C" },
      paragraph: { spacing: { before: 240, after: 120 } },
    },
  },
};

// ─── Theme switching ───
// Default: MCG theme. Call useQlikTheme() before generating Qlik-branded docs.
let T = MCG;

function useQlikTheme() { T = QLIK; }
function useMcgTheme() { T = MCG; }

// ─── LETTERHEAD HEADER (MCG default) ───
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

// ─── QLIK-THEMED HEADER (with Qlik logo + green accent) ───
function createQlikHeader(docType) {
  const headerChildren = [];
  const logoLine = [];
  if (fs.existsSync(QLIK_LOGO)) {
    logoLine.push(
      new ImageRun({
        data: fs.readFileSync(QLIK_LOGO),
        transformation: { width: 80, height: 35 },
        type: "png",
      })
    );
    logoLine.push(new TextRun({ text: "   ", font: "Inter", size: 20 }));
  }
  logoLine.push(new TextRun({ text: "MERIDIAN", font: "Inter", size: 26, bold: true, color: "19416C" }));
  logoLine.push(new TextRun({ text: " COMMERCE ", font: "Inter", size: 26, bold: false, color: "19416C" }));
  logoLine.push(new TextRun({ text: "GROUP", font: "Inter", size: 26, bold: true, color: "009845" }));
  headerChildren.push(new Paragraph({ spacing: { after: 0 }, children: logoLine }));
  headerChildren.push(new Paragraph({
    spacing: { after: 0 },
    children: [new TextRun({ text: MCG.tagline, font: "Inter", size: 16, italics: true, color: "454659" })],
  }));
  headerChildren.push(new Paragraph({
    spacing: { after: 0 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "009845", space: 4 } },
    children: [new TextRun({ text: "", size: 4 })],
  }));
  if (docType) {
    headerChildren.push(new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 60, after: 0 },
      children: [new TextRun({ text: docType, font: "Inter", size: 18, bold: true, color: "009845", allCaps: true })],
    }));
  }
  return new Header({ children: headerChildren });
}

// ─── FOOTER (MCG default) ───
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
            text: "Meridian Commerce Group  \u2022  ",
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
            text: `${MCG.phone}  \u2022  ${MCG.web}  \u2022  ${MCG.email}`,
            font: MCG.fonts.body, size: 14, color: MCG.colors.medGray,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 0 },
        children: [
          new TextRun({
            text: "CONFIDENTIAL \u2014 ",
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

// ─── QLIK-THEMED FOOTER (green accent, Inter font) ───
function createQlikFooter() {
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: "009845", space: 4 } },
        spacing: { before: 0 },
        children: [new TextRun({ text: "", size: 4 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({ text: "Meridian Commerce Group  \u2022  ", font: "Inter", size: 14, color: "454659" }),
          new TextRun({ text: MCG.hq, font: "Inter", size: 14, color: "454659" }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({ text: `${MCG.phone}  \u2022  ${MCG.web}  \u2022  ${MCG.email}`, font: "Inter", size: 14, color: "454659" }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 0 },
        children: [
          new TextRun({ text: "CONFIDENTIAL \u2014 ", font: "Inter", size: 13, bold: true, color: "009845" }),
          new TextRun({ text: "Page ", font: "Inter", size: 13, color: "454659" }),
          new TextRun({ children: [PageNumber.CURRENT], font: "Inter", size: 13, color: "454659" }),
        ],
      }),
    ],
  });
}

// ─── HELPER: Metadata table (2-column key-value) ───
// Uses active theme (T) for fonts and colors
function metadataTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([key, val]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: T.colors.navy },
            margins: { top: 40, bottom: 40, left: 100, right: 100 },
            children: [
              new Paragraph({
                spacing: { after: 0 },
                children: [new TextRun({ text: key, font: T.fonts.body, size: 20, bold: true, color: T.colors.white })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: T.colors.lightGray },
            margins: { top: 40, bottom: 40, left: 100, right: 100 },
            children: [
              new Paragraph({
                spacing: { after: 0 },
                children: [new TextRun({ text: val, font: T.fonts.body, size: 20, color: T.colors.darkText })],
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
        shading: { type: ShadingType.SOLID, color: T.colors.teal },
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [
          new Paragraph({
            spacing: { after: 0 },
            children: [new TextRun({ text: h, font: T.fonts.body, size: 19, bold: true, color: T.colors.white })],
          }),
        ],
      })
    ),
  });

  const dataRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map((cell) =>
        new TableCell({
          shading: ri % 2 === 0 ? { type: ShadingType.SOLID, color: T.colors.lightGray } : undefined,
          margins: { top: 30, bottom: 30, left: 80, right: 80 },
          children: [
            new Paragraph({
              spacing: { after: 0 },
              children: [new TextRun({ text: String(cell), font: T.fonts.body, size: 19, color: T.colors.darkText })],
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
    1: { size: 30, color: T.colors.navy, before: 360, after: 160, border: true },
    2: { size: 26, color: T.colors.teal, before: 280, after: 120, border: false },
    3: { size: 22, color: T.colors.navy, before: 200, after: 100, border: false },
  }[level] || { size: 22, color: T.colors.navy, before: 200, after: 100, border: false };

  return new Paragraph({
    spacing: { before: config.before, after: config.after },
    border: config.border ? { bottom: { style: BorderStyle.SINGLE, size: 2, color: T.colors.teal, space: 4 } } : undefined,
    children: [new TextRun({ text, font: T.fonts.heading, size: config.size, bold: true, color: config.color })],
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
        font: T.fonts.body,
        size: opts.size || 21,
        bold: opts.bold || false,
        italics: opts.italics || false,
        color: opts.color || T.colors.darkText,
      }),
    ],
  });
}

// ─── HELPER: Bold-label + value paragraph ───
function labelValue(label, value) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${label}: `, font: T.fonts.body, size: 21, bold: true, color: T.colors.navy }),
      new TextRun({ text: value, font: T.fonts.body, size: 21, color: T.colors.darkText }),
    ],
  });
}

// ─── HELPER: Callout/highlight box ───
function calloutBox(text, type = "info") {
  const colors = {
    info: T.colors.teal,
    warning: T.colors.gold,
    critical: T.colors.navy,    // no red — use navy for critical
    success: T.colors.green,
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
            shading: { type: ShadingType.SOLID, color: T.colors.lightGray },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({
                spacing: { after: 0 },
                children: [new TextRun({ text, font: T.fonts.body, size: 20, color: T.colors.darkText })],
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
      new TextRun({ text: `${num}. `, font: T.fonts.body, size: 21, bold: true, color: T.colors.teal }),
      new TextRun({ text, font: T.fonts.body, size: 21, bold, color: T.colors.darkText }),
    ],
  });
}

// ─── HELPER: Signature block ───
function signatureBlock(name, title, dept) {
  return [
    new Paragraph({ spacing: { before: 400, after: 0 }, children: [] }),
    new Paragraph({
      spacing: { after: 0 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: T.colors.medGray, space: 1 } },
      children: [new TextRun({ text: "                                                          ", size: 20 })],
    }),
    new Paragraph({
      spacing: { after: 0 },
      children: [new TextRun({ text: name, font: T.fonts.body, size: 20, bold: true, color: T.colors.navy })],
    }),
    new Paragraph({
      spacing: { after: 0 },
      children: [new TextRun({ text: title, font: T.fonts.body, size: 19, color: T.colors.medGray })],
    }),
    new Paragraph({
      spacing: { after: 0 },
      children: [new TextRun({ text: dept || "Meridian Commerce Group", font: T.fonts.body, size: 19, italics: true, color: T.colors.medGray })],
    }),
  ];
}

// ─── BUILD DOCUMENT (MCG default — Calibri, MCG colors) ───
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

// ─── BUILD DOCUMENT (Qlik-themed — Inter font, Qlik colors) ───
function buildQlikDocument(docType, sections) {
  const docOpts = {
    styles: qlikDocStyles,
    sections: [
      {
        properties: { page: { margin: margins } },
        headers: { default: createQlikHeader(docType) },
        footers: { default: createQlikFooter() },
        children: sections,
      },
    ],
  };
  if (fs.existsSync(QLIK_STYLES)) {
    docOpts.externalStyles = fs.readFileSync(QLIK_STYLES, "utf-8");
  }
  return new Document(docOpts);
}

// ─── SAVE DOCUMENT ───
async function saveDocument(doc, outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`  \u2713 ${path.basename(outputPath)}`);
}

module.exports = {
  MCG, buildDocument, buildQlikDocument, saveDocument,
  createHeader, createQlikHeader, createFooter, createQlikFooter,
  metadataTable, dataTable,
  heading, para, labelValue, calloutBox, numberedItem, signatureBlock,
  useQlikTheme, useMcgTheme,
};
