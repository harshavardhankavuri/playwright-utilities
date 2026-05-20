/**
 * Stress Test — JSONPlaceholder API
 * Ramps to 125% of MAX_VUS to find the breaking point.
 *
 * Run:  k6 run k6/tests/stress.test.js
 * Env:  MAX_VUS=200
 */

import { sleep } from 'k6';
import { get, post, buildUrl } from '../lib/http.js';
import { runChecks, statusIs, bodyIsArray, bodyHasField, responseTimeLt } from '../lib/checks.js';
import { combine, p95lt, p99lt, errorRateLt } from '../lib/thresholds.js';
import { randomInt, randomString, buildPayload } from '../lib/data.js';
import { buildSummary } from '../lib/reporter.js';

var BASE_URL = __ENV.BASE_URL || 'https://jsonplaceholder.typicode.com';
var MAX_VUS  = parseInt(__ENV.MAX_VUS || '100');

export var options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m',  target: Math.round(MAX_VUS * 0.1) },
        { duration: '1m',  target: Math.round(MAX_VUS * 0.25) },
        { duration: '1m',  target: Math.round(MAX_VUS * 0.5) },
        { duration: '1m',  target: Math.round(MAX_VUS * 0.75) },
        { duration: '2m',  target: MAX_VUS },
        { duration: '2m',  target: Math.round(MAX_VUS * 1.25) },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: combine(p95lt(2000), p99lt(5000), errorRateLt(0.1)),
};

export default function () {
  var postId = randomInt(1, 100);

  var posts = get(buildUrl(BASE_URL, '/posts'), { tags: { name: 'get-posts' } });
  runChecks(posts, statusIs(200), bodyIsArray(), responseTimeLt(2000));
  sleep(0.1);

  var single = get(buildUrl(BASE_URL, '/posts/' + postId), { tags: { name: 'get-post' } });
  runChecks(single, statusIs(200), bodyHasField('id'), responseTimeLt(2000));
  sleep(0.1);

  if (Math.random() < 0.3) {
    var payload = buildPayload({
      title:  function() { return 'Stress ' + randomString(4); },
      body:   'Stress test payload',
      userId: randomInt(1, 10),
    });
    var created = post(buildUrl(BASE_URL, '/posts'), payload, { tags: { name: 'create-post' } });
    runChecks(created, statusIs(201), responseTimeLt(2000));
  }

  sleep(randomInt(1, 3) * 0.1);
}

export function handleSummary(data) {
  return buildSummary(data, {
    testName: 'Stress Test \u2014 JSONPlaceholder API',
    outputFile: 'k6/results/stress-summary.json',
    htmlFile: 'k6-report/stress.html',
  });
}
