import type { XRayMode, XRayUserConfig } from './types';

/**
 * X-Ray Integration Configuration
 * ────────────────────────────────
 * This is the only file developers need to edit for static config.
 * All values can be overridden by environment variables (see .env.example).
 *
 * Environment variable reference:
 *
 *   Master switch:
 *     XRAY_ENABLED=true
 *     XRAY_VERBOSE=true
 *     XRAY_MODE=cloud|dc
 *
 *   Jira connection:
 *     JIRA_BASE_URL=https://your-org.atlassian.net
 *     JIRA_PROJECT_KEY=PROJ
 *
 *   Auth — Basic (Jira Cloud):
 *     JIRA_EMAIL=qa@company.com
 *     JIRA_API_TOKEN=your-api-token
 *
 *   Auth — PAT (Jira Data Center):
 *     JIRA_PAT=your-personal-access-token
 *
 *   Auth — X-Ray Client (X-Ray Cloud):
 *     XRAY_CLIENT_ID=your-client-id
 *     XRAY_CLIENT_SECRET=your-client-secret
 *
 *   Feature flags:
 *     XRAY_FEATURE_CREATE_EXECUTION=true
 *     XRAY_FEATURE_UPDATE_STATUS=true
 *     XRAY_FEATURE_ATTACH_SCREENSHOTS=true
 *     XRAY_FEATURE_UNTRACKED_REPORT=true
 *
 *   Execution metadata:
 *     XRAY_EXECUTION_SUMMARY=My Run
 *     XRAY_EXECUTION_DESCRIPTION=Triggered by CI
 *     XRAY_TEST_PLAN_KEY=PROJ-100
 *     XRAY_TEST_ENVIRONMENTS=staging,production
 *     XRAY_EXECUTION_KEY=PROJ-200   (reuse existing execution)
 *     XRAY_ASSIGNEE=accountId
 *     XRAY_UNTRACKED_OUTPUT=reports/untracked-tests.txt
 */
const xrayConfig: XRayUserConfig = {
  // ── Master switch ──────────────────────────────────────────────────────────
  enabled: false,   // env: XRAY_ENABLED
  verbose: false,   // env: XRAY_VERBOSE

  // ── Jira connection ────────────────────────────────────────────────────────
  jiraBaseUrl: '',  // env: JIRA_BASE_URL   e.g. 'https://your-org.atlassian.net'
  projectKey:  '',  // env: JIRA_PROJECT_KEY  e.g. 'PROJ'
  xrayMode: 'cloud' as XRayMode, // env: XRAY_MODE  'cloud' | 'dc'

  // ── Authentication ─────────────────────────────────────────────────────────
  // Choose ONE auth type. Values are overridden by env vars (see above).
  auth: {
    type: 'basic',  // 'basic' | 'pat' | 'xray-client'
    email: '',      // env: JIRA_EMAIL
    apiToken: '',   // env: JIRA_API_TOKEN
  },

  // ── Feature flags ──────────────────────────────────────────────────────────
  features: {
    createExecution:   false, // env: XRAY_FEATURE_CREATE_EXECUTION
    updateTestStatus:  false, // env: XRAY_FEATURE_UPDATE_STATUS
    attachScreenshots: false, // env: XRAY_FEATURE_ATTACH_SCREENSHOTS
    untrackedReport:   false, // env: XRAY_FEATURE_UNTRACKED_REPORT
  },

  // ── Execution metadata ─────────────────────────────────────────────────────
  executionSummary:     'Playwright E2E — Automated Run', // env: XRAY_EXECUTION_SUMMARY
  executionDescription: 'Automated test execution from Playwright', // env: XRAY_EXECUTION_DESCRIPTION
  testPlanKey:          '',   // env: XRAY_TEST_PLAN_KEY
  testEnvironments:     [],   // env: XRAY_TEST_ENVIRONMENTS (comma-separated)
  existingExecutionKey: '',   // env: XRAY_EXECUTION_KEY  (skip creation, append to this)
  assignee:             '',   // env: XRAY_ASSIGNEE  (Jira account ID)
  untrackedOutputFile:  'reports/untracked-tests.txt', // env: XRAY_UNTRACKED_OUTPUT
};

export default xrayConfig;
