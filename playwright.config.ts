import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4174', channel: process.env.PLAYWRIGHT_CHANNEL || undefined, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } }
  ],
  webServer: {
    command: 'node scripts/browser-preview.js',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      RELAY_FACILITATOR_KEY: '', AGENT_PRIVATE_KEY: '', BASE_PRIVATE_KEY: '', BASE_RPC_URL: 'http://127.0.0.1:1',
      RELAY_NETWORK: 'base', BASE_NETWORK: 'base', GATEWAY_ORIGIN: 'http://127.0.0.1:4174',
      RELAY_TREASURY_ADDRESS: '0x420f9F9deA7fA318eA8996C8aA00ad9738D98072', VITE_RELAY_TREASURY_ADDRESS: '0x420f9F9deA7fA318eA8996C8aA00ad9738D98072',
      VITE_GATEWAY_URL: 'http://127.0.0.1:4174', VITE_BASE_NETWORK: 'base',
      VITE_BASE_RPC_URL: 'http://127.0.0.1:1', VITE_WALLETCONNECT_PROJECT_ID: '',
      MAX_PAYMENT_USDC: '0', MAX_DAILY_BUDGET_USDC: '0'
    }
  }
});
