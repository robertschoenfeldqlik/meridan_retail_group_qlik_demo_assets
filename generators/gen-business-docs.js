// Generate POs, Supplier Comms, Recall, Shipping, Meeting Minutes, Compliance, Project Brief
const {
  buildDocument, saveDocument,
  metadataTable, dataTable,
  heading, para, labelValue, calloutBox, numberedItem, signatureBlock,
} = require("./mcg-docx-builder");
const path = require("path");
const DOCS = path.join(__dirname, "..", "documents");

// ═══ PO-2025-RTD-00847: Samsung Electronics ═══
function poSamsung() {
  return buildDocument("PURCHASE ORDER", [
    heading("Purchase Order: PO-2025-RTD-00847"),
    metadataTable([
      ["PO Number", "PO-2025-RTD-00847"],
      ["Date Issued", "15 June 2025"],
      ["Buyer", "Meridian Commerce Group B.V."],
      ["Supplier", "Samsung Electronics Co., Ltd."],
      ["Ship To", "MCG Rotterdam DC, Europaweg 120, 3199 LD Rotterdam, NL"],
      ["Payment Terms", "Net 60"],
      ["Currency", "EUR"],
      ["Total Value", "€42,767.45"],
    ]),

    heading("1. Order Lines"),
    dataTable(
      ["Line", "SKU", "Description", "Qty Ordered", "Qty Received", "Unit Price", "Line Total"],
      [
        ["10", "MCG-4420", "Bluetooth Speaker (Midnight Black)", "200", "187 ⚠", "€34.50", "€6,900.00"],
        ["20", "MCG-4421", "Bluetooth Speaker (Arctic White)", "150", "150", "€34.50", "€5,175.00"],
        ["30", "MCG-6610", "Wireless Earbuds Pro", "300", "300", "€52.80", "€15,840.00"],
        ["40", "MCG-6620", "USB-C Fast Charger 65W", "500", "500", "€18.90", "€9,450.00"],
        ["50", "MCG-7710", "Smart Watch Band (Silicone)", "400", "400", "€13.50", "€5,402.45"],
      ]
    ),
    calloutBox("Line 10 SHORT: 13 units short on MCG-4420 (Bluetooth Speaker). PO quantity 200, received 187. Shortage noted by receiving clerk and discrepancy report filed per SOP-WH-001 Section 4.3.", "warning"),

    heading("2. Receipt Record"),
    labelValue("WMS Receipt Date/Time", "22 June 2025, 14:32 CET (Oracle WMS)"),
    labelValue("SAP Goods Receipt", "22 June 2025, 12:02 UTC (SAP)"),
    calloutBox("TIMESTAMP DISCREPANCY: WMS recorded 14:32 CET, SAP shows 12:02 UTC. These are the SAME time (CET = UTC+2). However, without timezone indicators, this appears to be a 2.5-hour gap. This is a known issue per Nightmare #5 (Timestamp Tower of Babel).", "warning"),
    labelValue("Receiving Dock", "Dock 7, Rotterdam DC"),
    labelValue("Quality Inspection", "Passed — 10% sample, no cosmetic damage"),
    labelValue("Storage Zone", "AMBIENT, Zone B, Aisle B-14"),

    heading("3. Supplier Notes"),
    para("Supplier name appears in MCG systems as:"),
    para("SAP: 'Samsung Electronics Co., Ltd.'", { bullet: true }),
    para("WMS: 'Samsung Elec.'", { bullet: true }),
    para("Salesforce: 'SAMSUNG'", { bullet: true }),
    para("Procurement spreadsheet: 'Samsung Corp'", { bullet: true }),
    calloutBox("This supplier name inconsistency is tracked under Nightmare #3 (Product Master Data Mess). The Supplier Identity Resolution transformation route in Project Qlarity will resolve all 4 variants to a single canonical record.", "info"),

    heading("4. Approval"),
    ...signatureBlock("Henrik Jansen", "VP Warehouse Operations", "Receiving Authorization"),
  ]);
}

// ═══ PO-2025-SIN-01203: NinjaVan Packaging ═══
function poNinjaVan() {
  return buildDocument("PURCHASE ORDER", [
    heading("Purchase Order: PO-2025-SIN-01203"),
    metadataTable([
      ["PO Number", "PO-2025-SIN-01203"],
      ["Date Issued", "01 August 2025"],
      ["Buyer", "Meridian Commerce Group Pte. Ltd."],
      ["Supplier", "PackRight Asia Pte. Ltd."],
      ["Ship To", "MCG Singapore DC, 18 Jurong Port Rd, Singapore 619096"],
      ["Payment Terms", "Net 30"],
      ["Currency", "SGD"],
      ["Total Value", "SGD 34,389.50"],
      ["Purpose", "Packaging materials for NinjaVan cold chain pilot"],
    ]),

    heading("1. Order Lines"),
    dataTable(
      ["Line", "SKU", "Description", "Qty Ordered", "Qty Received", "Unit Price", "Line Total"],
      [
        ["10", "PKG-ICB-S", "Insulated Cold Box — Small (5 kg capacity)", "2,000", "2,000", "SGD 4.20", "SGD 8,400.00"],
        ["20", "PKG-ICB-M", "Insulated Cold Box — Medium (10 kg capacity)", "1,500", "1,500", "SGD 6.80", "SGD 10,200.00"],
        ["30", "PKG-ICB-L", "Insulated Cold Box — Large (20 kg capacity)", "1,000", "800 ⚠", "SGD 9.50", "SGD 9,500.00"],
        ["40", "PKG-GEL-1K", "Gel Ice Pack — 1 kg", "5,000", "5,000", "SGD 1.25", "SGD 6,289.50"],
      ]
    ),
    calloutBox("Line 30 SHORT: 200 units short on Large Insulated Cold Boxes. Supplier cited raw material shortage. Balance expected within 14 days.", "warning"),

    heading("2. Context"),
    para("This PO supports the Singapore-Jakarta cold chain pilot program. MCG is expanding perishable product delivery to Jakarta via NinjaVan's cross-border cold chain service."),
    para("Related documents:"),
    para("CARRIER-NV-2025: NinjaVan Contract Amendment AMD3", { bullet: true }),
    para("MCG-POL-012: Cold Chain Management Policy", { bullet: true }),
    para("SOP-SC-002: Cold Chain Monitoring Procedure", { bullet: true }),

    ...signatureBlock("Wei Lin Tan", "Regional Logistics Manager, APAC", "Meridian Commerce Group Pte. Ltd."),
  ]);
}

// ═══ SUPP-2025-FreshDirect Performance Review ═══
function suppFreshDirect() {
  return buildDocument("SUPPLIER PERFORMANCE REVIEW", [
    heading("Quarterly Supplier Performance Review: Fresh Direct NL B.V."),
    metadataTable([
      ["Document ID", "SUPP-2025-FreshDirect"],
      ["Review Period", "Q3 2025 (July — September)"],
      ["Supplier", "Fresh Direct NL B.V."],
      ["Supplier Code", "SUPP-NL-0089"],
      ["Category", "Fresh Produce"],
      ["MCG Reviewer", "Anna Bakker, Category Manager Fresh Produce"],
      ["Supplier Contact", "Jan de Groot, Sales Director"],
      ["Rating", "C — Needs Improvement ⚠"],
    ]),

    heading("1. Performance Scorecard"),
    dataTable(
      ["Metric", "Target", "Q2 2025", "Q3 2025", "Trend"],
      [
        ["On-time delivery", "98%", "96%", "91%", "↓ Declining"],
        ["Quality acceptance rate", "99%", "97.6%", "95.2%", "↓ Declining"],
        ["Quality rejection rate", "< 1%", "2.4%", "4.8%", "↑ Worsening ⚠"],
        ["Lot number compliance", "100%", "95%", "91%", "↓ Declining ⚠"],
        ["Temperature compliance", "100%", "99%", "97%", "↓ Declining"],
        ["Order fill rate", "99%", "98%", "94%", "↓ Declining ⚠"],
      ]
    ),
    calloutBox("Overall rating downgraded from B (Acceptable) to C (Needs Improvement). Three consecutive quarters of declining performance.", "critical"),

    heading("2. Critical Issues"),
    heading("2.1 Lettuce Recall Connection", 2),
    para("Fresh Direct NL was the primary supplier for the organic butter lettuce involved in recall RCL-2025-003 (Listeria contamination). Investigation revealed that Fresh Direct was sourcing from an undisclosed backup farm (FARM-NL-0042) that was not in MCG's approved supplier register."),
    calloutBox("Sub-tier visibility gap: MCG's supplier management system does not require disclosure of sub-tier suppliers for fresh produce. This meant the contaminated farm was unknown to MCG until the recall investigation.", "critical"),

    heading("2.2 Lot Number Non-Compliance", 2),
    para("91% lot number compliance means 9% of Fresh Direct deliveries arrive without proper lot identification. For food products subject to EU traceability regulations, this is a compliance risk."),

    heading("3. Corrective Action Requirements"),
    dataTable(
      ["Action", "Deadline", "Status"],
      [
        ["Disclose all sub-tier supplier farms", "30 September 2025", "Overdue ⚠"],
        ["Achieve 100% lot number compliance", "01 November 2025", "In progress"],
        ["Implement pre-shipment temperature logging", "01 December 2025", "Not started"],
        ["Quality rejection root cause analysis", "15 October 2025", "In progress"],
      ]
    ),

    heading("4. Contract Status"),
    para("Fresh Direct NL contract renewal is CONDITIONAL on meeting all corrective action deadlines. If sub-tier disclosure and lot number compliance targets are not met by 01 December 2025, MCG reserves the right to terminate per Section 14.2 of the Master Supply Agreement."),

    ...signatureBlock("Anna Bakker", "Category Manager, Fresh Produce", "Procurement Division"),
    ...signatureBlock("Thomas Brennan", "VP Supply Chain", "Global Supply Chain Division"),
  ]);
}

// ═══ SUPP-2025-TransFrio Contract Review ═══
function suppTransFrio() {
  return buildDocument("FORMAL NOTICE — CONTRACT REVIEW", [
    heading("Formal Notice: TransFrio Logistics S.A. — Contract Performance Review"),
    metadataTable([
      ["Document ID", "SUPP-2025-TransFrio"],
      ["Date", "01 October 2025"],
      ["To", "TransFrio Logistics S.A., São Paulo, Brazil"],
      ["Attention", "Ricardo Silva, CEO"],
      ["From", "Thomas Brennan, VP Supply Chain, MCG"],
      ["Re", "Performance deficiencies — São Paulo-Buenos Aires corridor"],
      ["Contract Ref", "MSA-2024-TF-LATAM-001"],
    ]),

    heading("1. Notice of Performance Deficiency"),
    para("Meridian Commerce Group hereby provides formal notice of significant performance deficiencies under Master Service Agreement MSA-2024-TF-LATAM-001, specifically relating to cold chain integrity on the São Paulo-Buenos Aires transportation corridor during Q3 2025."),

    heading("2. Performance Data"),
    dataTable(
      ["Metric", "Contract Target", "Q3 Actual", "Variance"],
      [
        ["Temperature exceedance rate", "< 2%", "8.8%", "+6.8% ⚠"],
        ["Spoilage rate", "< 0.5%", "3.4%", "+2.9% ⚠"],
        ["On-time delivery", "95%", "81%", "-14% ⚠"],
        ["Pre-cooling compliance", "100%", "62%", "-38% ⚠"],
        ["Telemetry data sharing", "Real-time", "Not provided", "Non-compliant ⚠"],
      ]
    ),
    labelValue("Total MCG losses attributable to TransFrio", "$2.48M (Q3 2025)"),

    heading("3. Required Corrective Actions"),
    numberedItem(1, "Immediate: Pre-cool all transport units to 0°C (down from 2°C) before loading."),
    numberedItem(2, "Within 30 days: Install auxiliary power units (APUs) on all São Paulo-Buenos Aires fleet vehicles to maintain refrigeration during border waits."),
    numberedItem(3, "Within 60 days: Implement real-time telemetry data sharing with MCG via API integration."),
    numberedItem(4, "Within 90 days: Update all driver SOPs for new Thermo King X4 7500 startup sequence."),

    heading("4. Penalty Structure"),
    para("Effective immediately, the following penalty structure applies per Section 8.4 of the MSA:"),
    para("Temperature exceedance > 15 min: USD $500 per incident", { bullet: true }),
    para("Spoilage due to carrier negligence: Full product replacement value + 15% handling surcharge", { bullet: true }),
    para("Failure to share telemetry data: USD $2,000/month penalty", { bullet: true }),
    para("APU installation deadline missed: MCG may engage alternate carrier at TransFrio's cost differential", { bullet: true }),

    heading("5. Consequences of Non-Compliance"),
    para("If the corrective actions are not substantially completed within the specified deadlines, MCG reserves the right to:"),
    para("Terminate the MSA with 30 days written notice per Section 14.3", { bullet: true }),
    para("Pursue recovery of Q3 2025 spoilage losses through formal dispute resolution", { bullet: true }),
    para("Engage alternate carriers for the São Paulo-Buenos Aires corridor effective immediately", { bullet: true }),

    ...signatureBlock("Thomas Brennan", "VP Supply Chain", "Meridian Commerce Group"),
  ]);
}

// ═══ RCL-2025-003: Lettuce Recall ═══
function recallLettuce() {
  return buildDocument("PRODUCT RECALL NOTICE", [
    heading("Recall Notice: RCL-2025-003 — Organic Butter Lettuce"),
    metadataTable([
      ["Recall ID", "RCL-2025-003"],
      ["Classification", "Class II — Potential Health Risk"],
      ["Product", "Organic Butter Lettuce (loose and pre-packed)"],
      ["Contaminant", "Listeria monocytogenes"],
      ["Supplier", "Fresh Direct NL B.V. (sub-tier: Farm NL-0042)"],
      ["Affected Lots", "LOT-FD-2025-0612 through LOT-FD-2025-0618"],
      ["Affected Markets", "Netherlands, Germany, Belgium, France"],
      ["Affected Units", "12,400 units across 210 stores"],
      ["Recall Initiated", "14 June 2025"],
      ["Recall Completed", "25 June 2025 (11 days)"],
      ["Regulatory Target", "24 hours"],
    ]),

    heading("1. Summary"),
    calloutBox("On 14 June 2025, MCG initiated a Class II product recall for organic butter lettuce supplied by Fresh Direct NL after routine testing detected Listeria monocytogenes contamination. The recall ultimately affected 12,400 units across 210 stores in NL, DE, BE, and FR. Complete traceability took 11 days — 10 days beyond the 24-hour regulatory target.", "critical"),

    heading("2. Traceability Timeline"),
    dataTable(
      ["Day", "Event", "Status"],
      [
        ["Day 1", "Contamination detected in routine QC test at Rotterdam DC", "Recall initiated"],
        ["Day 1", "Affected lot numbers identified in WMS", "Partial — WMS only"],
        ["Day 2-3", "Cross-reference PO receipts in SAP to identify all inbound lots", "Manual process"],
        ["Day 3-5", "Trace outbound shipments via Descartes TMS to identify stores", "Manual process"],
        ["Day 5-8", "Verify store-level receipts by lot number", "32% of stores had lot tracking"],
        ["Day 8-10", "For stores without lot tracking, conduct physical shelf audits", "Manual store visits"],
        ["Day 11", "Full traceability confirmed. All affected product accounted for.", "Complete"],
      ]
    ),

    heading("3. Traceability Effort"),
    dataTable(
      ["Resource", "Hours", "System"],
      [
        ["Inventory Control Analysts", "28 hours", "SAP + WMS cross-referencing"],
        ["Logistics Coordinators", "15 hours", "Descartes TMS trace"],
        ["Store Audit Teams", "18 hours", "Physical shelf audits"],
        ["IT Support", "4 hours", "Data extraction queries"],
        ["Total effort", "65 person-hours", "4 systems"],
      ]
    ),

    heading("4. Financial Impact"),
    dataTable(
      ["Category", "Amount"],
      [
        ["Product destruction", "€32,400"],
        ["Customer refunds", "€8,200"],
        ["Labor (65 person-hours)", "€12,025"],
        ["Store audit travel", "€4,500"],
        ["Regulatory filing costs", "€3,000"],
        ["Brand/PR impact (estimated)", "€25,000"],
        ["Total", "€85,125"],
      ]
    ),

    heading("5. Root Cause"),
    para("Primary: Listeria contamination traced to FARM-NL-0042, an undisclosed backup farm used by Fresh Direct NL. This farm was not in MCG's approved supplier register and had not been subject to MCG's food safety audit program."),
    para("Systemic: MCG's traceability infrastructure requires cross-referencing 4 disconnected systems with no common lot-level key. Store-level lot tracking is only 32% deployed."),

    heading("6. Regulatory Outcome"),
    para("NVWA issued formal citation NVWA-2025-CIT-04412 on 12 June 2025 during a routine inspection that coincided with the recall period. The citation specifically noted MCG's inability to complete traceability within the 24-hour regulatory target."),
    para("Corrective action plan submitted: COMP-2025-NVWA (see separate document)."),

    ...signatureBlock("Dr. Elena Vasquez", "Chief Compliance Officer", "Legal & Compliance Division"),
  ]);
}

// ═══ SHIP-2025-RTD-44821: Delivery Manifest ═══
function shipManifest() {
  return buildDocument("DELIVERY MANIFEST", [
    heading("Delivery Manifest: SHIP-2025-RTD-44821"),
    metadataTable([
      ["Manifest ID", "SHIP-2025-RTD-44821"],
      ["Date", "18 September 2025"],
      ["Origin", "MCG Rotterdam DC, Europaweg 120, 3199 LD Rotterdam, NL"],
      ["Carrier", "DPD EU"],
      ["Service", "DPD Classic (2-3 business days)"],
      ["Total Parcels", "24"],
      ["Destination Countries", "Netherlands (14), Germany (8), Belgium (2)"],
    ]),

    heading("1. Shipment Summary"),
    dataTable(
      ["Country", "Parcels", "Delivered", "Failed", "SLA Met"],
      [
        ["Netherlands", "14", "13", "1 ⚠", "86%"],
        ["Germany", "8", "6", "2 ⚠", "63% ⚠"],
        ["Belgium", "2", "2", "0", "100%"],
        ["Total", "24", "21", "3", "79% ⚠"],
      ]
    ),
    calloutBox("SLA compliance for this manifest: 79% vs 96% target. Two delivery failures were directly attributable to address data quality issues.", "warning"),

    heading("2. Delivery Failures — Address Quality Issues"),
    heading("2.1 Parcel RTD-44821-DE-05", 2),
    labelValue("Destination", "Hauptstr, 47, 80331 München, DE"),
    labelValue("DPD Status", "Nicht zustellbar (Non-deliverable)"),
    labelValue("Issue", "Street name truncated: 'Hauptstraße' was stored as 'Hauptstr' in the customer database (field length limit in legacy POS system). DPD could not locate the address."),
    labelValue("Resolution", "Manual address correction, re-delivery on Day 4. FedEx address correction equivalent: €21.00 surcharge."),

    heading("2.2 Parcel RTD-44821-NL-11", 2),
    labelValue("Destination", "Koningstraat 88, 3511 EG Utrecht, NL"),
    labelValue("DPD Status", "Niet bezorgbaar (Non-deliverable)"),
    labelValue("Issue", "Street name misspelled: 'Koningsstraat' (correct) was stored as 'Koningstraat' (missing 's'). DPD system flagged as invalid address."),
    labelValue("Resolution", "Address corrected, re-delivery Day 3."),

    heading("3. DPD Tracking Statuses (Original Language)"),
    para("The following tracking statuses were received from DPD in the delivery country's local language:"),
    dataTable(
      ["Parcel", "Status (DPD Original)", "Language", "MCG Translation"],
      [
        ["RTD-44821-NL-01", "Bezorgd", "Dutch", "Delivered"],
        ["RTD-44821-NL-03", "Bezorgd", "Dutch", "Delivered"],
        ["RTD-44821-DE-01", "Zugestellt", "German", "Delivered"],
        ["RTD-44821-DE-03", "Paketankündigung", "German", "Label Created"],
        ["RTD-44821-DE-05", "Nicht zustellbar", "German", "Non-deliverable"],
        ["RTD-44821-BE-01", "Livré", "French", "Delivered"],
        ["RTD-44821-NL-11", "Niet bezorgbaar", "Dutch", "Non-deliverable"],
      ]
    ),
    calloutBox("Multi-language carrier statuses must be normalized before ingestion into MCG analytics. See Talend Carrier Status Normalizer transformation route.", "info"),

    ...signatureBlock("Sophie Müller", "EU Logistics Manager", "Meridian Commerce Group B.V."),
  ]);
}

async function main() {
  console.log("Generating business documents...");
  await saveDocument(poSamsung(), path.join(DOCS, "purchase_orders", "PO-2025-RTD-00847_Samsung_Electronics.docx"));
  await saveDocument(poNinjaVan(), path.join(DOCS, "purchase_orders", "PO-2025-SIN-01203_NinjaVan_Packaging.docx"));
  console.log("  ✅ 2 purchase orders");
  await saveDocument(suppFreshDirect(), path.join(DOCS, "supplier_comms", "SUPP-2025-FreshDirect_Performance_Review.docx"));
  await saveDocument(suppTransFrio(), path.join(DOCS, "supplier_comms", "SUPP-2025-TransFrio_Contract_Review.docx"));
  console.log("  ✅ 2 supplier communications");
  await saveDocument(recallLettuce(), path.join(DOCS, "recall_notices", "RCL-2025-003_Lettuce_Recall.docx"));
  console.log("  ✅ 1 recall notice");
  await saveDocument(shipManifest(), path.join(DOCS, "shipping", "SHIP-2025-RTD-44821_Delivery_Manifest.docx"));
  console.log("  ✅ 1 shipping manifest");
  console.log("✅ Batch complete (6 documents).");
}

main().catch(console.error);
