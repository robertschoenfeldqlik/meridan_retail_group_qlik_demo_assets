# Meridian Commerce Group -- Common Datasets Reference
## Retail Supply Chain & Last-Mile Delivery Data Feeds

---

## Dataset Categories at a Glance

| # | Dataset | Source System(s) | Volume | Velocity | Quality Risk |
|---|---|---|---|---|---|
| 1 | Inventory Positions | ERP, WMS | High | Real-time / Hourly | **Critical** -- phantom inventory |
| 2 | Purchase Orders & Receipts | ERP, Supplier Portals | Medium | Daily | Moderate |
| 3 | Sales Transactions (POS) | POS Systems | Very High | Real-time | Low-Moderate |
| 4 | E-Commerce Orders | Commerce Platform | High | Real-time | Moderate |
| 5 | Shipment & Carrier Tracking | TMS, Carrier APIs | Very High | Real-time / Polling | **Critical** -- format chaos |
| 6 | Product Master Data | PIM/MDM, ERP, Catalogs | Medium | Low (reference) | **Critical** -- duplication |
| 7 | Supplier Master & Performance | ERP, SRM | Low-Medium | Weekly/Monthly | **High** -- no standard |
| 8 | Customer & Address Data | CRM, Commerce, POS | High | Continuous | **High** -- formatting |
| 9 | Demand Forecasts | Planning Systems | Medium | Daily/Weekly | Moderate |
| 10 | Warehouse Operations | WMS | High | Real-time | Moderate |
| 11 | Cold-Chain / IoT Telemetry | IoT Sensors | Very High | Streaming | Moderate-High |
| 12 | Returns & Reverse Logistics | OMS, RMA Systems | Medium | Daily | Moderate |
| 13 | Financial / Cost Data | ERP (FI/CO) | Medium | Daily/Monthly | Low-Moderate |
| 14 | Carrier Rate & Contract Data | TMS, Contracts | Low | Monthly/Quarterly | Low |
| 15 | Traceability & Compliance | Multiple | Variable | Event-driven | **Critical** -- gaps |

---

## 1. Inventory Positions

**Why it matters:** This is the #1 pain point for MCG. Phantom inventory (system says it's there, shelf says it's not) drives out-of-stocks, lost sales, and eroded customer trust.

**Typical sources:** SAP MM/IM, Oracle WMS, Manhattan WMS

### Common Fields

| Field | Type | Example | Quality Issue |
|---|---|---|---|
| `location_id` | String | `DC-RTD-01`, `STR-MUN-042` | Inconsistent naming across regions |
| `sku` | String | `MCG-4420` | Multiple SKU schemes from acquisitions |
| `lot_number` | String | `LOT-2025-09-1483` | Missing for 15% of grocery items |
| `quantity_on_hand` | Integer | `287` | ERP/WMS mismatch (the core problem) |
| `quantity_available` | Integer | `250` | Doesn't account for pending allocations |
| `quantity_reserved` | Integer | `37` | Sync delays between systems |
| `quantity_in_transit` | Integer | `120` | Often stale by 24-48 hours |
| `unit_of_measure` | String | `EA`, `CS`, `PAL` | "Each" vs "Case" confusion |
| `last_count_date` | Datetime | `2025-10-14T08:30:00Z` | Timezone inconsistency |
| `storage_zone` | String | `AMBIENT`, `CHILLED`, `FROZEN` | Non-standard codes across WMS platforms |
| `reorder_point` | Integer | `100` | Static -- doesn't reflect seasonality |
| `snapshot_timestamp` | Datetime | `2025-10-15T06:00:00+01:00` | UTC vs local time mismatch |

### Typical Quality Issues for MCG Demo
- **ERP vs. WMS quantity gap:** Batch sync failures create drifting discrepancies
- **Unit of measure confusion:** SAP tracks in "eaches," one WMS tracks in cases
- **Stale snapshots:** Some locations only update overnight, others in real-time
- **Negative inventory:** System allows -12 units (logic error) propagating to dashboards

---

## 2. Purchase Orders & Receipts

**Why it matters:** PO data connects what MCG ordered to what actually arrived. Gaps here mean they can't track supplier reliability or predict incoming stock.

**Typical sources:** SAP MM, Supplier EDI feeds, Procurement portals

### Common Fields

| Field | Type | Example | Quality Issue |
|---|---|---|---|
| `po_number` | String | `PO-2025-RTD-00847` | Different formats per region |
| `po_line_number` | Integer | `10` | SAP uses increments of 10; others use 1 |
| `supplier_id` | String | `SUP-003291` | Same supplier, multiple IDs |
| `supplier_name` | String | `Samsung Electronics Co.` | "Samsung Elec.", "SAMSUNG", etc. |
| `sku` | String | `MCG-4420` | Cross-reference needed to legacy SKUs |
| `quantity_ordered` | Integer | `500` | |
| `quantity_received` | Integer | `487` | Short-ships not always recorded |
| `unit_cost` | Decimal | `24.99` | Currency field often missing |
| `currency` | String | `EUR` | Sometimes blank -- assumed local |
| `order_date` | Date | `2025-09-01` | |
| `expected_delivery_date` | Date | `2025-09-15` | Often not updated when supplier delays |
| `actual_receipt_date` | Datetime | `2025-09-18T14:22:00` | WMS receipt vs. ERP posting can differ by days |
| `receiving_location` | String | `DC-RTD-01` | |
| `quality_inspection_status` | String | `PASS`, `HOLD`, `FAIL` | Missing for 30% of receipts |
| `country_of_origin` | String | `VN` | Critical for compliance; missing for 12% |

### Typical Quality Issues for MCG Demo
- **Supplier name standardization:** 4+ variants per supplier
- **Missing country of origin:** Compliance risk for EU food safety
- **Receipt date mismatch:** ERP goods-receipt posting lags actual warehouse receipt by 1-3 days
- **Short-ship gaps:** Partial deliveries not consistently captured

---

## 3. Sales Transactions (POS)

**Why it matters:** Real-time sales data drives demand signals, inventory replenishment triggers, and revenue reporting. Two POS systems means two formats.

**Typical sources:** Oracle Retail Xstore (full-format stores), Shopify POS (Express stores)

### Common Fields

| Field | Type | Example | Quality Issue |
|---|---|---|---|
| `transaction_id` | String | `TXN-MUN042-20251015-0847` | Different ID formats per POS |
| `store_id` | String | `STR-MUN-042` | |
| `register_id` | String | `REG-03` | |
| `transaction_datetime` | Datetime | `2025-10-15T14:23:47+02:00` | Local time (Xstore) vs UTC (Shopify) |
| `sku` | String | `MCG-4420` | Must map to master SKU |
| `quantity` | Integer | `2` | Returns stored as negative (sometimes separate) |
| `unit_price` | Decimal | `49.99` | Pre-tax vs post-tax inconsistency |
| `discount_amount` | Decimal | `5.00` | Promo vs manual markdown not distinguished |
| `tax_amount` | Decimal | `4.75` | Tax rules vary by country |
| `payment_method` | String | `CREDIT`, `DEBIT`, `CASH` | Non-standard codes across POS |
| `loyalty_id` | String | `MRD-LOYAL-00482910` | Only captured 62% of the time |
| `associate_id` | String | `EMP-8842` | Missing in self-checkout transactions |
| `line_void_flag` | Boolean | `false` | Voids handled differently per POS |

### Typical Quality Issues for MCG Demo
- **Timestamp format differences:** Local time vs UTC between two POS systems
- **Return handling:** Xstore uses negative quantities; Shopify uses separate return transactions
- **Loyalty capture rate:** Only 62% -- limits customer analytics
- **Currency inconsistency:** Some stores transact in local currency but report in EUR

---

## 4. E-Commerce Orders

**Why it matters:** $3.8B online channel. Every order is a promise to deliver -- and a promise MCG is currently breaking 22% of the time in APAC.

**Typical source:** Salesforce Commerce Cloud

### Common Fields

| Field | Type | Example | Quality Issue |
|---|---|---|---|
| `order_id` | String | `WEB-2025-10-0094827` | |
| `order_datetime` | Datetime | `2025-10-15T09:14:00Z` | |
| `customer_id` | String | `CUST-00482910` | Cross-system ID matching needed |
| `shipping_address` | Object | See address fields below | **Primary quality nightmare** |
| `address_line_1` | String | `Keizersgracht 482` | Truncated in legacy systems |
| `address_line_2` | String | `Apt 4B` | "Apt"/"Apartment"/"#" variants |
| `city` | String | `Amsterdam` | Spelling variants for non-Latin cities |
| `state_province` | String | `Noord-Holland` | Not applicable in all countries |
| `postal_code` | String | `1017 EJ` | Format varies wildly by country |
| `country_code` | String | `NL` | Sometimes full country name instead |
| `phone` | String | `+31 20 555 0147` | No standard format |
| `order_items[]` | Array | (nested line items) | |
| `item.sku` | String | `MCG-4420` | |
| `item.quantity` | Integer | `1` | |
| `item.price` | Decimal | `49.99` | |
| `fulfillment_method` | String | `SHIP_TO_HOME`, `BOPIS`, `CURBSIDE` | 3 different fulfillment paths |
| `promised_delivery_date` | Date | `2025-10-18` | Often overly optimistic |
| `assigned_dc` | String | `DC-RTD-01` | Allocation logic sometimes picks wrong DC |
| `order_status` | String | `PROCESSING` | Status codes differ from carrier statuses |

### Typical Quality Issues for MCG Demo
- **Address formatting:** 11% inconsistent, 6% truncated, 3.2% duplicated
- **Carrier rejection rate:** 4.7% of addresses fail first-attempt delivery
- **Promised vs. actual:** Delivery promises made without real-time inventory/carrier data
- **BOPIS complications:** Order says "ready for pickup" but store inventory doesn't match

---

## 5. Shipment & Carrier Tracking

**Why it matters:** This is the "last mile" black hole. 42 carriers, no standard format, and real-time visibility for only 58% of packages.

**Typical sources:** Descartes TMS, Carrier APIs (FedEx, DHL, DPD, NinjaVan, etc.), SFTP CSVs

### Common Fields

| Field | Type | Example | Quality Issue |
|---|---|---|---|
| `tracking_number` | String | `1Z999AA10123456784` | Format varies per carrier |
| `carrier_code` | String | `FEDEX`, `DHL-EXPRESS` | No standard carrier code system |
| `carrier_name` | String | `FedEx Ground` | Service level embedded in name |
| `order_id` | String | `WEB-2025-10-0094827` | Not always passed by carrier |
| `shipment_status` | String | `IN_TRANSIT` | **Nightmare #6:** "delivered"/"DEL"/"DLVRD"/"Complete" |
| `status_datetime` | Datetime | `2025-10-16T11:42:00` | Timezone? Local? UTC? Carrier-dependent |
| `origin_facility` | String | `DC-RTD-01` | |
| `destination_address` | String | (full address) | Carrier may reformat/abbreviate |
| `estimated_delivery` | Datetime | `2025-10-18T14:00:00` | Updated inconsistently |
| `actual_delivery` | Datetime | `2025-10-18T15:23:00` | Sometimes missing for "delivered" status |
| `delivery_attempt_count` | Integer | `1` | Not all carriers provide this |
| `exception_code` | String | `ADDR_INVALID`, `NO_ACCESS` | Non-standard exception codes |
| `proof_of_delivery` | String | `SIGNATURE: J. Smith` | Available from ~40% of carriers |
| `weight_kg` | Decimal | `2.3` | Sometimes in lbs without unit indicator |
| `parcel_dimensions` | String | `30x20x15cm` | Free-text vs structured fields |

### Carrier Format Chaos (MCG's Reality)

| Carrier | Data Method | Status Format | Timezone | Update Frequency |
|---|---|---|---|---|
| FedEx | REST API | Standardized enum | UTC | Real-time webhook |
| DHL Express | REST API | Standardized enum | UTC | Real-time webhook |
| DPD (EU) | SOAP API | German abbreviations | CET | Polling every 30 min |
| NinjaVan (APAC) | REST API | Custom codes | SGT | Polling every 15 min |
| Correios (Brazil) | SFTP CSV | Portuguese text | BRT | Daily file, often late |
| Royal Mail (UK) | REST API | Standardized enum | GMT/BST | Polling every 60 min |
| Local courier (Lagos) | Email/CSV | Free text | WAT | Manual, 1-2x daily |

---

## 6. Product Master Data

**Why it matters:** Without a clean product master, nothing else works. You can't match inventory to orders, calculate shipping costs, or build accurate forecasts.

**Typical sources:** SAP Material Master, PIM systems, Acquisition legacy catalogs

### Common Fields

| Field | Type | Example | Quality Issue |
|---|---|---|---|
| `sku` | String | `MCG-4420` | 3 numbering schemes coexist |
| `legacy_sku_1` | String | `AM-BT-SPKR-001` | Americas legacy |
| `legacy_sku_2` | String | `EU-44200` | EU legacy |
| `gtin/ean` | String | `8710103944201` | Missing for 9% of products |
| `product_name` | String | `Meridian Bluetooth Speaker` | Different names per region |
| `product_description` | Text | (long text) | Inconsistent length/format |
| `brand` | String | `Meridian Home Audio` | |
| `category_l1` | String | `Electronics` | |
| `category_l2` | String | `Audio` | EU has L3-L5; Americas stops at L3 |
| `category_l3` | String | `Portable Speakers` | |
| `weight_kg` | Decimal | `0.45` | **Missing for 8,200 products** |
| `length_cm` | Decimal | `18.5` | Mixed metric/imperial |
| `width_cm` | Decimal | `12.0` | |
| `height_cm` | Decimal | `8.0` | |
| `country_of_origin` | String | `CN` | Missing for 12% of food SKUs |
| `supplier_id` | String | `SUP-003291` | Multiple IDs per supplier |
| `unit_cost` | Decimal | `24.99` | Cost currency not always specified |
| `retail_price` | Decimal | `49.99` | Regional pricing stored separately |
| `shelf_life_days` | Integer | `null` (non-perishable) | Missing for some perishables |
| `storage_temp_requirement` | String | `AMBIENT` | Non-standard codes |
| `hazmat_flag` | Boolean | `false` | |
| `active_flag` | Boolean | `true` | Deactivated products still in some catalogs |

---

## 7. Supplier Master & Performance

**Typical sources:** SAP Vendor Master, Supplier portals, Manual spreadsheets

### Common Fields

| Field | Type | Example | Quality Issue |
|---|---|---|---|
| `supplier_id` | String | `SUP-003291` | Duplicates across ERP instances |
| `supplier_name` | String | `Samsung Electronics Co.` | 4+ variants |
| `supplier_country` | String | `KR` | |
| `supplier_tier` | String | `TIER_1` | Sub-tier suppliers largely unknown |
| `lead_time_days` | Integer | `21` | Static -- doesn't reflect reality |
| `on_time_delivery_rate` | Decimal | `0.87` | Calculated differently per region |
| `quality_reject_rate` | Decimal | `0.02` | Not consistently tracked |
| `payment_terms` | String | `NET30` | |
| `contract_expiry` | Date | `2026-03-31` | Not always updated |
| `risk_score` | Integer | `null` | Not yet implemented |
| `certifications` | Array | `["ISO9001","GFSI"]` | Manual entry, often outdated |

---

## 8. Customer & Address Data

**Typical sources:** Salesforce CRM, Commerce Cloud, POS loyalty systems

### Common Fields

| Field | Type | Example | Quality Issue |
|---|---|---|---|
| `customer_id` | String | `CUST-00482910` | Different IDs per system |
| `email` | String | `j.devries@email.nl` | Duplicates with typo variants |
| `first_name` | String | `Jan` | Character encoding issues for non-Latin |
| `last_name` | String | `de Vries` | Prefix handling varies ("de", "van der") |
| `phone` | String | `+31205550147` | No standard format |
| `address_line_1` | String | `Keizersgracht 482` | Truncation in legacy fields |
| `address_line_2` | String | `Apartment 4B` | "Apt"/"Apartment"/"#4B" variants |
| `city` | String | `Amsterdam` | |
| `postal_code` | String | `1017 EJ` | Format varies by country |
| `country` | String | `NL` or `Netherlands` | Code vs. full name |
| `preferred_language` | String | `nl-NL` | Missing for 40% of records |
| `loyalty_tier` | String | `GOLD` | Only in loyalty system, not CRM |
| `lifetime_value` | Decimal | `4,820.50` | Comma vs period decimal separators |
| `consent_marketing` | Boolean | `true` | GDPR consent tracked inconsistently |

---

## 9. Demand Forecasts

**Typical sources:** Blue Yonder (Americas), Kinaxis (EU/APAC)

### Common Fields

| Field | Type | Example | Quality Issue |
|---|---|---|---|
| `forecast_id` | String | `FC-2025-W42-RTD` | |
| `sku` | String | `MCG-4420` | Must map across SKU schemes |
| `location_id` | String | `STR-MUN-042` | |
| `forecast_date` | Date | `2025-10-21` | |
| `forecast_horizon` | String | `7D`, `30D`, `90D` | Different granularity per system |
| `forecasted_quantity` | Integer | `84` | |
| `confidence_interval_low` | Integer | `62` | Not available from all systems |
| `confidence_interval_high` | Integer | `108` | |
| `model_version` | String | `BY-v3.2` | |
| `manual_override_flag` | Boolean | `false` | Overrides degrade accuracy |
| `override_reason` | String | `null` | When flagged, reason often missing |
| `actual_demand` | Integer | `91` | Populated after the fact |
| `forecast_error_pct` | Decimal | `0.077` | |

### Typical Quality Issues for MCG Demo
- **Two planning systems, two forecast methodologies** -- results don't reconcile
- **Manual overrides** without documented reasoning -- corrupts model learning
- **SKU mapping failures** between planning system and ERP

---

## 10. Warehouse Operations

**Typical sources:** Oracle WMS, Manhattan Associates WMS

### Common Fields

| Field | Type | Example | Quality Issue |
|---|---|---|---|
| `event_id` | String | `WH-EVT-20251015-00482` | |
| `warehouse_id` | String | `DC-RTD-01` | |
| `event_type` | String | `RECEIVE`, `PICK`, `PACK`, `SHIP` | Different event names per WMS |
| `sku` | String | `MCG-4420` | |
| `quantity` | Integer | `24` | |
| `lot_number` | String | `LOT-2025-09-1483` | |
| `location_bin` | String | `A-04-02-C` | Bin naming conventions differ |
| `event_timestamp` | Datetime | `2025-10-15T14:22:47` | Local time vs UTC |
| `worker_id` | String | `WRK-RTD-0142` | |
| `order_id` | String | `WEB-2025-10-0094827` | Not always linked to outbound order |
| `cycle_count_variance` | Integer | `-13` | Key metric for inventory accuracy |

---

## 11. Cold-Chain / IoT Telemetry

**Why it matters:** Directly tied to the $48M spoilage loss. Real-time sensor data that often arrives late or with gaps.

**Typical sources:** Tive trackers, Sensitech monitors, Warehouse sensors

### Common Fields

| Field | Type | Example | Quality Issue |
|---|---|---|---|
| `sensor_id` | String | `TIVE-SN-00847291` | |
| `shipment_id` | String | `SHP-RTD-BA-20251015` | Not always linked to carrier tracking |
| `timestamp` | Datetime | `2025-10-15T14:22:47.382Z` | Millisecond precision truncated downstream |
| `temperature_celsius` | Decimal | `4.2` | Some sensors report Fahrenheit |
| `humidity_pct` | Decimal | `68.5` | Not all sensors capture humidity |
| `light_exposure` | Boolean | `false` | |
| `shock_detected` | Boolean | `false` | |
| `gps_latitude` | Decimal | `-23.5505` | GPS gaps in tunnels/buildings |
| `gps_longitude` | Decimal | `-46.6333` | |
| `battery_level_pct` | Integer | `72` | Low battery = data gaps |
| `alert_flag` | Boolean | `false` | Threshold varies by product type |
| `temp_threshold_min` | Decimal | `2.0` | Must join with product master |
| `temp_threshold_max` | Decimal | `6.0` | |

### Typical Quality Issues for MCG Demo
- **6-hour data lag** from Lagos DC sensors (connectivity issues)
- **Temperature unit mismatch** (Celsius vs Fahrenheit)
- **GPS blackouts** during tunnel transit -- gaps in location data
- **Sensor-to-shipment linkage** breaks when devices are reused without re-registration

---

## 12. Returns & Reverse Logistics

**Typical sources:** OMS, RMA systems, Carrier return tracking

### Common Fields

| Field | Type | Example | Quality Issue |
|---|---|---|---|
| `return_id` | String | `RET-2025-10-00291` | |
| `original_order_id` | String | `WEB-2025-10-0094827` | Sometimes not linked |
| `sku` | String | `MCG-4420` | |
| `return_reason_code` | String | `DEFECTIVE` | Non-standard codes across channels |
| `return_reason_text` | String | `"Speaker won't pair"` | Free text -- hard to analyze |
| `return_method` | String | `CARRIER_PICKUP`, `IN_STORE`, `DROP_OFF` | |
| `return_status` | String | `RECEIVED`, `INSPECTED`, `REFUNDED` | |
| `condition_on_receipt` | String | `DAMAGED`, `LIKE_NEW`, `OPENED` | Subjective assessment |
| `refund_amount` | Decimal | `49.99` | |
| `restockable_flag` | Boolean | `true` | Not consistently evaluated |
| `disposition` | String | `RESTOCK`, `LIQUIDATE`, `SCRAP` | |

---

## 13. Financial / Cost Data

**Typical sources:** SAP FI/CO, Regional financial systems

### Common Fields

| Field | Type | Example | Quality Issue |
|---|---|---|---|
| `cost_center` | String | `CC-SCM-EU-01` | Different structures per region |
| `gl_account` | String | `5100-FREIGHT` | Chart of accounts not harmonized |
| `transaction_date` | Date | `2025-10-15` | Fiscal calendar differs by region |
| `amount` | Decimal | `12,483.50` | Comma vs period (locale issues) |
| `currency` | String | `EUR` | Conversion rates applied inconsistently |
| `vendor_id` | String | `SUP-003291` | Must match supplier master |
| `cost_type` | String | `FREIGHT`, `WAREHOUSING`, `SPOILAGE` | |
| `document_reference` | String | `INV-2025-00847` | |

---

## 14. Carrier Rate & Contract Data

**Typical sources:** TMS, Contract management systems, Spreadsheets

### Common Fields

| Field | Type | Example | Quality Issue |
|---|---|---|---|
| `carrier_code` | String | `FEDEX` | Must match tracking data |
| `service_level` | String | `GROUND`, `EXPRESS`, `SAME_DAY` | Naming varies per carrier |
| `origin_zone` | String | `EU-WEST` | Zone definitions differ |
| `destination_zone` | String | `EU-CENTRAL` | |
| `weight_bracket_min_kg` | Decimal | `0.0` | |
| `weight_bracket_max_kg` | Decimal | `5.0` | |
| `rate_per_parcel` | Decimal | `4.85` | |
| `fuel_surcharge_pct` | Decimal | `0.12` | Changes monthly, not always updated |
| `contract_effective_date` | Date | `2025-01-01` | |
| `contract_expiry_date` | Date | `2025-12-31` | |
| `sla_delivery_hours` | Integer | `48` | The standard MCG measures against |

---

## 15. Traceability & Compliance Data

**Why it matters:** EU food safety regulations. The 11-day recall response that should have been 24 hours.

**Typical sources:** Supplier portals, Certification databases, ERP, Manual records

### Common Fields

| Field | Type | Example | Quality Issue |
|---|---|---|---|
| `product_sku` | String | `MCG-GRO-LET-001` | |
| `batch_lot_id` | String | `FARM-NL-2025-09-B42` | Format varies by supplier |
| `farm_origin_id` | String | `FARM-NL-0042` | **Unknown for 12% of food SKUs** |
| `farm_country` | String | `NL` | |
| `harvest_date` | Date | `2025-09-28` | Sometimes missing |
| `processing_facility_id` | String | `PROC-NL-007` | |
| `processing_date` | Date | `2025-09-29` | |
| `certification_type` | String | `GLOBAL_GAP`, `ORGANIC` | |
| `certification_expiry` | Date | `2026-06-30` | Not always current |
| `dc_receipt_date` | Date | `2025-10-01` | |
| `dc_id` | String | `DC-RTD-01` | |
| `store_receipt_date` | Date | `2025-10-02` | |
| `store_id` | String | `STR-AMS-001` | |
| `shelf_date` | Date | `2025-10-02` | Often not recorded |
| `expiry_date` | Date | `2025-10-09` | |
| `recall_flag` | Boolean | `false` | |
| `sub_tier_supplier_id` | String | `null` | **Largely unknown -- the gap** |

---

## Dataset Priority Matrix for Demo Build

Which datasets to build first based on demo impact and story alignment:

### Tier 1 -- Must Have (Core Demo Narrative)

| Dataset | Demo Moment | Qlik Products Showcased |
|---|---|---|
| **Inventory Positions** | Phantom inventory discovery, ERP/WMS reconciliation | Talend CDC, Data Quality rules, Trust Score, Qlik Analytics dashboard |
| **Shipment & Carrier Tracking** | Carrier format chaos, SLA monitoring, last-mile visibility | Talend integration, standardization, Qlik Analytics, Discovery Agent alerts |
| **Product Master Data** | Duplicate SKUs, missing weights, supplier name variants | Data profiling, fuzzy matching, Data Catalog, stewardship workflows |
| **E-Commerce Orders** | WISMO problem, address quality, delivery promise accuracy | Data Quality (address), Qlik Analytics order tracking, Qlik Answers Q&A |

### Tier 2 -- High Value (Enriches the Story)

| Dataset | Demo Moment | Qlik Products Showcased |
|---|---|---|
| **Cold-Chain IoT Telemetry** | Spoilage risk, temperature exceedance alerts | Real-time streaming, AutoML spoilage model, Discovery Agent |
| **Supplier Master** | Name standardization ("Samsung" x4), supplier performance | Data Quality matching, Trust Score, Qlik Analytics supplier scorecard |
| **Demand Forecasts** | Forecast accuracy, manual override impact | AutoML, Trust Score for AI (Diversity), Qlik Analytics |
| **Customer & Address Data** | Address formatting nightmare, delivery success rate | Data Quality standardization, Qlik Answers |

### Tier 3 -- Nice to Have (Full Story)

| Dataset | Demo Moment | Qlik Products Showcased |
|---|---|---|
| **POS Transactions** | Real-time sales signal, POS format differences | Talend integration, Qlik Analytics |
| **Warehouse Operations** | Cycle count variance, event tracking | Qlik Replicate, Qlik Analytics |
| **Returns** | Return reason analysis, restocking efficiency | Qlik Analytics, Qlik Answers |
| **Traceability** | EU compliance, recall readiness | Data Lineage, Catalog, Qlik Analytics |
| **Financial/Cost** | Carrying cost accuracy, spoilage $ impact | Qlik Analytics, Qlik Predict |
| **Carrier Rates** | Cost optimization, contract compliance | Qlik Analytics |
| **Purchase Orders** | Supplier reliability, receipt accuracy | Talend, Qlik Analytics |

---

## Synthetic Data Generation Notes

When building sample datasets for the demo:

- **Volume targets:** 1,140 stores × ~5,000 SKUs = ~5.7M inventory position records. Scale down to ~50 stores, ~500 SKUs for demo (~25K records).
- **Intentionally inject quality issues:** This is the story. Build data that is *dirty on purpose* so the Qlik platform can clean it.
- **Time range:** 90 days of historical data is sufficient for most demo scenarios.
- **Geographic spread:** Include at least 4 regions (EU, Americas, APAC, LATAM) to show timezone/format/currency issues.
- **Carrier mix:** 5-6 carriers with different formats demonstrates the standardization challenge.
- **Include "before and after" states:** Raw (dirty) versions and cleaned versions of the same datasets to show transformation impact.

---

*Dataset reference for Meridian Commerce Group demo build*
*Version 1.0 -- February 2026*
