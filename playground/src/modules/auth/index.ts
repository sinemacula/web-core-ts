/**
 * Auth module public surface.
 *
 * This is the only entry point other modules may import from when they need
 * anything from the auth module. All cross-module imports must go through
 * here; deep paths inside `src/modules/auth/**` are module-internal and must
 * not be referenced from outside this module.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

export { can, useCan } from './authorization';
export { authenticated, authorize, guestOnly } from './middleware';
export { authModule } from './module';
export { appendRedirectTarget, REDIRECT_QUERY_KEY, sanitiseRedirectTarget } from './redirect';
export { AUTH_ROUTE_NAMES } from './route-names';
export type { SessionLifecycleOptions } from './session-lifecycle';
export { installSessionLifecycle } from './session-lifecycle';
export { useAuthStore } from './stores/auth-store';
