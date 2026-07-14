/**
 * Page object for the users list screen.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { Locator, Page } from '@playwright/test';

/**
 * Drives the users list screen.
 */
export class UsersPage {
    readonly page: Page;
    readonly heading: Locator;
    readonly searchField: Locator;
    readonly rows: Locator;
    readonly nextButton: Locator;
    readonly previousButton: Locator;
    readonly sortFullNameButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.heading = page.getByRole('heading', { name: 'Users' });
        this.searchField = page.getByLabel('Search users');
        this.rows = page.locator('tbody tr');
        this.nextButton = page.getByRole('button', { name: 'Next' });
        this.previousButton = page.getByRole('button', { name: 'Previous' });
        this.sortFullNameButton = page.getByRole('button', { name: 'Full name' });
    }

    /**
     * Navigate directly to the users list.
     */
    async goto(): Promise<void> {
        await this.page.goto('/users');
    }
}
