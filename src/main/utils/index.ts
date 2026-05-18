// Core test helpers
export { delay, takeScreenshot, randomString, randomEmail } from './test-helpers';

// Screenshot comparison (advanced pixel-level analysis)
export {
  ScreenshotComparator,
  DiffCategory,
  DiffSeverity,
  type ComparisonResult,
  type ComparatorOptions,
  type DiffRegion,
} from './screenshot-comparator';

// PDF download, comparison, and masking
export {
  PdfComparator,
  PdfMasks,
  type PdfMask,
  type PdfRegionMask,
  type PdfComparisonResult,
  type PdfComparatorOptions,
  type PdfTextDiff,
} from './pdf-comparator';

// Network interception, mocking, and HAR replay
export {
  NetworkMocker,
  type MockResponse,
  type CapturedRequest,
  type CapturedResponse,
  type CapturedExchange,
  type RequestMatcher,
  type DynamicResponseHandler,
  type NetworkMockerOptions,
} from './network-mocker';

// Wait helpers (API response waits, element stability, retry patterns)
export {
  waitForApiResponse,
  waitForNetworkIdle,
  waitForElementStable,
  waitForCount,
  retryAction,
  waitForUrl,
  waitForDownload,
} from './wait-helpers';

// Auth helpers (storage state management, login flows)
export {
  saveAuthState,
  getAuthStatePath,
  hasAuthState,
  loginAndSave,
} from './auth-helpers';

// Session manager (full session persistence with refresh token support)
export {
  SessionManager,
  type FullSessionState,
  type LoginConfig,
  type SessionManagerOptions,
} from './session-manager';

// Accessibility helpers (basic a11y checks)
export {
  checkImagesHaveAlt,
  checkFormLabels,
  checkHeadingHierarchy,
  checkKeyboardAccessibility,
  runA11yChecks,
  type A11yCheckResult,
} from './accessibility-helpers';

// Visual helpers (scroll, highlight, console errors, viewports)
export {
  highlightElement,
  scrollToCenter,
  scrollToBottom,
  scrollToTop,
  collectConsoleErrors,
  getViewportSize,
  takeFullPageScreenshot,
  VIEWPORTS,
} from './visual-helpers';

// DateTime helpers (clock control, date pickers, formatting, timezones)
export {
  freezeClock,
  installClock,
  advanceClock,
  resumeClock,
  setClockTime,
  TIMEZONES,
  formatDate,
  today,
  relativeDate,
  relativeTo,
  fillDateInput,
  fillDateTimeInput,
  fillTimeInput,
  selectDateInPicker,
} from './datetime-helpers';

// Table/Grid helpers (read data, sort, filter, paginate, select, edit)
export {
  TableHelper,
  type TableRow,
  type TableConfig,
  type SortDirection,
} from './table-helpers';

// Smart Locator (self-healing locators with multi-strategy fallback)
export {
  SmartLocator,
  type LocatorStrategy,
  type UserLocatorEntry,
  type ElementFingerprint,
  type HealingResult,
  type SmartLocatorOptions,
} from './smart-locator';

// Allure helpers (suite hierarchy, tags, steps, metadata)
export {
  allureSuite,
  allureParentSuite,
  allureSuiteLabel,
  allureSubSuite,
  allureBehavior,
  allureTags,
  allureTag,
  allureTagsFromTitle,
  allureSeverity,
  allureOwner,
  allureDescription,
  allureLink,
  allureIssue,
  allureTms,
  allureLabel,
  allureStep,
  allureLogStep,
  allureAttachText,
  allureAttachJson,
  allureAttachFile,
  allureParameter,
  configureAllure,
  type AllureSuiteConfig,
  type AllureBehaviorConfig,
  type AllureTestConfig,
  type AllureSeverity,
} from './allure-helpers';

// API Client (typed HTTP helpers for API testing)
export {
  ApiClient,
  type ApiClientOptions,
  type ApiResponse,
  type RequestOptions,
} from './api-client';

// Test Data Factory (realistic fake data generation)
export {
  TestDataFactory,
  testData,
} from './test-data-factory';

// Soft Assertions (collect all failures, report at end)
export {
  SoftAssert,
  SoftLocatorAssert,
  SoftPageAssert,
  SoftValueAssert,
  type SoftFailure,
} from './soft-assertions';

// Visual Regression (enhanced snapshot comparison with masking)
export {
  VisualRegression,
  type VisualRegressionOptions,
  type VisualRegressionResult,
  type MaskRegion,
} from './visual-regression';
