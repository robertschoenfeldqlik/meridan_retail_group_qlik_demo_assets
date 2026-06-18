# MEETING MINUTES
## Q3 2025 Supply Chain Performance Review

| | |
|---|---|
| **Meeting ID** | MTG-SC-2025-Q3 |
| **Date** | October 8, 2025, 09:00-11:30 CET |
| **Location** | Rotterdam HQ, Boardroom 3 / MS Teams |
| **Chair** | Thomas Brennan, VP Supply Chain |
| **Minutes By** | Pieter van Dijk, Supply Chain Analyst |

---

## Attendees

| Name | Title | Location |
|---|---|---|
| Thomas Brennan | VP Supply Chain | Rotterdam (in person) |
| Henrik Jansen | VP Warehouse Operations | Rotterdam (in person) |
| Li Wei Chen | Regional Logistics Director, APAC | Singapore (remote) |
| Carlos Mendez | Regional Logistics Director, LATAM | Sao Paulo (remote) |
| Rachel Foster | Regional Logistics Director, Americas | Atlanta (remote) |
| Ana Ferreira | Cold Chain Manager | Rotterdam (in person) |
| Priya Ramanathan | Chief Data Officer | Rotterdam (in person) |
| Dr. Elena Vasquez | Chief Compliance Officer | Rotterdam (remote) |
| Pieter van Dijk | Supply Chain Analyst | Rotterdam (in person) |

---

## Agenda and Discussion

### 1. Q3 Performance Dashboard Review

Thomas presented the Q3 supply chain scorecard. Key metrics:

| Metric | Q3 Target | Q3 Actual | Trend | RAG |
|---|---|---|---|---|
| Inventory accuracy (IRA) | 97% | **74%** | Declining | RED |
| Last-mile SLA (global) | 92% | **82%** | Declining | RED |
| Last-mile SLA (APAC) | 92% | **78%** | Sharply declining | RED |
| Spoilage loss | $10M/qtr | **$14.2M** | Increasing | RED |
| WISMO call rate | < 25% | **41%** | Increasing | RED |
| Food traceability | 100% | **88%** | Flat | AMBER |
| Order fulfillment rate | 98% | 94.2% | Declining | AMBER |
| Carrier cost per parcel (avg) | $6.20 | $6.85 | Increasing | AMBER |

Thomas: "Every single metric is below target. Some significantly. This is not a seasonal blip -- these are structural problems."

### 2. Rotterdam Pipeline Failure (INC-2025-04872)

Henrik briefed the group on the Rotterdam WMS-SAP synchronization failure discovered by Pieter on September 28.

Key points discussed:
- The batch job failed silently on September 24 and went undetected for 4.3 days
- 42 SKUs affected, 847 units of phantom inventory
- 7 stores experienced out-of-stock events that could have been prevented
- Root cause: no monitoring on data freshness, only on errors

**Priya (CDO):** "This is exactly the kind of failure that our current architecture cannot detect. We monitor for errors but not for the absence of data. The Qlik Talend Cloud platform we're evaluating would replace this batch job with real-time CDC and include pipeline health monitoring out of the box."

**Thomas:** "How many other silent failures are happening right now that we don't know about?"

**Priya:** "Based on the data health assessment, we estimate 23 pipeline failures per week across the organization. About 25% of those are silent -- so roughly 5-6 undetected failures at any given time."

**ACTION ITEM**: Priya to present Project Qlarity platform recommendation to the CIO by October 31.

### 3. APAC SLA Decline

Li Wei presented analysis of the Singapore delivery performance decline:

- SLA compliance dropped from 92% to 78% since October 1
- Root cause identified: NinjaVan contract amendment (CARRIER-NV-2025-AMD3) reclassified parcels > 5kg from 2-day to 3-day service
- 68% of affected orders are electronics > 5kg
- The meridiancommerce.com checkout page still promises 2-day delivery for Singapore
- Customer NPS for Singapore dropped 18 points in October

**Li Wei:** "The contract change happened October 1 but nobody updated the delivery promise on the website. We've been systematically lying to 14,000 customers per month."

**Thomas:** "Why didn't we catch this sooner?"

**Li Wei:** "The carrier contract amendment was filed with Procurement but never communicated to the e-commerce team or the supply chain analytics team. Our systems don't connect contract changes to delivery promise logic."

**ACTION ITEMS:**
1. Li Wei to immediately request e-commerce team update Singapore delivery estimates -- URGENT
2. Li Wei to evaluate J&T Express and Lalamove as secondary carriers for 5-10 kg bracket
3. Priya to ensure carrier contract data is included in the Qlik platform scope

### 4. Cold Chain / Spoilage Update

Ana presented the cold chain performance review:

- Q3 spoilage losses: $14.2M (42% above $10M target)
- Primary driver: Sao Paulo-Buenos Aires corridor temperature exceedances (+340% since August)
- TransFrio fleet upgrade created a 15-minute refrigeration startup gap
- Border crossing wait times at Uruguaiana increased from 1.2 to 3.5 hours
- Lagos DC sensors have daily 6-hour connectivity blackouts, limiting monitoring visibility

**Ana:** "We're flying blind on the Lagos-Abidjan corridor. We have no temperature data for 6 hours every day. And on the GRU-BA route, we're estimating $180K per week in spoilage exposure."

**Carlos:** "I've been pushing TransFrio to pre-cool to 0°C before loading but they're resistant. They say it increases their energy costs by 15%."

**Thomas:** "Tell them if they don't pre-cool, we're switching to air freight and they lose the contract."

**ACTION ITEMS:**
1. Carlos to issue formal requirement to TransFrio: pre-cool to 0°C or face contract review
2. Ana to deploy redundant Tive sensors on all GRU-BA shipments immediately
3. Ana to work with IT to resolve Lagos DC sensor connectivity (ISP issue?)
4. Priya to include IoT telemetry normalization in Project Qlarity scope

### 5. EU Compliance Update

Dr. Vasquez provided an update on the NVWA corrective action plan:

- Mandatory lot number capture: Implemented at all DCs since October 1. Compliance rate improved from 85% to 93% in first week.
- Store-level receipt tracking: Improved from 70% to 78%. Target 85% by December.
- Unified traceability system: Dependent on Project Qlarity. Priya confirmed it's in scope.
- Sub-tier supplier mapping: 36% complete. On track for 50% by year end, 80% by end of 2026.

**Dr. Vasquez:** "The NVWA will likely conduct a follow-up inspection in Q1 2026. If we can demonstrate the Qlik platform with unified lineage by then, it will significantly strengthen our position."

### 6. Project Qlarity Status

Priya provided a brief update on the data platform evaluation:

- Qlik selected as strategic platform partner (pending CIO approval)
- Scope includes: real-time data integration (Talend Cloud + CDC), data quality and Trust Score, Open Lakehouse, Qlik Analytics analytics, and AI capabilities (Qlik Answers + Discovery Agent)
- Estimated implementation: 6 months for Phase 1 (integration + quality + dashboards), 12 months for full platform including AI
- Budget: Presentation to CIO scheduled for October 31
- Expected ROI: $85M+ annually (inventory accuracy, spoilage reduction, analyst productivity, compliance)

**Thomas:** "This is the single most important initiative for supply chain. I'll co-present with Priya to the CIO."

---

## Summary of Action Items

| # | Action | Owner | Due Date | Priority |
|---|---|---|---|---|
| 1 | Present Project Qlarity to CIO | Priya + Thomas | Oct 31 | HIGH |
| 2 | Update Singapore delivery estimates on website | Li Wei / E-commerce | IMMEDIATE | CRITICAL |
| 3 | Evaluate secondary carriers for Singapore 5-10 kg bracket | Li Wei | Nov 15 | HIGH |
| 4 | Issue pre-cool requirement to TransFrio | Carlos | Oct 15 | HIGH |
| 5 | Deploy redundant sensors on GRU-BA route | Ana | Oct 20 | HIGH |
| 6 | Resolve Lagos DC sensor connectivity | Ana / IT | Nov 1 | MEDIUM |
| 7 | Continue lot number compliance push (target 100%) | Henrik | Ongoing | HIGH |
| 8 | Continue store receipt tracking improvement | Henrik | Dec 31 | MEDIUM |

## Next Meeting

Q4 2025 Supply Chain Performance Review: January 14, 2026, 09:00 CET

---
*Meridian Commerce Group -- Internal*
