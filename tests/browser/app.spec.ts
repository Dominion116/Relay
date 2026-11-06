import { test, expect } from '@playwright/test';
import { RELAY_RESOURCES } from '../../src/shared/resources';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.headers()['payment-signature'] || !['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    return route.continue();
  });
});

test('application renders, dialogs manage focus, and Playground works without a wallet', async ({ page }) => {
  const exceptions: string[] = [];
  page.on('pageerror', error => exceptions.push(error.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  const mcpButton = page.locator('button:visible').filter({ hasText: /MCP/ }).first();
  await mcpButton.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(mcpButton).toBeFocused();

  const discoveryButton = page.locator('button:visible').filter({ hasText: /Discovery/i }).first();
  await discoveryButton.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('x402Version');
  await page.keyboard.press('Escape');

  await page.locator('button:visible,a:visible').filter({ hasText: /^Playground$/ }).first().click();
  const select = page.getByRole('combobox');
  await expect(select).toBeVisible();
  await select.selectOption('weather');
  const body = page.locator('textarea');
  await expect(body).toContainText('latitude');
  for (const field of [select, body]) {
    expect(await field.evaluate(element => Boolean(element.getAttribute('aria-label') || (element as HTMLInputElement).labels?.length))).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await page.locator('footer button:visible,footer a:visible').filter({ hasText: /Documentation|Docs/ }).first().click();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(page.locator('body')).toContainText('PAYMENT-SIGNATURE');
  expect(exceptions).toEqual([]);
});

test('real local HTTP gateway protects every endpoint and exposes standard preflight headers', async ({ request }) => {
  for (const resource of RELAY_RESOURCES) {
    for (const path of [resource.path, `/api${resource.path}`]) {
      const response = await request.post(path, { data: resource.defaultParams });
      expect(response.status(), path).toBe(402);
      const challenge = await response.json();
      expect(challenge.resource.url).toBe(`http://127.0.0.1:4174${path}`);
      expect(challenge.accepts[0].amount).toBe(resource.amount);
      expect(JSON.parse(Buffer.from(response.headers()['payment-required'], 'base64').toString('utf8'))).toEqual(challenge);
    }
    const preflight = await request.fetch(resource.path, { method: 'OPTIONS', headers: { Origin: 'https://example.com', 'Access-Control-Request-Headers': 'content-type,payment-signature' } });
    expect(preflight.status()).toBe(204);
    expect(preflight.headers()['access-control-allow-headers'].toLowerCase()).toContain('payment-signature');
    expect((await request.get(resource.path)).status()).toBe(405);
  }
  expect((await request.post('/v1/weather', { data: { latitude: 0, longitude: 0 }, headers: { 'PAYMENT-SIGNATURE': Buffer.from(JSON.stringify({ payerAddress: 'not-an-address' })).toString('base64') } })).status()).toBe(402);
  expect((await request.post('/v1/weather', { data: {} })).status()).toBe(400);
  expect((await request.post('/v1/weather', { data: '{bad json', headers: { 'Content-Type': 'application/json' } })).status()).toBe(400);
  for (const path of ['/.well-known/x402', '/.well-known/x402.json']) expect((await request.get(path)).status()).toBe(200);
});
