import { type Page, type Locator } from '@playwright/test';

/**
 * Accessibility Helpers — Common a11y checks for Playwright tests.
 *
 * These provide quick accessibility validation without requiring
 * a full axe-core integration. For comprehensive WCAG audits,
 * consider adding @axe-core/playwright.
 */

/**
 * Result of an accessibility check.
 */
export interface A11yCheckResult {
  passed: boolean;
  violations: string[];
  warnings: string[];
}

/**
 * Check that all images have alt text.
 */
export async function checkImagesHaveAlt(page: Page): Promise<A11yCheckResult> {
  const violations: string[] = [];
  const images = await page.locator('img').all();

  for (const img of images) {
    const alt = await img.getAttribute('alt');
    const src = await img.getAttribute('src');
    if (alt === null || alt === undefined) {
      violations.push(`Image missing alt attribute: ${src}`);
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    warnings: [],
  };
}

/**
 * Check that all form inputs have associated labels.
 */
export async function checkFormLabels(page: Page): Promise<A11yCheckResult> {
  const violations: string[] = [];
  const warnings: string[] = [];

  const inputs = await page.locator('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select').all();

  for (const input of inputs) {
    const id = await input.getAttribute('id');
    const ariaLabel = await input.getAttribute('aria-label');
    const ariaLabelledBy = await input.getAttribute('aria-labelledby');
    const placeholder = await input.getAttribute('placeholder');

    if (!ariaLabel && !ariaLabelledBy) {
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        if (await label.count() === 0) {
          violations.push(`Input #${id} has no associated label`);
        }
      } else {
        // Check if wrapped in a label
        const parentLabel = input.locator('xpath=ancestor::label');
        if (await parentLabel.count() === 0) {
          const name = await input.getAttribute('name');
          violations.push(`Input [name="${name}"] has no label, aria-label, or aria-labelledby`);
        }
      }
    }

    if (placeholder && !ariaLabel && !ariaLabelledBy) {
      warnings.push(`Input uses placeholder as only label hint (not accessible)`);
    }
  }

  return { passed: violations.length === 0, violations, warnings };
}

/**
 * Check that the page has a proper heading hierarchy (h1 -> h2 -> h3...).
 */
export async function checkHeadingHierarchy(page: Page): Promise<A11yCheckResult> {
  const violations: string[] = [];

  const headings = await page.evaluate(() => {
    const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    return Array.from(elements).map((el) => ({
      level: parseInt(el.tagName[1]),
      text: el.textContent?.trim().slice(0, 50) || '',
    }));
  });

  if (headings.length === 0) {
    violations.push('Page has no headings');
  } else if (headings[0].level !== 1) {
    violations.push(`First heading is h${headings[0].level}, expected h1`);
  }

  for (let i = 1; i < headings.length; i++) {
    const diff = headings[i].level - headings[i - 1].level;
    if (diff > 1) {
      violations.push(
        `Heading level skipped: h${headings[i - 1].level} → h${headings[i].level} ("${headings[i].text}")`,
      );
    }
  }

  return { passed: violations.length === 0, violations, warnings: [] };
}

/**
 * Check that interactive elements are keyboard accessible (have tabindex or are natively focusable).
 */
export async function checkKeyboardAccessibility(page: Page): Promise<A11yCheckResult> {
  const violations: string[] = [];

  const clickables = await page.evaluate(() => {
    const elements = document.querySelectorAll('[onclick], [role="button"], [role="link"]');
    return Array.from(elements).map((el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      tabindex: el.getAttribute('tabindex'),
      text: el.textContent?.trim().slice(0, 30) || '',
    }));
  });

  for (const el of clickables) {
    const nativelyFocusable = ['a', 'button', 'input', 'select', 'textarea'].includes(el.tag);
    if (!nativelyFocusable && el.tabindex === null) {
      violations.push(
        `Element <${el.tag} role="${el.role}"> "${el.text}" is not keyboard accessible (missing tabindex)`,
      );
    }
  }

  return { passed: violations.length === 0, violations, warnings: [] };
}

/**
 * Run all basic accessibility checks and return a combined result.
 */
export async function runA11yChecks(page: Page): Promise<A11yCheckResult> {
  const results = await Promise.all([
    checkImagesHaveAlt(page),
    checkFormLabels(page),
    checkHeadingHierarchy(page),
    checkKeyboardAccessibility(page),
  ]);

  return {
    passed: results.every((r) => r.passed),
    violations: results.flatMap((r) => r.violations),
    warnings: results.flatMap((r) => r.warnings),
  };
}
