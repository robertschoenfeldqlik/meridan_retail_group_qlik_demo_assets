// Generate ENRICHED Carrier Contracts — 10-15 page enterprise-grade documents
const {
  buildDocument, saveDocument,
  metadataTable, dataTable,
  heading, para, labelValue, calloutBox, numberedItem, signatureBlock,
} = require("./mcg-docx-builder");
const path = require("path");
const { deck, doc, DOCS_DIR } = require("./lib/asset-paths");

const CARRIERS = doc("carrier_contracts");

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT 1: NinjaVan Singapore — Contract Amendment AMD3
// ═══════════════════════════════════════════════════════════════════════════════
function carrierNV() {
  return buildDocument("CONTRACT AMENDMENT", [

    // ── TITLE & METADATA ──
    heading("NinjaVan Singapore — Contract Amendment AMD3"),
    para("Master Service Agreement Amendment", { bold: true, size: 24, color: "6B7280" }),
    metadataTable([
      ["Document ID", "CARRIER-NV-2025"],
      ["Amendment Number", "AMD3 (Third Amendment)"],
      ["Master Agreement", "MSA-2023-NV-SG-001"],
      ["Effective Date", "01 October 2025"],
      ["Previous Amendment", "AMD2 — 15 March 2024 (rate adjustment)"],
      ["MCG Entity", "Meridian Commerce Group Pte. Ltd. (UEN 201912345A)"],
      ["Carrier Entity", "NinjaVan Pte. Ltd. (UEN 201401234B)"],
      ["MCG Contact", "Wei Lin Tan, Regional Logistics Manager APAC"],
      ["NinjaVan Contact", "James Chua, Enterprise Account Director"],
      ["Document Classification", "CONFIDENTIAL — Commercial Terms"],
      ["Status", "EXECUTED — Signed by both parties 18 September 2025"],
    ]),

    // ── AMENDMENT HISTORY ──
    heading("Amendment History"),
    dataTable(
      ["Amd #", "Date", "Description", "Authorized By"],
      [
        ["Original", "01 Apr 2023", "Master Service Agreement execution — 3-year term", "R. Hartono / L. Ng"],
        ["AMD1", "01 Oct 2023", "Addition of bulky item service tier (>30 kg); weekend delivery surcharge schedule", "W.L. Tan / J. Chua"],
        ["AMD2", "15 Mar 2024", "Annual rate adjustment (+3.2% CPI-indexed); updated insurance coverage", "W.L. Tan / J. Chua"],
        ["AMD3", "01 Oct 2025", "Service level reclassification: 5-10 kg parcels moved from 2-day to 3-day (Standard tier)", "W.L. Tan / J. Chua"],
      ]
    ),

    // ── SECTION 1: DEFINITIONS ──
    heading("1. Definitions"),
    para("For the purposes of this Amendment, the following terms shall have the meanings set forth below. Capitalized terms not defined herein shall have the meanings assigned to them in the Master Agreement."),
    para('"Business Day" means any day other than a Saturday, Sunday, or gazetted public holiday in the Republic of Singapore.'),
    para('"Delivery Attempt" means a documented attempt by the Carrier to deliver a Parcel to the Consignee at the designated delivery address, evidenced by a tracking scan event.'),
    para('"Express Tier" means the service level providing next-business-day delivery for parcels weighing 0-5 kg within Singapore.'),
    para('"First-Attempt Delivery Rate" means the percentage of Parcels successfully delivered on the first Delivery Attempt, calculated monthly.'),
    para('"On-Time Delivery" means delivery completed within the SLA window applicable to the Parcel weight band and service tier.'),
    para('"Parcel" means any package tendered by MCG to the Carrier for delivery under this Agreement.'),
    para('"SLA Window" means the maximum number of Business Days permitted between Carrier receipt of a Parcel and successful delivery.'),
    para('"Standard Tier" means the service level providing delivery within the SLA windows specified in Schedule A for parcels in the applicable weight bands.'),
    para('"Tracking Event" means a timestamped status update transmitted by the Carrier to MCG via the agreed API or data feed, including but not limited to: picked up, in transit, out for delivery, delivered, and delivery failed.'),
    para('"WISMO" means "Where Is My Order" — a customer inquiry regarding the status of an order that has been dispatched but not confirmed delivered.'),
    para('"WISMO Rate" means the percentage of dispatched orders that generate at least one WISMO inquiry within the applicable SLA window, measured monthly.'),

    // ── SECTION 2: BACKGROUND AND RECITALS ──
    heading("2. Background and Recitals"),
    para("2.1. MCG and NinjaVan entered into the Master Service Agreement MSA-2023-NV-SG-001 on 01 April 2023 for the provision of last-mile parcel delivery services in the Republic of Singapore."),
    para("2.2. Under the Master Agreement, NinjaVan provides next-day, 2-day, 3-day, and 5-day delivery services segmented by parcel weight band."),
    para("2.3. NinjaVan has undertaken an operational review of its Singapore network capacity and determined that parcels in the 5-10 kg weight band require reclassification to a 3-day delivery window due to changes in sorting facility throughput and last-mile vehicle load optimization."),
    para("2.4. This Amendment formalizes the service level reclassification and associated rate adjustment for the 5-10 kg weight band, effective from the Amendment Effective Date."),
    calloutBox("CRITICAL NOTICE: This Amendment was executed on 18 September 2025 with an effective date of 01 October 2025. However, MCG's e-commerce fulfillment team (headed by Priya Ramanathan, E-Commerce Operations Manager) was NOT notified of the SLA change until 22 October 2025 — more than 3 weeks after the effective date. During this period, the MCG Singapore website and mobile app continued to display '2-day delivery' promises for 5-10 kg orders, resulting in false delivery commitments to approximately 14,000 customers per month.", "critical"),

    // ── SECTION 3: SERVICE LEVEL MODIFICATION ──
    heading("3. Service Level Modification"),
    heading("3.1 Reclassification Summary", 2),
    para("Effective 01 October 2025, Section 4.2(c) of the Master Agreement is hereby amended to reclassify the 5-10 kg weight band from the Express Tier (2-business-day delivery) to the Standard Tier (3-business-day delivery)."),
    dataTable(
      ["Weight Band", "Previous SLA", "New SLA (AMD3)", "Service Tier", "Tracking Level"],
      [
        ["0-2 kg", "Next-day", "Next-day (unchanged)", "Express", "Real-time (every scan)"],
        ["2-5 kg", "Next-day", "Next-day (unchanged)", "Express", "Real-time (every scan)"],
        ["5-10 kg", "2-day delivery", "3-day delivery", "Standard (CHANGED)", "Standard (hub scans only)"],
        ["10-20 kg", "3-day delivery", "3-day delivery (unchanged)", "Standard", "Standard (hub scans only)"],
        ["20-30 kg", "5-day delivery", "5-day delivery (unchanged)", "Freight", "Daily batch update"],
        ["> 30 kg", "By appointment", "By appointment (unchanged)", "Bulky Item", "Manual confirmation"],
      ]
    ),

    heading("3.2 Parcel Dimension Limits", 2),
    para("The following maximum dimensions apply per weight band. Parcels exceeding these dimensions are subject to the oversize surcharge specified in Schedule B."),
    dataTable(
      ["Weight Band", "Max Length (cm)", "Max Width (cm)", "Max Height (cm)", "Max L+W+H (cm)", "Oversize Surcharge"],
      [
        ["0-2 kg", "60", "40", "30", "100", "SGD 2.00"],
        ["2-5 kg", "80", "50", "40", "140", "SGD 3.00"],
        ["5-10 kg", "100", "60", "50", "170", "SGD 5.00"],
        ["10-20 kg", "120", "70", "60", "200", "SGD 8.00"],
        ["20-30 kg", "150", "80", "70", "240", "SGD 12.00"],
        ["> 30 kg", "200", "100", "80", "300", "By quotation"],
      ]
    ),

    // ── SECTION 4: RATE SCHEDULE ──
    heading("4. Rate Schedule (Schedule A)"),
    heading("4.1 Standard Delivery Rates by Weight Band and Zone", 2),
    para("Singapore is divided into three delivery zones for rate calculation purposes:"),
    para("Zone 1 (Central): Districts 01-08, 17-20, 22-23 — Central Business District, Orchard, Novena, Toa Payoh, Bishan", { bullet: true }),
    para("Zone 2 (Urban): Districts 09-16, 21, 24-28 — Woodlands, Yishun, Ang Mo Kio, Tampines, Bedok, Jurong East", { bullet: true }),
    para("Zone 3 (Extended): Districts 29+, Sentosa, Jurong Island, Tuas — Changi, Lim Chu Kang, Western islands", { bullet: true }),
    dataTable(
      ["Weight Band", "Zone 1 (SGD)", "Zone 2 (SGD)", "Zone 3 (SGD)", "Change vs AMD2"],
      [
        ["0-2 kg", "$3.95", "$4.20", "$4.80", "+3.9%"],
        ["2-5 kg", "$5.45", "$5.80", "$6.60", "+4.8%"],
        ["5-10 kg", "$7.20", "$7.65", "$8.70", "-15.3% (SLA reduced)"],
        ["10-20 kg", "$12.60", "$13.40", "$15.20", "+5.0%"],
        ["20-30 kg", "$19.25", "$20.50", "$23.30", "+4.1%"],
        ["> 30 kg", "$28.00", "$29.80", "$34.00", "+3.8%"],
      ]
    ),
    para("Note: The rate reduction for the 5-10 kg band from SGD 8.50 to SGD 7.20 (Zone 1) reflects the reduced service level commitment (3-day vs 2-day delivery). MCG's estimated monthly savings of SGD 18,200 on this weight band are offset by the customer experience impact detailed in Section 7."),

    heading("4.2 Surcharges and Additional Fees", 2),
    dataTable(
      ["Surcharge Type", "Amount (SGD)", "Conditions"],
      [
        ["Residential surcharge", "$0.80", "Delivery to non-commercial HDB/condo addresses"],
        ["Weekend/PH delivery", "$3.50", "Saturday, Sunday, or gazetted public holiday delivery"],
        ["Time-slot delivery (2hr window)", "$2.50", "Customer-selected 2-hour delivery window"],
        ["Address correction", "$4.00", "Incorrect/incomplete address requiring correction"],
        ["Failed delivery re-attempt", "$2.20", "Second or subsequent delivery attempt"],
        ["Cash on delivery (COD)", "$1.50", "COD collection and remittance service"],
        ["Oversize handling", "See 3.2", "Parcels exceeding dimension limits per weight band"],
        ["Dangerous goods (limited)", "$5.00", "Lithium battery-containing products (UN3481)"],
        ["Insurance premium (declared >$500)", "0.8% of value", "Declared value exceeding SGD 500"],
        ["Return to sender", "50% of outbound rate", "Undeliverable parcels returned to MCG"],
      ]
    ),

    heading("4.3 Holiday Surge Provisions", 2),
    para("During designated peak periods, the following surge pricing applies. NinjaVan shall provide MCG with no less than 30 days written notice before activating surge pricing."),
    dataTable(
      ["Peak Period", "Dates (2025-2026)", "Surge Multiplier", "Notice Required"],
      [
        ["Singles Day (11.11)", "08-14 Nov 2025", "1.25x base rate", "30 days"],
        ["Black Friday / Cyber Monday", "25 Nov - 02 Dec 2025", "1.30x base rate", "30 days"],
        ["12.12 Sale", "10-15 Dec 2025", "1.25x base rate", "30 days"],
        ["Christmas/New Year", "20 Dec 2025 - 03 Jan 2026", "1.35x base rate", "30 days"],
        ["Chinese New Year", "26 Jan - 05 Feb 2026", "1.40x base rate", "45 days"],
        ["Hari Raya Puasa", "TBD (est. late Mar 2026)", "1.20x base rate", "30 days"],
      ]
    ),
    para("MCG volume commitment during peak periods: MCG shall provide a 14-day rolling forecast of expected daily parcel volumes during surge periods. Failure to provide the forecast may result in capacity allocation being reduced to 80% of the prior year's peak daily volume."),

    // ── SECTION 5: SLA MATRIX AND PENALTY CALCULATIONS ──
    heading("5. SLA Matrix and Penalty Structure"),
    heading("5.1 Full SLA Performance Matrix", 2),
    dataTable(
      ["Metric", "Target", "Warning Threshold", "Penalty Trigger", "Measurement Period"],
      [
        ["On-time delivery (all bands)", "95%", "< 92%", "< 90%", "Monthly rolling"],
        ["On-time delivery (Express tier)", "98%", "< 96%", "< 94%", "Monthly rolling"],
        ["First-attempt delivery rate", "90%", "< 87%", "< 85%", "Monthly rolling"],
        ["Tracking data availability", "99%", "< 95%", "< 90%", "Monthly rolling"],
        ["Tracking data latency (pickup to first scan)", "< 2 hours", "< 4 hours", "> 6 hours", "Per-event sampling"],
        ["Customer complaint rate", "< 2%", "< 3%", "> 4%", "Monthly rolling"],
        ["WISMO rate", "< 30%", "< 40%", "> 45%", "Monthly rolling"],
        ["Parcel damage rate", "< 0.3%", "< 0.5%", "> 0.8%", "Monthly rolling"],
        ["Lost parcel rate", "< 0.05%", "< 0.08%", "> 0.1%", "Monthly rolling"],
      ]
    ),

    heading("5.2 Penalty Calculation Schedule", 2),
    para("When a performance metric falls below the Penalty Trigger threshold, the following rebates apply to the monthly invoice amount:"),
    dataTable(
      ["Breach Severity", "Condition", "Rebate", "Example (on SGD 180,000 monthly invoice)"],
      [
        ["Tier 1 (Minor)", "1 metric below penalty trigger", "2% of monthly invoice", "SGD 3,600"],
        ["Tier 2 (Moderate)", "2 metrics below penalty trigger", "5% of monthly invoice", "SGD 9,000"],
        ["Tier 3 (Major)", "3+ metrics below penalty trigger", "8% of monthly invoice", "SGD 14,400"],
        ["Tier 4 (Critical)", "Any metric >10% below target for 2+ months", "12% of monthly invoice + remediation plan", "SGD 21,600"],
        ["Termination Trigger", "Any metric >15% below target for 3+ months", "MCG may terminate with 30 days notice", "N/A"],
      ]
    ),

    heading("5.3 Tracking Data Surcharge", 2),
    para("Per Section 8.3 of the Master Agreement, parcels that do not receive a tracking scan within 6 hours of pickup are subject to an untracked parcel surcharge of SGD 0.10 per parcel, applied as a credit on the following month's invoice."),
    calloutBox("CURRENT STATUS: Tracking data availability in Q3 2025 is 71% against a 99% target — a 28-percentage-point shortfall. At approximately 47,000 Singapore parcels per month, this represents ~13,630 untracked parcels generating SGD 1,363 in monthly surcharges. However, the real cost is the WISMO spike to 52%, which is driving customer service costs estimated at SGD 28,000/month in additional call center staffing.", "critical"),

    // ── SECTION 6: PERFORMANCE METRICS ──
    heading("6. Performance Metrics — Q2 vs Q3 2025 Comparison"),
    heading("6.1 Quarterly Performance Dashboard", 2),
    dataTable(
      ["Metric", "Target", "Q2 2025 Actual", "Q3 2025 Actual", "Q2→Q3 Trend", "Status"],
      [
        ["On-time delivery (all bands)", "95%", "91%", "82%", "-9% decline", "CRITICAL"],
        ["On-time delivery (Express tier)", "98%", "95%", "88%", "-7% decline", "BREACH"],
        ["On-time delivery (Standard tier)", "92%", "88%", "76%", "-12% decline", "CRITICAL"],
        ["First-attempt delivery rate", "90%", "88%", "84%", "-4% decline", "BREACH"],
        ["Tracking data availability", "99%", "86%", "71%", "-15% decline", "CRITICAL"],
        ["Tracking data latency", "< 2 hrs", "3.1 hrs", "5.8 hrs", "+2.7 hrs worse", "BREACH"],
        ["Customer complaint rate", "< 2%", "3.1%", "4.7%", "+1.6% worse", "BREACH"],
        ["WISMO rate (Singapore)", "< 30%", "34%", "52%", "+18% worse", "CRITICAL"],
        ["Parcel damage rate", "< 0.3%", "0.4%", "0.6%", "+0.2% worse", "WARNING"],
        ["Lost parcel rate", "< 0.05%", "0.07%", "0.09%", "+0.02% worse", "WARNING"],
      ]
    ),

    heading("6.2 Penalty Calculations — Q3 2025", 2),
    para("Based on Q3 2025 performance, the following penalties apply:"),
    dataTable(
      ["Month", "Monthly Invoice", "Metrics in Breach", "Penalty Tier", "Rebate Amount", "Net Invoice"],
      [
        ["July 2025", "SGD 178,400", "4 metrics (on-time, tracking, complaints, WISMO)", "Tier 3 (Major)", "SGD 14,272 (8%)", "SGD 164,128"],
        ["August 2025", "SGD 183,200", "5 metrics (all July + damage rate)", "Tier 3 (Major)", "SGD 14,656 (8%)", "SGD 168,544"],
        ["September 2025", "SGD 176,800", "5 metrics (continuing)", "Tier 4 (Critical) — 2nd consecutive month", "SGD 21,216 (12%)", "SGD 155,584"],
      ]
    ),
    para("Total Q3 2025 rebates claimed: SGD 50,144", { bold: true }),
    para("Note: September's escalation to Tier 4 triggers a mandatory remediation plan from NinjaVan, due within 15 business days per Section 5.2 of this Amendment."),

    heading("6.3 Impact Analysis — Communication Failure", 2),
    calloutBox("The 3-week notification gap (01 Oct to 22 Oct 2025) resulted in the following quantified impacts: (1) 14,000 customers/month shown incorrect '2-day delivery' promise; (2) 4,200 customer complaints about late delivery in the first 3 weeks; (3) SGD 12,600 in goodwill refunds issued by MCG customer service; (4) NPS score for Singapore dropped from +42 to +28 in October 2025; (5) 847 WISMO tickets routed to the wrong resolution queue because agents did not know about the SLA change.", "critical"),

    // ── SECTION 7: TRACKING DATA REQUIREMENTS ──
    heading("7. Tracking Data Requirements (Appendix C)"),
    heading("7.1 Required Tracking Events", 2),
    para("NinjaVan shall transmit the following tracking events to MCG via the agreed webhook endpoint within the specified latency targets:"),
    dataTable(
      ["Event Code", "Description", "Required Latency", "Current Avg Latency", "Status"],
      [
        ["NV-PICKUP", "Parcel collected from MCG warehouse", "< 30 minutes", "42 minutes", "WARNING"],
        ["NV-SORT-IN", "Arrived at sorting facility", "< 1 hour", "2.4 hours", "BREACH"],
        ["NV-SORT-OUT", "Departed sorting facility", "< 1 hour", "3.1 hours", "BREACH"],
        ["NV-HUB-IN", "Arrived at delivery hub", "< 1 hour", "2.8 hours", "BREACH"],
        ["NV-OFD", "Out for delivery", "< 30 minutes", "1.2 hours", "BREACH"],
        ["NV-DELIVERED", "Delivered — with photo proof", "< 15 minutes", "38 minutes", "BREACH"],
        ["NV-FAILED", "Delivery attempt failed — with reason code", "< 15 minutes", "1.8 hours", "BREACH"],
        ["NV-RTS", "Return to sender initiated", "< 2 hours", "4.6 hours", "BREACH"],
      ]
    ),

    heading("7.2 Tracking Data Format", 2),
    para("All tracking events shall be transmitted as JSON payloads to the MCG webhook endpoint: https://api.meridiancommerce.com/v2/carriers/ninjavan/tracking"),
    para("Required fields: tracking_number, event_code, event_timestamp (ISO 8601 with timezone), location_code, location_name, latitude, longitude, driver_id, photo_url (for delivery/failed events), failure_reason_code (for failed events)."),
    para("Timestamp format: All timestamps MUST include timezone offset (e.g., 2025-10-01T14:30:00+08:00). Events without timezone information will be rejected by the MCG ingestion pipeline."),
    calloutBox("KNOWN ISSUE: NinjaVan's tracking system intermittently omits the timezone offset from event timestamps, sending bare timestamps (e.g., '2025-10-01T14:30:00'). MCG's Talend ingestion pipeline defaults to UTC for bare timestamps, causing an 8-hour offset for Singapore events. This affects approximately 12% of tracking events and contributes to the Timestamp Tower of Babel (Nightmare #5).", "warning"),

    // ── SECTION 8: INSURANCE AND LIABILITY ──
    heading("8. Insurance and Liability"),
    heading("8.1 Carrier Liability", 2),
    para("8.1.1. NinjaVan shall be liable for loss, damage, or destruction of Parcels from the time of collection until confirmed delivery or return to MCG."),
    para("8.1.2. Maximum liability per Parcel: SGD 500 unless additional insurance is purchased per the schedule in Section 4.2."),
    para("8.1.3. NinjaVan shall maintain the following insurance coverage throughout the term of this Agreement:"),
    para("Commercial General Liability: SGD 5,000,000 per occurrence", { bullet: true }),
    para("Professional Indemnity: SGD 2,000,000 per occurrence", { bullet: true }),
    para("Workers' Compensation: as required by Singapore law", { bullet: true }),
    para("Motor Vehicle Insurance: comprehensive coverage for all delivery vehicles", { bullet: true }),

    heading("8.2 MCG Declared Value Coverage", 2),
    dataTable(
      ["Declared Value Tier", "Premium Rate", "Maximum Payout", "Claim Processing Time"],
      [
        ["Up to SGD 100", "Included in base rate", "SGD 100", "5 business days"],
        ["SGD 101 - 500", "Included in base rate", "SGD 500", "5 business days"],
        ["SGD 501 - 2,000", "0.8% of declared value", "SGD 2,000", "10 business days"],
        ["SGD 2,001 - 5,000", "1.2% of declared value", "SGD 5,000", "15 business days"],
        ["> SGD 5,000", "By special arrangement", "As agreed", "20 business days"],
      ]
    ),

    heading("8.3 Indemnification", 2),
    para("8.3.1. NinjaVan shall indemnify, defend, and hold harmless MCG, its officers, directors, employees, and agents from and against any and all claims, damages, losses, costs, and expenses (including reasonable legal fees) arising out of or relating to: (a) NinjaVan's breach of this Agreement; (b) NinjaVan's negligence or willful misconduct; (c) any injury to persons or damage to property caused by NinjaVan's employees or agents in the performance of delivery services."),
    para("8.3.2. MCG shall indemnify NinjaVan against claims arising from MCG's provision of incorrect Consignee information, undeclared hazardous materials, or packaging defects attributable to MCG."),

    // ── SECTION 9: DISPUTE RESOLUTION ──
    heading("9. Dispute Resolution"),
    para("9.1. Escalation Procedure: Any dispute arising under this Agreement shall first be referred to the operational contacts (Wei Lin Tan for MCG; James Chua for NinjaVan) for resolution within 10 Business Days."),
    para("9.2. Management Escalation: If unresolved, the dispute shall be escalated to senior management (VP level or above) for resolution within a further 15 Business Days."),
    para("9.3. Mediation: If the dispute remains unresolved after management escalation, the parties agree to submit the dispute to mediation under the Singapore Mediation Centre (SMC) Mediation Procedure."),
    para("9.4. Arbitration: If mediation is unsuccessful within 30 days, the dispute shall be finally resolved by arbitration administered by the Singapore International Arbitration Centre (SIAC) under the SIAC Administered Arbitration Rules. The arbitration shall be conducted in English by a sole arbitrator."),
    para("9.5. Governing Law: This Agreement shall be governed by and construed in accordance with the laws of the Republic of Singapore."),

    // ── SECTION 10: FORCE MAJEURE ──
    heading("10. Force Majeure"),
    para("10.1. Neither party shall be liable for any failure or delay in performing its obligations under this Agreement if such failure or delay results from circumstances beyond the reasonable control of that party, including but not limited to: natural disasters, epidemics, pandemics, government actions, war, terrorism, civil unrest, strikes, fire, flood, earthquake, and failure of telecommunications or power supply."),
    para("10.2. The affected party shall give prompt written notice to the other party of the Force Majeure event and its expected duration."),
    para("10.3. If a Force Majeure event continues for more than 60 consecutive days, either party may terminate this Agreement upon 30 days written notice."),
    para("10.4. Notwithstanding the above, Force Majeure shall NOT excuse: (a) failure to provide timely notification of SLA changes; (b) failure to maintain tracking data feeds where NinjaVan systems are operational; (c) payment obligations for services already rendered."),

    // ── SECTION 11: TERMINATION ──
    heading("11. Termination"),
    para("11.1. Term: This Amendment shall remain in effect for the duration of the Master Agreement (expiring 31 March 2026), unless terminated earlier in accordance with this Section."),
    para("11.2. Termination for Convenience: Either party may terminate this Agreement by providing 90 days written notice."),
    para("11.3. Termination for Cause: Either party may terminate immediately upon written notice if the other party: (a) commits a material breach that is not cured within 30 days of written notice; (b) becomes insolvent or files for bankruptcy; (c) is subject to a change of control."),
    para("11.4. Termination for Performance Failure: MCG may terminate with 30 days notice if any SLA metric remains more than 15 percentage points below target for three consecutive months (per Section 5.2)."),
    para("11.5. Effect of Termination: Upon termination, NinjaVan shall complete delivery of all Parcels in transit at the time of termination. MCG shall pay for all services rendered through the effective date of termination, subject to applicable penalty deductions."),

    // ── SECTION 12: CONFIDENTIALITY ──
    heading("12. Confidentiality"),
    para("12.1. Each party agrees to maintain the confidentiality of all Confidential Information disclosed by the other party, including but not limited to: pricing, volume data, customer information, technology systems, and business strategies."),
    para("12.2. Confidentiality obligations shall survive termination of this Agreement for a period of 3 years."),
    para("12.3. Permitted Disclosures: A party may disclose Confidential Information to its employees, contractors, and advisors on a need-to-know basis, provided such recipients are bound by confidentiality obligations no less restrictive than those herein."),

    // ── SECTION 13: MCG CONTACT DETAILS ──
    heading("13. Contact Details"),
    heading("13.1 MCG Contacts", 2),
    dataTable(
      ["Role", "Name", "Email", "Phone"],
      [
        ["Regional Logistics Manager APAC", "Wei Lin Tan", "wltan@meridiancommerce.com", "+65 6234 8801"],
        ["E-Commerce Operations Manager", "Priya Ramanathan", "pramanathan@meridiancommerce.com", "+65 6234 8815"],
        ["APAC Finance Controller", "David Loh", "dloh@meridiancommerce.com", "+65 6234 8820"],
        ["Legal Counsel, APAC", "Rachel Goh", "rgoh@meridiancommerce.com", "+65 6234 8830"],
        ["VP Supply Chain", "Thomas Brennan", "tbrennan@meridiancommerce.com", "+31 10 798 4100"],
      ]
    ),
    heading("13.2 NinjaVan Contacts", 2),
    dataTable(
      ["Role", "Name", "Email", "Phone"],
      [
        ["Enterprise Account Director", "James Chua", "james.chua@ninjavan.co", "+65 9123 4567"],
        ["Operations Manager, Singapore", "Michelle Lim", "michelle.lim@ninjavan.co", "+65 9234 5678"],
        ["Technical Integration Lead", "Aaron Tan", "aaron.tan@ninjavan.co", "+65 9345 6789"],
        ["Finance & Billing", "Karen Wong", "karen.wong@ninjavan.co", "+65 9456 7890"],
      ]
    ),

    // ── SECTION 14: GENERAL PROVISIONS ──
    heading("14. General Provisions"),
    para("14.1. Entire Agreement: This Amendment, together with the Master Agreement and all prior Amendments, constitutes the entire agreement between the parties with respect to the subject matter hereof."),
    para("14.2. Severability: If any provision of this Amendment is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect."),
    para("14.3. Notices: All notices under this Agreement shall be in writing and delivered by registered mail, courier, or email to the addresses specified in Section 13."),
    para("14.4. Waiver: No failure or delay by either party in exercising any right shall constitute a waiver of that right."),
    para("14.5. Assignment: Neither party may assign this Agreement without the prior written consent of the other party, except in connection with a merger, acquisition, or sale of substantially all assets."),
    para("14.6. Counterparts: This Amendment may be executed in counterparts, each of which shall be deemed an original."),

    // ── SIGNATURES ──
    heading("15. Execution"),
    para("IN WITNESS WHEREOF, the parties have caused this Amendment to be executed by their duly authorized representatives as of the date first written above."),
    para("Date of Execution: 18 September 2025"),

    ...signatureBlock("Wei Lin Tan", "Regional Logistics Manager, APAC", "Meridian Commerce Group Pte. Ltd."),
    ...signatureBlock("James Chua", "Enterprise Account Director", "NinjaVan Pte. Ltd."),
    ...signatureBlock("Thomas Brennan", "VP Supply Chain (Countersignature)", "Meridian Commerce Group"),
    ...signatureBlock("Lai Chee Ng", "SVP Enterprise Accounts (Countersignature)", "NinjaVan Pte. Ltd."),
  ]);
}


// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT 2: FedEx Americas — 2025 Rate Card
// ═══════════════════════════════════════════════════════════════════════════════
function carrierFedEx() {
  return buildDocument("CARRIER RATE CARD", [

    // ── TITLE & METADATA ──
    heading("FedEx Americas — 2025 Annual Rate Card"),
    para("Negotiated Enterprise Pricing Schedule", { bold: true, size: 24, color: "6B7280" }),
    metadataTable([
      ["Document ID", "CARRIER-FEDEX-2025"],
      ["Effective Period", "01 January 2025 — 31 December 2025"],
      ["Master Agreement", "MSA-2021-FDX-US-003 (Annual Renewal)"],
      ["MCG Entity", "Meridian Commerce Group Inc. (DE Corp, EIN 84-2937654)"],
      ["FedEx Entity", "Federal Express Corporation"],
      ["MCG Contact", "Carlos Rivera, Director of Logistics, Americas"],
      ["FedEx Contact", "Diane Kowalski, Senior Account Executive"],
      ["MCG Account Number", "FDX-ENT-4827391"],
      ["Currency", "USD"],
      ["Pricing Basis", "Published Rate minus negotiated discount"],
      ["Document Classification", "CONFIDENTIAL — Commercial Terms"],
    ]),

    // ── REVISION HISTORY ──
    heading("Revision History"),
    dataTable(
      ["Version", "Date", "Description", "Authorized"],
      [
        ["1.0", "15 Nov 2024", "Initial 2025 rate card proposal from FedEx", "D. Kowalski"],
        ["1.1", "02 Dec 2024", "MCG counter-proposal with volume discount adjustment", "C. Rivera"],
        ["2.0", "18 Dec 2024", "Final negotiated rates — both parties agreed", "C. Rivera / D. Kowalski"],
        ["2.1", "06 Jan 2025", "Correction to Zone 7-8 Express rates (typographical error)", "D. Kowalski"],
      ]
    ),

    // ── SECTION 1: DEFINITIONS ──
    heading("1. Definitions"),
    para('"Actual Weight" means the weight of a package as measured on a calibrated scale, rounded up to the next whole pound.'),
    para('"Billable Weight" means the greater of Actual Weight and Dimensional Weight for any given package.'),
    para('"Delivery Area Surcharge (DAS)" means the additional charge applied to packages destined for ZIP codes designated by FedEx as extended delivery areas.'),
    para('"DIM Factor" means the divisor used to calculate Dimensional Weight. For FedEx 2025, the DIM Factor is 139 for domestic and 139 for international shipments.'),
    para('"Dimensional Weight" means the calculated weight of a package based on its dimensions: (Length x Width x Height in inches) / DIM Factor, rounded up to the next whole pound.'),
    para('"Ground Service" means FedEx Ground and FedEx Home Delivery services with transit times based on origin/destination zone pairs.'),
    para('"List Rate" means the published FedEx standard rate before application of any negotiated discounts.'),
    para('"Net Rate" means the List Rate minus the applicable MCG negotiated discount percentage.'),
    para('"Zone" means the FedEx-designated geographic zone determined by the distance between origin and destination ZIP codes, ranging from Zone 1 (local) through Zone 8 (cross-country).'),

    // ── SECTION 2: GROUND SERVICE RATES ──
    heading("2. Ground Service Rates"),
    heading("2.1 FedEx Ground — Commercial Delivery Rates", 2),
    para("The following rates apply to commercial (business) address deliveries via FedEx Ground. All rates are per package in USD. Rates shown are Net Rates (after MCG 19% volume discount)."),
    dataTable(
      ["Weight", "Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5", "Zone 6", "Zone 7", "Zone 8"],
      [
        ["1 lb", "$6.08", "$6.40", "$6.68", "$7.05", "$7.37", "$7.86", "$8.42", "$8.75"],
        ["2 lb", "$6.32", "$6.72", "$7.13", "$7.62", "$8.10", "$8.75", "$9.45", "$9.88"],
        ["3 lb", "$6.64", "$7.12", "$7.69", "$8.35", "$9.01", "$9.82", "$10.68", "$11.23"],
        ["5 lb", "$7.45", "$8.08", "$8.93", "$9.88", "$10.88", "$12.02", "$13.21", "$14.04"],
        ["10 lb", "$10.37", "$11.43", "$12.80", "$14.35", "$15.97", "$17.82", "$19.80", "$21.28"],
        ["15 lb", "$12.72", "$14.18", "$16.04", "$18.12", "$20.33", "$22.82", "$25.52", "$27.56"],
        ["20 lb", "$14.99", "$16.85", "$19.20", "$21.84", "$24.62", "$27.78", "$31.16", "$33.80"],
        ["25 lb", "$17.01", "$19.28", "$22.12", "$25.32", "$28.68", "$32.50", "$36.56", "$39.80"],
        ["30 lb", "$18.90", "$21.56", "$24.88", "$28.64", "$32.58", "$37.06", "$41.82", "$45.64"],
        ["40 lb", "$22.36", "$25.80", "$30.04", "$34.80", "$39.82", "$45.56", "$51.72", "$56.68"],
        ["50 lb", "$25.60", "$29.72", "$34.88", "$40.64", "$46.72", "$53.72", "$61.24", "$67.30"],
        ["60 lb", "$30.78", "$35.40", "$41.56", "$48.24", "$55.48", "$63.76", "$72.68", "$79.82"],
        ["70 lb", "$35.42", "$40.74", "$47.86", "$55.56", "$63.88", "$73.44", "$83.72", "$92.02"],
      ]
    ),

    heading("2.2 FedEx Home Delivery — Residential Rates", 2),
    para("FedEx Home Delivery rates apply to all residential addresses. Rates include the standard residential surcharge but exclude other applicable surcharges."),
    dataTable(
      ["Weight", "Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5", "Zone 6", "Zone 7", "Zone 8"],
      [
        ["1 lb", "$7.12", "$7.52", "$7.88", "$8.32", "$8.74", "$9.32", "$10.02", "$10.44"],
        ["2 lb", "$7.42", "$7.92", "$8.42", "$9.02", "$9.62", "$10.38", "$11.22", "$11.76"],
        ["5 lb", "$8.76", "$9.52", "$10.54", "$11.68", "$12.88", "$14.24", "$15.68", "$16.68"],
        ["10 lb", "$12.22", "$13.48", "$15.10", "$16.94", "$18.88", "$21.08", "$23.44", "$25.24"],
        ["20 lb", "$17.64", "$19.84", "$22.64", "$25.78", "$29.10", "$32.86", "$36.86", "$40.02"],
        ["30 lb", "$22.26", "$25.42", "$29.36", "$33.80", "$38.48", "$43.78", "$49.44", "$54.02"],
        ["50 lb", "$30.16", "$35.06", "$41.16", "$47.98", "$55.18", "$63.44", "$72.36", "$79.56"],
        ["70 lb", "$41.74", "$48.02", "$56.44", "$65.56", "$75.38", "$86.66", "$98.80", "$108.62"],
      ]
    ),

    // ── SECTION 3: EXPRESS SERVICE RATES ──
    heading("3. Express Service Rates"),
    heading("3.1 Express Service Tiers", 2),
    dataTable(
      ["Service", "Transit Time", "Weight Limit", "Base Multiplier (vs Ground)", "Cutoff Time", "Saturday Delivery"],
      [
        ["FedEx Express Saver", "3 business days", "150 lb", "Ground + 40%", "3:00 PM", "No"],
        ["FedEx 2Day", "2 business days", "150 lb", "Ground + 75%", "3:00 PM", "Available (+$16)"],
        ["FedEx 2Day A.M.", "2 business days (AM)", "150 lb", "Ground + 100%", "2:00 PM", "No"],
        ["FedEx Standard Overnight", "Next business day (by 4:30 PM)", "150 lb", "Ground + 120%", "5:00 PM", "Available (+$16)"],
        ["FedEx Priority Overnight", "Next business day (by 10:30 AM)", "150 lb", "Ground + 160%", "5:00 PM", "Available (+$16)"],
        ["FedEx First Overnight", "Next business day (by 8:00 AM)", "150 lb", "Ground + 220%", "5:00 PM", "No"],
      ]
    ),

    heading("3.2 MCG Express Usage Profile (FY2024)", 2),
    dataTable(
      ["Service", "Annual Packages", "% of Total", "Annual Spend", "Avg Cost/Package"],
      [
        ["FedEx Ground", "812,300", "65.1%", "$12,847,000", "$15.82"],
        ["FedEx Home Delivery", "247,600", "19.9%", "$5,182,000", "$20.93"],
        ["FedEx Express Saver", "98,400", "7.9%", "$2,461,000", "$25.01"],
        ["FedEx 2Day", "62,100", "5.0%", "$2,108,000", "$33.94"],
        ["FedEx Standard Overnight", "18,700", "1.5%", "$842,000", "$45.03"],
        ["FedEx Priority Overnight", "6,200", "0.5%", "$372,000", "$60.00"],
        ["FedEx First Overnight", "1,700", "0.1%", "$149,000", "$87.65"],
        ["TOTAL", "1,247,000", "100%", "$23,961,000", "$19.21 avg"],
      ]
    ),

    // ── SECTION 4: DIMENSIONAL WEIGHT ──
    heading("4. Dimensional Weight Calculation"),
    heading("4.1 DIM Weight Formula", 2),
    para("FedEx applies Dimensional Weight pricing when the Dimensional Weight exceeds the Actual Weight of a package. The billable weight is always the greater of Actual Weight and Dimensional Weight."),
    para("Dimensional Weight (lb) = (Length x Width x Height in inches) / 139", { bold: true }),
    para("Example: A package measuring 24\" x 18\" x 12\" = 5,184 cubic inches / 139 = 37.3 lb DIM weight. If actual weight is 15 lb, FedEx bills at 38 lb (DIM weight rounded up)."),

    heading("4.2 DIM Weight Impact on MCG", 2),
    calloutBox("MCG DATA QUALITY ISSUE: 8,200 products in the MCG product master database (out of 47,000 active SKUs) have missing or incorrect weight and/or dimension data. This represents 17.4% of all SKUs. Products without dimensions default to the maximum package size for their product category, resulting in systematic overbilling. Estimated annual impact: $2.1M in excess shipping costs.", "critical"),
    dataTable(
      ["Product Category", "Total SKUs", "Missing Weight Data", "Missing Dimensions", "Both Missing", "Est. Annual Overbilling"],
      [
        ["Electronics", "12,400", "820", "1,240", "480", "$624,000"],
        ["Home & Living", "8,600", "640", "960", "320", "$412,000"],
        ["Apparel & Fashion", "14,200", "480", "720", "240", "$318,000"],
        ["Sports & Outdoor", "4,800", "360", "580", "180", "$286,000"],
        ["Beauty & Personal Care", "3,800", "180", "280", "120", "$198,000"],
        ["Kitchen & Dining", "3,200", "220", "340", "140", "$262,000"],
        ["TOTAL", "47,000", "2,700", "4,120", "1,480", "$2,100,000"],
      ]
    ),
    para("Action Required: MCG Product Data team to remediate missing weight/dimension data. Priority should be given to Electronics (highest dollar impact) and high-velocity SKUs (top 20% by unit sales). Estimated remediation effort: 400 person-hours for manual measurement and data entry."),

    // ── SECTION 5: SURCHARGE SCHEDULE ──
    heading("5. 2025 Surcharge Schedule"),
    heading("5.1 Standard Surcharges", 2),
    dataTable(
      ["Surcharge", "Amount (USD)", "Applies To", "Trigger Condition"],
      [
        ["Fuel surcharge (Ground)", "Variable (avg 8.5%)", "All Ground/Home Delivery", "Indexed to DOE diesel price weekly"],
        ["Fuel surcharge (Express)", "Variable (avg 11.0%)", "All Express services", "Indexed to DOE jet fuel price weekly"],
        ["Residential delivery", "$4.40", "All non-commercial addresses", "Automatic — address classification"],
        ["Address correction", "$21.00", "Per package", "Invalid, incomplete, or undeliverable address"],
        ["Oversize — Level 1 (> 48\" any side)", "$32.50", "Per package", "Any single dimension > 48 inches"],
        ["Oversize — Level 2 (> 96\" L+girth)", "$112.00", "Per package", "Length + 2(W+H) > 96 inches"],
        ["Additional handling — weight (> 50 lb)", "$18.00", "Per package", "Actual weight > 50 lb"],
        ["Additional handling — dimensions", "$18.00", "Per package", "Any side > 30 inches"],
        ["Additional handling — packaging", "$18.00", "Per package", "Non-standard packaging (tubes, bags, etc.)"],
        ["Delivery area surcharge (DAS)", "$4.20", "Per package", "Extended ZIP codes per FedEx list"],
        ["DAS — Extended", "$7.80", "Per package", "Remote ZIP codes per FedEx list"],
        ["DAS — Residential", "$4.90", "Per package", "Extended ZIP + residential"],
        ["Signature Required — Direct", "$6.50", "Per package", "Adult signature at delivery"],
        ["Signature Required — Indirect", "$4.20", "Per package", "Any person at address may sign"],
        ["Hazardous Materials", "$45.00", "Per package", "DOT-classified hazardous materials"],
        ["Lithium Battery (standalone)", "$22.50", "Per package", "Standalone lithium battery shipments"],
        ["Weekend/Holiday delivery", "$16.00", "Per package", "Saturday delivery (where available)"],
        ["Return label", "$3.00", "Per label", "Prepaid return shipping label"],
        ["Third-party billing", "$0.00", "Per shipment", "No charge for MCG enterprise accounts"],
      ]
    ),

    heading("5.2 Address Correction Surcharge — MCG Impact Analysis", 2),
    calloutBox("ADDRESS CORRECTION CRISIS: MCG incurred $847,000 in FedEx address correction surcharges in FY2024. At $21.00 per correction across approximately 40,333 affected shipments, this represents 3.2% of all Americas packages. The root cause is the Address Data Catastrophe (Nightmare #2): MCG's address validation system uses a 2019 USPS database that has not been updated. New subdivisions, rezoned addresses, and USPS standardization changes since 2019 are not recognized, triggering corrections on valid addresses.", "critical"),
    dataTable(
      ["Quarter", "Packages Shipped", "Address Corrections", "Correction Rate", "Surcharge Cost", "Top Error Type"],
      [
        ["Q1 FY2024", "298,000", "8,420", "2.83%", "$176,820", "Missing apartment/unit number"],
        ["Q2 FY2024", "312,000", "9,180", "2.94%", "$192,780", "Incorrect ZIP+4 code"],
        ["Q3 FY2024", "325,000", "10,640", "3.27%", "$223,440", "New subdivision not in DB"],
        ["Q4 FY2024", "312,000", "12,093", "3.88%", "$253,953", "USPS standardization changes"],
        ["TOTAL FY2024", "1,247,000", "40,333", "3.23%", "$846,993", "—"],
      ]
    ),
    para("Trend: Address correction rates are increasing quarter-over-quarter as the 2019 USPS database becomes progressively more outdated. At current trajectory, FY2025 address correction costs are projected at $1.12M."),

    // ── SECTION 6: VOLUME DISCOUNT TIERS ──
    heading("6. Volume Discount Program"),
    heading("6.1 Tier Structure", 2),
    dataTable(
      ["Tier", "Annual Volume (packages)", "Discount", "Revenue Commitment", "Additional Benefits"],
      [
        ["Bronze", "< 100,000", "Base rate (0%)", "None", "Standard support"],
        ["Silver", "100,000 - 499,999", "8%", "$1.5M minimum", "Dedicated account rep"],
        ["Gold", "500,000 - 999,999", "14%", "$7.5M minimum", "Priority customer service, quarterly reviews"],
        ["Platinum", "1,000,000 - 2,499,999", "19%", "$15M minimum", "Named account executive, monthly reviews, SLA guarantees"],
        ["Diamond", "2,500,000+", "24%", "$40M minimum", "Executive sponsor, custom SLAs, dedicated ops team"],
      ]
    ),
    para("MCG Current Status: Platinum Tier", { bold: true }),
    labelValue("FY2024 Volume", "1,247,000 packages"),
    labelValue("FY2024 Gross Spend", "$29,581,000 (before discount)"),
    labelValue("FY2024 Discount Value", "$5,620,000 (19%)"),
    labelValue("FY2024 Net Spend", "$23,961,000"),
    calloutBox("VOLUME TIER RISK: MCG's FY2024 volume of 1,247,000 packages places it solidly in the Platinum tier. However, if the LATAM expansion (Project Horizon) proceeds as planned, FY2025 volume is projected at 2,180,000 packages — still below the 2,500,000 Diamond threshold. MCG should negotiate a custom intermediate tier or request early Diamond pricing based on projected growth trajectory. The 5-point discount gap (19% to 24%) represents approximately $1.5M annually at current spend levels.", "warning"),

    // ── SECTION 7: SERVICE LEVEL TARGETS ──
    heading("7. Service Level Targets"),
    dataTable(
      ["Metric", "Ground", "Home Delivery", "Express Saver", "2Day", "Overnight"],
      [
        ["On-time delivery", "96%", "95%", "97%", "98%", "99%"],
        ["Delivery attempt within SLA", "97%", "96%", "98%", "99%", "99.5%"],
        ["Tracking scan accuracy", "99%", "99%", "99.5%", "99.5%", "99.8%"],
        ["Damage rate (max)", "0.5%", "0.5%", "0.3%", "0.3%", "0.2%"],
        ["Loss rate (max)", "0.1%", "0.1%", "0.05%", "0.05%", "0.02%"],
      ]
    ),
    heading("7.1 FedEx Money-Back Guarantee", 2),
    para("FedEx Express services (2Day, Standard Overnight, Priority Overnight, First Overnight) are covered by the FedEx Money-Back Guarantee. If a package is delivered late, MCG is entitled to a full refund of transportation charges for that package."),
    para("Exclusions: The guarantee does not apply during: peak holiday season (Dec 15 - Jan 5), declared weather emergencies, or service disruptions posted on fedex.com/servicealerts."),
    para("Claim Window: Money-Back Guarantee claims must be filed within 15 calendar days of the scheduled delivery date."),

    // ── SECTION 8: CLAIMS AND LIABILITY ──
    heading("8. Claims Procedures and Liability"),
    heading("8.1 Claim Filing", 2),
    para("8.1.1. All claims for loss or damage must be filed within 60 calendar days of the shipment date via the FedEx Claims portal or by contacting the dedicated MCG account team."),
    para("8.1.2. Required documentation: original invoice/receipt showing value of goods, photographs of damaged items and packaging, FedEx tracking number, MCG order reference number."),
    para("8.1.3. FedEx shall acknowledge receipt of a claim within 5 business days and provide a resolution within 30 business days."),

    heading("8.2 Liability Limits", 2),
    dataTable(
      ["Service", "Maximum Liability (per package)", "Declared Value Coverage Available"],
      [
        ["FedEx Ground", "$100", "Up to $50,000 (additional charge)"],
        ["FedEx Home Delivery", "$100", "Up to $50,000 (additional charge)"],
        ["FedEx Express Saver", "$100", "Up to $50,000 (additional charge)"],
        ["FedEx 2Day", "$100", "Up to $50,000 (additional charge)"],
        ["FedEx Overnight services", "$100", "Up to $50,000 (additional charge)"],
      ]
    ),
    para("Declared Value surcharge: $0.00 for first $100; $1.40 per additional $100 of declared value (minimum charge $3.50)."),

    heading("8.3 Exclusions from Liability", 2),
    para("FedEx shall not be liable for: (a) consequential, incidental, special, or punitive damages; (b) loss of income or profits; (c) damage caused by improper packaging by the shipper; (d) perishable goods; (e) items of extraordinary value (artwork, antiques, jewelry >$1,000) unless properly declared; (f) delays caused by customs clearance; (g) acts of God, governmental actions, or other force majeure events."),

    // ── SECTION 9: BILLING AND PAYMENT ──
    heading("9. Billing and Payment Terms"),
    para("9.1. Billing Frequency: Weekly invoice (issued every Monday for the prior week's shipments)."),
    para("9.2. Payment Terms: Net 30 days from invoice date."),
    para("9.3. Payment Method: ACH electronic transfer to FedEx designated bank account."),
    para("9.4. Late Payment: Past-due invoices accrue interest at 1.5% per month (18% APR)."),
    para("9.5. Dispute Resolution: Invoice disputes must be raised within 30 days of invoice date. Disputed amounts may be withheld pending resolution, but undisputed portions must be paid on time."),
    para("9.6. Audit Rights: MCG may audit FedEx invoices for accuracy. FedEx shall provide detailed shipment-level data upon request. Identified overcharges shall be credited within 60 days."),

    // ── SECTION 10: LEGAL TERMS ──
    heading("10. General Legal Terms"),

    heading("10.1 Indemnification", 2),
    para("FedEx shall indemnify MCG against all claims, damages, and expenses arising from FedEx's negligence, willful misconduct, or breach of this Agreement. MCG shall indemnify FedEx against claims arising from MCG's provision of inaccurate shipping information, undeclared hazardous materials, or prohibited items."),

    heading("10.2 Force Majeure", 2),
    para("Neither party shall be liable for delays or failures caused by events beyond reasonable control, including natural disasters, pandemics, government actions, war, terrorism, strikes, or infrastructure failures. The affected party must provide prompt notice and use commercially reasonable efforts to mitigate the impact."),

    heading("10.3 Termination", 2),
    para("10.3.1. This Rate Card is effective for the calendar year 2025. Either party may terminate the underlying MSA with 180 days written notice."),
    para("10.3.2. MCG may terminate immediately if FedEx fails to maintain service levels below the targets in Section 7 for three consecutive months."),
    para("10.3.3. FedEx may terminate if MCG fails to meet the minimum revenue commitment for the applicable volume discount tier for two consecutive quarters."),

    heading("10.4 Governing Law", 2),
    para("This Agreement shall be governed by the laws of the State of Delaware, without regard to conflict of law principles. Any disputes shall be resolved in the federal or state courts located in Wilmington, Delaware."),

    heading("10.5 Confidentiality", 2),
    para("All pricing, volume, and commercial terms contained in this Rate Card are confidential and proprietary. Neither party shall disclose these terms to third parties without prior written consent, except as required by law or regulation."),

    // ── SECTION 11: APPENDIX ──
    heading("11. Appendix A — MCG Shipping Locations"),
    dataTable(
      ["Facility", "Address", "FedEx Pickup Time", "Daily Avg Volume", "Primary Zones"],
      [
        ["MCG Americas HQ / DC East", "1200 Commerce Blvd, Edison, NJ 08817", "5:00 PM ET", "2,400 pkgs", "Zone 1-4"],
        ["MCG DC Southeast", "4500 Logistics Dr, Atlanta, GA 30349", "4:30 PM ET", "1,800 pkgs", "Zone 2-5"],
        ["MCG DC Central", "8900 Distribution Way, Dallas, TX 75247", "4:00 PM CT", "1,200 pkgs", "Zone 3-6"],
        ["MCG DC West", "2100 Fulfillment Ave, Ontario, CA 91761", "5:00 PM PT", "2,000 pkgs", "Zone 1-4 (West)"],
        ["MCG Returns Center", "600 Returns Rd, Columbus, OH 43228", "3:00 PM ET", "800 pkgs (returns)", "N/A"],
      ]
    ),

    // ── SIGNATURES ──
    heading("12. Acceptance and Execution"),
    para("By signing below, the authorized representatives of MCG and FedEx agree to the rates, terms, and conditions set forth in this 2025 Rate Card, which shall supplement and be governed by the Master Service Agreement MSA-2021-FDX-US-003."),
    para("Date of Execution: 18 December 2024"),

    ...signatureBlock("Carlos Rivera", "Director of Logistics, Americas", "Meridian Commerce Group Inc."),
    ...signatureBlock("Diane Kowalski", "Senior Account Executive", "Federal Express Corporation"),
    ...signatureBlock("Thomas Brennan", "VP Supply Chain (Countersignature)", "Meridian Commerce Group"),
  ]);
}


// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT 3: DPD EU — Service Agreement 2025
// ═══════════════════════════════════════════════════════════════════════════════
function carrierDPD() {
  return buildDocument("CARRIER SERVICE AGREEMENT", [

    // ── TITLE & METADATA ──
    heading("DPD EU — Service Agreement 2025"),
    para("Enterprise Parcel Delivery Services for EU-27, UK, Switzerland, and Norway", { bold: true, size: 24, color: "6B7280" }),
    metadataTable([
      ["Document ID", "CARRIER-DPD-2025"],
      ["Effective Period", "01 January 2025 — 31 December 2025"],
      ["Master Agreement", "MSA-2022-DPD-EU-001"],
      ["MCG Entity", "Meridian Commerce Group B.V. (KvK 81234567)"],
      ["DPD Entity", "DPDgroup SAS / DPD (Nederland) B.V."],
      ["MCG Contact", "Sophie Muller, EU Logistics Manager"],
      ["DPD Contact", "Klaus Weidmann, Key Account Manager"],
      ["Service Territory", "EU-27 + United Kingdom, Switzerland, Norway"],
      ["Currency", "EUR (UK rates also quoted in GBP)"],
      ["Document Classification", "CONFIDENTIAL — Commercial Terms"],
      ["GDPR Reference", "DPA-2022-DPD-EU-001 (Data Processing Agreement)"],
    ]),

    // ── REVISION HISTORY ──
    heading("Document History"),
    dataTable(
      ["Version", "Date", "Description", "Author"],
      [
        ["1.0", "01 Mar 2022", "Original Master Service Agreement execution", "S. Muller / K. Weidmann"],
        ["1.1", "01 Jan 2023", "2023 rate card update; addition of Predict service", "K. Weidmann"],
        ["1.2", "01 Jan 2024", "2024 rate update (+2.8% CPI); expanded CH/NO coverage", "K. Weidmann"],
        ["2.0", "01 Jan 2025", "2025 service agreement — comprehensive refresh including new zone structure, updated data exchange requirements, multi-language tracking specification", "S. Muller / K. Weidmann"],
      ]
    ),

    // ── SECTION 1: DEFINITIONS ──
    heading("1. Definitions"),
    para('"Business Day" means any day other than Saturday, Sunday, or a public holiday in the country of origin or destination.'),
    para('"Canonical Status" means the standardized English-language tracking status codes maintained by MCG for cross-carrier normalization.'),
    para('"CET" means Central European Time (UTC+1), or Central European Summer Time (CEST, UTC+2) when Daylight Saving Time is in effect in the EU.'),
    para('"Classic Service" means the DPD standard parcel delivery service with 2-3 Business Day transit time within domestic markets.'),
    para('"Cross-Border Shipment" means a parcel where the origin and destination countries are different.'),
    para('"DPD Predict" means the premium delivery service providing a 1-hour delivery time window notification to the Consignee via SMS or email.'),
    para('"Domestic Shipment" means a parcel where the origin and destination are within the same country.'),
    para('"Express Service" means the DPD next-business-day delivery service available in major metropolitan areas.'),
    para('"International Service" means the DPD cross-border delivery service with 3-7 Business Day transit time.'),
    para('"Local Language Status" means the tracking status description provided by DPD in the official language of the delivery country.'),
    para('"Parcel Shop" means a DPD-authorized retail location where Consignees may collect parcels as an alternative to home delivery.'),
    para('"SFTP" means Secure File Transfer Protocol, used for daily batch data exchange between DPD and MCG.'),
    para('"Webhook" means a real-time HTTP POST callback from DPD systems to the MCG tracking ingestion endpoint.'),
    para('"Zone" means a geographic grouping of countries for rate calculation purposes, as defined in Schedule A.'),

    // ── SECTION 2: SERVICE TIERS ──
    heading("2. Service Tiers and Coverage"),
    heading("2.1 Service Overview", 2),
    dataTable(
      ["Service", "Transit Time", "Coverage", "Tracking Level", "Predict Available", "Parcel Shop Fallback"],
      [
        ["DPD Classic", "2-3 BD", "EU-27 domestic", "Standard", "No", "Yes"],
        ["DPD Express", "Next BD", "Major EU metro areas (80+ cities)", "Premium", "Yes (included)", "No"],
        ["DPD International", "3-7 BD", "Cross-border EU-27 + UK, CH, NO", "Standard", "No", "Yes"],
        ["DPD Predict", "2-3 BD + 1hr window", "NL, DE, BE, FR, UK, AT, PL, CZ", "Premium + SMS/Email", "Yes (core feature)", "Yes"],
      ]
    ),

    heading("2.2 Zone Definitions", 2),
    para("For rate calculation purposes, the DPD service territory is divided into the following zones:"),
    dataTable(
      ["Zone", "Countries", "Description"],
      [
        ["Domestic", "Each country individually", "Origin and destination in same country"],
        ["Zone 1 (Neighboring)", "NL-BE, NL-DE, DE-AT, DE-PL, FR-BE, etc.", "Bordering countries with direct road links"],
        ["Zone 2 (Near Europe)", "NL-FR, DE-CZ, FR-IT, ES-PT, etc.", "Non-bordering but within ~1,000 km"],
        ["Zone 3 (Mid Europe)", "NL-IT, DE-ES, FR-PL, NL-AT, etc.", "1,000-2,000 km distance"],
        ["Zone 4 (Far Europe)", "NL-GR, NL-RO, DE-PT, FR-FI, etc.", "2,000+ km or peripheral countries"],
        ["Zone UK", "United Kingdom", "Post-Brexit separate zone (customs clearance)"],
        ["Zone CH/NO", "Switzerland, Norway", "Non-EU / EEA (customs clearance required)"],
      ]
    ),

    // ── SECTION 3: RATE TABLES ──
    heading("3. Rate Tables (Schedule A)"),
    heading("3.1 DPD Classic — Domestic Rates (EUR)", 2),
    para("Domestic rates apply to shipments within a single country. Rates shown are for the Netherlands; other countries have country-specific supplements (see Appendix B)."),
    dataTable(
      ["Weight Band", "NL Domestic", "DE Domestic", "FR Domestic", "BE Domestic", "IT Domestic", "ES Domestic"],
      [
        ["0-1 kg", "EUR 3.60", "EUR 3.80", "EUR 4.10", "EUR 3.70", "EUR 4.40", "EUR 4.20"],
        ["1-2 kg", "EUR 4.20", "EUR 4.40", "EUR 4.80", "EUR 4.30", "EUR 5.10", "EUR 4.90"],
        ["2-5 kg", "EUR 5.80", "EUR 6.10", "EUR 6.60", "EUR 5.90", "EUR 7.20", "EUR 6.80"],
        ["5-10 kg", "EUR 8.40", "EUR 8.80", "EUR 9.60", "EUR 8.60", "EUR 10.40", "EUR 9.80"],
        ["10-15 kg", "EUR 10.80", "EUR 11.40", "EUR 12.40", "EUR 11.00", "EUR 13.40", "EUR 12.60"],
        ["15-20 kg", "EUR 12.60", "EUR 13.20", "EUR 14.40", "EUR 12.80", "EUR 15.60", "EUR 14.80"],
        ["20-25 kg", "EUR 15.40", "EUR 16.20", "EUR 17.60", "EUR 15.80", "EUR 19.00", "EUR 18.00"],
        ["25-31.5 kg", "EUR 18.20", "EUR 19.10", "EUR 20.80", "EUR 18.60", "EUR 22.40", "EUR 21.20"],
      ]
    ),

    heading("3.2 Cross-Border Rates by Zone (EUR)", 2),
    dataTable(
      ["Weight Band", "Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone UK", "Zone CH/NO"],
      [
        ["0-1 kg", "EUR 6.80", "EUR 8.40", "EUR 10.20", "EUR 13.40", "EUR 10.80", "EUR 12.60"],
        ["1-2 kg", "EUR 7.50", "EUR 9.20", "EUR 11.40", "EUR 14.80", "EUR 11.80", "EUR 13.80"],
        ["2-5 kg", "EUR 9.20", "EUR 11.60", "EUR 14.40", "EUR 18.60", "EUR 14.80", "EUR 17.20"],
        ["5-10 kg", "EUR 12.80", "EUR 16.20", "EUR 20.40", "EUR 26.40", "EUR 20.80", "EUR 24.20"],
        ["10-15 kg", "EUR 16.40", "EUR 21.00", "EUR 26.40", "EUR 34.00", "EUR 27.00", "EUR 31.40"],
        ["15-20 kg", "EUR 18.40", "EUR 23.60", "EUR 29.80", "EUR 38.40", "EUR 30.40", "EUR 35.40"],
        ["20-25 kg", "EUR 22.60", "EUR 29.00", "EUR 36.60", "EUR 47.00", "EUR 37.40", "EUR 43.60"],
        ["25-31.5 kg", "EUR 26.80", "EUR 34.40", "EUR 43.40", "EUR 55.80", "EUR 44.40", "EUR 51.80"],
      ]
    ),

    heading("3.3 DPD Express — Premium Rates (EUR)", 2),
    para("Express rates apply a multiplier to Classic rates. Express service is available for domestic and Zone 1 shipments only."),
    dataTable(
      ["Weight Band", "Domestic Express", "Zone 1 Express", "Predict Add-on (Domestic)", "Predict Add-on (Zone 1)"],
      [
        ["0-5 kg", "Classic + 60%", "Classic + 85%", "+EUR 0.80", "+EUR 1.20"],
        ["5-10 kg", "Classic + 55%", "Classic + 80%", "+EUR 0.80", "+EUR 1.20"],
        ["10-20 kg", "Classic + 50%", "Classic + 75%", "+EUR 1.00", "+EUR 1.50"],
        ["20-31.5 kg", "Classic + 45%", "Classic + 70%", "+EUR 1.20", "+EUR 1.80"],
      ]
    ),

    heading("3.4 Surcharges (EUR)", 2),
    dataTable(
      ["Surcharge", "Amount", "Applies To"],
      [
        ["Fuel surcharge", "Variable (avg 7.8%)", "All shipments — indexed to European diesel price"],
        ["Residential surcharge (DE, AT, CH only)", "EUR 1.80", "Deliveries to residential addresses in DE/AT/CH"],
        ["Island surcharge", "EUR 8.50", "Deliveries to islands (Balearic, Canary, Greek islands, Corsica, etc.)"],
        ["Remote area surcharge", "EUR 4.20", "Per DPD remote postcode list (updated quarterly)"],
        ["Oversize (longest side > 100 cm)", "EUR 12.00", "Per package"],
        ["Overweight (> 20 kg, up to 31.5 kg)", "EUR 3.50", "Per package"],
        ["Saturday delivery", "EUR 5.00", "Available in NL, DE, BE only"],
        ["Returns management", "EUR 2.80", "Per return parcel processed"],
        ["Cash on delivery (COD)", "EUR 3.50 + 1.5% of collected amount", "COD collection and remittance"],
        ["ID verification at delivery", "EUR 2.00", "Age-restricted items (alcohol, etc.)"],
        ["UK customs clearance (post-Brexit)", "EUR 4.80", "All UK-bound cross-border shipments"],
        ["CH/NO customs handling", "EUR 6.20", "All CH/NO-bound shipments"],
      ]
    ),

    // ── SECTION 4: TRACKING STATUS CODES ──
    heading("4. Multi-Language Tracking Status Codes (Appendix C)"),
    calloutBox("CRITICAL INTEGRATION REQUIREMENT: DPD provides tracking status updates in the LOCAL LANGUAGE of the delivery country. MCG must implement a comprehensive status translation layer to normalize these statuses into MCG Canonical Status codes. This multi-language tracking challenge is a core element of Nightmare #6 (Carrier Data Black Hole). The Talend Carrier Status Normalizer addresses this by maintaining a mapping table that is updated whenever DPD adds or modifies status codes.", "critical"),

    heading("4.1 Primary Status Mapping", 2),
    dataTable(
      ["MCG Canonical", "English", "German (DE/AT/CH)", "Dutch (NL/BE)", "French (FR/BE)", "Italian", "Spanish"],
      [
        ["LABEL_CREATED", "Shipment data received", "Paketdaten empfangen", "Pakketgegevens ontvangen", "Donnees d'envoi recues", "Dati spedizione ricevuti", "Datos de envio recibidos"],
        ["PICKED_UP", "Collected from sender", "Beim Absender abgeholt", "Opgehaald bij afzender", "Collecte chez l'expediteur", "Ritirato dal mittente", "Recogido del remitente"],
        ["IN_TRANSIT", "In transit", "Im Paketzentrum", "In pakketcentrum", "Au centre de tri", "Nel centro smistamento", "En centro de clasificacion"],
        ["IN_TRANSIT_HUB", "At sorting hub", "Im Umschlagzentrum", "In sorteercentrum", "Au hub de tri", "Al centro di smistamento", "En centro de distribucion"],
        ["OUT_FOR_DELIVERY", "Out for delivery", "In Zustellung", "In bezorging", "En livraison", "In consegna", "En reparto"],
        ["DELIVERED", "Delivered", "Zugestellt", "Bezorgd", "Livre", "Consegnato", "Entregado"],
        ["DELIVERED_NEIGHBOR", "Delivered to neighbor", "Beim Nachbarn abgegeben", "Afgeleverd bij buren", "Livre au voisin", "Consegnato al vicino", "Entregado al vecino"],
        ["DELIVERED_PARCEL_SHOP", "At Parcel Shop", "Im Paketshop", "In pakketpunt", "Au point relais", "Al punto di ritiro", "En punto de recogida"],
        ["DELIVERY_FAILED", "Delivery not possible", "Nicht zustellbar", "Niet bezorgbaar", "Non livrable", "Consegna non possibile", "No se pudo entregar"],
        ["RETURN_TO_SENDER", "Return to sender", "Retoure", "Retour", "Retour a l'expediteur", "Reso al mittente", "Devolucion al remitente"],
        ["ON_HOLD", "Shipment on hold", "Sendung angehalten", "Zending aangehouden", "Envoi en attente", "Spedizione in sospeso", "Envio en espera"],
        ["CUSTOMS_CLEARANCE", "In customs", "Im Zoll", "Bij de douane", "En douane", "In dogana", "En aduanas"],
      ]
    ),

    heading("4.2 Extended Status Codes — Failure Reasons", 2),
    dataTable(
      ["Failure Code", "English", "German", "Dutch", "French", "Resolution Action"],
      [
        ["FAIL_NO_ACCESS", "No access to delivery address", "Kein Zugang zur Lieferadresse", "Geen toegang tot afleveradres", "Pas d'acces a l'adresse", "Retry next BD"],
        ["FAIL_NOT_HOME", "Recipient not at home", "Empfanger nicht angetroffen", "Ontvanger niet thuis", "Destinataire absent", "Retry + Parcel Shop option"],
        ["FAIL_REFUSED", "Delivery refused", "Annahme verweigert", "Levering geweigerd", "Refus de livraison", "Return to sender"],
        ["FAIL_WRONG_ADDR", "Incorrect address", "Falsche Adresse", "Onjuist adres", "Adresse incorrecte", "Address correction + retry"],
        ["FAIL_DAMAGED", "Package damaged", "Paket beschadigt", "Pakket beschadigd", "Colis endommage", "Investigation + claim"],
        ["FAIL_TOO_LARGE", "Does not fit in mailbox/locker", "Passt nicht in Briefkasten", "Past niet in brievenbus", "Ne rentre pas dans la boite", "Retry with personal delivery"],
        ["FAIL_COD_NO_CASH", "COD: recipient has no cash", "Nachnahme: kein Bargeld", "Rembours: geen contant geld", "Contre-remboursement: pas d'especes", "Retry + card payment option"],
      ]
    ),

    heading("4.3 Status Mapping Implementation Notes", 2),
    calloutBox("WARNING — Status code variations: DPD periodically updates status descriptions across languages. In Q3 2024, German status 'In Zustellung' was temporarily changed to 'Wird zugestellt' in certain depots, breaking MCG's mapping. DPD provides no formal notification of status text changes. MCG must implement fuzzy matching or maintain a mapping table with regular updates. The current Talend Carrier Status Normalizer uses an exact-match lookup that is fragile to these changes.", "warning"),
    para("Key implementation requirements:"),
    para("Maintain a versioned lookup table with all known DPD status strings per language", { bullet: true }),
    para("Implement fallback logic: if exact match fails, attempt fuzzy match with >90% similarity threshold", { bullet: true }),
    para("Log all unmatched status codes for manual review and table update", { bullet: true }),
    para("DPD status API returns status in the language of the destination country, NOT the origin country", { bullet: true }),
    para("Belgium returns statuses in BOTH Dutch and French depending on the delivery region (Flanders vs Wallonia)", { bullet: true }),
    para("Switzerland may return statuses in German, French, or Italian depending on the canton", { bullet: true }),

    // ── SECTION 5: DATA EXCHANGE ──
    heading("5. Data Exchange Requirements"),
    heading("5.1 Real-Time Webhook", 2),
    para("DPD shall transmit tracking events in real-time via HTTP POST to the MCG webhook endpoint:"),
    para("Endpoint: https://api.meridiancommerce.com/v2/carriers/dpd/tracking", { bold: true }),
    para("Method: POST with JSON payload. Authentication via API key in X-MCG-API-Key header."),
    para("Payload must include: tracking_number, dpd_parcel_number, event_code, event_timestamp, event_description (local language), event_description_en (English translation), location_code, location_city, location_country_iso, delivery_depot_code."),
    para("Expected latency: Events shall be transmitted within 5 minutes of the scan event."),

    heading("5.2 Daily SFTP Reconciliation File", 2),
    para("DPD shall deliver a daily reconciliation CSV file via SFTP by 06:00 CET each day, containing all tracking events from the previous calendar day."),
    para("SFTP Host: sftp.meridiancommerce.com", { bold: true }),
    para("Directory: /inbound/carriers/dpd/tracking/"),
    para("Filename format: DPD_TRACKING_{YYYYMMDD}.csv"),
    para("CSV columns: tracking_number, dpd_parcel_number, event_sequence, event_code, event_timestamp, event_description, event_description_en, location_code, location_city, location_country, consignee_postcode, service_type, weight_kg, origin_country, destination_country"),

    heading("5.3 DPD MyParcel API", 2),
    para("MCG may query individual parcel status via the DPD MyParcel API for on-demand lookups."),
    para("Base URL: https://api.dpd.com/v2/tracking/{trackingNumber}", { bold: true }),
    para("Authentication: OAuth 2.0 client credentials flow"),
    para("Rate limit: 1,000 requests per minute (MCG enterprise tier)"),
    para("Response format: JSON with events array, each containing event_code, timestamp, description (multi-language), and location"),

    heading("5.4 Timestamp Format — CRITICAL ISSUE", 2),
    calloutBox("KNOWN BUG — TIMESTAMP FORMAT: All timestamps in DPD data feeds (webhook, SFTP, and API) use CET/CEST format WITHOUT an explicit timezone indicator. Example: '2025-06-15 14:30:22' with no timezone suffix. MCG systems MUST apply CET offset (+01:00) or CEST offset (+02:00) based on the date. DPD does NOT indicate which offset is in effect — MCG must calculate based on EU Daylight Saving Time rules. This is a documented contributor to Nightmare #5 (Timestamp Tower of Babel). DST transitions occur on the last Sunday of March (to CEST) and last Sunday of October (to CET).", "critical"),
    para("Additional timestamp complications:"),
    para("UK events: DPD UK operations use GMT/BST, but the SFTP file reports all timestamps as CET regardless of country. UK timestamps are therefore CET-converted (NOT original UK local time).", { bullet: true }),
    para("Switzerland: Follows CET/CEST schedule (same as EU).", { bullet: true }),
    para("Norway: Follows CET/CEST schedule (same as EU).", { bullet: true }),
    para("API responses: The MyParcel API returns timestamps in ISO 8601 format WITH timezone offset — this is the ONLY DPD data source that includes timezone information.", { bullet: true }),

    // ── SECTION 6: SLA TARGETS AND PENALTIES ──
    heading("6. SLA Targets and Penalty Structure"),
    heading("6.1 Performance Targets", 2),
    dataTable(
      ["Metric", "Classic Target", "Express Target", "International Target", "Predict Target"],
      [
        ["On-time delivery", "96%", "98%", "92%", "96% (within window)"],
        ["First-attempt success rate", "92%", "95%", "88%", "94%"],
        ["Tracking update frequency", "Every scan point", "Every scan + GPS", "Every hub scan", "Every scan + GPS"],
        ["Tracking update latency", "< 30 min", "< 15 min", "< 60 min", "< 15 min"],
        ["Damage rate (max)", "0.5%", "0.3%", "0.8%", "0.5%"],
        ["Lost parcel rate (max)", "0.05%", "0.03%", "0.1%", "0.05%"],
        ["Predict window accuracy", "N/A", "N/A", "N/A", "> 90% delivered within 1hr window"],
        ["Parcel Shop availability", "> 95% of deliveries", "N/A", "> 90% of deliveries", "> 95% of deliveries"],
      ]
    ),

    heading("6.2 Penalty Calculation", 2),
    para("Penalties are calculated monthly based on the performance of each service tier against its targets. Penalties are applied as credits on the following month's invoice."),
    dataTable(
      ["Performance Band", "Condition", "Rebate (% of affected service tier spend)"],
      [
        ["Green (Compliant)", "All metrics meet or exceed target", "No rebate"],
        ["Amber (Warning)", "1 metric 1-3% below target", "1% rebate + corrective action plan within 10 BD"],
        ["Red (Breach)", "1+ metrics 3-5% below target", "3% rebate + management escalation"],
        ["Critical", "1+ metrics >5% below target", "5% rebate + executive review + 30-day remediation plan"],
        ["Persistent Failure", "Any metric in Red/Critical for 3+ consecutive months", "8% rebate + MCG termination right (60 days notice)"],
      ]
    ),
    para("Penalty cap: Total monthly penalties shall not exceed 15% of the monthly invoice amount for the affected service tier."),

    // ── SECTION 7: PARCEL SPECIFICATIONS ──
    heading("7. Parcel Specifications and Restrictions"),
    heading("7.1 Dimension Limits", 2),
    dataTable(
      ["Parameter", "Classic/Predict", "Express", "International"],
      [
        ["Maximum weight", "31.5 kg", "31.5 kg", "31.5 kg"],
        ["Maximum length", "175 cm", "120 cm", "150 cm"],
        ["Maximum L + 2(W+H)", "300 cm", "250 cm", "300 cm"],
        ["Minimum dimensions", "15 x 10 x 1 cm", "15 x 10 x 1 cm", "15 x 10 x 1 cm"],
        ["Maximum value (standard)", "EUR 520", "EUR 520", "EUR 520"],
        ["Maximum value (declared)", "EUR 13,000", "EUR 13,000", "EUR 5,200"],
      ]
    ),

    heading("7.2 Prohibited Items", 2),
    para("The following items are prohibited from transport by DPD and shall not be tendered by MCG:"),
    para("Weapons, firearms, and ammunition", { bullet: true }),
    para("Explosives, fireworks, and flammable substances (except lithium batteries per IATA regulations)", { bullet: true }),
    para("Controlled substances, narcotics, and prescription medications", { bullet: true }),
    para("Live animals", { bullet: true }),
    para("Human remains or body parts", { bullet: true }),
    para("Counterfeit goods or items infringing intellectual property rights", { bullet: true }),
    para("Currency, bearer instruments, and precious metals", { bullet: true }),
    para("Perishable goods requiring temperature control (unless agreed under separate cold chain addendum)", { bullet: true }),
    para("Items requiring export licenses not held by MCG", { bullet: true }),

    // ── SECTION 8: INSURANCE AND CLAIMS ──
    heading("8. Insurance, Liability, and Claims"),
    heading("8.1 Standard Liability", 2),
    para("8.1.1. DPD's standard liability is governed by the CMR Convention (Convention on the Contract for the International Carriage of Goods by Road) for cross-border shipments and applicable national law for domestic shipments."),
    para("8.1.2. Maximum standard liability: EUR 520 per parcel (or 8.33 SDR per kilogram of gross weight, whichever is higher) as per CMR Article 23."),

    heading("8.2 Extended Coverage", 2),
    dataTable(
      ["Coverage Level", "Premium", "Maximum Payout", "Claim Filing Deadline"],
      [
        ["Standard (included)", "Included in base rate", "EUR 520 per parcel", "21 calendar days from delivery/expected delivery"],
        ["Enhanced", "+0.5% of declared value", "EUR 2,500 per parcel", "21 calendar days"],
        ["Premium", "+1.0% of declared value", "EUR 5,200 per parcel", "21 calendar days"],
        ["Maximum", "+1.5% of declared value", "EUR 13,000 per parcel", "21 calendar days"],
      ]
    ),

    heading("8.3 Claims Procedure", 2),
    para("8.3.1. Claims must be filed via the DPD Enterprise Claims Portal (claims.dpd.com/enterprise) or by email to enterprise.claims@dpd.com within 21 calendar days of delivery or expected delivery date."),
    para("8.3.2. Required documentation: MCG order number, DPD tracking number, commercial invoice, photographs (for damage claims), statutory declaration (for loss claims exceeding EUR 1,000)."),
    para("8.3.3. DPD shall acknowledge receipt within 3 Business Days and provide a decision within 30 Business Days."),
    para("8.3.4. Approved claims shall be paid within 14 Business Days of approval via bank transfer to the MCG designated account."),
    para("8.3.5. Disputed claims may be escalated per the dispute resolution procedure in Section 11."),

    // ── SECTION 9: GDPR AND DATA PROCESSING ──
    heading("9. GDPR and Data Processing"),
    heading("9.1 Data Processing Agreement", 2),
    para("This Agreement is supplemented by Data Processing Agreement DPA-2022-DPD-EU-001, executed between MCG and DPD in compliance with Regulation (EU) 2016/679 (General Data Protection Regulation)."),
    para("9.1.1. DPD acts as a Data Processor with respect to personal data provided by MCG for delivery purposes (consignee name, address, phone number, email address)."),
    para("9.1.2. MCG acts as the Data Controller and determines the purposes and means of processing."),

    heading("9.2 Data Processing Scope", 2),
    para("DPD shall process the following categories of personal data solely for the purpose of parcel delivery and tracking:"),
    dataTable(
      ["Data Category", "Examples", "Retention Period", "Legal Basis"],
      [
        ["Consignee identification", "Full name", "12 months after delivery", "Contract performance"],
        ["Delivery address", "Street, city, postal code, country", "12 months after delivery", "Contract performance"],
        ["Contact details", "Phone number, email address", "12 months after delivery", "Contract performance"],
        ["Delivery preferences", "Time windows, Parcel Shop selection, neighbor consent", "12 months after delivery", "Legitimate interest"],
        ["Tracking data", "Scan events, timestamps, GPS coordinates", "24 months after delivery", "Legitimate interest"],
        ["Proof of delivery", "Signature, photo, recipient name", "36 months after delivery", "Legal obligation"],
      ]
    ),

    heading("9.3 Data Security Requirements", 2),
    para("DPD shall implement and maintain the following technical and organizational security measures:"),
    para("Encryption of personal data in transit (TLS 1.2 minimum) and at rest (AES-256)", { bullet: true }),
    para("Access controls based on the principle of least privilege", { bullet: true }),
    para("Regular security assessments and penetration testing (annually)", { bullet: true }),
    para("Incident response procedure with MCG notification within 72 hours of any personal data breach", { bullet: true }),
    para("Sub-processor management: DPD shall not engage additional sub-processors without MCG's prior written consent", { bullet: true }),

    heading("9.4 Data Subject Rights", 2),
    para("DPD shall assist MCG in fulfilling data subject requests (access, rectification, erasure, portability, objection) within the timeframes required by GDPR. DPD shall respond to MCG requests for assistance within 5 Business Days."),

    // ── SECTION 10: SEASONAL VOLUME AND CAPACITY ──
    heading("10. Seasonal Volume Commitments"),
    heading("10.1 MCG Volume Forecast", 2),
    dataTable(
      ["Quarter", "Projected Volume (parcels)", "Peak Daily Volume", "Capacity Reserved"],
      [
        ["Q1 2025 (Jan-Mar)", "480,000", "8,200/day (post-Christmas returns)", "10,000/day"],
        ["Q2 2025 (Apr-Jun)", "420,000", "5,800/day", "7,000/day"],
        ["Q3 2025 (Jul-Sep)", "460,000", "6,400/day (back-to-school)", "8,000/day"],
        ["Q4 2025 (Oct-Dec)", "740,000", "18,000/day (Black Week peak)", "22,000/day"],
      ]
    ),
    para("Annual projected volume: 2,100,000 parcels across all EU markets."),

    heading("10.2 Peak Season Provisions (Q4)", 2),
    para("10.2.1. DPD shall reserve capacity for MCG at the levels specified in Section 10.1 during Q4 2025."),
    para("10.2.2. MCG shall provide rolling 14-day volume forecasts during Q4 (October-December)."),
    para("10.2.3. Surge pricing: No surge multiplier applies if MCG volumes remain within 120% of the reserved capacity. Volumes exceeding 120% are subject to a 15% surcharge on the excess."),
    para("10.2.4. Key peak dates for 2025:"),
    para("Singles Day (11.11): 11-12 November", { bullet: true }),
    para("Black Friday: 28-30 November", { bullet: true }),
    para("Cyber Monday: 01 December", { bullet: true }),
    para("Pre-Christmas cutoff: 18 December (last day for guaranteed pre-Christmas delivery within EU)", { bullet: true }),
    para("Post-Christmas returns surge: 26 December - 15 January", { bullet: true }),

    // ── SECTION 11: DISPUTE RESOLUTION ──
    heading("11. Dispute Resolution"),
    para("11.1. Operational Disputes: Disputes relating to day-to-day operational matters shall be referred to the designated operational contacts (Sophie Muller for MCG; Klaus Weidmann for DPD) for resolution within 10 Business Days."),
    para("11.2. Management Escalation: If unresolved, disputes shall be escalated to senior management (Director level or above) for resolution within 20 Business Days."),
    para("11.3. Mediation: If the dispute remains unresolved, the parties agree to submit it to mediation under the ICC Mediation Rules."),
    para("11.4. Arbitration: If mediation is unsuccessful within 45 days, the dispute shall be finally resolved by arbitration under the ICC Arbitration Rules. The arbitration shall be seated in Rotterdam, conducted in English, and decided by a sole arbitrator."),
    para("11.5. Governing Law: This Agreement shall be governed by the laws of the Netherlands."),

    // ── SECTION 12: FORCE MAJEURE ──
    heading("12. Force Majeure"),
    para("12.1. Neither party shall be liable for delays or failures resulting from Force Majeure events, including but not limited to: natural disasters, epidemics, pandemics, government restrictions (including border closures and customs delays), war, terrorism, civil unrest, industrial action, and failure of third-party infrastructure."),
    para("12.2. The affected party shall notify the other within 48 hours and provide regular updates on the expected duration and mitigation measures."),
    para("12.3. If a Force Majeure event continues for more than 90 consecutive days, either party may terminate this Agreement with 30 days notice."),
    para("12.4. Force Majeure shall NOT excuse: (a) payment obligations for services already rendered; (b) failure to maintain data feeds where DPD systems are operational; (c) pre-existing performance deficiencies."),

    // ── SECTION 13: TERMINATION ──
    heading("13. Termination"),
    para("13.1. Term: This Service Agreement is effective for the 2025 calendar year and shall automatically renew for successive 12-month periods unless either party provides 90 days written notice of non-renewal."),
    para("13.2. Termination for Convenience: Either party may terminate with 90 days written notice at any time."),
    para("13.3. Termination for Cause: Either party may terminate immediately upon written notice if the other party: (a) commits a material breach not cured within 30 days; (b) becomes insolvent; (c) undergoes a change of control that materially affects its ability to perform."),
    para("13.4. Termination for Persistent Failure: MCG may terminate with 60 days notice if any SLA metric remains in the Critical band for 3 or more consecutive months."),
    para("13.5. Transition Assistance: Upon termination, DPD shall provide reasonable transition assistance for up to 90 days, including continued delivery of parcels in transit and data migration support."),

    // ── SECTION 14: CONFIDENTIALITY ──
    heading("14. Confidentiality"),
    para("14.1. All commercial terms, pricing, volume data, and technical specifications contained in this Agreement are Confidential Information of the disclosing party."),
    para("14.2. Each party shall protect Confidential Information with at least the same degree of care it uses for its own confidential information, and in no event less than reasonable care."),
    para("14.3. Confidentiality obligations survive termination for 5 years."),
    para("14.4. Exceptions: Confidentiality obligations do not apply to information that: (a) is publicly available; (b) was known to the receiving party prior to disclosure; (c) is independently developed; (d) is required to be disclosed by law or regulation."),

    // ── SECTION 15: CONTACT DETAILS ──
    heading("15. Contact Details"),
    heading("15.1 MCG Contacts", 2),
    dataTable(
      ["Role", "Name", "Email", "Phone"],
      [
        ["EU Logistics Manager", "Sophie Muller", "smuller@meridiancommerce.com", "+31 10 798 4200"],
        ["EU Operations Coordinator", "Jan van Dijk", "jvandijk@meridiancommerce.com", "+31 10 798 4205"],
        ["NL Warehouse Manager", "Peter Bakker", "pbakker@meridiancommerce.com", "+31 10 798 4210"],
        ["DE Operations Lead", "Markus Weber", "mweber@meridiancommerce.com", "+49 69 234 5678"],
        ["Finance — EU Carrier Billing", "Anke de Vries", "adevries@meridiancommerce.com", "+31 10 798 4220"],
        ["Legal Counsel, EU", "Isabelle Laurent", "ilaurent@meridiancommerce.com", "+31 10 798 4230"],
        ["VP Supply Chain", "Thomas Brennan", "tbrennan@meridiancommerce.com", "+31 10 798 4100"],
      ]
    ),
    heading("15.2 DPD Contacts", 2),
    dataTable(
      ["Role", "Name", "Email", "Phone"],
      [
        ["Key Account Manager", "Klaus Weidmann", "klaus.weidmann@dpd.com", "+49 6461 890 1234"],
        ["NL Operations Manager", "Erik van der Berg", "erik.vanderberg@dpd.nl", "+31 88 400 1234"],
        ["DE Operations Manager", "Heike Schneider", "heike.schneider@dpd.de", "+49 6461 890 2345"],
        ["Technical Integration Lead", "Florian Bauer", "florian.bauer@dpd.com", "+49 6461 890 3456"],
        ["Enterprise Claims", "Claudia Richter", "enterprise.claims@dpd.com", "+49 6461 890 4567"],
        ["IT Service Desk", "DPD Enterprise Support", "enterprise.support@dpd.com", "+49 6461 890 5000"],
      ]
    ),

    // ── SECTION 16: GENERAL PROVISIONS ──
    heading("16. General Provisions"),
    para("16.1. Entire Agreement: This Service Agreement, together with the Master Agreement MSA-2022-DPD-EU-001, the Data Processing Agreement DPA-2022-DPD-EU-001, and all Schedules and Appendices, constitutes the entire agreement between the parties."),
    para("16.2. Amendments: No amendment to this Agreement shall be effective unless made in writing and signed by authorized representatives of both parties."),
    para("16.3. Severability: If any provision is found invalid or unenforceable, the remaining provisions shall continue in full force and effect."),
    para("16.4. Waiver: No waiver of any provision shall constitute a continuing waiver or a waiver of any other provision."),
    para("16.5. Assignment: Neither party may assign this Agreement without prior written consent, except in connection with a merger, acquisition, or corporate reorganization."),
    para("16.6. Language: This Agreement is executed in English. In the event of any conflict between the English version and any translation, the English version shall prevail."),
    para("16.7. Notices: All notices shall be in writing and sent to the addresses specified in Section 15, by registered mail, courier, or email with read receipt confirmation."),
    para("16.8. Counterparts: This Agreement may be executed in counterparts and by electronic signature (per eIDAS Regulation)."),

    // ── SIGNATURES ──
    heading("17. Execution"),
    para("IN WITNESS WHEREOF, the parties have caused this Agreement to be executed by their duly authorized representatives."),
    para("Date of Execution: 15 December 2024"),
    para("Place of Execution: Rotterdam, the Netherlands"),

    ...signatureBlock("Sophie Muller", "EU Logistics Manager", "Meridian Commerce Group B.V."),
    ...signatureBlock("Klaus Weidmann", "Key Account Manager", "DPDgroup SAS"),
    ...signatureBlock("Thomas Brennan", "VP Supply Chain (Countersignature)", "Meridian Commerce Group"),
    ...signatureBlock("Markus Schaefer", "Director of Enterprise Sales (Countersignature)", "DPDgroup SAS"),
  ]);
}


// ─── RUN ───
async function main() {
  console.log("Generating ENRICHED carrier contracts...");
  await saveDocument(carrierNV(), path.join(CARRIERS, "CARRIER-NV-2025_NinjaVan_Contract_Amendment.docx"));
  await saveDocument(carrierFedEx(), path.join(CARRIERS, "CARRIER-FEDEX-2025_Rate_Card.docx"));
  await saveDocument(carrierDPD(), path.join(CARRIERS, "CARRIER-DPD-2025_Service_Agreement.docx"));
  console.log("Done — 3 enriched carrier contracts generated.");
}

main().catch((err) => { console.error(err); process.exit(1); });
