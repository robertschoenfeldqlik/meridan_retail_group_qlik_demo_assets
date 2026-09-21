package routines;

/**
 * AddressFormatValidator - structural validation of a postal address, per country.
 *
 * This is the FORMAT half of address quality: it answers "is this shaped like a real
 * address in that country?" without calling anything. It is deliberately separate from
 * the geocoder call, because format failures are cheap to detect and there is no point
 * spending a rate-limited lookup on a row whose postal code has the wrong shape.
 *
 * US format is supported in full (state code + ZIP5/ZIP+4), alongside the six EU
 * formats present in the MCG dataset. A US-only validator would reject every row of
 * that dataset, since it holds no US addresses at all.
 *
 * Talend usage (tMap / tJavaRow):
 *   AddressFormatValidator.isValidPostalCode(row.postal_code, row.country_iso)
 *   AddressFormatValidator.formatScore(row.city, row.state_region,
 *                                      row.postal_code, row.country_iso)
 *   AddressFormatValidator.normalizePostalCode(row.postal_code, row.country_iso)
 *   AddressFormatValidator.explain(row.city, row.state_region,
 *                                  row.postal_code, row.country_iso)
 */
public class AddressFormatValidator {

    /** Postal-code shapes, by ISO-3166-1 alpha-2 country code. */
    private static final java.util.Map<String, String> POSTAL_PATTERNS =
            new java.util.HashMap<String, String>();

    /** US state and territory codes, for the state-field check. */
    private static final java.util.Set<String> US_STATES =
            new java.util.HashSet<String>(java.util.Arrays.asList(
                "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN",
                "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV",
                "NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN",
                "TX","UT","VT","VA","WA","WV","WI","WY",
                "DC","AS","GU","MP","PR","VI","AA","AE","AP"));

    static {
        // US: five digits, optionally +4. This is the only country here whose STATE
        // field is mandatory - the EU formats carry the region in the postal code.
        POSTAL_PATTERNS.put("US", "\\d{5}(-\\d{4})?");
        POSTAL_PATTERNS.put("NL", "\\d{4} ?[A-Z]{2}");   // 1234 AB
        POSTAL_PATTERNS.put("DE", "\\d{5}");
        POSTAL_PATTERNS.put("FR", "\\d{5}");
        POSTAL_PATTERNS.put("ES", "\\d{5}");
        POSTAL_PATTERNS.put("IT", "\\d{5}");
        POSTAL_PATTERNS.put("PL", "\\d{2}-\\d{3}");      // 12-345
        POSTAL_PATTERNS.put("GB", "[A-Z]{1,2}\\d[A-Z\\d]? ?\\d[A-Z]{2}");
        POSTAL_PATTERNS.put("BE", "\\d{4}");
        POSTAL_PATTERNS.put("AT", "\\d{4}");
        POSTAL_PATTERNS.put("PT", "\\d{4}-\\d{3}");
    }

    private static String up(String s) {
        return s == null ? "" : s.trim().toUpperCase();
    }

    /**
     * Does the postal code match the country's shape?
     * An unknown country returns true - absence of a rule is not evidence of a fault,
     * and failing rows for countries we have no pattern for would be misleading.
     */
    public static boolean isValidPostalCode(String postalCode, String countryIso) {
        String pc = up(postalCode), cc = up(countryIso);
        if (pc.isEmpty()) return false;
        String pattern = POSTAL_PATTERNS.get(cc);
        if (pattern == null) return true;
        return pc.matches(pattern);
    }

    /** Is the state/region field valid? Only the US requires one. */
    public static boolean isValidState(String stateRegion, String countryIso) {
        String cc = up(countryIso), st = up(stateRegion);
        if (!"US".equals(cc)) return true;          // EU rows carry no state
        return US_STATES.contains(st);
    }

    /**
     * Normalize a postal code to its canonical printed form, so that "1234ab",
     * "1234 AB" and " 1234  ab " all key the same downstream.
     */
    public static String normalizePostalCode(String postalCode, String countryIso) {
        String pc = up(postalCode).replaceAll("\\s+", " ").trim();
        String cc = up(countryIso);
        if (pc.isEmpty()) return "";
        if ("NL".equals(cc)) {
            String c = pc.replaceAll("\\s", "");
            if (c.matches("\\d{4}[A-Z]{2}")) return c.substring(0, 4) + " " + c.substring(4);
        } else if ("PL".equals(cc)) {
            String c = pc.replaceAll("[\\s-]", "");
            if (c.matches("\\d{5}")) return c.substring(0, 2) + "-" + c.substring(2);
        } else if ("US".equals(cc)) {
            String c = pc.replaceAll("[^0-9]", "");
            if (c.length() == 9) return c.substring(0, 5) + "-" + c.substring(5);
            if (c.length() >= 5) return c.substring(0, 5);
        }
        return pc;
    }

    /**
     * A 0..1 structural score. Weighted so a missing city and a malformed postal code
     * both matter, but neither alone zeroes the row - a geocoder can often still
     * resolve an address with one weak field, and the stewardship queue should be
     * ordered by how broken a row is, not by a pass/fail flag.
     */
    public static double formatScore(String city, String stateRegion,
                                     String postalCode, String countryIso) {
        double score = 0.0;
        if (city != null && city.trim().length() >= 2) score += 0.40;
        if (isValidPostalCode(postalCode, countryIso)) score += 0.40;
        else if (postalCode != null && !postalCode.trim().isEmpty()) score += 0.10;
        if (isValidState(stateRegion, countryIso)) score += 0.20;
        return Math.round(score * 100.0) / 100.0;
    }

    /** Human-readable reason, for the steward working the queue. Empty when clean. */
    public static String explain(String city, String stateRegion,
                                 String postalCode, String countryIso) {
        java.util.List<String> faults = new java.util.ArrayList<String>();
        if (city == null || city.trim().length() < 2) faults.add("city missing");
        if (postalCode == null || postalCode.trim().isEmpty()) faults.add("postal code missing");
        else if (!isValidPostalCode(postalCode, countryIso))
            faults.add("postal code does not match " + up(countryIso) + " format");
        if (!isValidState(stateRegion, countryIso))
            faults.add("state '" + stateRegion + "' is not a US state code");
        return faults.isEmpty() ? "" : join(faults, "; ");
    }

    private static String join(java.util.List<String> parts, String sep) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < parts.size(); i++) {
            if (i > 0) sb.append(sep);
            sb.append(parts.get(i));
        }
        return sb.toString();
    }
}
