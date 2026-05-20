# X-Ray Reporter

Playwright custom reporter that pushes test results to X-Ray (Jira) in **streaming mode** — each test is linked and its result imported immediately after it finishes, not batched at the end.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Full Flow — New Execution](#full-flow--new-execution)
- [Full Flow — Existing Execution Key](#full-flow--existing-execution-key)
- [Per-Test Detail Flow](#per-test-detail-flow)
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

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         REPORTER COMPONENTS                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  xrayReporter.ts          ← Playwright Reporter (onBegin/onTestEnd/onEnd)│
│       │                                                                  │
│       ├── configResolver.ts  ← merges xray.config.ts + env vars         │
│       ├── testIdExtractor.ts ← extracts [PROJ-123] from test titles      │
│       ├── screenshotHelper.ts← converts screenshots to base64 evidence  │
│       ├── untrackedReport.ts ← writes untracked-tests.txt + summary box │
│       └── xrayClient.ts     ← all HTTP calls to Jira + X-Ray APIs       │
│                                                                          │
│  xray.config.ts           ← the only file you need to edit              │
│  .env.xray                ← local credentials (gitignored)              │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Full Flow — New Execution

When `XRAY_FEATURE_CREATE_EXECUTION=true` and no `XRAY_EXECUTION_KEY` is set.

```
npx playwright test
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  CONSTRUCTOR                                                          │
│  resolveConfig()  ← merge xray.config.ts + env vars                  │
│  XRAY_ENABLED=false? ──────────────────────────────► reporter is no-op│
└───────────────────────────────────────────────────────────────────────┘
        │ XRAY_ENABLED=true
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  onBegin                                                              │
│                                                                       │
│  auth.type = 'xray-client'?                                           │
│    YES ──► POST /authenticate ──► get bearer token                    │
│    NO  ──► skip (basic/pat headers already set)                       │
│                                                                       │
│  XRAY_FEATURE_CREATE_EXECUTION=true                                   │
│    ──► POST /rest/api/3/issue  { issuetype: "Test Execution" }        │
│    ──► store executionKey = "PROJ-456"                                │
│                                                                       │
│  ✗ NO pre-linking of tests here                                       │
│    (only tests that actually run will be linked)                      │
└───────────────────────────────────────────────────────────────────────┘
        │
        │  Playwright runs each test
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  onTestEnd  ×N  (one call per test, runs in parallel with tests)      │
│  see "Per-Test Detail Flow" below                                     │
└───────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  onEnd                                                                │
│                                                                       │
│  await Promise.allSettled(pendingOps)                                 │
│    ← drain all per-test async work before continuing                  │
│                                                                       │
│  XRAY_FEATURE_UNTRACKED_REPORT=true AND untracked tests exist?        │
│    ──► write reports/untracked-tests.txt                              │
│                                                                       │
│  print summary box to console                                         │
│  ╔══════════════════════════════════════╗                             │
│  ║  X-Ray Integration Summary          ║                             │
│  ║  Execution Key : PROJ-456           ║                             │
│  ║  Total Tests   : 42                 ║                             │
│  ║  Tracked       : 38 (✔ 35 | ✖ 3)   ║                             │
│  ║  Untracked     : 4                  ║                             │
│  ╚══════════════════════════════════════╝                             │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Full Flow — Existing Execution Key

When `XRAY_EXECUTION_KEY=PROJ-456` is set (e.g. in CI sharded runs).

```
npx playwright test
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  CONSTRUCTOR  (same as above)                                         │
└───────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  onBegin                                                              │
│                                                                       │
│  auth.type = 'xray-client'?                                           │
│    YES ──► POST /authenticate                                         │
│    NO  ──► skip                                                       │
│                                                                       │
│  XRAY_EXECUTION_KEY is set                                            │
│    ──► executionKey = "PROJ-456"  (no creation)                       │
│                                                                       │
│  XRAY_FEATURE_UPDATE_STATUS=true?                                     │
│    ──► GET /testexec/PROJ-456/tests                                   │
│        populate linkedTestsCache  { "PROJ-456" → Set<testKey> }       │
│        (pre-warm cache so per-test checks are instant)                │
│                                                                       │
│  ✗ NO pre-linking of tests here                                       │
└───────────────────────────────────────────────────────────────────────┘
        │
        │  Playwright runs each test
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  onTestEnd  ×N                                                        │
│  see "Per-Test Detail Flow" below                                     │
└───────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  onEnd  (same as above)                                               │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Per-Test Detail Flow

This runs for **every test** that Playwright executes, immediately after it finishes.

```
Test finishes
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  Extract X-Ray key(s) from test title                                 │
│  e.g.  "[PROJ-123] should login"  ──►  ["PROJ-123"]                   │
│        "[PROJ-1/2/3] covers all"  ──►  ["PROJ-1","PROJ-2","PROJ-3"]   │
└───────────────────────────────────────────────────────────────────────┘
        │
        ├── No key found?
        │       │
        │       ▼
        │   ┌──────────────────────────────────────────────────────────┐
        │   │  UNTRACKED                                               │
        │   │  add to untrackedTests[]                                 │
        │   │  (written to untracked-tests.txt at onEnd if enabled)    │
        │   └──────────────────────────────────────────────────────────┘
        │       │
        │       └── done for this test
        │
        └── Key(s) found  AND  executionKey exists
                │
                │  (async op queued in pendingOps[], runs concurrently)
                ▼
        ┌──────────────────────────────────────────────────────────────┐
        │  For each testKey:                                           │
        │                                                              │
        │  STEP A — Link test to execution                             │
        │  ─────────────────────────────                               │
        │  check linkedTestsCache["PROJ-456"]                          │
        │                                                              │
        │    cache HIT  (already linked)                               │
        │      ──► skip API call                                       │
        │                                                              │
        │    cache MISS  (not yet linked)                              │
        │      ──► POST /testexec/PROJ-456/test  { add: ["PROJ-123"] } │
        │      ──► update cache                                        │
        │                                                              │
        │  STEP B — Import result immediately                          │
        │  ────────────────────────────────                            │
        │  POST /import/execution                                      │
        │  {                                                           │
        │    testExecutionKey: "PROJ-456",                             │
        │    tests: [{                                                 │
        │      testKey:    "PROJ-123",                                 │
        │      status:     "PASS" | "FAIL" | "TODO" | "ABORTED",      │
        │      startedOn:  "2025-05-20T10:00:00.000Z",                 │
        │      finishedOn: "2025-05-20T10:00:03.500Z",                 │
        │      comment:    "Error: ..."  (failures only, max 2000 ch)  │
        │    }]                                                        │
        │  }                                                           │
        │                                                              │
        │  Result is now visible in Jira ✓                             │
        │                                                              │
        │  STEP C — Attach screenshot (failures only)                  │
        │  ─────────────────────────────────────────                   │
        │  status = FAIL or TIMEOUT?  AND  attachScreenshots=true?     │
        │                                                              │
        │    NO  ──► done                                              │
        │                                                              │
        │    YES ──► GET /testexec/PROJ-456/testruns                   │
        │            find runId for PROJ-123  (cached after first call)│
        │            POST /testrun/{runId}/evidence                    │
        │            { data: "<base64>", filename: "...", type: "..." }│
        └──────────────────────────────────────────────────────────────┘
                │
                └── done for this test key, move to next
```

### What "streaming" means in practice

```
Time ──────────────────────────────────────────────────────────────────►

  Test 1 runs ──► finishes ──► link + import + screenshot (async)
                                      │
  Test 2 runs ──► finishes ──► link + import + screenshot (async)
                                              │
  Test 3 runs ──► finishes ──► link + import + screenshot (async)
                                                      │
  ...                                                 │
                                                      ▼
  onEnd ──► await all pending ops ──► summary ──► done

  Jira shows results as they arrive, not only at the end.
  If the run is killed after test 2, tests 1 and 2 are already in Jira.
```

---

## Enable Locally

### Step 1 — Fill in `.env.xray`

```bash
# .env.xray  (already exists at project root — fill in your values)

XRAY_ENABLED=true
XRAY_VERBOSE=true                    # shows [xray] debug logs

JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_PROJECT_KEY=PROJ
XRAY_MODE=cloud                      # cloud | dc

# Auth — pick ONE:
JIRA_EMAIL=you@company.com
JIRA_API_TOKEN=your-api-token        # https://id.atlassian.com/manage-profile/security/api-tokens

# Features:
XRAY_FEATURE_CREATE_EXECUTION=true
XRAY_FEATURE_UPDATE_STATUS=true
XRAY_FEATURE_ATTACH_SCREENSHOTS=true
XRAY_FEATURE_UNTRACKED_REPORT=true

# Optional:
XRAY_TEST_PLAN_KEY=PROJ-100
XRAY_TEST_ENVIRONMENTS=local,chrome
```

### Step 2 — Load `.env.xray` when running

```bash
# Option A — dotenv-cli
npx dotenv -e .env.xray -- npx playwright test

# Option B — PowerShell inline
$env:XRAY_ENABLED="true"; $env:JIRA_EMAIL="you@company.com"; $env:JIRA_API_TOKEN="token"; npx playwright test

# Option C — add to package.json
"test:xray": "dotenv -e .env.xray -- npx playwright test"
```

### Step 3 — Tag your tests

```typescript
test('[PROJ-123] should login successfully', async ({ page }) => { ... });
```

### Step 4 — Run and watch the logs

```
[xray] Using existing execution: PROJ-456
[xray] [debug] PROJ-123 already linked to PROJ-456 — skipping
[xray] ✔ Imported 1 test result(s)
[xray] [debug] [PROJ-123] PASS — imported (1234ms)
[xray] [debug] Untracked: "exploratory: check new feature"
```

---

## Enable on CI

### GitHub Actions

Store in **Settings → Secrets and variables → Actions**:
`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`

```yaml
- name: Run Playwright tests with X-Ray
  env:
    XRAY_ENABLED: "true"
    XRAY_MODE: cloud
    JIRA_BASE_URL: ${{ secrets.JIRA_BASE_URL }}
    JIRA_PROJECT_KEY: PROJ
    JIRA_EMAIL: ${{ secrets.JIRA_EMAIL }}
    JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
    XRAY_FEATURE_CREATE_EXECUTION: "true"
    XRAY_FEATURE_UPDATE_STATUS: "true"
    XRAY_FEATURE_ATTACH_SCREENSHOTS: "true"
    XRAY_FEATURE_UNTRACKED_REPORT: "true"
    XRAY_TEST_PLAN_KEY: PROJ-100
    XRAY_TEST_ENVIRONMENTS: staging,chrome
  run: npx playwright test
```

#### Sharded runs — one execution shared across all shards

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
                "project":     { "key": "PROJ" },
                "summary":     "CI Run — ${{ github.ref_name }}",
                "issuetype":   { "name": "Test Execution" }
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
      - run: npm ci && npx playwright install --with-deps
      - name: Run shard ${{ matrix.shard }}
        env:
          XRAY_ENABLED: "true"
          JIRA_BASE_URL: ${{ secrets.JIRA_BASE_URL }}
          JIRA_EMAIL: ${{ secrets.JIRA_EMAIL }}
          JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
          XRAY_EXECUTION_KEY: ${{ needs.create-execution.outputs.execution_key }}
          XRAY_FEATURE_CREATE_EXECUTION: "false"
          XRAY_FEATURE_UPDATE_STATUS: "true"
          XRAY_FEATURE_ATTACH_SCREENSHOTS: "true"
        run: npx playwright test --shard=${{ matrix.shard }}/4
```

```
Shard flow with shared execution key:

  create-execution job
    └──► POST /rest/api/3/issue  ──►  PROJ-456

  shard 1  ──► XRAY_EXECUTION_KEY=PROJ-456
               onBegin: fetch linked tests (empty), warm cache
               test A finishes: link PROJ-101, import PASS  ──► Jira ✓
               test B finishes: link PROJ-102, import FAIL  ──► Jira ✓

  shard 2  ──► XRAY_EXECUTION_KEY=PROJ-456
               onBegin: fetch linked tests (PROJ-101, PROJ-102 already there)
               test C finishes: link PROJ-103, import PASS  ──► Jira ✓
               test D finishes: PROJ-101 already linked, import PASS ──► Jira ✓

  All shards write to the same PROJ-456 execution.
  No duplicate links. No race conditions on linking.
```

### Jenkins

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
  }
  stages {
    stage('Test') {
      steps {
        sh 'npm ci && npx playwright install --with-deps'
        sh 'npx playwright test'
      }
    }
  }
}
```

### Azure DevOps

```yaml
variables:
  - group: xray-credentials   # JIRA_EMAIL, JIRA_API_TOKEN, JIRA_BASE_URL

steps:
  - script: npm ci && npx playwright install --with-deps
  - script: npx playwright test
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
```

---

## Test Title Format

```typescript
test('[PROJ-123] should login', ...)                    // single key

test('[PROJ-123][PROJ-456] login and verify', ...)      // separate brackets

test('[PROJ-100, PROJ-101] checkout flow', ...)         // comma-separated

test('[PROJ-1/2/3] covers three test cases', ...)       // slash-separated
// → PROJ-1, PROJ-2, PROJ-3

test('[PROJ-10, 20] two cases', ...)                    // bare numbers inherit prefix
// → PROJ-10, PROJ-20

test('exploratory: check new feature', ...)             // no key → UNTRACKED
```

---

## Status Mapping

| Playwright | X-Ray | When |
|---|---|---|
| `passed` | `PASS` | Test passed |
| `failed` | `FAIL` | Assertion or error |
| `timedOut` | `FAIL` | Exceeded timeout |
| `skipped` | `TODO` | `test.skip()` |
| `interrupted` | `ABORTED` | Run cancelled |

---

## Features

| Feature | Config key | Env var | What it does |
|---|---|---|---|
| Create Execution | `createExecution` | `XRAY_FEATURE_CREATE_EXECUTION` | Creates a Test Execution issue in Jira at run start |
| Update Status | `updateTestStatus` | `XRAY_FEATURE_UPDATE_STATUS` | Links each test and imports its result immediately after it finishes |
| Attach Screenshots | `attachScreenshots` | `XRAY_FEATURE_ATTACH_SCREENSHOTS` | Uploads failure screenshots as evidence per test |
| Untracked Report | `untrackedReport` | `XRAY_FEATURE_UNTRACKED_REPORT` | Writes `reports/untracked-tests.txt` at the end of the run |

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

> When using `xray-client`, the reporter calls `https://xray.cloud.getxray.app/api/v2/authenticate` to get a bearer token. Jira REST calls (creating issues) still need `JIRA_EMAIL` + `JIRA_API_TOKEN`.

Set the type in `xray.config.ts`:
```typescript
auth: { type: 'basic' }       // Jira Cloud
auth: { type: 'pat' }         // Jira Data Center
auth: { type: 'xray-client' } // X-Ray Cloud
```

---

## Configuration Reference

```typescript
// src/main/utils/xray/xray.config.ts
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

```
# ── Master switch ──────────────────────────────────────────────────────────────
XRAY_ENABLED=false              # true | false
XRAY_VERBOSE=false              # true | false  (debug logging)
XRAY_MODE=cloud                 # cloud | dc

# ── Jira connection ────────────────────────────────────────────────────────────
JIRA_BASE_URL=                  # https://your-org.atlassian.net
JIRA_PROJECT_KEY=               # e.g. PROJ

# ── Auth — Basic (Jira Cloud) ──────────────────────────────────────────────────
JIRA_EMAIL=
JIRA_API_TOKEN=

# ── Auth — PAT (Jira Data Center) ─────────────────────────────────────────────
JIRA_PAT=

# ── Auth — X-Ray Client (X-Ray Cloud) ─────────────────────────────────────────
XRAY_CLIENT_ID=
XRAY_CLIENT_SECRET=

# ── Feature flags ──────────────────────────────────────────────────────────────
XRAY_FEATURE_CREATE_EXECUTION=false
XRAY_FEATURE_UPDATE_STATUS=false
XRAY_FEATURE_ATTACH_SCREENSHOTS=false
XRAY_FEATURE_UNTRACKED_REPORT=false

# ── Execution metadata ─────────────────────────────────────────────────────────
XRAY_EXECUTION_SUMMARY=
XRAY_EXECUTION_DESCRIPTION=
XRAY_TEST_PLAN_KEY=
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
│   └── xrayClient.ts       ← HTTP client: create execution, link tests,
│                              import results, attach evidence, cache
├── reporter/
│   └── xrayReporter.ts     ← Playwright Reporter
│                              onBegin: auth + resolve execution key
│                              onTestEnd: per-test link + import + evidence
│                              onEnd: drain pending ops + summary
└── utils/
    ├── configResolver.ts   ← Merges xray.config.ts + env vars, validates
    ├── logger.ts           ← [xray] prefixed console logger
    ├── screenshotHelper.ts ← Screenshot file → base64 evidence
    ├── testIdExtractor.ts  ← Extracts [PROJ-123] keys from test titles
    └── untrackedReport.ts  ← Writes untracked report + prints summary box

.env.xray                   ← Local credentials template (gitignored)
```

### Design notes

- **No pre-linking** — tests are linked to the execution only when they actually run, so filtered/skipped tests never appear in Jira.
- **Streaming** — results appear in Jira as each test finishes, not only at the end. Interrupted runs still have partial results.
- **Cache prevents duplicate links** — `linkedTestsCache` is pre-warmed at `onBegin` (for existing executions) so repeated runs against the same execution don't re-link already-linked tests.
- **`Promise.allSettled`** — per-test async work runs concurrently. A failed screenshot upload doesn't block other tests' results.
- **Non-throwing** — every API call catches errors and logs them. A failing X-Ray call never breaks the test run.
- **Validation only when enabled** — the reporter can be registered in `playwright.config.ts` without needing credentials in every environment.
