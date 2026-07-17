/**
 * Accessibility test helpers for end-to-end specs.
 *
 * Wraps `@axe-core/playwright` to provide a single assertion helper that runs
 * an axe scan filtered to WCAG 2.1 A and AA rules and fails the test when any
 * violations are found.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Assert that the current page has no axe-core accessibility violations at the
 * WCAG 2.1 A and AA conformance levels.
 *
 * The check is performed against the full document. Fails the calling test
 * immediately when one or more violations are found and includes the violation
 * summary in the error message.
 *
 * @param page - the Playwright page to scan
 */
export async function expectNoA11yViolations(page: Page): Promise<void> {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

    expect(results.violations).toEqual([]);
}
