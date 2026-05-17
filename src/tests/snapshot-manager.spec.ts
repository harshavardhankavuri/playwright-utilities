import { test, expect } from '../main/fixtures';
import { SnapshotManager, DiffSeverity } from '../main/utils';
import * as fs from 'fs';
import * as path from 'path';

const SNAPSHOTS_DIR = path.resolve('test-results', 'test-snapshots-' + process.pid);

test.describe('SnapshotManager - Multi-baseline', () => {
  let manager: SnapshotManager;

  test.beforeAll(() => {
    // Clean up test snapshots before running
    if (fs.existsSync(SNAPSHOTS_DIR)) {
      fs.rmSync(SNAPSHOTS_DIR, { recursive: true });
    }
  });

  test.beforeEach(() => {
    manager = new SnapshotManager({
      snapshotsDir: SNAPSHOTS_DIR,
      diffOutputDir: path.resolve('test-results', 'snapshot-diffs'),
    });
  });

  test('should save first baseline automatically when none exist', async ({ page }) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    const result = await manager.assertScreenshot(page, { name: 'auto-save-test' });

    expect(result.isMatch).toBe(true);
    expect(result.summary).toContain('Saved first baseline');

    // Verify file was created
    const baselines = manager.listBaselines('auto-save-test');
    expect(baselines).toHaveLength(1);
    expect(baselines[0]).toBe('baseline-1.png');
  });

  test('should match against existing baseline', async ({ page }) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    // First call saves baseline
    await manager.assertScreenshot(page, { name: 'match-test' });

    // Second call should match it
    const result = await manager.assertScreenshot(page, { name: 'match-test' });

    expect(result.isMatch).toBe(true);
    expect(result.matchedBaselineIndex).toBe(0);
    expect(result.matchedBaselineName).toBe('baseline-1.png');
  });

  test('should support multiple baselines and match any', async ({ page }) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    // Save first baseline (normal state)
    await page.evaluate(() => {
      document.querySelectorAll('*').forEach((el) => {
        (el as HTMLElement).style.animation = 'none';
        (el as HTMLElement).style.transition = 'none';
      });
    });
    const screenshot1 = await page.screenshot({ animations: 'disabled' });
    manager.addBaseline('multi-test', screenshot1);

    // Save second baseline (slightly different — e.g. dark mode variant)
    await page.evaluate(() => {
      document.body.style.backgroundColor = '#1a1a1a';
    });
    const screenshot2 = await page.screenshot({ animations: 'disabled' });
    manager.addBaseline('multi-test', screenshot2);

    // Verify we have 2 baselines
    expect(manager.listBaselines('multi-test')).toHaveLength(2);

    // Reset to original state — should match baseline 1
    await page.evaluate(() => {
      document.body.style.backgroundColor = '';
    });
    const result = await manager.assertScreenshot(page, { name: 'multi-test' });

    expect(result.isMatch).toBe(true);
    expect(result.matchedBaselineIndex).toBe(0);
    console.log(result.summary);
  });

  test('should fail with intelligent analysis when no baseline matches', async ({ page }) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      document.querySelectorAll('*').forEach((el) => {
        (el as HTMLElement).style.animation = 'none';
        (el as HTMLElement).style.transition = 'none';
      });
    });

    // Save a baseline
    const baseline = await page.screenshot({ animations: 'disabled' });
    manager.addBaseline('fail-test', baseline);

    // Make a significant change
    await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      if (h1) {
        h1.textContent = 'COMPLETELY DIFFERENT TEXT';
        h1.style.color = 'red';
        h1.style.fontSize = '80px';
      }
    });

    const result = await manager.assertScreenshot(page, { name: 'fail-test' });

    expect(result.isMatch).toBe(false);
    expect(result.bestResult.severity).toBe(DiffSeverity.MAJOR);
    expect(result.summary).toContain('did not match');
    expect(result.summary).toContain('UPDATE_SNAPSHOTS');
    console.log(result.summary);
  });

  test('should save new baseline with updateBaseline option', async ({ page }) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    // Save initial baseline
    const initial = await page.screenshot({ animations: 'disabled' });
    manager.addBaseline('update-test', initial);
    expect(manager.listBaselines('update-test')).toHaveLength(1);

    // Update with a new variant
    const result = await manager.assertScreenshot(page, {
      name: 'update-test',
      updateBaseline: true,
    });

    expect(result.isMatch).toBe(true);
    expect(result.summary).toContain('Saved new baseline');
    expect(manager.listBaselines('update-test')).toHaveLength(2);
  });

  test('should support element-level screenshots', async ({ page }) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { name: 'Playwright enables reliable' });

    // First call saves baseline
    const result1 = await manager.assertElementScreenshot(heading, { name: 'heading-element' });
    expect(result1.isMatch).toBe(true);

    // Second call matches
    const result2 = await manager.assertElementScreenshot(heading, { name: 'heading-element' });
    expect(result2.isMatch).toBe(true);
    expect(result2.matchedBaselineIndex).toBe(0);
  });

  test('should store snapshots at folder level when testFilePath is provided', async ({ page }) => {
    await page.goto('https://playwright.dev');
    await page.waitForLoadState('networkidle');

    // Use a fresh manager without snapshotsDir override (uses folder-level storage)
    const folderManager = new SnapshotManager({
      diffOutputDir: path.resolve('test-results', 'snapshot-diffs'),
    });

    // Provide testFilePath — snapshots will be stored alongside this test file
    const result = await folderManager.assertScreenshot(page, {
      name: 'folder-level',
      testFilePath: __filename,
    });

    expect(result.isMatch).toBe(true);

    // Verify the snapshot folder was created next to this test file
    const expectedDir = path.join(
      path.dirname(__filename),
      'snapshot-manager-folder-level-snapshots',
    );
    expect(fs.existsSync(expectedDir)).toBe(true);

    // Verify baseline file exists
    const files = fs.readdirSync(expectedDir).filter((f) => f.endsWith('.png'));
    expect(files).toHaveLength(1);

    // Clean up
    fs.rmSync(expectedDir, { recursive: true });
  });
});
