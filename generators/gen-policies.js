// Generate Policy DOCX files
const {
  buildDocument, saveDocument,
  metadataTable, dataTable,
  heading, para, labelValue, calloutBox, numberedItem, signatureBlock,
} = require("./mcg-docx-builder");
const path = require("path");

const OUT = path.join(__dirname, "..", "documents", "policies");

// ═══ MCG-POL-007: EU Food Safety Compliance ═══
function pol007() {
  return buildDocument("CORPORATE POLICY", [
    heading("MCG-POL-007: EU Food Safety and Traceability Compliance"),
    metadataTable([
      ["Policy ID", "MCG-POL-007"],
      ["Version", "3.1"],
      ["Effective Date", "01 February 2025"],
      ["Last Reviewed", "15 August 2025"],
      ["Owner", "Dr. Elena Vasquez, Chief Compliance Officer"],
      ["Approved By", "Ingrid van der Berg, CEO"],
      ["Regulatory Basis", "EU Regulation (EC) No 178/2002; NVWA Guidelines 2024"],
    ]),

    heading("1. Purpose"),
    para("This policy establishes MCG's mandatory requirements for food safety compliance and product traceability across all EU operations. It ensures compliance with Article 18 of EU Regulation (EC) No 178/2002, which requires food business operators to trace products 'one step back, one step forward' in the supply chain."),

    heading("2. Scope"),
    para("Applies to all MCG operations handling food products in EU-27 markets, including:"),
    para("Fresh produce, dairy, frozen goods, beverages, health & wellness supplements", { bullet: true }),
    para("All 28 distribution centers handling food products", { bullet: true }),
    para("All 1,140 retail stores (Meridian Market and MCG Express formats)", { bullet: true }),
    para("E-commerce fulfillment for food products", { bullet: true }),

    heading("3. Regulatory Requirements"),
    heading("3.1 Article 18 — Traceability", 2),
    para("MCG must be able to identify:"),
    numberedItem(1, "The supplier of every food product (one step back)"),
    numberedItem(2, "The business customer/store to whom every food product was supplied (one step forward)"),
    numberedItem(3, "The date of transaction and product identification (lot number)"),
    para("Target response time for traceability query: 24 hours", { bold: true }),
    calloutBox("CURRENT PERFORMANCE: The June 2025 lettuce recall (RCL-2025-003) demonstrated that MCG's current traceability capability requires 11 days to complete full product trace — 10 days beyond the regulatory target.", "critical"),

    heading("3.2 Mandatory Data Elements", 2),
    dataTable(
      ["Data Element", "Requirement", "Current Compliance", "Gap"],
      [
        ["Lot number", "Mandatory for all food products", "85% capture rate", "15% missing"],
        ["Country of origin", "Mandatory for fresh produce", "88% complete", "12% missing"],
        ["Supplier identification", "Linked to business register", "93% standardized", "7% inconsistent"],
        ["Receipt date/time", "Timestamped per delivery", "100% (but timezone issues)", "Quality concern"],
        ["Store-level receipt tracking", "By lot number", "32% of stores", "68% gap ⚠"],
        ["Sub-tier supplier mapping", "Required for high-risk products", "36% mapped", "64% gap ⚠"],
      ]
    ),

    heading("4. NVWA Citation — June 2025"),
    para("On 12 June 2025, the Netherlands Food and Consumer Product Safety Authority (NVWA) conducted a routine inspection at MCG's Rotterdam DC and issued Citation NVWA-2025-CIT-04412 with the following findings:"),
    dataTable(
      ["Finding", "Severity", "Description"],
      [
        ["F1", "Major", "Lot numbers not consistently captured at goods receipt (free-text field allowed blank entries)"],
        ["F2", "Major", "Unable to complete product trace from supplier to store within 24 hours"],
        ["F3", "Significant", "Country of origin missing for 12% of fresh produce SKUs"],
        ["F4", "Significant", "Sub-tier supplier relationships not documented for 64% of food suppliers"],
        ["F5", "Observation", "Temperature recording at goods receipt uses inconsistent timestamp formats"],
      ]
    ),
    calloutBox("MCG submitted corrective action plan COMP-2025-NVWA on 15 July 2025. NVWA follow-up inspection expected Q1 2026.", "warning"),

    heading("5. Corrective Action Requirements"),
    para("All food-handling facilities must implement the following by their respective deadlines:"),
    numberedItem(1, "Lot number capture: Convert from free-text to structured field with validation. Reject receipts without valid lot numbers. Target: 100% capture by 01 October 2025."),
    numberedItem(2, "Store receipt tracking: Deploy lot-level tracking at all EU stores. Target: 90% by 01 March 2026."),
    numberedItem(3, "Unified traceability: Implement single-query traceability across all 4 systems (SAP, WMS, TMS, Salesforce). Target: Project Qlarity Phase 1."),
    numberedItem(4, "Sub-tier supplier mapping: Complete mapping for all food suppliers. Target: 80% by 01 January 2026."),

    heading("6. Revision History"),
    dataTable(
      ["Version", "Date", "Author", "Changes"],
      [
        ["1.0", "2019-03-01", "Legal Dept", "Initial release"],
        ["2.0", "2022-01-15", "E. Vasquez", "Updated for NVWA 2021 guidelines"],
        ["3.0", "2025-01-15", "E. Vasquez", "Post-lettuce recall comprehensive revision"],
        ["3.1", "2025-02-01", "E. Vasquez", "Added NVWA citation corrective actions"],
      ]
    ),
    ...signatureBlock("Dr. Elena Vasquez", "Chief Compliance Officer", "Legal & Compliance Division"),
    ...signatureBlock("Ingrid van der Berg", "Chief Executive Officer", "Meridian Commerce Group"),
  ]);
}

// ═══ MCG-POL-012: Cold Chain Management ═══
function pol012() {
  return buildDocument("CORPORATE POLICY", [
    heading("MCG-POL-012: Cold Chain Management Policy"),
    metadataTable([
      ["Policy ID", "MCG-POL-012"],
      ["Version", "2.3"],
      ["Effective Date", "01 April 2025"],
      ["Owner", "Thomas Brennan, VP Supply Chain"],
      ["Approved By", "Marcus Chen, CIO"],
      ["References", "SOP-SC-002, MCG-POL-007"],
    ]),

    heading("1. Purpose"),
    para("This policy mandates the requirements for maintaining cold chain integrity across MCG's perishable product supply chain, from supplier origin through last-mile delivery to the customer."),

    heading("2. Temperature Standards"),
    dataTable(
      ["Product Category", "Storage Temp", "Transport Temp", "Max Door-Open Time"],
      [
        ["Fresh produce", "1-5°C", "1-5°C", "15 minutes"],
        ["Dairy products", "2-6°C", "2-6°C", "10 minutes"],
        ["Frozen goods", "-25 to -18°C", "-22 to -18°C", "5 minutes"],
        ["Pharmaceuticals", "2-8°C", "2-8°C", "0 (continuous seal)"],
        ["Chilled beverages", "3-7°C", "3-7°C", "20 minutes"],
      ]
    ),

    heading("3. IoT Monitoring Requirements"),
    para("All shipments of temperature-sensitive products MUST be accompanied by an IoT temperature sensor (Tive or Sensitech). Coverage targets:"),
    dataTable(
      ["Region", "Current Coverage", "Target (FY2026)", "Gap"],
      [
        ["EU", "95%", "99%", "4%"],
        ["Americas", "88%", "95%", "7%"],
        ["APAC", "85%", "95%", "10%"],
        ["Africa", "45%", "75%", "30% ⚠"],
      ]
    ),

    heading("4. Known Data Quality Issues"),
    calloutBox("Americas Fahrenheit Contamination: Between July and September 2025, Tive sensors in Americas were configured to report in Fahrenheit without a unit indicator. This affected approximately 47,000 telemetry readings. A data remediation effort is underway.", "warning"),
    calloutBox("Lagos DC Connectivity: The Lagos distribution center experiences 6-hour daily connectivity blackouts. Tive sensors buffer data locally but temperature exceedances may go undetected for up to 6 hours. Satellite backup connectivity is budgeted for Q2 2026.", "warning"),

    heading("5. Carrier Cold Chain Requirements"),
    para("All carriers transporting MCG perishable products must:"),
    numberedItem(1, "Pre-cool transport units to within 1°C of target temperature before loading."),
    numberedItem(2, "Maintain continuous temperature logging throughout transport."),
    numberedItem(3, "Share real-time telemetry data with MCG (or provide daily telemetry file)."),
    numberedItem(4, "Not turn off refrigeration units during rest stops or border waits."),
    numberedItem(5, "Report any temperature exceedance within 1 hour of detection."),

    heading("6. Revision History"),
    dataTable(
      ["Version", "Date", "Author", "Changes"],
      [
        ["1.0", "2022-06-01", "T. Brennan", "Initial release"],
        ["2.0", "2024-09-01", "T. Brennan", "Added IoT coverage targets"],
        ["2.3", "2025-04-01", "T. Brennan", "Updated post TransFrio incident, added carrier requirements"],
      ]
    ),
    ...signatureBlock("Thomas Brennan", "VP Supply Chain", "Global Supply Chain Division"),
  ]);
}

// ═══ MCG-POL-015: Data Quality Standards ═══
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
    para("This policy establishes enterprise-wide data quality standards for Meridian Commerce Group. It defines the six dimensions of data quality, measurement methods, and accountability framework."),
    calloutBox("CONTEXT: MCG's Q3 2025 data health assessment identified $127M in annual losses attributable to data quality issues across the Seven Data Quality Nightmares. This policy provides the governance framework to address these issues.", "critical"),

    heading("2. Data Quality Dimensions"),
    dataTable(
      ["Dimension", "Definition", "Current Score", "Target", "Gap"],
      [
        ["Completeness", "Required fields populated", "82%", "98%", "-16%"],
        ["Accuracy", "Values match real-world truth", "74%", "97%", "-23%"],
        ["Timeliness", "Data available when needed", "68%", "95%", "-27%"],
        ["Consistency", "Same value across systems", "61%", "95%", "-34%"],
        ["Uniqueness", "No unintended duplicates", "79%", "99%", "-20%"],
        ["Validity", "Values conform to business rules", "77%", "98%", "-21%"],
      ]
    ),

    heading("3. Critical Data Elements"),
    para("The following Critical Data Elements (CDEs) have been identified as highest-priority for quality improvement:"),
    dataTable(
      ["CDE", "Current Score", "Target", "Nightmare Link", "Annual Impact"],
      [
        ["Inventory position accuracy", "74%", "97%", "#1 Phantom Inventory", "$48M"],
        ["Address deliverability", "82%", "98%", "#2 Address Catastrophe", "$3.1M"],
        ["Product weight/dimensions", "71%", "99%", "#3 Product Master Mess", "$8.2M"],
        ["Pipeline health/freshness", "Unmonitored", "99.5% uptime", "#4 Silent Pipelines", "$12M"],
        ["Timestamp timezone consistency", "64%", "100%", "#5 Timestamp Babel", "$6.5M"],
        ["Carrier tracking completeness", "58%", "95%", "#6 Carrier Black Hole", "$14.8M"],
        ["Lot-level traceability", "85%", "100%", "#7 Compliance Gap", "$4.2M"],
      ]
    ),

    heading("4. Data Quality Monitoring"),
    para("Current state: MCG has NO automated enterprise-wide data quality monitoring.", { bold: true }),
    para("Planned state (Project Qlarity Phase 2):"),
    para("Automated data profiling on all source systems at ingestion", { bullet: true }),
    para("Real-time data quality dashboards with Trust Score trending", { bullet: true }),
    para("Automated alerting when quality thresholds are breached", { bullet: true }),
    para("Data stewardship workflows for issue resolution", { bullet: true }),

    heading("5. Accountability"),
    dataTable(
      ["Role", "Responsibility"],
      [
        ["Chief Data Officer", "Enterprise data quality strategy and policy"],
        ["Data Domain Owners", "Quality targets for their domain CDEs"],
        ["Data Stewards", "Day-to-day quality issue resolution"],
        ["IT Operations", "Pipeline monitoring and alerting"],
        ["Business Unit Heads", "Reporting data quality issues"],
      ]
    ),

    heading("6. Revision History"),
    dataTable(
      ["Version", "Date", "Author", "Changes"],
      [
        ["1.0", "2025-01-15", "P. Ramanathan", "Initial release"],
        ["1.2", "2025-05-01", "P. Ramanathan", "Added CDE table with financial impact mapping"],
      ]
    ),
    ...signatureBlock("Priya Ramanathan", "Chief Data Officer", "Data & Analytics Division"),
  ]);
}

// ═══ MCG-POL-020: Shipping & Delivery Promise ═══
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
    para("This policy defines the delivery promises displayed to customers at checkout on meridiancommerce.com. Delivery promises must be achievable based on actual carrier SLAs and must be updated when carrier contracts change."),
    calloutBox("LESSON LEARNED: The NinjaVan AMD3 contract amendment (effective 01 October 2025) changed Singapore 5-10 kg delivery from 2-day to 3-day. This was not reflected on the website for 3+ weeks, resulting in false promises to ~14,000 customers/month and a spike in WISMO contacts to 52% of Singapore CS volume.", "critical"),

    heading("2. Delivery Promise Matrix"),
    dataTable(
      ["Region", "Weight Band", "Carrier", "Promised Delivery", "Actual SLA"],
      [
        ["EU (NL, DE, BE)", "0-20 kg", "DPD Classic", "2-3 business days", "2-3 BD"],
        ["EU (other)", "0-20 kg", "DPD International", "3-7 business days", "3-7 BD"],
        ["Americas (US)", "0-10 lb", "FedEx Ground", "3-5 business days", "3-5 BD"],
        ["Americas (US)", "10-50 lb", "FedEx Ground", "5-7 business days", "5-7 BD"],
        ["Singapore", "0-5 kg", "NinjaVan Express", "Next-day", "Next-day"],
        ["Singapore", "5-10 kg", "NinjaVan Standard", "3 business days ⚠", "3 BD (changed Oct 1)"],
        ["Singapore", "10-20 kg", "NinjaVan Standard", "3 business days", "3 BD"],
        ["Africa (Lagos)", "All", "Local carriers", "5-10 business days", "Varies widely"],
      ]
    ),

    heading("3. Delivery Promise Accuracy"),
    dataTable(
      ["Region", "Q2 2025", "Q3 2025", "Target"],
      [
        ["EU", "91%", "87%", "95%"],
        ["Americas", "93%", "91%", "95%"],
        ["APAC (Singapore)", "88%", "69% ⚠", "95%"],
        ["Africa", "72%", "68%", "85%"],
        ["Global Average", "89%", "82%", "95%"],
      ]
    ),

    heading("4. Change Management Requirements"),
    para("When carrier SLAs change:"),
    numberedItem(1, "Carrier management must notify the e-commerce team within 24 hours of any SLA change."),
    numberedItem(2, "E-commerce team must update the delivery promise on the website within 48 hours."),
    numberedItem(3, "Customer service must be briefed on the change within 24 hours."),
    numberedItem(4, "A communication must be sent to affected customers with pending orders."),
    calloutBox("These requirements are NEW as of October 2025, instituted after the NinjaVan incident. Previously, there was no formal process for carrier-to-e-commerce SLA change communication.", "info"),

    heading("5. Revision History"),
    dataTable(
      ["Version", "Date", "Author", "Changes"],
      [
        ["1.0", "2023-06-01", "L. Park", "Initial release"],
        ["2.0", "2025-08-01", "L. Park", "Added regional delivery matrix"],
        ["2.1", "2025-10-20", "L. Park", "Updated Singapore 5-10 kg after NinjaVan AMD3; added change management"],
      ]
    ),
    ...signatureBlock("Lisa Park", "Head of Customer Experience", "Customer Service Division"),
  ]);
}

// ─── RUN ───
async function main() {
  console.log("Generating policy documents...");
  await saveDocument(pol007(), path.join(OUT, "MCG-POL-007_EU_Food_Safety_Compliance.docx"));
  await saveDocument(pol012(), path.join(OUT, "MCG-POL-012_Cold_Chain_Management.docx"));
  await saveDocument(pol015(), path.join(OUT, "MCG-POL-015_Data_Quality_Standards.docx"));
  await saveDocument(pol020(), path.join(OUT, "MCG-POL-020_Shipping_Delivery_Promise.docx"));
  console.log("✅ 4 policies generated.");
}

main().catch(console.error);
