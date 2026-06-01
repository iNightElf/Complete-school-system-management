import { test, expect } from '@playwright/test';

test('health endpoint returns ok', async ({ request }) => {
  const res = await request.get('/health');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe('ok');
});

test('setup status returns valid response', async ({ request }) => {
  const res = await request.get('/api/setup/status');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  // Should have adminExists or setupNeeded
  expect(body).toHaveProperty('adminExists');
});
