/**
 * Session module context.
 *
 * The resolved session-module options and collaborators, installed once at the
 * module's register phase and read lazily by the session store, the guard
 * factories, and the authorization helpers. The context carries the storage
 * keys, the route identity, the storage adapter, the lazily-built session API
 * gateway, and the single token-refresh authority that both the reactive 401
 * path and the proactive refresh timer route through.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { TokenRefreshCoordinator } from '@sinemacula/foundation/http/token-refresh-coordinator';
import { createServiceHolder } from '@sinemacula/foundation/support/service-holder';
import type { SessionCoreContext } from '@sinemacula/foundation/session/session-core';
import type { SessionUser } from '@sinemacula/foundation/session/session-user';
import type { SessionRoutes } from './create-session-module';

/**
 * The resolved collaborators shared across the session module's units: the
 * foundation core slice (storage, storage keys, the lazily-built API gateway,
 * the device fingerprint and the legacy timestamp parser) extended with the
 * web-owned route identity, store id and refresh authority.
 */
export interface SessionContext<U extends SessionUser = SessionUser> extends SessionCoreContext<U> {
    /** The resolved route identity feeding guards and redirects. */
    readonly routes: SessionRoutes;

    /** The pinia store id the session store registers under. */
    readonly storeId: string;

    /** The single refresh authority: both the reactive 401 path and the proactive refresh timer route through it, so concurrent refresh attempts collapse into one in-flight call. */
    readonly coordinator: TokenRefreshCoordinator;
}

const holder = createServiceHolder<SessionContext>('session context');

/**
 * Install the session context. Called once at the module's register phase.
 *
 * @param context - the resolved context to install
 */
export function installSessionContext<U extends SessionUser = SessionUser>(context: SessionContext<U>): void {
    holder.install(context as SessionContext);
}

/**
 * The installed session context, cast to the application's user shape.
 *
 * @returns the installed context
 * @throws Error when accessed before {@link installSessionContext}
 */
export function sessionContext<U extends SessionUser = SessionUser>(): SessionContext<U> {
    return holder.resolve() as SessionContext<U>;
}

/**
 * Clear the session context back to its uninstalled state. Test-only.
 */
export function resetSessionContext(): void {
    holder.reset();
}
