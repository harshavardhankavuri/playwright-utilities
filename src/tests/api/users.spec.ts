import { test, expect, type User, type Post, type Album, type Todo } from './fixtures';
import { configureAllure, allureStep } from '../../main/utils';

/**
 * Users API — /users
 *
 * Covers: GET list, GET by id, nested resources (posts, albums, todos)
 */
test.describe('Users API @api', () => {
  test.beforeEach(async () => {
    await configureAllure({
      parentSuite: 'JSONPlaceholder',
      suite: 'Users',
      tags: ['api', 'users'],
    });
  });

  // ─── GET /users ──────────────────────────────────────────────────────────

  test('GET /users returns 10 users', async ({ api }) => {
    const res = await api.get<User[]>('/users');

    api.expectStatus(res, 200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(10);
  });

  test('GET /users returns correct user shape', async ({ api }) => {
    const res = await api.get<User[]>('/users');
    api.expectStatus(res, 200);

    await allureStep('Validate user schema', async () => {
      for (const user of res.body) {
        expect(typeof user.id).toBe('number');
        expect(typeof user.name).toBe('string');
        expect(typeof user.username).toBe('string');
        expect(user.email).toMatch(/@/);
        expect(typeof user.address).toBe('object');
        expect(typeof user.address.city).toBe('string');
        expect(typeof user.company).toBe('object');
        expect(typeof user.company.name).toBe('string');
      }
    });
  });

  // ─── GET /users/:id ──────────────────────────────────────────────────────

  test('GET /users/1 returns user with id 1', async ({ api }) => {
    const res = await api.get<User>('/users/1');

    api.expectStatus(res, 200);
    api.expectBodyHasKeys(res, ['id', 'name', 'username', 'email', 'address', 'phone', 'website', 'company']);
    api.expectBodyContains(res, { id: 1 });

    await allureStep('Validate nested address and company', async () => {
      expect(res.body.address.geo.lat).toBeTruthy();
      expect(res.body.address.geo.lng).toBeTruthy();
      expect(res.body.company.catchPhrase).toBeTruthy();
    });
  });

  test('GET /users/999 returns 404', async ({ api }) => {
    const res = await api.get('/users/999');
    api.expectStatus(res, 404);
  });

  // ─── GET /users/:id/posts ─────────────────────────────────────────────────

  test('GET /users/1/posts returns posts for user 1', async ({ api }) => {
    const res = await api.get<Post[]>('/users/1/posts');

    api.expectStatus(res, 200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    await allureStep('All posts belong to userId 1', async () => {
      for (const post of res.body) {
        expect(post.userId).toBe(1);
      }
    });
  });

  // ─── GET /users/:id/albums ────────────────────────────────────────────────

  test('GET /users/1/albums returns albums for user 1', async ({ api }) => {
    const res = await api.get<Album[]>('/users/1/albums');

    api.expectStatus(res, 200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    await allureStep('All albums belong to userId 1', async () => {
      for (const album of res.body) {
        expect(album.userId).toBe(1);
        expect(typeof album.title).toBe('string');
      }
    });
  });

  // ─── GET /users/:id/todos ─────────────────────────────────────────────────

  test('GET /users/1/todos returns todos for user 1', async ({ api }) => {
    const res = await api.get<Todo[]>('/users/1/todos');

    api.expectStatus(res, 200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    await allureStep('Validate todo shape and userId', async () => {
      for (const todo of res.body) {
        expect(todo.userId).toBe(1);
        expect(typeof todo.title).toBe('string');
        expect(typeof todo.completed).toBe('boolean');
      }
    });
  });

  // ─── Email uniqueness ─────────────────────────────────────────────────────

  test('all users have unique email addresses', async ({ api }) => {
    const res = await api.get<User[]>('/users');
    api.expectStatus(res, 200);

    await allureStep('Check email uniqueness', async () => {
      const emails = res.body.map((u) => u.email.toLowerCase());
      const unique = new Set(emails);
      expect(unique.size).toBe(emails.length);
    });
  });

  // ─── Username uniqueness ──────────────────────────────────────────────────

  test('all users have unique usernames', async ({ api }) => {
    const res = await api.get<User[]>('/users');
    api.expectStatus(res, 200);

    const usernames = res.body.map((u) => u.username);
    const unique = new Set(usernames);
    expect(unique.size).toBe(usernames.length);
  });
});
