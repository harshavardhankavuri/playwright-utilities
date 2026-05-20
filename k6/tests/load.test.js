/**
 * Load Test — JSONPlaceholder API
 * Ramps to 20 VUs, holds 2 min, ramps down. Verifies normal-load SLA.
 *
 * Run:  k6 run k6/tests/load.test.js
 * Env:  PEAK_VUS=50  HOLD_DURATION=5m  BASE_URL=https://...
 */

import { sleep } from 'k6';
import { get, post, buildUrl } from '../lib/http.js';
import { runChecks, statusIs, bodyIsArray, bodyHasField, responseTimeLt } from '../lib/checks.js';
import { combine, p95lt, p99lt, errorRateLt, allPassChecks } from '../lib/thresholds.js';
import { randomInt, randomString, buildPayload } from '../lib/data.js';
import { logStep, buildSummary } from '../lib/reporter.js';

var BASE_URL      = __ENV.BASE_URL      || 'https://jsonplaceholder.typicode.com';
var PEAK_VUS      = parseInt(__ENV.PEAK_VUS || '20');
var HOLD_DURATION = __ENV.HOLD_DURATION  || '2m';

export var options = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: PEAK_VUS },
        { duration: HOLD_DURATION, target: PEAK_VUS },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: combine(p95lt(500), p99lt(1000), errorRateLt(0.01), allPassChecks()),
};

export default function () {
  var userId = randomInt(1, 10);
  var postId = randomInt(1, 100);

  logStep('GET /posts');
  var posts = get(buildUrl(BASE_URL, '/posts', { userId: userId }), { tags: { name: 'get-posts' } });
  runChecks(posts, statusIs(200), bodyIsArray(), responseTimeLt(500));

  sleep(randomInt(1, 3) * 0.1);

  logStep('GET /posts/' + postId);
  var single = get(buildUrl(BASE_URL, '/posts/' + postId), { tags: { name: 'get-post' } });
  runChecks(single, statusIs(200), bodyHasField('id'), bodyHasField('title'), responseTimeLt(500));

  sleep(randomInt(1, 3) * 0.1);

  logStep('POST /posts');
  var payload = buildPayload({
    title:  function() { return 'Load Test Post ' + randomString(6); },
    body:   function() { return 'Generated at ' + new Date().toISOString(); },
    userId: userId,
  });
  var created = post(buildUrl(BASE_URL, '/posts'), payload, { tags: { name: 'create-post' } });
  runChecks(created, statusIs(201), bodyHasField('id'), responseTimeLt(500));

  logStep('GET /posts/' + postId + '/comments');
  var comments = get(buildUrl(BASE_URL, '/posts/' + postId + '/comments'), { tags: { name: 'get-comments' } });
  runChecks(comments, statusIs(200), bodyIsArray(), responseTimeLt(500));

  sleep(randomInt(1, 5) * 0.1);
}

export function handleSummary(data) {
  return buildSummary(data, {
    testName: 'Load Test \u2014 JSONPlaceholder API',
    outputFile: 'k6/results/load-summary.json',
    htmlFile: 'k6-report/load.html',
  });
}
