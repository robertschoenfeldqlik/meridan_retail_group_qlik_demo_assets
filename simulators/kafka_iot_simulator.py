"""
Meridian Commerce Group -- Kafka IoT Cold-Chain Simulator
=========================================================
Generates realistic IoT sensor data and carrier events for the MCG demo.

Produces messages to two Kafka topics:
  - mcg.iot.cold-chain    : Temperature/humidity sensor readings (~every 5s per sensor)
  - mcg.iot.carrier-events: Carrier status update events (~every 60s)

Data quality issues are INTENTIONALLY injected to demonstrate
Qlik Talend Cloud profiling, cleansing, and Trust Score.

Usage:
  pip install confluent-kafka

  # Continuous mode (default) — runs until Ctrl+C:
  python kafka_iot_simulator.py --bootstrap-servers localhost:9092

  # Scheduled mode — produce a batch, sleep, repeat (e.g., every 15 min):
  python kafka_iot_simulator.py --bootstrap-servers localhost:9092 --scheduled --interval 900

  # Single batch — produce one batch and exit (good for cron/Task Scheduler):
  python kafka_iot_simulator.py --bootstrap-servers localhost:9092 --batch-only --batch-duration 60

Press Ctrl+C to stop.
"""

import argparse
import json
import math
import os
import random
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone

try:
    from confluent_kafka import Producer
except ImportError:
    print("Install confluent-kafka:  pip install confluent-kafka")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Warehouses (origins) -- matches postgres_simulator
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

# Cold-chain routes with intentional exceedance rates
ROUTES = [
    {"id": "GRU-BA-001", "carrier": "TransFrio", "origin": "DC-GRU-01", "dest": "Buenos Aires", "product": "FRESH", "threshold_c": 8.0, "exceedance_rate": 0.088},
    {"id": "RTD-MUN-001", "carrier": "DPD", "origin": "DC-RTD-01", "dest": "Munich", "product": "DAIRY", "threshold_c": 4.0, "exceedance_rate": 0.02},
    {"id": "ATL-MIA-001", "carrier": "FedEx", "origin": "DC-ATL-01", "dest": "Miami", "product": "FROZEN", "threshold_c": -18.0, "exceedance_rate": 0.01},
    {"id": "SIN-TYO-001", "carrier": "NinjaVan", "origin": "DC-SIN-01", "dest": "Tokyo", "product": "FRESH", "threshold_c": 8.0, "exceedance_rate": 0.03},
    {"id": "LON-PAR-001", "carrier": "DPD", "origin": "DC-LON-01", "dest": "Paris", "product": "DAIRY", "threshold_c": 4.0, "exceedance_rate": 0.015},
    {"id": "LOS-ABJ-001", "carrier": "Correios", "origin": "DC-LOS-01", "dest": "Abidjan", "product": "FRESH", "threshold_c": 8.0, "exceedance_rate": 0.05},
]

# Carrier status vocabularies -- INTENTIONAL FORMAT CHAOS (Nightmare #6)
CARRIER_STATUSES = {
    "TransFrio": {
        "statuses": ["em_transito", "entregue", "tentativa_falha"],
        "weights": [0.50, 0.35, 0.15],
        "ts_format": "iso_offset_brt",
        "tracking_url_tpl": "https://transfrio.com.br/rastreio/{shipment_id}",
    },
    "DPD": {
        "statuses": ["In Transit", "Delivered", "Failed Attempt"],
        "weights": [0.45, 0.40, 0.15],
        "ts_format": "iso_offset_cet",
        "tracking_url_tpl": "https://tracking.dpd.de/status/{shipment_id}",
    },
    "FedEx": {
        "statuses": ["IT", "DL", "DE"],
        "weights": [0.50, 0.35, 0.15],
        "ts_format": "iso_utc",
        "tracking_url_tpl": "https://www.fedex.com/track?id={shipment_id}",
    },
    "NinjaVan": {
        "statuses": ["Pending Pickup", "Completed", "Arrived at Hub"],
        "weights": [0.30, 0.40, 0.30],
        "ts_format": "iso_offset_sgt",
        "tracking_url_tpl": "https://www.ninjavan.co/track/{shipment_id}",
    },
    "Correios": {
        "statuses": ["objeto postado", "saiu para entrega"],
        "weights": [0.55, 0.45],
        "ts_format": "brazilian",
        "tracking_url_tpl": "https://rastreamento.correios.com.br/{shipment_id}",
    },
    "J&T Express": {
        # Carrier data often MISSING entirely (~29% tracking availability)
        "statuses": ["Picked Up", "In Transit", "Delivered"],
        "weights": [0.25, 0.50, 0.25],
        "ts_format": "iso_utc",
        "tracking_url_tpl": "https://www.jtexpress.com/track/{shipment_id}",
        "tracking_availability": 0.29,
    },
}

# GPS coordinates for route waypoints (origin -> destination interpolation)
ROUTE_GPS = {
    "GRU-BA-001": {"origin": (-23.5505, -46.6333), "dest": (-34.6037, -58.3816)},
    "RTD-MUN-001": {"origin": (51.9244, 4.4777), "dest": (48.1351, 11.5820)},
    "ATL-MIA-001": {"origin": (33.7490, -84.3880), "dest": (25.7617, -80.1918)},
    "SIN-TYO-001": {"origin": (1.3521, 103.8198), "dest": (35.6762, 139.6503)},
    "LON-PAR-001": {"origin": (51.5074, -0.1278), "dest": (48.8566, 2.3522)},
    "LOS-ABJ-001": {"origin": (6.5244, 3.3792), "dest": (5.3600, -4.0083)},
}

# Normal operating temperature ranges by product type
TEMP_RANGES = {
    "FRESH": {"min": 2.0, "max": 6.0},
    "DAIRY": {"min": 1.0, "max": 4.0},
    "FROZEN": {"min": -22.0, "max": -18.0},
}

random.seed(42)


# ---------------------------------------------------------------------------
# Timestamp formatters -- THE NIGHTMARE (matches postgres_simulator style)
# ---------------------------------------------------------------------------

def fmt_timestamp_iso_utc(dt):
    """Clean UTC with Z"""
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def fmt_timestamp_bare(dt):
    """Nightmare #5: bare timestamp without timezone"""
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def fmt_timestamp_iso_offset(dt, offset_hours):
    """ISO with timezone offset"""
    sign = "+" if offset_hours >= 0 else "-"
    return dt.strftime(f"%Y-%m-%dT%H:%M:%S{sign}{abs(offset_hours):02d}:00")


def fmt_timestamp_brazilian(dt):
    """Brazilian format: DD/MM/YYYY HH:MM"""
    return dt.strftime("%d/%m/%Y %H:%M")


def format_carrier_event_timestamp(carrier_name, dt):
    """Format timestamp according to carrier's convention"""
    carrier = CARRIER_STATUSES[carrier_name]
    fmt = carrier["ts_format"]
    if fmt == "iso_utc":
        return fmt_timestamp_iso_utc(dt)
    elif fmt == "iso_offset_brt":
        return fmt_timestamp_iso_offset(dt, -3)
    elif fmt == "iso_offset_cet":
        return fmt_timestamp_iso_offset(dt, 1)
    elif fmt == "iso_offset_sgt":
        return fmt_timestamp_iso_offset(dt, 8)
    elif fmt == "brazilian":
        return fmt_timestamp_brazilian(dt)
    return fmt_timestamp_iso_utc(dt)


# ---------------------------------------------------------------------------
# Shipment lifecycle management
# ---------------------------------------------------------------------------

class ActiveShipment:
    """Represents a shipment currently in transit with IoT sensors."""

    def __init__(self, route):
        self.route = route
        now = datetime.now(timezone.utc)
        date_str = now.strftime("%Y%m%d")

        self.shipment_id = f"SHP-{route['id']}-{date_str}"
        self.sensor_id_base = f"SNS-{route['id']}"
        self.num_sensors = random.randint(1, 3)
        self.sensor_ids = [f"{self.sensor_id_base}-{chr(65 + i)}" for i in range(self.num_sensors)]
        self.created_at = now
        self.progress = 0.0  # 0.0 = origin, 1.0 = destination
        self.battery_pcts = {sid: random.randint(75, 100) for sid in self.sensor_ids}
        self.door_open = False
        self.completed = False
        # Duration in hours (realistic transit times)
        self.duration_hours = random.uniform(12, 72)
        # Lagos connectivity blackout state
        self.lagos_blackout = False
        self.lagos_blackout_until = None
        # Unique suffix to avoid shipment_id collisions
        self._suffix = random.randint(1000, 9999)
        self.shipment_id = f"SHP-{route['id']}-{date_str}-{self._suffix}"

    def advance(self, elapsed_seconds, speed):
        """Advance the shipment along its route."""
        hours_elapsed = (elapsed_seconds * speed) / 3600.0
        self.progress = min(1.0, self.progress + hours_elapsed / self.duration_hours)
        # Drain batteries
        for sid in self.sensor_ids:
            drain = random.uniform(0.01, 0.05) * speed
            self.battery_pcts[sid] = max(0, self.battery_pcts[sid] - drain)
        # Occasional door open events
        if random.random() < 0.02:
            self.door_open = not self.door_open
        # Complete when fully arrived
        if self.progress >= 1.0:
            self.completed = True

    def get_gps(self):
        """Interpolate GPS position along the route."""
        gps = ROUTE_GPS[self.route["id"]]
        lat = gps["origin"][0] + (gps["dest"][0] - gps["origin"][0]) * self.progress
        lon = gps["origin"][1] + (gps["dest"][1] - gps["origin"][1]) * self.progress
        # Add GPS jitter
        lat += random.uniform(-0.01, 0.01)
        lon += random.uniform(-0.01, 0.01)
        return round(lat, 4), round(lon, 4)


# ---------------------------------------------------------------------------
# Cold-chain message generation
# ---------------------------------------------------------------------------

def generate_cold_chain_reading(shipment, sensor_id):
    """
    Generate a single IoT sensor reading for a cold-chain shipment.
    Includes intentional data quality issues.
    """
    route = shipment.route
    now = datetime.now(timezone.utc)
    temp_range = TEMP_RANGES[route["product"]]

    # Base temperature -- normal operating range
    base_temp = random.uniform(temp_range["min"], temp_range["max"])

    # NIGHTMARE #6: Exceedance for specific routes (TransFrio fleet change)
    if random.random() < route["exceedance_rate"]:
        if route["product"] == "FRESH":
            base_temp = random.uniform(8.0, 14.0)  # Above threshold
        elif route["product"] == "DAIRY":
            base_temp = random.uniform(4.0, 9.0)
        elif route["product"] == "FROZEN":
            base_temp = random.uniform(-18.0, -10.0)

    temperature = round(base_temp + random.uniform(-0.3, 0.3), 1)
    humidity = round(random.uniform(65.0, 95.0), 1)
    gps_lat, gps_lon = shipment.get_gps()

    # Build the reading
    reading = {
        "sensor_id": sensor_id,
        "shipment_id": shipment.shipment_id,
        "route": route["id"],
        "carrier": route["carrier"],
        "product_type": route["product"],
        "temperature_celsius": temperature,
        "humidity_pct": humidity,
        "timestamp": fmt_timestamp_iso_utc(now),
        "gps_lat": gps_lat,
        "gps_lon": gps_lon,
        "battery_pct": int(shipment.battery_pcts.get(sensor_id, 50)),
        "door_open": shipment.door_open,
    }

    # --- INTENTIONAL DATA QUALITY ISSUES ---

    # ~5% of readings: temperature_unit "F" instead of Celsius (Nightmare #5)
    if random.random() < 0.05:
        reading["temperature_unit"] = "F"
        # Actually convert to Fahrenheit so the number looks plausible
        reading["temperature_celsius"] = round(temperature * 9.0 / 5.0 + 32.0, 1)

    # ~3% of readings: bare timestamp without timezone
    if random.random() < 0.03:
        reading["timestamp"] = fmt_timestamp_bare(now)

    # ~2% of readings: Lagos sensors have 6-hour connectivity blackout
    if route["id"] == "LOS-ABJ-001" and random.random() < 0.02:
        if not shipment.lagos_blackout:
            shipment.lagos_blackout = True
            shipment.lagos_blackout_until = now + timedelta(hours=6)
    if shipment.lagos_blackout:
        if now < (shipment.lagos_blackout_until or now):
            return None  # Drop the reading (connectivity blackout)
        else:
            shipment.lagos_blackout = False
            shipment.lagos_blackout_until = None

    # ~1% of readings: sensor_id is null or empty (sensor malfunction)
    if random.random() < 0.01:
        reading["sensor_id"] = random.choice([None, "", None])

    return reading


def maybe_duplicate_reading(reading):
    """
    ~2% of readings: duplicate messages (Kafka at-least-once delivery).
    Returns a list of 1 or 2 identical readings.
    """
    if reading is None:
        return []
    if random.random() < 0.02:
        return [reading, reading]
    return [reading]


# ---------------------------------------------------------------------------
# Carrier event message generation
# ---------------------------------------------------------------------------

def generate_carrier_event(shipment):
    """
    Generate a carrier status update event.
    Each carrier uses DIFFERENT status names -- INTENTIONAL (Nightmare #6).
    """
    route = shipment.route
    carrier_name = route["carrier"]
    now = datetime.now(timezone.utc)

    # J&T Express: carrier status data often MISSING entirely (~29% tracking)
    carrier_cfg = CARRIER_STATUSES.get(carrier_name)
    if carrier_cfg is None:
        # Fallback -- should not happen with defined routes, but be safe
        return None
    tracking_avail = carrier_cfg.get("tracking_availability", 1.0)
    if random.random() > tracking_avail:
        return None  # Data missing

    # Choose a status based on carrier-specific vocabulary
    status_raw = random.choices(
        carrier_cfg["statuses"],
        weights=carrier_cfg["weights"],
        k=1
    )[0]

    # Format timestamp per carrier convention
    status_timestamp = format_carrier_event_timestamp(carrier_name, now)

    # ~10% of events: timestamp in non-standard format (e.g., DD/MM/YYYY from Correios)
    if random.random() < 0.10:
        status_timestamp = fmt_timestamp_brazilian(now)

    # Weight -- with intentional unit chaos
    weight_kg = round(random.uniform(50.0, 800.0), 1)
    # ~5% of events: weight in pounds instead of kg (no unit indicator)
    weight_is_lbs = False
    if random.random() < 0.05:
        weight_kg = round(weight_kg * 2.20462, 1)  # Convert to pounds silently
        weight_is_lbs = True

    pieces = random.randint(4, 48)

    tracking_url = carrier_cfg["tracking_url_tpl"].format(shipment_id=shipment.shipment_id)

    event_id = f"EVT-{now.strftime('%Y%m%d-%H%M%S')}-{random.randint(100, 999)}"

    event = {
        "event_id": event_id,
        "shipment_id": shipment.shipment_id,
        "carrier": carrier_name,
        "status_raw": status_raw,
        "status_timestamp": status_timestamp,
        "origin": route["origin"],
        "destination": route["dest"],
        "weight_kg": weight_kg,
        "pieces": pieces,
        "tracking_url": tracking_url,
    }

    return event


# ---------------------------------------------------------------------------
# Kafka delivery callback
# ---------------------------------------------------------------------------

_delivery_errors = 0
_delivery_success = 0


def delivery_callback(err, msg):
    """Kafka producer delivery report callback."""
    global _delivery_errors, _delivery_success
    if err is not None:
        _delivery_errors += 1
    else:
        _delivery_success += 1


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main():
    global _delivery_errors, _delivery_success

    parser = argparse.ArgumentParser(description="MCG Kafka IoT Cold-Chain Simulator")
    parser.add_argument("--bootstrap-servers", default=os.environ.get("KAFKA_BOOTSTRAP", "localhost:9092"))
    parser.add_argument("--speed", type=float, default=1.0, help="Multiplier for message rate (default: 1.0)")
    parser.add_argument("--cold-chain-interval", type=float, default=5.0, help="Seconds between cold chain readings per sensor (default: 5)")
    parser.add_argument("--carrier-interval", type=float, default=60.0, help="Seconds between carrier events (default: 60)")
    parser.add_argument("--security-protocol", default="PLAINTEXT", choices=["PLAINTEXT", "SASL_PLAINTEXT"], help="Kafka security protocol")
    parser.add_argument("--sasl-username", default=os.environ.get("KAFKA_SASL_USER", None))
    parser.add_argument("--sasl-password", default=os.environ.get("KAFKA_SASL_PASS", None))
    parser.add_argument("--scheduled", action="store_true",
                        help="Run in scheduled mode: produce a batch, sleep for --interval seconds, repeat")
    parser.add_argument("--interval", type=int, default=900,
                        help="Seconds between batches in scheduled mode (default: 900 = 15 min)")
    parser.add_argument("--batch-duration", type=int, default=60,
                        help="Seconds to produce messages per batch in scheduled/batch-only mode (default: 60)")
    parser.add_argument("--batch-only", action="store_true",
                        help="Produce a single batch for --batch-duration seconds, then exit")
    args = parser.parse_args()

    # Topic names
    TOPIC_COLD_CHAIN = "mcg.iot.cold-chain"
    TOPIC_CARRIER_EVENTS = "mcg.iot.carrier-events"

    print("=" * 64)
    print("  Meridian Commerce Group -- Kafka IoT Cold-Chain Simulator")
    print("=" * 64)
    # Determine run mode
    if args.batch_only:
        run_mode = "batch-only"
    elif args.scheduled:
        run_mode = "scheduled"
    else:
        run_mode = "continuous"

    print(f"  Bootstrap:        {args.bootstrap_servers}")
    print(f"  Security:         {args.security_protocol}")
    print(f"  Speed multiplier: {args.speed}x")
    print(f"  Run mode:         {run_mode}")
    if run_mode == "scheduled":
        print(f"  Batch duration:   {args.batch_duration}s every {args.interval}s ({args.interval // 60} min)")
    elif run_mode == "batch-only":
        print(f"  Batch duration:   {args.batch_duration}s (single batch, then exit)")
    print(f"  Cold-chain topic: {TOPIC_COLD_CHAIN}  (interval: {args.cold_chain_interval}s)")
    print(f"  Carrier topic:    {TOPIC_CARRIER_EVENTS}  (interval: {args.carrier_interval}s)")
    print(f"  Routes:           {len(ROUTES)}")
    print()

    # Kafka producer configuration
    producer_config = {
        "bootstrap.servers": args.bootstrap_servers,
        "client.id": "mcg-iot-simulator",
        "acks": "all",
        "retries": 3,
        "retry.backoff.ms": 500,
    }
    if args.security_protocol == "SASL_PLAINTEXT":
        if not args.sasl_username or not args.sasl_password:
            print("[ERROR] SASL_PLAINTEXT requires --sasl-username and --sasl-password")
            sys.exit(1)
        producer_config["security.protocol"] = "SASL_PLAINTEXT"
        producer_config["sasl.mechanisms"] = "PLAIN"
        producer_config["sasl.username"] = args.sasl_username
        producer_config["sasl.password"] = args.sasl_password
    else:
        producer_config["security.protocol"] = "PLAINTEXT"

    producer = Producer(producer_config)

    # --- Create initial active shipments (6-10 concurrent) ---
    num_initial = random.randint(6, 10)
    active_shipments = []
    for i in range(num_initial):
        route = ROUTES[i % len(ROUTES)]
        shipment = ActiveShipment(route)
        # Randomize initial progress so they're not all at origin
        shipment.progress = random.uniform(0.0, 0.7)
        active_shipments.append(shipment)

    print(f"  Active shipments: {len(active_shipments)}")
    for s in active_shipments:
        print(f"    {s.shipment_id} | {s.route['id']} | {s.route['carrier']} | sensors: {len(s.sensor_ids)} | progress: {s.progress:.0%}")
    print()
    if run_mode == "continuous":
        print("[>>] Starting continuous data generation. Press Ctrl+C to stop.\n")
    elif run_mode == "scheduled":
        print(f"[>>] Scheduled mode: {args.batch_duration}s batch every {args.interval}s. Press Ctrl+C to stop.\n")
    else:
        print(f"[>>] Batch mode: producing for {args.batch_duration}s, then exiting.\n")

    # Timing state
    last_cold_chain_time = time.time()
    last_carrier_time = time.time()
    last_stats_time = time.time()
    start_time = time.time()

    # Statistics
    stats = {
        "cold_chain_produced": 0,
        "cold_chain_duplicates": 0,
        "cold_chain_dropped": 0,
        "carrier_events_produced": 0,
        "carrier_events_missing": 0,
        "shipments_completed": 0,
        "shipments_created": 0,
        "delivery_errors": 0,
        "batches_completed": 0,
    }
    stats["shipments_created"] = num_initial

    cycle = 0
    batch_start = time.time()

    def _run_one_cycle():
        """Run a single production cycle. Returns False if batch is done."""
        nonlocal cycle, last_cold_chain_time, last_carrier_time, last_stats_time, batch_start

        cycle += 1
        now = time.time()
        effective_cold_interval = args.cold_chain_interval / args.speed
        effective_carrier_interval = args.carrier_interval / args.speed

        # Check batch duration limit (for scheduled / batch-only modes)
        if run_mode in ("scheduled", "batch-only"):
            if now - batch_start >= args.batch_duration:
                return False  # batch complete

        # --- Cold-chain sensor readings ---
        if now - last_cold_chain_time >= effective_cold_interval:
            last_cold_chain_time = now
            for shipment in active_shipments:
                if shipment.completed:
                    continue
                shipment.advance(args.cold_chain_interval, args.speed)
                for sensor_id in shipment.sensor_ids:
                    reading = generate_cold_chain_reading(shipment, sensor_id)
                    if reading is None:
                        stats["cold_chain_dropped"] += 1
                        continue
                    messages = maybe_duplicate_reading(reading)
                    if len(messages) > 1:
                        stats["cold_chain_duplicates"] += 1
                    for msg in messages:
                        key = (msg.get("sensor_id") or "unknown").encode("utf-8")
                        value = json.dumps(msg).encode("utf-8")
                        producer.produce(
                            TOPIC_COLD_CHAIN,
                            key=key,
                            value=value,
                            callback=delivery_callback,
                        )
                        stats["cold_chain_produced"] += 1

        # --- Carrier events ---
        if now - last_carrier_time >= effective_carrier_interval:
            last_carrier_time = now
            num_events = random.randint(1, min(3, len(active_shipments)))
            active_only = [s for s in active_shipments if not s.completed]
            chosen = random.sample(active_only, k=min(num_events, len(active_only)))
            for shipment in chosen:
                event = generate_carrier_event(shipment)
                if event is None:
                    stats["carrier_events_missing"] += 1
                    continue
                key = event["shipment_id"].encode("utf-8")
                value = json.dumps(event).encode("utf-8")
                producer.produce(
                    TOPIC_CARRIER_EVENTS,
                    key=key,
                    value=value,
                    callback=delivery_callback,
                )
                stats["carrier_events_produced"] += 1

        # --- Flush pending messages ---
        producer.poll(0)

        # --- Shipment lifecycle ---
        completed_ids = []
        for shipment in active_shipments:
            if shipment.completed:
                completed_ids.append(shipment.shipment_id)
                stats["shipments_completed"] += 1
        if completed_ids:
            active_shipments[:] = [s for s in active_shipments if not s.completed]
            for cid in completed_ids:
                print(f"  [OK] Shipment completed: {cid}")
            for _ in completed_ids:
                route = random.choice(ROUTES)
                new_shipment = ActiveShipment(route)
                active_shipments.append(new_shipment)
                stats["shipments_created"] += 1
                print(f"  [>>] New shipment: {new_shipment.shipment_id} | {route['id']} | {route['carrier']}")

        # --- Periodic stats display (every 60 seconds) ---
        if now - last_stats_time >= 60.0:
            last_stats_time = now
            elapsed = now - start_time
            elapsed_min = elapsed / 60.0
            total_msgs = stats["cold_chain_produced"] + stats["carrier_events_produced"]
            print(
                f"\n  --- Stats @ {elapsed_min:.1f} min ---"
                f"  Cold-chain: {stats['cold_chain_produced']:,}"
                f"  (dupes: {stats['cold_chain_duplicates']:,}, dropped: {stats['cold_chain_dropped']:,})"
                f"  | Carrier events: {stats['carrier_events_produced']:,}"
                f"  (missing: {stats['carrier_events_missing']:,})"
                f"  | Shipments active: {len([s for s in active_shipments if not s.completed])}"
                f"  (created: {stats['shipments_created']:,}, completed: {stats['shipments_completed']:,})"
                f"  | Kafka errors: {_delivery_errors}"
                f"  | Total msgs: {total_msgs:,}"
            )

        # Status line
        total_msgs = stats["cold_chain_produced"] + stats["carrier_events_produced"]
        active_count = len([s for s in active_shipments if not s.completed])
        print(
            f"  Cycle {cycle:>6d} | Msgs: {total_msgs:>7,} | "
            f"CC: {stats['cold_chain_produced']:>6,} | CE: {stats['carrier_events_produced']:>5,} | "
            f"Active: {active_count} | Errs: {_delivery_errors}",
            end="\r"
        )

        time.sleep(min(effective_cold_interval, effective_carrier_interval, 1.0))
        return True  # continue

    try:
        if run_mode == "continuous":
            # --- Continuous mode: run until Ctrl+C ---
            while True:
                _run_one_cycle()

        elif run_mode == "batch-only":
            # --- Batch mode: produce for batch_duration, then exit ---
            batch_start = time.time()
            while _run_one_cycle():
                pass
            producer.flush(timeout=10)
            stats["batches_completed"] += 1
            total_msgs = stats["cold_chain_produced"] + stats["carrier_events_produced"]
            print(f"\n  [OK] Batch complete: {total_msgs:,} messages in {args.batch_duration}s")

        elif run_mode == "scheduled":
            # --- Scheduled mode: produce batch, sleep, repeat ---
            batch_num = 0
            while True:
                batch_num += 1
                batch_start = time.time()
                print(f"\n  === Batch {batch_num} started at {datetime.now(timezone.utc).strftime('%H:%M:%S UTC')} ===")

                while _run_one_cycle():
                    pass

                producer.flush(timeout=10)
                stats["batches_completed"] += 1
                total_msgs = stats["cold_chain_produced"] + stats["carrier_events_produced"]
                print(f"\n  [OK] Batch {batch_num} complete: {total_msgs:,} total messages so far")

                # Sleep until next interval
                sleep_seconds = args.interval - args.batch_duration
                if sleep_seconds > 0:
                    next_run = datetime.now(timezone.utc) + timedelta(seconds=sleep_seconds)
                    print(f"  [..] Sleeping {sleep_seconds}s — next batch at {next_run.strftime('%H:%M:%S UTC')}")
                    time.sleep(sleep_seconds)

    except KeyboardInterrupt:
        print("\n\n  Flushing remaining Kafka messages...")
        producer.flush(timeout=10)

    # --- Final summary ---
    elapsed = time.time() - start_time
    elapsed_min = elapsed / 60.0
    total_msgs = stats["cold_chain_produced"] + stats["carrier_events_produced"]

    print(f"\n{'=' * 64}")
    print(f"  Simulator stopped after {cycle} cycles ({elapsed_min:.1f} minutes)")
    if stats["batches_completed"] > 0:
        print(f"  Batches completed:       {stats['batches_completed']}")
    print(f"  Messages produced:")
    print(f"    Cold-chain readings:   {stats['cold_chain_produced']:,}")
    print(f"      Duplicates injected: {stats['cold_chain_duplicates']:,}")
    print(f"      Dropped (blackout):  {stats['cold_chain_dropped']:,}")
    print(f"    Carrier events:        {stats['carrier_events_produced']:,}")
    print(f"      Missing (carrier):   {stats['carrier_events_missing']:,}")
    print(f"    TOTAL:                 {total_msgs:,}")
    print(f"  Shipment lifecycle:")
    print(f"    Created:               {stats['shipments_created']:,}")
    print(f"    Completed:             {stats['shipments_completed']:,}")
    print(f"  Kafka delivery:")
    print(f"    Successful:            {_delivery_success:,}")
    print(f"    Errors:                {_delivery_errors:,}")
    print(f"{'=' * 64}")


if __name__ == "__main__":
    main()
