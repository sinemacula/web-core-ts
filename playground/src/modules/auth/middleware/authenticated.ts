/**
 * Authentication middleware.
 *
 * Guards routes that require a signed-in user; unauthenticated navigations
 * are redirected to the login screen.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type {
    MiddlewareContext,
    MiddlewareResult,
    RouteMiddleware,
} from '@sinemacula/web-core/router/middleware';
import { next, redirect } from '@sinemacula/web-core/router/middleware';
import type { RouteLocationRaw } from 'vue-router';

import { appendRedirectTarget } from '@/modules/auth/redirect';
import { AUTH_ROUTE_NAMES } from '@/modules/auth/route-names';
import { useAuthStore } from '@/modules/auth/stores/auth-store';

/**
 * Build middleware that requires an authenticated session.
 *
 * @param redirectTo - where unauthenticated navigations are sent; the
 *   attempted route's path is attached to it as a redirect query parameter
 * @returns the route middleware
 */
export function authenticated(redirectTo: RouteLocationRaw = { name: AUTH_ROUTE_NAMES.login }): RouteMiddleware {
    return {
        handle(context: MiddlewareContext): MiddlewareResult {
            return useAuthStore().isAuthenticated
                ? next()
                : redirect(appendRedirectTarget(redirectTo, context.to.fullPath));
        },
    };
}
