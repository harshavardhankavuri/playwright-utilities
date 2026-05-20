/**
 * Batch / Parallel Requests Test — JSONPlaceholder API
 * Simulates a dashboard loading multiple resources in parallel.
 *
 * Run:  k6 run k6/tests/batch.test.js
 */

import { sleep } from 'k6';
import http from 'k6/http';
import { check } from 'k6';
import { buildUrl } from '../lib/http.js';
import { runChecks, statusIs, responseTimeLt } from '../lib/checks.js';
import { combine, p95lt, errorRateLt, allPassChecks } from '../lib/thresholds.js';
import { randomInt } from '../lib/data.js';
import { logStep, buildSummary } from '../lib/reporter.js';

var BASE_URL = __ENV.BASE_URL || 'https://jsonplaceholder.typicode.com';

export var options = {
  scenarios: {
    batch: {
      executor: 'ramping-vus',
      stages: [
        { duration: '20s', target: 5 },
        { duration: '1m',  target: 5 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: combine(p95lt(1000), errorRateLt(0.01), allPassChecks()),
};

export default function () {
  var userId = randomInt(1, 10);

  logStep('Dashboard parallel load');
  var responses = http.batch([
    ['GET', buildUrl(BASE_URL, '/posts',         { userId: userId }), null, { tags: { name: 'batch-posts' } }],
    ['GET', buildUrl(BASE_URL, '/todos',         { userId: userId }), null, { tags: { name: 'batch-todos' } }],
    ['GET', buildUrl(BASE_URL, '/albums',        { userId: userId }), null, { tags: { name: 'batch-albums' } }],
    ['GET', buildUrl(BASE_URL, '/users/' + userId),                   null, { tags: { name: 'batch-user' } }],
  ]);

  check(responses[0], { 'posts: status 200':  function(r) { return r.status === 200; } });
  check(responses[1], { 'todos: status 200':  function(r) { return r.status === 200; } });
  check(responses[2], { 'albums: status 200': function(r) { return r.status === 200; } });
  check(responses[3], { 'user: status 200':   function(r) { return r.status === 200; } });

  sleep(0.5);

  var postId = randomInt(1, 100);
  logStep('Post detail parallel load (post ' + postId + ')');
  var detail = http.batch([
    ['GET', buildUrl(BASE_URL, '/posts/' + postId),           null, { tags: { name: 'detail-post' } }],
    ['GET', buildUrl(BASE_URL, '/posts/' + postId + '/comments'), null, { tags: { name: 'detail-comments' } }],
  ]);

  check(detail[0], {
    'post detail: status 200': function(r) { return r.status === 200; },
    'post detail: has title':  function(r) { try { return !!r.json().title; } catch (e) { return false; } },
  });
  check(detail[1], {
    'comments: status 200': function(r) { return r.status === 200; },
    'comments: is array':   function(r) { try { return Array.isArray(r.json()); } catch (e) { return false; } },
  });

  sleep(randomInt(1, 3) * 0.2);
}

export function handleSummary(data) {
  return buildSummary(data, {
    testName: 'Batch / Parallel Requests Test \u2014 JSONPlaceholder API',
    outputFile: 'k6/results/batch-summary.json',
    htmlFile: 'k6-report/batch.html',
  });
}
