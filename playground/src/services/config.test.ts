/**
 * Unit tests for the configuration service.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { Environment } from '@sinemacula/web-core/config/environment';
import { ObjectEnvironmentSource } from '@sinemacula/web-core/config/object-environment-source';
import { afterEach, describe, expect, it } from 'vitest';

import { config, configValue, initialiseConfiguration, resetConfiguration } from '@/services/config';

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

describe('config service', () => {
    afterEach(() => {
        resetConfiguration();
    });

    it('returns the frozen configuration tree after initialisation', () => {
        const env = new Environment(new ObjectEnvironmentSource(wire([['API_URL', 'https://api.test']])));

        initialiseConfiguration(env);

        const result = config();

        expect(result).toBeDefined();
        expect(result.api.baseUrl).toBe('https://api.test');
        expect(result.app).toBeDefined();
        expect(result.locales).toBeDefined();
        expect(result.services).toBeDefined();
    });

    it('returns a frozen (immutable) tree', () => {
        const env = new Environment(new ObjectEnvironmentSource({}));

        initialiseConfiguration(env);

        const result = config();

        expect(Object.isFrozen(result)).toBe(true);
    });

    it('resolves a value by dot-notation path via configValue', () => {
        const env = new Environment(new ObjectEnvironmentSource(wire([['API_URL', 'https://api.test']])));

        initialiseConfiguration(env);

        expect(configValue('app.urls.api')).toBe('https://api.test');
    });

    it('returns the fallback when the dot-notation path does not resolve', () => {
        const env = new Environment(new ObjectEnvironmentSource({}));

        initialiseConfiguration(env);

        expect(configValue('nonexistent.path', 'fallback-value')).toBe('fallback-value');
    });

    it('returns undefined for a missing path when no fallback is provided', () => {
        const env = new Environment(new ObjectEnvironmentSource({}));

        initialiseConfiguration(env);

        expect(configValue('nonexistent.path')).toBeUndefined();
    });

    it('throws before initialisation when config() is called', () => {
        expect(() => config()).toThrow('configuration accessed before initialisation');
    });

    it('throws again after resetConfiguration() clears the singleton', () => {
        const env = new Environment(new ObjectEnvironmentSource({}));

        initialiseConfiguration(env);
        resetConfiguration();

        expect(() => config()).toThrow('configuration accessed before initialisation');
    });
});
