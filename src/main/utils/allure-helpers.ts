import * as allure from 'allure-js-commons';

/**
 * Allure Helpers — Utilities for organizing tests in Allure Report.
 *
 * Provides a clean API to define suite hierarchy, tags, severity, steps,
 * and metadata. Designed to be called in test.beforeEach() or at the
 * start of each test for consistent report organization.
 *
 * Allure Report hierarchy:
 *   Parent Suite → Suite → Sub Suite → Test
 *
 * Example in report:
 *   E-Commerce App
 *     └── Authentication
 *           └── Login Flow
 *                 ├── should login with valid credentials
 *                 └── should show error for invalid password
 */

// ─────────────────────────────────────────────────────────────────────────────
// SUITE HIERARCHY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for organizing a test in Allure's suite hierarchy.
 */
export interface AllureSuiteConfig {
  /** Top-level grouping (e.g. "E-Commerce App", "Admin Portal") */
  parentSuite?: string;
  /** Mid-level grouping (e.g. "Authentication", "Checkout") */
  suite?: string;
  /** Lowest-level grouping (e.g. "Login Flow", "Password Reset") */
  subSuite?: string;
}

/**
 * Set the suite hierarchy for the current test.
 * Call this in test.beforeEach() or at the start of a test.
 *
 * Usage:
 *   test.beforeEach(async () => {
 *     await allureSuite({ parentSuite: 'E-Commerce', suite: 'Auth', subSuite: 'Login' });
 *   });
 */
export async function allureSuite(config: AllureSuiteConfig): Promise<void> {
  if (config.parentSuite) await allure.parentSuite(config.parentSuite);
  if (config.suite) await allure.suite(config.suite);
  if (config.subSuite) await allure.subSuite(config.subSuite);
}

/**
 * Set parent suite for the current test.
 */
export async function allureParentSuite(name: string): Promise<void> {
  await allure.parentSuite(name);
}

/**
 * Set suite for the current test.
 */
export async function allureSuiteLabel(name: string): Promise<void> {
  await allure.suite(name);
}

/**
 * Set sub-suite for the current test.
 */
export async function allureSubSuite(name: string): Promise<void> {
  await allure.subSuite(name);
}

// ─────────────────────────────────────────────────────────────────────────────
// BEHAVIOR HIERARCHY (Epic → Feature → Story)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for Allure's behavior-based hierarchy.
 */
export interface AllureBehaviorConfig {
  /** Top-level behavior grouping (e.g. "Web Interface") */
  epic?: string;
  /** Feature grouping (e.g. "User Management") */
  feature?: string;
  /** User story (e.g. "As a user I can reset my password") */
  story?: string;
}

/**
 * Set the behavior hierarchy for the current test.
 *
 * Usage:
 *   await allureBehavior({ epic: 'Payments', feature: 'Checkout', story: 'Credit Card' });
 */
export async function allureBehavior(config: AllureBehaviorConfig): Promise<void> {
  if (config.epic) await allure.epic(config.epic);
  if (config.feature) await allure.feature(config.feature);
  if (config.story) await allure.story(config.story);
}

// ─────────────────────────────────────────────────────────────────────────────
// TAGS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add tags to the current test in Allure Report.
 * Tags are searchable and filterable in the report UI.
 *
 * Usage:
 *   await allureTags('smoke', 'regression', 'P1');
 *
 * Or use Playwright's built-in tag syntax in test titles:
 *   test('should login @smoke @regression', async () => { ... });
 *   // These are automatically picked up by allure-playwright
 */
export async function allureTags(...tags: string[]): Promise<void> {
  await allure.tags(...tags);
}

/**
 * Add a single tag.
 */
export async function allureTag(tag: string): Promise<void> {
  await allure.tag(tag);
}

/**
 * Map Playwright tags (from test title @tag syntax) to Allure tags.
 * Call this with the test title to auto-extract and apply @tags.
 *
 * Usage:
 *   test.beforeEach(async ({}, testInfo) => {
 *     await allureTagsFromTitle(testInfo.title);
 *   });
 *
 * Test: 'should login @smoke @P1' → Allure tags: ['smoke', 'P1']
 */
export async function allureTagsFromTitle(title: string): Promise<string[]> {
  const tagPattern = /@(\w[\w-]*)/g;
  const tags: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(title)) !== null) {
    // Skip allure metadata tags (handled by allure-playwright natively)
    if (!match[1].startsWith('allure.')) {
      tags.push(match[1]);
    }
  }

  if (tags.length > 0) {
    await allure.tags(...tags);
  }

  return tags;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEVERITY & METADATA
// ─────────────────────────────────────────────────────────────────────────────

/** Allure severity levels */
export type AllureSeverity = 'trivial' | 'minor' | 'normal' | 'critical' | 'blocker';

/**
 * Set the severity level for the current test.
 */
export async function allureSeverity(severity: AllureSeverity): Promise<void> {
  await allure.severity(severity);
}

/**
 * Set the owner of the current test.
 */
export async function allureOwner(name: string): Promise<void> {
  await allure.owner(name);
}

/**
 * Set a description for the current test (supports Markdown).
 */
export async function allureDescription(markdown: string): Promise<void> {
  await allure.description(markdown);
}

/**
 * Add a link to the current test.
 */
export async function allureLink(url: string, name?: string, type?: string): Promise<void> {
  await allure.link(url, name, type);
}

/**
 * Add an issue link to the current test.
 */
export async function allureIssue(id: string, name?: string): Promise<void> {
  await allure.issue(id, name);
}

/**
 * Add a TMS (Test Management System) link.
 */
export async function allureTms(id: string, name?: string): Promise<void> {
  await allure.tms(id, name);
}

/**
 * Set a custom label.
 */
export async function allureLabel(name: string, value: string): Promise<void> {
  await allure.label(name, value);
}

// ─────────────────────────────────────────────────────────────────────────────
// STEPS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wrap an action in an Allure step for structured reporting.
 * Steps appear as collapsible sections in the Allure report.
 *
 * Usage:
 *   await allureStep('Fill login form', async () => {
 *     await page.fill('#email', 'user@test.com');
 *     await page.fill('#password', 'secret');
 *   });
 *
 *   // Nested steps
 *   await allureStep('Complete checkout', async () => {
 *     await allureStep('Add item to cart', async () => { ... });
 *     await allureStep('Enter payment details', async () => { ... });
 *     await allureStep('Confirm order', async () => { ... });
 *   });
 */
export async function allureStep<T = void>(
  name: string,
  body: () => T | Promise<T>,
): Promise<T> {
  return allure.step(name, async () => {
    return body();
  });
}

/**
 * Log a simple step (no body, just a marker in the report).
 */
export async function allureLogStep(name: string, status?: 'passed' | 'failed' | 'broken' | 'skipped'): Promise<void> {
  const statusMap: Record<string, any> = {
    passed: 'passed',
    failed: 'failed',
    broken: 'broken',
    skipped: 'skipped',
  };
  await allure.logStep(name, statusMap[status || 'passed']);
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTACHMENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attach text content to the current test in Allure.
 */
export async function allureAttachText(name: string, content: string): Promise<void> {
  await allure.attachment(name, content, 'text/plain');
}

/**
 * Attach JSON content to the current test.
 */
export async function allureAttachJson(name: string, data: unknown): Promise<void> {
  await allure.attachment(name, JSON.stringify(data, null, 2), 'application/json');
}

/**
 * Attach a file from disk to the current test.
 */
export async function allureAttachFile(name: string, filePath: string, contentType?: string): Promise<void> {
  await allure.attachmentPath(name, filePath, contentType || 'application/octet-stream');
}

// ─────────────────────────────────────────────────────────────────────────────
// PARAMETERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a parameter to the current test (shown in Allure report).
 */
export async function allureParameter(
  name: string,
  value: string,
  options?: { excluded?: boolean; mode?: 'default' | 'masked' | 'hidden' },
): Promise<void> {
  await allure.parameter(name, value, options);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMBINED SETUP HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full Allure metadata configuration for a test.
 * Use this in beforeEach for consistent organization across all tests.
 */
export interface AllureTestConfig {
  parentSuite?: string;
  suite?: string;
  subSuite?: string;
  epic?: string;
  feature?: string;
  story?: string;
  tags?: string[];
  severity?: AllureSeverity;
  owner?: string;
  description?: string;
}

/**
 * Apply full Allure metadata in a single call.
 * Designed for use in test.beforeEach() to organize all tests consistently.
 *
 * Usage:
 *   test.beforeEach(async () => {
 *     await configureAllure({
 *       parentSuite: 'E-Commerce App',
 *       suite: 'Authentication',
 *       subSuite: 'Login Flow',
 *       epic: 'User Access',
 *       feature: 'Login',
 *       story: 'Email/Password Login',
 *       tags: ['smoke', 'regression', 'P1'],
 *       severity: 'critical',
 *       owner: 'QA Team',
 *     });
 *   });
 */
export async function configureAllure(config: AllureTestConfig): Promise<void> {
  if (config.parentSuite) await allure.parentSuite(config.parentSuite);
  if (config.suite) await allure.suite(config.suite);
  if (config.subSuite) await allure.subSuite(config.subSuite);
  if (config.epic) await allure.epic(config.epic);
  if (config.feature) await allure.feature(config.feature);
  if (config.story) await allure.story(config.story);
  if (config.tags && config.tags.length > 0) await allure.tags(...config.tags);
  if (config.severity) await allure.severity(config.severity);
  if (config.owner) await allure.owner(config.owner);
  if (config.description) await allure.description(config.description);
}
