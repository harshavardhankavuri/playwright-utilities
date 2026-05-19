import { test, expect, type Todo } from './fixtures';
import { configureAllure, allureStep } from '../../main/utils';

/**
 * Todos API — /todos
 *
 * Covers: GET list, GET by id, filter by userId/completed, CRUD, data integrity
 */
test.describe('Todos API @api', () => {
  test.beforeEach(async () => {
    await configureAllure({
      parentSuite: 'JSONPlaceholder',
      suite: 'Todos',
      tags: ['api', 'todos'],
    });
  });

  // ─── GET /todos ──────────────────────────────────────────────────────────

  test('GET /todos returns 200 todos', async ({ api }) => {
    const res = await api.get<Todo[]>('/todos');

    api.expectStatus(res, 200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(200);
  });

  test('GET /todos returns correct shape', async ({ api }) => {
    const res = await api.get<Todo[]>('/todos');
    api.expectStatus(res, 200);

    await allureStep('Validate todo schema', async () => {
      for (const todo of res.body.slice(0, 10)) {
        expect(typeof todo.id).toBe('number');
        expect(typeof todo.userId).toBe('number');
        expect(typeof todo.title).toBe('string');
        expect(typeof todo.completed).toBe('boolean');
      }
    });
  });

  // ─── GET /todos/:id ──────────────────────────────────────────────────────

  test('GET /todos/1 returns todo with id 1', async ({ api }) => {
    const res = await api.get<Todo>('/todos/1');

    api.expectStatus(res, 200);
    api.expectBodyHasKeys(res, ['id', 'userId', 'title', 'completed']);
    api.expectBodyContains(res, { id: 1 });
  });

  test('GET /todos/999 returns 404', async ({ api }) => {
    const res = await api.get('/todos/999');
    api.expectStatus(res, 404);
  });

  // ─── GET /todos?userId=1 ─────────────────────────────────────────────────

  test('GET /todos?userId=1 returns only todos for user 1', async ({ api }) => {
    const res = await api.get<Todo[]>('/todos', { params: { userId: 1 } });

    api.expectStatus(res, 200);
    expect(res.body.length).toBeGreaterThan(0);

    await allureStep('All todos belong to userId 1', async () => {
      for (const todo of res.body) {
        expect(todo.userId).toBe(1);
      }
    });
  });

  // ─── GET /todos?completed=true ───────────────────────────────────────────

  test('GET /todos?completed=true returns only completed todos', async ({ api }) => {
    const res = await api.get<Todo[]>('/todos', { params: { completed: true } });

    api.expectStatus(res, 200);
    expect(res.body.length).toBeGreaterThan(0);

    await allureStep('All returned todos are completed', async () => {
      for (const todo of res.body) {
        expect(todo.completed).toBe(true);
      }
    });
  });

  test('GET /todos?completed=false returns only incomplete todos', async ({ api }) => {
    const res = await api.get<Todo[]>('/todos', { params: { completed: false } });

    api.expectStatus(res, 200);
    expect(res.body.length).toBeGreaterThan(0);

    for (const todo of res.body) {
      expect(todo.completed).toBe(false);
    }
  });

  // ─── Data integrity ───────────────────────────────────────────────────────

  test('completed + incomplete todos add up to total', async ({ api }) => {
    const [all, completed, incomplete] = await Promise.all([
      api.get<Todo[]>('/todos'),
      api.get<Todo[]>('/todos', { params: { completed: true } }),
      api.get<Todo[]>('/todos', { params: { completed: false } }),
    ]);

    await allureStep('Verify counts add up', async () => {
      expect(completed.body.length + incomplete.body.length).toBe(all.body.length);
    });
  });

  // ─── POST /todos ─────────────────────────────────────────────────────────

  test('POST /todos creates a new todo', async ({ api }) => {
    const payload = { title: 'Buy groceries', completed: false, userId: 1 };

    const res = await api.post<Todo>('/todos', payload);

    await allureStep('Verify created todo', async () => {
      api.expectStatus(res, 201);
      expect(res.body.id).toBeTruthy();
      expect(res.body.title).toBe(payload.title);
      expect(res.body.completed).toBe(false);
      expect(res.body.userId).toBe(1);
    });
  });

  // ─── PATCH /todos/:id ────────────────────────────────────────────────────

  test('PATCH /todos/1 marks todo as completed', async ({ api }) => {
    const res = await api.patch<Todo>('/todos/1', { completed: true });

    api.expectStatus(res, 200);
    expect(res.body.completed).toBe(true);
    expect(res.body.id).toBe(1);
  });

  // ─── DELETE /todos/:id ───────────────────────────────────────────────────

  test('DELETE /todos/1 returns 200', async ({ api }) => {
    const res = await api.delete('/todos/1');
    api.expectStatus(res, 200);
  });
});
