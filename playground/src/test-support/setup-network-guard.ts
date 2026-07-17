/**
 * Unit-test network guard.
 *
 * Installed as a Vitest setup file: replaces the global fetch with a stub that
 * throws, so any test that forgets to inject a fetch stub fails loudly and
 * deterministically instead of silently hitting the real network. Tests that
 * legitimately exercise global-fetch fallbacks override it with
 * `vi.stubGlobal('fetch', ...)` as usual.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { PlaygroundError } from '@/errors/playground-error';

/**
 * Reject any network access attempted from a unit test.
 */
const guard: typeof fetch = () => {
    throw new PlaygroundError(
        'Unit tests must not touch the network. Inject a fetchFn stub or use vi.stubGlobal("fetch", ...).',
    );
};

globalThis.fetch = guard;
