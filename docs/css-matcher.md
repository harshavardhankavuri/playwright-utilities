# CSS Matcher

**File:** `src/main/utils/css-matcher.ts`

## Overview

`CSSMatcher` is a custom Playwright matcher for validating CSS properties with flexible matching modes. It extends Playwright's `expect()` API with `toHaveStyle()` matcher that supports partial matching, value normalization, tolerance for numeric values, and pseudo-element validation.

## Features

- **Custom `expect()` matcher** - Integrates seamlessly with Playwright's assertion API
- **Flexible matching modes** - Exact, partial, or contains matching
- **Value normalization** - Automatically converts rgb to hex, normalizes whitespace
- **Tolerance for numeric values** - Handle sub-pixel rendering differences
- **Pseudo-element support** - Check `::before`, `::after`, etc.
- **Detailed error messages** - Shows expected vs actual for all mismatches
- **Auto-registration** - Matcher is automatically available when imported

## Installation

The matcher is automatically registered when you import it. No additional setup required:

```typescript
import { CSSMatcher } from '../main/utils';
// or just import any utility from the utils index
import { expectCSS } from '../main/utils';
```

For TypeScript autocomplete, the types are automatically extended in the global namespace.

## Usage

### Basic Usage with `expect()`

```typescript
import { test, expect } from '@playwright/test';

test('element has correct styles', async ({ page }) => {
  await page.goto('/');
  const button = page.locator('button');
  
  // Assert CSS properties
  await expect(button).toHaveStyle({
    display: 'flex',
    color: 'rgb(255, 0, 0)',
    fontSize: '16px',
    fontWeight: '700'
  });
});
```

### Partial Matching (Default)

By default, the matcher uses partial matching - the element can have additional CSS properties:

```typescript
// Only checks these properties, element can have others
await expect(button).toHaveStyle({
  display: 'flex',
  justifyContent: 'center'
});
```

### Numeric Values with Tolerance

Handle sub-pixel rendering differences:

```typescript
await expect(element).toHaveStyle({
  width: 100  // Will pass if actual is 98-102px
}, { tolerance: 2 });
```

### Contains Mode

Check if CSS value contains a substring:

```typescript
await expect(element).toHaveStyle({
  fontFamily: 'Arial'  // Passes if font-family includes 'Arial'
}, { mode: 'contains' });
```

### Pseudo-element Styles

Check styles of `::before`, `::after`, etc:

```typescript
await expect(element).toHaveStyle({
  content: '"★"',
  color: 'rgb(255, 215, 0)'
}, { pseudoElement: '::before' });
```

### Negative Assertions

```typescript
await expect(element).not.toHaveStyle({
  display: 'none'
});
```

### With Custom Options

```typescript
await expect(element).toHaveStyle({
  width: '500px',
  backgroundColor: '#ff0000'
}, {
  mode: 'partial',        // 'exact' | 'partial' | 'contains'
  normalize: true,        // Normalize colors, whitespace
  tolerance: 1,           // Tolerance for numeric values (px)
  waitForVisible: true,   // Wait for element before checking
  timeout: 10000          // Wait timeout (ms)
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `'exact' \| 'partial' \| 'contains'` | `'partial'` | Match mode |
| `normalize` | `boolean` | `true` | Normalize values before comparison |
| `tolerance` | `number` | `0` | Tolerance for numeric values (pixels) |
| `pseudoElement` | `string` | `''` | Pseudo-element to check (e.g., `'::before'`) |
| `waitForVisible` | `boolean` | `true` | Wait for element to be visible |
| `timeout` | `number` | `5000` | Wait timeout in milliseconds |

## Matching Modes

### Partial (Default)

Element must have all specified properties, but can have additional ones:

```typescript
await expect(element).toHaveStyle({
  display: 'flex'
  // Element can have fontSize, color, etc.
});
```

### Exact

Element must have exactly the specified properties (not commonly used):

```typescript
await expect(element).toHaveStyle({
  display: 'flex',
  color: 'rgb(0, 0, 0)'
  // Element should have ONLY these properties
}, { mode: 'exact' });
```

### Contains

String values use substring matching (case-insensitive):

```typescript
await expect(element).toHaveStyle({
  fontFamily: 'helvetica'  // Matches "Helvetica Neue, Helvetica, Arial"
}, { mode: 'contains' });
```

## Value Normalization

When `normalize: true` (default), values are normalized before comparison:

- **Colors**: `rgb(255, 0, 0)` → `#ff0000`
- **Whitespace**: Multiple spaces → single space
- **Quotes**: Removed from font-family names
- **Numbers**: `100` → `100px`

Examples:

```typescript
// All of these match
await expect(element).toHaveStyle({ color: 'rgb(255, 0, 0)' });
await expect(element).toHaveStyle({ color: '#ff0000' });
await expect(element).toHaveStyle({ color: '#FF0000' });

// Numeric to px conversion
await expect(element).toHaveStyle({ width: 100 });  // Same as '100px'
```

## Alternative Usage (Without `expect()`)

You can also use the matcher programmatically:

### CSSMatcher Class

```typescript
import { CSSMatcher } from '../main/utils';

const matcher = new CSSMatcher();

// Check and get result
const result = await matcher.matchCSS(locator, {
  display: 'flex',
  color: 'rgb(255, 0, 0)'
});

if (!result.passed) {
  console.log(result.summary);
  console.log('Mismatched:', result.mismatched);
  console.log('Matched:', result.matched);
}

// Assert (throws on failure)
await matcher.expectCSS(locator, { display: 'flex' });

// Get single property
const fontSize = await matcher.getProperty(locator, 'font-size');
```

### Helper Function

```typescript
import { expectCSS } from '../main/utils';

// Convenience function
await expectCSS(locator, {
  display: 'flex',
  color: '#ff0000'
}, { tolerance: 1 });
```

## Common Use Cases

### Responsive Design Testing

```typescript
test('mobile styles', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  
  await expect(page.locator('.sidebar')).toHaveStyle({
    display: 'none'
  });
  
  await expect(page.locator('.mobile-menu')).toHaveStyle({
    display: 'block'
  });
});
```

### Theme Validation

```typescript
test('dark theme colors', async ({ page }) => {
  await page.goto('/?theme=dark');
  
  await expect(page.locator('body')).toHaveStyle({
    backgroundColor: '#1a1a1a',
    color: '#ffffff'
  });
});
```

### Layout Verification

```typescript
test('flexbox layout', async ({ page }) => {
  await page.goto('/dashboard');
  
  const container = page.locator('.container');
  await expect(container).toHaveStyle({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px'
  });
});
```

### Animation States

```typescript
test('element is visible with opacity', async ({ page }) => {
  await page.goto('/');
  const modal = page.locator('.modal');
  
  await expect(modal).toHaveStyle({
    opacity: '1',
    visibility: 'visible',
    pointerEvents: 'auto'
  });
});
```

### Typography Checks

```typescript
test('heading typography', async ({ page }) => {
  await page.goto('/');
  
  await expect(page.locator('h1')).toHaveStyle({
    fontSize: '32px',
    fontWeight: '700',
    lineHeight: '1.2',
    letterSpacing: '-0.5px'
  }, { tolerance: 1 });
});
```

### CSS Variables

```typescript
test('uses CSS custom properties', async ({ page }) => {
  await page.goto('/');
  
  // Check computed value from CSS variable
  await expect(page.locator('.button')).toHaveStyle({
    color: 'rgb(37, 99, 235)'  // Computed from var(--primary-color)
  });
});
```

## Error Messages

The matcher provides clear, detailed error messages:

```typescript
await expect(button).toHaveStyle({
  display: 'flex',
  color: 'rgb(255, 0, 0)',
  fontSize: '16px'
});

// If it fails:
// ❌ 2 of 3 CSS properties mismatched (mode: partial)
//
// Mismatched properties:
//   • color:
//     Expected: #ff0000
//     Actual:   #0000ff
//   • fontSize:
//     Expected: 16px
//     Actual:   14px
//
// Matched 1 properties: display
```

## Tips & Best Practices

1. **Use partial mode (default)** - More maintainable than exact matching
2. **Add tolerance for dimensions** - Sub-pixel rendering varies across browsers
3. **Normalize colors** - Use hex or rgb consistently in your tests
4. **Check computed values** - The matcher uses `getComputedStyle()`, not inline styles
5. **Use contains mode for font families** - Font stacks have fallbacks
6. **Test responsive breakpoints** - Combine with viewport changes
7. **Verify pseudo-elements** - Check ::before, ::after decorations
8. **Check visibility states** - Validate opacity, visibility, display together

## Limitations

- Only checks computed styles (not inline or stylesheet rules)
- Pseudo-element support requires browser compatibility
- Some shorthand properties (like `border`) may need to be checked as individual properties
- Browser-specific prefixed properties may need explicit checking

## Comparison with Playwright's Built-in

| Feature | Playwright `toHaveCSS()` | `toHaveStyle()` |
|---------|-------------------------|-----------------|
| Single property | ✅ | ✅ Multiple properties |
| Exact match only | ✅ | ✅ Exact, partial, contains |
| Value normalization | ❌ Manual | ✅ Automatic |
| Numeric tolerance | ❌ | ✅ |
| Pseudo-elements | ✅ | ✅ |
| Detailed mismatch | ❌ | ✅ Shows all differences |

Use Playwright's `toHaveCSS()` for simple single-property checks. Use `toHaveStyle()` for comprehensive multi-property validation with flexible matching.
