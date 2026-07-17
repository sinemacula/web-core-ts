/**
 * Application test fixtures.
 *
 * Extends Playwright's base test with page objects so specs receive them
 * ready-made. Import `test` and `expect` from this file, never from
 * `@playwright/test` directly.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { test as base } from '@playwright/test';

import { DashboardPage } from '../pages/dashboard-page';
import { LoginPage } from '../pages/login-page';

interface AppFixtures {
    loginPage: LoginPage;
    dashboardPage: DashboardPage;
}

export const test = base.extend<AppFixtures>({
    loginPage: async ({ page }, use) => {
        await use(new LoginPage(page));
    },
    dashboardPage: async ({ page }, use) => {
        await use(new DashboardPage(page));
    },
});

export { expect } from '@playwright/test';
