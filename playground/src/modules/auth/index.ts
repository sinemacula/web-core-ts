/**
 * Auth module public surface.
 *
 * This is the only entry point other modules may import from when they need
 * anything from the auth module. All cross-module imports must go through
 * here; deep paths inside `src/modules/auth/**` are module-internal and must
 * not be referenced from outside this module. The generic session machinery
 * (store, guards, authorization, redirect handling) lives in the kernel
 * session module and is re-exported here under the module's established
 * names, so consumers are unaffected by where it is implemented.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

export { can, useCan } from '@sinemacula/web-core/session/authorization';
export { authenticated, authorize, guestOnly } from '@sinemacula/web-core/session/middleware';
export {
    appendRedirectTarget,
    REDIRECT_QUERY_KEY,
    sanitiseRedirectTarget,
} from '@sinemacula/web-core/session/redirect';
export { useSessionStore as useAuthStore } from '@sinemacula/web-core/session/session-store';
export { authModule } from './module';
export { AUTH_ROUTE_NAMES } from './route-names';
