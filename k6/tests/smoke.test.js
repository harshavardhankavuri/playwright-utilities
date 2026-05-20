/**
 * Smoke Test — JSONPlaceholder API
 * 1 VU, 1 iteration — verify the API is reachable and returns correct responses.
 *
 * Run:  k6 run k6/tests/smoke.test.js
 */

import { sleep } from 'k6';
import { get, post, put, patch, del, buildUrl } from '../lib/http.js';
import { runChecks, statusIs, bodyHasField, bodyIsArray, responseTimeLt } from '../lib/checks.js';
import { combine, p95lt, errorRateLt, allPassChecks } from '../lib/thresholds.js';
import { buildSummary } from '../lib/reporter.js';

var BASE_URL = __ENV.BASE_URL || 'https://jsonplaceholder.typicode.com';

export var options = {
  scenarios: {
    smoke: { executor: 'per-vu-iterations', vus: 1, iterations: 1 },
  },
  thresholds: combine(p95lt(2000), errorRateLt(0.001), allPassChecks()),
};

export default function () {
  var posts = get(buildUrl(BASE_URL, '/posts'), { tags: { name: 'get-posts' } });
  runChecks(posts, statusIs(200), bodyIsArray(), responseTimeLt(2000));

  var post1 = get(buildUrl(BASE_URL, '/posts/1'), { tags: { name: 'get-post' } });
  runChecks(post1, statusIs(200), bodyHasField('id'), bodyHasField('title'), bodyHasField('body'), bodyHasField('userId'), responseTimeLt(2000));

  var created = post(buildUrl(BASE_URL, '/posts'), { title: 'Smoke Test', body: 'Testing', userId: 1 }, { tags: { name: 'create-post' } });
  runChecks(created, statusIs(201), bodyHasField('id'), responseTimeLt(2000));

  var updated = put(buildUrl(BASE_URL, '/posts/1'), { id: 1, title: 'Updated', body: 'Updated body', userId: 1 }, { tags: { name: 'update-post' } });
  runChecks(updated, statusIs(200), bodyHasField('title'), responseTimeLt(2000));

  var patched = patch(buildUrl(BASE_URL, '/posts/1'), { title: 'Patched' }, { tags: { name: 'patch-post' } });
  runChecks(patched, statusIs(200), responseTimeLt(2000));

  var deleted = del(buildUrl(BASE_URL, '/posts/1'), { tags: { name: 'delete-post' } });
  runChecks(deleted, statusIs(200), responseTimeLt(2000));

  var users = get(buildUrl(BASE_URL, '/users'), { tags: { name: 'get-users' } });
  runChecks(users, statusIs(200), bodyIsArray(), responseTimeLt(2000));

  sleep(0.5);
}

export function handleSummary(data) {
  return buildSummary(data, {
    testName: 'Smoke Test \u2014 JSONPlaceholder API',
    outputFile: 'k6/results/smoke-summary.json',
    htmlFile: 'k6-report/smoke.html',
  });
}
