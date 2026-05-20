# k6 Reporter (`k6/lib/reporter.js`)

Custom reporter that generates three outputs from a single `handleSummary()` call:

| Output | Location | Description |
|---|---|---|
| stdout | Terminal | Coloured k6 text summary |
| JSON | `k6/results/<test>-summary.json` | Raw metrics for CI / Allure attachment |
| HTML | `k6-report/<test>.html` | Self-contained dark-themed HTML report |

## `buildSummary(data, opts)`

The main function — call it from `handleSummary()` in every test.

```js
import { buildSummary } from '../lib/reporter.js';

export function handleSummary(data) {
  return buildSummary(data, {
    testName:   'My Load Test',
    outputFile: 'k6/results/my-test.json',
    htmlFile:   'k6-report/my-test.html',
  });
}
```

### Options

| Property | Default | Description |
|---|---|---|
| `testName` | `'k6 Load Test'` | Title shown in the HTML report header |
| `outputFile` | `k6/results/<slug>.json` | Path for the JSON summary |
| `htmlFile` | `k6-report/<slug>.html` | Path for the HTML report |

If `outputFile` and `htmlFile` are omitted, they are derived from `testName` by slugifying it.

## HTML Report

The HTML report is a single self-contained file (no external dependencies) with a dark theme. It includes:

- **Overall PASS/FAIL badge** — based on whether all thresholds passed
- **KPI cards** — Total Requests, Req/s, Checks Pass Rate, Error Rate, Avg/p95/p99/Max Duration
- **Response Time Breakdown** — min/avg/p50/p90/p95/p99/max in a table
- **Thresholds** — each threshold with its condition and PASS/FAIL result
- **Checks Summary** — pass rate, passed count, failed count
- **All Metrics** — every k6 metric with value, p95, p99, and threshold conditions

## JSON Summary

The JSON file contains structured metrics suitable for CI assertions or attaching to Allure:

```json
{
  "testName": "Load Test — JSONPlaceholder API",
  "timestamp": "2025-05-20T10:00:00.000Z",
  "metrics": {
    "http_req_duration": { "avg": 82, "min": 12, "max": 250, "p95": 200, "p99": 240 },
    "http_req_failed":   { "rate": 0, "passes": 0, "fails": 700 },
    "http_reqs":         { "count": 700, "rate": 23.4 },
    "checks":            { "rate": 1, "passes": 2100, "fails": 0 }
  },
  "thresholds": [
    { "metric": "http_req_duration", "condition": "p(95)<500", "passed": true },
    { "metric": "http_req_failed",   "condition": "rate<0.01",  "passed": true },
    { "metric": "checks",            "condition": "rate==1.0",  "passed": true }
  ]
}
```

## Console Helpers

### `logStep(name)`

Log a named step with a timestamp — useful for marking phases in long tests.

```js
import { logStep } from '../lib/reporter.js';

logStep('Browse products');
// [2025-05-20T10:00:01.234Z] ▶ Browse products
```

### `logResult(name, passed)`

Log a pass/fail result.

```js
logResult('Login succeeded', true);   // ✓ [PASS] Login succeeded
logResult('Cart not empty', false);   // ✗ [FAIL] Cart not empty
```

### `logMetric(name, value, unit?, threshold?)`

Log a metric value with an optional budget indicator.

```js
logMetric('p95 response time', 450, 'ms', 500);  // ✓ within budget
logMetric('p95 response time', 650, 'ms', 500);  // ⚠ OVER BUDGET
logMetric('CLS score', 0.08, '', 0.1);           // ✓ within budget
```

## Attaching JSON to Allure

After a k6 run, attach the JSON summary to an Allure report using the Playwright `allureAttachFile` helper:

```typescript
import { allureAttachFile } from '../main/utils';

test.afterAll(async () => {
  await allureAttachFile(
    'k6 Load Test Results',
    'k6/results/load-summary.json',
    'application/json',
  );
});
```
