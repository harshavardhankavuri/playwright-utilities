# Drag & Drop Helpers

Reliable drag-and-drop utilities for Playwright tests. Provides multiple strategies to handle different JavaScript drag libraries and HTML5 file drop zones.

---

## Why Multiple Strategies?

Playwright's built-in `dragTo()` works for standard HTML5 drag-and-drop, but many popular libraries (React DnD, SortableJS, Dragula, AG Grid) require synthetic mouse or pointer events. This module provides the right tool for each scenario.

| Strategy | Best For |
|---|---|
| `dragTo()` | Standard HTML5 drag-and-drop |
| `dragWithMouse()` | React DnD, SortableJS, Dragula |
| `dragWithPointer()` | Touch-enabled libraries, mobile |
| `dropFile()` / `dropFiles()` | File upload drop zones |
| `reorderListItem()` | Sortable lists (any library) |

---

## Functions

### `dragTo(source, target, options?)`

Playwright's native drag-and-drop. Simplest option for HTML5 drag.

```typescript
import { dragTo } from './src/main/utils';

await dragTo(page.locator('#item-1'), page.locator('#drop-zone'));

// With position offsets
await dragTo(
  page.locator('.card'),
  page.locator('.column'),
  { sourcePosition: { x: 10, y: 10 }, targetPosition: { x: 50, y: 50 } }
);
```

---

### `dragWithMouse(page, source, target, options?)`

Synthetic mouse events (mousedown → mousemove → mouseup). More reliable for JavaScript-based drag libraries.

```typescript
import { dragWithMouse } from './src/main/utils';

await dragWithMouse(page, page.locator('.card'), page.locator('.column'));

// Slower, smoother drag (better for animations)
await dragWithMouse(page, source, target, { steps: 20, stepDelay: 30 });
```

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `steps` | `number` | `10` | Number of intermediate mouse positions |
| `stepDelay` | `number` | `20` | Delay between steps (ms) |
| `sourcePosition` | `{x, y}` | center | Offset from source element |
| `targetPosition` | `{x, y}` | center | Offset from target element |

---

### `dragWithPointer(page, source, target, options?)`

Pointer events (pointerdown → pointermove → pointerup). Required for touch-enabled drag libraries.

```typescript
import { dragWithPointer } from './src/main/utils';

await dragWithPointer(page, page.locator('.draggable'), page.locator('.droppable'));
```

---

### `dropFile(page, dropZone, fileName, options?)`

Simulate dropping a single file onto a drop zone using the DataTransfer API. No OS file picker needed.

```typescript
import { dropFile } from './src/main/utils';

// Drop a CSV file
await dropFile(page, page.locator('#upload-zone'), 'data.csv', {
  mimeType: 'text/csv',
  content: 'name,age\nAlice,30\nBob,25',
});

// Drop an image from a Buffer
await dropFile(page, page.locator('#image-drop'), 'photo.jpg', {
  mimeType: 'image/jpeg',
  content: imageBuffer,
});
```

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `mimeType` | `string` | auto-detected | MIME type of the file |
| `content` | `string \| Buffer` | `''` | File content |
| `lastModified` | `number` | `Date.now()` | Last modified timestamp |

---

### `dropFiles(page, dropZone, files)`

Drop multiple files at once.

```typescript
import { dropFiles } from './src/main/utils';

await dropFiles(page, page.locator('#upload-zone'), [
  { name: 'photo.jpg', mimeType: 'image/jpeg', content: imageBuffer },
  { name: 'doc.pdf', mimeType: 'application/pdf', content: pdfBuffer },
  { name: 'data.csv', content: 'a,b\n1,2' },
]);
```

---

### `reorderListItem(page, options, fromIndex, toIndex)`

Reorder an item in a sortable list by dragging from one index to another.

```typescript
import { reorderListItem } from './src/main/utils';

// Move item at index 0 to index 2
await reorderListItem(
  page,
  {
    containerSelector: '.sortable-list',
    itemSelector: '.list-item',
  },
  0,  // from
  2,  // to
);

// Use keyboard-based reordering (for accessible implementations)
await reorderListItem(
  page,
  {
    containerSelector: '[role="listbox"]',
    itemSelector: '[role="option"]',
    useKeyboard: true,
  },
  1,
  3,
);
```

---

### `isDraggable(locator)` / `isDropTarget(locator)`

Check if an element is draggable or a valid drop target.

```typescript
import { isDraggable, isDropTarget } from './src/main/utils';

const canDrag = await isDraggable(page.locator('.card'));
const canDrop = await isDropTarget(page.locator('.column'));
```

---

## MIME Type Auto-Detection

When `mimeType` is not specified in `dropFile()`, it's inferred from the file extension:

| Extension | MIME Type |
|---|---|
| `.jpg`, `.jpeg` | `image/jpeg` |
| `.png` | `image/png` |
| `.pdf` | `application/pdf` |
| `.csv` | `text/csv` |
| `.json` | `application/json` |
| `.zip` | `application/zip` |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| Other | `application/octet-stream` |
