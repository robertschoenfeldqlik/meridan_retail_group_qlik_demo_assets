# STANDARD OPERATING PROCEDURE
## SOP-SC-001: Product Recall Procedure

| | |
|---|---|
| **Document ID** | SOP-SC-001 |
| **Version** | 4.0 |
| **Effective Date** | 2025-04-01 |
| **Owner** | Dr. Elena Vasquez, Chief Compliance Officer |
| **Classification** | CONFIDENTIAL -- Management Only |
| **Regulatory Basis** | EU General Food Law Regulation (EC) No 178/2002; US FDA 21 CFR Part 7 |

---

## 1. Purpose

This procedure defines the end-to-end process for executing a product recall at Meridian Commerce Group. It covers identification, assessment, execution, and post-recall analysis. Regulatory target: **identify all affected locations within 24 hours** of recall initiation.

## 2. Recall Classification

| Class | Severity | Example | Response Time |
|---|---|---|---|
| **Class I** | Reasonable probability of serious health consequences or death | Contaminated food, electrical fire hazard | Immediate. All steps within 24 hours. |
| **Class II** | May cause temporary or medically reversible health consequences | Mislabeled allergens, minor contamination | Within 48 hours. |
| **Class III** | Not likely to cause adverse health consequences | Incorrect packaging, cosmetic defect | Within 5 business days. |

## 3. Recall Procedure

### Phase 1: Identification and Assessment (Target: 0-2 hours)

1. **Recall trigger received** from:
   - Supplier notification
   - Regulatory authority (EFSA, FDA, local food safety agency)
   - Internal quality finding
   - Customer complaint pattern

2. **Activate Recall Team**:
   - Chief Compliance Officer (lead)
   - VP Supply Chain Operations
   - VP Warehouse Operations
   - Regional Operations Directors (affected regions)
   - Legal Counsel
   - Communications Director

3. **Identify affected product**:
   - Product SKU(s) -- check ALL SKU variants (MCG global, Americas legacy, EU legacy)
   - Batch/lot number(s)
   - Date range of production
   - Supplier and sub-tier supplier (if known)

### Phase 2: Traceability (Target: 2-8 hours)

**This is the critical phase. MCG's traceability capability determines recall speed.**

1. **Trace forward** (farm/factory → consumer):
   - Query traceability database for the affected batch/lot number
   - Identify all DCs that received the batch
   - Identify all stores that received from those DCs
   - Identify all e-commerce orders fulfilled with the batch

2. **KNOWN LIMITATIONS (as of Q4 2025)**:
   - **15% of grocery inventory records have no lot number**. For these items, we cannot confirm or exclude involvement in the recall. Precautionary approach: assume ALL untracked inventory of the affected SKU is potentially involved.
   - **Store-level receipt tracking is missing for approximately 30% of deliveries.** For these, we must contact each DC manually to cross-reference paper delivery manifests.
   - **Sub-tier supplier visibility is limited.** If the recall involves a raw ingredient (e.g., a specific lettuce farm), we may not be able to trace through our Tier 1 suppliers to the farm of origin for ~47% of food suppliers.
   - **Traceability data is stored across 4 separate systems** (SAP, WMS, supplier portal, quality management system) with no unified query interface.

3. **Remediation target**: The Supply Chain Transformation Program (Project CLARITY) aims to resolve these limitations by Q2 2026 via unified data lineage in the Qlik platform.

### Phase 3: Containment (Target: 8-16 hours)

1. **Warehouse containment**:
   - Place hold on all identified lots in WMS (status = QUALITY_HOLD)
   - Physically segregate affected inventory in quarantine zone
   - Stop all outbound shipments of affected SKU until lot verification is complete

2. **Store containment**:
   - Issue URGENT RECALL NOTICE to all potentially affected stores
   - Store managers must pull affected product from shelves immediately
   - For stores where lot-level tracking is unavailable: pull ALL inventory of the affected SKU (precautionary)

3. **E-commerce containment**:
   - Disable the affected SKU on meridiancommerce.com
   - Identify in-transit orders containing the affected SKU
   - Contact carrier to intercept deliveries where possible
   - For delivered orders: initiate proactive customer outreach

### Phase 4: Notification (Target: 16-24 hours)

1. Notify regulatory authorities (EFSA for EU, FDA for US, local authorities per region)
2. Publish customer notification on meridiancommerce.com
3. Direct customer communications for affected e-commerce orders (email + SMS)
4. In-store signage at affected locations
5. Media statement (if Class I recall)

### Phase 5: Post-Recall Analysis (Target: 30 days)

1. Calculate total recall scope:
   - Units removed from sale
   - Units intercepted in transit
   - Units in customer possession (outreach required)
   - Financial impact

2. Conduct root cause analysis
3. Assess traceability performance:
   - Did we meet the 24-hour identification target?
   - What percentage of affected inventory was traceable by lot number?
   - How many stores required precautionary full-SKU pulls?
4. Update this SOP with lessons learned

## 4. Recent Recall History

### Recall RCL-2025-003: Contaminated Lettuce (September 2025)

| Metric | Target | Actual | Status |
|---|---|---|---|
| Time to identify all affected stores | 24 hours | **11 days** | FAILED |
| Lot-level traceability rate | 100% | 85% | FAILED |
| Stores requiring precautionary full pull | 0 | 247 (22% of chain) | FAILED |
| Root cause of delay | -- | Missing lot numbers (15%), missing store-level tracking (30%), 4 disconnected traceability systems | -- |
| Financial impact | -- | $2.1M (product waste + operational cost) | -- |
| Regulatory outcome | -- | EU citation issued, corrective action plan required within 90 days | -- |

**Corrective actions in progress:**
- Project CLARITY: Unified traceability platform (Qlik) -- target Q2 2026
- Mandatory lot number capture at all DCs -- enforced since October 2025
- Sub-tier supplier mapping initiative -- 60% complete as of January 2026

## 5. Emergency Contacts

| Role | Name | Phone | Available |
|---|---|---|---|
| Chief Compliance Officer | Dr. Elena Vasquez | +31 20 555 0001 | 24/7 |
| VP Supply Chain | Thomas Brennan | +1 404 555 0002 | 24/7 |
| VP Warehouse Operations | Henrik Jansen | +31 20 555 0003 | Business hours + on-call |
| Legal Counsel | Marie-Claire Dubois | +31 20 555 0004 | Business hours + on-call |
| IT Emergency (system access) | IT Service Desk | +31 20 555 9999 | 24/7 |

## 6. Related Documents

- MCG-POL-007: EU Food Safety Compliance Policy
- SOP-WH-001: Goods Receiving Procedure (lot number capture)
- MCG-POL-012: Cold Chain Management Policy
- REG-EU-178-2002: General Food Law Reference Guide
- INC-2025-RCL003: Lettuce Recall Post-Mortem Report

---
*Meridian Commerce Group -- CONFIDENTIAL*
