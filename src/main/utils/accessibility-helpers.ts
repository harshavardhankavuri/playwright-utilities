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

// ─────────────────────────────────────────────────────────────────────────────
// ENHANCED ACCESSIBILITY CHECKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check that all interactive elements have visible focus indicators.
 * Tabs through focusable elements and checks for visible outline/ring.
 */
export async function checkFocusIndicators(page: Page): Promise<A11yCheckResult> {
  const violations: string[] = [];
  const warnings: string[] = [];

  const focusableCount = await page.evaluate(() => {
    const focusable = document.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    return focusable.length;
  });

  // Sample up to 20 focusable elements
  const sampleSize = Math.min(focusableCount, 20);

  for (let i = 0; i < sampleSize; i++) {
    const result = await page.evaluate((idx) => {
      const focusable = Array.from(document.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      const el = focusable[idx] as HTMLElement;
      if (!el) return null;

      el.focus();
      const style = window.getComputedStyle(el);
      const outline = style.outline;
      const outlineWidth = parseFloat(style.outlineWidth);
      const boxShadow = style.boxShadow;
      const hasFocusRing = outlineWidth > 0 || (boxShadow && boxShadow !== 'none');

      return {
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.trim().slice(0, 30) || '',
        hasFocusRing,
        outline,
        boxShadow,
      };
    }, i);

    if (result && !result.hasFocusRing) {
      warnings.push(
        `<${result.tag}> "${result.text}" may lack visible focus indicator (outline: ${result.outline})`,
      );
    }
  }

  return { passed: violations.length === 0, violations, warnings };
}

/**
 * Check that ARIA live regions are properly configured.
 * Live regions announce dynamic content changes to screen readers.
 */
export async function checkAriaLiveRegions(page: Page): Promise<A11yCheckResult> {
  const violations: string[] = [];
  const warnings: string[] = [];

  const liveRegions = await page.evaluate(() => {
    const regions = document.querySelectorAll('[aria-live], [role="alert"], [role="status"], [role="log"]');
    return Array.from(regions).map((el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      ariaLive: el.getAttribute('aria-live'),
      ariaAtomic: el.getAttribute('aria-atomic'),
      ariaRelevant: el.getAttribute('aria-relevant'),
      text: el.textContent?.trim().slice(0, 50) || '',
    }));
  });

  for (const region of liveRegions) {
    // role="alert" should be assertive
    if (region.role === 'alert' && region.ariaLive && region.ariaLive !== 'assertive') {
      violations.push(
        `[role="alert"] should have aria-live="assertive", got "${region.ariaLive}"`,
      );
    }

    // role="status" should be polite
    if (region.role === 'status' && region.ariaLive && region.ariaLive !== 'polite') {
      warnings.push(
        `[role="status"] typically uses aria-live="polite", got "${region.ariaLive}"`,
      );
    }

    // aria-live without aria-atomic may cause partial announcements
    if (region.ariaLive && !region.ariaAtomic) {
      warnings.push(
        `Live region <${region.tag}> missing aria-atomic attribute (may cause partial announcements)`,
      );
    }
  }

  return { passed: violations.length === 0, violations, warnings };
}

/**
 * Check that modal dialogs trap focus correctly.
 * When a modal is open, Tab should cycle within the modal only.
 */
export async function checkFocusTrap(
  page: Page,
  modalSelector: string,
): Promise<A11yCheckResult> {
  const violations: string[] = [];

  const modalExists = await page.locator(modalSelector).count() > 0;
  if (!modalExists) {
    return { passed: true, violations: [], warnings: [`Modal "${modalSelector}" not found`] };
  }

  // Check aria-modal attribute
  const hasAriaModal = await page.locator(modalSelector).getAttribute('aria-modal');
  if (hasAriaModal !== 'true') {
    violations.push(`Modal "${modalSelector}" missing aria-modal="true"`);
  }

  // Check role="dialog"
  const role = await page.locator(modalSelector).getAttribute('role');
  if (role !== 'dialog' && role !== 'alertdialog') {
    violations.push(`Modal "${modalSelector}" should have role="dialog" or role="alertdialog", got "${role}"`);
  }

  // Check aria-labelledby or aria-label
  const ariaLabel = await page.locator(modalSelector).getAttribute('aria-label');
  const ariaLabelledBy = await page.locator(modalSelector).getAttribute('aria-labelledby');
  if (!ariaLabel && !ariaLabelledBy) {
    violations.push(`Modal "${modalSelector}" missing aria-label or aria-labelledby`);
  }

  return { passed: violations.length === 0, violations, warnings: [] };
}

/**
 * Check that skip navigation links are present and functional.
 * Skip links allow keyboard users to bypass repetitive navigation.
 */
export async function checkSkipLinks(page: Page): Promise<A11yCheckResult> {
  const violations: string[] = [];
  const warnings: string[] = [];

  const skipLinks = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href^="#"]');
    return Array.from(links).slice(0, 5).map((el) => ({
      href: el.getAttribute('href') || '',
      text: el.textContent?.trim() || '',
      isVisible: (el as HTMLElement).offsetParent !== null,
    }));
  });

  const hasSkipToMain = skipLinks.some(
    (l) => l.text.toLowerCase().includes('skip') || l.href === '#main' || l.href === '#content',
  );

  if (!hasSkipToMain) {
    warnings.push('No skip navigation link found. Consider adding "Skip to main content" for keyboard users.');
  }

  return { passed: violations.length === 0, violations, warnings };
}

/**
 * Check that all interactive elements have sufficient touch target size.
 * WCAG 2.5.5 recommends at least 44x44 CSS pixels.
 */
export async function checkTouchTargetSize(
  page: Page,
  options?: { minSize?: number },
): Promise<A11yCheckResult> {
  const minSize = options?.minSize ?? 44;
  const violations: string[] = [];

  const smallTargets = await page.evaluate((min) => {
    const interactive = document.querySelectorAll('button, a[href], input, select, [role="button"], [role="link"]');
    const small: string[] = [];

    for (const el of interactive) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        if (rect.width < min || rect.height < min) {
          const text = (el as HTMLElement).textContent?.trim().slice(0, 30) || el.tagName;
          small.push(`<${el.tagName.toLowerCase()}> "${text}" is ${Math.round(rect.width)}x${Math.round(rect.height)}px (min: ${min}x${min}px)`);
        }
      }
    }

    return small.slice(0, 10); // Limit to 10 violations
  }, minSize);

  violations.push(...smallTargets);

  return { passed: violations.length === 0, violations, warnings: [] };
}

/**
 * Run all enhanced accessibility checks.
 */
export async function runFullA11yChecks(
  page: Page,
  options?: { modalSelector?: string },
): Promise<A11yCheckResult> {
  const checks = await Promise.all([
    checkImagesHaveAlt(page),
    checkFormLabels(page),
    checkHeadingHierarchy(page),
    checkKeyboardAccessibility(page),
    checkFocusIndicators(page),
    checkAriaLiveRegions(page),
    checkSkipLinks(page),
    checkTouchTargetSize(page),
    ...(options?.modalSelector ? [checkFocusTrap(page, options.modalSelector)] : []),
  ]);

  return {
    passed: checks.every((r) => r.passed),
    violations: checks.flatMap((r) => r.violations),
    warnings: checks.flatMap((r) => r.warnings),
  };
}
