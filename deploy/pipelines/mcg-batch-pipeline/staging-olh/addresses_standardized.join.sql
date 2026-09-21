-- Replacement expressionStatement for
--   qtcp_tasks/MCG Silver Transform/datasets/addresses_standardized.yaml
--
-- What changes vs. the version deployed today:
--   * real latitude / longitude / geo_confidence, joined from the Talend job's
--     GPS-resolved output instead of being absent entirely
--   * address_quality_score stops being the naive 0.25-per-populated-field rule
--     and uses the AddressStandardizer score when a geocoded row exists
--   * validation_status exposes GEOCODED vs UNRESOLVED so the app can split on it
--
-- LEFT JOIN, not INNER: contacts the Talend job has not processed yet must still
-- appear, just without coordinates.

SELECT
  c.contact_id AS contact_id,
  c.first_name AS first_name,
  c.last_name AS last_name,
  c.email AS email,
  c.phone AS phone,
  c.mailing_street AS street_raw,
  CASE
    WHEN UPPER(TRIM(c.mailing_city)) IN ('A''DAM', 'AMSTERDAM') THEN 'AMSTERDAM'
    WHEN UPPER(TRIM(c.mailing_city)) IN ('R''DAM', 'ROTTERDAM') THEN 'ROTTERDAM'
    ELSE UPPER(TRIM(c.mailing_city))
  END AS city,
  CASE
    WHEN UPPER(TRIM(c.mailing_state)) IN ('NH', 'NOORD-HOLLAND', 'NORTH HOLLAND') THEN 'NOORD-HOLLAND'
    WHEN UPPER(TRIM(c.mailing_state)) IN ('ZH', 'ZUID-HOLLAND', 'SOUTH HOLLAND') THEN 'ZUID-HOLLAND'
    ELSE UPPER(TRIM(c.mailing_state))
  END AS state_region,
  UPPER(REPLACE(c.mailing_postal_code, ' ', '')) AS postal_code,
  CASE
    WHEN UPPER(TRIM(c.mailing_country)) IN ('NL', 'NETHERLANDS', 'NIEDERLANDE', 'NEDERLAND', 'THE NETHERLANDS') THEN 'NL'
    WHEN UPPER(TRIM(c.mailing_country)) IN ('DE', 'GERMANY', 'DEUTSCHLAND') THEN 'DE'
    WHEN UPPER(TRIM(c.mailing_country)) IN ('GB', 'UK', 'UNITED KINGDOM') THEN 'GB'
    WHEN UPPER(TRIM(c.mailing_country)) IN ('US', 'USA', 'UNITED STATES') THEN 'US'
    ELSE UPPER(TRIM(c.mailing_country))
  END AS country_iso,

  -- Talend's repaired values win where they exist.
  COALESCE(g.street_clean, c.mailing_street)      AS street_clean,
  g.house_number,
  g.unit_type,
  g.unit_number,
  g.floor,
  g.latitude,
  g.longitude,
  g.geo_confidence,
  COALESCE(g.status, 'NOT_PROCESSED')            AS validation_status,
  g.corrections,
  g.validated_at_utc,

  -- Real score when the job has seen this contact; otherwise fall back to the
  -- old completeness heuristic so nothing regresses to NULL.
  COALESCE(
    g.quality_score,
    (CASE WHEN c.mailing_street     IS NOT NULL AND TRIM(c.mailing_street)     <> '' THEN 0.25 ELSE 0.0 END
     + CASE WHEN c.mailing_city     IS NOT NULL AND TRIM(c.mailing_city)       <> '' THEN 0.25 ELSE 0.0 END
     + CASE WHEN c.mailing_postal_code IS NOT NULL AND TRIM(c.mailing_postal_code) <> '' THEN 0.25 ELSE 0.0 END
     + CASE WHEN c.mailing_country  IS NOT NULL AND TRIM(c.mailing_country)    <> '' THEN 0.25 ELSE 0.0 END)
  ) AS address_quality_score

FROM crm_contacts c
LEFT JOIN addresses_geocoded g
  ON g.contact_id = c.contact_id
