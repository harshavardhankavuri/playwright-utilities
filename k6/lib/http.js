/**
 * k6 HTTP Utilities
 * Wrappers around k6's http module with JSON handling, auth injection,
 * and response helpers. Compatible with k6 v0.49 (ES2015 only).
 */

import http from 'k6/http';
import { check } from 'k6';

var DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

export function buildUrl(base, path, params) {
  var url = base.replace(/\/$/, '') + path;
  if (!params || Object.keys(params).length === 0) return url;
  var qs = Object.keys(params)
    .map(function(k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
    .join('&');
  return url + '?' + qs;
}

export function mergeHeaders(clientHeaders, requestHeaders, bearerToken) {
  var headers = Object.assign({}, DEFAULT_HEADERS, clientHeaders || {}, requestHeaders || {});
  if (bearerToken) headers['Authorization'] = 'Bearer ' + bearerToken;
  return headers;
}

export function parseJson(res) {
  try { return res.json(); } catch (e) { return null; }
}

export function expectStatus(res, expectedStatus, label) {
  var name = label || ('status is ' + expectedStatus);
  check(res, { [name]: function(r) { return r.status === expectedStatus; } });
  return res;
}

export function expectOk(res, label) {
  check(res, { [label || 'status is 2xx']: function(r) { return r.status >= 200 && r.status < 300; } });
  return res;
}

export function expectFasterThan(res, maxMs, label) {
  check(res, { [label || ('response time < ' + maxMs + 'ms')]: function(r) { return r.timings.duration < maxMs; } });
  return res;
}

export function get(url, options) {
  options = options || {};
  var headers = mergeHeaders({}, options.headers, options.bearerToken);
  return http.get(url, { headers: headers, tags: options.tags });
}

export function post(url, body, options) {
  options = options || {};
  var headers = mergeHeaders({}, options.headers, options.bearerToken);
  return http.post(url, JSON.stringify(body), { headers: headers, tags: options.tags });
}

export function put(url, body, options) {
  options = options || {};
  var headers = mergeHeaders({}, options.headers, options.bearerToken);
  return http.put(url, JSON.stringify(body), { headers: headers, tags: options.tags });
}

export function patch(url, body, options) {
  options = options || {};
  var headers = mergeHeaders({}, options.headers, options.bearerToken);
  return http.patch(url, JSON.stringify(body), { headers: headers, tags: options.tags });
}

export function del(url, options) {
  options = options || {};
  var headers = mergeHeaders({}, options.headers, options.bearerToken);
  return http.del(url, null, { headers: headers, tags: options.tags });
}
