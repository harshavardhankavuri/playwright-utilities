# Playwright Utilities

A comprehensive Playwright test automation framework built with TypeScript following the **Page Object Model (POM)** pattern. Includes advanced utilities for screenshot comparison, PDF validation, network mocking, session management, accessibility checks, and BrowserStack real-device integration.

## Table of Contents

- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Page Object Model](#page-object-model)
- [Fluent Assertion Library](#fluent-assertion-library)
- [Screenshot Comparator](#screenshot-comparator)
- [Multi-Baseline Snapshot Manager](#multi-baseline-snapshot-manager)
- [PDF Comparator](#pdf-comparator)
- [Network Mocker](#network-mocker)
- [Session Manager](#session-manager)
- [DateTime Helpers](#datetime-helpers)
- [Table/Grid Helpers](#tablegrid-helpers)
- [Wait Helpers](#wait-helpers)
- [Auth Helpers](#auth-helpers)
- [Accessibility Helpers](#accessibility-helpers)
- [Visual Helpers](#visual-helpers)
- [BrowserStack Integration](#browserstack-integration)
- [Reporting](#reporting)

> **Full API Reference:** See [`docs/UTILITIES.md`](docs/UTILITIES.md) for detailed usage examples of every utility.
> **Screenshot Guide:** See [`docs/screenshot-comparator-guide.md`](docs/screenshot-comparator-guide.md) for the visual testing deep-dive.

## Project Structure

```
├── env/                          # Environment configuration
│   ├── .env.dev                  # Development environment
│   └── .env.qa                   # QA environment
├── src/
│   ├── main/                     # Framework source
│   │   ├── assertions/           # Fluent chainable assertion library
│   │   │   ├── fluent-expect.ts
│   │   │   └── index.ts
│   │   ├── data/                 # Test data constants
│   │   │   ├── test-data.ts
│   │   │   └── index.ts
│   │   ├── fixtures/             # Custom Playwright fixtures
│   │   │   ├── page-fixtures.ts
│   │   │   └── index.ts
│   │   ├── pages/                # Page Object classes
│   │   │   ├── base.page.ts
│   │   │   ├── home.page.ts
│   │   │   └── index.ts
│   │   └── utils/                # Utility libraries
│   │       ├── accessibility-helpers.ts
│   │       ├── auth-helpers.ts
│   │       ├── datetime-helpers.ts
│   │       ├── network-mocker.ts
│   │       ├── pdf-comparator.ts
│   │       ├── screenshot-comparator.ts
│   │       ├── session-manager.ts
│   │       ├── snapshot-manager.ts
│   │       ├── table-helpers.ts
│   │       ├── test-helpers.ts
│   │       ├── visual-helpers.ts
│   │       ├── wait-helpers.ts
│   │       └── index.ts
│   └── tests/                    # Test spec files
│       ├── home.spec.ts
│       ├── fluent-assertions.spec.ts
│       ├── screenshot-comparator.spec.ts
│       ├── snapshot-manager.spec.ts
│       ├── pdf-comparator.spec.ts
│       └── network-mocker.spec.ts
├── browserstack.config.ts        # BrowserStack real-device config
├── playwright.config.ts          # Local Playwright config
├── tsconfig.json
├── .eslintrc.json
└── .prettierrc
```

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9
- Java Runtime (for Allure reports)

### Installation

```bash
npm install
npx playwright install
```

### Running Tests

```bash
# Run all tests (defaults to dev environment)
npm test

# Run against specific environment
npm run test:dev
npm run test:qa

# Run in headed mode / UI mode / debug
npm run test:headed
npm run test:ui
npm run test:debug

# Run only Chromium
npm run test:chromium

# Run on BrowserStack
npx playwright test --config=browserstack.config.ts
```

### Linting & Formatting

```bash
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix issues
npm run format        # Format all files
npm run format:check  # Check formatting
```

## Environment Configuration

Environment files live in `env/`. Switch with the `ENV` variable:

```bash
npm run test:dev    # Uses env/.env.dev
npm run test:qa     # Uses env/.env.qa
```

Each file contains:

```env
BASE_URL=https://your-app.com
ENV=dev
BROWSERSTACK_USERNAME=your_username
BROWSERSTACK_ACCESS_KEY=your_key
```

## Page Object Model

All page objects extend `BasePage` with shared methods:

```typescript
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  readonly usernameInput = this.page.getByLabel('Username');
  readonly passwordInput = this.page.getByLabel('Password');
  readonly submitButton = this.page.getByRole('button', { name: 'Sign in' });

  async login(username: string, password: string): Promise<void> {
    await this.fill(this.usernameInput, username);
    await this.fill(this.passwordInput, password);
    await this.click(this.submitButton);
  }
}
```

**BasePage methods:** `navigate`, `waitForPageLoad`, `click`, `fill`, `getText`, `isVisible`, `waitForElement`, `getTitle`, `getUrl`

Register page objects in `src/main/fixtures/page-fixtures.ts` for automatic injection:

```typescript
test('login test', async ({ loginPage }) => {
  await loginPage.login('admin', 'password');
});
```

## Fluent Assertion Library

Chainable assertions that execute sequentially when awaited:

```typescript
import { expect$, fluentExpectPage } from '../main/fixtures';

// Chain multiple locator assertions
await expect$(locator)
  .toBeVisible()
  .toHaveText('Submit')
  .toHaveCss('color', 'rgb(0, 0, 255)')
  .toBeClickable()
  .toHaveAccessibleName('Submit form');

// Negation
await expect$(locator).not.toBeVisible().toBeHidden();

// Page-level assertions
await fluentExpectPage(page)
  .toHaveTitle(/Dashboard/)
  .toHaveURL('/dashboard');

// Custom assertion in the chain
await expect$(locator)
  .toBeVisible()
  .satisfies(async (loc) => {
    const box = await loc.boundingBox();
    if (!box || box.width < 100) throw new Error('Too narrow');
  });
```

**All Playwright locator assertions supported:** `toBeAttached`, `toBeVisible`, `toBeHidden`, `toBeEnabled`, `toBeDisabled`, `toBeEditable`, `toBeFocused`, `toBeChecked`, `toBeEmpty`, `toBeInViewport`, `toBeClickable`, `toHaveText`, `toContainText`, `toHaveValue`, `toHaveValues`, `toHaveAttribute`, `toHaveCss`, `toHaveClass`, `toContainClass`, `toHaveId`, `toHaveJSProperty`, `toHaveAccessibleName`, `toHaveAccessibleDescription`, `toHaveRole`, `toHaveCount`, `toHaveScreenshot`, `toMatchAriaSnapshot`

## Screenshot Comparator

Intelligent pixel-level comparison that classifies differences:

```typescript
import { ScreenshotComparator, DiffSeverity } from '../main/utils';

const comparator = new ScreenshotComparator({
  maxDiffPercentage: 0.5,
  maxStructuralPixels: 50,
  colorToleranceDelta: 25,
  maxAlignmentShift: 3,
  outputDir: 'test-results/diff-images',
});

const result = await comparator.compare(baselineBuffer, actualBuffer);

console.log(result.summary);
// ⚠️ MINOR: Small differences detected — likely alignment or rendering variance.
//    Diff: 1.5% of pixels differ.
//    Breakdown:
//      • Anti-aliasing:   10691 px
//      • Alignment shift: 16529 px
//      • Color tolerance: 0 px
//      • Structural:      0 px
```

**Classification categories:**

| Category | Detection | Verdict |
|----------|-----------|---------|
| Anti-aliasing | Pixel on high-contrast edge, similar pixel in neighbor | Noise — ignore |
| Alignment shift | Same pixel exists within 1-3px radius | Layout jitter — not a bug |
| Color tolerance | Perceptual color delta below threshold | Rendering variance — ignore |
| Structural | None of the above | Real bug |

**Severity levels:** `NONE` → `NEGLIGIBLE` → `MINOR` → `MAJOR`

## Multi-Baseline Snapshot Manager

Store multiple valid baselines per test — passes if ANY match:

```typescript
import { SnapshotManager } from '../main/utils';

const manager = new SnapshotManager();

// Compares against all stored baselines
const result = await manager.assertScreenshot(page, { name: 'homepage' });

// Element-level
const result = await manager.assertElementScreenshot(locator, { name: 'button' });

// Add a new valid baseline variant
manager.addBaseline('homepage', screenshotBuffer);

// Update baselines
// ENV: UPDATE_SNAPSHOTS=true npx playwright test
await manager.assertScreenshot(page, { name: 'homepage', updateBaseline: true });
```

## PDF Comparator

Download PDFs from embedded elements, compare with masking for dynamic content:

```typescript
import { PdfComparator, PdfMasks } from '../main/utils';

const comparator = new PdfComparator({
  masks: [PdfMasks.DATE_US, PdfMasks.TIME, PdfMasks.UUID, PdfMasks.CURRENCY],
  regionMasks: [
    { page: 1, startLine: 3, endLine: 5, description: 'Header timestamps' },
    { page: 2, startLine: 8, startChar: 20, endChar: 45, description: 'Transaction ID' },
  ],
});

// Click button → wait for PDF response → download → compare
const result = await comparator.compareFromResponse(
  page,
  'button#generate-pdf',
  'monthly-invoice',
);

// Download from embed element
const result = await comparator.compareFromEmbed(page, 'embed#pdf-viewer', 'report');

// Download from URL
const result = await comparator.compareFromUrl(page, '/api/report.pdf', 'report');
```

**Pre-built masks:** `DATE_US`, `DATE_ISO`, `DATE_LONG`, `TIME`, `DATETIME_ISO`, `UUID`, `EMAIL`, `PHONE`, `CURRENCY`, `PAGE_NUMBER`, `REFERENCE_NUMBER`

**Region masks:** Mask by page + line range + character range.

## Network Mocker

Full network interception, mocking, modification, and HAR replay:

```typescript
import { NetworkMocker } from '../main/utils';

const mocker = new NetworkMocker(page, { recordAll: true });
await mocker.start();

// ─── Mock API (no real request) ──────────────────────────────
mocker.mockGet('/api/users', { body: [{ id: 1, name: 'Alice' }] });
mocker.mockPost('/api/login', { status: 200, body: { token: 'abc' } });

// ─── Dynamic responses ──────────────────────────────────────
mocker.mockPost('/api/auth', (request) => {
  const body = JSON.parse(request.postData() || '{}');
  return body.password === 'secret'
    ? { status: 200, body: { token: 'jwt' } }
    : { status: 401, body: { error: 'Unauthorized' } };
});

// ─── Modify real responses (intercept + patch) ───────────────
mocker.mockAndModify('**/api/v1/fruits', async (route, response) => {
  const json = await response.json();
  json.push({ name: 'Loquat', id: 100 });
  return { json };
});

// ─── Simple JSON patching ────────────────────────────────────
mocker.patchJson('/api/user/profile', { name: 'Overridden', verified: true });

// ─── Error simulation ────────────────────────────────────────
mocker.mockError('/api/broken');
mocker.mockTimeout('/api/hang', 10000);
mocker.mockSlow('/api/slow', 2000, { body: { ok: true } });

// ─── HAR record & replay ────────────────────────────────────
await mocker.recordHAR('./hars/api.har', { url: '**/api/**' });
await mocker.replayFromHAR('./hars/api.har', { url: '**/api/**' });

// ─── WebSocket mocking ──────────────────────────────────────
await mocker.mockWebSocket('wss://example.com/ws', (ws) => {
  ws.onMessage((msg) => { if (msg === 'ping') ws.send('pong'); });
});

// ─── Request inspection ──────────────────────────────────────
mocker.wasCalled('/api/users');           // true/false
mocker.callCount('/api/users');           // number
mocker.getRequests('/api/login');         // CapturedRequest[]
mocker.getRequestBodies('/api/login');    // parsed bodies

await mocker.stop();
```

## Session Manager

Full session persistence with refresh token support — eliminates login per test:

```typescript
import { SessionManager } from '../main/utils';

const session = new SessionManager({
  tokenKey: 'access_token',
  refreshTokenKey: 'refresh_token',
  refreshEndpoint: '/api/auth/refresh',
  sessionTTL: 25 * 60 * 1000,  // 25 min
});

// In global setup (runs once):
await session.ensure(page, 'admin', {
  url: '/login',
  username: 'admin@company.com',
  password: process.env.ADMIN_PASSWORD!,
  successUrl: /dashboard/,
});

// In test beforeEach (no login needed):
test.beforeEach(async ({ page }) => {
  await session.restore(page, 'admin');
  await page.goto('/dashboard'); // Already authenticated
});
```

**Key features:**
- Captures cookies + localStorage + **sessionStorage** (Playwright only does first two)
- Auto-decodes JWT `exp` claim for expiry detection
- Attempts token refresh before falling back to re-login
- Configurable TTL with expiry buffer
- Supports custom login flows (MFA, OAuth)

## DateTime Helpers

Clock control, date formatting, timezone simulation, and date picker interaction:

```typescript
import {
  freezeClock, advanceClock, installClock, resumeClock,
  formatDate, today, relativeDate, relativeTo,
  fillDateInput, selectDateInPicker,
  TIMEZONES,
} from '../main/utils';

// ─── Freeze time for deterministic tests ─────────────────────
await freezeClock(page, '2025-06-15T10:30:00Z');

// ─── Install controllable clock ──────────────────────────────
await installClock(page, '2025-01-01T00:00:00Z');
await advanceClock(page, 60_000); // advance 1 minute

// ─── Date formatting for assertions ─────────────────────────
formatDate(new Date(), 'MM/DD/YYYY');     // "06/15/2025"
today('YYYY-MM-DD');                       // "2025-06-15"
relativeDate(7, 'MM/DD/YYYY');            // 7 days from now
relativeTo('2025-01-01', { months: 3 });  // "2025-04-01"

// ─── Fill native date inputs ─────────────────────────────────
await fillDateInput(page, '#start-date', '2025-03-15');
await fillDateTimeInput(page, '#appointment', '2025-03-15T14:30');

// ─── Navigate custom date pickers ────────────────────────────
await selectDateInPicker(page, {
  triggerSelector: '#date-field',
  targetDate: '2025-03-15',
  nextMonthSelector: 'button[aria-label="Next month"]',
  prevMonthSelector: 'button[aria-label="Previous month"]',
  daySelector: (day) => `button:has-text("${day}")`,
  currentMonthSelector: '.calendar-header',
});

// ─── Timezone constants ──────────────────────────────────────
// TIMEZONES.US_EASTERN, TIMEZONES.UK, TIMEZONES.JAPAN, etc.
```

## Table/Grid Helpers

Read, interact with, and assert on HTML tables and data grids:

```typescript
import { TableHelper } from '../main/utils';

const table = new TableHelper(page, { rootSelector: '#users-table' });

// ─── Read data ───────────────────────────────────────────────
const rows = await table.getAllRows();        // [{Name: 'Alice', Email: '...'}, ...]
const headers = await table.getHeaders();     // ['Name', 'Email', 'Status']
const emails = await table.getColumnValues('Email');
const count = await table.getRowCount();

// ─── Search & filter ─────────────────────────────────────────
const row = await table.findRow('Email', 'alice@test.com');
const activeRows = await table.findRows('Status', /Active/);
const exists = await table.hasRow('Name', 'Bob');

// ─── Sorting ─────────────────────────────────────────────────
await table.clickHeader('Name');
await table.expectColumnSorted('Name', 'asc');

// ─── Assertions ──────────────────────────────────────────────
await table.expectRowCount(10);
await table.expectRowExists({ Name: 'Alice', Status: 'Active' });
await table.expectRowNotExists({ Name: 'Deleted User' });
await table.expectColumnContains('Status', 'Active');
await table.expectCellText(0, 'Name', 'Alice');
await table.expectEmpty();
await table.expectNotEmpty();

// ─── Row interactions ────────────────────────────────────────
await table.clickRow(0);
await table.clickRowByValue('Name', 'Alice');
await table.clickActionInRow('Name', 'Alice', 'Actions', 'button:has-text("Edit")');

// ─── Pagination ──────────────────────────────────────────────
await table.nextPage();
await table.prevPage();
await table.goToPage(3);

// ─── Selection ───────────────────────────────────────────────
await table.selectRow(0);
await table.selectAll();
const selected = await table.getSelectedRowIndices();

// ─── Inline editing ──────────────────────────────────────────
await table.editCell(0, 'Name', 'New Name', {
  activateBy: 'dblclick',
  confirmBy: 'enter',
});
```

**Works with:** Standard HTML tables, AG Grid, Material UI Table, Ant Design Table, and any grid using `role="grid"` / `role="row"` / `role="gridcell"`.

## Wait Helpers

Common wait patterns beyond Playwright's built-in auto-waiting:

```typescript
import {
  waitForApiResponse, waitForNetworkIdle, waitForElementStable,
  waitForCount, retryAction, waitForUrl, waitForDownload,
} from '../main/utils';

// Wait for API response triggered by an action
const data = await waitForApiResponse(page, '/api/users', async () => {
  await page.click('button#load');
});

// Wait for element to stop moving (layout stability)
await waitForElementStable(locator);

// Retry flaky interactions
await retryAction(async () => {
  await page.click('button#submit');
  await expect(page.locator('.success')).toBeVisible();
}, { retries: 3, delay: 1000 });

// Wait for download
const filePath = await waitForDownload(page, async () => {
  await page.click('a#download');
}, { saveDir: './downloads' });
```

## Auth Helpers

Simple storage state management (cookies + localStorage):

```typescript
import { saveAuthState, loginAndSave, getAuthStatePath } from '../main/utils';

// Login and save state
await loginAndSave(page, {
  url: '/login',
  username: 'admin@test.com',
  password: 'password',
  successUrl: /dashboard/,
  stateName: 'admin',
});

// Use in tests
test.use({ storageState: getAuthStatePath('admin') });
```

## Accessibility Helpers

Quick a11y checks without full axe-core:

```typescript
import { runA11yChecks, checkImagesHaveAlt, checkHeadingHierarchy } from '../main/utils';

// Run all checks
const result = await runA11yChecks(page);
expect(result.passed).toBe(true);
if (!result.passed) console.log(result.violations);

// Individual checks
const imgCheck = await checkImagesHaveAlt(page);
const headingCheck = await checkHeadingHierarchy(page);
const formCheck = await checkFormLabels(page);
const kbCheck = await checkKeyboardAccessibility(page);
```

## Visual Helpers

Debugging, scrolling, viewport management, and console error collection:

```typescript
import {
  highlightElement, scrollToBottom, scrollToCenter,
  collectConsoleErrors, takeFullPageScreenshot, VIEWPORTS,
} from '../main/utils';

// Highlight for debugging
await highlightElement(locator, { color: 'red', duration: 3000 });

// Scroll utilities
await scrollToCenter(locator);
await scrollToBottom(page);

// Collect console errors during test
const errors = collectConsoleErrors(page);
// ... test actions ...
expect(errors.get()).toHaveLength(0);

// Viewport presets
// VIEWPORTS.mobile (375x812), VIEWPORTS.tablet (768x1024),
// VIEWPORTS.desktop (1440x900), VIEWPORTS.widescreen (1920x1080)
```

## BrowserStack Integration

Run tests on real Android, iPhone, and Windows devices:

```bash
# Run all BrowserStack projects
npx playwright test --config=browserstack.config.ts

# Run specific device
npx playwright test --config=browserstack.config.ts --project="BS iPhone 15"
npx playwright test --config=browserstack.config.ts --project="BS Pixel 8"
npx playwright test --config=browserstack.config.ts --project="BS Chrome Windows"
```

**Available projects:**

| Project | Device |
|---------|--------|
| `BS Chrome Windows` | Chrome latest, Windows 11 |
| `BS Edge Windows` | Edge latest, Windows 11 |
| `BS Firefox Windows` | Firefox, Windows 11 |
| `BS iPhone 15` | Safari/WebKit, iPhone 15 |
| `BS iPhone 14` | Safari/WebKit, iPhone 14 |
| `BS iPad Pro` | Safari/WebKit, iPad Pro 11 |
| `BS Pixel 8` | Chrome, Pixel (Android) |
| `BS Galaxy S23` | Chrome, Galaxy (Android) |

Set credentials in `env/.env.dev`:

```env
BROWSERSTACK_USERNAME=your_username
BROWSERSTACK_ACCESS_KEY=your_access_key
```

## Reporting

```bash
# Playwright HTML report
npm run report:html

# Allure report (requires Java)
npm run report:allure          # Generate + open
npm run report:allure:generate # Generate only
npm run report:allure:open     # Open existing
```

## Tech Stack

- **Test Runner:** @playwright/test
- **Language:** TypeScript (strict mode)
- **Linting:** ESLint + @typescript-eslint + eslint-plugin-playwright
- **Formatting:** Prettier
- **Reporting:** Allure + Playwright HTML + X-Ray Jira (optional)
- **PDF Parsing:** pdf-parse
- **Image Comparison:** pixelmatch + pngjs
- **HTTP Client:** axios (for X-Ray integration)
- **Cross-platform:** cross-env for env variable management

## SmartLocator (Self-Healing)

Locators that automatically heal when UI changes break them:

```typescript
// Register with weighted user locators
await smart.register('submit-btn', [
  { locator: page.getByTestId('submit'), weight: 300 },
  { locator: page.getByRole('button', { name: 'Submit' }), weight: 200 },
  { locator: page.locator('#submit-btn'), weight: 100 },
]);

// Find — tries user locators first, heals with auto strategies if all fail
const btn = await smart.locate('submit-btn');
await btn.click();
```

User locators are tried first (highest weight wins). If all fail, auto-extracted DOM strategies (testId, role, label, text, CSS, xpath) serve as healing fallbacks.

## X-Ray Jira Integration

Push test results to X-Ray — disabled by default, zero overhead until activated:

```bash
XRAY_ENABLED=true XRAY_FEATURE_UPDATE_STATUS=true npx playwright test
```

Tag tests with X-Ray keys: `test('[RPX-124] should login', ...)`. See [`docs/UTILITIES.md`](docs/UTILITIES.md#14-x-ray-jira-reporter) for full setup.
