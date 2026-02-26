# STANDARD OPERATING PROCEDURE
## SOP-WH-002: Inventory Cycle Count Procedure

| | |
|---|---|
| **Document ID** | SOP-WH-002 |
| **Version** | 2.4 |
| **Effective Date** | 2025-03-01 |
| **Owner** | Henrik Jansen, VP Warehouse Operations |
| **Classification** | Internal -- Warehouse Operations |

---

## 1. Purpose

This procedure defines the process for conducting daily and periodic inventory cycle counts at all MCG distribution centers. Accurate cycle counts are critical to identifying and resolving inventory discrepancies between the ERP (SAP S/4HANA), WMS (Oracle/Manhattan), and physical stock.

## 2. Cycle Count Schedule

| Count Type | Frequency | Scope | Trigger |
|---|---|---|---|
| **Daily ABC Count** | Daily (Mon-Fri) | A-items: 10% of high-value SKUs per day | Automated WMS schedule |
| **Weekly Full Zone** | Weekly (Saturday) | One complete warehouse zone per week | Rotating schedule |
| **Exception-Triggered** | As needed | Specific SKU/location | Negative inventory, pick failure, customer complaint |
| **Quarterly Wall-to-Wall** | Quarterly | Entire facility | Finance requirement |

## 3. Procedure

### 3.1 Daily ABC Cycle Count

1. At 06:00 local time, the WMS generates the day's count list based on ABC classification:
   - **A items** (top 20% by revenue): Counted every 10 business days
   - **B items** (next 30%): Counted every 30 business days
   - **C items** (bottom 50%): Counted every 90 business days

2. Assign count tasks to Cycle Count Operators via WMS mobile devices.

3. **Counting procedure**:
   - Navigate to assigned bin location
   - Scan bin barcode to confirm location
   - Physically count ALL units in the bin
   - Enter count on mobile device
   - If count matches system quantity (within tolerance): CONFIRM
   - If count does NOT match: RECOUNT (mandatory second count by a different operator)

4. **Variance tolerance**:
   - A items: ZERO tolerance. Any variance triggers investigation.
   - B items: +/- 2% or +/- 5 units (whichever is smaller)
   - C items: +/- 5% or +/- 10 units (whichever is smaller)

5. **Variance resolution**:
   - If recount confirms the variance, the Cycle Count Operator records the adjustment in WMS.
   - WMS adjustment transaction is created automatically.
   - **CRITICAL**: This adjustment MUST synchronize to SAP within 30 minutes via CDC.
   - **KNOWN ISSUE (as of October 2025)**: WMS-to-SAP sync for adjustment transactions at DC-RTD-01 (Rotterdam) has experienced intermittent failures. If you perform a cycle count adjustment at Rotterdam and it is not reflected in SAP within 1 hour, contact IT Support immediately and reference ticket INC-2025-04872.

### 3.2 Variance Investigation

When a cycle count variance exceeds tolerance:

1. Check WMS transaction history for the location/SKU:
   - Were there recent picks, receipts, or transfers that haven't been confirmed?
   - Is there a pending putaway that was physically completed but not scanned?

2. Check adjacent bins -- items may have been placed in the wrong location.

3. Check for unit-of-measure confusion:
   - **COMMON ERROR**: SAP may show quantity in "eaches" while WMS shows in "cases."
   - Example: SAP says 120 units. WMS says 10. Physical count: 10 cases of 12 = 120 eaches. Both are correct.
   - Refer to the Product Master Unit of Measure reference (SOP-DATA-004) when in doubt.

4. If variance cannot be resolved:
   - Create an Inventory Adjustment Request (IAR)
   - Supervisor approval required for adjustments > $500 in value
   - Finance approval required for adjustments > $5,000 in value

### 3.3 Store-Level Inventory Reconciliation

**Note**: Store managers currently perform a manual daily reconciliation using spreadsheets. This process takes approximately 45 minutes per store each morning. The Supply Chain Transformation team is working to replace this with automated real-time reconciliation via the Qlik platform (Project CLARITY, target go-live Q2 2026).

Current store reconciliation process:
1. Export POS sales data from previous day
2. Export current inventory snapshot from ERP
3. Manually compare expected vs actual inventory
4. Log discrepancies in the store reconciliation spreadsheet
5. Submit reconciliation report to Regional Inventory Manager by 10:00 local time

## 4. Metrics

| Metric | Target | Current Performance (Q3 2025) |
|---|---|---|
| Inventory Record Accuracy (IRA) | > 97% | **74%** (below target) |
| Cycle count completion rate | 100% of scheduled counts | 92% |
| Average variance per count | < 2% | 8.3% |
| Time to resolve variance | < 24 hours | 3.2 days |
| SAP-WMS sync success rate | > 99.5% | **96.1%** (below target) |

## 5. Related Documents

- SOP-WH-001: Goods Receiving Procedure
- SOP-DATA-004: Product Master Unit of Measure Reference
- MCG-POL-015: Inventory Adjustment Authorization Policy
- INC-2025-04872: Rotterdam DC WMS-SAP Sync Failure (IT Incident)

---
*Meridian Commerce Group -- Confidential*
