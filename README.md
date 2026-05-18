# Playwright Utilities

A comprehensive Playwright test automation framework built with TypeScript. Includes self-healing locators, visual regression with multi-baseline support, API testing, network mocking, PDF comparison, session management, and CI/CD integration.

## Quick Start

```bash
npm install
npx playwright install
npm test                          # Run all tests
npm run report:allure:single      # Generate single-file Allure report
```

## Project Structure

```
├── __snapshots__/                # Visual baselines (committed to repo for CI)
│   └── <spec-file>/
│       └── <snapshot-name>/
│           └── <platform>/       # win32, linux, or darwin
│               ├── baseline-1.png
│               └── baseline-2.png
├── env/                          # Environment configs
│   ├── .env.dev
│   └── .env.qa
├── src/
│   ├── main/
│   │   ├── assertions/           # Fluent chainable assertions
│   │   ├── pages/                # Page Objects (POM)
│   │   │   ├── base.page.ts     # Base with SmartLocator integration
│   │   │   └── saucedemo/       # SauceDemo page objects
│   │   └── utils/                # All utilities (17 modules)
│   └── tests/
│       ├── saucedemo/            # Functional, E2E, UI, Visual tests
│       ├── fluent-assertions.spec.ts
│       ├── smart-locator.spec.ts
│       ├── screenshot-comparator.spec.ts
│       ├── network-mocker.spec.ts
│       └── pdf-comparator.spec.ts
├── scripts/                      # Build scripts (allure-single.js)
├── docs/                         # Detailed documentation
├── playwright.config.ts          # Main config
├── browserstack.config.ts        # BrowserStack real devices
├── Jenkinsfile                   # Jenkins pipeline
├── azure-pipelines.yml           # Azure DevOps pipeline
└── .github/workflows/            # GitHub Actions
```

## Utilities Overview

| Utility | Purpose |
|---------|---------|
| **SmartLocator** | Self-healing locators with weighted strategies |
| **Fluent Assertions** | Chainable `expect$()` covering all Playwright assertions |
| **Visual Regression** | User-facing visual testing — multi-baseline + masking + intelligent diff |
| **Screenshot Comparator** | Low-level diff engine that classifies pixel differences |
| **API Client** | Typed HTTP helpers with validation |
| **Test Data Factory** | Seeded fake data generation |
| **Soft Assertions** | Collect all failures, report at end |
| **Network Mocker** | Mock/modify/HAR replay/WebSocket |
| **PDF Comparator** | Download, mask dynamic content, compare |
| **Session Manager** | Full session persistence with token refresh |
| **DateTime Helpers** | Clock control, date pickers, formatting |
| **Table Helpers** | Read/sort/filter/paginate data grids |
| **Wait Helpers** | API waits, element stability, retry |
| **Accessibility Helpers** | Quick a11y checks |
| **Visual Helpers** | Scroll, highlight, console errors |
| **Allure Helpers** | Suite hierarchy, tags, steps |
| **X-Ray Reporter** | Push results to Jira (disabled by default) |

## Commands

```bash
# ─── Test Execution ───────────────────────────────────────
npm test                              # All tests, dev env
npm run test:qa                       # QA environment
npm run test:chromium                 # Chromium only
npx playwright test --grep @smoke    # Filter by tag

# ─── Reports ─────────────────────────────────────────────
npm run report:allure                 # Full Allure report
npm run report:allure:single          # Single HTML file (no traces)
npm run report:html                   # Playwright HTML report

# ─── Visual Baselines ────────────────────────────────────
UPDATE_SNAPSHOTS=true npm test        # Update all baselines
npx playwright test visual --update   # Update specific tests

# ─── BrowserStack ─────────────────────────────────────────
npx playwright test --config=browserstack.config.ts
npx playwright test --config=browserstack.config.ts --project="BS iPhone 15"

# ─── Code Quality ─────────────────────────────────────────
npm run lint
npm run format
```

## Key Features

### SmartLocator (Self-Healing)

```typescript
// Register with weighted locators — highest weight tried first
await smart.register('submit-btn', [
  { locator: page.getByTestId('submit'), weight: 300 },
  { locator: page.getByRole('button', { name: 'Submit' }), weight: 200 },
  { locator: page.locator('#submit-btn'), weight: 100 },
]);

// If all user locators fail, auto-extracted DOM strategies heal the locator
const btn = await smart.locate('submit-btn');
```

### Visual Regression (Multi-Baseline + Masking)

```typescript
const visual = new VisualRegression({ maxBaselines: 4 });

// Compares against stored baselines — passes if ANY match
const result = await visual.assertPage(page, {
  name: 'dashboard',
  testFilePath: __filename,
  mask: [page.locator('.timestamp')],           // Hide by Locator
  maskSelectors: ['iframe', '.ad-banner'],      // Hide by CSS selector
  maskRegions: [{ x: 10, y: 50, width: 200, height: 30 }], // Black out area
});

// Update baselines: UPDATE_SNAPSHOTS=true npx playwright test
```

Baselines stored in `__snapshots__/<spec-file>/<name>/<platform>/baseline-N.png` and committed to git for CI. The `<platform>` segment (`win32`, `linux`, `darwin`) isolates baselines per OS so font and rendering differences don't cause cross-platform false positives.

**Generating Linux baselines for CI:** trigger the GitHub Actions workflow manually with `update_snapshots=true` — it will capture baselines on `ubuntu-latest` and push them back to the branch automatically.

### API Client

```typescript
const api = new ApiClient(page, { bearerToken: 'jwt' });
const { body, status } = await api.get<User[]>('/api/users');
api.expectStatus(response, 200);
api.expectBodyHasKeys(response, ['id', 'name']);
```

### Test Data Factory

```typescript
const data = new TestDataFactory(12345); // Seeded = reproducible
data.person();      // { firstName, lastName, email, phone, username }
data.address();     // { street, city, state, zip, country }
data.creditCard();  // { number, expiry, cvv, holder }
data.uuid();        // '550e8400-...'
```

### Soft Assertions

```typescript
const soft = new SoftAssert();
await soft.expect(nameField).toBeVisible();
await soft.expect(emailField).toHaveValue('test@example.com');
await soft.expect(submitBtn).toBeEnabled();
soft.assertAll(); // Throws with ALL failures at once
```

### Network Mocker

```typescript
const mocker = new NetworkMocker(page);
await mocker.start();
mocker.mockGet('/api/users', { body: [{ id: 1, name: 'Alice' }] });
mocker.mockAndModify('**/api/data', async (route, res) => {
  const json = await res.json();
  json.push({ name: 'New' });
  return { json };
});
```

### Allure Report Organization

```typescript
test.beforeEach(async ({}, testInfo) => {
  await configureAllure({
    parentSuite: 'E-Commerce',
    suite: 'Checkout',
    subSuite: 'Payment',
    tags: ['smoke', 'P1'],
    severity: 'critical',
  });
});
```

## CI/CD

All three pipelines support configurable parameters (environment, browser, workers, retries, tags, sharding, report mode, X-Ray integration):

- **GitHub Actions:** `.github/workflows/playwright.yml` — triggers on push/PR/manual
- **Jenkins:** `Jenkinsfile` — parameterized pipeline
- **Azure DevOps:** `azure-pipelines.yml` — parameters + variable groups

## Documentation

| Utility | Guide |
|---------|-------|
| SmartLocator | [`docs/smart-locator.md`](docs/smart-locator.md) |
| Fluent Assertions | [`docs/fluent-assertions.md`](docs/fluent-assertions.md) |
| Visual Regression | [`docs/visual-regression.md`](docs/visual-regression.md) |
| Screenshot Comparator | [`docs/screenshot-comparator.md`](docs/screenshot-comparator.md) |
| API Client | [`docs/api-client.md`](docs/api-client.md) |
| Test Data Factory | [`docs/test-data-factory.md`](docs/test-data-factory.md) |
| Soft Assertions | [`docs/soft-assertions.md`](docs/soft-assertions.md) |
| Network Mocker | [`docs/network-mocker.md`](docs/network-mocker.md) |
| PDF Comparator | [`docs/pdf-comparator.md`](docs/pdf-comparator.md) |
| Session Manager | [`docs/session-manager.md`](docs/session-manager.md) |
| DateTime Helpers | [`docs/datetime-helpers.md`](docs/datetime-helpers.md) |
| Table/Grid Helpers | [`docs/table-helpers.md`](docs/table-helpers.md) |
| Wait Helpers | [`docs/wait-helpers.md`](docs/wait-helpers.md) |
| Accessibility Helpers | [`docs/accessibility-helpers.md`](docs/accessibility-helpers.md) |
| Visual Helpers | [`docs/visual-helpers.md`](docs/visual-helpers.md) |
| Allure Helpers | [`docs/allure-helpers.md`](docs/allure-helpers.md) |
| X-Ray Reporter | [`docs/xray-reporter.md`](docs/xray-reporter.md) |

Full API reference: [`docs/UTILITIES.md`](docs/UTILITIES.md)

## Tech Stack

@playwright/test • TypeScript • ESLint • Prettier • Allure • pixelmatch • pngjs • pdf-parse • axios • cross-env
