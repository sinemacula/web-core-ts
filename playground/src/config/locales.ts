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
    readonly name: string;
    readonly direction: 'ltr' | 'rtl';
}

/**
 * Localisation configuration resolved from the environment.
 */
export interface LocalesConfig {
    readonly default: string;
    readonly enabled: readonly string[];
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
