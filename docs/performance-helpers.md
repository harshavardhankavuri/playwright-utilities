# Performance Helpers

Collect Web Vitals and Navigation Timing metrics for every page navigated during a test. Attaches results to both Allure and the Playwright HTML report automatically.

## Metrics Collected

**Navigation Timing** (from `PerformanceNavigationTiming`):

| Metric | Description |
|---|---|
| TTFB | Time To First Byte |
| DNS Lookup | DNS resolution time |
| TCP Connect | TCP connection time |
| TLS Handshake | SSL/TLS negotiation time |
| Request Time | Time from request start to first byte |
| Response Time | Time to receive the full response |
| DOM Interactive | Time until DOM became interactive |
| DOM Content Loaded | DOMContentLoaded event time |
| DOM Complete | DOM fully parsed |
| Page Load | Full page load (loadEventEnd) |
| Resource Count | Number of resources loaded |
| Total Transfer Size | Total bytes transferred |

**Web Vitals** (from `PerformanceObserver`):

| Metric | Target | Description |
|---|---|---|
| LCP | < 2500ms | Largest Contentful Paint |
| FCP | < 1800ms | First Contentful Paint |
| CLS | < 0.1 | Cumulative Layout Shift |
| FID | < 100ms | First Input Delay |
| INP | < 200ms | Interaction to Next Paint |
| TTFB | < 800ms | Time to First Byte (web-vitals) |

## Usage

### As a Playwright Fixture (recommended)

The `perf` fixture is available in `src/main/fixtures/page-fixtures.ts`. It automatically starts collecting before the test and attaches the report after.

```typescript
import { test } from '../main/fixtures';

test('dashboard loads fast', async ({ page, perf }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  // Metrics collected automatically — attached to report on teardown
});
```

### Standalone

```typescript
import { PerformanceCollector } from '../main/utils';

test('measure multiple pages', async ({ page }, testInfo) => {
  const collector = new PerformanceCollector(page);
  await collector.start();

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await collector.collectCurrentPage();

  await page.goto('/products');
  await page.waitForLoadState('networkidle');
  await collector.collectCurrentPage();

  await collector.attach(testInfo); // Attaches to Allure + Playwright HTML
});
```

### One-Shot Helper

```typescript
import { measurePagePerformance } from '../main/utils';

test('homepage performance', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const entry = await measurePagePerformance(page, testInfo, {
    name: 'Homepage',
    failOnViolation: false,
  });

  console.log(`LCP: ${entry.vitals.lcp}ms`);
  console.log(`Page Load: ${entry.navigation.pageLoad}ms`);
});
```

## Performance Budgets

Set budgets to flag or fail tests when metrics exceed thresholds.

```typescript
const collector = new PerformanceCollector(page, {
  budgets: {
    ttfb: 800,
    fcp: 1800,
    lcp: 2500,
    cls: 0.1,
    fid: 100,
    inp: 200,
    pageLoad: 5000,
    domContentLoaded: 3000,
  },
  failOnViolation: false, // report violations without failing the test
});
```

Set `failOnViolation: true` to throw an error if any budget is exceeded:

```typescript
const collector = new PerformanceCollector(page, {
  budgets: { lcp: 2500, pageLoad: 5000 },
  failOnViolation: true,
});
// Throws: "Performance budget violations:\n  LCP: 3200ms > budget 2500ms"
```

## `assertMetric(name, value, budget, unit?)`

Assert a single metric inline.

```typescript
import { assertMetric } from '../main/utils';

const entry = await collector.collectCurrentPage();

assertMetric('LCP',       entry.vitals.lcp,          2500, 'ms');
assertMetric('FCP',       entry.vitals.fcp,          1800, 'ms');
assertMetric('CLS',       entry.vitals.cls,           0.1, '');
assertMetric('Page Load', entry.navigation.pageLoad, 5000, 'ms');
```

Skips silently if the value is `undefined` (metric not available in this browser).

## Report Output

The collector attaches two files to every test:

- **`Performance Metrics (JSON)`** — raw metrics as JSON (visible in Allure attachments tab)
- **`Performance Metrics (Summary)`** — formatted text table with budget indicators

Example summary output:
```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        UI PERFORMANCE METRICS                               ║
╚══════════════════════════════════════════════════════════════════════════════╝

Page 1: Products — My App
URL:  https://myapp.com/products
────────────────────────────────────────────────────────────────────────────────
  NAVIGATION TIMING
  TTFB                          245ms
  DOM Content Loaded           1200ms
  Page Load                    2100ms
  Resources: 42  |  Transfer: 1.23 MB

  WEB VITALS
  LCP  (Largest Contentful Paint)       1850ms  ✓
  FCP  (First Contentful Paint)          920ms  ✓
  CLS  (Cumulative Layout Shift)        0.0200  ✓

  ✓ All budgets passed
```
