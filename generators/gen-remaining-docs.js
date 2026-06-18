// Generate Training, Meeting Minutes, Compliance, Project Brief DOCX files
const {
  buildDocument, saveDocument,
  metadataTable, dataTable,
  heading, para, labelValue, calloutBox, numberedItem, signatureBlock,
} = require("./mcg-docx-builder");
const path = require("path");
const DOCS = path.join(__dirname, "..", "documents");

// ═══ TRN-2025-001: WMS-SAP Integration Guide ═══
function trnWmsSap() {
  return buildDocument("TRAINING GUIDE", [
    heading("TRN-2025-001: WMS-SAP Integration — Operational Guide"),
    metadataTable([
      ["Document ID", "TRN-2025-001"],
      ["Version", "1.3"],
      ["Date", "01 August 2025"],
      ["Author", "IT Operations — Integration Team"],
      ["Audience", "Warehouse supervisors, inventory analysts, DC managers"],
      ["Prerequisite", "WMS basic operations certification"],
    ]),

    heading("1. Overview"),
    para("This guide explains how inventory data flows between MCG's Warehouse Management Systems (WMS) and SAP ERP, including known synchronization delays, timezone handling, and what to do when things go wrong."),

    heading("2. System Architecture"),
    dataTable(
      ["Component", "Technology", "Region", "Data Flow"],
      [
        ["WMS (Americas, EU)", "Oracle WMS", "Americas, EU", "WMS → CDC → SAP"],
        ["WMS (APAC)", "Manhattan Associates", "APAC", "WMS → CDC → SAP"],
        ["ERP", "SAP S/4HANA", "Global", "Central record system"],
        ["Replication", "Qlik Replicate (CDC)", "Global", "15-min batch sync"],
      ]
    ),

    heading("3. Synchronization Timing"),
    para("WMS-to-SAP synchronization runs via Change Data Capture (CDC) in 15-minute batch windows:"),
    calloutBox("If you post a goods receipt in WMS and check SAP immediately, the receipt will NOT be visible. Normal sync lag is 15-30 minutes. Do not escalate until at least 20 minutes have passed.", "warning"),
    dataTable(
      ["Event in WMS", "Expected in SAP", "Normal Delay"],
      [
        ["Goods receipt posted", "Inventory position update", "15-30 minutes"],
        ["Pick confirmed", "Inventory reduction", "15-30 minutes"],
        ["Cycle count adjustment", "Stock adjustment document", "15-30 minutes"],
        ["Transfer between zones", "Storage location change", "15-30 minutes"],
      ]
    ),

    heading("4. Timestamp Handling — Critical Information"),
    para("This is one of the most common sources of confusion:"),
    dataTable(
      ["System", "Timezone Used", "TZ Indicator?", "Example"],
      [
        ["Oracle WMS (EU)", "CET (UTC+1 / +2 DST)", "NO ⚠", "14:32 (means 14:32 CET)"],
        ["Oracle WMS (Americas)", "Local warehouse time", "NO ⚠", "09:15 (means 09:15 EST/CST/PST)"],
        ["Manhattan WMS (APAC)", "UTC (mostly)", "YES (usually)", "06:32 UTC"],
        ["SAP S/4HANA", "UTC", "YES", "12:02 UTC"],
        ["IoT Sensors (Tive)", "UTC", "YES", "12:02:34.567 UTC"],
      ]
    ),
    calloutBox("EXAMPLE: WMS shows receipt at '14:32' in Rotterdam (CET). SAP shows same receipt at '12:32 UTC'. These are the SAME TIME (CET = UTC + 2 hours). Do NOT create a discrepancy report for timezone differences.", "critical"),
    calloutBox("KNOWN ISSUE: Some APAC DCs (specifically Singapore and Jakarta) have Manhattan WMS misconfigured to use local time instead of UTC. IT is aware and correction is planned for Q1 2026.", "warning"),

    heading("5. Daily Manual Sync Check"),
    para("Until automated monitoring is fully deployed (Project Qlarity), all DC supervisors must perform a daily manual sync check:"),
    numberedItem(1, "At 08:00 local time, select 5 random transactions from yesterday's WMS activity log."),
    numberedItem(2, "Verify each transaction appears in SAP with matching quantities."),
    numberedItem(3, "Record results in the Daily Sync Check spreadsheet."),
    numberedItem(4, "If any transaction is missing from SAP, escalate to IT Operations immediately."),
    para("Estimated time: 15-20 minutes per day.", { italics: true }),

    heading("6. Phantom Inventory — How It Happens"),
    para("Phantom inventory occurs when SAP shows stock that doesn't physically exist. Common causes:"),
    numberedItem(1, "Silent pipeline failure: WMS-SAP sync stops, SAP retains old quantities (see INC-2025-04872)."),
    numberedItem(2, "Picks confirmed in WMS but sync batch fails before reaching SAP."),
    numberedItem(3, "Damaged goods written off in WMS but not yet synced to SAP."),
    numberedItem(4, "Returns processed in SAP but not yet received in WMS."),
    calloutBox("Current phantom inventory rate: 26% of total discrepancy (IRA at 74% vs 97% target). This is MCG's #1 data quality nightmare, costing an estimated $48M annually in misallocated stock, emergency transfers, and lost sales.", "critical"),

    heading("7. Escalation Contacts"),
    dataTable(
      ["Issue", "Contact", "Response SLA"],
      [
        ["Sync delay > 1 hour", "IT Ops Help Desk", "4 hours"],
        ["Missing transactions", "Integration Team Lead", "2 hours"],
        ["Suspected pipeline failure", "IT Ops On-Call", "1 hour"],
        ["Inventory discrepancy > 10%", "Inventory Control Manager", "Immediate"],
      ]
    ),
    ...signatureBlock("Marcus Chen", "Chief Information Officer", "IT Division"),
  ]);
}

// ═══ TRN-2025-002: Cold Chain Monitoring for Drivers ═══
function trnColdChain() {
  return buildDocument("TRAINING GUIDE", [
    heading("TRN-2025-002: Cold Chain Monitoring — Guide for Drivers and Receiving Staff"),
    metadataTable([
      ["Document ID", "TRN-2025-002"],
      ["Version", "1.1"],
      ["Date", "15 September 2025"],
      ["Author", "Supply Chain Operations — Cold Chain Team"],
      ["Audience", "Delivery drivers, receiving dock staff, cold chain handlers"],
    ]),

    heading("1. Temperature Limits — Know Your Product"),
    dataTable(
      ["Product Type", "Min Temp", "Max Temp", "If Exceeded"],
      [
        ["Fresh produce", "1°C", "5°C", "Report if > 8°C for 30+ min"],
        ["Dairy", "2°C", "6°C", "Report if > 8°C for 15+ min"],
        ["Frozen goods", "-25°C", "-18°C", "Report ANY thaw above -15°C"],
        ["Pharmaceuticals", "2°C", "8°C", "Report ANY breach immediately"],
      ]
    ),

    heading("2. Tive IoT Sensors"),
    para("Most MCG perishable shipments include a Tive IoT temperature sensor. These devices:"),
    para("Record temperature every 5 minutes (EU/Americas) or 10 minutes (APAC)", { bullet: true }),
    para("Transmit data automatically via cellular network", { bullet: true }),
    para("Flash red LED if temperature limit is exceeded", { bullet: true }),
    para("DO NOT remove or disable the sensor — it must stay with the shipment", { bullet: true }),

    heading("3. Known Sensor Issues"),
    calloutBox("Americas Fahrenheit Issue: Between July and September 2025, some Tive sensors in Americas DCs were configured to display in Fahrenheit without indicating the unit. If your sensor shows '41' it may mean 41°F (= 5°C, which is fine) or 41°C (critical failure). Check the sensor configuration screen. All sensors should now show '°C'. If yours shows no unit, report to IT.", "warning"),
    calloutBox("Lagos DC Connectivity: The Lagos DC has daily 6-hour internet blackouts (typically 11:00-17:00 WAT). During this time, Tive sensors continue recording but cannot transmit. Temperature alerts will be delayed. Extra vigilance required during blackout hours — check the sensor LED directly.", "warning"),

    heading("4. Receiving Temperature Check"),
    numberedItem(1, "Before unloading, check the trailer temperature on the reefer unit display."),
    numberedItem(2, "Use your handheld probe thermometer to spot-check product temperature."),
    numberedItem(3, "Record the temperature in WMS quality module."),
    numberedItem(4, "If ANY product is outside acceptable range: STOP. Do not unload. Call Quality Manager."),

    heading("5. Pre-Cooling Requirements (Updated October 2025)"),
    para("After the TransFrio spoilage incident (INC-2025-05102), all carriers must pre-cool transport units to 0°C BEFORE loading. The previous standard was 2°C."),
    calloutBox("Drivers: Verify your reefer unit shows 0°C or below BEFORE allowing loading to begin. Loading onto a warm trailer is the #1 cause of cold chain failure.", "critical"),

    ...signatureBlock("Thomas Brennan", "VP Supply Chain", "Global Supply Chain Division"),
  ]);
}

// ═══ MTG-2025-Q3: Supply Chain Review Meeting Minutes ═══
function mtgQ3Review() {
  return buildDocument("MEETING MINUTES", [
    heading("Q3 2025 Supply Chain Performance Review — Meeting Minutes"),
    metadataTable([
      ["Meeting ID", "MTG-2025-Q3-SCR"],
      ["Date", "15 October 2025, 09:00-12:30 CET"],
      ["Location", "MCG HQ Rotterdam, Board Room A (hybrid)"],
      ["Chair", "Ingrid van der Berg, CEO"],
      ["Minutes By", "Priya Ramanathan, CDO"],
      ["Classification", "Confidential — Senior Leadership Only"],
    ]),

    heading("Attendees"),
    dataTable(
      ["Name", "Title", "Attendance"],
      [
        ["Ingrid van der Berg", "CEO", "In person"],
        ["Marcus Chen", "CIO", "In person"],
        ["Priya Ramanathan", "CDO", "In person"],
        ["Thomas Brennan", "VP Supply Chain", "In person"],
        ["Henrik Jansen", "VP Warehouse Operations", "In person"],
        ["Dr. Elena Vasquez", "Chief Compliance Officer", "In person"],
        ["Lisa Park", "Head of Customer Experience", "Virtual"],
        ["Carlos Rivera", "Director of Logistics, Americas", "Virtual"],
        ["Wei Lin Tan", "Regional Logistics Manager, APAC", "Virtual"],
        ["Roberto Almeida", "LATAM Operations Director", "Virtual"],
      ]
    ),

    heading("1. Opening — CEO Statement"),
    para("\"The data tells a story this quarter that none of us should be comfortable with. Out-of-stock events up 34%, delivery SLA breaches at 22% in APAC, $2.48 million in spoilage on a single corridor, and a regulatory citation because we couldn't trace a head of lettuce through our own supply chain in less than 11 days. These are not isolated incidents. They are symptoms of a systemic failure in how we manage data.\"", { italics: true }),
    para("— Ingrid van der Berg, CEO", { bold: true }),

    heading("2. Nightmare Review — Key Discussion Points"),

    heading("2.1 Phantom Inventory Update (Henrik Jansen)", 2),
    para("IRA remains at 74%, unchanged from Q2. The Rotterdam pipeline failure (INC-2025-04872) demonstrated that a single undetected sync failure can create 847 units of phantom inventory. Pipeline monitoring has been implemented at Rotterdam but not yet rolled out to other DCs."),
    para("Henrik: \"We're still asking warehouse staff to do a 15-20 minute manual sync check every morning. That's 855 hours of manual labor across our DC network, every single day. We need automated monitoring.\""),

    heading("2.2 APAC SLA Crisis (Wei Lin Tan)", 2),
    para("Singapore delivery promise accuracy dropped to 69% (from 88% in Q2). Root cause: NinjaVan contract amendment AMD3 changed 5-10 kg delivery from 2-day to 3-day, but the change was not communicated to the e-commerce team for 3+ weeks."),
    para("Wei Lin: \"14,000 customers per month received false delivery promises. Our WISMO rate in Singapore hit 52%. We had no process for carrier-to-e-commerce SLA change notification.\""),

    heading("2.3 LATAM Spoilage (Roberto Almeida)", 2),
    para("$2.48M in Q3 spoilage on the São Paulo-Buenos Aires corridor. The issue was dismissed as 'summer heat' for 3 weeks because IoT and carrier data aren't connected."),
    para("Roberto: \"We had the temperature data. We had the carrier fleet data. But they lived in different systems with no connection. It took a human analyst to manually correlate the data and identify the TransFrio fleet change as the root cause.\""),

    heading("2.4 Compliance Update (Dr. Elena Vasquez)", 2),
    para("NVWA corrective action plan is in progress. Lot number capture at 93% (target: 100%). Store-level tracking at 78% (target: 90% by March 2026). NVWA follow-up inspection expected Q1 2026."),
    para("Elena: \"If we don't have a unified traceability solution by the NVWA follow-up, we risk escalation from citation to enforcement action. The lettuce recall exposed a fundamental gap.\""),

    heading("3. Project Qlarity Discussion"),
    para("Priya Ramanathan presented the Project Qlarity business case:"),
    para("Investment: $12.4M over 24 months", { bullet: true }),
    para("Conservative benefit: $52.7M annually (60% realization of $87.9M potential)", { bullet: true }),
    para("3-year ROI: 952%", { bullet: true }),
    para("Platform: Qlik Talend Cloud + Open Lakehouse + Qlik Analytics + Qlik Answers", { bullet: true }),
    para("CEO: \"Data quality is now our #1 operational priority for 2026. Priya, schedule the full Qlarity presentation for the CIO review on October 31.\"", { bold: true }),

    heading("4. Action Items"),
    dataTable(
      ["Action", "Owner", "Deadline"],
      [
        ["Present Project Qlarity to CIO review board", "P. Ramanathan", "31 Oct 2025"],
        ["Roll out pipeline monitoring to all DCs", "M. Chen", "31 Dec 2025"],
        ["Implement carrier SLA change notification process", "T. Brennan + L. Park", "15 Nov 2025"],
        ["Complete TransFrio corrective actions", "T. Brennan", "31 Dec 2025"],
        ["Achieve 100% lot number capture", "H. Jansen", "01 Nov 2025"],
        ["NVWA follow-up preparation", "E. Vasquez", "28 Feb 2026"],
      ]
    ),

    heading("5. Next Meeting"),
    para("Q4 2025 Supply Chain Performance Review: 15 January 2026, 09:00 CET"),

    ...signatureBlock("Priya Ramanathan", "Chief Data Officer", "Minutes Approved"),
  ]);
}

// ═══ COMP-2025-NVWA: Corrective Action Plan ═══
function compNVWA() {
  return buildDocument("CORRECTIVE ACTION PLAN", [
    heading("COMP-2025-NVWA: Corrective Action Plan — NVWA Citation Response"),
    metadataTable([
      ["Document ID", "COMP-2025-NVWA"],
      ["NVWA Citation", "NVWA-2025-CIT-04412"],
      ["Citation Date", "12 June 2025"],
      ["Response Submitted", "15 July 2025"],
      ["MCG Contact", "Dr. Elena Vasquez, Chief Compliance Officer"],
      ["Status", "In Progress — 3 of 5 actions on track"],
      ["Next Inspection", "Expected Q1 2026"],
    ]),

    heading("1. Citation Summary"),
    para("On 12 June 2025, the Netherlands Food and Consumer Product Safety Authority (NVWA) conducted a routine inspection at MCG's Rotterdam Distribution Center (Europaweg 120, 3199 LD Rotterdam). The inspection identified 5 findings:"),
    dataTable(
      ["Finding", "Severity", "Description"],
      [
        ["F1", "Major", "Lot numbers not consistently captured at goods receipt"],
        ["F2", "Major", "Unable to complete product trace within 24 hours"],
        ["F3", "Significant", "Country of origin missing for 12% of fresh produce"],
        ["F4", "Significant", "Sub-tier supplier relationships not documented"],
        ["F5", "Observation", "Inconsistent timestamp formats in temperature records"],
      ]
    ),

    heading("2. Corrective Action Status"),

    heading("2.1 Action 1: Lot Number Capture (F1)", 2),
    labelValue("Target", "100% lot capture for all food products"),
    labelValue("Deadline", "01 October 2025"),
    labelValue("Status", "93% complete — On Track"),
    para("WMS goods receipt forms converted from free-text to structured input with validation. Blank lot numbers now blocked at system level. Remaining 7% are legacy warehouse locations using older handheld scanners that require firmware update (scheduled for October)."),

    heading("2.2 Action 2: Store Receipt Tracking (F2)", 2),
    labelValue("Target", "90% lot-level tracking at retail stores"),
    labelValue("Deadline", "01 March 2026"),
    labelValue("Status", "78% complete — In Progress"),
    para("Store POS systems being updated to scan and record lot numbers at receipt. 78% of stores (890 of 1,140) now have the capability. Remaining 250 stores (primarily MCG Express format) require POS hardware upgrade."),

    heading("2.3 Action 3: Unified Traceability (F2)", 2),
    labelValue("Target", "Single-query traceability across SAP, WMS, TMS, Salesforce"),
    labelValue("Deadline", "Project Qlarity Phase 1"),
    labelValue("Status", "Business case submitted — Pending CIO approval"),
    para("This corrective action depends on the implementation of Project Qlarity, which will create a unified data layer connecting all 4 traceability systems. Business case presented to senior leadership on 15 October 2025. CIO review scheduled for 31 October 2025."),

    heading("2.4 Action 4: Sub-Tier Supplier Mapping (F4)", 2),
    labelValue("Target", "80% of food suppliers with documented sub-tier relationships"),
    labelValue("Deadline", "01 January 2026"),
    labelValue("Status", "36% complete — At Risk ⚠"),
    calloutBox("This action is at risk. Only 36% of food suppliers have provided sub-tier documentation. Many suppliers cite commercial confidentiality. The Fresh Direct lettuce recall demonstrated the risk of undisclosed sub-tier suppliers.", "warning"),

    heading("2.5 Action 5: Country of Origin Compliance (F3)", 2),
    labelValue("Target", "100% country of origin for fresh produce"),
    labelValue("Deadline", "01 November 2025"),
    labelValue("Status", "88% complete — On Track"),
    para("Procurement team has updated supplier requirements. 88% of fresh produce SKUs now have validated country of origin. Remaining 12% are sourced from multi-origin suppliers where country varies by shipment — process being developed."),

    heading("3. Preparation for Q1 2026 Follow-Up"),
    para("NVWA has indicated a follow-up inspection in Q1 2026. MCG must demonstrate:"),
    numberedItem(1, "100% lot number capture operational"),
    numberedItem(2, "Meaningful progress on store-level tracking (target: 90%)"),
    numberedItem(3, "Approved plan and timeline for unified traceability"),
    numberedItem(4, "Documented progress on sub-tier supplier mapping"),
    numberedItem(5, "Complete country of origin compliance"),

    ...signatureBlock("Dr. Elena Vasquez", "Chief Compliance Officer", "Legal & Compliance Division"),
  ]);
}

// ═══ PROJ-CLARITY-2025: Business Case ═══
function projClarity() {
  return buildDocument("PROJECT BUSINESS CASE", [
    heading("Project Qlarity: Business Case for Qlik Platform Implementation"),
    metadataTable([
      ["Document ID", "PROJ-CLARITY-2025"],
      ["Version", "2.0"],
      ["Date", "15 October 2025"],
      ["Author", "Priya Ramanathan, Chief Data Officer"],
      ["Sponsor", "Ingrid van der Berg, CEO"],
      ["Status", "Pending CIO Approval — Review: 31 October 2025"],
      ["Investment", "$12.4M over 24 months"],
      ["Expected Benefit", "$52.7M–$87.9M annually"],
    ]),

    heading("1. Executive Summary"),
    para("Meridian Commerce Group's data quality crisis costs an estimated $127M annually across seven identified problem areas. Project Qlarity proposes a $12.4M investment in the Qlik data platform to create a unified, governed, trusted data foundation. Conservative projections show $52.7M in annual benefits, yielding a 952% 3-year ROI."),

    heading("2. The Problem: Seven Data Quality Nightmares"),
    dataTable(
      ["#", "Nightmare", "Annual Cost", "Key Metric"],
      [
        ["1", "Phantom Inventory", "$48.0M", "IRA: 74% (target 97%)"],
        ["2", "Address Data Catastrophe", "$3.1M", "4.7% first-delivery rejection"],
        ["3", "Product Master Mess", "$8.2M", "8,200 SKUs missing weight data"],
        ["4", "Silent Pipeline Failures", "$12.0M", "4.3-day avg detection time"],
        ["5", "Timestamp Tower of Babel", "$6.5M", "14 timezones, no standards"],
        ["6", "Carrier Data Black Hole", "$14.8M", "42% missing tracking numbers"],
        ["7", "Compliance Traceability Gap", "$4.2M", "11-day recall trace (24h target)"],
      ]
    ),
    labelValue("Total Annual Impact", "$127.0M (conservative estimate, based on directly attributable costs)"),

    heading("3. Proposed Solution: Qlik Platform"),
    dataTable(
      ["Component", "Purpose"],
      [
        ["Qlik Talend Cloud — Data Integration", "CDC pipelines from SAP, WMS, Salesforce, IoT; replaces fragile batch jobs"],
        ["Qlik Talend Cloud — Data Quality", "Automated profiling, address standardization, supplier deduplication"],
        ["Qlik Talend Cloud — Data Stewardship", "Workflow for resolving data quality issues with SLA tracking"],
        ["Qlik Open Lakehouse", "Unified Bronze/Silver/Gold data architecture on Apache Iceberg"],
        ["Qlik Analytics", "Interactive dashboards for supply chain, inventory, cold chain monitoring"],
        ["Qlik AutoML", "Predictive models for demand forecasting, spoilage risk, delivery SLA prediction"],
        ["Qlik Answers", "Conversational AI over unstructured documents (SOPs, policies, contracts)"],
        ["Qlik Discovery Agent", "AI agent for automated data exploration and root cause analysis"],
      ]
    ),

    heading("4. Implementation Phases"),
    heading("4.1 Phase 1: Foundation (Months 1-8)", 2),
    para("Budget: $5.2M"),
    para("CDC pipelines from SAP, Oracle WMS, Manhattan WMS, Salesforce", { bullet: true }),
    para("Open Lakehouse Bronze and Silver tiers", { bullet: true }),
    para("4 priority transformation routes: Timestamp Normalizer, Inventory Reconciliation, Carrier Status Normalizer, IoT Telemetry Pipeline", { bullet: true }),
    para("Pipeline health monitoring and alerting (addresses Nightmare #4)", { bullet: true }),
    para("Inventory accuracy and cold chain dashboards in Qlik Analytics", { bullet: true }),

    heading("4.2 Phase 2: Analytics & Quality (Months 6-16)", 2),
    para("Budget: $4.8M"),
    para("Remaining 4 transformation routes: Address Standardization, Product Master Harmonizer, Supplier Identity Resolution, Order Enrichment", { bullet: true }),
    para("Enterprise data quality monitoring with Trust Score", { bullet: true }),
    para("Data stewardship workflows", { bullet: true }),
    para("AutoML models for demand and spoilage prediction", { bullet: true }),
    para("Gold tier data products", { bullet: true }),

    heading("4.3 Phase 3: AI & Conversational (Months 14-24)", 2),
    para("Budget: $2.4M"),
    para("Qlik Answers knowledge base with all SOPs, policies, and operational documents", { bullet: true }),
    para("Discovery Agent for automated root cause analysis", { bullet: true }),
    para("MCP Server for AI agent integration", { bullet: true }),
    para("Conversational analytics for store managers and customer service", { bullet: true }),

    heading("5. Financial Model"),
    dataTable(
      ["Benefit Category", "Conservative (60%)", "Expected (80%)", "Optimistic (100%)"],
      [
        ["Phantom inventory reduction", "$28.8M", "$38.4M", "$48.0M"],
        ["Carrier cost optimization", "$8.9M", "$11.8M", "$14.8M"],
        ["Pipeline failure prevention", "$7.2M", "$9.6M", "$12.0M"],
        ["Address quality improvement", "$1.9M", "$2.5M", "$3.1M"],
        ["Product master clean-up", "$4.9M", "$6.6M", "$8.2M"],
        ["Compliance risk reduction", "$1.0M", "$2.0M", "$4.2M"],
        ["Total Annual Benefit", "$52.7M", "$70.9M", "$87.9M"],
      ]
    ),
    labelValue("3-Year ROI (Conservative)", "952%"),
    labelValue("Payback Period", "< 4 months from Phase 1 completion"),

    heading("6. Risk Factors"),
    dataTable(
      ["Risk", "Probability", "Impact", "Mitigation"],
      [
        ["CDC performance impact on production ERP", "Low", "High", "Agentless CDC; proven on SAP S/4HANA"],
        ["User adoption of new dashboards", "Medium", "Medium", "Phased rollout with training program"],
        ["Data quality improvement slower than projected", "Medium", "Medium", "Conservative 60% realization in financial model"],
        ["Scope creep from 47 source systems", "High", "Medium", "Phase 1 limited to 4 critical sources"],
      ]
    ),

    heading("7. Approval Requested"),
    para("Approval is requested for $12.4M total investment over 24 months, with Phase 1 funding of $5.2M to begin Q1 2026."),

    ...signatureBlock("Priya Ramanathan", "Chief Data Officer", "Project Sponsor"),
    ...signatureBlock("Ingrid van der Berg", "Chief Executive Officer", "Executive Sponsor"),
  ]);
}

// ─── RUN ───
async function main() {
  console.log("Generating remaining documents...");
  await saveDocument(trnWmsSap(), path.join(DOCS, "training", "TRN-2025-001_WMS_SAP_Integration_Guide.docx"));
  await saveDocument(trnColdChain(), path.join(DOCS, "training", "TRN-2025-002_Cold_Chain_Monitoring_For_Drivers.docx"));
  console.log("  ✅ 2 training guides");
  await saveDocument(mtgQ3Review(), path.join(DOCS, "meeting_minutes", "MTG-2025-Q3_Supply_Chain_Review.docx"));
  console.log("  ✅ 1 meeting minutes");
  await saveDocument(compNVWA(), path.join(DOCS, "compliance", "COMP-2025-NVWA_Corrective_Action_Plan.docx"));
  console.log("  ✅ 1 compliance document");
  await saveDocument(projClarity(), path.join(DOCS, "project_briefs", "PROJ-CLARITY-2025_Business_Case.docx"));
  console.log("  ✅ 1 project brief");
  console.log("✅ All remaining documents generated.");
}

main().catch(console.error);
