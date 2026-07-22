/**
 * Post-login redirect target attachment.
 *
 * The vue-router half of redirect handling: attaching a sanitised return path
 * to a route location. Validation itself lives in the foundation's
 * `session/redirect` sanitiser.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { RouteLocationRaw } from 'vue-router';

import { REDIRECT_QUERY_KEY } from '@sinemacula/foundation/session/redirect';

/**
 * Attach a redirect target to a route location as a query parameter.
 *
 * Accepts either the object form of `RouteLocationRaw` (merging into its
 * existing query) or the string form (appending to its existing query string).
 * The input location is never mutated; a new value is returned.
 *
 * @param location - the route location to append the redirect target to
 * @param targetPath - the sanitised path to return the visitor to after login
 * @returns a new route location carrying the redirect target
 */
export function appendRedirectTarget(location: RouteLocationRaw, targetPath: string): RouteLocationRaw {
    if (typeof location === 'string') {
        const separator = location.includes('?') ? '&' : '?';

        return `${location}${separator}${REDIRECT_QUERY_KEY}=${encodeURIComponent(targetPath)}`;
    }

    return { ...location, query: { ...location.query, [REDIRECT_QUERY_KEY]: targetPath } };
}
