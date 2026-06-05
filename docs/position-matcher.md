# Position Matcher

**File:** `src/main/utils/position-matcher.ts`

## Overview

`PositionMatcher` is a comprehensive utility for validating element positions, layouts, and spatial relationships in Playwright tests. It provides assertions for relative positioning, z-index ordering, viewport placement, alignment, overlap detection, and distance measurements.

## Features

- **Relative positioning** - above, below, left, right checks
- **Overlap detection** - Check if elements overlap or don't overlap
- **Z-index comparison** - Validate stacking order
- **Viewport positioning** - left edge, right edge, top, bottom, center
- **Alignment checks** - Horizontally and vertically aligned elements
- **Distance measurements** - Center-to-center distances with min/max assertions
- **Tolerance support** - Handle sub-pixel rendering differences
- **Detailed error messages** - Shows actual vs expected positions with coordinates

## Installation

```typescript
import { PositionMatcher } from '../main/utils';
```

## Usage

### Creating a Matcher

```typescript
import { test } from '@playwright/test';
import { PositionMatcher } from '../main/utils';

test('layout validation', async ({ page }) => {
  const matcher = new PositionMatcher(page);
  
  const header = page.locator('header');
  const main = page.locator('main');
  
  // Header should be above main content
  await matcher.expectAbove(header, main);
});
```

## Relative Position Checks

### Above / Below

```typescript
const matcher = new PositionMatcher(page);

// Element is above reference
await matcher.expectAbove(header, mainContent);

// Element is below reference
await matcher.expectBelow(footer, mainContent);
```

### Left / Right

```typescript
// Sidebar is to the left of main content
await matcher.expectLeftOf(sidebar, mainContent);

// Aside is to the right of main content
await matcher.expectRightOf(aside, mainContent);
```

### Overlap Detection

```typescript
// Elements overlap (e.g., tooltip over button)
await matcher.expectOverlapping(tooltip, button);

// Elements don't overlap
await matcher.expectNotOverlapping(modal, sidebar);
```

## Z-Index Checks

```typescript
// Modal has higher z-index than backdrop
await matcher.expectHigherZIndex(modal, backdrop);

// Backdrop has lower z-index than modal
await matcher.expectLowerZIndex(backdrop, modal);
```

## Viewport Position Checks

### Edge Positioning

```typescript
// Element at left edge of viewport
await matcher.expectAtLeftEdge(sidebar);

// Element at right edge of viewport
await matcher.expectAtRightEdge(scrollbar);

// Element at top of viewport
await matcher.expectAtTop(header);

// Element at bottom of viewport
await matcher.expectAtBottom(footer);
```

### Centering

```typescript
// Element centered horizontally in viewport
await matcher.expectCenteredHorizontally(modal);

// Element centered vertically in viewport
await matcher.expectCenteredVertically(dialog);
```

### Viewport Containment

```typescript
// Element is fully within viewport (all edges inside)
await matcher.expectInViewport(banner);
```

## Alignment Checks

### Horizontal Alignment

Elements aligned at the same vertical position:

```typescript
// Aligned at top edges
await matcher.expectHorizontallyAligned(button1, button2, 'top');

// Aligned at vertical centers (default)
await matcher.expectHorizontallyAligned(icon1, icon2);
await matcher.expectHorizontallyAligned(icon1, icon2, 'center');

// Aligned at bottom edges
await matcher.expectHorizontallyAligned(input1, input2, 'bottom');
```

### Vertical Alignment

Elements aligned at the same horizontal position:

```typescript
// Aligned at left edges
await matcher.expectVerticallyAligned(item1, item2, 'left');

// Aligned at horizontal centers (default)
await matcher.expectVerticallyAligned(card1, card2);
await matcher.expectVerticallyAligned(card1, card2, 'center');

// Aligned at right edges
await matcher.expectVerticallyAligned(nav1, nav2, 'right');
```

## Distance Measurements

### Get Distance

```typescript
// Get center-to-center distance in pixels
const distance = await matcher.getDistance(element1, element2);
console.log(`Elements are ${distance}px apart`);
```

### Min/Max Distance

```typescript
// Elements must be at least 100px apart
await matcher.expectMinDistance(element1, element2, 100);

// Elements must be at most 500px apart
await matcher.expectMaxDistance(element1, element2, 500);
```

## Options

All position checks support tolerance options:

```typescript
interface PositionMatchOptions {
  tolerance?: number;        // Tolerance in pixels (default: 0)
  waitForVisible?: boolean;  // Wait for elements to be visible (default: true)
  timeout?: number;          // Wait timeout in milliseconds (default: 5000)
}
```

### Using Tolerance

```typescript
// Allow 2px tolerance for sub-pixel rendering
await matcher.expectAbove(header, main, { tolerance: 2 });

await matcher.expectHorizontallyAligned(button1, button2, 'center', {
  tolerance: 1,
  timeout: 10000
});
```

## Common Use Cases

### Header-Main-Footer Layout

```typescript
test('page layout structure', async ({ page, }) => {
  const matcher = new PositionMatcher(page);
  
  const header = page.locator('header');
  const main = page.locator('main');
  const footer = page.locator('footer');
  
  // Verify vertical stacking
  await matcher.expectAbove(header, main);
  await matcher.expectAbove(main, footer);
  
  // Header at top of page
  await matcher.expectAtTop(header, { tolerance: 10 });
});
```

### Sidebar Layout

```typescript
test('sidebar layout', async ({ page }) => {
  const matcher = new PositionMatcher(page);
  
  const sidebar = page.locator('.sidebar');
  const content = page.locator('.content');
  
  // Sidebar to the left
  await matcher.expectLeftOf(sidebar, content);
  
  // Sidebar at left edge
  await matcher.expectAtLeftEdge(sidebar);
  
  // Not overlapping
  await matcher.expectNotOverlapping(sidebar, content);
});
```

### Modal Positioning

```typescript
test('modal is centered', async ({ page }) => {
  const matcher = new PositionMatcher(page);
  
  await page.click('.open-modal');
  const modal = page.locator('.modal');
  const backdrop = page.locator('.modal-backdrop');
  
  // Modal centered in viewport
  await matcher.expectCenteredHorizontally(modal);
  await matcher.expectCenteredVertically(modal);
  
  // Modal above backdrop (z-index)
  await matcher.expectHigherZIndex(modal, backdrop);
  
  // Modal within viewport
  await matcher.expectInViewport(modal);
});
```

### Dropdown Positioning

```typescript
test('dropdown appears below button', async ({ page }) => {
  const matcher = new PositionMatcher(page);
  
  const button = page.locator('.dropdown-button');
  await button.click();
  
  const menu = page.locator('.dropdown-menu');
  
  // Menu below button
  await matcher.expectBelow(menu, button);
  
  // Left edges aligned
  await matcher.expectVerticallyAligned(menu, button, 'left');
  
  // Menu in viewport
  await matcher.expectInViewport(menu);
});
```

### Tooltip Positioning

```typescript
test('tooltip overlaps target', async ({ page }) => {
  const matcher = new PositionMatcher(page);
  
  const target = page.locator('.help-icon');
  await target.hover();
  
  const tooltip = page.locator('.tooltip');
  
  // Tooltip overlaps icon
  await matcher.expectOverlapping(tooltip, target);
  
  // Tooltip above icon
  await matcher.expectAbove(tooltip, target);
  
  // Close proximity
  await matcher.expectMaxDistance(tooltip, target, 50);
});
```

### Grid Alignment

```typescript
test('grid items are aligned', async ({ page }) => {
  const matcher = new PositionMatcher(page);
  
  const row1Items = await page.locator('.grid-row:nth-child(1) .grid-item').all();
  const row2Items = await page.locator('.grid-row:nth-child(2) .grid-item').all();
  
  // Items in same row are horizontally aligned
  await matcher.expectHorizontallyAligned(row1Items[0], row1Items[1], 'top');
  await matcher.expectHorizontallyAligned(row1Items[1], row1Items[2], 'top');
  
  // Items in same column are vertically aligned
  await matcher.expectVerticallyAligned(row1Items[0], row2Items[0], 'left');
});
```

### Responsive Layout

```typescript
test('mobile menu layout', async ({ page }) => {
  const matcher = new PositionMatcher(page);
  
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  
  const menuButton = page.locator('.mobile-menu-button');
  const logo = page.locator('.logo');
  
  // Menu button at right edge
  await matcher.expectAtRightEdge(menuButton, { tolerance: 20 });
  
  // Logo at left edge
  await matcher.expectAtLeftEdge(logo, { tolerance: 20 });
  
  // Both aligned horizontally (same height)
  await matcher.expectHorizontallyAligned(logo, menuButton, 'center');
});
```

### Sticky Header

```typescript
test('sticky header stays at top', async ({ page }) => {
  const matcher = new PositionMatcher(page);
  
  await page.goto('/');
  const header = page.locator('header');
  
  // Initially at top
  await matcher.expectAtTop(header);
  
  // Scroll down
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(100);
  
  // Still at top (sticky)
  await matcher.expectAtTop(header);
});
```

### Fixed Position Elements

```typescript
test('fixed footer positioning', async ({ page }) => {
  const matcher = new PositionMatcher(page);
  
  const footer = page.locator('.fixed-footer');
  
  // Footer at bottom
  await matcher.expectAtBottom(footer);
  
  // Footer spans full width
  await matcher.expectAtLeftEdge(footer);
  await matcher.expectAtRightEdge(footer);
  
  // Scroll doesn't affect position
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(100);
  
  await matcher.expectAtBottom(footer);
});
```

### Absolute Positioning

```typescript
test('badge positioned relative to container', async ({ page }) => {
  const matcher = new PositionMatcher(page);
  
  const container = page.locator('.notification-container');
  const badge = page.locator('.notification-badge');
  
  // Badge overlaps container (absolute positioning)
  await matcher.expectOverlapping(badge, container);
  
  // Badge near top-right of container
  const distance = await matcher.getDistance(badge, container);
  expect(distance).toBeLessThan(50);
});
```

## Error Messages

The matcher provides clear error messages with coordinates:

```typescript
await matcher.expectAbove(element1, element2);

// If it fails:
// ❌ Expected element above reference, but it is below
// Element: (100, 300) to (200, 400)
// Reference: (100, 100) to (200, 200)
```

```typescript
await matcher.expectCenteredHorizontally(modal);

// If it fails:
// ❌ Expected element centered horizontally (640px),
// but found at 500px (diff: 140px, tolerance: 0px)
```

## Return Values

Most methods throw assertions, but you can also use the lower-level methods:

```typescript
// Get element bounds
const bounds = await matcher.getBounds(element, {
  waitForVisible: true,
  timeout: 5000,
  tolerance: 0
});

console.log(bounds);
// {
//   x: 100, y: 200, width: 300, height: 150,
//   top: 200, right: 400, bottom: 350, left: 100,
//   centerX: 250, centerY: 275
// }
```

## Tips & Best Practices

1. **Use tolerance for sub-pixel rendering** - Browsers may render at fractional pixels
2. **Combine with viewport changes** - Test responsive layouts
3. **Check z-index for overlays** - Validate modal/dropdown stacking
4. **Verify alignment in grids** - Ensure consistent layouts
5. **Test sticky/fixed positioning** - Verify scroll behavior
6. **Use distance for proximity checks** - Tooltips, dropdowns near triggers
7. **Check viewport containment** - Ensure content doesn't overflow
8. **Test across viewports** - Mobile, tablet, desktop layouts

## Limitations

- Checks visual bounding boxes, not DOM hierarchy
- Doesn't account for CSS transforms (scale, rotate, skew)
- Z-index comparison is simplified (doesn't handle stacking contexts fully)
- Sub-pixel rendering may vary across browsers
- Requires elements to be visible (unless `waitForVisible: false`)

## Convenience Functions

```typescript
import { createPositionMatcher } from '../main/utils';

// Create matcher instance
const matcher = createPositionMatcher(page);
```

## Integration with Other Utilities

Combine with CSS Matcher for comprehensive layout testing:

```typescript
import { PositionMatcher, CSSMatcher } from '../main/utils';

test('complete layout validation', async ({ page }) => {
  const positionMatcher = new PositionMatcher(page);
  const cssMatch = new CSSMatcher();
  
  const sidebar = page.locator('.sidebar');
  
  // Check position
  await positionMatcher.expectAtLeftEdge(sidebar);
  
  // Check styles
  await expect(sidebar).toHaveStyle({
    width: '250px',
    position: 'fixed'
  });
});
```
