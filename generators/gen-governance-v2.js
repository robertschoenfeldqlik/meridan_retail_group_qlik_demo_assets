// Generate ENRICHED governance DOCX files — moderate depth for Qlik Answers
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
      ["Review Cycle", "Quarterly"],
      ["Next Review", "01 November 2025"],
    ]),

    heading("1. Overview"),
    para("This guide explains how inventory data flows between MCG's Warehouse Management Systems (WMS) and SAP ERP, including known synchronization delays, timezone handling, and what to do when things go wrong. Understanding this flow is critical because the WMS-SAP sync is the backbone of MCG's inventory accuracy — and its most common failure point."),
    para("This guide was updated after the Rotterdam DC pipeline failure incident (INC-2025-04872, September 2025) to include additional guidance on detecting silent pipeline failures."),

    heading("2. System Architecture"),
    dataTable(
      ["Component", "Technology", "Region", "Data Flow", "Sync Method"],
      [
        ["WMS (Americas, EU)", "Oracle WMS Cloud", "Americas, EU (18 DCs)", "WMS → CDC → SAP", "Qlik Replicate CDC"],
        ["WMS (APAC)", "Manhattan Associates", "APAC (6 DCs)", "WMS → CDC → SAP", "Qlik Replicate CDC"],
        ["WMS (LATAM)", "Oracle WMS Cloud", "LATAM (4 DCs)", "WMS → CDC → SAP", "Qlik Replicate CDC"],
        ["ERP", "SAP S/4HANA", "Global (single instance)", "Central record system", "—"],
        ["Replication", "Qlik Replicate", "Global", "CDC from all WMS → SAP", "15-min batch windows"],
      ]
    ),
    para("Total: 28 DCs syncing to one SAP instance via 28 independent Qlik Replicate CDC pipelines."),
    calloutBox("IMPORTANT: Each DC has its own independent CDC pipeline. A failure at one DC does NOT affect others. However, this also means a failure at one DC can go unnoticed while everything else appears healthy. This is exactly what happened in INC-2025-04872 (Rotterdam).", "warning"),

    heading("3. Synchronization Timing"),
    para("WMS-to-SAP synchronization runs via Change Data Capture (CDC) in 15-minute batch windows:"),
    dataTable(
      ["Event in WMS", "Expected in SAP", "Normal Delay", "Max Acceptable Delay"],
      [
        ["Goods receipt posted", "Inventory position update", "15-30 minutes", "60 minutes"],
        ["Pick confirmed", "Inventory reduction", "15-30 minutes", "60 minutes"],
        ["Cycle count adjustment", "Stock adjustment document", "15-30 minutes", "60 minutes"],
        ["Transfer between zones", "Storage location change", "15-30 minutes", "60 minutes"],
        ["Damage write-off", "Scrapping document", "15-30 minutes", "60 minutes"],
      ]
    ),
    calloutBox("If you post a goods receipt in WMS and check SAP immediately, the receipt will NOT be visible. Normal sync lag is 15-30 minutes. Do not escalate until at least 60 minutes have passed. If after 60 minutes the transaction is still missing in SAP, escalate immediately — it may indicate a pipeline failure.", "warning"),

    heading("4. Timestamp Handling — Critical Information"),
    para("This is one of the most common sources of confusion and discrepancy reports. Different systems store timestamps differently:"),
    dataTable(
      ["System", "Timezone Used", "TZ Indicator?", "Example", "UTC Equivalent"],
      [
        ["Oracle WMS (EU)", "CET (UTC+1 / +2 DST)", "NO ⚠", "14:32", "12:32 UTC (winter) or 12:32 UTC (summer)"],
        ["Oracle WMS (Americas)", "Local warehouse time", "NO ⚠", "09:15", "Depends on DC location"],
        ["Manhattan WMS (APAC)", "UTC (mostly)", "YES (usually)", "06:32 UTC", "06:32 UTC"],
        ["SAP S/4HANA", "UTC", "YES", "12:02 UTC", "12:02 UTC"],
        ["Tive IoT Sensors", "UTC", "YES", "12:02:34 UTC", "12:02:34 UTC"],
        ["Descartes TMS", "UTC", "YES", "12:02 UTC", "12:02 UTC"],
      ]
    ),
    calloutBox("EXAMPLE: WMS shows receipt at '14:32' in Rotterdam (CET, summer). SAP shows same receipt at '12:32 UTC'. These are the SAME TIME (CEST = UTC + 2 hours in summer). Do NOT create a discrepancy report for timezone differences. This is Nightmare #5 (Timestamp Tower of Babel).", "critical"),
    calloutBox("KNOWN ISSUE: Singapore and Jakarta DCs have Manhattan WMS misconfigured to use local time (SGT/WIB) instead of UTC. When comparing with SAP, add 8 hours (SGT) or 7 hours (WIB) to get UTC. IT is aware and correction is planned for Q1 2026 under Project CLARITY.", "warning"),

    heading("5. Daily Manual Sync Check (MANDATORY)"),
    para("Until automated monitoring is fully deployed across all DCs (Project CLARITY Phase 1, target: Q2 2026), all DC supervisors must perform a daily manual sync check. This check detected the Rotterdam pipeline failure (INC-2025-04872) and is currently the ONLY defense against silent pipeline failures at most DCs."),
    numberedItem(1, "At 08:00 local time, open WMS and select 5 random transactions from yesterday's activity log."),
    numberedItem(2, "For each transaction, note the WMS document number, SKU, quantity, and timestamp."),
    numberedItem(3, "Open SAP and verify each transaction appears with matching quantities (allow for timezone offset per Section 4)."),
    numberedItem(4, "Record results in the Daily Sync Check spreadsheet (SharePoint > Operations > Sync Checks > [DC Name])."),
    numberedItem(5, "If ANY transaction is missing from SAP after 60+ minutes, escalate to IT Operations IMMEDIATELY (see Section 7)."),
    para("Estimated time: 15-20 minutes per day."),
    calloutBox("This check costs MCG approximately 855 person-hours per day across all 28 DCs (28 supervisors × ~30 min including login/navigation). This manual effort will be eliminated by Project CLARITY's automated pipeline health monitoring.", "info"),

    heading("6. Phantom Inventory — How It Happens"),
    para("Phantom inventory occurs when SAP shows stock that doesn't physically exist in the warehouse. This is MCG's #1 data quality nightmare (Nightmare #1), with an estimated annual cost of $48M."),
    para("Common causes of phantom inventory:"),
    numberedItem(1, "Silent pipeline failure: CDC sync stops, SAP retains old quantities while WMS continues processing picks and receipts (see INC-2025-04872)."),
    numberedItem(2, "Picks confirmed in WMS but sync batch fails before reaching SAP — SAP still shows the picked items as available."),
    numberedItem(3, "Damaged goods written off in WMS but not yet synced to SAP — SAP shows stock that has been scrapped."),
    numberedItem(4, "Returns processed in SAP (from customer service) but physical return not yet received and processed in WMS."),
    numberedItem(5, "Cycle count adjustments pending in WMS queue but not yet synced (common on high-volume days like Black Friday)."),
    labelValue("Current IRA (Inventory Record Accuracy)", "74% (target: 97%)"),
    labelValue("Phantom inventory rate", "26% of total discrepancy"),
    calloutBox("When you encounter a situation where SAP says stock exists but the warehouse shelf is empty, check the sync status FIRST before initiating a cycle count or investigation. The stock may have been picked hours ago and the sync hasn't caught up.", "warning"),

    heading("7. Escalation Contacts"),
    dataTable(
      ["Issue", "Contact", "Channel", "Response SLA"],
      [
        ["Sync delay > 60 minutes", "IT Ops Help Desk", "ServiceNow ticket (Priority: High)", "4 hours"],
        ["Missing transactions (confirmed)", "Integration Team Lead", "Teams + ServiceNow (P2)", "2 hours"],
        ["Suspected pipeline failure", "IT Ops On-Call", "Phone: +31-20-555-0199", "1 hour"],
        ["Inventory discrepancy > 10%", "Inventory Control Manager", "Phone + email (immediate)", "Immediate"],
        ["Multiple DCs reporting sync issues", "CIO (Marcus Chen)", "Phone: +31-20-555-0100", "30 minutes"],
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
      ["Version", "2.0 (Updated October 2025)"],
      ["Date", "15 October 2025"],
      ["Author", "Supply Chain Operations — Cold Chain Team"],
      ["Audience", "Delivery drivers, receiving dock staff, cold chain handlers"],
      ["Update Reason", "TransFrio spoilage incident (INC-2025-05102) and updated pre-cooling requirements"],
    ]),

    heading("1. Temperature Limits — Know Your Product"),
    dataTable(
      ["Product Type", "Min Temp", "Max Temp", "Critical Alert", "Action If Exceeded"],
      [
        ["Fresh produce", "1°C", "5°C", "> 8°C for 30+ min", "Quarantine, notify Quality Manager"],
        ["Dairy", "2°C", "6°C", "> 8°C for 15+ min", "Quarantine, do NOT unload"],
        ["Frozen goods", "-25°C", "-18°C", "ANY reading above -15°C", "Reject shipment, notify carrier"],
        ["Pharmaceuticals", "2°C", "8°C", "ANY breach of range", "Quarantine immediately, regulatory notification required"],
        ["Eggs", "5°C", "8°C", "> 12°C for 20+ min", "Quarantine, check for condensation"],
      ]
    ),
    calloutBox("When in doubt, QUARANTINE. It is always better to hold a shipment for quality inspection than to put potentially compromised product on the shelf. The lettuce recall (RCL-2025-003) cost €85,125 — quarantine costs far less than a recall.", "critical"),

    heading("2. Tive IoT Sensors"),
    para("Most MCG perishable shipments include a Tive Solo 5G temperature sensor. These devices:"),
    para("Record temperature every 5 minutes (EU/Americas) or 10 minutes (APAC — due to carrier bandwidth limits)", { bullet: true }),
    para("Transmit data automatically via cellular network to MCG's IoT platform", { bullet: true }),
    para("Flash red LED if temperature limit is exceeded", { bullet: true }),
    para("Have a battery life of approximately 90 days per charge", { bullet: true }),
    para("DO NOT remove, disable, or cover the sensor — it must stay with the shipment until receiving dock check-in", { bullet: true }),

    heading("3. Known Sensor Issues"),
    heading("3.1 Americas Fahrenheit Issue (July-September 2025)", 2),
    para("Between July and September 2025, approximately 340 Tive sensors in Americas DCs were configured to display temperature in Fahrenheit without indicating the unit. This caused confusion:"),
    dataTable(
      ["Sensor Display", "If Fahrenheit", "If Celsius", "Status"],
      [
        ["41", "41°F = 5°C (OK)", "41°C (CRITICAL)", "Check sensor config screen"],
        ["32", "32°F = 0°C (OK)", "32°C (CRITICAL)", "Check sensor config screen"],
        ["45", "45°F = 7.2°C (marginal)", "45°C (CRITICAL)", "Check sensor config screen"],
      ]
    ),
    calloutBox("All sensors should now display in Celsius (°C). If your sensor display shows no unit symbol, press and hold the INFO button for 3 seconds to see the configuration screen. If it shows 'F', report to IT Operations immediately and do NOT rely on the reading until confirmed.", "warning"),

    heading("3.2 Lagos DC Connectivity Gap", 2),
    para("The Lagos DC experiences daily 6-hour internet blackouts (typically 11:00-17:00 WAT) due to infrastructure limitations. During blackouts:"),
    para("Tive sensors continue recording temperature data locally", { bullet: true }),
    para("Data transmission is paused — the MCG IoT dashboard will show 'Last Updated: [timestamp]' and the reading will be stale", { bullet: true }),
    para("Temperature ALERTS will be delayed by up to 6 hours", { bullet: true }),
    para("When connectivity resumes, all stored readings upload automatically", { bullet: true }),
    calloutBox("During Lagos DC blackout hours (11:00-17:00 WAT): physically check the sensor LED every 2 hours. RED LED = temperature exceedance occurred. Do NOT wait for the dashboard alert.", "warning"),

    heading("4. Pre-Cooling Requirements (UPDATED October 2025)"),
    para("After the TransFrio spoilage incident (INC-2025-05102, $2.48M in Q3 losses), pre-cooling requirements have been tightened:"),
    dataTable(
      ["Requirement", "Previous Standard", "New Standard (Oct 2025)", "Applies To"],
      [
        ["Pre-cool target temperature", "2°C", "0°C", "All cold chain transport"],
        ["Verification method", "Driver self-check", "Loading dock staff must verify", "All carriers"],
        ["Documentation", "None required", "Photo of reefer display at loading", "All carriers"],
        ["Hold time before loading", "None specified", "Unit must hold 0°C for 15 min before loading starts", "TransFrio, NinjaVan"],
      ]
    ),
    calloutBox("DRIVERS: Verify your reefer unit display shows 0°C or below AND 'READY' status BEFORE allowing loading to begin. Loading onto a warm trailer is the #1 cause of cold chain failure. If using Thermo King X4 7500: press and HOLD the START button for 3 seconds (do not just tap it).", "critical"),

    heading("5. Receiving Temperature Check Procedure"),
    numberedItem(1, "Before unloading, check the trailer reefer unit display and record the temperature."),
    numberedItem(2, "Use your handheld probe thermometer to spot-check product temperature on at least 3 pallets (front, middle, rear of trailer)."),
    numberedItem(3, "Record all temperatures in WMS quality module (Receiving > Temperature Check)."),
    numberedItem(4, "If ANY product is outside acceptable range: STOP. Do not unload further. Contact Quality Manager immediately."),
    numberedItem(5, "If Tive sensor is present, scan the sensor barcode to link sensor data to the receiving record."),
    numberedItem(6, "Place the Tive sensor in the returns bin for recharging and reuse."),

    heading("6. Thermo King X4 7500 Quick Reference"),
    para("After the TransFrio incident, all MCG staff interacting with Thermo King X4 7500 units must know the correct startup sequence:"),
    numberedItem(1, "Press and HOLD the START button for 3 full seconds (a brief press puts the unit in standby — it will NOT cool)."),
    numberedItem(2, "Wait for the digital display to show 'INITIALIZING...' (approximately 30 seconds)."),
    numberedItem(3, "Use the UP/DOWN keypad to set target temperature (0°C for pre-cooling)."),
    numberedItem(4, "Wait for display to show 'READY' and the actual temperature to reach 0°C (typically 15-25 minutes for an empty trailer)."),
    numberedItem(5, "Only then may loading begin. Take a photo of the display showing 0°C as documentation."),

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
      ["Location", "MCG HQ Rotterdam, Board Room A (hybrid — 6 in person, 4 virtual)"],
      ["Chair", "Ingrid van der Berg, CEO"],
      ["Minutes By", "Priya Ramanathan, CDO"],
      ["Classification", "Confidential — Senior Leadership Only"],
      ["Next Meeting", "Q4 2025 Review: 15 January 2026, 09:00 CET"],
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
        ["Lisa Park", "Head of Customer Experience", "Virtual (Seoul)"],
        ["Carlos Rivera", "Director of Logistics, Americas", "Virtual (Miami)"],
        ["Wei Lin Tan", "Regional Logistics Manager, APAC", "Virtual (Singapore)"],
        ["Roberto Almeida", "LATAM Operations Director", "Virtual (São Paulo)"],
      ]
    ),

    heading("1. Opening — CEO Statement"),
    para("Ingrid van der Berg opened by noting that Q3 2025 represented \"the worst quarter for supply chain data quality in MCG's history\" with out-of-stock events up 34%, delivery SLA breaches at 22% in APAC, $2.48M in spoilage on a single corridor, and a regulatory citation because MCG could not trace a head of lettuce through its supply chain within 24 hours."),
    para("The CEO stated that these are not isolated incidents but symptoms of a systemic failure in data management, and that data quality would be MCG's #1 operational priority for 2026."),

    heading("2. Nightmare Review — Key Discussion Points"),

    heading("2.1 Phantom Inventory Update (Henrik Jansen)", 2),
    para("IRA (Inventory Record Accuracy) remains at 74%, unchanged from Q2 and well below the 97% target. The Rotterdam pipeline failure (INC-2025-04872) demonstrated that a single undetected 72-hour sync failure can create 847 units of phantom inventory across 143 SKUs, costing €30,500 in emergency transfers and expedited shipping."),
    para("Pipeline monitoring has been implemented at Rotterdam DC following the incident but is NOT yet deployed at the remaining 27 DCs. Henrik emphasized that the daily manual sync check is the only defense at other sites, costing 855 person-hours per day across the network."),
    calloutBox("Henrik: \"We're spending 855 hours of human labor every single day on manual sync checks that a simple automated heartbeat monitor could replace. That's the equivalent of 107 full-time employees doing nothing but checking whether our data pipelines are working.\"", "info"),

    heading("2.2 APAC SLA Crisis (Wei Lin Tan)", 2),
    para("Singapore delivery promise accuracy dropped to 69% (from 88% in Q2). Root cause: NinjaVan contract amendment AMD3 reclassified 5-10 kg parcels from 2-day to 3-day delivery, effective 01 October 2025. However, this change was not communicated to the e-commerce fulfillment team for 3+ weeks after contract execution."),
    para("During the communication gap, the MCG website continued to promise 2-day delivery for 5-10 kg orders, affecting approximately 14,000 customers per month. WISMO (Where Is My Order) rate in Singapore hit 52%, compared to the 30% target."),
    para("Wei Lin proposed a mandatory carrier-to-e-commerce SLA change notification process. Lisa Park (Customer Experience) agreed to co-own the implementation with Thomas Brennan."),

    heading("2.3 LATAM Spoilage (Roberto Almeida)", 2),
    para("$2.48M in Q3 spoilage on the São Paulo-Buenos Aires corridor operated by TransFrio Logistics. The fleet change root cause (6 trucks replaced with new Thermo King X4 7500 units, drivers not retrained) was identified by Roberto's team after 3 weeks of investigation."),
    para("Roberto emphasized that the data to identify the root cause existed in MCG's systems from Day 1 — Tive IoT sensors recorded the temperature excursions, and TransFrio's fleet records showed the truck changeover. But these datasets lived in completely disconnected systems with no automated correlation."),
    para("A formal corrective action notice has been sent to TransFrio (SUPP-2025-TransFrio). If targets are not met, MCG will transition to LogFrio Argentina S.A. or Friovías LATAM."),

    heading("2.4 Compliance Update (Dr. Elena Vasquez)", 2),
    para("NVWA corrective action plan (COMP-2025-NVWA) progress:"),
    dataTable(
      ["Action", "Target", "Current", "Status"],
      [
        ["Lot number capture", "100%", "93%", "On track — firmware updates pending on legacy scanners"],
        ["Store-level lot tracking", "90% by Mar 2026", "78%", "On track — 250 stores need POS upgrade"],
        ["Unified traceability", "Project CLARITY", "Business case", "Pending CIO approval"],
        ["Sub-tier supplier mapping", "80% by Jan 2026", "36%", "AT RISK — supplier resistance"],
        ["Country of origin", "100%", "88%", "On track"],
      ]
    ),
    calloutBox("Elena: \"If we don't have a credible unified traceability plan approved before the NVWA follow-up inspection in Q1 2026, we risk escalation from citation to enforcement action. The lettuce recall demonstrated that our current 4-system manual tracing process is fundamentally inadequate.\"", "warning"),

    heading("3. Project CLARITY Presentation"),
    para("Priya Ramanathan presented the Project CLARITY business case (PROJ-CLARITY-2025):"),
    para("Total investment: $12.4M over 24 months (3 phases)", { bullet: true }),
    para("Conservative annual benefit: $52.7M (60% realization of $87.9M potential)", { bullet: true }),
    para("3-year ROI: 952%", { bullet: true }),
    para("Platform: Qlik Talend Cloud (data integration + quality) + Qlik Open Lakehouse + Qlik Analytics + Qlik Answers + Qlik AutoML", { bullet: true }),
    para("Phase 1 (Foundation, $5.2M): CDC pipelines, lakehouse, 4 priority transformation routes, pipeline monitoring", { bullet: true }),
    para("Phase 2 (Analytics & Quality, $4.8M): remaining transformation routes, data quality monitoring, AutoML models", { bullet: true }),
    para("Phase 3 (AI & Conversational, $2.4M): Qlik Answers knowledge base, Discovery Agent, MCP Server", { bullet: true }),
    para("CEO directed Priya to schedule the full CLARITY presentation for the CIO review board on 31 October 2025."),

    heading("4. Action Items"),
    dataTable(
      ["#", "Action", "Owner", "Deadline", "Priority"],
      [
        ["1", "Present Project CLARITY to CIO review board", "P. Ramanathan", "31 Oct 2025", "Critical"],
        ["2", "Roll out pipeline monitoring to all 28 DCs", "M. Chen", "31 Dec 2025", "High"],
        ["3", "Implement carrier SLA change notification process", "T. Brennan + L. Park", "15 Nov 2025", "High"],
        ["4", "Complete TransFrio corrective actions or initiate carrier transition", "T. Brennan", "31 Dec 2025", "High"],
        ["5", "Achieve 100% lot number capture at all food-handling DCs", "H. Jansen", "01 Nov 2025", "Critical"],
        ["6", "Prepare for NVWA follow-up inspection", "E. Vasquez", "28 Feb 2026", "Critical"],
        ["7", "Evaluate alternate LATAM cold chain carriers", "R. Almeida", "30 Nov 2025", "Medium"],
        ["8", "Address NinjaVan tracking data availability (71% vs 99% target)", "W. L. Tan", "31 Dec 2025", "Medium"],
      ]
    ),

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
      ["NVWA Inspector", "Ir. Jan Willem Koster, Senior Inspector"],
      ["Status", "In Progress — 3 of 5 actions on track, 1 at risk"],
      ["Next Inspection", "Expected Q1 2026"],
    ]),

    heading("1. Citation Summary"),
    para("On 12 June 2025, the Netherlands Food and Consumer Product Safety Authority (NVWA) conducted a routine inspection at MCG's Rotterdam Distribution Center (Europaweg 120, 3199 LD Rotterdam). The inspection coincided with the ongoing recall of organic butter lettuce (RCL-2025-003) and identified 5 findings:"),
    dataTable(
      ["Finding", "Severity", "Description", "Regulation"],
      [
        ["F1", "Major", "Lot numbers not consistently captured at goods receipt — free-text field allowed blank entries", "EC 178/2002 Art. 18"],
        ["F2", "Major", "Unable to complete product trace within 24 hours — took 11 days during active recall", "EC 178/2002 Art. 18"],
        ["F3", "Significant", "Country of origin missing for 12% of fresh produce SKUs", "EC 1169/2011 Art. 26"],
        ["F4", "Significant", "Sub-tier supplier relationships not documented for 64% of food suppliers", "EC 178/2002 Art. 18"],
        ["F5", "Observation", "Inconsistent timestamp formats in temperature records across WMS and IoT", "HACCP documentation standards"],
      ]
    ),
    calloutBox("The two Major findings (F1, F2) require corrective action within 6 months or MCG risks escalation to enforcement proceedings, which could include production restrictions or facility closure orders.", "critical"),

    heading("2. Corrective Action Status"),

    heading("2.1 Action 1: Lot Number Capture (F1)", 2),
    labelValue("Target", "100% lot capture for all food products at all food-handling DCs"),
    labelValue("Deadline", "01 October 2025"),
    labelValue("Status", "93% complete — On Track"),
    para("Changes implemented:"),
    para("WMS goods receipt forms converted from free-text to structured input with mandatory validation — blank lot numbers now blocked at system level", { bullet: true }),
    para("Barcode scanning now required for lot entry at 24 of 28 food-handling DCs", { bullet: true }),
    para("Remaining 7% gap: 4 legacy warehouse locations (Rotterdam Zone C, Antwerp Annex, Hamburg Cold Store, Milan Fresh Wing) using older Symbol MC9190 handheld scanners that require firmware update to support the new structured input format", { bullet: true }),
    labelValue("Firmware Update Schedule", "Rotterdam Zone C: 10 Oct, Antwerp: 17 Oct, Hamburg: 24 Oct, Milan: 31 Oct"),

    heading("2.2 Action 2: Store-Level Lot Tracking (F2)", 2),
    labelValue("Target", "90% lot-level tracking at retail stores"),
    labelValue("Deadline", "01 March 2026"),
    labelValue("Status", "78% complete — In Progress"),
    para("Store POS systems being updated to scan and record lot numbers at receipt. Current rollout:"),
    dataTable(
      ["Store Format", "Total Stores", "Upgraded", "Pending", "% Complete"],
      [
        ["MCG Hypermarket", "340", "338", "2", "99%"],
        ["MCG Supermarket", "520", "412", "108", "79%"],
        ["MCG Express", "280", "140", "140", "50%"],
        ["Total", "1,140", "890", "250", "78%"],
      ]
    ),
    para("The MCG Express format stores require a POS hardware upgrade (current terminals lack barcode scanning capability for lot numbers). Hardware procurement is approved; installation scheduled for November 2025 — February 2026."),

    heading("2.3 Action 3: Unified Traceability (F2)", 2),
    labelValue("Target", "Single-query traceability across SAP, WMS, TMS, and Salesforce Commerce"),
    labelValue("Deadline", "Dependent on Project CLARITY Phase 1"),
    labelValue("Status", "Business case submitted — Pending CIO approval (31 October 2025)"),
    para("This corrective action depends on the implementation of Project CLARITY, which will create a unified data layer connecting all 4 traceability systems via Qlik Talend Cloud CDC pipelines and a Qlik Open Lakehouse. The business case ($12.4M over 24 months) was presented to senior leadership on 15 October 2025."),
    para("If approved, the traceability data product (Phase 1) would be operational by Q3 2026, enabling single-query lot-to-store tracing in under 1 hour."),
    calloutBox("NVWA PREPARATION: For the Q1 2026 follow-up inspection, MCG must demonstrate at minimum an approved project plan with committed timeline and budget. A verbal commitment is not sufficient — the inspector will expect a signed project charter and evidence of vendor engagement.", "warning"),

    heading("2.4 Action 4: Sub-Tier Supplier Mapping (F4)", 2),
    labelValue("Target", "80% of food suppliers with documented sub-tier relationships"),
    labelValue("Deadline", "01 January 2026"),
    labelValue("Status", "36% complete — AT RISK ⚠"),
    para("This action is significantly behind schedule. Progress by supplier category:"),
    dataTable(
      ["Category", "Suppliers", "Mapped", "% Complete", "Primary Blocker"],
      [
        ["Fresh produce", "89", "52", "58%", "Sub-tier farm confidentiality"],
        ["Dairy", "34", "18", "53%", "Complex supply chains"],
        ["Frozen goods", "67", "22", "33%", "Multi-tier processing"],
        ["Beverages", "92", "14", "15%", "Low priority (lower risk category)"],
        ["Other food", "58", "16", "28%", "Resource constraints"],
        ["Total", "340", "122", "36%", ""],
      ]
    ),
    calloutBox("Many suppliers cite commercial confidentiality when asked to disclose sub-tier relationships. The Fresh Direct lettuce recall (RCL-2025-003) demonstrated the risk: the contaminated farm (FARM-NL-0042) was an undisclosed backup supplier with an expired HACCP certification. MCG Legal is evaluating whether to mandate sub-tier disclosure as a contract requirement for all food suppliers.", "critical"),

    heading("2.5 Action 5: Country of Origin Compliance (F3)", 2),
    labelValue("Target", "100% country of origin for fresh produce SKUs"),
    labelValue("Deadline", "01 November 2025"),
    labelValue("Status", "88% complete — On Track"),
    para("Procurement has updated supplier requirements to mandate country of origin on all delivery documentation. The remaining 12% gap consists of 47 SKUs sourced from multi-origin suppliers where country of origin varies by shipment and season (e.g., tomatoes sourced from Spain in summer, Morocco in winter). A dynamic origin tracking process is being developed."),

    heading("3. Evidence File for Follow-Up Inspection"),
    para("MCG is preparing a comprehensive evidence file for the anticipated Q1 2026 NVWA follow-up inspection:"),
    numberedItem(1, "Lot number capture statistics — monthly reports from WMS showing compliance trend"),
    numberedItem(2, "Store-level tracking rollout schedule and completion evidence"),
    numberedItem(3, "Project CLARITY charter (signed) with traceability milestone dates"),
    numberedItem(4, "Sub-tier supplier mapping progress report with category breakdown"),
    numberedItem(5, "Country of origin compliance report from procurement system"),
    numberedItem(6, "Updated SOPs incorporating all corrective action changes"),

    ...signatureBlock("Dr. Elena Vasquez", "Chief Compliance Officer", "Legal & Compliance Division"),
  ]);
}

// ═══ PROJ-CLARITY-2025: Business Case ═══
function projClarity() {
  return buildDocument("PROJECT BUSINESS CASE", [
    heading("Project CLARITY: Business Case for Qlik Platform Implementation"),
    metadataTable([
      ["Document ID", "PROJ-CLARITY-2025"],
      ["Version", "2.0"],
      ["Date", "15 October 2025"],
      ["Author", "Priya Ramanathan, Chief Data Officer"],
      ["Sponsor", "Ingrid van der Berg, CEO"],
      ["Status", "Pending CIO Approval — Review: 31 October 2025"],
      ["Investment", "$12.4M over 24 months"],
      ["Expected Benefit", "$52.7M–$87.9M annually"],
      ["ROI (3-Year, Conservative)", "952%"],
    ]),

    heading("1. Executive Summary"),
    para("Meridian Commerce Group's data quality crisis costs an estimated $127M annually across seven identified problem areas ('The Seven Data Quality Nightmares'). Project CLARITY proposes a $12.4M investment in the Qlik data platform to create a unified, governed, and trusted data foundation. Conservative projections show $52.7M in annual benefits, yielding a 952% 3-year ROI with payback within 4 months of Phase 1 completion."),
    para("The urgency is driven by three converging pressures: (1) the NVWA regulatory citation requiring credible corrective action by Q1 2026, (2) escalating operational losses ($2.48M in Q3 2025 spoilage alone), and (3) competitive pressure as peers adopt data-driven supply chain optimization."),

    heading("2. The Problem: Seven Data Quality Nightmares"),
    dataTable(
      ["#", "Nightmare", "Annual Cost", "Key Metric", "Worst Incident (Q3)"],
      [
        ["1", "Phantom Inventory", "$48.0M", "IRA: 74% (target 97%)", "INC-2025-04872: 847 phantom units from 72hr pipeline failure"],
        ["2", "Address Data Catastrophe", "$3.1M", "4.7% first-delivery failure", "$847K FedEx correction surcharges in FY2024"],
        ["3", "Product Master Mess", "$8.2M", "8,200 SKUs missing weight", "Dimensional weight overbilling across all carriers"],
        ["4", "Silent Pipeline Failures", "$12.0M", "4.3-day avg detection", "INC-2025-04872: 72hrs undetected at Rotterdam"],
        ["5", "Timestamp Tower of Babel", "$6.5M", "14 TZs, no standards", "Ongoing confusion in every cross-system report"],
        ["6", "Carrier Data Black Hole", "$14.8M", "42% missing tracking #s", "NinjaVan SG tracking at 71% (target 99%)"],
        ["7", "Compliance Traceability Gap", "$4.2M", "11-day recall trace", "RCL-2025-003: €85K recall cost, NVWA citation"],
      ]
    ),
    labelValue("Total Annual Impact", "$127.0M (conservative, based on directly attributable and quantified costs)"),

    heading("3. Proposed Solution: Qlik Platform"),
    dataTable(
      ["Component", "Purpose", "Addresses Nightmares"],
      [
        ["Qlik Talend Cloud — Data Integration", "CDC pipelines from SAP, WMS (Oracle + Manhattan), Salesforce, IoT, TMS", "#1, #4, #7"],
        ["Qlik Talend Cloud — Data Quality", "Automated profiling, address standardization, supplier dedup, product master harmonization", "#2, #3, #6"],
        ["Qlik Talend Cloud — Data Stewardship", "Workflow for resolving data quality issues with SLA tracking and accountability", "#1-#7"],
        ["Qlik Open Lakehouse", "Unified Bronze/Silver/Gold data architecture on Apache Iceberg", "#1-#7"],
        ["Qlik Analytics", "Interactive dashboards for supply chain, inventory, cold chain, carrier performance", "#1, #4, #5, #6"],
        ["Qlik AutoML", "Predictive models for demand forecasting, spoilage risk, delivery SLA prediction", "#1, #6"],
        ["Qlik Answers", "Conversational AI over SOPs, policies, contracts — enables warehouse staff to query procedures", "Operational efficiency"],
        ["Qlik Discovery Agent", "AI agent for automated data exploration and root cause analysis", "#1, #4, #6"],
      ]
    ),

    heading("4. Implementation Phases"),

    heading("4.1 Phase 1: Foundation (Months 1-8, $5.2M)", 2),
    para("Core data infrastructure and the 4 highest-priority transformation routes:"),
    dataTable(
      ["Deliverable", "Description", "Nightmare Addressed"],
      [
        ["CDC Pipelines", "Real-time CDC from SAP, Oracle WMS, Manhattan WMS, Salesforce", "#1, #4"],
        ["Open Lakehouse (Bronze/Silver)", "Apache Iceberg storage with automated ingestion and quality checks", "Foundation"],
        ["Timestamp Normalizer", "Standardize all timestamps to UTC with source timezone metadata", "#5"],
        ["Inventory Reconciliation", "Automated WMS-SAP reconciliation replacing manual daily checks", "#1"],
        ["Carrier Status Normalizer", "Multi-language carrier status mapping (DPD, FedEx, NinjaVan, TransFrio)", "#6"],
        ["IoT Telemetry Pipeline", "Tive sensor data integration with carrier and product context", "#6, spoilage detection"],
        ["Pipeline Health Monitoring", "Heartbeat checks, row-count reconciliation, sync lag alerting for all 28 DCs", "#4"],
        ["Qlik Analytics Dashboards (v1)", "Inventory accuracy, cold chain monitoring, pipeline health", "#1, #4"],
      ]
    ),

    heading("4.2 Phase 2: Analytics & Quality (Months 6-16, $4.8M)", 2),
    para("Advanced data quality, remaining transformation routes, and predictive analytics:"),
    para("Address Standardization — postal address validation and correction for EU, Americas, APAC (addresses Nightmare #2)", { bullet: true }),
    para("Product Master Harmonizer — cross-system SKU matching, weight/dimension completion (addresses #3)", { bullet: true }),
    para("Supplier Identity Resolution — fuzzy matching to create canonical supplier records across SAP, WMS, Salesforce (addresses #3)", { bullet: true }),
    para("Order Timeline Builder — end-to-end order tracking from PO to delivery with unified timestamps (#5, #6, #7)", { bullet: true }),
    para("Enterprise Data Quality Trust Score — automated scoring across all 6 quality dimensions (#1-#7)", { bullet: true }),
    para("Data Stewardship Workflows — issue routing, SLA tracking, accountability framework", { bullet: true }),
    para("Qlik AutoML models — demand forecasting (reduce phantom inventory), spoilage risk prediction, delivery SLA prediction", { bullet: true }),
    para("Gold Tier data products — curated, governed datasets for business consumption", { bullet: true }),

    heading("4.3 Phase 3: AI & Conversational (Months 14-24, $2.4M)", 2),
    para("AI-powered analytics and conversational access to MCG's data and documents:"),
    para("Qlik Answers knowledge base — ingest all SOPs, policies, carrier contracts, training guides, and operational documents for conversational Q&A", { bullet: true }),
    para("Discovery Agent — automated root cause analysis for anomalies (e.g., auto-detect spoilage correlation with fleet changes)", { bullet: true }),
    para("MCP Server — enable AI agent integration with MCG's data platform via Model Context Protocol", { bullet: true }),
    para("Conversational analytics — natural language query for store managers, customer service agents, and operations staff", { bullet: true }),

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
    labelValue("NPV (10% discount rate, 3 years)", "$118.4M"),

    heading("6. Risk Factors"),
    dataTable(
      ["Risk", "Probability", "Impact", "Mitigation"],
      [
        ["CDC performance impact on production SAP", "Low", "High", "Agentless CDC; proven at scale on SAP S/4HANA"],
        ["User adoption of new dashboards", "Medium", "Medium", "Phased rollout with role-based training program"],
        ["Data quality improvement slower than projected", "Medium", "Medium", "Conservative 60% realization used in base financial model"],
        ["Scope creep from 47 source systems", "High", "Medium", "Phase 1 strictly limited to 4 critical source systems"],
        ["NVWA enforcement before Phase 1 completion", "Low", "High", "Interim manual improvements + approved project plan as evidence"],
      ]
    ),

    heading("7. Approval Requested"),
    para("Approval is requested for $12.4M total investment over 24 months, structured as:"),
    para("Phase 1: $5.2M — begin Q1 2026 (critical for NVWA compliance and Nightmare #1/#4 remediation)", { bullet: true }),
    para("Phase 2: $4.8M — begin Q3 2026 (requires Phase 1 foundation)", { bullet: true }),
    para("Phase 3: $2.4M — begin Q1 2027 (AI capabilities, lower urgency)", { bullet: true }),

    ...signatureBlock("Priya Ramanathan", "Chief Data Officer", "Project Sponsor"),
    ...signatureBlock("Ingrid van der Berg", "Chief Executive Officer", "Executive Sponsor"),
  ]);
}

async function main() {
  console.log("Generating enriched governance documents...");
  await saveDocument(trnWmsSap(), path.join(DOCS, "training", "TRN-2025-001_WMS_SAP_Integration_Guide.docx"));
  await saveDocument(trnColdChain(), path.join(DOCS, "training", "TRN-2025-002_Cold_Chain_Monitoring_For_Drivers.docx"));
  console.log("  ✓ 2 training guides");
  await saveDocument(mtgQ3Review(), path.join(DOCS, "meeting_minutes", "MTG-2025-Q3_Supply_Chain_Review.docx"));
  console.log("  ✓ 1 meeting minutes");
  await saveDocument(compNVWA(), path.join(DOCS, "compliance", "COMP-2025-NVWA_Corrective_Action_Plan.docx"));
  console.log("  ✓ 1 compliance document");
  await saveDocument(projClarity(), path.join(DOCS, "project_briefs", "PROJ-CLARITY-2025_Business_Case.docx"));
  console.log("  ✓ 1 project brief");
  console.log("✅ 5 enriched governance documents generated.");
}

main().catch(console.error);
