/**
 * k6 Scenario Utilities — pre-built load pattern configs.
 * Compatible with k6 v0.49 (ES2015 only).
 */

export function constantArrivalRate(opts) {
  return {
    executor: 'constant-arrival-rate',
    rate: opts.rate,
    duration: opts.duration,
    preAllocatedVUs: opts.preAllocatedVUs || opts.rate * 2,
    maxVUs: opts.maxVUs || opts.rate * 10,
    timeUnit: opts.timeUnit || '1s',
  };
}

export function constantVUs(opts) {
  return { executor: 'constant-vus', vus: opts.vus, duration: opts.duration };
}

export function rampUp(opts) {
  var up = opts.rampUpTime || '1m';
  var down = opts.rampDownTime || '1m';
  return {
    executor: 'ramping-vus',
    stages: [
      { duration: up, target: opts.target },
      { duration: opts.duration, target: opts.target },
      { duration: down, target: 0 },
    ],
  };
}

export function rampingVUs(opts) {
  return { executor: 'ramping-vus', stages: opts.stages };
}

export function sharedIterations(opts) {
  return { executor: 'shared-iterations', vus: opts.vus, iterations: opts.iterations, maxDuration: opts.maxDuration || '10m' };
}

export function perVuIterations(opts) {
  return { executor: 'per-vu-iterations', vus: opts.vus, iterations: opts.iterations, maxDuration: opts.maxDuration || '10m' };
}

export function smokeTest()    { return perVuIterations({ vus: 1, iterations: 1, maxDuration: '1m' }); }

export function spikeTest(opts) {
  return {
    executor: 'ramping-vus',
    stages: [
      { duration: '10s', target: opts.peak },
      { duration: opts.holdDuration || '1m', target: opts.peak },
      { duration: '10s', target: 0 },
    ],
  };
}

export function soakTest(opts) { return constantVUs({ vus: opts.vus, duration: opts.duration }); }

export function stressTest(opts) {
  var step = opts.stepDuration || '2m';
  var max = opts.maxVUs;
  return {
    executor: 'ramping-vus',
    stages: [
      { duration: step, target: Math.round(max * 0.1) },
      { duration: step, target: Math.round(max * 0.25) },
      { duration: step, target: Math.round(max * 0.5) },
      { duration: step, target: Math.round(max * 0.75) },
      { duration: step, target: max },
      { duration: step, target: Math.round(max * 1.25) },
      { duration: '1m', target: 0 },
    ],
  };
}
