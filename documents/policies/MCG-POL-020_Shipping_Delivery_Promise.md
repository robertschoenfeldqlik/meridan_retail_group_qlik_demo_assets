# MERIDIAN COMMERCE GROUP POLICY
## MCG-POL-020: E-Commerce Shipping & Delivery Promise Policy

| | |
|---|---|
| **Policy ID** | MCG-POL-020 |
| **Version** | 1.1 |
| **Effective Date** | 2025-04-01 |
| **Owner** | Li Wei Chen, Regional Logistics Director, APAC (co-owner with e-commerce team) |
| **Approved By** | Thomas Brennan, VP Supply Chain |
| **Review Frequency** | Quarterly (due to carrier contract changes) |

---

## 1. Policy Statement

Meridian Commerce Group is committed to providing accurate, achievable delivery promises to our e-commerce customers. Delivery estimates displayed at checkout MUST reflect actual carrier capabilities and current service level agreements. Displaying unachievable delivery promises erodes customer trust and generates costly WISMO contacts.

## 2. Background

In October 2025, MCG discovered that the meridiancommerce.com checkout page was displaying **2-day delivery** for Singapore orders, despite NinjaVan's contract amendment (CARRIER-NV-2025-AMD3, effective October 1, 2025) reclassifying parcels > 5kg from 2-day to 3-day service. This mismatch affected **68% of Singapore orders** (primarily electronics) and was not detected for over 3 weeks.

As Li Wei Chen stated in the Q3 Supply Chain Review: "We've been systematically lying to 14,000 customers per month."

**Root cause**: The carrier contract amendment was filed with Procurement but never communicated to the e-commerce team. MCG's systems do not connect carrier contract data to delivery promise logic on the website.

## 3. Delivery Promise Matrix

### 3.1 Current Delivery Promises by Region

| Region | Country | Weight Class | Carrier | SLA (Business Days) | Display to Customer |
|---|---|---|---|---|---|
| EU | Netherlands | All | DPD / FedEx | 1-2 days | "1-2 business days" |
| EU | Germany | < 5 kg | DPD Classic | 1-3 days | "2-3 business days" |
| EU | Germany | 5-10 kg | DPD Classic | 2-3 days | "2-4 business days" |
| EU | France | All | DPD International | 3-5 days | "3-5 business days" |
| EU | Belgium | All | DPD / FedEx | 2-3 days | "2-3 business days" |
| Americas | United States | < 5 kg | FedEx Ground | 3-5 days | "3-5 business days" |
| Americas | United States | 5-20 kg | FedEx Ground | 3-7 days | "5-7 business days" |
| Americas | Brazil | All | Correios SEDEX | 5-10 days | "5-10 business days" |
| APAC | Singapore | < 5 kg | NinjaVan Standard | 2 days | "2 business days" |
| APAC | Singapore | **5-10 kg** | **NinjaVan Standard** | **3 days** | **"3 business days"** |
| APAC | Singapore | > 10 kg | NinjaVan Heavy | 3-5 days | "3-5 business days" |
| APAC | Malaysia | All | NinjaVan | 3-5 days | "3-5 business days" |
| Africa | Nigeria | All | Local courier | 7-14 days | "7-14 business days" |
| Africa | Kenya | All | Local courier | 7-14 days | "7-14 business days" |

**CRITICAL**: Singapore 5-10 kg row was updated on October 20, 2025 following the discovery of the NinjaVan contract mismatch. Previously displayed "2 business days."

### 3.2 Buffer Policy

All delivery promises displayed to customers must include a **1-day buffer** above the carrier's contractual SLA to account for:
- Warehouse processing time (pick, pack, ship: typically 4-8 hours)
- Carrier pickup scheduling
- Potential weather or customs delays

**Exception**: Markets with already-long delivery promises (> 7 days) do not need additional buffer.

## 4. Process Requirements

### 4.1 Carrier Contract Change Communication (NEW -- Effective October 2025)

When any carrier contract amendment, renewal, or change is executed that affects delivery SLAs, the following communication flow is **mandatory**:

```
Procurement executes carrier contract change
        ↓
Procurement notifies (within 24 hours):
  1. Supply Chain Analytics team (Pieter van Dijk)
  2. E-Commerce Operations team
  3. Customer Service Operations (for WISMO script updates)
        ↓
E-Commerce team updates delivery promise on website (within 48 hours)
        ↓
Customer Service updates WISMO scripts (within 48 hours)
        ↓
Supply Chain Analytics updates SLA monitoring dashboards (within 48 hours)
```

**KNOWN GAP**: This process is currently **manual and email-based**. There is no system that automatically links carrier contract changes to delivery promise logic. Project CLARITY (Qlik platform) will address this by including carrier contract data in the Qlik Answers knowledge base and enabling Discovery Agent to detect when a contract change should trigger a website update.

### 4.2 Monitoring

| Check | Frequency | Owner | Method |
|---|---|---|---|
| Compare delivery promise vs actual delivery time | Weekly | Supply Chain Analytics | Manual Excel analysis (SAP + carrier data) |
| SLA breach rate by region/carrier | Weekly | Supply Chain Analytics | Manual Excel analysis |
| WISMO rate by region | Daily | Customer Service Ops | Salesforce CRM report |
| Customer NPS by region | Monthly | Customer Experience | Survey platform |

**Future State**: Qlik Sense dashboard with automated SLA compliance monitoring, integrated with Discovery Agent alerts when breach rates exceed thresholds.

## 5. Non-Compliance Tracking

### 5.1 Delivery Promise Accuracy (Q3 2025)

| Region | Orders | On-Time (vs Promise) | Late | Promise Accuracy |
|---|---|---|---|---|
| EU (overall) | 245,000 | 218,000 | 27,000 | **89%** |
| Americas | 180,000 | 162,000 | 18,000 | **90%** |
| APAC (overall) | 95,000 | 74,000 | 21,000 | **78%** |
| APAC (Singapore) | 42,000 | 29,000 | 13,000 | **69%** |
| Africa | 15,000 | 10,500 | 4,500 | **70%** |
| LATAM | 32,000 | 25,600 | 6,400 | **80%** |

Singapore's 69% accuracy is directly attributable to the NinjaVan SLA change that was not reflected on the website.

### 5.2 WISMO Impact

| Region | WISMO Calls/Month | WISMO as % of Contacts | Estimated Monthly Cost |
|---|---|---|---|
| Global | 536,000 | 41% | $1,232,800 |
| Singapore | 28,000 | 52% | $64,400 |

Singapore's WISMO rate (52%) is 11 points above the global average, directly correlated with the delivery promise mismatch.

## 6. Related Documents

- CARRIER-NV-2025-AMD3: NinjaVan Contract Amendment
- SOP-CS-001: WISMO Call Handling Procedure
- MTG-SC-2025-Q3: Q3 Supply Chain Performance Review (Singapore SLA discussion)
- CARRIER-FEDEX-2025: FedEx Rate Card and SLA
- CARRIER-DPD-2025-SA: DPD Service Agreement

---
*Meridian Commerce Group -- Supply Chain & E-Commerce Operations -- Internal*
