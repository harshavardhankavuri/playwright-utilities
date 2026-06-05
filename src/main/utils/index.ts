// Core test helpers
export {
  delay,
  takeScreenshot,
  randomString,
  randomInt,
  randomEmail,
  randomUUID,
  slugify,
  pollUntil,
  chunk,
  deepClone,
  pick,
  omit,
} from './test-helpers';

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

// Nested PDF handler (download PDFs from nested iframes with visual detection)
export {
  NestedPdfHandler,
  type IframeNavigationPath,
  type NestedPdfHandlerOptions,
  type VisualIconClickOptions,
  type IconMatchResult,
} from './nested-pdf-handler';

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
  waitFor,
  waitForVisible,
  waitForHidden,
  waitForAttached,
  waitForDetached,
  waitForApiResponse,
  waitForNetworkIdle,
  waitForElementStable,
  waitForCount,
  retryAction,
  waitForUrl,
  waitForDownload,
  waitForCondition,
  waitForText,
  waitForAnimation,
  waitForLocalStorage,
  waitForSessionStorage,
  waitForRequestCount,
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
  checkFocusIndicators,
  checkAriaLiveRegions,
  checkFocusTrap,
  checkSkipLinks,
  checkTouchTargetSize,
  runFullA11yChecks,
  type A11yCheckResult,
} from './accessibility-helpers';

// Visual helpers (scroll, highlight, console errors, viewports)
export {
  highlightElement,
  scrollToCenter,
  scrollToBottom,
  scrollToTop,
  collectConsoleErrors,
  collectConsoleWarnings,
  collectNetworkErrors,
  collectAllConsole,
  getViewportSize,
  setViewport,
  takeFullPageScreenshot,
  measureElement,
  scrollTo,
  scrollIntoView,
  getScrollPosition,
  isFullyVisible,
  setColorScheme,
  setReducedMotion,
  setForcedColors,
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
  SoftResponseAssert,
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

// File Helpers (read/write JSON and text files, path resolution)
export {
  readTextFile,
  readTextFileAsync,
  readJsonFile,
  readJsonFileAsync,
  writeTextFile,
  writeTextFileAsync,
  writeJsonFile,
  writeJsonFileAsync,
  fileExists,
  directoryExists,
  resolveFromRoot,
  resolvePath,
  getDirectory,
  getFileName,
  getFileExtension,
  joinPaths,
  normalizePath,
  getRelativePath,
  createDirectory,
  createDirectoryAsync,
  deleteFile,
  deleteFileAsync,
  listFiles,
  copyFile,
  copyFileAsync,
} from './file-helpers';

// Environment Helpers (type-safe env var access, config builder, env detection)
export {
  requireEnv,
  getEnv,
  getEnvInt,
  getEnvBool,
  getEnvArray,
  buildConfig,
  isEnv,
  ENV,
  IS_CI,
  IS_DEBUG,
  UPDATE_SNAPSHOTS,
  type ConfigField,
} from './env-helpers';

// Keyboard Helpers (shortcuts, tab navigation, focus order, form interaction, clipboard)
export {
  MOD,
  pressShortcut,
  selectAll,
  copy,
  paste,
  cut,
  undo,
  redo,
  setClipboard,
  readClipboard,
  setClipboardAndPaste,
  getClipboardAfterAction,
  tabForward,
  tabBackward,
  getFocusedElementInfo,
  verifyTabOrder,
  typeInto,
  submitByEnter,
  pressEscape,
  navigateWithArrows,
} from './keyboard-helpers';

// Performance Helpers (Web Vitals + Navigation Timing, Allure + Playwright HTML report)
export {
  PerformanceCollector,
  measurePagePerformance,
  assertMetric,
  type NavigationMetrics,
  type WebVitals,
  type PagePerformanceEntry,
  type BudgetViolation,
  type PerformanceBudget,
  type PerformanceCollectorOptions,
} from './performance-helpers';

// Drag & Drop Helpers (native, mouse simulation, pointer events, file drop, sortable)
export {
  dragTo,
  dragWithMouse,
  dragWithPointer,
  dropFile,
  dropFiles,
  reorderListItem,
  isDraggable,
  isDropTarget,
  type DragOptions,
  type FileDropOptions,
  type SortableReorderOptions,
} from './drag-drop-helpers';

// Form Helpers (smart fill, select, checkbox, radio, file upload, validation, extraction)
export {
  fillField,
  fillForm,
  selectByText,
  selectByValue,
  selectByIndex,
  selectMultiple,
  getSelectOptions,
  getSelectedOptions,
  checkBox,
  uncheckBox,
  toggleCheckbox,
  checkByLabels,
  getCheckedValues,
  selectRadio,
  selectRadioByLabel,
  getSelectedRadio,
  uploadFile,
  uploadFiles,
  clearFileInput,
  uploadBuffer,
  getFormValidationState,
  expectValidationMessage,
  expectFieldInvalid,
  expectFieldValid,
  extractFormData,
  clearForm,
  submitForm,
  clickSubmit,
  setSliderValue,
  getSliderValue,
  getSliderRange,
  type FormData,
  type FormValidationState,
} from './form-helpers';

// Storage Helpers (localStorage, sessionStorage, cookies, IndexedDB, snapshots)
export {
  getLocalStorage,
  getLocalStorageJson,
  setLocalStorage,
  setLocalStorageJson,
  removeLocalStorage,
  clearLocalStorage,
  getAllLocalStorage,
  setLocalStorageMultiple,
  getSessionStorage,
  getSessionStorageJson,
  setSessionStorage,
  setSessionStorageJson,
  removeSessionStorage,
  clearSessionStorage,
  getAllSessionStorage,
  getCookie,
  getCookieValue,
  getAllCookies,
  setCookie,
  deleteCookie,
  clearAllCookies,
  hasCookie,
  captureStorageSnapshot,
  restoreStorageSnapshot,
  getIndexedDBNames,
  clearIndexedDBStore,
  deleteIndexedDB,
  expectLocalStorage,
  expectCookie,
  type StorageSnapshot,
} from './storage-helpers';

// Color Helpers (extraction, parsing, WCAG contrast, theme validation)
export {
  getBackgroundColor,
  getTextColor,
  getBorderColor,
  getCssColor,
  getCssVariable,
  getCssVariables,
  parseColor,
  toHex,
  toHSL,
  contrastRatio,
  checkContrast,
  checkElementContrast,
  findContrastViolations,
  colorsEqual,
  colorsSimilar,
  colorDistance,
  expectCssVariables,
  expectBackgroundColor,
  expectTextColor,
  type RGBColor,
  type HSLColor,
  type ContrastResult,
} from './color-helpers';
