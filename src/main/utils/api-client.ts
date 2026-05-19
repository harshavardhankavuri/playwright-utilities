import { type APIRequestContext, type APIResponse, type Page } from '@playwright/test';

/**
 * API Client — Typed HTTP request helpers for API testing within Playwright.
 *
 * Features:
 * - Typed request/response with generics
 * - Auto-auth header injection
 * - Response validation helpers
 * - Request chaining (use response from call A as input to call B)
 * - Supports both page.request and standalone APIRequestContext
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiClientOptions {
  /** Base URL for all requests. Overrides context baseURL if set. */
  baseURL?: string;
  /** Default headers applied to every request */
  defaultHeaders?: Record<string, string>;
  /** Auth token to inject as Bearer header */
  bearerToken?: string;
  /** Timeout for requests in ms. Default: 30000 */
  timeout?: number;
}

export interface ApiResponse<T = unknown> {
  /** HTTP status code */
  status: number;
  /** Parsed JSON body (or null if not JSON) */
  body: T;
  /** Raw response headers */
  headers: Record<string, string>;
  /** Response time in ms */
  duration: number;
  /** Whether status is 2xx */
  ok: boolean;
  /** Raw Playwright APIResponse for advanced use */
  raw: APIResponse;
}

export interface RequestOptions {
  /** Additional headers for this request */
  headers?: Record<string, string>;
  /** Query parameters */
  params?: Record<string, string | number | boolean>;
  /** Request timeout override */
  timeout?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// API CLIENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ApiClient — Typed HTTP client for API testing in Playwright.
 *
 * Usage:
 *   const api = new ApiClient(page, { bearerToken: 'my-jwt' });
 *
 *   // Typed GET
 *   const { body, status } = await api.get<User[]>('/api/users');
 *
 *   // POST with body
 *   const { body: created } = await api.post<User>('/api/users', { name: 'Alice' });
 *
 *   // Chain requests
 *   const token = (await api.post<{token:string}>('/auth/login', creds)).body.token;
 *   const users = (await api.get<User[]>('/api/users', { headers: { Authorization: `Bearer ${token}` } })).body;
 */
export class ApiClient {
  private readonly request: APIRequestContext;
  private readonly options: Required<ApiClientOptions>;

  constructor(pageOrContext: Page | APIRequestContext, options?: ApiClientOptions) {
    this.request = 'request' in pageOrContext ? pageOrContext.request : pageOrContext;
    this.options = {
      baseURL: options?.baseURL || '',
      defaultHeaders: options?.defaultHeaders || {},
      bearerToken: options?.bearerToken || '',
      timeout: options?.timeout || 30_000,
    };
  }

  /**
   * Set or update the bearer token for subsequent requests.
   */
  setToken(token: string): this {
    this.options.bearerToken = token;
    return this;
  }

  /**
   * GET request with typed response.
   */
  async get<T = unknown>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.send<T>('GET', path, undefined, options);
  }

  /**
   * POST request with typed response.
   */
  async post<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.send<T>('POST', path, body, options);
  }

  /**
   * PUT request with typed response.
   */
  async put<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.send<T>('PUT', path, body, options);
  }

  /**
   * PATCH request with typed response.
   */
  async patch<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.send<T>('PATCH', path, body, options);
  }

  /**
   * DELETE request with typed response.
   */
  async delete<T = unknown>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.send<T>('DELETE', path, undefined, options);
  }

  // ─── Validation Helpers ─────────────────────────────────────────────────

  /**
   * Assert response status matches expected.
   */
  expectStatus<T>(response: ApiResponse<T>, expected: number): ApiResponse<T> {
    if (response.status !== expected) {
      throw new Error(
        `Expected status ${expected}, got ${response.status}. Body: ${JSON.stringify(response.body).slice(0, 200)}`,
      );
    }
    return response;
  }

  /**
   * Assert response body contains expected fields.
   */
  expectBodyContains<T>(
    response: ApiResponse<T>,
    fields: Partial<Record<string, unknown>>,
  ): ApiResponse<T> {
    for (const [key, expected] of Object.entries(fields)) {
      const actual = (response.body as Record<string, unknown>)[key];
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(
          `Expected body.${key} to be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        );
      }
    }
    return response;
  }

  /**
   * Assert response body has specific keys.
   */
  expectBodyHasKeys<T>(response: ApiResponse<T>, keys: string[]): ApiResponse<T> {
    const body = response.body as Record<string, unknown>;
    for (const key of keys) {
      if (!(key in body)) {
        throw new Error(`Expected body to have key "${key}", but it's missing. Keys: ${Object.keys(body).join(', ')}`);
      }
    }
    return response;
  }

  /**
   * Assert response body is an array with expected length.
   */
  expectArrayLength<T>(response: ApiResponse<T[]>, length: number): ApiResponse<T[]> {
    if (!Array.isArray(response.body)) {
      throw new Error(`Expected body to be an array, got ${typeof response.body}`);
    }
    if (response.body.length !== length) {
      throw new Error(`Expected array length ${length}, got ${response.body.length}`);
    }
    return response;
  }

  /**
   * Assert response time is within threshold.
   */
  expectFasterThan<T>(response: ApiResponse<T>, maxMs: number): ApiResponse<T> {
    if (response.duration > maxMs) {
      throw new Error(`Response took ${response.duration}ms, expected < ${maxMs}ms`);
    }
    return response;
  }

  // ─── Internal ───────────────────────────────────────────────────────────

  private async send<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path, options?.params);
    const headers = this.buildHeaders(options?.headers);
    const timeout = options?.timeout || this.options.timeout;

    const start = Date.now();

    const response = await this.request.fetch(url, {
      method,
      headers,
      data: body ? JSON.stringify(body) : undefined,
      timeout,
    });

    const duration = Date.now() - start;
    const status = response.status();
    const responseHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(response.headers())) {
      responseHeaders[key] = value;
    }

    let parsedBody: T;
    try {
      parsedBody = await response.json() as T;
    } catch {
      parsedBody = (await response.text()) as unknown as T;
    }

    return {
      status,
      body: parsedBody,
      headers: responseHeaders,
      duration,
      ok: status >= 200 && status < 300,
      raw: response,
    };
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean>): string {
    const base = this.options.baseURL ? `${this.options.baseURL}${path}` : path;
    if (!params || Object.keys(params).length === 0) return base;

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      searchParams.set(key, String(value));
    }
    return `${base}?${searchParams.toString()}`;
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...this.options.defaultHeaders,
      ...extra,
    };

    if (this.options.bearerToken) {
      headers['Authorization'] = `Bearer ${this.options.bearerToken}`;
    }

    return headers;
  }
}
