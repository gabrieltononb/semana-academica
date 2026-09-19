import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server.js';
import { resetMockState } from './mocks/handlers.js';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
  resetMockState();
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});

afterAll(() => {
  server.close();
});
