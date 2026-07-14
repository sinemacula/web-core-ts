/**
 * Session guard factories.
 *
 * Route middleware over the session store: `authenticated` requires a
 * signed-in user, `guestOnly` requires a signed-out visitor, and `authorize`
 * additionally requires a permission. Every factory defers all store and
 * session-context access to `handle()`, so guard instances may be created at
 * module-definition time, before the application boots.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { RouteLocationRaw } from 'vue-router';

import type { MiddlewareContext, MiddlewareResult, RouteMiddleware } from '../router/middleware';
import { next, redirect } from '../router/middleware';
import { can } from './authorization';
import { appendRedirectTarget } from './redirect';
import { sessionContext } from './session-context';
import { useSessionStore } from './session-store';

/**
 * Build middleware that requires an authenticated session.
 *
 * @param redirectTo - where unauthenticated navigations are sent, carrying
 *   the attempted route's path as a redirect query parameter; defaults to
 *   the session context's login route
 * @returns the route middleware
 */
export function authenticated(redirectTo?: RouteLocationRaw): RouteMiddleware {
    return {
        handle(context: MiddlewareContext): MiddlewareResult {
            if (useSessionStore().isAuthenticated) {
                return next();
            }

            return redirect(appendRedirectTarget(redirectTo ?? sessionContext().routes.login, context.to.fullPath));
        },
    };
}

/**
 * Build middleware that requires a signed-out visitor.
 *
 * @param redirectTo - where authenticated navigations are sent; defaults to
 *   the session context's home route
 * @returns the route middleware
 */
export function guestOnly(redirectTo?: RouteLocationRaw): RouteMiddleware {
    return {
        handle(): MiddlewareResult {
            return useSessionStore().isAuthenticated ? redirect(redirectTo ?? sessionContext().routes.home) : next();
        },
    };
}

/**
 * Build middleware that requires a signed-in user holding a permission.
 *
 * An unauthenticated visitor is redirected to the session context's login
 * route, carrying the attempted route exactly as {@link authenticated} does.
 * An authenticated visitor lacking the permission is redirected to
 * `redirectTo`.
 *
 * @example
 * ```ts
 * { path: '/users', meta: { middleware: [authorize('users.view')] } }
 * ```
 *
 * @param permission - the permission the signed-in user must hold
 * @param redirectTo - where an authenticated-but-unauthorised visitor is
 *   sent; defaults to the session context's forbidden route
 * @returns the route middleware
 */
export function authorize(permission: string, redirectTo?: RouteLocationRaw): RouteMiddleware {
    return {
        handle(context: MiddlewareContext): MiddlewareResult {
            if (!useSessionStore().isAuthenticated) {
                return redirect(appendRedirectTarget(sessionContext().routes.login, context.to.fullPath));
            }

            return can(permission) ? next() : redirect(redirectTo ?? sessionContext().routes.forbidden);
        },
    };
}
