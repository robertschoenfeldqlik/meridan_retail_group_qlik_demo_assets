# PROJECT BRIEF
## Project Qlarity: Unified Data Platform Business Case

| | |
|---|---|
| **Project Name** | Qlarity (Connected Logistics, Analytics, and Real-time Intelligence Technology) |
| **Project ID** | PROJ-2025-Qlarity |
| **Sponsor** | Thomas Brennan, VP Supply Chain |
| **Project Lead** | Priya Ramanathan, Chief Data Officer |
| **Status** | Business Case -- Pending CIO Approval |
| **Presentation Date** | October 31, 2025 |
| **Target Start Date** | January 2026 |

---

## 1. Executive Summary

Meridian Commerce Group's supply chain is failing due to fragmented, poor-quality data distributed across **47 source systems** with no unified view. In Q3 2025, data quality failures cost MCG an estimated **$127M annually** in phantom inventory, spoilage, customer service overhead, compliance penalties, and SLA failures.

Project Qlarity proposes implementing the **Qlik platform** (Qlik Talend Cloud, Qlik Open Lakehouse, Qlik Analytics, Qlik Answers, and supporting AI capabilities) as MCG's strategic data platform to connect, trust, store, analyze, predict, and converse with supply chain data.

**Total investment**: $12.4M over 24 months
**Expected annual benefit**: $85M+ (conservative estimate)
**Payback period**: < 4 months after Phase 1 go-live

## 2. Problem Statement

### 2.1 The Seven Data Quality Nightmares

| # | Nightmare | Annual Cost | Systems Affected |
|---|---|---|---|
| 1 | Phantom Inventory (IRA at 74%) | $48M | Oracle WMS, Manhattan WMS, SAP |
| 2 | Address Data Catastrophe | $3.1M | Salesforce, Carrier systems |
| 3 | Product Master Mess | $8.2M | SAP MDG, WMS, POS |
| 4 | Silent Pipeline Failures | $12M | All integration pipelines |
| 5 | Timestamp Tower of Babel | $6.5M | All systems (cross-cutting) |
| 6 | Carrier Data Black Hole | $14.8M | Descartes TMS, 6 carrier systems |
| 7 | Compliance Traceability Gap | $4.2M | SAP, WMS, QMS, Supplier Portal |

### 2.2 Key Incidents Driving Urgency

1. **Rotterdam Pipeline Failure (INC-2025-04872)**: WMS-SAP batch job failed silently for 4.3 days. 847 units phantom inventory. 7 stores experienced preventable out-of-stock events. No monitoring detected the failure.

2. **Lettuce Recall (RCL-2025-003)**: Took 11 days to trace product from DC to all 210 affected stores (target: 24 hours). NVWA citation issued. Data fragmented across 4 systems.

3. **Singapore SLA Decline**: NinjaVan contract amendment changed delivery SLAs but was never communicated to e-commerce team. 14,000 customers/month received false delivery promises for 3+ weeks.

4. **LATAM Spoilage Crisis (INC-2025-05102)**: $2.48M in Q3 spoilage on one route. Temperature exceedances dismissed as "summer heat" for 3 weeks because IoT data and carrier data aren't connected.

### 2.3 Board Mandate

At the Q3 2025 Board meeting, CEO Ingrid van der Berg stated that data quality and supply chain visibility are MCG's **#1 operational priority** for 2026.

## 3. Proposed Solution: Qlik Platform

### 3.1 Platform Components

| Component | Capability | MCG Use Case |
|---|---|---|
| **Qlik Talend Cloud** | Data integration (CDC, SaaS connectors, API, file) | Replace 47 fragmented pipelines with unified real-time integration |
| **Qlik Talend Cloud Data Quality** | Profiling, standardization, matching/dedup | Address standardization, supplier dedup, lot number validation |
| **Qlik Talend Cloud Stewardship** | Human-in-the-loop data governance workflows | Manage exceptions from automated matching (< 90% confidence) |
| **Qlik Open Lakehouse** | Managed Apache Iceberg storage | Bronze/Silver/Gold data architecture replacing siloed databases |
| **Qlik Trust Score for AI** | Data quality scoring (Diversity, Timeliness, Accuracy) | Trust scoring for all supply chain data assets |
| **Qlik Analytics (Cloud Analytics)** | Interactive analytics and dashboards | Unified supply chain dashboards replacing Excel reconciliation |
| **Qlik Answers** | Conversational AI with RAG over structured + unstructured data | Natural language queries: "What is the status of order WEB-2025-10-0094827?" |
| **Discovery Agent** | Proactive anomaly detection and insight generation | Auto-detect pipeline failures, SLA degradation, spoilage risk |
| **Qlik AutoML / Predict** | Code-free machine learning | Spoilage prediction, demand forecasting, SLA breach prediction |
| **Qlik MCP Server** | Model Context Protocol for external AI tool integration | Enable third-party AI assistants to query MCG data |

### 3.2 Architecture

```
[47 Source Systems]
       ↓
[Qlik Talend Cloud -- Integration Layer]
  - CDC from PostgreSQL/Oracle/Manhattan WMS
  - Kafka streaming from IoT sensors
  - SaaS connectors for Salesforce, Descartes
  - API connectors for carrier tracking
  - File ingestion for legacy flat files
       ↓
[Qlik Open Lakehouse -- Storage Layer]
  - Bronze: Raw ingested data (append-only)
  - Silver: Cleansed, standardized, deduplicated
  - Gold: Business-ready data products
       ↓
[Qlik Talend Cloud -- Transformation Layer]
  - 8 transformation routes (timestamp, inventory, address, product, carrier, IoT, supplier, order timeline)
  - Data quality rules applied at Silver tier
  - Trust Score calculated at Gold tier
       ↓
[Qlik Analytics -- Analytics Layer]     [Qlik Answers -- AI Layer]
  - Supply chain dashboards           - Natural language queries
  - Inventory accuracy monitors       - SOP/policy document search
  - Cold chain visibility             - Order status lookup
  - Carrier performance               - Compliance evidence retrieval
       ↓                                      ↓
[Discovery Agent]                    [Qlik AutoML / Predict]
  - Proactive anomaly detection        - Spoilage risk model
  - Pipeline health monitoring         - Demand forecast
  - SLA degradation alerts             - SLA breach prediction
```

### 3.3 Transformation Architecture Note

Data lands in the Open Lakehouse at the Bronze tier in its raw form. Qlik Talend Cloud then reads from Bronze, applies transformations and data quality rules, and writes cleansed data back to the Lakehouse at the Silver and Gold tiers. This "ELT" approach (Extract-Load-Transform) ensures raw data is always preserved and transformations are auditable.

Additionally, Gold-tier data products will be exported as flat files for downstream consumers (e.g., inventory data feeds to B2B customers, compliance reports for regulators).

## 4. Implementation Phases

### Phase 1: Foundation (Months 1-6)
| Deliverable | Timeline | Owner |
|---|---|---|
| Qlik Talend Cloud deployment + Data Movement Gateway | Month 1-2 | IT + Qlik PS |
| CDC pipelines for Oracle WMS, SAP, Manhattan WMS | Month 2-3 | IT + CDO |
| Kafka streaming integration for IoT telemetry | Month 3-4 | IT + CDO |
| Open Lakehouse setup (Bronze/Silver layers) | Month 2-3 | CDO |
| 4 priority transformation routes (timestamp, inventory, carrier, IoT) | Month 3-5 | CDO |
| Pipeline health monitoring (resolve silent failure risk) | Month 2 | CDO |
| Qlik Analytics: Inventory accuracy dashboard | Month 4-5 | CDO + WH Ops |
| Qlik Analytics: Cold chain monitoring dashboard | Month 5-6 | CDO + Cold Chain |
| Trust Score deployment for Phase 1 data assets | Month 5-6 | CDO |

**Phase 1 expected impact**: Eliminate silent pipeline failures. Reduce inventory inaccuracy from 26% to < 10%. Reduce spoilage monitoring gap.

### Phase 2: Analytics & Quality (Months 7-12)
| Deliverable | Timeline | Owner |
|---|---|---|
| Remaining 4 transformation routes (address, product, supplier, order) | Month 7-9 | CDO |
| Gold layer data products | Month 8-10 | CDO |
| Qlik Talend Cloud Data Quality: Address standardization | Month 7-8 | CDO |
| Qlik Talend Cloud Data Quality: Supplier dedup | Month 8-9 | CDO |
| Qlik Talend Cloud Stewardship workflows | Month 9-10 | CDO + Procurement |
| Qlik Analytics: Full supply chain analytics suite | Month 8-12 | CDO + Supply Chain |
| Downstream flat file outputs (B2B inventory feeds) | Month 10-11 | CDO + B2B Team |
| Qlik AutoML: Spoilage prediction model | Month 10-12 | CDO |

**Phase 2 expected impact**: Address quality improvement to > 95% deliverability. Supplier master deduplication. Full supply chain analytics.

### Phase 3: AI & Conversational (Months 13-18)
| Deliverable | Timeline | Owner |
|---|---|---|
| Qlik Answers: Structured data integration | Month 13-14 | CDO |
| Qlik Answers: Unstructured document ingestion (SOPs, contracts, policies) | Month 14-15 | CDO + Compliance |
| Discovery Agent: Pipeline health monitoring | Month 14-16 | CDO |
| Discovery Agent: SLA degradation detection | Month 15-17 | CDO + Supply Chain |
| Discovery Agent: Spoilage risk proactive alerts | Month 16-18 | CDO + Cold Chain |
| Qlik MCP Server integration | Month 17-18 | CDO + IT |
| Qlik Answers: Customer service integration (WISMO) | Month 16-18 | CDO + CS Ops |

**Phase 3 expected impact**: WISMO call reduction of 55%. Proactive anomaly detection. Natural language access to supply chain data and documentation.

## 5. Financial Analysis

### 5.1 Investment

| Category | Year 1 | Year 2 | Total |
|---|---|---|---|
| Qlik platform licenses | $2.8M | $2.8M | $5.6M |
| Implementation services (Qlik PS + SI partner) | $2.4M | $1.2M | $3.6M |
| MCG internal resources (6 FTE dedicated) | $1.2M | $1.2M | $2.4M |
| Infrastructure (cloud compute, storage) | $0.4M | $0.4M | $0.8M |
| **Total** | **$6.8M** | **$5.6M** | **$12.4M** |

### 5.2 Expected Benefits (Annual, at Steady State)

| Benefit Area | Annual Value | Confidence |
|---|---|---|
| Inventory accuracy improvement (IRA 74% → 96%) | $38M | High |
| Spoilage reduction ($57M → $23M) | $34M | Medium-High |
| WISMO call reduction (55% fewer calls) | $8.1M | Medium |
| Analyst productivity (eliminate manual reconciliation) | $3.2M | High |
| Compliance cost avoidance (recall speed, penalties) | $2.8M | Medium |
| Carrier SLA improvement (address quality, tracking) | $1.8M | Medium |
| **Total estimated annual benefit** | **$87.9M** | |
| **Conservative estimate (60% realization)** | **$52.7M** | |

### 5.3 ROI Summary

| Metric | Value |
|---|---|
| Total investment (2 years) | $12.4M |
| Annual benefit (conservative) | $52.7M |
| Payback period | < 4 months after Phase 1 go-live |
| 3-year NPV (10% discount rate) | $118M |
| 3-year ROI | 952% |

## 6. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Data migration complexity underestimated | Medium | High | Phased approach; start with 3 priority sources |
| Organizational resistance to new tools | Medium | Medium | Change management program; executive sponsorship |
| Qlik platform capability gaps | Low | High | POC completed for core use cases |
| Talent/resource constraints | Medium | Medium | Qlik PS augmentation; training program |
| Integration with legacy systems (VPN + terminal emulator) | Medium | Medium | Data Movement Gateway; legacy connector evaluation |
| NVWA inspection before Phase 1 completes | Medium | High | Demonstrate in-progress implementation with interim improvements |

## 7. Governance

| Role | Person | Responsibility |
|---|---|---|
| Executive Sponsor | Thomas Brennan, VP Supply Chain | Funding approval, obstacle removal, board reporting |
| Project Lead | Priya Ramanathan, CDO | Technical delivery, vendor management, team leadership |
| Business Lead | Henrik Jansen, VP Warehouse Ops | Business requirements, user acceptance, adoption |
| Compliance Advisor | Dr. Elena Vasquez, CCO | Regulatory alignment, audit readiness |
| Technical Architect | TBD (Qlik PS) | Platform architecture, integration design |

## 8. Recommendation

We recommend **immediate approval** of Project Qlarity with a January 2026 start date. Every month of delay costs MCG approximately **$10.6M** in preventable losses. The NVWA follow-up inspection expected in Q1 2026 adds regulatory urgency -- demonstrating an in-progress unified traceability platform will significantly strengthen MCG's position.

---
*Meridian Commerce Group -- Office of the CDO -- CONFIDENTIAL -- Board Material*
