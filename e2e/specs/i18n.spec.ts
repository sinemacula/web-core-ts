/**
 * End-to-end specs for runtime locale switching.
 *
 * The switcher lives in the authenticated layout, so a seeded session is
 * required. Switching a locale loads that locale's shared and module
 * translations and re-renders the interface.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { expect, test } from '../fixtures/app';
import { seedAuthenticatedSession } from '../support/api-mock';

test.describe('locale switching', () => {
    test('switches the interface language through the locale switcher', async ({ page, dashboardPage }) => {
        await seedAuthenticatedSession(page);

        await dashboardPage.goto();

        await expect(dashboardPage.heading).toBeVisible();
        await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();

        await page.getByLabel('Language').selectOption('fr-FR');

        // The shared navigation re-renders in French, and the switcher's own
        // label localises too.
        await expect(page.getByRole('link', { name: 'Utilisateurs' })).toBeVisible();
        await expect(page.getByLabel('Langue')).toBeVisible();
    });
});
