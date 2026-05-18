import { test as base, expect } from '@playwright/test';
import { SnapshotManager, DiffSeverity } from '../main/utils';
import * as fs from 'fs';
import * as path from 'path';

const test = base;

const SNAPSHOTS_DIR = path.resolve('test-results', 'test-snapshots-' + process.pid);

test.describe('SnapshotManager', () => {
  let manager: SnapshotManager;

  test.beforeAll(() => {
    if (fs.existsSync(SNAPSHOTS_DIR)) {
      fs.rmSync(SNAPSHOTS_DIR, { recursive: true });
    }
  });

  test.beforeEach(() => {
    manager = new SnapshotManager({
      snapshotsDir: SNAPSHOTS_DIR,
      diffOutputDir: path.resolve('test-results', 'snapshot-diffs'),
      maxBaselines: 4,
    });
  });

  test('should save first baseline automatically when none exist', async ({ page }) => {
    await page.goto('https://www.saucedemo.com');
    await page.waitForLoadState('networkidle');

    const result = await manager.assertScreenshot(page, {
      name: 'auto-save-test',
      testFilePath: __filename,
    });

    expect(result.isMatch).toBe(true);
    expect(result.summary).toContain('Saved first baseline');

    // Verify file was created in correct structure
    const baselines = manager.listBaselines('auto-save-test', __filename);
    expect(baselines).toHaveLength(1);
    expect(baselines[0]).toBe('baseline-1.png');
  });

  test('should match against existing baseline on second run', async ({ page }) => {
    await page.goto('https://www.saucedemo.com');
    await page.waitForLoadState('networkidle');

    // First call saves baseline
    await manager.assertScreenshot(page, { name: 'match-test', testFilePath: __filename });

    // Second call should compare and match (same page, no changes)
    const result = await manager.assertScreenshot(page, { name: 'match-test', testFilePath: __filename });

    expect(result.isMatch).toBe(true);
    expect(result.matchedBaselineIndex).toBe(0);
    expect(result.matchedBaselineName).toBe('baseline-1.png');
  });

  test('should NOT save new baselines on normal runs', async ({ page }) => {
    await page.goto('https://www.saucedemo.com');
    await page.waitForLoadState('networkidle');

    // First run: saves baseline-1
    await manager.assertScreenshot(page, { name: 'no-auto-save', testFilePath: __filename });

    // Second run: should NOT create baseline-2
    await manager.assertScreenshot(page, { name: 'no-auto-save', testFilePath: __filename });

    // Third run: still only 1 baseline
    await manager.assertScreenshot(page, { name: 'no-auto-save', testFilePath: __filename });

    const baselines = manager.listBaselines('no-auto-save', __filename);
    expect(baselines).toHaveLength(1); // Only the initial baseline, no extras
  });

  test('should add new baseline only with updateBaseline flag', async ({ page }) => {
    await page.goto('https://www.saucedemo.com');
    await page.waitForLoadState('networkidle');

    // Save first baseline
    await manager.assertScreenshot(page, { name: 'update-test', testFilePath: __filename });
    expect(manager.listBaselines('update-test', __filename)).toHaveLength(1);

    // Explicit update adds a second baseline
    await manager.assertScreenshot(page, {
      name: 'update-test',
      testFilePath: __filename,
      updateBaseline: true,
    });
    expect(manager.listBaselines('update-test', __filename)).toHaveLength(2);
  });

  test('should rotate oldest baseline when at max capacity', async ({ page }) => {
    await page.goto('https://www.saucedemo.com');
    await page.waitForLoadState('networkidle');

    // Fill up to maxBaselines (4)
    for (let i = 0; i < 4; i++) {
      await manager.assertScreenshot(page, {
        name: 'rotate-test',
        testFilePath: __filename,
        updateBaseline: true,
      });
    }
    expect(manager.listBaselines('rotate-test', __filename)).toHaveLength(4);

    // 5th update should rotate out the oldest
    await manager.assertScreenshot(page, {
      name: 'rotate-test',
      testFilePath: __filename,
      updateBaseline: true,
    });
    expect(manager.listBaselines('rotate-test', __filename)).toHaveLength(4); // Still 4, not 5
  });

  test('should fail with intelligent analysis when no baseline matches', async ({ page }) => {
    await page.goto('https://www.saucedemo.com');
    await page.waitForLoadState('networkidle');

    // Save a baseline of the login page
    const loginScreenshot = await page.screenshot({ animations: 'disabled' });
    manager.addBaseline('fail-test', loginScreenshot, __filename);

    // Login and take a completely different screenshot
    await page.fill('[data-test="username"]', 'standard_user');
    await page.fill('[data-test="password"]', 'secret_sauce');
    await page.click('[data-test="login-button"]');
    await page.waitForURL(/inventory/);

    const result = await manager.assertScreenshot(page, { name: 'fail-test', testFilePath: __filename });

    expect(result.isMatch).toBe(false);
    expect(result.bestResult.severity).toBe(DiffSeverity.MAJOR);
    expect(result.summary).toContain('did not match');
    expect(result.summary).toContain('UPDATE_SNAPSHOTS');
  });

  test('should store snapshots in __snapshots__/<spec-name>/<snapshot-name>/ structure', async ({ page }) => {
    await page.goto('https://www.saucedemo.com');
    await page.waitForLoadState('networkidle');

    await manager.assertScreenshot(page, { name: 'structure-test', testFilePath: __filename });

    // Verify directory structure
    const specFolder = path.join(SNAPSHOTS_DIR, path.basename(__filename));
    const snapshotFolder = path.join(specFolder, 'structure-test');

    expect(fs.existsSync(specFolder)).toBe(true);
    expect(fs.existsSync(snapshotFolder)).toBe(true);
    expect(fs.existsSync(path.join(snapshotFolder, 'baseline-1.png'))).toBe(true);
  });

  test('should support element-level screenshots', async ({ page }) => {
    await page.goto('https://www.saucedemo.com');
    await page.waitForLoadState('networkidle');

    const logo = page.locator('.login_logo');

    // First call saves baseline
    const result1 = await manager.assertElementScreenshot(logo, { name: 'logo-element', testFilePath: __filename });
    expect(result1.isMatch).toBe(true);

    // Second call matches
    const result2 = await manager.assertElementScreenshot(logo, { name: 'logo-element', testFilePath: __filename });
    expect(result2.isMatch).toBe(true);
    expect(result2.matchedBaselineIndex).toBe(0);
  });
});
