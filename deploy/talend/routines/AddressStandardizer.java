package routines;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * MCG Demo - free replacement for the subscription-only Talend Data Quality
 * component tAddressRowStandardize.
 *
 * Parses, repairs and canonicalizes an international mailing address using only
 * the JDK - no Data Quality licence, no postal reference data subscription.
 * Emits the same status vocabulary the paid component produced
 * (VALID / CORRECTED / AMBIGUOUS / INVALID) so everything downstream keeps working.
 *
 * Used by mcg_sf_address_validate, tMap "map_standardize":
 *   Var.std = AddressStandardizer.standardize(row1.Id, row1.MailingStreet,
 *                 row1.MailingCity, row1.MailingState,
 *                 row1.MailingPostalCode, row1.MailingCountry)
 *
 * This class owns the country + postal rules for the whole job; AddressValidator
 * delegates to it so the rules live in exactly one place.
 *
 * Java 8 compatible.
 */
public class AddressStandardizer {

    /** Score at or above which an address is considered clean on format alone. */
    public static final double VALID_THRESHOLD = 0.90;

    /** Carrier for one standardized address as it moves through the job. */
    public static class Result {
        public String contactId;
        public String firstName;
        public String lastName;
        public String email;

        /* raw input - preserved for the steward and for lineage */
        public String streetRaw;
        public String cityRaw;
        public String stateRaw;
        public String postalRaw;
        public String countryRaw;

        /* standardized output */
        public String streetClean;
        public String houseNumber;
        public String unitType;     // canonical APT | STE | FL | null
        public String unitNumber;
        public String floor;
        public String cityClean;
        public String stateClean;
        public String postalClean;
        public String countryIso;

        /* geocoding - filled in by BulkGeocoder, null until then */
        public Double latitude;
        public Double longitude;
        public Double geoConfidence;
        public String geoDisplayName;

        /* verdict */
        public double qualityScore;   // 0.0 - 1.0
        public String status;         // VALID|CORRECTED|AMBIGUOUS|INVALID -> then GEOCODED|UNRESOLVED
        public final List<String> corrections = new ArrayList<String>();

        /**
         * THE ROUTING GATE.
         * GPS resolved -> Open Lakehouse. No GPS -> Qlik Stewardship.
         */
        public boolean hasGps() {
            return latitude != null && longitude != null;
        }

        /** Free-text query for the geocoder; joins whatever survived standardization. */
        public String geocodeQuery() {
            StringBuilder q = new StringBuilder();
            String[] parts = new String[] { streetClean, cityClean, postalClean, countryIso };
            for (String part : parts) {
                if (part != null && !part.trim().isEmpty()) {
                    if (q.length() > 0) q.append(", ");
                    q.append(part.trim());
                }
            }
            return q.toString();
        }

        /** Corrections as a JSON array string - lands in the corrections_applied column. */
        public String correctionsJson() {
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < corrections.size(); i++) {
                if (i > 0) sb.append(",");
                String c = corrections.get(i).replace("\\", "\\\\").replace("\"", "\\\"");
                sb.append("\"").append(c).append("\"");
            }
            return sb.append("]").toString();
        }

        /** Human-readable reason the record needs a steward - shown in the campaign. */
        public String stewardshipReason() {
            if (countryIso == null) return "Unrecognized country: " + nz(countryRaw);
            if (postalClean == null) return "Postal code not valid for " + countryIso + ": " + nz(postalRaw);
            if (streetClean == null || streetClean.trim().isEmpty()) return "Missing or unusable street";
            if (cityClean == null || cityClean.trim().isEmpty()) return "Missing or unusable city";
            return "Address could not be located by the geocoder";
        }

        void note(String correction) {
            corrections.add(correction);
        }

        private static String nz(String s) {
            return (s == null || s.trim().isEmpty()) ? "(empty)" : s.trim();
        }
    }

    // ---------------------------------------------------------------- country

    private static final Map<String, String> COUNTRY_ISO = new LinkedHashMap<String, String>();
    static {
        alias("NL", "NL", "NLD", "NETHERLANDS", "THE NETHERLANDS", "NEDERLAND", "NIEDERLANDE", "HOLLAND", "PAYS-BAS");
        alias("DE", "DE", "DEU", "GER", "GERMANY", "DEUTSCHLAND", "ALLEMAGNE");
        alias("GB", "GB", "GBR", "UK", "UNITED KINGDOM", "GREAT BRITAIN", "ENGLAND", "SCOTLAND", "WALES");
        alias("US", "US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA", "U.S.", "U.S.A.");
        alias("SG", "SG", "SGP", "SINGAPORE", "SINGAPUR", "REPUBLIC OF SINGAPORE");
        alias("JP", "JP", "JPN", "JAPAN", "JAPON", "NIPPON");
        alias("BR", "BR", "BRA", "BRAZIL", "BRASIL", "BRESIL");
        alias("NG", "NG", "NGA", "NIGERIA", "FEDERAL REPUBLIC OF NIGERIA");
    }
    private static void alias(String iso, String... names) {
        for (String n : names) COUNTRY_ISO.put(n, iso);
    }

    /**
     * ISO 3166-1 alpha-2 for the supported demo markets, or null when unknown.
     *
     * {talendTypes} String
     * {Category} MCG
     * {param} string(country) country: raw country text
     * {example} countryIso("Nederland") # NL
     */
    public static String countryIso(String country) {
        if (country == null) return null;
        String c = country.trim().toUpperCase(Locale.ROOT);
        if (c.isEmpty()) return null;
        return COUNTRY_ISO.get(c);
    }

    // ----------------------------------------------------------------- postal

    private static final Map<String, Pattern> POSTAL_CANONICAL = new LinkedHashMap<String, Pattern>();
    static {
        POSTAL_CANONICAL.put("NL", Pattern.compile("^\\d{4} [A-Z]{2}$"));
        POSTAL_CANONICAL.put("DE", Pattern.compile("^\\d{5}$"));
        POSTAL_CANONICAL.put("GB", Pattern.compile("^[A-Z]{1,2}\\d[A-Z\\d]? \\d[A-Z]{2}$"));
        POSTAL_CANONICAL.put("US", Pattern.compile("^\\d{5}(-\\d{4})?$"));
        POSTAL_CANONICAL.put("SG", Pattern.compile("^\\d{6}$"));
        POSTAL_CANONICAL.put("JP", Pattern.compile("^\\d{3}-\\d{4}$"));
        POSTAL_CANONICAL.put("BR", Pattern.compile("^\\d{5}-\\d{3}$"));
        POSTAL_CANONICAL.put("NG", Pattern.compile("^\\d{6}$"));
    }

    /** True when the postal code is already in its country's canonical form. */
    public static boolean isCanonicalPostal(String postal, String iso) {
        if (postal == null || iso == null) return false;
        Pattern p = POSTAL_CANONICAL.get(iso);
        return p != null && p.matcher(postal.trim().toUpperCase(Locale.ROOT)).matches();
    }

    /**
     * Repair a postal code into its country's canonical form, or null when the
     * input cannot be made to fit (which forces the record toward stewardship).
     *
     * {talendTypes} String
     * {Category} MCG
     * {example} standardizePostal("1017ej", "NL") # 1017 EJ
     */
    public static String standardizePostal(String postal, String iso) {
        if (postal == null || iso == null) return null;
        String p = postal.trim().toUpperCase(Locale.ROOT).replaceAll("[\\s\\-\\.]", "");
        if (p.isEmpty()) return null;

        if ("NL".equals(iso)) {
            Matcher m = Pattern.compile("^(\\d{4})([A-Z]{2})$").matcher(p);
            return m.matches() ? m.group(1) + " " + m.group(2) : null;
        }
        if ("DE".equals(iso)) {
            return p.matches("\\d{5}") ? p : null;
        }
        if ("GB".equals(iso)) {
            Matcher m = Pattern.compile("^([A-Z]{1,2}\\d[A-Z\\d]?)(\\d[A-Z]{2})$").matcher(p);
            return m.matches() ? m.group(1) + " " + m.group(2) : null;
        }
        if ("US".equals(iso)) {
            if (p.matches("\\d{5}")) return p;
            Matcher m = Pattern.compile("^(\\d{5})(\\d{4})$").matcher(p);
            return m.matches() ? m.group(1) + "-" + m.group(2) : null;
        }
        if ("SG".equals(iso) || "NG".equals(iso)) {
            return p.matches("\\d{6}") ? p : null;
        }
        if ("JP".equals(iso)) {
            Matcher m = Pattern.compile("^(\\d{3})(\\d{4})$").matcher(p);
            return m.matches() ? m.group(1) + "-" + m.group(2) : null;
        }
        if ("BR".equals(iso)) {
            Matcher m = Pattern.compile("^(\\d{5})(\\d{3})$").matcher(p);
            return m.matches() ? m.group(1) + "-" + m.group(2) : null;
        }
        return null;
    }

    // ----------------------------------------------------- street + unit rules

    /** Street-type abbreviations per market, longest-first so "Str." wins over "St". */
    private static final Map<String, String[][]> STREET_ABBREV = new LinkedHashMap<String, String[][]>();
    static {
        // NB: Dutch and German street types are SUFFIXES glued to the name
        // ("Kurfurstenstr."), so these patterns must NOT start with \b - there is
        // no word boundary mid-word and the rule would never fire.
        STREET_ABBREV.put("NL", new String[][] {
            { "(?i)str\\.", "straat" }, { "(?i)gr\\.", "gracht" },
            { "(?i)\\bln\\.?\\b", "laan" }, { "(?i)pln\\.?\\b", "plein" },
            { "(?i)\\bwg\\.?\\b", "weg" }
        });
        STREET_ABBREV.put("DE", new String[][] {
            { "(?i)str\\.", "straße" }, { "(?i)pl\\.", "Platz" },
            { "(?i)\\bg\\.\\b", "Gasse" }, { "(?i)\\ballee\\b", "Allee" }
        });
        STREET_ABBREV.put("BR", new String[][] {
            { "(?i)^r\\.", "Rua" }, { "(?i)\\bav\\.", "Avenida" },
            { "(?i)\\bal\\.", "Alameda" }, { "(?i)\\btrav\\.", "Travessa" },
            { "(?i)\\bpca\\.?\\b", "Praça" }
        });
        String[][] anglo = new String[][] {
            { "(?i)\\bst\\.?\\b", "Street" }, { "(?i)\\brd\\.?\\b", "Road" },
            { "(?i)\\bave?\\.?\\b", "Avenue" }, { "(?i)\\bblvd\\.?\\b", "Boulevard" },
            { "(?i)\\bln\\.?\\b", "Lane" }, { "(?i)\\bdr\\.?\\b", "Drive" },
            { "(?i)\\bct\\.?\\b", "Court" }, { "(?i)\\bpl\\.?\\b", "Place" }
        };
        STREET_ABBREV.put("GB", anglo);
        STREET_ABBREV.put("US", anglo);
        STREET_ABBREV.put("SG", anglo);
        STREET_ABBREV.put("NG", anglo);
        STREET_ABBREV.put("JP", new String[][] { { "(?i)\\bchome\\b", "Chome" } });
    }

    /** Secondary-unit markers -> canonical APT / STE / FL, multilingual. */
    private static final String[][] UNIT_MARKERS = new String[][] {
        { "(?i)\\b(apartment|appartement|apartamento|apt|appt|ap)\\.?\\s*#?\\s*([0-9A-Za-z\\-]+)", "APT" },
        { "(?i)\\b(wohnung|whg)\\.?\\s*#?\\s*([0-9A-Za-z\\-]+)",                                    "APT" },
        { "(?i)\\b(suite|ste|conjunto|cj|sala)\\.?\\s*#?\\s*([0-9A-Za-z\\-]+)",                     "STE" },
        { "(?i)\\b(unit|bloco|blk)\\.?\\s*#?\\s*([0-9A-Za-z\\-]+)",                                 "STE" },
        { "(?i)\\b(floor|andar|etage|verdieping|fl)\\.?\\s*#?\\s*([0-9A-Za-z\\-]+)",                "FL"  },
        { "(?i)\\b([0-9]+)\\.?\\s*(og|obergeschoss)\\b",                                            "FL"  }
    };

    /** Everything the standardizer strips out of a raw street before parsing. */
    private static final Pattern MULTISPACE = Pattern.compile("\\s{2,}");

    // ------------------------------------------------------------- entry point

    /**
     * Standardize one address. Never throws and never returns null - a hopeless
     * record comes back with status INVALID and a low qualityScore.
     *
     * {talendTypes} Object
     * {Category} MCG
     * {param} string(contactId) contactId: Salesforce Id
     * {param} string(street) street: MailingStreet
     * {param} string(city) city: MailingCity
     * {param} string(state) state: MailingState
     * {param} string(postal) postal: MailingPostalCode
     * {param} string(country) country: MailingCountry
     */
    public static Result standardize(String contactId, String street, String city,
                                     String state, String postal, String country) {
        Result r = new Result();
        r.contactId = contactId;
        r.streetRaw = street;
        r.cityRaw = city;
        r.stateRaw = state;
        r.postalRaw = postal;
        r.countryRaw = country;

        // 1. country -> ISO
        r.countryIso = countryIso(country);
        if (r.countryIso == null && country != null && !country.trim().isEmpty()) {
            r.note("Country '" + country.trim() + "' not recognized");
        } else if (r.countryIso != null && !r.countryIso.equalsIgnoreCase(trim(country))) {
            r.note("Normalized country '" + trim(country) + "' to " + r.countryIso);
        }

        // 2. postal -> canonical
        boolean postalWasCanonical = isCanonicalPostal(postal, r.countryIso);
        r.postalClean = standardizePostal(postal, r.countryIso);
        if (r.postalClean != null && !postalWasCanonical) {
            r.note("Reformatted postal code '" + trim(postal) + "' to '" + r.postalClean + "'");
        } else if (r.postalClean == null && r.countryIso != null) {
            r.note("Postal code '" + trim(postal) + "' does not match the " + r.countryIso + " pattern");
        }

        // 3. city
        r.cityClean = standardizeCity(city, r);

        // 4. state / region
        r.stateClean = standardizeState(state, r.countryIso);

        // 5. street: extract unit + floor, expand abbreviations, pull house number
        parseStreet(street, r);

        // 6. score + status
        score(r, postalWasCanonical);
        return r;
    }

    private static String standardizeCity(String city, Result r) {
        if (city == null) return null;
        String c = collapse(city);
        if (c.isEmpty()) return null;
        // Dutch contractions the simulator injects
        String upper = c.toUpperCase(Locale.ROOT);
        if ("A'DAM".equals(upper) || "ADAM".equals(upper)) { r.note("Expanded city abbreviation to Amsterdam"); return "Amsterdam"; }
        if ("R'DAM".equals(upper) || "RDAM".equals(upper)) { r.note("Expanded city abbreviation to Rotterdam"); return "Rotterdam"; }
        if ("S-HAGE".equals(upper) || "DEN HAAG".equals(upper)) return "Den Haag";
        // strip stray digits / punctuation a free-text city field collects
        String cleaned = c.replaceAll("[0-9]+", "").replaceAll("[,;]+", " ").trim();
        cleaned = collapse(cleaned);
        if (!cleaned.equals(c)) r.note("Removed non-city characters from '" + c + "'");
        return cleaned.isEmpty() ? null : titleCase(cleaned);
    }

    private static String standardizeState(String state, String iso) {
        if (state == null) return null;
        String s = collapse(state);
        if (s.isEmpty()) return null;
        if ("NL".equals(iso)) {
            String u = s.toUpperCase(Locale.ROOT);
            if (u.equals("NH") || u.equals("NORTH HOLLAND") || u.equals("NOORD-HOLLAND")) return "Noord-Holland";
            if (u.equals("ZH") || u.equals("SOUTH HOLLAND") || u.equals("ZUID-HOLLAND")) return "Zuid-Holland";
        }
        if ("US".equals(iso) && s.length() == 2) return s.toUpperCase(Locale.ROOT);
        return titleCase(s);
    }

    private static void parseStreet(String street, Result r) {
        if (street == null || street.trim().isEmpty()) {
            r.note("Street is empty");
            return;
        }
        String s = collapse(street.replace("\n", " ").replace("\r", " "));

        // 5a. pull out unit / floor markers and remove them from the street line
        for (String[] marker : UNIT_MARKERS) {
            Matcher m = Pattern.compile(marker[0]).matcher(s);
            if (m.find()) {
                String canonical = marker[1];
                String value = "FL".equals(canonical) && m.groupCount() >= 2 && m.group(2) != null
                        && m.group(2).matches("(?i)og|obergeschoss") ? m.group(1) : m.group(m.groupCount());
                if ("FL".equals(canonical)) {
                    r.floor = value;
                } else {
                    r.unitType = canonical;
                    r.unitNumber = value;
                }
                if (!m.group(0).equalsIgnoreCase(canonical + " " + value)) {
                    r.note("Mapped '" + m.group(0).trim() + "' to " + canonical + " " + value);
                }
                s = collapse(m.replaceFirst(" "));
            }
        }
        s = collapse(s.replaceAll("[,;]\\s*$", ""));

        // 5b. expand street-type abbreviations for the country
        String[][] rules = r.countryIso == null ? null : STREET_ABBREV.get(r.countryIso);
        if (rules != null) {
            for (String[] rule : rules) {
                Matcher m = Pattern.compile(rule[0]).matcher(s);
                if (m.find()) {
                    // capture the matched text first - replaceAll resets the matcher,
                    // after which group() throws IllegalStateException
                    String matched = m.group(0).trim();
                    String before = s;
                    s = m.replaceAll(rule[1]);
                    if (!before.equals(s)) r.note("Expanded '" + matched + "' to '" + rule[1] + "'");
                }
            }
        }

        // 5c. house number: leading (BR/US style) or trailing (NL/DE style)
        Matcher trailing = Pattern.compile("^(.*?[\\p{L}\\.].*?)[,\\s]+(\\d+[A-Za-z]?(?:[-/]\\d+[A-Za-z]?)?)$").matcher(s);
        Matcher leading  = Pattern.compile("^(\\d+[A-Za-z]?)[,\\s]+(.*[\\p{L}].*)$").matcher(s);
        if (trailing.matches()) {
            r.streetClean = collapse(trailing.group(1)).replaceAll("[,\\s]+$", "");
            r.houseNumber = trailing.group(2);
        } else if (leading.matches()) {
            r.streetClean = collapse(leading.group(2));
            r.houseNumber = leading.group(1);
        } else {
            r.streetClean = s;
            r.note("Could not separate a house number from '" + s + "'");
        }
        if (r.streetClean != null) r.streetClean = collapse(r.streetClean);
    }

    /**
     * Quality score drives the campaign filter and the app's quality KPI.
     * Weighting mirrors what the paid validator charged for: a deliverable
     * address needs street + number + city + postal + country.
     */
    private static void score(Result r, boolean postalWasCanonical) {
        double s = 0.0;
        if (r.countryIso != null)                                   s += 0.25;
        if (r.postalClean != null)                                  s += 0.25;
        if (r.cityClean != null && !r.cityClean.isEmpty())          s += 0.20;
        if (r.streetClean != null && !r.streetClean.isEmpty())      s += 0.20;
        if (r.houseNumber != null)                                  s += 0.10;
        r.qualityScore = Math.round(s * 100.0) / 100.0;

        if (r.countryIso == null || r.streetClean == null || r.streetClean.isEmpty()) {
            r.status = "INVALID";
        } else if (r.qualityScore >= VALID_THRESHOLD && r.corrections.isEmpty() && postalWasCanonical) {
            r.status = "VALID";
        } else if (r.qualityScore >= VALID_THRESHOLD) {
            r.status = "CORRECTED";
        } else {
            r.status = "AMBIGUOUS";
        }
    }

    // ------------------------------------------------------------- small utils

    private static String trim(String s) { return s == null ? "" : s.trim(); }

    private static String collapse(String s) {
        if (s == null) return "";
        return MULTISPACE.matcher(s.trim()).replaceAll(" ");
    }

    private static String titleCase(String s) {
        if (s == null || s.isEmpty()) return s;
        StringBuilder sb = new StringBuilder(s.length());
        boolean up = true;
        for (char ch : s.toCharArray()) {
            if (Character.isLetter(ch)) {
                sb.append(up ? Character.toUpperCase(ch) : Character.toLowerCase(ch));
                up = false;
            } else {
                sb.append(ch);
                up = (ch == ' ' || ch == '-' || ch == '\'');
            }
        }
        return sb.toString();
    }
}
