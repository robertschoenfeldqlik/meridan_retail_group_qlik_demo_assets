#!/usr/bin/env python3
"""
mcg_reference_data.py — Shared CRM reference data for the MCG demo
===================================================================
The CRM seeder (seed_data.py) and the continuous CRM simulator
(mysql_crm_simulator.py) generate the same population of contacts, orders
and products. These constants used to be copy-pasted into both files and
had already drifted apart (different names for the same product list, a
supplier missing from one copy), so they live here once.

Quality nightmares encoded below:
  #2 Address Catastrophe  — ADDRESS_PERSONAS: one real person, several
                            inconsistent spellings of the same address.
  #3 Product Master Mess  — CRM_PRODUCT_TEMPLATES: legacy SKUs, missing and
                            zero weights, missing country of origin.
                            SUPPLIER_VARIANTS: one supplier, four spellings.

Only CRM-side data belongs here. The WMS constants (WAREHOUSES, PRODUCTS,
CARRIERS, STORAGE_ZONE_DIRTY, BIN_FMTS) stay in seed_data.py — they are used
by the PostgreSQL path and moving them buys nothing.
"""

import random
import string

# ---------------------------------------------------------------------------
#  Addresses (Nightmare #2)
# ---------------------------------------------------------------------------
# CONVENTION: variants[0] is the CLEAN, canonical spelling for that person.
# Every later variant is a degraded form of the same real address. The
# simulator's address-correction pass rewrites a dirty variant back to
# variants[0], which is Nightmare #2 visibly resolving in the change stream.

ADDRESS_PERSONAS = [
    {"region": "EU-NL", "variants": [
        {"first": "Jan", "last": "de Vries", "street": "Keizersgracht 482", "line2": "Apartment 4B", "city": "Amsterdam", "state": "Noord-Holland", "postal": "1017 EJ", "country": "NL", "phone": "+31 20 555 0147", "email": "j.devries@email.nl"},
        {"first": "Jan", "last": "De Vries", "street": "Keizersgracht 482", "line2": "Apt 4B", "city": "Amsterdam", "state": "Noord-Holland", "postal": "1017EJ", "country": "Netherlands", "phone": "+31205550147", "email": "j.devries@email.nl"},
        {"first": "Jan", "last": "deVries", "street": "Keizersgracht 482, #4B", "line2": None, "city": "Amsterdam", "state": "NH", "postal": "1017 EJ", "country": "NL", "phone": "020-5550147", "email": "jan.devries@email.nl"},
    ]},
    {"region": "EU-DE", "variants": [
        {"first": "Klaus", "last": "Müller", "street": "Friedrichstraße 123, Hinterhaus", "line2": "3. OG links", "city": "Berlin", "state": "Berlin", "postal": "10117", "country": "DE", "phone": "+49 30 555 0199", "email": "k.mueller@email.de"},
        {"first": "Klaus", "last": "Mueller", "street": "Friedrichstraße 123, Hinterh", "line2": "3. OG links", "city": "Berlin", "state": "Berlin", "postal": "10117", "country": "Deutschland", "phone": "+4930555 0199", "email": "k.mueller@email.de"},
        {"first": "Klaus", "last": "MÜLLER", "street": "Friedrichstr. 123", "line2": "Hinterhaus 3.OG", "city": "Berlin", "state": "BE", "postal": "10117", "country": "DE", "phone": "030 5550199", "email": "klaus.mueller@email.de"},
    ]},
    {"region": "AMER-US", "variants": [
        {"first": "Sarah", "last": "Johnson", "street": "4521 Peachtree Rd NE", "line2": "Suite 200", "city": "Atlanta", "state": "GA", "postal": "30319", "country": "US", "phone": "+1 404-555-0188", "email": "s.johnson@email.com"},
        {"first": "Sarah", "last": "Johnson", "street": "4521 Peachtree Road Northeast", "line2": "Ste 200", "city": "Atlanta, GA", "state": "Georgia", "postal": "30319-3219", "country": "United States", "phone": "4045550188", "email": "sarah.johnson@email.com"},
        {"first": "Sarah", "last": "Johnson", "street": "4521 Peachtree Rd NE, Ste 200", "line2": None, "city": "Atlanta", "state": "GA", "postal": "30319", "country": "US", "phone": "(404) 555-0188", "email": "s.johnson@email.com"},
    ]},
    {"region": "APAC-SG", "variants": [
        {"first": "Wei Lin", "last": "Tan", "street": "15 Orchard Road", "line2": "#08-01 Wheelock Place", "city": "Singapore", "state": None, "postal": "238862", "country": "SG", "phone": "+65 6555 0142", "email": "wl.tan@email.sg"},
        {"first": "Wei Lin", "last": "Tan", "street": "15 Orchard Rd, #08-01", "line2": "Wheelock Place", "city": "Singapore", "state": None, "postal": "238862", "country": "Singapore", "phone": "+6565550142", "email": "wltan@email.sg"},
        {"first": "Weilin", "last": "Tan", "street": "15 Orchard Rd", "line2": None, "city": "Singapore", "state": None, "postal": "238862", "country": "SG", "phone": "6555 0142", "email": "wl.tan@email.sg"},
    ]},
    {"region": "LATAM-BR", "variants": [
        {"first": "Maria", "last": "Silva", "street": "Rua Augusta, 1500", "line2": "Conjunto 42, Cerqueira César", "city": "São Paulo", "state": "SP", "postal": "01304-001", "country": "BR", "phone": "+55 11 5555-0177", "email": "m.silva@email.com.br"},
        {"first": "Maria", "last": "Silva", "street": "R. Augusta 1500 Cj 42", "line2": None, "city": "Sao Paulo", "state": "SP", "postal": "01304001", "country": "BR", "phone": "1155550177", "email": "maria.silva@email.com.br"},
        {"first": "Maria", "last": "Da Silva", "street": "Rua Augusta, 1500", "line2": "Cj 42 Cerq. César", "city": "São Paulo", "state": "São Paulo", "postal": "01304-001", "country": "Brasil", "phone": "+55 (11) 5555 0177", "email": "m.silva@email.com.br"},
    ]},
    {"region": "AFRICA-NG", "variants": [
        {"first": "Chidi", "last": "Okafor", "street": "15 Admiralty Way", "line2": "Lekki Phase 1", "city": "Lagos", "state": "Lagos", "postal": "106104", "country": "NG", "phone": "+234 801 555 0166", "email": "c.okafor@email.com.ng"},
        {"first": "Chidi", "last": "Okafor", "street": "15 Admiralty Wy, Lekki Ph1", "line2": None, "city": "Lagos", "state": "Lagos", "postal": "106104", "country": "Nigeria", "phone": "08015550166", "email": "chidi.okafor@email.ng"},
    ]},
]


# ---------------------------------------------------------------------------
#  Products and suppliers (Nightmare #3)
# ---------------------------------------------------------------------------

CRM_PRODUCT_TEMPLATES = [
    {"sku": "MCG-4420",         "sku_am": "AM-BT-SPKR-001", "sku_eu": "EU-44200",       "name": "Meridian Bluetooth Speaker", "name_de": "Tragbarer Bluetooth-Lautsprecher", "cat1": "Electronics", "cat2": "Audio",         "cat3": "Portable Speakers", "weight": 0.45, "origin": "CN", "supplier": "Samsung Electronics Co."},
    {"sku": "MCG-4421",         "sku_am": "AM-HDPH-002",    "sku_eu": "EU-44210",       "name": "Wireless Headphones",        "name_de": "Kabellose Kopfhörer",              "cat1": "Electronics", "cat2": "Audio",         "cat3": "Headphones",        "weight": 0.32, "origin": "CN", "supplier": "Samsung Elec."},
    # Missing weight AND a third spelling of the same supplier:
    {"sku": "MCG-4430",         "sku_am": "AM-CHRG-010",    "sku_eu": "EU-44300",       "name": "USB-C Charger",              "name_de": "USB-C Ladegerät",                  "cat1": "Electronics", "cat2": "Accessories",   "cat3": None,                "weight": None, "origin": "CN", "supplier": "SAMSUNG"},
    # Missing weight AND missing country of origin:
    {"sku": "MCG-HG-1010",      "sku_am": None,             "sku_eu": "EU-HG-1010",     "name": "Kitchen Mixer Pro",          "name_de": "Küchenmixer Pro",                  "cat1": "Home",        "cat2": "Kitchen",       "cat3": "Appliances",        "weight": None, "origin": None, "supplier": "Philips Domestic Appliances"},
    # Perishable with no origin — the compliance gap (Nightmare #7):
    {"sku": "MCG-GRO-LET-001",  "sku_am": None,             "sku_eu": "EU-GRO-LET-001", "name": "Organic Lettuce",            "name_de": "Bio-Salat",                        "cat1": "Grocery",     "cat2": "Fresh Produce", "cat3": "Leafy Greens",      "weight": 0.35, "origin": None, "supplier": "Fresh Direct NL"},
    {"sku": "MCG-GRO-MIX-015",  "sku_am": None,             "sku_eu": None,             "name": "Salad Mix 200g",             "name_de": "Salatmischung 200g",               "cat1": "Grocery",     "cat2": "Fresh Produce", "cat3": "Salads",            "weight": 0.22, "origin": None, "supplier": "Fresh Direct NL"},
    # Zero weight is NOT the same as missing weight — both must survive to MySQL:
    {"sku": "MCG-APP-JKT-881",  "sku_am": "AM-APP-JKT-881", "sku_eu": "EU-APP-JKT-881", "name": "Winter Jacket L",            "name_de": "Winterjacke L",                    "cat1": "Apparel",     "cat2": "Outerwear",     "cat3": "Jackets",           "weight": 0.0,  "origin": "VN", "supplier": "Samsung Corp"},
    {"sku": "MCG-HW-VIT-300",   "sku_am": "AM-HW-VIT-300",  "sku_eu": "EU-HW-VIT-300",  "name": "Multivitamin 60ct",          "name_de": "Multivitamin 60 Stk",              "cat1": "Health",      "cat2": "Supplements",   "cat3": "Vitamins",          "weight": 0.15, "origin": "US", "supplier": "Unilever plc"},
]

SUPPLIER_VARIANTS = {
    "Samsung":  ["Samsung Electronics Co.", "Samsung Elec.", "SAMSUNG", "Samsung Corp"],
    "Unilever": ["Unilever plc", "Unilever", "Unilever PLC", "UNILEVER"],
    "Nestlé":   ["Nestlé S.A.", "Nestle SA", "NESTLÉ", "Nestle"],
    "Philips":  ["Philips Domestic Appliances", "Philips DA", "PHILIPS", "Philips Appliances BV"],
}


# ---------------------------------------------------------------------------
#  Order vocabulary
# ---------------------------------------------------------------------------

CRM_CARRIERS = ["FEDEX", "DHL-EXPRESS", "DPD", "NINJAVAN", "CORREIOS", "LOCAL-LOS"]

# Weighted by repetition: SHIP_TO_HOME is 3 draws in 5.
FULFILLMENT_METHODS = ["SHIP_TO_HOME", "SHIP_TO_HOME", "SHIP_TO_HOME", "BOPIS", "CURBSIDE"]

ORDER_STATUSES = ["PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "DELIVERY_FAILED"]

# The lifecycle the simulator walks an order through, one hop per update.
# DELIVERED and DELIVERY_FAILED are terminal. The repeated DELIVERED entries
# make roughly 1 delivery in 5 fail, which matches the seeded distribution.
ORDER_TRANSITIONS = {
    "PROCESSING": ["SHIPPED"],
    "SHIPPED":    ["IN_TRANSIT"],
    "IN_TRANSIT": ["DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "DELIVERY_FAILED"],
}

# Rates that define the demo's headline numbers. Changing one of these moves a
# number that the narration, the decks and the app KPIs all quote.
LATE_DELIVERY_RATE     = 0.22   # delivered after the promised date
MISSING_TRACKING_RATE  = 0.42   # no tracking number at all
WISMO_RATE             = 0.41   # triggers a "where is my order" contact
GERMAN_NAME_RATE       = 0.15   # product name stored in German, not English
NEXT_DAY_PROMISE_RATE  = 0.30   # unrealistic next-day promise


# ---------------------------------------------------------------------------
#  Helpers
# ---------------------------------------------------------------------------

_ID_ALPHABET = string.ascii_uppercase + string.ascii_lowercase + string.digits


def new_id(prefix):
    """Return an 18-character record id.

    The CRM's keys are 18 characters because that is what the legacy system
    minted, and the downstream joins and column widths are built around it.
    Keeping the shape means the silver layer sees identical key cardinality
    and length whichever system sits behind it.
    """
    body = "".join(random.choice(_ID_ALPHABET) for _ in range(18 - len(prefix)))
    return f"{prefix}{body}"


def supplier_spelling(canonical):
    """Pick one of the inconsistent spellings for a supplier (Nightmare #3)."""
    for base, variants in SUPPLIER_VARIANTS.items():
        if base.lower() in canonical.lower():
            return random.choice(variants)
    return canonical


def mailing_street(variant):
    """Flatten line1 + line2 into the single free-text street column.

    The CRM has no second address line, so everything is crammed into one
    column separated by a newline. That embedded newline is part of the
    address-quality story — do not strip it.
    """
    if variant["line2"]:
        return f"{variant['street']}\n{variant['line2']}"
    return variant["street"]
