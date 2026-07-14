/**
 * Session store.
 *
 * Owns the session state: access token, refresh token, expiry, and the
 * authenticated user. All transitions go through the actions; nothing else
 * writes tokens to storage. State hydrates from the installed session
 * context's storage at store creation, and expiry persists as an
 * epoch-millisecond string - legacy wire-format values from sessions
 * predating that format are delegated to the context's timestamp parser.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { Pinia } from 'pinia';
import { defineStore } from 'pinia';

import type { SessionContext } from './session-context';
import { sessionContext } from './session-context';
import type { SessionTokens } from './session-tokens';
import type { SessionUser } from './session-user';

/**
 * The session store contract consumed by guards, authorization checks and
 * the session module's lifecycle wiring.
 */
export interface SessionStore<U extends SessionUser = SessionUser> {
    /** The bearer token for the active session, or null when signed out. */
    readonly accessToken: string | null;

    /** The refresh token for the active session, or null when not issued. */
    readonly refreshToken: string | null;

    /** Absolute session expiry in epoch milliseconds, or null when unknown. */
    readonly expiresAtEpochMs: number | null;

    /** The authenticated user record, or null when not yet loaded. */
    readonly user: U | null;

    /** Whether an access token is present. */
    readonly isAuthenticated: boolean;

    /**
     * Exchange credentials for a session, persist every session key, and
     * load the current user.
     *
     * @param credentials - the login credentials, forwarded opaquely to the gateway
     */
    login(credentials: unknown): Promise<void>;

    /**
     * Use the refresh token to obtain a new session.
     *
     * @returns true when the session was refreshed; false (with the session
     *   cleared) when no refresh token exists or the request fails
     */
    refresh(): Promise<boolean>;

    /**
     * Discard the session locally and best-effort invalidate it server-side.
     */
    logout(): Promise<void>;

    /**
     * Re-read the persisted tokens and expiry from storage into state. Used
     * by cross-tab synchronisation; it never calls the API.
     */
    hydrateFromStorage(): void;

    /**
     * Discard the session locally without calling the logout endpoint.
     */
    clearLocal(): void;

    /**
     * Fetch and store the current user when a session is present but no user
     * record has been loaded yet. Failures are swallowed.
     */
    rehydrateUser(): Promise<void>;

    /**
     * Stop the store's effect scope; composed into application disposal.
     */
    $dispose(): void;
}

interface SessionState {
    accessToken: string | null;
    refreshToken: string | null;
    expiresAtEpochMs: number | null;
    user: SessionUser | null;
}

/**
 * Resolve the session store over the installed session context.
 *
 * @param pinia - the pinia instance to resolve against; defaults to the
 *   active instance
 * @returns the session store, registered under the context's store id
 */
export function useSessionStore<U extends SessionUser = SessionUser>(pinia?: Pinia): SessionStore<U> {
    return sessionStoreDefinition(sessionContext().storeId)(pinia) as SessionStore<U>;
}

/**
 * Define the session store under the given id.
 *
 * @param id - the pinia store id from the session context
 * @returns the pinia store hook
 */
function sessionStoreDefinition(id: string): (pinia?: Pinia) => SessionStore {
    const definition = defineStore(id, {
        state: (): SessionState => {
            const context = sessionContext();

            return {
                accessToken: context.storage.get(context.storageKeys.accessToken),
                refreshToken: context.storage.get(context.storageKeys.refreshToken),
                expiresAtEpochMs: readPersistedExpiry(context),
                user: null,
            };
        },

        getters: {
            isAuthenticated: (state): boolean => state.accessToken !== null,
        },

        actions: {
            async login(credentials: unknown): Promise<void> {
                await loginWithCredentials(this, credentials);
            },

            refresh(): Promise<boolean> {
                return refreshSession(this);
            },

            async logout(): Promise<void> {
                await logoutSession(this);
            },

            hydrateFromStorage(): void {
                hydrateStateFromStorage(this);
            },

            clearLocal(): void {
                clearSession(this, sessionContext());
            },

            async rehydrateUser(): Promise<void> {
                await rehydrateSessionUser(this);
            },
        },
    });

    return definition as unknown as (pinia?: Pinia) => SessionStore;
}

/**
 * Exchange credentials for a session, persist it, and load the current user.
 *
 * @param state - the mutable store state
 * @param credentials - the login credentials
 */
async function loginWithCredentials(state: SessionState, credentials: unknown): Promise<void> {
    const context = sessionContext();

    // The credential shape is the gateway's concern; the store forwards it opaquely.
    const session = await context.api.login(credentials as { email: string; password: string }, context.device());

    applySession(state, context, session);

    state.user = await context.api.currentUser();
}

/**
 * Use the refresh token to obtain a new session.
 *
 * @param state - the mutable store state
 * @returns true when the session was refreshed; false (with the session
 *   cleared) when no refresh token exists or the request fails
 */
async function refreshSession(state: SessionState): Promise<boolean> {
    if (state.refreshToken === null) {
        return false;
    }

    const context = sessionContext();

    try {
        applySession(state, context, await context.api.refresh(state.refreshToken));

        return true;
    } catch {
        clearSession(state, context);

        return false;
    }
}

/**
 * Discard the session locally and best-effort invalidate it server-side.
 *
 * @param state - the mutable store state
 */
async function logoutSession(state: SessionState): Promise<void> {
    const context = sessionContext();

    try {
        await context.api.logout();
    } catch {
        // The local session is discarded regardless of server reachability.
    }

    clearSession(state, context);
}

/**
 * Re-read the persisted tokens and expiry from storage into state.
 *
 * @param state - the mutable store state
 */
function hydrateStateFromStorage(state: SessionState): void {
    const context = sessionContext();

    state.accessToken = context.storage.get(context.storageKeys.accessToken);
    state.refreshToken = context.storage.get(context.storageKeys.refreshToken);
    state.expiresAtEpochMs = readPersistedExpiry(context);
}

/**
 * Fetch and store the current user when a session is present but no user
 * record has been loaded yet. Failures are swallowed.
 *
 * @param state - the mutable store state
 */
async function rehydrateSessionUser(state: SessionState): Promise<void> {
    if (state.accessToken === null || state.user !== null) {
        return;
    }

    try {
        state.user = await sessionContext().api.currentUser();
    } catch {
        // Swallowed: a dead session is handled by the 401-refresh flow or the session-loss watcher.
    }
}

/**
 * Apply a freshly issued session onto the store and persist it to storage.
 *
 * @param state - the mutable store state
 * @param context - the installed session context
 * @param session - the session returned by login or refresh
 */
function applySession(state: SessionState, context: SessionContext, session: SessionTokens): void {
    state.accessToken = session.accessToken;
    state.refreshToken = session.refreshToken;
    state.expiresAtEpochMs = session.expiresAtEpochMs;

    context.storage.set(context.storageKeys.accessToken, session.accessToken);

    if (session.refreshToken === null) {
        context.storage.remove(context.storageKeys.refreshToken);
    } else {
        context.storage.set(context.storageKeys.refreshToken, session.refreshToken);
    }

    if (session.expiresAtEpochMs === null) {
        context.storage.remove(context.storageKeys.expiresAt);
    } else {
        context.storage.set(context.storageKeys.expiresAt, String(session.expiresAtEpochMs));
    }
}

/**
 * Clear all session state from the store and remove every persisted session
 * key from storage.
 *
 * @param state - the mutable store state
 * @param context - the installed session context
 */
function clearSession(state: SessionState, context: SessionContext): void {
    state.accessToken = null;
    state.refreshToken = null;
    state.expiresAtEpochMs = null;
    state.user = null;

    context.storage.remove(context.storageKeys.accessToken);
    context.storage.remove(context.storageKeys.refreshToken);
    context.storage.remove(context.storageKeys.expiresAt);
}

/**
 * Read the persisted expiry, tolerating the legacy wire format.
 *
 * @param context - the installed session context
 * @returns the expiry in epoch milliseconds, or null when absent or unparseable
 */
function readPersistedExpiry(context: SessionContext): number | null {
    const persisted = context.storage.get(context.storageKeys.expiresAt);

    if (persisted === null) {
        return null;
    }

    // Digits-only values are the current epoch-ms format; anything else is a legacy wire timestamp.
    return /^\d+$/.test(persisted) ? Number(persisted) : context.parseTimestamp(persisted);
}
