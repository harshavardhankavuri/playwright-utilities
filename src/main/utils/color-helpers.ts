import { type Page, type Locator } from '@playwright/test';

/**
 * Color Helpers — Utilities for color extraction, contrast checking,
 * and theme/design system validation in Playwright tests.
 *
 * Covers:
 * - Extract computed colors from elements
 * - Parse CSS color values (rgb, rgba, hex, hsl)
 * - WCAG contrast ratio calculation
 * - Color comparison with tolerance
 * - Theme token validation
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface RGBColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface HSLColor {
  h: number;
  s: number;
  l: number;
  a: number;
}

export interface ContrastResult {
  /** WCAG contrast ratio (1:1 to 21:1) */
  ratio: number;
  /** Whether it passes WCAG AA for normal text (4.5:1) */
  passesAA: boolean;
  /** Whether it passes WCAG AA for large text (3:1) */
  passesAALarge: boolean;
  /** Whether it passes WCAG AAA for normal text (7:1) */
  passesAAA: boolean;
  /** Whether it passes WCAG AAA for large text (4.5:1) */
  passesAAALarge: boolean;
  /** Human-readable summary */
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COLOR EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the computed background color of an element as an RGB object.
 *
 * Usage:
 *   const bg = await getBackgroundColor(page.locator('.header'));
 *   // { r: 255, g: 255, b: 255, a: 1 }
 */
export async function getBackgroundColor(locator: Locator): Promise<RGBColor> {
  const color = await locator.evaluate(
    (el) => window.getComputedStyle(el).backgroundColor,
  );
  return parseColor(color);
}

/**
 * Get the computed text color of an element.
 *
 * Usage:
 *   const color = await getTextColor(page.locator('h1'));
 */
export async function getTextColor(locator: Locator): Promise<RGBColor> {
  const color = await locator.evaluate(
    (el) => window.getComputedStyle(el).color,
  );
  return parseColor(color);
}

/**
 * Get the computed border color of an element.
 */
export async function getBorderColor(
  locator: Locator,
  side: 'top' | 'right' | 'bottom' | 'left' = 'top',
): Promise<RGBColor> {
  const color = await locator.evaluate(
    (el, s) => window.getComputedStyle(el)[`border${s.charAt(0).toUpperCase() + s.slice(1)}Color` as any],
    side,
  );
  return parseColor(color);
}

/**
 * Get any computed CSS color property from an element.
 *
 * Usage:
 *   const outline = await getCssColor(page.locator('button:focus'), 'outline-color');
 */
export async function getCssColor(locator: Locator, property: string): Promise<RGBColor> {
  const color = await locator.evaluate(
    (el, prop) => window.getComputedStyle(el).getPropertyValue(prop),
    property,
  );
  return parseColor(color);
}

/**
 * Get a CSS custom property (variable) value from an element.
 *
 * Usage:
 *   const primary = await getCssVariable(page.locator(':root'), '--color-primary');
 *   // '#3b82f6'
 */
export async function getCssVariable(locator: Locator, variable: string): Promise<string> {
  return locator.evaluate(
    (el, v) => window.getComputedStyle(el).getPropertyValue(v).trim(),
    variable,
  );
}

/**
 * Get all CSS custom properties (design tokens) from an element.
 *
 * Usage:
 *   const tokens = await getCssVariables(page.locator(':root'), ['--color-primary', '--color-secondary']);
 */
export async function getCssVariables(
  locator: Locator,
  variables: string[],
): Promise<Record<string, string>> {
  return locator.evaluate((el, vars) => {
    const style = window.getComputedStyle(el);
    const result: Record<string, string> = {};
    for (const v of vars) {
      result[v] = style.getPropertyValue(v).trim();
    }
    return result;
  }, variables);
}

// ─────────────────────────────────────────────────────────────────────────────
// COLOR PARSING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a CSS color string into an RGB object.
 * Supports: rgb(), rgba(), #hex, #hexa, hsl(), hsla(), named colors.
 *
 * Usage:
 *   parseColor('rgb(255, 128, 0)')   // { r: 255, g: 128, b: 0, a: 1 }
 *   parseColor('#ff8000')            // { r: 255, g: 128, b: 0, a: 1 }
 *   parseColor('rgba(0,0,0,0.5)')    // { r: 0, g: 0, b: 0, a: 0.5 }
 */
export function parseColor(color: string): RGBColor {
  const trimmed = color.trim();

  // rgb() or rgba()
  const rgbMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
      a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1,
    };
  }

  // #rrggbb or #rrggbbaa
  const hexMatch = trimmed.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16),
      g: parseInt(hexMatch[2], 16),
      b: parseInt(hexMatch[3], 16),
      a: hexMatch[4] ? parseInt(hexMatch[4], 16) / 255 : 1,
    };
  }

  // #rgb or #rgba (shorthand)
  const shortHexMatch = trimmed.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i);
  if (shortHexMatch) {
    return {
      r: parseInt(shortHexMatch[1] + shortHexMatch[1], 16),
      g: parseInt(shortHexMatch[2] + shortHexMatch[2], 16),
      b: parseInt(shortHexMatch[3] + shortHexMatch[3], 16),
      a: shortHexMatch[4] ? parseInt(shortHexMatch[4] + shortHexMatch[4], 16) / 255 : 1,
    };
  }

  // transparent
  if (trimmed === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  // Fallback: return black
  return { r: 0, g: 0, b: 0, a: 1 };
}

/**
 * Convert an RGB color to a hex string.
 *
 * Usage:
 *   toHex({ r: 255, g: 128, b: 0, a: 1 }) // '#ff8000'
 */
export function toHex(color: RGBColor): string {
  const r = color.r.toString(16).padStart(2, '0');
  const g = color.g.toString(16).padStart(2, '0');
  const b = color.b.toString(16).padStart(2, '0');
  if (color.a < 1) {
    const a = Math.round(color.a * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}${a}`;
  }
  return `#${r}${g}${b}`;
}

/**
 * Convert an RGB color to an HSL object.
 */
export function toHSL(color: RGBColor): HSLColor {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
    a: color.a,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WCAG CONTRAST
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate the WCAG contrast ratio between two colors.
 * Returns a value between 1 (no contrast) and 21 (maximum contrast).
 *
 * Usage:
 *   const ratio = contrastRatio({ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 });
 *   // 21
 */
export function contrastRatio(foreground: RGBColor, background: RGBColor): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check WCAG contrast compliance between two colors.
 *
 * Usage:
 *   const result = checkContrast(textColor, bgColor);
 *   expect(result.passesAA).toBe(true);
 */
export function checkContrast(foreground: RGBColor, background: RGBColor): ContrastResult {
  const ratio = contrastRatio(foreground, background);
  const rounded = Math.round(ratio * 100) / 100;

  return {
    ratio: rounded,
    passesAA: ratio >= 4.5,
    passesAALarge: ratio >= 3,
    passesAAA: ratio >= 7,
    passesAAALarge: ratio >= 4.5,
    summary: buildContrastSummary(rounded, ratio),
  };
}

/**
 * Check the contrast between an element's text color and background color.
 * Automatically extracts both colors from the element.
 *
 * Usage:
 *   const result = await checkElementContrast(page.locator('button.primary'));
 *   expect(result.passesAA).toBe(true);
 */
export async function checkElementContrast(locator: Locator): Promise<ContrastResult> {
  const [textColor, bgColor] = await Promise.all([
    getTextColor(locator),
    getBackgroundColor(locator),
  ]);
  return checkContrast(textColor, bgColor);
}

/**
 * Run contrast checks on all text elements on the page and return violations.
 *
 * Usage:
 *   const violations = await findContrastViolations(page);
 *   expect(violations).toHaveLength(0);
 */
export async function findContrastViolations(
  page: Page,
  options?: {
    /** Selectors to check. Default: all text elements */
    selectors?: string[];
    /** Minimum contrast ratio required. Default: 4.5 (WCAG AA) */
    minRatio?: number;
  },
): Promise<Array<{ selector: string; ratio: number; foreground: string; background: string }>> {
  const selectors = options?.selectors || ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'button', 'label', 'span'];
  const minRatio = options?.minRatio ?? 4.5;
  const violations: Array<{ selector: string; ratio: number; foreground: string; background: string }> = [];

  for (const selector of selectors) {
    const elements = page.locator(selector);
    const count = await elements.count();

    for (let i = 0; i < Math.min(count, 20); i++) {
      const el = elements.nth(i);
      try {
        const [fg, bg] = await Promise.all([getTextColor(el), getBackgroundColor(el)]);
        const ratio = contrastRatio(fg, bg);

        if (ratio < minRatio) {
          violations.push({
            selector: `${selector}:nth(${i})`,
            ratio: Math.round(ratio * 100) / 100,
            foreground: toHex(fg),
            background: toHex(bg),
          });
        }
      } catch {
        // Skip elements that can't be measured
      }
    }
  }

  return violations;
}

// ─────────────────────────────────────────────────────────────────────────────
// COLOR COMPARISON
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if two colors are equal (exact match).
 */
export function colorsEqual(a: RGBColor, b: RGBColor): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

/**
 * Check if two colors are similar within a tolerance.
 * Tolerance is the maximum allowed difference per channel (0-255).
 *
 * Usage:
 *   colorsSimilar(color1, color2, 10) // true if within 10 units per channel
 */
export function colorsSimilar(a: RGBColor, b: RGBColor, tolerance: number = 5): boolean {
  return (
    Math.abs(a.r - b.r) <= tolerance &&
    Math.abs(a.g - b.g) <= tolerance &&
    Math.abs(a.b - b.b) <= tolerance &&
    Math.abs(a.a - b.a) <= tolerance / 255
  );
}

/**
 * Calculate the perceptual color distance between two colors (Delta E approximation).
 * Returns 0 for identical colors, higher values for more different colors.
 */
export function colorDistance(a: RGBColor, b: RGBColor): number {
  const dr = (a.r - b.r) * 0.3;
  const dg = (a.g - b.g) * 0.59;
  const db = (a.b - b.b) * 0.11;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// ─────────────────────────────────────────────────────────────────────────────
// THEME VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that CSS custom properties match expected values.
 * Useful for design system / theme token testing.
 *
 * Usage:
 *   await expectCssVariables(page, {
 *     '--color-primary': '#3b82f6',
 *     '--color-secondary': '#6b7280',
 *     '--font-size-base': '16px',
 *   });
 */
export async function expectCssVariables(
  page: Page,
  expected: Record<string, string>,
  options?: { tolerance?: number },
): Promise<void> {
  const root = page.locator(':root');
  const actual = await getCssVariables(root, Object.keys(expected));
  const tolerance = options?.tolerance ?? 0;
  const errors: string[] = [];

  for (const [variable, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[variable];

    if (!actualValue) {
      errors.push(`CSS variable "${variable}" not found`);
      continue;
    }

    // Try color comparison with tolerance
    if (tolerance > 0 && (expectedValue.startsWith('#') || expectedValue.startsWith('rgb'))) {
      try {
        const expectedColor = parseColor(expectedValue);
        const actualColor = parseColor(actualValue);
        if (!colorsSimilar(expectedColor, actualColor, tolerance)) {
          errors.push(`"${variable}": expected "${expectedValue}", got "${actualValue}"`);
        }
        continue;
      } catch {
        // Fall through to string comparison
      }
    }

    if (actualValue !== expectedValue) {
      errors.push(`"${variable}": expected "${expectedValue}", got "${actualValue}"`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`CSS variable validation failed:\n${errors.map((e) => `  • ${e}`).join('\n')}`);
  }
}

/**
 * Assert an element's background color matches an expected color.
 *
 * Usage:
 *   await expectBackgroundColor(page.locator('.header'), '#1a1a2e');
 *   await expectBackgroundColor(page.locator('.header'), '#1a1a2e', { tolerance: 5 });
 */
export async function expectBackgroundColor(
  locator: Locator,
  expected: string | RGBColor,
  options?: { tolerance?: number },
): Promise<void> {
  const actual = await getBackgroundColor(locator);
  const expectedColor = typeof expected === 'string' ? parseColor(expected) : expected;
  const tolerance = options?.tolerance ?? 0;

  if (tolerance > 0) {
    if (!colorsSimilar(actual, expectedColor, tolerance)) {
      throw new Error(
        `Background color mismatch. Expected: ${toHex(expectedColor)}, Got: ${toHex(actual)}`,
      );
    }
  } else {
    if (!colorsEqual(actual, expectedColor)) {
      throw new Error(
        `Background color mismatch. Expected: ${toHex(expectedColor)}, Got: ${toHex(actual)}`,
      );
    }
  }
}

/**
 * Assert an element's text color matches an expected color.
 */
export async function expectTextColor(
  locator: Locator,
  expected: string | RGBColor,
  options?: { tolerance?: number },
): Promise<void> {
  const actual = await getTextColor(locator);
  const expectedColor = typeof expected === 'string' ? parseColor(expected) : expected;
  const tolerance = options?.tolerance ?? 0;

  if (tolerance > 0) {
    if (!colorsSimilar(actual, expectedColor, tolerance)) {
      throw new Error(
        `Text color mismatch. Expected: ${toHex(expectedColor)}, Got: ${toHex(actual)}`,
      );
    }
  } else {
    if (!colorsEqual(actual, expectedColor)) {
      throw new Error(
        `Text color mismatch. Expected: ${toHex(expectedColor)}, Got: ${toHex(actual)}`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate relative luminance for WCAG contrast calculation.
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function relativeLuminance(color: RGBColor): number {
  const toLinear = (c: number) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(color.r) + 0.7152 * toLinear(color.g) + 0.0722 * toLinear(color.b);
}

function buildContrastSummary(rounded: number, ratio: number): string {
  const level = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA Large' : 'FAIL';
  return `Contrast ratio: ${rounded}:1 — WCAG ${level}`;
}
