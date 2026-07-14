/**
 * Authorization checks.
 *
 * Wraps the kernel {@link PermissionSet} primitive over the signed-in user's
 * granted permissions from the auth store. Every check reads the store lazily
 * at call time (matching the middleware pattern) rather than caching a store
 * reference at import time.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { PermissionSet } from '@sinemacula/web-core/authorization/permission-set';

import type { AuthenticatedUser } from '@/modules/auth/services/auth-api';
import { useAuthStore } from '@/modules/auth/stores/auth-store';

/**
 * Determine whether the signed-in user holds a permission.
 *
 * @param permission - the permission string to check
 * @returns false when no user is signed in; otherwise whether the user's
 *   granted permissions allow `permission`
 */
export function can(permission: string): boolean {
    return evaluate(useAuthStore().user, permission);
}

/**
 * Build a permission-check function suited to template `v-if` bindings.
 *
 * The auth store's `user` is reactive; reading it inside the returned
 * function (rather than capturing a snapshot) means a template expression
 * such as `v-if="canCheck('users.view')"` re-evaluates whenever the
 * signed-in user changes.
 *
 * @returns a function that checks a permission against the current store user
 */
export function useCan(): (permission: string) => boolean {
    const store = useAuthStore();

    return (permission: string): boolean => evaluate(store.user, permission);
}

/**
 * Check a permission against a possibly-absent user record.
 *
 * @param user - the user to check, or null when signed out
 * @param permission - the permission string to check
 * @returns false when `user` is null; otherwise the PermissionSet result
 */
function evaluate(user: AuthenticatedUser | null, permission: string): boolean {
    return user !== null && new PermissionSet(user.permissions).allows(permission);
}
