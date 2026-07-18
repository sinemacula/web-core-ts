/**
 * Playwright end-to-end test configuration.
 *
 * Locally the suite runs against the Vite dev server; in CI it runs against a
 * production build served by `vite preview`, so end-to-end checks exercise the
 * same artifact that ships. The API is never assumed to exist: specs stub the
 * network at the browser boundary (see `e2e/support/api-mock.ts`).
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { defineConfig, devices } from '@playwright/test';

const IS_CI = process.env.CI !== undefined;
const PORT = IS_CI ? 4173 : 5173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
    testDir: './e2e/specs',
    fullyParallel: true,
    forbidOnly: IS_CI,
    retries: IS_CI ? 2 : 0,
    reporter: [['list'], ['html', { open: 'never', outputFolder: 'build/playwright-report' }]],
    use: {
        // biome-ignore lint/style/useNamingConvention: Playwright API property
        baseURL: BASE_URL,
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'mobile-chromium',
            use: { ...devices['Pixel 7'] },
        },
    ],
    webServer: {
        command: IS_CI
            ? `npm run build && APP_ENV=e2e APP_VERSION=e2e API_URL=http://localhost:8000 APP_URL=${BASE_URL} DEFAULT_LOCALE=en-US ENABLED_LOCALES='["en-US","fr-FR"]' node playground/scripts/generate-runtime-env.mjs > playground/dist/runtime-env.json && npm run preview --workspace playground -- --port ${PORT} --strictPort`
            : `npm run dev --workspace playground -- --port ${PORT} --strictPort`,
        url: BASE_URL,
        reuseExistingServer: !IS_CI,
        timeout: 120_000,
    },
});
