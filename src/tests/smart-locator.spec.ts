import { test as base, expect } from '@playwright/test';
import { SmartLocator } from '../main/utils';
import * as fs from 'fs';
import * as path from 'path';

const test = base;

const LOCATOR_STORE = path.resolve('test-results', 'test-locators-' + process.pid);

test.describe('SmartLocator', () => {
  test.beforeAll(() => {
    if (fs.existsSync(LOCATOR_STORE)) {
      fs.rmSync(LOCATOR_STORE, { recursive: true });
    }
  });

  test('should register an element and store multiple strategies', async ({ page }) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    const smart = new SmartLocator(page, { storeDir: LOCATOR_STORE, verbose: false });
    const link = page.getByRole('link', { name: 'Get started' });

    const fingerprint = await smart.register('get-started', link);

    expect(fingerprint.name).toBe('get-started');
    expect(fingerprint.strategies.length).toBeGreaterThan(2);
    expect(fingerprint.updatedAt).toBeGreaterThan(0);

    // Should have at least role and text strategies
    const types = fingerprint.strategies.map((s) => s.type);
    expect(types).toContain('role');
  });

  test('should find element using primary strategy', async ({ page }) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    const smart = new SmartLocator(page, { storeDir: LOCATOR_STORE, verbose: false });
    const link = page.getByRole('link', { name: 'Get started' });

    await smart.register('get-started-find', link);

    const result = await smart.find('get-started-find');

    expect(result.found).toBe(true);
    expect(result.healed).toBe(false);
    expect(result.strategyIndex).toBe(0);
    expect(result.locator).toBeDefined();
  });

  test('should return locate() shorthand as a Locator', async ({ page }) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    const smart = new SmartLocator(page, { storeDir: LOCATOR_STORE, verbose: false });
    const heading = page.getByRole('heading', { name: 'Playwright enables reliable' });

    await smart.register('main-heading', heading);

    const locator = await smart.locate('main-heading');
    await expect(locator).toBeVisible();
  });

  test('should heal when primary strategy fails by using fallback', async ({ page }) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    const smart = new SmartLocator(page, {
      storeDir: LOCATOR_STORE,
      verbose: false,
      autoUpdate: false,
    });

    // Register the Get Started link
    const link = page.getByRole('link', { name: 'Get started' });
    const fingerprint = await smart.register('heal-test', link);

    // Corrupt the primary strategy so it won't match. Mark it as 'auto' so the
    // value is actually used to construct a Locator (user strategies use the
    // live cached Locator instead of the value).
    fingerprint.strategies[0] = {
      type: 'css',
      value: '#non-existent-element-xyz',
      weight: 99,
      source: 'auto',
    };

    // The find should heal by falling back to a working strategy
    const result = await smart.find('heal-test');

    expect(result.found).toBe(true);
    expect(result.healed).toBe(true);
    expect(result.strategyIndex).toBeGreaterThan(0);
    expect(result.summary).toContain('HEALED');
  });

  test('should return not found when no strategy works', async ({ page }) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    const smart = new SmartLocator(page, {
      storeDir: LOCATOR_STORE,
      verbose: false,
      strategyTimeout: 1000,
    });

    // Register with only broken strategies — using 'auto' source so they're
    // reconstructed from the strategy descriptor (no live Locator needed).
    smart['fingerprints'].set('broken-element', {
      name: 'broken-element',
      strategies: [
        { type: 'css', value: '#does-not-exist-1', weight: 90, source: 'auto' },
        { type: 'css', value: '#does-not-exist-2', weight: 80, source: 'auto' },
      ],
      updatedAt: Date.now(),
    });

    const result = await smart.find('broken-element');

    expect(result.found).toBe(false);
    expect(result.healed).toBe(false);
    expect(result.strategyIndex).toBe(-1);
    expect(result.triedStrategies).toHaveLength(2);
    expect(result.summary).toContain('not found');
  });

  test('should throw from locate() when element not found', async ({ page }) => {
    await page.goto('https://playwright.dev');

    const smart = new SmartLocator(page, {
      storeDir: LOCATOR_STORE,
      verbose: false,
      strategyTimeout: 1000,
    });

    // No fingerprint registered for this name
    let errorThrown = false;
    try {
      await smart.locate('unregistered-element');
    } catch (err: any) {
      errorThrown = true;
      expect(err.message).toContain('No fingerprint stored');
    }
    expect(errorThrown).toBe(true);
  });

  test('should persist fingerprints to disk and reload', async ({ page }) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    const storeDir = path.join(LOCATOR_STORE, 'persist-test');

    // Register with first instance
    const smart1 = new SmartLocator(page, { storeDir, verbose: false });
    const link = page.getByRole('link', { name: 'Get started' });
    await smart1.register('persisted-link', link);

    // Verify file exists
    const storePath = path.join(storeDir, 'locators.json');
    expect(fs.existsSync(storePath)).toBe(true);

    // Create new instance — should load from disk
    const smart2 = new SmartLocator(page, { storeDir, verbose: false });
    const names = smart2.listRegistered();
    expect(names).toContain('persisted-link');

    // Should be able to find the element using loaded fingerprint
    const result = await smart2.find('persisted-link');
    expect(result.found).toBe(true);
  });

  test('should extract multiple strategy types from a rich element', async ({ page }) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    const smart = new SmartLocator(page, { storeDir: LOCATOR_STORE, verbose: false });

    const searchBtn = page.getByRole('button', { name: 'Search' });
    const fingerprint = await smart.register('search-btn', searchBtn);

    // Should have user strategy + auto strategies
    const autoStrategies = fingerprint.strategies.filter((s) => s.source === 'auto');
    expect(autoStrategies.length).toBeGreaterThanOrEqual(2);

    // Strategies should be sorted by weight (highest first)
    for (let i = 1; i < fingerprint.strategies.length; i++) {
      expect(fingerprint.strategies[i].weight)
        .toBeLessThanOrEqual(fingerprint.strategies[i - 1].weight);
    }
  });

  test('should detect auto-generated IDs and rank them low', async ({ page }) => {
    await page.setContent(`
      <button id="el-a3f2b1c4d5e6" data-testid="submit-btn">Submit</button>
    `);

    const smart = new SmartLocator(page, { storeDir: LOCATOR_STORE, verbose: false });
    const btn = page.locator('button');
    const fingerprint = await smart.register('auto-id-test', btn);

    // Find the auto-extracted ID strategy
    const idStrategy = fingerprint.strategies.find((s) => s.type === 'id' && s.source === 'auto');
    const testIdStrategy = fingerprint.strategies.find((s) => s.type === 'testId' && s.source === 'auto');

    // Auto-generated ID should have low weight
    if (idStrategy) {
      expect(idStrategy.weight).toBeLessThan(50);
    }

    // data-testid should have high weight
    expect(testIdStrategy).toBeDefined();
    expect(testIdStrategy!.weight).toBeGreaterThanOrEqual(90);
  });

  test('should refresh fingerprint with updated strategies', async ({ page }) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    const smart = new SmartLocator(page, { storeDir: LOCATOR_STORE, verbose: false });
    const link = page.getByRole('link', { name: 'Get started' });

    const fp1 = await smart.register('refresh-test', link);
    const originalTime = fp1.updatedAt;

    // Wait a tick so timestamp differs
    await page.waitForTimeout(10);

    const fp2 = await smart.refresh('refresh-test', link);
    expect(fp2.updatedAt).toBeGreaterThanOrEqual(originalTime);
    expect(fp2.strategies.length).toBeGreaterThan(0);
  });
});
