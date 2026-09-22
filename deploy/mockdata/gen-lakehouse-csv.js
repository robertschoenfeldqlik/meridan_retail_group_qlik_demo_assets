#!/usr/bin/env node
/**
 * Generate the lakehouse layer as CSV, for tenants without a provisioned Open Lakehouse.
 *
 *   node deploy/mockdata/gen-lakehouse-csv.js [--out <dir>]
 *
 * The two analytics apps read gold.* and silver.* through the Athena connection when a
 * real lakehouse exists. Where it does not, these files stand in for those tables: same
 * table names, same column names, same grain, so the load scripts change only in their
 * FROM clause and every downstream artifact — data products, profiling, trust scores,
 * lineage — behaves as it would against Iceberg.
 *
 * Deterministic by design: a fixed seed means a re-run produces byte-identical files, so
 * a video can be re-cut months later and the numbers on screen still match the narration.
 *
 * The headline figures are pinned to the MCG story rather than left to chance —
 * see HEADLINES below.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
//  The numbers the narration quotes. Everything else is generated around these.
// ---------------------------------------------------------------------------
const HEADLINES = {
  iraPct: 0.74,              // inventory record accuracy, vs a 97% target
  trustRotterdam: 0.31,      // DC-RTD-01 during the silent CDC failure
  trustHealthy: 0.89,        // every other DC
  skusMissingWeight: 8200,   // nightmare #3
  addressesUnresolved: 640,  // 3.2% of 20,000 contacts -> Address Cleanup sprint
  lotViolations: 2400,       // 15% of perishables -> Lot Number Compliance sprint
  onTimeTarget: 0.92,
  ninjavanOnTime: 0.69,      // post-AMD3 reclassification
};

const COUNTS = {
  contacts: 20000,
  products: 25000,
  positions: 45000,
  orders: 20000,
  shipments: 8000,
  iotReadings: 15000,
  carrierEvents: 5000,
};

// ---------------------------------------------------------------------------
//  Deterministic RNG (mulberry32) — same seed, same data, every run.
// ---------------------------------------------------------------------------
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(20260916);
const pick = (arr) => arr[Math.floor(R() * arr.length)];
const int = (lo, hi) => lo + Math.floor(R() * (hi - lo + 1));
const dec = (lo, hi, p = 2) => Number((lo + R() * (hi - lo)).toFixed(p));
const chance = (p) => R() < p;

// ---------------------------------------------------------------------------
//  Reference data — 12 warehouses across 6 countries, 6 carriers.
// ---------------------------------------------------------------------------
const DCS = [
  { id: 'DC-RTD-01', city: 'Rotterdam',  country: 'NL', tz: 'Europe/Amsterdam' },
  { id: 'DC-RTD-02', city: 'Rotterdam',  country: 'NL', tz: 'Europe/Amsterdam' },
  { id: 'DC-AMS-01', city: 'Amsterdam',  country: 'NL', tz: 'Europe/Amsterdam' },
  { id: 'DC-HAM-01', city: 'Hamburg',    country: 'DE', tz: 'Europe/Berlin' },
  { id: 'DC-MUC-01', city: 'Munich',     country: 'DE', tz: 'Europe/Berlin' },
  { id: 'DC-PAR-01', city: 'Paris',      country: 'FR', tz: 'Europe/Paris' },
  { id: 'DC-LYO-01', city: 'Lyon',       country: 'FR', tz: 'Europe/Paris' },
  { id: 'DC-MAD-01', city: 'Madrid',     country: 'ES', tz: 'Europe/Madrid' },
  { id: 'DC-BCN-01', city: 'Barcelona',  country: 'ES', tz: 'Europe/Madrid' },
  { id: 'DC-MIL-01', city: 'Milan',      country: 'IT', tz: 'Europe/Rome' },
  { id: 'DC-WAW-01', city: 'Warsaw',     country: 'PL', tz: 'Europe/Warsaw' },
  { id: 'DC-GDN-01', city: 'Gdansk',     country: 'PL', tz: 'Europe/Warsaw' },
];
const CARRIERS = ['DPD', 'FEDEX', 'NINJAVAN', 'DHL', 'GLS', 'TRANSFRIO'];
const COUNTRIES = ['NL', 'DE', 'FR', 'ES', 'IT', 'PL'];

// Six carrier vocabularies in three languages collapsing to six canonical stages —
// nightmare #6, and the thing silver.shipments_canonical exists to fix.
const STATUS_RAW = {
  CREATED:    ['created', 'Auftrag erstellt', 'criado'],
  IN_TRANSIT: ['in_transit', 'unterwegs', 'em transito', 'IN TRANSIT'],
  OUT_FOR_DELIVERY: ['out_for_delivery', 'in Zustellung', 'saiu para entrega'],
  DELIVERED:  ['delivered', 'zugestellt', 'entregue', 'DELIVERED'],
  EXCEPTION:  ['exception', 'Ausnahme', 'excecao'],
  RETURNED:   ['returned', 'retour', 'devolvido'],
};
const EXCEPTIONS = ['', '', '', '', 'ADDRESS_INVALID', 'RECIPIENT_ABSENT', 'CUSTOMS_HOLD', 'DAMAGED'];
const ZONES = ['AMBIENT', 'CHILLED', 'FROZEN', 'HAZMAT'];
const UOM = ['EA', 'CS', 'PL'];
const CATS = [
  ['Electronics', 'Audio', 'Speakers'], ['Electronics', 'Mobile', 'Handsets'],
  ['Grocery', 'Fresh Produce', 'Leafy Greens'], ['Grocery', 'Dairy', 'Cheese'],
  ['Grocery', 'Frozen', 'Ready Meals'], ['Home', 'Kitchen', 'Cookware'],
  ['Home', 'Furniture', 'Seating'], ['Apparel', 'Outerwear', 'Jackets'],
];
const SUPPLIERS = [
  ['Samsung Electronics Co., Ltd.', 'Samsung Electronics'],
  ['SAMSUNG ELECTRONICS CO LTD', 'Samsung Electronics'],
  ['TransFrio Logistica SA', 'TransFrio'],
  ['Transfrio Logistica S.A.', 'TransFrio'],
  ['FreshDirect B.V.', 'FreshDirect'],
  ['Fresh Direct BV', 'FreshDirect'],
  ['NinjaVan Holdings', 'NinjaVan'],
];
const FIRST = ['Jan', 'Sophie', 'Henrik', 'Marta', 'Luca', 'Ana', 'Pieter', 'Elena', 'Tomas', 'Ingrid'];
const LAST = ['de Vries', 'Muller', 'Jansen', 'Kowalski', 'Rossi', 'Garcia', 'Bakker', 'Novak', 'Silva', 'Berg'];
const CITIES = {
  NL: ['Amsterdam', 'Rotterdam', 'Utrecht'], DE: ['Hamburg', 'Munich', 'Berlin'],
  FR: ['Paris', 'Lyon', 'Marseille'], ES: ['Madrid', 'Barcelona', 'Valencia'],
  IT: ['Milan', 'Rome', 'Turin'], PL: ['Warsaw', 'Gdansk', 'Krakow'],
};

// ---------------------------------------------------------------------------
//  CSV writer
// ---------------------------------------------------------------------------
function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function writeCsv(dir, name, cols, rows) {
  const out = [cols.join(',')];
  for (const r of rows) out.push(cols.map((c) => csvCell(r[c])).join(','));
  const file = path.join(dir, name);
  fs.writeFileSync(file, out.join('\n') + '\n', 'utf8');
  console.log(`  ${name.padEnd(42)} ${String(rows.length).padStart(7)} rows`);
  return rows;
}

const DAY = 86400000;
const BASE = Date.UTC(2026, 8, 16); // 2026-09-16, the demo's "today"
const iso = (ms) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
//  Builders
// ---------------------------------------------------------------------------
function buildProducts() {
  const rows = [];
  // Exactly HEADLINES.skusMissingWeight products carry no weight — nightmare #3.
  const missing = new Set();
  while (missing.size < HEADLINES.skusMissingWeight) missing.add(int(0, COUNTS.products - 1));

  for (let i = 0; i < COUNTS.products; i++) {
    const [l1, l2, l3] = pick(CATS);
    const [rawSup, canonSup] = pick(SUPPLIERS);
    const noWeight = missing.has(i);
    // A weight that was imputed from the category average is still a weight, but it is
    // flagged — the app separates "known" from "inferred".
    const imputed = !noWeight && chance(0.12);
    const origin = chance(0.07) ? '' : pick(['KR', 'CN', 'NL', 'DE', 'BR', 'VN']);
    rows.push({
      sku: 'SKU-' + String(100000 + i),
      legacy_sku_americas: chance(0.4) ? 'US' + int(10000, 99999) : '',
      legacy_sku_eu: chance(0.4) ? 'EU-' + int(10000, 99999) : '',
      product_name: `${l3.replace(/s$/, '')} ${pick(['Pro', 'Max', 'Lite', 'Classic', 'XL'])} ${int(100, 999)}`,
      category_l1: l1, category_l2: l2, category_l3: l3,
      weight_kg: noWeight ? '' : dec(0.1, 25, 3),
      weight_imputed: imputed ? 1 : 0,
      country_of_origin: origin,
      origin_missing_compliance_risk: origin === '' ? 1 : 0,
      supplier_name_raw: rawSup,
      supplier_canonical: canonSup,
    });
  }
  return rows;
}

// Each distribution centre gets its own operating profile. Without this every
// centre lands on the same IRA and the same trust score, and the bar charts render
// as a wall of identical bars — which tells a viewer nothing. `health` drives the
// phantom rate (and so IRA); `trust` is the centre's average trust score. Both are
// chosen so the estate still averages out to the narration's headline figures.
const DC_PROFILE = {
  'DC-RTD-01': { health: 0.55, trust: HEADLINES.trustRotterdam }, // the silent CDC failure
  'DC-GDN-01': { health: 0.78, trust: 0.73 },
  'DC-WAW-01': { health: 0.84, trust: 0.80 },
  'DC-MIL-01': { health: 0.90, trust: 0.85 },
  'DC-BCN-01': { health: 0.95, trust: 0.88 },
  'DC-LYO-01': { health: 1.00, trust: 0.90 },
  'DC-MAD-01': { health: 1.05, trust: 0.90 },
  'DC-HAM-01': { health: 1.10, trust: 0.92 },
  'DC-RTD-02': { health: 1.14, trust: 0.93 },
  'DC-PAR-01': { health: 1.19, trust: 0.95 },
  'DC-AMS-01': { health: 1.24, trust: 0.96 },
  'DC-MUC-01': { health: 1.30, trust: 0.97 }, // best run centre
};

// Dividing by `health` would otherwise push the estate-wide phantom rate above
// target, because the mean of 1/health exceeds 1. Deriving the constant instead of
// hand-tuning it keeps IRA on 74% however the profiles above are retuned.
const PHANTOM_K = DCS.length / DCS.reduce((t, d) => t + 1 / DC_PROFILE[d.id].health, 0);


function buildInventory(products) {
  const rows = [];
  // Phantom rate is set so IRA lands on the quoted 74% ACROSS the estate, with the
  // per-DC health factor spreading the individual centres either side of it.
  const targetPhantom = 1 - HEADLINES.iraPct;
  let lotViolations = 0;
  for (let i = 0; i < COUNTS.positions; i++) {
    const dc = pick(DCS);
    const p = products[int(0, products.length - 1)];
    const perishable = p.category_l1 === 'Grocery';
    const onHand = int(0, 900);
    const reserved = Math.min(onHand, int(0, 120));
    const inTransit = int(0, 200);
    // Healthier centre -> fewer phantoms. Inverting the health factor spreads IRA
    // from roughly 55% at Rotterdam to 81% at Munich, mean still on 74%.
    const prof = DC_PROFILE[dc.id];
    const phantom = chance(Math.min(0.95, (targetPhantom * PHANTOM_K) / prof.health));
    const negative = chance(0.015);
    // 15% of perishables are missing a lot number — the compliance sprint's feed.
    const lotMissing = perishable && lotViolations < HEADLINES.lotViolations && chance(0.15);
    if (lotMissing) lotViolations++;
    // 180 days, not 30. A 30-day window puts every position in two calendar
    // months, so an IRA trend is a two-point line that says nothing. The window
    // only spreads the same 45,000 positions over more months; it changes no
    // ratio, so estate IRA stays on its 74% target.
    const ts = BASE - int(0, 179) * DAY - int(0, 86399) * 1000;
    rows.push({
      location_id: dc.id,
      sku: p.sku,
      lot_number: lotMissing ? '' : 'LOT-' + int(200000, 299999),
      quantity_on_hand: negative ? -int(1, 40) : onHand,
      quantity_available: Math.max(0, onHand - reserved),
      quantity_reserved: reserved,
      quantity_in_transit: inTransit,
      unit_of_measure: pick(UOM),
      storage_zone: perishable ? pick(['CHILLED', 'FROZEN']) : pick(ZONES),
      logic_error: negative ? 1 : 0,
      phantom_suspect: phantom ? 1 : 0,
      lot_missing: lotMissing ? 1 : 0,
      last_count_date: day(BASE - int(1, 120) * DAY),
      snapshot_timestamp: iso(ts),
      // Trust tracks the same profile, so the two charts agree with each other
      // instead of one being flat while the other varies.
      trust_score: dec(Math.max(0.05, prof.trust - 0.03), Math.min(0.99, prof.trust + 0.03)),
    });
  }
  return rows;
}

// gold.supply_chain_health is an aggregate of silver.inventory_reconciled, so it is
// derived from those rows rather than invented — the gold numbers reconcile to silver.
function buildSupplyChainHealth(inventory) {
  const by = new Map();
  for (const r of inventory) {
    let g = by.get(r.location_id);
    if (!g) {
      g = { location_id: r.location_id, sku_positions: 0, total_on_hand: 0,
            phantom_suspect_count: 0, negative_qty_count: 0, lot_missing_count: 0,
            _trust: 0, cycle_count_events: 0, avg_cycle_count_variance: 0 };
      by.set(r.location_id, g);
    }
    g.sku_positions++;
    g.total_on_hand += Math.max(0, Number(r.quantity_on_hand));
    g.phantom_suspect_count += r.phantom_suspect;
    g.negative_qty_count += r.logic_error;
    g.lot_missing_count += r.lot_missing;
    g._trust += Number(r.trust_score);
  }
  return [...by.values()].map((g) => ({
    location_id: g.location_id,
    sku_positions: g.sku_positions,
    total_on_hand: g.total_on_hand,
    phantom_suspect_count: g.phantom_suspect_count,
    negative_qty_count: g.negative_qty_count,
    lot_missing_count: g.lot_missing_count,
    avg_trust_score: Number((g._trust / g.sku_positions).toFixed(3)),
    cycle_count_events: int(40, 400),
    avg_cycle_count_variance: dec(0.5, 12.5),
  })).sort((a, b) => a.location_id.localeCompare(b.location_id));
}

// IRA over time needs a fact with a date on it. gold_supply_chain_health is
// DC-grain with no date column, so Avg([IRA %]) is the same number in every
// month by construction — a trend chart built on it draws a flat line and looks
// broken. This is the same aggregation at DC x month grain, emitted as its own
// table so the 12-row estate table, and the 74% headline read off it, are
// untouched.
function buildSupplyChainHealthMonthly(inventory) {
  const by = new Map();
  for (const r of inventory) {
    const month = String(r.snapshot_timestamp).slice(0, 7); // YYYY-MM
    const key = r.location_id + '|' + month;
    let g = by.get(key);
    if (!g) {
      g = { location_id: r.location_id, snapshot_month: month, sku_positions: 0,
            total_on_hand: 0, phantom_suspect_count: 0, lot_missing_count: 0, _trust: 0 };
      by.set(key, g);
    }
    g.sku_positions++;
    g.total_on_hand += Math.max(0, Number(r.quantity_on_hand));
    g.phantom_suspect_count += r.phantom_suspect;
    g.lot_missing_count += r.lot_missing;
    g._trust += Number(r.trust_score);
  }
  return [...by.values()].map((g) => ({
    location_id: g.location_id,
    snapshot_month: g.snapshot_month,
    // First of the month, so the app can key it straight to a master calendar.
    snapshot_month_start: g.snapshot_month + '-01',
    sku_positions: g.sku_positions,
    total_on_hand: g.total_on_hand,
    phantom_suspect_count: g.phantom_suspect_count,
    lot_missing_count: g.lot_missing_count,
    avg_trust_score: Number((g._trust / g.sku_positions).toFixed(3)),
  })).sort((a, b) => (a.snapshot_month + a.location_id).localeCompare(b.snapshot_month + b.location_id));
}

// Postal codes have to match their country. Emitting a Dutch "1234 AB" for a French
// address makes every downstream format check fail, which drowns the stewardship queue
// in noise and makes an address validator look broken when it is working correctly.
// The malformed tail is deliberate and bounded: it is exactly the rows that already
// carry a low quality score, so the format faults and the quality score agree.
const PC_LETTER = () => String.fromCharCode(65 + int(0, 25));
const POSTAL_BY_COUNTRY = {
  NL: () => `${int(1000, 9999)} ${PC_LETTER()}${PC_LETTER()}`,
  DE: () => String(int(10000, 99999)),
  FR: () => String(int(10000, 99999)),
  ES: () => String(int(1000, 52999)).padStart(5, '0'),
  IT: () => String(int(10000, 98999)),
  PL: () => `${String(int(0, 99)).padStart(2, '0')}-${int(100, 999)}`,
};

// DE, FR, ES and IT all use five digits, so borrowing one of those formats for another
// of them produces a code that is indistinguishable from correct. Group by SHAPE and
// borrow from a different shape, otherwise a third of the "broken" tail silently
// validates and the stewardship queue is short by rows that are genuinely wrong.
const POSTAL_SHAPE = { NL: 'alnum', PL: 'dashed', DE: 'five', FR: 'five', ES: 'five', IT: 'five' };

/** A correctly shaped code for `country`, or a detectably wrong-shaped one when `broken`. */
function postalCode(country, broken) {
  if (broken) {
    const own = POSTAL_SHAPE[country];
    const others = COUNTRIES.filter((c) => POSTAL_SHAPE[c] !== own);
    if (others.length) return POSTAL_BY_COUNTRY[pick(others)]();
  }
  return (POSTAL_BY_COUNTRY[country] || POSTAL_BY_COUNTRY.NL)();
}

function buildAddresses() {
  const std = [], geo = [];
  for (let i = 0; i < COUNTS.contacts; i++) {
    const id = 'CON-' + String(500000 + i);
    const country = pick(COUNTRIES);
    const city = pick(CITIES[country]);
    const fn = pick(FIRST), ln = pick(LAST);
    // The unresolved tail is what feeds the Address Cleanup stewardship sprint.
    const unresolved = i < HEADLINES.addressesUnresolved;
    const quality = unresolved ? dec(0.15, 0.55) : dec(0.72, 0.99);
    std.push({
      contact_id: id, first_name: fn, last_name: ln,
      email: `${fn.toLowerCase().replace(/ /g, '')}.${ln.toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
      city, state_region: country === 'NL' ? 'Zuid-Holland' : '',
      postal_code: postalCode(country, unresolved),
      country_iso: country,
      address_quality_score: quality,
    });
    geo.push({
      contact_id: id,
      street_validated: unresolved ? '' : `${pick(['Keizersgracht', 'Hauptstrasse', 'Rue de Rivoli', 'Gran Via'])} ${int(1, 900)}`,
      city_validated: unresolved ? '' : city,
      postal_code_validated: unresolved ? '' : postalCode(country, false),
      country_validated: unresolved ? '' : country,
      latitude: unresolved ? '' : dec(36, 60, 5),
      longitude: unresolved ? '' : dec(-9, 24, 5),
      geo_confidence: unresolved ? '' : dec(0.6, 0.99),
      validation_status: unresolved ? 'UNRESOLVED' : 'RESOLVED',
      validated_at_utc: iso(BASE - int(0, 14) * DAY),
    });
  }
  return { std, geo };
}

function buildShipments() {
  const rows = [];
  for (let i = 0; i < COUNTS.shipments; i++) {
    const carrier = pick(CARRIERS);
    const canonical = pick(Object.keys(STATUS_RAW));
    const dc = pick(DCS);
    const country = pick(COUNTRIES);
    const est = BASE - int(0, 60) * DAY;
    const delivered = canonical === 'DELIVERED';
    // "Delivered" with no timestamp is one of the carrier-vocabulary defects.
    const noTimestamp = delivered && chance(0.09);
    rows.push({
      shipment_id: 'SHP-' + String(700000 + i),
      tracking_number: chance(0.42) ? '' : carrier.slice(0, 3) + int(10000000, 99999999),
      carrier_code: carrier,
      order_id: 'ORD-' + String(300000 + int(0, COUNTS.orders - 1)),
      shipment_status_raw: pick(STATUS_RAW[canonical]),
      shipment_status: canonical,
      status_datetime_raw: iso(est),
      origin_facility: dc.id,
      destination_city: pick(CITIES[country]),
      destination_country: country,
      estimated_delivery: day(est),
      actual_delivery: delivered && !noTimestamp ? day(est + int(-1, 6) * DAY) : '',
      delivery_attempts: int(1, 3),
      exception_code: canonical === 'EXCEPTION' ? pick(EXCEPTIONS.filter(Boolean)) : '',
      weight_kg: dec(0.2, 40, 2),
      delivered_without_timestamp: noTimestamp ? 1 : 0,
    });
  }
  return rows;
}

// A missing tracking number multiplies the odds of a late delivery. The multiplier and
// the renormalising constant live together so the headline on-time rates survive: the
// mean multiplier across all orders is (P*M + (1-P)), so dividing by it leaves the
// expected lateness per carrier unchanged.
const P_TRACK_MISSING = 0.42;
const TRACK_LATE_MULT = 2.4;
const LATE_K = 1 / (P_TRACK_MISSING * TRACK_LATE_MULT + (1 - P_TRACK_MISSING));

function buildOrders(products, addresses) {
  const rows = [];
  for (let i = 0; i < COUNTS.orders; i++) {
    const carrier = pick(CARRIERS);
    const p = products[int(0, products.length - 1)];
    const orderDate = BASE - int(0, 180) * DAY;
    const promised = orderDate + int(2, 5) * DAY;
    // NinjaVan runs at the quoted 69% on-time after the AMD3 reclassification;
    // everyone else sits near the 92% target. But lateness is NOT a pure function of
    // the carrier: a parcel that never received a tracking number is materially more
    // likely to arrive late, because nobody can chase what has no identifier. That is
    // the demo's whole point — the data gap predicts the failure — so it has to be in
    // the data. When tracking_missing was an independent coin flip, Qlik Predict
    // correctly reported carrier_code as the ONLY feature with any influence, and the
    // narration's claim about missing tracking numbers was contradicted on screen.
    const trackingMissing = chance(P_TRACK_MISSING);
    const baseLate = 1 - (carrier === 'NINJAVAN'
      ? HEADLINES.ninjavanOnTime
      : HEADLINES.onTimeTarget);
    // LATE_K renormalises so the per-carrier on-time rates still land on the quoted
    // headline figures once the tracking-number effect is applied.
    const onTime = !chance(Math.min(0.97,
      baseLate * LATE_K * (trackingMissing ? TRACK_LATE_MULT : 1)));
    const daysLate = onTime ? 0 : int(1, 9);
    const actual = promised + daysLate * DAY;
    const canonical = chance(0.88) ? 'DELIVERED' : pick(['IN_TRANSIT', 'EXCEPTION', 'OUT_FOR_DELIVERY']);
    rows.push({
      order_id: 'ORD-' + String(300000 + i),
      contact_id: addresses[int(0, addresses.length - 1)].contact_id,
      order_date: day(orderDate),
      sku: p.sku,
      product_name: p.product_name,
      fulfillment_method: pick(['STANDARD', 'EXPRESS', 'CLICK_COLLECT']),
      carrier_code: carrier,
      tracking_number: trackingMissing ? '' : carrier.slice(0, 3) + int(10000000, 99999999),
      order_status: canonical,
      promised_delivery: day(promised),
      actual_delivery: canonical === 'DELIVERED' ? day(actual) : '',
      tracking_missing: trackingMissing ? 1 : 0,
      delivered_late: !onTime ? 1 : 0,
      days_late: daysLate,
      // "Where is my order" is driven by the data gap, not just by lateness.
      wismo_flag: (trackingMissing && chance(0.55)) || (!onTime && chance(0.4)) ? 1 : 0,
      shipment_id: 'SHP-' + String(700000 + int(0, COUNTS.shipments - 1)),
      carrier_status_raw: pick(STATUS_RAW[canonical] || STATUS_RAW.DELIVERED),
      // Attempts and exception codes are consequences of a failed delivery, so they
      // carry real signal instead of noise. The distributions deliberately OVERLAP:
      // a clean split (1 attempt => always on time, 3 => always late) is leakage, and
      // the model then scores ~1.0 on that one column and ignores everything else.
      delivery_attempts: onTime
        ? (chance(0.72) ? 1 : (chance(0.80) ? 2 : (chance(0.70) ? 3 : 4)))
        : (chance(0.35) ? 1 : (chance(0.50) ? 2 : int(3, 4))),
      exception_code: onTime
        ? (chance(0.85) ? '' : pick(EXCEPTIONS.filter((e) => e !== '')))
        : (chance(0.45) ? '' : pick(EXCEPTIONS.filter((e) => e !== ''))),
    });
  }
  return rows;
}

// gold.last_mile_performance aggregates silver.order_delivery_timeline the same way
// gold.supply_chain_health aggregates inventory — derived, not invented.
function buildLastMile(orders, addressByContact) {
  const by = new Map();
  for (const o of orders) {
    const key = o.carrier_code + '|' + (addressByContact.get(o.contact_id) || 'NL');
    let g = by.get(key);
    if (!g) {
      g = { carrier_code: o.carrier_code, destination_country: key.split('|')[1],
            orders: 0, delivered_orders: 0, late_deliveries: 0, _daysLate: 0,
            wismo_inquiries: 0, tracking_missing_count: 0, _quality: 0, _q: 0 };
      by.set(key, g);
    }
    g.orders++;
    if (o.order_status === 'DELIVERED') g.delivered_orders++;
    if (o.delivered_late) { g.late_deliveries++; g._daysLate += o.days_late; }
    g.wismo_inquiries += o.wismo_flag;
    g.tracking_missing_count += o.tracking_missing;
  }
  return [...by.values()].map((g) => ({
    carrier_code: g.carrier_code,
    destination_country: g.destination_country,
    orders: g.orders,
    delivered_orders: g.delivered_orders,
    late_deliveries: g.late_deliveries,
    on_time_rate: Number((1 - g.late_deliveries / Math.max(1, g.orders)).toFixed(4)),
    avg_days_late: Number((g._daysLate / Math.max(1, g.late_deliveries)).toFixed(2)),
    wismo_inquiries: g.wismo_inquiries,
    wismo_rate: Number((g.wismo_inquiries / Math.max(1, g.orders)).toFixed(4)),
    tracking_missing_count: g.tracking_missing_count,
    avg_address_quality: dec(0.62, 0.94, 3),
  })).sort((a, b) => a.carrier_code.localeCompare(b.carrier_code)
                  || a.destination_country.localeCompare(b.destination_country));
}

function buildIot() {
  const rows = [];
  for (let i = 0; i < COUNTS.iotReadings; i++) {
    const dc = pick(DCS);
    // GRU-BA is the Sao Paulo -> Buenos Aires route that runs 4x the exceedance rate
    // after the TransFrio fleet change — the pattern Qlik Predict is meant to surface.
    const route = chance(0.18) ? 'GRU-BA-001' : pick(['RTD-HAM-004', 'PAR-MAD-002', 'MIL-WAW-007', 'AMS-LYO-003']);
    const hot = route === 'GRU-BA-001' ? chance(0.088) : chance(0.021);
    const fahrenheit = chance(0.08);           // 8% of sensors report °F
    const tempC = hot ? dec(8.2, 14.5) : dec(1.5, 7.8);
    const battery = int(3, 100);
    const gpsGap = chance(0.02);
    rows.push({
      sensor_id: 'SEN-' + String(9000 + (i % 620)),
      shipment_id: 'SHP-' + String(700000 + int(0, COUNTS.shipments - 1)),
      timestamp: iso(BASE - int(0, 45) * DAY - int(0, 86399) * 1000),
      temperature_value: fahrenheit ? Number((tempC * 9 / 5 + 32).toFixed(2)) : tempC,
      temperature_unit: fahrenheit ? 'F' : 'C',
      temperature_c: tempC,
      humidity_pct: dec(28, 92, 1),
      light_exposure: chance(0.05) ? 1 : 0,
      shock_detected: chance(0.04) ? 1 : 0,
      gps_latitude: gpsGap ? '' : dec(-34, 60, 5),
      gps_longitude: gpsGap ? '' : dec(-58, 24, 5),
      gps_gap: gpsGap ? 1 : 0,
      battery_level_pct: battery,
      battery_low: battery < 15 ? 1 : 0,
      sensor_unregistered: chance(0.03) ? 1 : 0,
      alert_flag: hot ? 1 : 0,
      warehouse_id: dc.id,
      route_id: route,
    });
  }
  return rows;
}

function buildCarrierEvents() {
  const rows = [];
  for (let i = 0; i < COUNTS.carrierEvents; i++) {
    const carrier = pick(CARRIERS);
    const canonical = pick(Object.keys(STATUS_RAW));
    rows.push({
      event_id: 'EVT-' + String(800000 + i),
      shipment_id: 'SHP-' + String(700000 + int(0, COUNTS.shipments - 1)),
      carrier_code: carrier,
      // Raw, unmapped, multi-language — this is bronze, before canonicalization.
      status_raw: pick(STATUS_RAW[canonical]),
      status_language: pick(['en', 'de', 'pt']),
      event_timestamp_raw: iso(BASE - int(0, 45) * DAY),
      location_city: pick(CITIES[pick(COUNTRIES)]),
      payload_received_utc: iso(BASE - int(0, 45) * DAY),
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
//  Main
// ---------------------------------------------------------------------------
function main() {
  const argOut = process.argv.indexOf('--out');
  const outDir = argOut > -1 ? process.argv[argOut + 1] : path.join(__dirname, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Generating lakehouse CSV into', outDir, '\n');

  const products = buildProducts();
  const inventory = buildInventory(products);
  const scHealth = buildSupplyChainHealth(inventory);
  const scHealthMonthly = buildSupplyChainHealthMonthly(inventory);
  const { std: addresses, geo } = buildAddresses();
  const shipments = buildShipments();
  const orders = buildOrders(products, addresses);
  const addrCountry = new Map(addresses.map((a) => [a.contact_id, a.country_iso]));
  const lastMile = buildLastMile(orders, addrCountry);
  const iot = buildIot();
  const carrierEvents = buildCarrierEvents();

  writeCsv(outDir, 'gold_supply_chain_health.csv', Object.keys(scHealth[0]), scHealth);
  writeCsv(outDir, 'gold_supply_chain_health_monthly.csv', Object.keys(scHealthMonthly[0]), scHealthMonthly);
  writeCsv(outDir, 'gold_last_mile_performance.csv', Object.keys(lastMile[0]), lastMile);
  writeCsv(outDir, 'silver_inventory_reconciled.csv', Object.keys(inventory[0]), inventory);
  writeCsv(outDir, 'silver_products_harmonized.csv', Object.keys(products[0]), products);
  writeCsv(outDir, 'silver_iot_normalized.csv', Object.keys(iot[0]), iot);
  writeCsv(outDir, 'silver_order_delivery_timeline.csv', Object.keys(orders[0]), orders);
  writeCsv(outDir, 'silver_shipments_canonical.csv', Object.keys(shipments[0]), shipments);
  writeCsv(outDir, 'silver_addresses_standardized.csv', Object.keys(addresses[0]), addresses);
  writeCsv(outDir, 'bronze_iot_carrier_events.csv', Object.keys(carrierEvents[0]), carrierEvents);
  writeCsv(outDir, 'MCG_CRM_Addresses_Validated.csv', Object.keys(geo[0]), geo);

  // Prove the generated data actually tells the story the narration tells.
  const pos = scHealth.reduce((s, g) => s + g.sku_positions, 0);
  const ph = scHealth.reduce((s, g) => s + g.phantom_suspect_count, 0);
  const rtd = scHealth.find((g) => g.location_id === 'DC-RTD-01');
  const nv = lastMile.filter((g) => g.carrier_code === 'NINJAVAN');
  const nvRate = nv.reduce((s, g) => s + g.on_time_rate * g.orders, 0) / nv.reduce((s, g) => s + g.orders, 0);

  console.log('\nHeadline check (these must match the narration):');
  console.log(`  IRA overall            ${((1 - ph / pos) * 100).toFixed(1)}%   (target 74%)`);
  const mPos = scHealthMonthly.reduce((s2, g) => s2 + g.sku_positions, 0);
  const mPh = scHealthMonthly.reduce((s2, g) => s2 + g.phantom_suspect_count, 0);
  const months = new Set(scHealthMonthly.map((g) => g.snapshot_month)).size;
  console.log(`  IRA monthly reconciles ${((1 - mPh / mPos) * 100).toFixed(1)}%   (must equal the line above, over ${months} months)`);
  console.log(`  DC-RTD-01 trust score  ${rtd.avg_trust_score.toFixed(2)}    (target 0.31)`);
  console.log(`  Healthy DC trust       ${(scHealth.filter(g => g.location_id !== 'DC-RTD-01')
      .reduce((s, g) => s + g.avg_trust_score, 0) / (scHealth.length - 1)).toFixed(2)}    (target 0.89)`);
  console.log(`  SKUs missing weight    ${products.filter((p) => p.weight_kg === '').length}    (target ${HEADLINES.skusMissingWeight})`);
  console.log(`  Unresolved addresses   ${geo.filter((g) => g.validation_status === 'UNRESOLVED').length}     (target ${HEADLINES.addressesUnresolved})`);
  console.log(`  Lot-number violations  ${inventory.filter((r) => r.lot_missing).length}    (target ~${HEADLINES.lotViolations})`);
  console.log(`  NinjaVan on-time       ${(nvRate * 100).toFixed(1)}%   (target 69%)`);
}

main();
