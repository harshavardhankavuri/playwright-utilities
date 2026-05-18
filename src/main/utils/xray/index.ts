/**
 * X-Ray Integration — Public Barrel
 *
 * NOTE: The reporter class is NOT exported here.
 * Playwright loads it directly via file path in playwright.config.ts.
 */

// Types
export type {
  AuthBasic,
  AuthConfig,
  AuthPat,
  AuthXRayClient,
  Logger,
  ResolvedConfig,
  UntrackedTest,
  XRayEvidence,
  XRayFeatures,
  XRayImportPayload,
  XRayMode,
  XRayTestResult,
  XRayUserConfig,
} from './types';

// Test ID extraction
export {
  expandBracketContent,
  extractTestIds,
  stripTestIds,
} from './utils/testIdExtractor';

// Config resolution
export { resolveConfig, resolveFeatures } from './utils/configResolver';

// Logger
export { createLogger } from './utils/logger';
