/**
 * Localisation configuration definition.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { Environment } from '@sinemacula/web-core/config/environment';

/**
 * Display metadata for a single supported locale.
 */
export interface LocaleDefinition {
    /** The human-readable locale name. */
    readonly name: string;

    /** The text direction for the locale. */
    readonly direction: 'ltr' | 'rtl';
}

/**
 * Localisation configuration resolved from the environment.
 */
export interface LocalesConfig {
    /** The default locale. */
    readonly default: string;

    /** The locales enabled for selection. */
    readonly enabled: readonly string[];

    /** Display metadata for every supported locale. */
    readonly supported: Readonly<Record<string, LocaleDefinition>>;
}

/**
 * Resolve the localisation configuration from the environment.
 *
 * @param env - the typed environment reader
 * @returns the resolved localisation configuration
 */
export function localesConfig(env: Environment): LocalesConfig {
    return {
        default: env.string('DEFAULT_LOCALE', 'en-US'),
        enabled: env.json<string[]>('ENABLED_LOCALES', ['en-US', 'fr-FR']),
        supported: {
            'en-US': { name: 'English', direction: 'ltr' },
            'fr-FR': { name: 'Français', direction: 'ltr' },
        },
    };
}
