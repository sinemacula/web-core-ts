/**
 * Page object for the users list screen.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { Locator, Page } from '@playwright/test';

/**
 * Drives the users list screen.
 */
export class UsersPage {

    /** The Playwright page under test. */
    readonly page: Page;

    /** The users heading. */
    readonly heading: Locator;

    /** The search users field. */
    readonly searchField: Locator;

    /** The table body rows. */
    readonly rows: Locator;

    /** The next page button. */
    readonly nextButton: Locator;

    /** The previous page button. */
    readonly previousButton: Locator;

    /** The full name sort button. */
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
