# Playwright Utilities

A comprehensive test automation framework built with TypeScript and Playwright. Covers functional UI testing, API testing, visual regression, load testing with k6, and CI/CD integration.

## Quick Start

```bash
npm install
npx playwright install
npm test                      # Run all Playwright tests
npm run k6:smoke              # Run k6 smoke test
```

---

## Project Structure

```
playwright-utilities/
│
├── src/                          ← All Playwright source code
│   ├── main/
│   │   ├── assertions/           ← Fluent chainable assertions
│   │   │   └── fluent-expect.ts
│   │   ├── data/                 ← Shared test data constants
│   │   │   └── test-data.ts
│   │   ├── fixtures/             ← Playwright test fixtures
│   │   │   └── page-fixtures.ts  ← homePage, visual, perf fixtures
│   │   ├── pages/                ← Page Object Model
│   │   │   ├── base.page.ts      ← Base class with SmartLocator
│   │   │   └── saucedemo/        ← SauceDemo page objects
│   │   └── utils/                ← 20+ utility modules
│   │       ├── index.ts          ← Single barrel export
│   │       ├── accessibility-helpers.ts
│   │       ├── allure-helpers.ts
│   │       ├── api-client.ts
│   │       ├── auth-helpers.ts
│   │       ├── datetime-helpers.ts
│   │       ├── env-helpers.ts
│   │       ├── file-helpers.ts
│   │       ├── keyboard-helpers.ts
│   │       ├── network-mocker.ts
│   │       ├── nested-pdf-handler.ts
│   │       ├── pdf-comparator.ts
│   │       ├── performance-helpers.ts
│   │       ├── screenshot-comparator.ts
│   │       ├── session-manager.ts
│   │       ├── smart-locator.ts
│   │       ├── soft-assertions.ts
│   │       ├── table-helpers.ts
│   │       ├── test-data-factory.ts
│   │       ├── test-helpers.ts
│   │       ├── visual-helpers.ts
│   │       ├── visual-regression.ts
│   │       ├── wait-helpers.ts
│   │       └── xray/             ← Jira X-Ray reporter
│   └── tests/
│       ├── api/                  ← API tests (JSONPlaceholder)
│       ├── saucedemo/            ← E2E, UI, visual tests
│       ├── file-helpers.spec.ts
│       ├── fluent-assertions.spec.ts
│       ├── network-mocker.spec.ts
│       ├── pdf-comparator.spec.ts
│       ├── performance-helpers.spec.ts
│       ├── screenshot-comparator.spec.ts
│       ├── smart-locator.spec.ts
│       └── soft-assertions.spec.ts
│
├── k6/                           ← k6 load testing
│   ├── lib/                      ← Reusable k6 utilities
│   │   ├── http.js               ← HTTP wrappers
│   │   ├── checks.js             ← Check builders
│   │   ├── thresholds.js         ← Threshold presets
│   │   ├── scenarios.js          ← Load pattern builders
│   │   ├── data.js               ← Test data generators
│   │   └── reporter.js           ← Custom HTML + JSON reporter
│   ├── tests/                    ← Load test scripts
│   │   ├── smoke.test.js
│   │   ├── load.test.js
│   │   ├── stress.test.js
│   │   ├── spike.test.js
│   │   ├── crud.test.js
│   │   └── batch.test.js
│   └── results/                  ← JSON summaries (gitignored)
│
├── k6-report/                    ← HTML reports (gitignored)
├── __snapshots__/                ← Visual baselines (committed)
├── docs/                         ← Documentation
│   ├── UTILITIES.md              ← Master utility index
│   ├── k6/                       ← k6 documentation
│   └── *.md                      ← Per-utility guides
├── env/                          ← Environment configs
│   ├── .env.dev
│   └── .env.qa
├── scripts/                      ← Build scripts
├── playwright.config.ts
├── browserstack.config.ts
├── tsconfig.json
├── Jenkinsfile
├── azure-pipelines.yml
└── .github/workflows/
```

---

## Playwright Tests

### Running Tests

```bash
# All tests
npm test

# By environment
npm run test:dev
npm run test:qa

# By browser
npm run test:chromium

# By tag
npx playwright test --grep @smoke
npx playwright test --grep @P1

# Debug
npm run test:debug
npm run test:ui
```

### Reports

```bash
npm run report:html              # Playwright HTML report
npm run report:allure            # Full Allure report
npm run report:allure:single     # Single-file Allure (no traces)
```

### Visual Baselines

```bash
UPDATE_SNAPSHOTS=true npm test   # Update all baselines locally
# For CI (Linux) baselines: trigger GitHub Actions with update_snapshots=true
```

---

## k6 Load Tests

k6 must be [installed separately](https://k6.io/docs/getting-started/installation/).

### Running Tests

```bash
npm run k6:smoke    # 1 VU, 1 iteration — sanity check
npm run k6:load     # Ramp to 20 VUs, hold 2 min
npm run k6:stress   # Ramp to 125% capacity
npm run k6:spike    # Sudden burst then recovery
npm run k6:crud     # Full CRUD user journey
npm run k6:batch    # Parallel/batch requests
```

### Real-Time Dashboard

```bash
npm run k6:smoke:dashboard   # Live dashboard at http://127.0.0.1:5665
npm run k6:load:dashboard    # + exports HTML snapshot to k6-report/
```

### Custom Target

```bash
k6 run --env BASE_URL=https://staging.api.example.com k6/tests/load.test.js
k6 run --env PEAK_VUS=50 --env HOLD_DURATION=5m k6/tests/load.test.js
```

---

## Key Utilities

### SmartLocator — Self-Healing Locators

```typescript
await smart.register('submit-btn', [
  { locator: page.getByTestId('submit'), weight: 300 },
  { locator: page.getByRole('button', { name: 'Submit' }), weight: 200 },
  { locator: page.locator('#submit-btn'), weight: 100 },
]);
// If all user locators fail, auto-extracted DOM strategies heal the locator
const btn = await smart.locate('submit-btn');
```

### Visual Regression — Multi-Baseline + Masking

```typescript
const visual = new VisualRegression({ maxBaselines: 4 });
await visual.assertPage(page, {
  name: 'dashboard',
  testFilePath: __filename,
  mask: [page.locator('.timestamp')],
  maskSelectors: ['iframe', '.ad-banner'],
  maskRegions: [{ x: 10, y: 50, width: 200, height: 30 }],
});
// UPDATE_SNAPSHOTS=true npx playwright test
```

### Wait Helpers — BrowserStack-Safe

```typescript
// Uses locator.waitFor() — always throws on timeout, never hangs
await waitFor(page.locator('.spinner'), 'hidden');
await waitForVisible(page.locator('.modal'));
await waitForCondition(async () => {
  return (await page.locator('.item').count()) > 5;
}, { timeout: 10_000, message: 'Expected more than 5 items' });
```

### Fluent Assertions — Chainable

```typescript
await expect$(locator)
  .toBeVisible()
  .toHaveText('Submit')
  .toHaveCss('color', 'rgb(0, 0, 255)')
  .toBeEnabled();
```

### Soft Assertions — Collect All Failures

```typescript
const soft = new SoftAssert();
await soft.expect(nameField).toBeVisible().toHaveValue('Alice');
await soft.expect(emailField).toHaveValue('alice@test.com');
await soft.expect(submitBtn).toBeEnabled();
soft.assertAll(); // Throws with ALL failures at once
```

### API Client — Typed HTTP

```typescript
const api = new ApiClient(page, { bearerToken: 'jwt' });
const { body, status } = await api.get<User[]>('/api/users');
api.expectStatus(response, 200);
api.expectBodyHasKeys(response, ['id', 'name', 'email']);
```

### Network Mocker

```typescript
const mocker = new NetworkMocker(page);
await mocker.start();
mocker.mockGet('/api/users', { body: [{ id: 1, name: 'Alice' }] });
mocker.mockAndModify('**/api/data', async (route, res) => {
  const json = await res.json();
  json.push({ name: 'New Item' });
  return { json };
});
```

### Performance Helpers — Web Vitals

```typescript
// As a fixture — auto-attaches to Allure + Playwright HTML
test('dashboard loads fast', async ({ page, perf }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  // Metrics collected and attached automatically
});
```

### Keyboard & Clipboard

```typescript
await setClipboardAndPaste(page, page.locator('#search'), 'Hello World');
await verifyTabOrder(page, ['#name', '#email', '#phone', 'button[type="submit"]']);
```

### Environment Config

```typescript
const config = buildConfig({
  baseUrl:  { env: 'BASE_URL', required: true },
  timeout:  { env: 'TIMEOUT', type: 'number', default: 30000 },
  headless: { env: 'HEADLESS', type: 'boolean', default: true },
});
```

---

## CI/CD

| Platform | File | Features |
|---|---|---|
| GitHub Actions | `.github/workflows/playwright.yml` | Push/PR/manual, update baselines, sharding |
| Jenkins | `Jenkinsfile` | Parameterized pipeline |
| Azure DevOps | `azure-pipelines.yml` | Parameters + variable groups |
| BrowserStack | `browserstack.config.ts` | Real devices and browsers |

---

## Documentation

| Topic | Guide |
|---|---|
| **All utilities index** | [`docs/UTILITIES.md`](docs/UTILITIES.md) |
| **k6 load testing** | [`docs/k6/README.md`](docs/k6/README.md) |
| Smart Locator | [`docs/smart-locator.md`](docs/smart-locator.md) |
| Fluent Assertions | [`docs/fluent-assertions.md`](docs/fluent-assertions.md) |
| Soft Assertions | [`docs/soft-assertions.md`](docs/soft-assertions.md) |
| Visual Regression | [`docs/visual-regression.md`](docs/visual-regression.md) |
| Screenshot Comparator | [`docs/screenshot-comparator.md`](docs/screenshot-comparator.md) |
| API Client | [`docs/api-client.md`](docs/api-client.md) |
| Network Mocker | [`docs/network-mocker.md`](docs/network-mocker.md) |
| PDF Comparator | [`docs/pdf-comparator.md`](docs/pdf-comparator.md) |
| Session Manager | [`docs/session-manager.md`](docs/session-manager.md) |
| Wait Helpers | [`docs/wait-helpers.md`](docs/wait-helpers.md) |
| Keyboard Helpers | [`docs/keyboard-helpers.md`](docs/keyboard-helpers.md) |
| Performance Helpers | [`docs/performance-helpers.md`](docs/performance-helpers.md) |
| DateTime Helpers | [`docs/datetime-helpers.md`](docs/datetime-helpers.md) |
| Table Helpers | [`docs/table-helpers.md`](docs/table-helpers.md) |
| File Helpers | [`docs/file-helpers.md`](docs/file-helpers.md) |
| Env Helpers | [`docs/env-helpers.md`](docs/env-helpers.md) |
| Accessibility Helpers | [`docs/accessibility-helpers.md`](docs/accessibility-helpers.md) |
| Visual Helpers | [`docs/visual-helpers.md`](docs/visual-helpers.md) |
| Allure Helpers | [`docs/allure-helpers.md`](docs/allure-helpers.md) |
| Test Data Factory | [`docs/test-data-factory.md`](docs/test-data-factory.md) |
| X-Ray Reporter | [`docs/xray-reporter.md`](docs/xray-reporter.md) |

---

## Tech Stack

| Category | Libraries |
|---|---|
| Test runner | `@playwright/test` |
| Language | TypeScript 6 |
| Load testing | k6 |
| Reporting | Allure, Playwright HTML |
| Visual diff | pixelmatch, pngjs |
| PDF | pdf-parse |
| HTTP | axios |
| Linting | ESLint, Prettier |
| CI | GitHub Actions, Jenkins, Azure DevOps |
