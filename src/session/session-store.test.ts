/**
 * Unit tests for useSessionStore.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TokenRefreshCoordinator } from '../http/token-refresh-coordinator';
import { MemoryStorage } from '@sinemacula/foundation/storage/memory-storage';
import type { SessionApi, SessionDevice } from './session-api';
import { installSessionContext, resetSessionContext } from './session-context';
import { useSessionStore } from './session-store';
import type { SessionTokens } from './session-tokens';
import type { SessionUser } from './session-user';

const ACCESS_TOKEN_KEY = 'auth.access_token';
const REFRESH_TOKEN_KEY = 'auth.refresh_token';
const EXPIRES_AT_KEY = 'auth.expires_at';

/**
 * The epoch-millisecond instant for the UTC wire timestamp 2026-12-31 23:59:59.
 */
const SESSION_EXPIRY_EPOCH_MS = 1_798_761_599_000;

/**
 * An in-memory {@link SessionApi} fake that records every call and replays
 * queued outcomes in order.
 */
class FakeSessionApi implements SessionApi {
    readonly calls: string[] = [];
    readonly loginCalls: Array<{ credentials: unknown; device: SessionDevice }> = [];
    readonly refreshCalls: string[] = [];

    readonly #sessions: Array<SessionTokens | Error> = [];
    readonly #users: Array<SessionUser | Error> = [];
    #logoutError: Error | null = null;

    /**
     * Queue an outcome for the next login or refresh call.
     *
     * @param outcome - the tokens to resolve with, or the error to reject with
     */
    queueSession(outcome: SessionTokens | Error): void {
        this.#sessions.push(outcome);
    }

    /**
     * Queue an outcome for the next currentUser call.
     *
     * @param outcome - the user to resolve with, or the error to reject with
     */
    queueUser(outcome: SessionUser | Error): void {
        this.#users.push(outcome);
    }

    /**
     * Make the next logout call reject.
     *
     * @param error - the error to reject with
     */
    failLogout(error: Error): void {
        this.#logoutError = error;
    }

    login(credentials: unknown, device: SessionDevice): Promise<SessionTokens> {
        this.calls.push('login');
        this.loginCalls.push({ credentials, device });

        return take(this.#sessions);
    }

    refresh(refreshToken: string): Promise<SessionTokens> {
        this.calls.push('refresh');
        this.refreshCalls.push(refreshToken);

        return take(this.#sessions);
    }

    logout(): Promise<void> {
        this.calls.push('logout');

        return this.#logoutError === null ? Promise.resolve() : Promise.reject(this.#logoutError);
    }

    currentUser(): Promise<SessionUser> {
        this.calls.push('currentUser');

        return take(this.#users);
    }
}

/**
 * Consume the next queued outcome.
 *
 * @param queue - the outcome queue
 * @returns a promise resolving or rejecting with the next outcome
 */
function take<T>(queue: Array<T | Error>): Promise<T> {
    const outcome = queue.shift();

    if (outcome === undefined) {
        return Promise.reject(new Error('No queued outcome.'));
    }

    return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome);
}

/** A valid token bundle as returned by the gateway. */
function tokens(overrides: Partial<SessionTokens> = {}): SessionTokens {
    return {
        accessToken: 'new-token',
        refreshToken: 'new-refresh-token',
        expiresAtEpochMs: SESSION_EXPIRY_EPOCH_MS,
        ...overrides,
    };
}

/** A mapped user record as returned by the gateway. */
function user(): SessionUser {
    return { id: 'u1', email: 'alice@example.com', name: 'Alice Smith', permissions: [] };
}

describe('useSessionStore', () => {
    let storage: MemoryStorage;
    let fake: FakeSessionApi;
    let parseCalls: string[];

    /**
     * Install a test session context over fresh collaborators.
     *
     * @param overrides - optional context overrides
     */
    function installTestContext(
        overrides: { storeId?: string; parseTimestamp?: (value: string) => number | null } = {},
    ): void {
        installSessionContext({
            storageKeys: {
                accessToken: ACCESS_TOKEN_KEY,
                refreshToken: REFRESH_TOKEN_KEY,
                expiresAt: EXPIRES_AT_KEY,
                deviceUuid: 'auth.device_uuid',
            },
            routes: { login: { name: 'auth.login' }, loginPath: '/login', home: '/', forbidden: '/forbidden' },
            storage,
            storeId: overrides.storeId ?? 'auth',
            api: fake,
            coordinator: new TokenRefreshCoordinator({ refresh: () => Promise.resolve(false) }),
            parseTimestamp:
                overrides.parseTimestamp ??
                ((value: string): null => {
                    parseCalls.push(value);

                    return null;
                }),
            device: () => ({ uuid: 'device-uuid-1', os: 'WEB' }),
        });
    }

    beforeEach(() => {
        storage = new MemoryStorage();
        fake = new FakeSessionApi();
        parseCalls = [];
        setActivePinia(createPinia());
        installTestContext();
    });

    afterEach(() => {
        resetSessionContext();
    });

    it('throws when the session context is not installed', () => {
        resetSessionContext();

        expect(() => useSessionStore()).toThrowError('session context accessed before initialisation');
    });

    describe('initial state', () => {
        it('reads a persisted access token from storage', () => {
            storage.set(ACCESS_TOKEN_KEY, 'persisted-token');

            expect(useSessionStore().accessToken).toBe('persisted-token');
        });

        it('reads a persisted refresh token from storage', () => {
            storage.set(REFRESH_TOKEN_KEY, 'persisted-refresh');

            expect(useSessionStore().refreshToken).toBe('persisted-refresh');
        });

        it('initialises accessToken as null when storage is empty', () => {
            expect(useSessionStore().accessToken).toBeNull();
        });

        it('initialises refreshToken as null when storage is empty', () => {
            expect(useSessionStore().refreshToken).toBeNull();
        });

        it('initialises the user as null', () => {
            expect(useSessionStore().user).toBeNull();
        });

        it('hydrates a digits-only persisted expiry as epoch milliseconds', () => {
            storage.set(EXPIRES_AT_KEY, '1782820800000');

            expect(useSessionStore().expiresAtEpochMs).toBe(1_782_820_800_000);
            expect(parseCalls).toStrictEqual([]);
        });

        it('delegates a legacy non-numeric expiry to the configured parser', () => {
            resetSessionContext();
            installTestContext({
                parseTimestamp: value => (value === '2026-06-30 12:00:00' ? 1_782_820_800_000 : null),
            });
            storage.set(EXPIRES_AT_KEY, '2026-06-30 12:00:00');

            expect(useSessionStore().expiresAtEpochMs).toBe(1_782_820_800_000);
        });

        it('hydrates expiry as null when the legacy value is unparseable', () => {
            storage.set(EXPIRES_AT_KEY, 'not-a-timestamp');

            expect(useSessionStore().expiresAtEpochMs).toBeNull();
            expect(parseCalls).toStrictEqual(['not-a-timestamp']);
        });

        it('initialises expiresAtEpochMs as null when storage is empty', () => {
            expect(useSessionStore().expiresAtEpochMs).toBeNull();
            expect(parseCalls).toStrictEqual([]);
        });
    });

    describe('isAuthenticated getter', () => {
        it('returns true when an access token is present', () => {
            storage.set(ACCESS_TOKEN_KEY, 'tok');

            expect(useSessionStore().isAuthenticated).toBe(true);
        });

        it('returns false when no access token is present', () => {
            expect(useSessionStore().isAuthenticated).toBe(false);
        });
    });

    describe('login action', () => {
        it('sets the tokens and user after a successful login', async () => {
            fake.queueSession(tokens());
            fake.queueUser(user());

            const store = useSessionStore();

            await store.login({ email: 'alice@example.com', password: 'secret' });

            expect(store.accessToken).toBe('new-token');
            expect(store.refreshToken).toBe('new-refresh-token');
            expect(store.expiresAtEpochMs).toBe(SESSION_EXPIRY_EPOCH_MS);
            expect(store.user).toStrictEqual(user());
        });

        it('forwards the credentials and device fingerprint to the gateway', async () => {
            fake.queueSession(tokens());
            fake.queueUser(user());

            await useSessionStore().login({ email: 'alice@example.com', password: 'secret' });

            expect(fake.loginCalls).toStrictEqual([
                {
                    credentials: { email: 'alice@example.com', password: 'secret' },
                    device: { uuid: 'device-uuid-1', os: 'WEB' },
                },
            ]);
        });

        it('persists every session key, with expiry as an epoch-ms string', async () => {
            fake.queueSession(tokens({ accessToken: 'stored-token', refreshToken: 'stored-refresh' }));
            fake.queueUser(user());

            await useSessionStore().login({ email: 'alice@example.com', password: 'secret' });

            expect(storage.get(ACCESS_TOKEN_KEY)).toBe('stored-token');
            expect(storage.get(REFRESH_TOKEN_KEY)).toBe('stored-refresh');
            expect(storage.get(EXPIRES_AT_KEY)).toBe('1798761599000');
        });

        it('fetches the current user after the session is applied', async () => {
            fake.queueSession(tokens());
            fake.queueUser(user());

            const store = useSessionStore();

            await store.login({ email: 'alice@example.com', password: 'secret' });

            expect(fake.calls).toStrictEqual(['login', 'currentUser']);
            expect(store.user?.name).toBe('Alice Smith');
        });

        it('removes the persisted expiry when the session has none', async () => {
            storage.set(EXPIRES_AT_KEY, '1782820800000');
            fake.queueSession(tokens({ expiresAtEpochMs: null }));
            fake.queueUser(user());

            const store = useSessionStore();

            await store.login({ email: 'alice@example.com', password: 'secret' });

            expect(store.expiresAtEpochMs).toBeNull();
            expect(storage.get(EXPIRES_AT_KEY)).toBeNull();
        });

        it('removes the persisted refresh token when the session has none', async () => {
            storage.set(REFRESH_TOKEN_KEY, 'old-refresh');
            fake.queueSession(tokens({ refreshToken: null }));
            fake.queueUser(user());

            const store = useSessionStore();

            await store.login({ email: 'alice@example.com', password: 'secret' });

            expect(store.refreshToken).toBeNull();
            expect(storage.get(REFRESH_TOKEN_KEY)).toBeNull();
        });
    });

    describe('refresh action', () => {
        it('returns false immediately when no refresh token is stored', async () => {
            const store = useSessionStore();

            const result = await store.refresh();

            expect(result).toBe(false);
            expect(fake.calls).toStrictEqual([]);
        });

        it('updates tokens and returns true on a successful refresh', async () => {
            storage.set(REFRESH_TOKEN_KEY, 'old-refresh');
            fake.queueSession(tokens({ accessToken: 'fresh-token', refreshToken: 'fresh-refresh' }));

            const store = useSessionStore();
            const result = await store.refresh();

            expect(result).toBe(true);
            expect(fake.refreshCalls).toStrictEqual(['old-refresh']);
            expect(store.accessToken).toBe('fresh-token');
            expect(store.refreshToken).toBe('fresh-refresh');
            expect(store.expiresAtEpochMs).toBe(SESSION_EXPIRY_EPOCH_MS);
            expect(storage.get(ACCESS_TOKEN_KEY)).toBe('fresh-token');
            expect(storage.get(REFRESH_TOKEN_KEY)).toBe('fresh-refresh');
            expect(storage.get(EXPIRES_AT_KEY)).toBe('1798761599000');
        });

        it('clears the session and returns false when the refresh request fails', async () => {
            storage.set(ACCESS_TOKEN_KEY, 'old-token');
            storage.set(REFRESH_TOKEN_KEY, 'old-refresh');
            storage.set(EXPIRES_AT_KEY, '1782820800000');
            fake.queueSession(new Error('401 Unauthorized'));

            const store = useSessionStore();
            const result = await store.refresh();

            expect(result).toBe(false);
            expect(store.accessToken).toBeNull();
            expect(store.refreshToken).toBeNull();
            expect(store.expiresAtEpochMs).toBeNull();
            expect(store.user).toBeNull();
            expect(storage.get(ACCESS_TOKEN_KEY)).toBeNull();
            expect(storage.get(REFRESH_TOKEN_KEY)).toBeNull();
            expect(storage.get(EXPIRES_AT_KEY)).toBeNull();
        });
    });

    describe('logout action', () => {
        it('clears the session state on a successful logout', async () => {
            fake.queueSession(tokens());
            fake.queueUser(user());

            const store = useSessionStore();

            await store.login({ email: 'alice@example.com', password: 'secret' });
            await store.logout();

            expect(fake.calls).toStrictEqual(['login', 'currentUser', 'logout']);
            expect(store.accessToken).toBeNull();
            expect(store.refreshToken).toBeNull();
            expect(store.expiresAtEpochMs).toBeNull();
            expect(store.user).toBeNull();
        });

        it('removes the persisted session keys on logout', async () => {
            fake.queueSession(tokens());
            fake.queueUser(user());

            const store = useSessionStore();

            await store.login({ email: 'alice@example.com', password: 'secret' });
            await store.logout();

            expect(storage.get(ACCESS_TOKEN_KEY)).toBeNull();
            expect(storage.get(REFRESH_TOKEN_KEY)).toBeNull();
            expect(storage.get(EXPIRES_AT_KEY)).toBeNull();
        });

        it('still clears local state when the logout API call rejects', async () => {
            fake.queueSession(tokens());
            fake.queueUser(user());
            fake.failLogout(new Error('network failure'));

            const store = useSessionStore();

            await store.login({ email: 'alice@example.com', password: 'secret' });
            await store.logout();

            expect(store.accessToken).toBeNull();
            expect(store.user).toBeNull();
            expect(storage.get(ACCESS_TOKEN_KEY)).toBeNull();
            expect(storage.get(REFRESH_TOKEN_KEY)).toBeNull();
        });
    });

    describe('hydrateFromStorage action', () => {
        it('re-reads all three persisted keys into state', () => {
            const store = useSessionStore();

            storage.set(ACCESS_TOKEN_KEY, 'other-tab-token');
            storage.set(REFRESH_TOKEN_KEY, 'other-tab-refresh');
            storage.set(EXPIRES_AT_KEY, '1786752000000');

            store.hydrateFromStorage();

            expect(store.accessToken).toBe('other-tab-token');
            expect(store.refreshToken).toBe('other-tab-refresh');
            expect(store.expiresAtEpochMs).toBe(1_786_752_000_000);
        });

        it('delegates a legacy expiry to the configured parser on hydration', () => {
            resetSessionContext();
            installTestContext({ parseTimestamp: () => 1_782_820_800_000 });

            const store = useSessionStore();

            storage.set(EXPIRES_AT_KEY, '2026-06-30 12:00:00');
            store.hydrateFromStorage();

            expect(store.expiresAtEpochMs).toBe(1_782_820_800_000);
        });

        it('resets state to null when storage has no persisted keys', () => {
            storage.set(ACCESS_TOKEN_KEY, 'stale-token');

            const store = useSessionStore();

            storage.remove(ACCESS_TOKEN_KEY);
            store.hydrateFromStorage();

            expect(store.accessToken).toBeNull();
        });

        it('does not call the API', () => {
            useSessionStore().hydrateFromStorage();

            expect(fake.calls).toStrictEqual([]);
        });
    });

    describe('clearLocal action', () => {
        it('clears the session without calling the logout endpoint', async () => {
            fake.queueSession(tokens());
            fake.queueUser(user());

            const store = useSessionStore();

            await store.login({ email: 'alice@example.com', password: 'secret' });
            store.clearLocal();

            expect(fake.calls).toStrictEqual(['login', 'currentUser']);
            expect(store.accessToken).toBeNull();
            expect(store.refreshToken).toBeNull();
            expect(store.expiresAtEpochMs).toBeNull();
            expect(store.user).toBeNull();
        });

        it('removes the persisted session keys from storage', async () => {
            fake.queueSession(tokens());
            fake.queueUser(user());

            const store = useSessionStore();

            await store.login({ email: 'alice@example.com', password: 'secret' });
            store.clearLocal();

            expect(storage.get(ACCESS_TOKEN_KEY)).toBeNull();
            expect(storage.get(REFRESH_TOKEN_KEY)).toBeNull();
            expect(storage.get(EXPIRES_AT_KEY)).toBeNull();
        });
    });

    describe('rehydrateUser action', () => {
        it('fetches and stores the current user when a token is present but no user is loaded', async () => {
            storage.set(ACCESS_TOKEN_KEY, 'tok');
            fake.queueUser(user());

            const store = useSessionStore();

            await store.rehydrateUser();

            expect(store.user?.email).toBe('alice@example.com');
        });

        it('does nothing when no access token is present', async () => {
            const store = useSessionStore();

            await store.rehydrateUser();

            expect(store.user).toBeNull();
            expect(fake.calls).toStrictEqual([]);
        });

        it('does nothing when a user is already loaded', async () => {
            storage.set(ACCESS_TOKEN_KEY, 'tok');
            fake.queueUser(user());

            const store = useSessionStore();

            await store.rehydrateUser();
            await store.rehydrateUser();

            expect(fake.calls).toStrictEqual(['currentUser']);
        });

        it('swallows failures and leaves the user unset', async () => {
            storage.set(ACCESS_TOKEN_KEY, 'tok');
            fake.queueUser(new Error('network failure'));

            const store = useSessionStore();

            await expect(store.rehydrateUser()).resolves.toBeUndefined();
            expect(store.user).toBeNull();
        });

        it('shares one request across concurrent rehydrations', async () => {
            storage.set(ACCESS_TOKEN_KEY, 'tok');
            fake.queueUser(user());

            const store = useSessionStore();

            await Promise.all([store.rehydrateUser(), store.rehydrateUser()]);

            expect(fake.calls).toStrictEqual(['currentUser']);
            expect(store.user?.email).toBe('alice@example.com');
        });
    });

    describe('store id', () => {
        it('registers under the auth id from the context by default', () => {
            const store = useSessionStore() as unknown as Record<'$id', string>;

            expect(store.$id).toBe('auth');
        });

        it('registers under a custom store id from the context', () => {
            resetSessionContext();
            installTestContext({ storeId: 'custom-session' });

            const store = useSessionStore() as unknown as Record<'$id', string>;

            expect(store.$id).toBe('custom-session');
        });

        it('exposes a $dispose hook for application disposal', () => {
            const store = useSessionStore();

            expect(typeof store.$dispose).toBe('function');
            expect(() => {
                store.$dispose();
            }).not.toThrow();
        });
    });

    it('resolves against an explicitly supplied pinia instance', () => {
        const pinia = createPinia();

        storage.set(ACCESS_TOKEN_KEY, 'explicit-pinia-token');

        expect(useSessionStore(pinia).accessToken).toBe('explicit-pinia-token');
    });
});
