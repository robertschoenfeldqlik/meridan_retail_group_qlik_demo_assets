# MERIDIAN COMMERCE GROUP POLICY
## MCG-POL-015: Enterprise Data Quality Standards

| | |
|---|---|
| **Policy ID** | MCG-POL-015 |
| **Version** | 1.0 |
| **Effective Date** | 2025-07-01 |
| **Owner** | Priya Ramanathan, Chief Data Officer |
| **Approved By** | Ingrid van der Berg, CEO |
| **Review Frequency** | Annual |

---

## 1. Policy Statement

Meridian Commerce Group recognizes that data quality directly impacts business outcomes, regulatory compliance, and customer experience. Following the Q3 2025 Board review that identified critical data quality failures across the supply chain, this policy establishes mandatory data quality standards for all MCG data assets.

## 2. Background

In Q3 2025, MCG experienced a series of data quality failures that collectively cost an estimated **$127M annually**:

| Issue | Annual Impact | Root Cause |
|---|---|---|
| Phantom inventory (inaccurate stock counts) | $48M | WMS-SAP sync failures; no data freshness monitoring |
| Spoilage from cold chain monitoring gaps | $57M | Fragmented IoT data; 6-hour blackouts; no unified view |
| WISMO customer service costs | $14.8M | 5 separate systems; no unified order tracking |
| Compliance penalties and recall costs | $4.2M | Missing lot numbers; incomplete traceability |
| Carrier SLA failures (address issues) | $3.1M | Non-standardized addresses; truncated fields |

These issues were identified in the Q3 2025 Supply Chain Performance Review (MTG-SC-2025-Q3) and reported to the Board Audit Committee.

## 3. Data Quality Dimensions

MCG adopts six standard data quality dimensions, aligned with Qlik's Trust Score for AI framework:

### 3.1 Completeness
- **Definition**: The percentage of required fields that contain non-null, non-empty values
- **Target**: > 98% for critical fields, > 95% for standard fields
- **Current State**: Lot number completeness: 85%. Country of origin: 88%. Tracking number: 58%.

### 3.2 Accuracy
- **Definition**: The degree to which data correctly represents the real-world entity it describes
- **Target**: > 99% for master data, > 97% for transactional data
- **Current State**: Inventory accuracy: 74%. Address accuracy (deliverable): 82%.

### 3.3 Timeliness
- **Definition**: The degree to which data represents the current state of the entity
- **Target**: Critical data refreshed within 15 minutes. Standard data within 1 hour.
- **Current State**: 23 pipeline failures per week across the organization. ~6 undetected silent failures at any given time. WMS-SAP sync delay up to 30 minutes (known). Batch pipelines can fail silently for 4+ days (INC-2025-04872).

### 3.4 Consistency
- **Definition**: The degree to which the same data is represented uniformly across systems
- **Target**: 100% consistency for shared identifiers (SKU, supplier ID, carrier code)
- **Current State**: Samsung appears as 4 different supplier names across systems. Product weights differ between SAP and WMS. Timestamps have no consistent timezone convention.

### 3.5 Uniqueness
- **Definition**: The degree to which each entity appears only once in the dataset
- **Target**: < 0.1% duplicate rate for master data
- **Current State**: Estimated 340 duplicate supplier records across Salesforce, SAP, and procurement system. Customer duplicate rate estimated at 8%.

### 3.6 Validity
- **Definition**: The degree to which data conforms to defined formats, ranges, and business rules
- **Target**: > 99% for validated fields
- **Current State**: 12% of carrier status codes are in non-English languages. 3% of weights use non-standard UoM. Temperature readings include mixed Fahrenheit/Celsius without unit indicators.

## 4. Data Classification

### 4.1 Critical Data Elements (CDEs)

The following data elements are classified as **Critical** and subject to the highest quality standards:

| CDE | Owner | Source System | Quality Target | Current Score |
|---|---|---|---|---|
| Inventory position (qty on hand) | VP Warehouse Ops | Oracle WMS / Manhattan WMS | 99% accuracy | **74%** |
| Product lot/batch number | Chief Compliance Officer | Supplier → WMS | 100% completeness | **85%** |
| Shipment tracking number | VP Supply Chain | Descartes TMS | 100% completeness | **58%** |
| Customer delivery address | VP E-Commerce | Salesforce Commerce Cloud | 95% deliverability | **82%** |
| Cold chain temperature reading | Cold Chain Manager | Tive / DC sensors | 99% availability | **72%** |
| Supplier identity | VP Procurement | SAP MM | 100% uniqueness | **91%** |
| Product master (weight, dims) | Category Management | SAP MDG | 99% consistency | **87%** |

### 4.2 Standard Data Elements

All other data elements that support business operations but are not classified as Critical. Subject to standard quality targets (>95% across all dimensions).

## 5. Data Quality Monitoring

### 5.1 Current State

MCG currently has **no automated, enterprise-wide data quality monitoring**. Quality checks are performed:
- Manually by analysts on an ad-hoc basis
- Via Excel-based reconciliation by store managers (estimated 45 min/day per store)
- Through quarterly manual audits by Internal Audit
- Reactively when data quality issues cause visible business failures

### 5.2 Future State (Project CLARITY)

The Qlik platform implementation will provide:

| Capability | Qlik Component | Target Date |
|---|---|---|
| Automated data profiling | Qlik Talend Cloud Data Quality | Q1 2026 |
| Real-time pipeline health monitoring | Qlik Talend Cloud Pipeline Designer | Q1 2026 |
| Trust Score for all data assets | Qlik Trust Score for AI | Q2 2026 |
| Data stewardship workflows | Qlik Talend Cloud Stewardship | Q2 2026 |
| Proactive anomaly detection | Qlik Discovery Agent | Q3 2026 |

### 5.3 Pipeline Health Requirements

Following the Rotterdam pipeline failure (INC-2025-04872), the following monitoring requirements are mandatory:

1. **Data freshness monitoring**: Every data pipeline must have a freshness check that triggers an alert if no data flows for a configured time window (default: 2x the expected interval)
2. **Row count monitoring**: Daily row counts must be compared to baseline. Variance > 20% triggers investigation.
3. **Schema drift detection**: Any change in source schema must trigger an alert before pipeline processing continues.
4. **Error vs. absence monitoring**: Pipelines must monitor for both errors AND the absence of expected data. Silent failures (no data, no error) are the highest-priority risk.

## 6. Data Quality Remediation

### 6.1 Issue Severity Classification

| Severity | Definition | Response SLA | Escalation |
|---|---|---|---|
| SEV-1 | Data quality issue affecting regulatory compliance or customer safety | 4 hours | CDO + CCO + VP Supply Chain |
| SEV-2 | Data quality issue causing material financial impact (> $10K/day) | 24 hours | CDO + affected VP |
| SEV-3 | Data quality issue affecting operational efficiency | 5 business days | Data owner |
| SEV-4 | Data quality issue identified in profiling, no immediate impact | Next sprint | Data steward |

### 6.2 Root Cause Categories

Based on MCG's analysis of data quality issues in 2025:

| Root Cause Category | % of Issues | Example |
|---|---|---|
| Integration/pipeline failures | 35% | WMS-SAP batch job silent failure |
| Source system data entry errors | 25% | Incorrect warehouse codes, truncated addresses |
| Missing validation rules | 20% | No timezone enforcement on timestamps |
| Schema mismatches between systems | 12% | Weight in kg vs lbs; different country code formats |
| Master data decay | 8% | Outdated supplier addresses, deactivated carrier codes |

## 7. Roles and Responsibilities

| Role | Responsibility |
|---|---|
| Chief Data Officer (Priya Ramanathan) | Policy owner. Overall data quality strategy and reporting. |
| Data Owners (VPs) | Accountable for quality of data in their domain. Define quality rules. |
| Data Stewards | Operationally responsible for monitoring and remediating quality issues. |
| IT/Platform Team | Implement and maintain data quality tooling and pipelines. |
| All Employees | Report data quality issues. Follow data entry standards. |

## 8. Compliance and Reporting

- **Monthly**: Data Quality Dashboard published to CDO and all VPs (currently manual Excel; target: Qlik Sense automated dashboard)
- **Quarterly**: Data Quality Report to Board Audit Committee
- **Annually**: Comprehensive data quality assessment and policy review
- **On-demand**: Data quality impact assessments for regulatory inquiries

## 9. Related Documents

- MTG-SC-2025-Q3: Q3 Supply Chain Performance Review (where data quality failures were formally documented)
- INC-2025-04872: Rotterdam Pipeline Failure Incident Report
- MCG-POL-007: EU Food Safety and Traceability Compliance
- SOP-WH-002: Cycle Count Procedure (inventory accuracy remediation)
- Project CLARITY Business Case (pending CIO approval)

---
*Meridian Commerce Group -- APPROVED BY CEO -- Mandatory Compliance*
