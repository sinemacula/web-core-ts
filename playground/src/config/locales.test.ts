/**
 * Unit tests for localesConfig.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { Environment } from '@sinemacula/web-core/config/environment';
import { ObjectEnvironmentSource } from '@sinemacula/web-core/config/object-environment-source';
import { describe, expect, it } from 'vitest';

import { localesConfig } from '@/config/locales';

/**
 * Build a `Record<string, string>` from an array of `[key, value]` pairs.
 *
 * Wraps `Object.fromEntries` so callers can write wire-field names as plain
 * string literals inside array elements rather than as object-literal keys -
 * keeping non-camelCase environment keys out of any position that Biome's
 * naming-convention or literal-keys rules inspect.
 *
 * @param entries - key-value pairs for the record
 * @returns a plain `Record<string, string>`
 */
function wire(entries: ReadonlyArray<readonly [string, string]>): Record<string, string> {
    return Object.fromEntries(entries);
}

describe('localesConfig', () => {
    it('returns defaults when the environment source is empty', () => {
        const env = new Environment(new ObjectEnvironmentSource({}));
        const result = localesConfig(env);

        expect(result.default).toBe('en-US');
        expect(result.enabled).toEqual(['en-US', 'fr-FR']);
    });

    it('uses DEFAULT_LOCALE when present', () => {
        const env = new Environment(new ObjectEnvironmentSource(wire([['DEFAULT_LOCALE', 'fr-FR']])));
        const result = localesConfig(env);

        expect(result.default).toBe('fr-FR');
    });

    it('parses ENABLED_LOCALES as a JSON array when present', () => {
        const env = new Environment(new ObjectEnvironmentSource(wire([['ENABLED_LOCALES', '["en-US","fr-FR"]']])));
        const result = localesConfig(env);

        expect(result.enabled).toEqual(['en-US', 'fr-FR']);
    });

    it('includes en-US in the supported map with ltr direction', () => {
        const env = new Environment(new ObjectEnvironmentSource({}));
        const result = localesConfig(env);

        expect(result.supported['en-US']).toStrictEqual({ name: 'English', direction: 'ltr' });
    });

    it('includes fr-FR in the supported map with ltr direction', () => {
        const env = new Environment(new ObjectEnvironmentSource({}));
        const result = localesConfig(env);

        expect(result.supported['fr-FR']).toStrictEqual({ name: 'Français', direction: 'ltr' });
    });
});
