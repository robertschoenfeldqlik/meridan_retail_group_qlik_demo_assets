# STANDARD OPERATING PROCEDURE
## SOP-WH-001: Goods Receiving and Inbound Processing

| | |
|---|---|
| **Document ID** | SOP-WH-001 |
| **Version** | 3.2 |
| **Effective Date** | 2025-01-15 |
| **Last Reviewed** | 2025-07-01 |
| **Owner** | Henrik Jansen, VP Warehouse Operations |
| **Classification** | Internal -- All Warehouse Staff |
| **Applies To** | All Meridian Commerce Group DCs and Fulfillment Centers |

---

## 1. Purpose

This procedure defines the standard process for receiving inbound goods at all MCG distribution centers and fulfillment hubs. Compliance ensures accurate inventory records, quality control, and regulatory traceability.

## 2. Scope

Applies to all inbound receipts including:
- Supplier purchase order deliveries
- Inter-facility transfers
- Customer returns (see SOP-WH-006 for return-specific handling)
- Sample and promotional stock

## 3. Responsibilities

| Role | Responsibility |
|---|---|
| Receiving Dock Supervisor | Oversee all inbound operations, approve exceptions |
| Receiving Clerk | Physical inspection, quantity verification, system entry |
| Quality Inspector | Perishable/regulated product inspection |
| Inventory Control Analyst | Reconcile receipts against POs in SAP |
| Data Entry Operator | WMS transaction recording |

## 4. Procedure

### 4.1 Pre-Arrival

1. Review the **Daily Expected Receipts Report** generated from SAP open PO data (published daily at 05:00 local time).
2. Verify dock door availability and assign inbound appointments.
3. For **perishable goods**: Confirm cold storage capacity is available. Contact Cold Chain Manager if capacity < 80%.
4. For **international shipments**: Verify customs clearance documentation is complete.

### 4.2 Arrival and Unloading

1. Verify carrier documentation against the Purchase Order:
   - PO number must match exactly
   - Supplier name must match (NOTE: supplier names may vary between systems -- refer to the Supplier Cross-Reference Guide SOP-DATA-003 if uncertain)
   - SKU and quantity must match PO line items
2. Perform **visual inspection** of all pallets/cartons for damage.
3. Record actual arrival time in WMS.
   - **IMPORTANT**: Record time in LOCAL WAREHOUSE TIME. Do not convert to UTC. The system handles timezone conversion.
   - **KNOWN ISSUE**: Timestamps between SAP (UTC) and WMS (local time) may appear inconsistent. This is expected behavior. Do not attempt manual correction.

### 4.3 Quantity Verification

1. Count all received units. For pallet-level receipts, verify pallet count and multiply by standard pallet quantity.
2. Record in WMS:
   - SKU (scan barcode -- system will resolve to MCG global SKU)
   - Quantity received
   - Lot number (if applicable)
   - **CRITICAL FOR FOOD PRODUCTS**: Lot number is MANDATORY. Do not receipt food products without a lot number. If supplier has not provided a lot number, contact Supplier Management before proceeding. Reference: EU Food Safety Compliance Policy MCG-POL-007.
3. If received quantity differs from PO quantity:
   - Shortage < 5%: Record actual quantity, system generates shortage alert
   - Shortage > 5%: Hold receipt, notify Receiving Dock Supervisor
   - Overship: Accept only the PO quantity. Excess requires supervisor approval.

### 4.4 Quality Inspection

1. **Perishable goods** (Grocery, Fresh, Health & Wellness with cold chain requirements):
   - Verify temperature on arrival using handheld probe thermometer
   - Acceptable range: **2°C to 6°C** for chilled, **-22°C to -18°C** for frozen
   - Record temperature reading in WMS quality inspection module
   - If temperature exceeds threshold: **REJECT entire shipment**. Do not partial-accept. Notify Quality Manager and Supplier Management.
   - Cross-reference IoT sensor data from Tive/Sensitech tracker (if available) via the Cold Chain Monitoring Dashboard.
2. **Electronics and high-value goods**:
   - Verify serial numbers for items > $200 unit cost
   - Conduct 10% random sample inspection for cosmetic damage
3. **General merchandise**:
   - 5% random sample inspection unless supplier quality score < 90%, then 20% inspection

### 4.5 System Recording

1. Post Goods Receipt in **WMS first**, then verify ERP posting:
   - Oracle WMS (Americas, EU DCs): Use transaction type GR-PO
   - Manhattan Associates (APAC DCs): Use receipt workflow RCV-STD
   - **KNOWN ISSUE**: WMS-to-SAP synchronization runs every 15 minutes via CDC. If you check SAP immediately after WMS posting, the receipt may not yet be visible. Wait at least 20 minutes before escalating a sync concern.
2. Assign storage location (bin) based on product storage requirements:
   - AMBIENT → Zones A-D
   - CHILLED → Zones E-F (temperature-controlled)
   - FROZEN → Zone G (sub-zero)
3. Print and apply put-away labels.

### 4.6 Exception Handling

| Exception | Action | Escalation |
|---|---|---|
| PO not found in system | Hold at dock, contact Procurement | Receiving Supervisor within 1 hour |
| Quantity mismatch > 5% | Partial receipt, create discrepancy report | Inventory Control within 4 hours |
| Damaged goods | Photograph, record in WMS, segregate | Quality Manager within 2 hours |
| Temperature exceedance (perishable) | Reject entire shipment | Quality Manager IMMEDIATELY |
| Unknown SKU / barcode won't scan | Check legacy SKU cross-reference. If still unresolved, hold and contact Product Data team | Product Data team within 4 hours |
| Missing lot number (food products) | DO NOT receipt. Contact supplier. | Compliance Officer within 2 hours |

## 5. Key Performance Indicators

| KPI | Target | Measurement |
|---|---|---|
| Receipt accuracy (qty match) | > 99% | Monthly, per DC |
| Receipt processing time | < 4 hours from dock arrival | Per receipt |
| Temperature compliance (perishable) | 100% within range | Per receipt |
| Lot number capture rate (food) | 100% | Monthly, per DC |
| WMS-to-SAP sync lag | < 30 minutes | Real-time monitoring |

## 6. Related Documents

- SOP-WH-002: Inventory Cycle Count Procedure
- SOP-WH-003: Outbound Picking and Packing
- SOP-WH-006: Returns Processing
- SOP-DATA-003: Supplier Cross-Reference Guide
- MCG-POL-007: EU Food Safety Compliance Policy
- MCG-POL-012: Cold Chain Management Policy

## 7. Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2020-03-01 | H. Jansen | Initial release |
| 2.0 | 2022-06-15 | H. Jansen | Added APAC Manhattan WMS procedures |
| 3.0 | 2024-01-10 | H. Jansen | Added mandatory lot number for food products per EU audit findings |
| 3.1 | 2024-09-01 | H. Jansen | Added known issue note re: WMS/SAP timestamp discrepancy |
| 3.2 | 2025-01-15 | H. Jansen | Added IoT sensor cross-reference step for perishable inspection |

---
*Meridian Commerce Group -- Confidential*
