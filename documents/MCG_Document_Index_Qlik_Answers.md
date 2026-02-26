# MCG Document Index for Qlik Answers Demo
## Mapping Documents to Demo Scenarios and Sample Questions

---

## Document Inventory (22 Documents)

### SOPs (5)
| ID | Title | File |
|---|---|---|
| SOP-WH-001 | Goods Receiving Procedure | `sops/SOP-WH-001_Goods_Receiving_Procedure.md` |
| SOP-WH-002 | Cycle Count Procedure | `sops/SOP-WH-002_Cycle_Count_Procedure.md` |
| SOP-SC-001 | Product Recall Procedure | `sops/SOP-SC-001_Product_Recall_Procedure.md` |
| SOP-SC-002 | Cold Chain Monitoring | `sops/SOP-SC-002_Cold_Chain_Monitoring.md` |
| SOP-CS-001 | WISMO Call Handling | `sops/SOP-CS-001_WISMO_Call_Handling.md` |

### Carrier Contracts (3)
| ID | Title | File |
|---|---|---|
| CARRIER-NV-2025 | NinjaVan Contract Amendment | `carrier_contracts/CARRIER-NV-2025_NinjaVan_Contract_Amendment.md` |
| CARRIER-FEDEX-2025 | FedEx Rate Card | `carrier_contracts/CARRIER-FEDEX-2025_Rate_Card.md` |
| CARRIER-DPD-2025 | DPD Service Agreement | `carrier_contracts/CARRIER-DPD-2025_Service_Agreement.md` |

### Policies (4)
| ID | Title | File |
|---|---|---|
| MCG-POL-007 | EU Food Safety Compliance | `policies/MCG-POL-007_EU_Food_Safety_Compliance.md` |
| MCG-POL-012 | Cold Chain Management | `policies/MCG-POL-012_Cold_Chain_Management.md` |
| MCG-POL-015 | Data Quality Standards | `policies/MCG-POL-015_Data_Quality_Standards.md` |
| MCG-POL-020 | Shipping & Delivery Promise | `policies/MCG-POL-020_Shipping_Delivery_Promise.md` |

### Incident Reports (2)
| ID | Title | File |
|---|---|---|
| INC-2025-04872 | Rotterdam Pipeline Failure | `incident_reports/INC-2025-04872_Rotterdam_Pipeline_Failure.md` |
| INC-2025-05102 | TransFrio Spoilage Incident | `incident_reports/INC-2025-05102_TransFrio_Spoilage.md` |

### Purchase Orders (2)
| ID | Title | File |
|---|---|---|
| PO-2025-RTD-00847 | Samsung Electronics PO | `purchase_orders/PO-2025-RTD-00847_Samsung_Electronics.md` |
| PO-2025-SIN-01203 | NinjaVan Packaging PO | `purchase_orders/PO-2025-SIN-01203_NinjaVan_Packaging.md` |

### Supplier Communications (2)
| ID | Title | File |
|---|---|---|
| SUPP-2025-FD | Fresh Direct Performance Review | `supplier_comms/SUPP-2025-FreshDirect_Performance_Review.md` |
| SUPP-2025-TF | TransFrio Contract Review | `supplier_comms/SUPP-2025-TransFrio_Contract_Review.md` |

### Recall Notices (1)
| ID | Title | File |
|---|---|---|
| RCL-2025-003 | Lettuce Contamination Recall | `recall_notices/RCL-2025-003_Lettuce_Recall.md` |

### Training Documents (2)
| ID | Title | File |
|---|---|---|
| TRN-2025-001 | WMS-SAP Integration Guide | `training/TRN-2025-001_WMS_SAP_Integration_Guide.md` |
| TRN-2025-002 | Cold Chain Monitoring for Drivers | `training/TRN-2025-002_Cold_Chain_Monitoring_For_Drivers.md` |

### Meeting Minutes (1)
| ID | Title | File |
|---|---|---|
| MTG-SC-2025-Q3 | Q3 Supply Chain Performance Review | `meeting_minutes/MTG-2025-Q3_Supply_Chain_Review.md` |

### Compliance (1)
| ID | Title | File |
|---|---|---|
| COMP-2025-NVWA | NVWA Corrective Action Plan | `compliance/COMP-2025-NVWA_Corrective_Action_Plan.md` |

### Project Briefs (1)
| ID | Title | File |
|---|---|---|
| PROJ-CLARITY | Project CLARITY Business Case | `project_briefs/PROJ-CLARITY-2025_Business_Case.md` |

### Shipping (1)
| ID | Title | File |
|---|---|---|
| SHIP-2025-RTD-44821 | Rotterdam Delivery Manifest | `shipping/SHIP-2025-RTD-44821_Delivery_Manifest.md` |

---

## Demo Scenario 1: "Why are Singapore delivery SLAs declining?"

**Narrative**: An executive asks Qlik Answers why Singapore customer satisfaction has dropped and delivery SLAs are not being met. Qlik Answers surfaces the root cause from both structured data (carrier performance) and unstructured documents (contract amendment).

### Sample Questions

| # | Question | Expected Answer Sources | Key Citations |
|---|---|---|---|
| 1 | "Why are delivery SLAs declining in Singapore?" | CARRIER-NV-2025, MTG-SC-2025-Q3, MCG-POL-020 | NinjaVan reclassified 5-10kg parcels from 2-day to 3-day service (Oct 1). 68% of affected orders are electronics >5kg. |
| 2 | "What changed in the NinjaVan contract?" | CARRIER-NV-2025 | Amendment AMD3 reclassified service tiers. MCG-STD parcels 5-10kg moved to 3-day SLA. 2-day SLA now only for <5kg. |
| 3 | "Who is responsible for updating the delivery promise on our website?" | MCG-POL-020, MTG-SC-2025-Q3 | Li Wei Chen was assigned to request e-commerce team update. MCG-POL-020 mandates Procurement notify e-commerce within 24 hours of contract changes. |
| 4 | "How many customers were affected by the Singapore SLA issue?" | MTG-SC-2025-Q3, MCG-POL-020 | 14,000 customers per month received incorrect delivery promises. Singapore NPS dropped 18 points. WISMO rate for Singapore: 52%. |
| 5 | "What carriers do we use in Singapore?" | CARRIER-NV-2025, MCG-POL-020 | NinjaVan (primary). Heavy parcels >10kg use NinjaVan Heavy. J&T Express and Lalamove being evaluated as secondary carriers. |

### Document Cross-References
```
CARRIER-NV-2025 ──→ MTG-SC-2025-Q3 (Li Wei discussed the issue)
                ──→ MCG-POL-020 (policy updated to prevent recurrence)
                ──→ SOP-CS-001 (WISMO agents use carrier tracking portals)
                ──→ PO-2025-SIN-01203 (packaging PO references the NinjaVan change)
```

---

## Demo Scenario 2: "What happened with the Rotterdam inventory failure?"

**Narrative**: A warehouse manager asks Qlik Answers about the phantom inventory issue to understand what went wrong and what corrective actions were taken.

### Sample Questions

| # | Question | Expected Answer Sources | Key Citations |
|---|---|---|---|
| 1 | "What caused the phantom inventory at Rotterdam?" | INC-2025-04872, TRN-2025-001 | WMS-SAP batch job failed silently on Sep 24. Went undetected for 4.3 days. 847 units of phantom inventory across 42 SKUs. |
| 2 | "How do I check if the WMS-SAP sync is working?" | TRN-2025-001, INC-2025-04872 | Daily manual sync check: compare WMS and SAP transaction counts, spot-check 5 SKUs, verify batch job status in SM37. |
| 3 | "What is our inventory accuracy rate?" | MTG-SC-2025-Q3, SOP-WH-002, MCG-POL-015 | Current IRA: 74% (target: 97%). Cycle count procedure identifies variances. Data quality policy sets 99% accuracy target for inventory. |
| 4 | "How many pipeline failures happen per week?" | INC-2025-04872, MCG-POL-015 | Estimated 23 pipeline failures per week. ~25% are silent (5-6 undetected at any given time). |
| 5 | "What is Project CLARITY going to fix about this?" | PROJ-CLARITY, INC-2025-04872 | Replace batch interface with CDC via Qlik Talend Cloud. Pipeline health monitoring. Data freshness checks. Silent failure detection. |

### Document Cross-References
```
INC-2025-04872 ──→ TRN-2025-001 (training updated to include daily sync check)
               ──→ SOP-WH-002 (cycle count procedure references the incident)
               ──→ MCG-POL-015 (data quality policy cites incident as evidence)
               ──→ MTG-SC-2025-Q3 (discussed at Q3 review meeting)
               ──→ PROJ-CLARITY (key justification for the platform investment)
```

---

## Demo Scenario 3: "Tell me about the lettuce recall"

**Narrative**: A compliance officer asks Qlik Answers about the recall history and current traceability capabilities to prepare for the upcoming NVWA inspection.

### Sample Questions

| # | Question | Expected Answer Sources | Key Citations |
|---|---|---|---|
| 1 | "What happened with the lettuce recall?" | RCL-2025-003, SUPP-2025-FD | Listeria detected in organic butter lettuce from FARM-NL-0042 (Fresh Direct supplier). 12,400 units across 210 stores. Took 11 days to complete trace (target: 24 hours). |
| 2 | "Why did the recall take so long?" | RCL-2025-003, COMP-2025-NVWA | Data fragmented across 4 systems. 15% missing lot numbers. Only 32% store-level receipt tracking. 65 person-hours of manual cross-referencing. |
| 3 | "What is the NVWA corrective action plan?" | COMP-2025-NVWA, MCG-POL-007 | 5 corrective actions: mandatory lot number capture (done), store receipt tracking (78%), unified traceability plan (CLARITY), sub-tier mapping (36%), origin documentation (88%). |
| 4 | "What is Fresh Direct's supplier rating?" | SUPP-2025-FD | Rating: C (Needs Improvement), down from B. Quality rejection rate 4.8% (was 2.1%). Connected to FARM-NL-0042 recall. Conditional renewal recommendation. |
| 5 | "How do we handle a product recall?" | SOP-SC-001 | 5-phase procedure: Identification, Traceability, Containment, Notification, Post-Recall. Recall team contacts listed. Current limitations documented. |
| 6 | "When is the next NVWA inspection?" | COMP-2025-NVWA, MCG-POL-007 | Expected Q1 2026. MCG must demonstrate lot number compliance at 100%, store tracking >85%, and Project CLARITY in active implementation. |

### Document Cross-References
```
RCL-2025-003 ──→ SUPP-2025-FD (supplier rating declined due to recall)
              ──→ COMP-2025-NVWA (corrective action plan filed)
              ──→ MCG-POL-007 (policy requirements that were violated)
              ──→ SOP-SC-001 (recall procedure followed -- exposed limitations)
              ──→ SOP-WH-001 (goods receiving updated for lot number capture)
              ──→ MTG-SC-2025-Q3 (compliance update at Q3 meeting)
              ──→ PROJ-CLARITY (unified traceability is key deliverable)
```

---

## Demo Scenario 4: "What's happening with cold chain spoilage?"

**Narrative**: A supply chain analyst asks Qlik Answers about the spoilage crisis and what corrective actions are underway.

### Sample Questions

| # | Question | Expected Answer Sources | Key Citations |
|---|---|---|---|
| 1 | "Why is spoilage so high this quarter?" | MTG-SC-2025-Q3, INC-2025-05102, MCG-POL-012 | Q3 spoilage: $14.2M (target: $10M). Primary driver: GRU-BA corridor (+340% exceedances). TransFrio fleet upgrade created 15-min reefer startup gap. Border delays at Uruguaiana increased from 1.2 to 3.5 hours. |
| 2 | "What are the temperature requirements for fresh produce?" | MCG-POL-012, TRN-2025-002, SOP-SC-002 | Fresh produce: 2-6°C. Reject above 8°C. Pre-cool requirement for LATAM: 0°C. |
| 3 | "What is TransFrio doing about the refrigeration issue?" | SUPP-2025-TF, INC-2025-05102 | TransFrio acknowledged issue. Working on firmware update (Q1 2026). Surcharge of BRL 180/shipment proposed (MCG countered BRL 120). APU installation required by Nov 15. |
| 4 | "What monitoring do we have on the Lagos-Abidjan corridor?" | MCG-POL-012, SOP-SC-002, MTG-SC-2025-Q3 | Only 45% sensor coverage. 6-hour daily connectivity blackouts. Manual readings with paper logbook during blackouts. ISP upgrade target: Q1 2026. |
| 5 | "What do I do if a cold shipment arrives above temperature?" | TRN-2025-002, SOP-WH-001 | Take 3 handheld readings. If 1 reading slightly out of range: accept with HOLD. If significantly out of range: REJECT, take photos, notify supervisor. |

### Document Cross-References
```
INC-2025-05102 ──→ SUPP-2025-TF (formal notice to TransFrio)
               ──→ MCG-POL-012 (0°C pre-cool mandate added)
               ──→ MTG-SC-2025-Q3 (discussed at Q3 review, Thomas's ultimatum)
               ──→ TRN-2025-002 (driver training updated)
               ──→ SOP-SC-002 (monitoring procedure for corridor)
               ──→ PROJ-CLARITY (IoT telemetry normalization in scope)
```

---

## Demo Scenario 5: "Help me with a WISMO call"

**Narrative**: A customer service agent uses Qlik Answers to quickly resolve a customer inquiry about order status, demonstrating the AI-assisted customer service vision.

### Sample Questions

| # | Question | Expected Answer Sources | Key Citations |
|---|---|---|---|
| 1 | "What is the status of order WEB-2025-10-0094827?" | SHIP-2025-RTD-44821, SOP-CS-001 | Order shipped via DPD Classic from Rotterdam DC. Tracking: DPD-1025487321. Status: DELIVERED (Oct 16). |
| 2 | "How do I handle a WISMO call?" | SOP-CS-001 | 4-step procedure: Identify order (1 min), Check fulfillment status (2 min), Check carrier tracking (3 min), Escalation if needed (2 min). |
| 3 | "What systems do I need to check for order status?" | SOP-CS-001, TRN-2025-001 | Currently 5 systems: Salesforce Commerce Cloud, Salesforce CRM, Descartes TMS, Carrier tracking portal, WMS. Project CLARITY will provide unified view. |
| 4 | "Customer says their order shows delivered but they didn't receive it" | SOP-CS-001 | Ask customer to check household members, building reception, safe place. If not found: create case in CRM, initiate carrier investigation (48-hour response SLA from carrier). |
| 5 | "Why doesn't my Singapore customer have tracking for their order?" | SOP-CS-001, CARRIER-NV-2025 | 42% of orders (especially APAC) don't have tracking due to carrier limitations. Use scripted response about regional carrier and estimated delivery window. |
| 6 | "A DPD delivery failed because of a truncated address" | SHIP-2025-RTD-44821, CARRIER-DPD-2025 | Known address quality issue: MCG 35-character field limit truncates long street names. DPD charges EUR 2.80 correction fee per address fix. Contact carrier for reattempt. |

### Document Cross-References
```
SOP-CS-001 ──→ SHIP-2025-RTD-44821 (example of actual shipment with tracking)
           ──→ CARRIER-NV-2025 (tracking limitations for APAC)
           ──→ CARRIER-DPD-2025 (German-language status codes, address issues)
           ──→ CARRIER-FEDEX-2025 (carrier-specific API and tracking details)
           ──→ PROJ-CLARITY (Qlik Answers will unify the 5-system lookup)
```

---

## Demo Scenario 6: "Data quality and platform strategy"

**Narrative**: The CDO or CIO asks Qlik Answers about the current state of data quality and the business case for the Qlik platform.

### Sample Questions

| # | Question | Expected Answer Sources | Key Citations |
|---|---|---|---|
| 1 | "What is the annual cost of our data quality problems?" | MCG-POL-015, PROJ-CLARITY | $127M annually: phantom inventory ($48M), spoilage ($57M), WISMO ($14.8M), compliance ($4.2M), carrier SLA ($3.1M). |
| 2 | "What is Project CLARITY?" | PROJ-CLARITY, MTG-SC-2025-Q3 | Qlik platform implementation: Talend Cloud, Open Lakehouse, Qlik Sense, Qlik Answers, Discovery Agent, AutoML. $12.4M investment. $85M+ annual benefit. |
| 3 | "What data quality dimensions do we measure?" | MCG-POL-015 | Six dimensions: Completeness, Accuracy, Timeliness, Consistency, Uniqueness, Validity. Aligned with Qlik Trust Score for AI framework. |
| 4 | "How many data pipeline failures do we have?" | MCG-POL-015, INC-2025-04872 | 23 failures/week, ~25% silent (5-6 undetected at any time). Rotterdam failure went 4.3 days without detection. |
| 5 | "What is the ROI of Project CLARITY?" | PROJ-CLARITY | 3-year ROI: 952%. Payback: <4 months after Phase 1. Conservative annual benefit: $52.7M. |
| 6 | "When will we be ready for the NVWA inspection?" | COMP-2025-NVWA, PROJ-CLARITY | Q1 2026 inspection expected. Must demonstrate: lot number 100%, store tracking >85%, CLARITY in active implementation. Risk: CIO approval delay beyond November. |

### Document Cross-References
```
PROJ-CLARITY ──→ MCG-POL-015 (data quality problems justify platform)
             ──→ MTG-SC-2025-Q3 (Thomas + Priya co-presenting to CIO)
             ──→ INC-2025-04872 (pipeline failure as key evidence)
             ──→ RCL-2025-003 (recall failure as key evidence)
             ──→ COMP-2025-NVWA (regulatory urgency)
             ──→ All incident reports (collective justification)
```

---

## Master Cross-Reference Matrix

Shows which documents are relevant to each of the 7 Data Quality Nightmares:

| Document | N1: Phantom Inventory | N2: Address Catastrophe | N3: Product Master | N4: Silent Pipelines | N5: Timestamps | N6: Carrier Black Hole | N7: Compliance Gap |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| SOP-WH-001 | X | | | | X | | X |
| SOP-WH-002 | X | | | X | | | |
| SOP-SC-001 | | | | | | | X |
| SOP-SC-002 | | | | | X | X | |
| SOP-CS-001 | | | | | | X | |
| CARRIER-NV-2025 | | | | | | X | |
| CARRIER-FEDEX-2025 | | | | | | X | |
| CARRIER-DPD-2025 | | X | | | | X | |
| MCG-POL-007 | | | | | | | X |
| MCG-POL-012 | | | | | X | | X |
| MCG-POL-015 | X | X | X | X | X | X | X |
| MCG-POL-020 | | X | | | | X | |
| INC-2025-04872 | X | | | X | X | | |
| INC-2025-05102 | | | | | | X | |
| PO-2025-RTD-00847 | | | X | | X | | |
| PO-2025-SIN-01203 | | | | | | X | |
| SUPP-2025-FD | | | | | | | X |
| SUPP-2025-TF | | | | | | X | |
| RCL-2025-003 | | | | | | | X |
| TRN-2025-001 | X | | | X | X | | |
| TRN-2025-002 | | | | | X | | X |
| MTG-SC-2025-Q3 | X | X | | X | | X | X |
| COMP-2025-NVWA | | | | | | | X |
| PROJ-CLARITY | X | X | X | X | X | X | X |
| SHIP-2025-RTD-44821 | | X | | | | X | |

---

## Qlik Answers Setup Notes

### Document Ingestion
1. Upload all 22 documents to Qlik Answers knowledge base
2. Documents are in Markdown format -- Qlik Answers should handle these natively
3. Cross-references between documents (e.g., "see INC-2025-04872") should enable Qlik Answers to follow chains of related information

### Structured + Unstructured Combination
For the most powerful demo, combine these documents with structured data from the Qlik Open Lakehouse (inventory positions, shipment tracking, carrier performance metrics). Qlik Answers should be able to answer questions that require BOTH:
- "Why is Singapore's SLA declining?" → Structured data (carrier SLA metrics) + Unstructured (NinjaVan contract amendment text)
- "What happened with order WEB-2025-10-0094827?" → Structured data (order/shipment tables) + Unstructured (delivery manifest, WISMO procedure)

### Demo Flow Recommendation
1. Start with Scenario 6 (data quality overview) to set context
2. Deep dive into Scenario 2 (Rotterdam pipeline) for technical audience
3. Show Scenario 3 (lettuce recall) for compliance/risk audience
4. Demo Scenario 5 (WISMO) for customer experience audience
5. Close with Scenario 1 (Singapore SLA) to show how Discovery Agent would have caught it proactively

---
*Meridian Commerce Group -- Demo Reference -- Internal*
