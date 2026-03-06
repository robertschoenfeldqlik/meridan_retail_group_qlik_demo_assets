-- =============================================================================
-- MCG WMS Database Schema
-- =============================================================================
-- PostgreSQL schema for the Meridian Commerce Group warehouse management demo.
--
-- Creates 3 core tables with intentional data quality issues baked in:
--   - inventory_positions: Stock levels per SKU/location (Nightmare #1: Phantom Inventory)
--   - warehouse_events:    Inventory movements and cycle counts
--   - shipments:           Multi-carrier delivery tracking (Nightmare #5: Timestamp chaos)
--
-- Usage:
--   psql -h localhost -U mcg_admin -d mcg_wms -f simulators/schema.sql
--
-- Or via Docker:
--   docker exec -i mcg-postgres psql -U mcg_admin -d mcg_wms < simulators/schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Inventory Positions
-- ---------------------------------------------------------------------------
-- Tracks current stock levels at each warehouse location.
-- Quality issues:
--   - quantity_on_hand may not match quantity_available (Nightmare #1)
--   - lot_number is NULL for ~15% of perishable items (Nightmare #7)
--   - storage_zone uses inconsistent naming (AMBIENT vs AMB vs ROOM_TEMP)
--   - unit_of_measure varies (EA vs each vs pcs)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Warehouse Events
-- ---------------------------------------------------------------------------
-- Captures all inventory movements: receipts, picks, adjustments, cycle counts.
-- Quality issues:
--   - event_timestamp uses local time without timezone info (Nightmare #5)
--   - cycle_count_variance can be NULL even for CYCLE_COUNT events
--   - worker_id format varies by warehouse (DC-RTD uses "RTD-W001", DC-SIN uses "S001")
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Shipments
-- ---------------------------------------------------------------------------
-- Multi-carrier shipment tracking with intentional inconsistencies.
-- Quality issues:
--   - status_datetime stored as VARCHAR with mixed formats per carrier (Nightmare #5)
--     FedEx: ISO-8601 UTC, DPD: CET with German locale, Correios: "dd/MM/yyyy HH:mm"
--   - shipment_status uses carrier-native vocabulary (6 different schemas)
--   - destination_address has inconsistent formatting across regions (Nightmare #2)
--   - weight_unit varies: "lbs" (FedEx), "kg" (others), NULL (LOCAL-LOS)
--   - estimated_delivery stored as VARCHAR with inconsistent date formats
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_inv_location_sku ON inventory_positions(location_id, sku);
CREATE INDEX IF NOT EXISTS idx_inv_snapshot ON inventory_positions(snapshot_timestamp);
CREATE INDEX IF NOT EXISTS idx_wh_events_warehouse ON warehouse_events(warehouse_id, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_wh_events_sku ON warehouse_events(sku);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier ON shipments(carrier_code, shipment_status);
CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);

-- ---------------------------------------------------------------------------
-- Logical replication setup (for Qlik CDC via Data Movement Gateway)
-- ---------------------------------------------------------------------------
-- Note: Requires wal_level=logical (set in Docker Compose postgres command).
-- The publication allows Qlik's Data Movement Gateway to capture changes.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'mcg_wms_pub') THEN
        CREATE PUBLICATION mcg_wms_pub FOR TABLE
            inventory_positions,
            warehouse_events,
            shipments;
    END IF;
END $$;

-- Success
SELECT 'MCG WMS schema created successfully' AS status,
       (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS table_count;
