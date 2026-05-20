# k6 Scenario Utilities (`k6/lib/scenarios.js`)

Pre-built scenario configurations for common load patterns. Import and use in `options.scenarios`.

## VU-Based Scenarios

### `constantVUs({ vus, duration })`

Fixed number of virtual users for a set duration. Simplest baseline test.

```js
import { constantVUs } from '../lib/scenarios.js';

export var options = {
  scenarios: { baseline: constantVUs({ vus: 10, duration: '5m' }) },
};
```

### `rampUp({ target, duration, rampUpTime?, rampDownTime? })`

Ramp up → hold → ramp down. The standard load test pattern.

```js
import { rampUp } from '../lib/scenarios.js';

export var options = {
  scenarios: {
    load: rampUp({
      target: 50,          // peak VUs
      duration: '5m',      // hold duration
      rampUpTime: '1m',    // default: '1m'
      rampDownTime: '30s', // default: '1m'
    }),
  },
};
```

### `rampingVUs({ stages })`

Custom stages for complex load shapes.

```js
import { rampingVUs } from '../lib/scenarios.js';

export var options = {
  scenarios: {
    custom: rampingVUs({
      stages: [
        { duration: '2m', target: 10 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 0 },
      ],
    }),
  },
};
```

## Iteration-Based Scenarios

### `perVuIterations({ vus, iterations, maxDuration? })`

Each VU runs exactly N iterations. Good for smoke tests and functional verification.

```js
import { perVuIterations } from '../lib/scenarios.js';

export var options = {
  scenarios: {
    smoke: perVuIterations({ vus: 1, iterations: 1 }),
  },
};
```

### `sharedIterations({ vus, iterations, maxDuration? })`

N total iterations split across all VUs. Good for running a fixed test suite.

```js
import { sharedIterations } from '../lib/scenarios.js';

export var options = {
  scenarios: {
    suite: sharedIterations({ vus: 5, iterations: 100 }),
  },
};
```

## Arrival-Rate Scenarios

### `constantArrivalRate({ rate, duration, preAllocatedVUs?, maxVUs?, timeUnit? })`

Fixed RPS regardless of response time. Best for API load tests where you want to maintain specific throughput.

```js
import { constantArrivalRate } from '../lib/scenarios.js';

export var options = {
  scenarios: {
    steady: constantArrivalRate({
      rate: 100,           // 100 requests per second
      duration: '5m',
      preAllocatedVUs: 50,
      maxVUs: 200,
    }),
  },
};
```

## Named Preset Patterns

### `smokeTest()`

1 VU, 1 iteration — verify the system works at all.

```js
export var options = {
  scenarios: { smoke: smokeTest() },
};
```

### `spikeTest({ peak, holdDuration? })`

Sudden burst of traffic — tests resilience.

```js
export var options = {
  scenarios: {
    spike: spikeTest({ peak: 200, holdDuration: '2m' }),
  },
};
```

### `soakTest({ vus, duration })`

Sustained load over a long period — detects memory leaks and degradation.

```js
export var options = {
  scenarios: {
    soak: soakTest({ vus: 20, duration: '2h' }),
  },
};
```

### `stressTest({ maxVUs, stepDuration? })`

Gradually increase load until the system breaks. Stages: 10% → 25% → 50% → 75% → 100% → 125%.

```js
export var options = {
  scenarios: {
    stress: stressTest({ maxVUs: 200, stepDuration: '2m' }),
  },
};
```

## Multiple Scenarios

Run different load patterns simultaneously:

```js
export var options = {
  scenarios: {
    reads: {
      ...rampUp({ target: 50, duration: '5m' }),
      exec: 'readScenario',
    },
    writes: {
      ...constantVUs({ vus: 5, duration: '5m' }),
      exec: 'writeScenario',
    },
  },
};

export function readScenario() { /* GET requests */ }
export function writeScenario() { /* POST requests */ }
```
