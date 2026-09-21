package routines;

import java.util.ArrayList;
import java.util.List;

/**
 * MCG Demo - hands the standardized + geocoded batch between Talend subjobs.
 *
 * Talend needs a way to turn a Java collection back into a row flow. The idiom is
 * tLoop -> tIterateToFlow, but the raw expression for each column is an unreadable
 * pile of casts. This holder gives tIterateToFlow one clean, null-safe, correctly
 * typed getter per column:
 *
 *   routines.AddressBatch.contactId((Integer) globalMap.get("tLoop_1_CURRENT_VALUE"))
 *
 * Lifecycle inside mcg_crm_address_validate_bulk:
 *   1. tJava      "init_batch"     -> AddressBatch.reset()
 *   2. tJavaRow   "standardize"    -> AddressBatch.add(AddressStandardizer.standardize(...))
 *   3. tJava      "bulk_geocode"   -> BulkGeocoder.geocodeAll(AddressBatch.all(), ...)
 *   4. tLoop + tIterateToFlow      -> the getters below
 *
 * Every getter is bounds- and null-safe: an out-of-range index returns null rather
 * than throwing, so a mid-run schema slip degrades to an empty column instead of
 * killing the job.
 */
public class AddressBatch {

    private static List<AddressStandardizer.Result> batch =
            new ArrayList<AddressStandardizer.Result>();

    /** Clear the holder at the start of a run. */
    public static void reset() {
        batch = new ArrayList<AddressStandardizer.Result>();
    }

    /** Append one standardized address. */
    public static void add(AddressStandardizer.Result r) {
        if (r != null) batch.add(r);
    }

    /** The whole batch - hand this to BulkGeocoder.geocodeAll(). */
    public static List<AddressStandardizer.Result> all() {
        return batch;
    }

    /** Row count - drives the tLoop bound. */
    public static int size() {
        return batch.size();
    }

    /** Raw accessor; null when the index is out of range. */
    public static AddressStandardizer.Result get(Integer i) {
        if (i == null) return null;
        int idx = i.intValue();
        if (idx < 0 || idx >= batch.size()) return null;
        return batch.get(idx);
    }

    // ------------------------------------------------- typed column accessors

    public static String contactId(Integer i)     { AddressStandardizer.Result r = get(i); return r == null ? null : r.contactId; }
    public static String firstName(Integer i)     { AddressStandardizer.Result r = get(i); return r == null ? null : r.firstName; }
    public static String lastName(Integer i)      { AddressStandardizer.Result r = get(i); return r == null ? null : r.lastName; }
    public static String email(Integer i)         { AddressStandardizer.Result r = get(i); return r == null ? null : r.email; }

    public static String streetRaw(Integer i)     { AddressStandardizer.Result r = get(i); return r == null ? null : r.streetRaw; }
    public static String cityRaw(Integer i)       { AddressStandardizer.Result r = get(i); return r == null ? null : r.cityRaw; }
    public static String postalRaw(Integer i)     { AddressStandardizer.Result r = get(i); return r == null ? null : r.postalRaw; }
    public static String countryRaw(Integer i)    { AddressStandardizer.Result r = get(i); return r == null ? null : r.countryRaw; }

    public static String street(Integer i)        { AddressStandardizer.Result r = get(i); return r == null ? null : r.streetClean; }
    public static String houseNumber(Integer i)   { AddressStandardizer.Result r = get(i); return r == null ? null : r.houseNumber; }
    public static String unitType(Integer i)      { AddressStandardizer.Result r = get(i); return r == null ? null : r.unitType; }
    public static String unitNumber(Integer i)    { AddressStandardizer.Result r = get(i); return r == null ? null : r.unitNumber; }
    public static String floor(Integer i)         { AddressStandardizer.Result r = get(i); return r == null ? null : r.floor; }
    public static String city(Integer i)          { AddressStandardizer.Result r = get(i); return r == null ? null : r.cityClean; }
    public static String state(Integer i)         { AddressStandardizer.Result r = get(i); return r == null ? null : r.stateClean; }
    public static String postalCode(Integer i)    { AddressStandardizer.Result r = get(i); return r == null ? null : r.postalClean; }
    public static String countryIso(Integer i)    { AddressStandardizer.Result r = get(i); return r == null ? null : r.countryIso; }

    public static Double latitude(Integer i)      { AddressStandardizer.Result r = get(i); return r == null ? null : r.latitude; }
    public static Double longitude(Integer i)     { AddressStandardizer.Result r = get(i); return r == null ? null : r.longitude; }
    public static Double geoConfidence(Integer i) { AddressStandardizer.Result r = get(i); return r == null ? null : r.geoConfidence; }

    public static Double qualityScore(Integer i)  { AddressStandardizer.Result r = get(i); return r == null ? null : Double.valueOf(r.qualityScore); }
    public static String status(Integer i)        { AddressStandardizer.Result r = get(i); return r == null ? null : r.status; }
    public static String corrections(Integer i)   { AddressStandardizer.Result r = get(i); return r == null ? null : r.correctionsJson(); }
    public static String reason(Integer i)        { AddressStandardizer.Result r = get(i); return r == null ? null : r.stewardshipReason(); }

    /**
     * THE ROUTING GATE, as a tMap-friendly boolean.
     * true  -> Open Lakehouse
     * false -> Qlik Stewardship
     */
    public static boolean hasGps(Integer i) {
        AddressStandardizer.Result r = get(i);
        return r != null && r.hasGps();
    }
}
