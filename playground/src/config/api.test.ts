/**
 * Unit tests for apiConfig.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { Environment } from '@sinemacula/foundation/config/environment';
import { ObjectEnvironmentSource } from '@sinemacula/foundation/config/object-environment-source';
import { describe, expect, it } from 'vitest';

import { apiConfig } from '@/config/api';

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

describe('apiConfig', () => {
    it('returns defaults when the environment source is empty', () => {
        const env = new Environment(new ObjectEnvironmentSource({}));
        const result = apiConfig(env);

        expect(result.baseUrl).toBe('http://localhost:8000');
        expect(result.timeout).toBe(30_000);
    });

    it('uses API_URL when present', () => {
        const env = new Environment(new ObjectEnvironmentSource(wire([['API_URL', 'https://api.example.com']])));
        const result = apiConfig(env);

        expect(result.baseUrl).toBe('https://api.example.com');
    });

    it('uses API_TIMEOUT when present', () => {
        const env = new Environment(new ObjectEnvironmentSource(wire([['API_TIMEOUT', '5000']])));
        const result = apiConfig(env);

        expect(result.timeout).toBe(5000);
    });

    it('uses both API_URL and API_TIMEOUT when both are present', () => {
        const env = new Environment(
            new ObjectEnvironmentSource(
                wire([
                    ['API_URL', 'https://api.example.com'],
                    ['API_TIMEOUT', '10000'],
                ]),
            ),
        );
        const result = apiConfig(env);

        expect(result.baseUrl).toBe('https://api.example.com');
        expect(result.timeout).toBe(10_000);
    });
});
