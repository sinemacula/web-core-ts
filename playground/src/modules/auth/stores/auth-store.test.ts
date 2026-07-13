/**
 * Unit tests for useAuthStore.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { MemoryStorage } from '@sinemacula/web-core/storage/memory-storage';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    ACCESS_TOKEN_STORAGE_KEY,
    EXPIRES_AT_STORAGE_KEY,
    REFRESH_TOKEN_STORAGE_KEY,
    useAuthStore,
} from '@/modules/auth/stores/auth-store';
import { initialiseApi, resetApi } from '@/services/api';
import { initialiseStorage, resetStorage } from '@/services/storage';
import { FakeHttpClient } from '@/test-support/fake-http-client';

/**
 * Build a `Record<string, unknown>` from an array of `[key, value]` pairs.
 *
 * Wraps `Object.fromEntries` so callers can write snake_case API field names
 * as plain string literals inside array elements rather than as object-literal
 * keys - keeping non-camelCase field names out of any position that Biome's
 * naming-convention or literal-keys rules inspect.
 *
 * @param entries - key-value pairs for the record
 * @returns a plain `Record<string, unknown>`
 */
function wire(entries: ReadonlyArray<readonly [string, unknown]>): Record<string, unknown> {
    return Object.fromEntries(entries);
}

/** A valid session envelope as returned by the API. */
function sessionEnvelope(
    token = 'new-token',
    refreshToken = 'new-refresh-token',
    expiresAt = '2026-12-31 23:59:59',
): Record<string, unknown> {
    return {
        data: wire([
            ['token', token],
            ['refresh_token', refreshToken],
            ['expires_at', expiresAt],
        ]),
    };
}

/** A valid user envelope as returned by GET users/self. */
function userEnvelope(): Record<string, unknown> {
    return {
        data: wire([
            ['id', 'u1'],
            ['first_name', 'Alice'],
            ['last_name', 'Smith'],
            ['full_name', 'Alice Smith'],
            ['email', 'alice@example.com'],
        ]),
    };
}

describe('useAuthStore', () => {
    let fake: FakeHttpClient;
    let storage: MemoryStorage;

    beforeEach(() => {
        storage = new MemoryStorage();
        initialiseStorage(storage);
        fake = new FakeHttpClient();
        initialiseApi(fake);
        setActivePinia(createPinia());
    });

    afterEach(() => {
        resetApi();
        resetStorage();
    });

    describe('initial state', () => {
        it('reads a persisted access token from storage', () => {
            storage.set(ACCESS_TOKEN_STORAGE_KEY, 'persisted-token');
            const store = useAuthStore();

            expect(store.accessToken).toBe('persisted-token');
        });

        it('reads a persisted refresh token from storage', () => {
            storage.set(REFRESH_TOKEN_STORAGE_KEY, 'persisted-refresh');
            const store = useAuthStore();

            expect(store.refreshToken).toBe('persisted-refresh');
        });

        it('initialises accessToken as null when storage is empty', () => {
            const store = useAuthStore();

            expect(store.accessToken).toBeNull();
        });

        it('initialises refreshToken as null when storage is empty', () => {
            const store = useAuthStore();

            expect(store.refreshToken).toBeNull();
        });

        it('reads a persisted expiresAt from storage', () => {
            storage.set(EXPIRES_AT_STORAGE_KEY, '2026-06-30 12:00:00');
            const store = useAuthStore();

            expect(store.expiresAt).toBe('2026-06-30 12:00:00');
        });

        it('initialises expiresAt as null when storage is empty', () => {
            const store = useAuthStore();

            expect(store.expiresAt).toBeNull();
        });
    });

    describe('isAuthenticated getter', () => {
        it('returns true when an access token is present', () => {
            storage.set(ACCESS_TOKEN_STORAGE_KEY, 'tok');
            const store = useAuthStore();

            expect(store.isAuthenticated).toBe(true);
        });

        it('returns false when no access token is present', () => {
            const store = useAuthStore();

            expect(store.isAuthenticated).toBe(false);
        });
    });

    describe('login action', () => {
        it('sets the access token and user after a successful login', async () => {
            fake.queueResponse(sessionEnvelope());
            fake.queueResponse(userEnvelope());

            const store = useAuthStore();

            await store.login({ email: 'alice@example.com', password: 'secret' });

            expect(store.accessToken).toBe('new-token');
            expect(store.refreshToken).toBe('new-refresh-token');
            expect(store.user?.firstName).toBe('Alice');
            expect(store.user?.email).toBe('alice@example.com');
        });

        it('persists the access token to storage', async () => {
            fake.queueResponse(sessionEnvelope('stored-token'));
            fake.queueResponse(userEnvelope());

            await useAuthStore().login({ email: 'alice@example.com', password: 'secret' });

            expect(storage.get(ACCESS_TOKEN_STORAGE_KEY)).toBe('stored-token');
        });

        it('persists the refresh token to storage', async () => {
            fake.queueResponse(sessionEnvelope('tok', 'stored-refresh'));
            fake.queueResponse(userEnvelope());

            await useAuthStore().login({ email: 'alice@example.com', password: 'secret' });

            expect(storage.get(REFRESH_TOKEN_STORAGE_KEY)).toBe('stored-refresh');
        });

        it('fetches the current user after login', async () => {
            fake.queueResponse(sessionEnvelope());
            fake.queueResponse(userEnvelope());

            const store = useAuthStore();

            await store.login({ email: 'alice@example.com', password: 'secret' });

            const userCall = fake.calls.at(1);

            expect(userCall?.method).toBe('GET');
            expect(userCall?.path).toBe('users/self');
            expect(store.user?.fullName).toBe('Alice Smith');
        });

        it('sets expiresAt from the session', async () => {
            fake.queueResponse(sessionEnvelope('t', 'r', '2026-06-30 12:00:00'));
            fake.queueResponse(userEnvelope());

            const store = useAuthStore();

            await store.login({ email: 'alice@example.com', password: 'secret' });

            expect(store.expiresAt).toBe('2026-06-30 12:00:00');
        });
    });

    describe('refresh action', () => {
        it('returns false immediately when no refresh token is stored', async () => {
            const store = useAuthStore();

            const result = await store.refresh();

            expect(result).toBe(false);
        });

        it('updates tokens and returns true on a successful refresh', async () => {
            storage.set(REFRESH_TOKEN_STORAGE_KEY, 'old-refresh');
            fake.queueResponse(sessionEnvelope('fresh-token', 'fresh-refresh', '2026-08-15 00:00:00'));

            const store = useAuthStore();
            const result = await store.refresh();

            expect(result).toBe(true);
            expect(store.accessToken).toBe('fresh-token');
            expect(store.refreshToken).toBe('fresh-refresh');
            expect(store.expiresAt).toBe('2026-08-15 00:00:00');
            expect(storage.get(ACCESS_TOKEN_STORAGE_KEY)).toBe('fresh-token');
            expect(storage.get(REFRESH_TOKEN_STORAGE_KEY)).toBe('fresh-refresh');
            expect(storage.get(EXPIRES_AT_STORAGE_KEY)).toBe('2026-08-15 00:00:00');
        });

        it('clears the session and returns false when the refresh request fails', async () => {
            storage.set(ACCESS_TOKEN_STORAGE_KEY, 'old-token');
            storage.set(REFRESH_TOKEN_STORAGE_KEY, 'old-refresh');
            storage.set(EXPIRES_AT_STORAGE_KEY, '2026-06-30 12:00:00');
            fake.queueError(new Error('401 Unauthorized'));

            const store = useAuthStore();
            const result = await store.refresh();

            expect(result).toBe(false);
            expect(store.accessToken).toBeNull();
            expect(store.refreshToken).toBeNull();
            expect(store.expiresAt).toBeNull();
            expect(store.user).toBeNull();
            expect(storage.get(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
            expect(storage.get(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
            expect(storage.get(EXPIRES_AT_STORAGE_KEY)).toBeNull();
        });
    });

    describe('logout action', () => {
        it('clears the access token and user on a successful logout', async () => {
            fake.queueResponse(sessionEnvelope());
            fake.queueResponse(userEnvelope());
            fake.queueResponse(undefined);

            const store = useAuthStore();

            await store.login({ email: 'alice@example.com', password: 'secret' });
            await store.logout();

            expect(store.accessToken).toBeNull();
            expect(store.user).toBeNull();
        });

        it('removes the tokens from storage on logout', async () => {
            fake.queueResponse(sessionEnvelope());
            fake.queueResponse(userEnvelope());
            fake.queueResponse(undefined);

            const store = useAuthStore();

            await store.login({ email: 'alice@example.com', password: 'secret' });
            await store.logout();

            expect(storage.get(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
            expect(storage.get(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
            expect(storage.get(EXPIRES_AT_STORAGE_KEY)).toBeNull();
        });

        it('clears expiresAt on logout', async () => {
            fake.queueResponse(sessionEnvelope());
            fake.queueResponse(userEnvelope());
            fake.queueResponse(undefined);

            const store = useAuthStore();

            await store.login({ email: 'alice@example.com', password: 'secret' });
            await store.logout();

            expect(store.expiresAt).toBeNull();
        });

        it('still clears local state when the logout API call rejects', async () => {
            fake.queueResponse(sessionEnvelope());
            fake.queueResponse(userEnvelope());
            fake.queueError(new Error('network failure'));

            const store = useAuthStore();

            await store.login({ email: 'alice@example.com', password: 'secret' });
            await store.logout();

            expect(store.accessToken).toBeNull();
            expect(store.user).toBeNull();
            expect(storage.get(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
            expect(storage.get(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
        });
    });

    describe('hydrateFromStorage action', () => {
        it('re-reads all three persisted keys into state', () => {
            const store = useAuthStore();

            storage.set(ACCESS_TOKEN_STORAGE_KEY, 'other-tab-token');
            storage.set(REFRESH_TOKEN_STORAGE_KEY, 'other-tab-refresh');
            storage.set(EXPIRES_AT_STORAGE_KEY, '2026-09-01 00:00:00');

            store.hydrateFromStorage();

            expect(store.accessToken).toBe('other-tab-token');
            expect(store.refreshToken).toBe('other-tab-refresh');
            expect(store.expiresAt).toBe('2026-09-01 00:00:00');
        });

        it('resets state to null when storage has no persisted keys', () => {
            storage.set(ACCESS_TOKEN_STORAGE_KEY, 'stale-token');
            const store = useAuthStore();

            storage.remove(ACCESS_TOKEN_STORAGE_KEY);
            store.hydrateFromStorage();

            expect(store.accessToken).toBeNull();
        });

        it('does not call the API', () => {
            const store = useAuthStore();

            store.hydrateFromStorage();

            expect(fake.calls).toHaveLength(0);
        });
    });

    describe('clearLocal action', () => {
        it('clears the access token and user without calling the logout endpoint', async () => {
            fake.queueResponse(sessionEnvelope());
            fake.queueResponse(userEnvelope());

            const store = useAuthStore();

            await store.login({ email: 'alice@example.com', password: 'secret' });
            const callCountAfterLogin = fake.calls.length;

            store.clearLocal();

            expect(store.accessToken).toBeNull();
            expect(store.refreshToken).toBeNull();
            expect(store.expiresAt).toBeNull();
            expect(store.user).toBeNull();
            expect(fake.calls).toHaveLength(callCountAfterLogin);
        });

        it('removes the persisted tokens from storage', async () => {
            fake.queueResponse(sessionEnvelope());
            fake.queueResponse(userEnvelope());

            const store = useAuthStore();

            await store.login({ email: 'alice@example.com', password: 'secret' });
            store.clearLocal();

            expect(storage.get(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
            expect(storage.get(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
            expect(storage.get(EXPIRES_AT_STORAGE_KEY)).toBeNull();
        });
    });

    describe('rehydrateUser action', () => {
        it('fetches and stores the current user when a token is present but no user is loaded', async () => {
            storage.set(ACCESS_TOKEN_STORAGE_KEY, 'tok');
            fake.queueResponse(userEnvelope());

            const store = useAuthStore();

            await store.rehydrateUser();

            expect(store.user?.email).toBe('alice@example.com');
        });

        it('does nothing when no access token is present', async () => {
            const store = useAuthStore();

            await store.rehydrateUser();

            expect(store.user).toBeNull();
            expect(fake.calls).toHaveLength(0);
        });

        it('does nothing when a user is already loaded', async () => {
            storage.set(ACCESS_TOKEN_STORAGE_KEY, 'tok');
            fake.queueResponse(userEnvelope());

            const store = useAuthStore();

            await store.rehydrateUser();
            const callCountAfterFirstFetch = fake.calls.length;

            await store.rehydrateUser();

            expect(fake.calls).toHaveLength(callCountAfterFirstFetch);
        });

        it('swallows failures and leaves the user unset', async () => {
            storage.set(ACCESS_TOKEN_STORAGE_KEY, 'tok');
            fake.queueError(new Error('network failure'));

            const store = useAuthStore();

            await expect(store.rehydrateUser()).resolves.toBeUndefined();
            expect(store.user).toBeNull();
        });
    });
});
