/**
 * Spike Test — JSONPlaceholder API
 * Sudden burst then recovery — tests resilience under flash traffic.
 *
 * Run:  k6 run k6/tests/spike.test.js
 * Env:  SPIKE_VUS=200
 */

import { sleep } from 'k6';
import { get, buildUrl } from '../lib/http.js';
import { runChecks, statusIs, responseTimeLt } from '../lib/checks.js';
import { combine, p95lt, errorRateLt } from '../lib/thresholds.js';
import { randomInt } from '../lib/data.js';
import { buildSummary } from '../lib/reporter.js';

var BASE_URL   = __ENV.BASE_URL   || 'https://jsonplaceholder.typicode.com';
var SPIKE_VUS  = parseInt(__ENV.SPIKE_VUS || '100');
var BASELINE   = Math.max(1, Math.round(SPIKE_VUS * 0.05));

export var options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: BASELINE },
        { duration: '10s', target: SPIKE_VUS },
        { duration: '1m',  target: SPIKE_VUS },
        { duration: '10s', target: BASELINE },
        { duration: '2m',  target: BASELINE },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: combine(p95lt(3000), errorRateLt(0.05)),
};

export default function () {
  var postId = randomInt(1, 100);
  var res = get(buildUrl(BASE_URL, '/posts/' + postId), { tags: { name: 'get-post' } });
  runChecks(res, statusIs(200), responseTimeLt(3000));
  sleep(randomInt(1, 3) * 0.1);
}

export function handleSummary(data) {
  return buildSummary(data, {
    testName: 'Spike Test \u2014 JSONPlaceholder API',
    outputFile: 'k6/results/spike-summary.json',
    htmlFile: 'k6-report/spike.html',
  });
}
