#!/usr/bin/env python3
"""
mysql_crm_simulator.py — Meridian CRM Data Simulator
=====================================================
Continuously generates CRM activity in the MySQL database that Qlik lands
over log-based CDC: new contacts and orders, product-master additions, and —
unlike the append-only feed this replaced — genuine UPDATEs and DELETEs.

That last part is the point. A change-data-capture demo whose change stream
contains nothing but inserts is indistinguishable from an append, and the
binlog shows it. Three mutation streams run alongside the inserts:

  1. Order lifecycle    PROCESSING -> SHIPPED -> IN_TRANSIT -> DELIVERED
                        or DELIVERY_FAILED, one hop per pass. Tracking numbers
                        appear at SHIPPED, delivery dates at DELIVERED.
  2. Address correction A dirty address variant is rewritten to the clean
                        spelling of the same real address — Nightmare #2
                        resolving live, with address_quality_score moving
                        in the silver layer as it happens.
  3. Order deletion     Rare (about 1 pass in 200), old orders only. Contacts
                        and products are never deleted: that would orphan the
                        joins the silver layer is built on.

Activity is shaped by time of day and day of week so the feed looks organic
rather than metronomic.

Usage:
    python mysql_crm_simulator.py --host localhost --port 3307 \\
        --db mcg_crm --user qlik_cdc --password secret --interval 10

Environment variables (shared with seed_data.py and docker-compose):
    MYSQL_HOST, MYSQL_PORT, MYSQL_DB, MYSQL_USER, MYSQL_PASSWORD
"""

import argparse
import os
import random
import sys
import time
from datetime import datetime, timedelta, timezone

try:
    import pymysql
except ImportError:
    print("Install PyMySQL:  pip install PyMySQL")
    sys.exit(1)

from mcg_reference_data import (
    ADDRESS_PERSONAS,
    CRM_CARRIERS,
    CRM_PRODUCT_TEMPLATES,
    FULFILLMENT_METHODS,
    GERMAN_NAME_RATE,
    LATE_DELIVERY_RATE,
    MISSING_TRACKING_RATE,
    NEXT_DAY_PROMISE_RATE,
    ORDER_TRANSITIONS,
    WISMO_RATE,
    mailing_street,
    new_id,
    supplier_spelling,
)


# A carriage return keeps the status line in place on a terminal, but container
# log drivers only emit on a newline — so under `podman logs` the counters never
# appear at all and the simulator looks dead. Redraw in place only when stdout
# really is a TTY.
STATUS_END = "\r" if sys.stdout.isatty() else "\n"


# ---------------------------------------------------------------------------
#  Organic pattern helpers
# ---------------------------------------------------------------------------

def business_hours_weight():
    """Weight activity based on global business hours (EU/US overlap is peak)."""
    hour = datetime.now(timezone.utc).hour
    if 8 <= hour <= 10:    return 0.6   # EU morning
    elif 10 <= hour <= 14: return 0.9   # EU peak
    elif 14 <= hour <= 17: return 1.0   # EU + US overlap (busiest)
    elif 17 <= hour <= 22: return 0.7   # US afternoon/evening
    elif 22 <= hour <= 23: return 0.3   # US west coast
    else:                  return 0.15  # Overnight


def day_of_week_weight():
    """Less activity on weekends."""
    day = datetime.now(timezone.utc).weekday()
    if day >= 5: return 0.3
    if day == 0: return 1.1  # Monday catch-up
    if day == 4: return 1.2  # Friday push
    return 1.0


# ---------------------------------------------------------------------------
#  Inserts
# ---------------------------------------------------------------------------

class Sequence:
    """Mints record ids that cannot collide with anything already in the table.

    The cycle counter is NOT usable as an id suffix. It restarts at 1 every
    time the container restarts, and the seeder independently numbers its own
    600 orders from 0 in the same YYYY-MM namespace -- so a fresh simulator
    walks straight into "Duplicate entry 'WEB-2026-09-000005' for key
    crm_orders.PRIMARY" and silently drops those orders on the floor.

    Instead, read the highest suffix already present once at startup and
    continue above it. Survives restarts, and never overlaps the seeder.
    """

    def __init__(self, cur):
        cur.execute(
            "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(order_id, '-', -1) AS UNSIGNED)), 0)"
            " FROM crm_orders"
        )
        self.order_n = int(cur.fetchone()[0])

        # Product SKUs are "<template sku>-<n>"; the template part itself
        # contains hyphens, so take the trailing numeric segment the same way.
        cur.execute(
            "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(sku, '-', -1) AS UNSIGNED)), 0)"
            " FROM crm_products"
        )
        self.product_n = int(cur.fetchone()[0])

    def next_order(self):
        self.order_n += 1
        return self.order_n

    def next_product(self):
        self.product_n += 1
        return self.product_n


def create_contact(cur, unique_suffix):
    """Insert a Contact with intentional address quality issues (Nightmare #2)."""
    persona = random.choice(ADDRESS_PERSONAS)
    v = random.choice(persona["variants"])
    contact_id = new_id("003")

    cur.execute(
        """
        INSERT INTO crm_contacts
          (contact_id, first_name, last_name, email, phone,
           mailing_street, mailing_city, mailing_state,
           mailing_postal_code, mailing_country)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            contact_id,
            v["first"],
            # Suffixed so near-duplicates stay distinguishable while sharing
            # an address — which is exactly the defect being demonstrated.
            f"{v['last']}_{unique_suffix}",
            v["email"].replace("@", f".{unique_suffix}@"),
            v["phone"],
            mailing_street(v),
            v["city"],
            v["state"],      # genuinely None for city-states — keep it None
            v["postal"],
            v["country"],
        ),
    )
    return contact_id


def create_order(cur, contact_id, seq_n):
    """Insert an order at the START of its lifecycle.

    Orders are born PROCESSING and walked forward by advance_orders(). The
    seeder creates history with a spread of terminal states; the live feed
    creates motion, which is what puts UPDATEs in the binlog.
    """
    now = datetime.now(timezone.utc)
    product = random.choice(CRM_PRODUCT_TEMPLATES)
    carrier = random.choice(CRM_CARRIERS)
    method  = random.choice(FULFILLMENT_METHODS)

    if random.random() < NEXT_DAY_PROMISE_RATE:
        promised = now + timedelta(days=1)          # unrealistic next-day promise
    else:
        promised = now + timedelta(days=random.randint(2, 7))

    order_id = f"WEB-{now.strftime('%Y-%m')}-{seq_n:06d}"

    cur.execute(
        """
        INSERT INTO crm_orders
          (order_id, contact_id, order_date, sku, product_name,
           fulfillment_method, promised_delivery, actual_delivery,
           carrier, tracking_number, order_status, wismo_flag)
        VALUES (%s, %s, %s, %s, %s, %s, %s, NULL, %s, NULL, 'PROCESSING', %s)
        """,
        (
            order_id,
            contact_id,
            now.strftime("%Y-%m-%d %H:%M:%S"),
            product["sku"],
            product["name"],
            method,
            promised.strftime("%Y-%m-%d"),
            carrier,
            1 if random.random() < WISMO_RATE else 0,
        ),
    )
    return order_id


def create_product(cur, seq_n):
    """Insert a product-master row with its quality defects intact (Nightmare #3)."""
    t = random.choice(CRM_PRODUCT_TEMPLATES)
    name = t["name"]
    if random.random() < GERMAN_NAME_RATE:
        name = t.get("name_de", t["name"])

    sku = f"{t['sku']}-{seq_n:04d}"
    cur.execute(
        """
        INSERT INTO crm_products
          (sku, legacy_sku_americas, legacy_sku_eu, product_name,
           category_l1, category_l2, category_l3, weight_kg,
           country_of_origin, supplier_name)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            sku,
            t.get("sku_am"),
            t.get("sku_eu"),
            name,
            t["cat1"],
            t["cat2"],
            t.get("cat3"),
            # None stays None and 0.0 stays 0.0 — different defects, both real.
            t["weight"],
            t.get("origin"),
            supplier_spelling(t["supplier"]),
        ),
    )
    return sku


# ---------------------------------------------------------------------------
#  Mutations — the reason this feed is worth capturing
# ---------------------------------------------------------------------------

def advance_orders(cur, batch=3):
    """Move a few in-flight orders one step along their lifecycle.

    Picks the oldest orders that have not reached a terminal state, so the
    backlog drains in roughly the order it was created rather than a random
    order jittering forever.
    """
    cur.execute(
        """
        SELECT order_id, order_status, carrier, promised_delivery
        FROM crm_orders
        WHERE order_status IN ('PROCESSING', 'SHIPPED', 'IN_TRANSIT')
        ORDER BY last_modified_date ASC
        LIMIT %s
        """,
        (batch,),
    )
    rows = cur.fetchall()
    updated = 0

    for order_id, status, carrier, promised in rows:
        nxt = random.choice(ORDER_TRANSITIONS[status])

        sets = ["order_status = %s"]
        vals = [nxt]

        if nxt == "SHIPPED":
            # The smaller carriers return no tracking at all, so a share of
            # orders ship without one and never gain it.
            if random.random() > MISSING_TRACKING_RATE:
                sets.append("tracking_number = %s")
                vals.append(f"{(carrier or 'UNK')[:3]}-{random.randint(1000000, 9999999)}")

        if nxt == "DELIVERED":
            base = promised or datetime.now(timezone.utc).date()
            if random.random() > LATE_DELIVERY_RATE:
                actual = base - timedelta(days=random.randint(0, 2))
            else:
                actual = base + timedelta(days=random.randint(1, 5))   # SLA breach
            sets.append("actual_delivery = %s")
            vals.append(actual.strftime("%Y-%m-%d"))

        vals.append(order_id)
        cur.execute(f"UPDATE crm_orders SET {', '.join(sets)} WHERE order_id = %s", vals)
        updated += 1

    return updated


def correct_address(cur):
    """Rewrite one dirty address to the clean spelling of the same address.

    variants[0] of each persona is the canonical form. This finds a contact
    holding a degraded variant and repairs it in place, which is Nightmare #2
    being resolved on camera — the row's address_quality_score rises and the
    change lands in the binlog as an UPDATE, not an insert.
    """
    persona = random.choice(ADDRESS_PERSONAS)
    clean = persona["variants"][0]
    dirty_variants = persona["variants"][1:]
    if not dirty_variants:
        return 0

    dirty = random.choice(dirty_variants)

    # Match on the dirty street text: it is the field that differs most
    # reliably between variants of the same address.
    cur.execute(
        """
        SELECT contact_id FROM crm_contacts
        WHERE mailing_street LIKE %s
        ORDER BY RAND() LIMIT 1
        """,
        (f"{dirty['street']}%",),
    )
    row = cur.fetchone()
    if not row:
        return 0

    cur.execute(
        """
        UPDATE crm_contacts
        SET mailing_street = %s,
            mailing_city = %s,
            mailing_state = %s,
            mailing_postal_code = %s,
            mailing_country = %s
        WHERE contact_id = %s
        """,
        (
            mailing_street(clean),
            clean["city"],
            clean["state"],
            clean["postal"],
            clean["country"],
            row[0],
        ),
    )
    return 1


def delete_stale_order(cur):
    """Delete one old delivered order — a retention purge or a test order.

    Orders only. Deleting a contact or a product would orphan the joins the
    silver layer depends on and break the demo for no gain.
    """
    cur.execute(
        """
        SELECT order_id FROM crm_orders
        WHERE order_status IN ('DELIVERED', 'DELIVERY_FAILED')
          AND order_date < (NOW() - INTERVAL 60 DAY)
        ORDER BY order_date ASC LIMIT 1
        """
    )
    row = cur.fetchone()
    if not row:
        return 0
    cur.execute("DELETE FROM crm_orders WHERE order_id = %s", (row[0],))
    return 1


# ---------------------------------------------------------------------------
#  Main
# ---------------------------------------------------------------------------

def connect(args):
    """Open a connection, waiting for the database container to come up."""
    max_attempts = 10
    for attempt in range(1, max_attempts + 1):
        try:
            return pymysql.connect(
                host=args.host, port=args.port, user=args.user,
                password=args.password, database=args.db,
                charset="utf8mb4", autocommit=True,
            )
        except pymysql.err.OperationalError as e:
            if attempt == max_attempts:
                raise
            wait = min(2 * attempt, 15)
            print(f"  MySQL not ready yet (attempt {attempt}/{max_attempts}): {e}")
            print(f"  Retrying in {wait}s...")
            time.sleep(wait)


def main():
    parser = argparse.ArgumentParser(description="Meridian CRM Data Simulator (MySQL)")
    parser.add_argument("--host", default=os.environ.get("MYSQL_HOST", "localhost"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("MYSQL_PORT", "3307")))
    parser.add_argument("--db", default=os.environ.get("MYSQL_DB", "mcg_crm"))
    parser.add_argument("--user", default=os.environ.get("MYSQL_USER", "root"))
    parser.add_argument("--password", default=os.environ.get("MYSQL_PASSWORD", ""))
    parser.add_argument("--interval", type=float, default=10.0, help="Seconds between event cycles")
    parser.add_argument("--no-mutations", action="store_true",
                        help="Insert only — no UPDATEs or DELETEs (not recommended: "
                             "it makes the change stream indistinguishable from an append)")
    args = parser.parse_args()

    print("=" * 60)
    print("  Meridian Commerce Group -- CRM Simulator (MySQL)")
    print("=" * 60)
    print(f"  Host:     {args.host}:{args.port}/{args.db}")
    print(f"  User:     {args.user}")
    print(f"  Interval: {args.interval}s between cycles")
    print(f"  Mutations:{' DISABLED' if args.no_mutations else ' enabled (updates + deletes)'}")
    print()

    conn = connect(args)
    print(f"[OK] Connected to MySQL at {args.host}:{args.port}\n")
    print("[>>] Starting continuous data generation. Press Ctrl+C to stop.\n")

    cycle = 0
    stats = {"contacts": 0, "orders": 0, "products": 0,
             "updates": 0, "deletes": 0, "errors": 0}
    contact_ids = []

    # Ids continue above whatever is already in the tables, so a restart does
    # not replay the suffixes it used last time and the seeder's own 600
    # orders are never re-minted.
    with conn.cursor() as cur:
        seq = Sequence(cur)
    print(f"[OK] Id sequence continues from order #{seq.order_n}, product #{seq.product_n}\n")

    try:
        while True:
            cycle += 1
            combined_weight = business_hours_weight() * day_of_week_weight()

            # Skip some cycles during quiet periods.
            if random.random() > combined_weight:
                time.sleep(args.interval)
                continue

            suffix = f"{cycle:06d}"

            try:
                with conn.cursor() as cur:
                    # --- Inserts ---
                    if random.random() < 0.6:
                        contact_ids.append(create_contact(cur, suffix))
                        stats["contacts"] += 1
                        if len(contact_ids) > 500:
                            contact_ids = contact_ids[-200:]

                    if random.random() < 0.5 and contact_ids:
                        create_order(cur, random.choice(contact_ids), seq.next_order())
                        stats["orders"] += 1

                    if random.random() < 0.15:
                        create_product(cur, seq.next_product())
                        stats["products"] += 1

                    # --- Mutations ---
                    if not args.no_mutations:
                        stats["updates"] += advance_orders(cur)

                        if random.random() < 0.20:
                            stats["updates"] += correct_address(cur)

                        # Deliberately rare: a purge should look like an event,
                        # not like background noise.
                        if random.random() < 0.005:
                            stats["deletes"] += delete_stale_order(cur)

            except pymysql.err.OperationalError as e:
                # Connection dropped (container restart, idle timeout). Rebuild
                # it rather than dying — the simulator is meant to outlive a
                # database bounce during a long demo.
                stats["errors"] += 1
                print(f"\n  [WARN] Lost connection on cycle {cycle}: {e} — reconnecting...")
                try:
                    conn = connect(args)
                except Exception as reconnect_error:
                    print(f"  [ERROR] Reconnect failed: {reconnect_error}")
                    raise
            except Exception as e:
                stats["errors"] += 1
                if stats["errors"] <= 5:
                    print(f"\n  [ERROR] Cycle {cycle}: {e}")
                elif stats["errors"] == 6:
                    print("\n  [ERROR] Suppressing further error messages...")

            inserted = stats["contacts"] + stats["orders"] + stats["products"]
            print(
                f"  Cycle {cycle:>5d} | Inserts: {inserted:>5d} | "
                f"Contacts: {stats['contacts']:>4d} | "
                f"Orders: {stats['orders']:>4d} | "
                f"Products: {stats['products']:>4d} | "
                f"Updates: {stats['updates']:>5d} | "
                f"Deletes: {stats['deletes']:>3d} | "
                f"Errors: {stats['errors']:>3d}",
                end=STATUS_END,
            )

            time.sleep(args.interval)

    except KeyboardInterrupt:
        inserted = stats["contacts"] + stats["orders"] + stats["products"]
        print(f"\n\n{'=' * 60}")
        print(f"  Simulator stopped after {cycle} cycles")
        print("  Changes written to Meridian CRM:")
        print(f"    Contacts inserted:  {stats['contacts']:,}")
        print(f"    Orders inserted:    {stats['orders']:,}")
        print(f"    Products inserted:  {stats['products']:,}")
        print(f"    Rows updated:       {stats['updates']:,}")
        print(f"    Rows deleted:       {stats['deletes']:,}")
        print(f"    Errors:             {stats['errors']:,}")
        print(f"    TOTAL INSERTS:      {inserted:,}")
        print(f"{'=' * 60}")
    finally:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    main()
