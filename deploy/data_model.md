# MCG Data Model Reference

All source schemas for the Meridian Commerce Group demo, covering all three data feeds (PostgreSQL, Kafka, Salesforce), the Open Lakehouse tiers, and Gold-layer data products.

---

## 1. Source: PostgreSQL (WMS Database)

Database: `mcg_wms` | Schema: `public`

### 1.1 `inventory_positions`

Real-time inventory snapshot per SKU/location. Updated by the simulator every cycle.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `position_id` | SERIAL | PK | Auto-increment |
| `location_id` | VARCHAR(20) | NOT NULL | DC identifier (e.g., `DC-RTD-01`) |
| `sku` | VARCHAR(30) | NOT NULL | **Nightmare #3**: Mix of global (`MCG-4420`), Americas legacy (`AM-BT-SPKR-001`), EU legacy (`EU-44200`) |
| `lot_number` | VARCHAR(30) | YES | **Nightmare #7**: NULL for ~15% of perishable grocery items |
| `quantity_on_hand` | INTEGER | NOT NULL | **Nightmare #1**: Can be phantom-inflated 30-80%; can go negative (bug) |
| `quantity_available` | INTEGER | YES | `on_hand - reserved` |
| `quantity_reserved` | INTEGER | DEFAULT 0 | Allocated to open orders |
| `quantity_in_transit` | INTEGER | DEFAULT 0 | Inbound, not yet received |
| `unit_of_measure` | VARCHAR(10) | YES | **Nightmare #3**: Inconsistent -- EA, CS, PAL, EACH, UNIT, PK |
| `storage_zone` | VARCHAR(15) | YES | **Nightmare #3**: Non-standard variants -- KALT, FROID, AMB, FRZ, ROOM_TEMP |
| `last_count_date` | TIMESTAMP | YES | **Nightmare #5**: No timezone (local time) |
| `snapshot_timestamp` | TIMESTAMP | YES | **Nightmare #5**: Local time, NOT UTC |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_inv_location_sku` on `(location_id, sku)`
- `idx_inv_snapshot` on `(snapshot_timestamp)`

### 1.2 `warehouse_events`

Event log of all inventory movements: receipts, picks, adjustments, cycle counts.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `event_id` | SERIAL | PK | Auto-increment |
| `warehouse_id` | VARCHAR(20) | NOT NULL | DC identifier |
| `event_type` | VARCHAR(30) | NOT NULL | **Nightmare #3**: RECEIVE vs RCV vs INBOUND_RECEIPT vs PICK vs ADJUST |
| `sku` | VARCHAR(30) | NOT NULL | Same legacy/global mix as inventory_positions |
| `quantity` | INTEGER | NOT NULL | Positive for receipts, negative for picks |
| `lot_number` | VARCHAR(30) | YES | Same 15% NULL rate on perishables |
| `location_bin` | VARCHAR(20) | YES | **Nightmare #3**: Format varies -- `A-04-02-C` vs `A/04/02/C` vs `A.04.02.C` |
| `order_id` | VARCHAR(30) | YES | NULL for ~20% of SHIP events |
| `worker_id` | VARCHAR(20) | YES | Warehouse worker identifier |
| `cycle_count_variance` | INTEGER | YES | Non-null only for CYCLE_COUNT events |
| `event_timestamp` | TIMESTAMP | YES | **Nightmare #5**: Local time, no timezone |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_wh_events_warehouse` on `(warehouse_id, event_timestamp)`

### 1.3 `shipments`

Outbound shipment tracking from 6 carriers, each with unique status vocabularies.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `shipment_id` | SERIAL | PK | Auto-increment |
| `tracking_number` | VARCHAR(40) | YES | NULL for some carriers (LOCAL-LOS never provides) |
| `carrier_code` | VARCHAR(20) | NOT NULL | FEDEX, DHL-EXPRESS, DPD, NINJAVAN, CORREIOS, LOCAL-LOS |
| `order_id` | VARCHAR(30) | YES | Links to warehouse_events and Salesforce MCG_Order__c |
| `shipment_status` | VARCHAR(60) | NOT NULL | **Nightmare #6**: Carrier-specific vocabularies (see carrier table below) |
| `status_datetime` | VARCHAR(50) | YES | **STRING**, not timestamp! Formats vary per carrier |
| `origin_facility` | VARCHAR(20) | YES | DC identifier |
| `destination_address` | TEXT | YES | **Nightmare #2**: Inconsistent address formats |
| `destination_city` | VARCHAR(50) | YES | |
| `destination_country` | VARCHAR(50) | YES | **Nightmare #2**: NL vs Netherlands vs Niederlande vs Nederland |
| `estimated_delivery` | VARCHAR(50) | YES | String, format varies |
| `actual_delivery` | VARCHAR(50) | YES | NULL even when status=DELIVERED (~15%) |
| `delivery_attempts` | INTEGER | YES | |
| `exception_code` | VARCHAR(40) | YES | **Nightmare #6**: Multi-language codes |
| `weight_value` | DECIMAL(8,2) | YES | |
| `weight_unit` | VARCHAR(5) | YES | **Nightmare #3**: kg vs lbs vs KG vs lb vs NULL |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_shipments_carrier` on `(carrier_code, shipment_status)`
- `idx_shipments_order` on `(order_id)`

### Carrier Status Vocabulary Reference

| Stage | FEDEX | DHL-EXPRESS | DPD (German) | NINJAVAN | CORREIOS (Portuguese) | LOCAL-LOS |
|-------|-------|-------------|-------------|----------|----------------------|-----------|
| Created | LABEL_CREATED | shipment_info | Paketankündigung | Pending Pickup | Objeto postado | registered |
| Pickup | PICKED_UP | pickup | Abgeholt | Picked Up | Coletado | collected |
| Transit | IN_TRANSIT | transit | In Zustellung | Arrived at Hub | Em trânsito | moving |
| Out for delivery | ON_VEHICLE | out_for_delivery | In Auslieferung | On Vehicle | Saiu para entrega | on the way |
| Delivered | DELIVERED | delivered | Zugestellt | Completed | Objeto entregue ao destinatário | delivered ok |
| Failed | DELIVERY_EXCEPTION | failure | Zustellversuch | Pending Reschedule | Não entregue | not delivered |

### Timestamp Format Reference

| Carrier | Format | Example |
|---------|--------|---------|
| FEDEX | ISO 8601 UTC | `2025-10-15T14:22:47Z` |
| DHL-EXPRESS | ISO 8601 UTC | `2025-10-15T14:22:47Z` |
| DPD | ISO 8601 + CET offset | `2025-10-15T15:22:47+01:00` |
| NINJAVAN | ISO 8601 + SGT offset | `2025-10-15T22:22:47+08:00` |
| CORREIOS | Brazilian DD/MM/YYYY | `15/10/2025 14:22` |
| LOCAL-LOS | Informal text | `Oct 15 2025` |

---

## 2. Source: Apache Kafka (IoT Telemetry)

Two Kafka topics on `mcg.iot.*` namespace.

### 2.1 Topic: `mcg.iot.cold-chain`

Cold-chain sensor readings from Tive/Sensitech devices.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `sensor_id` | string | NOT NULL | e.g., `TIVE-SN-00847291`, `SENS-LOS-00100042` |
| `shipment_id` | string | YES | **12% NULL** -- sensor reused without re-registration |
| `timestamp` | string | NOT NULL | **Nightmare #5**: Most have `.382Z` ms precision; older sensors omit timezone |
| `temperature_value` | float | NOT NULL | Value in `temperature_unit` scale |
| `temperature_unit` | string | NOT NULL | **~8% are "F"** from US sensors; rest are "C" |
| `humidity_pct` | float | YES | 0-100 range |
| `light_exposure` | boolean | YES | Package opened indicator |
| `shock_detected` | boolean | YES | Drop/impact indicator |
| `gps_latitude` | float | YES | Periodic NULLs (tunnel GPS blackout) |
| `gps_longitude` | float | YES | Periodic NULLs (tunnel GPS blackout) |
| `battery_level_pct` | integer | YES | Below 10%: intermittent readings |
| `alert_flag` | boolean | NOT NULL | True = temperature exceedance |
| `warehouse_id` | string | YES | Source DC |
| `route_id` | string | YES | e.g., `RTD-BA-001` |

**Known data quality issues:**
- 6-hour gap for Lagos sensors (`SENS-LOS-*`): 02:00-08:00 UTC silence
- GRU-BA route bursts with `alert_flag: true` (spoilage demo event)
- Occasional Kafka duplicates (at-least-once delivery)

### 2.2 Topic: `mcg.iot.carrier-events`

Carrier webhook pushes forwarded to Kafka.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `carrier_code` | string | NOT NULL | Same 6 carriers as shipments table |
| `tracking_number` | string | YES | |
| `event_type` | string | NOT NULL | **Nightmare #6**: Same multi-language vocabulary as shipments |
| `event_timestamp` | string | NOT NULL | Format varies by carrier (ISO, epoch ms, local strings) |
| `location_description` | string | YES | |
| `recipient_name` | string | YES | |
| `exception_code` | string | YES | Multi-language exception codes |
| `raw_carrier_payload` | string | YES | Some carriers include original JSON, others don't |

---

## 3. Source: Salesforce (CRM)

Standard + custom objects in a Salesforce Developer Edition org.

### 3.1 `Contact` (Standard Object)

Standard Salesforce Contact with address quality issues.

| Field | Type | Notes |
|-------|------|-------|
| `Id` | ID | Salesforce auto-ID |
| `FirstName` | Text | |
| `LastName` | Text | Suffixed with unique ID to prevent duplication |
| `Email` | Email | |
| `Phone` | Phone | |
| `MailingStreet` | TextArea | **Nightmare #2**: Multi-line, inconsistent formats |
| `MailingCity` | Text | **Nightmare #2**: Amsterdam vs AMSTERDAM vs A'dam |
| `MailingState` | Text | **Nightmare #2**: Noord-Holland vs NH vs North Holland |
| `MailingPostalCode` | Text | **Nightmare #2**: Space/no-space variants (1012 AB vs 1012AB) |
| `MailingCountry` | Text | **Nightmare #2**: NL vs Netherlands vs Niederlande |

### 3.2 `MCG_Order__c` (Custom Object)

Customer orders linked to Contact records.

| Field | Type | Notes |
|-------|------|-------|
| `Order_ID__c` | Text(30) | External ID, format: `WEB-YYYY-MM-NNNNN` |
| `Contact__c` | Lookup(Contact) | FK to Contact |
| `Order_Date__c` | DateTime | UTC |
| `SKU__c` | Text(30) | Global MCG SKU |
| `Product_Name__c` | Text(100) | |
| `Fulfillment_Method__c` | Picklist | SHIP_TO_HOME, BOPIS, CURBSIDE |
| `Promised_Delivery__c` | Date | ~30% unrealistically optimistic (next-day) |
| `Actual_Delivery__c` | Date | NULL for undelivered; 22% late (APAC SLA breaches) |
| `Carrier__c` | Text(20) | One of 6 carrier codes |
| `Tracking_Number__c` | Text(40) | **42% NULL** (carriers without tracking) |
| `Order_Status__c` | Picklist | PROCESSING, SHIPPED, IN_TRANSIT, DELIVERED, DELIVERY_FAILED |
| `WISMO_Flag__c` | Checkbox | **41%** of orders trigger customer inquiry |

### 3.3 `MCG_Product__c` (Custom Object)

Product master with intentional data quality issues.

| Field | Type | Notes |
|-------|------|-------|
| `SKU__c` | Text(40) | External ID, global MCG SKU |
| `Legacy_SKU_Americas__c` | Text(30) | NULL if product not sold in Americas |
| `Legacy_SKU_EU__c` | Text(30) | NULL if product not sold in EU |
| `Product_Name__c` | Text(100) | **Nightmare #3**: 15% use German names (`Kabellose Kopfhörer`) |
| `Category_L1__c` | Text(30) | Top-level: Electronics, Home, Grocery, Apparel, Health |
| `Category_L2__c` | Text(30) | Sub-category |
| `Category_L3__c` | Text(30) | Leaf category (sometimes NULL) |
| `Weight_KG__c` | Number(8,2) | **Nightmare #3**: NULL for 3 products, ZERO for 1 (invalid) |
| `Country_of_Origin__c` | Text(5) | **Nightmare #7**: NULL for some grocery items (compliance risk) |
| `Supplier_Name__c` | Text(80) | **Nightmare #3**: Inconsistent variants (Samsung Electronics Co. vs SAMSUNG vs Samsung Corp) |

---

## 4. Open Lakehouse Tiers (Qlik Talend Cloud)

### 4.1 Bronze Layer (Raw Ingestion)

Direct CDC/connector replicas -- no transformation.

| Table | Source | Refresh |
|-------|--------|---------|
| `bronze.inventory_positions` | PostgreSQL CDC | Real-time |
| `bronze.warehouse_events` | PostgreSQL CDC | Real-time |
| `bronze.shipments` | PostgreSQL CDC | Real-time |
| `bronze.sf_contacts` | Salesforce connector | 15 min |
| `bronze.sf_orders` | Salesforce connector | 15 min |
| `bronze.sf_products` | Salesforce connector | 15 min |
| `bronze.iot_cold_chain` | Kafka `mcg.iot.cold-chain` | Streaming |
| `bronze.iot_carrier_events` | Kafka `mcg.iot.carrier-events` | Streaming |

### 4.2 Silver Layer (Cleansed & Standardized)

Output of Talend transformation routes.

| Table | Transformation Route | Key Fixes |
|-------|---------------------|-----------|
| `silver.inventory_reconciled` | Inventory Reconciliation | Phantom flag, variance calc, ERP-WMS join |
| `silver.warehouse_events_clean` | Timestamp Normalization | All timestamps UTC, event_type standardized |
| `silver.shipments_canonical` | Carrier Status Canonicalization | Status mapped to 6 universal stages, country codes standardized |
| `silver.addresses_standardized` | Address Standardization | Parsed, geocoded, quality scored |
| `silver.products_harmonized` | Product Master Harmonization | SKU resolved, weights imputed, supplier deduped |
| `silver.iot_telemetry_normalized` | IoT Telemetry Normalization | Temp converted to Celsius, timestamps UTC, GPS gaps flagged |
| `silver.suppliers_deduped` | Supplier Master Dedup | Fuzzy-matched, canonical name assigned |
| `silver.order_delivery_timeline` | Order-to-Delivery Timeline | Full lifecycle with SLA calc |

### 4.3 Gold Layer (Business-Ready Data Products)

Aggregated, enriched, ready for analytics and API sharing.

| Table | Description | Refresh |
|-------|-------------|---------|
| `gold.supply_chain_health` | Inventory accuracy + pipeline health KPIs per DC/SKU | 15 min |
| `gold.last_mile_performance` | Carrier SLA metrics + address quality by region | 30 min |

---

## 5. Entity Relationships

```
PostgreSQL (WMS)                    Salesforce (CRM)
+----------------------+            +------------------+
| inventory_positions  |            | Contact          |
| - location_id (DC)   |            | - Id             |
| - sku (product)      |            | - MailingAddress  |
+----------+-----------+            +--------+---------+
           |                                 |
     (sku) |                      (Contact__c)
           |                                 |
+----------+-----------+            +--------+---------+
| warehouse_events     |            | MCG_Order__c     |
| - warehouse_id (DC)  +--order_id--+ - Order_ID__c    |
| - sku (product)      |            | - SKU__c         |
| - order_id           |            | - Carrier__c     |
+----------+-----------+            +--------+---------+
           |                                 |
     (order_id, carrier)              (SKU__c)
           |                                 |
+----------+-----------+            +--------+---------+
| shipments            |            | MCG_Product__c   |
| - order_id           |            | - SKU__c         |
| - carrier_code       |            | - Supplier_Name  |
| - tracking_number    |            +------------------+
+----------+-----------+
           |
   (tracking_number, carrier_code)
           |
Kafka (IoT Telemetry)
+------------------------+
| mcg.iot.carrier-events |
| - tracking_number      |
| - carrier_code         |
+------------------------+

+------------------------+
| mcg.iot.cold-chain     |
| - sensor_id            |
| - shipment_id -------> shipments.shipment_id (loose join)
| - warehouse_id ------> inventory_positions.location_id
+------------------------+
```

### Cross-Source Join Keys

| Join | Left | Right | Key(s) | Notes |
|------|------|-------|--------|-------|
| Orders to Shipments | MCG_Order__c | shipments | `Order_ID__c = order_id` | ~80% match rate (20% missing order_id) |
| Products to Inventory | MCG_Product__c | inventory_positions | `SKU__c ~ sku` | Requires SKU harmonization (3 formats) |
| Shipments to Carrier Events | shipments | iot.carrier-events | `tracking_number + carrier_code` | 58% have tracking; rest unlinked |
| IoT to Shipments | iot.cold-chain | shipments | `shipment_id` | 88% match (12% NULL shipment_id) |
| Contacts to Addresses | Contact.MailingAddress | shipments.destination_address | Fuzzy match | Requires address standardization |

---

## 6. Distribution Centers Reference

| DC ID | Region | Timezone (UTC offset) | Type |
|-------|--------|-----------------------|------|
| DC-RTD-01 | EU | +1 (CET) | Mega |
| DC-MUN-01 | EU | +1 (CET) | Regional |
| DC-LON-01 | EU | +0 (GMT) | Regional |
| DC-ATL-01 | AMER | -5 (EST) | Mega |
| DC-CHI-01 | AMER | -6 (CST) | Regional |
| DC-SIN-01 | APAC | +8 (SGT) | Mega |
| DC-TYO-01 | APAC | +9 (JST) | Regional |
| DC-GRU-01 | LATAM | -3 (BRT) | Regional |
| DC-LOS-01 | AFRICA | +1 (WAT) | Regional |

## 7. Product Catalog Reference

| SKU | Legacy Americas | Legacy EU | Name | Category | Weight (kg) | Perishable |
|-----|-----------------|-----------|------|----------|-------------|------------|
| MCG-4420 | AM-BT-SPKR-001 | EU-44200 | Bluetooth Speaker | Electronics | 0.45 | No |
| MCG-4421 | AM-HDPH-002 | EU-44210 | Wireless Headphones | Electronics | 0.32 | No |
| MCG-4430 | AM-CHRG-010 | EU-44300 | USB-C Charger | Electronics | **NULL** | No |
| MCG-4435 | -- | EU-44350 | Smart Watch Band | Electronics | 0.08 | No |
| MCG-HG-1001 | AM-CNDL-050 | -- | Scented Candle Set | Home | 1.20 | No |
| MCG-HG-1002 | AM-THRO-051 | EU-HG-1002 | Throw Blanket | Home | **NULL** | No |
| MCG-HG-1010 | -- | EU-HG-1010 | Kitchen Mixer Pro | Home | **NULL** | No |
| MCG-GRO-LET-001 | -- | EU-GRO-LET-001 | Organic Lettuce | Grocery | 0.35 | Yes |
| MCG-GRO-MLK-010 | AM-GRO-MLK-010 | -- | Whole Milk 1L | Grocery | 1.03 | Yes |
| MCG-GRO-CHZ-015 | -- | EU-GRO-CHZ-015 | Aged Gouda 500g | Grocery | 0.52 | Yes |
| MCG-GRO-OLV-220 | AM-GRO-OLV-220 | EU-GRO-OLV-220 | Olive Oil 500ml | Grocery | 0.52 | No |
| MCG-GRO-MIX-015 | -- | -- | Salad Mix 200g | Grocery | 0.22 | Yes |
| MCG-APP-JKT-881 | AM-APP-JKT-881 | EU-APP-JKT-881 | Winter Jacket L | Apparel | **0.0 (invalid)** | No |
| MCG-APP-TEE-200 | -- | EU-APP-TEE-200 | Basic T-Shirt M | Apparel | 0.18 | No |
| MCG-HW-VIT-300 | AM-HW-VIT-300 | EU-HW-VIT-300 | Multivitamin 60ct | Health | 0.15 | No |
| MCG-HW-YOG-050 | -- | EU-HW-YOG-050 | Greek Yogurt 500g | Health | 0.53 | Yes |
