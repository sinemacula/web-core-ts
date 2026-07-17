/**
 * End-to-end specs for the users list screen.
 *
 * Exercises the full application - routing middleware, the query layer, and
 * rendering - against a mocked network boundary.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { expect, test } from '../fixtures/app';
import { UsersPage } from '../pages/users-page';
import { mockUsersList, seedAuthenticatedSession } from '../support/api-mock';

test.describe('users list', () => {
    test('navigates from the dashboard and lists users', async ({ page, dashboardPage }) => {
        await seedAuthenticatedSession(page);
        await mockUsersList(page);

        await dashboardPage.goto();

        const usersPage = new UsersPage(page);

        await page.getByRole('link', { name: 'Users' }).click();

        await expect(page).toHaveURL(/\/users$/u);
        await expect(usersPage.heading).toBeVisible();
        await expect(usersPage.rows).toHaveCount(2);
    });

    test('loads the next page of results', async ({ page }) => {
        await seedAuthenticatedSession(page);
        await mockUsersList(page);

        const usersPage = new UsersPage(page);

        await usersPage.goto();

        await expect(usersPage.rows).toHaveCount(2);

        await usersPage.nextButton.click();

        await expect(page.getByText('Carol Page Two')).toBeVisible();
    });

    test('sends the search term to the server after typing', async ({ page }) => {
        await seedAuthenticatedSession(page);
        await mockUsersList(page);

        const usersPage = new UsersPage(page);

        await usersPage.goto();
        await expect(usersPage.rows).toHaveCount(2);

        const requestPromise = page.waitForRequest(
            request => request.url().includes('/users') && request.url().includes('filters='),
        );

        await usersPage.searchField.fill('alice');

        const request = await requestPromise;

        expect(request.url()).toContain('filters=');
    });
});
