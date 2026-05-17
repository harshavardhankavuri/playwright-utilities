import { type Page, type BrowserContext, type Browser } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Complete session state including cookies, localStorage, AND sessionStorage.
 * Playwright's built-in storageState only captures cookies + localStorage.
 * This extends it to also capture sessionStorage (critical for SPAs with tokens).
 */
export interface FullSessionState {
  /** Playwright's native storage state (cookies + localStorage) */
  storageState: {
    cookies: Array<Record<string, unknown>>;
    origins: Array<{
      origin: string;
      localStorage: Array<{ name: string; value: string }>;
    }>;
  };
  /** SessionStorage entries per origin (not captured by Playwright natively) */
  sessionStorage: Array<{
    origin: string;
    entries: Array<{ name: string; value: string }>;
  }>;
  /** Timestamp when this session was captured */
  capturedAt: number;
  /** Optional: when the session/token expires (epoch ms) */
  expiresAt?: number;
  /** Metadata about the session */
  metadata: {
    username?: string;
    role?: string;
    [key: string]: unknown;
  };
}

/**
 * Configuration for the login flow used to obtain a fresh session.
 */
export interface LoginConfig {
  /** Login page URL */
  url: string;
  /** Username/email to enter */
  username: string;
  /** Password to enter */
  password: string;
  /** Selector for username field. Default: auto-detect */
  usernameSelector?: string;
  /** Selector for password field. Default: auto-detect */
  passwordSelector?: string;
  /** Selector for submit button. Default: auto-detect */
  submitSelector?: string;
  /** URL pattern to wait for after successful login */
  successUrl?: string | RegExp;
  /** Custom login function (overrides selector-based login) */
  customLogin?: (page: Page) => Promise<void>;
}

/**
 * Configuration for the SessionManager.
 */
export interface SessionManagerOptions {
  /** Directory to store session files. Default: '.auth' */
  stateDir?: string;
  /** Session TTL in milliseconds. Default: 25 minutes (below typical 30min timeout) */
  sessionTTL?: number;
  /**
   * Key in sessionStorage/localStorage that holds the access token.
   * Used to detect token expiry. Default: auto-detect common patterns.
   */
  tokenKey?: string;
  /**
   * Key in sessionStorage/localStorage that holds the refresh token.
   * If present, the manager will attempt token refresh before re-login.
   */
  refreshTokenKey?: string;
  /**
   * URL endpoint for token refresh (POST with refresh token).
   * If set, the manager will call this to get a new access token.
   */
  refreshEndpoint?: string;
  /**
   * Function to extract token expiry from the token value (e.g. decode JWT exp).
   * Returns epoch ms when the token expires.
   */
  getTokenExpiry?: (token: string) => number | undefined;
  /**
   * Buffer time in ms before actual expiry to consider session "expired".
   * Default: 60_000 (1 minute buffer)
   */
  expiryBuffer?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION MANAGER
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<SessionManagerOptions> = {
  stateDir: path.resolve('.auth'),
  sessionTTL: 25 * 60 * 1000, // 25 minutes
  tokenKey: '',
  refreshTokenKey: '',
  refreshEndpoint: '',
  getTokenExpiry: defaultGetTokenExpiry,
  expiryBuffer: 60_000,
};

/**
 * SessionManager — Persist and restore full browser session state across tests.
 *
 * Solves the problem of session timeouts and refresh tokens in SPAs:
 * 1. Login once (via UI or API), capture FULL state (cookies + localStorage + sessionStorage)
 * 2. Before each test, check if session is still valid (token not expired)
 * 3. If valid → restore state (no login needed)
 * 4. If expired but refresh token exists → attempt token refresh
 * 5. If refresh fails or no refresh token → re-login and save new state
 *
 * Usage:
 *   // In global setup or auth fixture:
 *   const session = new SessionManager({
 *     tokenKey: 'access_token',
 *     refreshTokenKey: 'refresh_token',
 *     refreshEndpoint: '/api/auth/refresh',
 *   });
 *
 *   // Ensure authenticated (login if needed, reuse if valid):
 *   await session.ensure(page, 'admin', {
 *     url: '/login',
 *     username: 'admin@test.com',
 *     password: 'secret',
 *   });
 *
 *   // In test fixtures:
 *   test.beforeEach(async ({ page }) => {
 *     await session.restore(page, 'admin');
 *   });
 */
export class SessionManager {
  private readonly options: Required<SessionManagerOptions>;

  constructor(options?: SessionManagerOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.ensureDir(this.options.stateDir);
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Ensure a valid session exists for the given name.
   * - If a saved session exists and is still valid → does nothing (fast path)
   * - If session is expired but has refresh token → attempts refresh
   * - If no session or refresh fails → performs full login flow
   *
   * Call this in a global setup or beforeAll hook.
   */
  async ensure(page: Page, name: string, loginConfig: LoginConfig): Promise<void> {
    const state = this.loadState(name);

    if (state && this.isSessionValid(state)) {
      // Session is still valid, nothing to do
      return;
    }

    if (state && this.canRefresh(state)) {
      // Try to refresh the token
      const refreshed = await this.attemptRefresh(page, state, name);
      if (refreshed) return;
    }

    // Full login required
    await this.loginAndCapture(page, name, loginConfig);
  }

  /**
   * Restore a saved session into the current page/context.
   * Injects cookies, localStorage, AND sessionStorage.
   *
   * Call this in beforeEach to skip login for every test.
   *
   * Usage:
   *   test.beforeEach(async ({ page }) => {
   *     await sessionManager.restore(page, 'admin');
   *     await page.goto('/dashboard'); // Already authenticated
   *   });
   */
  async restore(page: Page, name: string): Promise<boolean> {
    const state = this.loadState(name);
    if (!state) return false;

    const context = page.context();

    // 1. Restore cookies
    if (state.storageState.cookies.length > 0) {
      await context.addCookies(state.storageState.cookies as any);
    }

    // 2. Navigate to the app origin to set storage (required for same-origin policy)
    for (const origin of state.storageState.origins) {
      await page.goto(origin.origin, { waitUntil: 'commit' });

      // Restore localStorage
      if (origin.localStorage.length > 0) {
        await page.evaluate((items) => {
          for (const { name, value } of items) {
            localStorage.setItem(name, value);
          }
        }, origin.localStorage);
      }
    }

    // 3. Restore sessionStorage (the key differentiator from Playwright's built-in)
    for (const origin of state.sessionStorage) {
      // Ensure we're on the right origin
      const currentUrl = page.url();
      if (!currentUrl.startsWith(origin.origin)) {
        await page.goto(origin.origin, { waitUntil: 'commit' });
      }

      if (origin.entries.length > 0) {
        await page.evaluate((items) => {
          for (const { name, value } of items) {
            sessionStorage.setItem(name, value);
          }
        }, origin.entries);
      }
    }

    return true;
  }

  /**
   * Capture the current page's full session state and save it.
   * Call this after a successful login to persist the session.
   */
  async capture(page: Page, name: string, metadata?: Record<string, unknown>): Promise<string> {
    const state = await this.captureState(page, metadata);
    return this.saveState(name, state);
  }

  /**
   * Perform login and capture the resulting session state.
   */
  async loginAndCapture(page: Page, name: string, config: LoginConfig): Promise<string> {
    // Perform login
    if (config.customLogin) {
      await config.customLogin(page);
    } else {
      await this.performLogin(page, config);
    }

    // Capture and save the authenticated state
    return this.capture(page, name, { username: config.username });
  }

  /**
   * Check if a saved session is still valid (not expired).
   */
  isValid(name: string): boolean {
    const state = this.loadState(name);
    return state ? this.isSessionValid(state) : false;
  }

  /**
   * Force invalidate a saved session (e.g. after logout test).
   */
  invalidate(name: string): void {
    const filePath = this.getStatePath(name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Get the Playwright-compatible storageState path for use with test.use().
   * Note: This only includes cookies + localStorage (Playwright's native format).
   * For full session restore (including sessionStorage), use restore() instead.
   */
  getStorageStatePath(name: string): string | undefined {
    const state = this.loadState(name);
    if (!state) return undefined;

    // Write a Playwright-compatible storageState file
    const filePath = path.join(this.options.stateDir, `${name}-playwright.json`);
    fs.writeFileSync(filePath, JSON.stringify(state.storageState, null, 2));
    return filePath;
  }

  /**
   * Get the remaining TTL of a session in milliseconds.
   * Returns 0 if expired or not found.
   */
  getRemainingTTL(name: string): number {
    const state = this.loadState(name);
    if (!state) return 0;

    if (state.expiresAt) {
      const remaining = state.expiresAt - Date.now() - this.options.expiryBuffer;
      return Math.max(0, remaining);
    }

    const elapsed = Date.now() - state.capturedAt;
    const remaining = this.options.sessionTTL - elapsed;
    return Math.max(0, remaining);
  }

  // ─── Internal: State Capture ────────────────────────────────────────────

  private async captureState(
    page: Page,
    metadata?: Record<string, unknown>,
  ): Promise<FullSessionState> {
    const context = page.context();

    // Capture Playwright's native storage state
    const storageState = await context.storageState();

    // Capture sessionStorage from all frames
    const sessionStorage = await this.captureSessionStorage(page);

    // Determine token expiry
    const expiresAt = this.detectTokenExpiry(storageState, sessionStorage);

    return {
      storageState,
      sessionStorage,
      capturedAt: Date.now(),
      expiresAt,
      metadata: metadata || {},
    };
  }

  /**
   * Capture sessionStorage from the current page.
   * sessionStorage is per-origin and per-tab, not included in Playwright's storageState.
   */
  private async captureSessionStorage(
    page: Page,
  ): Promise<FullSessionState['sessionStorage']> {
    const origin = new URL(page.url()).origin;

    const entries = await page.evaluate(() => {
      const items: Array<{ name: string; value: string }> = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          items.push({ name: key, value: sessionStorage.getItem(key) || '' });
        }
      }
      return items;
    });

    return [{ origin, entries }];
  }

  /**
   * Detect token expiry by examining stored tokens.
   */
  private detectTokenExpiry(
    storageState: FullSessionState['storageState'],
    sessionStorage: FullSessionState['sessionStorage'],
  ): number | undefined {
    const tokenKey = this.options.tokenKey;
    if (!tokenKey) return undefined;

    // Search in localStorage
    for (const origin of storageState.origins) {
      const item = origin.localStorage.find((i) => i.name === tokenKey);
      if (item) {
        return this.options.getTokenExpiry(item.value);
      }
    }

    // Search in sessionStorage
    for (const origin of sessionStorage) {
      const item = origin.entries.find((i) => i.name === tokenKey);
      if (item) {
        return this.options.getTokenExpiry(item.value);
      }
    }

    // Search in cookies
    const tokenCookie = storageState.cookies.find(
      (c: any) => c.name === tokenKey,
    );
    if (tokenCookie) {
      return this.options.getTokenExpiry((tokenCookie as any).value);
    }

    return undefined;
  }

  // ─── Internal: Validation & Refresh ─────────────────────────────────────

  private isSessionValid(state: FullSessionState): boolean {
    // Check explicit token expiry
    if (state.expiresAt) {
      return Date.now() < state.expiresAt - this.options.expiryBuffer;
    }

    // Fall back to TTL-based expiry
    const elapsed = Date.now() - state.capturedAt;
    return elapsed < this.options.sessionTTL;
  }

  private canRefresh(state: FullSessionState): boolean {
    if (!this.options.refreshTokenKey) return false;

    // Look for refresh token in localStorage
    for (const origin of state.storageState.origins) {
      if (origin.localStorage.find((i) => i.name === this.options.refreshTokenKey)) {
        return true;
      }
    }

    // Look in sessionStorage
    for (const origin of state.sessionStorage) {
      if (origin.entries.find((i) => i.name === this.options.refreshTokenKey)) {
        return true;
      }
    }

    // Look in cookies
    if (state.storageState.cookies.find((c: any) => c.name === this.options.refreshTokenKey)) {
      return true;
    }

    return false;
  }

  /**
   * Attempt to refresh the access token using the stored refresh token.
   * Returns true if refresh succeeded and new state was saved.
   */
  private async attemptRefresh(
    page: Page,
    state: FullSessionState,
    name: string,
  ): Promise<boolean> {
    if (!this.options.refreshEndpoint) return false;

    const refreshToken = this.findToken(state, this.options.refreshTokenKey);
    if (!refreshToken) return false;

    try {
      // Restore the current state first (so cookies are available)
      await this.restore(page, name);

      // Navigate to app origin
      const origin = state.sessionStorage[0]?.origin || state.storageState.origins[0]?.origin;
      if (origin) {
        await page.goto(origin, { waitUntil: 'commit' });
      }

      // Call the refresh endpoint from the page context (preserves cookies)
      const refreshResult = await page.evaluate(
        async ({ endpoint, token, tokenKey, refreshTokenKey }) => {
          try {
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: token, refresh_token: token }),
              credentials: 'include',
            });

            if (!res.ok) return { success: false };

            const data = await res.json();

            // Store new tokens (common response patterns)
            const newAccessToken = data.access_token || data.accessToken || data.token;
            const newRefreshToken = data.refresh_token || data.refreshToken;

            if (newAccessToken && tokenKey) {
              sessionStorage.setItem(tokenKey, newAccessToken);
              localStorage.setItem(tokenKey, newAccessToken);
            }
            if (newRefreshToken && refreshTokenKey) {
              sessionStorage.setItem(refreshTokenKey, newRefreshToken);
              localStorage.setItem(refreshTokenKey, newRefreshToken);
            }

            return { success: true };
          } catch {
            return { success: false };
          }
        },
        {
          endpoint: this.options.refreshEndpoint,
          token: refreshToken,
          tokenKey: this.options.tokenKey,
          refreshTokenKey: this.options.refreshTokenKey,
        },
      );

      if (refreshResult.success) {
        // Capture the refreshed state
        await this.capture(page, name, state.metadata);
        return true;
      }
    } catch {
      // Refresh failed, will fall through to full login
    }

    return false;
  }

  private findToken(state: FullSessionState, key: string): string | undefined {
    if (!key) return undefined;

    for (const origin of state.storageState.origins) {
      const item = origin.localStorage.find((i) => i.name === key);
      if (item) return item.value;
    }

    for (const origin of state.sessionStorage) {
      const item = origin.entries.find((i) => i.name === key);
      if (item) return item.value;
    }

    const cookie = state.storageState.cookies.find((c: any) => c.name === key);
    if (cookie) return (cookie as any).value;

    return undefined;
  }

  // ─── Internal: Login Flow ───────────────────────────────────────────────

  private async performLogin(page: Page, config: LoginConfig): Promise<void> {
    await page.goto(config.url);

    const usernameField = config.usernameSelector ||
      '[name="username"], [name="email"], [type="email"], #username, #email';
    const passwordField = config.passwordSelector ||
      '[name="password"], [type="password"], #password';
    const submitBtn = config.submitSelector ||
      'button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign in")';

    await page.locator(usernameField).first().fill(config.username);
    await page.locator(passwordField).first().fill(config.password);
    await page.locator(submitBtn).first().click();

    if (config.successUrl) {
      await page.waitForURL(config.successUrl, { timeout: 15_000 });
    } else {
      await page.waitForLoadState('networkidle');
    }

    // Wait a moment for tokens to be stored in sessionStorage/localStorage
    await page.waitForTimeout(1000);
  }

  // ─── Internal: File I/O ─────────────────────────────────────────────────

  private getStatePath(name: string): string {
    return path.join(this.options.stateDir, `${name}-session.json`);
  }

  private loadState(name: string): FullSessionState | null {
    const filePath = this.getStatePath(name);
    if (!fs.existsSync(filePath)) return null;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as FullSessionState;
    } catch {
      return null;
    }
  }

  private saveState(name: string, state: FullSessionState): string {
    const filePath = this.getStatePath(name);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
    return filePath;
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default JWT expiry extractor.
 * Decodes a JWT token and returns the `exp` claim as epoch milliseconds.
 */
function defaultGetTokenExpiry(token: string): number | undefined {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return undefined;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp) {
      // JWT exp is in seconds, convert to ms
      return payload.exp * 1000;
    }
  } catch {
    // Not a JWT or malformed
  }
  return undefined;
}
