package routines;

/**
 * MCG Demo - Talend routine for address format validation (Job 1 tMap).
 *
 * Used by mcg_sf_address_validate:
 *   Var.valid = AddressValidator.isValidFormat(row1.MailingStreet, row1.MailingCity,
 *                                              row1.MailingPostalCode, row1.MailingCountry)
 *
 * The country and postal-code rules now live in {@link AddressStandardizer}, which
 * both validates AND repairs. This class stays as the thin pass/fail gate so the
 * original tMap expressions keep working; it delegates rather than duplicating.
 *
 * For the current job, prefer AddressStandardizer.standardize(...) - it returns a
 * repaired address plus a quality score, which is what feeds the Open Lakehouse /
 * Stewardship routing decision.
 */
public class AddressValidator {

    /** Street must contain at least one digit (house number) and at least one word of letters. */
    public static boolean hasValidStreet(String street) {
        if (street == null) return false;
        String s = street.trim();
        if (s.length() < 5 || s.length() > 120) return false;
        return s.matches(".*\\d+.*") && s.matches(".*\\p{L}{2,}.*");
    }

    /** City: non-empty, letters (plus spaces, dots, apostrophes, hyphens), no digits. */
    public static boolean hasValidCity(String city) {
        if (city == null) return false;
        String c = city.trim();
        if (c.isEmpty() || c.length() > 60) return false;
        return c.matches("[\\p{L}][\\p{L} .'\\-]*");
    }

    /**
     * ISO-2 country code for the supported demo markets, or null when unknown.
     * Delegates to AddressStandardizer so the alias table lives in one place.
     *
     * {talendTypes} String
     * {Category} MCG
     */
    public static String countryIso(String country) {
        return AddressStandardizer.countryIso(country);
    }

    /**
     * Postal code already in its country's canonical form.
     * Delegates to AddressStandardizer. Unknown country -> false.
     *
     * {talendTypes} boolean
     * {Category} MCG
     */
    public static boolean hasValidPostalCode(String postal, String country) {
        String iso = AddressStandardizer.countryIso(country);
        if (iso == null) return false;
        // accept both the canonical form and anything the standardizer can repair
        return AddressStandardizer.standardizePostal(postal, iso) != null;
    }

    /**
     * The tMap gate: true only when every component passes.
     *
     * {talendTypes} boolean
     * {Category} MCG
     * {param} string(street) street: MailingStreet
     * {param} string(city) city: MailingCity
     * {param} string(postal) postal: MailingPostalCode
     * {param} string(country) country: MailingCountry
     * {example} isValidFormat("Keizersgracht 482", "Amsterdam", "1017 EJ", "NL") # true
     */
    public static boolean isValidFormat(String street, String city, String postal, String country) {
        return hasValidStreet(street)
            && hasValidCity(city)
            && hasValidPostalCode(postal, country)
            && countryIso(country) != null;
    }

    /**
     * Free-text query for the geocoding branch - joins the non-empty parts so even
     * partially broken addresses still produce a usable search string.
     *
     * {talendTypes} String
     * {Category} MCG
     */
    public static String buildNominatimQuery(String street, String city, String postal, String country) {
        StringBuilder q = new StringBuilder();
        for (String part : new String[] { street, city, postal, country }) {
            if (part != null && !part.trim().isEmpty()) {
                if (q.length() > 0) q.append(", ");
                q.append(part.trim());
            }
        }
        return q.toString();
    }
}
