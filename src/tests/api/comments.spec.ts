import { test, expect, type Comment } from './fixtures';
import { configureAllure, allureStep } from '../../main/utils';

/**
 * Comments API — /comments
 *
 * Covers: GET list, GET by id, GET filtered by postId, schema validation
 */
test.describe('Comments API @api', () => {
  test.beforeEach(async () => {
    await configureAllure({
      parentSuite: 'JSONPlaceholder',
      suite: 'Comments',
      tags: ['api', 'comments'],
    });
  });

  // ─── GET /comments ───────────────────────────────────────────────────────

  test('GET /comments returns 500 comments', async ({ api }) => {
    const res = await api.get<Comment[]>('/comments');

    api.expectStatus(res, 200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(500);
  });

  test('GET /comments returns correct shape', async ({ api }) => {
    const res = await api.get<Comment[]>('/comments');
    api.expectStatus(res, 200);

    await allureStep('Validate comment schema on first 5 items', async () => {
      for (const comment of res.body.slice(0, 5)) {
        expect(typeof comment.id).toBe('number');
        expect(typeof comment.postId).toBe('number');
        expect(typeof comment.name).toBe('string');
        expect(comment.email).toMatch(/@/);
        expect(typeof comment.body).toBe('string');
        expect(comment.body.length).toBeGreaterThan(0);
      }
    });
  });

  // ─── GET /comments/:id ───────────────────────────────────────────────────

  test('GET /comments/1 returns comment with id 1', async ({ api }) => {
    const res = await api.get<Comment>('/comments/1');

    api.expectStatus(res, 200);
    api.expectBodyHasKeys(res, ['id', 'postId', 'name', 'email', 'body']);
    api.expectBodyContains(res, { id: 1 });
  });

  test('GET /comments/999 returns 404', async ({ api }) => {
    const res = await api.get('/comments/999');
    api.expectStatus(res, 404);
  });

  // ─── GET /comments?postId=1 ──────────────────────────────────────────────

  test('GET /comments?postId=1 returns only comments for post 1', async ({ api }) => {
    const res = await api.get<Comment[]>('/comments', { params: { postId: 1 } });

    api.expectStatus(res, 200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    await allureStep('All comments belong to postId 1', async () => {
      for (const comment of res.body) {
        expect(comment.postId).toBe(1);
      }
    });
  });

  test('GET /comments?postId=1 returns 5 comments', async ({ api }) => {
    const res = await api.get<Comment[]>('/comments', { params: { postId: 1 } });
    api.expectStatus(res, 200);
    // JSONPlaceholder has exactly 5 comments per post
    expect(res.body).toHaveLength(5);
  });

  // ─── Email format validation ──────────────────────────────────────────────

  test('all comments have valid email format', async ({ api }) => {
    const res = await api.get<Comment[]>('/comments', { params: { postId: 2 } });
    api.expectStatus(res, 200);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    await allureStep('Validate email format', async () => {
      for (const comment of res.body) {
        expect(comment.email).toMatch(emailRegex);
      }
    });
  });
});
