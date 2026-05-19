import { test, expect, type Post } from './fixtures';
import { configureAllure, allureStep } from '../../main/utils';

/**
 * Posts API — /posts
 *
 * Covers: GET list, GET by id, GET with filter, POST, PUT, PATCH, DELETE
 */
test.describe('Posts API @api', () => {
  test.beforeEach(async () => {
    await configureAllure({
      parentSuite: 'JSONPlaceholder',
      suite: 'Posts',
      tags: ['api', 'posts'],
    });
  });

  // ─── GET /posts ──────────────────────────────────────────────────────────

  test('GET /posts returns 100 posts', async ({ api }) => {
    await allureStep('Fetch all posts', async () => {
      const res = await api.get<Post[]>('/posts');

      api.expectStatus(res, 200);
      expect(res.ok).toBe(true);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(100);
    });
  });

  test('GET /posts response time is under 3s', async ({ api }) => {
    const res = await api.get<Post[]>('/posts');
    api.expectFasterThan(res, 3000);
  });

  test('GET /posts returns correct shape for each post', async ({ api }) => {
    const res = await api.get<Post[]>('/posts');
    api.expectStatus(res, 200);

    await allureStep('Validate post schema', async () => {
      for (const post of res.body.slice(0, 5)) {
        expect(typeof post.id).toBe('number');
        expect(typeof post.userId).toBe('number');
        expect(typeof post.title).toBe('string');
        expect(typeof post.body).toBe('string');
        expect(post.title.length).toBeGreaterThan(0);
      }
    });
  });

  // ─── GET /posts/:id ──────────────────────────────────────────────────────

  test('GET /posts/1 returns the correct post', async ({ api }) => {
    const res = await api.get<Post>('/posts/1');

    api.expectStatus(res, 200);
    api.expectBodyHasKeys(res, ['id', 'userId', 'title', 'body']);
    api.expectBodyContains(res, { id: 1, userId: 1 });

    expect(res.body.title).toBeTruthy();
    expect(res.body.body).toBeTruthy();
  });

  test('GET /posts/999 returns 404 for non-existent post', async ({ api }) => {
    const res = await api.get('/posts/999');
    api.expectStatus(res, 404);
    expect(res.ok).toBe(false);
  });

  // ─── GET /posts?userId=1 ─────────────────────────────────────────────────

  test('GET /posts?userId=1 filters posts by user', async ({ api }) => {
    const res = await api.get<Post[]>('/posts', { params: { userId: 1 } });

    api.expectStatus(res, 200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    await allureStep('Verify all posts belong to userId 1', async () => {
      for (const post of res.body) {
        expect(post.userId).toBe(1);
      }
    });
  });

  // ─── GET /posts/:id/comments ─────────────────────────────────────────────

  test('GET /posts/1/comments returns comments for post 1', async ({ api }) => {
    const res = await api.get<{ id: number; postId: number; email: string }[]>('/posts/1/comments');

    api.expectStatus(res, 200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    await allureStep('Verify all comments belong to postId 1', async () => {
      for (const comment of res.body) {
        expect(comment.postId).toBe(1);
        expect(comment.email).toMatch(/@/);
      }
    });
  });

  // ─── POST /posts ─────────────────────────────────────────────────────────

  test('POST /posts creates a new post', async ({ api }) => {
    const payload = { title: 'Test Post', body: 'Test body content', userId: 1 };

    const res = await api.post<Post>('/posts', payload);

    await allureStep('Verify created post', async () => {
      api.expectStatus(res, 201);
      expect(res.ok).toBe(true);
      expect(res.body.id).toBeTruthy();
      expect(res.body.title).toBe(payload.title);
      expect(res.body.body).toBe(payload.body);
      expect(res.body.userId).toBe(payload.userId);
    });
  });

  test('POST /posts with missing fields still returns 201 (JSONPlaceholder is lenient)', async ({ api }) => {
    const res = await api.post<Post>('/posts', { title: 'Minimal post' });
    api.expectStatus(res, 201);
    expect(res.body.id).toBeTruthy();
  });

  // ─── PUT /posts/:id ──────────────────────────────────────────────────────

  test('PUT /posts/1 replaces the post', async ({ api }) => {
    const payload = { id: 1, title: 'Updated Title', body: 'Updated body', userId: 1 };

    const res = await api.put<Post>('/posts/1', payload);

    await allureStep('Verify updated post', async () => {
      api.expectStatus(res, 200);
      api.expectBodyContains(res, { id: 1, title: 'Updated Title', userId: 1 });
    });
  });

  // ─── PATCH /posts/:id ────────────────────────────────────────────────────

  test('PATCH /posts/1 partially updates the post title', async ({ api }) => {
    const res = await api.patch<Post>('/posts/1', { title: 'Patched Title' });

    await allureStep('Verify patched title', async () => {
      api.expectStatus(res, 200);
      expect(res.body.title).toBe('Patched Title');
      // Other fields should still be present
      expect(res.body.id).toBe(1);
    });
  });

  // ─── DELETE /posts/:id ───────────────────────────────────────────────────

  test('DELETE /posts/1 returns 200', async ({ api }) => {
    const res = await api.delete('/posts/1');
    api.expectStatus(res, 200);
    expect(res.ok).toBe(true);
  });

  // ─── Response headers ────────────────────────────────────────────────────

  test('GET /posts response includes content-type application/json', async ({ api }) => {
    const res = await api.get('/posts/1');
    expect(res.headers['content-type']).toContain('application/json');
  });
});
