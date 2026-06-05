import { type Locator, type Page, expect as playwrightExpect } from '@playwright/test';
import { expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CSS property values can be strings or numbers (converted to px for dimensions)
 */
export type CSSValue = string | number;

/**
 * Map of CSS property names to their expected values
 */
export type CSSProperties = Record<string, CSSValue>;

/**
 * Options for CSS matching
 */
export interface CSSMatchOptions {
  /**
   * Match mode:
   * - 'exact': All supplied properties must match exactly
   * - 'partial': Supplied properties must match, but element can have additional properties (default)
   * - 'contains': For string values, check if actual contains expected (case-insensitive)
   */
  mode?: 'exact' | 'partial' | 'contains';
  
  /**
   * Normalize values before comparison:
   * - Converts 'rgb(...)' to hex
   * - Normalizes whitespace
   * - Converts numeric pixels to 'Npx' format
   * Default: true
   */
  normalize?: boolean;
  
  /**
   * Tolerance for numeric values (in pixels)
   * Useful for values that may differ by sub-pixels due to rendering
   * Default: 0
   */
  tolerance?: number;
  
  /**
   * Pseudo-element to check (e.g., '::before', '::after')
   */
  pseudoElement?: string;
  
  /**
   * Wait for the element to be visible before checking CSS
   * Default: true
   */
  waitForVisible?: boolean;
  
  /**
   * Timeout for waiting (in milliseconds)
   * Default: 5000
   */
  timeout?: number;
}

/**
 * Result of CSS property comparison
 */
export interface CSSMatchResult {
  /** Whether all checks passed */
  passed: boolean;
  /** Properties that matched */
  matched: Record<string, { expected: string; actual: string }>;
  /** Properties that didn't match */
  mismatched: Record<string, { expected: string; actual: string }>;
  /** All computed CSS properties of the element */
  allProperties: Record<string, string>;
  /** Human-readable summary */
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYWRIGHT CUSTOM MATCHER TYPES
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  namespace PlaywrightTest {
    interface Matchers<R, T> {
      /**
       * Assert that an element has the specified CSS properties.
       * 
       * @example
       * await expect(locator).toHaveStyle({
       *   display: 'flex',
       *   color: 'rgb(255, 0, 0)',
       *   fontSize: '16px'
       * });
       * 
       * @example With options
       * await expect(locator).toHaveStyle({
       *   width: 100
       * }, { tolerance: 2, mode: 'partial' });
       */
      toHaveStyle(expected: CSSProperties, options?: CSSMatchOptions): R;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS MATCHER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CSSMatcher - Validate CSS properties of elements with flexible matching modes.
 *
 * Features:
 * - Full or partial property matching
 * - Value normalization (colors, units, whitespace)
 * - Tolerance for numeric values
 * - Pseudo-element support
 * - Contains mode for flexible string matching
 * - Detailed mismatch reporting
 *
 * Usage:
 *   const matcher = new CSSMatcher();
 *
 *   // Exact match (default)
 *   await matcher.expectCSS(element, {
 *     color: 'rgb(255, 0, 0)',
 *     fontSize: '16px',
 *     display: 'flex'
 *   });
 *
 *   // Partial match (element can have additional properties)
 *   await matcher.expectCSS(element, { display: 'flex' }, { mode: 'partial' });
 *
 *   // Contains mode for flexible matching
 *   await matcher.expectCSS(element, { fontFamily: 'Arial' }, { mode: 'contains' });
 *
 *   // With tolerance for numeric values
 *   await matcher.expectCSS(element, { width: 100 }, { tolerance: 2 });
 */
export class CSSMatcher {
  /**
   * Assert that an element's CSS properties match the expected values.
   * Throws an assertion error if any properties don't match.
   */
  async expectCSS(
    locator: Locator,
    expectedProperties: CSSProperties,
    options?: CSSMatchOptions,
  ): Promise<void> {
    const result = await this.matchCSS(locator, expectedProperties, options);
    
    if (!result.passed) {
      const message = this.buildErrorMessage(result);
      throw new Error(message);
    }
  }

  /**
   * Check if an element's CSS properties match the expected values.
   * Returns a detailed result object without throwing.
   */
  async matchCSS(
    locator: Locator,
    expectedProperties: CSSProperties,
    options?: CSSMatchOptions,
  ): Promise<CSSMatchResult> {
    const opts: Required<CSSMatchOptions> = {
      mode: options?.mode ?? 'partial',
      normalize: options?.normalize ?? true,
      tolerance: options?.tolerance ?? 0,
      pseudoElement: options?.pseudoElement ?? '',
      waitForVisible: options?.waitForVisible ?? true,
      timeout: options?.timeout ?? 5000,
    };

    // Wait for element to be visible if requested
    if (opts.waitForVisible) {
      await locator.waitFor({ state: 'visible', timeout: opts.timeout }).catch(() => {
        throw new Error('Element is not visible');
      });
    }

    // Get all computed CSS properties
    const allProperties = await this.getComputedStyles(locator, opts.pseudoElement);

    // Compare each expected property
    const matched: Record<string, { expected: string; actual: string }> = {};
    const mismatched: Record<string, { expected: string; actual: string }> = {};

    for (const [property, expectedValue] of Object.entries(expectedProperties)) {
      const actualValue = allProperties[property];
      
      if (actualValue === undefined) {
        mismatched[property] = {
          expected: this.normalizeValue(expectedValue, opts),
          actual: 'undefined',
        };
        continue;
      }

      const normalizedExpected = opts.normalize
        ? this.normalizeValue(expectedValue, opts)
        : String(expectedValue);
      const normalizedActual = opts.normalize
        ? this.normalizeValue(actualValue, opts)
        : actualValue;

      const isMatch = this.compareValues(
        normalizedExpected,
        normalizedActual,
        opts.mode,
        opts.tolerance,
      );

      if (isMatch) {
        matched[property] = { expected: normalizedExpected, actual: normalizedActual };
      } else {
        mismatched[property] = { expected: normalizedExpected, actual: normalizedActual };
      }
    }

    const passed = Object.keys(mismatched).length === 0;
    const summary = this.buildSummary(matched, mismatched, opts.mode);

    return {
      passed,
      matched,
      mismatched,
      allProperties,
      summary,
    };
  }

  /**
   * Get a single CSS property value from an element.
   */
  async getProperty(
    locator: Locator,
    property: string,
    pseudoElement?: string,
  ): Promise<string> {
    const styles = await this.getComputedStyles(locator, pseudoElement);
    return styles[property] || '';
  }

  /**
   * Get all computed CSS properties of an element.
   */
  private async getComputedStyles(
    locator: Locator,
    pseudoElement?: string,
  ): Promise<Record<string, string>> {
    return await locator.evaluate(
      (el, pseudo) => {
        const styles = window.getComputedStyle(el, pseudo || null);
        const result: Record<string, string> = {};
        
        // Get all CSS properties
        for (let i = 0; i < styles.length; i++) {
          const property = styles[i];
          result[property] = styles.getPropertyValue(property);
        }
        
        return result;
      },
      pseudoElement,
    );
  }

  /**
   * Normalize a CSS value for comparison.
   */
  private normalizeValue(value: CSSValue, options: Required<CSSMatchOptions>): string {
    let normalized = String(value);

    // Convert number to px
    if (typeof value === 'number') {
      normalized = `${value}px`;
    }

    if (!options.normalize) {
      return normalized;
    }

    // Normalize whitespace
    normalized = normalized.trim().replace(/\s+/g, ' ');

    // Convert rgb/rgba to hex (if possible)
    const rgbMatch = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
      const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
      const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
      normalized = `#${r}${g}${b}`;
    }

    // Normalize hex colors to lowercase
    if (normalized.startsWith('#')) {
      normalized = normalized.toLowerCase();
    }

    // Remove quotes from font families
    normalized = normalized.replace(/['"]/g, '');

    return normalized;
  }

  /**
   * Compare two CSS values based on the match mode.
   */
  private compareValues(
    expected: string,
    actual: string,
    mode: 'exact' | 'partial' | 'contains',
    tolerance: number,
  ): boolean {
    if (mode === 'contains') {
      return actual.toLowerCase().includes(expected.toLowerCase());
    }

    // Try numeric comparison with tolerance
    if (tolerance > 0) {
      const expectedNum = this.extractNumericValue(expected);
      const actualNum = this.extractNumericValue(actual);
      
      if (expectedNum !== null && actualNum !== null) {
        return Math.abs(expectedNum - actualNum) <= tolerance;
      }
    }

    // Exact string comparison
    return expected === actual;
  }

  /**
   * Extract numeric value from a CSS value (e.g., '100px' -> 100).
   */
  private extractNumericValue(value: string): number | null {
    const match = value.match(/^(-?\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
  }

  /**
   * Build a human-readable summary of the comparison.
   */
  private buildSummary(
    matched: Record<string, any>,
    mismatched: Record<string, any>,
    mode: string,
  ): string {
    const matchedCount = Object.keys(matched).length;
    const mismatchedCount = Object.keys(mismatched).length;
    const total = matchedCount + mismatchedCount;

    if (mismatchedCount === 0) {
      return `✅ All ${matchedCount} CSS properties matched (mode: ${mode})`;
    }

    const lines = [
      `❌ ${mismatchedCount} of ${total} CSS properties mismatched (mode: ${mode})`,
      '',
      'Mismatched properties:',
    ];

    for (const [property, values] of Object.entries(mismatched)) {
      lines.push(`  • ${property}:`);
      lines.push(`    Expected: ${values.expected}`);
      lines.push(`    Actual:   ${values.actual}`);
    }

    if (matchedCount > 0) {
      lines.push('', `Matched ${matchedCount} properties: ${Object.keys(matched).join(', ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Build error message for assertion failures.
   */
  private buildErrorMessage(result: CSSMatchResult): string {
    return `CSS properties assertion failed:\n\n${result.summary}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a CSS matcher instance (convenience function).
 */
export function createCSSMatcher(): CSSMatcher {
  return new CSSMatcher();
}

/**
 * Quick assertion for CSS properties (convenience function).
 */
export async function expectCSS(
  locator: Locator,
  properties: CSSProperties,
  options?: CSSMatchOptions,
): Promise<void> {
  const matcher = new CSSMatcher();
  await matcher.expectCSS(locator, properties, options);
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYWRIGHT CUSTOM MATCHER REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register the custom CSS matcher with Playwright's expect.
 * Call this in your test setup file (e.g., playwright.config.ts or global-setup.ts)
 */
export function registerCSSMatcher(): void {
  playwrightExpect.extend({
    async toHaveStyle(
      locator: Locator,
      expectedProperties: CSSProperties,
      options?: CSSMatchOptions,
    ) {
      const matcher = new CSSMatcher();
      
      let result: CSSMatchResult;
      let error: Error | null = null;

      try {
        result = await matcher.matchCSS(locator, expectedProperties, options);
      } catch (err) {
        error = err as Error;
        result = {
          passed: false,
          matched: {},
          mismatched: {},
          allProperties: {},
          summary: error.message,
        };
      }

      const pass = result.passed && !error;

      // Build matcher result message
      const message = () => {
        const hint = this.utils.matcherHint(
          'toHaveStyle',
          'locator',
          'expected',
          { isNot: this.isNot },
        );

        const expectedStr = this.utils.printExpected(expectedProperties);
        const mismatchedStr = Object.keys(result.mismatched).length > 0
          ? '\n\nMismatched properties:\n' +
            Object.entries(result.mismatched)
              .map(([prop, vals]) => 
                `  ${prop}:\n` +
                `    Expected: ${this.utils.printExpected(vals.expected)}\n` +
                `    Received: ${this.utils.printReceived(vals.actual)}`
              )
              .join('\n')
          : '';

        const matchedStr = Object.keys(result.matched).length > 0
          ? `\n\nMatched: ${Object.keys(result.matched).join(', ')}`
          : '';

        if (pass) {
          return hint + '\n\n' +
            `Expected element NOT to have CSS properties:\n${expectedStr}` +
            `\n\nBut all properties matched.${matchedStr}`;
        } else {
          return hint + '\n\n' +
            `Expected element to have CSS properties:\n${expectedStr}` +
            mismatchedStr + matchedStr;
        }
      };

      return {
        pass,
        message,
        actual: result.mismatched,
        expected: expectedProperties,
      };
    },
  });
}

// Auto-register the matcher when this module is imported
registerCSSMatcher();
