/**
 * Automated accessibility checks for the application.
 *
 * Runs axe-core against key screens to catch WCAG 2.1 A/AA regressions. Network
 * calls are stubbed at the browser boundary (no real backend needed).
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { expect, test } from '../fixtures/app';
import { UsersPage } from '../pages/users-page';
import { expectNoA11yViolations } from '../support/a11y';
import { mockLoginSuccess, mockUsersList, seedAuthenticatedSession } from '../support/api-mock';

test.describe('accessibility', () => {
    test('login screen has no axe violations', async ({ page }) => {
        await page.goto('/login');

        await expect(page).toHaveURL(/\/login$/u);

        await expectNoA11yViolations(page);
    });

    test('dashboard has no axe violations', async ({ page, dashboardPage }) => {
        await seedAuthenticatedSession(page);
        await mockLoginSuccess(page);

        await dashboardPage.goto();

        await expect(dashboardPage.heading).toBeVisible();

        await expectNoA11yViolations(page);
    });

    test('users screen has no axe violations', async ({ page }) => {
        await seedAuthenticatedSession(page);
        await mockUsersList(page);

        const usersPage = new UsersPage(page);

        await usersPage.goto();

        await expect(usersPage.heading).toBeVisible();

        await expectNoA11yViolations(page);
    });
});
