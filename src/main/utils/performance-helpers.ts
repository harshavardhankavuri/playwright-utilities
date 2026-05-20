import { type Page, type TestInfo } from '@playwright/test';
import * as allure from 'allure-js-commons';

/**
 * Performance Helpers — Collect Web Vitals and Navigation Timing metrics
 * for every page navigated during a test.
 *
 * Metrics collected per navigation:
 *   Navigation Timing (from PerformanceNavigationTiming):
 *     - TTFB          Time To First Byte
 *     - DOM Content Loaded
 *     - Page Load Time (loadEventEnd)
 *     - DNS Lookup
 *     - TCP Connect
 *     - TLS Handshake
 *     - Request Time
 *     - Response Time
 *     - DOM Interactive
 *     - DOM Complete
 *
 *   Web Vitals (from PerformanceObserver):
 *     - LCP  Largest Contentful Paint
 *     - FID  First Input Delay  (if user interaction occurs)
 *     - CLS  Cumulative Layout Shift
 *     - FCP  First Contentful Paint
 *     - INP  Interaction to Next Paint
 *     - TTFB (from web-vitals observer, cross-checks nav timing)
 *
 * Reporting:
 *   - Allure: attaches a JSON attachment + a formatted text table per page
 *   - Playwright HTML: attaches via testInfo.attach() so it appears in the
 *     "Attachments" tab of every test in the built-in HTML report
 *   - Both reporters receive the same data — detection is automatic
 *
 * Usage (standalone):
 *   const perf = new PerformanceCollector(page);
 *   await perf.start();
 *   // ... navigate and interact ...
 *   const report = await perf.collect();
 *   await perf.attach(testInfo);
 *
 * Usage (as a Playwright fixture — recommended):
 *   // In your fixtures.ts:
 *   perf: async ({ page }, use, testInfo) => {
 *     const collector = new PerformanceCollector(page);
 *     await collector.start();
 *     await use(collector);
 *     await collector.attach(testInfo);
 *   }
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Raw Navigation Timing metrics for a single page load. */
export interface NavigationMetrics {
  /** URL that was navigated to */
  url: string;
  /** Page title at time of collection */
  title: string;
  /** Time To First Byte (ms) */
  ttfb: number;
  /** DNS lookup duration (ms) */
  dnsLookup: number;
  /** TCP connection duration (ms) */
  tcpConnect: number;
  /** TLS/SSL handshake duration (ms) — 0 for HTTP */
  tlsHandshake: number;
  /** Time from request start to first byte (ms) */
  requestTime: number;
  /** Time to receive the full response (ms) */
  responseTime: number;
  /** DOMContentLoaded event (ms from navigation start) */
  domContentLoaded: number;
  /** DOM became interactive (ms from navigation start) */
  domInteractive: number;
  /** DOM fully parsed (ms from navigation start) */
  domComplete: number;
  /** Full page load (loadEventEnd, ms from navigation start) */
  pageLoad: number;
  /** Number of resources loaded */
  resourceCount: number;
  /** Total transfer size of all resources (bytes) */
  totalTransferSize: number;
  /** Timestamp when this snapshot was taken */
  collectedAt: number;
}

/** Web Vitals collected via PerformanceObserver. */
export interface WebVitals {
  /** Largest Contentful Paint (ms) — target < 2500 */
  lcp?: number;
  /** First Contentful Paint (ms) — target < 1800 */
  fcp?: number;
  /** Cumulative Layout Shift (score) — target < 0.1 */
  cls?: number;
  /** First Input Delay (ms) — target < 100 */
  fid?: number;
  /** Interaction to Next Paint (ms) — target < 200 */
  inp?: number;
  /** TTFB from web-vitals observer (ms) — target < 800 */
  ttfb?: number;
}

/** Combined metrics for a single page. */
export interface PagePerformanceEntry {
  navigation: NavigationMetrics;
  vitals: WebVitals;
  /** Budget violations found for this page */
  violations: BudgetViolation[];
}

/** A single performance budget violation. */
export interface BudgetViolation {
  metric: string;
  value: number;
  budget: number;
  unit: string;
}

/** Performance budgets — tests fail (or warn) when exceeded. */
export interface PerformanceBudget {
  /** Max TTFB in ms. Default: 800 */
  ttfb?: number;
  /** Max FCP in ms. Default: 1800 */
  fcp?: number;
  /** Max LCP in ms. Default: 2500 */
  lcp?: number;
  /** Max CLS score. Default: 0.1 */
  cls?: number;
  /** Max FID in ms. Default: 100 */
  fid?: number;
  /** Max INP in ms. Default: 200 */
  inp?: number;
  /** Max full page load in ms. Default: 5000 */
  pageLoad?: number;
  /** Max DOM Content Loaded in ms. Default: 3000 */
  domContentLoaded?: number;
}

/** Options for PerformanceCollector. */
export interface PerformanceCollectorOptions {
  /**
   * Performance budgets. Violations are listed in the report.
   * Set to false to disable budget checking entirely.
   */
  budgets?: PerformanceBudget | false;
  /**
   * Whether to throw an error if any budget is violated.
   * Default: false (violations are reported but don't fail the test).
   */
  failOnViolation?: boolean;
  /**
   * Attachment name prefix in reports. Default: 'Performance'
   */
  attachmentName?: string;
}

const DEFAULT_BUDGETS: Required<PerformanceBudget> = {
  ttfb: 800,
  fcp: 1800,
  lcp: 2500,
  cls: 0.1,
  fid: 100,
  inp: 200,
  pageLoad: 5000,
  domContentLoaded: 3000,
};

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE COLLECTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PerformanceCollector — Automatically tracks UI performance metrics across
 * every page navigation in a test and attaches results to Allure and/or
 * the Playwright HTML report.
 */
export class PerformanceCollector {
  private readonly page: Page;
  private readonly options: PerformanceCollectorOptions;
  private readonly entries: PagePerformanceEntry[] = [];
  private isStarted = false;

  constructor(page: Page, options: PerformanceCollectorOptions = {}) {
    this.page = page;
    this.options = options;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  /**
   * Start collecting. Injects the Web Vitals observer script into every
   * page load so vitals are available when collect() is called.
   *
   * Call this before any navigation (e.g. in beforeEach or fixture setup).
   */
  async start(): Promise<void> {
    if (this.isStarted) return;

    // Inject the Web Vitals observer on every navigation
    await this.page.addInitScript(() => {
      (window as any).__perfVitals = { lcp: undefined, fcp: undefined, cls: 0, fid: undefined, inp: undefined, ttfb: undefined };

      try {
        // LCP
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1] as any;
          if (last) (window as any).__perfVitals.lcp = last.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        // FCP
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              (window as any).__perfVitals.fcp = entry.startTime;
            }
          }
        }).observe({ type: 'paint', buffered: true });

        // CLS — accumulate all layout shift scores
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const ls = entry as any;
            if (!ls.hadRecentInput) {
              (window as any).__perfVitals.cls = ((window as any).__perfVitals.cls ?? 0) + (ls.value ?? 0);
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });

        // FID
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const fi = entry as any;
            (window as any).__perfVitals.fid = fi.processingStart - fi.startTime;
          }
        }).observe({ type: 'first-input', buffered: true });

        // INP
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const ie = entry as any;
            const duration = ie.processingEnd - ie.startTime;
            const current = (window as any).__perfVitals.inp ?? 0;
            if (duration > current) (window as any).__perfVitals.inp = duration;
          }
        }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as any);

        // TTFB via navigation timing
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const nav = entry as PerformanceNavigationTiming;
            (window as any).__perfVitals.ttfb = nav.responseStart - nav.requestStart;
          }
        }).observe({ type: 'navigation', buffered: true });

      } catch {
        // PerformanceObserver not available in this context — skip silently
      }
    });

    this.isStarted = true;
  }

  /**
   * Collect metrics for the current page state.
   * Call this after a navigation completes and the page has settled.
   *
   * Automatically called by attach() if you haven't called it manually.
   */
  async collectCurrentPage(): Promise<PagePerformanceEntry> {
    const [nav, vitals] = await Promise.all([
      this.collectNavigationTiming(),
      this.collectWebVitals(),
    ]);

    const budgets = this.options.budgets !== false
      ? { ...DEFAULT_BUDGETS, ...(this.options.budgets ?? {}) }
      : null;

    const violations = budgets ? this.checkBudgets(nav, vitals, budgets) : [];

    const entry: PagePerformanceEntry = { navigation: nav, vitals, violations };
    this.entries.push(entry);
    return entry;
  }

  /**
   * Return all collected entries so far.
   */
  getEntries(): PagePerformanceEntry[] {
    return [...this.entries];
  }

  // ─── Reporting ──────────────────────────────────────────────────────────

  /**
   * Attach all collected metrics to both Allure and the Playwright HTML report.
   *
   * - Allure: JSON attachment + formatted text table (if allure-playwright is active)
   * - Playwright HTML: binary attachment visible in the "Attachments" tab
   *
   * Call this in afterEach / fixture teardown.
   */
  async attach(testInfo: TestInfo): Promise<void> {
    // Collect the current page if nothing has been collected yet
    if (this.entries.length === 0) {
      try {
        await this.collectCurrentPage();
      } catch {
        // Page may have been closed — skip
      }
    }

    if (this.entries.length === 0) return;

    const name = this.options.attachmentName ?? 'Performance Metrics';
    const jsonContent = JSON.stringify(this.buildReport(), null, 2);
    const tableContent = this.buildTextTable();

    // ── Playwright HTML report ──────────────────────────────────────────
    // testInfo.attach() puts the file in the "Attachments" tab of the
    // built-in HTML report regardless of which other reporters are active.
    await testInfo.attach(`${name} (JSON)`, {
      body: Buffer.from(jsonContent),
      contentType: 'application/json',
    });
    await testInfo.attach(`${name} (Summary)`, {
      body: Buffer.from(tableContent),
      contentType: 'text/plain',
    });

    // ── Allure report ───────────────────────────────────────────────────
    // allure-js-commons throws if called outside an Allure context, so we
    // guard with a try/catch. When allure-playwright is not configured the
    // data is still available via the Playwright attachment above.
    try {
      await allure.attachment(`${name} (JSON)`, jsonContent, 'application/json');
      await allure.attachment(`${name} (Summary)`, tableContent, 'text/plain');
    } catch {
      // Allure not configured — Playwright attachment is sufficient
    }

    // Throw if any budget violations found and failOnViolation is set
    if (this.options.failOnViolation) {
      const allViolations = this.entries.flatMap((e) => e.violations);
      if (allViolations.length > 0) {
        const lines = allViolations.map(
          (v) => `  ${v.metric}: ${fmt(v.value, v.unit)} > budget ${fmt(v.budget, v.unit)}`,
        );
        throw new Error(`Performance budget violations:\n${lines.join('\n')}`);
      }
    }
  }

  // ─── Internal: Metric Collection ────────────────────────────────────────

  private async collectNavigationTiming(): Promise<NavigationMetrics> {
    return this.page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

      const totalTransferSize = resources.reduce((sum, r) => sum + (r.transferSize ?? 0), 0);

      if (!nav) {
        // Fallback for pages where navigation timing isn't available
        return {
          url: location.href,
          title: document.title,
          ttfb: 0,
          dnsLookup: 0,
          tcpConnect: 0,
          tlsHandshake: 0,
          requestTime: 0,
          responseTime: 0,
          domContentLoaded: 0,
          domInteractive: 0,
          domComplete: 0,
          pageLoad: 0,
          resourceCount: resources.length,
          totalTransferSize,
          collectedAt: Date.now(),
        };
      }

      return {
        url: nav.name || location.href,
        title: document.title,
        ttfb: Math.round(nav.responseStart - nav.requestStart),
        dnsLookup: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
        tcpConnect: Math.round(nav.connectEnd - nav.connectStart),
        tlsHandshake: nav.secureConnectionStart > 0
          ? Math.round(nav.connectEnd - nav.secureConnectionStart)
          : 0,
        requestTime: Math.round(nav.responseStart - nav.requestStart),
        responseTime: Math.round(nav.responseEnd - nav.responseStart),
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
        domInteractive: Math.round(nav.domInteractive - nav.startTime),
        domComplete: Math.round(nav.domComplete - nav.startTime),
        pageLoad: Math.round(nav.loadEventEnd - nav.startTime),
        resourceCount: resources.length,
        totalTransferSize,
        collectedAt: Date.now(),
      };
    });
  }

  private async collectWebVitals(): Promise<WebVitals> {
    return this.page.evaluate(() => {
      const v = (window as any).__perfVitals ?? {};
      return {
        lcp: v.lcp !== undefined ? Math.round(v.lcp) : undefined,
        fcp: v.fcp !== undefined ? Math.round(v.fcp) : undefined,
        cls: v.cls !== undefined ? parseFloat(v.cls.toFixed(4)) : undefined,
        fid: v.fid !== undefined ? Math.round(v.fid) : undefined,
        inp: v.inp !== undefined ? Math.round(v.inp) : undefined,
        ttfb: v.ttfb !== undefined ? Math.round(v.ttfb) : undefined,
      };
    });
  }

  // ─── Internal: Budget Checking ───────────────────────────────────────────

  private checkBudgets(
    nav: NavigationMetrics,
    vitals: WebVitals,
    budgets: Required<PerformanceBudget>,
  ): BudgetViolation[] {
    const violations: BudgetViolation[] = [];

    const check = (metric: string, value: number | undefined, budget: number, unit: string) => {
      if (value !== undefined && value > budget) {
        violations.push({ metric, value, budget, unit });
      }
    };

    check('TTFB', nav.ttfb, budgets.ttfb, 'ms');
    check('Page Load', nav.pageLoad, budgets.pageLoad, 'ms');
    check('DOM Content Loaded', nav.domContentLoaded, budgets.domContentLoaded, 'ms');
    check('FCP', vitals.fcp, budgets.fcp, 'ms');
    check('LCP', vitals.lcp, budgets.lcp, 'ms');
    check('CLS', vitals.cls, budgets.cls, '');
    check('FID', vitals.fid, budgets.fid, 'ms');
    check('INP', vitals.inp, budgets.inp, 'ms');

    return violations;
  }

  // ─── Internal: Report Building ───────────────────────────────────────────

  private buildReport(): object {
    return {
      collectedAt: new Date().toISOString(),
      pageCount: this.entries.length,
      pages: this.entries.map((e) => ({
        url: e.navigation.url,
        title: e.navigation.title,
        navigationTiming: {
          ttfb_ms: e.navigation.ttfb,
          dnsLookup_ms: e.navigation.dnsLookup,
          tcpConnect_ms: e.navigation.tcpConnect,
          tlsHandshake_ms: e.navigation.tlsHandshake,
          requestTime_ms: e.navigation.requestTime,
          responseTime_ms: e.navigation.responseTime,
          domInteractive_ms: e.navigation.domInteractive,
          domContentLoaded_ms: e.navigation.domContentLoaded,
          domComplete_ms: e.navigation.domComplete,
          pageLoad_ms: e.navigation.pageLoad,
          resourceCount: e.navigation.resourceCount,
          totalTransferSize_bytes: e.navigation.totalTransferSize,
        },
        webVitals: {
          LCP_ms: e.vitals.lcp,
          FCP_ms: e.vitals.fcp,
          CLS: e.vitals.cls,
          FID_ms: e.vitals.fid,
          INP_ms: e.vitals.inp,
          TTFB_ms: e.vitals.ttfb,
        },
        budgetViolations: e.violations,
      })),
    };
  }

  private buildTextTable(): string {
    const lines: string[] = [];
    const sep = '─'.repeat(80);

    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║                        UI PERFORMANCE METRICS                               ║');
    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');
    lines.push('');

    for (let i = 0; i < this.entries.length; i++) {
      const { navigation: n, vitals: v, violations } = this.entries[i];

      lines.push(`Page ${i + 1}: ${n.title || '(no title)'}`);
      lines.push(`URL:  ${n.url}`);
      lines.push(sep);

      lines.push('  NAVIGATION TIMING');
      lines.push(row('  TTFB',                 n.ttfb,              'ms',  800));
      lines.push(row('  DNS Lookup',            n.dnsLookup,         'ms'));
      lines.push(row('  TCP Connect',           n.tcpConnect,        'ms'));
      lines.push(row('  TLS Handshake',         n.tlsHandshake,      'ms'));
      lines.push(row('  Request Time',          n.requestTime,       'ms'));
      lines.push(row('  Response Time',         n.responseTime,      'ms'));
      lines.push(row('  DOM Interactive',       n.domInteractive,    'ms', 3000));
      lines.push(row('  DOM Content Loaded',    n.domContentLoaded,  'ms', 3000));
      lines.push(row('  DOM Complete',          n.domComplete,       'ms'));
      lines.push(row('  Page Load',             n.pageLoad,          'ms', 5000));
      lines.push(`  Resources: ${n.resourceCount}  |  Transfer: ${formatBytes(n.totalTransferSize)}`);
      lines.push('');

      lines.push('  WEB VITALS');
      lines.push(vitalRow('  LCP  (Largest Contentful Paint)',  v.lcp,  'ms',  2500));
      lines.push(vitalRow('  FCP  (First Contentful Paint)',    v.fcp,  'ms',  1800));
      lines.push(vitalRow('  CLS  (Cumulative Layout Shift)',   v.cls,  '',    0.1,  true));
      lines.push(vitalRow('  FID  (First Input Delay)',         v.fid,  'ms',  100));
      lines.push(vitalRow('  INP  (Interaction to Next Paint)', v.inp,  'ms',  200));
      lines.push(vitalRow('  TTFB (Time to First Byte)',        v.ttfb, 'ms',  800));
      lines.push('');

      if (violations.length > 0) {
        lines.push('  ⚠  BUDGET VIOLATIONS');
        for (const viol of violations) {
          lines.push(`     ✗ ${viol.metric}: ${fmt(viol.value, viol.unit)} (budget: ${fmt(viol.budget, viol.unit)})`);
        }
        lines.push('');
      } else {
        lines.push('  ✓ All budgets passed');
        lines.push('');
      }

      if (i < this.entries.length - 1) lines.push(sep);
    }

    return lines.join('\n');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STANDALONE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collect performance metrics for the current page and attach to the report.
 * Convenience wrapper for one-off measurements without a full collector.
 *
 * Usage:
 *   await page.goto('/dashboard');
 *   await measurePagePerformance(page, testInfo, { name: 'Dashboard' });
 */
export async function measurePagePerformance(
  page: Page,
  testInfo: TestInfo,
  options?: { name?: string; budgets?: PerformanceBudget | false; failOnViolation?: boolean },
): Promise<PagePerformanceEntry> {
  const collector = new PerformanceCollector(page, {
    budgets: options?.budgets,
    failOnViolation: options?.failOnViolation,
    attachmentName: options?.name ?? 'Performance Metrics',
  });
  const entry = await collector.collectCurrentPage();
  await collector.attach(testInfo);
  return entry;
}

/**
 * Assert a specific metric is within a threshold.
 * Throws with a clear message if the value exceeds the budget.
 *
 * Usage:
 *   const entry = await collector.collectCurrentPage();
 *   assertMetric('LCP', entry.vitals.lcp, 2500, 'ms');
 */
export function assertMetric(
  name: string,
  value: number | undefined,
  budget: number,
  unit: string = 'ms',
): void {
  if (value === undefined) return; // Metric not available — skip
  if (value > budget) {
    throw new Error(
      `Performance assertion failed: ${name} = ${fmt(value, unit)} exceeds budget of ${fmt(budget, unit)}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTING HELPERS (internal)
// ─────────────────────────────────────────────────────────────────────────────

function fmt(value: number, unit: string): string {
  if (unit === '') return value.toFixed(4); // CLS score
  return `${value}${unit}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function row(label: string, value: number, unit: string, budget?: number): string {
  const padded = label.padEnd(28);
  const val = `${value}${unit}`.padStart(10);
  const flag = budget !== undefined && value > budget ? '  ⚠' : '';
  return `${padded} ${val}${flag}`;
}

function vitalRow(
  label: string,
  value: number | undefined,
  unit: string,
  budget: number,
  isCls = false,
): string {
  const padded = label.padEnd(38);
  if (value === undefined) return `${padded}  n/a`;
  const display = isCls ? value.toFixed(4) : `${value}${unit}`;
  const flag = value > budget ? '  ⚠' : '  ✓';
  return `${padded} ${display.padStart(10)}${flag}`;
}
