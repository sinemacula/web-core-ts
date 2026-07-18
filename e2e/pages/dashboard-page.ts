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
    /** The Playwright page under test. */
    readonly page: Page;

    /** The dashboard heading. */
    readonly heading: Locator;

    /** The sign out button. */
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
