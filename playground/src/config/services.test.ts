/**
 * Unit tests for servicesConfig.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { Environment } from '@sinemacula/web-core/config/environment';
import { ObjectEnvironmentSource } from '@sinemacula/web-core/config/object-environment-source';
import { describe, expect, it } from 'vitest';

import { servicesConfig } from '@/config/services';

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

describe('servicesConfig', () => {
    it('resolves segment.writeKey to null when SEGMENT_WRITE_KEY is absent', () => {
        const env = new Environment(new ObjectEnvironmentSource({}));
        const result = servicesConfig(env);

        expect(result.segment.writeKey).toBeNull();
    });

    it('resolves segment.writeKey to the provided value when SEGMENT_WRITE_KEY is present', () => {
        const env = new Environment(new ObjectEnvironmentSource(wire([['SEGMENT_WRITE_KEY', 'abc123']])));
        const result = servicesConfig(env);

        expect(result.segment.writeKey).toBe('abc123');
    });

    it('resolves sentry.dsn to null when SENTRY_DSN is absent', () => {
        const env = new Environment(new ObjectEnvironmentSource({}));
        const result = servicesConfig(env);

        expect(result.sentry.dsn).toBeNull();
    });

    it('resolves sentry.dsn to the provided value when SENTRY_DSN is present', () => {
        const env = new Environment(new ObjectEnvironmentSource(wire([['SENTRY_DSN', 'https://sentry.io/1234']])));
        const result = servicesConfig(env);

        expect(result.sentry.dsn).toBe('https://sentry.io/1234');
    });
});
