/**
 * Authentication store.
 *
 * Owns the session state: access token, refresh token, expiry, and the
 * authenticated user. All transitions go through the actions; nothing
 * else writes tokens to storage.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { defineStore } from 'pinia';

import { deviceFingerprint } from '@/modules/auth/device';
import type { AuthenticatedSession, AuthenticatedUser, LoginCredentials } from '@/modules/auth/services/auth-api';
import { AuthApi } from '@/modules/auth/services/auth-api';
import { api } from '@/services/api';
import { appStorage } from '@/services/storage';

/**
 * Storage key under which the access token is persisted across reloads.
 */
export const ACCESS_TOKEN_STORAGE_KEY = 'auth.access_token';

/**
 * Storage key under which the refresh token is persisted across reloads.
 */
export const REFRESH_TOKEN_STORAGE_KEY = 'auth.refresh_token';

/**
 * Storage key under which the session expiry is persisted across reloads.
 */
export const EXPIRES_AT_STORAGE_KEY = 'auth.expires_at';

interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: string | null;
    user: AuthenticatedUser | null;
}

/**
 * Manages the user's authentication session: tokens and user record.
 */
export const useAuthStore = defineStore('auth', {
    state: (): AuthState => ({
        accessToken: appStorage().get(ACCESS_TOKEN_STORAGE_KEY),
        refreshToken: appStorage().get(REFRESH_TOKEN_STORAGE_KEY),
        expiresAt: appStorage().get(EXPIRES_AT_STORAGE_KEY),
        user: null,
    }),

    getters: {
        isAuthenticated: (state): boolean => state.accessToken !== null,
    },

    actions: {
        /**
         * Exchange credentials for a session, persist tokens, and load the
         * current user.
         *
         * @param credentials - the login credentials
         */
        async login(credentials: LoginCredentials): Promise<void> {
            const storage = appStorage();
            const device = deviceFingerprint(storage);
            const authApi = new AuthApi(api());
            const session = await authApi.login({ ...credentials, ...device });

            applySession(this, storage, session);

            this.user = await authApi.getCurrentUser();
        },

        /**
         * Use the refresh token to obtain a new session.
         *
         * Returns false and clears the session when no refresh token is
         * available or when the refresh request fails.
         *
         * @returns true when the session was refreshed successfully
         */
        async refresh(): Promise<boolean> {
            if (this.refreshToken === null) {
                return false;
            }

            try {
                const session = await new AuthApi(api()).refresh(this.refreshToken);

                applySession(this, appStorage(), session);

                return true;
            } catch {
                clearSession(this, appStorage());

                return false;
            }
        },

        /**
         * Discard the session locally and best-effort invalidate it
         * server-side.
         */
        async logout(): Promise<void> {
            try {
                await new AuthApi(api()).logout();
            } catch {
                // The local session is discarded regardless of server
                // reachability.
            }

            clearSession(this, appStorage());
        },

        /**
         * Re-read the persisted tokens and expiry from storage into state.
         *
         * Used by cross-tab session synchronisation to mirror a change made
         * by another tab; it never calls the API.
         */
        hydrateFromStorage(): void {
            const storage = appStorage();

            this.accessToken = storage.get(ACCESS_TOKEN_STORAGE_KEY);
            this.refreshToken = storage.get(REFRESH_TOKEN_STORAGE_KEY);
            this.expiresAt = storage.get(EXPIRES_AT_STORAGE_KEY);
        },

        /**
         * Discard the session locally without calling the logout endpoint.
         *
         * Used when another tab has already ended the session; invalidating
         * it server-side again is unnecessary.
         */
        clearLocal(): void {
            clearSession(this, appStorage());
        },

        /**
         * Fetch and store the current user when a session is present but no
         * user record has been loaded yet.
         *
         * Failures are swallowed: a dead session is caught by the
         * 401-refresh flow or the session-loss watcher, not by this action.
         */
        async rehydrateUser(): Promise<void> {
            if (this.accessToken === null || this.user !== null) {
                return;
            }

            try {
                this.user = await new AuthApi(api()).getCurrentUser();
            } catch {
                // Swallowed: a dead session is handled elsewhere.
            }
        },
    },
});

/**
 * Apply a freshly issued session onto the store and persist it to storage.
 *
 * @param store - the auth store instance
 * @param storage - the key-value storage adapter
 * @param session - the session returned by login or refresh
 */
function applySession(
    store: { accessToken: string | null; refreshToken: string | null; expiresAt: string | null },
    storage: ReturnType<typeof appStorage>,
    session: AuthenticatedSession,
): void {
    store.accessToken = session.accessToken;
    store.refreshToken = session.refreshToken;
    store.expiresAt = session.expiresAt;

    storage.set(ACCESS_TOKEN_STORAGE_KEY, session.accessToken);
    storage.set(REFRESH_TOKEN_STORAGE_KEY, session.refreshToken);
    storage.set(EXPIRES_AT_STORAGE_KEY, session.expiresAt);
}

/**
 * Clear all session state from the store and remove persisted tokens from
 * storage.
 *
 * @param store - the auth store instance
 * @param storage - the key-value storage adapter
 */
function clearSession(
    store: {
        accessToken: string | null;
        refreshToken: string | null;
        expiresAt: string | null;
        user: AuthenticatedUser | null;
    },
    storage: ReturnType<typeof appStorage>,
): void {
    store.accessToken = null;
    store.refreshToken = null;
    store.expiresAt = null;
    store.user = null;

    storage.remove(ACCESS_TOKEN_STORAGE_KEY);
    storage.remove(REFRESH_TOKEN_STORAGE_KEY);
    storage.remove(EXPIRES_AT_STORAGE_KEY);
}
