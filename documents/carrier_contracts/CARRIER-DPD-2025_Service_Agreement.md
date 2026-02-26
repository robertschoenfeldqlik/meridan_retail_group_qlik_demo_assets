# CARRIER SERVICE AGREEMENT
## DPD Germany GmbH -- MCG Service Agreement Summary

| | |
|---|---|
| **Agreement ID** | CARRIER-DPD-2025-SA |
| **Carrier** | DPD Germany GmbH |
| **Carrier Code** | DPD-DE |
| **Agreement Effective** | January 1, 2025 -- December 31, 2025 |
| **MCG Contact** | Rachel Foster, Regional Logistics Director, Americas / Thomas Brennan, VP Supply Chain |
| **DPD Contact** | Klaus Bauer, Key Account Manager |
| **Annual Volume Commitment** | 620,000 parcels |
| **Service Territory** | Germany, Austria, Netherlands, Belgium, Luxembourg, France, Poland, Czech Republic |

---

## 1. Service Tiers

| Tier | Service Name | SLA (Delivery) | Max Weight | Max Dimensions | Base Rate (EUR) |
|---|---|---|---|---|---|
| DPD Express | DPD Express 10:00 | Next business day by 10:00 | 31.5 kg | 175 cm (L+W+H) | 12.80 |
| DPD Classic | DPD Classic | 1-3 business days | 31.5 kg | 175 cm (L+W+H) | 6.45 |
| DPD Economy | DPD Economy | 3-5 business days | 31.5 kg | 175 cm (L+W+H) | 4.20 |
| DPD International | DPD Classic International | 3-7 business days | 31.5 kg | 175 cm (L+W+H) | 9.85 |

## 2. Service Level Commitments

| Metric | Target | Measurement Method |
|---|---|---|
| On-time delivery (Express) | 98.5% | DPD tracking data vs SLA window |
| On-time delivery (Classic) | 96% | DPD tracking data vs SLA window |
| On-time delivery (Economy) | 94% | DPD tracking data vs SLA window |
| Damage rate | < 0.3% | MCG customer claims / total parcels |
| Loss rate | < 0.05% | Parcels not delivered within 30 days |
| First attempt delivery success | > 92% | DPD tracking data |

### 2.1 SLA Credit Structure

| SLA Breach Level | Credit |
|---|---|
| On-time delivery falls below target by 1-3% | 2% credit on monthly invoice |
| On-time delivery falls below target by 3-5% | 5% credit on monthly invoice |
| On-time delivery falls below target by > 5% | 10% credit + contract review triggered |
| Individual parcel SLA breach (Express only) | Shipping cost refunded for that parcel |

## 3. Tracking and Visibility

### 3.1 Tracking Status Codes

DPD provides tracking status via their API and web portal. **NOTE**: Status descriptions from DPD Germany API are returned in **German by default**. MCG systems must handle translation.

| DPD Status Code | German Description | English Translation | MCG Canonical Status |
|---|---|---|---|
| 01 | Paket wurde abgeholt | Parcel picked up | PICKED_UP |
| 02 | Paket ist im DPD-Paketzentrum eingetroffen | Arrived at DPD parcel center | IN_TRANSIT |
| 03 | Paket ist im Zielgebiet eingetroffen | Arrived at destination area | IN_TRANSIT |
| 04 | Paket ist in Zustellung | Out for delivery | OUT_FOR_DELIVERY |
| 05 | Paket wurde zugestellt | Parcel delivered | DELIVERED |
| 06 | Zustellung nicht möglich -- Empfänger nicht angetroffen | Delivery not possible -- recipient not found | DELIVERY_FAILED |
| 07 | Paket wird im Paketshop bereitgehalten | Parcel held at DPD pickup shop | HELD_AT_PICKUP |
| 08 | Paket wurde vom Empfänger im Paketshop abgeholt | Picked up by recipient at DPD shop | DELIVERED |
| 09 | Paket wurde an Absender zurückgesendet | Parcel returned to sender | RETURNED |
| 10 | Sendungsdaten wurden elektronisch übermittelt | Shipment data transmitted electronically | LABEL_CREATED |

**KNOWN ISSUE**: MCG's Descartes TMS currently stores DPD status codes in their German-language text form rather than translating to MCG canonical status codes. This means WISMO agents must read German status text when checking DPD shipments, or use Chrome's translate function. The Qlik Talend Cloud carrier status canonicalization pipeline (Transformation Route 5) will resolve this.

### 3.2 API Integration

| Parameter | Value |
|---|---|
| API Type | REST (DPD Web Service) |
| Base URL | https://api.dpd.de/v1/ |
| Authentication | API Key (header: `x-dpd-api-key`) |
| Tracking Endpoint | GET /tracking/{parcelNumber} |
| Webhook | POST to MCG endpoint on status change |
| Rate Limit | 1,000 requests/minute |
| Data Format | JSON (status text in German unless `lang=en` header sent) |

**NOTE**: MCG's current integration does NOT send the `lang=en` header, resulting in German-language status messages stored in Descartes TMS.

### 3.3 EDI Integration

DPD also supports UN/EDIFACT IFTSTA messages for tracking updates. MCG receives these via AS2 connection. However, the EDI messages use DPD's internal event codes (different from the API status codes above), creating a **second mapping challenge** when both data sources feed into TMS simultaneously.

## 4. Surcharges

| Surcharge Type | Rate | Conditions |
|---|---|---|
| Fuel surcharge | Variable (currently 8.2%) | Adjusted monthly based on diesel index |
| Oversize surcharge | EUR 4.50 | Longest side > 120 cm |
| Overweight surcharge | EUR 3.20 | > 20 kg |
| Peak season surcharge | EUR 0.85/parcel | November 15 -- January 5 |
| Saturday delivery | EUR 5.50/parcel | Available for Express tier only |
| Address correction | EUR 2.80 | When DPD corrects delivery address |
| Return service | EUR 4.10 | MCG return label parcels |

## 5. Performance (Q3 2025)

| Metric | Target | Q3 Actual | Notes |
|---|---|---|---|
| Volume | 155,000/quarter | 162,300 | 5% above plan (seasonal) |
| On-time (Express) | 98.5% | 97.2% | Below target -- Munich DC dispatch delays |
| On-time (Classic) | 96% | 94.8% | Below target -- address correction delays |
| On-time (Economy) | 94% | 93.1% | Marginally below target |
| Damage rate | < 0.3% | 0.22% | Within target |
| First attempt success | > 92% | 89.4% | Below target -- address quality issue |

**Key finding**: First attempt delivery success dropped to 89.4% primarily due to **address quality issues** in MCG's order data. DPD reported that 6.8% of parcels had addresses that required manual correction by DPD drivers or resulted in failed first attempts. The most common issues:
- Truncated street names (MCG system limitation: 35-character address field)
- Missing apartment/floor numbers
- Incorrect postal codes (transposed digits)
- Dutch addresses formatted in German conventions (or vice versa)

## 6. Dispute Log (Q3 2025)

| Dispute # | Date | Amount | Issue | Status |
|---|---|---|---|---|
| DPD-D-2025-041 | Jul 15 | EUR 342 | 12 parcels billed as Express but downgraded to Classic by DPD | Resolved -- credit issued |
| DPD-D-2025-047 | Aug 8 | EUR 1,240 | Fuel surcharge rate discrepancy (8.2% applied vs 7.8% contractual for August) | Under review |
| DPD-D-2025-052 | Sep 3 | EUR 890 | 31 parcels marked as oversize that were within spec | Resolved -- credit issued |
| DPD-D-2025-058 | Sep 22 | EUR 2,100 | SLA credits not applied for September Express underperformance | Pending |

## 7. Renewal Notes

Contract renewal discussion scheduled for November 2025. Key negotiation points:
1. Address correction surcharge waiver until MCG address quality improvement program completes
2. API language parameter change to default English responses
3. Volume tier discount for exceeding 620K commitment
4. Integration of DPD Predict (delivery time window notification) into MCG customer communications

---
*Meridian Commerce Group -- Procurement -- Confidential*
