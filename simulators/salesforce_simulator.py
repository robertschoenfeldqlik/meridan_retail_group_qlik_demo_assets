"""
Meridian Commerce Group -- Continuous Salesforce Data Simulator
================================================================
Generates organic, realistic CRM and order data in Salesforce.

Simulates:
  - New customer contacts with address quality issues
  - E-commerce orders with delivery tracking gaps
  - Product catalog updates with master data inconsistencies

Uses the Salesforce REST API (simple_salesforce library).

Prerequisites:
  pip install simple-salesforce faker
  Salesforce Developer org with custom objects deployed (see setup instructions)

Usage:
  python salesforce_simulator.py --username you@dev.org --password YourPass --token SecurityToken

Press Ctrl+C to stop.
"""

import argparse
import json
import os
import random
import sys
import time
from datetime import datetime, timedelta, timezone

try:
    from simple_salesforce import Salesforce
except ImportError:
    print("Install simple-salesforce:  pip install simple-salesforce")
    sys.exit(1)

try:
    from faker import Faker
except ImportError:
    print("Install faker:  pip install faker")
    sys.exit(1)


# This simulator deliberately emits near-duplicate contacts -- that IS the
# "Address Catastrophe" scenario the demo is built on. Salesforce's
# Standard_Contact_Duplicate_Rule rejects those inserts with DUPLICATES_DETECTED
# and the run stalls on errors. The rule reports allowSave=true, so this header
# lets the intentional duplicates land instead of failing the cycle.
DUPLICATE_RULE_HEADER = {"Sforce-Duplicate-Rule-Header": "allowSave=true"}


# ---------------------------------------------------------------------------
# Address templates -- THE NIGHTMARE (Nightmare #2)
# ---------------------------------------------------------------------------

# Each "persona" has a clean version and multiple dirty variants
ADDRESS_PERSONAS = [
    {
        "region": "EU-NL",
        "variants": [
            {"first": "Jan", "last": "de Vries", "street": "Keizersgracht 482", "line2": "Apartment 4B", "city": "Amsterdam", "state": "Noord-Holland", "postal": "1017 EJ", "country": "NL", "phone": "+31 20 555 0147", "email": "j.devries@email.nl"},
            {"first": "Jan", "last": "De Vries", "street": "Keizersgracht 482", "line2": "Apt 4B", "city": "Amsterdam", "state": "Noord-Holland", "postal": "1017EJ", "country": "Netherlands", "phone": "+31205550147", "email": "j.devries@email.nl"},
            {"first": "Jan", "last": "deVries", "street": "Keizersgracht 482, #4B", "line2": None, "city": "Amsterdam", "state": "NH", "postal": "1017 EJ", "country": "NL", "phone": "020-5550147", "email": "jan.devries@email.nl"},
        ]
    },
    {
        "region": "EU-DE",
        "variants": [
            {"first": "Klaus", "last": "Müller", "street": "Friedrichstraße 123, Hinterhaus", "line2": "3. OG links", "city": "Berlin", "state": "Berlin", "postal": "10117", "country": "DE", "phone": "+49 30 555 0199", "email": "k.mueller@email.de"},
            {"first": "Klaus", "last": "Mueller", "street": "Friedrichstraße 123, Hinterh", "line2": "3. OG links", "city": "Berlin", "state": "Berlin", "postal": "10117", "country": "Deutschland", "phone": "+4930555 0199", "email": "k.mueller@email.de"},  # Truncated + accent stripped
            {"first": "Klaus", "last": "MÜLLER", "street": "Friedrichstr. 123", "line2": "Hinterhaus 3.OG", "city": "Berlin", "state": "BE", "postal": "10117", "country": "DE", "phone": "030 5550199", "email": "klaus.mueller@email.de"},
        ]
    },
    {
        "region": "AMER-US",
        "variants": [
            {"first": "Sarah", "last": "Johnson", "street": "4521 Peachtree Rd NE", "line2": "Suite 200", "city": "Atlanta", "state": "GA", "postal": "30319", "country": "US", "phone": "+1 404-555-0188", "email": "s.johnson@email.com"},
            {"first": "Sarah", "last": "Johnson", "street": "4521 Peachtree Road Northeast", "line2": "Ste 200", "city": "Atlanta, GA", "state": "Georgia", "postal": "30319-3219", "country": "United States", "phone": "4045550188", "email": "sarah.johnson@email.com"},
            {"first": "Sarah", "last": "Johnson", "street": "4521 Peachtree Rd NE, Ste 200", "line2": None, "city": "Atlanta", "state": "GA", "postal": "30319", "country": "US", "phone": "(404) 555-0188", "email": "s.johnson@email.com"},
        ]
    },
    {
        "region": "APAC-SG",
        "variants": [
            {"first": "Wei Lin", "last": "Tan", "street": "15 Orchard Road", "line2": "#08-01 Wheelock Place", "city": "Singapore", "state": None, "postal": "238862", "country": "SG", "phone": "+65 6555 0142", "email": "wl.tan@email.sg"},
            {"first": "Wei Lin", "last": "Tan", "street": "15 Orchard Rd, #08-01", "line2": "Wheelock Place", "city": "Singapore", "state": None, "postal": "238862", "country": "Singapore", "phone": "+6565550142", "email": "wltan@email.sg"},
            {"first": "Weilin", "last": "Tan", "street": "15 Orchard Rd", "line2": None, "city": "Singapore", "state": None, "postal": "238862", "country": "SG", "phone": "6555 0142", "email": "wl.tan@email.sg"},  # Missing unit -- carrier will reject
        ]
    },
    {
        "region": "LATAM-BR",
        "variants": [
            {"first": "Maria", "last": "Silva", "street": "Rua Augusta, 1500", "line2": "Conjunto 42, Cerqueira César", "city": "São Paulo", "state": "SP", "postal": "01304-001", "country": "BR", "phone": "+55 11 5555-0177", "email": "m.silva@email.com.br"},
            {"first": "Maria", "last": "Silva", "street": "R. Augusta 1500 Cj 42", "line2": None, "city": "Sao Paulo", "state": "SP", "postal": "01304001", "country": "BR", "phone": "1155550177", "email": "maria.silva@email.com.br"},  # Abbreviated, accent stripped, no hyphen
            {"first": "Maria", "last": "Da Silva", "street": "Rua Augusta, 1500", "line2": "Cj 42 Cerq. César", "city": "São Paulo", "state": "São Paulo", "postal": "01304-001", "country": "Brasil", "phone": "+55 (11) 5555 0177", "email": "m.silva@email.com.br"},
        ]
    },
    {
        "region": "AFRICA-NG",
        "variants": [
            {"first": "Chidi", "last": "Okafor", "street": "15 Admiralty Way", "line2": "Lekki Phase 1", "city": "Lagos", "state": "Lagos", "postal": "106104", "country": "NG", "phone": "+234 801 555 0166", "email": "c.okafor@email.com.ng"},
            {"first": "Chidi", "last": "Okafor", "street": "15 Admiralty Wy, Lekki Ph1", "line2": None, "city": "Lagos", "state": "Lagos", "postal": "106104", "country": "Nigeria", "phone": "08015550166", "email": "chidi.okafor@email.ng"},
        ]
    },
]

# Product entries with quality issues (Nightmare #3)
PRODUCT_TEMPLATES = [
    {"sku": "MCG-4420", "sku_am": "AM-BT-SPKR-001", "sku_eu": "EU-44200", "name": "Meridian Bluetooth Speaker", "name_de": "Tragbarer Bluetooth-Lautsprecher", "cat1": "Electronics", "cat2": "Audio", "cat3": "Portable Speakers", "weight": 0.45, "origin": "CN", "supplier": "Samsung Electronics Co."},
    {"sku": "MCG-4421", "sku_am": "AM-HDPH-002", "sku_eu": "EU-44210", "name": "Wireless Headphones", "name_de": "Kabellose Kopfhörer", "cat1": "Electronics", "cat2": "Audio", "cat3": "Headphones", "weight": 0.32, "origin": "CN", "supplier": "Samsung Elec."},  # Supplier variant!
    {"sku": "MCG-4430", "sku_am": "AM-CHRG-010", "sku_eu": "EU-44300", "name": "USB-C Charger", "name_de": "USB-C Ladegerät", "cat1": "Electronics", "cat2": "Accessories", "cat3": None, "weight": None, "origin": "CN", "supplier": "SAMSUNG"},  # Missing weight + supplier variant!
    {"sku": "MCG-HG-1010", "sku_am": None, "sku_eu": "EU-HG-1010", "name": "Kitchen Mixer Pro", "name_de": "Küchenmixer Pro", "cat1": "Home", "cat2": "Kitchen", "cat3": "Appliances", "weight": None, "origin": None, "supplier": "Philips Domestic Appliances"},  # Missing weight + origin!
    {"sku": "MCG-GRO-LET-001", "sku_am": None, "sku_eu": "EU-GRO-LET-001", "name": "Organic Lettuce", "name_de": "Bio-Salat", "cat1": "Grocery", "cat2": "Fresh Produce", "cat3": "Leafy Greens", "weight": 0.35, "origin": None, "supplier": "Fresh Direct NL"},  # Missing origin -- compliance!
    {"sku": "MCG-GRO-MIX-015", "sku_am": None, "sku_eu": None, "name": "Salad Mix 200g", "name_de": "Salatmischung 200g", "cat1": "Grocery", "cat2": "Fresh Produce", "cat3": "Salads", "weight": 0.22, "origin": None, "supplier": "Fresh Direct NL"},
    {"sku": "MCG-APP-JKT-881", "sku_am": "AM-APP-JKT-881", "sku_eu": "EU-APP-JKT-881", "name": "Winter Jacket L", "name_de": "Winterjacke L", "cat1": "Apparel", "cat2": "Outerwear", "cat3": "Jackets", "weight": 0.0, "origin": "VN", "supplier": "Samsung Corp"},  # Zero weight (invalid!) + Samsung variant!
    {"sku": "MCG-HW-VIT-300", "sku_am": "AM-HW-VIT-300", "sku_eu": "EU-HW-VIT-300", "name": "Multivitamin 60ct", "name_de": "Multivitamin 60 Stk", "cat1": "Health", "cat2": "Supplements", "cat3": "Vitamins", "weight": 0.15, "origin": "US", "supplier": "Unilever plc"},
]

SUPPLIER_VARIANTS = {
    "Samsung": ["Samsung Electronics Co.", "Samsung Elec.", "SAMSUNG", "Samsung Corp"],
    "Unilever": ["Unilever plc", "Unilever", "Unilever PLC", "UNILEVER"],
    "Nestlé": ["Nestlé S.A.", "Nestle SA", "NESTLÉ", "Nestle"],
    "Philips": ["Philips Domestic Appliances", "Philips DA", "PHILIPS", "Philips Appliances BV"],
}

CARRIERS_FOR_ORDERS = ["FEDEX", "DHL-EXPRESS", "DPD", "NINJAVAN", "CORREIOS", "LOCAL-LOS"]
FULFILLMENT_METHODS = ["SHIP_TO_HOME", "SHIP_TO_HOME", "SHIP_TO_HOME", "BOPIS", "CURBSIDE"]

fake = Faker()
Faker.seed(None)  # Random seed for variety

# Locale-specific fakers for realistic names
fake_nl = Faker('nl_NL')
fake_de = Faker('de_DE')
fake_br = Faker('pt_BR')
fake_us = Faker('en_US')
fake_jp = Faker('ja_JP')


# ---------------------------------------------------------------------------
# Salesforce helpers
# ---------------------------------------------------------------------------

def create_contact(sf, persona_variant, unique_suffix):
    """Create a Contact record with intentional address quality issues."""
    v = persona_variant

    # Build the mailing street (combining line1 + line2 if present)
    street = v["street"]
    if v["line2"]:
        street = f"{v['street']}\n{v['line2']}"

    record = {
        "FirstName": v["first"],
        "LastName": f"{v['last']}_{unique_suffix}",  # Suffix to prevent true duplicates in SF
        "Email": v["email"].replace("@", f".{unique_suffix}@"),  # Unique email
        "Phone": v["phone"],
        "MailingStreet": street,
        "MailingCity": v["city"],
        "MailingState": v["state"],
        "MailingPostalCode": v["postal"],
        "MailingCountry": v["country"],
    }

    # Remove None values
    record = {k: v for k, v in record.items() if v is not None}

    result = sf.Contact.create(record, headers=DUPLICATE_RULE_HEADER)
    return result["id"] if result["success"] else None


def create_order(sf, contact_id, unique_suffix):
    """Create a custom MCG_Order__c record."""
    now = datetime.now(timezone.utc)

    product = random.choice(PRODUCT_TEMPLATES)
    carrier = random.choice(CARRIERS_FOR_ORDERS)
    method = random.choice(FULFILLMENT_METHODS)

    # Promised delivery -- sometimes overly optimistic
    if random.random() < 0.3:
        promised = (now + timedelta(days=1)).strftime("%Y-%m-%d")  # Unrealistic next-day
    else:
        promised = (now + timedelta(days=random.randint(2, 7))).strftime("%Y-%m-%d")

    # Actual delivery -- NULL for APAC SLA breaches (22%)
    actual = None
    status = random.choices(
        ["PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "DELIVERY_FAILED"],
        weights=[0.15, 0.10, 0.25, 0.35, 0.15],
        k=1
    )[0]

    if status == "DELIVERED":
        if random.random() > 0.22:  # 22% APAC-style SLA breach -- late
            actual = (now - timedelta(days=random.randint(0, 2))).strftime("%Y-%m-%d")
        else:
            actual = (now + timedelta(days=random.randint(1, 5))).strftime("%Y-%m-%d")  # Late!

    # Tracking number -- NULL for 42% (carriers without tracking)
    tracking = None
    if random.random() > 0.42:
        tracking = f"{carrier[:3]}-{random.randint(1000000, 9999999)}"

    # WISMO flag -- 41% of orders trigger a "where is my package" call
    wismo = random.random() < 0.41

    record = {
        "Order_ID__c": f"WEB-{now.strftime('%Y-%m')}-{unique_suffix}",
        "Contact__c": contact_id,
        "Order_Date__c": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "SKU__c": product["sku"],
        "Product_Name__c": product["name"],
        "Fulfillment_Method__c": method,
        "Promised_Delivery__c": promised,
        "Carrier__c": carrier,
        "Tracking_Number__c": tracking,
        "Order_Status__c": status,
        "WISMO_Flag__c": wismo,
    }

    if actual:
        record["Actual_Delivery__c"] = actual

    # Remove None values
    record = {k: v for k, v in record.items() if v is not None}

    try:
        result = sf.MCG_Order__c.create(record, headers=DUPLICATE_RULE_HEADER)
        return result["id"] if result["success"] else None
    except Exception as e:
        print(f"\n  [WARN] Order creation failed: {e}")
        return None


def create_product(sf, template, unique_suffix):
    """Create a custom MCG_Product__c record with master data issues."""

    # Randomly pick which supplier name variant to use (Nightmare #3)
    supplier = template["supplier"]
    for base, variants in SUPPLIER_VARIANTS.items():
        if base.lower() in supplier.lower():
            supplier = random.choice(variants)
            break

    # Randomly decide whether to use German product name (simulating EU legacy)
    name = template["name"]
    if random.random() < 0.15:
        name = template.get("name_de", template["name"])

    record = {
        "SKU__c": f"{template['sku']}-{unique_suffix}",
        "Legacy_SKU_Americas__c": template.get("sku_am"),
        "Legacy_SKU_EU__c": template.get("sku_eu"),
        "Product_Name__c": name,
        "Category_L1__c": template["cat1"],
        "Category_L2__c": template["cat2"],
        "Category_L3__c": template.get("cat3"),
        "Supplier_Name__c": supplier,
        "Country_of_Origin__c": template.get("origin"),
    }

    # Weight -- include None/zero (Nightmare #3)
    if template["weight"] is not None:
        record["Weight_KG__c"] = template["weight"]
    # If weight is None, just don't include it -- it will be NULL in SF

    # Remove None values
    record = {k: v for k, v in record.items() if v is not None}

    try:
        result = sf.MCG_Product__c.create(record, headers=DUPLICATE_RULE_HEADER)
        return result["id"] if result["success"] else None
    except Exception as e:
        print(f"\n  [WARN] Product creation failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Organic pattern helpers
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
# Salesforce custom object setup instructions
# ---------------------------------------------------------------------------

SETUP_INSTRUCTIONS = """
============================================================
  SALESFORCE CUSTOM OBJECT SETUP
============================================================

Before running this simulator, create these custom objects
in your Salesforce Developer org:

1. Go to Setup > Object Manager > Create > Custom Object

2. Object: MCG_Order__c
   Fields:
     - Order_ID__c           (Text, 30, Unique, External ID)
     - Contact__c            (Lookup to Contact)
     - Order_Date__c         (Date/Time)
     - SKU__c                (Text, 30)
     - Product_Name__c       (Text, 100)
     - Fulfillment_Method__c (Picklist: SHIP_TO_HOME, BOPIS, CURBSIDE)
     - Promised_Delivery__c  (Date)
     - Actual_Delivery__c    (Date)
     - Carrier__c            (Text, 20)
     - Tracking_Number__c    (Text, 40)
     - Order_Status__c       (Picklist: PROCESSING, SHIPPED, IN_TRANSIT, DELIVERED, DELIVERY_FAILED)
     - WISMO_Flag__c         (Checkbox)

3. Object: MCG_Product__c
   Fields:
     - SKU__c                    (Text, 40, Unique, External ID)
     - Legacy_SKU_Americas__c    (Text, 30)
     - Legacy_SKU_EU__c          (Text, 30)
     - Product_Name__c           (Text, 100)
     - Category_L1__c            (Text, 30)
     - Category_L2__c            (Text, 30)
     - Category_L3__c            (Text, 30)
     - Weight_KG__c              (Number, 8, 2)
     - Country_of_Origin__c      (Text, 5)
     - Supplier_Name__c          (Text, 80)

============================================================
"""


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="MCG Salesforce Data Simulator")
    parser.add_argument("--username", default=os.environ.get("SF_USERNAME"), help="Salesforce username")
    parser.add_argument("--password", default=os.environ.get("SF_PASSWORD"), help="Salesforce password")
    parser.add_argument("--token", default=os.environ.get("SF_SECURITY_TOKEN", ""), help="Salesforce security token")
    parser.add_argument("--domain", default=os.environ.get("SF_DOMAIN", "login"), help="Salesforce domain (login or test)")
    parser.add_argument("--api-version", default=os.environ.get("SF_API_VERSION", "61.0"), help="Salesforce REST API version (default 61.0)")
    parser.add_argument("--interval", type=float, default=10.0, help="Seconds between event cycles")
    parser.add_argument("--setup-help", action="store_true", help="Show custom object setup instructions")
    args = parser.parse_args()

    if args.setup_help:
        print(SETUP_INSTRUCTIONS)
        return

    if not args.username or not args.password:
        print("ERROR: Salesforce credentials required.")
        print("  Use --username/--password or set SF_USERNAME/SF_PASSWORD env vars.")
        print("  Use --setup-help to see custom object setup instructions.")
        sys.exit(1)

    print("=" * 60)
    print("  Meridian Commerce Group -- Salesforce Simulator")
    print("=" * 60)
    print(f"  Username: {args.username}")
    print(f"  Domain:   {args.domain}")
    print(f"  API ver:  {args.api_version}")
    print(f"  Interval: {args.interval}s between cycles")
    print()

    # Pin the REST API version rather than taking simple_salesforce's built-in
    # default: the default drifts with the library, which silently changes the
    # endpoint the simulator writes through and the fields it may send.
    sf = Salesforce(
        username=args.username,
        password=args.password,
        security_token=args.token,
        domain=args.domain,
        version=args.api_version
    )
    print(f"[OK] Connected to Salesforce ({sf.sf_instance})\n")
    print("[>>] Starting continuous data generation. Press Ctrl+C to stop.\n")

    cycle = 0
    stats = {"contacts": 0, "orders": 0, "products": 0, "errors": 0}
    contact_ids = []  # Cache created contact IDs for order creation

    try:
        while True:
            cycle += 1
            bh_weight = business_hours_weight()
            dow_weight = day_of_week_weight()
            combined_weight = bh_weight * dow_weight

            # Skip some cycles during quiet periods
            if random.random() > combined_weight:
                time.sleep(args.interval)
                continue

            suffix = f"{cycle:06d}"

            try:
                # --- Create a Contact (with address quality issues) ---
                if random.random() < 0.6:
                    persona = random.choice(ADDRESS_PERSONAS)
                    variant = random.choice(persona["variants"])
                    cid = create_contact(sf, variant, suffix)
                    if cid:
                        stats["contacts"] += 1
                        contact_ids.append(cid)
                        # Keep cache manageable
                        if len(contact_ids) > 500:
                            contact_ids = contact_ids[-200:]

                # --- Create an Order (linked to existing contact) ---
                if random.random() < 0.5 and contact_ids:
                    contact_id = random.choice(contact_ids)
                    oid = create_order(sf, contact_id, suffix)
                    if oid:
                        stats["orders"] += 1

                # --- Create a Product (less frequent) ---
                if random.random() < 0.15:
                    template = random.choice(PRODUCT_TEMPLATES)
                    pid = create_product(sf, template, suffix)
                    if pid:
                        stats["products"] += 1

            except Exception as e:
                stats["errors"] += 1
                if stats["errors"] <= 5:
                    print(f"\n  [ERROR] Cycle {cycle}: {e}")
                elif stats["errors"] == 6:
                    print(f"\n  [ERROR] Suppressing further error messages...")

            # Status display
            total = stats["contacts"] + stats["orders"] + stats["products"]
            print(
                f"  Cycle {cycle:>5d} | Total: {total:>5d} | "
                f"Contacts: {stats['contacts']:>4d} | "
                f"Orders: {stats['orders']:>4d} | "
                f"Products: {stats['products']:>4d} | "
                f"Errors: {stats['errors']:>3d}",
                end='\r'
            )

            time.sleep(args.interval)

    except KeyboardInterrupt:
        print(f"\n\n{'=' * 60}")
        print(f"  Simulator stopped after {cycle} cycles")
        print(f"  Records created in Salesforce:")
        print(f"    Contacts:  {stats['contacts']:,}")
        print(f"    Orders:    {stats['orders']:,}")
        print(f"    Products:  {stats['products']:,}")
        print(f"    Errors:    {stats['errors']:,}")
        print(f"    TOTAL:     {stats['contacts'] + stats['orders'] + stats['products']:,}")
        print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
