# Storage Helpers

Utilities for managing browser storage in Playwright tests. Covers localStorage, sessionStorage, cookies, IndexedDB, and full storage snapshots.

---

## localStorage

```typescript
import {
  getLocalStorage, setLocalStorage, removeLocalStorage, clearLocalStorage,
  getAllLocalStorage, setLocalStorageMultiple,
  getLocalStorageJson, setLocalStorageJson,
} from './src/main/utils';

// Read
const token = await getLocalStorage(page, 'access_token');
const user = await getLocalStorageJson<User>(page, 'current_user');

// Write
await setLocalStorage(page, 'theme', 'dark');
await setLocalStorageJson(page, 'user', { id: 1, name: 'Alice' });

// Bulk write
await setLocalStorageMultiple(page, { theme: 'dark', lang: 'en', sidebar: 'collapsed' });

// Delete
await removeLocalStorage(page, 'temp_data');
await clearLocalStorage(page);

// Get all
const all = await getAllLocalStorage(page);
// { theme: 'dark', lang: 'en', ... }
```

---

## sessionStorage

```typescript
import {
  getSessionStorage, setSessionStorage, clearSessionStorage,
  getSessionStorageJson, setSessionStorageJson,
} from './src/main/utils';

const token = await getSessionStorage(page, 'auth_token');
await setSessionStorage(page, 'cart_id', 'abc123');
await clearSessionStorage(page);
```

---

## Cookies

```typescript
import {
  getCookie, getCookieValue, getAllCookies,
  setCookie, deleteCookie, clearAllCookies, hasCookie,
} from './src/main/utils';

// Read
const session = await getCookie(page, 'session_id');
// { name: 'session_id', value: 'abc123', domain: 'example.com', path: '/' }

const value = await getCookieValue(page, 'session_id');
// 'abc123'

const exists = await hasCookie(page, 'session_id');

// Write
await setCookie(page, 'theme', 'dark');
await setCookie(page, 'session', 'abc123', {
  httpOnly: true,
  secure: true,
  sameSite: 'Strict',
  expires: Date.now() / 1000 + 3600, // 1 hour
});

// Delete
await deleteCookie(page, 'session_id');
await clearAllCookies(page.context());
```

---

## Storage Snapshots

Capture and restore the complete browser storage state. Useful for test isolation.

```typescript
import { captureStorageSnapshot, restoreStorageSnapshot } from './src/main/utils';

// Save state before test
const snapshot = await captureStorageSnapshot(page);

// ... run test that modifies storage ...

// Restore original state
await restoreStorageSnapshot(page, snapshot);
```

The snapshot includes:
- All `localStorage` entries
- All `sessionStorage` entries
- All cookies for the current context

---

## IndexedDB

```typescript
import { getIndexedDBNames, clearIndexedDBStore, deleteIndexedDB } from './src/main/utils';

// List all databases
const dbs = await getIndexedDBNames(page);
// ['myApp', 'cache', 'offline-data']

// Clear a specific store
await clearIndexedDBStore(page, 'myApp', 'users');

// Delete entire database
await deleteIndexedDB(page, 'cache');
```

---

## Storage Assertions

```typescript
import { expectLocalStorage, expectCookie } from './src/main/utils';

// Assert localStorage value
await expectLocalStorage(page, 'theme', 'dark');
await expectLocalStorage(page, 'token', /^Bearer .+/);
await expectLocalStorage(page, 'temp', null); // Assert key doesn't exist

// Assert cookie value
await expectCookie(page, 'session_id', 'abc123');
await expectCookie(page, 'user_role', /^(admin|editor)$/);
```

---

## Common Patterns

### Pre-populate storage before navigation

```typescript
test('dashboard loads with saved preferences', async ({ page }) => {
  await page.goto('/');
  await setLocalStorageMultiple(page, {
    theme: 'dark',
    sidebar: 'collapsed',
    language: 'en',
  });
  await page.reload();
  // Now test with pre-populated storage
});
```

### Verify storage after action

```typescript
test('login stores token', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', 'user@test.com');
  await page.fill('#password', 'secret');
  await page.click('button[type="submit"]');

  const token = await getLocalStorage(page, 'access_token');
  expect(token).toBeTruthy();
  expect(token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/); // JWT format
});
```
