/**
 * CRUD Flow Test — JSONPlaceholder API
 * Full browse → read → create → update → delete user journey under load.
 *
 * Run:  k6 run k6/tests/crud.test.js
 */

import { sleep } from 'k6';
import { get, post, put, patch, del, buildUrl } from '../lib/http.js';
import { runChecks, statusIs, bodyHasField, bodyIsArray, bodyFieldEquals, responseTimeLt } from '../lib/checks.js';
import { combine, p95lt, errorRateLt, allPassChecks } from '../lib/thresholds.js';
import { randomInt, randomString, buildPayload } from '../lib/data.js';
import { logStep, buildSummary } from '../lib/reporter.js';

var BASE_URL = __ENV.BASE_URL || 'https://jsonplaceholder.typicode.com';

export var options = {
  scenarios: {
    crud: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m',  target: 10 },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: combine(p95lt(500), errorRateLt(0.01), allPassChecks()),
};

export default function () {
  var userId = randomInt(1, 10);
  var postId = randomInt(1, 100);

  logStep('Browse posts');
  var posts = get(buildUrl(BASE_URL, '/posts', { userId: userId }), { tags: { name: 'browse-posts' } });
  runChecks(posts, statusIs(200), bodyIsArray(), responseTimeLt(500));
  sleep(0.5);

  logStep('Read post ' + postId);
  var single = get(buildUrl(BASE_URL, '/posts/' + postId), { tags: { name: 'read-post' } });
  runChecks(single, statusIs(200), bodyHasField('id'), bodyHasField('title'), bodyHasField('body'), responseTimeLt(500));
  sleep(0.3);

  logStep('Read comments for post ' + postId);
  var comments = get(buildUrl(BASE_URL, '/posts/' + postId + '/comments'), { tags: { name: 'read-comments' } });
  runChecks(comments, statusIs(200), bodyIsArray(), responseTimeLt(500));
  sleep(0.5);

  logStep('Create post');
  var newPost = buildPayload({
    title:  function() { return 'Test Post ' + randomString(6); },
    body:   function() { return 'Created at ' + new Date().toISOString(); },
    userId: userId,
  });
  var created = post(buildUrl(BASE_URL, '/posts'), newPost, { tags: { name: 'create-post' } });
  runChecks(created, statusIs(201), bodyHasField('id'), bodyFieldEquals('userId', userId), responseTimeLt(500));
  sleep(0.3);

  logStep('Update post (PUT)');
  var putRes = put(buildUrl(BASE_URL, '/posts/' + postId), { id: postId, title: 'Updated ' + randomString(4), body: 'Updated body', userId: userId }, { tags: { name: 'update-post' } });
  runChecks(putRes, statusIs(200), bodyHasField('title'), responseTimeLt(500));
  sleep(0.2);

  logStep('Patch post');
  var patchRes = patch(buildUrl(BASE_URL, '/posts/' + postId), { title: 'Patched ' + randomString(4) }, { tags: { name: 'patch-post' } });
  runChecks(patchRes, statusIs(200), responseTimeLt(500));
  sleep(0.2);

  logStep('Delete post');
  var deleted = del(buildUrl(BASE_URL, '/posts/' + postId), { tags: { name: 'delete-post' } });
  runChecks(deleted, statusIs(200), responseTimeLt(500));

  sleep(randomInt(1, 5) * 0.1);
}

export function handleSummary(data) {
  return buildSummary(data, {
    testName: 'CRUD Flow Test \u2014 JSONPlaceholder API',
    outputFile: 'k6/results/crud-summary.json',
    htmlFile: 'k6-report/crud.html',
  });
}
