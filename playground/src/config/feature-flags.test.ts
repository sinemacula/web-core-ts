/**
 * Unit tests for featureFlagsConfig.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { Environment } from '@sinemacula/web-core/config/environment';
import { ObjectEnvironmentSource } from '@sinemacula/web-core/config/object-environment-source';
import { describe, expect, it } from 'vitest';

import { featureFlagsConfig } from '@/config/feature-flags';

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

describe('featureFlagsConfig', () => {
    it('resolves flags to an empty object when FEATURE_FLAGS is absent', () => {
        const env = new Environment(new ObjectEnvironmentSource({}));
        const result = featureFlagsConfig(env);

        expect(result.flags).toEqual({});
    });

    it('resolves flags to the parsed object when FEATURE_FLAGS is present', () => {
        const env = new Environment(
            new ObjectEnvironmentSource(
                wire([['FEATURE_FLAGS', '{"new-dashboard":true,"checkout-flow":"b","limit":5}']]),
            ),
        );
        const result = featureFlagsConfig(env);

        expect(result.flags).toEqual({ 'new-dashboard': true, 'checkout-flow': 'b', limit: 5 });
    });

    it('resolves flags to an empty object when FEATURE_FLAGS is invalid JSON', () => {
        const env = new Environment(new ObjectEnvironmentSource(wire([['FEATURE_FLAGS', 'not-json']])));
        const result = featureFlagsConfig(env);

        expect(result.flags).toEqual({});
    });
});
