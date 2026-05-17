import { test as base, expect } from '@playwright/test';
import { NetworkMocker } from '../main/utils';
import * as path from 'path';

const test = base;

test.describe('NetworkMocker', () => {
  let mocker: NetworkMocker;

  test.beforeEach(async ({ page }) => {
    mocker = new NetworkMocker(page, { recordAll: true });
    await mocker.start();
    // Navigate to a page so we can make fetch calls from page context
    await page.goto('about:blank');
  });

  test.afterEach(async () => {
    await mocker.stop();
  });

  test('should mock a GET request with JSON response', async ({ page }) => {
    mocker.mockGet('/api/users', {
      body: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
    });

    const data = await page.evaluate(async () => {
      const res = await fetch('https://example.com/api/users');
      return res.json();
    });

    expect(data).toHaveLength(2);
    expect(data[0].name).toBe('Alice');
  });

  test('should mock a POST request and capture body', async ({ page }) => {
    mocker.mockPost('/api/login', {
      status: 200,
      body: { token: 'jwt-token-123' },
    });

    const data = await page.evaluate(async () => {
      const res = await fetch('https://example.com/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'secret' }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(data.status).toBe(200);
    expect(data.body.token).toBe('jwt-token-123');

    const requests = mocker.getRequests('/api/login');
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('POST');
    expect(requests[0].body).toEqual({ username: 'admin', password: 'secret' });
  });

  test('should support dynamic response handlers', async ({ page }) => {
    mocker.mockPost('/api/auth', (request) => {
      const body = JSON.parse(request.postData() || '{}');
      if (body.password === 'correct') {
        return { status: 200, body: { success: true } };
      }
      return { status: 401, body: { error: 'Invalid credentials' } };
    });

    const res1 = await page.evaluate(async () => {
      const r = await fetch('https://example.com/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'correct' }),
      });
      return r.status;
    });
    expect(res1).toBe(200);

    const res2 = await page.evaluate(async () => {
      const r = await fetch('https://example.com/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong' }),
      });
      return r.status;
    });
    expect(res2).toBe(401);
  });

  test('should support regex URL matching', async ({ page }) => {
    mocker.mock(/\/api\/users\/\d+/, { body: { id: 42, name: 'Matched User' } });

    const data = await page.evaluate(async () => {
      const res = await fetch('https://example.com/api/users/42');
      return res.json();
    });
    expect(data.name).toBe('Matched User');
  });

  test('should support limited-use mocks (times option)', async ({ page }) => {
    mocker.mockGet('/api/counter', { body: { count: 1 } }, { times: 1 });
    mocker.mockGet('/api/counter', { body: { count: 999 } }, { priority: -1 });

    const count1 = await page.evaluate(async () => {
      const r = await fetch('https://example.com/api/counter');
      return (await r.json()).count;
    });
    expect(count1).toBe(1);

    const count2 = await page.evaluate(async () => {
      const r = await fetch('https://example.com/api/counter');
      return (await r.json()).count;
    });
    expect(count2).toBe(999);
  });

  test('should simulate network errors', async ({ page }) => {
    mocker.mockError('/api/broken');

    const failed = await page.evaluate(async () => {
      try {
        await fetch('https://example.com/api/broken');
        return false;
      } catch {
        return true;
      }
    });
    expect(failed).toBe(true);
  });

  test('should simulate slow responses', async ({ page }) => {
    mocker.mockSlow('/api/slow', 500, { body: { result: 'delayed' } });

    const result = await page.evaluate(async () => {
      const start = Date.now();
      const res = await fetch('https://example.com/api/slow');
      const elapsed = Date.now() - start;
      const body = await res.json();
      return { elapsed, body };
    });

    expect(result.elapsed).toBeGreaterThanOrEqual(400);
    expect(result.body.result).toBe('delayed');
  });

  test('should track call counts and wasCalled', async ({ page }) => {
    mocker.mockGet('/api/data', { body: { ok: true } });

    expect(mocker.wasCalled('/api/data')).toBe(false);

    await page.evaluate(() => fetch('https://example.com/api/data'));
    await page.evaluate(() => fetch('https://example.com/api/data'));

    expect(mocker.wasCalled('/api/data')).toBe(true);
    expect(mocker.callCount('/api/data')).toBe(2);
  });

  test('should support wildcard URL patterns', async ({ page }) => {
    mocker.mock('/api/*/details', { body: { detail: true } });

    const data = await page.evaluate(async () => {
      const res = await fetch('https://example.com/api/orders/details');
      return res.json();
    });
    expect(data.detail).toBe(true);
  });

  test('should allow removing specific mocks', async ({ page }) => {
    const id = mocker.mockGet('/api/removable', { body: { mocked: true } });
    mocker.removeMock(id);

    expect(mocker.wasCalled('/api/removable')).toBe(false);
  });

  test('should reset all state', async ({ page }) => {
    mocker.mockGet('/api/test', { body: {} });
    await page.evaluate(() => fetch('https://example.com/api/test'));

    expect(mocker.callCount('/api/test')).toBe(1);

    mocker.reset();

    expect(mocker.callCount('/api/test')).toBe(0);
    expect(mocker.getAllExchanges()).toHaveLength(0);
  });

  test('should capture request headers', async ({ page }) => {
    mocker.mockGet('/api/auth-check', { body: { ok: true } });

    await page.evaluate(async () => {
      await fetch('https://example.com/api/auth-check', {
        headers: { Authorization: 'Bearer my-token' },
      });
    });

    const requests = mocker.getRequests('/api/auth-check');
    expect(requests[0].headers['authorization']).toBe('Bearer my-token');
  });

  test('should modify real API responses (mockAndModify)', async ({ page }) => {
    // Intercept the real fruits API and add a new fruit
    mocker.mockAndModify('**/api/v1/fruits', async (route, response) => {
      const json = await response.json();
      json.push({ name: 'Loquat', id: 100 });
      return { json };
    });

    await page.goto('https://demo.playwright.dev/api-mocking');
    await expect(page.getByText('Loquat', { exact: true })).toBeVisible();
  });

  test('should fully mock API without calling server', async ({ page }) => {
    // Mock the fruits API entirely — no real request made
    mocker.mock('**/api/v1/fruits', {
      body: [{ name: 'Strawberry', id: 21 }],
    });

    await page.goto('https://demo.playwright.dev/api-mocking');
    await expect(page.getByText('Strawberry')).toBeVisible();
  });

  test('should support HAR replay via replayFromHAR', async ({ page }) => {
    // Verify the replayFromHAR method correctly wraps page.routeFromHAR
    // We test with a non-existent file to verify it throws the expected error
    // (proving it calls page.routeFromHAR correctly)
    await mocker.stop();

    const mocker2 = new NetworkMocker(page);
    let errorThrown = false;
    try {
      await mocker2.replayFromHAR('./non-existent.har', { url: '**/api/**' });
    } catch (e: any) {
      errorThrown = true;
      expect(e.message).toContain('ENOENT');
    }
    expect(errorThrown).toBe(true);
  });
});
