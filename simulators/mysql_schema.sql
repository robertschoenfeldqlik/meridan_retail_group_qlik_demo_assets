-- ===========================================================================
--  MCG CRM — MySQL 8 schema
-- ===========================================================================
--  Meridian CRM is the customer system of record: contacts, their orders, and
--  the product master the order lines reference. Qlik lands these three tables
--  into the bronze layer over log-based CDC.
--
--  This file is applied automatically by seed_data.py --mysql. It is also safe
--  to run by hand:
--      mysql -h 127.0.0.1 -P 3307 -u root -p < simulators/mysql_schema.sql
--
--  THE QUALITY DEFECTS ARE THE POINT. Every nullable column below is nullable
--  on purpose, and the demo's data-quality story is built on which values are
--  actually absent. Two rules follow from that:
--
--    1. NEVER add `NOT NULL DEFAULT ''` to an optional column. The silver layer
--       scores quality with `IS NOT NULL AND TRIM(x) <> ''`; an empty-string
--       default makes every check pass and silently deletes the whole
--       address-quality demo.
--    2. Picklists are VARCHAR, not ENUM. ENUM complicates CDC type mapping and
--       would block ever inserting an off-vocabulary value — which is a defect
--       we may well want to demo later.
--
--  utf8mb4 is not optional either: the seeded population includes Müller,
--  São Paulo, Friedrichstraße and Nestlé. On utf8mb3 those arrive mangled and
--  the "same customer, six spellings" story becomes an encoding bug instead.
-- ===========================================================================

CREATE DATABASE IF NOT EXISTS mcg_crm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE mcg_crm;


-- ---------------------------------------------------------------------------
--  crm_contacts — Nightmare #2, the address catastrophe
-- ---------------------------------------------------------------------------
--  One real person appears several times with inconsistent spellings of the
--  same address: "Atlanta" vs "Atlanta, GA", "NL" vs "Netherlands" vs
--  "Nederland", postal codes with and without the space.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_contacts (
  contact_id          VARCHAR(18)  NOT NULL,
  first_name          VARCHAR(40)      NULL,
  last_name           VARCHAR(80)  NOT NULL,
  email               VARCHAR(80)      NULL,
  phone               VARCHAR(40)      NULL,
  -- Single free-text street column, so line 2 is crammed in after a newline.
  mailing_street      TEXT             NULL,
  -- Dirty on purpose: some rows carry the state inside the city ("Atlanta, GA").
  mailing_city        VARCHAR(40)      NULL,
  -- Genuinely absent for city-states (Singapore) — NULL, not ''.
  mailing_state       VARCHAR(80)      NULL,
  mailing_postal_code VARCHAR(20)      NULL,
  -- NL / Netherlands / Nederland all appear for the same country.
  mailing_country     VARCHAR(80)      NULL,
  created_date        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  -- The incremental-landing watermark. Qlik's CRM landing task reads changes
  -- every 15 minutes; without ON UPDATE this column never moves and the
  -- incremental story silently becomes a full reload.
  last_modified_date  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                        ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (contact_id),
  KEY idx_contacts_lastmod (last_modified_date),
  KEY idx_contacts_email   (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ---------------------------------------------------------------------------
--  crm_orders — Nightmares #5 and #6, delivery promises and carrier data
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_orders (
  -- Business key the warehouse and carrier systems also quote. It is stable
  -- and unique, so it is the primary key outright — CDC needs no surrogate.
  order_id            VARCHAR(30)  NOT NULL,
  contact_id          VARCHAR(18)      NULL,
  order_date          DATETIME         NULL,
  sku                 VARCHAR(30)      NULL,
  product_name        VARCHAR(100)     NULL,
  -- SHIP_TO_HOME | BOPIS | CURBSIDE
  fulfillment_method  VARCHAR(30)      NULL,
  promised_delivery   DATE             NULL,
  -- NULL until the order is delivered. Roughly 22% of delivered orders land
  -- AFTER promised_delivery — that gap is the SLA-breach story.
  actual_delivery     DATE             NULL,
  carrier             VARCHAR(20)      NULL,
  -- NULL for roughly 42% of orders: the smaller carriers return nothing.
  tracking_number     VARCHAR(40)      NULL,
  -- PROCESSING | SHIPPED | IN_TRANSIT | DELIVERED | DELIVERY_FAILED
  order_status        VARCHAR(30)      NULL,
  -- "Where is my order" contact. A flag, never null.
  wismo_flag          TINYINT(1)   NOT NULL DEFAULT 0,
  created_date        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_modified_date  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                        ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (order_id),
  KEY        idx_orders_contact  (contact_id),
  KEY        idx_orders_lastmod  (last_modified_date),
  KEY        idx_orders_status   (order_status),
  -- SET NULL rather than CASCADE: a deleted contact must not silently delete
  -- the orders the revenue figures are built from.
  CONSTRAINT fk_orders_contact FOREIGN KEY (contact_id)
    REFERENCES crm_contacts (contact_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ---------------------------------------------------------------------------
--  crm_products — Nightmares #3 and #7, product master and compliance
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_products (
  sku                 VARCHAR(40)  NOT NULL,
  -- Two dead SKU schemes from the pre-merger Americas and EU systems.
  legacy_sku_americas VARCHAR(30)      NULL,
  legacy_sku_eu       VARCHAR(30)      NULL,
  product_name        VARCHAR(100)     NULL,
  category_l1         VARCHAR(30)      NULL,
  category_l2         VARCHAR(30)      NULL,
  -- Deliberately absent for some SKUs — the category tree is incomplete.
  category_l3         VARCHAR(30)      NULL,
  -- NULL (never captured) and 0.00 (captured wrong) are DIFFERENT defects and
  -- both must survive the load. Do not coalesce one into the other.
  weight_kg           DECIMAL(8,2)     NULL,
  -- NULL here on a perishable item is the compliance gap.
  country_of_origin   VARCHAR(5)       NULL,
  -- Same supplier, four spellings. Deduplicating these is the silver layer's job.
  supplier_name       VARCHAR(80)      NULL,
  created_date        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_modified_date  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                        ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (sku),
  KEY        idx_products_lastmod (last_modified_date),
  KEY        idx_products_supplier(supplier_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
