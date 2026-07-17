/**
 * End-to-end specs for the authentication flow.
 *
 * Exercises the full application - routing middleware, stores, HTTP layer and
 * rendering - against a mocked network boundary.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { expect, test } from '../fixtures/app';
import { mockLoginFailure, mockLoginSuccess, mockLogout, seedAuthenticatedSession } from '../support/api-mock';

test.describe('authentication', () => {
    test('redirects an unauthenticated visitor to the login screen', async ({ page, loginPage }) => {
        await page.goto('/');

        await expect(page).toHaveURL(/\/login/u);
        await expect(loginPage.heading).toBeVisible();
        await expect(page).toHaveTitle(/^Sign in/u);
    });

    test('returns to the originally requested route after signing in', async ({ page, loginPage, dashboardPage }) => {
        await mockLoginSuccess(page);

        await page.goto('/');

        await expect(page).toHaveURL(/\/login\?redirect=\/$/u);

        await loginPage.signIn('e2e@example.com', 'correct-horse-battery');

        await expect(dashboardPage.heading).toBeVisible();
        await expect(page).toHaveURL(/\/$/u);
    });

    test('signs in and lands on the dashboard', async ({ page, loginPage, dashboardPage }) => {
        await mockLoginSuccess(page);

        await loginPage.goto();
        await loginPage.signIn('e2e@example.com', 'correct-horse-battery');

        await expect(dashboardPage.heading).toBeVisible();
        await expect(page).toHaveURL(/\/$/u);
        await expect(page).toHaveTitle(/^Dashboard/u);
    });

    test('surfaces invalid credentials on the form', async ({ page, loginPage }) => {
        await mockLoginFailure(page);

        await loginPage.goto();
        await loginPage.signIn('e2e@example.com', 'wrong-password');

        await expect(loginPage.errorMessage).toBeVisible();
        await expect(page).toHaveURL(/\/login$/u);
    });

    test('sends an authenticated visitor past the login screen', async ({ page, loginPage, dashboardPage }) => {
        await seedAuthenticatedSession(page);

        await loginPage.goto();

        await expect(dashboardPage.heading).toBeVisible();
        await expect(page).toHaveURL(/\/$/u);
    });

    test('signs out back to the login screen', async ({ page, loginPage, dashboardPage }) => {
        await seedAuthenticatedSession(page);
        await mockLogout(page);

        await dashboardPage.goto();
        await dashboardPage.signOutButton.click();

        await expect(loginPage.heading).toBeVisible();
        await expect(page).toHaveURL(/\/login$/u);
    });
});
