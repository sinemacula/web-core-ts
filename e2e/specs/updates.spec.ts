/**
 * End-to-end specs for the deployed-version update toast.
 *
 * Exercises the runtime environment document, the update monitor's
 * visibility-triggered poll, and the sticky toast that invites a refresh.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { expect, test } from '../fixtures/app';
import { mockRuntimeEnvironmentVersionChange, seedAuthenticatedSession } from '../support/api-mock';

test.describe('deployed-version updates', () => {
    test('shows a sticky toast once a new version is detected', async ({ page, dashboardPage, baseURL }) => {
        if (baseURL === undefined) {
            throw new Error('The e2e suite requires a configured baseURL.');
        }

        await seedAuthenticatedSession(page);
        await mockRuntimeEnvironmentVersionChange(page, baseURL);

        await page.goto('/');

        await expect(dashboardPage.heading).toBeVisible();

        await page.evaluate(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });

        await expect(page.getByText('A new version is available. Refresh to update.')).toBeVisible();
    });
});
