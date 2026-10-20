// Generate ENRICHED business DOCX files — moderate depth for Qlik Answers
const {
  buildDocument, saveDocument,
  metadataTable, dataTable,
  heading, para, labelValue, calloutBox, numberedItem, signatureBlock,
} = require("./mcg-docx-builder");
const path = require("path");
const { deck, doc, DOCS_DIR } = require("./lib/asset-paths");
const DOCS = DOCS_DIR;

// ═══ PO-2025-RTD-00847: Samsung Electronics ═══
function poSamsung() {
  return buildDocument("PURCHASE ORDER", [
    heading("Purchase Order: PO-2025-RTD-00847"),
    metadataTable([
      ["PO Number", "PO-2025-RTD-00847"],
      ["Date Issued", "15 June 2025"],
      ["Buyer", "Meridian Commerce Group B.V."],
      ["Buyer VAT", "NL-8234.71.629.B01"],
      ["Supplier", "Samsung Electronics Co., Ltd."],
      ["Supplier Code (SAP)", "SUPP-KR-0012"],
      ["Ship To", "MCG Rotterdam DC, Europaweg 120, 3199 LD Rotterdam, NL"],
      ["Payment Terms", "Net 60"],
      ["Currency", "EUR"],
      ["Total Value", "€42,767.45"],
      ["Incoterms", "DDP Rotterdam"],
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
    calloutBox("Line 10 SHORT: 13 units short on MCG-4420 (Bluetooth Speaker Midnight Black). PO quantity 200, received 187. Shortage noted by receiving clerk Pieter de Vries and discrepancy report DR-2025-0419 filed per SOP-WH-001 Section 4.3. Samsung claims 13 units damaged in transit (photo evidence pending).", "warning"),

    heading("2. Receipt Record"),
    labelValue("WMS Receipt Date/Time", "22 June 2025, 14:32 CET (Oracle WMS)"),
    labelValue("SAP Goods Receipt", "22 June 2025, 12:02 UTC (SAP)"),
    calloutBox("TIMESTAMP DISCREPANCY: WMS recorded 14:32 CET, SAP shows 12:02 UTC. These are the SAME time (CET = UTC+2). However, without timezone indicators in WMS, this appears to be a 2.5-hour gap. Known issue — see Nightmare #5 (Timestamp Tower of Babel) and TRN-2025-001 Section 4 for timezone handling guidance.", "warning"),
    labelValue("Receiving Dock", "Dock 7, Rotterdam DC"),
    labelValue("Receiving Clerk", "Pieter de Vries (ID: RTD-EMP-0447)"),
    labelValue("Quality Inspection", "Passed — 10% random sample (155 units), no cosmetic damage, all serial numbers match packing list"),
    labelValue("Storage Zone", "AMBIENT, Zone B, Aisle B-14, Rows 3-7"),
    labelValue("Putaway Confirmed", "22 June 2025, 15:48 CET (WMS)"),

    heading("3. Supplier Name Variants"),
    para("This supplier appears under 4 different names across MCG systems:"),
    dataTable(
      ["System", "Supplier Name as Stored", "Supplier Code"],
      [
        ["SAP S/4HANA", "Samsung Electronics Co., Ltd.", "SUPP-KR-0012"],
        ["Oracle WMS", "Samsung Elec.", "V-00012"],
        ["Meridian CRM", "SAMSUNG", "CRM-ACC-9912"],
        ["Procurement spreadsheet", "Samsung Corp", "N/A (manual)"],
      ]
    ),
    calloutBox("This supplier name inconsistency is tracked under Nightmare #3 (Product Master Data Mess). The Supplier Identity Resolution transformation route in Project Qlarity will resolve all 4 variants to a single canonical record using fuzzy matching and the D-U-N-S number (KR-542881901).", "info"),

    heading("4. Financial Reconciliation"),
    para("Due to the 13-unit shortage on Line 10, the invoice amount will differ from the PO total:"),
    labelValue("PO Total", "€42,767.45"),
    labelValue("Adjusted Total (less 13 × €34.50)", "€42,318.95"),
    labelValue("Samsung Credit Note", "CN-SAM-2025-0612 (pending)"),
    para("Accounts Payable has been notified. Payment will be held until credit note is received or replacement units arrive, per MCG Procurement Policy Section 7.2."),

    heading("5. Approval"),
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
      ["Buyer UEN", "201512345G"],
      ["Supplier", "PackRight Asia Pte. Ltd."],
      ["Supplier Code (SAP)", "SUPP-SG-0203"],
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
    calloutBox("Line 30 SHORT: 200 units short on Large Insulated Cold Boxes. PackRight cited raw material shortage (EPS foam supply disruption from Malaysia). Balance expected within 14 business days. Partial receipt accepted to avoid delaying pilot launch.", "warning"),

    heading("2. Cold Chain Pilot Context"),
    para("This PO supports the Singapore-Jakarta cold chain pilot program launching Q4 2025. Key details:"),
    labelValue("Pilot Route", "Singapore DC → Changi Air Cargo → Jakarta Soekarno-Hatta → NinjaVan Jakarta Hub"),
    labelValue("Target Products", "Fresh produce, dairy, health & wellness supplements"),
    labelValue("Expected Volume", "2,500-4,000 parcels/month during pilot"),
    labelValue("Duration", "6-month pilot (October 2025 — March 2026)"),
    para("The insulated cold boxes must maintain 2-8°C for up to 48 hours without active refrigeration (gel ice packs only). This is required because NinjaVan's Jakarta last-mile fleet does not have refrigerated vehicles."),
    calloutBox("RISK: The Large cold boxes (PKG-ICB-L) are critical for 10-20 kg dairy shipments. The 200-unit shortage may limit pilot capacity for heavier items in the first 2 weeks. Wei Lin Tan has approved a temporary workaround using double-packed Medium boxes with additional gel packs.", "warning"),

    heading("3. Packaging Specifications"),
    dataTable(
      ["Spec", "Small (ICB-S)", "Medium (ICB-M)", "Large (ICB-L)"],
      [
        ["Capacity", "5 kg", "10 kg", "20 kg"],
        ["Wall thickness", "25 mm EPS", "30 mm EPS", "35 mm EPS"],
        ["Cold hold time", "36 hours", "42 hours", "48 hours"],
        ["Gel packs needed", "2 × 1 kg", "3 × 1 kg", "4 × 1 kg"],
        ["Max ambient temp", "35°C", "35°C", "35°C"],
        ["Recyclable", "Yes (EPS #6)", "Yes (EPS #6)", "Yes (EPS #6)"],
      ]
    ),

    heading("4. Related Documents"),
    para("CARRIER-NV-2025: NinjaVan Contract Amendment AMD3 (SLA reclassification)", { bullet: true }),
    para("MCG-POL-012: Cold Chain Management Policy", { bullet: true }),
    para("SOP-SC-002: Cold Chain Monitoring Procedure", { bullet: true }),
    para("TRN-2025-002: Cold Chain Monitoring Guide for Drivers", { bullet: true }),

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
      ["Previous Rating", "B — Acceptable (Q2 2025)"],
    ]),

    heading("1. Performance Scorecard"),
    dataTable(
      ["Metric", "Target", "Q1 2025", "Q2 2025", "Q3 2025", "Trend"],
      [
        ["On-time delivery", "98%", "97%", "96%", "91%", "↓ Declining"],
        ["Quality acceptance rate", "99%", "98.1%", "97.6%", "95.2%", "↓ Declining"],
        ["Quality rejection rate", "< 1%", "1.9%", "2.4%", "4.8%", "↑ Worsening ⚠"],
        ["Lot number compliance", "100%", "97%", "95%", "91%", "↓ Declining ⚠"],
        ["Temperature compliance", "100%", "99.5%", "99%", "97%", "↓ Declining"],
        ["Order fill rate", "99%", "99%", "98%", "94%", "↓ Declining ⚠"],
      ]
    ),
    calloutBox("Overall rating downgraded from B (Acceptable) to C (Needs Improvement). Three consecutive quarters of declining performance across all 6 metrics. If Q4 does not show improvement, rating will fall to D (Unacceptable) triggering automatic contract review.", "critical"),

    heading("2. Critical Issues"),

    heading("2.1 Lettuce Recall Connection", 2),
    para("Fresh Direct NL was the primary supplier for the organic butter lettuce involved in recall RCL-2025-003 (Listeria monocytogenes contamination, 14 June 2025). Investigation revealed that Fresh Direct was sourcing from an undisclosed backup farm (FARM-NL-0042) near Breda that was not in MCG's approved supplier register."),
    para("Impact of the recall:"),
    para("12,400 units recalled across 210 stores in NL, DE, BE, FR", { bullet: true }),
    para("€85,125 total financial impact to MCG", { bullet: true }),
    para("11-day traceability effort (65 person-hours)", { bullet: true }),
    para("NVWA citation NVWA-2025-CIT-04412 specifically referenced this supplier gap", { bullet: true }),
    calloutBox("Sub-tier visibility gap: MCG's supplier management system does not require disclosure of sub-tier suppliers for fresh produce. This meant the contaminated farm was unknown to MCG until the recall investigation. Fresh Direct has since disclosed 3 additional backup farms.", "critical"),

    heading("2.2 Lot Number Non-Compliance", 2),
    para("91% lot number compliance means 9% of Fresh Direct deliveries arrive without proper lot identification. For food products subject to EU Regulation (EC) No 178/2002 traceability requirements, this represents a direct compliance risk. NVWA Finding F1 specifically cited inconsistent lot capture at goods receipt."),
    para("Root cause analysis indicates Fresh Direct uses manual handwritten lot labels on approximately 15% of deliveries (smaller farms). These labels are often illegible, smudged, or absent. MCG receiving clerks cannot scan these and must enter lot numbers manually — or skip them when under time pressure."),

    heading("3. Corrective Action Requirements"),
    dataTable(
      ["#", "Action", "Deadline", "Status", "Verified By"],
      [
        ["1", "Disclose all sub-tier supplier farms with addresses and certifications", "30 Sep 2025", "Overdue ⚠", "Procurement"],
        ["2", "Achieve 100% lot number compliance (machine-readable barcodes on all deliveries)", "01 Nov 2025", "In progress", "Warehouse Ops"],
        ["3", "Implement pre-shipment temperature logging with Tive IoT sensor or equivalent", "01 Dec 2025", "Not started", "Quality"],
        ["4", "Submit root cause analysis for Q3 quality rejection rate increase (4.8%)", "15 Oct 2025", "In progress", "Quality"],
        ["5", "Provide monthly sub-tier sourcing report showing farm-to-lot mapping", "Ongoing from Nov", "Not started", "Procurement"],
      ]
    ),

    heading("4. Contract Status"),
    para("Fresh Direct NL Master Supply Agreement (MSA-2024-FD-NL-001) renewal is CONDITIONAL on meeting all corrective action deadlines. If sub-tier disclosure and lot number compliance targets are not met by 01 December 2025, MCG reserves the right to terminate per Section 14.2 of the MSA."),
    para("Annual spend with Fresh Direct NL: €4.2M (FY2024). Alternative suppliers identified: GreenHarvest B.V. and BioFresh Holland B.V. Transition plan drafted but not activated."),

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
      ["To", "TransFrio Logistics S.A., Rua das Palmeiras 450, São Paulo, Brazil"],
      ["Attention", "Ricardo Silva, CEO"],
      ["From", "Thomas Brennan, VP Supply Chain, MCG"],
      ["Re", "Performance deficiencies — São Paulo-Buenos Aires corridor"],
      ["Contract Ref", "MSA-2024-TF-LATAM-001"],
      ["Notice Type", "Formal Corrective Action Notice (Section 8.4 of MSA)"],
    ]),

    heading("1. Notice of Performance Deficiency"),
    para("Meridian Commerce Group hereby provides formal notice of significant performance deficiencies under Master Service Agreement MSA-2024-TF-LATAM-001, specifically relating to cold chain integrity on the São Paulo-Buenos Aires transportation corridor during Q3 2025."),
    para("This notice follows the investigation findings of Incident INC-2025-05102 (TransFrio São Paulo-Buenos Aires Spoilage Event) which identified systematic cold chain failures traceable to fleet management decisions made without MCG notification."),

    heading("2. Performance Data"),
    dataTable(
      ["Metric", "Contract Target", "Q2 Actual", "Q3 Actual", "Variance"],
      [
        ["Temperature exceedance rate", "< 2%", "2.1%", "8.8%", "+6.8% ⚠"],
        ["Spoilage rate", "< 0.5%", "0.6%", "3.4%", "+2.9% ⚠"],
        ["On-time delivery", "95%", "93%", "81%", "-14% ⚠"],
        ["Pre-cooling compliance", "100%", "94%", "62%", "-38% ⚠"],
        ["Telemetry data sharing", "Real-time", "Partial", "Not provided", "Non-compliant ⚠"],
      ]
    ),
    labelValue("Total MCG losses attributable to TransFrio Q3", "$2.48M"),
    labelValue("Breakdown", "$1.82M product spoilage + $0.41M expedited replacements + $0.25M customer refunds"),

    heading("3. Root Cause — Fleet Change Without Notification"),
    para("Investigation revealed that TransFrio replaced 6 of its 12 São Paulo-Buenos Aires fleet trucks in July 2025 with newer Thermo King X4 7500 reefer units. The new units require a different startup sequence that drivers were not trained on. As a result:"),
    para("Drivers were starting the new reefer units with the old procedure, causing a 45-minute cooling delay", { bullet: true }),
    para("Pre-cooling target of 0°C was rarely achieved — most units departed at 4-6°C", { bullet: true }),
    para("The 14-hour São Paulo-Buenos Aires border crossing wait (without active power at Argentine customs) caused temperatures to exceed 8°C for extended periods", { bullet: true }),
    calloutBox("This fleet change was NOT communicated to MCG. The performance degradation was initially dismissed as 'summer heat' by both MCG and TransFrio operations teams because IoT temperature data (Tive sensors) and carrier fleet data lived in different systems with no correlation. It took 3 weeks and manual analyst work to identify the true root cause.", "critical"),

    heading("4. Required Corrective Actions"),
    numberedItem(1, "Immediate: Pre-cool all transport units to 0°C (down from 2°C) before loading. Loading verification required."),
    numberedItem(2, "Within 30 days: Install auxiliary power units (APUs) on all São Paulo-Buenos Aires fleet vehicles to maintain refrigeration during the 14-hour Argentine border wait."),
    numberedItem(3, "Within 60 days: Implement real-time telemetry data sharing with MCG via REST API integration (specification provided separately)."),
    numberedItem(4, "Within 90 days: Complete driver retraining on Thermo King X4 7500 startup sequence and provide certification records to MCG."),

    heading("5. Penalty Structure"),
    para("Effective immediately, the following penalty structure applies per Section 8.4 of the MSA:"),
    dataTable(
      ["Violation", "Penalty", "Measurement"],
      [
        ["Temperature exceedance > 15 min", "USD $500 per incident", "Per Tive sensor reading"],
        ["Spoilage due to carrier negligence", "Full product replacement + 15% handling", "Per shipment"],
        ["Failure to share telemetry data", "USD $2,000/month", "Binary compliance"],
        ["APU installation deadline missed", "MCG may engage alternate carrier at TransFrio cost differential", "Per vehicle"],
        ["Pre-cooling non-compliance", "USD $200 per departure above 1°C", "Per loading event"],
      ]
    ),

    heading("6. Consequences of Non-Compliance"),
    para("If corrective actions are not substantially completed within specified deadlines, MCG reserves the right to:"),
    para("Terminate the MSA with 30 days written notice per Section 14.3", { bullet: true }),
    para("Pursue recovery of Q3 2025 spoilage losses ($2.48M) through formal dispute resolution per Section 16", { bullet: true }),
    para("Engage alternate carriers for the São Paulo-Buenos Aires corridor effective immediately", { bullet: true }),
    para("MCG has identified two alternate carriers (LogFrio Argentina S.A. and Friovías LATAM) with available capacity on this corridor."),

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
      ["Supplier", "Fresh Direct NL B.V. (sub-tier: Farm NL-0042, Breda)"],
      ["Affected Lots", "LOT-FD-2025-0612 through LOT-FD-2025-0618"],
      ["Affected Markets", "Netherlands, Germany, Belgium, France"],
      ["Affected Units", "12,400 units across 210 stores"],
      ["Recall Initiated", "14 June 2025"],
      ["Recall Completed", "25 June 2025 (11 days)"],
      ["Regulatory Target", "24 hours"],
      ["Total Financial Impact", "€85,125"],
    ]),

    heading("1. Executive Summary"),
    calloutBox("On 14 June 2025, MCG initiated a Class II product recall for organic butter lettuce supplied by Fresh Direct NL after routine QC testing at Rotterdam DC detected Listeria monocytogenes. The recall affected 12,400 units across 210 stores in 4 EU markets. Full traceability took 11 days — 10 days beyond the 24-hour regulatory target — because tracing required manual cross-referencing across 4 disconnected systems.", "critical"),

    heading("2. Detection and Initial Response"),
    labelValue("Detection Method", "Routine QC sampling at Rotterdam DC, Dock 12 receiving area"),
    labelValue("Sample ID", "QC-RTD-2025-06-14-0034"),
    labelValue("Lab Result", "Positive for Listeria monocytogenes (confirmed by RIVM reference lab)"),
    labelValue("Initial Action", "Immediate hold on all Fresh Direct NL fresh produce at Rotterdam DC"),
    labelValue("Recall Decision", "Made within 2 hours of lab confirmation by Dr. Elena Vasquez (CCO)"),
    para("Per SOP-SC-001 (Product Recall Procedure), a recall team was assembled within 4 hours including representatives from Quality, Warehouse Ops, Logistics, IT, Legal, and Communications."),

    heading("3. Traceability Timeline"),
    dataTable(
      ["Day", "Event", "Effort", "Blocker"],
      [
        ["Day 1", "Contamination detected; affected lot numbers identified in WMS", "2 hrs", "WMS only — no cross-system link"],
        ["Day 2-3", "Cross-reference PO receipts in SAP to identify all inbound lots from Fresh Direct", "12 hrs", "Supplier name mismatch between WMS and SAP"],
        ["Day 3-5", "Trace outbound shipments via Descartes TMS to identify destination stores", "15 hrs", "TMS uses shipment IDs, not lot numbers"],
        ["Day 5-8", "Verify store-level receipt by lot number", "18 hrs", "Only 32% of stores had lot-level tracking"],
        ["Day 8-10", "Physical shelf audits at 143 stores without lot tracking", "14 hrs", "Required dispatching audit teams"],
        ["Day 11", "Full traceability confirmed — all affected product accounted for", "4 hrs", "Final reconciliation"],
      ]
    ),
    labelValue("Total Effort", "65 person-hours across 4 systems and 12 team members"),

    heading("4. Financial Impact"),
    dataTable(
      ["Category", "Amount", "Notes"],
      [
        ["Product destruction", "€32,400", "12,400 units at avg €2.61 per unit"],
        ["Customer refunds", "€8,200", "614 online orders with affected product"],
        ["Labor (65 person-hours)", "€12,025", "Blended rate €185/hr (includes overtime)"],
        ["Store audit travel", "€4,500", "Teams dispatched to 143 stores in 4 countries"],
        ["Regulatory filing costs", "€3,000", "RASFF notification + NVWA filings"],
        ["Brand/PR impact (estimated)", "€25,000", "Social media monitoring, press response, customer comms"],
        ["Total", "€85,125", ""],
      ]
    ),

    heading("5. Root Cause Analysis"),
    heading("5.1 Contamination Source", 2),
    para("Listeria contamination traced to FARM-NL-0042, an undisclosed backup farm near Breda used by Fresh Direct NL. This farm was not in MCG's approved supplier register, had not been subject to MCG's food safety audit program, and was operating with an expired HACCP certification (expired March 2025)."),

    heading("5.2 Systemic Traceability Failure", 2),
    para("MCG's traceability infrastructure requires cross-referencing 4 disconnected systems with no common lot-level key:"),
    dataTable(
      ["System", "What It Knows", "What It Doesn't Know"],
      [
        ["SAP S/4HANA", "PO, supplier, receipt date, quantity", "Lot-to-store mapping"],
        ["Oracle WMS", "Lot numbers, storage locations, picks", "Outbound store destinations"],
        ["Descartes TMS", "Shipment routes, carrier, delivery status", "Product lot numbers"],
        ["Meridian Storefront", "Customer orders, store assignments", "Supplier lot numbers"],
      ]
    ),
    calloutBox("No single system can answer: 'Which stores received products from lot LOT-FD-2025-0614?' This is the fundamental traceability gap that Project Qlarity's unified data layer will solve.", "info"),

    heading("6. Regulatory Outcome"),
    para("NVWA issued formal citation NVWA-2025-CIT-04412 on 12 June 2025 during a routine inspection that coincided with the recall period. The citation included 5 findings (detailed in COMP-2025-NVWA). MCG submitted corrective action plan on 15 July 2025. NVWA follow-up inspection expected Q1 2026."),
    para("Additionally, a RASFF (Rapid Alert System for Food and Feed) notification was filed with the European Commission, triggering notification to food safety authorities in DE, BE, and FR."),

    heading("7. Lessons Learned"),
    numberedItem(1, "Sub-tier supplier visibility is a critical gap — MCG must require disclosure of all sub-tier suppliers for food products."),
    numberedItem(2, "Store-level lot tracking at 32% is woefully inadequate — must reach 90%+ for effective recalls."),
    numberedItem(3, "Manual cross-referencing across 4 systems is not sustainable — unified traceability platform required."),
    numberedItem(4, "The 24-hour regulatory target is achievable only with connected systems and common data keys."),

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
      ["Carrier", "DPD EU (Contract: MSA-2022-DPD-EU-001)"],
      ["Service", "DPD Classic (2-3 business days)"],
      ["Total Parcels", "24"],
      ["Destination Countries", "Netherlands (14), Germany (8), Belgium (2)"],
      ["DPD Pickup Time", "16:30 CET"],
      ["Manifest Weight", "187.4 kg total"],
    ]),

    heading("1. Shipment Summary"),
    dataTable(
      ["Country", "Parcels", "Delivered", "Failed", "Avg Transit", "SLA Met"],
      [
        ["Netherlands", "14", "13", "1 ⚠", "1.8 days", "86%"],
        ["Germany", "8", "6", "2 ⚠", "2.9 days", "63% ⚠"],
        ["Belgium", "2", "2", "0", "2.0 days", "100%"],
        ["Total", "24", "21", "3", "2.2 days", "79% ⚠"],
      ]
    ),
    calloutBox("SLA compliance for this manifest: 79% vs 96% DPD contract target. Two of three delivery failures were directly attributable to address data quality issues (Nightmare #2 — Address Data Catastrophe).", "warning"),

    heading("2. Delivery Failures — Root Cause Analysis"),

    heading("2.1 Parcel RTD-44821-DE-05 — Address Truncation", 2),
    labelValue("Customer", "Order #MCG-DE-2025-88421"),
    labelValue("Destination", "Hauptstr, 47, 80331 München, DE"),
    labelValue("Correct Address", "Hauptstraße 47, 80331 München, DE"),
    labelValue("DPD Status", "Nicht zustellbar (Non-deliverable)"),
    labelValue("Issue", "Street name truncated: 'Hauptstraße' stored as 'Hauptstr' in customer database. Root cause: legacy POS system field length limit of 20 characters. The 'aße' was silently truncated at data entry."),
    labelValue("Resolution", "Manual address correction by customer service (WISMO call), re-delivery on Day 4"),
    labelValue("Additional Cost", "€21.00 DPD address correction surcharge + €8.50 re-delivery fee"),

    heading("2.2 Parcel RTD-44821-NL-11 — Spelling Error", 2),
    labelValue("Customer", "Order #MCG-NL-2025-77103"),
    labelValue("Destination", "Koningstraat 88, 3511 EG Utrecht, NL"),
    labelValue("Correct Address", "Koningsstraat 88, 3511 EG Utrecht, NL"),
    labelValue("DPD Status", "Niet bezorgbaar (Non-deliverable)"),
    labelValue("Issue", "Street name misspelled: 'Koningsstraat' (correct) was stored as 'Koningstraat' (missing 's'). DPD address validation flagged as invalid."),
    labelValue("Resolution", "Address corrected via customer contact, re-delivery Day 3"),
    labelValue("Additional Cost", "€21.00 DPD address correction surcharge"),

    heading("2.3 Parcel RTD-44821-DE-07 — Customer Not Home", 2),
    labelValue("DPD Status", "Nicht zustellbar — Empfänger nicht angetroffen (Recipient not present)"),
    labelValue("Resolution", "Redirected to DPD Pickup Point, collected by customer Day 3"),
    para("This failure is not address-quality related — it is a standard delivery attempt failure."),

    heading("3. DPD Tracking Statuses (Multi-Language)"),
    para("DPD provides tracking status updates in the delivery country's local language. This manifest demonstrates the challenge:"),
    dataTable(
      ["Parcel", "Status (DPD Original)", "Language", "MCG Normalized Status"],
      [
        ["RTD-44821-NL-01", "Bezorgd", "Dutch", "Delivered"],
        ["RTD-44821-NL-03", "Bezorgd", "Dutch", "Delivered"],
        ["RTD-44821-NL-11", "Niet bezorgbaar", "Dutch", "Delivery Failed"],
        ["RTD-44821-DE-01", "Zugestellt", "German", "Delivered"],
        ["RTD-44821-DE-03", "Paketankündigung", "German", "Label Created"],
        ["RTD-44821-DE-05", "Nicht zustellbar", "German", "Delivery Failed"],
        ["RTD-44821-DE-07", "Nicht zustellbar", "German", "Delivery Failed"],
        ["RTD-44821-BE-01", "Livré", "French", "Delivered"],
        ["RTD-44821-BE-02", "Livré", "French", "Delivered"],
      ]
    ),
    calloutBox("Multi-language carrier statuses must be normalized before ingestion into MCG analytics. Currently this is done via a manual mapping spreadsheet maintained by Sophie Müller. Project Qlarity's Talend Carrier Status Normalizer transformation route will automate this for DPD (3 languages), FedEx (English), NinjaVan (English + Malay), and TransFrio (Portuguese + Spanish).", "info"),

    heading("4. WISMO Impact"),
    para("Of the 3 failed deliveries on this manifest, 2 generated WISMO (Where Is My Order) calls to MCG customer service:"),
    labelValue("WISMO Call #1", "Customer #MCG-DE-2025-88421 called 48 hours after order, agent spent 12 minutes locating DPD status 'Nicht zustellbar' and coordinating re-delivery"),
    labelValue("WISMO Call #2", "Customer #MCG-NL-2025-77103 used live chat, resolved in 8 minutes"),
    para("Average WISMO call cost: €6.40. These 2 calls cost €12.80 in addition to the re-delivery surcharges."),

    ...signatureBlock("Sophie Müller", "EU Logistics Manager", "Meridian Commerce Group B.V."),
  ]);
}

// ═══ INC-2025-04872: Rotterdam Pipeline Failure ═══
function incRotterdam() {
  return buildDocument("INCIDENT REPORT", [
    heading("INC-2025-04872: Rotterdam DC — Silent WMS-SAP Pipeline Failure"),
    metadataTable([
      ["Incident ID", "INC-2025-04872"],
      ["Severity", "P1 — Critical"],
      ["Date Detected", "03 September 2025"],
      ["Date Resolved", "04 September 2025"],
      ["Duration of Silent Failure", "72+ hours (estimated start: 31 August 2025)"],
      ["Detection Method", "Manual — warehouse supervisor noticed discrepancy during daily check"],
      ["Affected DC", "Rotterdam DC, Europaweg 120, 3199 LD Rotterdam, NL"],
      ["Systems Affected", "Oracle WMS → Qlik Replicate CDC → SAP S/4HANA"],
      ["Reported By", "Pieter de Vries, Warehouse Supervisor"],
      ["Resolved By", "IT Operations — Integration Team"],
    ]),

    heading("1. Executive Summary"),
    calloutBox("The CDC (Change Data Capture) pipeline between Oracle WMS and SAP at Rotterdam DC silently failed on approximately 31 August 2025. The failure went undetected for 72+ hours because there was no automated pipeline health monitoring. During this period, SAP inventory positions diverged from actual warehouse stock, creating 847 units of phantom inventory across 143 SKUs. The incident was detected only because warehouse supervisor Pieter de Vries noticed a discrepancy during a manual daily sync check.", "critical"),

    heading("2. Timeline"),
    dataTable(
      ["Date/Time", "Event", "Source"],
      [
        ["~31 Aug, 02:15 UTC", "CDC pipeline fails silently (estimated from log analysis)", "Qlik Replicate logs"],
        ["31 Aug — 03 Sep", "Pipeline down. No alerts generated. SAP inventory frozen at 31 Aug levels.", "—"],
        ["03 Sep, 08:12 CET", "Pieter de Vries starts daily manual sync check per TRN-2025-001 Section 5", "Manual process"],
        ["03 Sep, 08:28 CET", "Pieter identifies SKU MCG-6610 shows 300 units in SAP but only 214 in WMS", "WMS + SAP comparison"],
        ["03 Sep, 08:35 CET", "Pieter escalates to IT Operations Help Desk (Ticket INC-2025-04872)", "ServiceNow"],
        ["03 Sep, 09:15 CET", "IT confirms CDC pipeline is DOWN — last successful sync: 31 Aug 02:12 UTC", "Qlik Replicate admin"],
        ["03 Sep, 11:00 CET", "Root cause identified: network certificate expiry on Replicate server", "IT Security"],
        ["03 Sep, 14:30 CET", "Certificate renewed, pipeline restarted", "IT Ops"],
        ["03 Sep, 15:45 CET", "Backlog of 72 hours of changes begins processing", "Qlik Replicate"],
        ["04 Sep, 06:00 CET", "Full sync complete. SAP and WMS reconciled.", "Automated"],
      ]
    ),

    heading("3. Impact Assessment"),
    heading("3.1 Phantom Inventory Created", 2),
    para("During the 72-hour outage, SAP continued to show inventory levels from 31 August while actual stock in WMS changed due to picks, receipts, and adjustments:"),
    dataTable(
      ["Metric", "Value"],
      [
        ["Total SKUs affected", "143"],
        ["Total phantom units (SAP > WMS)", "847 units"],
        ["Total ghost units (WMS > SAP)", "312 units"],
        ["Orders allocated against phantom stock", "94 orders"],
        ["Orders that shipped late due to allocation failure", "31 orders"],
        ["Customer complaints generated", "18"],
      ]
    ),

    heading("3.2 Financial Impact", 2),
    dataTable(
      ["Category", "Amount"],
      [
        ["Emergency inter-DC transfers (stock borrowed from Antwerp DC)", "€14,200"],
        ["Expedited shipping to fulfill late orders", "€8,400"],
        ["Customer compensation (vouchers for late delivery)", "€3,100"],
        ["IT overtime (incident response + reconciliation)", "€4,800"],
        ["Total direct cost", "€30,500"],
      ]
    ),

    heading("4. Root Cause"),
    labelValue("Primary Cause", "TLS certificate on the Qlik Replicate CDC server expired on 31 August 2025. The certificate was issued 12 months prior and was not included in the IT certificate renewal tracking system."),
    labelValue("Contributing Cause", "No automated pipeline health monitoring. The CDC pipeline had no heartbeat check, no row-count reconciliation, and no alerting on sync lag."),
    labelValue("Detection Gap", "The failure was only detected because Rotterdam DC has implemented the daily manual sync check procedure (TRN-2025-001 Section 5). Other DCs do NOT have this check — similar silent failures may be occurring undetected."),
    calloutBox("This incident validates the $48M annual cost estimate for Nightmare #1 (Phantom Inventory) — a figure built from estate-wide stockouts, write-offs and expedite fees, not from scaling up one outage. Rotterdam is the shape of the problem rather than its arithmetic: one 72-hour CDC failure at one DC produced 847 phantom units and EUR 30,500 of write-off, with no alert for three days. Across 28 DCs with no monitoring, that exposure is unbounded. Pipeline health monitoring is Priority #1 for Project Qlarity Phase 1.", "critical"),

    heading("5. Corrective Actions"),
    dataTable(
      ["#", "Action", "Owner", "Deadline", "Status"],
      [
        ["1", "Implement pipeline heartbeat monitoring at Rotterdam DC", "IT Ops", "15 Sep 2025", "Complete ✓"],
        ["2", "Add all CDC certificates to renewal tracking system", "IT Security", "30 Sep 2025", "Complete ✓"],
        ["3", "Roll out pipeline monitoring to ALL 28 DCs", "CIO (M. Chen)", "31 Dec 2025", "In progress"],
        ["4", "Implement automated row-count reconciliation (WMS vs SAP)", "Integration Team", "31 Jan 2026", "Not started"],
        ["5", "Evaluate alerting thresholds for sync lag > 30 min", "IT Ops", "31 Oct 2025", "In progress"],
      ]
    ),

    ...signatureBlock("Marcus Chen", "Chief Information Officer", "IT Division"),
    ...signatureBlock("Henrik Jansen", "VP Warehouse Operations", "Operations Division"),
  ]);
}

// ═══ INC-2025-05102: TransFrio Spoilage ═══
function incTransFrio() {
  return buildDocument("INCIDENT REPORT", [
    heading("INC-2025-05102: TransFrio São Paulo-Buenos Aires — Cold Chain Spoilage Event"),
    metadataTable([
      ["Incident ID", "INC-2025-05102"],
      ["Severity", "P1 — Critical"],
      ["Date Range", "July — September 2025 (Q3)"],
      ["Date Root Cause Identified", "18 September 2025"],
      ["Total Financial Impact", "$2.48M"],
      ["Carrier", "TransFrio Logistics S.A."],
      ["Route", "São Paulo DC → Buenos Aires DC (1,500 km, ~22 hours)"],
      ["Products Affected", "Fresh produce, dairy, frozen goods"],
      ["Reported By", "Roberto Almeida, LATAM Operations Director"],
    ]),

    heading("1. Executive Summary"),
    calloutBox("Over Q3 2025, MCG experienced $2.48M in product spoilage on the São Paulo-Buenos Aires cold chain corridor operated by TransFrio Logistics. The root cause — TransFrio's unannounced replacement of 6 fleet trucks with new Thermo King X4 7500 reefer units whose drivers hadn't been retrained — took 3 weeks to identify because IoT temperature data and carrier fleet data lived in disconnected systems.", "critical"),

    heading("2. Spoilage Timeline"),
    dataTable(
      ["Week", "Spoilage Rate", "$ Impact", "Internal Assessment"],
      [
        ["W27 (Jul 7)", "1.2%", "$82K", "Within normal range"],
        ["W28 (Jul 14)", "2.1%", "$143K", "Slight increase — attributed to summer heat"],
        ["W29 (Jul 21)", "3.8%", "$261K", "Escalating — TransFrio asked to investigate"],
        ["W30 (Jul 28)", "4.1%", "$280K", "TransFrio blames 'extreme heat wave'"],
        ["W31-W35", "3.2-4.5%", "$1,180K", "Ongoing — operations teams accept heat explanation"],
        ["W36 (Sep 8)", "3.9%", "$267K", "Analyst Roberto Almeida manually correlates IoT + fleet data"],
        ["W37 (Sep 15)", "—", "—", "Root cause identified: fleet change + driver retraining gap"],
        ["W38 (Sep 22)", "—", "—", "TransFrio confirms fleet replacement in July"],
      ]
    ),
    labelValue("Total Q3 Spoilage", "$2.48M ($1.82M product + $0.41M expedited replacements + $0.25M customer refunds)"),

    heading("3. Root Cause Analysis"),
    heading("3.1 What Happened", 2),
    para("In early July 2025, TransFrio replaced 6 of its 12 dedicated MCG fleet trucks with newer models equipped with Thermo King X4 7500 reefer units. The X4 7500 has a different startup sequence than the older X4 7300 units:"),
    dataTable(
      ["Step", "X4 7300 (Old)", "X4 7500 (New)"],
      [
        ["1", "Press START", "Press and HOLD START for 3 seconds"],
        ["2", "Set temperature on dial", "Enter temperature on digital keypad"],
        ["3", "Unit reaches setpoint in ~15 min", "Unit requires 30-second initialization before cooling begins"],
        ["4", "Pre-cool confirmation: green light", "Pre-cool confirmation: digital display shows 'READY'"],
      ]
    ),
    para("Drivers using the old X4 7300 procedure on the new X4 7500 were pressing START briefly (instead of holding), causing the unit to enter standby mode rather than active cooling. This resulted in a 30-45 minute delay before the unit actually began cooling — effectively shipping with warm trailers."),

    heading("3.2 Why It Took 3 Weeks to Identify", 2),
    para("The delay in root cause identification was due to data silos:"),
    para("Tive IoT sensors recorded the temperature excursions accurately — data was available in MCG's IoT platform", { bullet: true }),
    para("TransFrio's fleet management system recorded which trucks were used on which routes — data was NOT shared with MCG", { bullet: true }),
    para("MCG's analytics dashboards showed spoilage trending upward but had no carrier fleet metadata to correlate against", { bullet: true }),
    para("The 'summer heat' explanation was plausible and accepted without challenge for 3 weeks", { bullet: true }),
    calloutBox("If MCG had a unified data layer connecting IoT telemetry with carrier fleet data, the correlation between fleet truck changeover (July) and spoilage spike (July) would have been immediately visible. This is exactly the kind of insight Project Qlarity's data integration will enable.", "info"),

    heading("4. Corrective Actions"),
    para("Immediate actions taken:"),
    numberedItem(1, "Formal corrective action notice sent to TransFrio (SUPP-2025-TransFrio, 01 October 2025)"),
    numberedItem(2, "Pre-cooling verification added to loading protocol: MCG dock staff must verify reefer display shows 0°C or below before allowing loading"),
    numberedItem(3, "TransFrio required to install APUs for Argentine border wait (14-hour average)"),
    numberedItem(4, "Telemetry data sharing via API required within 60 days"),
    para("Long-term actions:"),
    numberedItem(5, "Project Qlarity Phase 1 will include IoT-to-carrier data correlation pipeline"),
    numberedItem(6, "Spoilage prediction model (Qlik AutoML) to detect anomalies within 48 hours, not 3 weeks"),

    ...signatureBlock("Roberto Almeida", "LATAM Operations Director", "Meridian Commerce Group"),
    ...signatureBlock("Thomas Brennan", "VP Supply Chain", "Global Supply Chain Division"),
  ]);
}

async function main() {
  console.log("Generating enriched business documents...");
  await saveDocument(poSamsung(), path.join(DOCS, "purchase_orders", "PO-2025-RTD-00847_Samsung_Electronics.docx"));
  await saveDocument(poNinjaVan(), path.join(DOCS, "purchase_orders", "PO-2025-SIN-01203_NinjaVan_Packaging.docx"));
  console.log("  ✓ 2 purchase orders");
  await saveDocument(suppFreshDirect(), path.join(DOCS, "supplier_comms", "SUPP-2025-FreshDirect_Performance_Review.docx"));
  await saveDocument(suppTransFrio(), path.join(DOCS, "supplier_comms", "SUPP-2025-TransFrio_Contract_Review.docx"));
  console.log("  ✓ 2 supplier communications");
  await saveDocument(recallLettuce(), path.join(DOCS, "recall_notices", "RCL-2025-003_Lettuce_Recall.docx"));
  console.log("  ✓ 1 recall notice");
  await saveDocument(shipManifest(), path.join(DOCS, "shipping", "SHIP-2025-RTD-44821_Delivery_Manifest.docx"));
  console.log("  ✓ 1 shipping manifest");
  await saveDocument(incRotterdam(), path.join(DOCS, "incident_reports", "INC-2025-04872_Rotterdam_Pipeline_Failure.docx"));
  await saveDocument(incTransFrio(), path.join(DOCS, "incident_reports", "INC-2025-05102_TransFrio_Spoilage.docx"));
  console.log("  ✓ 2 incident reports");
  console.log("✅ 8 enriched business documents generated.");
}

main().catch((err) => { console.error(err); process.exit(1); });
