# Keyboard Helpers

Utilities for keyboard navigation, shortcut simulation, clipboard operations, and form interaction testing.

## Keyboard Shortcuts

### `MOD`

Platform-aware modifier key — `'Meta'` on macOS, `'Control'` on Windows/Linux.

```typescript
import { MOD } from '../main/utils';
// macOS:   'Meta'
// Windows: 'Control'
```

### `pressShortcut(page, key)`

Press a keyboard shortcut using the platform-aware modifier.

```typescript
await pressShortcut(page, 'a');       // Ctrl+A / Cmd+A
await pressShortcut(page, 'z');       // Ctrl+Z / Cmd+Z
await pressShortcut(page, 'Shift+z'); // Ctrl+Shift+Z / Cmd+Shift+Z
```

### Common Shortcuts

```typescript
await selectAll(page);  // Ctrl+A / Cmd+A
await copy(page);       // Ctrl+C / Cmd+C
await paste(page);      // Ctrl+V / Cmd+V
await cut(page);        // Ctrl+X / Cmd+X
await undo(page);       // Ctrl+Z / Cmd+Z
await redo(page);       // Ctrl+Y / Cmd+Shift+Z
```

## Clipboard

### `setClipboard(page, text)`

Write text to the browser clipboard via the Clipboard API. Requires `clipboard-write` permission (Chromium).

```typescript
await setClipboard(page, 'Hello World');
await paste(page); // Ctrl+V into the focused element
```

### `readClipboard(page)`

Read the current clipboard text. Requires `clipboard-read` permission.

```typescript
await copy(page);
const text = await readClipboard(page);
expect(text).toBe('expected value');
```

### `setClipboardAndPaste(page, locator, text)`

The most reliable cross-browser approach. Writes text to the clipboard and pastes it into a locator.

**Strategy:**
1. Try `navigator.clipboard.writeText()` (Chromium with permissions)
2. Fall back to hidden `<textarea>` + `execCommand('copy')` (Firefox, WebKit, BrowserStack)
3. Last resort: type the text directly

```typescript
await setClipboardAndPaste(page, page.locator('#search'), 'Hello World');
await setClipboardAndPaste(page, page.locator('#email'), 'user@test.com');
```

### `getClipboardAfterAction(page, action)`

Grant clipboard permissions, run an action, then return what ended up in the clipboard. Useful for testing "Copy" buttons.

```typescript
const copied = await getClipboardAfterAction(page, async () => {
  await page.locator('button#copy-code').click();
});
expect(copied).toBe('expected code snippet');
```

## Tab Navigation

### `tabForward(page, times?)` / `tabBackward(page, times?)`

```typescript
await tabForward(page);      // Tab once
await tabForward(page, 3);   // Tab three times
await tabBackward(page, 2);  // Shift+Tab twice
```

### `getFocusedElementInfo(page)`

Get information about the currently focused element.

```typescript
const info = await getFocusedElementInfo(page);
// { tag: 'input', id: 'email', name: 'email', role: 'textbox', text: '' }
```

### `verifyTabOrder(page, selectors)`

Assert that Tab key navigation follows the expected order.

```typescript
await page.locator('#first-input').focus();
await verifyTabOrder(page, [
  '#first-input',
  '#second-input',
  '#third-input',
  'button[type="submit"]',
]);
```

Throws with a clear message if the focus order doesn't match:
```
Tab order mismatch at position 3.
Expected: #third-input
Focused:  <button> id="skip-btn" text="Skip"
```

## Form Interaction

### `typeInto(locator, text, options?)`

Clear a field and type text using keyboard events. More realistic than `locator.fill()` — triggers `keydown`/`keyup` events.

```typescript
await typeInto(page.locator('#search'), 'playwright');
await typeInto(page.locator('#search'), 'playwright', { delay: 50 }); // slow typing
await typeInto(page.locator('#search'), 'playwright', { clearFirst: false }); // append
```

### `submitByEnter(locator)`

Submit a form by pressing Enter in a field.

```typescript
await submitByEnter(page.locator('#search-input'));
```

### `pressEscape(page)`

Dismiss a dialog or close a modal.

```typescript
await pressEscape(page);
```

### `navigateWithArrows(page, direction, times?)`

Navigate a dropdown or listbox using arrow keys.

```typescript
await page.locator('select').focus();
await navigateWithArrows(page, 'down', 3);  // Move down 3 options
await navigateWithArrows(page, 'up', 1);    // Move up 1 option
```

## Accessibility Testing Example

```typescript
import { tabForward, verifyTabOrder, getFocusedElementInfo } from '../main/utils';

test('form has correct tab order', async ({ page }) => {
  await page.goto('/contact');

  // Start from the first field
  await page.locator('#name').focus();

  // Verify the complete tab order
  await verifyTabOrder(page, [
    '#name',
    '#email',
    '#phone',
    '#message',
    'button[type="submit"]',
  ]);
});

test('copy button copies correct text', async ({ page }) => {
  await page.goto('/api-docs');

  const copied = await getClipboardAfterAction(page, async () => {
    await page.locator('.copy-button').first().click();
  });

  expect(copied).toContain('npm install');
});
```
