"""
Meridian Commerce Group -- Continuous PostgreSQL Data Simulator
================================================================
Generates organic, realistic data patterns for the MCG WMS database.

Simulates:
  - Inventory movements (receipts, picks, adjustments, cycle counts)
  - Warehouse events with realistic daily/hourly patterns
  - Shipment lifecycle events from 6 carriers with format chaos

Data quality issues are INTENTIONALLY injected to demonstrate
Qlik Talend Cloud profiling, cleansing, and Trust Score.

Usage:
  pip install psycopg2-binary faker
  python postgres_simulator.py --host localhost --port 5432 --db mcg_wms

Press Ctrl+C to stop.
"""

import argparse
import json
import math
import os
import random
import sys
import time
from datetime import datetime, timedelta, timezone

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("Install psycopg2-binary:  pip install psycopg2-binary")
    sys.exit(1)

try:
    from faker import Faker
except ImportError:
    print("Install faker:  pip install faker")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Regions and their warehouses
WAREHOUSES = {
    "DC-RTD-01": {"region": "EU", "tz_offset": 1, "type": "mega"},
    "DC-MUN-01": {"region": "EU", "tz_offset": 1, "type": "regional"},
    "DC-LON-01": {"region": "EU", "tz_offset": 0, "type": "regional"},
    "DC-ATL-01": {"region": "AMER", "tz_offset": -5, "type": "mega"},
    "DC-CHI-01": {"region": "AMER", "tz_offset": -6, "type": "regional"},
    "DC-SIN-01": {"region": "APAC", "tz_offset": 8, "type": "mega"},
    "DC-TYO-01": {"region": "APAC", "tz_offset": 9, "type": "regional"},
    "DC-GRU-01": {"region": "LATAM", "tz_offset": -3, "type": "regional"},
    "DC-LOS-01": {"region": "AFRICA", "tz_offset": 1, "type": "regional"},
}

# Sample stores (subset)
STORES = [
    "STR-AMS-001", "STR-AMS-002", "STR-MUN-042", "STR-BER-010",
    "STR-LON-005", "STR-LON-018", "STR-PAR-003",
    "STR-ATL-015", "STR-NYC-008", "STR-CHI-022", "STR-MIA-006",
    "STR-SIN-008", "STR-TYO-012", "STR-SYD-004",
    "STR-GRU-007", "STR-BA-003",
    "STR-LOS-002", "STR-ABJ-001",
]

# Product catalog -- mix of categories with intentional quality issues
PRODUCTS = [
    # Electronics
    {"sku": "MCG-4420", "legacy_am": "AM-BT-SPKR-001", "legacy_eu": "EU-44200", "name": "Bluetooth Speaker", "category": "Electronics", "weight_kg": 0.45, "perishable": False, "uom": "EA"},
    {"sku": "MCG-4421", "legacy_am": "AM-HDPH-002", "legacy_eu": "EU-44210", "name": "Wireless Headphones", "category": "Electronics", "weight_kg": 0.32, "perishable": False, "uom": "EA"},
    {"sku": "MCG-4430", "legacy_am": "AM-CHRG-010", "legacy_eu": "EU-44300", "name": "USB-C Charger", "category": "Electronics", "weight_kg": None, "perishable": False, "uom": "EA"},  # Missing weight!
    {"sku": "MCG-4435", "legacy_am": None, "legacy_eu": "EU-44350", "name": "Smart Watch Band", "category": "Electronics", "weight_kg": 0.08, "perishable": False, "uom": "EA"},
    # Home goods
    {"sku": "MCG-HG-1001", "legacy_am": "AM-CNDL-050", "legacy_eu": None, "name": "Scented Candle Set", "category": "Home", "weight_kg": 1.2, "perishable": False, "uom": "EA"},
    {"sku": "MCG-HG-1002", "legacy_am": "AM-THRO-051", "legacy_eu": "EU-HG-1002", "name": "Throw Blanket", "category": "Home", "weight_kg": None, "perishable": False, "uom": "EA"},  # Missing weight!
    {"sku": "MCG-HG-1010", "legacy_am": None, "legacy_eu": "EU-HG-1010", "name": "Kitchen Mixer Pro", "category": "Home", "weight_kg": None, "perishable": False, "uom": "EA"},  # Missing weight!
    # Grocery & Fresh (perishable -- lot tracking critical)
    {"sku": "MCG-GRO-LET-001", "legacy_am": None, "legacy_eu": "EU-GRO-LET-001", "name": "Organic Lettuce", "category": "Grocery", "weight_kg": 0.35, "perishable": True, "uom": "EA"},
    {"sku": "MCG-GRO-MLK-010", "legacy_am": "AM-GRO-MLK-010", "legacy_eu": None, "name": "Whole Milk 1L", "category": "Grocery", "weight_kg": 1.03, "perishable": True, "uom": "EA"},
    {"sku": "MCG-GRO-CHZ-015", "legacy_am": None, "legacy_eu": "EU-GRO-CHZ-015", "name": "Aged Gouda 500g", "category": "Grocery", "weight_kg": 0.52, "perishable": True, "uom": "EA"},
    {"sku": "MCG-GRO-OLV-220", "legacy_am": "AM-GRO-OLV-220", "legacy_eu": "EU-GRO-OLV-220", "name": "Olive Oil 500ml", "category": "Grocery", "weight_kg": 0.52, "perishable": False, "uom": "EA"},
    {"sku": "MCG-GRO-MIX-015", "legacy_am": None, "legacy_eu": None, "name": "Salad Mix 200g", "category": "Grocery", "weight_kg": 0.22, "perishable": True, "uom": "EA"},
    # Apparel
    {"sku": "MCG-APP-JKT-881", "legacy_am": "AM-APP-JKT-881", "legacy_eu": "EU-APP-JKT-881", "name": "Winter Jacket L", "category": "Apparel", "weight_kg": 0.0, "perishable": False, "uom": "EA"},  # Zero weight (invalid!)
    {"sku": "MCG-APP-TEE-200", "legacy_am": None, "legacy_eu": "EU-APP-TEE-200", "name": "Basic T-Shirt M", "category": "Apparel", "weight_kg": 0.18, "perishable": False, "uom": "EA"},
    # Health & Wellness
    {"sku": "MCG-HW-VIT-300", "legacy_am": "AM-HW-VIT-300", "legacy_eu": "EU-HW-VIT-300", "name": "Multivitamin 60ct", "category": "Health", "weight_kg": 0.15, "perishable": False, "uom": "EA"},
    {"sku": "MCG-HW-YOG-050", "legacy_am": None, "legacy_eu": "EU-HW-YOG-050", "name": "Greek Yogurt 500g", "category": "Health", "weight_kg": 0.53, "perishable": True, "uom": "EA"},
]

# Carriers with their format chaos
CARRIERS = {
    "FEDEX": {
        "statuses": {"created": "LABEL_CREATED", "pickup": "PICKED_UP", "transit": "IN_TRANSIT", "out": "ON_VEHICLE", "delivered": "DELIVERED", "failed": "DELIVERY_EXCEPTION"},
        "ts_format": "iso_utc",
        "exception_codes": ["DELIVERY_EXCEPTION", "NO_ACCESS", "BUSINESS_CLOSED"],
        "weight_unit": "lbs",
    },
    "DHL-EXPRESS": {
        "statuses": {"created": "shipment_info", "pickup": "pickup", "transit": "transit", "out": "out_for_delivery", "delivered": "delivered", "failed": "failure"},
        "ts_format": "iso_utc",
        "exception_codes": ["DE", "BA", "NH"],
        "weight_unit": "kg",
    },
    "DPD": {
        "statuses": {"created": "Paketankündigung", "pickup": "Abgeholt", "transit": "In Zustellung", "out": "In Auslieferung", "delivered": "Zugestellt", "failed": "Zustellversuch"},
        "ts_format": "iso_offset_cet",
        "exception_codes": ["ZS_FEHLER", "EMPF_NICHT_DA", "ADDR_FALSCH"],
        "weight_unit": "kg",
    },
    "NINJAVAN": {
        "statuses": {"created": "Pending Pickup", "pickup": "Picked Up", "transit": "Arrived at Hub", "out": "On Vehicle", "delivered": "Completed", "failed": "Pending Reschedule"},
        "ts_format": "iso_offset_sgt",
        "exception_codes": ["FAIL_DELIVER", "ADDR_UNKNOWN", "REFUSED"],
        "weight_unit": "kg",
    },
    "CORREIOS": {
        "statuses": {"created": "Objeto postado", "pickup": "Coletado", "transit": "Em trânsito", "out": "Saiu para entrega", "delivered": "Objeto entregue ao destinatário", "failed": "Não entregue"},
        "ts_format": "brazilian",
        "exception_codes": ["CEP_INVALIDO", "AUSENTE", "ENDERECO_INSUFICIENTE"],
        "weight_unit": "kg",
    },
    "LOCAL-LOS": {
        "statuses": {"created": "registered", "pickup": "collected", "transit": "moving", "out": "on the way", "delivered": "delivered ok", "failed": "not delivered"},
        "ts_format": "informal",
        "exception_codes": ["bad address", "no one home", "refused"],
        "weight_unit": None,  # Never provided
    },
}

STORAGE_ZONES = ["AMBIENT", "CHILLED", "FROZEN"]
# Intentional non-standard variants that appear in dirty data
STORAGE_ZONE_DIRTY = ["AMBIENT", "CHILLED", "FROZEN", "KALT", "FROID", "ROOM_TEMP", "AMB", "FRZ"]

BIN_FORMATS = [
    lambda: f"{chr(random.randint(65,70))}-{random.randint(1,12):02d}-{random.randint(1,8):02d}-{chr(random.randint(65,68))}",  # A-04-02-C
    lambda: f"{chr(random.randint(65,70))}/{random.randint(1,12):02d}/{random.randint(1,8):02d}/{chr(random.randint(65,68))}",  # A/04/02/C
    lambda: f"{chr(random.randint(65,70))}.{random.randint(1,12):02d}.{random.randint(1,8):02d}.{chr(random.randint(65,68))}",  # A.04.02.C
]

fake = Faker()
Faker.seed(42)

# ---------------------------------------------------------------------------
# Timestamp formatters -- THE NIGHTMARE
# ---------------------------------------------------------------------------

def fmt_timestamp_local_no_tz(dt):
    """Nightmare #5: Local time, no timezone indicator (WMS style)"""
    return dt.strftime("%Y-%m-%dT%H:%M:%S")

def fmt_timestamp_iso_utc(dt):
    """Clean UTC with Z"""
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

def fmt_timestamp_iso_offset(dt, offset_hours):
    """ISO with timezone offset"""
    sign = "+" if offset_hours >= 0 else "-"
    return dt.strftime(f"%Y-%m-%dT%H:%M:%S{sign}{abs(offset_hours):02d}:00")

def fmt_timestamp_brazilian(dt):
    """Brazilian format: DD/MM/YYYY HH:MM"""
    return dt.strftime("%d/%m/%Y %H:%M")

def fmt_timestamp_informal(dt):
    """Informal: Oct 18 2025"""
    return dt.strftime("%b %d %Y")

def format_carrier_timestamp(carrier_code, dt):
    """Format timestamp according to carrier's convention"""
    carrier = CARRIERS[carrier_code]
    fmt = carrier["ts_format"]
    if fmt == "iso_utc":
        return fmt_timestamp_iso_utc(dt)
    elif fmt == "iso_offset_cet":
        return fmt_timestamp_iso_offset(dt, 1)
    elif fmt == "iso_offset_sgt":
        return fmt_timestamp_iso_offset(dt, 8)
    elif fmt == "brazilian":
        return fmt_timestamp_brazilian(dt)
    elif fmt == "informal":
        return fmt_timestamp_informal(dt)
    return fmt_timestamp_iso_utc(dt)


# ---------------------------------------------------------------------------
# Business pattern helpers -- makes data look organic
# ---------------------------------------------------------------------------

def business_activity_weight(hour_utc, region):
    """
    Returns a 0.0-1.0 weight representing how active a warehouse is
    at a given UTC hour, based on its region's business hours.
    Creates realistic daily patterns: busy during work hours, quiet at night.
    """
    offsets = {"EU": 1, "AMER": -5, "APAC": 8, "LATAM": -3, "AFRICA": 1}
    local_hour = (hour_utc + offsets.get(region, 0)) % 24

    if 6 <= local_hour <= 8:      # Morning ramp-up
        return 0.4 + (local_hour - 6) * 0.2
    elif 8 <= local_hour <= 12:    # Morning peak
        return 0.8 + random.uniform(0, 0.2)
    elif 12 <= local_hour <= 13:   # Lunch dip
        return 0.5
    elif 13 <= local_hour <= 17:   # Afternoon peak
        return 0.7 + random.uniform(0, 0.3)
    elif 17 <= local_hour <= 20:   # Evening wind-down
        return 0.3 + (20 - local_hour) * 0.1
    elif 20 <= local_hour <= 23:   # Night shift (light)
        return 0.1
    else:                           # Overnight (minimal)
        return 0.05

def should_generate_event(region):
    """Probabilistic: should we generate an event this cycle based on time of day?"""
    now_utc = datetime.now(timezone.utc)
    weight = business_activity_weight(now_utc.hour, region)
    return random.random() < weight

def weekly_seasonality():
    """Slightly less activity on weekends"""
    day = datetime.now(timezone.utc).weekday()
    if day >= 5:  # Saturday, Sunday
        return 0.4
    elif day == 0:  # Monday -- catch-up
        return 1.1
    elif day == 4:  # Friday -- shipping push
        return 1.15
    return 1.0


# ---------------------------------------------------------------------------
# Data generation functions
# ---------------------------------------------------------------------------

def generate_inventory_update(conn):
    """
    Simulate an inventory position change.
    Includes intentional quality issues.
    """
    wh_id = random.choice(list(WAREHOUSES.keys()))
    wh = WAREHOUSES[wh_id]

    if not should_generate_event(wh["region"]):
        return None

    product = random.choice(PRODUCTS)
    now = datetime.now(timezone.utc)
    local_time = now + timedelta(hours=wh["tz_offset"])

    # Decide which SKU format to use -- INTENTIONAL INCONSISTENCY (Nightmare #3)
    sku_choice = random.random()
    if sku_choice < 0.6:
        sku = product["sku"]  # Global SKU
    elif sku_choice < 0.8 and product["legacy_am"]:
        sku = product["legacy_am"]  # Americas legacy
    elif product["legacy_eu"]:
        sku = product["legacy_eu"]  # EU legacy
    else:
        sku = product["sku"]

    # Base quantity
    qty = random.randint(20, 800)

    # NIGHTMARE #1: Occasionally create phantom inventory (inflated numbers)
    if random.random() < 0.08:
        qty = int(qty * random.uniform(1.3, 1.8))  # Inflated by 30-80%

    # NIGHTMARE: Negative inventory (logic error)
    if random.random() < 0.02:
        qty = -random.randint(1, 25)

    reserved = random.randint(0, max(1, qty // 5)) if qty > 0 else 0
    available = max(0, qty - reserved)
    in_transit = random.randint(0, 200) if random.random() < 0.4 else 0

    # Unit of measure -- INTENTIONAL INCONSISTENCY (Nightmare #3)
    uom = product["uom"]
    if random.random() < 0.07:
        uom = random.choice(["CS", "PAL", "PK", "EACH", "UNIT"])  # Non-standard

    # Lot number -- NULL for 15% of perishables (Nightmare #7)
    lot = None
    if product["perishable"]:
        if random.random() > 0.15:
            lot = f"LOT-{now.strftime('%Y-%m')}-{random.randint(1000,9999)}"
    elif random.random() > 0.5:
        lot = f"LOT-{now.strftime('%Y-%m')}-{random.randint(1000,9999)}"

    # Storage zone -- INTENTIONAL non-standard codes
    if product["perishable"]:
        zone = random.choice(["CHILLED", "FROZEN", "KALT", "FROID"]) if random.random() < 0.15 else random.choice(["CHILLED", "FROZEN"])
    else:
        zone = random.choice(STORAGE_ZONE_DIRTY) if random.random() < 0.10 else "AMBIENT"

    # NIGHTMARE #5: Timestamp in local time WITHOUT timezone
    snapshot_ts = fmt_timestamp_local_no_tz(local_time)
    count_date = fmt_timestamp_local_no_tz(local_time - timedelta(days=random.randint(0, 7)))

    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO inventory_positions
                (location_id, sku, lot_number, quantity_on_hand, quantity_available,
                 quantity_reserved, quantity_in_transit, unit_of_measure,
                 storage_zone, last_count_date, snapshot_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING position_id
        """, (
            wh_id, sku, lot, qty, available, reserved, in_transit,
            uom, zone, count_date, snapshot_ts
        ))
        pid = cur.fetchone()[0]
    conn.commit()
    return {"type": "inventory", "id": pid, "warehouse": wh_id, "sku": sku, "qty": qty}


def generate_warehouse_event(conn):
    """
    Simulate a warehouse operation event (receive, pick, pack, ship, adjust, cycle count).
    """
    wh_id = random.choice(list(WAREHOUSES.keys()))
    wh = WAREHOUSES[wh_id]

    if not should_generate_event(wh["region"]):
        return None

    product = random.choice(PRODUCTS)
    now = datetime.now(timezone.utc)
    local_time = now + timedelta(hours=wh["tz_offset"])

    # Event type -- INTENTIONAL variant naming (simulating 2 WMS platforms)
    event_types_standard = ["RECEIVE", "PICK", "PACK", "SHIP", "ADJUST", "CYCLE_COUNT"]
    event_types_variant = ["RCV", "PCK", "PACK", "SHP", "ADJ", "CC"]  # Manhattan-style abbreviations
    event_types_verbose = ["INBOUND_RECEIPT", "ORDER_PICK", "PACK_STATION", "OUTBOUND_SHIP", "INVENTORY_ADJUST", "CYCLE_COUNT_AUDIT"]

    if wh["region"] == "APAC":
        event_type = random.choice(event_types_variant)  # APAC uses Manhattan (abbreviated)
    elif random.random() < 0.1:
        event_type = random.choice(event_types_verbose)  # Occasional verbose entries
    else:
        event_type = random.choice(event_types_standard)  # Standard Oracle WMS

    qty = random.randint(1, 100)
    lot = f"LOT-{now.strftime('%Y-%m')}-{random.randint(1000,9999)}" if product["perishable"] and random.random() > 0.15 else None

    # Bin format varies (Nightmare: inconsistent naming)
    location_bin = random.choice(BIN_FORMATS)()

    # Order ID -- NULL for 20% of SHIP events (broken linkage)
    order_id = None
    if event_type in ("SHIP", "SHP", "OUTBOUND_SHIP", "PICK", "PCK", "ORDER_PICK"):
        if random.random() > 0.20:
            order_id = f"WEB-{now.strftime('%Y-%m')}-{random.randint(100000, 999999):07d}"

    worker_id = f"WRK-{wh_id.split('-')[1]}-{random.randint(100,999):04d}"

    # Cycle count variance (only for cycle count events)
    variance = None
    if event_type in ("CYCLE_COUNT", "CC", "CYCLE_COUNT_AUDIT"):
        variance = random.choice([0, 0, 0, -random.randint(1, 30), random.randint(1, 10), -random.randint(1, 5)])

    # NIGHTMARE #5: Local time, no timezone
    event_ts = fmt_timestamp_local_no_tz(local_time)

    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO warehouse_events
                (warehouse_id, event_type, sku, quantity, lot_number,
                 location_bin, order_id, worker_id, cycle_count_variance, event_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING event_id
        """, (
            wh_id, event_type, product["sku"], qty, lot,
            location_bin, order_id, worker_id, variance, event_ts
        ))
        eid = cur.fetchone()[0]
    conn.commit()
    return {"type": "warehouse_event", "id": eid, "warehouse": wh_id, "event": event_type}


def generate_shipment(conn):
    """
    Simulate a shipment tracking event.
    Carriers use completely different status vocabularies, timestamp formats,
    and exception codes.
    """
    carrier_code = random.choice(list(CARRIERS.keys()))
    carrier = CARRIERS[carrier_code]
    now = datetime.now(timezone.utc)

    if not should_generate_event(random.choice(["EU", "AMER", "APAC", "LATAM"])):
        return None

    # Lifecycle stage
    lifecycle = random.choices(
        ["created", "pickup", "transit", "out", "delivered", "failed"],
        weights=[0.10, 0.10, 0.30, 0.15, 0.25, 0.10],
        k=1
    )[0]

    status = carrier["statuses"][lifecycle]

    # Tracking number format varies by carrier
    if carrier_code == "FEDEX":
        tracking = f"1Z{random.randint(100,999)}AA{random.randint(10000000,99999999)}"
    elif carrier_code == "DHL-EXPRESS":
        tracking = f"JD{random.randint(10000000000,99999999999)}"
    elif carrier_code == "DPD":
        tracking = f"DPD-DE-{now.strftime('%Y%m%d')}-{random.randint(1000,9999)}"
    elif carrier_code == "NINJAVAN":
        tracking = f"NV-SG-{now.strftime('%Y%m%d')}-{random.randint(1000,9999)}"
    elif carrier_code == "CORREIOS":
        tracking = f"COR-BR-{now.strftime('%Y%m%d')}-{random.randint(1000,9999)}"
    elif carrier_code == "LOCAL-LOS":
        tracking = None if random.random() < 0.4 else f"LOS-{random.randint(10000,99999)}"  # Often no tracking

    order_id = f"WEB-{now.strftime('%Y-%m')}-{random.randint(100000, 999999):07d}" if random.random() > 0.1 else None

    # NIGHTMARE #5 + #6: Timestamp format varies per carrier
    status_dt = format_carrier_timestamp(carrier_code, now)

    # Destination address with quality issues
    countries_clean = ["NL", "DE", "US", "SG", "BR", "GB", "NG", "JP", "AU", "FR"]
    countries_dirty = ["Netherlands", "Deutschland", "United States", "Singapore", "Brasil",
                       "Niederlande", "Allemagne", "USA", "Estados Unidos", "Singapur"]

    dest_country = random.choice(countries_clean) if random.random() > 0.25 else random.choice(countries_dirty)
    dest_city = fake.city()
    dest_addr = fake.street_address()

    # Estimated & actual delivery
    est_delivery = format_carrier_timestamp(carrier_code, now + timedelta(days=random.randint(1, 5)))
    actual_delivery = None
    if lifecycle == "delivered":
        if random.random() > 0.15:  # 15% of "delivered" have no actual_delivery timestamp!
            actual_delivery = format_carrier_timestamp(carrier_code, now)

    # Exception codes (in different languages)
    exception = None
    if lifecycle == "failed":
        exception = random.choice(carrier["exception_codes"])

    # Weight -- unit inconsistency
    weight_val = round(random.uniform(0.2, 25.0), 2) if random.random() > 0.2 else None
    weight_unit = carrier["weight_unit"]
    # Extra chaos: sometimes the unit is wrong or has case variation
    if weight_unit and random.random() < 0.1:
        weight_unit = random.choice(["kg", "KG", "Kg", "lbs", "LBS", "lb", None])

    delivery_attempts = None
    if lifecycle in ("delivered", "failed"):
        delivery_attempts = random.choices([1, 2, 3], weights=[0.7, 0.2, 0.1])[0]

    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO shipments
                (tracking_number, carrier_code, order_id, shipment_status,
                 status_datetime, origin_facility, destination_address,
                 destination_city, destination_country, estimated_delivery,
                 actual_delivery, delivery_attempts, exception_code,
                 weight_value, weight_unit)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING shipment_id
        """, (
            tracking, carrier_code, order_id, status,
            status_dt, random.choice(list(WAREHOUSES.keys())),
            dest_addr, dest_city, dest_country,
            est_delivery, actual_delivery, delivery_attempts,
            exception, weight_val, weight_unit
        ))
        sid = cur.fetchone()[0]
    conn.commit()
    return {"type": "shipment", "id": sid, "carrier": carrier_code, "status": status}


# ---------------------------------------------------------------------------
# Periodic quality degradation events (simulates Nightmare #4)
# ---------------------------------------------------------------------------

def maybe_inject_silent_failure(conn, cycle_count):
    """
    Every ~200 cycles, simulate a partial load by inserting a batch of
    warehouse events where 50% of records are missing (Nightmare #4).
    """
    if cycle_count % 200 != 0:
        return

    wh_id = "DC-RTD-01"  # Rotterdam -- the nightmare DC
    now = datetime.now(timezone.utc)
    local_time = now + timedelta(hours=1)
    print(f"\n  [!] Injecting PARTIAL LOAD for {wh_id} (Nightmare #4)")

    # Generate 20 events but only insert 10 (50% partial load)
    inserted = 0
    for i in range(20):
        if random.random() < 0.5:  # Skip 50%
            continue
        product = random.choice(PRODUCTS)
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO warehouse_events
                    (warehouse_id, event_type, sku, quantity, lot_number,
                     location_bin, order_id, worker_id, cycle_count_variance, event_timestamp)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                wh_id, "ADJUST", product["sku"], random.randint(-20, 20), None,
                random.choice(BIN_FORMATS)(), None, f"WRK-RTD-BATCH",
                None, fmt_timestamp_local_no_tz(local_time)
            ))
            inserted += 1
    conn.commit()
    print(f"  [!] Partial load complete: {inserted}/20 records inserted\n")


# ---------------------------------------------------------------------------
# Schema setup
# ---------------------------------------------------------------------------

SCHEMA_SQL = """
-- MCG WMS Database Schema
-- Intentional quality issues are documented in comments

CREATE TABLE IF NOT EXISTS inventory_positions (
    position_id         SERIAL PRIMARY KEY,
    location_id         VARCHAR(20) NOT NULL,
    sku                 VARCHAR(30) NOT NULL,
    lot_number          VARCHAR(30),              -- NULL for 15% of grocery items
    quantity_on_hand    INTEGER NOT NULL,          -- Can go negative (bug!)
    quantity_available  INTEGER,
    quantity_reserved   INTEGER DEFAULT 0,
    quantity_in_transit INTEGER DEFAULT 0,
    unit_of_measure     VARCHAR(10),              -- Inconsistent: EA, CS, PAL, EACH, UNIT
    storage_zone        VARCHAR(15),              -- Non-standard: KALT, FROID, AMB, FRZ
    last_count_date     TIMESTAMP WITHOUT TIME ZONE,  -- No timezone (Nightmare #5)
    snapshot_timestamp  TIMESTAMP WITHOUT TIME ZONE,  -- Local time, not UTC
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_events (
    event_id            SERIAL PRIMARY KEY,
    warehouse_id        VARCHAR(20) NOT NULL,
    event_type          VARCHAR(30) NOT NULL,     -- RECEIVE vs RCV vs INBOUND_RECEIPT
    sku                 VARCHAR(30) NOT NULL,
    quantity            INTEGER NOT NULL,
    lot_number          VARCHAR(30),
    location_bin        VARCHAR(20),              -- A-04-02-C vs A/04/02/C vs A.04.02.C
    order_id            VARCHAR(30),              -- NULL for 20% of SHIP events
    worker_id           VARCHAR(20),
    cycle_count_variance INTEGER,
    event_timestamp     TIMESTAMP WITHOUT TIME ZONE,  -- Local time, no timezone
    created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipments (
    shipment_id         SERIAL PRIMARY KEY,
    tracking_number     VARCHAR(40),              -- NULL for some carriers
    carrier_code        VARCHAR(20) NOT NULL,
    order_id            VARCHAR(30),
    shipment_status     VARCHAR(60) NOT NULL,     -- Carrier-specific: DELIVERED vs Zugestellt vs Completed
    status_datetime     VARCHAR(50),              -- STRING! Formats vary per carrier
    origin_facility     VARCHAR(20),
    destination_address TEXT,
    destination_city    VARCHAR(50),
    destination_country VARCHAR(50),              -- NL vs Netherlands vs Niederlande
    estimated_delivery  VARCHAR(50),
    actual_delivery     VARCHAR(50),              -- NULL even when delivered (15%)
    delivery_attempts   INTEGER,
    exception_code      VARCHAR(40),              -- Multi-language: ADDR_INVALID vs CEP_INVALIDO
    weight_value        DECIMAL(8,2),
    weight_unit         VARCHAR(5),               -- kg vs lbs vs KG vs lb vs NULL
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_inv_location_sku ON inventory_positions(location_id, sku);
CREATE INDEX IF NOT EXISTS idx_inv_snapshot ON inventory_positions(snapshot_timestamp);
CREATE INDEX IF NOT EXISTS idx_wh_events_warehouse ON warehouse_events(warehouse_id, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier ON shipments(carrier_code, shipment_status);
CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
"""


def setup_schema(conn):
    """Create tables if they don't exist."""
    with conn.cursor() as cur:
        cur.execute(SCHEMA_SQL)
    conn.commit()
    print("[OK] Schema created/verified")


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="MCG PostgreSQL Data Simulator")
    parser.add_argument("--host", default=os.environ.get("PG_HOST", "localhost"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PG_PORT", "5432")))
    parser.add_argument("--db", default=os.environ.get("PG_DB", "mcg_wms"))
    parser.add_argument("--user", default=os.environ.get("PG_USER", "postgres"))
    parser.add_argument("--password", default=os.environ.get("PG_PASSWORD", "postgres"))
    parser.add_argument("--interval", type=float, default=3.0, help="Seconds between event cycles")
    parser.add_argument("--setup-only", action="store_true", help="Create schema and exit")
    args = parser.parse_args()

    print("=" * 60)
    print("  Meridian Commerce Group -- PostgreSQL Simulator")
    print("=" * 60)
    print(f"  Host:     {args.host}:{args.port}")
    print(f"  Database: {args.db}")
    print(f"  Interval: {args.interval}s between cycles")
    print()

    conn = psycopg2.connect(
        host=args.host, port=args.port, dbname=args.db,
        user=args.user, password=args.password
    )
    conn.autocommit = False

    setup_schema(conn)

    if args.setup_only:
        print("[OK] Schema setup complete. Exiting.")
        conn.close()
        return

    print("[>>] Starting continuous data generation. Press Ctrl+C to stop.\n")

    cycle = 0
    stats = {"inventory": 0, "warehouse_event": 0, "shipment": 0}

    try:
        while True:
            cycle += 1
            season = weekly_seasonality()
            events_this_cycle = []

            # Generate 1-4 events per cycle, weighted by time of day and day of week
            num_events = max(1, int(random.uniform(1, 4) * season))

            for _ in range(num_events):
                event_type = random.choices(
                    ["inventory", "warehouse", "shipment"],
                    weights=[0.35, 0.40, 0.25],
                    k=1
                )[0]

                result = None
                if event_type == "inventory":
                    result = generate_inventory_update(conn)
                elif event_type == "warehouse":
                    result = generate_warehouse_event(conn)
                elif event_type == "shipment":
                    result = generate_shipment(conn)

                if result:
                    stats[result["type"]] += 1
                    events_this_cycle.append(result)

            # Periodic quality degradation injection
            maybe_inject_silent_failure(conn, cycle)

            # Status display
            total = sum(stats.values())
            if events_this_cycle:
                latest = events_this_cycle[-1]
                print(
                    f"  Cycle {cycle:>5d} | Total: {total:>6d} | "
                    f"Inv: {stats['inventory']:>5d} | WH: {stats['warehouse_event']:>5d} | "
                    f"Ship: {stats['shipment']:>5d} | "
                    f"Last: {latest['type'][:8]:>8s}",
                    end='\r'
                )

            time.sleep(args.interval)

    except KeyboardInterrupt:
        print(f"\n\n{'=' * 60}")
        print(f"  Simulator stopped after {cycle} cycles")
        print(f"  Total records generated:")
        print(f"    Inventory positions: {stats['inventory']:,}")
        print(f"    Warehouse events:    {stats['warehouse_event']:,}")
        print(f"    Shipments:           {stats['shipment']:,}")
        print(f"    TOTAL:               {sum(stats.values()):,}")
        print(f"{'=' * 60}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
