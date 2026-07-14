/**
 * Loader for the runtime environment document.
 *
 * Deployed artifacts are environment-agnostic: the deploy pipeline renders
 * `runtime-env.json` next to the artifact (served with no-store caching), and
 * the application fetches it before mounting. Local development has no such
 * document, so every failure mode (missing file, network error, malformed
 * payload) resolves to an empty record and the environment chain falls
 * through to Vite's build variables.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

/**
 * Default URL of the runtime environment document served next to the artifact.
 */
export const RUNTIME_ENVIRONMENT_URL = '/runtime-env.json';

/**
 * Fetch and normalise the runtime environment document.
 *
 * @param fetchFn - the fetch implementation to use
 * @param url - the document location, relative to the application origin
 * @returns the string-valued entries of the document, or an empty record
 */
export async function fetchRuntimeEnvironment(
    fetchFn: typeof fetch = (input, init) => globalThis.fetch(input, init),
    url: string = RUNTIME_ENVIRONMENT_URL,
): Promise<Record<string, string>> {
    try {
        const response = await fetchFn(url, { cache: 'no-store', headers: { accept: 'application/json' } });

        if (!response.ok) {
            return {};
        }

        return normaliseRuntimeValues(await response.json());
    } catch {
        return {};
    }
}

/**
 * Keep only the string-valued entries of a parsed payload.
 *
 * @param payload - the parsed JSON payload
 * @returns the string-valued entries, or an empty record for non-objects
 */
function normaliseRuntimeValues(payload: unknown): Record<string, string> {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        return {};
    }

    const values: Record<string, string> = {};

    for (const [key, value] of Object.entries(payload)) {
        if (typeof value === 'string') {
            values[key] = value;
        }
    }

    return values;
}
