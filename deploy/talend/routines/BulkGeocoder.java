package routines;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * MCG Demo - free replacement for the subscription-only Talend Data Quality
 * components tAddressRowValidate + tGeocode.
 *
 * ONE bulk call geocodes a whole batch of addresses and returns them with GPS.
 * Built on the JDK's java.net.http.HttpClient (Java 11+, ships with Talend 8) -
 * no licence, no API key, no third-party jar on the Studio classpath.
 *
 * Backend: the public OpenStreetMap Nominatim service. Nominatim has NO bulk
 * endpoint and its usage policy caps callers at 1 request/second, so "bulk"
 * here means: the job hands the geocoder the entire batch in a single call, and
 * this class fans it out internally behind a shared rate limiter, an in-memory
 * dedupe cache, retries and a hard wall-clock budget. Demo batches of 100-1000
 * rows finish in roughly 2-18 minutes, and the cache usually cuts that sharply
 * because MCG contacts cluster in a handful of cities.
 *
 * Used by mcg_crm_address_validate, tJava "bulk_geocode":
 *   BulkGeocoder.geocodeAll(batch, context.nominatim_base_url,
 *                           context.nominatim_user_agent,
 *                           context.nominatim_throttle_ms,
 *                           context.geocode_max_concurrent,
 *                           context.geocode_budget_ms);
 *
 * Routing contract after this call:
 *   result.hasGps() == true   -> Open Lakehouse    (status GEOCODED)
 *   result.hasGps() == false  -> Qlik Stewardship  (status UNRESOLVED)
 *
 * Fail-soft by design: a dead endpoint, a timeout or a malformed response never
 * throws and never aborts the job - those rows simply arrive without GPS and are
 * routed to stewardship, which is exactly where a human should see them.
 */
public class BulkGeocoder {

    /** Nominatim usage policy: absolute minimum gap between request starts. */
    public static final long POLICY_MIN_INTERVAL_MS = 1100L;

    private static final int MAX_ATTEMPTS = 3;

    /** Cache survives across calls within one JVM / job run. */
    private static final Map<String, double[]> CACHE = Collections.synchronizedMap(new HashMap<String, double[]>());

    /** Shared rate-limit clock - guarantees the whole JVM respects 1 req/s. */
    private static final Object RATE_LOCK = new Object();
    private static long nextSlotAtMs = 0L;

    /** Outcome summary so the job can log what happened. */
    public static class Summary {
        public int total;
        public int geocoded;
        public int unresolved;
        public int fromCache;
        public int requests;
        public long elapsedMs;
        public boolean budgetExhausted;

        @Override
        public String toString() {
            return "BulkGeocoder: " + total + " in, " + geocoded + " geocoded, "
                 + unresolved + " unresolved, " + fromCache + " cache hits, "
                 + requests + " HTTP requests, " + elapsedMs + " ms"
                 + (budgetExhausted ? " (BUDGET EXHAUSTED - remainder routed to stewardship)" : "");
        }
    }

    /**
     * Geocode an entire batch in one call. Mutates each Result in place, setting
     * latitude/longitude/geoConfidence and flipping status to GEOCODED or UNRESOLVED.
     *
     * {talendTypes} Object
     * {Category} MCG
     * {param} object(batch) batch: List of AddressStandardizer.Result
     * {param} string(baseUrl) baseUrl: Nominatim search endpoint
     * {param} string(userAgent) userAgent: identifying User-Agent (required by policy)
     * {param} long(minIntervalMs) minIntervalMs: gap between requests, >= 1100
     * {param} int(maxConcurrent) maxConcurrent: in-flight requests, 1 for public Nominatim
     * {param} long(budgetMs) budgetMs: wall-clock ceiling for the whole batch
     */
    public static Summary geocodeAll(List<AddressStandardizer.Result> batch,
                                     String baseUrl,
                                     String userAgent,
                                     long minIntervalMs,
                                     int maxConcurrent,
                                     long budgetMs) {

        Summary sum = new Summary();
        long startedAt = System.currentTimeMillis();
        if (batch == null || batch.isEmpty()) return sum;
        sum.total = batch.size();

        final String endpoint = (baseUrl == null || baseUrl.trim().isEmpty())
                ? "https://nominatim.openstreetmap.org/search" : baseUrl.trim();
        final String ua = (userAgent == null || userAgent.trim().isEmpty())
                ? "MCG-Demo-Talend/1.0 (contact@mcg.example)" : userAgent.trim();
        final long interval = Math.max(POLICY_MIN_INTERVAL_MS, minIntervalMs);
        final int threads = Math.max(1, Math.min(maxConcurrent, 8));
        final long budget = budgetMs > 0 ? budgetMs : Long.MAX_VALUE;
        final long deadline = startedAt + budget;

        final HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();

        // Pass 1 - serve everything we already know from the cache, no HTTP at all.
        List<AddressStandardizer.Result> needsCall = new ArrayList<AddressStandardizer.Result>();
        for (AddressStandardizer.Result r : batch) {
            if (r == null) continue;
            String key = cacheKey(r.geocodeQuery());
            if (key.isEmpty()) { markUnresolved(r); continue; }
            double[] hit = CACHE.get(key);
            if (hit != null) {
                apply(r, hit[0], hit[1], hit[2]);
                sum.fromCache++;
            } else {
                needsCall.add(r);
            }
        }

        // Pass 2 - one HTTP call per distinct remaining query, fanned out under the limiter.
        Map<String, List<AddressStandardizer.Result>> byQuery =
                new HashMap<String, List<AddressStandardizer.Result>>();
        for (AddressStandardizer.Result r : needsCall) {
            String key = cacheKey(r.geocodeQuery());
            List<AddressStandardizer.Result> group = byQuery.get(key);
            if (group == null) { group = new ArrayList<AddressStandardizer.Result>(); byQuery.put(key, group); }
            group.add(r);
        }

        ExecutorService pool = Executors.newFixedThreadPool(threads);
        try {
            List<Future<Object[]>> futures = new ArrayList<Future<Object[]>>();
            for (final Map.Entry<String, List<AddressStandardizer.Result>> e : byQuery.entrySet()) {
                final String query = e.getValue().get(0).geocodeQuery();
                final String key = e.getKey();
                futures.add(pool.submit(new Callable<Object[]>() {
                    @Override
                    public Object[] call() {
                        if (System.currentTimeMillis() >= deadline) return new Object[] { key, null, 0 };
                        int[] calls = new int[1];
                        double[] geo = lookup(client, endpoint, ua, query, interval, deadline, calls);
                        return new Object[] { key, geo, Integer.valueOf(calls[0]) };
                    }
                }));
            }

            for (Future<Object[]> f : futures) {
                Object[] out;
                try {
                    out = f.get();
                } catch (Exception ex) {
                    continue; // fail-soft: group stays unresolved
                }
                String key = (String) out[0];
                double[] geo = (double[]) out[1];
                sum.requests += ((Integer) out[2]).intValue();
                List<AddressStandardizer.Result> group = byQuery.get(key);
                if (geo != null) {
                    CACHE.put(key, geo);
                    for (AddressStandardizer.Result r : group) apply(r, geo[0], geo[1], geo[2]);
                }
            }
        } finally {
            pool.shutdown();
            try { pool.awaitTermination(30, TimeUnit.SECONDS); } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
        }

        // Anything still without GPS goes to stewardship.
        for (AddressStandardizer.Result r : batch) {
            if (r == null) continue;
            if (!r.hasGps()) markUnresolved(r);
            if (r.hasGps()) sum.geocoded++; else sum.unresolved++;
        }
        sum.elapsedMs = System.currentTimeMillis() - startedAt;
        sum.budgetExhausted = sum.elapsedMs >= budget;
        return sum;
    }

    /** Convenience overload using the Nominatim policy defaults. */
    public static Summary geocodeAll(List<AddressStandardizer.Result> batch, String userAgent) {
        return geocodeAll(batch, null, userAgent, POLICY_MIN_INTERVAL_MS, 1, 0L);
    }

    // ------------------------------------------------------------------ HTTP

    /** One query, with retry/backoff. Returns {lat, lon, confidence} or null. */
    private static double[] lookup(HttpClient client, String endpoint, String userAgent,
                                   String query, long interval, long deadline, int[] calls) {
        if (query == null || query.trim().isEmpty()) return null;

        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            if (System.currentTimeMillis() >= deadline) return null;
            awaitSlot(interval, deadline);
            if (System.currentTimeMillis() >= deadline) return null;

            try {
                String url = endpoint
                        + (endpoint.contains("?") ? "&" : "?")
                        + "q=" + URLEncoder.encode(query, StandardCharsets.UTF_8.name())
                        + "&format=json&limit=1&addressdetails=1";

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .timeout(Duration.ofSeconds(20))
                        .header("User-Agent", userAgent)      // required by Nominatim policy
                        .header("Accept", "application/json")
                        .header("Accept-Language", "en")
                        .GET()
                        .build();

                calls[0]++;
                HttpResponse<String> response =
                        client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                int code = response.statusCode();

                if (code == 200) return parseFirst(response.body());
                if (code == 429 || code == 503) {          // throttled - back off and retry
                    sleep(Math.min(interval * (1L << attempt), 15000L));
                    continue;
                }
                return null;                                // 4xx other than 429: not retryable
            } catch (IOException io) {
                sleep(Math.min(interval * (1L << attempt), 15000L));
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                return null;
            } catch (Exception other) {
                return null;                                // fail-soft
            }
        }
        return null;
    }

    /** Global 1-req/s gate shared by every worker thread. */
    private static void awaitSlot(long interval, long deadline) {
        long waitFor;
        synchronized (RATE_LOCK) {
            long now = System.currentTimeMillis();
            long slot = Math.max(now, nextSlotAtMs);
            if (slot >= deadline) { waitFor = -1; }
            else { waitFor = slot - now; nextSlotAtMs = slot + interval; }
        }
        if (waitFor > 0) sleep(waitFor);
    }

    private static void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
    }

    // ------------------------------------------------------- response parsing

    private static final Pattern LAT = Pattern.compile("\"lat\"\\s*:\\s*\"?(-?\\d+(?:\\.\\d+)?)\"?");
    private static final Pattern LON = Pattern.compile("\"lon\"\\s*:\\s*\"?(-?\\d+(?:\\.\\d+)?)\"?");
    private static final Pattern HOUSE = Pattern.compile("\"house_number\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern ROAD = Pattern.compile("\"road\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern POSTCODE = Pattern.compile("\"postcode\"\\s*:\\s*\"([^\"]*)\"");

    /**
     * Nominatim with limit=1 returns a one-element array. We only need lat, lon
     * and enough of address{} to judge precision, so a targeted scan beats
     * dragging a JSON library onto the Studio classpath.
     */
    private static double[] parseFirst(String body) {
        if (body == null) return null;
        String b = body.trim();
        if (b.isEmpty() || "[]".equals(b)) return null;

        Matcher lat = LAT.matcher(b);
        Matcher lon = LON.matcher(b);
        if (!lat.find() || !lon.find()) return null;
        try {
            double latitude = Double.parseDouble(lat.group(1));
            double longitude = Double.parseDouble(lon.group(1));
            if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

            // precision: rooftop > street > locality
            double confidence = 0.60;
            if (ROAD.matcher(b).find()) confidence = 0.80;
            if (HOUSE.matcher(b).find()) confidence = 0.95;
            else if (POSTCODE.matcher(b).find() && confidence < 0.80) confidence = 0.70;

            return new double[] { latitude, longitude, confidence };
        } catch (NumberFormatException nfe) {
            return null;
        }
    }

    // -------------------------------------------------------------- mutation

    private static void apply(AddressStandardizer.Result r, double lat, double lon, double confidence) {
        r.latitude = Double.valueOf(lat);
        r.longitude = Double.valueOf(lon);
        r.geoConfidence = Double.valueOf(confidence);
        r.status = "GEOCODED";
    }

    private static void markUnresolved(AddressStandardizer.Result r) {
        r.latitude = null;
        r.longitude = null;
        if (r.geoConfidence == null) r.geoConfidence = Double.valueOf(0.0);
        r.status = "UNRESOLVED";
    }

    private static String cacheKey(String query) {
        if (query == null) return "";
        return query.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    /** Clear the dedupe cache - call between runs if the job is long-lived. */
    public static void clearCache() {
        CACHE.clear();
    }
}
