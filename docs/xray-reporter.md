# X-Ray Reporter

Playwright custom reporter that pushes test results to X-Ray (Jira). Supports Jira Cloud and Data Center, three auth strategies, and four independently toggleable features.

---

## Table of Contents

- [End-to-End Flow](#end-to-end-flow)
- [Reporter Lifecycle](#reporter-lifecycle)
- [Enable Locally](#enable-locally)
- [Enable on CI](#enable-on-ci)
- [Test Title Format](#test-title-format)
- [Status Mapping](#status-mapping)
- [Features](#features)
- [Auth Strategies](#auth-strategies)
- [Configuration Reference](#configuration-reference)
- [Environment Variables](#environment-variables)
- [File Structure](#file-structure)

---

## End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DEVELOPER WORKFLOW                               │
└─────────────────────────────────────────────────────────────────────────┘

  1. Create test case in Jira X-Ray
     └─► Jira creates issue key  e.g.  PROJ-123

  2. Add key to Playwright test title
     └─► test('[PROJ-123] should login', async ({ page }) => { ... })

  3. Configure credentials
     ├── Local:  copy .env.xray → fill in values → dotenv loads it
     └── CI:     set secrets in GitHub / Jenkins / Azure DevOps

  4. Run tests
     └─► npx playwright test

  5. Reporter runs automatically (3 phases — see below)

  6. Results appear in Jira
     ├── New Test Execution issue created  (PROJ-456)
     ├── Tests linked to execution
     ├── PASS / FAIL status updated on each test
     └── Failure screenshots attached as evidence


┌─────────────────────────────────────────────────────────────────────────┐
│                        REPORTER LIFECYCLE                               │
└─────────────────────────────────────────────────────────────────────────┘

  npx playwright test
       │
       ▼
  ┌─────────────┐   XRAY_ENABLED=false?
  │  onBegin    │──────────────────────────► skip (reporter is a no-op)
  └─────────────┘
       │ XRAY_ENABLED=true
       │
       ├─ auth.type = 'xray-client'? ──► POST /authenticate → get bearer token
       │
       ├─ existingExecutionKey set? ──► use it (skip creation)
       │
       └─ createExecution = true?   ──► POST /rest/api/3/issue
                                         └─► pre-link all [PROJ-xxx] keys found
                                             in the suite to the new execution
       │
       ▼  (for every test)
  ┌─────────────┐
  │ onTestEnd   │──► extract [PROJ-xxx] from title
  └─────────────┘    map status: passed→PASS  failed→FAIL  skipped→TODO
       │              collect result + failure screenshots
       │
       ▼
  ┌─────────────┐
  │   onEnd     │
  └─────────────┘
       │
       ├─ updateTestStatus = true?
       │    └─► POST /import/execution  (single batch for all results)
       │
       ├─ attachScreenshots = true?
       │    └─► for each failed test:
       │          GET  /testexec/{key}/testruns  → find run ID
       │          POST /testrun/{runId}/evidence → upload screenshot (base64)
       │
       ├─ untrackedReport = true?
       │    └─► write reports/untracked-tests.txt
       │         (tests with no [PROJ-xxx] key in title)
       │
       └─► print summary to console
             ╔═══════════════════════════════════════╗
             ║  X-Ray Integration Summary            ║
             ║  Execution Key : PROJ-456             ║
             ║  Total Tests   : 42                   ║
             ║  Tracked       : 38 (✔ 35 | ✖ 3 | ⊘ 0)║
             ║  Untracked     : 4                    ║
             ╚═══════════════════════════════════════╝
```

---

## Enable Locally

### Step 1 — Copy and fill in `.env.xray`

The file `.env.xray` at the project root is the template for local credentials. It is **gitignored** — never commit real values.

```bash
# The file already exists at the root — just fill in your values:
# .env.xray

XRAY_ENABLED=true
XRAY_VERBOSE=true                          # shows auth + API call logs
XRAY_MODE=cloud                            # 'cloud' | 'dc'

JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_PROJECT_KEY=PROJ

# Auth — choose ONE block:

# Option A: Basic (Jira Cloud — email + API token)
JIRA_EMAIL=you@company.com
JIRA_API_TOKEN=your-api-token              # https://id.atlassian.com/manage-profile/security/api-tokens

# Option B: PAT (Jira Data Center)
# JIRA_PAT=your-personal-access-token

# Option C: X-Ray Client (X-Ray Cloud)
# XRAY_CLIENT_ID=your-client-id
# XRAY_CLIENT_SECRET=your-client-secret

# Feature flags — enable what you need:
XRAY_FEATURE_CREATE_EXECUTION=true
XRAY_FEATURE_UPDATE_STATUS=true
XRAY_FEATURE_ATTACH_SCREENSHOTS=true
XRAY_FEATURE_UNTRACKED_REPORT=true

# Optional metadata:
XRAY_TEST_PLAN_KEY=PROJ-100
XRAY_TEST_ENVIRONMENTS=local,chrome
```

### Step 2 — Load the env file when running tests

The project uses `dotenv` to load environment files. The default file loaded is `env/.env.dev`. To load `.env.xray` instead, pass it via the `ENV` variable or load it directly:

```bash
# Option A: load .env.xray explicitly with dotenv-cli
npx dotenv -e .env.xray -- npx playwright test

# Option B: set vars inline (PowerShell)
$env:XRAY_ENABLED="true"; $env:JIRA_EMAIL="you@company.com"; $env:JIRA_API_TOKEN="token"; npx playwright test

# Option C: add a dedicated npm script in package.json
# "test:xray": "dotenv -e .env.xray -- npx playwright test"
```

### Step 3 — Tag your tests

```typescript
// Single key
test('[PROJ-123] should login successfully', async ({ page }) => {
  await page.goto('/login');
  // ...
});

// Multiple keys — both PROJ-123 and PROJ-456 get updated
test('[PROJ-123][PROJ-456] login and verify dashboard', async ({ page }) => {
  // ...
});
```

### Step 4 — Run

```bash
npx playwright test
```

Watch the console for `[xray]` prefixed log lines. With `XRAY_VERBOSE=true` you'll see every API call. The summary box prints at the end of the run.

### Verify it worked

1. Open Jira and search for the execution key printed in the summary (e.g. `PROJ-456`)
2. The execution should show all linked tests with PASS/FAIL status
3. Failed tests should have screenshots attached under the "Evidence" tab

---

## Enable on CI

The reporter is **disabled by default** (`XRAY_ENABLED=false`). On CI, enable it by setting environment variables — no code changes needed.

### GitHub Actions

Store secrets in **Settings → Secrets and variables → Actions**:

| Secret name | Value |
|---|---|
| `JIRA_BASE_URL` | `https://your-org.atlassian.net` |
| `JIRA_EMAIL` | `qa-bot@company.com` |
| `JIRA_API_TOKEN` | your API token |

Then reference them in your workflow:

```yaml
# .github/workflows/playwright.yml

- name: Run Playwright tests with X-Ray reporting
  env:
    # ── Enable X-Ray ──────────────────────────────────────────────────────
    XRAY_ENABLED: "true"
    XRAY_MODE: cloud

    # ── Jira connection ───────────────────────────────────────────────────
    JIRA_BASE_URL: ${{ secrets.JIRA_BASE_URL }}
    JIRA_PROJECT_KEY: PROJ
    JIRA_EMAIL: ${{ secrets.JIRA_EMAIL }}
    JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}

    # ── Features ──────────────────────────────────────────────────────────
    XRAY_FEATURE_CREATE_EXECUTION: "true"
    XRAY_FEATURE_UPDATE_STATUS: "true"
    XRAY_FEATURE_ATTACH_SCREENSHOTS: "true"
    XRAY_FEATURE_UNTRACKED_REPORT: "true"

    # ── Metadata ──────────────────────────────────────────────────────────
    XRAY_TEST_PLAN_KEY: PROJ-100
    XRAY_TEST_ENVIRONMENTS: staging,chrome
    XRAY_EXECUTION_SUMMARY: "CI Run — ${{ github.ref_name }} @ ${{ github.sha }}"

  run: npx playwright test
```

#### Sharded runs — one execution for all shards

```yaml
jobs:
  create-execution:
    runs-on: ubuntu-latest
    outputs:
      execution_key: ${{ steps.create.outputs.key }}
    steps:
      - name: Create X-Ray execution
        id: create
        run: |
          KEY=$(curl -s -X POST "${{ secrets.JIRA_BASE_URL }}/rest/api/3/issue" \
            -H "Authorization: Basic $(echo -n ${{ secrets.JIRA_EMAIL }}:${{ secrets.JIRA_API_TOKEN }} | base64 -w0)" \
            -H "Content-Type: application/json" \
            -d '{
              "fields": {
                "project": { "key": "PROJ" },
                "summary": "CI Run — ${{ github.ref_name }}",
                "issuetype": { "name": "Test Execution" }
              }
            }' | jq -r '.key')
          echo "key=$KEY" >> $GITHUB_OUTPUT

  test:
    needs: create-execution
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - name: Run shard ${{ matrix.shard }}
        env:
          XRAY_ENABLED: "true"
          JIRA_BASE_URL: ${{ secrets.JIRA_BASE_URL }}
          JIRA_EMAIL: ${{ secrets.JIRA_EMAIL }}
          JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
          XRAY_EXECUTION_KEY: ${{ needs.create-execution.outputs.execution_key }}
          XRAY_FEATURE_CREATE_EXECUTION: "false"   # execution already exists
          XRAY_FEATURE_UPDATE_STATUS: "true"
          XRAY_FEATURE_ATTACH_SCREENSHOTS: "true"
        run: npx playwright test --shard=${{ matrix.shard }}/4
```

### Jenkins

Store credentials in Jenkins Credentials Manager, then reference them:

```groovy
pipeline {
  agent any
  environment {
    XRAY_ENABLED            = 'true'
    XRAY_MODE               = 'cloud'
    JIRA_BASE_URL           = credentials('jira-base-url')
    JIRA_PROJECT_KEY        = 'PROJ'
    JIRA_EMAIL              = credentials('jira-email')
    JIRA_API_TOKEN          = credentials('jira-api-token')
    XRAY_FEATURE_CREATE_EXECUTION   = 'true'
    XRAY_FEATURE_UPDATE_STATUS      = 'true'
    XRAY_FEATURE_ATTACH_SCREENSHOTS = 'true'
    XRAY_FEATURE_UNTRACKED_REPORT   = 'true'
    XRAY_TEST_PLAN_KEY      = 'PROJ-100'
    XRAY_TEST_ENVIRONMENTS  = 'staging'
  }
  stages {
    stage('Test') {
      steps {
        sh 'npm ci'
        sh 'npx playwright install --with-deps'
        sh 'npx playwright test'
      }
    }
  }
}
```

### Azure DevOps

Store secrets in **Pipelines → Library → Variable Groups** (mark as secret):

```yaml
# azure-pipelines.yml

variables:
  - group: xray-credentials   # contains JIRA_EMAIL, JIRA_API_TOKEN, JIRA_BASE_URL

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'

  - script: npm ci && npx playwright install --with-deps
    displayName: Install

  - script: npx playwright test
    displayName: Run tests with X-Ray reporting
    env:
      XRAY_ENABLED: "true"
      XRAY_MODE: cloud
      JIRA_BASE_URL: $(JIRA_BASE_URL)
      JIRA_PROJECT_KEY: PROJ
      JIRA_EMAIL: $(JIRA_EMAIL)
      JIRA_API_TOKEN: $(JIRA_API_TOKEN)
      XRAY_FEATURE_CREATE_EXECUTION: "true"
      XRAY_FEATURE_UPDATE_STATUS: "true"
      XRAY_FEATURE_ATTACH_SCREENSHOTS: "true"
      XRAY_TEST_PLAN_KEY: PROJ-100
      XRAY_TEST_ENVIRONMENTS: staging
```

---

## Test Title Format

X-Ray test keys are extracted from test titles using bracket notation. The project key prefix is case-sensitive and must be uppercase.

```typescript
test('[PROJ-123] should login', ...)                    // single key

test('[PROJ-123][PROJ-456] login and verify', ...)      // separate brackets

test('[PROJ-100, PROJ-101] checkout flow', ...)         // comma-separated

test('[PROJ-1/2/3] covers three test cases', ...)       // slash-separated
// → extracts PROJ-1, PROJ-2, PROJ-3

test('[PROJ-10, 20] two cases', ...)                    // bare numbers inherit prefix
// → extracts PROJ-10, PROJ-20
```

Tests without any bracket key are **untracked** — collected and written to `reports/untracked-tests.txt` when `untrackedReport` is enabled.

---

## Status Mapping

| Playwright | X-Ray | Meaning |
|---|---|---|
| `passed` | `PASS` | Test passed |
| `failed` | `FAIL` | Assertion or error |
| `timedOut` | `FAIL` | Exceeded timeout |
| `skipped` | `TODO` | Skipped / pending |
| `interrupted` | `ABORTED` | Run was cancelled |

---

## Features

Four features are independently toggleable:

| Feature | Config key | Env var | What it does |
|---|---|---|---|
| Create Execution | `createExecution` | `XRAY_FEATURE_CREATE_EXECUTION` | Creates a Test Execution issue in Jira at run start and pre-links all test keys |
| Update Status | `updateTestStatus` | `XRAY_FEATURE_UPDATE_STATUS` | Imports PASS/FAIL results in a single batch at run end |
| Attach Screenshots | `attachScreenshots` | `XRAY_FEATURE_ATTACH_SCREENSHOTS` | Uploads failure screenshots as evidence on the test run |
| Untracked Report | `untrackedReport` | `XRAY_FEATURE_UNTRACKED_REPORT` | Writes `reports/untracked-tests.txt` listing tests with no X-Ray key |

You can enable any combination. For example, to only update statuses on an existing execution without creating a new one:

```bash
XRAY_ENABLED=true
XRAY_EXECUTION_KEY=PROJ-456          # existing execution
XRAY_FEATURE_CREATE_EXECUTION=false  # skip creation
XRAY_FEATURE_UPDATE_STATUS=true      # just push results
```

---

## Auth Strategies

### `basic` — Jira Cloud

```bash
JIRA_EMAIL=you@company.com
JIRA_API_TOKEN=your-api-token
```

Generate at: `https://id.atlassian.com/manage-profile/security/api-tokens`

### `pat` — Jira Data Center

```bash
JIRA_PAT=your-personal-access-token
```

Generate in Jira: **Profile → Personal Access Tokens**

### `xray-client` — X-Ray Cloud

```bash
XRAY_CLIENT_ID=your-client-id
XRAY_CLIENT_SECRET=your-client-secret
```

Generate in X-Ray Cloud: **Settings → API Keys**

> When using `xray-client`, the reporter calls `https://xray.cloud.getxray.app/api/v2/authenticate` to get a bearer token for X-Ray API calls. Jira REST calls (creating issues) still need `JIRA_EMAIL` + `JIRA_API_TOKEN`.

Set the auth type in `xray.config.ts`:

```typescript
auth: { type: 'basic' }      // Jira Cloud
auth: { type: 'pat' }        // Jira Data Center
auth: { type: 'xray-client'} // X-Ray Cloud
```

---

## Configuration Reference

`src/main/utils/xray/xray.config.ts` — the only file you need to edit for static config. All values are overridden by environment variables.

```typescript
const xrayConfig: XRayUserConfig = {
  enabled: false,          // env: XRAY_ENABLED
  verbose: false,          // env: XRAY_VERBOSE

  jiraBaseUrl: '',         // env: JIRA_BASE_URL
  projectKey:  '',         // env: JIRA_PROJECT_KEY
  xrayMode: 'cloud',       // env: XRAY_MODE  ('cloud' | 'dc')

  auth: {
    type: 'basic',         // 'basic' | 'pat' | 'xray-client'
    email: '',             // env: JIRA_EMAIL
    apiToken: '',          // env: JIRA_API_TOKEN
  },

  features: {
    createExecution:   false, // env: XRAY_FEATURE_CREATE_EXECUTION
    updateTestStatus:  false, // env: XRAY_FEATURE_UPDATE_STATUS
    attachScreenshots: false, // env: XRAY_FEATURE_ATTACH_SCREENSHOTS
    untrackedReport:   false, // env: XRAY_FEATURE_UNTRACKED_REPORT
  },

  executionSummary:     'Playwright E2E — Automated Run', // env: XRAY_EXECUTION_SUMMARY
  executionDescription: 'Automated test execution',       // env: XRAY_EXECUTION_DESCRIPTION
  testPlanKey:          '',   // env: XRAY_TEST_PLAN_KEY
  testEnvironments:     [],   // env: XRAY_TEST_ENVIRONMENTS (comma-separated)
  existingExecutionKey: '',   // env: XRAY_EXECUTION_KEY
  assignee:             '',   // env: XRAY_ASSIGNEE  (Jira account ID)
  untrackedOutputFile:  'reports/untracked-tests.txt', // env: XRAY_UNTRACKED_OUTPUT
};
```

---

## Environment Variables

All variables — grouped by category. Environment variables always override `xray.config.ts`.

```
# ── Master switch ──────────────────────────────────────────────────────────────
XRAY_ENABLED=false              # true | false
XRAY_VERBOSE=false              # true | false  (debug logging)
XRAY_MODE=cloud                 # cloud | dc

# ── Jira connection ────────────────────────────────────────────────────────────
JIRA_BASE_URL=                  # https://your-org.atlassian.net
JIRA_PROJECT_KEY=               # e.g. PROJ

# ── Auth — Basic (Jira Cloud) ──────────────────────────────────────────────────
JIRA_EMAIL=                     # qa@company.com
JIRA_API_TOKEN=                 # from id.atlassian.com/manage-profile/security/api-tokens

# ── Auth — PAT (Jira Data Center) ─────────────────────────────────────────────
JIRA_PAT=                       # personal access token

# ── Auth — X-Ray Client (X-Ray Cloud) ─────────────────────────────────────────
XRAY_CLIENT_ID=
XRAY_CLIENT_SECRET=

# ── Feature flags ──────────────────────────────────────────────────────────────
XRAY_FEATURE_CREATE_EXECUTION=false
XRAY_FEATURE_UPDATE_STATUS=false
XRAY_FEATURE_ATTACH_SCREENSHOTS=false
XRAY_FEATURE_UNTRACKED_REPORT=false

# ── Execution metadata ─────────────────────────────────────────────────────────
XRAY_EXECUTION_SUMMARY=         # title of the execution issue
XRAY_EXECUTION_DESCRIPTION=     # description of the execution issue
XRAY_TEST_PLAN_KEY=             # e.g. PROJ-100
XRAY_TEST_ENVIRONMENTS=         # comma-separated: staging,chrome
XRAY_EXECUTION_KEY=             # reuse existing execution (skips creation)
XRAY_ASSIGNEE=                  # Jira account ID
XRAY_UNTRACKED_OUTPUT=          # default: reports/untracked-tests.txt
```

---

## File Structure

```
src/main/utils/xray/
├── xray.config.ts          ← Edit this — static config with env var comments
├── types.ts                ← All TypeScript types
├── index.ts                ← Public barrel (types + utilities)
├── client/
│   └── xrayClient.ts       ← HTTP client for Jira + X-Ray REST APIs
├── reporter/
│   └── xrayReporter.ts     ← Playwright Reporter (onBegin / onTestEnd / onEnd)
└── utils/
    ├── configResolver.ts   ← Merges xray.config.ts + env vars, validates
    ├── logger.ts           ← [xray] prefixed console logger
    ├── screenshotHelper.ts ← Screenshot file → base64 evidence
    ├── testIdExtractor.ts  ← Extracts [PROJ-123] keys from test titles
    └── untrackedReport.ts  ← Writes untracked report + prints summary box

.env.xray                   ← Local credentials template (gitignored)
```

### Design notes

- **Reporter not in the barrel** — `xrayReporter.ts` is loaded by Playwright via file path in `playwright.config.ts`, not exported from `index.ts`. This avoids circular imports.
- **Non-throwing API calls** — every HTTP call catches errors and logs them. A failing X-Ray call never breaks the test run.
- **Validation only when enabled** — the reporter can be registered in `playwright.config.ts` without needing credentials in every environment. Validation runs only when `XRAY_ENABLED=true`.
- **Single batch import** — all results are sent in one `POST /import/execution` call at `onEnd`, not per-test.
