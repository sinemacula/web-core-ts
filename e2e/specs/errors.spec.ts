/**
 * End-to-end specs for the application-shell error views.
 *
 * The catch-all not-found route and the forbidden route carry no authentication
 * middleware, so both render directly - with or without a signed-in session.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { expect, test } from '../fixtures/app';
import { seedAuthenticatedSession } from '../support/api-mock';

test.describe('error views', () => {
    test('renders the not-found view for an unmatched path when unauthenticated', async ({ page }) => {
        await page.goto('/nonsense/path');

        await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
        await expect(page).toHaveTitle(/^Page not found/u);
        await expect(page).toHaveURL(/\/nonsense\/path$/u);
    });

    test('renders the not-found view for an authenticated visitor, with a working back-home link', async ({
        page,
        dashboardPage,
    }) => {
        await seedAuthenticatedSession(page);

        await page.goto('/nonsense');

        await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();

        await page.getByRole('button', { name: 'Back to home' }).click();

        await expect(dashboardPage.heading).toBeVisible();
        await expect(page).toHaveURL(/\/$/u);
    });

    test('renders the forbidden view, with a working back-home link', async ({ page, dashboardPage }) => {
        await seedAuthenticatedSession(page);

        await page.goto('/forbidden');

        await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
        await expect(page).toHaveTitle(/^Access denied/u);

        await page.getByRole('button', { name: 'Back to home' }).click();

        await expect(dashboardPage.heading).toBeVisible();
        await expect(page).toHaveURL(/\/$/u);
    });
});
