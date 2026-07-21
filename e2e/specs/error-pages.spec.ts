/**
 * End-to-end specs for the static HTTP error pages.
 *
 * These pages are generated into `dist/errors/` at build time and are only
 * served by the production preview, so the suite runs against CI's built
 * artifact and is skipped against the local dev server. Each spec drives the
 * inline locale swap by fixing the browser language.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { expect, test } from '../fixtures/app';

const servedByPreview = process.env['CI'] !== undefined;

test.describe('static error pages', () => {
    test.skip(!servedByPreview, 'error pages are only served by the production preview');

    test.describe('English browser', () => {
        test.use({ locale: 'en-US' });

        test('renders the default copy and no external references', async ({ page }) => {
            const failed: string[] = [];

            page.on('requestfailed', request => failed.push(request.url()));

            await page.goto('/errors/500.html');

            await expect(page.locator('#e-title')).toHaveText('Internal Server Error');
            await expect(page.locator('#e-message')).toHaveText('Something went wrong on our end.');
            await expect(page).toHaveTitle('500 Internal Server Error');
            await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
            expect(failed).toEqual([]);
        });
    });

    test.describe('French browser', () => {
        test.use({ locale: 'fr-FR' });

        test('localises the page to the browser language', async ({ page }) => {
            await page.goto('/errors/500.html');

            await expect(page.locator('#e-title')).toHaveText('Erreur interne du serveur');
            await expect(page.locator('#e-message')).toHaveText("Une erreur s'est produite de notre côté.");
            await expect(page.locator('#e-home')).toHaveText("Retour à la page d'accueil");
            await expect(page).toHaveTitle('500 Erreur interne du serveur');
            await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
        });

        test('honours an explicit stored locale over the browser language', async ({ page }) => {
            await page.addInitScript(() => window.localStorage.setItem('locale', 'en-US'));

            await page.goto('/errors/404.html');

            await expect(page.locator('#e-title')).toHaveText('Not Found');
            await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
        });
    });
});
