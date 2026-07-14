/**
 * Post-login redirect target handling.
 *
 * Guarded navigations attach the originally-requested path as a query
 * parameter so the login screen can return the visitor there once signed in.
 * Only same-origin, relative paths are ever honoured; anything else is
 * treated as untrusted input and discarded.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { RouteLocationRaw } from 'vue-router';

import { isSessionContextInstalled, sessionContext } from './session-context';

const DEFAULT_LOGIN_PATH = '/login';

function defaultLoginPath(): string {
    return isSessionContextInstalled() ? sessionContext().routes.loginPath : DEFAULT_LOGIN_PATH;
}

/**
 * Query parameter under which the post-login redirect target is carried.
 */
export const REDIRECT_QUERY_KEY = 'redirect';

/**
 * Validate an untrusted value as a safe post-login redirect target.
 *
 * Only a same-origin, relative path is accepted: it must start with a
 * single `/` (protocol-relative `//` targets are rejected), must not
 * contain a backslash, and must not point back at the login screen (which
 * would bounce the visitor in a loop).
 *
 * @param target - the untrusted candidate, typically a route query value
 * @param loginPath - the login-path prefix rejected as a loop guard; defaults
 *   to the installed session context's configured login path, else `/login`
 * @returns the sanitised path, or `null` when the value is not a safe target
 */
export function sanitiseRedirectTarget(target: unknown, loginPath?: string): string | null {
    if (typeof target !== 'string') {
        return null;
    }

    const guard = loginPath ?? defaultLoginPath();

    if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\') || target.startsWith(guard)) {
        return null;
    }

    return target;
}

/**
 * Attach a redirect target to a route location as a query parameter.
 *
 * Accepts either the object form of `RouteLocationRaw` (merging into its
 * existing query) or the string form (appending to its existing query
 * string). The input location is never mutated; a new value is returned.
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
