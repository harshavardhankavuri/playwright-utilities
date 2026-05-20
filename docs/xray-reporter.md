# X-Ray Reporter

Playwright custom reporter that pushes test results to X-Ray (Jira). Supports Jira Cloud and Data Center, three auth strategies, and four independently toggleable features.

## Table of Contents

- [How It Works](#how-it-works)
- [Quick Setup](#quick-setup)
- [Test Title Format](#test-title-format)
- [Status Mapping](#status-mapping)
- [Features](#features)
- [Auth Strategies](#auth-strategies)
- [Configuration Reference](#configuration-reference)
- [Environment Variables](#environment-variables)
- [playwright.config.ts](#playwrightconfigts)
- [CI/CD Integration](#cicd-integration)
- [File Structure](#file-structure)

---

## How It Works

The reporter implements Playwright's `Reporter` interface and runs in three phases:

```
onBegin
  ├── Authenticate with X-Ray (if using xray-client auth)
  ├── Create Test Execution issue in Jira  (if createExecution = true)
  └── Pre-link all test keys found in the suite

onTestEnd  (called for every test)
  ├── Extract X-Ray keys from test title  e.g. [PROJ-123]
  ├── Map Playwright status → X-Ray status
  └── Collect result + failure attachments

onEnd
  ├── Import all results to X-Ray in one API call  (if updateTestStatus = true)
  ├── Attach screenshots for failed tests           (if attachScreenshots = true)
  ├── Write untracked tests report                  (if untrackedReport = true)
  └── Print summary to console
```

---

## Quick Setup

**1. Edit `src/main/utils/xray/xray.config.ts`:**

```typescript
const xrayConfig: XRayUserConfig = {
  enabled: true,
  jiraBaseUrl: 'https://your-org.atlassian.net',
  projectKey: 'PROJ',
  xrayMode: 'cloud',
  auth: { type: 'basic', email: '', apiToken: '' },
  features: {
    createExecution: true,
    updateTestStatus: true,
    attachScreenshots: true,
    untrackedReport: true,
  },
};
```

**2. Set credentials via environment variables (never commit secrets):**

```bash
JIRA_EMAIL=qa@company.com
JIRA_API_TOKEN=your-api-token
```

**3. Tag your tests:**

```typescript
test('[PROJ-123] should login successfully', async ({ page }) => { ... });
```

**4. Run:**

```bash
npx playwright test
```

---

## Test Title Format

X-Ray test keys are extracted from test titles using bracket notation. The project key prefix is case-sensitive and must be uppercase.

```typescript
// Single key
test('[PROJ-123] should login', ...)

// Multiple keys — separate brackets
test('[PROJ-123][PROJ-456] login and verify dashboard', ...)

// Multiple keys — comma-separated inside one bracket
test('[PROJ-100, PROJ-101] checkout flow', ...)

// Multiple keys — slash-separated (bare numbers inherit the last prefix)
test('[PROJ-1/2/3] covers three test cases', ...)
// → extracts PROJ-1, PROJ-2, PROJ-3

// Mixed prefix and bare numbers
test('[PROJ-10, 20] two cases', ...)
// → extracts PROJ-10, PROJ-20
```

Tests without any bracket key are collected as **untracked** and written to `reports/untracked-tests.txt` when `untrackedReport` is enabled.

---

## Status Mapping

| Playwright Status | X-Ray Status |
|---|---|
| `passed` | `PASS` |
| `failed` | `FAIL` |
| `timedOut` | `FAIL` |
| `skipped` | `TODO` |
| `interrupted` | `ABORTED` |

---

## Features

Four features are independently toggleable via config or environment variables:

| Feature | Config Key | Env Var | Description |
|---|---|---|---|
| Create Execution | `createExecution` | `XRAY_FEATURE_CREATE_EXECUTION` | Create a new Test Execution issue in Jira at run start |
| Update Status | `updateTestStatus` | `XRAY_FEATURE_UPDATE_STATUS` | Import PASS/FAIL results to X-Ray at run end |
| Attach Screenshots | `attachScreenshots` | `XRAY_FEATURE_ATTACH_SCREENSHOTS` | Upload failure screenshots as evidence |
| Untracked Report | `untrackedReport` | `XRAY_FEATURE_UNTRACKED_REPORT` | Write a report of tests with no X-Ray key |

---

## Auth Strategies

### `basic` — Jira Cloud (email + API token)

```typescript
auth: { type: 'basic', email: '', apiToken: '' }
```

```bash
JIRA_EMAIL=qa@company.com
JIRA_API_TOKEN=your-api-token
```

Generate an API token at: `https://id.atlassian.com/manage-profile/security/api-tokens`

### `pat` — Jira Data Center (Personal Access Token)

```typescript
auth: { type: 'pat', token: '' }
```

```bash
JIRA_PAT=your-personal-access-token
```

Generate a PAT in Jira: Profile → Personal Access Tokens.

### `xray-client` — X-Ray Cloud (client credentials)

```typescript
auth: { type: 'xray-client', clientId: '', clientSecret: '' }
```

```bash
XRAY_CLIENT_ID=your-client-id
XRAY_CLIENT_SECRET=your-client-secret
```

Generate credentials in X-Ray Cloud: Settings → API Keys.

> **Note:** When using `xray-client`, the reporter authenticates with X-Ray Cloud's OAuth endpoint (`https://xray.cloud.getxray.app/api/v2/authenticate`) to get a bearer token. Jira REST calls (for creating issues) still require `basic` or `pat` credentials unless you pair this with `JIRA_EMAIL` + `JIRA_API_TOKEN`.

---

## Configuration Reference

All options in `xray.config.ts`:

```typescript
const xrayConfig: XRayUserConfig = {
  // ── Master switch ──────────────────────────────────────────────────────────
  enabled: false,          // Enable/disable the entire integration
  verbose: false,          // Log debug-level messages (auth, API calls)

  // ── Jira connection ────────────────────────────────────────────────────────
  jiraBaseUrl: '',         // e.g. 'https://your-org.atlassian.net'
  projectKey:  '',         // e.g. 'PROJ'
  xrayMode: 'cloud',       // 'cloud' | 'dc'

  // ── Authentication ─────────────────────────────────────────────────────────
  auth: {
    type: 'basic',         // 'basic' | 'pat' | 'xray-client'
    email: '',
    apiToken: '',
  },

  // ── Feature flags ──────────────────────────────────────────────────────────
  features: {
    createExecution:   false,
    updateTestStatus:  false,
    attachScreenshots: false,
    untrackedReport:   false,
  },

  // ── Execution metadata ─────────────────────────────────────────────────────
  executionSummary:     'Playwright E2E — Automated Run',
  executionDescription: 'Automated test execution from Playwright',
  testPlanKey:          '',   // Link execution to a Test Plan issue key
  testEnvironments:     [],   // e.g. ['staging', 'chrome']
  existingExecutionKey: '',   // Reuse an existing execution (skip creation)
  assignee:             '',   // Jira account ID for the execution issue
  untrackedOutputFile:  'reports/untracked-tests.txt',
};
```

---

## Environment Variables

Environment variables always override `xray.config.ts` values. Use them for secrets and CI overrides.

### Master switch

| Variable | Type | Description |
|---|---|---|
| `XRAY_ENABLED` | `true\|false` | Enable/disable the integration |
| `XRAY_VERBOSE` | `true\|false` | Enable debug logging |
| `XRAY_MODE` | `cloud\|dc` | Jira deployment type |

### Jira connection

| Variable | Description |
|---|---|
| `JIRA_BASE_URL` | Jira base URL, e.g. `https://your-org.atlassian.net` |
| `JIRA_PROJECT_KEY` | Jira project key, e.g. `PROJ` |

### Authentication

| Variable | Auth type | Description |
|---|---|---|
| `JIRA_EMAIL` | `basic` | Jira account email |
| `JIRA_API_TOKEN` | `basic` | Jira API token |
| `JIRA_PAT` | `pat` | Jira Personal Access Token (Data Center) |
| `XRAY_CLIENT_ID` | `xray-client` | X-Ray Cloud client ID |
| `XRAY_CLIENT_SECRET` | `xray-client` | X-Ray Cloud client secret |

### Feature flags

| Variable | Description |
|---|---|
| `XRAY_FEATURE_CREATE_EXECUTION` | Create a Test Execution issue |
| `XRAY_FEATURE_UPDATE_STATUS` | Import test results |
| `XRAY_FEATURE_ATTACH_SCREENSHOTS` | Upload failure screenshots |
| `XRAY_FEATURE_UNTRACKED_REPORT` | Write untracked tests report |

### Execution metadata

| Variable | Description |
|---|---|
| `XRAY_EXECUTION_SUMMARY` | Summary text for the execution issue |
| `XRAY_EXECUTION_DESCRIPTION` | Description text for the execution issue |
| `XRAY_TEST_PLAN_KEY` | Test Plan issue key to link the execution to |
| `XRAY_TEST_ENVIRONMENTS` | Comma-separated environment labels, e.g. `staging,chrome` |
| `XRAY_EXECUTION_KEY` | Reuse an existing execution (skips creation) |
| `XRAY_ASSIGNEE` | Jira account ID for the execution issue assignee |
| `XRAY_UNTRACKED_OUTPUT` | Output path for the untracked tests report |

---

## playwright.config.ts

The reporter is registered in the reporters array. It is disabled by default — enable it via `XRAY_ENABLED=true` or in `xray.config.ts`.

```typescript
import xrayConfig from './src/main/utils/xray/xray.config';

export default defineConfig({
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'reports/html' }],
    ['allure-playwright', { outputFolder: 'allure-results' }],
    ['./src/main/utils/xray/reporter/xrayReporter.ts', xrayConfig],
  ],
});
```

---

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run Playwright tests
  env:
    XRAY_ENABLED: true
    JIRA_BASE_URL: ${{ secrets.JIRA_BASE_URL }}
    JIRA_PROJECT_KEY: PROJ
    JIRA_EMAIL: ${{ secrets.JIRA_EMAIL }}
    JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
    XRAY_FEATURE_CREATE_EXECUTION: true
    XRAY_FEATURE_UPDATE_STATUS: true
    XRAY_FEATURE_ATTACH_SCREENSHOTS: true
    XRAY_TEST_PLAN_KEY: PROJ-100
    XRAY_TEST_ENVIRONMENTS: staging
  run: npx playwright test
```

### Reuse an existing execution (one execution per pipeline run)

```yaml
# Create the execution once, then pass the key to all parallel shards
- name: Create X-Ray execution
  id: create_exec
  run: |
    KEY=$(curl -s -X POST "$JIRA_BASE_URL/rest/api/3/issue" \
      -H "Authorization: Basic $(echo -n $JIRA_EMAIL:$JIRA_API_TOKEN | base64)" \
      -H "Content-Type: application/json" \
      -d '{"fields":{"project":{"key":"PROJ"},"summary":"CI Run","issuetype":{"name":"Test Execution"}}}' \
      | jq -r '.key')
    echo "execution_key=$KEY" >> $GITHUB_OUTPUT

- name: Run tests (shard 1)
  env:
    XRAY_ENABLED: true
    XRAY_EXECUTION_KEY: ${{ steps.create_exec.outputs.execution_key }}
    XRAY_FEATURE_CREATE_EXECUTION: false   # skip creation — key already exists
    XRAY_FEATURE_UPDATE_STATUS: true
  run: npx playwright test --shard=1/2
```

### Jenkins

```groovy
environment {
  XRAY_ENABLED = 'true'
  JIRA_BASE_URL = credentials('jira-base-url')
  JIRA_EMAIL = credentials('jira-email')
  JIRA_API_TOKEN = credentials('jira-api-token')
  XRAY_FEATURE_CREATE_EXECUTION = 'true'
  XRAY_FEATURE_UPDATE_STATUS = 'true'
}
steps {
  sh 'npx playwright test'
}
```

---

## File Structure

```
src/main/utils/xray/
├── xray.config.ts              ← The only file you need to edit
├── types.ts                    ← All TypeScript types
├── index.ts                    ← Public barrel (types + utilities)
├── client/
│   └── xrayClient.ts           ← HTTP client for Jira + X-Ray REST APIs
├── reporter/
│   └── xrayReporter.ts         ← Playwright Reporter implementation
└── utils/
    ├── configResolver.ts       ← Merges config file + env vars, validates
    ├── logger.ts               ← Prefixed console logger
    ├── screenshotHelper.ts     ← Screenshot → base64 evidence conversion
    ├── testIdExtractor.ts      ← Extracts [PROJ-123] keys from test titles
    └── untrackedReport.ts      ← Writes untracked tests file + console summary
```

### Key design decisions

- **`xrayReporter.ts` is not exported from the barrel** — Playwright loads it directly via file path in `playwright.config.ts`. This avoids circular imports and keeps the reporter isolated.
- **All API calls are non-throwing** — errors are logged and safe defaults returned so a failing X-Ray call never breaks the test run.
- **Config validation only runs when `enabled: true`** — so the reporter can be registered in `playwright.config.ts` without requiring credentials in every environment.
- **Results are imported in a single batch** at `onEnd`, not per-test, to minimise API calls.
