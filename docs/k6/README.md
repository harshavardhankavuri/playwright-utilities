# k6 Load Testing

Load and performance tests using [k6](https://k6.io) — a developer-centric load testing tool that runs JavaScript.

## Table of Contents

- [Directory Structure](#directory-structure)
- [Prerequisites](#prerequisites)
- [Running Tests](#running-tests)
- [Environment Variables](#environment-variables)
- [Real-Time Dashboard](#real-time-dashboard)
- [Reports](#reports)
- [Utilities Reference](#utilities-reference)

## Directory Structure

```
k6/
├── lib/                    ← Reusable utilities (imported by all tests)
│   ├── http.js             ← HTTP wrappers: get, post, put, patch, del, buildUrl
│   ├── checks.js           ← Composable check builders: statusIs, bodyHasField, runChecks
│   ├── thresholds.js       ← Threshold presets: p95lt, errorRateLt, combine, standardApiSla
│   ├── scenarios.js        ← Load pattern builders: rampUp, spikeTest, stressTest, smokeTest
│   ├── data.js             ← Test data generators: randomString, feeder, buildPayload
│   └── reporter.js         ← Custom HTML + JSON + stdout summary via handleSummary
├── tests/
│   ├── smoke.test.js       ← 1 VU, 1 iteration — verify API is reachable
│   ├── load.test.js        ← Ramp to 20 VUs, hold 2 min — normal load SLA
│   ├── stress.test.js      ← Ramp to 125% capacity — find breaking point
│   ├── spike.test.js       ← Sudden burst then recovery
│   ├── crud.test.js        ← Full browse/read/create/update/delete journey
│   └── batch.test.js       ← Parallel/batch requests (dashboard simulation)
├── results/                ← JSON summaries (gitignored, .gitkeep present)
└── docs/k6/                ← This documentation
    ├── README.md           ← This file
    ├── http.md             ← HTTP utilities reference
    ├── checks.md           ← Check builders reference
    ├── thresholds.md       ← Threshold presets reference
    ├── scenarios.md        ← Scenario builders reference
    ├── data.md             ← Test data utilities reference
    └── reporter.md         ← Reporter reference
```

## Prerequisites

k6 must be installed separately — it is **not** an npm package.

```bash
# Windows (winget)
winget install k6 --source winget

# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg --no-default-keyring \
  --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] \
  https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

Verify: `k6 version`

## Running Tests

### npm scripts (recommended)

```bash
npm run k6:smoke    # Smoke  — 1 VU, 1 iteration
npm run k6:load     # Load   — ramp to 20 VUs, hold 2 min
npm run k6:stress   # Stress — ramp to 100 VUs (125% peak)
npm run k6:spike    # Spike  — sudden burst to 100 VUs
npm run k6:crud     # CRUD   — full user journey, 10 VUs
npm run k6:batch    # Batch  — parallel requests, 5 VUs
```

### Direct k6 commands

```bash
# Basic run
k6 run k6/tests/smoke.test.js

# Override VUs and duration
k6 run --env PEAK_VUS=50 --env HOLD_DURATION=5m k6/tests/load.test.js

# Target a different environment
k6 run --env BASE_URL=https://staging.api.example.com k6/tests/load.test.js

# Output raw metrics to JSON
k6 run --out json=k6/results/raw.json k6/tests/load.test.js
```

## Environment Variables

| Variable | Default | Used by | Description |
|---|---|---|---|
| `BASE_URL` | `https://jsonplaceholder.typicode.com` | all | API base URL |
| `PEAK_VUS` | `20` | load | Peak virtual users |
| `HOLD_DURATION` | `2m` | load | Hold duration at peak |
| `MAX_VUS` | `100` | stress | Maximum VUs |
| `SPIKE_VUS` | `100` | spike | Peak VUs for spike |

## Real-Time Dashboard

The `:dashboard` npm scripts enable k6's built-in web dashboard at `http://127.0.0.1:5665` while the test runs. The dashboard is also exported as a standalone HTML file to `k6-report/` when the test finishes.

```bash
npm run k6:smoke:dashboard    # Opens live dashboard + saves k6-report/smoke-dashboard.html
npm run k6:load:dashboard     # Opens live dashboard + saves k6-report/load-dashboard.html
npm run k6:stress:dashboard
npm run k6:spike:dashboard
npm run k6:crud:dashboard
npm run k6:batch:dashboard
```

Open `http://127.0.0.1:5665` in your browser while the test is running to see real-time charts for:
- Virtual users over time
- Request rate and response times
- Error rate
- Threshold pass/fail status

## Reports

Each test produces two output files:

| File | Contents |
|---|---|
| `k6-report/<test>.html` | Custom dark-themed self-contained HTML report |
| `k6/results/<test>-summary.json` | Raw JSON metrics for CI / Allure attachment |
| `k6-report/<test>-dashboard.html` | k6 built-in dashboard snapshot (`:dashboard` scripts only) |

Both HTML files are gitignored. The JSON files are also gitignored but can be attached to Allure using `allureAttachFile()` from the Playwright utilities.

## Utilities Reference

| File | Docs |
|---|---|
| `k6/lib/http.js` | [http.md](./http.md) |
| `k6/lib/checks.js` | [checks.md](./checks.md) |
| `k6/lib/thresholds.js` | [thresholds.md](./thresholds.md) |
| `k6/lib/scenarios.js` | [scenarios.md](./scenarios.md) |
| `k6/lib/data.js` | [data.md](./data.md) |
| `k6/lib/reporter.js` | [reporter.md](./reporter.md) |
