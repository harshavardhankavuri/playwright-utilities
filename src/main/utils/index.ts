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

// Multi-baseline snapshot management
export {
  SnapshotManager,
  type MultiSnapshotResult,
  type SnapshotOptions,
} from './snapshot-manager';

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
