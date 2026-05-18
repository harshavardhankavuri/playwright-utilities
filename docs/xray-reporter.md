# X-Ray Reporter

**File:** `src/main/utils/xray/reporter/xrayReporter.ts`

## Overview

The X-Ray Reporter is a Playwright custom reporter that pushes test results to X-Ray (Jira). It creates test executions, updates test statuses, attaches failure screenshots, and reports untracked tests — all automatically at the end of a test run. Supports both Jira Cloud and Data Center deployments.

## How It Works

The reporter implements Playwright's `Reporter` interface and operates in three phases:

1. **onBegin** — Authenticates with X-Ray, creates (or reuses) a Test Execution issue in Jira, and pre-links all test keys found in the suite.
2. **onTestEnd** — Extracts X-Ray test keys from the test title (e.g. `[PROJ-123]`), maps Playwright status to X-Ray status, and collects results.
3. **onEnd** — Imports all results to X-Ray in a single API call, attaches screenshots for failed tests, writes an untracked tests report, and prints a summary.

### Test Title Format

X-Ray test keys are extracted from test titles using bracket notation:

```
test('[PROJ-123] should login successfully', ...)
test('[PROJ-123][PROJ-456] covers multiple test cases', ...)
test('[PROJ-100, PROJ-101] comma-separated keys', ...)
```

Tests without keys are reported as "untracked" in a separate file.

### Status Mapping

| Playwright Status | X-Ray Status |
|-------------------|--------------|
| `passed` | `PASS` |
| `failed` | `FAIL` |
| `timedOut` | `FAIL` |
| `skipped` | `TODO` |
| `interrupted` | `ABORTED` |

## 4 Features (toggleable)

| Feature | Description |
|---------|-------------|
| `createExecution` | Create a new Test Execution issue in Jira |
| `updateTestStatus` | Import test results (PASS/FAIL) to X-Ray |
| `attachScreenshots` | Attach failure screenshots as evidence |
| `untrackedReport` | Write a report of tests without X-Ray keys |

## Auth Strategies

| Strategy | Use Case | Required Fields |
|----------|----------|-----------------|
| `basic` | Jira Cloud (email + API token) | `email`, `apiToken` |
| `pat` | Jira Data Center (Personal Access Token) | `token` |
| `xray-client` | X-Ray Cloud (client credentials) | `clientId`, `clientSecret` |

## Configuration

### xray.config.ts

```typescript
const xrayConfig: XRayUserConfig = {
  enabled: true,
  verbose: true,
  jiraBaseUrl: 'https://your-company.atlassian.net',
  projectKey: 'PROJ',
  xrayMode: 'cloud',  // 'cloud' | 'dc'
  auth: {
    type: 'basic',
    email: '',         // Override via XRAY_EMAIL env var
    apiToken: '',      // Override via XRAY_API_TOKEN env var
  },
  features: {
    createExecution: true,
    updateTestStatus: true,
    attachScreenshots: true,
    untrackedReport: true,
  },
  executionSummary: 'Playwright E2E — Automated Run',
  executionDescription: 'Automated test execution from Playwright',
  testPlanKey: 'PROJ-100',           // Link execution to a Test Plan
  testEnvironments: ['staging'],     // Environment labels
  existingExecutionKey: '',          // Reuse an existing execution (skip creation)
  assignee: 'qa-bot',               // Assignee for the execution issue
  untrackedOutputFile: 'reports/untracked-tests.txt',
};
```

### Environment Variables

All sensitive values should be set via environment variables (override config file values):

```bash
XRAY_ENABLED=true
XRAY_JIRA_BASE_URL=https://your-company.atlassian.net
XRAY_PROJECT_KEY=PROJ
XRAY_MODE=cloud

# Basic auth (Cloud)
XRAY_EMAIL=qa@company.com
XRAY_API_TOKEN=your-api-token

# PAT auth (Data Center)
XRAY_PAT_TOKEN=your-personal-access-token

# X-Ray Client auth (Cloud)
XRAY_CLIENT_ID=your-client-id
XRAY_CLIENT_SECRET=your-client-secret

XRAY_TEST_PLAN_KEY=PROJ-100
XRAY_TEST_ENVIRONMENTS=staging,production
XRAY_EXECUTION_KEY=PROJ-200
```

### playwright.config.ts

```typescript
reporter: [
  ['./src/main/utils/xray/reporter/xrayReporter.ts', xrayConfig],
  ['html'],
],
```

## Usage Examples

### Test with X-Ray key

```typescript
test('[PROJ-123] should login with valid credentials', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', 'user@test.com');
  await page.fill('#password', 'secret');
  await page.click('#submit');
  await expect(page).toHaveURL('/dashboard');
});
```

### Multiple keys per test

```typescript
test('[PROJ-123][PROJ-456] login and verify dashboard', async ({ page }) => {
  // Both PROJ-123 and PROJ-456 will be updated with this test's result
});
```

### Comma-separated keys

```typescript
test('[PROJ-100, PROJ-101] checkout flow covers two test cases', async ({ page }) => {
  // ...
});
```

### Untracked test (no key)

```typescript
test('exploratory: check new feature', async ({ page }) => {
  // This test will appear in reports/untracked-tests.txt
});
```

### CI pipeline integration

```yaml
# GitHub Actions example
- name: Run Playwright tests
  env:
    XRAY_ENABLED: true
    XRAY_EMAIL: ${{ secrets.XRAY_EMAIL }}
    XRAY_API_TOKEN: ${{ secrets.XRAY_API_TOKEN }}
  run: npx playwright test
```

## Tips & Best Practices

- Add X-Ray keys to test titles as you create test cases in Jira — the reporter picks them up automatically.
- Use `existingExecutionKey` in CI to append results to a single execution per pipeline run (avoids creating many executions).
- Enable `untrackedReport` to identify tests that haven't been linked to Jira yet — useful for coverage tracking.
- Keep `verbose: true` during setup to see authentication and API call logs; disable in production CI for cleaner output.
- Use `testPlanKey` to link executions to a Test Plan — this enables X-Ray's traceability matrix and coverage reports.
