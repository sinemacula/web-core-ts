/**
 * Page object for the login screen.
 *
 * Encapsulates every selector and interaction for the screen so specs read as
 * user behaviour and selector changes touch one file.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { Locator, Page } from '@playwright/test';

/**
 * Drives the login screen.
 */
export class LoginPage {
    /** The Playwright page under test. */
    readonly page: Page;

    /** The sign in heading. */
    readonly heading: Locator;

    /** The email address field. */
    readonly emailField: Locator;

    /** The password field. */
    readonly passwordField: Locator;

    /** The submit button. */
    readonly submitButton: Locator;

    /** The invalid credentials error message. */
    readonly errorMessage: Locator;

    constructor(page: Page) {
        this.page = page;
        this.heading = page.getByRole('heading', { name: 'Sign in' });
        this.emailField = page.getByLabel('Email address');
        this.passwordField = page.getByLabel('Password');
        this.submitButton = page.getByRole('button', { name: 'Sign in' });
        this.errorMessage = page.getByText('Those credentials do not match our records.');
    }

    /**
     * Navigate directly to the login screen.
     */
    async goto(): Promise<void> {
        await this.page.goto('/login');
    }

    /**
     * Fill the credentials and submit the form.
     *
     * @param email - the email address to sign in with
     * @param password - the password to sign in with
     */
    async signIn(email: string, password: string): Promise<void> {
        await this.emailField.fill(email);
        await this.passwordField.fill(password);
        await this.submitButton.click();
    }
}
