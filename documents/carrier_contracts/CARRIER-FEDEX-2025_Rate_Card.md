# CARRIER RATE CARD
## FedEx -- MCG Enterprise Agreement Rate Schedule 2025

| | |
|---|---|
| **Document ID** | CARRIER-FX-2025-RATES |
| **Effective** | January 1, 2025 -- December 31, 2025 |
| **Account Number** | MCG-ENT-4847291 |
| **MCG Contact** | Thomas Brennan, VP Supply Chain |
| **FedEx Contact** | Amanda Torres, Enterprise Account Director |

---

## 1. Negotiated Rates -- Americas

### FedEx Ground

| Weight Bracket | Zone 1-2 (USD) | Zone 3-4 (USD) | Zone 5-6 (USD) | Zone 7-8 (USD) |
|---|---|---|---|---|
| 0 - 1 lb | $4.85 | $5.20 | $5.90 | $6.75 |
| 1 - 5 lbs | $5.90 | $6.40 | $7.10 | $8.20 |
| 5 - 10 lbs | $7.50 | $8.10 | $9.20 | $10.80 |
| 10 - 25 lbs | $10.20 | $11.50 | $13.00 | $15.50 |
| 25 - 50 lbs | $14.00 | $16.00 | $18.50 | $22.00 |
| 50 - 70 lbs | $18.50 | $21.00 | $24.50 | $29.00 |

**Note**: Rates are per package. Dimensional weight pricing applies when dim weight exceeds actual weight. Dim factor: 139 (domestic).

### FedEx Express (Next Day / 2-Day)

| Service | Weight Bracket | Rate (USD) | SLA |
|---|---|---|---|
| FedEx First Overnight | 0 - 10 lbs | $28.50 | Next business day by 8:00 AM |
| FedEx Priority Overnight | 0 - 10 lbs | $22.00 | Next business day by 10:30 AM |
| FedEx Standard Overnight | 0 - 10 lbs | $18.50 | Next business day by 3:00 PM |
| FedEx 2Day | 0 - 10 lbs | $12.80 | 2 business days by end of day |

### Surcharges (2025)

| Surcharge | Rate |
|---|---|
| Fuel surcharge (Ground) | 8.5% (updated monthly -- see FedEx fuel index) |
| Fuel surcharge (Express) | 12.0% |
| Residential delivery | +$4.40 per package |
| Delivery area surcharge (extended) | +$3.80 per package |
| Additional handling (oversize) | +$16.00 per package |
| Signature required | +$5.50 per package |
| Saturday delivery | +$16.00 per package |
| Address correction | +$19.50 per package |

## 2. Service Level Agreements

| Service | SLA Commitment | On-Time Guarantee | Penalty for Breach |
|---|---|---|---|
| FedEx Ground | Published transit time by zone | Money-back guarantee | Full refund of shipping charges |
| FedEx Express | Delivery by committed time | Money-back guarantee | Full refund of shipping charges |
| FedEx Ground Economy | 2-7 business days | No guarantee | No penalty |

**MCG-specific SLA addendum**: FedEx commits to 97.5% on-time delivery rate across all MCG Ground shipments, measured monthly. If monthly performance falls below 95%, MCG receives a 2% rate credit for the following month.

## 3. Volume Commitment

MCG commits to a minimum of **850,000 packages per year** via FedEx (all services combined) in exchange for the enterprise rates above. If volume falls below 80% of commitment (680,000), FedEx reserves the right to adjust rates to published list prices.

Current YTD volume (through September 2025): **672,000 packages** (on track for ~896,000 annualized).

## 4. Data Integration

| Capability | Status |
|---|---|
| Tracking API (REST) | Active -- real-time webhook push |
| Shipping API | Active -- label generation via API |
| Invoice EDI (210) | Active -- weekly electronic invoicing |
| Address validation API | Active -- pre-shipment address check |
| Proof of delivery | Available via API (signature image) |

**API endpoint**: `https://apis.fedex.com/track/v1/` (OAuth 2.0 authentication)
**Webhook push**: Events delivered within 60 seconds of scan. Status codes follow FedEx standard enumeration (LABEL_CREATED, PICKED_UP, IN_TRANSIT, ON_VEHICLE, DELIVERED, DELIVERY_EXCEPTION).

## 5. Key Contact Information

| Role | Name | Email | Phone |
|---|---|---|---|
| Enterprise Account Director | Amanda Torres | a.torres@fedex.com | +1 800 555 0142 |
| Operations Liaison | David Kim | d.kim@fedex.com | +1 800 555 0143 |
| Invoice Disputes | FedEx Revenue Services | billing@fedex.com | +1 800 555 0100 |
| API Support | FedEx Developer Support | developer@fedex.com | +1 800 555 0199 |

---
*Meridian Commerce Group -- Confidential -- Carrier Relations*
