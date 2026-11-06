/**
 * Standalone Playwright E2E Configuration for Apex Grand Prix: Uncapped Next-Gen Edition
 * Owned by: E2E_Testing_Track (playwright.config.ts)
 * Executes headless Chromium with WebGL2 / ANGLE SwiftShader enabled.
 */

const PORT = Number(process.env.APEX_E2E_PORT || 4173);
const BASE_URL = process.env.APEX_E2E_BASE_URL || `http://127.0.0.1:${PORT}`;

export default {
  testDir: './tests/e2e/playwright',
  testMatch: '**/*.e2e.spec.ts',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    launchOptions: {
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--disable-gpu-sandbox',
        '--no-sandbox',
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
  projects: [
    {
      name: 'chromium-webgl2',
      use: {
        browserName: 'chromium',
      },
    },
  ],
  webServer: process.env.APEX_SKIP_WEBSERVER
    ? undefined
    : {
        command: `npx vite --port ${PORT} --host 127.0.0.1`,
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
};
