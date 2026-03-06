// Generate ENRICHED SOP DOCX files — deep enterprise detail
const {
  buildDocument, saveDocument,
  metadataTable, dataTable,
  heading, para, labelValue, calloutBox, numberedItem, signatureBlock,
} = require("./mcg-docx-builder");
const path = require("path");

const OUT = path.join(__dirname, "..", "documents", "sops");

// ══════════════════════════════════════════════════════════════
// SOP-WH-001: Goods Receiving and Inbound Processing (ENRICHED)
// ══════════════════════════════════════════════════════════════
function sopWH001() {
  return buildDocument("STANDARD OPERATING PROCEDURE", [
    heading("SOP-WH-001: Goods Receiving and Inbound Processing"),
    metadataTable([
      ["Document ID", "SOP-WH-001"],
      ["Version", "3.2"],
      ["Effective Date", "15 January 2025"],
      ["Last Reviewed", "01 July 2025"],
      ["Next Review Due", "01 January 2026"],
      ["Owner", "Henrik Jansen, VP Warehouse Operations"],
      ["Co-Author", "Marco de Luca, Director DC Operations EU"],
      ["Classification", "Internal — All Warehouse Staff"],
      ["Applies To", "All MCG Distribution Centers and Fulfillment Hubs (28 DCs, 6 Mega-Hubs)"],
      ["Supersedes", "SOP-WH-001 v3.1 (01 September 2024)"],
      ["Regulatory Basis", "EU Regulation (EC) No 178/2002; MCG-POL-007 v3.1"],
      ["Training Required", "WMS Basic Operations Certification; Annual SOP Refresher"],
    ]),

    heading("1. Purpose"),
    para("This procedure defines the standard process for receiving inbound goods at all Meridian Commerce Group distribution centers and fulfillment hubs. It applies to all 28 regional distribution centers and 6 mega-fulfillment hubs across the EU, Americas, APAC, LATAM, and Africa regions."),
    para("Compliance with this SOP ensures:"),
    para("Accurate inventory records that reflect physical stock positions in real time", { bullet: true }),
    para("Product quality and safety standards are maintained at point of receipt", { bullet: true }),
    para("Regulatory traceability requirements (EU Article 18) are met for food products", { bullet: true }),
    para("Discrepancies between ordered and received quantities are identified, documented, and resolved per MCG escalation standards", { bullet: true }),
    para("Temperature-sensitive products are inspected and stored within cold chain parameters defined in MCG-POL-012", { bullet: true }),
    para("WMS and ERP records are synchronized within published SLA windows (see Section 4.5)", { bullet: true }),
    calloutBox("This SOP was substantially revised in v3.0 following the NVWA citation (NVWA-2025-CIT-04412) issued during the June 2025 inspection at Rotterdam DC. The citation specifically noted that lot numbers for food products were captured in a free-text field that allowed blank entries. Section 4.3 now mandates structured lot number capture with system-enforced validation. Version 3.2 adds IoT sensor cross-referencing for perishable quality inspection.", "warning"),

    heading("2. Scope"),
    para("This procedure applies to ALL inbound material movements at MCG facilities, including:"),
    para("Supplier purchase order deliveries (domestic and international)", { bullet: true }),
    para("Inter-facility transfers (DC-to-DC, hub-to-DC, hub-to-store)", { bullet: true }),
    para("Customer returns routed to DC (see SOP-WH-006 for return-specific handling after receipt)", { bullet: true }),
    para("Sample, promotional, and marketing stock", { bullet: true }),
    para("Vendor-managed inventory (VMI) replenishments", { bullet: true }),
    para("Cross-dock shipments transiting through the facility", { bullet: true }),

    heading("2.1 Out of Scope", 2),
    para("The following are NOT covered by this SOP:"),
    para("Direct-to-store deliveries that bypass DC (governed by SOP-ST-004)", { bullet: true }),
    para("Drop-ship orders fulfilled directly by suppliers (governed by SOP-PROC-009)", { bullet: true }),
    para("Returns processing beyond initial receipt (governed by SOP-WH-006)", { bullet: true }),
    para("Inbound customs brokerage (governed by SOP-TRADE-002, managed by MCG Trade Compliance team)", { bullet: true }),

    heading("3. Definitions and Abbreviations"),
    dataTable(
      ["Term", "Definition"],
      [
        ["CDC", "Change Data Capture — technology used for real-time data replication between WMS and SAP"],
        ["CET", "Central European Time (UTC+1; CEST = UTC+2 during daylight saving)"],
        ["DC", "Distribution Center"],
        ["ERP", "Enterprise Resource Planning (SAP S/4HANA at MCG)"],
        ["GR", "Goods Receipt — the formal posting of received inventory into the system"],
        ["IRA", "Inventory Record Accuracy — the percentage match between system records and physical stock"],
        ["Lot Number", "Unique identifier assigned by the supplier to a production batch; mandatory for food products per EU Regulation (EC) No 178/2002"],
        ["PO", "Purchase Order"],
        ["SKU", "Stock Keeping Unit — MCG's internal product identifier (format: MCG-XXXX or legacy regional formats)"],
        ["UoM", "Unit of Measure (EA=Each, CS=Case, PAL=Pallet; legacy: EACH, UNIT)"],
        ["WMS", "Warehouse Management System (Oracle WMS in Americas/EU; Manhattan Associates in APAC)"],
        ["WISMO", "Where Is My Order/Shipment — customer inquiry about delivery status"],
        ["VMI", "Vendor Managed Inventory"],
      ]
    ),

    heading("4. Responsibilities"),
    dataTable(
      ["Role", "Responsibility", "Authority Level"],
      [
        ["Receiving Dock Supervisor", "Oversee all inbound operations for assigned shift; approve exceptions up to Moderate level; ensure staffing coverage for all dock doors", "Approve receipts up to €50,000; authorize overtime"],
        ["Receiving Clerk", "Physical inspection of inbound goods; quantity verification by count or scan; barcode scanning and WMS data entry; first-line discrepancy identification", "Record receipts; flag discrepancies"],
        ["Quality Inspector", "Specialized inspection for perishable, regulated, and high-value products; temperature verification; sample testing; IoT sensor data cross-reference", "Reject entire shipments for temperature/quality violations"],
        ["Inventory Control Analyst", "Post-receipt reconciliation between WMS and SAP; variance investigation; root cause analysis for Major/Critical discrepancies", "Initiate cycle counts; request zone freezes"],
        ["Data Entry Operator", "WMS transaction recording for facilities still using manual entry (3 legacy DCs in Americas); data validation and correction", "Enter and modify WMS transactions"],
        ["Cold Chain Manager", "Authorize cold storage capacity allocation; manage temperature monitoring equipment; escalation point for all cold chain issues", "Override standard storage assignments for temperature emergencies"],
        ["Receiving Dock Manager", "Overall accountability for receiving operations across all shifts; KPI reporting; SOP compliance auditing; training program oversight", "Approve receipts over €50,000; authorize facility process changes"],
      ]
    ),

    heading("5. Required Equipment and Systems"),
    dataTable(
      ["Equipment", "Purpose", "Maintenance Schedule"],
      [
        ["Handheld barcode scanners (Zebra MC9300)", "SKU scanning, location scanning, quantity entry", "Firmware update quarterly; battery replacement as needed (>60% charge required for shift start)"],
        ["Handheld probe thermometer (Testo 104-IR)", "Product core temperature measurement for perishables", "Calibration monthly; NIST-traceable annual certification"],
        ["Pallet jack with integrated scale", "Weight verification for dimensional weight discrepancies", "Calibration quarterly"],
        ["Dock leveler and restraint system", "Safe loading/unloading", "Inspection weekly; maintenance per manufacturer schedule"],
        ["WMS terminal (fixed)", "Transaction processing for supervisors and data entry operators", "IT support per SLA"],
        ["IoT sensor reader (Tive Hub)", "Download trip data from Tive/Sensitech sensors on arriving shipments", "Firmware update as released; connectivity check daily"],
        ["Digital camera / mobile device", "Photographic evidence for damaged goods, discrepancy documentation", "Charged and available at each dock door"],
      ]
    ),

    heading("6. Procedure"),

    heading("6.1 Pre-Arrival Preparation", 2),
    numberedItem(1, "Review the Daily Expected Receipts Report, generated automatically from SAP open PO data and published to the WMS dashboard at 05:00 local warehouse time. The report includes: PO number, supplier name, expected SKUs and quantities, carrier name, appointment time (if scheduled), and any special handling instructions."),
    numberedItem(2, "Verify dock door availability in the WMS dock scheduling module and assign inbound appointments. Priority scheduling: (a) Perishable goods requiring cold dock — Dock Doors 1-4 at Rotterdam, or equivalent cold-capable doors at other DCs. (b) High-value electronics (> €10,000 shipment value) — secure dock doors with CCTV coverage. (c) International shipments requiring customs hold — bonded area dock doors."),
    numberedItem(3, "For perishable goods (product categories: Grocery, Fresh Produce, Dairy, Frozen, Health & Wellness with cold-chain flag): Confirm cold storage capacity is available in the appropriate temperature zone. If available capacity is below 80% in any cold zone, contact the Cold Chain Manager immediately to arrange overflow or priority put-away. Reference MCG-POL-012 Section 4 for temperature zone definitions."),
    numberedItem(4, "For international shipments: Verify customs clearance documentation is complete in the Trade Compliance Portal. Required documents: commercial invoice, packing list, certificate of origin (where applicable), phytosanitary certificate (for fresh produce from non-EU origins), and customs declaration. Do NOT commence unloading of international shipments without 'CLEARED' status in the portal."),
    numberedItem(5, "For supplier first-receipts (new supplier or new SKU): Alert the Quality Inspector team for mandatory 100% inspection. Reference the Supplier Quality Scorecard in the Procurement Portal to determine inspection level for returning suppliers."),
    numberedItem(6, "Verify that all receiving equipment is operational: scanners charged (>60%), thermometers calibrated (check calibration sticker date), and IoT sensor reader powered on and connected."),

    heading("6.2 Arrival and Unloading", 2),
    numberedItem(1, "Upon carrier arrival, verify carrier documentation against the Purchase Order. The following must match EXACTLY:"),
    para("PO number on delivery note matches SAP PO number", { bullet: true }),
    para("Supplier name matches (NOTE: supplier names may vary between systems due to the Product Master Data issue — refer to the Supplier Cross-Reference Guide SOP-DATA-003 if the name does not match exactly. Common example: Samsung appears as 'Samsung Electronics Co., Ltd.' in SAP, 'Samsung Elec.' in WMS, 'SAMSUNG' in Salesforce, and 'Samsung Corp' in the procurement spreadsheet. All four refer to the same supplier.)", { bullet: true }),
    para("SKU codes and quantities on the delivery note match PO line items", { bullet: true }),
    para("Carrier name matches the expected carrier in Descartes TMS (check the Daily Expected Receipts Report)", { bullet: true }),
    numberedItem(2, "Perform visual inspection of all pallets and cartons for transit damage before unloading begins. Inspect: pallet wrap integrity, carton condition (crushing, water damage, punctures), temperature indicator strips on perishable shipments (if present), and seal integrity on containers/trailers."),
    numberedItem(3, "For full-truckload (FTL) shipments: Verify trailer seal number against the bill of lading before breaking the seal. Record seal number in WMS. Any seal discrepancy requires Receiving Dock Supervisor authorization before proceeding."),
    numberedItem(4, "Record actual arrival time in WMS using the 'Carrier Check-In' function."),
    calloutBox("IMPORTANT: Record time in LOCAL WAREHOUSE TIME. Do not manually convert to UTC. The WMS system handles timezone conversion automatically during CDC replication to SAP. Oracle WMS (EU DCs) stores timestamps in CET/CEST. Oracle WMS (Americas DCs) stores in local warehouse time (EST, CST, PST, etc.). Manhattan Associates (APAC DCs) stores in UTC (with known exceptions — see Section 6.5 Known Issues).", "warning"),
    calloutBox("KNOWN ISSUE (Active): Timestamps between SAP (UTC) and WMS (local time) will appear inconsistent when viewed side-by-side. For example, a receipt at 14:32 CET in Rotterdam WMS will show as 12:32 UTC in SAP. This is CORRECT BEHAVIOR, not an error. DO NOT create a discrepancy report for timezone differences. This is documented as Nightmare #5 (Timestamp Tower of Babel) in the enterprise data quality assessment. Reference: TRN-2025-001 Section 4.", "warning"),
    numberedItem(5, "Unload goods to the receiving staging area. Organize by PO line for efficient counting. For mixed-SKU pallets, break down to individual SKU groups before counting."),

    heading("6.3 Quantity Verification", 2),
    numberedItem(1, "Count all received units. Counting methods by shipment type:"),
    para("Individual cartons: Count each carton; open 5% random sample to verify inner pack count matches packing list", { bullet: true }),
    para("Full pallets (standard configuration): Verify pallet count and multiply by standard pallet quantity (SPQ) from the SKU master. Spot-check 1 pallet per 10 pallets received by breaking down and counting individual units", { bullet: true }),
    para("Mixed pallets: Full breakdown and individual count required", { bullet: true }),
    para("Bulk/loose items: Weigh and calculate unit count based on master data unit weight (if available — note that 8,200 SKUs have missing weight data per Nightmare #3)", { bullet: true }),
    numberedItem(2, "Record in WMS for each PO line:"),
    para("SKU — Scan the barcode. The system will resolve to the MCG global SKU format (MCG-XXXX). If the barcode scans to a legacy format (Americas: AM-XXXXXX; EU: EU-XXXX-XX), the system will cross-reference automatically. If the barcode does not scan or resolves to 'UNKNOWN', see Exception Handling Section 6.6.", { bullet: true }),
    para("Quantity received — Enter the actual physical count. Do NOT enter the PO quantity; enter what you physically counted.", { bullet: true }),
    para("Unit of Measure — Verify the UoM matches the PO. MCG standard UoMs are: EA (each), CS (case), PAL (pallet). Legacy systems may show EACH or UNIT instead of EA — the system normalizes these, but verify the conversion factor is correct (e.g., 1 CS = 12 EA for most products, but varies by SKU).", { bullet: true }),
    para("Lot number (if applicable) — see critical requirements below.", { bullet: true }),
    para("Serial number — for electronics > €200 unit cost, scan individual serial numbers. System links serial to SKU and PO.", { bullet: true }),
    para("Country of origin — for fresh produce, record the country of origin from the supplier label. If not present, record 'MISSING-COO' and escalate per Section 6.6.", { bullet: true }),

    calloutBox("CRITICAL REQUIREMENT — FOOD PRODUCTS: Lot number capture is MANDATORY for ALL food products, including fresh produce, dairy, frozen goods, beverages, and health & wellness products with ingestible ingredients. As of SOP v3.0 (January 2024), the WMS lot number field is a STRUCTURED INPUT with validation. The system will BLOCK the goods receipt transaction if the lot number field is empty for any food-category SKU. If the supplier has not provided a lot number on the delivery documentation, DO NOT: (a) enter a placeholder or dummy value, (b) enter 'N/A' or 'TBD', (c) bypass the validation. Instead: HOLD the shipment at the receiving dock, contact Supplier Management (ext. 4400 or supplier.mgmt@meridiancommerce.com), and reference MCG-POL-007 Section 3.2. The Compliance Officer must be notified within 2 hours if lot number cannot be obtained. This requirement was strengthened after the NVWA citation finding F1 (June 2025).", "critical"),

    numberedItem(3, "If received quantity differs from PO quantity:"),
    para("Shortage ≤ 5% (by unit count or value, whichever is less): Record actual quantity received. WMS automatically generates a shortage alert sent to Procurement and the Inventory Control Analyst. No manual escalation required. The system creates an open 'Shortage' record linked to the PO for follow-up.", { bullet: true }),
    para("Shortage > 5% and ≤ 15%: Record actual quantity received. Hold the receipt for Receiving Dock Supervisor review within 1 hour. Supervisor decides: (a) Accept partial receipt and create backorder for balance, or (b) Reject entire shipment and return to supplier if partial receipt is not operationally viable.", { bullet: true }),
    para("Shortage > 15%: Escalate immediately to Receiving Dock Manager and Procurement Manager. Do not process receipt until authorization received. Potential supplier performance issue — log in Supplier Quality Scorecard.", { bullet: true }),
    para("Overship ≤ 5%: Accept only the PO quantity. Segregate excess units in the 'HOLD' zone. Notify Procurement to determine disposition (accept at PO price, return to supplier, or request credit).", { bullet: true }),
    para("Overship > 5%: Do NOT accept excess. Notify Receiving Dock Supervisor. Excess remains on the carrier vehicle or is staged in 'RETURN' zone pending Procurement decision.", { bullet: true }),

    heading("6.4 Quality Inspection", 2),
    para("Quality inspection requirements vary by product category. The Supplier Quality Scorecard determines the inspection level for each supplier (available in the Procurement Portal)."),

    heading("6.4.1 Perishable Goods (Grocery, Fresh, Dairy, Frozen, Health & Wellness)", 3),
    numberedItem(1, "BEFORE unloading from the carrier vehicle, check the reefer unit display temperature. Record the reading. If the display shows a temperature outside the acceptable range, do NOT unload — proceed to Step 5 (rejection)."),
    numberedItem(2, "Verify temperature on arrival using the handheld probe thermometer (Testo 104-IR). Insert the probe into the product core (not surface) of at least 3 randomly selected units from different locations within the shipment (front, middle, rear of trailer)."),
    numberedItem(3, "Acceptable temperature ranges by product type:"),
    dataTable(
      ["Product Category", "Min Temp", "Max Temp", "Tolerance", "Measurement Method"],
      [
        ["Fresh produce (lettuce, herbs, berries)", "1°C", "5°C", "+2°C for max 30 min", "Core probe, 3 samples"],
        ["Dairy (milk, cheese, yogurt)", "2°C", "6°C", "+2°C for max 15 min", "Core probe, 3 samples"],
        ["Frozen goods (ice cream, frozen meals)", "-25°C", "-18°C", "0°C tolerance (NO thaw)", "Core probe, 3 samples"],
        ["Chilled beverages", "3°C", "7°C", "+3°C for max 60 min", "Surface reading acceptable"],
        ["Pharmaceuticals / supplements", "2°C", "8°C", "0°C tolerance", "Core probe, 5 samples; calibrated thermometer only"],
        ["Eggs", "5°C", "12°C", "+2°C for max 60 min", "Surface reading acceptable"],
      ]
    ),
    numberedItem(4, "Record all temperature readings in the WMS Quality Inspection module. The system timestamps and links the reading to the PO, shipment, and lot number."),
    numberedItem(5, "If ANY temperature reading exceeds the acceptable range (including tolerance): REJECT THE ENTIRE SHIPMENT. Do NOT partial-accept. Do NOT attempt to 'salvage' products that appear to be within range — if the cold chain was broken, the entire load is compromised. Actions upon rejection:"),
    para("Record rejection in WMS with reason code 'TEMP-REJECT' and the actual temperature readings", { bullet: true }),
    para("Photograph the reefer unit display, the thermometer readings, and the product condition", { bullet: true }),
    para("Notify Quality Manager immediately (ext. 4200 or quality.mgr@meridiancommerce.com)", { bullet: true }),
    para("Notify Supplier Management within 2 hours", { bullet: true }),
    para("The carrier vehicle must remain at the dock until the Quality Manager authorizes departure or arranges for temperature-controlled waste disposal", { bullet: true }),
    para("For carriers with Tive/Sensitech IoT sensors: Download the trip telemetry from the sensor using the Tive Hub reader at the dock. The telemetry data provides the complete temperature history of the shipment and is critical evidence for carrier claims and supplier disputes.", { bullet: true }),
    numberedItem(6, "Cross-reference IoT sensor data from Tive/Sensitech tracker (if sensor is present on the shipment). Access the Cold Chain Monitoring Dashboard (Qlik Analytics) or the Tive portal directly. Compare the sensor temperature curve with your probe readings. Any discrepancy > 2°C between sensor and probe requires investigation — the sensor may be improperly positioned or malfunctioning."),
    calloutBox("KNOWN ISSUE — Americas Fahrenheit Contamination (July-September 2025): Tive sensors deployed in Americas DCs between July and September 2025 were initially configured to report in Fahrenheit WITHOUT a unit indicator in the data feed. This means a reading of '41' could be 41°F (= 5°C, acceptable for fresh produce) or 41°C (catastrophic failure). If reviewing historical data from this period, always verify the sensor configuration. All sensors have been reconfigured to Celsius as of October 2025, but the contaminated historical data has not yet been fully corrected. Reference: MCG-POL-012 Section 4, TRN-2025-002 Section 3.", "warning"),

    heading("6.4.2 Electronics and High-Value Goods", 3),
    numberedItem(1, "For items with unit cost > €200: Scan and record individual serial numbers. The WMS links serial numbers to the PO, SKU, and storage location for warranty tracking and theft prevention."),
    numberedItem(2, "Conduct 10% random sample inspection for cosmetic damage (scratches, dents, packaging damage). For new suppliers or suppliers with quality score < 85%, increase to 25% inspection."),
    numberedItem(3, "For electronics with batteries (speakers, earbuds, watches, chargers): Verify no swelling, leaking, or heat generation. Damaged lithium batteries require HAZMAT handling per SOP-WH-010."),
    numberedItem(4, "Verify product labeling matches MCG specifications: brand name, model number, MCG SKU barcode, CE marking (EU), and safety certifications."),

    heading("6.4.3 General Merchandise (Apparel, Home Goods, Non-Food)", 3),
    numberedItem(1, "Standard inspection: 5% random sample for cosmetic damage, labeling accuracy, and packaging integrity."),
    numberedItem(2, "Elevated inspection (supplier quality score < 90%): 20% random sample."),
    numberedItem(3, "New supplier first-receipt: 100% inspection of first 3 deliveries."),
    numberedItem(4, "For apparel: Verify sizing labels match packing list. Common issue: Asian sizing vs European sizing mismatches on supplier cross-docked goods."),

    heading("6.5 System Recording and Posting", 2),
    numberedItem(1, "Post Goods Receipt in WMS FIRST, then verify ERP posting. This is the required sequence because the CDC replication flows FROM WMS TO SAP, not the reverse."),
    para("Oracle WMS (Americas DCs, EU DCs): Use transaction type GR-PO. Select the PO number, confirm line items and quantities, confirm storage location assignment, and POST.", { bullet: true }),
    para("Manhattan Associates (APAC DCs): Use receipt workflow RCV-STD. Navigate to Inbound > Receipt > Standard Receipt. Scan PO barcode, confirm lines, and COMPLETE.", { bullet: true }),
    calloutBox("CRITICAL TIMING: WMS-to-SAP synchronization runs via Change Data Capture (CDC) in 15-minute batch windows. After posting a goods receipt in WMS, the corresponding inventory update in SAP will NOT be visible for 15-30 minutes. This is normal and expected. DO NOT: (a) Escalate a 'missing receipt' in SAP until at least 30 minutes have elapsed. (b) Attempt to manually enter the receipt in SAP — this will create a DUPLICATE when the CDC batch catches up. (c) Re-post the receipt in WMS thinking the first attempt failed. Check the WMS transaction log to confirm your posting was successful before taking any corrective action. Reference: TRN-2025-001 Section 3.", "warning"),
    calloutBox("KNOWN ISSUE (Active) — APAC Timezone Misconfiguration: Manhattan WMS at the Singapore and Jakarta DCs is configured to store timestamps in local time instead of UTC, despite the system setting indicating UTC. This means a receipt posted at 14:00 SGT appears as 14:00 in Manhattan (should be 06:00 UTC). When this data replicates to SAP, it creates an apparent 8-hour discrepancy. IT is aware; correction planned for Q1 2026. In the interim, APAC DCs should NOT create discrepancy reports for timezone differences between Manhattan and SAP. Reference: TRN-2025-001 Section 4.", "warning"),
    numberedItem(2, "Assign storage location based on product storage requirements. The WMS will suggest a location based on the SKU's storage profile, but the operator must confirm:"),
    dataTable(
      ["Storage Zone", "Temperature", "Product Types", "DC Locations"],
      [
        ["AMBIENT (Zones A-D)", "15-25°C", "Electronics, home goods, apparel, non-perishable grocery", "All DCs"],
        ["CHILLED (Zones E-F)", "2-6°C", "Fresh produce, dairy, chilled beverages, some pharmaceuticals", "22 of 28 DCs (6 legacy DCs lack chilled zones)"],
        ["FROZEN (Zone G)", "-25 to -18°C", "Frozen goods, ice cream", "18 of 28 DCs"],
        ["SECURE (Zone S)", "Ambient, CCTV-monitored", "Electronics > €500, high-theft-risk items", "All DCs"],
        ["HAZMAT (Zone H)", "Per MSDS requirements", "Batteries, cleaning chemicals, aerosols", "12 DCs with HAZMAT certification"],
        ["BONDED (Zone B)", "Varies", "International shipments pending customs clearance", "8 DCs with bonded warehouse status"],
      ]
    ),
    para("NOTE: Legacy DCs in LATAM (São Paulo, Buenos Aires) and Africa (Lagos, Nairobi) use non-standard zone codes: KALT (German legacy for 'cold'), FROID (French legacy for 'cold'), AMB (abbreviation for ambient). The WMS normalizes these internally, but operators at these facilities should use the local zone codes they are familiar with.", { italics: true }),
    numberedItem(3, "Print and apply put-away labels from the WMS label printer at the receiving station. Labels include: MCG SKU barcode, lot number (if applicable), storage location barcode, receipt date, and PO reference."),
    numberedItem(4, "Initiate put-away. For high-volume DCs using directed put-away, the WMS assigns the specific bin location. For DCs using zone-directed put-away, the operator selects any available bin within the assigned zone. Confirm put-away in WMS by scanning the destination bin barcode."),
    numberedItem(5, "DAILY END-OF-SHIFT RECONCILIATION: Before shift end, the Receiving Dock Supervisor must verify that all goods receipted during the shift have been posted in WMS and no items remain in the receiving staging area without a WMS transaction. Any unprocessed goods must be documented on the Shift Handover Report with reason for delay."),

    heading("6.6 Exception Handling", 2),
    dataTable(
      ["Exception", "Immediate Action", "Escalation", "Escalation Timeline", "Documentation Required"],
      [
        ["PO not found in WMS/SAP", "Hold goods at dock. Do NOT unload to staging. Verify PO number with carrier paperwork.", "Procurement Helpdesk (ext. 4100)", "Within 1 hour", "Photo of carrier docs; email to procurement"],
        ["Quantity mismatch > 5%", "Complete partial receipt for accepted quantity. Segregate discrepancy.", "Inventory Control Analyst", "Within 4 hours", "WMS shortage record; photo of actual goods"],
        ["Damaged goods (external)", "Photograph all damage. Segregate damaged units. Accept undamaged portion.", "Quality Manager (ext. 4200)", "Within 2 hours", "Photos; WMS damage record; carrier acknowledgment"],
        ["Concealed damage (found during inspection)", "Segregate affected units. Record in WMS with 'CONCEALED-DMG' code.", "Quality Manager + Carrier Claims", "Within 24 hours (carrier claim deadline)", "Photos; inspection report; carrier claim form"],
        ["Temperature exceedance (perishable)", "REJECT entire shipment. Do NOT unload.", "Quality Manager IMMEDIATELY", "Immediate", "Reefer display photo; thermometer readings; IoT data download"],
        ["Unknown SKU / barcode won't scan", "Check legacy SKU cross-reference in WMS (F8 key or Search > Cross-Ref). Try manual entry of supplier SKU.", "Product Data Team (ext. 4300)", "Within 4 hours", "Photo of product label; supplier SKU; PO reference"],
        ["Missing lot number (food product)", "DO NOT receipt. Hold at dock.", "Supplier Management + Compliance Officer", "Within 2 hours", "Supplier contact record; delivery note copy"],
        ["Missing country of origin (fresh produce)", "Record 'MISSING-COO' in WMS. Accept receipt but flag for follow-up.", "Compliance Officer", "Within 24 hours", "WMS flag; supplier notification email"],
        ["Supplier not in approved register", "Hold ALL goods. Do not receipt.", "Procurement Manager + Compliance Officer", "Immediate", "Delivery note; carrier info; supplier details"],
        ["Seal number mismatch (FTL)", "Do not break seal. Hold trailer.", "Receiving Dock Manager + Security", "Immediate", "Photo of seal; BOL copy; security incident report"],
        ["Carrier arrived outside appointment window (> 2 hours late)", "Attempt to accommodate. If no dock available, carrier waits or reschedules.", "Receiving Dock Supervisor", "Within 1 hour", "Carrier detention record (if applicable)"],
        ["Hazardous material without MSDS", "REJECT. Do not unload.", "HAZMAT Officer + Receiving Dock Manager", "Immediate", "Carrier rejection notice; regulatory report if required"],
      ]
    ),

    heading("6.7 Post-Receipt Activities", 2),
    numberedItem(1, "DAILY SYNC VERIFICATION (mandatory until Project CLARITY pipeline monitoring is deployed): At 08:00 local time, the Inventory Control Analyst selects 5 random transactions from the previous day's WMS receiving log and verifies each appears in SAP with matching quantities. Results recorded in the Daily Sync Check Spreadsheet (SharePoint > Supply Chain > Inventory Control > Daily Sync Checks). Estimated time: 15-20 minutes. Reference: TRN-2025-001 Section 5."),
    numberedItem(2, "Carrier documentation (delivery notes, bills of lading, temperature logs, customs declarations) must be scanned and uploaded to the Document Management System (DMS) within 24 hours of receipt. Link to the PO number and WMS receipt ID."),
    numberedItem(3, "For perishable receipts with IoT sensor data: Ensure the Tive trip summary is saved in the DMS. This data may be required for regulatory audits (NVWA), carrier disputes, or insurance claims."),
    numberedItem(4, "For receipts with quantity discrepancies: Verify that the Procurement team has acknowledged the shortage alert within 48 hours. If no acknowledgment, escalate to Procurement Manager."),

    heading("7. Key Performance Indicators"),
    dataTable(
      ["KPI", "Target", "Current (Q3 2025)", "Measurement Frequency", "Data Source"],
      [
        ["Receipt accuracy (quantity match)", "> 99%", "96.2%", "Monthly, per DC", "WMS receipt vs PO comparison"],
        ["Receipt processing time (dock to put-away)", "< 4 hours", "3.8 hours (EU avg)", "Per receipt", "WMS timestamp: check-in to put-away confirm"],
        ["Temperature compliance (perishable)", "100% within range at receipt", "97.3%", "Per receipt", "WMS Quality Inspection module"],
        ["Lot number capture rate (food products)", "100%", "93% (up from 85% pre-v3.0)", "Monthly, per DC", "WMS data quality report"],
        ["Country of origin capture (fresh produce)", "100%", "88%", "Monthly, per DC", "WMS data quality report"],
        ["WMS-to-SAP sync verification pass rate", "100%", "94%", "Daily", "Daily Sync Check Spreadsheet"],
        ["Carrier on-time arrival rate", "> 90%", "82%", "Monthly, per carrier", "WMS check-in vs appointment time"],
        ["Exception rate (total exceptions / total receipts)", "< 3%", "4.7%", "Monthly, per DC", "WMS exception log"],
        ["Dock-to-stock time (receipt to available for picking)", "< 8 hours", "6.2 hours (EU avg)", "Per receipt", "WMS receipt timestamp to inventory available timestamp"],
      ]
    ),

    heading("8. Training Requirements"),
    para("All personnel involved in goods receiving must complete the following training:"),
    dataTable(
      ["Training Module", "Audience", "Frequency", "Duration", "Delivery Method"],
      [
        ["SOP-WH-001 Goods Receiving Procedure", "All receiving staff", "Annual refresher + upon SOP revision", "2 hours", "Classroom + hands-on"],
        ["WMS Receiving Operations (Oracle)", "EU/Americas DC staff", "Initial + annual refresher", "4 hours", "Hands-on with WMS trainer"],
        ["WMS Receiving Operations (Manhattan)", "APAC DC staff", "Initial + annual refresher", "4 hours", "Hands-on with WMS trainer"],
        ["Cold Chain Receiving (TRN-2025-002)", "Staff handling perishables", "Annual + seasonal refresh", "1.5 hours", "Classroom + cold dock practical"],
        ["IoT Sensor Data Download", "Quality Inspectors", "Upon deployment + annual", "1 hour", "Hands-on"],
        ["Food Safety & Traceability Basics", "All receiving staff at food-handling DCs", "Annual", "2 hours", "E-learning + assessment"],
        ["HAZMAT Receiving", "Staff at HAZMAT-certified DCs", "Annual + regulatory certification", "4 hours", "External certified trainer"],
      ]
    ),

    heading("9. Related Documents"),
    dataTable(
      ["Document ID", "Title", "Relevance"],
      [
        ["SOP-WH-002", "Inventory Cycle Count Procedure", "Post-receipt inventory verification"],
        ["SOP-WH-003", "Outbound Picking and Packing", "Downstream process after put-away"],
        ["SOP-WH-006", "Returns Processing", "Return-specific handling after initial receipt"],
        ["SOP-WH-010", "Hazardous Materials Handling", "HAZMAT receiving and storage"],
        ["SOP-SC-001", "Product Recall Procedure", "Recall execution when received product is affected"],
        ["SOP-SC-002", "Cold Chain Monitoring", "Continuous temperature monitoring after receipt"],
        ["SOP-DATA-003", "Supplier Cross-Reference Guide", "Resolving supplier name mismatches"],
        ["SOP-PROC-009", "Drop-Ship Order Management", "Direct-to-customer supplier shipments"],
        ["SOP-ST-004", "Direct-to-Store Delivery", "Store deliveries bypassing DC"],
        ["SOP-TRADE-002", "International Trade Compliance", "Customs and import procedures"],
        ["MCG-POL-007", "EU Food Safety Compliance Policy", "Regulatory requirements for food receiving"],
        ["MCG-POL-012", "Cold Chain Management Policy", "Temperature standards and monitoring requirements"],
        ["MCG-POL-015", "Data Quality Standards", "Enterprise data quality governance"],
        ["TRN-2025-001", "WMS-SAP Integration Guide", "Understanding sync delays and timestamp handling"],
        ["TRN-2025-002", "Cold Chain Monitoring for Drivers/Staff", "Practical cold chain guidance"],
        ["INC-2025-04872", "Rotterdam Pipeline Failure", "Case study: what happens when sync fails"],
        ["COMP-2025-NVWA", "NVWA Corrective Action Plan", "Regulatory corrective actions affecting receiving"],
      ]
    ),

    heading("10. Appendix A: SKU Format Cross-Reference"),
    para("MCG uses multiple SKU formats due to legacy acquisitions. The WMS barcode scanner resolves all formats automatically, but operators should be aware of the following formats:"),
    dataTable(
      ["Format", "Region/System", "Example", "Pattern"],
      [
        ["MCG Global", "Standard (all new products)", "MCG-4420", "MCG-XXXX (4 digits)"],
        ["Americas Legacy", "Oracle WMS Americas", "AM-442078", "AM-XXXXXX (6 digits)"],
        ["EU Legacy", "Oracle WMS EU (pre-2022 products)", "EU-4420-BK", "EU-XXXX-XX (4 digits + 2-char variant)"],
        ["APAC", "Manhattan WMS APAC", "AP4420", "APXXXX (4 digits, no hyphen)"],
        ["Supplier SKU", "Various", "SM-BT-SPK-001", "Varies by supplier (not scannable in MCG systems)"],
      ]
    ),

    heading("11. Appendix B: Supplier Quality Score Inspection Levels"),
    dataTable(
      ["Supplier Score", "Rating", "Standard Inspection", "Perishable Inspection", "Review Frequency"],
      [
        ["95-100", "A (Excellent)", "2% sample", "Temperature + 5% visual", "Annual"],
        ["85-94", "B (Good)", "5% sample", "Temperature + 10% visual", "Semi-annual"],
        ["70-84", "C (Needs Improvement)", "20% sample", "Temperature + 20% visual + lab sample", "Quarterly"],
        ["< 70", "D (Probation)", "100% inspection", "100% inspection + Quality Manager oversight", "Monthly"],
        ["New supplier", "Unrated", "100% (first 3 deliveries)", "100% (first 5 deliveries)", "Per delivery until rated"],
      ]
    ),

    heading("12. Revision History"),
    dataTable(
      ["Version", "Date", "Author", "Changes", "Approval"],
      [
        ["1.0", "01 Mar 2020", "H. Jansen", "Initial release — EU and Americas DCs only", "VP Supply Chain"],
        ["1.5", "15 Sep 2020", "H. Jansen", "Added HAZMAT receiving references", "VP Supply Chain"],
        ["2.0", "15 Jun 2022", "H. Jansen", "Added APAC Manhattan WMS procedures; expanded to global scope", "VP Supply Chain + CIO"],
        ["2.5", "01 Mar 2023", "H. Jansen", "Added cross-dock and VMI receiving procedures", "VP Supply Chain"],
        ["3.0", "10 Jan 2024", "H. Jansen", "MAJOR: Added mandatory lot number for food products per EU audit findings; converted lot field from free-text to structured input; added NVWA compliance references", "VP Supply Chain + CCO + CEO"],
        ["3.1", "01 Sep 2024", "H. Jansen", "Added known issue note re: WMS/SAP timestamp discrepancy; added Daily Sync Verification procedure; updated exception handling table", "VP Supply Chain"],
        ["3.2", "15 Jan 2025", "H. Jansen", "Added IoT sensor cross-reference step for perishable inspection; added Americas Fahrenheit sensor issue warning; added country of origin capture for fresh produce; expanded training requirements table; added Appendix A (SKU formats) and Appendix B (supplier inspection levels)", "VP Supply Chain + CCO"],
      ]
    ),

    heading("13. Document Approval"),
    ...signatureBlock("Henrik Jansen", "VP Warehouse Operations", "Global Supply Chain Division"),
    ...signatureBlock("Dr. Elena Vasquez", "Chief Compliance Officer", "Legal & Compliance Division (Regulatory review)"),
    ...signatureBlock("Marco de Luca", "Director DC Operations, EU", "Operations (Technical review)"),
  ]);
}

// ══════════════════════════════════════════════════════════════
// SOP-WH-002: Inventory Cycle Count (ENRICHED)
// ══════════════════════════════════════════════════════════════
function sopWH002() {
  return buildDocument("STANDARD OPERATING PROCEDURE", [
    heading("SOP-WH-002: Inventory Cycle Count Procedure"),
    metadataTable([
      ["Document ID", "SOP-WH-002"],
      ["Version", "2.4"],
      ["Effective Date", "01 March 2025"],
      ["Last Reviewed", "15 August 2025"],
      ["Next Review Due", "15 February 2026"],
      ["Owner", "Henrik Jansen, VP Warehouse Operations"],
      ["Co-Author", "Anke de Vries, Senior Inventory Control Analyst"],
      ["Classification", "Internal — Warehouse Operations & Inventory Control"],
      ["Applies To", "All MCG Distribution Centers and Fulfillment Hubs"],
      ["Supersedes", "SOP-WH-002 v2.3 (01 November 2024)"],
      ["Training Required", "WMS Cycle Count Module; SOP-WH-002 Annual Refresher"],
    ]),

    heading("1. Purpose and Business Context"),
    para("This procedure establishes the standard process for conducting inventory cycle counts across all MCG distribution centers. Regular cycle counting is essential for maintaining inventory record accuracy (IRA) and identifying discrepancies before they impact customer orders, store replenishment, and financial reporting."),
    calloutBox("CRITICAL CONTEXT: MCG's enterprise Inventory Record Accuracy (IRA) stands at 74% — critically below the 97% target and well below the industry benchmark of 95%. This 23-percentage-point gap translates to approximately $48M in annual losses from phantom inventory, misallocated stock, emergency transfers, store stockouts on products showing as 'available' in SAP, and customer order cancellations. Cycle count compliance and accuracy are the primary operational levers for improving IRA while the enterprise invests in systemic fixes through Project CLARITY.", "critical"),
    para("Key business impacts of low IRA:"),
    para("Store replenishment orders are allocated against inventory that doesn't physically exist ('phantom inventory'), resulting in store stockouts with no ERP visibility", { bullet: true }),
    para("E-commerce orders are accepted and confirmed for products that are not in stock, leading to cancellations, refunds, and WISMO contacts ($14.8M/year in WISMO costs)", { bullet: true }),
    para("Financial inventory valuations are overstated, creating audit risk and inaccurate carrying cost forecasts", { bullet: true }),
    para("Safety stock calculations are unreliable, leading to either excess stock (carrying cost) or insufficient stock (stockouts)", { bullet: true }),
    para("The Q3 2025 board review specifically cited IRA as the #1 data quality issue requiring immediate operational attention", { bullet: true }),

    heading("2. Scope"),
    para("This procedure applies to all scheduled and ad-hoc cycle counts at MCG distribution centers and fulfillment hubs. It covers:"),
    para("Scheduled cycle counts (ABC-classified frequency)", { bullet: true }),
    para("Ad-hoc counts triggered by discrepancy investigation", { bullet: true }),
    para("Pre-promotion and post-promotion counts", { bullet: true }),
    para("Regulatory compliance counts (food traceability verification)", { bullet: true }),
    para("Annual wall-to-wall inventory (coordinated across all DCs in January)", { bullet: true }),
    para("It does NOT cover retail store inventory counts (governed by SOP-ST-007)."),

    heading("3. Definitions"),
    dataTable(
      ["Term", "Definition"],
      [
        ["IRA", "Inventory Record Accuracy: (Number of SKU locations with matching system and physical counts) / (Total SKU locations counted) × 100%"],
        ["ABC Classification", "Product classification by annual sales velocity and value: A = top 80% of revenue (typically 20% of SKUs); B = next 15% of revenue; C = remaining 5% of revenue"],
        ["Phantom Inventory", "Stock shown in the system (SAP/WMS) that does not physically exist. Primary cause: silent pipeline failures between WMS and SAP (see INC-2025-04872)"],
        ["Negative Inventory", "System shows negative stock quantity — physically impossible. Indicates a transaction sequencing error or unposted receipt"],
        ["Variance", "Difference between system (WMS book) quantity and physical count quantity. Expressed in units and/or percentage of book quantity"],
        ["Cycle Count Sheet", "System-generated list of SKU/locations to be counted, with current book quantities hidden from the counter to prevent bias"],
        ["Blind Count", "Count method where the counter does NOT see the expected quantity — enters only what they physically count. MCG standard method."],
        ["Zone Freeze", "Temporary halt to all inventory movements (receipts, picks, transfers) in a specific zone to allow accurate counting. Duration: maximum 4 hours."],
      ]
    ),

    heading("4. Count Frequency and Classification"),
    dataTable(
      ["Category", "ABC Class", "Count Frequency", "Method", "Zone Freeze Required?", "Counter Certification"],
      [
        ["High-value electronics (> €100 unit cost)", "A", "Weekly", "Full count, blind method", "Yes (2-hour window)", "Level 2 certified"],
        ["Perishable / cold chain products", "A", "Daily (20% zone sampling per day = full zone per week)", "Zone sample, blind method", "No (count between picks)", "Level 1 certified + cold chain trained"],
        ["Fast-moving general merchandise", "A", "Weekly", "Full count per location, blind method", "Yes (2-hour window)", "Level 1 certified"],
        ["Medium-velocity merchandise", "B", "Bi-weekly", "Statistical sampling (30% of locations)", "No", "Level 1 certified"],
        ["Slow-moving / seasonal", "C", "Monthly", "Random 10% sample", "No", "Level 1 certified"],
        ["Promotional / seasonal displays", "A (temporary)", "Day before promo starts; day after promo ends", "Full count of promo SKUs", "Yes (1-hour window)", "Level 1 certified"],
        ["Quarantined / hold stock", "N/A", "Weekly", "Full count of hold zone", "Yes (permanent freeze on hold zone)", "Level 2 certified"],
        ["Hazardous materials", "N/A", "Monthly", "Full count with HAZMAT-certified counter", "Yes (during count only)", "HAZMAT certified"],
      ]
    ),

    heading("5. Counter Certification Levels"),
    dataTable(
      ["Level", "Requirements", "Authorized Count Types"],
      [
        ["Level 1", "WMS basic operations certified; SOP-WH-002 training complete; 2 supervised counts signed off by Level 2 counter", "B and C class SKUs; daily perishable sampling; ad-hoc counts (standard zones)"],
        ["Level 2", "Level 1 requirements + 6 months counting experience; variance investigation training; supervisor endorsement", "A class SKUs; high-value electronics; promotional counts; hold zone counts; regulatory counts"],
        ["HAZMAT", "Level 2 requirements + external HAZMAT certification", "Hazardous materials zone counts"],
      ]
    ),

    heading("6. Pre-Count Preparation"),
    numberedItem(1, "Generate the Cycle Count Sheet from WMS for the assigned zone/SKU group. The sheet includes: Location barcode, SKU barcode, SKU description, UoM, and lot number (if lot-tracked). The BOOK QUANTITY IS HIDDEN (blind count method) to prevent bias."),
    numberedItem(2, "Ensure all pending transactions for the count zone are complete:"),
    para("All goods receipts posted and put-away confirmed", { bullet: true }),
    para("All open pick tasks completed or cancelled", { bullet: true }),
    para("All pending transfers posted", { bullet: true }),
    para("No open replenishment tasks for the zone", { bullet: true }),
    para("If transactions cannot be completed, coordinate with the DC Shift Manager to establish a zone freeze window. Maximum freeze duration: 4 hours for standard zones, 2 hours for high-velocity zones.", { bullet: true }),
    numberedItem(3, "Verify handheld scanner is operational: firmware current (check version on startup screen; current version: MC9300-FW-2025.09), battery > 60%, Wi-Fi connected to DC network."),
    numberedItem(4, "For cold chain zone counts: Coordinate with the Cold Chain Manager to schedule count during off-peak receiving/shipping periods. Cold zone door-open time during counting must not exceed the limits defined in MCG-POL-012 (15 minutes for chilled, 5 minutes for frozen). Counters must wear appropriate PPE: insulated gloves, cold-weather vest for chilled zones; full cold-weather suit for frozen zones."),
    numberedItem(5, "For high-value electronics counts: Notify DC Security. A security officer must be present during the count to maintain chain of custody. Count area must be under CCTV coverage."),

    heading("7. Count Process"),
    numberedItem(1, "Navigate to the first count location. Scan the location barcode to initiate count in WMS."),
    numberedItem(2, "Physically count ALL units of each SKU at the location. Counting rules:"),
    para("Count each individual unit (EA). Do not estimate.", { bullet: true }),
    para("For case (CS) quantities: Count cases AND open/partial cases. Record: X full cases + Y loose units. System converts to total EA.", { bullet: true }),
    para("For pallet (PAL) quantities: Count full pallets. For each pallet, verify the pallet label matches the SKU. If labels are missing or illegible, count individual cases on the pallet.", { bullet: true }),
    para("For lot-tracked products: Count by lot number. If multiple lots of the same SKU are at the same location, record separate counts per lot.", { bullet: true }),
    para("Count items physically present at the location, INCLUDING items that appear damaged, expired, or misplaced. Record their condition in the notes field.", { bullet: true }),
    numberedItem(3, "Scan each SKU barcode and enter the physical count in the WMS count module."),
    numberedItem(4, "WMS compares the entered count to the book quantity in real-time and flags variances:"),

    heading("8. Variance Thresholds and Escalation"),
    dataTable(
      ["Variance Level", "Threshold", "Action Required", "Approval Authority", "Resolution SLA"],
      [
        ["Minor", "≤ 5 units AND ≤ 2% of book qty (whichever is greater)", "System auto-adjusts WMS quantity with reason code 'CC-AUTO'. No manual intervention required. Adjustment logged for audit trail.", "None (automated)", "Immediate (system)"],
        ["Moderate", "6-25 units OR 2-5% of book qty", "WMS flags for recount. A DIFFERENT counter (not the original) must perform a second blind count. If the recount matches the original count, supervisor approves the adjustment. If the recount differs, a third count is performed by a Level 2 counter.", "Receiving Dock Supervisor or Inventory Control Analyst", "Within 24 hours"],
        ["Major", "26-100 units OR 5-10% of book qty", "Full zone recount triggered. Root cause investigation initiated by Inventory Control Analyst. Common causes investigated: silent pipeline failure, mispicks, unreported damage, theft, WMS-SAP sync issue.", "Inventory Control Manager", "Within 48 hours"],
        ["Critical", "> 100 units OR > 10% of book qty, OR any A-class SKU variance > 5%", "Zone freeze initiated. Full zone recount by Level 2 counters. VP Warehouse Operations notified. Root cause investigation with written report. May trigger financial inventory restatement.", "VP Warehouse Operations (Henrik Jansen)", "Within 72 hours; written RCA report within 5 business days"],
      ]
    ),

    heading("9. SAP Reconciliation"),
    para("After WMS count adjustments are finalized, the Inventory Control Analyst must verify SAP reconciliation:"),
    numberedItem(1, "Allow MINIMUM 30 minutes for CDC replication from WMS to SAP. For large batch adjustments (> 50 SKU locations), allow 60 minutes."),
    numberedItem(2, "In SAP, run transaction MI07 (Inventory Differences List) filtered for the counted SKUs and date range."),
    numberedItem(3, "Verify each WMS count adjustment is reflected in SAP with matching quantity."),
    numberedItem(4, "If any adjustment is MISSING from SAP after 60 minutes, this may indicate a CDC pipeline failure. Escalate to IT Operations immediately and reference INC-2025-04872 (Rotterdam Pipeline Failure) as a comparable incident. Do NOT manually enter the adjustment in SAP."),
    calloutBox("KNOWN ISSUE: Due to the 15-minute CDC batch window, rapid sequential count adjustments on the same SKU may show temporary discrepancies between WMS and SAP. Example: Counter adjusts SKU MCG-4420 at Location A-14-03 at 10:05, then adjusts the same SKU at Location A-14-08 at 10:12. The first adjustment may reach SAP before the second, showing a momentary intermediate value. ALWAYS wait 30+ minutes after the LAST count adjustment before verifying reconciliation.", "warning"),

    heading("10. Root Cause Analysis"),
    para("For all Major and Critical variances, a Root Cause Analysis (RCA) must be completed within the resolution SLA. The RCA must address:"),
    numberedItem(1, "What was the specific variance (SKU, location, expected vs actual, lot if applicable)?"),
    numberedItem(2, "When was the last accurate count at this location (reference previous cycle count records)?"),
    numberedItem(3, "What transactions occurred at this location since the last accurate count (WMS transaction log)?"),
    numberedItem(4, "Was there a known pipeline failure or sync issue during the period (check IT Ops incident log)?"),
    numberedItem(5, "Was the SKU subject to any promotional activity, store allocation, or reallocation during the period?"),
    numberedItem(6, "Is there evidence of damage write-off not posted, returns not processed, or inter-zone transfer not completed?"),
    numberedItem(7, "For A-class electronics: Was there a security incident or evidence of shrinkage?"),

    para("Common root causes identified at MCG (ranked by frequency):"),
    dataTable(
      ["Root Cause", "Frequency", "Nightmare Link", "Typical Resolution"],
      [
        ["WMS-SAP sync failure (batch job stopped)", "28%", "#4 Silent Pipelines", "IT Ops restart; backlog replay; pipeline monitoring alert"],
        ["Picks completed in WMS but shipment not confirmed", "22%", "#4 Silent Pipelines", "Post-shipment confirmation; retrain picker"],
        ["Goods received but put-away not confirmed", "18%", "Process gap", "Complete put-away transaction; retrain receiver"],
        ["Damaged/expired stock not written off", "14%", "Process gap", "Post write-off; establish regular damaged goods sweep"],
        ["Cross-dock items counted in wrong zone", "8%", "Process gap", "Correct location assignment; retrain"],
        ["UoM conversion error (EA vs CS vs PAL)", "6%", "#3 Product Master", "Correct UoM; flag SKU master for review"],
        ["Actual theft/shrinkage", "4%", "Security", "Security investigation; loss prevention review"],
      ]
    ),

    heading("11. Key Performance Indicators"),
    dataTable(
      ["KPI", "Target", "Q2 2025", "Q3 2025", "Trend", "Data Source"],
      [
        ["Inventory Record Accuracy (IRA)", "97%", "74%", "74%", "→ Flat ⚠", "Cycle count results"],
        ["Cycle count completion rate", "100% of scheduled counts", "86%", "89%", "↑ Improving", "WMS count schedule vs completion"],
        ["First-count accuracy (no recount needed)", "90%", "78%", "81%", "↑ Improving", "WMS count records"],
        ["Variance root cause resolved within SLA", "95%", "58%", "62%", "↑ Improving slowly ⚠", "RCA report log"],
        ["SAP-WMS reconciliation match rate", "99%", "79%", "81%", "↑ Improving slowly ⚠", "Daily sync verification"],
        ["A-class count on-time completion", "100%", "92%", "94%", "↑ Improving", "WMS count schedule"],
        ["Average variance (absolute, A-class SKUs)", "< 2%", "7.3%", "6.8%", "↓ Improving slowly", "WMS count records"],
        ["Zone freeze compliance (within 4-hour limit)", "100%", "96%", "98%", "↑ Improving", "WMS zone freeze log"],
      ]
    ),

    heading("12. Appendix: Sample Cycle Count Sheet"),
    para("The following is an example of a WMS-generated Cycle Count Sheet (blind count method — book quantities hidden):"),
    dataTable(
      ["Location", "SKU", "Description", "UoM", "Lot", "Physical Count", "Counter Notes"],
      [
        ["A-14-03", "MCG-4420", "Bluetooth Speaker (Black)", "EA", "N/A", "______", ""],
        ["A-14-03", "MCG-4421", "Bluetooth Speaker (White)", "EA", "N/A", "______", ""],
        ["E-02-11", "MCG-8801", "Organic Butter Lettuce", "CS", "LOT-FD-2025-0847", "______", ""],
        ["E-02-11", "MCG-8802", "Fresh Basil (200g)", "EA", "LOT-FD-2025-0912", "______", ""],
        ["G-01-05", "MCG-9100", "Premium Vanilla Ice Cream 1L", "CS", "LOT-IC-2025-2204", "______", ""],
        ["S-03-02", "MCG-5500", "Wireless Noise-Cancel Headphones", "EA", "N/A", "______", ""],
      ]
    ),

    heading("13. Revision History"),
    dataTable(
      ["Version", "Date", "Author", "Changes", "Approval"],
      [
        ["1.0", "15 Jan 2021", "H. Jansen", "Initial release", "VP Supply Chain"],
        ["1.5", "01 Jul 2021", "H. Jansen", "Added cold chain zone counting procedures", "VP Supply Chain"],
        ["2.0", "01 Jun 2023", "H. Jansen", "Added counter certification levels; expanded RCA requirements", "VP Supply Chain + CFO"],
        ["2.3", "01 Nov 2024", "H. Jansen + A. de Vries", "Updated variance thresholds after Q3 2024 audit; added SAP reconciliation timing guidance", "VP Supply Chain"],
        ["2.4", "01 Mar 2025", "H. Jansen + A. de Vries", "Added RCA root cause frequency table; updated KPIs to include Q3 2025 actuals; added Appendix with sample count sheet; expanded pre-count preparation for security and HAZMAT", "VP Supply Chain + CCO"],
      ]
    ),

    heading("14. Document Approval"),
    ...signatureBlock("Henrik Jansen", "VP Warehouse Operations", "Global Supply Chain Division"),
    ...signatureBlock("Anke de Vries", "Senior Inventory Control Analyst", "Inventory Control Team"),
    ...signatureBlock("Thomas Brennan", "VP Supply Chain", "Executive Approval"),
  ]);
}

// ══════════════════════════════════════════════════════════════
// SOP-SC-001: Product Recall Procedure (ENRICHED)
// ══════════════════════════════════════════════════════════════
function sopSC001() {
  return buildDocument("STANDARD OPERATING PROCEDURE", [
    heading("SOP-SC-001: Product Recall Procedure"),
    metadataTable([
      ["Document ID", "SOP-SC-001"],
      ["Version", "4.0"],
      ["Effective Date", "01 September 2025"],
      ["Last Reviewed", "15 August 2025"],
      ["Next Review Due", "01 March 2026"],
      ["Owner", "Dr. Elena Vasquez, Chief Compliance Officer"],
      ["Co-Author", "Thomas Brennan, VP Supply Chain"],
      ["Classification", "Internal — Critical: All Supply Chain, Store, and Customer Service Personnel"],
      ["Regulatory Basis", "EU Regulation (EC) No 178/2002, Articles 18 & 19; RASFF Procedures; NVWA Guidelines 2024"],
      ["Training Required", "Annual Recall Readiness Drill; Role-specific training per Section 12"],
    ]),

    heading("1. Purpose"),
    para("This procedure defines the end-to-end process for executing product recalls across all MCG channels — retail stores (1,140 locations in 23 countries), e-commerce (meridiancommerce.com serving 38 countries), and wholesale/B2B. It is designed to meet the 24-hour regulatory traceability requirement mandated by EU food safety law and covers both voluntary and regulatory-mandated recalls across all product categories."),
    calloutBox("CRITICAL LESSONS LEARNED: This SOP was substantially rewritten in v4.0 following the June 2025 organic butter lettuce recall (RCL-2025-003). That recall exposed systemic failures in MCG's traceability infrastructure: it took 11 days and 65 person-hours of manual cross-referencing across 4 disconnected systems to complete full product tracing — 10 days beyond the 24-hour regulatory target. The NVWA issued formal citation NVWA-2025-CIT-04412 as a result. Every section of this SOP now incorporates corrective measures from that incident.", "critical"),

    heading("2. Scope"),
    para("This procedure applies to:"),
    para("All product categories sold by MCG: fresh produce, dairy, frozen goods, beverages, electronics, apparel, home goods, health & wellness, pharmaceuticals/supplements", { bullet: true }),
    para("All channels: brick-and-mortar retail (Meridian Market, MCG Express), e-commerce, wholesale/B2B, marketplace channels", { bullet: true }),
    para("All geographies: EU-27, UK, Americas, APAC, LATAM, Africa", { bullet: true }),
    para("Both voluntary recalls (MCG-initiated) and mandatory recalls (regulatory authority-mandated)", { bullet: true }),
    para("Product withdrawals (removal from sale, no customer notification) and full recalls (removal from sale + customer notification + return/refund)", { bullet: true }),

    heading("3. Recall Classification"),
    dataTable(
      ["Class", "Definition", "Examples", "Response Time", "Decision Authority", "Regulatory Notification"],
      [
        ["Class I", "Reasonable probability of serious adverse health consequences or death", "Listeria in ready-to-eat food; allergen mislabeling; electrical fault causing fire risk; toxic substance contamination", "Immediate activation (< 2 hours from trigger to team assembly)", "CEO + CCO jointly", "Within 24 hours to all relevant authorities"],
        ["Class II", "Product may cause temporary or medically reversible adverse health consequences, or where the probability of serious consequences is remote", "Salmonella in raw product (cooking kills bacteria); minor allergen cross-contamination below clinical threshold; cosmetic defect in pharmaceutical packaging", "< 24 hours from trigger to team assembly", "CCO + VP Supply Chain", "Within 48 hours"],
        ["Class III", "Product is unlikely to cause adverse health consequences but violates regulatory standards or labeling requirements", "Incorrect nutritional labeling; missing country of origin; packaging text in wrong language; product past best-before date but not safety-critical", "< 72 hours from trigger to team assembly", "VP Supply Chain", "Within 72 hours (or per specific regulation)"],
      ]
    ),

    heading("4. Recall Trigger Sources"),
    para("A recall may be triggered by any of the following:"),
    dataTable(
      ["Trigger Source", "Example", "Initial Contact Point", "Typical Response"],
      [
        ["Supplier notification", "Supplier discovers contamination in their production line", "Procurement Manager", "Verify affected lots, assess MCG exposure"],
        ["Regulatory authority alert", "NVWA, FDA, EFSA issues recall order or RASFF notification", "CCO / Legal", "Mandatory compliance; immediate activation"],
        ["Internal QC finding", "MCG lab testing detects contamination or defect", "Quality Manager", "Assess severity; determine recall class"],
        ["Customer complaint cluster", "3+ complaints about same product issue within 7 days", "Head of Customer Service (Lisa Park)", "Investigate pattern; assess health/safety risk"],
        ["Media / social media report", "News report or viral social media post about product safety issue", "Communications Director", "Verify claim; assess impact; prepare response"],
        ["Third-party lab / testing org", "Independent testing organization publishes adverse findings", "CCO / Legal", "Verify methodology; assess MCG product match"],
        ["Store employee report", "Store staff observes product quality issue (mold, off-odor, damage)", "Store Manager → Regional Operations", "Photograph evidence; quarantine affected stock"],
      ]
    ),

    heading("5. Recall Response Team"),
    para("Upon recall activation, the Recall Response Team (RRT) must be assembled within the timeline specified by the recall class:"),
    dataTable(
      ["Role", "Name (Current)", "Responsibility", "Backup"],
      [
        ["Recall Lead", "Dr. Elena Vasquez, CCO", "Overall recall execution; regulatory liaison; final decisions", "General Counsel"],
        ["Supply Chain Lead", "Thomas Brennan, VP Supply Chain", "Product identification; DC inventory quarantine; in-transit shipment interception", "Director of Logistics, EU"],
        ["Warehouse Operations Lead", "Henrik Jansen, VP Warehouse Ops", "DC-level stock pull; lot-level inventory search across all WMS instances", "DC Operations Director"],
        ["E-Commerce Lead", "Head of E-Commerce", "Website product removal; order cancellation for affected products; e-commerce customer notification", "E-Commerce Operations Manager"],
        ["Customer Service Lead", "Lisa Park, Head of Customer Experience", "Customer notification execution; call center briefing; WISMO re-routing for recall-affected orders", "CS Operations Manager"],
        ["Store Operations Lead", "Regional VP (affected region)", "Store-level product pull; shelf clearance verification; store staff briefing", "District Managers (chain of command)"],
        ["Legal Counsel", "MCG Legal Department", "Regulatory filing; liability assessment; media statement review", "External counsel (Baker McKenzie)"],
        ["Communications Director", "MCG Communications", "Press statements; social media monitoring; internal communications", "PR Agency (retained)"],
        ["IT/Data Lead", "Priya Ramanathan, CDO", "Data extraction for traceability; system support for affected lot identification", "Head of Data Engineering"],
        ["Finance", "CFO Office representative", "Cost tracking; insurance notification; financial impact assessment", "Financial Controller"],
      ]
    ),

    heading("6. Traceability Execution — The Critical Path"),
    para("The most time-critical element of any recall is identifying ALL affected inventory across the entire supply chain. MCG's current traceability capability requires cross-referencing 4 disconnected systems:"),

    heading("6.1 System-by-System Trace Procedure", 2),
    numberedItem(1, "SAP ERP — Purchase Order Receipts and Supplier Lot Linkage:"),
    para("Transaction: MB51 (Material Document List) filtered by material number and lot number", { bullet: true }),
    para("Output: All PO receipts for the affected product/lot, with supplier, receipt date, DC location, and quantity", { bullet: true }),
    para("Known limitation: Supplier names may not match across systems (Nightmare #3). Use Supplier Cross-Reference Guide.", { bullet: true }),
    para("Known limitation: If the receipt occurred during a pipeline failure window, the data may be stale or incomplete. Cross-reference with WMS.", { bullet: true }),

    numberedItem(2, "WMS (Oracle/Manhattan) — Current Warehouse Inventory by Lot:"),
    para("Oracle WMS: Inventory Inquiry > Filter by Item + Lot. Shows current on-hand by location, zone, and lot.", { bullet: true }),
    para("Manhattan WMS: Inventory > Search > Material + Lot Number. Shows current positions.", { bullet: true }),
    para("Known limitation: WMS and SAP may show different quantities if CDC sync is delayed or failed. ALWAYS use WMS as the authoritative source for physical inventory.", { bullet: true }),
    para("Known limitation: Only 93% of food product receipts have lot numbers captured (improving from 85% pre-NVWA citation). For the 7% without lot numbers, a broader product-level (rather than lot-level) search is required.", { bullet: true }),

    numberedItem(3, "Descartes TMS — In-Transit Shipment Details:"),
    para("TMS Shipment Search: Filter by origin DC, product code, and date range.", { bullet: true }),
    para("Output: All in-transit shipments containing the affected product. Includes: carrier, tracking number, destination, expected delivery date.", { bullet: true }),
    para("Known limitation: 42% of shipments have missing tracking numbers (Nightmare #6). For these, carrier contact is required for manual verification.", { bullet: true }),

    numberedItem(4, "Salesforce Commerce Cloud — Customer Orders with Affected SKUs:"),
    para("SOQL query on MCG_Order__c: Filter by product SKU and order date range.", { bullet: true }),
    para("Output: All customer orders containing the affected product, with delivery address, order status, and tracking information.", { bullet: true }),
    para("Known limitation: Salesforce order records do not contain lot-level information. The link between customer order → specific lot requires cross-referencing order date + fulfillment DC + lot availability at time of pick.", { bullet: true }),

    calloutBox("CURRENT GAP — NO UNIFIED TRACEABILITY KEY: These four systems are not linked by a common lot-level traceability key. During the June 2025 lettuce recall, this required 65 person-hours of manual cross-referencing involving 28 hours in SAP, 15 hours in WMS, 18 hours on physical store audits, and 4 hours of IT data extraction support. Project CLARITY Phase 1 will create a unified data layer connecting all 4 systems with a common traceability key. Until then, the manual process described above is the ONLY reliable method.", "critical"),

    heading("6.2 Traceability Completeness Verification", 2),
    para("The Recall Lead must verify that the following inventory categories are ALL accounted for:"),
    dataTable(
      ["Inventory Category", "System", "Verification Method", "Current Capability"],
      [
        ["In DC (on-hand)", "WMS", "Lot-level inventory search", "93% lot-tracked"],
        ["In transit (DC to store)", "Descartes TMS", "Shipment search by product", "58% have tracking data"],
        ["In transit (DC to customer - e-com)", "Descartes + Salesforce", "Order + shipment cross-reference", "Variable by carrier"],
        ["On store shelves", "POS / store inventory system", "Store-level lot search OR physical audit", "32% stores have lot tracking ⚠"],
        ["In customer hands (delivered)", "Salesforce", "Customer order history", "Lot link indirect (date/DC match)"],
        ["At supplier (unshipped)", "SAP + Supplier contact", "Open PO check + supplier verification", "Manual process"],
        ["Returns in process", "WMS + Salesforce", "Return receipt search by SKU", "No lot link on returns ⚠"],
      ]
    ),

    heading("7. Store-Level Actions"),
    numberedItem(1, "Recall notification pushed to all affected stores via the MCG Alert System (mobile push + email + POS pop-up). Notification includes: recall reference number, affected product description, affected lot numbers (if available), product image, and required action."),
    numberedItem(2, "Store managers pull ALL affected products from shelves within 2 hours of notification (Class I) or 24 hours (Class II/III)."),
    numberedItem(3, "Pulled inventory recorded in POS system with reason code 'RECALL-[recall ID]'. For stores WITH lot-level tracking (32%), record the lot number. For stores WITHOUT lot-level tracking (68%), pull ALL units of the affected SKU regardless of lot."),
    numberedItem(4, "Photographic evidence of shelf clearance submitted via the MCG Store Ops mobile app within 1 hour of completion. Photo must show: (a) empty shelf location, (b) pulled product in quarantine area, (c) quarantine label applied."),
    numberedItem(5, "Quarantined product held in store backroom with 'DO NOT SELL — RECALL' label until disposition instructions received from the Recall Lead."),
    numberedItem(6, "Store acknowledgment of recall completion must be recorded in the MCG Alert System. Stores that have not acknowledged within the required timeframe are escalated to the District Manager."),
    calloutBox("PERFORMANCE GAP: During the June lettuce recall, only 32% of stores could identify recalled product by lot number. The remaining 68% had to conduct physical shelf audits and pull ALL lettuce regardless of lot, increasing the scope and cost of the recall significantly. Store-level lot tracking deployment is a corrective action under COMP-2025-NVWA, with 78% completion as of September 2025 and a target of 90% by March 2026.", "warning"),

    heading("8. Customer Notification (E-Commerce)"),
    para("For e-commerce orders containing recalled products:"),
    numberedItem(1, "Customer Service team generates the affected customer list from Salesforce (SOQL query by product SKU + order date range + delivery status)."),
    numberedItem(2, "Customer segmentation for notification:"),
    para("Delivered orders: Full recall notification with return/refund instructions", { bullet: true }),
    para("In-transit orders: Carrier intercept attempted. If intercept fails, customer notified upon delivery.", { bullet: true }),
    para("Unfulfilled orders: Order cancelled with apology + full refund + courtesy credit", { bullet: true }),
    numberedItem(3, "Automated email notification sent within:"),
    para("Class I: 4 hours of recall activation", { bullet: true }),
    para("Class II: 24 hours", { bullet: true }),
    para("Class III: 72 hours", { bullet: true }),
    numberedItem(4, "Notification includes: product name and image, reason for recall (consumer-friendly language, reviewed by Legal), return/disposal instructions, refund/credit offer, customer service contact for questions."),
    numberedItem(5, "Refund or replacement processed automatically for all affected orders. Customer does NOT need to initiate the return for Class I recalls."),
    numberedItem(6, "WISMO-trained agents briefed on recall-specific FAQs within 2 hours of recall activation (template FAQ document maintained by Customer Service)."),
    numberedItem(7, "Dedicated recall phone line and email address activated for customer inquiries: recall@meridiancommerce.com, +31 10 798 4999."),

    heading("9. Regulatory Reporting"),
    heading("9.1 EU Markets", 2),
    numberedItem(1, "NVWA notification (Netherlands) within 24 hours via the NVWA Portal. Contact: MCG's registered food safety officer (Dr. Elena Vasquez)."),
    numberedItem(2, "RASFF notification filed through the national contact point. The RASFF alert triggers automatic notification to all EU member state food safety authorities."),
    numberedItem(3, "Complete traceability report submitted to NVWA within 72 hours. Report must include: affected lots, quantities, distribution list (stores + customers), supplier information including sub-tier (if food), and containment actions taken."),
    numberedItem(4, "Corrective action plan filed within 30 days."),
    numberedItem(5, "For food products: Maintain all traceability documentation for minimum 5 years per EU Regulation 178/2002."),

    heading("9.2 Americas Markets", 2),
    numberedItem(1, "FDA notification (US) within 24 hours via the FDA Reportable Food Registry (RFR) for food products, or via CPSC SaferProducts.gov for non-food products."),
    numberedItem(2, "Health Canada notification for Canadian distribution."),
    numberedItem(3, "ANVISA notification for Brazilian distribution."),

    heading("9.3 APAC Markets", 2),
    para("SFA (Singapore Food Agency), TGA (Australia), KFDA (South Korea) as applicable per distribution."),

    heading("10. Post-Recall Review"),
    para("Within 14 calendar days of recall closure, the Recall Response Team must complete a Post-Recall Review meeting. The following must be documented:"),
    numberedItem(1, "Full timeline reconstruction: trigger → activation → traceability → containment → completion. Actual vs target timeline at each stage."),
    numberedItem(2, "Root cause analysis: What caused the product safety issue? What was the source?"),
    numberedItem(3, "Traceability gap analysis: Where did the tracing process break down? Which systems lacked the data needed? How long did each system trace take?"),
    numberedItem(4, "Cost analysis: Direct costs (product destruction, refunds, labor) + indirect costs (brand impact, regulatory penalties, legal)."),
    numberedItem(5, "Corrective action recommendations: What must change to prevent recurrence and improve response time?"),
    numberedItem(6, "SOP revision: Does this SOP need to be updated based on lessons learned?"),
    numberedItem(7, "Regulatory follow-up: Are there outstanding corrective action requirements from regulatory authorities?"),

    heading("11. Annual Recall Readiness Drill"),
    para("MCG conducts an annual recall simulation exercise ('Recall Readiness Drill') to test the effectiveness of this procedure. The drill:"),
    para("Uses a realistic but fictional scenario (previous drills: contaminated honey, allergen mislabeling in ready-meals, electrical fault in smart home devices)", { bullet: true }),
    para("Tests end-to-end execution across all RRT functions", { bullet: true }),
    para("Measures traceability time against the 24-hour target", { bullet: true }),
    para("Identifies gaps in training, system access, and communication", { bullet: true }),
    para("Results in a Drill After-Action Report with improvement recommendations", { bullet: true }),
    para("Next drill scheduled: Q4 2025 (scenario TBD by CCO).", { bold: true }),

    heading("12. Training Requirements"),
    dataTable(
      ["Role", "Training Module", "Frequency"],
      [
        ["All Recall Response Team members", "Recall Readiness Drill participation", "Annual"],
        ["Store Managers", "Recall Notification Response — store-level actions", "Annual + upon SOP revision"],
        ["Customer Service Agents", "Recall FAQ handling; WISMO recall routing", "Annual + upon each recall activation"],
        ["Procurement / Supplier Management", "Supplier recall notification procedures", "Annual"],
        ["Quality Inspectors", "Product hold and quarantine procedures", "Annual"],
        ["IT / Data team", "Traceability data extraction procedures", "Annual"],
      ]
    ),

    heading("13. Related Documents"),
    dataTable(
      ["Document ID", "Title"],
      [
        ["RCL-2025-003", "Lettuce Recall — Full incident record and traceability timeline"],
        ["COMP-2025-NVWA", "NVWA Corrective Action Plan"],
        ["MCG-POL-007", "EU Food Safety Compliance Policy"],
        ["SUPP-2025-FreshDirect", "Fresh Direct NL Supplier Performance Review (connected to lettuce recall)"],
        ["SOP-WH-001", "Goods Receiving Procedure (lot number capture requirements)"],
        ["PROJ-CLARITY-2025", "Project CLARITY Business Case (unified traceability solution)"],
      ]
    ),

    heading("14. Revision History"),
    dataTable(
      ["Version", "Date", "Author", "Changes"],
      [
        ["1.0", "01 May 2019", "Legal Dept", "Initial release"],
        ["2.0", "15 Mar 2021", "E. Vasquez", "Added EU regulatory reporting requirements; RASFF procedures"],
        ["3.0", "10 Jan 2024", "E. Vasquez", "Updated recall classification per NVWA 2024 guidance; added Americas/APAC reporting"],
        ["4.0", "01 Sep 2025", "E. Vasquez + T. Brennan", "MAJOR REVISION post lettuce recall: Added detailed 4-system traceability procedure; store lot tracking gap documentation; customer notification segmentation; annual drill requirement; expanded RRT membership; post-recall review template"],
      ]
    ),

    heading("15. Document Approval"),
    ...signatureBlock("Dr. Elena Vasquez", "Chief Compliance Officer", "Legal & Compliance Division"),
    ...signatureBlock("Thomas Brennan", "VP Supply Chain", "Global Supply Chain Division"),
    ...signatureBlock("Ingrid van der Berg", "Chief Executive Officer", "Executive Approval"),
  ]);
}

// ══════════════════════════════════════════════════════════════
// SOP-SC-002: Cold Chain Monitoring (ENRICHED)
// ══════════════════════════════════════════════════════════════
function sopSC002() {
  return buildDocument("STANDARD OPERATING PROCEDURE", [
    heading("SOP-SC-002: Cold Chain Monitoring and Exceedance Response"),
    metadataTable([
      ["Document ID", "SOP-SC-002"],
      ["Version", "2.1"],
      ["Effective Date", "01 June 2025"],
      ["Last Reviewed", "01 September 2025"],
      ["Next Review Due", "01 March 2026"],
      ["Owner", "Thomas Brennan, VP Supply Chain"],
      ["Co-Author", "Dr. Michael Torres, Cold Chain Director"],
      ["Classification", "Internal — Supply Chain, Warehouse, Logistics, Carrier Partners"],
      ["References", "MCG-POL-012: Cold Chain Management Policy; TRN-2025-002; INC-2025-05102"],
      ["Training Required", "TRN-2025-002 for all cold chain handlers; Annual refresher"],
    ]),

    heading("1. Purpose"),
    para("This procedure defines the monitoring, alerting, and response protocols for maintaining cold chain integrity across MCG's perishable supply chain — from supplier dispatch through warehouse storage and last-mile delivery to the customer's door. Compliance ensures product safety, regulatory adherence, and minimization of spoilage losses."),
    calloutBox("FINANCIAL CONTEXT: Cold chain failures cost MCG $48M+ annually in spoilage, with the Q3 2025 LATAM corridor alone contributing $2.48M in a single quarter (INC-2025-05102). Effective cold chain monitoring is not just a food safety requirement — it is a critical cost control measure.", "critical"),

    heading("2. Temperature Requirements by Product Category"),
    dataTable(
      ["Product Category", "Storage Min", "Storage Max", "Transport Min", "Transport Max", "Max Exceedance Before Action", "Sensor Type", "Recording Interval"],
      [
        ["Fresh produce (leafy greens, herbs, berries)", "1°C", "5°C", "1°C", "5°C", "30 min > 8°C", "Tive Solo 5G", "5 min"],
        ["Root vegetables, hardy produce", "4°C", "10°C", "4°C", "10°C", "60 min > 12°C", "Tive Solo 5G", "5 min"],
        ["Dairy (milk, cheese, yogurt, butter)", "2°C", "6°C", "2°C", "6°C", "15 min > 8°C", "Tive Solo 5G", "5 min"],
        ["Frozen goods (ice cream, frozen meals, frozen produce)", "-25°C", "-18°C", "-22°C", "-18°C", "ANY time > -15°C (zero tolerance for thaw)", "Tive Solo 5G", "5 min"],
        ["Chilled beverages (juices, smoothies)", "3°C", "7°C", "3°C", "7°C", "60 min > 10°C", "Tive Solo 5G", "10 min"],
        ["Pharmaceuticals / health supplements (cold chain)", "2°C", "8°C", "2°C", "8°C", "0 min outside range (zero tolerance)", "Sensitech TempTale Ultra", "2 min"],
        ["Eggs", "5°C", "12°C", "5°C", "12°C", "60 min > 15°C", "Tive Solo 5G", "10 min"],
        ["Fresh flowers (seasonal)", "2°C", "5°C", "2°C", "5°C", "30 min > 8°C", "Tive Solo 5G", "10 min"],
      ]
    ),

    heading("3. IoT Sensor Infrastructure"),
    heading("3.1 Regional Coverage", 2),
    dataTable(
      ["Region", "Current Coverage", "FY2026 Target", "Sensor Provider", "Connectivity", "Known Issues"],
      [
        ["EU (NL, DE, BE, FR, ES, IT)", "95%", "99%", "Tive Solo 5G", "4G/5G cellular, 99.5% uptime", "No significant issues"],
        ["Americas (US, CA, MX, BR, AR)", "88%", "95%", "Tive Solo 5G + Sensitech (pharma)", "4G cellular, 98% uptime", "July-Sep 2025 Fahrenheit contamination (see 3.2)"],
        ["APAC (SG, MY, TH, ID, AU)", "85%", "95%", "Tive Solo 5G", "4G cellular, 97% uptime", "10-min intervals (vs 5-min EU) due to data costs"],
        ["LATAM (BR, AR, CL, CO, PE)", "72%", "90%", "Tive Solo 5G", "3G/4G mixed, 92% uptime", "Border crossing blackout zones (Uruguaiana)"],
        ["Africa (NG, KE, ZA, GH)", "45%", "75%", "Tive Solo 5G", "3G, 78% uptime", "Lagos DC: 6-hour daily connectivity blackout ⚠"],
      ]
    ),

    heading("3.2 Known Data Quality Issues", 2),
    calloutBox("AMERICAS FAHRENHEIT CONTAMINATION (ACTIVE — Data remediation in progress): Between July 1 and September 30, 2025, Tive sensors deployed in Americas distribution centers (Atlanta, Dallas, Chicago, Los Angeles, São Paulo, Buenos Aires) were configured to report temperatures in Fahrenheit WITHOUT a unit indicator in the telemetry data stream. This means a reading of '41' in the historical data could be 41°F (= 5°C, which is within range for fresh produce) or could have been entered in a system expecting Celsius (in which case 41 would be a catastrophic failure). Approximately 47,000 telemetry readings from this period are affected. The data remediation team is working with Tive to retroactively apply unit correction based on sensor serial numbers and deployment region. Until remediation is complete, any cold chain analysis using Americas data from Q3 2025 should be flagged as potentially unreliable. All sensors have been reconfigured to Celsius as of October 1, 2025. Reference: MCG-POL-012 Section 4.2; TRN-2025-002 Section 3.", "critical"),

    calloutBox("LAGOS DC CONNECTIVITY BLACKOUT (ACTIVE — Satellite backup budgeted for Q2 2026): The Lagos distribution center (MCG's primary West Africa hub) experiences daily internet connectivity blackouts lasting approximately 6 hours, typically between 11:00 and 17:00 West Africa Time (WAT). During these periods, Tive IoT sensors continue recording temperature data locally (buffered on the sensor's internal storage) but CANNOT transmit to the cloud platform. This means: (a) Temperature exceedances occurring during blackout hours will NOT trigger real-time alerts. Detection is delayed by up to 6 hours until connectivity resumes. (b) The Cold Chain Monitoring Dashboard will show 'Last Updated' timestamps that are hours old during blackout periods — this does NOT mean the cold chain has failed, it means we don't know the current state. (c) During blackout hours, warehouse staff at Lagos DC must perform MANUAL temperature checks every 30 minutes in all cold zones and record readings on paper logs. These are digitized when connectivity resumes. Satellite internet backup (Starlink) has been budgeted for Q2 2026 deployment.", "warning"),

    heading("4. Monitoring Architecture"),
    numberedItem(1, "IoT sensors (Tive Solo 5G or Sensitech TempTale) are attached to each pallet or shipment of temperature-sensitive products at the origin point (supplier dispatch or MCG DC outbound)."),
    numberedItem(2, "Sensors transmit temperature readings at configured intervals (2-10 minutes depending on region and product) to the Tive Cloud platform via cellular connectivity."),
    numberedItem(3, "Tive Cloud forwards telemetry data to MCG's Kafka topic 'cold-chain-telemetry' in real-time via webhook integration."),
    numberedItem(4, "MCG's automated rules engine (currently: custom application; future: Qlik Talend Cloud IoT pipeline) evaluates each reading against the product-specific temperature limits defined in Section 2."),
    numberedItem(5, "If a reading exceeds the defined threshold, the system generates an alert routed to the designated regional Cold Chain Manager via: (a) SMS, (b) email, (c) push notification in the MCG Supply Chain mobile app."),
    numberedItem(6, "Alert includes: Shipment ID, sensor ID, current temperature, threshold temperature, duration of exceedance, GPS location (if available), carrier name, product details, and suggested response action."),
    numberedItem(7, "Cold Chain Manager acknowledges the alert and initiates the response protocol per Section 5."),

    heading("5. Exceedance Response Protocol"),
    dataTable(
      ["Severity", "Condition", "Automated Action", "Human Response", "Timeline", "Documentation"],
      [
        ["Advisory", "Within 1°C of limit and trending toward breach", "Dashboard warning (yellow indicator)", "Cold Chain Manager reviews; contacts carrier if in transit", "Monitor within 30 min", "System log only"],
        ["Warning", "Exceeds limit for < 15 minutes", "SMS alert to Cold Chain Manager", "Contact carrier driver; verify reefer unit operation; monitor for recovery", "Response within 15 min", "Incident log entry"],
        ["Minor Exceedance", "Exceeds limit for 15-30 minutes", "SMS + email alert to Cold Chain Manager + Regional Logistics Manager", "Direct carrier to nearest cold facility for assessment; prepare product inspection team at destination", "Decision within 30 min", "Incident report required within 24h"],
        ["Major Exceedance", "Exceeds limit for 30-60 minutes", "Alert escalated to VP Supply Chain", "Reroute shipment to nearest cold facility; prepare for potential rejection; notify destination DC", "Decision within 15 min", "Full incident report within 24h; carrier claim initiated"],
        ["Critical Exceedance", "Exceeds limit for > 60 minutes OR frozen product shows thaw (any duration above -15°C)", "Alert to VP Supply Chain + Quality Manager", "QUARANTINE shipment. Do NOT deliver to customer or store. Carrier holds at current location or proceeds to nearest MCG facility for controlled disposal. Full investigation initiated.", "Immediate", "Full incident report; carrier claim; spoilage report; regulatory notification if food safety impacted"],
      ]
    ),

    heading("6. Carrier Cold Chain Requirements"),
    para("All carriers transporting MCG temperature-sensitive products must comply with the following requirements (embedded in all carrier MSAs):"),
    numberedItem(1, "Pre-cool ALL transport units to the target product temperature BEFORE loading begins. As of October 2025 (post-TransFrio incident), the pre-cooling requirement is 0°C for chilled products (tightened from previous 2°C standard). The reefer unit must show target temperature for a minimum of 15 minutes before loading doors are opened."),
    numberedItem(2, "Maintain continuous temperature logging throughout transport. Reefer unit temperature logs must be available for MCG inspection upon request."),
    numberedItem(3, "Share real-time telemetry data with MCG. Acceptable methods: (a) Tive sensor on MCG-provided device (preferred), (b) carrier's own telemetry system with API integration to MCG, (c) daily telemetry file upload to MCG SFTP by 06:00 UTC."),
    numberedItem(4, "Do NOT turn off refrigeration units during rest stops, refueling, border waits, or loading/unloading at intermediate stops. Carriers operating on routes with extended border crossings (e.g., Uruguaiana Brazil-Argentina crossing, averaging 4.2 hours in Q3 2025) must have auxiliary power units (APUs) to maintain refrigeration independently of the vehicle engine."),
    numberedItem(5, "Report any temperature exceedance to MCG Cold Chain Manager within 1 hour of detection or within 1 hour of connectivity restoration (for regions with connectivity gaps)."),
    numberedItem(6, "Driver training: All drivers on MCG cold chain routes must complete the carrier-equivalent of TRN-2025-002. MCG provides a training package that carriers may use or substitute with equivalent certified training."),

    heading("7. TransFrio LATAM Incident — Lessons Applied"),
    para("The Q3 2025 TransFrio spoilage incident (INC-2025-05102) resulted in $2.48M in losses on the São Paulo-Buenos Aires corridor. Key lessons incorporated into this SOP:"),
    para("Root cause: TransFrio's new Thermo King X4 7500 fleet had a 15-minute startup time to reach target temperature (vs 3 minutes on old fleet). Drivers loaded cargo during startup. The loading SOP was not updated.", { bullet: true }),
    para("Contributing: Uruguaiana border crossing wait times increased from 1.8h to 4.2h in Q3. Some drivers shut off reefer units to save fuel during the wait.", { bullet: true }),
    para("Systemic: MCG had no system connecting IoT temperature data with carrier fleet/operational data. The pattern was dismissed as 'seasonal heat' for 3 weeks because no one could see the correlation.", { bullet: true }),
    para("Corrective: Pre-cooling requirement tightened to 0°C; APU requirement added; real-time telemetry sharing mandated within 60 days; penalty structure for exceedances implemented.", { bullet: true }),

    heading("8. Revision History"),
    dataTable(
      ["Version", "Date", "Author", "Changes"],
      [
        ["1.0", "01 Apr 2023", "T. Brennan", "Initial release"],
        ["1.5", "01 Oct 2023", "T. Brennan", "Added pharmaceutical cold chain requirements"],
        ["2.0", "15 Jan 2025", "T. Brennan", "Added Africa/APAC coverage details; documented Fahrenheit data issue; expanded severity levels"],
        ["2.1", "01 Jun 2025", "T. Brennan + M. Torres", "Major update post TransFrio incident: tightened pre-cooling to 0°C; added APU requirement; expanded carrier requirements; added monitoring architecture detail; documented Lagos connectivity issue"],
      ]
    ),
    ...signatureBlock("Thomas Brennan", "VP Supply Chain", "Global Supply Chain Division"),
    ...signatureBlock("Dr. Michael Torres", "Cold Chain Director", "Cold Chain Operations"),
  ]);
}

// ══════════════════════════════════════════════════════════════
// SOP-CS-001: WISMO Call Handling (ENRICHED)
// ══════════════════════════════════════════════════════════════
function sopCS001() {
  return buildDocument("STANDARD OPERATING PROCEDURE", [
    heading("SOP-CS-001: WISMO (Where Is My Order/Shipment) Call Handling"),
    metadataTable([
      ["Document ID", "SOP-CS-001"],
      ["Version", "3.0"],
      ["Effective Date", "01 August 2025"],
      ["Last Reviewed", "15 September 2025"],
      ["Next Review Due", "01 February 2026"],
      ["Owner", "Lisa Park, Head of Customer Experience"],
      ["Co-Author", "Regional CS Managers (EU, Americas, APAC, Africa)"],
      ["Classification", "Internal — Customer Service Representatives (all tiers)"],
      ["Volume Context", "536,000 WISMO contacts/month globally (41% of all CS contacts)"],
      ["Cost Context", "$14.8M annual cost at $2.30 per WISMO contact"],
      ["Training Required", "CS Onboarding Module 4 (Order Tracking); Annual WISMO Refresher; System-specific training"],
    ]),

    heading("1. Purpose and Business Context"),
    para("This procedure standardizes the handling of WISMO (Where Is My Order/Shipment) inquiries across all MCG customer service channels — phone, email, chat, social media, and the self-service portal. WISMO contacts represent MCG's single largest category of customer service interactions."),
    heading("1.1 The Scale of the Problem", 2),
    dataTable(
      ["Metric", "Value", "Trend"],
      [
        ["WISMO contacts per month (global)", "536,000", "↑ 12% YoY"],
        ["WISMO as % of all CS contacts", "41%", "↑ from 35% in FY2024"],
        ["Average cost per WISMO contact", "$2.30", "Stable"],
        ["Annual WISMO cost", "$14.8M", "↑ from $12.1M in FY2024"],
        ["Average handling time per WISMO call", "4 min 30 sec", "↑ from 3 min 45 sec"],
        ["First-contact resolution rate (WISMO)", "62%", "↓ from 71% in FY2024 ⚠"],
        ["Repeat WISMO (customer calls 2+ times for same order)", "28%", "↑ from 19% in FY2024 ⚠"],
        ["NPS impact (WISMO callers vs non-callers)", "-18 points", "Worsening"],
      ]
    ),

    heading("1.2 Why WISMO Is So Hard at MCG", 2),
    para("MCG customers currently cannot get a single, clear answer about their order status because:"),
    numberedItem(1, "Order and delivery data lives across 5 separate, disconnected systems — no unified order journey view exists."),
    numberedItem(2, "Carrier tracking data is incomplete: 42% of shipments globally have no tracking number in MCG's systems (Nightmare #6 — Carrier Data Black Hole)."),
    numberedItem(3, "Delivery promise accuracy varies wildly by region: Singapore 69%, EU 87%, Americas 91% — customers call when the promise is broken."),
    numberedItem(4, "Carrier status codes are in multiple languages (German, Dutch, French, English, codes-only) and different formats — agents cannot readily interpret raw carrier statuses."),
    numberedItem(5, "There is no proactive notification system — MCG does not alert customers to delays before the customer notices and calls."),
    calloutBox("SINGAPORE CRISIS (Active): WISMO rate in Singapore reached 52% in Q3 2025 (vs 41% global average) after the NinjaVan contract amendment (AMD3) changed 5-10 kg delivery from 2-day to 3-day service. This change was NOT communicated to the MCG e-commerce team for over 3 weeks. During this period, the website continued promising 2-day delivery, affecting approximately 14,000 customers per month. The delivery promise has been corrected as of October 20, 2025 (MCG-POL-020 v2.1), but trust recovery is ongoing.", "critical"),

    heading("2. System Lookup Sequence"),
    para("For each WISMO inquiry, agents must check systems in the following order. This sequence is optimized for most-likely-to-resolve-first:"),
    dataTable(
      ["Step", "System", "Access Method", "What to Check", "Typical Resolution", "Avg. Time"],
      [
        ["1", "Salesforce Commerce Cloud", "CRM tab (SSO)", "Order status, payment confirmation, fulfillment assignment, delivery promise date", "Order confirmed/processing — give estimated ship date", "45 sec"],
        ["2", "SAP ERP (view-only)", "SAP GUI / Fiori (CS read-only role)", "Warehouse allocation, pick status, stock availability, fulfillment DC location", "Allocated to DC — give estimated ship date from DC", "30 sec"],
        ["3", "WMS (Oracle/Manhattan)", "WMS Web Portal (CS read-only role)", "Pick confirmed, pack confirmed, ship confirmed, tracking number assignment", "Shipped — provide tracking number", "60 sec"],
        ["4", "Descartes TMS", "TMS Portal (CS read-only role)", "Carrier assignment, shipment tracking events, delivery status, POD (proof of delivery)", "In transit — provide last tracking event and ETA", "45 sec"],
        ["5", "Carrier Portal (varies)", "External carrier websites / API lookup tool", "Last-mile tracking detail: driver location, delivery attempt history, re-delivery scheduling", "Last-mile status — provide specific delivery detail", "90 sec"],
      ]
    ),
    para("Total average handling time per WISMO call: 4 minutes 30 seconds (target: < 3 minutes)", { bold: true }),
    calloutBox("MISSING TRACKING NUMBERS: When Step 3 or Step 4 shows NO tracking number (42% of orders globally), the agent must attempt to locate the shipment via the carrier portal using the order date + destination postal code + weight band. This adds 5-8 minutes to the call. If the carrier portal also shows no match, the agent must contact the carrier's MCG account representative directly. Carrier contact details are in the Carrier Directory (SharePoint > Supply Chain > Carrier Contacts > Carrier_Directory_2025.xlsx).", "warning"),

    heading("3. Response Scripts by Status"),
    heading("3.1 Order Confirmed, Not Yet Shipped", 2),
    para("Script: \"Thank you for contacting us about your order [ORDER-ID], placed on [DATE]. I can see your order has been confirmed and payment processed successfully. It's currently being prepared at our [CITY] fulfillment center. Based on your selected delivery option ([CARRIER] [SERVICE]), you should expect your package to ship within [X] business days, with delivery by [PROMISE-DATE].\""),
    para("If behind schedule: \"I can see your order is taking a bit longer than expected to ship. Let me check what's happening... [Check SAP for allocation status]. I apologize for the delay — [provide specific reason if available: 'the item is being picked from our warehouse now' / 'there's been a slight delay in processing' / etc.]. I expect it to ship by [REVISED DATE]. Would you like me to send you an email notification when it ships?\""),

    heading("3.2 Shipped, Tracking Available", 2),
    para("Script: \"Great news — your order [ORDER-ID] shipped on [DATE] via [CARRIER]. Your tracking number is [TRACKING]. Based on the latest tracking update from [TIME/DATE], your package is currently [STATUS — translated to plain English] and the estimated delivery is [DATE]. Would you like me to text or email you the tracking link so you can follow along?\""),
    para("Translation guide for common carrier statuses:"),
    dataTable(
      ["Carrier Status (Raw)", "Language", "Customer-Friendly Translation"],
      [
        ["Zugestellt", "German (DPD DE)", "\"Your package has been delivered\""],
        ["Bezorgd", "Dutch (DPD NL)", "\"Your package has been delivered\""],
        ["Livré", "French (DPD FR/BE)", "\"Your package has been delivered\""],
        ["In Zustellung", "German (DPD DE)", "\"Your package is out for delivery today\""],
        ["In bezorging", "Dutch (DPD NL)", "\"Your package is out for delivery today\""],
        ["Paketankündigung", "German (DPD DE)", "\"Your package label has been created and it's being prepared for shipping\""],
        ["Nicht zustellbar", "German (DPD DE)", "\"There was an issue delivering your package — I'll look into this right now\""],
        ["Niet bezorgbaar", "Dutch (DPD NL)", "\"There was an issue delivering your package — I'll look into this right now\""],
        ["DLVRD", "Code (Lagos carriers)", "\"Your package has been delivered\""],
        ["Completed", "English (NinjaVan)", "\"Your package has been delivered\""],
      ]
    ),

    heading("3.3 Shipped, No Tracking Available", 2),
    para("Script: \"Your order [ORDER-ID] shipped on [DATE] via [CARRIER]. I don't have real-time tracking available for this shipment just yet — I apologize for the inconvenience. Let me check with the carrier directly to get you an update...\""),
    para("Actions:"),
    para("If carrier portal has tracking: Provide the update and offer to send tracking link", { bullet: true }),
    para("If carrier portal has NO tracking: \"I'm working with our logistics team to get you a status update. I'll follow up with you by [email/phone] within [4 hours for domestic / 24 hours for international]. May I have your preferred contact method?\"", { bullet: true }),
    para("Log the interaction with tag 'WISMO-NO-TRACK' for reporting. This data feeds the Carrier Data Black Hole metrics.", { bullet: true }),

    heading("3.4 Delivery Delayed Beyond Promise", 2),
    para("Script: \"I sincerely apologize — I can see your order was expected to arrive by [PROMISE-DATE] and it hasn't arrived yet. I completely understand your frustration, and I'm going to look into this right now to get you answers.\""),
    para("[Check all 5 systems to identify where the delay occurred]"),
    para("If carrier shows delay: \"It looks like [CARRIER] experienced a delay [provide reason if available: 'due to high volume in their network' / 'due to an address issue' / 'due to a failed delivery attempt']. Based on the latest update, your revised estimated delivery is [DATE].\""),
    para("Offer proactive resolution:"),
    para("Delay 1-2 days past promise: Apologize, provide revised ETA, offer to set up delivery notification", { bullet: true }),
    para("Delay 3-5 days past promise: Apologize, provide revised ETA, offer 10% discount code for next order", { bullet: true }),
    para("Delay > 5 days past promise: Apologize, issue proactive refund OR express re-ship at no cost (agent authority up to $100; supervisor approval above $100)", { bullet: true }),

    heading("3.5 Customer Claims Non-Delivery (Carrier Shows Delivered)", 2),
    para("Script: \"I'm sorry to hear you haven't received your package. Our carrier records show it was marked as delivered on [DATE] at [TIME]. Let me look into this further for you.\""),
    para("Actions:"),
    numberedItem(1, "Verify delivery address matches order address. Check for address quality issues (truncated street name, misspelling — common per Nightmare #2)."),
    numberedItem(2, "Check if carrier has proof of delivery (POD): photo, signature, GPS coordinates."),
    numberedItem(3, "If POD available: Share with customer (if photo available). Ask if a neighbor or building manager may have accepted the delivery."),
    numberedItem(4, "If no POD: Open carrier investigation. Create case in Salesforce with type 'NON-DELIVERY-INVESTIGATION'. SLA: carrier must respond within 24 hours."),
    numberedItem(5, "If investigation inconclusive after 48 hours: Issue replacement or full refund at customer's choice. The cost is charged back to the carrier per MSA terms."),

    heading("4. Regional Considerations"),
    dataTable(
      ["Region", "WISMO Rate", "Primary Issue", "Special Handling", "Key Carrier(s)"],
      [
        ["EU (NL, DE, BE, FR)", "38%", "DPD multi-language statuses; address truncation in DE", "Use status translation table (Section 3.2); check address quality for 'Hauptstr' type truncations", "DPD Classic, DPD Express, DPD Predict"],
        ["EU (other)", "41%", "Cross-border transit visibility gaps", "Check TMS for border transit updates; expect longer transit for Southern/Eastern EU", "DPD International"],
        ["Americas (US)", "35%", "FedEx dimensional weight disputes; rural delivery delays", "Reference CARRIER-FEDEX-2025 rate card for weight disputes; extended delivery for Zone 7-8", "FedEx Ground, FedEx Express"],
        ["Americas (LATAM)", "44%", "Carrier connectivity gaps; border crossing delays", "Set broader delivery windows; explain potential customs delay", "TransFrio (cold), local carriers"],
        ["APAC (Singapore)", "52% ⚠", "NinjaVan SLA mismatch (5-10 kg)", "Acknowledge 3-day (not 2-day) delivery for 5-10 kg. If customer ordered before Oct 20, apply the previous 2-day promise and offer resolution.", "NinjaVan Express, NinjaVan Standard"],
        ["APAC (other)", "39%", "Variable carrier quality; limited tracking", "Wider delivery window expectations", "Various regional carriers"],
        ["Africa (Lagos)", "61% ⚠", "Limited carrier tracking; connectivity gaps at DC", "Set expectation: tracking may be delayed; delivery windows are estimates. Offer to call back with update within 24h.", "Local carriers (limited tracking)"],
      ]
    ),

    heading("5. Escalation Matrix"),
    dataTable(
      ["Scenario", "Tier 1 Agent Action", "Escalation To", "SLA"],
      [
        ["No tracking after 48 hours from ship date", "Attempt carrier portal lookup; if no result, escalate", "Logistics Team (internal ticket)", "4-hour response"],
        ["Delivery > 3 days past promise (domestic)", "Apologize + discount code; if > 5 days, escalate", "CS Supervisor → Logistics", "24-hour resolution"],
        ["Delivery > 5 days past promise (any region)", "Issue proactive refund or re-ship", "Agent authority up to $100; Supervisor above", "Immediate"],
        ["Customer claims non-delivery (carrier shows delivered)", "Verify address + POD; open investigation", "Carrier Claims Team", "24-hour carrier response; 48-hour resolution"],
        ["Repeat WISMO (3+ calls same order)", "Assign dedicated case owner", "CS Team Lead → dedicated resolution", "Immediate assignment; 24-hour update"],
        ["Pattern detected (multiple customers, same carrier/route)", "Log observation; note in daily team huddle", "CS Manager → Logistics Manager", "End of day"],
        ["Customer threatening social media / media escalation", "Empathize; offer maximum authority resolution", "CS Manager → Communications Director", "Immediate"],
      ]
    ),

    heading("6. Self-Service Deflection (Reducing WISMO Volume)"),
    para("The following self-service channels exist to reduce WISMO call volume. Agents should educate customers about these options at the END of every WISMO call:"),
    para("meridiancommerce.com/track — Order tracking page (requires order number + email). Coverage: 58% of orders (those with tracking numbers).", { bullet: true }),
    para("MCG mobile app — Push notification for ship and delivery events. Current adoption: 22% of customers.", { bullet: true }),
    para("Proactive email notifications — Ship confirmation and delivery confirmation emails. Current opt-in rate: 78%.", { bullet: true }),
    para("SMS tracking — Available in EU and Americas (carrier-dependent). Opt-in via checkout or MCG account settings.", { bullet: true }),
    calloutBox("TARGET: Project CLARITY Phase 3 includes a unified order tracking experience powered by Qlik Answers, where customers can ask 'where is my order?' in natural language and get a real-time answer pulling from all 5 systems. This is projected to reduce WISMO volume by 40% ($5.9M annual savings). Target launch: 18-24 months.", "info"),

    heading("7. Revision History"),
    dataTable(
      ["Version", "Date", "Author", "Changes"],
      [
        ["1.0", "15 Jan 2022", "L. Park", "Initial release"],
        ["2.0", "01 Mar 2024", "L. Park", "Added 5-system lookup sequence; expanded scripts; added regional tables"],
        ["3.0", "01 Aug 2025", "L. Park", "Major update: Singapore NinjaVan handling; carrier status translation table; escalation matrix; self-service deflection strategy; updated volume/cost data to FY2025"],
      ]
    ),
    ...signatureBlock("Lisa Park", "Head of Customer Experience", "Customer Service Division"),
    ...signatureBlock("Thomas Brennan", "VP Supply Chain", "Cross-functional approval"),
  ]);
}

// ─── RUN ───
async function main() {
  console.log("Generating ENRICHED SOP documents...");
  await saveDocument(sopWH001(), path.join(OUT, "SOP-WH-001_Goods_Receiving_Procedure.docx"));
  await saveDocument(sopWH002(), path.join(OUT, "SOP-WH-002_Cycle_Count_Procedure.docx"));
  await saveDocument(sopSC001(), path.join(OUT, "SOP-SC-001_Product_Recall_Procedure.docx"));
  await saveDocument(sopSC002(), path.join(OUT, "SOP-SC-002_Cold_Chain_Monitoring.docx"));
  await saveDocument(sopCS001(), path.join(OUT, "SOP-CS-001_WISMO_Call_Handling.docx"));
  console.log("✅ All 5 enriched SOPs generated.");
}

main().catch(console.error);
