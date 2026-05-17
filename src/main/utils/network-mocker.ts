import { type Page, type Route, type Request, type BrowserContext, type WebSocketRoute } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A mock response definition.
 */
export interface MockResponse {
  /** HTTP status code. Default: 200 */
  status?: number;
  /** Response headers */
  headers?: Record<string, string>;
  /** Response body — string, object (auto-serialized to JSON), or Buffer */
  body?: string | Record<string, unknown> | unknown[] | Buffer;
  /** Content type. Default: 'application/json' for objects, 'text/plain' for strings */
  contentType?: string;
  /** Delay in ms before responding (simulates network latency) */
  delay?: number;
}

/**
 * A recorded network request captured during interception.
 */
export interface CapturedRequest {
  /** Full URL */
  url: string;
  /** HTTP method */
  method: string;
  /** Request headers */
  headers: Record<string, string>;
  /** Parsed request body (JSON if applicable, otherwise raw string) */
  body: unknown;
  /** Timestamp when the request was captured */
  timestamp: number;
  /** Resource type (xhr, fetch, document, etc.) */
  resourceType: string;
}

/**
 * A recorded response captured during interception.
 */
export interface CapturedResponse {
  /** HTTP status code */
  status: number;
  /** Response headers */
  headers: Record<string, string>;
  /** Response body */
  body: unknown;
  /** URL of the request */
  url: string;
}

/**
 * A full captured request/response pair.
 */
export interface CapturedExchange {
  request: CapturedRequest;
  response?: CapturedResponse;
}

/**
 * Condition function to match requests.
 */
export type RequestMatcher = (request: Request) => boolean;

/**
 * Dynamic response handler — receives the request and returns a mock response.
 */
export type DynamicResponseHandler = (request: Request) => MockResponse | Promise<MockResponse>;

/**
 * A registered mock rule.
 */
interface MockRule {
  id: string;
  matcher: RequestMatcher;
  response: MockResponse | DynamicResponseHandler;
  /** How many times this mock should be used. -1 = unlimited */
  times: number;
  /** How many times it has been used */
  usedCount: number;
  /** Priority (higher = matched first) */
  priority: number;
  /** Modifier function for mockAndModify rules (status -3) */
  _modifier?: (route: Route, response: any) => Promise<any>;
}

/**
 * Options for the NetworkMocker.
 */
export interface NetworkMockerOptions {
  /** Whether to record all requests (even non-mocked ones). Default: false */
  recordAll?: boolean;
  /** Default delay for all mock responses (ms). Default: 0 */
  defaultDelay?: number;
  /** Default headers added to all mock responses */
  defaultHeaders?: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// NETWORK MOCKER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * NetworkMocker — Advanced network interception and mocking utility for Playwright.
 *
 * Features:
 * - Mock API responses by URL pattern, method, headers, body content
 * - Dynamic response handlers (respond based on request data)
 * - Request recording and assertion helpers
 * - Simulate errors, timeouts, and slow networks
 * - HAR-style record & replay
 * - Chainable fluent API for setting up mocks
 * - Scoped to page or browser context
 *
 * Usage:
 *   const mocker = new NetworkMocker(page);
 *   await mocker.start();
 *
 *   mocker.mock('/api/users', { body: [{ id: 1, name: 'John' }] });
 *   mocker.mock('/api/login', (req) => {
 *     const body = JSON.parse(req.postData() || '{}');
 *     return body.password === 'secret'
 *       ? { status: 200, body: { token: 'abc' } }
 *       : { status: 401, body: { error: 'Invalid credentials' } };
 *   });
 *
 *   // After test actions...
 *   expect(mocker.wasCalled('/api/users')).toBe(true);
 *   expect(mocker.getRequests('/api/login')).toHaveLength(1);
 *
 *   await mocker.stop();
 */
export class NetworkMocker {
  private readonly page: Page;
  private readonly options: Required<NetworkMockerOptions>;
  private rules: MockRule[] = [];
  private captured: CapturedExchange[] = [];
  private isActive = false;
  private ruleIdCounter = 0;

  constructor(page: Page, options?: NetworkMockerOptions) {
    this.page = page;
    this.options = {
      recordAll: options?.recordAll ?? false,
      defaultDelay: options?.defaultDelay ?? 0,
      defaultHeaders: options?.defaultHeaders ?? {},
    };
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  /** Start intercepting network requests. */
  async start(): Promise<this> {
    if (this.isActive) return this;
    await this.page.route('**/*', (route) => this.handleRoute(route));
    this.isActive = true;
    return this;
  }

  /** Stop intercepting and clean up all routes. */
  async stop(): Promise<this> {
    if (!this.isActive) return this;
    await this.page.unroute('**/*');
    this.isActive = false;
    return this;
  }

  /** Reset all mocks and captured requests. */
  reset(): this {
    this.rules = [];
    this.captured = [];
    this.ruleIdCounter = 0;
    return this;
  }

  // ─── Mock Registration ──────────────────────────────────────────────────

  /**
   * Register a mock for requests matching a URL pattern.
   *
   * @param urlPattern - String (substring match), RegExp, or glob pattern
   * @param response - Static MockResponse or dynamic handler function
   * @param options - Additional matching/behavior options
   * @returns Rule ID for later removal
   */
  mock(
    urlPattern: string | RegExp,
    response: MockResponse | DynamicResponseHandler,
    options?: {
      method?: string;
      times?: number;
      priority?: number;
    },
  ): string {
    const matcher = this.buildMatcher(urlPattern, options?.method);
    const id = `mock-${++this.ruleIdCounter}`;

    this.rules.push({
      id,
      matcher,
      response,
      times: options?.times ?? -1,
      usedCount: 0,
      priority: options?.priority ?? 0,
    });

    // Sort by priority descending
    this.rules.sort((a, b) => b.priority - a.priority);
    return id;
  }

  /**
   * Mock a GET request.
   */
  mockGet(
    urlPattern: string | RegExp,
    response: MockResponse | DynamicResponseHandler,
    options?: { times?: number; priority?: number },
  ): string {
    return this.mock(urlPattern, response, { ...options, method: 'GET' });
  }

  /**
   * Mock a POST request.
   */
  mockPost(
    urlPattern: string | RegExp,
    response: MockResponse | DynamicResponseHandler,
    options?: { times?: number; priority?: number },
  ): string {
    return this.mock(urlPattern, response, { ...options, method: 'POST' });
  }

  /**
   * Mock a PUT request.
   */
  mockPut(
    urlPattern: string | RegExp,
    response: MockResponse | DynamicResponseHandler,
    options?: { times?: number; priority?: number },
  ): string {
    return this.mock(urlPattern, response, { ...options, method: 'PUT' });
  }

  /**
   * Mock a DELETE request.
   */
  mockDelete(
    urlPattern: string | RegExp,
    response: MockResponse | DynamicResponseHandler,
    options?: { times?: number; priority?: number },
  ): string {
    return this.mock(urlPattern, response, { ...options, method: 'DELETE' });
  }

  /**
   * Mock a PATCH request.
   */
  mockPatch(
    urlPattern: string | RegExp,
    response: MockResponse | DynamicResponseHandler,
    options?: { times?: number; priority?: number },
  ): string {
    return this.mock(urlPattern, response, { ...options, method: 'PATCH' });
  }

  // ─── Error Simulation ───────────────────────────────────────────────────

  /**
   * Simulate a network error for matching requests.
   */
  mockError(urlPattern: string | RegExp, options?: { method?: string; times?: number }): string {
    const matcher = this.buildMatcher(urlPattern, options?.method);
    const id = `mock-${++this.ruleIdCounter}`;

    this.rules.push({
      id,
      matcher,
      response: { status: 0 } as MockResponse, // Special: status 0 = abort
      times: options?.times ?? -1,
      usedCount: 0,
      priority: 10, // High priority for errors
    });

    this.rules.sort((a, b) => b.priority - a.priority);
    return id;
  }

  /**
   * Simulate a timeout (request hangs for specified duration then aborts).
   */
  mockTimeout(
    urlPattern: string | RegExp,
    timeoutMs: number = 30_000,
    options?: { method?: string; times?: number },
  ): string {
    const matcher = this.buildMatcher(urlPattern, options?.method);
    const id = `mock-${++this.ruleIdCounter}`;

    this.rules.push({
      id,
      matcher,
      response: { status: -1, delay: timeoutMs } as MockResponse, // Special: status -1 = timeout
      times: options?.times ?? -1,
      usedCount: 0,
      priority: 10,
    });

    this.rules.sort((a, b) => b.priority - a.priority);
    return id;
  }

  /**
   * Simulate slow network for matching requests.
   */
  mockSlow(
    urlPattern: string | RegExp,
    delayMs: number,
    response?: MockResponse,
    options?: { method?: string; times?: number },
  ): string {
    const finalResponse: MockResponse = { ...response, delay: delayMs };
    return this.mock(urlPattern, finalResponse, options);
  }

  // ─── Mock Management ────────────────────────────────────────────────────

  /** Remove a specific mock by its ID. */
  removeMock(id: string): boolean {
    const idx = this.rules.findIndex((r) => r.id === id);
    if (idx >= 0) {
      this.rules.splice(idx, 1);
      return true;
    }
    return false;
  }

  /** Remove all mocks (keeps captured requests). */
  clearMocks(): this {
    this.rules = [];
    return this;
  }

  // ─── Modify API Responses (Intercept + Patch) ────────────────────────────

  /**
   * Intercept a request, fetch the real response from the server, then modify it.
   * This is the "Modify API responses" pattern from Playwright docs.
   *
   * Usage:
   *   mocker.mockAndModify('/api/v1/fruits', async (route, response) => {
   *     const json = await response.json();
   *     json.push({ name: 'Loquat', id: 100 });
   *     return { json };
   *   });
   */
  mockAndModify(
    urlPattern: string | RegExp,
    modifier: (route: Route, response: Awaited<ReturnType<Route['fetch']>>) => Promise<{
      json?: unknown;
      body?: string | Buffer;
      headers?: Record<string, string>;
      status?: number;
    }>,
    options?: { method?: string; times?: number; priority?: number },
  ): string {
    const matcher = this.buildMatcher(urlPattern, options?.method);
    const id = `mock-${++this.ruleIdCounter}`;

    this.rules.push({
      id,
      matcher,
      response: { status: -3 } as MockResponse,
      times: options?.times ?? -1,
      usedCount: 0,
      priority: options?.priority ?? 5,
      _modifier: modifier,
    });

    this.rules.sort((a, b) => b.priority - a.priority);
    return id;
  }

  /**
   * Intercept a JSON API, fetch real response, and merge/override specific fields.
   * Simpler version of mockAndModify for common JSON patching.
   *
   * Usage:
   *   mocker.patchJson('/api/user/profile', { name: 'Overridden Name', verified: true });
   */
  patchJson(
    urlPattern: string | RegExp,
    patch: Record<string, unknown> | ((json: any) => any),
    options?: { method?: string; times?: number },
  ): string {
    return this.mockAndModify(urlPattern, async (route, response) => {
      const json = await response.json();
      if (typeof patch === 'function') {
        return { json: patch(json) };
      }
      // If response is array, patch doesn't apply directly — return as-is with additions
      if (Array.isArray(json)) {
        return { json };
      }
      return { json: { ...json, ...patch } };
    }, options);
  }

  // ─── HAR Record & Replay ────────────────────────────────────────────────

  /**
   * Replay API requests from a HAR file.
   * Matching responses from the HAR are served; unmatched requests are optionally aborted.
   *
   * This wraps Playwright's page.routeFromHAR() with a simpler API.
   *
   * Usage:
   *   await mocker.replayFromHAR('./hars/api.har', { url: '**/api/**' });
   */
  async replayFromHAR(
    harPath: string,
    options?: {
      /** Glob pattern to filter which requests are served from HAR */
      url?: string;
      /** If true, updates the HAR file with real responses instead of replaying */
      update?: boolean;
      /** What to do with unmatched requests: 'abort' or 'continue'. Default: 'abort' */
      notFound?: 'abort' | 'fallback';
    },
  ): Promise<this> {
    await this.page.routeFromHAR(harPath, {
      url: options?.url,
      update: options?.update ?? false,
      notFound: options?.notFound ?? 'abort',
    });
    return this;
  }

  /**
   * Record network traffic to a HAR file.
   * Navigate and interact with the page, then call saveHAR() to write the file.
   *
   * Usage:
   *   await mocker.recordHAR('./hars/api.har', { url: '**/api/**' });
   *   // ... navigate and interact ...
   *   // HAR is auto-saved when update: true is used with routeFromHAR
   */
  async recordHAR(
    harPath: string,
    options?: { url?: string },
  ): Promise<this> {
    await this.page.routeFromHAR(harPath, {
      url: options?.url,
      update: true,
    });
    return this;
  }

  // ─── WebSocket Mocking ──────────────────────────────────────────────────

  /**
   * Mock a WebSocket connection entirely (no real server connection).
   *
   * Usage:
   *   mocker.mockWebSocket('wss://example.com/ws', (ws) => {
   *     ws.onMessage((message) => {
   *       if (message === 'ping') ws.send('pong');
   *     });
   *   });
   */
  async mockWebSocket(
    url: string | RegExp,
    handler: (ws: WebSocketRoute) => void,
  ): Promise<this> {
    await this.page.routeWebSocket(url, handler);
    return this;
  }

  /**
   * Intercept a WebSocket and proxy to the real server, with message modification.
   *
   * Usage:
   *   mocker.interceptWebSocket('wss://example.com/ws', (ws) => {
   *     const server = ws.connectToServer();
   *     ws.onMessage((message) => {
   *       // Modify outgoing messages
   *       server.send(message === 'request' ? 'modified-request' : message);
   *     });
   *     server.onMessage((message) => {
   *       // Modify incoming messages
   *       ws.send(message);
   *     });
   *   });
   */
  async interceptWebSocket(
    url: string | RegExp,
    handler: (ws: WebSocketRoute) => void,
  ): Promise<this> {
    await this.page.routeWebSocket(url, handler);
    return this;
  }

  // ─── Request Inspection & Assertions ────────────────────────────────────

  /** Get all captured request/response exchanges. */
  getAllExchanges(): CapturedExchange[] {
    return [...this.captured];
  }

  /** Get captured requests matching a URL pattern. */
  getRequests(urlPattern?: string | RegExp): CapturedRequest[] {
    if (!urlPattern) return this.captured.map((e) => e.request);
    const matcher = this.buildUrlMatcher(urlPattern);
    return this.captured
      .filter((e) => matcher(e.request.url))
      .map((e) => e.request);
  }

  /** Get the last captured request matching a URL pattern. */
  getLastRequest(urlPattern?: string | RegExp): CapturedRequest | undefined {
    const requests = this.getRequests(urlPattern);
    return requests[requests.length - 1];
  }

  /** Check if a URL was called at least once. */
  wasCalled(urlPattern: string | RegExp): boolean {
    return this.getRequests(urlPattern).length > 0;
  }

  /** Get the number of times a URL was called. */
  callCount(urlPattern: string | RegExp): number {
    return this.getRequests(urlPattern).length;
  }

  /**
   * Wait for a request matching the pattern to be captured.
   * Useful for asserting async requests after user actions.
   */
  async waitForRequest(
    urlPattern: string | RegExp,
    options?: { method?: string; timeout?: number },
  ): Promise<CapturedRequest> {
    const matcher = this.buildMatcher(urlPattern, options?.method);
    const timeout = options?.timeout ?? 10_000;

    // Check if already captured
    const existing = this.captured.find((e) => matcher(e.request as unknown as Request));
    if (existing) return existing.request;

    // Wait for it
    const request = await this.page.waitForRequest(
      (req) => matcher(req),
      { timeout },
    );

    return this.captureRequest(request);
  }

  /** Clear all captured requests. */
  clearCaptured(): this {
    this.captured = [];
    return this;
  }

  /**
   * Get request bodies for a URL pattern (parsed as JSON where possible).
   */
  getRequestBodies(urlPattern: string | RegExp): unknown[] {
    return this.getRequests(urlPattern).map((r) => r.body);
  }

  /**
   * Get request headers for a URL pattern.
   */
  getRequestHeaders(urlPattern: string | RegExp): Record<string, string>[] {
    return this.getRequests(urlPattern).map((r) => r.headers);
  }

  // ─── Passthrough with Recording ─────────────────────────────────────────

  /**
   * Let requests through to the real server but record them.
   * Useful for capturing real API responses to use as mock data later.
   */
  record(urlPattern: string | RegExp, options?: { method?: string }): string {
    const matcher = this.buildMatcher(urlPattern, options?.method);
    const id = `mock-${++this.ruleIdCounter}`;

    this.rules.push({
      id,
      matcher,
      response: { status: -2 } as MockResponse, // Special: -2 = passthrough + record
      times: -1,
      usedCount: 0,
      priority: -1, // Low priority so other mocks take precedence
    });

    this.rules.sort((a, b) => b.priority - a.priority);
    return id;
  }

  // ─── Internal: Route Handler ────────────────────────────────────────────

  private async handleRoute(route: Route): Promise<void> {
    const request = route.request();

    // Find matching rule
    const rule = this.findMatchingRule(request);

    if (!rule) {
      // No mock matched
      if (this.options.recordAll) {
        this.captured.push({ request: this.captureRequest(request) });
      }
      await route.continue();
      return;
    }

    // Increment usage
    rule.usedCount++;

    // Remove if times limit reached
    if (rule.times > 0 && rule.usedCount >= rule.times) {
      this.rules = this.rules.filter((r) => r.id !== rule.id);
    }

    // Capture the request
    const capturedReq = this.captureRequest(request);

    // Resolve the response
    const mockResponse = typeof rule.response === 'function'
      ? await rule.response(request)
      : rule.response;

    // Handle special statuses
    if (mockResponse.status === 0) {
      // Abort (network error)
      this.captured.push({ request: capturedReq });
      await route.abort('failed');
      return;
    }

    if (mockResponse.status === -1) {
      // Timeout simulation
      this.captured.push({ request: capturedReq });
      await new Promise((resolve) => setTimeout(resolve, mockResponse.delay || 30_000));
      await route.abort('timedout');
      return;
    }

    if (mockResponse.status === -2) {
      // Passthrough + record
      const response = await route.fetch();
      const body = await response.body();
      this.captured.push({
        request: capturedReq,
        response: {
          status: response.status(),
          headers: response.headers(),
          body: this.tryParseJson(body.toString()),
          url: request.url(),
        },
      });
      await route.fulfill({ response });
      return;
    }

    if (mockResponse.status === -3) {
      // Modify response: fetch real, apply modifier, fulfill with patched data
      const modifier = (rule as any)._modifier;
      const response = await route.fetch();
      const modifications = await modifier(route, response);
      const fulfillOptions: Record<string, unknown> = { response };
      if (modifications.json !== undefined) fulfillOptions.json = modifications.json;
      if (modifications.body !== undefined) fulfillOptions.body = modifications.body;
      if (modifications.headers !== undefined) fulfillOptions.headers = modifications.headers;
      if (modifications.status !== undefined) fulfillOptions.status = modifications.status;

      this.captured.push({
        request: capturedReq,
        response: {
          status: modifications.status ?? response.status(),
          headers: modifications.headers ?? response.headers(),
          body: modifications.json ?? this.tryParseJson((await response.body()).toString()),
          url: request.url(),
        },
      });

      await route.fulfill(fulfillOptions as any);
      return;
    }

    // Apply delay
    const delay = mockResponse.delay ?? this.options.defaultDelay;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Build response
    const { status, headers, bodyBuffer, contentType } = this.buildResponse(mockResponse);

    this.captured.push({
      request: capturedReq,
      response: {
        status,
        headers: headers,
        body: this.tryParseJson(bodyBuffer.toString()),
        url: request.url(),
      },
    });

    await route.fulfill({
      status,
      headers: { ...headers, 'content-type': contentType },
      body: bodyBuffer,
    });
  }

  // ─── Internal: Matching ─────────────────────────────────────────────────

  private findMatchingRule(request: Request): MockRule | undefined {
    return this.rules.find((rule) => {
      if (rule.times > 0 && rule.usedCount >= rule.times) return false;
      return rule.matcher(request);
    });
  }

  private buildMatcher(urlPattern: string | RegExp, method?: string): RequestMatcher {
    const urlMatcher = this.buildUrlMatcher(urlPattern);
    return (request: Request) => {
      if (method && request.method().toUpperCase() !== method.toUpperCase()) return false;
      return urlMatcher(request.url());
    };
  }

  private buildUrlMatcher(urlPattern: string | RegExp): (url: string) => boolean {
    if (urlPattern instanceof RegExp) {
      return (url: string) => urlPattern.test(url);
    }
    // String: treat as substring match (supports glob-like * wildcards)
    if (urlPattern.includes('*')) {
      const regexStr = urlPattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      const regex = new RegExp(regexStr, 'i');
      return (url: string) => regex.test(url);
    }
    return (url: string) => url.includes(urlPattern);
  }

  // ─── Internal: Response Building ────────────────────────────────────────

  private buildResponse(mock: MockResponse): {
    status: number;
    headers: Record<string, string>;
    bodyBuffer: Buffer;
    contentType: string;
  } {
    const status = mock.status ?? 200;
    const headers: Record<string, string> = {
      ...this.options.defaultHeaders,
      ...mock.headers,
    };

    let bodyBuffer: Buffer;
    let contentType: string;

    if (Buffer.isBuffer(mock.body)) {
      bodyBuffer = mock.body;
      contentType = mock.contentType || 'application/octet-stream';
    } else if (typeof mock.body === 'object' && mock.body !== null) {
      bodyBuffer = Buffer.from(JSON.stringify(mock.body));
      contentType = mock.contentType || 'application/json';
    } else if (typeof mock.body === 'string') {
      bodyBuffer = Buffer.from(mock.body);
      contentType = mock.contentType || 'text/plain';
    } else {
      bodyBuffer = Buffer.from('');
      contentType = mock.contentType || 'text/plain';
    }

    return { status, headers, bodyBuffer, contentType };
  }

  // ─── Internal: Capture ──────────────────────────────────────────────────

  private captureRequest(request: Request): CapturedRequest {
    const postData = request.postData();
    return {
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      body: this.tryParseJson(postData || ''),
      timestamp: Date.now(),
      resourceType: request.resourceType(),
    };
  }

  private tryParseJson(str: string): unknown {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }
}
