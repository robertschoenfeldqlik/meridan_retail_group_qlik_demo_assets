# Meridian Commerce Group -- Three Data Feed Demo Plan
## PostgreSQL WMS + Kafka Streaming + MySQL CRM

---

## Feed Selection Summary

| # | Feed Type | Recommended Source | MCG Story Mapping | Qlik Talend Cloud Connector |
|---|---|---|---|---|
| 1 | **Relational Database** | PostgreSQL | Warehouse / Inventory data (simulates Oracle WMS) | Native CDC via Data Movement Gateway |
| 2 | **Streaming** | Apache Kafka | Cold-chain IoT telemetry (Tive / Sensitech sensors) | Native Kafka connector |
| 3 | **Second Relational Engine** | MySQL (Meridian CRM) | E-commerce orders + customer data | Gateway-bound CDC off the binary log |

---

## Feed 1: Relational Database -- PostgreSQL

### Why PostgreSQL

| Consideration | Detail |
|---|---|
| **Qlik support level** | Fully supported. PostgreSQL 12.x through 17.x (including Amazon RDS for PostgreSQL, Azure Flexible Server) |
| **CDC support** | Yes -- log-based CDC via Data Movement Gateway. Real-time change capture without triggers. |
| **Demo ease** | Free, easy to spin up locally (Docker), on Amazon RDS, or Azure. No licensing cost. |
| **MCG story fit** | Simulates the Oracle WMS / Manhattan WMS inventory and warehouse operations data |
| **Alternative option** | Microsoft SQL Server (2016-2022) if you prefer -- equally well-supported with CDC |

### MCG Story Role

PostgreSQL acts as **MCG's Warehouse Management System** -- the source of truth (or supposed truth) for inventory positions, warehouse events, and shipment records. This is the system that fell out of sync with SAP in Nightmare #1.

### Schema Design -- Three Tables

#### Table 1: `inventory_positions` (Nightmare #1: Phantom Inventory)

```sql
CREATE TABLE inventory_positions (
    position_id         SERIAL PRIMARY KEY,
    location_id         VARCHAR(20) NOT NULL,    -- 'DC-RTD-01', 'STR-MUN-042'
    sku                 VARCHAR(30) NOT NULL,     -- Multiple SKU schemes: 'MCG-4420', 'AM-BT-SPKR-001', 'EU-44200'
    lot_number          VARCHAR(30),              -- NULL for 15% of grocery items (Nightmare #7)
    quantity_on_hand    INTEGER NOT NULL,          -- WMS count (will differ from SAP/ERP count)
    quantity_available  INTEGER,
    quantity_reserved   INTEGER DEFAULT 0,
    quantity_in_transit INTEGER DEFAULT 0,
    unit_of_measure     VARCHAR(5),               -- 'EA', 'CS', 'PAL' -- inconsistent (Nightmare #3)
    storage_zone        VARCHAR(15),              -- 'AMBIENT', 'CHILLED', 'FROZEN', 'KALT', 'FROID'
    last_count_date     TIMESTAMP WITHOUT TIME ZONE,  -- No timezone! (Nightmare #5)
    snapshot_timestamp  TIMESTAMP WITHOUT TIME ZONE,  -- Local warehouse time, not UTC (Nightmare #5)
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
```

**Intentional quality issues to inject:**
- `quantity_on_hand` values that diverge from the "ERP" values (phantom inventory)
- `lot_number` = NULL for ~15% of grocery/fresh SKUs
- `unit_of_measure` inconsistency: some rows use 'CS' (case) where they should use 'EA' (each)
- `snapshot_timestamp` in local time WITHOUT timezone indicator (Nightmare #5)
- `storage_zone` with non-standard codes: 'KALT' (German for cold), 'FROID' (French)
- A few rows with negative `quantity_on_hand` (-12, -3) -- logic errors
- Rows that stop updating after a certain date for one DC (simulating Nightmare #4: silent pipeline failure)

#### Table 2: `warehouse_events` (Nightmare #4: Silent Pipeline Failures)

```sql
CREATE TABLE warehouse_events (
    event_id            SERIAL PRIMARY KEY,
    warehouse_id        VARCHAR(20) NOT NULL,
    event_type          VARCHAR(20) NOT NULL,     -- 'RECEIVE', 'PICK', 'PACK', 'SHIP', 'ADJUST', 'CYCLE_COUNT'
    sku                 VARCHAR(30) NOT NULL,
    quantity            INTEGER NOT NULL,
    lot_number          VARCHAR(30),
    location_bin        VARCHAR(20),              -- 'A-04-02-C' vs 'A/04/02/C' (format varies)
    order_id            VARCHAR(30),              -- NULL for non-order events
    worker_id           VARCHAR(20),
    cycle_count_variance INTEGER,                 -- Only populated for CYCLE_COUNT events
    event_timestamp     TIMESTAMP WITHOUT TIME ZONE,  -- Local time, no timezone (Nightmare #5)
    created_at          TIMESTAMP DEFAULT NOW()
);
```

**Intentional quality issues to inject:**
- Events after the "failure date" (Sept 24) that exist here but never appear in the ERP
- `location_bin` format varies: 'A-04-02-C' vs 'A/04/02/C' vs 'A.04.02.C'
- `event_type` terminology varies: 'RECEIVE' vs 'RCV' vs 'INBOUND' (simulating 2 WMS platforms)
- `order_id` = NULL for 20% of SHIP events (linkage broken)
- A batch of events where exactly 50% of expected records are present (partial load -- Nightmare #4)
- `event_timestamp` in local warehouse time with no offset

#### Table 3: `shipments` (Nightmare #6: Carrier Data Black Hole)

```sql
CREATE TABLE shipments (
    shipment_id         SERIAL PRIMARY KEY,
    tracking_number     VARCHAR(40),
    carrier_code        VARCHAR(20) NOT NULL,     -- 'FEDEX', 'DHL-EXPRESS', 'DPD', 'NINJAVAN', 'CORREIOS'
    order_id            VARCHAR(30),
    shipment_status     VARCHAR(50) NOT NULL,     -- THE CHAOS: 'DELIVERED', 'Zugestellt', 'Completed', 'DEL'
    status_datetime     VARCHAR(40),              -- Stored as STRING because formats vary! (Nightmare #5 + #6)
    origin_facility     VARCHAR(20),
    destination_address TEXT,
    destination_city    VARCHAR(50),
    destination_country VARCHAR(50),              -- 'NL' vs 'Netherlands' vs 'Niederlande'
    estimated_delivery  VARCHAR(40),              -- Also string -- formats vary
    actual_delivery     VARCHAR(40),              -- NULL even when status = 'DELIVERED' (some carriers)
    delivery_attempts   INTEGER,
    exception_code      VARCHAR(30),              -- 'ADDR_INVALID', 'ZS_FEHLER', 'CEP_INVALIDO'
    weight_value        DECIMAL(8,2),
    weight_unit         VARCHAR(5),               -- 'kg', 'lbs', NULL, 'KG', 'lb'
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
```

**Intentional quality issues to inject:**
- `shipment_status` with 6+ carrier-specific vocabularies for the same lifecycle event
- `status_datetime` as STRING with mixed formats: ISO 8601, 'DD/MM/YYYY HH:MM', 'Oct 18 2025', bare timestamps
- `destination_country` mix of ISO codes, full names, and localized names
- `actual_delivery` = NULL for 15% of records where `shipment_status` = delivered equivalent
- `weight_unit` inconsistency: 'kg', 'lbs', 'KG', 'lb', NULL
- `exception_code` in different languages: English, German, Portuguese
- Some tracking numbers NULL (carriers that don't provide tracking)

### Qlik Talend Cloud Connection Setup

```
Connection Type:  PostgreSQL (via Data Movement Gateway)
Host:             <your-postgres-host>
Port:             5432
Database:         mcg_wms
Schema:           public
Authentication:   Username / Password
CDC Method:       Log-based (WAL -- Write-Ahead Log)
```

**Prerequisites:**
- PostgreSQL with `wal_level = logical` (required for CDC)
- A publication created for the tables you want to capture
- Data Movement Gateway installed (for on-prem) or network access (for cloud-hosted PG)

**Demo flow:**
1. Connect to PostgreSQL via Qlik Talend Cloud
2. Set up CDC replication task for all 3 tables
3. Show real-time inventory changes flowing into the target (Snowflake / Lakehouse)
4. Insert a new record → watch it appear in the target within seconds
5. Show pipeline monitoring: healthy green status

---

## Feed 2: Streaming -- Apache Kafka

### Why Kafka

| Consideration | Detail |
|---|---|
| **Qlik support level** | Native Kafka connector in Talend Cloud. Also supported via Qlik Replicate as a target. |
| **Streaming fit** | Purpose-built for high-velocity, real-time event streams |
| **Demo ease** | Confluent Cloud offers a free tier. Or run locally via Docker (confluent/cp-kafka). |
| **MCG story fit** | Simulates the IoT cold-chain sensor telemetry -- the $48M spoilage problem |
| **Versions supported** | Kafka v0.10.0.x through current. Confluent Cloud fully supported. |

### MCG Story Role

Kafka acts as **MCG's IoT telemetry pipeline** -- cold-chain sensors (Tive, Sensitech) on refrigerated trucks and in DCs publish temperature, humidity, GPS, and shock readings to Kafka topics. This data feeds the spoilage risk model and Discovery Agent alerts.

### Topic Design -- Two Topics

#### Topic 1: `mcg.iot.cold-chain` (Nightmare #5: Timestamps + Nightmare #4: Silent Pipelines)

**Message schema (JSON):**

```json
{
  "sensor_id": "TIVE-SN-00847291",
  "shipment_id": "SHP-RTD-BA-20251015",
  "timestamp": "2025-10-15T14:22:47.382Z",
  "temperature_value": 4.2,
  "temperature_unit": "C",
  "humidity_pct": 68.5,
  "light_exposure": false,
  "shock_detected": false,
  "gps_latitude": -23.5505,
  "gps_longitude": -46.6333,
  "battery_level_pct": 72,
  "alert_flag": false,
  "warehouse_id": "DC-RTD-01",
  "route_id": "RTD-BA-001"
}
```

**Intentional quality issues to inject:**
- `temperature_unit`: most records = "C" (Celsius), but ~8% from older US sensors send "F" (Fahrenheit) without converting the value -- so `temperature_value: 39.5` with `temperature_unit: "F"` is valid, but `temperature_value: 39.5` with `temperature_unit: "C"` would indicate a dead shipment
- `timestamp`: most records have `.382Z` millisecond UTC precision, but some older sensors send `"2025-10-15T14:22:47"` (no timezone, no milliseconds)
- **6-hour data gap** for Lagos DC sensors (sensor_id starting with `SENS-LOS-*`): no messages between 02:00 and 08:00 UTC (simulating connectivity dropout -- Nightmare #4)
- `gps_latitude` / `gps_longitude`: periodic `null` values (GPS blackout in tunnels)
- `shipment_id`: 12% of records have `null` shipment_id (sensor reused without re-registration)
- `battery_level_pct`: sensors below 10% start sending intermittent readings (gaps in the stream)
- A burst of `alert_flag: true` records for the Sao Paulo-to-Buenos Aires route (temperature exceedance event for Discovery Agent demo)

#### Topic 2: `mcg.iot.carrier-events` (Nightmare #6: Carrier Data Black Hole)

**Message schema (JSON) -- mimics carrier webhook pushes:**

```json
{
  "carrier_code": "FEDEX",
  "tracking_number": "1Z999AA10123456784",
  "event_type": "DELIVERED",
  "event_timestamp": "2025-10-18T15:23:00Z",
  "location_description": "Front door",
  "recipient_name": "J. Smith",
  "exception_code": null,
  "raw_carrier_payload": "{...}"
}
```

**Intentional quality issues to inject:**
- Different carriers publish to the same topic but with different `event_type` vocabularies ("DELIVERED" vs "Zugestellt" vs "Completed")
- `event_timestamp` formats vary by carrier (ISO 8601, epoch milliseconds, local time strings)
- Some carriers include `raw_carrier_payload` (the original response), others don't
- NinjaVan events arrive with SGT timestamps; DPD with CET; Correios with BRT
- Occasional duplicate messages (Kafka at-least-once delivery)

### Producer Script (For Generating Demo Data)

A simple Python producer to simulate IoT sensor streams:

```python
# mcg_iot_producer.py
# Simulates cold-chain sensor readings publishing to Kafka
# Run this during the demo to generate live streaming data

from confluent_kafka import Producer
import json
import time
import random
from datetime import datetime, timezone

KAFKA_CONFIG = {
    'bootstrap.servers': '<your-kafka-broker>',
    'client.id': 'mcg-iot-simulator'
    # Add security config for Confluent Cloud:
    # 'security.protocol': 'SASL_SSL',
    # 'sasl.mechanisms': 'PLAIN',
    # 'sasl.username': '<API_KEY>',
    # 'sasl.password': '<API_SECRET>'
}

SENSORS = [
    {"sensor_id": "TIVE-SN-00847291", "warehouse_id": "DC-RTD-01", "route_id": "RTD-BA-001", "unit": "C"},
    {"sensor_id": "TIVE-SN-00847305", "warehouse_id": "DC-RTD-01", "route_id": "RTD-MUN-003", "unit": "C"},
    {"sensor_id": "SENS-LOS-00100042", "warehouse_id": "DC-LOS-01", "route_id": "LOS-ABJ-001", "unit": "C"},
    {"sensor_id": "SENS-ATL-00200010", "warehouse_id": "DC-ATL-01", "route_id": "ATL-MIA-002", "unit": "F"},  # US sensor in Fahrenheit!
    {"sensor_id": "TIVE-SN-00901122", "warehouse_id": "DC-SIN-01", "route_id": "SIN-JKT-001", "unit": "C"},
    {"sensor_id": "SENS-GRU-00300055", "warehouse_id": "DC-GRU-01", "route_id": "GRU-BA-001", "unit": "C"},
]

TOPIC = "mcg.iot.cold-chain"

def generate_reading(sensor):
    """Generate a single sensor reading with intentional quality issues"""
    now = datetime.now(timezone.utc)

    # Quality issue: Lagos sensors have connectivity gaps
    # (In a real demo, you'd skip publishing for SENS-LOS sensors during certain hours)

    # Temperature: normal range 2-6C for chilled goods
    if sensor["unit"] == "F":
        temp = round(random.uniform(35.0, 43.0), 1)  # Fahrenheit equivalent
    else:
        temp = round(random.uniform(2.0, 6.0), 1)

    # Occasionally inject a temperature exceedance (for Discovery Agent alert demo)
    if sensor["route_id"] == "GRU-BA-001" and random.random() < 0.15:
        temp = round(random.uniform(8.0, 14.0), 1)  # Exceedance!

    # Quality issue: some timestamps lack timezone/milliseconds
    if sensor["sensor_id"].startswith("SENS-"):
        ts = now.strftime("%Y-%m-%dT%H:%M:%S")  # No timezone, no millis
    else:
        ts = now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"

    # Quality issue: GPS blackouts
    gps_lat = round(random.uniform(-34.0, 52.0), 4) if random.random() > 0.05 else None
    gps_lon = round(random.uniform(-58.0, 104.0), 4) if gps_lat else None

    # Quality issue: shipment_id sometimes null (sensor reused without re-registration)
    shipment_id = f"SHP-{sensor['route_id']}-{now.strftime('%Y%m%d')}" if random.random() > 0.12 else None

    return {
        "sensor_id": sensor["sensor_id"],
        "shipment_id": shipment_id,
        "timestamp": ts,
        "temperature_value": temp,
        "temperature_unit": sensor["unit"],
        "humidity_pct": round(random.uniform(40.0, 85.0), 1),
        "light_exposure": random.random() < 0.02,
        "shock_detected": random.random() < 0.01,
        "gps_latitude": gps_lat,
        "gps_longitude": gps_lon,
        "battery_level_pct": random.randint(15, 100),
        "alert_flag": temp > 6.0 if sensor["unit"] == "C" else temp > 43.0,
        "warehouse_id": sensor["warehouse_id"],
        "route_id": sensor["route_id"]
    }

def delivery_callback(err, msg):
    if err:
        print(f"ERROR: {err}")

def main():
    producer = Producer(KAFKA_CONFIG)
    print(f"Starting MCG IoT simulator -- publishing to {TOPIC}")
    print("Press Ctrl+C to stop\n")

    count = 0
    try:
        while True:
            for sensor in SENSORS:
                reading = generate_reading(sensor)
                producer.produce(
                    TOPIC,
                    key=sensor["sensor_id"],
                    value=json.dumps(reading),
                    callback=delivery_callback
                )
                count += 1

            producer.flush()
            print(f"  Published {count} readings...", end='\r')
            time.sleep(5)  # One reading per sensor every 5 seconds
    except KeyboardInterrupt:
        print(f"\nStopped. Total readings published: {count}")
    finally:
        producer.flush()

if __name__ == "__main__":
    main()
```

### Qlik Talend Cloud Connection Setup

```
Connection Type:  Apache Kafka
Bootstrap Servers: <your-kafka-broker>:9092
Topic:            mcg.iot.cold-chain
Message Format:   JSON
Security:         SASL_SSL (for Confluent Cloud) or PLAINTEXT (local)
Engine:           Data Gateway - Streaming (recommended)
```

**Demo flow:**
1. Start the Kafka producer script (generates live sensor readings)
2. Connect to Kafka topic in Qlik Talend Cloud
3. Show streaming data arriving in real-time
4. Apply transformation: normalize temperature_unit to Celsius, standardize timestamps to UTC
5. Land data in target (Snowflake / Lakehouse)
6. Show the temperature exceedance event flowing through to a Qlik Analytics dashboard
7. Discovery Agent alerts on the Sao Paulo-Buenos Aires route anomaly

### Quick Start Options

| Option | Setup Time | Cost | Best For |
|---|---|---|---|
| **Confluent Cloud** (Free tier) | ~15 min | Free (limited) | Fastest demo setup, no infra management |
| **Amazon MSK Serverless** | ~20 min | Pay-per-use | AWS-aligned demo environments |
| **Docker (cp-kafka)** | ~10 min | Free | Local demos, fully offline capable |
| **Redpanda** (Kafka-compatible) | ~10 min | Free | Lightweight local alternative |

---

## Feed 3: Second Relational Engine -- MySQL (Meridian CRM)

### Why MySQL

| Consideration | Detail |
|---|---|
| **Qlik support level** | Gateway-bound replication **source** (`repsrc_mysql`) -- log-based CDC off the binary log, the same class of capture as PostgreSQL |
| **Demo ease** | A container in this repo. No external account, no OAuth app, no security token, nothing to expire mid-demo |
| **MCG story fit** | Meridian CRM holds customer profiles, e-commerce orders and the product master -- the address nightmare and WISMO both start here |
| **CDC support** | Yes -- `binlog_format=ROW`, `binlog_row_image=FULL`, watermark on `last_modified_date` |
| **Deployability** | The connection is API-creatable, so `npm run deploy` builds it unattended |

### Why a Second Database Rather Than a SaaS Source

The CRM used to be a hosted SaaS CRM org. It made a worse demo for
four concrete reasons, all of which the move fixes:

| Problem with the SaaS source | With MySQL |
|---|---|
| Needed an external org, an External Client App and an interactive OAuth login, so the connection could not be created headlessly -- it was the one step `npm run deploy` always skipped | Gateway-bound source; the deploy creates it |
| Credentials lived in `.env` and expired | No credentials leave the stack |
| The feed was **insert-only**, so its change stream was indistinguishable from an append -- a CDC demo with no change data | Orders advance through their lifecycle, addresses are corrected in place, old orders are purged. The binary log carries `Update_rows` and `Delete_rows` events |
| API quotas and rate limits shaped the demo | A local database, no quota |

It also makes a sharper technical point on camera: **two CDC sources on two
different engines** -- PostgreSQL's write-ahead log and MySQL's binary log --
landing through one gateway into one lakehouse. That is a more interesting
architecture slide than "and here is a SaaS connector".

### MCG Story Role

Meridian CRM is **MCG's customer and e-commerce order system** -- the source of
customer profiles, delivery addresses, and online orders. This is ground zero
for Nightmare #2 (Address Catastrophe) and the WISMO problem.

### Schema Design -- Three Tables

#### Table 1: `crm_contacts` (Nightmare #2: Address Catastrophe)

One row per customer contact. The same real person appears several times with
inconsistent spellings of the same address:

| Column | MCG Mapping | Quality Issue to Inject |
|---|---|---|
| `mailing_street` | `address_line_1` | Truncated for 6% of records (force long addresses) |
| `mailing_city` | `city` | Spelling variants: 'São Paulo' vs 'Sao Paulo' |
| `mailing_state` | `state_province` | Sometimes full name, sometimes abbreviation |
| `mailing_postal_code` | `postal_code` | Format varies: '1017 EJ' vs '1017EJ', '01304-001' vs '01304001' |
| `mailing_country` | `country` | 'NL' vs 'Netherlands' vs 'Niederlande' |
| `phone` | `phone` | No standard format: '+31205550147' vs '+31 20 555 0147' |
| `email` | `email` | Duplicate contacts with typo email variants |
| `last_name` | `customer_name` | Prefix handling: 'de Vries' vs 'De Vries' vs 'DeVries' |

**Sample records to load (demonstrating Nightmare #2):**

```
Contact 1 (clean):
  Name: Jan de Vries
  MailingStreet: Keizersgracht 482, Apartment 4B
  MailingCity: Amsterdam
  MailingPostalCode: 1017 EJ
  MailingCountry: NL
  Phone: +31 20 555 0147

Contact 2 (same person, duplicate with variations):
  Name: Jan De Vries
  MailingStreet: Keizersgracht 482, Apt 4B
  MailingCity: Amsterdam
  MailingPostalCode: 1017EJ
  MailingCountry: Netherlands
  Phone: +31205550147

Contact 3 (truncated address):
  Name: Klaus Müller
  MailingStreet: Friedrichstraße 123, Hinterh   <-- truncated at 30 chars
  MailingCity: Berlin
  MailingPostalCode: 10117
  MailingCountry: DE

Contact 4 (Brazilian format):
  Name: Maria Silva
  MailingStreet: Av. Presidente Juscelino Kub   <-- truncated
  MailingCity: Sao Paulo                         <-- accent stripped
  MailingPostalCode: 01304001                    <-- no hyphen
  MailingCountry: BR

Contact 5 (Singapore format):
  Name: Wei Lin Tan
  MailingStreet: 15 Orchard Rd, #08-01
  MailingCity: Singapore
  MailingPostalCode: 238862
  MailingCountry: Singapore                      <-- full name instead of code
```

#### Table 2: `crm_orders` (E-Commerce Orders)

| Column | Type | MCG Mapping | Quality Issue |
|---|---|---|---|
| `order_id` | Text | `order_id` | Unique per order |
| `order_date` | DATETIME | `order_datetime` | UTC (clean) |
| `contact_id` | FK | Link to Contact | Cross-system ID matching needed |
| `mailing_street` | TEXT | `address_line_1 + 2` | Inherits Contact address issues |
| `mailing_city` | Text | `city` | |
| `mailing_postal_code` | Text | `postal_code` | |
| `mailing_country` | Text | `country_code` | Code vs name inconsistency |
| `fulfillment_method` | VARCHAR | `SHIP_TO_HOME`, `BOPIS`, `CURBSIDE` | |
| `promised_delivery` | Date | `promised_delivery_date` | Often overly optimistic |
| `actual_delivery` | Date | `actual_delivery_date` | NULL for 22% of APAC orders (SLA breach) |
| `carrier` | Text | `carrier_code` | Non-standard carrier codes |
| `tracking_number` | Text | `tracking_number` | NULL for 42% (no tracking from some carriers) |
| `order_status` | VARCHAR | `order_status` | Status codes don't match carrier statuses |
| `wismo_flag` | BOOLEAN | Has customer called about this order? | 41% of online orders |

#### Object 3: Custom `crm_products` (Nightmare #3: Product Master Mess)

| Column | Type | MCG Mapping | Quality Issue |
|---|---|---|---|
| `sku` | Text | `sku` | Three numbering schemes coexist |
| `legacy_sku_americas` | Text | `legacy_sku_1` | 'AM-BT-SPKR-001' |
| `legacy_sku_eu` | Text | `legacy_sku_2` | 'EU-44200' |
| `product_name` | Text | `product_name` | Different names per region |
| `category_l1` | Text | `category_l1` | |
| `category_l2` | Text | `category_l2` | |
| `category_l3` | Text | `category_l3` | NULL for Americas (only 3 levels) |
| `weight_kg` | DECIMAL(8,2) | `weight_kg` | NULL for 8,200 products |
| `country_of_origin` | Text | `country_of_origin` | Missing for 12% of food SKUs |
| `supplier_name` | Text | `supplier_name` | 'Samsung Elec.' / 'SAMSUNG' / etc. |

### Qlik Talend Cloud Connection Setup

```
Connection Type:  MySQL (replication source, repsrc_mysql)
Data gateway:     MCG_DATA_MOVEMENT
Host:             mysql            (compose service name, as seen FROM the gateway)
Port:             3306 inside the network / 3307 on the host
Database:         mcg_crm
Credentials:      qlik_cdc / MYSQL_PASSWORD from infrastructure/.env
Tables:           crm_contacts, crm_orders, crm_products
Replication Mode: Full + Incremental (watermark: last_modified_date)
```

`npm run deploy` creates this connection itself once `dataGateway.id` is set.
The name must be exactly `MCG CRM Database` or the pipeline binding will not
resolve.

**Prerequisites:**
- `npm run docker:up:simulators` -- starts MySQL, seeds it, and starts the CRM simulator
- A registered Data Movement gateway that can reach the database
- Nothing else. There is no account to create and no token to rotate

**Demo flow:**
1. Connect to Meridian CRM in Qlik Talend Cloud
2. Browse the `mcg_crm` schema -- show `crm_contacts`, `crm_orders`, `crm_products`
3. Set up the landing task (full initial load + incremental). No rename rule is
   needed: the source tables are already named `crm_*`
4. Run the initial data landing
5. Show Data Quality profiling: address formatting issues, duplicate contacts,
   missing product weights -- and note that a missing weight and a zero weight
   are different defects, both present
6. Apply standardization rules and fuzzy matching
7. Show Trust Score before (low) and after (high) cleansing
8. **Show the change stream.** Re-run
   `SELECT order_status, COUNT(*) FROM crm_orders GROUP BY order_status;`
   a minute apart and watch orders move. The simulator is not only inserting --
   it is updating and deleting, so incremental capture has something to capture

---

## Three-Feed Demo Flow -- Combined Walkthrough

### Setup Phase (Before Demo)

| Step | Action | Time |
|---|---|---|
| 1 | Provision PostgreSQL (Docker or RDS) and load 3 tables with dirty data | 30 min |
| 2 | Set up Kafka (Confluent Cloud free tier or Docker) and create 2 topics | 15 min |
| 3 | `npm run docker:up:simulators` -- MySQL comes up seeded and mutating | 3 min |
| 4 | Configure all 3 connections in Qlik Talend Cloud | 20 min |
| 5 | Test connectivity and run initial loads | 15 min |
| **Total setup** | | **~2 hours** |

### Live Demo Script (25 Minutes)

| Time | Demo Step | Feed | Qlik Product | What You Show |
|---|---|---|---|---|
| 0:00 | **The problem** -- Show MCG's system landscape and nightmare overview | -- | Slides | Set the stage |
| 3:00 | **Connect PostgreSQL** -- Show CDC pipeline from WMS database | Relational | Qlik Talend Cloud | Real-time inventory changes flowing. Insert a row in PG → appears in target within seconds. |
| 6:00 | **Profile PostgreSQL data** -- Run data profiling on inventory_positions | Relational | Data Quality | Discover: negative quantities, NULL lot numbers, UoM inconsistencies, timestamp format issues |
| 9:00 | **Connect Meridian CRM** -- Show the MySQL source, browse tables | MySQL CDC | Qlik Talend Cloud | Land Contact and Order data. Show the address formatting chaos discovered by profiling. |
| 12:00 | **Clean the data** -- Apply standardization and matching rules | SaaS + Relational | Data Quality | Address normalization, supplier dedup ("Samsung" x4 → 1), Trust Score before/after |
| 15:00 | **Connect Kafka** -- Show streaming IoT telemetry | Streaming | Qlik Talend Cloud | Live sensor readings flowing in real-time. Show temperature unit mismatch, timestamp normalization. |
| 18:00 | **Analyze in Qlik Analytics** -- Open the Supply Chain Command Center | All 3 | Qlik Analytics | Inventory health (from PG), delivery SLAs (from SF), cold-chain monitor (from Kafka) -- all in one dashboard |
| 21:00 | **AI Layer** -- Ask Qlik Answers a question about the data | All 3 | Qlik Answers | "Which shipments from the Sao Paulo DC are at risk of spoilage?" -- blends Kafka temp data with SF order data |
| 23:00 | **Proactive alert** -- Show Discovery Agent notification | All 3 | Discovery Agent | "Temperature exceedance on GRU-BA route. 12 shipments affected. Estimated $180K exposure." |
| 25:00 | **Wrap up** -- Show Trust Score improvement and transformation outcomes | All 3 | Trust Score | Before/after Trust Scores across all three feeds |

---

## Architecture Diagram -- Three Feeds into Qlik

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         SOURCE SYSTEMS                                    │
│                                                                          │
│  ┌──────────────┐   ┌──────────────────┐   ┌─────────────────────────┐  │
│  │ PostgreSQL   │   │ Apache Kafka     │   │ MySQL                   │  │
│  │ (WMS DB)     │   │ (IoT Telemetry)  │   │ (Meridian CRM)          │  │
│  │              │   │                  │   │                         │  │
│  │ • inventory  │   │ • cold-chain     │   │ • crm_contacts          │  │
│  │ • wh_events  │   │   topic          │   │ • crm_orders            │  │
│  │ • shipments  │   │ • carrier-events │   │ • crm_products          │  │
│  │              │   │   topic          │   │                         │  │
│  │ CDC (WAL)    │   │ Streaming        │   │ CDC (binlog)            │  │
│  └──────┬───────┘   └────────┬─────────┘   └───────────┬─────────────┘  │
│         │                    │                          │                │
└─────────┼────────────────────┼──────────────────────────┼────────────────┘
          │                    │                          │
          ▼                    ▼                          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    QLIK TALEND CLOUD                                      │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ DATA INTEGRATION LAYER                                              │  │
│  │  • PostgreSQL CDC connector (Data Movement Gateway)                 │  │
│  │  • Kafka streaming connector (Data Gateway - Streaming)                   │  │
│  │  • MySQL CDC connector (Data Movement Gateway)                      │  │
│  │  • Pipeline orchestration + monitoring + alerting                   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ DATA QUALITY & GOVERNANCE LAYER                                     │  │
│  │  • Automated profiling (discover issues across all 3 feeds)         │  │
│  │  • Standardization (addresses, timestamps, status codes, units)     │  │
│  │  • Matching & dedup (supplier names, customer records)              │  │
│  │  • Trust Score + Trust Score for AI                                 │  │
│  │  • Data Catalog + Lineage                                           │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
└──────────────────────────────┼───────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  TARGET: Qlik Open Lakehouse / Snowflake / Cloud Storage                 │
│                                                                          │
│  ┌──────────────┐   ┌──────────────────┐   ┌─────────────────────────┐  │
│  │ Inventory    │   │ IoT Telemetry    │   │ Customer & Orders       │  │
│  │ (cleaned)    │   │ (normalized)     │   │ (deduplicated)          │  │
│  └──────────────┘   └──────────────────┘   └─────────────────────────┘  │
│                                                                          │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  ANALYTICS + AI                                                          │
│                                                                          │
│  Qlik Analytics (dashboards) → AutoML (spoilage model) → Qlik Answers (Q&A)│
│  Discovery Agent (proactive alerts) → MCP Server (extensibility)         │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference: Nightmare-to-Feed Mapping

| Nightmare | PostgreSQL (WMS) | Kafka (Streaming) | MySQL (Meridian CRM) |
|---|---|---|---|
| #1 Phantom Inventory | **PRIMARY** -- ERP/WMS qty mismatch | | |
| #2 Address Catastrophe | | | **PRIMARY** -- Contact address chaos |
| #3 Product Master Mess | UoM inconsistency | | **PRIMARY** -- SKU/supplier duplication |
| #4 Silent Pipelines | Stale data, partial loads | 6-hour Lagos gap | |
| #5 Timestamp Tower | No-timezone warehouse timestamps | Mixed timestamp formats, truncated millis | |
| #6 Carrier Black Hole | Status code chaos in shipments table | Carrier webhook format variation | Order tracking gaps |
| #7 Compliance Gap | Missing lot numbers | | Missing country_of_origin |

**All 7 nightmares are represented across the 3 feeds.**

---

*Three-Feed Demo Plan for Meridian Commerce Group*
*Version 1.0 -- February 2026*

### Sources

- [Qlik Talend Cloud Connector Factory](https://www.qlik.com/us/products/data-sources)
- [Supported Source Databases and Versions](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/DataIntegration/SourcesConnections/supported-sources.htm)
- [Kafka Connector Setup](https://help.qlik.com/talend/en-US/connectors-guide/Cloud/kafka)
- [MySQL source (Data Movement)](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/DataIntegration/Connectors/MySQL/MySQL-source.htm)
- [Supported SaaS Applications](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/DataIntegration/Landing/supported-saas-applications.htm)
- [100 New Qlik Talend Cloud Connectors](https://community.qlik.com/t5/Product-Innovation/From-A-to-Z-100-new-Qlik-Talend-Cloud-connectors/ba-p/2470982)
- [Connector Factory Q3 2025 Releases](https://community.qlik.com/t5/Product-Innovation/Connector-Factory-July-August-amp-September-2025-releases/ba-p/2532267)
