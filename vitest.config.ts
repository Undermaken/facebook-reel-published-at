import { defineConfig } from 'vitest/config';

process.env.TZ = 'Europe/Rome';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'https://www.facebook.com/reel/5532624203628819/' },
    },
    restoreMocks: true,
  },
});
