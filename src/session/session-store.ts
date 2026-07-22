/**
 * Session store.
 *
 * The pinia binding over the foundation session core: state hydrates
 * synchronously through `createInitialSessionState`, and every action forwards
 * the store's own state plus the installed session context into the core
 * transitions - nothing else writes tokens to storage.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { Pinia } from 'pinia';
import { defineStore } from 'pinia';

import {
    clearSession,
    createInitialSessionState,
    hydrateStateFromStorage,
    loginWithCredentials,
    logoutSession,
    refreshSession,
    rehydrateSessionUser,
} from '@sinemacula/foundation/session/session-core';
import type { SessionState } from '@sinemacula/foundation/session/session-state';
import type { SessionUser } from '@sinemacula/foundation/session/session-user';
import { sessionContext } from './session-context';

/**
 * The session store contract consumed by guards, authorization checks and the
 * session module's lifecycle wiring.
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
     * Exchange credentials for a session, persist every session key, and load
     * the current user.
     *
     * @param credentials - the login credentials, forwarded opaquely to the
     * gateway
     */
    login(credentials: unknown): Promise<void>;

    /**
     * Use the refresh token to obtain a new session.
     *
     * @returns true when the session was refreshed; false (with the session
     * cleared) when no refresh token exists or the request fails
     */
    refresh(): Promise<boolean>;

    /**
     * Discard the session locally and best-effort invalidate it server-side.
     */
    logout(): Promise<void>;

    /**
     * Re-read the persisted tokens and expiry from storage into state. Used by
     * cross-tab synchronisation; it never calls the API.
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

/**
 * Resolve the session store over the installed session context.
 *
 * @param pinia - the pinia instance to resolve against; defaults to the active
 * instance
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
        state: (): SessionState => createInitialSessionState(sessionContext()),

        getters: {
            isAuthenticated: (state): boolean => state.accessToken !== null,
        },

        actions: {
            async login(credentials: unknown): Promise<void> {
                await loginWithCredentials(this, sessionContext(), credentials);
            },

            refresh(): Promise<boolean> {
                return refreshSession(this, sessionContext());
            },

            async logout(): Promise<void> {
                await logoutSession(this, sessionContext());
            },

            hydrateFromStorage(): void {
                hydrateStateFromStorage(this, sessionContext());
            },

            clearLocal(): void {
                clearSession(this, sessionContext());
            },

            async rehydrateUser(): Promise<void> {
                await rehydrateSessionUser(this, sessionContext());
            },
        },
    });

    return definition as unknown as (pinia?: Pinia) => SessionStore;
}
