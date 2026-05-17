import { test as base } from '@playwright/test';
import { HomePage } from '../pages';
import { fluentExpect, fluentExpectPage, fluentExpectResponse } from '../assertions';
import { SnapshotManager } from '../utils';

/**
 * Custom test fixtures that provide page objects and utilities to tests.
 */
type PageFixtures = {
  homePage: HomePage;
  snapshotManager: SnapshotManager;
};

export const test = base.extend<PageFixtures>({
  homePage: async ({ page }, use) => {
    const homePage = new HomePage(page);
    await use(homePage);
  },
  snapshotManager: async ({}, use) => {
    const manager = new SnapshotManager();
    await use(manager);
  },
});

export { expect } from '@playwright/test';
export { fluentExpect as expect$, fluentExpect, fluentExpectPage, fluentExpectResponse };
export { SnapshotManager };
