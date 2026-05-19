import { test as base, request } from '@playwright/test';
import { ApiClient } from '../../main/utils';

const BASE_URL = 'https://jsonplaceholder.typicode.com';

/**
 * Shared types for JSONPlaceholder resources.
 */
export interface Post {
  id: number;
  userId: number;
  title: string;
  body: string;
}

export interface Comment {
  id: number;
  postId: number;
  name: string;
  email: string;
  body: string;
}

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  address: {
    street: string;
    suite: string;
    city: string;
    zipcode: string;
    geo: { lat: string; lng: string };
  };
  phone: string;
  website: string;
  company: { name: string; catchPhrase: string; bs: string };
}

export interface Album {
  id: number;
  userId: number;
  title: string;
}

export interface Photo {
  id: number;
  albumId: number;
  title: string;
  url: string;
  thumbnailUrl: string;
}

export interface Todo {
  id: number;
  userId: number;
  title: string;
  completed: boolean;
}

/**
 * API test fixtures — provides a pre-configured ApiClient for JSONPlaceholder.
 */
type ApiFixtures = {
  api: ApiClient;
};

export const test = base.extend<ApiFixtures>({
  api: async ({}, use) => {
    // Use a standalone request context (no browser needed for pure API tests)
    const ctx = await request.newContext({ baseURL: BASE_URL });
    const api = new ApiClient(ctx, { baseURL: BASE_URL });
    await use(api);
    await ctx.dispose();
  },
});

export { expect } from '@playwright/test';
