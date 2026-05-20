import { test, expect } from '@playwright/test';
import {
  PerformanceCollector,
  measurePagePerformance,
  assertMetric,
} from '../main/utils';

/**
 * Tests for PerformanceCollector and related helpers.
 * Uses playwright.dev as a stable public page.
 */
test.describe('Performance Helpers', () => {
  test('should collect navigation timing metrics', async ({ page }, testInfo) => {
    const collector = new PerformanceCollector(page);
    await collector.start();

    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    const entry = await collector.collectCurrentPage();

    // Navigation timing fields should be non-negative numbers
    expect(entry.navigation.ttfb).toBeGreaterThanOrEqual(0);
    expect(entry.navigation.pageLoad).toBeGreaterThan(0);
    expect(entry.navigation.domContentLoaded).toBeGreaterThan(0);
    expect(entry.navigation.domInteractive).toBeGreaterThan(0);
    expect(entry.navigation.resourceCount).toBeGreaterThan(0);
    expect(entry.navigation.url).toContain('playwright.dev');

    await collector.attach(testInfo);
  });

  test('should collect web vitals (FCP, LCP, CLS)', async ({ page }, testInfo) => {
    const collector = new PerformanceCollector(page);
    await collector.start();

    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');
    // Give observers a moment to fire
    await page.waitForTimeout(500);

    const entry = await collector.collectCurrentPage();

    // FCP and LCP should be available after a real navigation
    if (entry.vitals.fcp !== undefined) {
      expect(entry.vitals.fcp).toBeGreaterThan(0);
    }
    if (entry.vitals.lcp !== undefined) {
      expect(entry.vitals.lcp).toBeGreaterThan(0);
    }
    // CLS is always present (starts at 0)
    expect(entry.vitals.cls).toBeGreaterThanOrEqual(0);

    await collector.attach(testInfo);
  });

  test('should collect metrics across multiple page navigations', async ({ page }, testInfo) => {
    const collector = new PerformanceCollector(page);
    await collector.start();

    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');
    await collector.collectCurrentPage();

    await page.goto('https://playwright.dev/docs/intro');
    await page.waitForLoadState('networkidle');
    await collector.collectCurrentPage();

    const entries = collector.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].navigation.url).toContain('playwright.dev');
    expect(entries[1].navigation.url).toContain('docs/intro');

    await collector.attach(testInfo);
  });

  test('should detect budget violations', async ({ page }, testInfo) => {
    // Set an impossibly tight budget to force violations
    const collector = new PerformanceCollector(page, {
      budgets: { pageLoad: 1, ttfb: 1, fcp: 1, lcp: 1 },
      failOnViolation: false, // report only, don't throw
    });
    await collector.start();

    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    const entry = await collector.collectCurrentPage();

    // With a 1ms budget, at least pageLoad should be violated
    expect(entry.violations.length).toBeGreaterThan(0);
    expect(entry.violations[0]).toMatchObject({
      metric: expect.any(String),
      value: expect.any(Number),
      budget: expect.any(Number),
    });

    await collector.attach(testInfo);
  });

  test('should throw on budget violation when failOnViolation is true', async ({ page }, testInfo) => {
    const collector = new PerformanceCollector(page, {
      budgets: { pageLoad: 1 },
      failOnViolation: true,
    });
    await collector.start();

    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');
    await collector.collectCurrentPage();

    await expect(collector.attach(testInfo)).rejects.toThrow('Performance budget violations');
  });

  test('measurePagePerformance standalone helper', async ({ page }, testInfo) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    const entry = await measurePagePerformance(page, testInfo, {
      name: 'Playwright Homepage',
      failOnViolation: false,
    });

    expect(entry.navigation.pageLoad).toBeGreaterThan(0);
    expect(entry.navigation.url).toContain('playwright.dev');
  });

  test('assertMetric helper passes within budget', () => {
    expect(() => assertMetric('LCP', 1500, 2500, 'ms')).not.toThrow();
  });

  test('assertMetric helper throws when over budget', () => {
    expect(() => assertMetric('LCP', 4000, 2500, 'ms')).toThrow(
      'Performance assertion failed: LCP = 4000ms exceeds budget of 2500ms',
    );
  });

  test('assertMetric skips undefined values', () => {
    expect(() => assertMetric('FID', undefined, 100, 'ms')).not.toThrow();
  });
});
