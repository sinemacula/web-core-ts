/**
 * Unit tests for web-environment.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';

import { Environment } from './environment';
import { ConfigurationError, createWebEnvironment } from './web-environment';

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

/**
 * Run a function expected to throw and return the thrown value.
 *
 * @param fn - the function under test
 * @returns the thrown value, or undefined when nothing was thrown
 */
function capture(fn: () => void): unknown {
    try {
        fn();
    } catch (error) {
        return error;
    }

    return undefined;
}

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

describe('createWebEnvironment in development', () => {
    it('returns an Environment preferring a runtime value over the build-time value', () => {
        const environment = createWebEnvironment({
            runtime: wire([['API_URL', 'https://runtime.example.com']]),
            dev: true,
            buildTimeEnv: wire([['VITE_API_URL', 'https://build.example.com']]),
        });

        expect(environment).toBeInstanceOf(Environment);
        expect(environment.string('API_URL')).toBe('https://runtime.example.com');
    });

    it('falls through to the build-time value when the runtime document lacks the key', () => {
        const environment = createWebEnvironment({
            runtime: {},
            dev: true,
            buildTimeEnv: wire([['VITE_API_URL', 'https://build.example.com']]),
        });

        expect(environment.string('API_URL')).toBe('https://build.example.com');
    });

    it('applies the default VITE_ prefix to build-time keys', () => {
        const environment = createWebEnvironment({
            runtime: {},
            dev: true,
            buildTimeEnv: wire([
                ['VITE_FROM_BUILD', 'prefixed'],
                ['FROM_BUILD', 'unprefixed'],
            ]),
        });

        expect(environment.string('FROM_BUILD')).toBe('prefixed');
    });

    it('does not resolve build-time keys that lack the prefix', () => {
        const environment = createWebEnvironment({
            runtime: {},
            dev: true,
            buildTimeEnv: wire([['FROM_BUILD', 'unprefixed']]),
        });

        expect(environment.string('FROM_BUILD')).toBeUndefined();
    });

    it('honours a custom build-time prefix', () => {
        const environment = createWebEnvironment({
            runtime: {},
            dev: true,
            buildTimeEnv: wire([
                ['APP_FROM_BUILD', 'custom'],
                ['VITE_FROM_BUILD', 'default'],
            ]),
            buildTimePrefix: 'APP_',
        });

        expect(environment.string('FROM_BUILD')).toBe('custom');
    });

    it('resolves only runtime values when no build-time record is supplied', () => {
        const environment = createWebEnvironment({
            runtime: wire([['API_URL', 'https://runtime.example.com']]),
            dev: true,
        });

        expect(environment.string('API_URL')).toBe('https://runtime.example.com');
        expect(environment.string('FROM_BUILD')).toBeUndefined();
    });

    it('does not enforce required keys', () => {
        const environment = createWebEnvironment({
            runtime: {},
            dev: true,
            requiredKeys: ['API_URL', 'APP_VERSION'],
        });

        expect(environment).toBeInstanceOf(Environment);
        expect(environment.string('API_URL')).toBeUndefined();
    });
});

describe('createWebEnvironment in production', () => {
    it('returns an Environment over the runtime document alone', () => {
        const environment = createWebEnvironment({
            runtime: wire([['API_URL', 'https://runtime.example.com']]),
            dev: false,
        });

        expect(environment).toBeInstanceOf(Environment);
        expect(environment.string('API_URL')).toBe('https://runtime.example.com');
    });

    it('ignores build-time variables', () => {
        const environment = createWebEnvironment({
            runtime: wire([['API_URL', 'https://runtime.example.com']]),
            dev: false,
            buildTimeEnv: wire([
                ['VITE_API_URL', 'https://build.example.com'],
                ['VITE_FROM_BUILD', 'build'],
            ]),
        });

        expect(environment.string('API_URL')).toBe('https://runtime.example.com');
        expect(environment.string('FROM_BUILD')).toBeUndefined();
    });

    it('does not throw when every required key is present and non-empty', () => {
        const environment = createWebEnvironment({
            runtime: wire([
                ['API_URL', 'https://api.example.com'],
                ['APP_VERSION', '1.0.0'],
            ]),
            dev: false,
            requiredKeys: ['API_URL', 'APP_VERSION'],
        });

        expect(environment.string('APP_VERSION')).toBe('1.0.0');
    });

    it('does not throw when no required keys are given', () => {
        const environment = createWebEnvironment({ runtime: {}, dev: false });

        expect(environment).toBeInstanceOf(Environment);
    });

    it('throws ConfigurationError naming the single missing key', () => {
        const build = (): void => {
            createWebEnvironment({
                runtime: wire([['API_URL', 'https://api.example.com']]),
                dev: false,
                requiredKeys: ['API_URL', 'APP_VERSION'],
            });
        };

        expect(build).toThrowError(ConfigurationError);

        const thrown = capture(build);

        expect((thrown as ConfigurationError).message).toBe(
            'Runtime configuration is missing required keys: APP_VERSION.',
        );
    });

    it('names every missing key in one message, in required-key order', () => {
        const thrown = capture(() => {
            createWebEnvironment({
                runtime: wire([['APP_ENV', 'production']]),
                dev: false,
                requiredKeys: ['API_URL', 'APP_URL', 'APP_ENV', 'APP_VERSION'],
            });
        });

        expect(thrown).toBeInstanceOf(ConfigurationError);
        expect((thrown as ConfigurationError).message).toBe(
            'Runtime configuration is missing required keys: API_URL, APP_URL, APP_VERSION.',
        );
    });

    it('treats an empty-string value as missing', () => {
        const thrown = capture(() => {
            createWebEnvironment({
                runtime: wire([
                    ['API_URL', ''],
                    ['APP_VERSION', '1.0.0'],
                ]),
                dev: false,
                requiredKeys: ['API_URL', 'APP_VERSION'],
            });
        });

        expect(thrown).toBeInstanceOf(ConfigurationError);
        expect((thrown as ConfigurationError).message).toBe('Runtime configuration is missing required keys: API_URL.');
    });
});
