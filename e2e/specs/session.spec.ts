/**
 * End-to-end specs for the token-refresh flow.
 *
 * Exercises the full application - the bearer-token interceptor, the
 * token-refresh coordinator, and the auth store - against a mocked network
 * boundary that rejects one authenticated request so the refresh-and-retry path
 * engages.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { expect, test } from '../fixtures/app';
import { mockAuthRefreshSuccess, mockUsersSelfUnauthorizedOnce, seedAuthenticatedSession } from '../support/api-mock';

test.describe('token refresh', () => {
    test('recovers from a transient 401 by refreshing the session, retrying once', async ({ page, dashboardPage }) => {
        await seedAuthenticatedSession(page);
        await mockUsersSelfUnauthorizedOnce(page);
        const refreshRequestCount = await mockAuthRefreshSuccess(page);

        const refreshRequest = page.waitForRequest(
            request => request.method() === 'PATCH' && request.url().includes('/auth'),
        );

        await page.goto('/');

        await expect(dashboardPage.heading).toBeVisible();
        await expect(page).toHaveURL(/\/$/u);

        await refreshRequest;

        expect(refreshRequestCount()).toBe(1);
    });
});
