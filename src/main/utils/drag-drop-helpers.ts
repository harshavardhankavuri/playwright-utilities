import { type Page, type Locator } from '@playwright/test';

/**
 * Drag & Drop Helpers — Reliable drag-and-drop utilities for Playwright tests.
 *
 * Playwright's built-in dragTo() works for most cases, but some frameworks
 * (React DnD, SortableJS, Dragula, AG Grid) require synthetic mouse events
 * or specific event sequences. This module provides multiple strategies.
 *
 * Strategies:
 * 1. Native Playwright dragTo()          — simplest, works for HTML5 drag
 * 2. Mouse event simulation              — works for React DnD, SortableJS
 * 3. DataTransfer injection              — works for HTML5 file drop zones
 * 4. Keyboard-based reorder             — for accessible drag-and-drop
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface DragOptions {
  /** Steps for mouse movement (higher = smoother). Default: 10 */
  steps?: number;
  /** Delay between steps in ms. Default: 20 */
  stepDelay?: number;
  /** Source position offset (relative to element). Default: center */
  sourcePosition?: { x: number; y: number };
  /** Target position offset (relative to element). Default: center */
  targetPosition?: { x: number; y: number };
  /** Whether to use HTML5 DataTransfer events. Default: false */
  useDataTransfer?: boolean;
}

export interface FileDropOptions {
  /** MIME type of the file. Default: auto-detected from filename */
  mimeType?: string;
  /** File content as string or Buffer */
  content?: string | Buffer;
  /** Last modified timestamp. Default: Date.now() */
  lastModified?: number;
}

export interface SortableReorderOptions {
  /** Selector for the list container */
  containerSelector: string;
  /** Selector for individual items within the container */
  itemSelector: string;
  /** Whether to use keyboard-based reordering. Default: false */
  useKeyboard?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// NATIVE DRAG (Playwright built-in)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drag an element to another element using Playwright's native dragTo().
 * Works for standard HTML5 drag-and-drop.
 *
 * Usage:
 *   await dragTo(page.locator('#item-1'), page.locator('#drop-zone'));
 */
export async function dragTo(
  source: Locator,
  target: Locator,
  options?: {
    sourcePosition?: { x: number; y: number };
    targetPosition?: { x: number; y: number };
    timeout?: number;
  },
): Promise<void> {
  await source.dragTo(target, {
    sourcePosition: options?.sourcePosition,
    targetPosition: options?.targetPosition,
    timeout: options?.timeout,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MOUSE EVENT SIMULATION (for React DnD, SortableJS, etc.)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drag using synthetic mouse events (mousedown → mousemove → mouseup).
 * More reliable than dragTo() for JavaScript-based drag libraries.
 *
 * Usage:
 *   await dragWithMouse(page, page.locator('.card'), page.locator('.column'));
 */
export async function dragWithMouse(
  page: Page,
  source: Locator,
  target: Locator,
  options?: DragOptions,
): Promise<void> {
  const steps = options?.steps ?? 10;
  const stepDelay = options?.stepDelay ?? 20;

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error('Could not get bounding box for source or target element');
  }

  const sourceX = sourceBox.x + (options?.sourcePosition?.x ?? sourceBox.width / 2);
  const sourceY = sourceBox.y + (options?.sourcePosition?.y ?? sourceBox.height / 2);
  const targetX = targetBox.x + (options?.targetPosition?.x ?? targetBox.width / 2);
  const targetY = targetBox.y + (options?.targetPosition?.y ?? targetBox.height / 2);

  // Move to source and press
  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  await page.waitForTimeout(50); // Brief pause to register drag start

  // Gradually move to target
  for (let i = 1; i <= steps; i++) {
    const x = sourceX + ((targetX - sourceX) * i) / steps;
    const y = sourceY + ((targetY - sourceY) * i) / steps;
    await page.mouse.move(x, y);
    if (stepDelay > 0) await page.waitForTimeout(stepDelay);
  }

  await page.waitForTimeout(50); // Brief pause before release
  await page.mouse.up();
}

// ─────────────────────────────────────────────────────────────────────────────
// POINTER EVENT SIMULATION (for touch-based drag libraries)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drag using pointer events (pointerdown → pointermove → pointerup).
 * Required for touch-enabled drag libraries and mobile testing.
 *
 * Usage:
 *   await dragWithPointer(page, page.locator('.draggable'), page.locator('.droppable'));
 */
export async function dragWithPointer(
  page: Page,
  source: Locator,
  target: Locator,
  options?: DragOptions,
): Promise<void> {
  const steps = options?.steps ?? 10;
  const stepDelay = options?.stepDelay ?? 20;

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error('Could not get bounding box for source or target element');
  }

  const sourceX = sourceBox.x + (options?.sourcePosition?.x ?? sourceBox.width / 2);
  const sourceY = sourceBox.y + (options?.sourcePosition?.y ?? sourceBox.height / 2);
  const targetX = targetBox.x + (options?.targetPosition?.x ?? targetBox.width / 2);
  const targetY = targetBox.y + (options?.targetPosition?.y ?? targetBox.height / 2);

  await page.evaluate(
    ({ sx, sy, tx, ty, steps, stepDelay }) => {
      return new Promise<void>((resolve) => {
        const el = document.elementFromPoint(sx, sy) as HTMLElement;
        if (!el) { resolve(); return; }

        const firePointer = (type: string, x: number, y: number) => {
          el.dispatchEvent(new PointerEvent(type, {
            bubbles: true, cancelable: true, clientX: x, clientY: y,
            pointerId: 1, pointerType: 'mouse', isPrimary: true,
          }));
        };

        firePointer('pointerdown', sx, sy);

        let step = 0;
        const interval = setInterval(() => {
          step++;
          const x = sx + ((tx - sx) * step) / steps;
          const y = sy + ((ty - sy) * step) / steps;
          firePointer('pointermove', x, y);

          if (step >= steps) {
            clearInterval(interval);
            setTimeout(() => {
              firePointer('pointerup', tx, ty);
              resolve();
            }, stepDelay);
          }
        }, stepDelay);
      });
    },
    { sx: sourceX, sy: sourceY, tx: targetX, ty: targetY, steps, stepDelay },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML5 FILE DROP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulate dropping a file onto a drop zone element.
 * Uses DataTransfer API to inject file data without OS file picker.
 *
 * Usage:
 *   await dropFile(page, page.locator('#upload-zone'), 'test.csv', {
 *     mimeType: 'text/csv',
 *     content: 'name,age\nAlice,30',
 *   });
 */
export async function dropFile(
  page: Page,
  dropZone: Locator,
  fileName: string,
  options?: FileDropOptions,
): Promise<void> {
  const mimeType = options?.mimeType || guessMimeType(fileName);
  const content = options?.content ?? '';
  const lastModified = options?.lastModified ?? Date.now();

  const contentBase64 = Buffer.isBuffer(content)
    ? content.toString('base64')
    : Buffer.from(content).toString('base64');

  await dropZone.evaluate(
    (el, { fileName, mimeType, contentBase64, lastModified }) => {
      const binaryStr = atob(contentBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const file = new File([bytes], fileName, { type: mimeType, lastModified });

      const dt = new DataTransfer();
      dt.items.add(file);

      el.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: dt }));
      el.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
      el.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
    },
    { fileName, mimeType, contentBase64, lastModified },
  );
}

/**
 * Simulate dropping multiple files onto a drop zone.
 *
 * Usage:
 *   await dropFiles(page, page.locator('#upload-zone'), [
 *     { name: 'photo.jpg', mimeType: 'image/jpeg', content: imageBuffer },
 *     { name: 'doc.pdf', mimeType: 'application/pdf', content: pdfBuffer },
 *   ]);
 */
export async function dropFiles(
  page: Page,
  dropZone: Locator,
  files: Array<{ name: string; mimeType?: string; content?: string | Buffer }>,
): Promise<void> {
  const fileData = files.map((f) => ({
    name: f.name,
    mimeType: f.mimeType || guessMimeType(f.name),
    contentBase64: Buffer.isBuffer(f.content)
      ? f.content.toString('base64')
      : Buffer.from(f.content ?? '').toString('base64'),
  }));

  await dropZone.evaluate((el, files) => {
    const dt = new DataTransfer();
    for (const f of files) {
      const binaryStr = atob(f.contentBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      dt.items.add(new File([bytes], f.name, { type: f.mimeType }));
    }
    el.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: dt }));
    el.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
  }, fileData);
}

// ─────────────────────────────────────────────────────────────────────────────
// SORTABLE LIST REORDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reorder an item in a sortable list by dragging from one index to another.
 * Works with SortableJS, React Beautiful DnD, and similar libraries.
 *
 * Usage:
 *   // Move item at index 0 to index 2
 *   await reorderListItem(page, {
 *     containerSelector: '.sortable-list',
 *     itemSelector: '.list-item',
 *   }, 0, 2);
 */
export async function reorderListItem(
  page: Page,
  options: SortableReorderOptions,
  fromIndex: number,
  toIndex: number,
): Promise<void> {
  const items = page.locator(`${options.containerSelector} ${options.itemSelector}`);
  const count = await items.count();

  if (fromIndex < 0 || fromIndex >= count || toIndex < 0 || toIndex >= count) {
    throw new Error(
      `Index out of bounds: fromIndex=${fromIndex}, toIndex=${toIndex}, count=${count}`,
    );
  }

  if (options.useKeyboard) {
    await reorderWithKeyboard(page, items, fromIndex, toIndex);
  } else {
    await dragWithMouse(page, items.nth(fromIndex), items.nth(toIndex), { steps: 15 });
  }
}

/**
 * Reorder using keyboard (Space to grab, Arrow keys to move, Space to drop).
 * For accessible drag-and-drop implementations.
 */
async function reorderWithKeyboard(
  page: Page,
  items: Locator,
  fromIndex: number,
  toIndex: number,
): Promise<void> {
  const item = items.nth(fromIndex);
  await item.focus();
  await item.press('Space'); // Grab

  const direction = toIndex > fromIndex ? 'ArrowDown' : 'ArrowUp';
  const steps = Math.abs(toIndex - fromIndex);

  for (let i = 0; i < steps; i++) {
    await page.keyboard.press(direction);
    await page.waitForTimeout(100);
  }

  await page.keyboard.press('Space'); // Drop
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAG ASSERTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify that an element is draggable (has draggable attribute or role).
 */
export async function isDraggable(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => {
    const htmlEl = el as HTMLElement;
    return (
      htmlEl.draggable === true ||
      htmlEl.getAttribute('draggable') === 'true' ||
      htmlEl.getAttribute('role') === 'treeitem' ||
      htmlEl.getAttribute('aria-grabbed') !== null
    );
  });
}

/**
 * Verify that an element is a valid drop target.
 */
export async function isDropTarget(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => {
    const htmlEl = el as HTMLElement;
    return (
      htmlEl.getAttribute('role') === 'listbox' ||
      htmlEl.getAttribute('aria-dropeffect') !== null ||
      htmlEl.getAttribute('data-droppable') !== null ||
      htmlEl.classList.contains('droppable') ||
      htmlEl.classList.contains('drop-zone')
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function guessMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf',
    txt: 'text/plain', csv: 'text/csv', json: 'application/json',
    xml: 'application/xml', zip: 'application/zip', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    mp4: 'video/mp4', mp3: 'audio/mpeg',
  };
  return mimeMap[ext] || 'application/octet-stream';
}
