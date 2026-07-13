/**
 * Application locale-switcher service.
 *
 * Holds the boot-time {@link LocaleSwitcher} singleton, constructed by the
 * bootstrap once the initial locale has been activated. Components that let
 * the user change locale at runtime (e.g. the locale switcher) depend on
 * this singleton rather than constructing their own switcher.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { LocaleSwitcher } from '@sinemacula/web-core/i18n/application-i18n';

let switcher: LocaleSwitcher | null = null;

/**
 * Install the locale switcher. Called once by the application bootstrap.
 *
 * @param instance - the locale switcher to install
 */
export function initialiseLocaleSwitcher(instance: LocaleSwitcher): void {
    switcher = instance;
}

/**
 * The active locale switcher.
 *
 * @returns the active locale switcher
 * @throws Error when accessed before {@link initialiseLocaleSwitcher} has
 *   been called
 */
export function localeSwitcher(): LocaleSwitcher {
    if (switcher === null) {
        throw new Error(
            'The locale switcher was accessed before initialisation. Call initialiseLocaleSwitcher() first.',
        );
    }

    return switcher;
}

/**
 * Discard the locale switcher singleton. Test use only.
 */
export function resetLocaleSwitcher(): void {
    switcher = null;
}
