# Session Manager

**File:** `src/main/utils/session-manager.ts`

## Overview

SessionManager persists and restores full browser session state — cookies, localStorage, AND sessionStorage — across tests. It extends Playwright's built-in `storageState` (which only captures cookies + localStorage) by also handling sessionStorage, which is critical for SPAs that store JWT tokens there. Includes automatic JWT expiry detection and token refresh flow.

## How It Works

The session lifecycle:

1. **Login once** — Perform UI or API login, capture the full state (cookies + localStorage + sessionStorage).
2. **Before each test** — Check if the saved session is still valid (token not expired).
3. **If valid** → Restore state directly (no login needed, fast).
4. **If expired but refresh token exists** → Call the refresh endpoint to get a new access token.
5. **If refresh fails or no refresh token** → Re-login via UI and save new state.

### JWT Expiry Detection

The manager decodes JWT tokens (base64url payload) and reads the `exp` claim. A configurable buffer (default: 1 minute) ensures refresh happens before actual expiry.

### Storage Location

Sessions are saved as JSON files in `.auth/`:
```
.auth/
  admin-session.json
  viewer-session.json
```

## Configuration

```typescript
const session = new SessionManager({
  stateDir: '.auth',              // Directory for session files
  sessionTTL: 25 * 60 * 1000,    // Fallback TTL if no JWT exp (25 min)
  tokenKey: 'access_token',      // Key in storage holding the access token
  refreshTokenKey: 'refresh_token', // Key holding the refresh token
  refreshEndpoint: '/api/auth/refresh', // POST endpoint for token refresh
  getTokenExpiry: defaultGetTokenExpiry, // Custom expiry extractor
  expiryBuffer: 60_000,          // Buffer before actual expiry (1 min)
});
```

## Usage Examples

### Global setup — ensure authenticated

```typescript
// In global-setup.ts or auth fixture
const session = new SessionManager({
  tokenKey: 'access_token',
  refreshTokenKey: 'refresh_token',
  refreshEndpoint: '/api/auth/refresh',
});

await session.ensure(page, 'admin', {
  url: '/login',
  username: 'admin@test.com',
  password: 'secret',
  successUrl: /dashboard/,
});
```

### Restore in each test

```typescript
test.beforeEach(async ({ page }) => {
  await session.restore(page, 'admin');
  await page.goto('/dashboard'); // Already authenticated
});
```

### Custom login function

```typescript
await session.ensure(page, 'admin', {
  url: '/login',
  username: 'admin@test.com',
  password: 'secret',
  customLogin: async (page) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@test.com');
    await page.getByLabel('Password').fill('secret');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('/dashboard');
  },
});
```

### Multiple roles

```typescript
// Setup different sessions for different roles
await session.ensure(page, 'admin', adminLoginConfig);
await session.ensure(page, 'viewer', viewerLoginConfig);

// In tests, restore the appropriate role
test('admin can delete users', async ({ page }) => {
  await session.restore(page, 'admin');
  // ...
});

test('viewer cannot delete users', async ({ page }) => {
  await session.restore(page, 'viewer');
  // ...
});
```

### Check validity and TTL

```typescript
if (!session.isValid('admin')) {
  console.log('Session expired, will re-login');
}

const remaining = session.getRemainingTTL('admin');
console.log(`Session valid for ${remaining / 1000}s more`);
```

### Invalidate after logout test

```typescript
test('logout clears session', async ({ page }) => {
  await session.restore(page, 'admin');
  await page.click('#logout');
  session.invalidate('admin'); // Force re-login next time
});
```

### Playwright-compatible storageState path

```typescript
// For use with test.use({ storageState: ... })
const statePath = session.getStorageStatePath('admin');
// Note: this only includes cookies + localStorage (Playwright's format)
// For full restore including sessionStorage, use session.restore()
```

## Tips & Best Practices

- Use `session.ensure()` in `globalSetup` or a shared fixture — it handles the full login-or-reuse logic automatically.
- Set `sessionTTL` slightly below your server's actual timeout (e.g. 25 min for a 30 min server timeout) to avoid race conditions.
- Add `.auth/` to `.gitignore` — session files contain tokens and should not be committed.
- For parallel test workers, each worker should have its own session name (e.g. `admin-worker-${workerIndex}`) to avoid file conflicts.
- The `customLogin` option is preferred over selector-based login for complex auth flows (MFA, OAuth redirects, etc.).
