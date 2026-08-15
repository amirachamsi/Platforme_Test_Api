import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import crypto from 'k6/crypto';

/**
 * Generic k6 runner driven entirely by environment variables, launched by K6Runner
 */

const TARGET_URL = __ENV.TARGET_URL;
if (!TARGET_URL) {
    throw new Error('TARGET_URL env var is required');
}

const METHOD = (__ENV.METHOD || 'GET').toUpperCase();
const EXPECTED_STATUS = parseInt(__ENV.EXPECTED_STATUS || '200', 10);
const TIMEOUT_MS = parseInt(__ENV.TIMEOUT_MS || '5000', 10);
const THRESHOLD_MS = parseInt(__ENV.THRESHOLD_MS || '1000', 10);
const MAX_ERROR_RATE = parseFloat(__ENV.MAX_ERROR_RATE || '0.05');
const VUS = parseInt(__ENV.VUS || '1', 10);
// Mutually exclusive: if ITERATIONS is set, k6 uses the "shared-iterations"
// executor (runs exactly that many requests total across VUS, however long it
// takes). Otherwise it uses the default "duration" executor.
const ITERATIONS = __ENV.ITERATIONS ? parseInt(__ENV.ITERATIONS, 10) : null;
const DURATION = __ENV.DURATION || '10s';

let HEADERS = { 'Content-Type': 'application/json' };
if (__ENV.HEADERS) {
    try {
        HEADERS = { ...HEADERS, ...JSON.parse(__ENV.HEADERS) };
    } catch (e) {
        console.warn('HEADERS env var is not valid JSON, ignoring: ' + e.message);
    }
}

// open() must be called from k6's init context (top level, not inside default()) —
// this reads the body exactly as written to disk, sidestepping any command-line
// argument quoting issues a raw JSON string could hit via -e BODY=...
const BODY = __ENV.BODY_FILE ? open(__ENV.BODY_FILE) : (__ENV.BODY || null);

// This is the sole source of truth for "did this request succeed" — driven
// directly from `statusOk` below, not from k6's built-in http_req_failed
// (which classifies any non-2xx/3xx as failed by default; setResponseCallback
// is supposed to override that but wasn't proving reliable in practice, so we
// don't depend on it at all here).
const statusMismatchRate = new Rate('status_mismatch_rate');
const responseTimeTrend = new Trend('custom_response_time');

// Per-VU set of body hashes already sample-logged to stdout — keeps output to
// one line per distinct body variant this VU has seen, not one per request.
const loggedBodyHashes = new Set();
const MAX_HASH_INPUT_CHARS = 5000; // bound hashing cost for very large bodies
const PREVIEW_CHARS = 300;

export const options = {
    vus: VUS,
    ...(ITERATIONS ? { iterations: ITERATIONS } : { duration: DURATION }),
    thresholds: {
        http_req_duration: [`p(95)<${THRESHOLD_MS}`],
        status_mismatch_rate: [`rate<${MAX_ERROR_RATE}`],
    },
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export default function () {
    const params = {
        headers: HEADERS,
        timeout: `${TIMEOUT_MS}ms`,
    };

    let res;
    switch (METHOD) {
        case 'POST':
            res = http.post(TARGET_URL, BODY, params);
            break;
        case 'PUT':
            res = http.put(TARGET_URL, BODY, params);
            break;
        case 'DELETE':
            res = http.del(TARGET_URL, BODY, params);
            break;
        case 'PATCH':
            res = http.patch(TARGET_URL, BODY, params);
            break;
        default:
            res = http.get(TARGET_URL, params);
    }

    const statusOk = res.status === EXPECTED_STATUS;
    statusMismatchRate.add(!statusOk);
    responseTimeTrend.add(res.timings.duration);

    const checks = {
        [`status is ${EXPECTED_STATUS}`]: () => statusOk,
        [`response time < ${THRESHOLD_MS}ms`]: (r) => r.timings.duration < THRESHOLD_MS,
        'no connection/timeout error': (r) => r.error_code === 0,
        // Diagnostic only (always "passes") — one check node per distinct status
        // code actually observed, so the raw report shows a histogram for free:
        // passes = how many requests returned that code. Status 0 means no HTTP
        // response was received at all (timeout, DNS failure, connection refused,
        // TLS failure — a network-level failure, not a real status code).
        [`actual status observed: ${res.status}`]: () => true,
    };

    // Only added when status is 0, so it doesn't clutter reports where every
    // request got a real response. res.error / res.error_code come straight
    // from k6 and describe the specific network failure (see k6 docs for the
    // error_code reference table, e.g. 1211 = request timeout).
    if (res.status === 0) {
        checks[`network error (code ${res.error_code}): ${res.error || 'raison inconnue'}`] = () => true;
    }

    // Group/count distinct response bodies without storing every single one.
    // Hash input is capped at MAX_HASH_INPUT_CHARS so a handful of very large
    // responses can't slow the run down — two huge bodies differing only past
    // that cutoff would be (rarely) grouped together, an accepted trade-off.
    const bodyText = res.body || '';
    const hashInput = bodyText.length > MAX_HASH_INPUT_CHARS ? bodyText.slice(0, MAX_HASH_INPUT_CHARS) : bodyText;
    const bodyHash = crypto.sha256(hashInput, 'hex').slice(0, 12);
    checks[`response body variant: ${bodyHash}`] = () => true;

    if (!loggedBodyHashes.has(bodyHash)) {
        loggedBodyHashes.add(bodyHash);
        const preview = bodyText.slice(0, PREVIEW_CHARS).replace(/[\r\n]+/g, ' ⏎ ');
        // Parsed back out of stdout by K6ResultParser.java — pipe-delimited, single line.
        console.log(`BODY_SAMPLE|${bodyHash}|${preview}`);
    }

    check(res, checks);
}

export function handleSummary(data) {
    // Defining handleSummary() makes k6 ignore --summary-export entirely, so the
    // output path is passed in explicitly and written here instead.
    const outPath = __ENV.RESULT_PATH || 'result.json';
    return {
        [outPath]: JSON.stringify(data, null, 2),
        stdout: '',
    };
}