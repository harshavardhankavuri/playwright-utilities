# k6 Threshold Utilities (`k6/lib/thresholds.js`)

Pre-built threshold configurations for common SLA targets. Import and spread into `options.thresholds`.

## `combine(...thresholdObjects)`

Merge multiple threshold objects into one. Arrays for the same metric key are concatenated.

```js
import { combine, p95lt, p99lt, errorRateLt, allPassChecks } from '../lib/thresholds.js';

export var options = {
  thresholds: combine(
    p95lt(500),
    p99lt(1000),
    errorRateLt(0.01),
    allPassChecks(),
  ),
};
```

## Response Time Thresholds

| Function | Threshold |
|---|---|
| `p95lt(ms)` | 95th percentile < ms |
| `p99lt(ms)` | 99th percentile < ms |
| `p50lt(ms)` | Median < ms |
| `avgLt(ms)` | Average < ms |
| `maxLt(ms)` | Maximum < ms |

```js
combine(p95lt(500), p99lt(1000), avgLt(200), maxLt(3000))
```

### `durationThresholds(targets)`

Set multiple percentiles in one call:

```js
durationThresholds({ p50: 100, p95: 500, p99: 1000, avg: 200 })
```

## Error Rate Thresholds

| Function | Threshold |
|---|---|
| `errorRateLt(rate)` | HTTP error rate < rate (0–1) |
| `checkFailRateLt(rate)` | Check failure rate < rate |
| `allPassChecks()` | 100% of checks must pass |

```js
errorRateLt(0.01)   // < 1% errors
errorRateLt(0.001)  // < 0.1% errors (strict)
allPassChecks()     // zero check failures
```

## Throughput Thresholds

```js
rpsAbove(100)   // must sustain > 100 req/s
```

## Per-Endpoint Thresholds

Tag requests with `{ tags: { name: 'endpoint-name' } }` then apply targeted thresholds:

```js
import { taggedP95lt } from '../lib/thresholds.js';

export var options = {
  thresholds: combine(
    p95lt(500),                    // global p95
    taggedP95lt('login', 200),     // login endpoint must be faster
    taggedP95lt('search', 1000),   // search can be slower
  ),
};

// In your test:
get(url, { tags: { name: 'login' } });
get(url, { tags: { name: 'search' } });
```

## Preset SLA Bundles

| Function | Includes |
|---|---|
| `standardApiSla()` | p95<500ms, p99<1000ms, errors<1%, all checks pass |
| `strictApiSla()` | p95<200ms, p99<500ms, errors<0.1%, all checks pass |
| `relaxedSla()` | p95<2000ms, errors<5% |

```js
export var options = {
  thresholds: standardApiSla(),
};
```

## Threshold Behaviour

- k6 exits with code `1` if any threshold is breached
- Use this in CI to fail the pipeline on SLA violations
- For stress tests, use relaxed thresholds — the goal is to observe degradation, not pass/fail

```js
// Stress test — intentionally relaxed
export var options = {
  thresholds: combine(
    p95lt(2000),       // allow up to 2s under stress
    errorRateLt(0.1),  // allow up to 10% errors
    // no allPassChecks() — some checks will fail under extreme load
  ),
};
```
