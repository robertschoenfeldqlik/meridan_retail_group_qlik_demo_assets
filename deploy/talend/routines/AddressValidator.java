package routines;

/**
 * MCG Demo — Talend routine for address format validation (Job 1 tMap).
 *
 * Used by mcg_sf_address_validate:
 *   Var.valid = AddressValidator.isValidFormat(row1.MailingStreet, row1.MailingCity,
 *                                              row1.MailingPostalCode, row1.MailingCountry)
 *
 * A record that fails format validation is routed to the Nominatim geocoding branch;
 * if Nominatim cannot resolve it either, it goes to the Stewardship route
 * (Address Cleanup campaign).
 *
 * Demo-grade rules on purpose: strict enough to catch the simulator's injected
 * Nightmare #2 issues (truncated streets, postal/country variants, free-text cities),
 * loose enough not to reject ordinary international addresses.
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

    /** ISO-2 country code for the supported demo markets, or null when unknown. */
    public static String countryIso(String country) {
        if (country == null) return null;
        String c = country.trim().toUpperCase();
        if (c.isEmpty()) return null;
        switch (c) {
            case "NL": case "NETHERLANDS": case "THE NETHERLANDS":
            case "NEDERLAND": case "NIEDERLANDE":               return "NL";
            case "DE": case "GERMANY": case "DEUTSCHLAND":      return "DE";
            case "GB": case "UK": case "UNITED KINGDOM":
            case "GREAT BRITAIN": case "ENGLAND":               return "GB";
            case "US": case "USA": case "UNITED STATES":
            case "UNITED STATES OF AMERICA":                    return "US";
            case "SG": case "SINGAPORE": case "SINGAPUR":       return "SG";
            case "JP": case "JAPAN": case "JAPON":              return "JP";
            case "BR": case "BRAZIL": case "BRASIL":            return "BR";
            case "NG": case "NIGERIA":                          return "NG";
            default:                                            return null;
        }
    }

    /** Postal code pattern per demo market. Unknown country -> fail (forces geocode branch). */
    public static boolean hasValidPostalCode(String postal, String country) {
        if (postal == null) return false;
        String p = postal.trim().toUpperCase();
        String iso = countryIso(country);
        if (iso == null) return false;
        switch (iso) {
            case "NL": return p.matches("\\d{4} ?[A-Z]{2}");
            case "DE": return p.matches("\\d{5}");
            case "GB": return p.matches("[A-Z]{1,2}\\d[A-Z\\d]? ?\\d[A-Z]{2}");
            case "US": return p.matches("\\d{5}(-\\d{4})?");
            case "SG": return p.matches("\\d{6}");
            case "JP": return p.matches("\\d{3}-?\\d{4}");
            case "BR": return p.matches("\\d{5}-?\\d{3}");
            case "NG": return p.matches("\\d{6}");
            default:   return false;
        }
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
     * Free-text query for the Nominatim branch — joins the non-empty parts so even
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
