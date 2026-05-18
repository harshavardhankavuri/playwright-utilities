import type { XRayMode, XRayUserConfig } from './types';

/**
 * X-Ray Integration Configuration
 * ────────────────────────────────
 * This is the only file developers need to edit.
 * Environment variables (see .env.example) override values here.
 */
const xrayConfig: XRayUserConfig = {
  enabled: false,
  verbose: false,
  jiraBaseUrl: '',
  projectKey: '',
  xrayMode: 'cloud' as XRayMode,
  auth: {
    type: 'basic',
    email: '',
    apiToken: '',
  },
  features: {
    createExecution: false,
    updateTestStatus: false,
    attachScreenshots: false,
    untrackedReport: false,
  },
  executionSummary: 'Playwright E2E — Automated Run',
  executionDescription: 'Automated test execution from Playwright',
  testPlanKey: '',
  testEnvironments: [] as string[],
  existingExecutionKey: '',
  assignee: '',
  untrackedOutputFile: 'reports/untracked-tests.txt',
};

export default xrayConfig;
