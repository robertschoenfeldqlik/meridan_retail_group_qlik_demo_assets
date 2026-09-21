#!/usr/bin/env python3
"""
seed_data.py — One-Time Data Seeder for MCG Demo
=================================================
Creates database schemas and populates PostgreSQL (WMS) and MySQL (Meridian
CRM) with a realistic batch of initial data for the Meridian Commerce Group
demo.

All 7 data quality nightmares are baked in:
  #1 Phantom Inventory       — Inflated WMS quantities (8% of records)
  #2 Address Catastrophe     — Inconsistent addresses across regions
  #3 Product Master Mess     — Legacy SKUs, missing weights, supplier variants
  #4 Silent Pipeline Failures— Partial loads in Rotterdam DC
  #5 Timestamp Tower of Babel— Mixed timezone formats per carrier/WMS
  #6 Carrier Data Black Hole — 6 carriers × 6 status vocabularies
  #7 Compliance Gap          — Missing lot numbers on 15% of perishables

Usage:
  pip install psycopg2-binary PyMySQL faker

  # Seed PostgreSQL only
  python seed_data.py --postgres --pg-host localhost --pg-db mcg_wms

  # Seed the CRM (MySQL) only
  python seed_data.py --mysql --my-host localhost --my-port 3307 --my-db mcg_crm

  # Seed both
  python seed_data.py --postgres --mysql [connection args...]

  # Preview mode (no writes)
  python seed_data.py --postgres --mysql --dry-run

Volumes (configurable):
  PostgreSQL:  ~2,000 inventory positions, ~5,000 warehouse events, ~3,000 shipments
  MySQL CRM:   ~120 contacts, ~600 orders, ~50 products
"""

import argparse
import math
import os
import random
import sys
import time
from datetime import datetime, timedelta, timezone

try:
    from faker import Faker
except ImportError:
    print("Install faker:  pip install faker")
    sys.exit(1)

# CRM reference data is shared with mysql_crm_simulator.py so the seeded
# population and the live feed cannot drift apart.
from mcg_reference_data import (
    ADDRESS_PERSONAS,
    CRM_CARRIERS,
    CRM_PRODUCT_TEMPLATES,
    FULFILLMENT_METHODS,
    GERMAN_NAME_RATE,
    LATE_DELIVERY_RATE,
    MISSING_TRACKING_RATE,
    NEXT_DAY_PROMISE_RATE,
    SUPPLIER_VARIANTS,
    WISMO_RATE,
    mailing_street,
    new_id,
    supplier_spelling,
)

fake = Faker()
Faker.seed(42)
random.seed(42)

# ---------------------------------------------------------------------------
#  Shared Reference Data
# ---------------------------------------------------------------------------

WAREHOUSES = {
    "DC-RTD-01": {"region": "EU",     "tz_offset": 1,  "type": "mega"},
    "DC-MUN-01": {"region": "EU",     "tz_offset": 1,  "type": "regional"},
    "DC-LON-01": {"region": "EU",     "tz_offset": 0,  "type": "regional"},
    "DC-ATL-01": {"region": "AMER",   "tz_offset": -5, "type": "mega"},
    "DC-CHI-01": {"region": "AMER",   "tz_offset": -6, "type": "regional"},
    "DC-SIN-01": {"region": "APAC",   "tz_offset": 8,  "type": "mega"},
    "DC-TYO-01": {"region": "APAC",   "tz_offset": 9,  "type": "regional"},
    "DC-GRU-01": {"region": "LATAM",  "tz_offset": -3, "type": "regional"},
    "DC-LOS-01": {"region": "AFRICA", "tz_offset": 1,  "type": "regional"},
}

PRODUCTS = [
    {"sku": "MCG-4420",         "legacy_am": "AM-BT-SPKR-001",  "legacy_eu": "EU-44200",        "name": "Bluetooth Speaker",    "category": "Electronics", "weight_kg": 0.45, "perishable": False, "uom": "EA"},
    {"sku": "MCG-4421",         "legacy_am": "AM-HDPH-002",      "legacy_eu": "EU-44210",        "name": "Wireless Headphones",  "category": "Electronics", "weight_kg": 0.32, "perishable": False, "uom": "EA"},
    {"sku": "MCG-4430",         "legacy_am": "AM-CHRG-010",      "legacy_eu": "EU-44300",        "name": "USB-C Charger",        "category": "Electronics", "weight_kg": None, "perishable": False, "uom": "EA"},
    {"sku": "MCG-4435",         "legacy_am": None,               "legacy_eu": "EU-44350",        "name": "Smart Watch Band",     "category": "Electronics", "weight_kg": 0.08, "perishable": False, "uom": "EA"},
    {"sku": "MCG-HG-1001",     "legacy_am": "AM-CNDL-050",      "legacy_eu": None,              "name": "Scented Candle Set",   "category": "Home",        "weight_kg": 1.2,  "perishable": False, "uom": "EA"},
    {"sku": "MCG-HG-1002",     "legacy_am": "AM-THRO-051",      "legacy_eu": "EU-HG-1002",      "name": "Throw Blanket",        "category": "Home",        "weight_kg": None, "perishable": False, "uom": "EA"},
    {"sku": "MCG-HG-1010",     "legacy_am": None,               "legacy_eu": "EU-HG-1010",      "name": "Kitchen Mixer Pro",    "category": "Home",        "weight_kg": None, "perishable": False, "uom": "EA"},
    {"sku": "MCG-GRO-LET-001", "legacy_am": None,               "legacy_eu": "EU-GRO-LET-001",  "name": "Organic Lettuce",      "category": "Grocery",     "weight_kg": 0.35, "perishable": True,  "uom": "EA"},
    {"sku": "MCG-GRO-MLK-010", "legacy_am": "AM-GRO-MLK-010",   "legacy_eu": None,              "name": "Whole Milk 1L",        "category": "Grocery",     "weight_kg": 1.03, "perishable": True,  "uom": "EA"},
    {"sku": "MCG-GRO-CHZ-015", "legacy_am": None,               "legacy_eu": "EU-GRO-CHZ-015",  "name": "Aged Gouda 500g",      "category": "Grocery",     "weight_kg": 0.52, "perishable": True,  "uom": "EA"},
    {"sku": "MCG-GRO-OLV-220", "legacy_am": "AM-GRO-OLV-220",   "legacy_eu": "EU-GRO-OLV-220",  "name": "Olive Oil 500ml",      "category": "Grocery",     "weight_kg": 0.52, "perishable": False, "uom": "EA"},
    {"sku": "MCG-GRO-MIX-015", "legacy_am": None,               "legacy_eu": None,              "name": "Salad Mix 200g",       "category": "Grocery",     "weight_kg": 0.22, "perishable": True,  "uom": "EA"},
    {"sku": "MCG-APP-JKT-881", "legacy_am": "AM-APP-JKT-881",   "legacy_eu": "EU-APP-JKT-881",  "name": "Winter Jacket L",      "category": "Apparel",     "weight_kg": 0.0,  "perishable": False, "uom": "EA"},
    {"sku": "MCG-APP-TEE-200", "legacy_am": None,               "legacy_eu": "EU-APP-TEE-200",  "name": "Basic T-Shirt M",      "category": "Apparel",     "weight_kg": 0.18, "perishable": False, "uom": "EA"},
    {"sku": "MCG-HW-VIT-300",  "legacy_am": "AM-HW-VIT-300",    "legacy_eu": "EU-HW-VIT-300",   "name": "Multivitamin 60ct",    "category": "Health",      "weight_kg": 0.15, "perishable": False, "uom": "EA"},
    {"sku": "MCG-HW-YOG-050",  "legacy_am": None,               "legacy_eu": "EU-HW-YOG-050",   "name": "Greek Yogurt 500g",    "category": "Health",      "weight_kg": 0.53, "perishable": True,  "uom": "EA"},
]

CARRIERS = {
    "FEDEX":       {"statuses": {"created": "LABEL_CREATED", "pickup": "PICKED_UP", "transit": "IN_TRANSIT", "out": "ON_VEHICLE", "delivered": "DELIVERED", "failed": "DELIVERY_EXCEPTION"}, "ts": "iso_utc", "exceptions": ["DELIVERY_EXCEPTION", "NO_ACCESS", "BUSINESS_CLOSED"], "weight_unit": "lbs"},
    "DHL-EXPRESS": {"statuses": {"created": "shipment_info", "pickup": "pickup", "transit": "transit", "out": "out_for_delivery", "delivered": "delivered", "failed": "failure"}, "ts": "iso_utc", "exceptions": ["DE", "BA", "NH"], "weight_unit": "kg"},
    "DPD":         {"statuses": {"created": "Paketankündigung", "pickup": "Abgeholt", "transit": "In Zustellung", "out": "In Auslieferung", "delivered": "Zugestellt", "failed": "Zustellversuch"}, "ts": "iso_cet", "exceptions": ["ZS_FEHLER", "EMPF_NICHT_DA", "ADDR_FALSCH"], "weight_unit": "kg"},
    "NINJAVAN":    {"statuses": {"created": "Pending Pickup", "pickup": "Picked Up", "transit": "Arrived at Hub", "out": "On Vehicle", "delivered": "Completed", "failed": "Pending Reschedule"}, "ts": "iso_sgt", "exceptions": ["FAIL_DELIVER", "ADDR_UNKNOWN", "REFUSED"], "weight_unit": "kg"},
    "CORREIOS":    {"statuses": {"created": "Objeto postado", "pickup": "Coletado", "transit": "Em trânsito", "out": "Saiu para entrega", "delivered": "Objeto entregue ao destinatário", "failed": "Não entregue"}, "ts": "brazilian", "exceptions": ["CEP_INVALIDO", "AUSENTE", "ENDERECO_INSUFICIENTE"], "weight_unit": "kg"},
    "LOCAL-LOS":   {"statuses": {"created": "registered", "pickup": "collected", "transit": "moving", "out": "on the way", "delivered": "delivered ok", "failed": "not delivered"}, "ts": "informal", "exceptions": ["bad address", "no one home", "refused"], "weight_unit": None},
}

STORAGE_ZONE_DIRTY = ["AMBIENT", "CHILLED", "FROZEN", "KALT", "FROID", "ROOM_TEMP", "AMB", "FRZ"]

BIN_FMTS = [
    lambda: f"{chr(random.randint(65,70))}-{random.randint(1,12):02d}-{random.randint(1,8):02d}-{chr(random.randint(65,68))}",
    lambda: f"{chr(random.randint(65,70))}/{random.randint(1,12):02d}/{random.randint(1,8):02d}/{chr(random.randint(65,68))}",
    lambda: f"{chr(random.randint(65,70))}.{random.randint(1,12):02d}.{random.randint(1,8):02d}.{chr(random.randint(65,68))}",
]

# ADDRESS_PERSONAS, SUPPLIER_VARIANTS and CRM_PRODUCT_TEMPLATES used to be
# duplicated here. They now live in mcg_reference_data.py, shared with
# mysql_crm_simulator.py, and are imported at the top of this file.


# ---------------------------------------------------------------------------
#  Timestamp Formatters (Nightmare #5)
# ---------------------------------------------------------------------------

def ts_local_no_tz(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%S")

def ts_iso_utc(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

def ts_iso_offset(dt, offset_hours):
    sign = "+" if offset_hours >= 0 else "-"
    return dt.strftime(f"%Y-%m-%dT%H:%M:%S{sign}{abs(offset_hours):02d}:00")

def ts_brazilian(dt):
    return dt.strftime("%d/%m/%Y %H:%M")

def ts_informal(dt):
    return dt.strftime("%b %d %Y")

def carrier_ts(carrier_code, dt):
    fmt = CARRIERS[carrier_code]["ts"]
    if fmt == "iso_utc":   return ts_iso_utc(dt)
    if fmt == "iso_cet":   return ts_iso_offset(dt, 1)
    if fmt == "iso_sgt":   return ts_iso_offset(dt, 8)
    if fmt == "brazilian":  return ts_brazilian(dt)
    if fmt == "informal":   return ts_informal(dt)
    return ts_iso_utc(dt)


# ============================================================================
#  POSTGRESQL SEED
# ============================================================================

PG_SCHEMA = """
-- MCG WMS Database Schema
-- Intentional quality issues documented in comments

CREATE TABLE IF NOT EXISTS inventory_positions (
    position_id         SERIAL PRIMARY KEY,
    location_id         VARCHAR(20) NOT NULL,
    sku                 VARCHAR(30) NOT NULL,
    lot_number          VARCHAR(30),
    quantity_on_hand    INTEGER NOT NULL,
    quantity_available  INTEGER,
    quantity_reserved   INTEGER DEFAULT 0,
    quantity_in_transit INTEGER DEFAULT 0,
    unit_of_measure     VARCHAR(10),
    storage_zone        VARCHAR(15),
    last_count_date     TIMESTAMP WITHOUT TIME ZONE,
    snapshot_timestamp  TIMESTAMP WITHOUT TIME ZONE,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_events (
    event_id            SERIAL PRIMARY KEY,
    warehouse_id        VARCHAR(20) NOT NULL,
    event_type          VARCHAR(30) NOT NULL,
    sku                 VARCHAR(30) NOT NULL,
    quantity            INTEGER NOT NULL,
    lot_number          VARCHAR(30),
    location_bin        VARCHAR(20),
    order_id            VARCHAR(30),
    worker_id           VARCHAR(20),
    cycle_count_variance INTEGER,
    event_timestamp     TIMESTAMP WITHOUT TIME ZONE,
    created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipments (
    shipment_id         SERIAL PRIMARY KEY,
    tracking_number     VARCHAR(40),
    carrier_code        VARCHAR(20) NOT NULL,
    order_id            VARCHAR(30),
    shipment_status     VARCHAR(60) NOT NULL,
    status_datetime     VARCHAR(50),
    origin_facility     VARCHAR(20),
    destination_address TEXT,
    destination_city    VARCHAR(50),
    destination_country VARCHAR(50),
    estimated_delivery  VARCHAR(50),
    actual_delivery     VARCHAR(50),
    delivery_attempts   INTEGER,
    exception_code      VARCHAR(40),
    weight_value        DECIMAL(8,2),
    weight_unit         VARCHAR(5),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_location_sku ON inventory_positions(location_id, sku);
CREATE INDEX IF NOT EXISTS idx_inv_snapshot ON inventory_positions(snapshot_timestamp);
CREATE INDEX IF NOT EXISTS idx_wh_events_warehouse ON warehouse_events(warehouse_id, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier ON shipments(carrier_code, shipment_status);
CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
"""


def seed_postgres(host, port, db, user, password, counts, dry_run=False):
    """Create schema and seed PostgreSQL with batch data."""
    import psycopg2
    import psycopg2.extras

    inv_count   = counts.get("inventory", 2000)
    event_count = counts.get("events", 5000)
    ship_count  = counts.get("shipments", 3000)

    print(f"\n{'='*60}")
    print(f"  PostgreSQL Seed — {host}:{port}/{db}")
    print(f"  Target: {inv_count} inventory + {event_count} events + {ship_count} shipments")
    print(f"{'='*60}")

    if dry_run:
        print("  DRY RUN — no database changes will be made.")
        print(f"  Would create 3 tables and ~{inv_count + event_count + ship_count:,} rows.")
        return

    max_attempts = 10
    for attempt in range(1, max_attempts + 1):
        try:
            conn = psycopg2.connect(host=host, port=port, dbname=db, user=user, password=password)
            break
        except psycopg2.OperationalError as e:
            if attempt == max_attempts:
                raise
            wait = min(2 * attempt, 15)
            print(f"  Postgres not ready yet (attempt {attempt}/{max_attempts}): {e}".strip())
            print(f"  Retrying in {wait}s — the database container may still be starting up...")
            time.sleep(wait)
    conn.autocommit = False

    # --- Create schema ---
    print("\n  [1/4] Creating schema...")
    with conn.cursor() as cur:
        cur.execute(PG_SCHEMA)
    conn.commit()
    print("        OK — 3 tables + 5 indexes")

    # --- Idempotency guard ---
    # This seeder is meant to run once. Every re-run (e.g. a restarted
    # "docker compose up" for the seed container) would otherwise insert
    # another full batch on top of existing rows, silently duplicating the
    # dataset. Bail out if the main table is already populated.
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM inventory_positions")
        existing_rows = cur.fetchone()[0]
    if existing_rows > 0:
        print(f"\n  Database already seeded ({existing_rows:,} rows found) — skipping to avoid duplicate data.\n")
        conn.close()
        return

    # --- Seed inventory_positions ---
    print(f"  [2/4] Seeding inventory_positions ({inv_count:,} rows)...")
    t0 = time.time()
    inv_rows = []
    base_time = datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 48))

    for i in range(inv_count):
        wh_id = random.choice(list(WAREHOUSES.keys()))
        wh = WAREHOUSES[wh_id]
        product = random.choice(PRODUCTS)
        local_time = base_time + timedelta(minutes=random.randint(-2880, 0)) + timedelta(hours=wh["tz_offset"])

        # SKU format: Nightmare #3
        r = random.random()
        if r < 0.6:
            sku = product["sku"]
        elif r < 0.8 and product["legacy_am"]:
            sku = product["legacy_am"]
        elif product["legacy_eu"]:
            sku = product["legacy_eu"]
        else:
            sku = product["sku"]

        qty = random.randint(20, 800)
        if random.random() < 0.08:           # Nightmare #1: phantom
            qty = int(qty * random.uniform(1.3, 1.8))
        if random.random() < 0.02:           # Negative inventory bug
            qty = -random.randint(1, 25)

        reserved = random.randint(0, max(1, qty // 5)) if qty > 0 else 0
        available = max(0, qty - reserved)
        in_transit = random.randint(0, 200) if random.random() < 0.4 else 0

        uom = product["uom"]
        if random.random() < 0.07:           # Nightmare #3: unit inconsistency
            uom = random.choice(["CS", "PAL", "PK", "EACH", "UNIT"])

        lot = None
        if product["perishable"]:
            if random.random() > 0.15:       # Nightmare #7: 15% missing lot
                lot = f"LOT-{local_time.strftime('%Y-%m')}-{random.randint(1000,9999)}"
        elif random.random() > 0.5:
            lot = f"LOT-{local_time.strftime('%Y-%m')}-{random.randint(1000,9999)}"

        if product["perishable"]:
            zone = random.choice(["CHILLED", "FROZEN", "KALT", "FROID"]) if random.random() < 0.15 else random.choice(["CHILLED", "FROZEN"])
        else:
            zone = random.choice(STORAGE_ZONE_DIRTY) if random.random() < 0.10 else "AMBIENT"

        snapshot_ts = ts_local_no_tz(local_time)
        count_date = ts_local_no_tz(local_time - timedelta(days=random.randint(0, 7)))

        inv_rows.append((wh_id, sku, lot, qty, available, reserved, in_transit, uom, zone, count_date, snapshot_ts))

    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, """
            INSERT INTO inventory_positions
                (location_id, sku, lot_number, quantity_on_hand, quantity_available,
                 quantity_reserved, quantity_in_transit, unit_of_measure,
                 storage_zone, last_count_date, snapshot_timestamp)
            VALUES %s
        """, inv_rows, page_size=500)
    conn.commit()
    print(f"        OK — {len(inv_rows):,} rows in {time.time()-t0:.1f}s")

    # --- Seed warehouse_events ---
    print(f"  [3/4] Seeding warehouse_events ({event_count:,} rows)...")
    t0 = time.time()
    evt_rows = []
    event_types_std = ["RECEIVE", "PICK", "PACK", "SHIP", "ADJUST", "CYCLE_COUNT"]
    event_types_short = ["RCV", "PCK", "PACK", "SHP", "ADJ", "CC"]
    event_types_long = ["INBOUND_RECEIPT", "ORDER_PICK", "PACK_STATION", "OUTBOUND_SHIP", "INVENTORY_ADJUST", "CYCLE_COUNT_AUDIT"]

    for i in range(event_count):
        wh_id = random.choice(list(WAREHOUSES.keys()))
        wh = WAREHOUSES[wh_id]
        product = random.choice(PRODUCTS)
        local_time = base_time + timedelta(minutes=random.randint(-4320, 0)) + timedelta(hours=wh["tz_offset"])

        # Event type naming varies by region
        if wh["region"] == "APAC":
            event_type = random.choice(event_types_short)
        elif random.random() < 0.1:
            event_type = random.choice(event_types_long)
        else:
            event_type = random.choice(event_types_std)

        qty = random.randint(1, 100)
        lot = f"LOT-{local_time.strftime('%Y-%m')}-{random.randint(1000,9999)}" if product["perishable"] and random.random() > 0.15 else None
        location_bin = random.choice(BIN_FMTS)()

        order_id = None
        if event_type in ("SHIP", "SHP", "OUTBOUND_SHIP", "PICK", "PCK", "ORDER_PICK"):
            if random.random() > 0.20:       # 20% missing order linkage
                order_id = f"WEB-{local_time.strftime('%Y-%m')}-{random.randint(100000,999999):07d}"

        worker_id = f"WRK-{wh_id.split('-')[1]}-{random.randint(100,999):04d}"
        variance = None
        if event_type in ("CYCLE_COUNT", "CC", "CYCLE_COUNT_AUDIT"):
            variance = random.choice([0, 0, 0, -random.randint(1, 30), random.randint(1, 10)])

        evt_rows.append((wh_id, event_type, product["sku"], qty, lot, location_bin, order_id, worker_id, variance, ts_local_no_tz(local_time)))

    # Inject Nightmare #4: partial load batch for Rotterdam
    for j in range(20):
        if random.random() < 0.5:
            continue
        product = random.choice(PRODUCTS)
        evt_rows.append((
            "DC-RTD-01", "ADJUST", product["sku"], random.randint(-20, 20), None,
            random.choice(BIN_FMTS)(), None, "WRK-RTD-BATCH", None,
            ts_local_no_tz(base_time + timedelta(hours=1))
        ))

    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, """
            INSERT INTO warehouse_events
                (warehouse_id, event_type, sku, quantity, lot_number,
                 location_bin, order_id, worker_id, cycle_count_variance, event_timestamp)
            VALUES %s
        """, evt_rows, page_size=500)
    conn.commit()
    print(f"        OK — {len(evt_rows):,} rows in {time.time()-t0:.1f}s")

    # --- Seed shipments ---
    print(f"  [4/4] Seeding shipments ({ship_count:,} rows)...")
    t0 = time.time()
    ship_rows = []
    countries_clean = ["NL", "DE", "US", "SG", "BR", "GB", "NG", "JP", "AU", "FR"]
    countries_dirty = ["Netherlands", "Deutschland", "United States", "Singapore", "Brasil",
                       "Niederlande", "Allemagne", "USA", "Estados Unidos", "Singapur"]

    for i in range(ship_count):
        cc = random.choice(list(CARRIERS.keys()))
        carrier = CARRIERS[cc]
        ts_base = base_time + timedelta(minutes=random.randint(-4320, 0))

        lifecycle = random.choices(
            ["created", "pickup", "transit", "out", "delivered", "failed"],
            weights=[0.10, 0.10, 0.30, 0.15, 0.25, 0.10], k=1
        )[0]
        status = carrier["statuses"][lifecycle]

        # Tracking number format per carrier
        if cc == "FEDEX":     tracking = f"1Z{random.randint(100,999)}AA{random.randint(10000000,99999999)}"
        elif cc == "DHL-EXPRESS": tracking = f"JD{random.randint(10000000000,99999999999)}"
        elif cc == "DPD":     tracking = f"DPD-DE-{ts_base.strftime('%Y%m%d')}-{random.randint(1000,9999)}"
        elif cc == "NINJAVAN":tracking = f"NV-SG-{ts_base.strftime('%Y%m%d')}-{random.randint(1000,9999)}"
        elif cc == "CORREIOS":tracking = f"COR-BR-{ts_base.strftime('%Y%m%d')}-{random.randint(1000,9999)}"
        elif cc == "LOCAL-LOS":tracking = None if random.random() < 0.4 else f"LOS-{random.randint(10000,99999)}"
        else: tracking = None

        order_id = f"WEB-{ts_base.strftime('%Y-%m')}-{random.randint(100000,999999):07d}" if random.random() > 0.1 else None
        status_dt = carrier_ts(cc, ts_base)
        dest_country = random.choice(countries_clean) if random.random() > 0.25 else random.choice(countries_dirty)
        est_delivery = carrier_ts(cc, ts_base + timedelta(days=random.randint(1, 5)))
        actual_delivery = carrier_ts(cc, ts_base) if lifecycle == "delivered" and random.random() > 0.15 else None
        exception = random.choice(carrier["exceptions"]) if lifecycle == "failed" else None
        weight_val = round(random.uniform(0.2, 25.0), 2) if random.random() > 0.2 else None
        weight_unit = carrier["weight_unit"]
        if weight_unit and random.random() < 0.1:
            weight_unit = random.choice(["kg", "KG", "Kg", "lbs", "LBS", "lb", None])
        delivery_attempts = random.choices([1, 2, 3], weights=[0.7, 0.2, 0.1])[0] if lifecycle in ("delivered", "failed") else None

        ship_rows.append((
            tracking, cc, order_id, status, status_dt,
            random.choice(list(WAREHOUSES.keys())),
            fake.street_address(), fake.city(), dest_country,
            est_delivery, actual_delivery, delivery_attempts,
            exception, weight_val, weight_unit
        ))

    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, """
            INSERT INTO shipments
                (tracking_number, carrier_code, order_id, shipment_status,
                 status_datetime, origin_facility, destination_address,
                 destination_city, destination_country, estimated_delivery,
                 actual_delivery, delivery_attempts, exception_code,
                 weight_value, weight_unit)
            VALUES %s
        """, ship_rows, page_size=500)
    conn.commit()
    print(f"        OK — {len(ship_rows):,} rows in {time.time()-t0:.1f}s")

    conn.close()
    total = len(inv_rows) + len(evt_rows) + len(ship_rows)
    print(f"\n  PostgreSQL seed complete: {total:,} total rows across 3 tables.\n")


# ============================================================================
#  MERIDIAN CRM SEED (MySQL)
# ============================================================================

def _load_mysql_schema():
    """Read mysql_schema.sql from beside this file and split it into statements.

    The DDL lives in a .sql file rather than a Python string so it can also be
    piped straight into a mysql client by hand, and so there is exactly one
    definition of the CRM schema to keep correct.
    """
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, "mysql_schema.sql")
    with open(path, encoding="utf-8") as fh:
        raw = fh.read()

    # Strip full-line and trailing "--" comments. PyMySQL will not run a
    # multi-statement string, so the file has to be split on ";" and every
    # comment removed first or a trailing comment swallows the next statement.
    lines = []
    for line in raw.splitlines():
        stripped = line.split("--", 1)[0].rstrip()
        if stripped:
            lines.append(stripped)
    return [stmt.strip() for stmt in "\n".join(lines).split(";") if stmt.strip()]


def seed_mysql(host, port, db, user, password, counts, dry_run=False):
    """Create the CRM schema and seed MySQL with contacts, orders and products."""
    contact_count = counts.get("contacts", 120)
    order_count   = counts.get("orders", 600)
    product_count = counts.get("products", 50)

    print(f"\n{'='*60}")
    print(f"  Meridian CRM Seed (MySQL) — {host}:{port}/{db}")
    print(f"  Target: {contact_count} contacts + {order_count} orders + {product_count} products")
    print(f"{'='*60}")

    if dry_run:
        print("  DRY RUN — no database changes will be made.")
        print(f"  Would create 3 tables and ~{contact_count + order_count + product_count:,} rows.")
        return

    # Imported here rather than at module scope so a missing MySQL driver only
    # breaks the MySQL path, exactly as psycopg2 is handled in seed_postgres().
    # It sits below the dry-run return so --dry-run works on a bare checkout.
    import pymysql

    # Connect without selecting a database: the schema file creates it.
    max_attempts = 10
    for attempt in range(1, max_attempts + 1):
        try:
            conn = pymysql.connect(
                host=host, port=port, user=user, password=password,
                charset="utf8mb4", autocommit=False,
            )
            break
        except pymysql.err.OperationalError as e:
            if attempt == max_attempts:
                raise
            wait = min(2 * attempt, 15)
            print(f"  MySQL not ready yet (attempt {attempt}/{max_attempts}): {e}".strip())
            print(f"  Retrying in {wait}s — the database container may still be starting up...")
            time.sleep(wait)

    # --- Create schema ---
    print("\n  [1/4] Creating schema...")
    with conn.cursor() as cur:
        for stmt in _load_mysql_schema():
            cur.execute(stmt)
        cur.execute(f"USE `{db}`")
    conn.commit()
    print("        OK — 3 tables + 8 indexes")

    # --- Idempotency guard ---
    # This seeder is meant to run once. Every re-run (e.g. a restarted
    # compose "up" for the seed container) would otherwise insert another
    # full batch on top of the existing rows, silently duplicating the
    # dataset. Bail out if the main table is already populated.
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM crm_contacts")
        existing_rows = cur.fetchone()[0]
    if existing_rows > 0:
        print(f"\n  CRM already seeded ({existing_rows:,} contacts found) — skipping to avoid duplicate data.\n")
        conn.close()
        return

    def bulk(cur, sql, rows, chunk=500):
        """executemany in chunks, mirroring psycopg2's execute_values page_size."""
        for i in range(0, len(rows), chunk):
            cur.executemany(sql, rows[i:i + chunk])

    # --- Seed crm_contacts ---
    print(f"  [2/4] Seeding crm_contacts ({contact_count:,} rows)...")
    t0 = time.time()
    contact_ids = []
    contact_rows = []

    for i in range(contact_count):
        persona = random.choice(ADDRESS_PERSONAS)
        v = random.choice(persona["variants"])
        cid = new_id("003")
        contact_ids.append(cid)
        contact_rows.append((
            cid,
            v["first"],
            # Suffixed so the near-duplicates stay distinguishable while still
            # sharing an address — that is the point of Nightmare #2.
            f"{v['last']}_{i:04d}",
            v["email"].replace("@", f".{i:04d}@"),
            v["phone"],
            mailing_street(v),
            v["city"],
            v["state"],      # genuinely None for city-states — keep it None
            v["postal"],
            v["country"],
        ))

    with conn.cursor() as cur:
        bulk(cur, """
            INSERT INTO crm_contacts
              (contact_id, first_name, last_name, email, phone,
               mailing_street, mailing_city, mailing_state,
               mailing_postal_code, mailing_country)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, contact_rows)
    conn.commit()
    print(f"        OK — {len(contact_rows):,} contacts in {time.time()-t0:.1f}s")

    # --- Seed crm_orders ---
    print(f"  [3/4] Seeding crm_orders ({order_count:,} rows)...")
    t0 = time.time()
    order_rows = []
    seen_order_ids = set()

    for i in range(order_count):
        now = datetime.now(timezone.utc) - timedelta(days=random.randint(0, 90))
        product = random.choice(CRM_PRODUCT_TEMPLATES)
        carrier = random.choice(CRM_CARRIERS)
        method  = random.choice(FULFILLMENT_METHODS)

        # Some promises are unrealistically optimistic (next-day).
        if random.random() < NEXT_DAY_PROMISE_RATE:
            promised = now + timedelta(days=1)
        else:
            promised = now + timedelta(days=random.randint(2, 7))

        # Seeded orders are history, so they carry a spread of terminal and
        # in-flight states. Orders the simulator creates later start at
        # PROCESSING and are walked forward, which is what produces the
        # UPDATE traffic in the change stream.
        status = random.choices(
            ["PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "DELIVERY_FAILED"],
            weights=[0.15, 0.10, 0.25, 0.35, 0.15], k=1,
        )[0]

        actual = None
        if status == "DELIVERED":
            if random.random() > LATE_DELIVERY_RATE:
                actual = promised - timedelta(days=random.randint(0, 2))
            else:
                actual = promised + timedelta(days=random.randint(1, 5))  # SLA breach

        tracking = None
        if random.random() > MISSING_TRACKING_RATE:
            tracking = f"{carrier[:3]}-{random.randint(1000000, 9999999)}"

        order_id = f"WEB-{now.strftime('%Y-%m')}-{i:06d}"
        if order_id in seen_order_ids:
            continue
        seen_order_ids.add(order_id)

        order_rows.append((
            order_id,
            random.choice(contact_ids),
            now.strftime("%Y-%m-%d %H:%M:%S"),
            product["sku"],
            product["name"],
            method,
            promised.strftime("%Y-%m-%d"),
            actual.strftime("%Y-%m-%d") if actual else None,
            carrier,
            tracking,
            status,
            1 if random.random() < WISMO_RATE else 0,
        ))

    with conn.cursor() as cur:
        bulk(cur, """
            INSERT INTO crm_orders
              (order_id, contact_id, order_date, sku, product_name,
               fulfillment_method, promised_delivery, actual_delivery,
               carrier, tracking_number, order_status, wismo_flag)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, order_rows)
    conn.commit()
    print(f"        OK — {len(order_rows):,} orders in {time.time()-t0:.1f}s")

    # --- Seed crm_products ---
    print(f"  [4/4] Seeding crm_products ({product_count:,} rows)...")
    t0 = time.time()
    product_rows = []

    for i in range(product_count):
        template = random.choice(CRM_PRODUCT_TEMPLATES)
        name = template["name"]
        if random.random() < GERMAN_NAME_RATE:
            name = template.get("name_de", template["name"])

        product_rows.append((
            f"{template['sku']}-{i:04d}",
            template.get("sku_am"),
            template.get("sku_eu"),
            name,
            template["cat1"],
            template["cat2"],
            template.get("cat3"),
            # None stays None and 0.0 stays 0.0 — they are different defects.
            template["weight"],
            template.get("origin"),
            supplier_spelling(template["supplier"]),
        ))

    with conn.cursor() as cur:
        bulk(cur, """
            INSERT INTO crm_products
              (sku, legacy_sku_americas, legacy_sku_eu, product_name,
               category_l1, category_l2, category_l3, weight_kg,
               country_of_origin, supplier_name)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, product_rows)
    conn.commit()
    print(f"        OK — {len(product_rows):,} products in {time.time()-t0:.1f}s")

    total = len(contact_rows) + len(order_rows) + len(product_rows)
    print(f"\n  Meridian CRM seed complete: {total:,} rows.\n")
    conn.close()


# ============================================================================
#  CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Seed MCG demo data into PostgreSQL (WMS) and/or MySQL (Meridian CRM).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Seed PostgreSQL only
  python seed_data.py --postgres --pg-host localhost --pg-db mcg_wms --pg-user postgres --pg-pass secret

  # Seed the CRM only
  python seed_data.py --mysql --my-host localhost --my-port 3307 --my-user qlik_cdc --my-pass secret

  # Seed both with custom volumes
  python seed_data.py --postgres --mysql --inv-count 5000 --event-count 10000

  # Dry run (preview)
  python seed_data.py --postgres --mysql --dry-run

Environment variables:
  PG_HOST, PG_PORT, PG_DB, PG_USER, PG_PASSWORD
  MYSQL_HOST, MYSQL_PORT, MYSQL_DB, MYSQL_USER, MYSQL_PASSWORD
        """,
    )

    # Mode
    parser.add_argument("--postgres", action="store_true", help="Seed PostgreSQL database")
    parser.add_argument("--mysql", action="store_true", help="Seed the Meridian CRM MySQL database")
    parser.add_argument("--dry-run", action="store_true", help="Preview without making changes")

    # PostgreSQL connection
    pg = parser.add_argument_group("PostgreSQL connection")
    pg.add_argument("--pg-host", default=os.environ.get("PG_HOST", "localhost"))
    pg.add_argument("--pg-port", type=int, default=int(os.environ.get("PG_PORT", "5432")))
    pg.add_argument("--pg-db", default=os.environ.get("PG_DB", "mcg_wms"))
    pg.add_argument("--pg-user", default=os.environ.get("PG_USER", "postgres"))
    pg.add_argument("--pg-pass", default=os.environ.get("PG_PASSWORD", ""))

    # MySQL (Meridian CRM) connection
    # NOTE: the env var names below are the ones wired through
    # infrastructure/.env.example and docker-compose*.yml, and they are shared
    # with mysql_crm_simulator.py. Change them in all three or none.
    #
    # The default port is 3307, not 3306: the Data Movement Gateway container
    # already binds 3306 on this host, so the CRM database is published one
    # port up. Inside the compose network it is still plain mysql:3306.
    my = parser.add_argument_group("MySQL (Meridian CRM) connection")
    my.add_argument("--my-host", default=os.environ.get("MYSQL_HOST", "localhost"))
    my.add_argument("--my-port", type=int, default=int(os.environ.get("MYSQL_PORT", "3307")))
    my.add_argument("--my-db", default=os.environ.get("MYSQL_DB", "mcg_crm"))
    my.add_argument("--my-user", default=os.environ.get("MYSQL_USER", "root"))
    my.add_argument("--my-pass", default=os.environ.get("MYSQL_PASSWORD", ""))

    # Volume controls
    vol = parser.add_argument_group("Data volume")
    vol.add_argument("--inv-count", type=int, default=2000, help="Inventory positions (default: 2000)")
    vol.add_argument("--event-count", type=int, default=5000, help="Warehouse events (default: 5000)")
    vol.add_argument("--ship-count", type=int, default=3000, help="Shipments (default: 3000)")
    vol.add_argument("--contact-count", type=int, default=120, help="CRM contacts (default: 120)")
    vol.add_argument("--order-count", type=int, default=600, help="CRM orders (default: 600)")
    vol.add_argument("--product-count", type=int, default=50, help="CRM products (default: 50)")

    args = parser.parse_args()

    if not args.postgres and not args.mysql:
        print("ERROR: Specify --postgres, --mysql, or both.")
        parser.print_help()
        sys.exit(1)

    print("\n" + "=" * 60)
    print("  MCG Data Seeder")
    print("  Meridian Commerce Group — Demo Data Population")
    print("=" * 60)

    pg_counts = {"inventory": args.inv_count, "events": args.event_count, "shipments": args.ship_count}
    crm_counts = {"contacts": args.contact_count, "orders": args.order_count, "products": args.product_count}

    # Track failure across ALL requested phases so the exit code reflects
    # any failure, not just a postgres-only failure (a failing --postgres
    # phase must not be masked by a subsequent successful --mysql phase).
    any_failed = False

    if args.postgres:
        try:
            seed_postgres(
                host=args.pg_host, port=args.pg_port, db=args.pg_db,
                user=args.pg_user, password=args.pg_pass,
                counts=pg_counts, dry_run=args.dry_run,
            )
        except Exception as e:
            print(f"\n  ERROR (PostgreSQL): {e}")
            any_failed = True

    if args.mysql:
        try:
            seed_mysql(
                host=args.my_host, port=args.my_port, db=args.my_db,
                user=args.my_user, password=args.my_pass,
                counts=crm_counts, dry_run=args.dry_run,
            )
        except Exception as e:
            print(f"\n  ERROR (MySQL CRM): {e}")
            any_failed = True

    print("=" * 60)
    if any_failed:
        print("  Seeding completed with errors.")
        print("=" * 60)
        sys.exit(1)

    print("  Seeding complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
