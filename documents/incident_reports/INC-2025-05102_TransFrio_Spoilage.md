# INCIDENT REPORT
## INC-2025-05102: TransFrio Sao Paulo-Buenos Aires Refrigeration Gap Spoilage

| | |
|---|---|
| **Incident ID** | INC-2025-05102 |
| **Severity** | SEV-2 (Material financial impact) |
| **Status** | Corrective Actions In Progress |
| **Date Discovered** | August 28, 2025 |
| **Date Reported** | August 29, 2025 |
| **Reported By** | Carlos Mendez, Regional Logistics Director, LATAM |
| **Incident Commander** | Ana Ferreira, Cold Chain Manager |

---

## 1. Incident Summary

Starting in August 2025, MCG experienced a **340% increase in cold chain temperature exceedances** on the Sao Paulo (GRU) to Buenos Aires (BA) corridor. Investigation revealed that TransFrio Transportes Ltda., MCG's primary cold chain carrier for this route, had upgraded their fleet's refrigeration units. The new units have a **15-minute startup gap** after engine ignition during which the refrigeration system does not reach operating temperature. This gap, combined with increased border crossing wait times at Uruguaiana, resulted in product temperature exceedances and significant spoilage.

## 2. Timeline

| Date | Event |
|---|---|
| Aug 1, 2025 | TransFrio begins fleet upgrade (replacement of Carrier Transicold units with new Thermo King T-series) |
| Aug 5, 2025 | First Tive sensor alerts showing elevated temperatures at load-out from GRU DC (3.8°C vs target 2°C) |
| Aug 5-20, 2025 | Multiple temperature exceedance alerts -- attributed to "summer heat" by GRU DC staff |
| Aug 20, 2025 | Border crossing wait times at Uruguaiana increase from 1.2 to 3.5 hours (Argentine customs processing change) |
| Aug 22, 2025 | Buenos Aires DC rejects 3 shipments in one week for temperature exceedances (dairy: 8.2°C, fresh produce: 9.1°C) |
| Aug 28, 2025 | Carlos Mendez identifies pattern: all rejected shipments traveled on TransFrio's new-fleet trucks |
| Aug 29, 2025 | Incident reported. TransFrio confirms refrigeration startup gap on new units. |
| Sep 3, 2025 | Tive data analysis confirms: average load temperature at GRU departure was 3.2°C (vs 1.8°C historical), indicating trucks not fully pre-cooled |
| Sep 15, 2025 | Spoilage loss analysis completed: $180K/week exposure identified |
| Oct 8, 2025 | Issue escalated at Q3 Supply Chain Performance Review (MTG-SC-2025-Q3) |
| Oct 15, 2025 | Thomas Brennan (VP Supply Chain) mandates 0°C pre-cool requirement for TransFrio |

## 3. Root Cause Analysis

### Primary Cause: Refrigeration Startup Gap
TransFrio's new Thermo King T-series units require approximately **15 minutes** to reach operating temperature (2°C) after engine ignition. During loading at the GRU DC, the refrigeration is running and the truck interior is cold. However, once the truck departs and begins its journey, brief engine stops (traffic, tolls, fueling) can cause the unit to cycle off and on, creating repeated 15-minute warming periods.

### Contributing Cause: Border Crossing Delays
Argentine customs processing changes in August 2025 increased border crossing wait times at Uruguaiana from an average of 1.2 hours to 3.5 hours. During this extended wait:
- Drivers frequently turn off engines to conserve fuel
- Refrigeration units stop completely
- Upon crossing, the 15-minute startup gap means products are unrefrigerated for up to **3.75 hours** (3.5 hours wait + 15 minutes startup)

### Contributing Cause: Insufficient Pre-Cooling
TransFrio's loading protocol called for trucks to be pre-cooled to 2°C before loading. With the new units' startup behavior, 2°C pre-cool is insufficient to buffer against the warming events during transit. The corrective action mandates 0°C pre-cool, providing a 2°C thermal buffer.

### Contributing Cause: Delayed Detection
- The initial temperature exceedance alerts (Aug 5) were dismissed as "summer heat" because there was no automated correlation between sensor data and carrier fleet data
- MCG does not currently have a system that links carrier equipment changes to shipment performance
- Tive sensor data and carrier contract/fleet data are in separate systems with no cross-reference

## 4. Impact Assessment

### Financial Impact (Q3 2025)

| Category | Amount (USD) |
|---|---|
| Product spoilage -- fresh produce | $1,420,000 |
| Product spoilage -- dairy | $680,000 |
| Product spoilage -- frozen (partial thaw) | $240,000 |
| Emergency air freight (replacement stock) | $185,000 |
| Customer refunds (e-commerce orders) | $62,000 |
| Carrier claims filed (pending) | $890,000 |
| **Total Q3 impact** | **$2,477,000** |

### Ongoing Exposure
If uncorrected, estimated ongoing exposure: **$180K/week** ($9.36M annualized)

### Operational Impact
- 47 shipments rejected at Buenos Aires DC in Q3 2025 (vs 8 in Q2)
- Average product rejection rate on GRU-BA route: 18% (vs 3% historical)
- 12 store-level out-of-stock events for fresh produce in Buenos Aires metro area
- Customer NPS for Buenos Aires dropped 11 points in Q3

## 5. Corrective Actions

| # | Action | Owner | Due Date | Status |
|---|---|---|---|---|
| 1 | Issue formal pre-cool requirement to TransFrio: 0°C before loading | Carlos Mendez | Oct 15, 2025 | **Completed** |
| 2 | Deploy redundant Tive sensors on all GRU-BA shipments (2 sensors per truck) | Ana Ferreira | Oct 20, 2025 | **Completed** |
| 3 | Negotiate with TransFrio for auxiliary power unit (APU) installation to maintain refrigeration during engine-off periods | Carlos Mendez | Nov 30, 2025 | In Progress |
| 4 | Evaluate air freight for high-value perishables on GRU-BA route | Carlos Mendez | Nov 15, 2025 | In Progress |
| 5 | Implement automated IoT anomaly detection linking sensor data to carrier/route | Priya Ramanathan | Q2 2026 (Project CLARITY) | Planned |
| 6 | Contract penalty clause addition: temperature exceedance financial responsibility | Carlos Mendez | Dec 31, 2025 | Pending TransFrio negotiation |

## 6. TransFrio Response

TransFrio Transportes Ltda. provided the following response (email dated October 2, 2025):

> TransFrio acknowledges the refrigeration startup characteristics of the new Thermo King T-series units. We are in discussions with Thermo King about a firmware update that may reduce the startup time from 15 minutes to 5 minutes. Expected availability: Q1 2026.
>
> Regarding the 0°C pre-cool requirement: TransFrio estimates this will increase our energy costs by approximately 15% per trip on the GRU-BA route. We propose a surcharge of BRL 180 per shipment to cover additional cooling costs.
>
> TransFrio does not accept financial liability for the border crossing delays at Uruguaiana, as these are outside our control.

**MCG Response** (Thomas Brennan, VP Supply Chain, at Q3 review meeting): "Tell them if they don't pre-cool, we're switching to air freight and they lose the contract."

## 7. Monitoring Metrics

| Metric | Pre-Incident (Q2 avg) | Peak Incident (Aug) | Current (Oct) | Target |
|---|---|---|---|---|
| Temperature exceedances per week (GRU-BA) | 2.1 | **14.8** | 8.2 | < 3.0 |
| Product rejection rate (GRU-BA) | 3% | **18%** | 11% | < 5% |
| Average load temp at GRU departure | 1.8°C | 3.2°C | 1.1°C | < 1.0°C |
| Spoilage loss per week (GRU-BA) | $45K | **$180K** | $95K | < $50K |

## 8. Lessons Learned

1. **Carrier fleet changes must be communicated and risk-assessed**: TransFrio changed their entire fleet's refrigeration units without notifying MCG. Carrier contracts must require advance notification of equipment changes.
2. **IoT alerts need context**: Raw temperature alerts without carrier, route, and equipment context are easily dismissed. MCG needs automated anomaly detection that correlates multiple data sources.
3. **Border crossing risks are real**: External logistics delays (customs, regulation changes) can amplify equipment-related cold chain gaps. Route risk models must factor in border crossing variability.
4. **Pre-cool specifications must account for worst-case**: The previous 2°C pre-cool standard was sufficient for the old fleet but inadequate for the new one. Standards must be set based on equipment capabilities and route conditions, not just product requirements.

---
*Meridian Commerce Group -- Supply Chain Operations -- Confidential*
