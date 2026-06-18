// Generate SOP DOCX files with MCG letterhead
const {
  buildDocument, saveDocument,
  metadataTable, dataTable,
  heading, para, labelValue, calloutBox, numberedItem, signatureBlock,
} = require("./mcg-docx-builder");
const path = require("path");

const OUT = path.join(__dirname, "..", "documents", "sops");

// ══════════════════════════════════════════════
// SOP-WH-001: Goods Receiving and Inbound Processing
// ══════════════════════════════════════════════
function sopWH001() {
  return buildDocument("STANDARD OPERATING PROCEDURE", [
    heading("SOP-WH-001: Goods Receiving and Inbound Processing"),
    metadataTable([
      ["Document ID", "SOP-WH-001"],
      ["Version", "3.2"],
      ["Effective Date", "15 January 2025"],
      ["Last Reviewed", "01 July 2025"],
      ["Owner", "Henrik Jansen, VP Warehouse Operations"],
      ["Classification", "Internal — All Warehouse Staff"],
      ["Applies To", "All MCG Distribution Centers and Fulfillment Hubs"],
    ]),

    heading("1. Purpose"),
    para("This procedure defines the standard process for receiving inbound goods at all MCG distribution centers and fulfillment hubs. Compliance ensures accurate inventory records, quality control, and regulatory traceability."),

    heading("2. Scope"),
    para("Applies to all inbound receipts including:"),
    para("Supplier purchase order deliveries", { bullet: true }),
    para("Inter-facility transfers", { bullet: true }),
    para("Customer returns (see SOP-WH-006 for return-specific handling)", { bullet: true }),
    para("Sample and promotional stock", { bullet: true }),

    heading("3. Responsibilities"),
    dataTable(
      ["Role", "Responsibility"],
      [
        ["Receiving Dock Supervisor", "Oversee all inbound operations, approve exceptions"],
        ["Receiving Clerk", "Physical inspection, quantity verification, system entry"],
        ["Quality Inspector", "Perishable/regulated product inspection"],
        ["Inventory Control Analyst", "Reconcile receipts against POs in SAP"],
        ["Data Entry Operator", "WMS transaction recording"],
      ]
    ),

    heading("4. Procedure"),
    heading("4.1 Pre-Arrival", 2),
    numberedItem(1, "Review the Daily Expected Receipts Report generated from SAP open PO data (published daily at 05:00 local time)."),
    numberedItem(2, "Verify dock door availability and assign inbound appointments."),
    numberedItem(3, "For perishable goods: Confirm cold storage capacity is available. Contact Cold Chain Manager if capacity < 80%."),
    numberedItem(4, "For international shipments: Verify customs clearance documentation is complete."),

    heading("4.2 Arrival and Unloading", 2),
    numberedItem(1, "Verify carrier documentation against the Purchase Order: PO number must match exactly, supplier name must match (refer to Supplier Cross-Reference Guide SOP-DATA-003 if uncertain), SKU and quantity must match PO line items."),
    numberedItem(2, "Perform visual inspection of all pallets/cartons for damage."),
    numberedItem(3, "Record actual arrival time in WMS."),
    calloutBox("IMPORTANT: Record time in LOCAL WAREHOUSE TIME. Do not convert to UTC. The system handles timezone conversion.", "warning"),
    calloutBox("KNOWN ISSUE: Timestamps between SAP (UTC) and WMS (local time) may appear inconsistent. This is expected behavior. Do not attempt manual correction.", "warning"),

    heading("4.3 Quantity Verification", 2),
    numberedItem(1, "Count all received units. For pallet-level receipts, verify pallet count and multiply by standard pallet quantity."),
    numberedItem(2, "Record in WMS: SKU (scan barcode), Quantity received, Lot number (if applicable)."),
    calloutBox("CRITICAL FOR FOOD PRODUCTS: Lot number is MANDATORY. Do not receipt food products without a lot number. If supplier has not provided a lot number, contact Supplier Management before proceeding. Reference: MCG-POL-007.", "critical"),
    numberedItem(3, "If received quantity differs from PO quantity:"),
    para("Shortage < 5%: Record actual quantity, system generates shortage alert", { bullet: true, bulletLevel: 1 }),
    para("Shortage > 5%: Hold receipt, notify Receiving Dock Supervisor", { bullet: true, bulletLevel: 1 }),
    para("Overship: Accept only the PO quantity. Excess requires supervisor approval.", { bullet: true, bulletLevel: 1 }),

    heading("4.4 Quality Inspection", 2),
    para("Perishable goods (Grocery, Fresh, Health & Wellness with cold chain requirements):", { bold: true }),
    para("Verify temperature on arrival using handheld probe thermometer", { bullet: true }),
    para("Acceptable range: 2°C to 6°C for chilled, -22°C to -18°C for frozen", { bullet: true }),
    para("Record temperature reading in WMS quality inspection module", { bullet: true }),
    calloutBox("If temperature exceeds threshold: REJECT entire shipment. Do not partial-accept. Notify Quality Manager and Supplier Management.", "critical"),
    para("Cross-reference IoT sensor data from Tive/Sensitech tracker via the Cold Chain Monitoring Dashboard.", { bullet: true }),
    para("Electronics and high-value goods:", { bold: true }),
    para("Verify serial numbers for items > $200 unit cost", { bullet: true }),
    para("Conduct 10% random sample inspection for cosmetic damage", { bullet: true }),
    para("General merchandise:", { bold: true }),
    para("5% random sample inspection unless supplier quality score < 90%, then 20% inspection", { bullet: true }),

    heading("4.5 System Recording", 2),
    numberedItem(1, "Post Goods Receipt in WMS first, then verify ERP posting."),
    para("Oracle WMS (Americas, EU DCs): Use transaction type GR-PO", { bullet: true }),
    para("Manhattan Associates (APAC DCs): Use receipt workflow RCV-STD", { bullet: true }),
    calloutBox("KNOWN ISSUE: WMS-to-SAP synchronization runs every 15 minutes via CDC. If you check SAP immediately after WMS posting, the receipt may not yet be visible. Wait at least 20 minutes before escalating a sync concern.", "warning"),
    numberedItem(2, "Assign storage location (bin) based on product storage requirements:"),
    para("AMBIENT → Zones A-D", { bullet: true }),
    para("CHILLED → Zones E-F (temperature-controlled)", { bullet: true }),
    para("FROZEN → Zone G (sub-zero)", { bullet: true }),
    numberedItem(3, "Print and apply put-away labels."),

    heading("4.6 Exception Handling", 2),
    dataTable(
      ["Exception", "Action", "Escalation"],
      [
        ["PO not found in system", "Hold at dock, contact Procurement", "Receiving Supervisor within 1 hour"],
        ["Quantity mismatch > 5%", "Partial receipt, create discrepancy report", "Inventory Control within 4 hours"],
        ["Damaged goods", "Photograph, record in WMS, segregate", "Quality Manager within 2 hours"],
        ["Temperature exceedance", "Reject entire shipment", "Quality Manager IMMEDIATELY"],
        ["Unknown SKU / barcode won't scan", "Check legacy SKU cross-reference", "Product Data team within 4 hours"],
        ["Missing lot number (food)", "DO NOT receipt. Contact supplier.", "Compliance Officer within 2 hours"],
      ]
    ),

    heading("5. Key Performance Indicators"),
    dataTable(
      ["KPI", "Target", "Measurement"],
      [
        ["Receipt accuracy (qty match)", "> 99%", "Monthly, per DC"],
        ["Receipt processing time", "< 4 hours from dock arrival", "Per receipt"],
        ["Temperature compliance (perishable)", "100% within range", "Per receipt"],
        ["Lot number capture rate (food)", "100%", "Monthly, per DC"],
        ["WMS-to-SAP sync lag", "< 30 minutes", "Real-time monitoring"],
      ]
    ),

    heading("6. Related Documents"),
    para("SOP-WH-002: Inventory Cycle Count Procedure", { bullet: true }),
    para("SOP-WH-003: Outbound Picking and Packing", { bullet: true }),
    para("SOP-WH-006: Returns Processing", { bullet: true }),
    para("SOP-DATA-003: Supplier Cross-Reference Guide", { bullet: true }),
    para("MCG-POL-007: EU Food Safety Compliance Policy", { bullet: true }),
    para("MCG-POL-012: Cold Chain Management Policy", { bullet: true }),

    heading("7. Revision History"),
    dataTable(
      ["Version", "Date", "Author", "Changes"],
      [
        ["1.0", "2020-03-01", "H. Jansen", "Initial release"],
        ["2.0", "2022-06-15", "H. Jansen", "Added APAC Manhattan WMS procedures"],
        ["3.0", "2024-01-10", "H. Jansen", "Added mandatory lot number for food products per EU audit findings"],
        ["3.1", "2024-09-01", "H. Jansen", "Added known issue re: WMS/SAP timestamp discrepancy"],
        ["3.2", "2025-01-15", "H. Jansen", "Added IoT sensor cross-reference step for perishable inspection"],
      ]
    ),
    ...signatureBlock("Henrik Jansen", "VP Warehouse Operations", "Global Supply Chain Division"),
  ]);
}

// ══════════════════════════════════════════════
// SOP-WH-002: Inventory Cycle Count Procedure
// ══════════════════════════════════════════════
function sopWH002() {
  return buildDocument("STANDARD OPERATING PROCEDURE", [
    heading("SOP-WH-002: Inventory Cycle Count Procedure"),
    metadataTable([
      ["Document ID", "SOP-WH-002"],
      ["Version", "2.4"],
      ["Effective Date", "01 March 2025"],
      ["Last Reviewed", "15 August 2025"],
      ["Owner", "Henrik Jansen, VP Warehouse Operations"],
      ["Classification", "Internal — Warehouse Operations & Inventory Control"],
      ["Applies To", "All MCG Distribution Centers and Fulfillment Hubs"],
    ]),

    heading("1. Purpose"),
    para("This procedure establishes the standard process for conducting inventory cycle counts across all MCG distribution centers. Regular cycle counting is essential for maintaining inventory record accuracy (IRA) and identifying discrepancies before they impact customer orders."),
    calloutBox("CURRENT PERFORMANCE: Enterprise IRA stands at 74% — critically below the 97% target. Cycle count compliance and accuracy are key levers for improvement.", "critical"),

    heading("2. Count Frequency and Classification"),
    dataTable(
      ["Category", "ABC Class", "Count Frequency", "Method"],
      [
        ["High-value electronics", "A", "Weekly", "Full physical count"],
        ["Perishable / cold chain", "A", "Daily", "Zone sampling (20% per day)"],
        ["General merchandise", "B", "Bi-weekly", "Statistical sampling"],
        ["Low-value / slow-moving", "C", "Monthly", "Random 10% sample"],
        ["Promotional / seasonal", "A", "Before and after promotion", "Full count"],
      ]
    ),

    heading("3. Pre-Count Preparation"),
    numberedItem(1, "Generate the Cycle Count Sheet from WMS for the assigned zone/SKU group."),
    numberedItem(2, "Ensure all pending receipts and shipments for the count zone are posted in WMS. No open transactions during counting."),
    numberedItem(3, "Verify handheld scanner firmware is current and battery is charged (>60%)."),
    numberedItem(4, "For cold chain zones: Coordinate with Cold Chain Manager to schedule count during off-peak periods to minimize door-open time."),

    heading("4. Count Process"),
    numberedItem(1, "Scan location barcode to initiate count."),
    numberedItem(2, "Scan each SKU and enter physical count."),
    numberedItem(3, "System compares to WMS book quantity in real-time."),
    numberedItem(4, "If variance detected:"),
    para("Within tolerance (±5 units or ±2%, whichever is greater): System auto-adjusts with reason code 'CC-AUTO'", { bullet: true }),
    para("Outside tolerance: System flags for supervisor review — DO NOT adjust", { bullet: true }),

    heading("5. Variance Thresholds and Escalation"),
    dataTable(
      ["Variance Level", "Threshold", "Action Required", "Approval"],
      [
        ["Minor", "≤ 5 units or ≤ 2%", "Auto-adjustment in WMS", "None (system)"],
        ["Moderate", "6-25 units or 2-5%", "Recount by different counter", "Supervisor"],
        ["Major", "26-100 units or 5-10%", "Full zone recount + root cause", "Inventory Control Manager"],
        ["Critical", "> 100 units or > 10%", "Zone freeze + investigation", "VP Warehouse Operations"],
      ]
    ),

    heading("6. SAP Reconciliation"),
    para("After WMS count adjustments are finalized:"),
    numberedItem(1, "Allow 30 minutes for CDC replication to SAP."),
    numberedItem(2, "Run SAP transaction MI07 (Inventory Differences List) for counted SKUs."),
    numberedItem(3, "Verify WMS and SAP quantities match post-adjustment."),
    calloutBox("KNOWN ISSUE: Due to the 15-minute CDC batch window, rapid sequential counts on the same SKU may show temporary discrepancies between WMS and SAP. Always verify reconciliation 30+ minutes after the last count adjustment.", "warning"),

    heading("7. Root Cause Analysis"),
    para("For all Major and Critical variances, a Root Cause Analysis (RCA) must be completed within 48 hours. Common root causes:"),
    para("Goods received but not posted (phantom inventory)", { bullet: true }),
    para("Picks completed but shipment not confirmed", { bullet: true }),
    para("Damaged/expired stock not written off", { bullet: true }),
    para("Cross-dock items counted in wrong zone", { bullet: true }),
    para("WMS-SAP sync failure (silent pipeline failure)", { bullet: true }),

    heading("8. KPIs"),
    dataTable(
      ["KPI", "Target", "Current"],
      [
        ["Inventory Record Accuracy (IRA)", "97%", "74% ⚠"],
        ["Cycle count completion rate", "100% of scheduled", "89%"],
        ["Variance root cause resolved within 48h", "95%", "62%"],
        ["SAP-WMS reconciliation match rate", "99%", "81%"],
      ]
    ),

    heading("9. Revision History"),
    dataTable(
      ["Version", "Date", "Author", "Changes"],
      [
        ["1.0", "2021-01-15", "H. Jansen", "Initial release"],
        ["2.0", "2023-06-01", "H. Jansen", "Added cold chain zone count procedures"],
        ["2.3", "2024-11-01", "H. Jansen", "Updated variance thresholds after Q3 audit"],
        ["2.4", "2025-03-01", "H. Jansen", "Added SAP reconciliation wait time guidance"],
      ]
    ),
    ...signatureBlock("Henrik Jansen", "VP Warehouse Operations", "Global Supply Chain Division"),
  ]);
}

// ══════════════════════════════════════════════
// SOP-SC-001: Product Recall Procedure
// ══════════════════════════════════════════════
function sopSC001() {
  return buildDocument("STANDARD OPERATING PROCEDURE", [
    heading("SOP-SC-001: Product Recall Procedure"),
    metadataTable([
      ["Document ID", "SOP-SC-001"],
      ["Version", "4.0"],
      ["Effective Date", "01 September 2025"],
      ["Last Reviewed", "15 August 2025"],
      ["Owner", "Dr. Elena Vasquez, Chief Compliance Officer"],
      ["Classification", "Internal — Critical: All Supply Chain & Store Personnel"],
      ["Regulatory Basis", "EU Regulation (EC) No 178/2002, Article 18 & 19"],
    ]),

    heading("1. Purpose"),
    para("This procedure defines the end-to-end process for executing product recalls across all MCG channels (stores, e-commerce, wholesale). It is designed to meet the 24-hour regulatory traceability requirement mandated by EU food safety law."),
    calloutBox("LESSONS LEARNED: The June 2025 lettuce recall (RCL-2025-003) took 11 days to complete full traceability — 10 days beyond the regulatory target. This SOP incorporates corrective actions from that incident.", "critical"),

    heading("2. Recall Classification"),
    dataTable(
      ["Class", "Definition", "Response Time", "Authority"],
      [
        ["Class I", "Reasonable probability of serious health consequences or death", "Immediate (< 4 hours)", "CEO + CCO"],
        ["Class II", "May cause temporary or medically reversible health consequences", "< 24 hours", "CCO + VP Supply Chain"],
        ["Class III", "Not likely to cause adverse health consequences", "< 72 hours", "VP Supply Chain"],
      ]
    ),

    heading("3. Recall Trigger and Notification"),
    numberedItem(1, "Recall trigger received (supplier notification, regulatory alert, internal QC finding, or customer complaint cluster)."),
    numberedItem(2, "CCO or delegate activates Recall Response Team within 30 minutes."),
    numberedItem(3, "Recall Response Team membership:"),
    para("Chief Compliance Officer (Lead)", { bullet: true }),
    para("VP Supply Chain", { bullet: true }),
    para("VP Warehouse Operations", { bullet: true }),
    para("Head of E-Commerce", { bullet: true }),
    para("Head of Customer Service", { bullet: true }),
    para("Legal Counsel", { bullet: true }),
    para("Communications Director", { bullet: true }),

    heading("4. Traceability Execution"),
    para("The critical path for any recall is identifying ALL affected inventory across the supply chain. This currently requires cross-referencing 4 systems:"),
    numberedItem(1, "SAP ERP — Purchase order receipts, supplier lot linkage"),
    numberedItem(2, "WMS (Oracle/Manhattan) — Current warehouse inventory by lot"),
    numberedItem(3, "Descartes TMS — In-transit shipment details"),
    numberedItem(4, "Salesforce Commerce Cloud — Customer orders with affected SKUs"),
    calloutBox("CURRENT GAP: These four systems are not linked by a common lot-level traceability key. The June lettuce recall required 65 person-hours of manual cross-referencing. Project Qlarity (business case pending CIO approval) will create this unified traceability layer.", "warning"),

    heading("5. Store-Level Actions"),
    numberedItem(1, "Recall notification pushed to all stores via MCG Alert System."),
    numberedItem(2, "Store managers pull affected products from shelves within 2 hours of notification."),
    numberedItem(3, "Pulled inventory recorded in POS system with reason code 'RECALL'."),
    numberedItem(4, "Photographic evidence of shelf clearance submitted via mobile app."),
    calloutBox("KNOWN ISSUE: Store-level receipt tracking by lot is only 32% complete. For SKUs without lot-level store tracking, a broader recall scope (all lots, not just affected lots) must be used. This increases cost and customer impact.", "warning"),

    heading("6. Customer Notification"),
    para("For e-commerce orders containing recalled products:"),
    numberedItem(1, "Customer Service team generates affected customer list from Salesforce."),
    numberedItem(2, "Automated email notification sent within 4 hours (Class I) or 24 hours (Class II/III)."),
    numberedItem(3, "Refund or replacement processed automatically."),
    numberedItem(4, "WISMO-trained agents briefed on recall-specific FAQs."),

    heading("7. Regulatory Reporting"),
    para("For food products in EU markets:"),
    numberedItem(1, "NVWA (Netherlands) notification within 24 hours."),
    numberedItem(2, "RASFF (Rapid Alert System for Food and Feed) entry filed."),
    numberedItem(3, "Complete traceability report submitted to regulator within 72 hours."),
    numberedItem(4, "Corrective action plan filed within 30 days."),

    heading("8. Post-Recall Review"),
    para("Within 14 days of recall closure, the Recall Response Team must complete:"),
    para("Full timeline reconstruction", { bullet: true }),
    para("Root cause analysis", { bullet: true }),
    para("Gap analysis against 24-hour target", { bullet: true }),
    para("Corrective action recommendations", { bullet: true }),
    para("SOP revision if needed", { bullet: true }),

    heading("9. Revision History"),
    dataTable(
      ["Version", "Date", "Author", "Changes"],
      [
        ["1.0", "2019-05-01", "Legal Dept", "Initial release"],
        ["2.0", "2021-03-15", "E. Vasquez", "Added EU regulatory reporting requirements"],
        ["3.0", "2024-01-10", "E. Vasquez", "Updated recall classification per NVWA guidance"],
        ["4.0", "2025-09-01", "E. Vasquez", "Major revision post lettuce recall incident"],
      ]
    ),
    ...signatureBlock("Dr. Elena Vasquez", "Chief Compliance Officer", "Legal & Compliance Division"),
  ]);
}

// ══════════════════════════════════════════════
// SOP-SC-002: Cold Chain Monitoring
// ══════════════════════════════════════════════
function sopSC002() {
  return buildDocument("STANDARD OPERATING PROCEDURE", [
    heading("SOP-SC-002: Cold Chain Monitoring and Exceedance Response"),
    metadataTable([
      ["Document ID", "SOP-SC-002"],
      ["Version", "2.1"],
      ["Effective Date", "01 June 2025"],
      ["Last Reviewed", "01 September 2025"],
      ["Owner", "Thomas Brennan, VP Supply Chain"],
      ["Classification", "Internal — Supply Chain, Warehouse, Logistics"],
      ["References", "MCG-POL-012: Cold Chain Management Policy"],
    ]),

    heading("1. Purpose"),
    para("This procedure defines the monitoring, alerting, and response protocols for maintaining cold chain integrity across MCG's perishable supply chain, from supplier dispatch through last-mile delivery."),

    heading("2. Temperature Requirements"),
    dataTable(
      ["Product Category", "Min Temp", "Max Temp", "Max Exceedance", "Sensor Type"],
      [
        ["Fresh produce", "1°C", "5°C", "30 min > 8°C", "Tive"],
        ["Dairy", "2°C", "6°C", "15 min > 8°C", "Tive"],
        ["Frozen goods", "-25°C", "-18°C", "0 min > -15°C", "Tive"],
        ["Pharmaceuticals", "2°C", "8°C", "0 min outside range", "Sensitech"],
        ["Chilled beverages", "3°C", "7°C", "60 min > 10°C", "Tive"],
      ]
    ),

    heading("3. IoT Sensor Coverage"),
    dataTable(
      ["Region", "Coverage", "Sensor Provider", "Reporting Interval"],
      [
        ["EU", "95%", "Tive", "5 minutes"],
        ["Americas", "88%", "Tive + Sensitech", "5 minutes"],
        ["APAC", "85%", "Tive", "10 minutes"],
        ["Africa", "45%", "Tive (partial)", "15 min (when connected)"],
      ]
    ),
    calloutBox("KNOWN ISSUE — Lagos DC: The Lagos distribution center experiences daily 6-hour connectivity blackouts (typically 11:00-17:00 WAT) due to intermittent internet service. During blackouts, Tive sensors buffer data locally and upload when connectivity resumes. This means temperature exceedances in Lagos may not be detected for up to 6 hours.", "critical"),
    calloutBox("KNOWN ISSUE — Americas Fahrenheit Data: Between July and September 2025, Tive sensors deployed in Americas were initially configured to report in Fahrenheit without a unit indicator. This contaminated 3 months of IoT data. Affected data has been flagged but not yet corrected.", "warning"),

    heading("4. Monitoring Workflow"),
    numberedItem(1, "IoT telemetry streams to Kafka topic 'cold-chain-telemetry' in real-time."),
    numberedItem(2, "Automated rules engine evaluates against product-specific temperature limits."),
    numberedItem(3, "Exceedance triggers alert to designated regional Cold Chain Manager."),
    numberedItem(4, "Alert includes: Shipment ID, current temperature, duration of exceedance, location, product details."),

    heading("5. Exceedance Response Protocol"),
    dataTable(
      ["Severity", "Condition", "Response", "Timeline"],
      [
        ["Warning", "Approaching limit (within 1°C)", "Monitor closely, notify driver", "Immediate"],
        ["Minor", "Exceeds limit < 15 min", "Log event, continue monitoring", "Log within 1 hour"],
        ["Major", "Exceeds limit 15-60 min", "Reroute to nearest cold facility", "Decision within 30 min"],
        ["Critical", "Exceeds limit > 60 min or frozen product thaw detected", "Quarantine shipment, do not deliver", "Immediate"],
      ]
    ),

    heading("6. Carrier Accountability"),
    para("When a temperature exceedance is caused by carrier negligence:"),
    numberedItem(1, "Document exceedance with IoT telemetry evidence."),
    numberedItem(2, "File carrier incident report within 24 hours."),
    numberedItem(3, "For repeat offenders (3+ incidents/quarter): Escalate to Carrier Performance Review."),
    para("Reference: TransFrio Q3 2025 LATAM spoilage incident — $2.48M in losses traced to carrier refrigeration gap.", { italics: true }),

    heading("7. Revision History"),
    dataTable(
      ["Version", "Date", "Author", "Changes"],
      [
        ["1.0", "2023-04-01", "T. Brennan", "Initial release"],
        ["2.0", "2025-01-15", "T. Brennan", "Added Africa/APAC sensor coverage, Fahrenheit data issue"],
        ["2.1", "2025-06-01", "T. Brennan", "Updated after TransFrio incident; added carrier accountability"],
      ]
    ),
    ...signatureBlock("Thomas Brennan", "VP Supply Chain", "Global Supply Chain Division"),
  ]);
}

// ══════════════════════════════════════════════
// SOP-CS-001: WISMO Call Handling
// ══════════════════════════════════════════════
function sopCS001() {
  return buildDocument("STANDARD OPERATING PROCEDURE", [
    heading("SOP-CS-001: WISMO (Where Is My Order/Shipment) Call Handling"),
    metadataTable([
      ["Document ID", "SOP-CS-001"],
      ["Version", "3.0"],
      ["Effective Date", "01 August 2025"],
      ["Last Reviewed", "15 September 2025"],
      ["Owner", "Lisa Park, Head of Customer Experience"],
      ["Classification", "Internal — Customer Service Representatives"],
      ["Volume Context", "536,000 WISMO contacts/month (41% of all CS contacts)"],
    ]),

    heading("1. Purpose"),
    para("This procedure standardizes the handling of WISMO (Where Is My Order/Shipment) inquiries, which represent 41% of all customer service contacts (536,000/month). Estimated cost: $1.23M per month ($14.8M annually)."),

    heading("2. The WISMO Challenge"),
    para("MCG customers currently cannot get a single, clear answer about their order status because:"),
    para("Order data lives across 5 separate systems with no unified view", { bullet: true }),
    para("Carrier tracking data is incomplete (42% missing tracking numbers globally)", { bullet: true }),
    para("Delivery promise accuracy varies by region (Singapore: 69%, EU: 87%, Americas: 91%)", { bullet: true }),
    para("Agents must toggle between 5 screens to reconstruct an order journey", { bullet: true }),

    heading("3. System Lookup Sequence"),
    para("For each WISMO inquiry, agents must check systems in this order:"),
    dataTable(
      ["Step", "System", "Purpose", "Avg. Time"],
      [
        ["1", "Salesforce Commerce Cloud", "Order status, payment confirmation", "45 sec"],
        ["2", "SAP ERP", "Fulfillment allocation, warehouse assignment", "30 sec"],
        ["3", "WMS (Oracle/Manhattan)", "Pick, pack, ship status", "60 sec"],
        ["4", "Descartes TMS", "Carrier assignment, shipment tracking", "45 sec"],
        ["5", "Carrier Portal (varies)", "Last-mile tracking detail", "90 sec"],
      ]
    ),
    para("Total average handling time per WISMO call: 4 minutes 30 seconds", { bold: true }),
    calloutBox("KNOWN ISSUE: 42% of orders have no tracking number in Descartes. For these orders, agents must contact the carrier directly, adding 5-8 minutes to the call. In Singapore, 52% of all CS contacts are WISMO (vs 41% global average) due to the NinjaVan contract change that was not communicated for 3+ weeks.", "warning"),

    heading("4. Response Scripts by Status"),
    heading("4.1 Order Confirmed, Not Yet Shipped", 2),
    para("\"Your order [ORDER-ID] was confirmed on [DATE]. It's currently being prepared at our [REGION] fulfillment center. Based on your delivery option, you should expect shipment within [X] business days.\""),
    heading("4.2 Shipped, Tracking Available", 2),
    para("\"Your order shipped on [DATE] via [CARRIER]. Your tracking number is [TRACKING]. Based on the latest update, your package is [STATUS] and expected delivery is [DATE].\""),
    heading("4.3 Shipped, No Tracking Available", 2),
    para("\"Your order shipped on [DATE] via [CARRIER]. I don't have real-time tracking available for this shipment yet. Let me check with the carrier directly...\""),
    calloutBox("Apologize for the inconvenience. Offer to set up a callback/email notification when tracking becomes available. Log the interaction with tag 'WISMO-NO-TRACK' for reporting.", "info"),
    heading("4.4 Delivery Delayed Beyond Promise", 2),
    para("\"I sincerely apologize for the delay. Your order was expected by [PROMISE-DATE]. Let me investigate what happened...\""),
    para("Check carrier system for delay reason. If carrier shows 'delivered' but customer says not received, escalate to Carrier Claims within 24 hours.", { italics: true }),

    heading("5. Escalation Matrix"),
    dataTable(
      ["Scenario", "Action", "SLA"],
      [
        ["No tracking after 48h", "Escalate to Logistics team", "4 hours"],
        ["Delivery > 5 days past promise", "Issue proactive refund/credit", "Immediate"],
        ["Customer claims non-delivery", "Open carrier investigation", "24 hours"],
        ["Repeat WISMO (3+ calls same order)", "Assign dedicated case owner", "Immediate"],
      ]
    ),

    heading("6. Regional Considerations"),
    dataTable(
      ["Region", "WISMO Rate", "Key Issue", "Special Handling"],
      [
        ["EU", "38%", "DPD German-language statuses", "Use status translation guide"],
        ["Americas", "35%", "FedEx dimensional weight disputes", "Reference rate card"],
        ["APAC (Singapore)", "52%", "NinjaVan SLA mismatch", "Acknowledge 3-day (not 2-day) delivery"],
        ["Africa (Lagos)", "61%", "Carrier connectivity gaps", "Set expectation for delayed tracking"],
      ]
    ),

    heading("7. Revision History"),
    dataTable(
      ["Version", "Date", "Author", "Changes"],
      [
        ["1.0", "2022-01-15", "L. Park", "Initial release"],
        ["2.0", "2024-03-01", "L. Park", "Added 5-system lookup sequence"],
        ["3.0", "2025-08-01", "L. Park", "Updated for NinjaVan SLA change; added Singapore handling"],
      ]
    ),
    ...signatureBlock("Lisa Park", "Head of Customer Experience", "Customer Service Division"),
  ]);
}

// ─── RUN ───
async function main() {
  console.log("Generating SOP documents...");
  await saveDocument(sopWH001(), path.join(OUT, "SOP-WH-001_Goods_Receiving_Procedure.docx"));
  await saveDocument(sopWH002(), path.join(OUT, "SOP-WH-002_Cycle_Count_Procedure.docx"));
  await saveDocument(sopSC001(), path.join(OUT, "SOP-SC-001_Product_Recall_Procedure.docx"));
  await saveDocument(sopSC002(), path.join(OUT, "SOP-SC-002_Cold_Chain_Monitoring.docx"));
  await saveDocument(sopCS001(), path.join(OUT, "SOP-CS-001_WISMO_Call_Handling.docx"));
  console.log("✅ All 5 SOPs generated.");
}

main().catch(console.error);
