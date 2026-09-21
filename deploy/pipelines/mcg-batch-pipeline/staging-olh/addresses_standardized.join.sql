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
  c.Id AS contact_id,
  c.FirstName AS first_name,
  c.LastName AS last_name,
  c.Email AS email,
  c.Phone AS phone,
  c.MailingStreet AS street_raw,
  CASE
    WHEN UPPER(TRIM(c.MailingCity)) IN ('A''DAM', 'AMSTERDAM') THEN 'AMSTERDAM'
    WHEN UPPER(TRIM(c.MailingCity)) IN ('R''DAM', 'ROTTERDAM') THEN 'ROTTERDAM'
    ELSE UPPER(TRIM(c.MailingCity))
  END AS city,
  CASE
    WHEN UPPER(TRIM(c.MailingState)) IN ('NH', 'NOORD-HOLLAND', 'NORTH HOLLAND') THEN 'NOORD-HOLLAND'
    WHEN UPPER(TRIM(c.MailingState)) IN ('ZH', 'ZUID-HOLLAND', 'SOUTH HOLLAND') THEN 'ZUID-HOLLAND'
    ELSE UPPER(TRIM(c.MailingState))
  END AS state_region,
  UPPER(REPLACE(c.MailingPostalCode, ' ', '')) AS postal_code,
  CASE
    WHEN UPPER(TRIM(c.MailingCountry)) IN ('NL', 'NETHERLANDS', 'NIEDERLANDE', 'NEDERLAND', 'THE NETHERLANDS') THEN 'NL'
    WHEN UPPER(TRIM(c.MailingCountry)) IN ('DE', 'GERMANY', 'DEUTSCHLAND') THEN 'DE'
    WHEN UPPER(TRIM(c.MailingCountry)) IN ('GB', 'UK', 'UNITED KINGDOM') THEN 'GB'
    WHEN UPPER(TRIM(c.MailingCountry)) IN ('US', 'USA', 'UNITED STATES') THEN 'US'
    ELSE UPPER(TRIM(c.MailingCountry))
  END AS country_iso,

  -- Talend's repaired values win where they exist.
  COALESCE(g.street_clean, c.MailingStreet)      AS street_clean,
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
    (CASE WHEN c.MailingStreet     IS NOT NULL AND TRIM(c.MailingStreet)     <> '' THEN 0.25 ELSE 0.0 END
     + CASE WHEN c.MailingCity     IS NOT NULL AND TRIM(c.MailingCity)       <> '' THEN 0.25 ELSE 0.0 END
     + CASE WHEN c.MailingPostalCode IS NOT NULL AND TRIM(c.MailingPostalCode) <> '' THEN 0.25 ELSE 0.0 END
     + CASE WHEN c.MailingCountry  IS NOT NULL AND TRIM(c.MailingCountry)    <> '' THEN 0.25 ELSE 0.0 END)
  ) AS address_quality_score

FROM sf_contacts c
LEFT JOIN addresses_geocoded g
  ON g.contact_id = c.Id
