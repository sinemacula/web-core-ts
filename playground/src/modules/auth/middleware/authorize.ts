/**
 * Permission-gated route middleware.
 *
 * Guards routes that require a specific permission, on top of the session
 * check {@link authenticated} performs.
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

import { can } from '@/modules/auth/authorization';
import { appendRedirectTarget } from '@/modules/auth/redirect';
import { AUTH_ROUTE_NAMES } from '@/modules/auth/route-names';
import { useAuthStore } from '@/modules/auth/stores/auth-store';

/**
 * Build middleware that requires a signed-in user holding a permission.
 *
 * An unauthenticated visitor is redirected to the login screen, carrying the
 * attempted route via {@link appendRedirectTarget} exactly as
 * {@link authenticated} does. An authenticated visitor lacking the
 * permission is redirected to `redirectTo`.
 *
 * @example
 * ```ts
 * { path: '/users', meta: { middleware: [authorize('users.view')] } }
 * ```
 *
 * @param permission - the permission the signed-in user must hold
 * @param redirectTo - where an authenticated-but-unauthorised visitor is
 *   sent; defaults to `/forbidden`, a path owned by the errors module (see
 *   `src/modules/errors/routes.ts`) referenced by literal path rather than an
 *   imported route name, so this middleware does not depend on a feature module
 * @returns the route middleware
 */
export function authorize(permission: string, redirectTo: RouteLocationRaw = '/forbidden'): RouteMiddleware {
    return {
        handle(context: MiddlewareContext): MiddlewareResult {
            if (!useAuthStore().isAuthenticated) {
                return redirect(appendRedirectTarget({ name: AUTH_ROUTE_NAMES.login }, context.to.fullPath));
            }

            return can(permission) ? next() : redirect(redirectTo);
        },
    };
}
