# Utility Reference Guide

Complete documentation for every utility in the Playwright Utilities framework.

---

## Table of Contents

1. [SmartLocator (Self-Healing)](#1-smartlocator)
2. [Fluent Assertions](#2-fluent-assertions)
3. [Visual Regression](#3-visual-regression)
4. [Screenshot Comparator](#4-screenshot-comparator)
5. [PDF Comparator](#5-pdf-comparator)
6. [Network Mocker](#6-network-mocker)
7. [Session Manager](#7-session-manager)
8. [DateTime Helpers](#8-datetime-helpers)
9. [Table/Grid Helpers](#9-tablegrid-helpers)
10. [Wait Helpers](#10-wait-helpers)
11. [Auth Helpers](#11-auth-helpers)
12. [Accessibility Helpers](#12-accessibility-helpers)
13. [Visual Helpers](#13-visual-helpers)
14. [X-Ray Jira Reporter](#14-x-ray-jira-reporter)

---

## 1. SmartLocator

**File:** `src/main/utils/smart-locator.ts`
**Purpose:** Self-healing locator resolution with weighted user locators and auto-extracted DOM fallbacks.

### How It Works

```
User clicks "Submit" button → SmartLocator.locate('submit-btn')
  │
  ├─ Try user locator #1 (weight 300): getByTestId('submit')     ✅ Found → return
  ├─ Try user locator #2 (weight 200): getByRole('button')       (skipped)
  ├─ Try user locator #3 (weight 100): locator('#submit')        (skipped)
  │
  │  ── ALL user locators failed ──
  │
  ├─ Try auto: data-testid (weight 95)                           ✅ HEALED
  ├─ Try auto: role+aria-label (weight 90)
  ├─ Try auto: CSS path (weight 30)
  └─ Try auto: XPath (weight 20)
```

### Usage

```typescript
import { SmartLocator } from '../main/utils';

const smart = new SmartLocator(page, {
  storeDir: '.locators',       // Where fingerprints are persisted
  strategyTimeout: 3000,       // Timeout per strategy attempt (ms)
  autoUpdate: true,            // Promote working fallbacks automatically
  verbose: true,               // Log healing activity
  enableAutoHealing: true,     // Extract DOM fallbacks on register
});

// ─── Single locator (simplest) ───────────────────────────────
await smart.register('submit-btn', page.getByRole('button', { name: 'Submit' }));

// ─── Multiple weighted locators (recommended) ────────────────
await smart.register('login-email', [
  { locator: page.getByTestId('email-input'), weight: 300, description: 'testId' },
  { locator: page.getByLabel('Email'), weight: 200, description: 'label' },
  { locator: page.locator('#email'), weight: 100, description: 'css:id' },
]);

// ─── Find with auto-healing ──────────────────────────────────
const btn = await smart.locate('submit-btn');  // Throws if not found
await btn.click();

// ─── Detailed result ─────────────────────────────────────────
const result = await smart.find('submit-btn');
if (result.healed) {
  console.log(`Healed using: ${result.usedStrategy?.type}:${result.usedStrategy?.value}`);
}
```

### In Page Objects

```typescript
export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.navigate('/login');
    await this.registerLocator('login-email', [
      { locator: this.page.getByLabel('Email'), weight: 200 },
      { locator: this.page.locator('#email'), weight: 100 },
    ]);
    await this.registerLocator('login-submit', this.page.getByRole('button', { name: 'Sign in' }));
  }

  async login(email: string, password: string): Promise<void> {
    const emailField = await this.findSmart('login-email');
    await emailField.fill(email);
    const submit = await this.findSmart('login-submit');
    await submit.click();
  }
}
```

---

## 2. Fluent Assertions

**File:** `src/main/assertions/fluent-expect.ts`
**Purpose:** Chainable assertions that execute sequentially when awaited.

### Usage

```typescript
import { expect$, fluentExpectPage, fluentExpectResponse } from '../main/fixtures';

// Locator assertions (all Playwright assertions supported)
await expect$(locator)
  .toBeVisible()
  .toHaveText('Submit')
  .toHaveCss('color', 'rgb(0, 0, 255)')
  .toBeClickable()
  .toHaveAccessibleName('Submit form')
  .toBeInViewport();

// Negation
await expect$(locator).not.toBeVisible().toBeHidden();

// Page assertions
await fluentExpectPage(page).toHaveTitle(/Dashboard/).toHaveURL('/dashboard');

// Custom assertion in chain
await expect$(locator).toBeVisible().satisfies(async (loc) => {
  const box = await loc.boundingBox();
  if (!box || box.width < 100) throw new Error('Too narrow');
});

// Response assertions
await fluentExpectResponse(response).toBeOK();
```

---

## 3. Visual Regression

**File:** `src/main/utils/visual-regression.ts`
**Purpose:** End-to-end visual testing with multi-baseline support, masking, and intelligent diff analysis.

### How It Works

```
1. Capture screenshot
   ├── Inject CSS to hide maskSelectors (iframes, spinners)
   ├── Use Playwright's mask option for Locator-based hiding
   └── Apply region masks (gray rectangles on pixel coordinates)

2. Compare against baselines (up to 4 valid states)
   ├── Uses ScreenshotComparator engine for each baseline
   ├── Classifies diffs: anti-aliasing, alignment, color, structural
   └── Passes if ANY baseline matches

3. Result
   ├── passed: true/false
   ├── analysis: full diff breakdown
   └── summary: human-readable report
```

### Storage Structure

```
__snapshots__/
  login.spec.ts/              ← subfolder per spec file
    login-form/               ← subfolder per snapshot name
      baseline-1.png
      baseline-2.png
```

### Usage

```typescript
import { VisualRegression } from '../main/utils';

const visual = new VisualRegression({ maxBaselines: 4 });

// Page comparison
await visual.assertPage(page, {
  name: 'inventory-page',
  testFilePath: __filename,
  fullPage: true,
});

// Element comparison with masking
await visual.assertElement(card, page, {
  name: 'product-card',
  testFilePath: __filename,
  mask: [page.locator('.timestamp')],          // Locator masking
  maskSelectors: ['iframe', '.ad-banner'],     // CSS selector masking
  maskRegions: [{ x: 10, y: 50, width: 200, height: 30 }], // Pixel region masking
});

// Update baselines
// UPDATE_SNAPSHOTS=true npx playwright test
```

**Key features over Playwright's built-in `toHaveScreenshot()`:**
- Up to 4 valid baselines per snapshot (passes if ANY match)
- Three masking strategies: Locator, CSS selector, pixel region
- Intelligent diff classification (AA, alignment, color, structural)
- Per-category tolerance thresholds — distinguishes real bugs from rendering noise

---

## 4. Screenshot Comparator

**File:** `src/main/utils/screenshot-comparator.ts`
**Purpose:** Low-level pixel-diff engine. Takes two PNG buffers and classifies every differing pixel.

> For end-to-end visual testing, use [VisualRegression](#3-visual-regression) instead. This engine is exposed for raw image-vs-image comparison only.

### Classification Pipeline

| Category | Detection Method | Verdict |
|----------|-----------------|---------|
| Anti-aliasing | Pixel on high-contrast edge + similar neighbor in other image | Noise |
| Alignment shift | Same pixel exists within N-px radius | Layout jitter |
| Color tolerance | Perceptual color delta below threshold | Rendering variance |
| Structural | None of the above | Real bug |

### Usage

```typescript
import { ScreenshotComparator, DiffSeverity } from '../main/utils';

const comparator = new ScreenshotComparator({
  threshold: 0.1,              // Pixelmatch sensitivity (0-1, lower = stricter)
  maxDiffPercentage: 0.5,     // Max % diff to still pass
  maxStructuralPixels: 50,    // Max structural pixels before MAJOR
  colorToleranceDelta: 25,    // Color delta threshold (0-255)
  maxAlignmentShift: 3,       // Pixel radius for shift detection
  outputDir: 'test-results/diff-images',
});

const result = await comparator.compare(baselineBuffer, actualBuffer);
// result.isMatch, result.severity, result.summary, result.categoryBreakdown

// Or compare files from disk
const result2 = await comparator.compareFiles('baseline.png', 'actual.png');
```

---

## 5. PDF Comparator

**File:** `src/main/utils/pdf-comparator.ts`
**Purpose:** Download PDFs from embedded elements, compare text with masking.

### Usage

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
const result = await comparator.compareFromResponse(page, 'button#generate-pdf', 'invoice');

// Download from embed element
const result = await comparator.compareFromEmbed(page, 'embed#pdf-viewer', 'report');

// Download from URL
const result = await comparator.compareFromUrl(page, '/api/report.pdf', 'report');

// Download via file download event
const buffer = await comparator.downloadFromClick(page, 'a#download-link', 'receipt');
```

### Pre-built Masks

`DATE_US`, `DATE_ISO`, `DATE_LONG`, `TIME`, `DATETIME_ISO`, `UUID`, `EMAIL`, `PHONE`, `CURRENCY`, `PAGE_NUMBER`, `REFERENCE_NUMBER`

---

## 6. Network Mocker

**File:** `src/main/utils/network-mocker.ts`
**Purpose:** Full network interception, mocking, modification, HAR replay, WebSocket mocking.

### Usage

```typescript
import { NetworkMocker } from '../main/utils';

const mocker = new NetworkMocker(page, { recordAll: true });
await mocker.start();

// Mock API
mocker.mockGet('/api/users', { body: [{ id: 1, name: 'Alice' }] });
mocker.mockPost('/api/login', { status: 200, body: { token: 'abc' } });

// Dynamic responses
mocker.mockPost('/api/auth', (request) => {
  const body = JSON.parse(request.postData() || '{}');
  return body.password === 'secret'
    ? { status: 200, body: { token: 'jwt' } }
    : { status: 401, body: { error: 'Unauthorized' } };
});

// Modify real responses (intercept + patch)
mocker.mockAndModify('**/api/v1/fruits', async (route, response) => {
  const json = await response.json();
  json.push({ name: 'Loquat', id: 100 });
  return { json };
});

// Error simulation
mocker.mockError('/api/broken');
mocker.mockTimeout('/api/hang', 10000);
mocker.mockSlow('/api/slow', 2000, { body: { ok: true } });

// HAR replay
await mocker.replayFromHAR('./hars/api.har', { url: '**/api/**' });

// WebSocket mocking
await mocker.mockWebSocket('wss://example.com/ws', (ws) => {
  ws.onMessage((msg) => { if (msg === 'ping') ws.send('pong'); });
});

// Request inspection
mocker.wasCalled('/api/users');        // true/false
mocker.callCount('/api/users');        // number
mocker.getRequests('/api/login');      // CapturedRequest[]

await mocker.stop();
```

---

## 7. Session Manager

**File:** `src/main/utils/session-manager.ts`
**Purpose:** Full session persistence (cookies + localStorage + sessionStorage) with token refresh.

### Usage

```typescript
import { SessionManager } from '../main/utils';

const session = new SessionManager({
  tokenKey: 'access_token',
  refreshTokenKey: 'refresh_token',
  refreshEndpoint: '/api/auth/refresh',
  sessionTTL: 25 * 60 * 1000,
});

// Global setup (runs once)
await session.ensure(page, 'admin', {
  url: '/login',
  username: 'admin@company.com',
  password: process.env.ADMIN_PASSWORD!,
  successUrl: /dashboard/,
});

// Test beforeEach (no login needed)
test.beforeEach(async ({ page }) => {
  await session.restore(page, 'admin');
  await page.goto('/dashboard');
});
```

### Flow

```
ensure() → Is session valid? → YES → done (fast)
                             → NO  → Has refresh token? → YES → refresh → done
                                                        → NO  → full login → save
```

---

## 8. DateTime Helpers

**File:** `src/main/utils/datetime-helpers.ts`
**Purpose:** Clock control, date formatting, timezone simulation, date picker interaction.

### Usage

```typescript
import {
  freezeClock, installClock, advanceClock, resumeClock,
  formatDate, today, relativeDate, relativeTo,
  fillDateInput, selectDateInPicker, TIMEZONES,
} from '../main/utils';

// Freeze time
await freezeClock(page, '2025-06-15T10:30:00Z');

// Controllable clock
await installClock(page, '2025-01-01T00:00:00Z');
await advanceClock(page, 60_000);  // +1 minute
await resumeClock(page);

// Date formatting
formatDate(new Date(), 'MM/DD/YYYY');   // "06/15/2025"
today('YYYY-MM-DD');                     // "2025-06-15"
relativeDate(7, 'MM/DD/YYYY');          // 7 days from now
relativeTo('2025-01-01', { months: 3 }); // "2025-04-01"

// Fill native inputs
await fillDateInput(page, '#start-date', '2025-03-15');

// Navigate custom date pickers
await selectDateInPicker(page, {
  triggerSelector: '#date-field',
  targetDate: '2025-03-15',
  nextMonthSelector: 'button[aria-label="Next month"]',
  prevMonthSelector: 'button[aria-label="Previous month"]',
  daySelector: (day) => `button:has-text("${day}")`,
  currentMonthSelector: '.calendar-header',
});
```

---

## 9. Table/Grid Helpers

**File:** `src/main/utils/table-helpers.ts`
**Purpose:** Read, interact with, and assert on HTML tables and data grids.

### Usage

```typescript
import { TableHelper } from '../main/utils';

const table = new TableHelper(page, { rootSelector: '#users-table' });

// Read data
const rows = await table.getAllRows();       // [{Name: 'Alice', ...}, ...]
const headers = await table.getHeaders();    // ['Name', 'Email', 'Status']
const count = await table.getRowCount();

// Search
const row = await table.findRow('Email', 'alice@test.com');
const active = await table.findRows('Status', /Active/);

// Sort
await table.clickHeader('Name');
await table.expectColumnSorted('Name', 'asc');

// Assertions
await table.expectRowCount(10);
await table.expectRowExists({ Name: 'Alice', Status: 'Active' });
await table.expectColumnContains('Status', 'Active');

// Interactions
await table.clickRowByValue('Name', 'Alice');
await table.clickActionInRow('Name', 'Alice', 'Actions', 'button:has-text("Edit")');

// Pagination
await table.nextPage();
await table.goToPage(3);

// Selection
await table.selectRow(0);
await table.selectAll();

// Inline editing
await table.editCell(0, 'Name', 'New Name', { activateBy: 'dblclick', confirmBy: 'enter' });
```

---

## 10. Wait Helpers

**File:** `src/main/utils/wait-helpers.ts`
**Purpose:** Higher-level wait patterns beyond Playwright's built-in auto-waiting.

### Usage

```typescript
import {
  waitForApiResponse, waitForNetworkIdle, waitForElementStable,
  waitForCount, retryAction, waitForUrl, waitForDownload,
} from '../main/utils';

// Wait for API response triggered by action
const data = await waitForApiResponse(page, '/api/users', async () => {
  await page.click('button#load');
});

// Wait for element layout stability
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

// Wait for specific element count
await waitForCount(page.locator('.item'), 10);
```

---

## 11. Auth Helpers

**File:** `src/main/utils/auth-helpers.ts`
**Purpose:** Simple Playwright storageState management (cookies + localStorage).

### Usage

```typescript
import { loginAndSave, getAuthStatePath, hasAuthState } from '../main/utils';

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

// Check if state exists
if (!hasAuthState('admin')) { /* re-login */ }
```

---

## 12. Accessibility Helpers

**File:** `src/main/utils/accessibility-helpers.ts`
**Purpose:** Quick a11y checks without full axe-core.

### Usage

```typescript
import {
  runA11yChecks, checkImagesHaveAlt, checkFormLabels,
  checkHeadingHierarchy, checkKeyboardAccessibility,
} from '../main/utils';

// Run all checks
const result = await runA11yChecks(page);
expect(result.passed).toBe(true);
if (!result.passed) {
  console.log('Violations:', result.violations);
  console.log('Warnings:', result.warnings);
}

// Individual checks
const imgCheck = await checkImagesHaveAlt(page);
const formCheck = await checkFormLabels(page);
const headingCheck = await checkHeadingHierarchy(page);
const kbCheck = await checkKeyboardAccessibility(page);
```

---

## 13. Visual Helpers

**File:** `src/main/utils/visual-helpers.ts`
**Purpose:** Debugging, scrolling, viewport management, console error collection.

### Usage

```typescript
import {
  highlightElement, scrollToBottom, scrollToCenter, scrollToTop,
  collectConsoleErrors, getViewportSize, takeFullPageScreenshot, VIEWPORTS,
} from '../main/utils';

// Highlight for debugging
await highlightElement(locator, { color: 'red', duration: 3000 });

// Scroll
await scrollToCenter(locator);
await scrollToBottom(page);
await scrollToTop(page);

// Collect console errors
const errors = collectConsoleErrors(page);
// ... test actions ...
expect(errors.get()).toHaveLength(0);

// Viewport presets
// VIEWPORTS.mobile (375x812), VIEWPORTS.tablet (768x1024),
// VIEWPORTS.desktop (1440x900), VIEWPORTS.widescreen (1920x1080)

// Full-page screenshot
const path = await takeFullPageScreenshot(page, 'homepage');
```

---

## 14. X-Ray Jira Reporter

**File:** `src/main/utils/xray/reporter/xrayReporter.ts`
**Purpose:** Push Playwright test results to X-Ray (Jira) — disabled by default.

### Setup

1. Edit `src/main/utils/xray/xray.config.ts`
2. Set environment variables (see `.env.example`)
3. Reporter is already registered in `playwright.config.ts`

### Environment Variables

```bash
XRAY_ENABLED=true                    # Master switch
XRAY_MODE=cloud                      # 'cloud' or 'dc'
XRAY_FEATURE_CREATE_EXECUTION=true   # Create Jira Test Execution
XRAY_FEATURE_UPDATE_STATUS=true      # Push test results
XRAY_FEATURE_ATTACH_SCREENSHOTS=true # Upload failure screenshots
XRAY_FEATURE_UNTRACKED_REPORT=true   # Report tests without X-Ray keys
JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_PROJECT_KEY=RPX
JIRA_EMAIL=your@email.com
JIRA_API_TOKEN=your-api-token
```

### Test Title Format

Tag tests with X-Ray keys in brackets:

```typescript
test('[RPX-124] should login successfully', ...);
test('[RPX-124][RPX-145] should validate form', ...);
test('[RPX-124,145,167] should process payment', ...);
```

### Features

| Feature | Env Var | Description |
|---------|---------|-------------|
| Create Execution | `XRAY_FEATURE_CREATE_EXECUTION` | Creates Jira issue + pre-links tests |
| Update Status | `XRAY_FEATURE_UPDATE_STATUS` | Bulk imports results at run end |
| Attach Screenshots | `XRAY_FEATURE_ATTACH_SCREENSHOTS` | Uploads failure screenshots |
| Untracked Report | `XRAY_FEATURE_UNTRACKED_REPORT` | Lists tests without X-Ray keys |
