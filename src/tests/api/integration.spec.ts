import { test, expect, type Post, type Comment, type User, type Todo } from './fixtures';
import { configureAllure, allureStep, SoftAssert } from '../../main/utils';

/**
 * Integration tests — chain multiple API calls to verify cross-resource consistency.
 *
 * These tests exercise the ApiClient's request-chaining capability and validate
 * that related resources are consistent with each other.
 */
test.describe('API Integration — Cross-resource consistency @api @integration', () => {
  test.beforeEach(async () => {
    await configureAllure({
      parentSuite: 'JSONPlaceholder',
      suite: 'Integration',
      tags: ['api', 'integration'],
    });
  });

  test('user posts are consistent with /posts?userId filter', async ({ api }) => {
    const userId = 1;

    const [viaUser, viaFilter] = await Promise.all([
      api.get<Post[]>(`/users/${userId}/posts`),
      api.get<Post[]>('/posts', { params: { userId } }),
    ]);

    await allureStep('Both endpoints return the same posts', async () => {
      api.expectStatus(viaUser, 200);
      api.expectStatus(viaFilter, 200);

      expect(viaUser.body.length).toBe(viaFilter.body.length);

      const idsViaUser = viaUser.body.map((p) => p.id).sort();
      const idsViaFilter = viaFilter.body.map((p) => p.id).sort();
      expect(idsViaUser).toEqual(idsViaFilter);
    });
  });

  test('post comments are consistent with /comments?postId filter', async ({ api }) => {
    const postId = 3;

    const [viaPost, viaFilter] = await Promise.all([
      api.get<Comment[]>(`/posts/${postId}/comments`),
      api.get<Comment[]>('/comments', { params: { postId } }),
    ]);

    await allureStep('Both endpoints return the same comments', async () => {
      api.expectStatus(viaPost, 200);
      api.expectStatus(viaFilter, 200);

      expect(viaPost.body.length).toBe(viaFilter.body.length);

      const idsViaPost = viaPost.body.map((c) => c.id).sort();
      const idsViaFilter = viaFilter.body.map((c) => c.id).sort();
      expect(idsViaPost).toEqual(idsViaFilter);
    });
  });

  test('create post then verify it exists in the response', async ({ api }) => {
    const payload = { title: 'Integration test post', body: 'Created by integration test', userId: 5 };

    await allureStep('Create a new post', async () => {
      const created = await api.post<Post>('/posts', payload);
      api.expectStatus(created, 201);
      expect(created.body.id).toBeTruthy();
      expect(created.body.title).toBe(payload.title);
      expect(created.body.userId).toBe(payload.userId);
    });

    // JSONPlaceholder is a fake API — it doesn't persist, but we verify the
    // response contract is correct (id is assigned, fields are echoed back).
  });

  test('all post userIds reference valid users', async ({ api }) => {
    const [postsRes, usersRes] = await Promise.all([
      api.get<Post[]>('/posts'),
      api.get<User[]>('/users'),
    ]);

    api.expectStatus(postsRes, 200);
    api.expectStatus(usersRes, 200);

    await allureStep('Every post.userId maps to a real user', async () => {
      const validUserIds = new Set(usersRes.body.map((u) => u.id));
      const invalidPosts = postsRes.body.filter((p) => !validUserIds.has(p.userId));
      expect(invalidPosts).toHaveLength(0);
    });
  });

  test('all todo userIds reference valid users', async ({ api }) => {
    const [todosRes, usersRes] = await Promise.all([
      api.get<Todo[]>('/todos'),
      api.get<User[]>('/users'),
    ]);

    api.expectStatus(todosRes, 200);
    api.expectStatus(usersRes, 200);

    await allureStep('Every todo.userId maps to a real user', async () => {
      const validUserIds = new Set(usersRes.body.map((u) => u.id));
      const invalidTodos = todosRes.body.filter((t) => !validUserIds.has(t.userId));
      expect(invalidTodos).toHaveLength(0);
    });
  });

  test('soft-assert multiple fields on a single user response', async ({ api }) => {
    const res = await api.get<User>('/users/1');
    api.expectStatus(res, 200);

    const soft = new SoftAssert();

    // Use soft assertions to check all fields at once — see all failures together
    await soft.expectValue(res.body.id, 'id').toBe(1);
    await soft.expectValue(res.body.name, 'name').toBeTruthy();
    await soft.expectValue(res.body.email, 'email').toContain('@');
    await soft.expectValue(res.body.username, 'username').toBeTruthy();
    await soft.expectValue(res.body.address.city, 'city').toBeTruthy();
    await soft.expectValue(res.body.company.name, 'company.name').toBeTruthy();
    await soft.expectValue(res.ok, 'ok').toBe(true);

    soft.assertAll();
  });

  test('parallel requests complete within 5s total', async ({ api }) => {
    const start = Date.now();

    await Promise.all([
      api.get('/posts'),
      api.get('/users'),
      api.get('/todos'),
      api.get('/comments', { params: { postId: 1 } }),
    ]);

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test('CRUD lifecycle: create → patch → delete a post', async ({ api }) => {
    // CREATE
    const created = await allureStep('Create post', async () => {
      const res = await api.post<Post>('/posts', {
        title: 'Lifecycle test',
        body: 'Initial body',
        userId: 1,
      });
      api.expectStatus(res, 201);
      expect(res.body.id).toBeTruthy();
      return res.body;
    });

    // PATCH
    await allureStep('Patch post title', async () => {
      const res = await api.patch<Post>(`/posts/${created.id}`, { title: 'Updated title' });
      api.expectStatus(res, 200);
      expect(res.body.title).toBe('Updated title');
    });

    // DELETE
    await allureStep('Delete post', async () => {
      const res = await api.delete(`/posts/${created.id}`);
      api.expectStatus(res, 200);
    });
  });
});
