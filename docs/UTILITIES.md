# Utility Reference Guide

Complete index of every utility in the framework. Click any link for full documentation.

---

## Playwright Utilities (`src/main/utils/`)

### UI Interaction

| Utility | File | Description |
|---|---|---|
| [Wait Helpers](./wait-helpers.md) | `wait-helpers.ts` | `waitFor`, `waitForVisible`, `waitForHidden`, `waitForCondition`, `retryAction` |
| [Keyboard Helpers](./keyboard-helpers.md) | `keyboard-helpers.ts` | Shortcuts, clipboard, tab navigation, `verifyTabOrder` |
| [Visual Helpers](./visual-helpers.md) | `visual-helpers.ts` | Scroll, highlight, console errors, network errors, viewports |
| [DateTime Helpers](./datetime-helpers.md) | `datetime-helpers.ts` | Clock control, date pickers, formatting, timezones |
| [Table Helpers](./table-helpers.md) | `table-helpers.ts` | Read/sort/filter/paginate/select/edit data grids |
| [Accessibility Helpers](./accessibility-helpers.md) | `accessibility-helpers.ts` | Alt text, form labels, heading hierarchy, keyboard access |

### Assertions

| Utility | File | Description |
|---|---|---|
| [Fluent Assertions](./fluent-assertions.md) | `assertions/fluent-expect.ts` | Chainable `expect$()` covering all Playwright assertions |
| [Soft Assertions](./soft-assertions.md) | `soft-assertions.ts` | Collect all failures, report at end |

### Visual Testing

| Utility | File | Description |
|---|---|---|
| [Visual Regression](./visual-regression.md) | `visual-regression.ts` | Multi-baseline snapshots with masking and intelligent diff |
| [Screenshot Comparator](./screenshot-comparator.md) | `screenshot-comparator.ts` | Low-level pixel diff engine with AA/alignment/structural classification |
| [Visual Helpers](./visual-helpers.md) | `visual-helpers.ts` | Highlight, scroll, full-page screenshots |

### API & Network

| Utility | File | Description |
|---|---|---|
| [API Client](./api-client.md) | `api-client.ts` | Typed HTTP helpers with validation and chaining |
| [Network Mocker](./network-mocker.md) | `network-mocker.ts` | Mock/modify/HAR replay/WebSocket interception |

### PDF

| Utility | File | Description |
|---|---|---|
| [PDF Comparator](./pdf-comparator.md) | `pdf-comparator.ts` | Download, mask dynamic content, compare text |
| Nested PDF Handler | `nested-pdf-handler.ts` | Download PDFs from nested iframes with visual detection |

### Authentication & Sessions

| Utility | File | Description |
|---|---|---|
| [Session Manager](./session-manager.md) | `session-manager.ts` | Full session persistence (cookies + localStorage + sessionStorage) with token refresh |
| Auth Helpers | `auth-helpers.ts` | `saveAuthState`, `loginAndSave`, `getAuthStatePath` |

### Data & Configuration

| Utility | File | Description |
|---|---|---|
| [Test Data Factory](./test-data-factory.md) | `test-data-factory.ts` | Seeded fake data: people, addresses, credit cards, UUIDs |
| [File Helpers](./file-helpers.md) | `file-helpers.ts` | Read/write JSON and text files, path resolution |
| [Env Helpers](./env-helpers.md) | `env-helpers.ts` | Type-safe env var access, `buildConfig`, `IS_CI`, `isEnv` |
| Test Helpers | `test-helpers.ts` | `randomString`, `randomUUID`, `slugify`, `deepClone`, `pick`, `omit` |

### Reporting & Observability

| Utility | File | Description |
|---|---|---|
| [Allure Helpers](./allure-helpers.md) | `allure-helpers.ts` | Suite hierarchy, tags, steps, attachments, metadata |
| [Performance Helpers](./performance-helpers.md) | `performance-helpers.ts` | Web Vitals + Navigation Timing, attaches to Allure + Playwright HTML |
| [X-Ray Reporter](./xray-reporter.md) | `utils/xray/` | Push results to Jira X-Ray (disabled by default) |

### Smart Locators

| Utility | File | Description |
|---|---|---|
| [Smart Locator](./smart-locator.md) | `smart-locator.ts` | Self-healing locators with weighted strategies and auto-extracted DOM fallbacks |

---

## k6 Load Testing Utilities (`k6/lib/`)

See [k6/README.md](./k6/README.md) for the full guide.

| Utility | File | Description |
|---|---|---|
| [HTTP Helpers](./k6/http.md) | `k6/lib/http.js` | `get`, `post`, `put`, `patch`, `del`, `buildUrl` |
| [Check Builders](./k6/checks.md) | `k6/lib/checks.js` | `statusIs`, `bodyHasField`, `responseTimeLt`, `runChecks` |
| [Threshold Presets](./k6/thresholds.md) | `k6/lib/thresholds.js` | `p95lt`, `errorRateLt`, `standardApiSla`, `combine` |
| [Scenario Builders](./k6/scenarios.md) | `k6/lib/scenarios.js` | `rampUp`, `spikeTest`, `stressTest`, `smokeTest` |
| [Test Data](./k6/data.md) | `k6/lib/data.js` | `randomString`, `feeder`, `buildPayload` |
| [Reporter](./k6/reporter.md) | `k6/lib/reporter.js` | Custom HTML + JSON + stdout via `handleSummary` |

---

## Quick Import Reference

```typescript
// All Playwright utilities from a single import
import {
  // UI
  waitFor, waitForVisible, waitForHidden, waitForCondition,
  retryAction, waitForText,
  pressShortcut, setClipboardAndPaste, verifyTabOrder,
  scrollToCenter, collectConsoleErrors, collectNetworkErrors,
  VIEWPORTS, setViewport,

  // Assertions
  SoftAssert, FluentLocatorExpect,

  // Visual
  VisualRegression, ScreenshotComparator,

  // API & Network
  ApiClient, NetworkMocker,

  // PDF
  PdfComparator, NestedPdfHandler,

  // Auth
  SessionManager, loginAndSave,

  // Data
  TestDataFactory, testData,
  readJsonFile, writeJsonFile, resolveFromRoot,
  requireEnv, getEnv, buildConfig, IS_CI,
  randomString, randomUUID, deepClone, pick, omit,

  // Reporting
  configureAllure, allureStep, allureAttachJson,
  PerformanceCollector, measurePagePerformance,

  // Locators
  SmartLocator,
} from './src/main/utils';
```
