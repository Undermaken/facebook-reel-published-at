import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 20_000,
  expect: { timeout: 4000 },
  reporter: 'list',
});
