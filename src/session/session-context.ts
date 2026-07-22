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

import type { TokenRefreshCoordinator } from '../http/token-refresh-coordinator';
import type { KeyValueStorage } from '../storage/key-value-storage';
import { createServiceHolder } from '@sinemacula/foundation/support/service-holder';
import type { SessionRoutes, SessionStorageKeys } from './create-session-module';
import type { SessionApi, SessionDevice } from './session-api';
import type { SessionUser } from './session-user';

/**
 * The resolved collaborators shared across the session module's units.
 */
export interface SessionContext<U extends SessionUser = SessionUser> {
    /** The resolved storage keys the session persists under. */
    readonly storageKeys: SessionStorageKeys;

    /** The resolved route identity feeding guards and redirects. */
    readonly routes: SessionRoutes;

    /** The storage adapter session state persists to. */
    readonly storage: KeyValueStorage;

    /** The pinia store id the session store registers under. */
    readonly storeId: string;

    /** Lazily constructed over the installed HTTP client on first access. */
    readonly api: SessionApi<U>;

    /** The single refresh authority: both the reactive 401 path and the proactive refresh timer route through it, so concurrent refresh attempts collapse into one in-flight call. */
    readonly coordinator: TokenRefreshCoordinator;

    /** Convert a legacy persisted wire timestamp to epoch milliseconds during hydration; returns null for unparseable values. */
    readonly parseTimestamp: (value: string) => number | null;

    /** Resolve the stable device fingerprint, generating and persisting the uuid on first use. */
    readonly device: () => SessionDevice;
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
 * Determine whether the session context has been installed.
 *
 * @returns true when a session context is installed
 */
export function isSessionContextInstalled(): boolean {
    return holder.isInstalled();
}

/**
 * Clear the session context back to its uninstalled state. Test-only.
 */
export function resetSessionContext(): void {
    holder.reset();
}
