# TRAINING DOCUMENT
## TRN-2025-002: Cold Chain Monitoring Quick Reference for Drivers & Receiving Staff

| | |
|---|---|
| **Document ID** | TRN-2025-002 |
| **Version** | 1.0 |
| **Effective Date** | 2025-11-01 |
| **Author** | Ana Ferreira, Cold Chain Manager |
| **Audience** | Delivery Drivers, DC Receiving Staff, Store Receiving Staff |

---

## 1. Temperature Limits -- Know These by Heart

| Product Type | Keep Between | REJECT if Above | REJECT if Below |
|---|---|---|---|
| Fresh produce (lettuce, herbs, salads) | 2°C -- 6°C | 8°C | 0°C (freeze damage) |
| Fresh meat & poultry | 0°C -- 4°C | 5°C | -2°C |
| Dairy (milk, yogurt, cheese) | 2°C -- 6°C | 7°C | 0°C |
| Frozen products | -22°C -- -18°C | -15°C | N/A |
| Chilled ready meals | 2°C -- 5°C | 7°C | 0°C |

## 2. What To Do When You Receive a Cold Shipment

### Step 1: Check the Temperature Before Unloading

- Use the handheld IR thermometer (issued to every receiving dock)
- Take 3 readings: top of load, middle of load, bottom of load
- Record all 3 readings on the **Goods Receipt Form (GRF-001)**

### Step 2: Check the Tive Sensor Data (If Available)

- If the shipment has a Tive sensor attached (small white device on outer carton):
  - DO NOT remove the sensor
  - The sensor data is automatically uploaded to the MCG IoT platform
  - If the truck driver has a Tive printout, staple it to the GRF-001 form

**NOTE**: Not all shipments have Tive sensors. Coverage varies by route:
- EU routes: ~95% have sensors
- Americas routes: ~90%
- APAC routes: ~85%
- LATAM routes: ~78%
- Africa routes: ~45%

If no sensor is attached, your handheld readings are the ONLY temperature record.

### Step 3: Accept or Reject

| Reading | Action |
|---|---|
| All 3 readings within range | Accept. Record on GRF-001. Proceed to put-away. |
| 1 reading slightly out of range (within 2°C of limit) | Accept with **HOLD**. Record on GRF-001. Notify Quality team. Product goes to inspection area. |
| Any reading significantly out of range (> 2°C beyond limit) | **REJECT**. Record on GRF-001. Notify receiving supervisor. Take photos of thermometer readings. Do NOT unload. |
| Frozen product showing signs of thaw (wet cartons, soft packages) | **REJECT** regardless of temperature reading. |

## 3. Common Problems and What to Do

### Problem: Truck arrives with refrigeration unit off
**Action**: DO NOT accept. Record truck arrival time and reefer unit status on GRF-001. Call receiving supervisor. The driver may claim "it was just turned off" -- this is not acceptable. Without continuous refrigeration data, we cannot verify the cold chain was maintained.

### Problem: Mixed temperature zones in one truck
**Action**: Some carriers load chilled and frozen together. Check BOTH zones. If the frozen zone is above -15°C, reject the frozen items even if chilled items are acceptable.

### Problem: Shipment from LATAM has no sensor and no driver temperature log
**Action**: Accept ONLY if your handheld readings are within range. Add note on GRF-001: "No transit temperature data available." Escalate to Ana Ferreira's team for corridor risk assessment.

### Problem: Lagos DC -- sensors showing "offline" for hours
**Action**: This is a known issue. The Lagos DC has daily 6-hour connectivity blackouts that prevent sensor data upload. During blackouts, rely on manual readings every 2 hours using handheld thermometers. Log readings on the paper Cold Chain Logbook (kept at each cold room entrance). IT is working on an ISP upgrade (target Q1 2026).

### Problem: TransFrio truck on GRU-BA route arrives warm
**Action**: Since October 2025, TransFrio is required to pre-cool trucks to 0°C before loading. If the truck arrives above 4°C at Buenos Aires DC, this indicates a pre-cooling failure. REJECT and immediately notify Carlos Mendez (LATAM Logistics Director). This was a key corrective action from Q3 2025 spoilage review.

## 4. Recording Temperature Data

### Where to Record

| What | Where | Format |
|---|---|---|
| Handheld temperature readings | GRF-001 (Goods Receipt Form) | Paper form at dock → scanned to DMS |
| Tive sensor data | Automatic (Tive Cloud → MCG) | No manual action needed |
| Rejection with temperature reason | WMS exception screen | WMS > Receiving > Exception > "Temperature" |
| Cold room temperature log | DC Building Management System | Automatic (fixed sensors) |
| Manual cold room readings (Lagos, backup) | Paper Cold Chain Logbook | Logbook at cold room entrance |

### Temperature Units

**ALWAYS use Celsius (°C)**. MCG standard is Celsius globally. If a carrier provides temperature data in Fahrenheit (common with US-origin shipments), convert before recording:
- Quick conversion: (°F - 32) × 5/9 = °C
- Or use the conversion chart posted at every receiving dock

**KNOWN ISSUE**: Some Tive sensors deployed on Americas routes were initially configured to report in Fahrenheit without a unit indicator. These sensors have been reconfigured, but historical data from July-September 2025 may contain mixed F/C readings in the IoT database. If you see a reading like "38" on a chilled shipment and the product looks fine, it's probably 38°F (3.3°C), not 38°C. Report to Ana Ferreira's team for data correction.

## 5. Emergency Contacts

| Contact | Phone | When to Call |
|---|---|---|
| DC Receiving Supervisor | Posted at dock | Any rejection or hold decision |
| Ana Ferreira (Cold Chain Manager) | +31 6 555 0188 | Systemic issues, route-level problems |
| Carlos Mendez (LATAM Logistics) | +55 11 555 0234 | TransFrio issues, GRU-BA corridor |
| Li Wei Chen (APAC Logistics) | +65 555 0345 | NinjaVan cold chain handoff issues |
| Quality Team Hotline | +31 10 555 0150 | Food safety concerns, contamination suspicion |

## 6. Remember

- **When in doubt, reject.** It is always better to reject a shipment than to accept compromised product.
- **Temperature data is compliance data.** NVWA and other regulators can ask for our temperature records at any time. Incomplete records = compliance risk.
- **The cold chain is only as strong as its weakest link.** Your temperature check at receiving is often the last checkpoint before product reaches our customers.

---
*Meridian Commerce Group -- Cold Chain Operations -- Mandatory Training*
