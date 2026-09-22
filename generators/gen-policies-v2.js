// Generate ENRICHED policy DOCX files — moderate depth for Qlik Answers
const {
  buildDocument, saveDocument,
  metadataTable, dataTable,
  heading, para, labelValue, calloutBox, numberedItem, signatureBlock,
} = require("./mcg-docx-builder");
const path = require("path");
const { deck, doc, DOCS_DIR } = require("./lib/asset-paths");
const OUT = doc("policies");

function pol007() {
  return buildDocument("CORPORATE POLICY", [
    heading("MCG-POL-007: EU Food Safety and Traceability Compliance"),
    metadataTable([
      ["Policy ID", "MCG-POL-007"],
      ["Version", "3.1"],
      ["Effective Date", "01 February 2025"],
      ["Owner", "Dr. Elena Vasquez, Chief Compliance Officer"],
      ["Approved By", "Ingrid van der Berg, CEO"],
      ["Regulatory Basis", "EU Regulation (EC) No 178/2002; NVWA Guidelines 2024"],
      ["Classification", "Internal — All Business Units handling food products"],
      ["Applies To", "All MCG operations in EU-27 markets"],
    ]),

    heading("1. Purpose"),
    para("This policy establishes MCG's mandatory requirements for food safety compliance and product traceability across all EU operations. It ensures compliance with Article 18 of EU Regulation (EC) No 178/2002, which requires food business operators to trace products 'one step back, one step forward' in the supply chain."),
    para("Non-compliance carries significant regulatory, financial, and reputational risk. The June 2025 NVWA citation demonstrated that MCG's current traceability infrastructure is inadequate for regulatory requirements."),

    heading("2. Scope"),
    para("Applies to all MCG operations handling food products in EU-27 markets:"),
    para("Product categories: Fresh produce, dairy, frozen goods, beverages, health & wellness supplements, eggs, bakery, confectionery", { bullet: true }),
    para("Facilities: All 28 DCs handling food (22 with cold chain capability) and all 1,140 retail stores", { bullet: true }),
    para("Channels: In-store retail, e-commerce, wholesale/B2B, marketplace fulfillment", { bullet: true }),
    para("Supply chain: 340 direct suppliers and approximately 1,200 sub-tier suppliers (actual number uncertain — mapping in progress)", { bullet: true }),

    heading("3. Article 18 Requirements — Traceability"),
    para("EU Regulation (EC) No 178/2002, Article 18 mandates that food business operators must be able to identify:"),
    numberedItem(1, "One step back: The supplier of every food product (who supplied it, when, what product, what lot)"),
    numberedItem(2, "One step forward: The business customer or store to which every food product was supplied (who received it, when, what quantity)"),
    numberedItem(3, "Product identification: Lot number, product description, quantity, date of transaction"),
    para("Target response time for a complete traceability query: 24 hours.", { bold: true }),
    calloutBox("CURRENT PERFORMANCE: The June 2025 lettuce recall (RCL-2025-003) required 11 days and 65 person-hours of manual cross-referencing across 4 disconnected systems (SAP, WMS, Descartes TMS, Meridian CRM) to complete full product tracing. This is 10 days beyond the 24-hour regulatory target.", "critical"),

    heading("4. Mandatory Data Elements"),
    dataTable(
      ["Data Element", "Requirement", "Current Compliance", "Target", "Gap Owner"],
      [
        ["Lot number", "Mandatory for all food receipts", "93%", "100%", "VP Warehouse Ops"],
        ["Country of origin", "Mandatory for fresh produce", "88%", "100%", "Procurement"],
        ["Supplier identification", "Linked to business register", "93%", "100%", "Procurement"],
        ["Receipt date/time", "Timestamped per delivery", "100% (timezone issues)", "100% clean", "IT Operations"],
        ["Store-level lot tracking", "Receipt by lot at retail stores", "32%", "90% by Mar 2026", "Store Operations"],
        ["Sub-tier supplier mapping", "Required for high-risk products", "36%", "80% by Jan 2026", "Procurement"],
        ["Expiry/best-before date", "Recorded at receipt", "91%", "100%", "VP Warehouse Ops"],
        ["Temperature at receipt", "Recorded for cold chain products", "97%", "100%", "Quality"],
      ]
    ),

    heading("5. NVWA Citation — June 2025"),
    para("On 12 June 2025, the Netherlands Food and Consumer Product Safety Authority (NVWA) conducted a routine inspection at MCG's Rotterdam DC (Europaweg 120, 3199 LD Rotterdam) and issued Citation NVWA-2025-CIT-04412:"),
    dataTable(
      ["Finding", "Severity", "Description", "Corrective Action"],
      [
        ["F1", "Major", "Lot numbers not consistently captured — free-text field allowed blank entries", "WMS field converted to structured input with validation; blank blocked"],
        ["F2", "Major", "Unable to complete product trace from supplier to store within 24 hours", "Project Qlarity Phase 1 — unified traceability layer"],
        ["F3", "Significant", "Country of origin missing for 12% of fresh produce SKUs", "Procurement updating supplier requirements; 88% complete"],
        ["F4", "Significant", "Sub-tier supplier relationships not documented for 64% of food suppliers", "Supplier mapping program; 36% complete (at risk)"],
        ["F5", "Observation", "Temperature recording at goods receipt uses inconsistent timestamp formats", "Timestamp standardization planned under Project Qlarity"],
      ]
    ),
    para("MCG submitted corrective action plan COMP-2025-NVWA on 15 July 2025. NVWA follow-up inspection expected Q1 2026."),
    calloutBox("Sub-tier mapping (F4) is AT RISK at only 36% complete. Many suppliers cite commercial confidentiality. The Fresh Direct lettuce recall exposed this exact risk — the contaminated farm (FARM-NL-0042) was an undisclosed backup supplier.", "warning"),

    heading("6. Record Retention"),
    para("All traceability records must be maintained for a minimum of 5 years per EU Regulation 178/2002. This includes:"),
    para("Purchase orders and goods receipt records (SAP and WMS)", { bullet: true }),
    para("Lot number capture records and quality inspection results", { bullet: true }),
    para("Temperature monitoring records (IoT telemetry and manual readings)", { bullet: true }),
    para("Supplier certifications and audit reports", { bullet: true }),
    para("Recall documentation and regulatory correspondence", { bullet: true }),

    heading("7. Roles and Responsibilities"),
    dataTable(
      ["Role", "Responsibility"],
      [
        ["Chief Compliance Officer (Dr. Elena Vasquez)", "Policy ownership; regulatory liaison; NVWA primary contact; recall authority"],
        ["VP Warehouse Operations (Henrik Jansen)", "Lot number capture at all DCs; goods receipt compliance; cycle count for food traceability"],
        ["VP Supply Chain (Thomas Brennan)", "Cold chain compliance; carrier food safety requirements; in-transit traceability"],
        ["Head of Procurement", "Supplier qualification; sub-tier mapping; country of origin data collection"],
        ["CDO (Priya Ramanathan)", "Data quality monitoring for traceability elements; Project Qlarity delivery"],
        ["Store Operations VPs", "Store-level lot tracking deployment; recall execution at retail"],
        ["Quality Managers (per DC)", "Receiving inspection; temperature verification; rejection authority for non-compliant deliveries"],
      ]
    ),

    heading("8. Non-Compliance Consequences"),
    para("Internal: Failure to comply with this policy will result in escalation to the CCO and may affect individual performance evaluations. Repeated non-compliance at a facility level triggers a formal compliance audit."),
    para("External: Regulatory non-compliance may result in:"),
    para("NVWA citations and fines (up to €820,000 per incident under Dutch food safety law)", { bullet: true }),
    para("Mandatory product recalls at MCG's expense", { bullet: true }),
    para("Suspension of food handling permits for affected facilities", { bullet: true }),
    para("Reputational damage and loss of consumer trust", { bullet: true }),

    heading("9. Revision History"),
    dataTable(
      ["Version", "Date", "Author", "Changes"],
      [
        ["1.0", "2019-03-01", "Legal Dept", "Initial release"],
        ["2.0", "2022-01-15", "E. Vasquez", "Updated for NVWA 2021 guidelines"],
        ["3.0", "2025-01-15", "E. Vasquez", "Post-lettuce recall comprehensive revision"],
        ["3.1", "2025-02-01", "E. Vasquez", "Added NVWA citation corrective actions; expanded data element table"],
      ]
    ),
    ...signatureBlock("Dr. Elena Vasquez", "Chief Compliance Officer", "Legal & Compliance Division"),
    ...signatureBlock("Ingrid van der Berg", "Chief Executive Officer", "Meridian Commerce Group"),
  ]);
}

function pol012() {
  return buildDocument("CORPORATE POLICY", [
    heading("MCG-POL-012: Cold Chain Management Policy"),
    metadataTable([
      ["Policy ID", "MCG-POL-012"],
      ["Version", "2.3"],
      ["Effective Date", "01 April 2025"],
      ["Owner", "Thomas Brennan, VP Supply Chain"],
      ["Approved By", "Marcus Chen, CIO"],
      ["References", "SOP-SC-002, MCG-POL-007, INC-2025-05102, TRN-2025-002"],
    ]),

    heading("1. Purpose"),
    para("This policy mandates the requirements for maintaining cold chain integrity across MCG's perishable product supply chain, from supplier origin through warehouse storage and last-mile delivery to the customer. Cold chain failures cost MCG over $48M annually in spoilage losses, with the Q3 2025 LATAM corridor alone contributing $2.48M in a single quarter."),

    heading("2. Temperature Standards"),
    dataTable(
      ["Product Category", "Storage Temp", "Transport Temp", "Max Exceedance", "Sensor Required"],
      [
        ["Fresh produce (leafy, berries)", "1-5°C", "1-5°C", "30 min > 8°C", "Yes — Tive 5G"],
        ["Root vegetables", "4-10°C", "4-10°C", "60 min > 12°C", "Yes — Tive 5G"],
        ["Dairy (milk, cheese, yogurt)", "2-6°C", "2-6°C", "15 min > 8°C", "Yes — Tive 5G"],
        ["Frozen goods", "-25 to -18°C", "-22 to -18°C", "ZERO tolerance > -15°C", "Yes — Tive 5G"],
        ["Pharmaceuticals", "2-8°C", "2-8°C", "ZERO tolerance outside range", "Yes — Sensitech"],
        ["Chilled beverages", "3-7°C", "3-7°C", "60 min > 10°C", "Yes — Tive 5G"],
        ["Eggs", "5-12°C", "5-12°C", "60 min > 15°C", "Regional (EU only)"],
      ]
    ),

    heading("3. IoT Monitoring Coverage"),
    dataTable(
      ["Region", "Coverage", "Target (FY2026)", "Provider", "Interval", "Known Issues"],
      [
        ["EU", "95%", "99%", "Tive Solo 5G", "5 min", "None significant"],
        ["Americas", "88%", "95%", "Tive + Sensitech", "5 min", "Fahrenheit data contamination Jul-Sep 2025 (47K readings)"],
        ["APAC", "85%", "95%", "Tive Solo 5G", "10 min", "Higher intervals due to data costs"],
        ["LATAM", "72%", "90%", "Tive Solo 5G", "5 min", "Border crossing connectivity gaps"],
        ["Africa", "45%", "75%", "Tive Solo 5G", "15 min", "Lagos DC: 6-hour daily connectivity blackout"],
      ]
    ),

    heading("4. Known Data Quality Issues"),
    calloutBox("AMERICAS FAHRENHEIT CONTAMINATION: Between July and September 2025, Tive sensors in Americas were configured to report in Fahrenheit without a unit indicator. A reading of '41' could mean 41°F (5°C, fine) or 41°C (catastrophic). Approximately 47,000 readings affected. Data remediation in progress. All sensors reconfigured to Celsius as of October 2025.", "critical"),
    calloutBox("LAGOS DC CONNECTIVITY: Daily 6-hour internet blackout (typically 11:00-17:00 WAT). Sensors buffer locally and upload when connectivity resumes. Temperature exceedances may go undetected for up to 6 hours. Manual checks every 30 minutes required during blackout. Satellite backup (Starlink) budgeted for Q2 2026.", "warning"),

    heading("5. Carrier Requirements"),
    para("All carriers transporting MCG temperature-sensitive products must:"),
    numberedItem(1, "Pre-cool transport units to 0°C BEFORE loading (tightened from 2°C after TransFrio incident). Reefer must show target temp for 15 minutes before doors open."),
    numberedItem(2, "Maintain continuous temperature logging throughout transport."),
    numberedItem(3, "Share real-time telemetry with MCG (API preferred; SFTP daily file minimum)."),
    numberedItem(4, "NOT turn off refrigeration during rest stops, refueling, or border waits. Carriers on routes with extended border crossings must have auxiliary power units (APUs)."),
    numberedItem(5, "Report any temperature exceedance to MCG within 1 hour of detection."),
    para("Reference: INC-2025-05102 (TransFrio LATAM spoilage) — $2.48M losses from carrier refrigeration gap and border crossing delays.", { italics: true }),

    heading("6. Product Disposition Decision"),
    dataTable(
      ["Exceedance Duration", "Product Category", "Decision", "Authority"],
      [
        ["< 15 min, minor (within +2°C)", "All", "Accept with monitoring", "Quality Inspector"],
        ["15-30 min", "Fresh produce, dairy", "Quarantine for assessment", "Quality Manager"],
        ["15-30 min", "Frozen (no thaw detected)", "Accept with documentation", "Quality Inspector"],
        ["> 30 min", "Fresh produce, dairy", "Reject — do not accept delivery", "Quality Manager"],
        ["Any thaw above -15°C", "Frozen goods", "Reject — immediate disposal", "Quality Manager"],
        ["Any exceedance", "Pharmaceuticals", "Reject — return to supplier", "Quality Manager + Compliance"],
      ]
    ),

    heading("7. Revision History"),
    dataTable(
      ["Version", "Date", "Author", "Changes"],
      [
        ["1.0", "2022-06-01", "T. Brennan", "Initial release"],
        ["2.0", "2024-09-01", "T. Brennan", "Added IoT coverage targets; pharmaceutical requirements"],
        ["2.3", "2025-04-01", "T. Brennan", "Post-TransFrio: tightened pre-cooling to 0°C; APU requirement; Lagos blackout documentation"],
      ]
    ),
    ...signatureBlock("Thomas Brennan", "VP Supply Chain", "Global Supply Chain Division"),
  ]);
}

function pol015() {
  return buildDocument("CORPORATE POLICY", [
    heading("MCG-POL-015: Enterprise Data Quality Standards"),
    metadataTable([
      ["Policy ID", "MCG-POL-015"],
      ["Version", "1.2"],
      ["Effective Date", "01 May 2025"],
      ["Owner", "Priya Ramanathan, Chief Data Officer"],
      ["Approved By", "Marcus Chen, CIO"],
      ["Classification", "Internal — All Business Units"],
    ]),

    heading("1. Purpose"),
    para("This policy establishes enterprise-wide data quality standards for Meridian Commerce Group. MCG's Q3 2025 data health assessment identified $127M in annual losses attributable to data quality issues across seven identified problem areas ('The Seven Data Quality Nightmares'). This policy provides the governance framework to measure, monitor, and improve data quality."),

    heading("2. Six Dimensions of Data Quality"),
    dataTable(
      ["Dimension", "Definition", "Measurement Method", "Current", "Target", "Gap"],
      [
        ["Completeness", "Required fields are populated with non-null values", "% of mandatory fields populated across CDEs", "82%", "98%", "-16%"],
        ["Accuracy", "Values match real-world truth (verified by physical audit or external source)", "Sample audit against physical counts, address validation services, supplier registers", "74%", "97%", "-23%"],
        ["Timeliness", "Data is available within the required time window after the real-world event", "Latency between real event and system record; pipeline freshness checks", "68%", "95%", "-27%"],
        ["Consistency", "Same fact is represented the same way across all systems", "Cross-system matching rate for CDEs (e.g., inventory in WMS vs SAP)", "61%", "95%", "-34%"],
        ["Uniqueness", "No unintended duplicate records for the same real-world entity", "Duplicate detection rate using fuzzy matching (supplier names, customer addresses)", "79%", "99%", "-20%"],
        ["Validity", "Values conform to defined business rules and acceptable ranges", "Business rule pass rate (e.g., temperatures within bounds, quantities non-negative)", "77%", "98%", "-21%"],
      ]
    ),

    heading("3. Critical Data Elements (CDEs)"),
    para("The following CDEs are prioritized for quality improvement based on financial impact:"),
    dataTable(
      ["CDE", "Score", "Target", "Nightmare", "Annual Impact", "Domain Owner"],
      [
        ["Inventory position accuracy", "74%", "97%", "#1 Phantom Inventory", "$48.0M", "VP Warehouse Ops"],
        ["Carrier tracking completeness", "58%", "95%", "#6 Carrier Black Hole", "$14.8M", "VP Supply Chain"],
        ["Pipeline health/freshness", "None", "99.5% uptime", "#4 Silent Pipelines", "$12.0M", "CIO"],
        ["Product weight/dimensions", "71%", "99%", "#3 Product Master", "$8.2M", "Head of Procurement"],
        ["Timestamp timezone consistency", "64%", "100%", "#5 Timestamp Babel", "$6.5M", "CIO"],
        ["Lot-level traceability", "85%", "100%", "#7 Compliance Gap", "$4.2M", "CCO"],
        ["Address deliverability", "82%", "98%", "#2 Address Catastrophe", "$3.1M", "Head of E-Commerce"],
        ["Supplier identity (dedup)", "76%", "99%", "#3 Product Master", "Included above", "Head of Procurement"],
      ]
    ),
    labelValue("Total Annual Impact from Data Quality Issues", "$127M (conservative, directly attributable costs only)"),

    heading("4. Current State: No Enterprise Monitoring"),
    calloutBox("MCG currently has NO automated enterprise-wide data quality monitoring. Data quality is measured through periodic manual assessments, cycle count results, and incident-driven investigations. The Rotterdam pipeline failure (INC-2025-04872) went undetected for 4.3 days because no system monitors data freshness or pipeline health.", "critical"),
    para("Planned state under Project Qlarity Phase 2:"),
    para("Automated data profiling on all source systems at ingestion (Qlik Talend Cloud)", { bullet: true }),
    para("Real-time data quality dashboards with Trust Score trending (Qlik Analytics)", { bullet: true }),
    para("Automated alerting when quality thresholds are breached", { bullet: true }),
    para("Data stewardship workflows for issue resolution with SLA tracking", { bullet: true }),
    para("Trust Score for AI to validate data suitability for ML/AI models", { bullet: true }),

    heading("5. Accountability Framework"),
    dataTable(
      ["Role", "Responsibility", "Reporting"],
      [
        ["Chief Data Officer", "Enterprise data quality strategy; policy ownership; Project Qlarity sponsorship", "Quarterly to CEO and Board"],
        ["Data Domain Owners", "Quality targets and improvement plans for their domain CDEs; root cause resolution", "Monthly to CDO"],
        ["Data Stewards", "Day-to-day quality issue investigation and resolution; stewardship task completion", "Weekly to Domain Owner"],
        ["IT Operations", "Pipeline monitoring and alerting; infrastructure for data quality tools", "Real-time dashboards"],
        ["Business Unit Heads", "Reporting data quality issues; adopting data quality processes; funding remediation", "Quarterly to CDO"],
      ]
    ),

    heading("6. Data Quality Incident Classification"),
    dataTable(
      ["Severity", "Definition", "Example", "Response SLA"],
      [
        ["Critical", "Data issue causing regulatory risk, financial loss > $100K, or customer safety impact", "Pipeline failure creating phantom inventory; lot number missing for food recall", "Immediate escalation to CDO"],
        ["Major", "Data issue affecting operational decisions or causing financial loss $10K-$100K", "Carrier tracking data gap affecting 1000+ shipments; address quality causing delivery failures", "Resolution within 48 hours"],
        ["Minor", "Data issue with limited operational impact or financial loss < $10K", "Duplicate supplier record; inconsistent product category mapping", "Resolution within 5 business days"],
      ]
    ),

    heading("7. Revision History"),
    dataTable(
      ["Version", "Date", "Author", "Changes"],
      [
        ["1.0", "2025-01-15", "P. Ramanathan", "Initial release following Q3 2025 data health assessment"],
        ["1.2", "2025-05-01", "P. Ramanathan", "Added CDE table with financial impact; incident classification; accountability framework"],
      ]
    ),
    ...signatureBlock("Priya Ramanathan", "Chief Data Officer", "Data & Analytics Division"),
  ]);
}

function pol020() {
  return buildDocument("CORPORATE POLICY", [
    heading("MCG-POL-020: E-Commerce Shipping and Delivery Promise"),
    metadataTable([
      ["Policy ID", "MCG-POL-020"],
      ["Version", "2.1"],
      ["Effective Date", "20 October 2025"],
      ["Owner", "Lisa Park, Head of Customer Experience"],
      ["Approved By", "Thomas Brennan, VP Supply Chain"],
      ["Applies To", "meridiancommerce.com — All Markets"],
    ]),

    heading("1. Purpose"),
    para("This policy defines the delivery promises displayed to customers at checkout on meridiancommerce.com. Delivery promises must be achievable based on actual carrier SLAs and must be updated promptly when carrier contracts change."),
    calloutBox("LESSON LEARNED: The NinjaVan AMD3 contract amendment (effective 01 October 2025) changed Singapore 5-10 kg delivery from 2-day to 3-day. This was NOT reflected on the website for 3+ weeks. During this period, ~14,000 customers per month received false 2-day delivery promises. WISMO contacts in Singapore spiked to 52% of all CS volume (vs 41% global average). This policy now includes mandatory change management procedures to prevent recurrence.", "critical"),

    heading("2. Delivery Promise Matrix"),
    dataTable(
      ["Region", "Weight Band", "Carrier", "Delivery Promise", "Actual Carrier SLA", "Match?"],
      [
        ["EU (NL, DE, BE)", "0-20 kg", "DPD Classic", "2-3 business days", "2-3 BD", "✓"],
        ["EU (other)", "0-20 kg", "DPD International", "3-7 business days", "3-7 BD", "✓"],
        ["Americas (US)", "0-10 lb", "FedEx Ground", "3-5 business days", "3-5 BD", "✓"],
        ["Americas (US)", "10-50 lb", "FedEx Ground", "5-7 business days", "5-7 BD", "✓"],
        ["Singapore", "0-5 kg", "NinjaVan Express", "Next-day delivery", "Next-day", "✓"],
        ["Singapore", "5-10 kg", "NinjaVan Standard", "3 business days", "3 BD (changed Oct 1)", "✓ (fixed Oct 20)"],
        ["Singapore", "10-20 kg", "NinjaVan Standard", "3 business days", "3 BD", "✓"],
        ["APAC (other)", "All", "Regional carriers", "3-7 business days", "Varies", "~"],
        ["Africa (Lagos)", "All", "Local carriers", "5-10 business days", "Highly variable", "~"],
        ["LATAM", "All", "Local + TransFrio (cold)", "5-10 business days", "Varies", "~"],
      ]
    ),

    heading("3. Delivery Promise Accuracy"),
    dataTable(
      ["Region", "Q1 2025", "Q2 2025", "Q3 2025", "Target"],
      [
        ["EU (core: NL, DE, BE, FR)", "92%", "91%", "87%", "95%"],
        ["EU (other)", "85%", "84%", "81%", "90%"],
        ["Americas (US, CA)", "92%", "93%", "91%", "95%"],
        ["APAC (Singapore)", "91%", "88%", "69% ⚠", "95%"],
        ["APAC (other)", "83%", "82%", "79%", "90%"],
        ["Africa", "74%", "72%", "68%", "85%"],
        ["LATAM", "78%", "76%", "71%", "85%"],
        ["Global weighted average", "88%", "87%", "82% ⚠", "93%"],
      ]
    ),

    heading("4. Carrier SLA Change Management (NEW — October 2025)"),
    para("When ANY carrier SLA changes (new contract, amendment, seasonal adjustment, or unilateral carrier change):"),
    numberedItem(1, "Carrier Management must notify the e-commerce team AND customer service within 24 hours of learning about the change (email to delivery-promise@meridiancommerce.com)."),
    numberedItem(2, "E-Commerce team must update the delivery promise on the website within 48 hours of notification."),
    numberedItem(3, "Customer Service must be briefed with updated scripts and FAQ within 24 hours."),
    numberedItem(4, "For orders already placed with the old promise: send proactive email notification to affected customers within 72 hours."),
    numberedItem(5, "Monthly audit: Carrier Management must verify all active carrier SLAs match the promises displayed on the website. Audit results reported to VP Supply Chain and Head of Customer Experience."),
    calloutBox("These requirements are NEW as of October 2025, instituted after the NinjaVan incident. Previously, there was no formal process for carrier-to-e-commerce SLA change communication.", "info"),

    heading("5. WISMO Impact"),
    para("Delivery promise failures are the primary driver of WISMO contacts:"),
    para("536,000 WISMO contacts per month (41% of all CS contacts)", { bullet: true }),
    para("Annual cost: $14.8M at $2.30 per contact", { bullet: true }),
    para("Singapore WISMO rate reached 52% during the NinjaVan promise mismatch period", { bullet: true }),
    para("Repeat WISMO callers (same order, 2+ calls): 28%, up from 19% in FY2024", { bullet: true }),
    para("NPS impact: WISMO callers score -18 points below non-callers", { bullet: true }),

    heading("6. Promise Failure Compensation"),
    dataTable(
      ["Delay vs Promise", "Automatic Compensation", "Agent Authority"],
      [
        ["1-2 days late", "Proactive email apology", "10% discount code for next order"],
        ["3-5 days late", "Proactive email + discount code sent automatically", "Full shipping refund"],
        ["> 5 days late", "Full shipping refund + 15% discount code", "Re-ship express at no cost (up to $100)"],
        ["> 10 days or lost", "Full order refund processed automatically", "Re-ship + courtesy credit ($25)"],
      ]
    ),

    heading("7. Revision History"),
    dataTable(
      ["Version", "Date", "Author", "Changes"],
      [
        ["1.0", "2023-06-01", "L. Park", "Initial release"],
        ["2.0", "2025-08-01", "L. Park", "Added regional delivery matrix; WISMO impact analysis"],
        ["2.1", "2025-10-20", "L. Park", "Singapore 5-10 kg updated after NinjaVan AMD3; added change management section; compensation matrix"],
      ]
    ),
    ...signatureBlock("Lisa Park", "Head of Customer Experience", "Customer Service Division"),
  ]);
}

async function main() {
  console.log("Generating enriched policies...");
  await saveDocument(pol007(), path.join(OUT, "MCG-POL-007_EU_Food_Safety_Compliance.docx"));
  await saveDocument(pol012(), path.join(OUT, "MCG-POL-012_Cold_Chain_Management.docx"));
  await saveDocument(pol015(), path.join(OUT, "MCG-POL-015_Data_Quality_Standards.docx"));
  await saveDocument(pol020(), path.join(OUT, "MCG-POL-020_Shipping_Delivery_Promise.docx"));
  console.log("✅ 4 enriched policies generated.");
}

main().catch((err) => { console.error(err); process.exit(1); });
