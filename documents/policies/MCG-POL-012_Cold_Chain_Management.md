# MERIDIAN COMMERCE GROUP POLICY
## MCG-POL-012: Cold Chain Management Policy

| | |
|---|---|
| **Policy ID** | MCG-POL-012 |
| **Version** | 2.1 |
| **Effective Date** | 2025-03-01 |
| **Owner** | Ana Ferreira, Cold Chain Manager |
| **Approved By** | Thomas Brennan, VP Supply Chain |
| **Review Frequency** | Semi-annual |

---

## 1. Policy Statement

Meridian Commerce Group is committed to maintaining product integrity through unbroken cold chain management from supplier dock to customer delivery. Temperature-controlled products represent **28% of MCG revenue ($3.98B)** and require continuous monitoring to ensure food safety, product quality, and regulatory compliance.

## 2. Scope

This policy applies to all temperature-sensitive products handled by MCG, including:
- **Chilled products** (2-6°C): Fresh produce, dairy, deli items, fresh meat
- **Frozen products** (-22 to -18°C): Frozen foods, ice cream, frozen seafood
- **Ambient-controlled products** (15-25°C): Chocolate, wine, certain pharmaceuticals
- **Ultra-cold products** (-30°C or below): Specialty frozen items

## 3. Temperature Requirements

### 3.1 Storage Requirements by Category

| Category | Target Temp | Min | Max | Exceedance Tolerance | Action on Breach |
|---|---|---|---|---|---|
| Fresh produce | 4°C | 2°C | 6°C | 15 min > 8°C | Hold & inspect |
| Fresh meat/poultry | 2°C | 0°C | 4°C | 10 min > 5°C | Quarantine & test |
| Dairy products | 4°C | 2°C | 6°C | 15 min > 7°C | Hold & inspect |
| Frozen general | -20°C | -25°C | -18°C | 30 min > -15°C | Assess refreeze viability |
| Frozen seafood | -20°C | -25°C | -18°C | 20 min > -15°C | Quarantine & test |
| Ambient-controlled | 20°C | 15°C | 25°C | 60 min outside range | Visual inspection |

### 3.2 Transit Requirements

| Corridor | Mode | Pre-Cool Requirement | Monitoring | Max Transit Time |
|---|---|---|---|---|
| EU domestic (NL, DE, FR) | Refrigerated truck | 2°C before loading | Tive sensor + GPS | 12 hours |
| EU cross-border | Refrigerated truck | 2°C before loading | Tive sensor + GPS | 24 hours |
| Americas (US domestic) | Refrigerated truck | 2°C before loading | Carrier-provided | 18 hours |
| LATAM (GRU-BA corridor) | Refrigerated truck | **0°C before loading** | Tive sensor + GPS | 36 hours |
| APAC (SG-MY-TH) | Refrigerated truck | 2°C before loading | Tive sensor | 8 hours |
| Africa (LOS-ABJ) | Refrigerated truck | 0°C before loading | **Intermittent** | 48 hours |

**CRITICAL NOTE -- LATAM Corridor**: Effective October 15, 2025, all shipments on the Sao Paulo-Buenos Aires route MUST be pre-cooled to 0°C, not the standard 2°C. This was mandated after Q3 2025 spoilage losses on this route reached $180K/week due to TransFrio's refrigeration startup gap of 15 minutes. See INC-2025-05102 for details.

**CRITICAL NOTE -- Africa Corridor**: The Lagos-Abidjan corridor currently has only **45% sensor coverage** with daily 6-hour connectivity blackouts at the Lagos DC. Products on this route require manual temperature checks at origin and destination with paper logbook documentation. Resolution dependent on ISP infrastructure upgrade (target: Q1 2026).

## 4. Monitoring Infrastructure

### 4.1 Sensor Types and Deployment

| Sensor Type | Use Case | Data Frequency | Coverage |
|---|---|---|---|
| Tive Solo 5G | In-transit shipments (high value) | Every 5 minutes | EU: 95%, Americas: 90% |
| Tive Tag | In-transit shipments (standard) | Every 15 minutes | APAC: 85%, LATAM: 78% |
| DC fixed sensors | Distribution center cold rooms | Every 1 minute | All DCs: 100% |
| Store display sensors | Retail display cases | Every 5 minutes | EU: 92%, Americas: 88% |

### 4.2 Data Integration

Cold chain sensor data flows through multiple paths:

1. **Tive sensors** → Tive Cloud API → MCG IoT Gateway → **Kafka topic: mcg.iot.cold-chain**
2. **DC fixed sensors** → Building Management System → SCADA → Oracle WMS
3. **Store sensors** → Store POS system → Daily batch upload to SAP

**KNOWN ISSUE**: There is no unified view of cold chain data across all three paths. DC sensors report to WMS, transit sensors report to Kafka, and store sensors report to SAP. Correlating a temperature exceedance with a specific product lot requires manual cross-referencing across these three systems. Average investigation time: **4-6 hours per incident**.

**Future State**: Project Qlarity (Qlik platform) will normalize all IoT telemetry into a unified cold chain dashboard with automated exceedance-to-lot correlation. Target: Q2 2026.

### 4.3 Alerting Thresholds

| Alert Level | Condition | Notification | Response Time |
|---|---|---|---|
| WARNING | Temperature within 2°C of limit for > 10 min | Email to Cold Chain Manager | 30 minutes |
| CRITICAL | Temperature exceeds limit | SMS + email to Cold Chain Manager + DC Manager | 15 minutes |
| EMERGENCY | Temperature exceeds limit by > 5°C or for > 30 min | Phone call to Cold Chain Manager + VP Supply Chain | Immediate |

## 5. Spoilage Management

### 5.1 Current Performance

| Metric | Target | Q3 2025 Actual |
|---|---|---|
| Total spoilage loss | $10M/quarter | **$14.2M/quarter** |
| Spoilage rate (fresh produce) | < 3% | **5.2%** |
| Spoilage rate (dairy) | < 2% | 2.8% |
| Spoilage rate (frozen) | < 1% | 1.4% |
| Temperature exceedance incidents | < 50/month | **127/month** |

### 5.2 Top Spoilage Corridors (Q3 2025)

| Corridor | Quarterly Loss | Primary Cause | Remediation |
|---|---|---|---|
| Sao Paulo → Buenos Aires | **$2.34M** | TransFrio refrigeration startup gap + border delays at Uruguaiana | Pre-cool mandate + redundant sensors |
| Lagos → Abidjan | **$1.87M** | 6-hour monitoring blackouts + unreliable road refrigeration | ISP upgrade + manual logging |
| Rotterdam → Munich | $0.92M | Summer heat wave (Aug 2025) exceeded truck capacity | Route timing adjustment |
| Singapore → Jakarta | $0.68M | NinjaVan cold chain handoff delays | Contract amendment in negotiation |

## 6. Predictive Capabilities

### 6.1 Current Model

MCG operates a basic spoilage prediction model (deployed Q1 2025):
- **Algorithm**: Gradient Boosted Decision Tree
- **Features**: Product type, corridor, season, carrier, transit time, loading temperature
- **Performance**: Precision 82%, Recall 79%
- **Limitation**: Does not incorporate real-time IoT data (batch-trained weekly)

### 6.2 Future State (Qlik AutoML)

The Project Qlarity platform will enable:
- Real-time feature engineering from IoT telemetry
- Automated model retraining on new data
- Embedded predictions in Qlik Analytics dashboards
- Discovery Agent proactive alerts when spoilage risk exceeds threshold

## 7. Compliance Requirements

- **EU**: Regulation (EC) No 852/2004 (food hygiene), Regulation (EC) No 37/2005 (temperature monitoring)
- **US**: FDA Food Safety Modernization Act (FSMA) Section 111
- **Brazil**: ANVISA RDC 275/2002
- **Singapore**: SFA Food Safety Act
- All cold chain records must be retained for minimum **5 years** per MCG-POL-007

## 8. Related Documents

- SOP-SC-002: Cold Chain Monitoring Procedure
- SOP-WH-001: Goods Receiving Procedure (Section 4.3: Temperature Checks)
- MCG-POL-007: EU Food Safety and Traceability Compliance
- INC-2025-05102: TransFrio Sao Paulo Refrigeration Gap Incident

---
*Meridian Commerce Group -- APPROVED BY VP SUPPLY CHAIN -- Mandatory Compliance*
