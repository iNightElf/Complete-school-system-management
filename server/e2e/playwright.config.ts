import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5000',
    headless: true,
  },
  webServer: {
    command: 'npm run dev',
    port: 5000,
    timeout: 30000,
    reuseExistingServer: true,
  },
});
