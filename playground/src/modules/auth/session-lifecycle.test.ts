/**
 * Unit tests for installSessionLifecycle.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { MemoryStorage } from '@sinemacula/web-core/storage/memory-storage';
import type { Pinia } from 'pinia';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installSessionLifecycle } from '@/modules/auth/session-lifecycle';
import { ACCESS_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY, useAuthStore } from '@/modules/auth/stores/auth-store';
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
    token = 'next-token',
    refreshToken = 'next-refresh',
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

/** Convert an epoch-millisecond instant to the server's wire-format timestamp. */
function wireTimestamp(ms: number): string {
    return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

type StorageListener = (event: StorageEvent) => void;

/** A minimal fake `Window` that records `storage` listeners and lets tests dispatch them directly. */
function makeWindow(): Window & {
    dispatchStorage(init: { key: string | null; newValue: string | null }): void;
} {
    const listeners = new Set<StorageListener>();

    // Cast is unavoidable: a fake Window only implements the two methods this
    // module actually calls, not the full DOM Window surface.
    return {
        addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
            listeners.add(listener as StorageListener);
        },
        removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
            listeners.delete(listener as StorageListener);
        },
        dispatchStorage: (init: { key: string | null; newValue: string | null }) => {
            const event = { key: init.key, newValue: init.newValue } as StorageEvent;

            for (const listener of listeners) {
                listener(event);
            }
        },
    } as unknown as Window & { dispatchStorage(init: { key: string | null; newValue: string | null }): void };
}

const NOW = 1_700_000_000_000;

describe('installSessionLifecycle', () => {
    let storage: MemoryStorage;
    let fake: FakeHttpClient;
    let pinia: Pinia;

    beforeEach(() => {
        storage = new MemoryStorage();
        initialiseStorage(storage);
        fake = new FakeHttpClient();
        initialiseApi(fake);
        pinia = createPinia();
        setActivePinia(pinia);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        resetApi();
        resetStorage();
    });

    describe('cross-tab sync', () => {
        it('clears the session locally when the access-token key is removed in another tab', () => {
            storage.set(ACCESS_TOKEN_STORAGE_KEY, 'tok');

            const store = useAuthStore(pinia);
            const win = makeWindow();

            installSessionLifecycle({ pinia, targetWindow: win });

            win.dispatchStorage({ key: ACCESS_TOKEN_STORAGE_KEY, newValue: null });

            expect(store.accessToken).toBeNull();
        });

        it('clears the session locally on a full storage clear (key null, newValue null)', () => {
            storage.set(ACCESS_TOKEN_STORAGE_KEY, 'tok');

            const store = useAuthStore(pinia);
            const win = makeWindow();

            installSessionLifecycle({ pinia, targetWindow: win });

            win.dispatchStorage({ key: null, newValue: null });

            expect(store.accessToken).toBeNull();
        });

        it('hydrates from storage and rehydrates the user when a token appears in another tab', async () => {
            const store = useAuthStore(pinia);
            const win = makeWindow();

            installSessionLifecycle({ pinia, targetWindow: win });

            storage.set(ACCESS_TOKEN_STORAGE_KEY, 'new-tab-token');
            storage.set(REFRESH_TOKEN_STORAGE_KEY, 'new-tab-refresh');
            fake.queueResponse(userEnvelope());

            win.dispatchStorage({ key: ACCESS_TOKEN_STORAGE_KEY, newValue: 'new-tab-token' });
            await vi.advanceTimersByTimeAsync(0);

            expect(store.accessToken).toBe('new-tab-token');
            expect(store.refreshToken).toBe('new-tab-refresh');
            expect(store.user?.email).toBe('alice@example.com');
        });

        it('ignores storage events for unrelated keys', () => {
            storage.set(ACCESS_TOKEN_STORAGE_KEY, 'tok');

            const store = useAuthStore(pinia);
            const win = makeWindow();

            installSessionLifecycle({ pinia, targetWindow: win });

            win.dispatchStorage({ key: 'some.other.key', newValue: null });

            expect(store.accessToken).toBe('tok');
        });

        it('swallows a rehydrateUser failure triggered by a cross-tab storage event', async () => {
            const store = useAuthStore(pinia);
            const rehydrateMock = vi.fn((): Promise<void> => Promise.reject(new Error('rehydrate failed')));

            store.rehydrateUser = rehydrateMock;

            const win = makeWindow();

            installSessionLifecycle({ pinia, targetWindow: win });

            storage.set(ACCESS_TOKEN_STORAGE_KEY, 'new-tab-token');

            win.dispatchStorage({ key: ACCESS_TOKEN_STORAGE_KEY, newValue: 'new-tab-token' });
            await vi.advanceTimersByTimeAsync(0);

            expect(rehydrateMock).toHaveBeenCalledTimes(1);
        });

        it('does not react to storage events after teardown', () => {
            storage.set(ACCESS_TOKEN_STORAGE_KEY, 'tok');

            const store = useAuthStore(pinia);
            const win = makeWindow();

            const teardown = installSessionLifecycle({ pinia, targetWindow: win });

            teardown();
            win.dispatchStorage({ key: ACCESS_TOKEN_STORAGE_KEY, newValue: null });

            expect(store.accessToken).toBe('tok');
        });
    });

    describe('proactive refresh', () => {
        it('schedules a refresh ahead of the parsed expiry by the skew amount', async () => {
            storage.set(REFRESH_TOKEN_STORAGE_KEY, 'refresh-token');

            const store = useAuthStore(pinia);
            const win = makeWindow();

            installSessionLifecycle({ pinia, targetWindow: win, clock: () => NOW, refreshSkewMs: 1_000 });

            fake.queueResponse(sessionEnvelope());
            store.$patch({ expiresAt: wireTimestamp(NOW + 5_000) });

            await vi.advanceTimersByTimeAsync(3_999);
            expect(fake.calls).toHaveLength(0);

            await vi.advanceTimersByTimeAsync(1);
            expect(fake.calls).toHaveLength(1);
            expect(fake.calls[0]?.method).toBe('PATCH');
        });

        it('clamps the delay to zero when the expiry has already passed', async () => {
            storage.set(REFRESH_TOKEN_STORAGE_KEY, 'refresh-token');

            const store = useAuthStore(pinia);
            const win = makeWindow();

            installSessionLifecycle({ pinia, targetWindow: win, clock: () => NOW, refreshSkewMs: 60_000 });

            fake.queueResponse(sessionEnvelope());
            store.$patch({ expiresAt: wireTimestamp(NOW - 10_000) });

            await vi.advanceTimersByTimeAsync(0);

            expect(fake.calls).toHaveLength(1);
        });

        it('re-evaluates instead of firing when the delay exceeds the timer range', async () => {
            storage.set(REFRESH_TOKEN_STORAGE_KEY, 'refresh-token');

            const store = useAuthStore(pinia);
            const win = makeWindow();

            installSessionLifecycle({ pinia, targetWindow: win, clock: () => NOW, refreshSkewMs: 1_000 });

            fake.queueResponse(sessionEnvelope());
            // Far-future expiry: the raw delay overflows the signed 32-bit
            // setTimeout range, which would otherwise fire immediately.
            store.$patch({ expiresAt: wireTimestamp(NOW + 4_000_000_000_000) });

            await vi.advanceTimersByTimeAsync(2_147_483_647);

            expect(fake.calls).toHaveLength(0);
        });

        it('does not schedule a refresh when expiresAt is unparseable', async () => {
            storage.set(REFRESH_TOKEN_STORAGE_KEY, 'refresh-token');

            const store = useAuthStore(pinia);
            const win = makeWindow();

            installSessionLifecycle({ pinia, targetWindow: win, clock: () => NOW });

            store.$patch({ expiresAt: 'not-a-timestamp' });

            await vi.advanceTimersByTimeAsync(1_000_000);

            expect(fake.calls).toHaveLength(0);
        });

        it('cancels the pending timer when expiresAt is cleared', async () => {
            storage.set(REFRESH_TOKEN_STORAGE_KEY, 'refresh-token');

            const store = useAuthStore(pinia);
            const win = makeWindow();

            installSessionLifecycle({ pinia, targetWindow: win, clock: () => NOW, refreshSkewMs: 1_000 });

            store.$patch({ expiresAt: wireTimestamp(NOW + 5_000) });
            store.$patch({ expiresAt: null });

            await vi.advanceTimersByTimeAsync(10_000);

            expect(fake.calls).toHaveLength(0);
        });

        it('reschedules when expiresAt changes, cancelling the previous timer', async () => {
            storage.set(REFRESH_TOKEN_STORAGE_KEY, 'refresh-token');

            const store = useAuthStore(pinia);
            const win = makeWindow();

            installSessionLifecycle({ pinia, targetWindow: win, clock: () => NOW, refreshSkewMs: 1_000 });

            fake.queueResponse(sessionEnvelope());
            store.$patch({ expiresAt: wireTimestamp(NOW + 5_000) });
            store.$patch({ expiresAt: wireTimestamp(NOW + 20_000) });

            await vi.advanceTimersByTimeAsync(4_000);
            expect(fake.calls).toHaveLength(0);

            await vi.advanceTimersByTimeAsync(15_000);
            expect(fake.calls).toHaveLength(1);
        });

        it('does not fire a scheduled refresh after teardown', async () => {
            storage.set(REFRESH_TOKEN_STORAGE_KEY, 'refresh-token');

            const store = useAuthStore(pinia);
            const win = makeWindow();

            const teardown = installSessionLifecycle({
                pinia,
                targetWindow: win,
                clock: () => NOW,
                refreshSkewMs: 1_000,
            });

            store.$patch({ expiresAt: wireTimestamp(NOW + 5_000) });
            teardown();

            await vi.advanceTimersByTimeAsync(10_000);

            expect(fake.calls).toHaveLength(0);
        });

        it('does not react to expiresAt changes after teardown', async () => {
            storage.set(REFRESH_TOKEN_STORAGE_KEY, 'refresh-token');

            const store = useAuthStore(pinia);
            const win = makeWindow();

            const teardown = installSessionLifecycle({
                pinia,
                targetWindow: win,
                clock: () => NOW,
                refreshSkewMs: 1_000,
            });

            teardown();
            store.$patch({ expiresAt: wireTimestamp(NOW + 2_000) });

            await vi.advanceTimersByTimeAsync(10_000);

            expect(fake.calls).toHaveLength(0);
        });

        it('swallows a failed proactive refresh', async () => {
            const store = useAuthStore(pinia);
            const refreshMock = vi.fn((): Promise<boolean> => Promise.reject(new Error('refresh failed')));

            store.refresh = refreshMock;

            const win = makeWindow();

            installSessionLifecycle({ pinia, targetWindow: win, clock: () => NOW, refreshSkewMs: 1_000 });

            store.$patch({ expiresAt: wireTimestamp(NOW + 1_000) });

            await vi.advanceTimersByTimeAsync(0);

            expect(refreshMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('boot rehydration', () => {
        it('rehydrates the user on install when already authenticated', async () => {
            storage.set(ACCESS_TOKEN_STORAGE_KEY, 'tok');
            fake.queueResponse(userEnvelope());

            const store = useAuthStore(pinia);

            installSessionLifecycle({ pinia });
            await vi.advanceTimersByTimeAsync(0);

            expect(store.user?.email).toBe('alice@example.com');
        });

        it('does not rehydrate the user on install when unauthenticated', async () => {
            const store = useAuthStore(pinia);
            const rehydrateMock = vi.fn();

            store.rehydrateUser = rehydrateMock;

            installSessionLifecycle({ pinia });
            await vi.advanceTimersByTimeAsync(0);

            expect(rehydrateMock).not.toHaveBeenCalled();
        });

        it('swallows a rehydrateUser failure triggered by boot rehydration', async () => {
            storage.set(ACCESS_TOKEN_STORAGE_KEY, 'tok');

            const store = useAuthStore(pinia);
            const rehydrateMock = vi.fn((): Promise<void> => Promise.reject(new Error('boot rehydrate failed')));

            store.rehydrateUser = rehydrateMock;

            installSessionLifecycle({ pinia });
            await vi.advanceTimersByTimeAsync(0);

            expect(rehydrateMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('default overrides', () => {
        it('uses globalThis.window when targetWindow is not provided', () => {
            const addSpy = vi.spyOn(globalThis.window, 'addEventListener');
            const removeSpy = vi.spyOn(globalThis.window, 'removeEventListener');

            const teardown = installSessionLifecycle({ pinia });

            expect(addSpy).toHaveBeenCalledWith('storage', expect.any(Function));

            teardown();

            expect(removeSpy).toHaveBeenCalledWith('storage', expect.any(Function));

            addSpy.mockRestore();
            removeSpy.mockRestore();
        });

        it('uses Date.now by default for the clock', async () => {
            storage.set(REFRESH_TOKEN_STORAGE_KEY, 'refresh-token');

            const store = useAuthStore(pinia);
            const win = makeWindow();
            const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(NOW);

            installSessionLifecycle({ pinia, targetWindow: win, refreshSkewMs: 1_000 });

            fake.queueResponse(sessionEnvelope());
            store.$patch({ expiresAt: wireTimestamp(NOW + 2_000) });

            await vi.advanceTimersByTimeAsync(999);
            expect(fake.calls).toHaveLength(0);

            await vi.advanceTimersByTimeAsync(1);
            expect(fake.calls).toHaveLength(1);

            nowSpy.mockRestore();
        });

        it('uses the default 60-second skew when refreshSkewMs is not provided', async () => {
            storage.set(REFRESH_TOKEN_STORAGE_KEY, 'refresh-token');

            const store = useAuthStore(pinia);
            const win = makeWindow();

            installSessionLifecycle({ pinia, targetWindow: win, clock: () => NOW });

            fake.queueResponse(sessionEnvelope());
            store.$patch({ expiresAt: wireTimestamp(NOW + 60_000 + 1_000) });

            await vi.advanceTimersByTimeAsync(999);
            expect(fake.calls).toHaveLength(0);

            await vi.advanceTimersByTimeAsync(1);
            expect(fake.calls).toHaveLength(1);
        });
    });
});
