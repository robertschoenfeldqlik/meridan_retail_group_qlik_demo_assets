// Generate Carrier Contracts & Incident Report DOCX files
const {
  buildDocument, saveDocument,
  metadataTable, dataTable,
  heading, para, labelValue, calloutBox, numberedItem, signatureBlock,
} = require("./mcg-docx-builder");
const path = require("path");

const CARRIERS = path.join(__dirname, "..", "documents", "carrier_contracts");
const INCIDENTS = path.join(__dirname, "..", "documents", "incident_reports");

// ═══ CARRIER-NV-2025: NinjaVan Contract Amendment ═══
function carrierNV() {
  return buildDocument("CONTRACT AMENDMENT", [
    heading("NinjaVan Singapore — Contract Amendment AMD3"),
    metadataTable([
      ["Document ID", "CARRIER-NV-2025"],
      ["Amendment", "AMD3"],
      ["Effective Date", "01 October 2025"],
      ["MCG Contract Ref", "MSA-2023-NV-SG-001"],
      ["MCG Contact", "Wei Lin Tan, Regional Logistics Manager APAC"],
      ["NinjaVan Contact", "James Chua, Enterprise Account Director"],
      ["Status", "EXECUTED — Signed by both parties"],
    ]),

    heading("1. Background"),
    para("This Amendment No. 3 (\"AMD3\") to the Master Service Agreement MSA-2023-NV-SG-001 between Meridian Commerce Group Pte. Ltd. (\"MCG\") and NinjaVan Pte. Ltd. (\"Carrier\") modifies the service level terms for parcel deliveries in the Republic of Singapore."),

    heading("2. Service Level Modification"),
    para("Effective 01 October 2025, the following service tier reclassification applies:"),
    dataTable(
      ["Weight Band", "Previous SLA", "New SLA (AMD3)", "Service Tier"],
      [
        ["0-2 kg", "Next-day", "Next-day (unchanged)", "Express"],
        ["2-5 kg", "Next-day", "Next-day (unchanged)", "Express"],
        ["5-10 kg", "2-day delivery", "3-day delivery ⚠", "Standard"],
        ["10-20 kg", "3-day delivery", "3-day delivery (unchanged)", "Standard"],
        ["> 20 kg", "5-day delivery", "5-day delivery (unchanged)", "Freight"],
      ]
    ),
    calloutBox("CRITICAL IMPACT: The reclassification of 5-10 kg parcels from 2-day to 3-day delivery was NOT communicated to MCG's e-commerce fulfillment team for over 3 weeks after execution. During this period, the MCG website continued to promise 2-day delivery for 5-10 kg orders in Singapore, affecting approximately 14,000 customers per month.", "critical"),

    heading("3. Rate Adjustments"),
    dataTable(
      ["Weight Band", "Previous Rate (SGD)", "New Rate (SGD)", "Change"],
      [
        ["0-2 kg", "$3.80", "$3.95", "+3.9%"],
        ["2-5 kg", "$5.20", "$5.45", "+4.8%"],
        ["5-10 kg", "$8.50", "$7.20", "-15.3%"],
        ["10-20 kg", "$12.00", "$12.60", "+5.0%"],
        ["> 20 kg", "$18.50", "$19.25", "+4.1%"],
      ]
    ),
    para("Note: The rate reduction for the 5-10 kg band reflects the reduced service level (3-day vs 2-day)."),

    heading("4. Performance Metrics (Post-Amendment)"),
    dataTable(
      ["Metric", "Target", "Q3 Actual", "Variance"],
      [
        ["On-time delivery (all bands)", "95%", "82%", "-13% ⚠"],
        ["First-attempt delivery rate", "90%", "84%", "-6%"],
        ["Tracking data availability", "99%", "71%", "-28% ⚠"],
        ["Customer complaint rate", "< 2%", "4.7%", "+2.7% ⚠"],
        ["WISMO rate (Singapore)", "< 30%", "52%", "+22% ⚠"],
      ]
    ),

    heading("5. Penalty Clauses"),
    para("The following penalty structure remains in effect per the original MSA:"),
    para("SLA breach > 5%: 2% rebate on monthly invoice", { bullet: true }),
    para("SLA breach > 10%: 5% rebate on monthly invoice", { bullet: true }),
    para("SLA breach > 15%: MCG may terminate with 30 days notice", { bullet: true }),
    para("Tracking data availability < 90%: SGD 0.10 surcharge per untracked parcel", { bullet: true }),

    heading("6. Signatures"),
    ...signatureBlock("Wei Lin Tan", "Regional Logistics Manager, APAC", "Meridian Commerce Group Pte. Ltd."),
    ...signatureBlock("James Chua", "Enterprise Account Director", "NinjaVan Pte. Ltd."),
  ]);
}

// ═══ CARRIER-FEDEX-2025: FedEx Rate Card ═══
function carrierFedEx() {
  return buildDocument("CARRIER RATE CARD", [
    heading("FedEx Americas — 2025 Rate Card"),
    metadataTable([
      ["Document ID", "CARRIER-FEDEX-2025"],
      ["Effective Period", "01 January 2025 — 31 December 2025"],
      ["MCG Contract Ref", "MSA-2021-FDX-US-003"],
      ["MCG Contact", "Carlos Rivera, Director of Logistics, Americas"],
      ["FedEx Contact", "Diane Kowalski, Senior Account Executive"],
      ["Currency", "USD"],
    ]),

    heading("1. Ground Service Rates"),
    dataTable(
      ["Weight Band", "Zone 1-2", "Zone 3-4", "Zone 5-6", "Zone 7-8"],
      [
        ["0-1 lb", "$7.50", "$8.25", "$9.10", "$10.80"],
        ["1-5 lb", "$9.20", "$10.45", "$11.90", "$14.25"],
        ["5-10 lb", "$12.80", "$14.60", "$16.75", "$20.10"],
        ["10-25 lb", "$18.50", "$21.20", "$24.40", "$29.30"],
        ["25-50 lb", "$26.00", "$29.90", "$34.50", "$41.40"],
        ["50-70 lb", "$38.00", "$43.70", "$50.50", "$60.60"],
      ]
    ),

    heading("2. Express Service Rates"),
    dataTable(
      ["Service", "Weight Limit", "Transit Time", "Base Rate"],
      [
        ["FedEx Express Saver", "150 lb", "3 business days", "Ground + 40%"],
        ["FedEx 2Day", "150 lb", "2 business days", "Ground + 75%"],
        ["FedEx Standard Overnight", "150 lb", "Next business day (PM)", "Ground + 120%"],
        ["FedEx Priority Overnight", "150 lb", "Next business day (AM)", "Ground + 160%"],
        ["FedEx First Overnight", "150 lb", "Next business day (8:00 AM)", "Ground + 220%"],
      ]
    ),

    heading("3. Dimensional Weight Calculation"),
    para("FedEx applies dimensional weight pricing when dimensional weight exceeds actual weight:"),
    para("Dimensional Weight (lb) = (L × W × H in inches) ÷ 139", { bold: true }),
    calloutBox("MCG IMPACT: 8,200 products have missing or incorrect weight/dimension data in the product master. This causes shipping cost miscalculations estimated at $2.1M annually. Products without dimensions default to maximum dimensional weight, resulting in overbilling.", "warning"),

    heading("4. Surcharges (2025)"),
    dataTable(
      ["Surcharge", "Amount", "Applies To"],
      [
        ["Fuel surcharge", "Variable (avg. 8.5%)", "All shipments"],
        ["Residential delivery", "$4.40", "Non-commercial addresses"],
        ["Address correction", "$21.00", "Invalid/incomplete addresses"],
        ["Oversize (> 48\" any side)", "$32.50", "Per package"],
        ["Additional handling (> 50 lb)", "$18.00", "Per package"],
        ["Delivery area surcharge", "$4.20-$7.80", "Extended ZIP codes"],
        ["Signature required", "$6.50", "Per package when requested"],
      ]
    ),
    calloutBox("MCG spent $847,000 on FedEx address correction surcharges in FY2024 due to address data quality issues. At $21.00 per correction on ~40,300 shipments, this represents a direct cost of the Address Data Catastrophe (Nightmare #2).", "critical"),

    heading("5. Volume Discount Tiers"),
    dataTable(
      ["Annual Volume (packages)", "Discount"],
      [
        ["< 100,000", "Base rate"],
        ["100,000-500,000", "8% discount"],
        ["500,000-1,000,000", "14% discount"],
        ["> 1,000,000", "19% discount (MCG current tier)"],
      ]
    ),
    para("MCG FY2024 Americas volume: 1,247,000 packages. Current discount tier: 19%."),

    ...signatureBlock("Carlos Rivera", "Director of Logistics, Americas", "Meridian Commerce Group Inc."),
  ]);
}

// ═══ CARRIER-DPD-2025: DPD Service Agreement ═══
function carrierDPD() {
  return buildDocument("CARRIER SERVICE AGREEMENT", [
    heading("DPD EU — Service Agreement 2025"),
    metadataTable([
      ["Document ID", "CARRIER-DPD-2025"],
      ["Effective Period", "01 January 2025 — 31 December 2025"],
      ["MCG Contract Ref", "MSA-2022-DPD-EU-001"],
      ["MCG Contact", "Sophie Müller, EU Logistics Manager"],
      ["DPD Contact", "Klaus Weidmann, Key Account Manager"],
      ["Service Territory", "EU-27 + UK, Switzerland, Norway"],
    ]),

    heading("1. Service Tiers"),
    dataTable(
      ["Service", "Transit Time", "Coverage", "Tracking"],
      [
        ["DPD Classic", "2-3 business days", "EU-27 domestic", "Standard"],
        ["DPD Express", "Next business day", "Major EU cities", "Premium"],
        ["DPD International", "3-7 business days", "Cross-border EU", "Standard"],
        ["DPD Predict", "2-3 BD with 1-hour window", "NL, DE, BE, FR, UK", "Premium + SMS"],
      ]
    ),

    heading("2. Tracking Status Codes"),
    para("DPD provides tracking status updates in the LOCAL LANGUAGE of the delivery country. MCG systems must handle multi-language status mapping:"),
    dataTable(
      ["DPD Status (German)", "DPD Status (Dutch)", "DPD Status (French)", "MCG Canonical Status"],
      [
        ["Paketankündigung", "Pakket aangekondigd", "Colis annoncé", "Label Created"],
        ["Im Paketzentrum", "In pakketcentrum", "Au centre de tri", "In Transit"],
        ["In Zustellung", "In bezorging", "En livraison", "Out for Delivery"],
        ["Zugestellt", "Bezorgd", "Livré", "Delivered"],
        ["Nicht zustellbar", "Niet bezorgbaar", "Non livrable", "Delivery Failed"],
        ["Retoure", "Retour", "Retour", "Return to Sender"],
      ]
    ),
    calloutBox("MCG IMPACT: The multi-language status codes from DPD are a core contributor to Nightmare #6 (Carrier Data Black Hole). Customer service agents seeing 'Zugestellt' or 'Bezorgd' cannot readily determine delivery status without the translation guide. The Talend Carrier Status Normalizer transformation route addresses this.", "warning"),

    heading("3. Rate Structure (EUR)"),
    dataTable(
      ["Weight Band", "Domestic", "Intra-EU Zone 1", "Intra-EU Zone 2", "UK"],
      [
        ["0-2 kg", "€4.20", "€7.50", "€9.80", "€11.20"],
        ["2-5 kg", "€5.80", "€9.20", "€12.40", "€14.60"],
        ["5-10 kg", "€8.40", "€12.80", "€16.90", "€19.80"],
        ["10-20 kg", "€12.60", "€18.40", "€24.20", "€28.50"],
        ["20-31.5 kg", "€18.20", "€26.80", "€35.40", "€41.20"],
      ]
    ),

    heading("4. SLA Targets"),
    dataTable(
      ["Metric", "Target", "Penalty Trigger"],
      [
        ["On-time delivery", "96%", "< 93% triggers rebate"],
        ["First-attempt success", "92%", "< 88% triggers review"],
        ["Tracking update frequency", "Every scan point", "Gaps > 12h trigger investigation"],
        ["Damage rate", "< 0.5%", "> 1% triggers corrective action"],
      ]
    ),

    heading("5. Data Exchange"),
    para("DPD delivers tracking data to MCG via:"),
    para("Real-time webhook (POST to MCG endpoint) for status changes", { bullet: true }),
    para("Daily SFTP file (CSV) with full-day reconciliation by 06:00 CET", { bullet: true }),
    para("DPD MyParcel API for on-demand tracking queries", { bullet: true }),
    calloutBox("Data format: All timestamps in DPD feeds use CET/CEST without explicit timezone indicator. MCG systems must apply CET offset. This is a known contributor to Nightmare #5 (Timestamp Tower of Babel).", "warning"),

    ...signatureBlock("Sophie Müller", "EU Logistics Manager", "Meridian Commerce Group B.V."),
    ...signatureBlock("Klaus Weidmann", "Key Account Manager", "DPDgroup"),
  ]);
}

// ═══ INC-2025-04872: Rotterdam Pipeline Failure ═══
function incRotterdam() {
  return buildDocument("INCIDENT REPORT", [
    heading("INC-2025-04872: Rotterdam DC Pipeline Failure"),
    metadataTable([
      ["Incident ID", "INC-2025-04872"],
      ["Severity", "P1 — Critical"],
      ["Status", "CLOSED — Root Cause Identified"],
      ["Date Detected", "14 July 2025, 09:42 CET"],
      ["Date Originated", "10 July 2025, 02:15 CET (estimated)"],
      ["Duration Undetected", "4 days, 7 hours, 27 minutes"],
      ["Reported By", "Anke de Vries, Inventory Control Analyst"],
      ["Assigned To", "IT Operations — Data Integration Team"],
    ]),

    heading("1. Executive Summary"),
    calloutBox("The WMS-to-SAP inventory synchronization batch job for Rotterdam DC failed silently on 10 July 2025 and was not detected for 4.3 days. During this period, 847 inventory movements were not reflected in SAP, creating phantom inventory across 42 SKUs. Seven stores experienced preventable out-of-stock events on products that SAP showed as available.", "critical"),

    heading("2. Timeline"),
    dataTable(
      ["Date/Time", "Event"],
      [
        ["10 Jul, 02:15 CET", "WMS-SAP batch job RTD-INV-SYNC-001 fails. Error logged to /var/log/batch/rtd-sync.log. No alert generated."],
        ["10 Jul, 05:00 CET", "Daily Expected Receipts Report runs using SAP data — shows stale inventory. No anomaly detected."],
        ["10-13 Jul", "72 hours of inventory movements (receipts, picks, adjustments) accumulate in WMS but do not reach SAP."],
        ["12 Jul, 14:30 CET", "Store manager in Eindhoven reports BT speaker (MCG-4420) out of stock. SAP shows 500 units at Rotterdam. Treated as logistics delay."],
        ["13 Jul, 08:00 CET", "Two more stores report same SKU stockout. Inventory control begins investigation."],
        ["14 Jul, 09:42 CET", "Anke de Vries discovers WMS shows 312 units of MCG-4420 at Rotterdam vs SAP's 500. Physical count: 287. Pipeline failure identified."],
        ["14 Jul, 11:00 CET", "IT Operations confirms batch job has been failing since 10 July. Error: database connection timeout (Oracle WMS maintenance window overlap)."],
        ["14 Jul, 16:00 CET", "Recovery batch executed. 847 backlogged transactions replayed to SAP."],
        ["15 Jul, 10:00 CET", "Full reconciliation confirms all stores impacted. 7 stores had out-of-stock events on products showing available in SAP."],
      ]
    ),

    heading("3. Root Cause Analysis"),
    para("Primary cause: The WMS-SAP synchronization batch job encountered a database connection timeout during a scheduled Oracle WMS maintenance window. The error was logged to a local file only — no alerting mechanism existed."),
    para("Contributing factors:"),
    para("Batch job monitoring relies on a log file that no team actively monitors", { bullet: true }),
    para("No heartbeat/health check mechanism for the sync pipeline", { bullet: true }),
    para("No data freshness SLA alert (e.g., 'if no WMS data received in 2 hours, alert')", { bullet: true }),
    para("Oracle maintenance window was not communicated to the integration team", { bullet: true }),
    para("SAP inventory reports do not flag stale data — they present last-known values as current", { bullet: true }),

    heading("4. Business Impact"),
    dataTable(
      ["Impact Category", "Measurement"],
      [
        ["Phantom inventory created", "847 units across 42 SKUs"],
        ["Stores with preventable stockouts", "7"],
        ["Estimated lost revenue", "€34,200"],
        ["Customer complaints generated", "23"],
        ["Manual recovery effort", "18 person-hours"],
        ["Time to detect", "4 days 7 hours 27 minutes"],
      ]
    ),

    heading("5. Corrective Actions"),
    dataTable(
      ["Action", "Owner", "Deadline", "Status"],
      [
        ["Implement pipeline health monitoring with 2-hour SLA alert", "IT Ops", "01 Aug 2025", "Complete"],
        ["Add heartbeat check for all batch sync jobs", "IT Ops", "15 Aug 2025", "Complete"],
        ["Create SAP data freshness indicator on inventory reports", "BI Team", "01 Sep 2025", "In Progress"],
        ["Include integration team in Oracle maintenance notifications", "DBA Team", "Immediate", "Complete"],
        ["Evaluate Project Qlarity for enterprise pipeline monitoring", "CDO Office", "31 Oct 2025", "Pending"],
      ]
    ),

    heading("6. Lessons Learned"),
    para("This incident exemplifies Nightmare #4 (Silent Pipeline Failures). The average detection time for silent failures across MCG is 4.3 days — this incident was exactly on that average. Without proactive monitoring, the business operates on stale data with no awareness of the problem."),

    ...signatureBlock("Marcus Chen", "Chief Information Officer", "Meridian Commerce Group"),
  ]);
}

// ═══ INC-2025-05102: TransFrio LATAM Spoilage ═══
function incTransFrio() {
  return buildDocument("INCIDENT REPORT", [
    heading("INC-2025-05102: LATAM Cold Chain Spoilage — TransFrio"),
    metadataTable([
      ["Incident ID", "INC-2025-05102"],
      ["Severity", "P1 — Critical"],
      ["Status", "CLOSED — Corrective Action In Progress"],
      ["Period", "Q3 2025 (July — September)"],
      ["Region", "LATAM — São Paulo to Buenos Aires corridor"],
      ["Carrier", "TransFrio Logistics S.A."],
      ["Financial Impact", "$2.48M (spoilage losses)"],
      ["Reported By", "Roberto Almeida, LATAM Operations Director"],
    ]),

    heading("1. Executive Summary"),
    calloutBox("Q3 2025 saw a 340% increase in temperature exceedances on the São Paulo-Buenos Aires corridor operated by TransFrio Logistics. Total spoilage losses reached $2.48M, up from $560K in Q2. The root cause was a combination of a refrigeration startup gap in TransFrio's new fleet and increased border crossing wait times. The issue was initially dismissed as 'summer heat' for 3 weeks because IoT sensor data and carrier operational data are not connected in any MCG system.", "critical"),

    heading("2. Incident Discovery"),
    para("The spoilage increase was first noticed by warehouse receiving staff in Buenos Aires who reported a rising number of temperature-rejected inbound shipments. Initial reports were attributed to seasonal heat (Southern Hemisphere summer approaching)."),
    para("After 3 weeks, a pattern analysis by the LATAM operations team revealed:"),
    para("Temperature exceedances were concentrated on TransFrio routes specifically", { bullet: true }),
    para("Exceedances occurred during the first 15 minutes of each trip segment", { bullet: true }),
    para("The pattern correlated with TransFrio's July fleet upgrade to new Thermo King units", { bullet: true }),

    heading("3. Root Cause Analysis"),
    heading("3.1 Primary Cause: Refrigeration Startup Gap", 2),
    para("TransFrio upgraded their São Paulo-Buenos Aires fleet to new Thermo King X4 7500 units in July 2025. The new units have a 15-minute startup sequence to reach target temperature. TransFrio's drivers were loading pre-cooled cargo immediately after engine start, before the trailer reached 0°C."),
    para("Previous fleet (Carrier Transicold units) had a 3-minute startup time. The loading SOP was not updated for the new fleet."),

    heading("3.2 Contributing Cause: Border Crossing Delays", 2),
    para("The Uruguaiana border crossing (Brazil-Argentina) experienced processing delays averaging 4.2 hours in Q3 (up from 1.8 hours in Q2) due to new customs documentation requirements. During these waits, some drivers turned off refrigeration units to conserve fuel."),

    heading("3.3 Systemic Cause: Disconnected Data", 2),
    calloutBox("The 3-week delay in identifying the root cause occurred because MCG has no system that correlates: (1) IoT temperature telemetry data, (2) Carrier operational data (fleet changes, route timing), and (3) Border crossing/customs event data. Each dataset existed in isolation. This is a direct manifestation of Nightmare #6 (Carrier Data Black Hole).", "warning"),

    heading("4. Financial Impact"),
    dataTable(
      ["Category", "Q2 2025", "Q3 2025", "Increase"],
      [
        ["Product spoilage (direct)", "$420K", "$1.86M", "343%"],
        ["Emergency replacement stock", "$95K", "$380K", "300%"],
        ["Carrier penalty claims filed", "$30K", "$120K", "300%"],
        ["Customer refunds", "$15K", "$120K", "700%"],
        ["Total", "$560K", "$2.48M", "343%"],
      ]
    ),

    heading("5. Corrective Actions"),
    dataTable(
      ["Action", "Owner", "Deadline", "Status"],
      [
        ["Require TransFrio 0°C pre-cooling (up from 2°C)", "T. Brennan", "Immediate", "Complete"],
        ["TransFrio APU installation for border wait periods", "TransFrio", "30 days", "In Progress"],
        ["Real-time telemetry data sharing from TransFrio", "TransFrio", "60 days", "In Progress"],
        ["Integrate IoT + carrier data in unified dashboard", "CDO Office", "Project Qlarity", "Planned"],
        ["Penalty structure for temperature exceedances", "Legal", "30 days", "Complete"],
      ]
    ),

    ...signatureBlock("Thomas Brennan", "VP Supply Chain", "Global Supply Chain Division"),
    ...signatureBlock("Roberto Almeida", "LATAM Operations Director", "Meridian Commerce Group Ltda."),
  ]);
}

// ─── RUN ───
async function main() {
  console.log("Generating carrier contracts...");
  await saveDocument(carrierNV(), path.join(CARRIERS, "CARRIER-NV-2025_NinjaVan_Contract_Amendment.docx"));
  await saveDocument(carrierFedEx(), path.join(CARRIERS, "CARRIER-FEDEX-2025_Rate_Card.docx"));
  await saveDocument(carrierDPD(), path.join(CARRIERS, "CARRIER-DPD-2025_Service_Agreement.docx"));
  console.log("✅ 3 carrier contracts generated.");

  console.log("Generating incident reports...");
  await saveDocument(incRotterdam(), path.join(INCIDENTS, "INC-2025-04872_Rotterdam_Pipeline_Failure.docx"));
  await saveDocument(incTransFrio(), path.join(INCIDENTS, "INC-2025-05102_TransFrio_Spoilage.docx"));
  console.log("✅ 2 incident reports generated.");
}

main().catch(console.error);
