/**
 * Unit tests for runtime configuration validation.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';

import { assertRuntimeConfig, ConfigurationError, REQUIRED_RUNTIME_KEYS } from '@/config/runtime';

/**
 * Build a `Record<string, string>` from an array of `[key, value]` pairs.
 *
 * @param entries - key-value pairs for the record
 * @returns a plain `Record<string, string>`
 */
function wire(entries: ReadonlyArray<readonly [string, string]>): Record<string, string> {
    return Object.fromEntries(entries);
}

/** A complete set of valid runtime values covering all required keys. */
const VALID_RUNTIME = wire([
    ['API_URL', 'https://api.example.com'],
    ['APP_URL', 'https://app.example.com'],
    ['APP_ENV', 'production'],
    ['APP_VERSION', '1.0.0'],
]);

describe('REQUIRED_RUNTIME_KEYS', () => {
    it('includes API_URL, APP_URL, APP_ENV, and APP_VERSION', () => {
        expect(REQUIRED_RUNTIME_KEYS).toContain('API_URL');
        expect(REQUIRED_RUNTIME_KEYS).toContain('APP_URL');
        expect(REQUIRED_RUNTIME_KEYS).toContain('APP_ENV');
        expect(REQUIRED_RUNTIME_KEYS).toContain('APP_VERSION');
        expect(REQUIRED_RUNTIME_KEYS).toHaveLength(4);
    });
});

describe('ConfigurationError', () => {
    it('is an instance of Error', () => {
        const error = new ConfigurationError('test');

        expect(error).toBeInstanceOf(Error);
    });

    it('has name set to ConfigurationError', () => {
        const error = new ConfigurationError('test message');

        expect(error.name).toBe('ConfigurationError');
    });

    it('preserves the message', () => {
        const error = new ConfigurationError('missing: KEY_A');

        expect(error.message).toBe('missing: KEY_A');
    });
});

describe('assertRuntimeConfig', () => {
    it('does not throw when all required keys are present and non-empty', () => {
        expect(() => assertRuntimeConfig(VALID_RUNTIME)).not.toThrow();
    });

    it('throws ConfigurationError when one key is missing', () => {
        const values = wire([
            ['API_URL', 'https://api.example.com'],
            ['APP_URL', 'https://app.example.com'],
            ['APP_ENV', 'production'],
            // APP_VERSION is absent
        ]);

        expect(() => assertRuntimeConfig(values)).toThrowError(ConfigurationError);
        expect(() => assertRuntimeConfig(values)).toThrowError('APP_VERSION');
    });

    it('throws ConfigurationError listing all missing keys', () => {
        expect(() => assertRuntimeConfig({})).toThrowError(ConfigurationError);
        expect(() => assertRuntimeConfig({})).toThrowError('API_URL');
        expect(() => assertRuntimeConfig({})).toThrowError('APP_URL');
        expect(() => assertRuntimeConfig({})).toThrowError('APP_ENV');
        expect(() => assertRuntimeConfig({})).toThrowError('APP_VERSION');
    });

    it('treats an empty-string value as missing', () => {
        const values = wire([
            ['API_URL', ''],
            ['APP_URL', 'https://app.example.com'],
            ['APP_ENV', 'production'],
            ['APP_VERSION', '1.0.0'],
        ]);

        expect(() => assertRuntimeConfig(values)).toThrowError(ConfigurationError);
        expect(() => assertRuntimeConfig(values)).toThrowError('API_URL');
    });

    it('throws with the correct message format listing multiple missing keys', () => {
        const values = wire([['APP_ENV', 'production']]);

        let thrown: unknown;

        try {
            assertRuntimeConfig(values);
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(ConfigurationError);
        expect((thrown as ConfigurationError).message).toMatch(/^Runtime configuration is missing required keys:/u);
    });
});
