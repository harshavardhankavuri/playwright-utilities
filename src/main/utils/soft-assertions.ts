import { type Locator, type Page, expect as playwrightExpect } from '@playwright/test';

/**
 * Soft Assertions — Collect all failures without stopping the test.
 *
 * Unlike regular assertions that throw immediately on failure, soft assertions
 * collect all violations and report them together at the end. This is ideal for:
 * - Form validation tests (check all fields at once)
 * - Page structure verification (check multiple elements)
 * - Data integrity checks (verify all rows/columns)
 *
 * Usage:
 *   const soft = new SoftAssert();
 *
 *   await soft.expect(locator1).toBeVisible();
 *   await soft.expect(locator2).toHaveText('Hello');
 *   await soft.expect(locator3).toBeEnabled();
 *
 *   soft.assertAll(); // Throws with ALL failures if any
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SoftFailure {
  /** Description of what was being asserted */
  assertion: string;
  /** Error message from the failed assertion */
  error: string;
  /** Index of this assertion in the sequence */
  index: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFT ASSERT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SoftAssert — Collect assertion failures without stopping the test.
 *
 * Usage:
 *   const soft = new SoftAssert();
 *
 *   // These won't throw even if they fail:
 *   await soft.expect(nameField).toBeVisible();
 *   await soft.expect(emailField).toHaveValue('test@example.com');
 *   await soft.expect(submitBtn).toBeEnabled();
 *   await soft.expectPage(page).toHaveTitle('Form');
 *
 *   // This throws with ALL collected failures:
 *   soft.assertAll();
 *
 *   // Or check without throwing:
 *   if (soft.hasFailures()) {
 *     console.log(soft.getFailures());
 *   }
 */
export class SoftAssert {
  private failures: SoftFailure[] = [];
  private assertionCount = 0;

  /**
   * Create a soft assertion for a Locator.
   * Returns a proxy that catches failures instead of throwing.
   */
  expect(locator: Locator, message?: string): SoftLocatorAssert {
    return new SoftLocatorAssert(locator, this, message);
  }

  /**
   * Create a soft assertion for a Page.
   */
  expectPage(page: Page, message?: string): SoftPageAssert {
    return new SoftPageAssert(page, this, message);
  }

  /**
   * Soft-assert a plain value (non-locator).
   */
  expectValue(actual: unknown, message?: string): SoftValueAssert {
    return new SoftValueAssert(actual, this, message);
  }

  /**
   * Record a failure (called internally by soft assertion proxies).
   */
  recordFailure(assertion: string, error: string): void {
    this.failures.push({
      assertion,
      error,
      index: this.assertionCount,
    });
  }

  /**
   * Increment the assertion counter (called internally).
   */
  incrementCount(): void {
    this.assertionCount++;
  }

  /**
   * Throw an error if any soft assertions failed.
   * Call this at the end of your test.
   */
  assertAll(): void {
    if (this.failures.length === 0) return;

    const lines = [
      `\n❌ ${this.failures.length} of ${this.assertionCount} soft assertion(s) failed:\n`,
    ];

    for (const f of this.failures) {
      lines.push(`  [${f.index + 1}] ${f.assertion}`);
      lines.push(`      → ${f.error}\n`);
    }

    throw new Error(lines.join('\n'));
  }

  /**
   * Check if there are any failures without throwing.
   */
  hasFailures(): boolean {
    return this.failures.length > 0;
  }

  /**
   * Get all collected failures.
   */
  getFailures(): SoftFailure[] {
    return [...this.failures];
  }

  /**
   * Get counts: total assertions and failures.
   */
  getCounts(): { total: number; passed: number; failed: number } {
    return {
      total: this.assertionCount,
      passed: this.assertionCount - this.failures.length,
      failed: this.failures.length,
    };
  }

  /**
   * Reset all collected failures and counters.
   */
  reset(): void {
    this.failures = [];
    this.assertionCount = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFT LOCATOR ASSERT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Soft assertion proxy for Playwright Locators.
 * Each method catches errors and records them instead of throwing.
 */
export class SoftLocatorAssert {
  private readonly locator: Locator;
  private readonly collector: SoftAssert;
  private readonly label: string;

  constructor(locator: Locator, collector: SoftAssert, message?: string) {
    this.locator = locator;
    this.collector = collector;
    this.label = message || 'locator';
  }

  private async run(name: string, fn: () => Promise<void>): Promise<this> {
    this.collector.incrementCount();
    try {
      await fn();
    } catch (err) {
      this.collector.recordFailure(
        `expect(${this.label}).${name}`,
        err instanceof Error ? err.message.split('\n')[0] : String(err),
      );
    }
    return this;
  }

  async toBeVisible(options?: { timeout?: number }): Promise<this> {
    return this.run('toBeVisible()', () =>
      playwrightExpect(this.locator).toBeVisible({ timeout: options?.timeout ?? 5000 }),
    );
  }

  async toBeHidden(options?: { timeout?: number }): Promise<this> {
    return this.run('toBeHidden()', () =>
      playwrightExpect(this.locator).toBeHidden({ timeout: options?.timeout ?? 5000 }),
    );
  }

  async toBeEnabled(options?: { timeout?: number }): Promise<this> {
    return this.run('toBeEnabled()', () =>
      playwrightExpect(this.locator).toBeEnabled({ timeout: options?.timeout ?? 5000 }),
    );
  }

  async toBeDisabled(options?: { timeout?: number }): Promise<this> {
    return this.run('toBeDisabled()', () =>
      playwrightExpect(this.locator).toBeDisabled({ timeout: options?.timeout ?? 5000 }),
    );
  }

  async toHaveText(expected: string | RegExp, options?: { timeout?: number }): Promise<this> {
    return this.run(`toHaveText(${expected})`, () =>
      playwrightExpect(this.locator).toHaveText(expected, { timeout: options?.timeout ?? 5000 }),
    );
  }

  async toContainText(expected: string | RegExp, options?: { timeout?: number }): Promise<this> {
    return this.run(`toContainText(${expected})`, () =>
      playwrightExpect(this.locator).toContainText(expected, { timeout: options?.timeout ?? 5000 }),
    );
  }

  async toHaveValue(expected: string | RegExp, options?: { timeout?: number }): Promise<this> {
    return this.run(`toHaveValue(${expected})`, () =>
      playwrightExpect(this.locator).toHaveValue(expected, { timeout: options?.timeout ?? 5000 }),
    );
  }

  async toHaveAttribute(name: string, value?: string | RegExp, options?: { timeout?: number }): Promise<this> {
    return this.run(`toHaveAttribute(${name}, ${value})`, () =>
      playwrightExpect(this.locator).toHaveAttribute(name, value ?? /.*/, { timeout: options?.timeout ?? 5000 }),
    );
  }

  async toHaveClass(expected: string | RegExp, options?: { timeout?: number }): Promise<this> {
    return this.run(`toHaveClass(${expected})`, () =>
      playwrightExpect(this.locator).toHaveClass(expected, { timeout: options?.timeout ?? 5000 }),
    );
  }

  async toHaveCount(count: number, options?: { timeout?: number }): Promise<this> {
    return this.run(`toHaveCount(${count})`, () =>
      playwrightExpect(this.locator).toHaveCount(count, { timeout: options?.timeout ?? 5000 }),
    );
  }

  async toBeChecked(options?: { timeout?: number }): Promise<this> {
    return this.run('toBeChecked()', () =>
      playwrightExpect(this.locator).toBeChecked({ timeout: options?.timeout ?? 5000 }),
    );
  }

  async toHaveCss(property: string, value: string | RegExp, options?: { timeout?: number }): Promise<this> {
    return this.run(`toHaveCSS(${property}, ${value})`, () =>
      playwrightExpect(this.locator).toHaveCSS(property, value, { timeout: options?.timeout ?? 5000 }),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFT PAGE ASSERT
// ─────────────────────────────────────────────────────────────────────────────

export class SoftPageAssert {
  private readonly page: Page;
  private readonly collector: SoftAssert;
  private readonly label: string;

  constructor(page: Page, collector: SoftAssert, message?: string) {
    this.page = page;
    this.collector = collector;
    this.label = message || 'page';
  }

  private async run(name: string, fn: () => Promise<void>): Promise<this> {
    this.collector.incrementCount();
    try {
      await fn();
    } catch (err) {
      this.collector.recordFailure(
        `expect(${this.label}).${name}`,
        err instanceof Error ? err.message.split('\n')[0] : String(err),
      );
    }
    return this;
  }

  async toHaveTitle(expected: string | RegExp, options?: { timeout?: number }): Promise<this> {
    return this.run(`toHaveTitle(${expected})`, () =>
      playwrightExpect(this.page).toHaveTitle(expected, { timeout: options?.timeout ?? 5000 }),
    );
  }

  async toHaveURL(expected: string | RegExp, options?: { timeout?: number }): Promise<this> {
    return this.run(`toHaveURL(${expected})`, () =>
      playwrightExpect(this.page).toHaveURL(expected, { timeout: options?.timeout ?? 5000 }),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFT VALUE ASSERT
// ─────────────────────────────────────────────────────────────────────────────

export class SoftValueAssert {
  private readonly actual: unknown;
  private readonly collector: SoftAssert;
  private readonly label: string;

  constructor(actual: unknown, collector: SoftAssert, message?: string) {
    this.actual = actual;
    this.collector = collector;
    this.label = message || String(actual);
  }

  toBe(expected: unknown): this {
    this.collector.incrementCount();
    if (this.actual !== expected) {
      this.collector.recordFailure(
        `expect(${this.label}).toBe(${expected})`,
        `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(this.actual)}`,
      );
    }
    return this;
  }

  toEqual(expected: unknown): this {
    this.collector.incrementCount();
    if (JSON.stringify(this.actual) !== JSON.stringify(expected)) {
      this.collector.recordFailure(
        `expect(${this.label}).toEqual(...)`,
        `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(this.actual)}`,
      );
    }
    return this;
  }

  toBeTruthy(): this {
    this.collector.incrementCount();
    if (!this.actual) {
      this.collector.recordFailure(
        `expect(${this.label}).toBeTruthy()`,
        `Expected truthy, got ${JSON.stringify(this.actual)}`,
      );
    }
    return this;
  }

  toBeFalsy(): this {
    this.collector.incrementCount();
    if (this.actual) {
      this.collector.recordFailure(
        `expect(${this.label}).toBeFalsy()`,
        `Expected falsy, got ${JSON.stringify(this.actual)}`,
      );
    }
    return this;
  }

  toContain(expected: unknown): this {
    this.collector.incrementCount();
    const str = String(this.actual);
    if (!str.includes(String(expected))) {
      this.collector.recordFailure(
        `expect(${this.label}).toContain(${expected})`,
        `"${str}" does not contain "${expected}"`,
      );
    }
    return this;
  }

  toBeGreaterThan(expected: number): this {
    this.collector.incrementCount();
    if (typeof this.actual !== 'number' || this.actual <= expected) {
      this.collector.recordFailure(
        `expect(${this.label}).toBeGreaterThan(${expected})`,
        `Expected > ${expected}, got ${this.actual}`,
      );
    }
    return this;
  }

  toBeLessThan(expected: number): this {
    this.collector.incrementCount();
    if (typeof this.actual !== 'number' || this.actual >= expected) {
      this.collector.recordFailure(
        `expect(${this.label}).toBeLessThan(${expected})`,
        `Expected < ${expected}, got ${this.actual}`,
      );
    }
    return this;
  }
}
