/**
 * Unit tests for useSessionStore.
 *
 * The transition behaviour itself is covered by the foundation session-core
 * suite; these cases prove the pinia binding - state seeding, getter, action
 * delegation with the installed context, store id wiring and disposal.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TokenRefreshCoordinator } from '@sinemacula/foundation/http/token-refresh-coordinator';
import type { SessionApi, SessionDevice } from '@sinemacula/foundation/session/session-api';
import type { SessionTokens } from '@sinemacula/foundation/session/session-tokens';
import type { SessionUser } from '@sinemacula/foundation/session/session-user';
import { MemoryStorage } from '@sinemacula/foundation/storage/memory-storage';
import { installSessionContext, resetSessionContext } from './session-context';
import { useSessionStore } from './session-store';

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

    readonly #sessions: Array<SessionTokens | Error> = [];
    readonly #users: Array<SessionUser | Error> = [];

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

    login(_credentials: unknown, _device: SessionDevice): Promise<SessionTokens> {
        this.calls.push('login');

        return take(this.#sessions);
    }

    refresh(_refreshToken: string): Promise<SessionTokens> {
        this.calls.push('refresh');

        return take(this.#sessions);
    }

    logout(): Promise<void> {
        this.calls.push('logout');

        return Promise.resolve();
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
function tokens(): SessionTokens {
    return {
        accessToken: 'new-token',
        refreshToken: 'new-refresh-token',
        expiresAtEpochMs: SESSION_EXPIRY_EPOCH_MS,
    };
}

/** A mapped user record as returned by the gateway. */
function user(): SessionUser {
    return { id: 'u1', email: 'alice@example.com', name: 'Alice Smith', permissions: [] };
}

describe('useSessionStore', () => {
    let storage: MemoryStorage;
    let fake: FakeSessionApi;

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
            parseTimestamp: overrides.parseTimestamp ?? ((): null => null),
            device: () => ({ uuid: 'device-uuid-1', os: 'WEB' }),
        });
    }

    beforeEach(() => {
        storage = new MemoryStorage();
        fake = new FakeSessionApi();
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

    describe('state seeding', () => {
        it('hydrates the initial state from the context storage', () => {
            storage.set(ACCESS_TOKEN_KEY, 'persisted-token');
            storage.set(REFRESH_TOKEN_KEY, 'persisted-refresh');
            storage.set(EXPIRES_AT_KEY, '1782820800000');

            const store = useSessionStore();

            expect(store.accessToken).toBe('persisted-token');
            expect(store.refreshToken).toBe('persisted-refresh');
            expect(store.expiresAtEpochMs).toBe(1_782_820_800_000);
            expect(store.user).toBeNull();
        });

        it('delegates a legacy persisted expiry to the context parser', () => {
            resetSessionContext();
            installTestContext({
                parseTimestamp: value => (value === '2026-06-30 12:00:00' ? 1_782_820_800_000 : null),
            });
            storage.set(EXPIRES_AT_KEY, '2026-06-30 12:00:00');

            expect(useSessionStore().expiresAtEpochMs).toBe(1_782_820_800_000);
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

    describe('action delegation', () => {
        it('login runs the core transition against the installed context', async () => {
            fake.queueSession(tokens());
            fake.queueUser(user());

            const store = useSessionStore();

            await store.login({ email: 'alice@example.com', password: 'secret' });

            expect(fake.calls).toStrictEqual(['login', 'currentUser']);
            expect(store.accessToken).toBe('new-token');
            expect(store.user).toStrictEqual(user());
            expect(storage.get(ACCESS_TOKEN_KEY)).toBe('new-token');
        });

        it('refresh runs the core transition and reports the outcome', async () => {
            storage.set(REFRESH_TOKEN_KEY, 'old-refresh');
            fake.queueSession(tokens());

            const store = useSessionStore();

            await expect(store.refresh()).resolves.toBe(true);
            expect(store.accessToken).toBe('new-token');
        });

        it('logout clears the session through the core transition', async () => {
            storage.set(ACCESS_TOKEN_KEY, 'tok');

            const store = useSessionStore();

            await store.logout();

            expect(fake.calls).toStrictEqual(['logout']);
            expect(store.accessToken).toBeNull();
            expect(storage.get(ACCESS_TOKEN_KEY)).toBeNull();
        });

        it('hydrateFromStorage re-reads the persisted keys into state', () => {
            const store = useSessionStore();

            storage.set(ACCESS_TOKEN_KEY, 'other-tab-token');
            store.hydrateFromStorage();

            expect(store.accessToken).toBe('other-tab-token');
            expect(fake.calls).toStrictEqual([]);
        });

        it('clearLocal clears the session without calling the API', () => {
            storage.set(ACCESS_TOKEN_KEY, 'tok');

            const store = useSessionStore();

            store.clearLocal();

            expect(fake.calls).toStrictEqual([]);
            expect(store.accessToken).toBeNull();
            expect(storage.get(ACCESS_TOKEN_KEY)).toBeNull();
        });

        it('rehydrateUser fetches the user through the core transition', async () => {
            storage.set(ACCESS_TOKEN_KEY, 'tok');
            fake.queueUser(user());

            const store = useSessionStore();

            await store.rehydrateUser();

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
