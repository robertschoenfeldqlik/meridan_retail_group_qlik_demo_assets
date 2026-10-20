/**
 * http-client.js — zero-dependency HTTP(S) client with retry, shared by the
 * deploy scripts.
 * ============================================================================
 * build-apps.js and build-automations.js used to carry their own copies of
 * this code. The copies drifted: deploy-to-qlik.js stopped retrying writes on
 * 502/504, while the builders kept re-sending POST/PUT on gateway errors and
 * could create duplicate master items. One copy means one retry policy.
 *
 *   const { request, requestOnce, sleep } = require('./http-client');
 *   const res = await request('POST', url, { headers, body });
 *   // res = { statusCode, headers, body }  (body parsed when the reply is JSON)
 */

'use strict';

const https = require('https');
const http  = require('http');

/**
 * Make an HTTP(S) request and return { statusCode, headers, body }.
 * `body` is parsed as JSON when the response Content-Type is application/json.
 *
 * Options:
 *   headers  request headers
 *   body     object, sent as JSON (sets Content-Type and Content-Length)
 *   rawBody  Buffer/string sent as-is (OAuth form posts, multipart uploads)
 *   timeout  socket timeout in ms (default 60000)
 *   binary   return the response body as a Buffer instead of a string
 */
function requestOnce(method, reqUrl, { headers = {}, body = null, rawBody = null, timeout = 60000, binary = false, _redirectCount = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(reqUrl);
    const transport = parsed.protocol === 'https:' ? https : http;

    const opts = {
      method,
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      headers:  { ...headers },
      timeout,
    };

    // Serialize body
    let payload = rawBody || null;
    if (body && !rawBody) {
      payload = JSON.stringify(body);
      opts.headers['Content-Type']   = opts.headers['Content-Type'] || 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    } else if (payload != null && opts.headers['Content-Length'] == null) {
      // rawBody path (OAuth token POST, multipart uploads): set Content-Length so
      // Node doesn't fall back to chunked Transfer-Encoding, which some
      // multipart/form-data and token endpoints reject.
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = transport.request(opts, (res) => {
      // Follow 301/302/307/308 redirects (max 10)
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        const rc = _redirectCount + 1;
        if (rc > 10) { res.resume(); reject(new Error(`Too many redirects (>10): ${reqUrl}`)); return; }
        const redirectUrl = new URL(res.headers.location, reqUrl).toString();
        res.resume(); // drain response
        resolve(requestOnce(method, redirectUrl, { headers, body, rawBody, timeout, binary, _redirectCount: rc }));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        if (binary) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) });
          return;
        }
        const raw = Buffer.concat(chunks).toString('utf-8');
        let parsed = raw;
        const ct = (res.headers['content-type'] || '').toLowerCase();
        if (ct.includes('application/json') && raw.length > 0) {
          try { parsed = JSON.parse(raw); } catch (_) { /* keep raw string */ }
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error(`Request timed out: ${method} ${reqUrl}`)); });
    req.on('error', reject);

    if (payload) req.write(payload);
    req.end();
  });
}

// Retry policy. Only GET is re-sent when the outcome is unknown.
//
// Statuses: 429 and 503 mean the server did not act on the request, so any
// method may retry them. 502 and 504 come from a gateway that can lose the
// response to a request the backend already committed — re-sending a
// POST/PUT/PATCH/DELETE then creates a duplicate resource.
//
// Transport errors: ECONNREFUSED means no connection was made, so the request
// never reached the server. ECONNRESET, ETIMEDOUT and our own socket timeout can
// fire after the body was sent, when the write may already have landed.
function isRetryableStatus(method, statusCode) {
  return (method === 'GET' ? [429, 502, 503, 504] : [429, 503]).includes(statusCode);
}

function isRetryableError(method, err) {
  if (err.code === 'ECONNREFUSED') return true;
  if (method !== 'GET') return false;
  return err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || String(err.message || '').includes('timed out');
}

/**
 * requestOnce() with retry and exponential backoff on transient failures,
 * following the policy above. Retry-After is honoured when the server sends it.
 */
async function request(method, reqUrl, opts = {}, { maxRetries = 3, backoff = 2.0 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await requestOnce(method, reqUrl, opts);

      // Dry runs authenticate with a placeholder OAuth token, so existence-check
      // GETs made before a step's own dry-run short-circuit get a real 401 from
      // the tenant. Treat that as "can't verify — assume not present" instead of
      // letting it throw and cascade the whole dry run to failure.
      if (opts.dryRun && res.statusCode === 401) {
        console.warn(`  WARN  dry run: cannot verify existing state without valid OAuth token — assuming not present (${method} ${reqUrl})`);
        return { statusCode: 200, headers: {}, body: {} };
      }

      if (isRetryableStatus(method, res.statusCode) && attempt < maxRetries) {
        const retryAfter = parseFloat(res.headers['retry-after']) || backoff * Math.pow(2, attempt);
        console.warn(`  WARN  HTTP ${res.statusCode} — retrying in ${retryAfter.toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(retryAfter * 1000);
        continue;
      }
      return res;
    } catch (err) {
      if (attempt < maxRetries && isRetryableError(method, err)) {
        const wait = backoff * Math.pow(2, attempt);
        console.warn(`  WARN  ${err.code || 'Timeout'} — retrying in ${wait.toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(wait * 1000);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Request failed after ${maxRetries} retries: ${method} ${reqUrl}`);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

module.exports = { requestOnce, request, sleep };
