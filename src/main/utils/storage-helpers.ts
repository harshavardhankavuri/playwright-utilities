import { type Page, type BrowserContext } from '@playwright/test';

/**
 * Storage Helpers — Utilities for managing browser storage in Playwright tests.
 *
 * Covers:
 * - localStorage read/write/clear
 * - sessionStorage read/write/clear
 * - Cookie management (get/set/delete)
 * - IndexedDB helpers
 * - Storage state snapshots and restore
 */

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL STORAGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a value from localStorage.
 *
 * Usage:
 *   const token = await getLocalStorage(page, 'access_token');
 */
export async function getLocalStorage(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key);
}

/**
 * Get a parsed JSON value from localStorage.
 *
 * Usage:
 *   const user = await getLocalStorageJson<User>(page, 'current_user');
 */
export async function getLocalStorageJson<T = unknown>(
  page: Page,
  key: string,
): Promise<T | null> {
  const raw = await getLocalStorage(page, key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Set a value in localStorage.
 *
 * Usage:
 *   await setLocalStorage(page, 'theme', 'dark');
 */
export async function setLocalStorage(page: Page, key: string, value: string): Promise<void> {
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, value]);
}

/**
 * Set a JSON-serializable value in localStorage.
 *
 * Usage:
 *   await setLocalStorageJson(page, 'user', { id: 1, name: 'Alice' });
 */
export async function setLocalStorageJson(page: Page, key: string, value: unknown): Promise<void> {
  await setLocalStorage(page, key, JSON.stringify(value));
}

/**
 * Remove a key from localStorage.
 */
export async function removeLocalStorage(page: Page, key: string): Promise<void> {
  await page.evaluate((k) => localStorage.removeItem(k), key);
}

/**
 * Clear all localStorage entries.
 */
export async function clearLocalStorage(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.clear());
}

/**
 * Get all localStorage entries as a key-value map.
 *
 * Usage:
 *   const all = await getAllLocalStorage(page);
 *   // { theme: 'dark', token: 'abc123', ... }
 */
export async function getAllLocalStorage(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const result: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) result[key] = localStorage.getItem(key) || '';
    }
    return result;
  });
}

/**
 * Set multiple localStorage entries at once.
 *
 * Usage:
 *   await setLocalStorageMultiple(page, { theme: 'dark', lang: 'en' });
 */
export async function setLocalStorageMultiple(
  page: Page,
  entries: Record<string, string>,
): Promise<void> {
  await page.evaluate((items) => {
    for (const [key, value] of Object.entries(items)) {
      localStorage.setItem(key, value);
    }
  }, entries);
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION STORAGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a value from sessionStorage.
 */
export async function getSessionStorage(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => sessionStorage.getItem(k), key);
}

/**
 * Get a parsed JSON value from sessionStorage.
 */
export async function getSessionStorageJson<T = unknown>(
  page: Page,
  key: string,
): Promise<T | null> {
  const raw = await getSessionStorage(page, key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Set a value in sessionStorage.
 */
export async function setSessionStorage(page: Page, key: string, value: string): Promise<void> {
  await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [key, value]);
}

/**
 * Set a JSON-serializable value in sessionStorage.
 */
export async function setSessionStorageJson(
  page: Page,
  key: string,
  value: unknown,
): Promise<void> {
  await setSessionStorage(page, key, JSON.stringify(value));
}

/**
 * Remove a key from sessionStorage.
 */
export async function removeSessionStorage(page: Page, key: string): Promise<void> {
  await page.evaluate((k) => sessionStorage.removeItem(k), key);
}

/**
 * Clear all sessionStorage entries.
 */
export async function clearSessionStorage(page: Page): Promise<void> {
  await page.evaluate(() => sessionStorage.clear());
}

/**
 * Get all sessionStorage entries as a key-value map.
 */
export async function getAllSessionStorage(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const result: Record<string, string> = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) result[key] = sessionStorage.getItem(key) || '';
    }
    return result;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// COOKIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a specific cookie by name.
 *
 * Usage:
 *   const session = await getCookie(page, 'session_id');
 */
export async function getCookie(
  page: Page,
  name: string,
): Promise<{ name: string; value: string; domain: string; path: string } | undefined> {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === name) as any;
}

/**
 * Get the value of a specific cookie.
 *
 * Usage:
 *   const value = await getCookieValue(page, 'session_id');
 */
export async function getCookieValue(page: Page, name: string): Promise<string | undefined> {
  const cookie = await getCookie(page, name);
  return cookie?.value;
}

/**
 * Get all cookies for the current page.
 */
export async function getAllCookies(page: Page): Promise<Array<{ name: string; value: string }>> {
  const cookies = await page.context().cookies();
  return cookies.map((c) => ({ name: c.name, value: c.value }));
}

/**
 * Set a cookie on the current page's domain.
 *
 * Usage:
 *   await setCookie(page, 'theme', 'dark');
 *   await setCookie(page, 'session', 'abc123', { httpOnly: true, secure: true });
 */
export async function setCookie(
  page: Page,
  name: string,
  value: string,
  options?: {
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  },
): Promise<void> {
  const url = page.url();
  const domain = options?.domain || new URL(url).hostname;

  await page.context().addCookies([{
    name,
    value,
    domain,
    path: options?.path || '/',
    expires: options?.expires,
    httpOnly: options?.httpOnly,
    secure: options?.secure,
    sameSite: options?.sameSite,
  }]);
}

/**
 * Delete a specific cookie.
 *
 * Usage:
 *   await deleteCookie(page, 'session_id');
 */
export async function deleteCookie(page: Page, name: string): Promise<void> {
  await page.context().clearCookies({ name });
}

/**
 * Clear all cookies for the current context.
 */
export async function clearAllCookies(context: BrowserContext): Promise<void> {
  await context.clearCookies();
}

/**
 * Check if a cookie exists.
 */
export async function hasCookie(page: Page, name: string): Promise<boolean> {
  const cookie = await getCookie(page, name);
  return cookie !== undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE SNAPSHOTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Snapshot of all browser storage (localStorage + sessionStorage + cookies).
 */
export interface StorageSnapshot {
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  cookies: Array<{ name: string; value: string; domain: string; path: string }>;
  capturedAt: number;
}

/**
 * Capture a full snapshot of all browser storage.
 * Useful for saving state before a test and restoring after.
 *
 * Usage:
 *   const snapshot = await captureStorageSnapshot(page);
 *   // ... run test that modifies storage ...
 *   await restoreStorageSnapshot(page, snapshot);
 */
export async function captureStorageSnapshot(page: Page): Promise<StorageSnapshot> {
  const [ls, ss, cookies] = await Promise.all([
    getAllLocalStorage(page),
    getAllSessionStorage(page),
    page.context().cookies(),
  ]);

  return {
    localStorage: ls,
    sessionStorage: ss,
    cookies: cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
    })),
    capturedAt: Date.now(),
  };
}

/**
 * Restore browser storage from a previously captured snapshot.
 *
 * Usage:
 *   await restoreStorageSnapshot(page, snapshot);
 */
export async function restoreStorageSnapshot(
  page: Page,
  snapshot: StorageSnapshot,
): Promise<void> {
  // Restore localStorage
  await clearLocalStorage(page);
  if (Object.keys(snapshot.localStorage).length > 0) {
    await setLocalStorageMultiple(page, snapshot.localStorage);
  }

  // Restore sessionStorage
  await clearSessionStorage(page);
  if (Object.keys(snapshot.sessionStorage).length > 0) {
    await page.evaluate((items) => {
      for (const [key, value] of Object.entries(items)) {
        sessionStorage.setItem(key, value);
      }
    }, snapshot.sessionStorage);
  }

  // Restore cookies
  await page.context().clearCookies();
  if (snapshot.cookies.length > 0) {
    await page.context().addCookies(snapshot.cookies as any);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INDEXEDDB HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all database names from IndexedDB.
 *
 * Usage:
 *   const dbs = await getIndexedDBNames(page);
 */
export async function getIndexedDBNames(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    if (!indexedDB.databases) return [];
    const dbs = await indexedDB.databases();
    return dbs.map((db) => db.name || '').filter(Boolean);
  });
}

/**
 * Clear all data from an IndexedDB store.
 *
 * Usage:
 *   await clearIndexedDBStore(page, 'myDatabase', 'users');
 */
export async function clearIndexedDBStore(
  page: Page,
  dbName: string,
  storeName: string,
): Promise<void> {
  await page.evaluate(
    ({ dbName, storeName }) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).clear();
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      });
    },
    { dbName, storeName },
  );
}

/**
 * Delete an entire IndexedDB database.
 *
 * Usage:
 *   await deleteIndexedDB(page, 'myDatabase');
 */
export async function deleteIndexedDB(page: Page, dbName: string): Promise<void> {
  await page.evaluate((name) => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }, dbName);
}

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE ASSERTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assert a localStorage key has a specific value.
 *
 * Usage:
 *   await expectLocalStorage(page, 'theme', 'dark');
 */
export async function expectLocalStorage(
  page: Page,
  key: string,
  expected: string | RegExp | null,
): Promise<void> {
  const value = await getLocalStorage(page, key);
  if (expected === null) {
    if (value !== null) {
      throw new Error(`Expected localStorage["${key}"] to be null, got "${value}"`);
    }
  } else if (typeof expected === 'string') {
    if (value !== expected) {
      throw new Error(`Expected localStorage["${key}"] = "${expected}", got "${value}"`);
    }
  } else {
    if (value === null || !expected.test(value)) {
      throw new Error(`Expected localStorage["${key}"] to match ${expected}, got "${value}"`);
    }
  }
}

/**
 * Assert a cookie has a specific value.
 *
 * Usage:
 *   await expectCookie(page, 'theme', 'dark');
 */
export async function expectCookie(
  page: Page,
  name: string,
  expected: string | RegExp,
): Promise<void> {
  const value = await getCookieValue(page, name);
  if (value === undefined) {
    throw new Error(`Cookie "${name}" not found`);
  }
  if (typeof expected === 'string') {
    if (value !== expected) {
      throw new Error(`Expected cookie "${name}" = "${expected}", got "${value}"`);
    }
  } else {
    if (!expected.test(value)) {
      throw new Error(`Expected cookie "${name}" to match ${expected}, got "${value}"`);
    }
  }
}
