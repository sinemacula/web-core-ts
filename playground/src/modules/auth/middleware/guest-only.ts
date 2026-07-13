/**
 * Guest-only middleware.
 *
 * Guards routes that only make sense for signed-out visitors (login,
 * password reset); authenticated navigations are redirected into the
 * application.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { MiddlewareResult, RouteMiddleware } from '@sinemacula/web-core/router/middleware';
import { next, redirect } from '@sinemacula/web-core/router/middleware';
import type { RouteLocationRaw } from 'vue-router';

import { useAuthStore } from '@/modules/auth/stores/auth-store';

/**
 * Build middleware that requires a signed-out visitor.
 *
 * @param redirectTo - where authenticated navigations are sent; defaults to
 *   `'/'` (the application root) so auth remains independent of any feature
 *   module
 * @returns the route middleware
 */
export function guestOnly(redirectTo: RouteLocationRaw = '/'): RouteMiddleware {
    return {
        handle(): MiddlewareResult {
            return useAuthStore().isAuthenticated ? redirect(redirectTo) : next();
        },
    };
}
