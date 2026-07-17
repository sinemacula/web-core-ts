/**
 * Unit tests for runtime-environment.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchRuntimeEnvironment, RUNTIME_ENVIRONMENT_URL } from './runtime-environment';

/**
 * Build a `Record<string, T>` from an array of `[key, value]` pairs.
 *
 * Wraps `Object.fromEntries` so callers can write wire-field names as plain
 * string literals inside array elements rather than as object-literal keys -
 * keeping non-camelCase environment keys out of any position that Biome's
 * naming-convention or literal-keys rules inspect.
 *
 * @param entries - key-value pairs for the record
 * @returns a plain `Record<string, T>`
 */
function wire<T>(entries: ReadonlyArray<readonly [string, T]>): Record<string, T> {
    return Object.fromEntries(entries);
}

function jsonResponse(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

describe('fetchRuntimeEnvironment', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns only string-valued entries from a successful response', async () => {
        const stub = vi.fn().mockResolvedValue(
            jsonResponse(
                wire<string | number | boolean>([
                    ['API_URL', 'https://api.example.com'],
                    ['COUNT', 42],
                    ['FLAG', true],
                ]),
            ),
        );
        const result = await fetchRuntimeEnvironment(stub);

        expect(result).toStrictEqual(wire([['API_URL', 'https://api.example.com']]));
    });

    it('returns an empty record for a non-ok response', async () => {
        const stub = vi.fn().mockResolvedValue(jsonResponse({}, 404));
        const result = await fetchRuntimeEnvironment(stub);

        expect(result).toStrictEqual({});
    });

    it('returns an empty record when fetch throws', async () => {
        const stub = vi.fn().mockRejectedValue(new Error('network error'));
        const result = await fetchRuntimeEnvironment(stub);

        expect(result).toStrictEqual({});
    });

    it('returns an empty record when the payload is null', async () => {
        const stub = vi.fn().mockResolvedValue(jsonResponse(null));
        const result = await fetchRuntimeEnvironment(stub);

        expect(result).toStrictEqual({});
    });

    it('returns an empty record when the payload is an array', async () => {
        const stub = vi.fn().mockResolvedValue(jsonResponse(['a', 'b']));
        const result = await fetchRuntimeEnvironment(stub);

        expect(result).toStrictEqual({});
    });

    it('returns an empty record when the payload is a primitive string', async () => {
        const stub = vi.fn().mockResolvedValue(jsonResponse('just a string'));
        const result = await fetchRuntimeEnvironment(stub);

        expect(result).toStrictEqual({});
    });

    it('returns an empty record when the payload is a number', async () => {
        const stub = vi.fn().mockResolvedValue(jsonResponse(123));
        const result = await fetchRuntimeEnvironment(stub);

        expect(result).toStrictEqual({});
    });

    it('passes the custom url to the fetch function', async () => {
        const stub = vi.fn().mockResolvedValue(jsonResponse(wire([['KEY', 'val']])));
        await fetchRuntimeEnvironment(stub, '/custom/runtime-env.json');

        expect(stub).toHaveBeenCalledWith('/custom/runtime-env.json', expect.objectContaining({ cache: 'no-store' }));
    });

    it('uses the default RUNTIME_ENVIRONMENT_URL when no url is provided', async () => {
        const stub = vi.fn().mockResolvedValue(jsonResponse(wire([['KEY', 'val']])));
        await fetchRuntimeEnvironment(stub);

        expect(stub).toHaveBeenCalledWith(RUNTIME_ENVIRONMENT_URL, expect.anything());
    });

    it('uses globalThis.fetch via the default fetchFn when no arguments are provided', async () => {
        const globalStub = vi.fn().mockResolvedValue(jsonResponse(wire([['RUNTIME', 'yes']])));

        vi.stubGlobal('fetch', globalStub);

        const result = await fetchRuntimeEnvironment();

        expect(result).toStrictEqual(wire([['RUNTIME', 'yes']]));
        expect(globalStub).toHaveBeenCalled();
    });
});
