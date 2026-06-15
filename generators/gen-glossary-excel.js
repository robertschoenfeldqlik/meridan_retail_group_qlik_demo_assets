// =============================================================================
// MCG Business Glossary — Excel Generator
// =============================================================================
// Generates a formatted Excel workbook with 25 MCG business glossary terms
// organized across 5 categories, ready for Qlik Cloud Glossary import.
//
// Usage: node generators/gen-glossary-excel.js
// Output: documents/MCG_Business_Glossary.xlsx
// =============================================================================

const ExcelJS = require("exceljs");
const path = require("path");

// ─── Qlik brand colors ───
const COLORS = {
  qlikBlue: "19416C",
  qlikGreen: "009845",
  qlikTeal: "006580",
  qlikCyan: "10CFC9",
  qlikLightGreen: "4CB393",
  white: "FFFFFF",
  lightBg: "F6F7F8",
  darkText: "454659",
  medGray: "6B7280",
};

// ─── Glossary Terms ───
const terms = [
  // ═══ Inventory & Warehouse ═══
  {
    category: "Inventory & Warehouse",
    term: "Phantom Inventory",
    definition: "Inventory that exists in the WMS/ERP system but is physically absent from the warehouse. Causes order fulfillment failures, incorrect replenishment signals, and financial reporting discrepancies.",
    abbreviation: "",
    nightmare: "#1 — Phantom Inventory",
    relatedDataProducts: "Supply Chain Health",
    relatedTables: "gold.supply_chain_health, silver.inventory_reconciled",
    owner: "Henrik Jansen (VP Warehouse Operations)",
    source: "SOP-WH-001, INC-2025-04872",
    businessImpact: "$48M/year in write-offs, stockouts, and mis-shipments",
  },
  {
    category: "Inventory & Warehouse",
    term: "Inventory Record Accuracy (IRA)",
    definition: "The percentage of inventory records that match physical stock counts. Calculated as: (Matching SKU-Location Counts / Total SKU-Location Counts) × 100. MCG target: ≥95%. Rotterdam DC currently at 74%.",
    abbreviation: "IRA",
    nightmare: "#1 — Phantom Inventory",
    relatedDataProducts: "Supply Chain Health",
    relatedTables: "gold.supply_chain_health",
    owner: "Henrik Jansen (VP Warehouse Operations)",
    source: "SOP-WH-002",
    businessImpact: "Each 1% improvement in IRA saves ~$500K/year in avoided mis-picks",
  },
  {
    category: "Inventory & Warehouse",
    term: "Cycle Count",
    definition: "A systematic inventory auditing process where a subset of inventory locations are physically counted on a rotating schedule. Used to detect phantom inventory without full warehouse shutdown.",
    abbreviation: "",
    nightmare: "#1 — Phantom Inventory",
    relatedDataProducts: "Supply Chain Health",
    relatedTables: "bronze.warehouse_events (event_type='CYCLE_COUNT')",
    owner: "Henrik Jansen (VP Warehouse Operations)",
    source: "SOP-WH-002",
    businessImpact: "Enables continuous IRA improvement without operational disruption",
  },
  {
    category: "Inventory & Warehouse",
    term: "Goods Receipt",
    definition: "The process of receiving, inspecting, and recording incoming goods into the warehouse management system. Includes quantity verification, quality inspection, lot assignment, and bin allocation.",
    abbreviation: "GR",
    nightmare: "#1 — Phantom Inventory, #7 — Compliance Gap",
    relatedDataProducts: "Supply Chain Health",
    relatedTables: "bronze.warehouse_events (event_type='RECEIVE')",
    owner: "Henrik Jansen (VP Warehouse Operations)",
    source: "SOP-WH-001",
    businessImpact: "Errors at receipt propagate through entire supply chain",
  },
  {
    category: "Inventory & Warehouse",
    term: "Lot Number",
    definition: "A unique identifier assigned to a batch of products manufactured or received together. Critical for traceability, recall management, and regulatory compliance (EC 178/2002). MCG: 15% of perishable items missing lot numbers.",
    abbreviation: "",
    nightmare: "#7 — Compliance Traceability Gap",
    relatedDataProducts: "Supply Chain Health",
    relatedTables: "silver.inventory_reconciled (lot_number field)",
    owner: "Dr. Elena Vasquez (Chief Compliance Officer)",
    source: "MCG-POL-007, COMP-2025-NVWA",
    businessImpact: "$9M/year compliance risk; recall response time 72h → target 4h",
  },

  // ═══ Supply Chain & Logistics ═══
  {
    category: "Supply Chain & Logistics",
    term: "WISMO",
    definition: "\"Where Is My Order\" — customer inquiries about shipment status. High WISMO rates indicate poor delivery visibility, carrier communication gaps, or tracking data quality issues. MCG average: 34% of customer contacts are WISMO.",
    abbreviation: "WISMO",
    nightmare: "#6 — Carrier Data Black Hole",
    relatedDataProducts: "Last Mile Performance",
    relatedTables: "gold.last_mile_performance",
    owner: "Lisa Park (Head of Customer Experience)",
    source: "SOP-CS-001, MCG-POL-020",
    businessImpact: "Each WISMO call costs $4.50; 34% rate = ~$8M/year in support costs",
  },
  {
    category: "Supply Chain & Logistics",
    term: "SLA Breach",
    definition: "A failure to meet the contracted service level agreement for delivery timing. Measured as actual delivery time exceeding the promised delivery window. MCG: 22% overall SLA breach rate, 38% in APAC.",
    abbreviation: "",
    nightmare: "#2 — Address Catastrophe, #6 — Carrier Black Hole",
    relatedDataProducts: "Last Mile Performance",
    relatedTables: "gold.last_mile_performance (on_time_rate, late_deliveries fields)",
    owner: "Sophie Müller (EU Logistics Manager)",
    source: "Carrier contracts (CARRIER-NV-2025, CARRIER-FEDEX-2025, CARRIER-DPD-2025)",
    businessImpact: "Each SLA breach costs ~$12 in penalties + customer churn risk",
  },
  {
    category: "Supply Chain & Logistics",
    term: "Cold Chain Exceedance",
    definition: "A temperature violation where a refrigerated or frozen shipment exceeds its maximum allowable temperature threshold for a specified duration. MCG thresholds: >8°C for >30 min (fresh produce), >8°C for >15 min (dairy), any reading above threshold (frozen).",
    abbreviation: "",
    nightmare: "#6 — Carrier Data Black Hole",
    relatedDataProducts: "Supply Chain Health",
    relatedTables: "silver.iot_normalized",
    owner: "Thomas Brennan (VP Supply Chain)",
    source: "SOP-SC-002, MCG-POL-012",
    businessImpact: "São Paulo→Buenos Aires route: spoilage rate spiked from 2.1% to 8.8%",
  },
  {
    category: "Supply Chain & Logistics",
    term: "Delivery Promise",
    definition: "The customer-facing commitment for when an order will be delivered. Based on carrier SLA, origin warehouse, destination region, and product availability. MCG: promises range from same-day to 7 business days by region.",
    abbreviation: "",
    nightmare: "#2 — Address Catastrophe",
    relatedDataProducts: "Last Mile Performance",
    relatedTables: "gold.last_mile_performance",
    owner: "Lisa Park (Head of Customer Experience)",
    source: "MCG-POL-020",
    businessImpact: "Broken promises drive WISMO calls and NPS decline",
  },
  {
    category: "Supply Chain & Logistics",
    term: "Pre-Cool Compliance",
    definition: "The requirement that refrigerated transport vehicles must reach target temperature before loading cold chain products. Ensures the cold chain is maintained from warehouse to destination without initial temperature spikes.",
    abbreviation: "",
    nightmare: "#6 — Carrier Data Black Hole",
    relatedDataProducts: "Supply Chain Health",
    relatedTables: "silver.iot_normalized (pre_cool_compliant field)",
    owner: "Thomas Brennan (VP Supply Chain)",
    source: "SOP-SC-002, MCG-POL-012",
    businessImpact: "Failed pre-cool is the #1 predictor of spoilage on long routes",
  },

  // ═══ Data Quality & Governance ═══
  {
    category: "Data Quality & Governance",
    term: "Change Data Capture (CDC)",
    definition: "A data integration pattern that identifies and captures changes (inserts, updates, deletes) made to a source database, propagating them in real-time to downstream systems. MCG uses Qlik CDC for PostgreSQL → Open Lakehouse.",
    abbreviation: "CDC",
    nightmare: "#4 — Silent Pipeline Failures",
    relatedDataProducts: "All (data freshness depends on CDC)",
    relatedTables: "All Bronze tables (bronze.*)",
    owner: "IT Operations",
    source: "TRN-2025-001",
    businessImpact: "CDC failure caused Rotterdam DC IRA to drop from 94% to 74%",
  },
  {
    category: "Data Quality & Governance",
    term: "Data Movement Gateway",
    definition: "A Qlik Cloud component installed on-premises or in a cloud VPC that enables secure data movement from private network sources (databases, file shares) to Qlik Cloud without opening inbound firewall ports.",
    abbreviation: "DMG",
    nightmare: "#4 — Silent Pipeline Failures",
    relatedDataProducts: "All (gateway is the transport layer)",
    relatedTables: "All Bronze tables",
    owner: "IT Operations",
    source: "TRN-2025-001",
    businessImpact: "Single point of failure for all CDC and scheduled data loads",
  },
  {
    category: "Data Quality & Governance",
    term: "Trust Score",
    definition: "A quantified data quality metric (0.0–1.0) calculated across multiple dimensions: Validity, Completeness, Discoverability, Usage, and AI-Specific (Accuracy, Diversity, Timeliness). Applied at the data product level in Qlik Cloud. MCG target: ≥0.75 for all data products.",
    abbreviation: "",
    nightmare: "All nightmares affect Trust Score",
    relatedDataProducts: "Supply Chain Health, Last Mile Performance",
    relatedTables: "Applied to gold.* tables via Qlik Data Products",
    owner: "Priya Ramanathan (Data Governance Lead)",
    source: "MCG-POL-015",
    businessImpact: "Trust Score < 0.70 triggers Discovery Agent alerts",
  },
  {
    category: "Data Quality & Governance",
    term: "Data Product",
    definition: "A governed, SLA-backed dataset published in Qlik Cloud with defined ownership, quality metrics (Trust Score), refresh schedule, and API access. Serves as the contract between data producers and consumers.",
    abbreviation: "",
    nightmare: "N/A — Data Products are the solution",
    relatedDataProducts: "All 8 MCG data products",
    relatedTables: "All gold.* tables",
    owner: "Priya Ramanathan (Data Governance Lead)",
    source: "MCG-POL-015",
    businessImpact: "Eliminates 'shadow data' and rogue spreadsheet culture",
  },
  {
    category: "Data Quality & Governance",
    term: "Table Recipe",
    definition: "A Qlik Cloud transformation definition that specifies how a target table (typically Silver or Gold) is built from source tables. Combines SQL-like transformations with a visual designer. Recipes are versioned and lineage-tracked.",
    abbreviation: "",
    nightmare: "#4 — Silent Pipeline Failures",
    relatedDataProducts: "All (recipes define Gold-layer transformations)",
    relatedTables: "All silver.* and gold.* tables",
    owner: "IT Operations / Data Engineering",
    source: "Creation Guide",
    businessImpact: "Recipes provide auditable, repeatable data transformations",
  },

  // ═══ Compliance & Regulatory ═══
  {
    category: "Compliance & Regulatory",
    term: "NVWA",
    definition: "Netherlands Food and Consumer Product Safety Authority (Nederlandse Voedsel- en Warenautoriteit). The Dutch regulatory body responsible for food safety enforcement. MCG's Rotterdam DC is subject to NVWA inspections.",
    abbreviation: "NVWA",
    nightmare: "#7 — Compliance Traceability Gap",
    relatedDataProducts: "Supply Chain Health",
    relatedTables: "silver.inventory_reconciled",
    owner: "Dr. Elena Vasquez (Chief Compliance Officer)",
    source: "COMP-2025-NVWA, MCG-POL-007",
    businessImpact: "NVWA non-compliance can result in facility shutdown",
  },
  {
    category: "Compliance & Regulatory",
    term: "EC 178/2002",
    definition: "European Union General Food Law establishing food safety principles, including mandatory traceability requirements. Article 18 requires 'one step back, one step forward' traceability for all food operators.",
    abbreviation: "",
    nightmare: "#7 — Compliance Traceability Gap",
    relatedDataProducts: "Supply Chain Health",
    relatedTables: "silver.inventory_reconciled",
    owner: "Dr. Elena Vasquez (Chief Compliance Officer)",
    source: "MCG-POL-007",
    businessImpact: "Non-compliance penalties up to €5M per incident",
  },
  {
    category: "Compliance & Regulatory",
    term: "Sub-Tier Supplier",
    definition: "A supplier's supplier — the upstream source of raw materials or components that MCG's direct suppliers use. Sub-tier visibility is critical for recall traceability but often absent from data systems.",
    abbreviation: "",
    nightmare: "#3 — Product Master Mess, #7 — Compliance Gap",
    relatedDataProducts: "Supply Chain Health",
    relatedTables: "silver.suppliers_deduped, silver.products_harmonized",
    owner: "Thomas Berger (Product Data Manager)",
    source: "MCG-POL-007, SUPP-2025-FreshDirect",
    businessImpact: "Lettuce recall (RCL-2025-003) revealed missing sub-tier data",
  },
  {
    category: "Compliance & Regulatory",
    term: "GTIN / EAN",
    definition: "Global Trade Item Number — a unique product identifier encoded in barcodes. EAN-13 is the European variant. MCG uses GTINs as the primary product identifier, but 8,200 SKUs have legacy codes without valid GTINs.",
    abbreviation: "GTIN / EAN",
    nightmare: "#3 — Product Master Mess",
    relatedDataProducts: "Supply Chain Health",
    relatedTables: "silver.products_harmonized",
    owner: "Thomas Berger (Product Data Manager)",
    source: "MCG-POL-015",
    businessImpact: "Invalid GTINs block EDI orders and retail compliance",
  },
  {
    category: "Compliance & Regulatory",
    term: "SKU",
    definition: "Stock Keeping Unit — MCG's internal product identifier. Unlike GTINs, SKUs are company-specific and may have legacy formats. MCG has 5,000+ active SKUs across 12 categories with inconsistent naming conventions.",
    abbreviation: "SKU",
    nightmare: "#3 — Product Master Mess",
    relatedDataProducts: "Supply Chain Health, Last Mile Performance",
    relatedTables: "All tables with sku/product_id fields",
    owner: "Thomas Berger (Product Data Manager)",
    source: "MCG-POL-015",
    businessImpact: "SKU inconsistency causes duplicate orders and forecast errors",
  },

  // ═══ Architecture & Platform ═══
  {
    category: "Architecture & Platform",
    term: "Bronze Layer",
    definition: "The raw landing zone in the Qlik Open Lakehouse. Data arrives in its original format via CDC, streaming, or API connectors with minimal transformation — only append timestamps and source metadata.",
    abbreviation: "",
    nightmare: "N/A — Bronze is the ingestion target",
    relatedDataProducts: "N/A (Bronze is not directly consumed)",
    relatedTables: "bronze.inventory_positions, bronze.warehouse_events, bronze.shipments, bronze.sf_contacts, bronze.sf_orders, bronze.sf_products, bronze.iot_cold_chain, bronze.iot_carrier_events",
    owner: "IT Operations / Data Engineering",
    source: "Creation Guide, TRN-2025-001",
    businessImpact: "Foundation of the data platform — all downstream depends on Bronze freshness",
  },
  {
    category: "Architecture & Platform",
    term: "Silver Layer",
    definition: "The cleansed and standardized layer in the Open Lakehouse. Data Flows and Table Recipes transform Bronze data: deduplication, normalization, type casting, and business rule application. Addresses the 7 Data Quality Nightmares.",
    abbreviation: "",
    nightmare: "All 7 nightmares are addressed at the Silver layer",
    relatedDataProducts: "N/A (Silver feeds Gold)",
    relatedTables: "silver.inventory_reconciled, silver.addresses_standardized, silver.products_harmonized, silver.shipments_canonical, silver.iot_normalized, silver.suppliers_deduped, silver.order_delivery_timeline, silver.warehouse_events_clean",
    owner: "IT Operations / Data Engineering",
    source: "Creation Guide",
    businessImpact: "Quality issues caught here prevent propagation to analytics and AI",
  },
  {
    category: "Architecture & Platform",
    term: "Gold Layer",
    definition: "The business-ready layer containing curated Data Products. Gold tables are aggregated, enriched, and optimized for analytics consumption. Each Gold table has an owner, SLA, Trust Score, and optional API access.",
    abbreviation: "",
    nightmare: "N/A — Gold is the outcome of fixing nightmares",
    relatedDataProducts: "Supply Chain Health, Last Mile Performance",
    relatedTables: "gold.supply_chain_health, gold.last_mile_performance",
    owner: "Priya Ramanathan (Data Governance Lead)",
    source: "Creation Guide",
    businessImpact: "Single source of truth for all analytics, AI, and external consumers",
  },
  {
    category: "Architecture & Platform",
    term: "Carrier Status Canonical",
    definition: "MCG's unified shipment status vocabulary that normalizes 6 carriers × 6 languages into a single lifecycle: LABEL_CREATED → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED (or FAILED/RETURNED).",
    abbreviation: "",
    nightmare: "#6 — Carrier Data Black Hole",
    relatedDataProducts: "Last Mile Performance",
    relatedTables: "silver.shipments_canonical (status_canonical field)",
    owner: "Sophie Müller (EU Logistics Manager)",
    source: "Data Flow 5 (Carrier Status Canonicalization)",
    businessImpact: "Enables unified tracking across all carriers; reduces WISMO by ~40%",
  },
  {
    category: "Architecture & Platform",
    term: "Address Quality Score",
    definition: "A numeric score (0.0–1.0) assigned by the address standardization pipeline indicating confidence that an address is valid, complete, and deliverable. Based on postal validation, geocoding success, and format compliance.",
    abbreviation: "AQS",
    nightmare: "#2 — Address Catastrophe",
    relatedDataProducts: "Last Mile Performance",
    relatedTables: "silver.addresses_standardized (address_quality_score field)",
    owner: "Sophie Müller (EU Logistics Manager)",
    source: "Data Flow 3 (Address Standardization)",
    businessImpact: "AQS < 0.7 correlates with 3x higher SLA breach rate",
  },
];

// ─── Category colors for visual grouping ───
const categoryColors = {
  "Inventory & Warehouse": COLORS.qlikTeal,
  "Supply Chain & Logistics": COLORS.qlikGreen,
  "Data Quality & Governance": COLORS.qlikBlue,
  "Compliance & Regulatory": COLORS.qlikLightGreen,
  "Architecture & Platform": COLORS.qlikCyan,
};

async function generate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MCG Demo — Qlik Cloud";
  wb.created = new Date();

  // ═══════════════════════════════════════════════════
  // Sheet 1: All Terms (master list)
  // ═══════════════════════════════════════════════════
  const ws = wb.addWorksheet("Glossary Terms", {
    properties: { defaultColWidth: 20 },
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // Column definitions
  ws.columns = [
    { header: "Category", key: "category", width: 26 },
    { header: "Term", key: "term", width: 30 },
    { header: "Abbreviation", key: "abbreviation", width: 14 },
    { header: "Definition", key: "definition", width: 65 },
    { header: "Related Nightmare", key: "nightmare", width: 30 },
    { header: "Data Product(s)", key: "relatedDataProducts", width: 30 },
    { header: "Related Tables", key: "relatedTables", width: 45 },
    { header: "Owner", key: "owner", width: 32 },
    { header: "Source Document(s)", key: "source", width: 30 },
    { header: "Business Impact", key: "businessImpact", width: 50 },
  ];

  // Header row styling
  const headerRow = ws.getRow(1);
  headerRow.font = { name: "Inter", size: 11, bold: true, color: { argb: "FF" + COLORS.white } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLORS.qlikBlue } };
  headerRow.alignment = { vertical: "middle", wrapText: true };
  headerRow.height = 30;

  // Add data rows
  terms.forEach((t, i) => {
    const row = ws.addRow(t);
    row.font = { name: "Inter", size: 10 };
    row.alignment = { vertical: "top", wrapText: true };

    // Alternate row shading
    if (i % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLORS.lightBg } };
    }

    // Category cell color
    const catCell = row.getCell("category");
    const catColor = categoryColors[t.category] || COLORS.qlikBlue;
    catCell.font = { name: "Inter", size: 10, bold: true, color: { argb: "FF" + COLORS.white } };
    catCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + catColor } };

    // Term bold
    row.getCell("term").font = { name: "Inter", size: 10, bold: true, color: { argb: "FF" + COLORS.qlikBlue } };

    // Abbreviation
    if (t.abbreviation) {
      row.getCell("abbreviation").font = { name: "Consolas", size: 10, bold: true };
    }
  });

  // Auto-filter
  ws.autoFilter = { from: "A1", to: "J26" };

  // Borders for all data cells
  for (let r = 1; r <= terms.length + 1; r++) {
    for (let c = 1; c <= 10; c++) {
      const cell = ws.getCell(r, c);
      cell.border = {
        top: { style: "thin", color: { argb: "FFD1D5DB" } },
        left: { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
        right: { style: "thin", color: { argb: "FFD1D5DB" } },
      };
    }
  }

  // ═══════════════════════════════════════════════════
  // Sheet 2: Summary by Category
  // ═══════════════════════════════════════════════════
  const wsSummary = wb.addWorksheet("Category Summary", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  wsSummary.columns = [
    { header: "Category", key: "category", width: 30 },
    { header: "Term Count", key: "count", width: 14 },
    { header: "Key Terms", key: "keyTerms", width: 60 },
    { header: "Primary Nightmares", key: "nightmares", width: 40 },
    { header: "Primary Owners", key: "owners", width: 40 },
  ];

  // Header styling
  const sumHeader = wsSummary.getRow(1);
  sumHeader.font = { name: "Inter", size: 11, bold: true, color: { argb: "FF" + COLORS.white } };
  sumHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLORS.qlikBlue } };
  sumHeader.alignment = { vertical: "middle", wrapText: true };
  sumHeader.height = 28;

  const categories = [...new Set(terms.map(t => t.category))];
  categories.forEach((cat, i) => {
    const catTerms = terms.filter(t => t.category === cat);
    const row = wsSummary.addRow({
      category: cat,
      count: catTerms.length,
      keyTerms: catTerms.map(t => t.abbreviation ? `${t.term} (${t.abbreviation})` : t.term).join(", "),
      nightmares: [...new Set(catTerms.flatMap(t => t.nightmare.split(",").map(n => n.trim())))].join(", "),
      owners: [...new Set(catTerms.map(t => t.owner))].join(", "),
    });
    row.font = { name: "Inter", size: 10 };
    row.alignment = { vertical: "top", wrapText: true };

    const catCell = row.getCell("category");
    const catColor = categoryColors[cat] || COLORS.qlikBlue;
    catCell.font = { name: "Inter", size: 10, bold: true, color: { argb: "FF" + COLORS.white } };
    catCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + catColor } };

    if (i % 2 === 0) {
      for (let c = 2; c <= 5; c++) {
        row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLORS.lightBg } };
      }
    }
  });

  // Total row
  const totalRow = wsSummary.addRow({ category: "TOTAL", count: terms.length, keyTerms: "", nightmares: "7 Nightmares", owners: "" });
  totalRow.font = { name: "Inter", size: 11, bold: true };
  totalRow.getCell("category").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLORS.qlikBlue } };
  totalRow.getCell("category").font = { name: "Inter", size: 11, bold: true, color: { argb: "FF" + COLORS.white } };

  // ═══════════════════════════════════════════════════
  // Sheet 3: Qlik Import Format
  // ═══════════════════════════════════════════════════
  const wsImport = wb.addWorksheet("Qlik Import Format", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  wsImport.columns = [
    { header: "Name", key: "name", width: 35 },
    { header: "Description", key: "description", width: 70 },
    { header: "Abbreviation", key: "abbreviation", width: 14 },
    { header: "Tags", key: "tags", width: 30 },
    { header: "Status", key: "status", width: 12 },
    { header: "Steward", key: "steward", width: 32 },
  ];

  const importHeader = wsImport.getRow(1);
  importHeader.font = { name: "Inter", size: 11, bold: true, color: { argb: "FF" + COLORS.white } };
  importHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLORS.qlikGreen } };
  importHeader.alignment = { vertical: "middle", wrapText: true };
  importHeader.height = 28;

  terms.forEach((t, i) => {
    const row = wsImport.addRow({
      name: t.term,
      description: t.definition,
      abbreviation: t.abbreviation || "",
      tags: t.category,
      status: "Verified",
      steward: t.owner,
    });
    row.font = { name: "Inter", size: 10 };
    row.alignment = { vertical: "top", wrapText: true };
    if (i % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLORS.lightBg } };
    }
  });

  // ═══════════════════════════════════════════════════
  // Save
  // ═══════════════════════════════════════════════════
  const outPath = path.join(__dirname, "..", "documents", "MCG_Business_Glossary.xlsx");
  await wb.xlsx.writeFile(outPath);
  console.log(`✅ Glossary Excel saved: ${outPath}`);
  console.log(`   Sheet 1: Glossary Terms (${terms.length} terms, 10 columns)`);
  console.log(`   Sheet 2: Category Summary (${categories.length} categories)`);
  console.log(`   Sheet 3: Qlik Import Format (ready for Qlik Cloud Glossary import)`);
}

generate().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
