# PRODUCT RECALL NOTICE
## RCL-2025-003: Organic Lettuce Contamination Recall

| | |
|---|---|
| **Recall ID** | RCL-2025-003 |
| **Date Initiated** | September 12, 2025 |
| **Recall Class** | Class II (Product may cause temporary health effects; probability of serious harm is remote) |
| **Recall Status** | ACTIVE -- Recovery in Progress |
| **Product** | Organic Butter Lettuce (MCG-GRO-LET-001) |
| **Supplier** | Fresh Direct NL B.V. (SUP-001200) |
| **Sub-Tier Farm** | FARM-NL-0042, Westland, Netherlands |
| **Affected Lot Numbers** | LT-2025-08-0142, LT-2025-08-0143, LT-2025-08-0156, LT-2025-08-0157, LT-2025-08-0161 |
| **Recall Coordinator** | Dr. Elena Vasquez, Chief Compliance Officer |

---

## 1. Recall Trigger

On September 10, 2025, the NVWA (Netherlands Food and Consumer Product Safety Authority) notified MCG that routine sampling of organic butter lettuce from MCG's Rotterdam retail locations detected elevated levels of **Listeria monocytogenes** exceeding EU limits (Regulation (EC) No 2073/2005).

NVWA sample reference: NVWA-2025-SAM-07821

## 2. Product Details

| Field | Detail |
|---|---|
| **Product Name** | MCG Organic Butter Lettuce |
| **SKU** | MCG-GRO-LET-001 |
| **Supplier** | Fresh Direct NL B.V. |
| **Farm of Origin** | FARM-NL-0042, Westland greenhouse complex |
| **Pack Dates** | August 14-22, 2025 |
| **Best Before Dates** | August 21 -- September 5, 2025 |
| **Distribution** | Netherlands, Germany, Belgium, France |
| **Estimated Units Distributed** | 12,400 units |

## 3. Root Cause

Fresh Direct NL informed MCG that FARM-NL-0042 experienced **irrigation system failures** in August 2025, which led to:
1. Pooling of irrigation water in greenhouse beds
2. Elevated soil moisture creating favorable conditions for Listeria growth
3. Cross-contamination during harvesting due to shared equipment

**Additional concern**: Following the irrigation failure, Fresh Direct shifted approximately 30% of lettuce volume to an **undisclosed backup farm** whose identity has not been shared with MCG. This represents a sub-tier supply chain visibility gap that prevented MCG from assessing risk across the full supply base.

## 4. Recall Timeline

| Date | Time | Event | Duration from Trigger |
|---|---|---|---|
| Sep 10 | 14:30 CET | NVWA notification received by Compliance team | 0 |
| Sep 10 | 15:00 CET | Recall team convened (per SOP-SC-001) | 30 min |
| Sep 10 | 16:00 CET | Fresh Direct NL contacted; confirmed farm of origin | 1.5 hours |
| Sep 10 | 17:00 CET | Began lot number trace in SAP | 2.5 hours |
| Sep 11 | 09:00 CET | SAP trace identified 3 of 5 affected lot numbers | 18.5 hours |
| Sep 12 | 11:00 CET | Manual WMS cross-reference identified remaining 2 lot numbers | **44.5 hours** |
| Sep 12 | 14:00 CET | Distribution trace begun -- identifying all receiving DCs | 47.5 hours |
| Sep 14 | 10:00 CET | DC-level distribution confirmed (Rotterdam, Munich, Brussels, Paris DCs) | 67.5 hours |
| Sep 16 | 16:00 CET | Store-level distribution partially identified (148 of estimated 210 stores) | **122 hours** |
| Sep 18 | 09:00 CET | Store-level distribution identified for 187 stores; 23 stores still unconfirmed | **162.5 hours** |
| Sep 21 | 14:00 CET | Final store-level distribution confirmed (all 210 stores identified) | **263.5 hours (11 days)** |
| Sep 21 | 15:00 CET | Store removal confirmation received from 198 of 210 stores | 264.5 hours |
| Sep 25 | 12:00 CET | All 210 stores confirmed product removed from shelves | **14.8 days** |

**TARGET**: Identify all affected locations within **24 hours**. **ACTUAL**: **11 days**.

## 5. Traceability Gaps Encountered

### 5.1 Lot Number Traceability

| Stage | Lot Number Available? | Notes |
|---|---|---|
| Supplier → DC receipt | **Partial** | 3 of 5 lots captured in SAP at goods receipt. 2 lots were received at Munich DC where lot number was entered in a free-text comments field, not the structured lot number field. |
| DC → Store shipment | **Partial** | Rotterdam DC: lot-to-store mapping available (70%). Munich DC: lot numbers not systematically linked to store deliveries (manual paper-based tracking only). |
| Store receipt | **Poor** | Only 32% of stores recorded lot numbers at receipt. Most stores do not scan incoming product at lot level. |

### 5.2 Systems Consulted During Trace

To complete the traceability exercise, the recall team had to query **four separate systems**:

1. **SAP MM** -- Goods receipt records (lot numbers for Rotterdam DC)
2. **Oracle WMS** -- Warehouse inventory movements and pick/pack records (Rotterdam, Munich)
3. **Supplier Portal** -- Fresh Direct's shipment manifests (to cross-reference lot numbers not captured at MCG receipt)
4. **Quality Management System (QMS)** -- Quality inspection records with lot-level detail

**No single system contained the complete trace**. The team spent approximately **65 person-hours** on manual cross-referencing.

### 5.3 Sub-Tier Visibility Gap

MCG was unable to determine whether the undisclosed backup farm (shifted to after FARM-NL-0042's irrigation failure) was also affected. Fresh Direct NL has been unable or unwilling to disclose this farm's identity, location, or testing records. This has been escalated as a corrective action in the Q3 supplier performance review (SUPP-2025-FreshDirect).

## 6. Financial Impact

| Cost Category | Amount | Status |
|---|---|---|
| Product destruction (12,400 units) | EUR 24,800 | Incurred |
| Recall labor (65 person-hours) | EUR 8,125 | Incurred |
| NVWA regulatory response costs | EUR 15,000 | Estimated |
| Customer refunds / goodwill credits | EUR 6,200 | Issued |
| Fresh Direct supplier chargeback | EUR 31,000 | Under dispute |
| Reputational / brand impact | Not quantified | Ongoing |
| **Total estimated cost** | **EUR 85,125** | |

## 7. Regulatory Impact

The slow recall execution triggered an NVWA follow-up inspection on **June 10, 2025** (based on the initial contamination report timeline). The NVWA inspection resulted in a **formal citation** for failure to meet the 24-hour traceability requirement under Article 18 of Regulation (EC) No 178/2002.

MCG submitted a corrective action plan to NVWA (see MCG-POL-007, Section 4.3). A follow-up inspection is expected in **Q1 2026**.

## 8. Corrective Actions

| # | Action | Owner | Status | Due Date |
|---|---|---|---|---|
| 1 | Mandate structured lot number capture at all DCs (eliminate free-text entries) | Henrik Jansen | **Completed** (Oct 1, 2025) | Oct 1, 2025 |
| 2 | Implement store-level receipt scanning for food products | Henrik Jansen | In progress (78% of stores) | Dec 31, 2025 |
| 3 | Require Fresh Direct to disclose all sub-tier farm identities | Sophie de Groot | Pending -- deadline issued | Nov 15, 2025 |
| 4 | Implement unified traceability platform (Project CLARITY) | Priya Ramanathan | In planning | Q2 2026 |
| 5 | Conduct post-recall drill using lot-to-store trace within 24 hours | Dr. Elena Vasquez | Scheduled | Jan 2026 |
| 6 | Deploy Qlik Answers for natural language recall trace queries | Priya Ramanathan | Pending CLARITY Phase 2 | Q3 2026 |

## 9. Lessons Learned

1. **Lot number capture is non-negotiable**: Free-text fields are not searchable at speed. All lot data must be in structured fields with validation.
2. **Store receipt scanning is critical**: The weakest link was store-level traceability (32% compliance). Without knowing which stores received which lots, recall scope cannot be determined.
3. **Sub-tier visibility matters**: MCG cannot assess risk when suppliers shift to undisclosed farms. The Supplier Transparency Program must accelerate.
4. **Fragmented systems kill speed**: 65 person-hours of manual cross-referencing across 4 systems is unacceptable. A unified traceability platform would have reduced this to hours, not days.
5. **Proactive detection could have prevented the recall**: If MCG had real-time quality monitoring linked to supplier farm data, the irrigation failure → contamination risk chain could have been flagged before products reached stores.

---
*Meridian Commerce Group -- Compliance -- CONFIDENTIAL*
