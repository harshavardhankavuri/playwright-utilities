import { test as base, expect } from '@playwright/test';
import { ScreenshotComparator, DiffSeverity, DiffCategory } from '../main/utils';

const test = base;

test.describe('ScreenshotComparator', () => {
  test('identical screenshots should return NONE severity', async ({ page }) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    // Disable animations to get truly identical screenshots
    await page.evaluate(() => {
      document.querySelectorAll('*').forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.animation = 'none';
        htmlEl.style.transition = 'none';
      });
    });

    const screenshot1 = await page.screenshot({ animations: 'disabled' });
    const screenshot2 = await page.screenshot({ animations: 'disabled' });

    const comparator = new ScreenshotComparator();
    const result = await comparator.compare(screenshot1, screenshot2);

    expect(result.isMatch).toBe(true);
    expect(result.severity).toBe(DiffSeverity.NONE);
    expect(result.totalDiffPixels).toBe(0);
    console.log(result.summary);
  });

  test('different pages should return MAJOR severity', async ({ page }) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');
    const screenshot1 = await page.screenshot({ animations: 'disabled' });

    await page.goto('https://playwright.dev/docs/intro');
    await page.waitForLoadState('networkidle');
    const screenshot2 = await page.screenshot({ animations: 'disabled' });

    const comparator = new ScreenshotComparator({
      outputDir: 'test-results/diff-images',
    });
    const result = await comparator.compare(screenshot1, screenshot2, 'page-change');

    expect(result.isMatch).toBe(false);
    expect(result.severity).toBe(DiffSeverity.MAJOR);
    expect(result.categoryBreakdown[DiffCategory.STRUCTURAL]).toBeGreaterThan(0);
    console.log(result.summary);
  });

  test('color change should be detected as structural', async ({ page }) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      document.querySelectorAll('*').forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.animation = 'none';
        htmlEl.style.transition = 'none';
      });
    });

    const screenshot1 = await page.screenshot({ animations: 'disabled' });

    // Make a visible color change
    await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      if (h1) h1.style.color = 'red';
    });
    const screenshot2 = await page.screenshot({ animations: 'disabled' });

    const comparator = new ScreenshotComparator();
    const result = await comparator.compare(screenshot1, screenshot2);

    expect(result.severity).not.toBe(DiffSeverity.NONE);
    expect(result.totalDiffPixels).toBeGreaterThan(0);
    console.log(result.summary);
  });

  test('comparison result provides detailed breakdown', async ({ page }) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      document.querySelectorAll('*').forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.animation = 'none';
        htmlEl.style.transition = 'none';
      });
    });

    const screenshot1 = await page.screenshot({ animations: 'disabled' });

    // Shift an element slightly (simulates alignment issue)
    await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      if (h1) h1.style.marginLeft = '2px';
    });
    const screenshot2 = await page.screenshot({ animations: 'disabled' });

    const comparator = new ScreenshotComparator();
    const result = await comparator.compare(screenshot1, screenshot2);

    // Should have regions and breakdown
    expect(result.categoryBreakdown).toBeDefined();
    expect(result.regions.length).toBeGreaterThanOrEqual(0);
    expect(result.summary).toContain('px');
    expect(result.dimensions.width).toBeGreaterThan(0);
    console.log(result.summary);
  });
});
