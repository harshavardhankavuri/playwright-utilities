import { test, expect, type Album, type Photo } from './fixtures';
import { configureAllure, allureStep } from '../../main/utils';

/**
 * Albums & Photos API — /albums, /photos
 *
 * Covers: GET list, GET by id, nested resources, URL format validation
 */
test.describe('Albums API @api', () => {
  test.beforeEach(async () => {
    await configureAllure({
      parentSuite: 'JSONPlaceholder',
      suite: 'Albums',
      tags: ['api', 'albums'],
    });
  });

  test('GET /albums returns 100 albums', async ({ api }) => {
    const res = await api.get<Album[]>('/albums');

    api.expectStatus(res, 200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(100);
  });

  test('GET /albums/:id returns correct album', async ({ api }) => {
    const res = await api.get<Album>('/albums/1');

    api.expectStatus(res, 200);
    api.expectBodyHasKeys(res, ['id', 'userId', 'title']);
    api.expectBodyContains(res, { id: 1 });
    expect(typeof res.body.title).toBe('string');
  });

  test('GET /albums?userId=1 returns albums for user 1', async ({ api }) => {
    const res = await api.get<Album[]>('/albums', { params: { userId: 1 } });

    api.expectStatus(res, 200);
    expect(res.body.length).toBeGreaterThan(0);

    for (const album of res.body) {
      expect(album.userId).toBe(1);
    }
  });

  test('GET /albums/1/photos returns photos for album 1', async ({ api }) => {
    const res = await api.get<Photo[]>('/albums/1/photos');

    api.expectStatus(res, 200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    await allureStep('Validate photo shape and albumId', async () => {
      for (const photo of res.body) {
        expect(photo.albumId).toBe(1);
        expect(typeof photo.title).toBe('string');
        expect(photo.url).toMatch(/^https?:\/\//);
        expect(photo.thumbnailUrl).toMatch(/^https?:\/\//);
      }
    });
  });
});

test.describe('Photos API @api', () => {
  test.beforeEach(async () => {
    await configureAllure({
      parentSuite: 'JSONPlaceholder',
      suite: 'Photos',
      tags: ['api', 'photos'],
    });
  });

  test('GET /photos returns 5000 photos', async ({ api }) => {
    const res = await api.get<Photo[]>('/photos');

    api.expectStatus(res, 200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(5000);
  });

  test('GET /photos/:id returns correct photo', async ({ api }) => {
    const res = await api.get<Photo>('/photos/1');

    api.expectStatus(res, 200);
    api.expectBodyHasKeys(res, ['id', 'albumId', 'title', 'url', 'thumbnailUrl']);
    api.expectBodyContains(res, { id: 1 });
  });

  test('GET /photos?albumId=1 returns only photos for album 1', async ({ api }) => {
    const res = await api.get<Photo[]>('/photos', { params: { albumId: 1 } });

    api.expectStatus(res, 200);
    expect(res.body.length).toBeGreaterThan(0);

    await allureStep('All photos belong to albumId 1', async () => {
      for (const photo of res.body) {
        expect(photo.albumId).toBe(1);
      }
    });
  });

  test('GET /photos returns valid URL format for url and thumbnailUrl', async ({ api }) => {
    const res = await api.get<Photo[]>('/photos', { params: { albumId: 1 } });
    api.expectStatus(res, 200);

    const urlRegex = /^https?:\/\/.+/;
    await allureStep('Validate URL formats', async () => {
      for (const photo of res.body) {
        expect(photo.url).toMatch(urlRegex);
        expect(photo.thumbnailUrl).toMatch(urlRegex);
      }
    });
  });
});
