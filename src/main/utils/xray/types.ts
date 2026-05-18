// ─── X-Ray Integration Types ─────────────────────────────────────────────────

/** Deployment mode for X-Ray */
export type XRayMode = 'cloud' | 'dc';

/** Basic auth (Jira Cloud — email + API token) */
export interface AuthBasic {
  type: 'basic';
  email: string;
  apiToken: string;
}

/** Personal Access Token auth (Jira Data Center) */
export interface AuthPat {
  type: 'pat';
  token: string;
}

/** X-Ray Cloud client credentials */
export interface AuthXRayClient {
  type: 'xray-client';
  clientId: string;
  clientSecret: string;
}

/** Discriminated union of supported auth strategies */
export type AuthConfig = AuthBasic | AuthPat | AuthXRayClient;

/** Feature flags controlling which X-Ray operations run */
export interface XRayFeatures {
  createExecution: boolean;
  updateTestStatus: boolean;
  attachScreenshots: boolean;
  untrackedReport: boolean;
}

/** User-facing configuration shape (written in xray.config.ts) */
export interface XRayUserConfig {
  enabled?: boolean;
  verbose?: boolean;
  jiraBaseUrl?: string;
  projectKey?: string;
  xrayMode?: XRayMode;
  auth?: Partial<AuthBasic> & { type: AuthConfig['type'] }
    | Partial<AuthPat> & { type: AuthConfig['type'] }
    | Partial<AuthXRayClient> & { type: AuthConfig['type'] };
  features?: Partial<XRayFeatures>;
  executionSummary?: string;
  executionDescription?: string;
  testPlanKey?: string;
  testEnvironments?: string[];
  existingExecutionKey?: string;
  assignee?: string;
  untrackedOutputFile?: string;
}

/** Fully resolved configuration — no optionals */
export interface ResolvedConfig {
  enabled: boolean;
  verbose: boolean;
  jiraBaseUrl: string;
  projectKey: string;
  xrayMode: XRayMode;
  auth: AuthConfig;
  features: XRayFeatures;
  executionSummary: string;
  executionDescription: string;
  testPlanKey: string;
  testEnvironments: string[];
  existingExecutionKey: string;
  assignee: string;
  untrackedOutputFile: string;
}

/** Single test result for X-Ray import */
export interface XRayTestResult {
  testKey: string;
  status: string;
  startedOn: string;
  finishedOn: string;
  comment?: string;
}

/** Evidence attachment (base64-encoded) */
export interface XRayEvidence {
  data: string;
  filename: string;
  contentType: string;
}

/** Payload shape for X-Ray import/execution endpoint */
export interface XRayImportPayload {
  testExecutionKey: string;
  info?: {
    summary?: string;
    description?: string;
    project?: string;
    testPlanKey?: string;
    testEnvironments?: string[];
  };
  tests: XRayTestResult[];
}

/** Test that has no X-Ray key in its title */
export interface UntrackedTest {
  title: string;
  filePath: string;
  status: string;
  duration: number;
}

/** Structured logger interface */
export interface Logger {
  info(msg: string): void;
  success(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
}
