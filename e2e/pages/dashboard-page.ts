/**
 * Page object for the dashboard home screen.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { Locator, Page } from '@playwright/test';

/**
 * Drives the dashboard home screen.
 */
export class DashboardPage {
    readonly page: Page;
    readonly heading: Locator;
    readonly signOutButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.heading = page.getByRole('heading', { name: 'Dashboard' });
        this.signOutButton = page.getByRole('button', { name: 'Sign out' });
    }

    /**
     * Navigate directly to the dashboard.
     */
    async goto(): Promise<void> {
        await this.page.goto('/');
    }
}
