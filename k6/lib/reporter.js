/**
 * k6 Reporter — custom HTML + JSON + stdout summary.
 *
 * Each test's handleSummary() calls buildSummary() which produces:
 *   stdout              — coloured k6 text summary
 *   k6/results/*.json   — raw JSON metrics (for CI / Allure attachment)
 *   k6-report/*.html    — self-contained dark-themed HTML report
 *
 * Compatible with k6 v0.49 (ES2015 only — no spread, no optional chaining).
 */

import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// ─── Console helpers ─────────────────────────────────────────────────────────

export function logStep(name) {
  console.log('[' + new Date().toISOString() + '] \u25b6 ' + name);
}

export function logResult(name, passed) {
  console.log('  ' + (passed ? '\u2713 [PASS]' : '\u2717 [FAIL]') + ' ' + name);
}

export function logMetric(name, value, unit, threshold) {
  unit = unit || 'ms';
  var formatted = unit === '' ? value.toFixed(2) : (Math.round(value) + unit);
  var flag = threshold !== undefined ? (value > threshold ? ' \u26a0 OVER BUDGET' : ' \u2713') : '';
  console.log('  ' + (name + '                              ').slice(0, 30) + ' ' + formatted + flag);
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Build the handleSummary return value.
 *
 * @param {Object} data   k6 summary data
 * @param {{ testName?: string, outputFile?: string, htmlFile?: string }} opts
 */
export function buildSummary(data, opts) {
  opts = opts || {};
  var testName = opts.testName || 'k6 Load Test';

  var slug = testName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  var jsonFile = opts.outputFile || ('k6/results/' + slug + '.json');
  var htmlFile = opts.htmlFile  || ('k6-report/'  + slug + '.html');

  var summary = buildJsonSummary(data, testName);
  var result = { stdout: textSummary(data, { indent: '  ', enableColors: true }) };
  result[jsonFile] = JSON.stringify(summary, null, 2);
  result[htmlFile] = buildHtml(summary, data);
  return result;
}

// ─── JSON summary ─────────────────────────────────────────────────────────────

function buildJsonSummary(data, testName) {
  var m = data.metrics || {};

  function v(metric, key) {
    if (!metric || !metric.values) return undefined;
    return metric.values[key];
  }

  return {
    testName: testName,
    timestamp: new Date().toISOString(),
    metrics: {
      http_req_duration: {
        avg: v(m.http_req_duration, 'avg'),
        min: v(m.http_req_duration, 'min'),
        max: v(m.http_req_duration, 'max'),
        p50: v(m.http_req_duration, 'p(50)'),
        p90: v(m.http_req_duration, 'p(90)'),
        p95: v(m.http_req_duration, 'p(95)'),
        p99: v(m.http_req_duration, 'p(99)'),
      },
      http_req_failed: {
        rate:   v(m.http_req_failed, 'rate'),
        passes: v(m.http_req_failed, 'passes'),
        fails:  v(m.http_req_failed, 'fails'),
      },
      http_reqs: {
        count: v(m.http_reqs, 'count'),
        rate:  v(m.http_reqs, 'rate'),
      },
      checks: {
        rate:   v(m.checks, 'rate'),
        passes: v(m.checks, 'passes'),
        fails:  v(m.checks, 'fails'),
      },
    },
    thresholds: extractThresholds(data),
  };
}

function extractThresholds(data) {
  var results = [];
  var keys = Object.keys(data.metrics || {});
  for (var i = 0; i < keys.length; i++) {
    var metric = data.metrics[keys[i]];
    if (metric.thresholds) {
      var conds = Object.keys(metric.thresholds);
      for (var j = 0; j < conds.length; j++) {
        results.push({
          metric: keys[i],
          condition: conds[j],
          passed: metric.thresholds[conds[j]].ok !== false,
        });
      }
    }
  }
  return results;
}

// ─── HTML report ──────────────────────────────────────────────────────────────

function esc(str) {
  if (str === undefined || str === null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function ms(val) {
  if (val === undefined || val === null) return '<span class="na">n/a</span>';
  return Math.round(val) + ' ms';
}

function pct(val) {
  if (val === undefined || val === null) return '<span class="na">n/a</span>';
  return (val * 100).toFixed(2) + '%';
}

function num(val, decimals) {
  if (val === undefined || val === null) return '<span class="na">n/a</span>';
  return Number(val).toFixed(decimals !== undefined ? decimals : 2);
}

function badge(passed) {
  return passed
    ? '<span class="badge pass">\u2713 PASS</span>'
    : '<span class="badge fail">\u2717 FAIL</span>';
}

function warnCell(val, budget, display) {
  if (val === undefined || val === null) return '<span class="na">n/a</span>';
  return budget !== undefined && val > budget
    ? '<span class="warn">' + display + '</span>'
    : display;
}

function kpi(label, value, cls) {
  return '<div class="kpi' + (cls ? ' kpi-' + cls : '') + '">'
    + '<div class="kpi-val">' + value + '</div>'
    + '<div class="kpi-lbl">' + esc(label) + '</div>'
    + '</div>';
}

function thresholdRows(thresholds) {
  if (!thresholds || thresholds.length === 0) {
    return '<tr><td colspan="3" class="na">No thresholds defined</td></tr>';
  }
  var rows = '';
  for (var i = 0; i < thresholds.length; i++) {
    var t = thresholds[i];
    rows += '<tr>'
      + '<td class="mono">' + esc(t.metric) + '</td>'
      + '<td><code>' + esc(t.condition) + '</code></td>'
      + '<td>' + badge(t.passed) + '</td>'
      + '</tr>';
  }
  return rows;
}

function allMetricRows(data) {
  var metrics = data.metrics || {};
  var keys = Object.keys(metrics).sort();
  var rows = '';
  for (var i = 0; i < keys.length; i++) {
    var name = keys[i];
    var m = metrics[name];
    var vals = m.values || {};

    var displayVal = '';
    if (vals['avg'] !== undefined)  displayVal = 'avg=' + Number(vals['avg']).toFixed(2);
    else if (vals['rate'] !== undefined) displayVal = 'rate=' + Number(vals['rate']).toFixed(4);
    else if (vals['value'] !== undefined) displayVal = Number(vals['value']).toFixed(2);

    var p95 = vals['p(95)'] !== undefined ? (Math.round(vals['p(95)']) + ' ms') : '';
    var p99 = vals['p(99)'] !== undefined ? (Math.round(vals['p(99)']) + ' ms') : '';

    var tHtml = '';
    if (m.thresholds) {
      var conds = Object.keys(m.thresholds);
      for (var j = 0; j < conds.length; j++) {
        var ok = m.thresholds[conds[j]].ok !== false;
        tHtml += '<div class="t-' + (ok ? 'pass' : 'fail') + '">' + (ok ? '\u2713' : '\u2717') + ' ' + esc(conds[j]) + '</div>';
      }
    }

    rows += '<tr>'
      + '<td class="mono">' + esc(name) + '</td>'
      + '<td>' + esc(displayVal) + '</td>'
      + '<td>' + esc(p95) + '</td>'
      + '<td>' + esc(p99) + '</td>'
      + '<td>' + (tHtml || '<span class="na">\u2014</span>') + '</td>'
      + '</tr>';
  }
  return rows;
}

function buildHtml(s, data) {
  var dur = s.metrics.http_req_duration;
  var chk = s.metrics.checks;
  var req = s.metrics.http_reqs;
  var fail = s.metrics.http_req_failed;

  var allPassed = s.thresholds.every(function(t) { return t.passed; });
  var overallCls = allPassed ? 'pass' : 'fail';
  var overallTxt = allPassed ? 'PASS' : 'FAIL';

  var checksRate = chk.rate !== undefined ? (chk.rate * 100).toFixed(1) + '%' : 'n/a';
  var errorRate  = fail.rate !== undefined ? (fail.rate * 100).toFixed(2) + '%' : 'n/a';
  var errorCls   = fail.rate !== undefined && fail.rate > 0.01 ? 'warn' : 'good';
  var checksCls  = chk.rate !== undefined && chk.rate < 1 ? 'warn' : 'good';
  var p95Cls     = dur.p95 !== undefined && dur.p95 > 500 ? 'warn' : 'good';
  var p99Cls     = dur.p99 !== undefined && dur.p99 > 1000 ? 'warn' : 'good';

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n'
    + '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + '<title>' + esc(s.testName) + ' \u2014 k6 Report</title>\n'
    + '<style>' + CSS + '</style>\n</head>\n<body>\n'

    // Header
    + '<header><div class="hdr">'
    + '<div><h1>' + esc(s.testName) + '</h1>'
    + '<p class="sub">k6 Load Test Report &nbsp;\u00b7&nbsp; ' + esc(s.timestamp) + '</p></div>'
    + '<div class="overall ' + overallCls + '">' + overallTxt + '</div>'
    + '</div></header>\n<main>\n'

    // KPI row
    + '<div class="kpis">'
    + kpi('Total Requests',   req.count !== undefined ? String(req.count) : 'n/a', '')
    + kpi('Req / s',          req.rate  !== undefined ? num(req.rate) : 'n/a', '')
    + kpi('Checks Pass Rate', checksRate, checksCls)
    + kpi('Error Rate',       errorRate,  errorCls)
    + kpi('Avg Duration',     ms(dur.avg), '')
    + kpi('p95 Duration',     ms(dur.p95), p95Cls)
    + kpi('p99 Duration',     ms(dur.p99), p99Cls)
    + kpi('Max Duration',     ms(dur.max), '')
    + '</div>\n'

    // Response time breakdown
    + '<section class="card"><h2>Response Time Breakdown</h2>'
    + '<table><thead><tr><th>Metric</th><th>Min</th><th>Avg</th><th>p50</th><th>p90</th><th>p95</th><th>p99</th><th>Max</th></tr></thead>'
    + '<tbody><tr>'
    + '<td class="mono">http_req_duration</td>'
    + '<td>' + ms(dur.min) + '</td>'
    + '<td>' + ms(dur.avg) + '</td>'
    + '<td>' + ms(dur.p50) + '</td>'
    + '<td>' + ms(dur.p90) + '</td>'
    + '<td>' + warnCell(dur.p95, 500,  ms(dur.p95)) + '</td>'
    + '<td>' + warnCell(dur.p99, 1000, ms(dur.p99)) + '</td>'
    + '<td>' + ms(dur.max) + '</td>'
    + '</tr></tbody></table></section>\n'

    // Thresholds
    + '<section class="card"><h2>Thresholds</h2>'
    + '<table><thead><tr><th>Metric</th><th>Condition</th><th>Result</th></tr></thead>'
    + '<tbody>' + thresholdRows(s.thresholds) + '</tbody></table></section>\n'

    // Checks
    + '<section class="card"><h2>Checks</h2>'
    + '<table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>'
    + '<tr><td>Pass rate</td><td>' + pct(chk.rate) + '</td></tr>'
    + '<tr><td>Passed</td><td>' + (chk.passes !== undefined ? chk.passes : 'n/a') + '</td></tr>'
    + '<tr><td>Failed</td><td>' + (chk.fails > 0 ? '<span class="warn">' + chk.fails + '</span>' : (chk.fails !== undefined ? chk.fails : 'n/a')) + '</td></tr>'
    + '</tbody></table></section>\n'

    // All metrics
    + '<section class="card"><h2>All Metrics</h2>'
    + '<table><thead><tr><th>Metric</th><th>Value</th><th>p95</th><th>p99</th><th>Thresholds</th></tr></thead>'
    + '<tbody>' + allMetricRows(data) + '</tbody></table></section>\n'

    + '</main>\n'
    + '<footer><p>Generated by k6 &nbsp;\u00b7&nbsp; ' + esc(s.timestamp) + '</p></footer>\n'
    + '</body>\n</html>';
}

// ─── Embedded CSS ─────────────────────────────────────────────────────────────

var CSS = [
  ':root{--bg:#0f1117;--surf:#1a1d27;--surf2:#22263a;--bdr:#2e3250;',
  '--txt:#e2e8f0;--muted:#64748b;--pass:#22c55e;--fail:#ef4444;--warn:#f59e0b;',
  '--accent:#6366f1;--font:"Inter",system-ui,sans-serif}',
  '*{box-sizing:border-box;margin:0;padding:0}',
  'body{background:var(--bg);color:var(--txt);font-family:var(--font);font-size:14px;line-height:1.6}',
  'header{background:var(--surf);border-bottom:1px solid var(--bdr);padding:24px 32px}',
  '.hdr{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px}',
  'h1{font-size:22px;font-weight:700;color:#fff}',
  '.sub{color:var(--muted);font-size:12px;margin-top:4px}',
  '.overall{padding:10px 28px;border-radius:8px;font-size:18px;font-weight:800;letter-spacing:1px}',
  '.overall.pass{background:rgba(34,197,94,.15);color:var(--pass);border:2px solid var(--pass)}',
  '.overall.fail{background:rgba(239,68,68,.15);color:var(--fail);border:2px solid var(--fail)}',
  'main{max-width:1200px;margin:32px auto;padding:0 32px}',
  '.kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;margin-bottom:28px}',
  '.kpi{background:var(--surf);border:1px solid var(--bdr);border-radius:10px;padding:18px 14px;text-align:center}',
  '.kpi.kpi-warn{border-color:var(--warn)}.kpi.kpi-good{border-color:var(--pass)}',
  '.kpi-val{font-size:24px;font-weight:700;color:#fff;margin-bottom:5px}',
  '.kpi-lbl{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}',
  '.card{background:var(--surf);border:1px solid var(--bdr);border-radius:10px;padding:22px;margin-bottom:22px}',
  '.card h2{font-size:14px;font-weight:600;color:#fff;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--bdr)}',
  'table{width:100%;border-collapse:collapse}',
  'thead tr{background:var(--surf2)}',
  'th{text-align:left;padding:9px 13px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);font-weight:600;border-bottom:1px solid var(--bdr)}',
  'td{padding:9px 13px;border-bottom:1px solid var(--bdr);font-size:13px;vertical-align:top}',
  'tr:last-child td{border-bottom:none}',
  'tr:hover td{background:var(--surf2)}',
  '.mono{font-family:monospace;font-size:12px;color:var(--accent)}',
  '.badge{display:inline-block;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:700}',
  '.badge.pass{background:rgba(34,197,94,.15);color:var(--pass)}',
  '.badge.fail{background:rgba(239,68,68,.15);color:var(--fail)}',
  '.t-pass{font-size:12px;color:var(--pass);margin-bottom:2px}',
  '.t-fail{font-size:12px;color:var(--fail);margin-bottom:2px}',
  '.warn{color:var(--warn);font-weight:600}',
  '.na{color:var(--muted)}',
  'code{background:var(--surf2);padding:2px 6px;border-radius:4px;font-size:12px;font-family:monospace}',
  'footer{text-align:center;padding:22px;color:var(--muted);font-size:12px;border-top:1px solid var(--bdr);margin-top:12px}',
].join('');
