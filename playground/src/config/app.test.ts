/**
 * Unit tests for appConfig.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { Environment } from '@sinemacula/web-core/config/environment';
import { ObjectEnvironmentSource } from '@sinemacula/web-core/config/object-environment-source';
import { describe, expect, it } from 'vitest';

import { appConfig } from '@/config/app';

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

describe('appConfig', () => {
    it('returns all defaults when the environment source is empty', () => {
        const env = new Environment(new ObjectEnvironmentSource({}));
        const result = appConfig(env);

        expect(result.environment).toBe('production');
        expect(result.name).toBe('Web Core');
        expect(result.version).toBe('dev');
        expect(result.urls.api).toBe('http://localhost:8000');
        expect(result.urls.app).toBe('http://localhost:5173');
        expect(result.urls.static).toBe('http://localhost:5173');
        expect(result.urls.stream).toBe('http://localhost:8000');
        expect(result.links.terms).toBe('https://www.sinemacula.co.uk/terms-conditions');
        expect(result.links.privacy).toBe('https://www.sinemacula.co.uk/privacy-policy');
    });

    it('returns explicit values for every key when all env vars are set', () => {
        const env = new Environment(
            new ObjectEnvironmentSource(
                wire([
                    ['APP_ENV', 'staging'],
                    ['APP_NAME', 'Web Core'],
                    ['APP_VERSION', '1.2.3'],
                    ['API_URL', 'https://api.staging.example.com'],
                    ['APP_URL', 'https://app.staging.example.com'],
                    ['STATIC_URL', 'https://static.staging.example.com'],
                    ['STREAM_URL', 'https://stream.staging.example.com'],
                ]),
            ),
        );
        const result = appConfig(env);

        expect(result.environment).toBe('staging');
        expect(result.name).toBe('Web Core');
        expect(result.version).toBe('1.2.3');
        expect(result.urls.api).toBe('https://api.staging.example.com');
        expect(result.urls.app).toBe('https://app.staging.example.com');
        expect(result.urls.static).toBe('https://static.staging.example.com');
        expect(result.urls.stream).toBe('https://stream.staging.example.com');
    });

    it('falls back static url to app url when STATIC_URL is absent', () => {
        const env = new Environment(new ObjectEnvironmentSource(wire([['APP_URL', 'https://app.example.com']])));
        const result = appConfig(env);

        expect(result.urls.static).toBe('https://app.example.com');
    });

    it('uses STATIC_URL when present, independently of app url', () => {
        const env = new Environment(
            new ObjectEnvironmentSource(
                wire([
                    ['APP_URL', 'https://app.example.com'],
                    ['STATIC_URL', 'https://cdn.example.com'],
                ]),
            ),
        );
        const result = appConfig(env);

        expect(result.urls.static).toBe('https://cdn.example.com');
    });

    it('falls back stream url to api url when STREAM_URL is absent', () => {
        const env = new Environment(new ObjectEnvironmentSource(wire([['API_URL', 'https://api.example.com']])));
        const result = appConfig(env);

        expect(result.urls.stream).toBe('https://api.example.com');
    });

    it('uses STREAM_URL when present, independently of api url', () => {
        const env = new Environment(
            new ObjectEnvironmentSource(
                wire([
                    ['API_URL', 'https://api.example.com'],
                    ['STREAM_URL', 'https://stream.example.com'],
                ]),
            ),
        );
        const result = appConfig(env);

        expect(result.urls.stream).toBe('https://stream.example.com');
    });
});
