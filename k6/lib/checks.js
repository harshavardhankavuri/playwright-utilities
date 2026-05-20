/**
 * k6 Check Utilities — composable check builders.
 * Compatible with k6 v0.49 (ES2015 only).
 */

import { check } from 'k6';

function getNestedField(obj, fieldPath) {
  var parts = fieldPath.split('.');
  var value = obj;
  for (var i = 0; i < parts.length; i++) {
    if (value == null) return undefined;
    value = value[parts[i]];
  }
  return value;
}

function safeJson(r) {
  try { return r.json(); } catch (e) { return null; }
}

export function statusIs(expected) {
  return { ['status is ' + expected]: function(r) { return r.status === expected; } };
}

export function statusOk() {
  return { 'status is 2xx': function(r) { return r.status >= 200 && r.status < 300; } };
}

export function statusClientError() {
  return { 'status is 4xx': function(r) { return r.status >= 400 && r.status < 500; } };
}

export function responseTimeLt(maxMs) {
  return { ['response time < ' + maxMs + 'ms']: function(r) { return r.timings.duration < maxMs; } };
}

export function bodyNotEmpty() {
  return { 'body is not empty': function(r) { return r.body && r.body.length > 0; } };
}

export function bodyContains(substring) {
  return { ['body contains "' + substring + '"']: function(r) { return r.body && r.body.includes(substring); } };
}

export function bodyHasField(fieldPath) {
  return {
    ['body has field "' + fieldPath + '"']: function(r) {
      var body = safeJson(r);
      if (!body) return false;
      var value = getNestedField(body, fieldPath);
      return value !== undefined && value !== null;
    },
  };
}

export function bodyFieldEquals(fieldPath, expected) {
  return {
    ['body.' + fieldPath + ' === ' + JSON.stringify(expected)]: function(r) {
      var body = safeJson(r);
      if (!body) return false;
      return JSON.stringify(getNestedField(body, fieldPath)) === JSON.stringify(expected);
    },
  };
}

export function bodyIsArray() {
  return { 'body is array': function(r) { var b = safeJson(r); return Array.isArray(b); } };
}

export function bodyArrayMinLength(minLength) {
  return {
    ['body array length >= ' + minLength]: function(r) {
      var b = safeJson(r);
      return Array.isArray(b) && b.length >= minLength;
    },
  };
}

export function hasHeader(headerName) {
  return {
    ['has header "' + headerName + '"']: function(r) {
      return Object.keys(r.headers).some(function(h) { return h.toLowerCase() === headerName.toLowerCase(); });
    },
  };
}

export function headerContains(headerName, substring) {
  return {
    ['header "' + headerName + '" contains "' + substring + '"']: function(r) {
      var key = Object.keys(r.headers).find(function(h) { return h.toLowerCase() === headerName.toLowerCase(); });
      return key ? r.headers[key].includes(substring) : false;
    },
  };
}

// Run multiple check objects against a response
export function runChecks(res) {
  var checkObjects = Array.prototype.slice.call(arguments, 1);
  var merged = Object.assign.apply(Object, [{}].concat(checkObjects));
  return check(res, merged);
}

// Merge check objects without running them
export function allChecks() {
  var checkObjects = Array.prototype.slice.call(arguments);
  return Object.assign.apply(Object, [{}].concat(checkObjects));
}
