/**
 * k6 Threshold Utilities — pre-built SLA threshold configs.
 * Compatible with k6 v0.49 (ES2015 only).
 */

export function p95lt(maxMs)  { return { http_req_duration: ['p(95)<' + maxMs] }; }
export function p99lt(maxMs)  { return { http_req_duration: ['p(99)<' + maxMs] }; }
export function p50lt(maxMs)  { return { http_req_duration: ['p(50)<' + maxMs] }; }
export function avgLt(maxMs)  { return { http_req_duration: ['avg<' + maxMs] }; }
export function maxLt(maxMs)  { return { http_req_duration: ['max<' + maxMs] }; }

export function durationThresholds(targets) {
  var conditions = [];
  if (targets.p50 !== undefined) conditions.push('p(50)<' + targets.p50);
  if (targets.p95 !== undefined) conditions.push('p(95)<' + targets.p95);
  if (targets.p99 !== undefined) conditions.push('p(99)<' + targets.p99);
  if (targets.avg !== undefined) conditions.push('avg<' + targets.avg);
  if (targets.max !== undefined) conditions.push('max<' + targets.max);
  return { http_req_duration: conditions };
}

export function errorRateLt(rate)    { return { http_req_failed: ['rate<' + rate] }; }
export function checkFailRateLt(rate){ return { checks: ['rate>' + (1 - rate)] }; }
export function allPassChecks()      { return { checks: ['rate==1.0'] }; }
export function rpsAbove(minRps)     { return { http_reqs: ['rate>' + minRps] }; }

export function taggedP95lt(tagName, maxMs) {
  return { ['http_req_duration{name:' + tagName + '}']: ['p(95)<' + maxMs] };
}

// Merge multiple threshold objects — arrays for the same key are concatenated
export function combine() {
  var objs = Array.prototype.slice.call(arguments);
  var result = {};
  for (var i = 0; i < objs.length; i++) {
    var keys = Object.keys(objs[i]);
    for (var j = 0; j < keys.length; j++) {
      var key = keys[j];
      var val = objs[i][key];
      var arr = Array.isArray(val) ? val : [val];
      result[key] = result[key] ? result[key].concat(arr) : arr.slice();
    }
  }
  return result;
}

// Preset SLA bundles
export function standardApiSla() { return combine(p95lt(500), p99lt(1000), errorRateLt(0.01), allPassChecks()); }
export function strictApiSla()   { return combine(p95lt(200), p99lt(500),  errorRateLt(0.001), allPassChecks()); }
export function relaxedSla()     { return combine(p95lt(2000), errorRateLt(0.05)); }
