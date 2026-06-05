# Color Helpers

Utilities for color extraction, WCAG contrast checking, and design system/theme validation in Playwright tests.

---

## Color Extraction

### Extract colors from elements

```typescript
import {
  getBackgroundColor, getTextColor, getBorderColor,
  getCssColor, getCssVariable, getCssVariables,
} from './src/main/utils';

// Get computed colors
const bg = await getBackgroundColor(page.locator('.header'));
// { r: 26, g: 26, b: 46, a: 1 }

const text = await getTextColor(page.locator('h1'));
// { r: 255, g: 255, b: 255, a: 1 }

const border = await getBorderColor(page.locator('.card'), 'top');
// { r: 200, g: 200, b: 200, a: 1 }

// Get any CSS property
const outline = await getCssColor(page.locator('button:focus'), 'outline-color');

// Get CSS custom properties (design tokens)
const primary = await getCssVariable(page.locator(':root'), '--color-primary');
// '#3b82f6'

const tokens = await getCssVariables(page.locator(':root'), [
  '--color-primary',
  '--color-secondary',
  '--font-size-base',
]);
// { '--color-primary': '#3b82f6', '--color-secondary': '#6b7280', '--font-size-base': '16px' }
```

---

## Color Parsing & Conversion

```typescript
import { parseColor, toHex, toHSL } from './src/main/utils';

// Parse any CSS color format
parseColor('rgb(255, 128, 0)')    // { r: 255, g: 128, b: 0, a: 1 }
parseColor('#ff8000')             // { r: 255, g: 128, b: 0, a: 1 }
parseColor('rgba(0, 0, 0, 0.5)') // { r: 0, g: 0, b: 0, a: 0.5 }
parseColor('#f80')                // { r: 255, g: 136, b: 0, a: 1 } (shorthand)

// Convert to hex
toHex({ r: 255, g: 128, b: 0, a: 1 })    // '#ff8000'
toHex({ r: 0, g: 0, b: 0, a: 0.5 })      // '#0000007f'

// Convert to HSL
toHSL({ r: 255, g: 128, b: 0, a: 1 })    // { h: 30, s: 100, l: 50, a: 1 }
```

---

## WCAG Contrast Checking

### `checkContrast(foreground, background)`

Calculate WCAG contrast ratio and compliance levels.

```typescript
import { checkContrast, parseColor } from './src/main/utils';

const result = checkContrast(
  parseColor('#ffffff'),  // white text
  parseColor('#1a1a2e'),  // dark background
);

// result.ratio        → 15.3
// result.passesAA     → true  (≥ 4.5:1 for normal text)
// result.passesAAA    → true  (≥ 7:1 for normal text)
// result.passesAALarge → true (≥ 3:1 for large text)
// result.summary      → 'Contrast ratio: 15.3:1 — WCAG AAA'
```

### `checkElementContrast(locator)`

Automatically extract and check contrast for an element.

```typescript
import { checkElementContrast } from './src/main/utils';

const result = await checkElementContrast(page.locator('button.primary'));
expect(result.passesAA).toBe(true);
```

### `findContrastViolations(page, options?)`

Scan the page for contrast violations.

```typescript
import { findContrastViolations } from './src/main/utils';

const violations = await findContrastViolations(page);
expect(violations).toHaveLength(0);

// Custom selectors and threshold
const violations = await findContrastViolations(page, {
  selectors: ['button', 'a', '.badge'],
  minRatio: 3.0, // AA Large
});
```

---

## Color Comparison

```typescript
import { colorsEqual, colorsSimilar, colorDistance } from './src/main/utils';

const a = parseColor('#ff8000');
const b = parseColor('#ff8010');

colorsEqual(a, b)           // false (exact match)
colorsSimilar(a, b, 20)     // true (within 20 units per channel)
colorDistance(a, b)         // ~1.1 (perceptual distance)
```

---

## Theme / Design System Validation

### `expectCssVariables(page, expected, options?)`

Assert that CSS custom properties match expected values.

```typescript
import { expectCssVariables } from './src/main/utils';

await expectCssVariables(page, {
  '--color-primary': '#3b82f6',
  '--color-secondary': '#6b7280',
  '--font-size-base': '16px',
  '--border-radius': '8px',
});

// With color tolerance (allows minor rendering differences)
await expectCssVariables(page, {
  '--color-primary': '#3b82f6',
}, { tolerance: 5 });
```

### `expectBackgroundColor(locator, expected, options?)`

Assert an element's background color.

```typescript
import { expectBackgroundColor, expectTextColor } from './src/main/utils';

await expectBackgroundColor(page.locator('.header'), '#1a1a2e');
await expectBackgroundColor(page.locator('.card'), 'rgb(255, 255, 255)');

// With tolerance for cross-browser rendering differences
await expectBackgroundColor(page.locator('.btn-primary'), '#3b82f6', { tolerance: 5 });

await expectTextColor(page.locator('h1'), '#ffffff');
```

---

## WCAG Compliance Levels

| Level | Normal Text | Large Text (18pt+ or 14pt bold) |
|---|---|---|
| AA | 4.5:1 | 3:1 |
| AAA | 7:1 | 4.5:1 |

```typescript
const result = checkContrast(fg, bg);

// Check specific levels
if (!result.passesAA) {
  console.warn(`Contrast ${result.ratio}:1 fails WCAG AA (need 4.5:1)`);
}
if (!result.passesAALarge) {
  console.warn(`Contrast ${result.ratio}:1 fails WCAG AA for large text (need 3:1)`);
}
```
