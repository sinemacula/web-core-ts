/**
 * List-screen URL query state composable.
 *
 * Synchronises a fixed set of string parameters (page, sort, filters, etc.)
 * with the browser URL so state survives reloads and can be shared via link.
 *
 * Only the keys declared in {@link RouteQueryStateOptions.defaults} are
 * managed; all other query parameters are preserved transparently by the
 * {@link RouteQueryState.set} operation.
 *
 * Resolution rules for each managed key:
 *  - When the route query contains a string value it is used as-is.
 *  - When the route query contains an array the first element is used.
 *  - When the key is absent or its value is null/undefined the configured
 *    default is used.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { ComputedRef } from 'vue';
import { computed } from 'vue';
import type { LocationQuery, Router } from 'vue-router';

/**
 * Options accepted by {@link useRouteQueryState}.
 */
export interface RouteQueryStateOptions {

    /** Managed keys mapped to the value each falls back to when absent. */
    readonly defaults: Readonly<Record<string, string>>;
}

/**
 * The reactive query state and mutation helpers returned by
 * {@link useRouteQueryState}.
 */
export interface RouteQueryState {

    /** The resolved value of every managed key. */
    readonly values: ComputedRef<Readonly<Record<string, string>>>;

    /**
     * Read the resolved value of a managed key.
     *
     * @param key - the managed key to read
     * @returns the resolved value, or an empty string when unmanaged
     */
    get(key: string): string;

    /**
     * Merge a patch into the URL query, leaving unmanaged parameters intact.
     *
     * @param patch - the managed keys to set, or null to clear
     * @returns a promise that settles once navigation completes
     */
    set(patch: Readonly<Record<string, string | null>>): Promise<void>;
}

/**
 * Resolve a single raw query value to a string.
 *
 * @param raw - the value from `route.query`
 * @param fallback - the default to use when the value is absent
 * @returns the resolved string value
 */
function resolveQueryValue(raw: string | null | (string | null)[] | undefined, fallback: string): string {
    if (raw === null || raw === undefined) {
        return fallback;
    }

    if (Array.isArray(raw)) {
        const first = raw[0];

        return first === null || first === undefined ? fallback : first;
    }

    return raw;
}

/**
 * Create reactive URL query state for a list screen.
 *
 * @param router - the Vue Router instance
 * @param options - the managed keys and their default values
 * @returns the reactive query state and mutation helpers
 */
export function useRouteQueryState(router: Router, options: RouteQueryStateOptions): RouteQueryState {
    const { defaults } = options;

    const values = computed<Readonly<Record<string, string>>>(() => {
        const query = router.currentRoute.value.query;
        const result: Record<string, string> = {};

        for (const [key, defaultValue] of Object.entries(defaults)) {
            result[key] = resolveQueryValue(query[key], defaultValue);
        }

        return result;
    });

    /**
     * Read the resolved value of a managed key.
     *
     * @param key - the managed key to read
     * @returns the resolved value, or an empty string when the key is unmanaged
     */
    function get(key: string): string {
        return values.value[key] ?? '';
    }

    /**
     * Merge a patch into the URL query, leaving unmanaged parameters untouched.
     *
     * A null value removes its key; keys outside `defaults` are ignored.
     *
     * @param patch - the managed keys to set, or null to clear
     * @returns a promise that settles once the router navigation completes
     */
    async function set(patch: Readonly<Record<string, string | null>>): Promise<void> {
        const current = router.currentRoute.value.query;
        const next: LocationQuery = { ...current };

        for (const [key, value] of Object.entries(patch)) {
            if (!(key in defaults)) {
                continue;
            }

            if (value === null) {
                delete next[key];
            } else {
                next[key] = value;
            }
        }

        await router.replace({ query: next });
    }

    return { values, get, set };
}
