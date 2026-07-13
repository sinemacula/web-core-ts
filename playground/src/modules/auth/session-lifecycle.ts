/**
 * Session lifecycle hardening.
 *
 * Wires cross-tab session synchronisation and proactive token refresh onto
 * the auth store so a session stays consistent across tabs and renews itself
 * before it lapses, rather than waiting for a reactive 401 to notice.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { Pinia } from 'pinia';
import { watch } from 'vue';

import { ACCESS_TOKEN_STORAGE_KEY, useAuthStore } from '@/modules/auth/stores/auth-store';

/** Refresh this long before expiry when no override is supplied. */
const DEFAULT_REFRESH_SKEW_MS = 60_000;
const MAX_TIMEOUT_DELAY_MS = 2_147_483_647;

type AuthStore = ReturnType<typeof useAuthStore>;

/**
 * Options for {@link installSessionLifecycle}.
 */
export interface SessionLifecycleOptions {
    /** The active Pinia instance. */
    readonly pinia: Pinia;
    /** The window to listen for cross-tab `storage` events on; defaults to `globalThis.window`. */
    readonly targetWindow?: Window;
    /** Clock used to compute the refresh delay; defaults to `() => Date.now()`. */
    readonly clock?: () => number;
    /** How long before expiry to refresh, in milliseconds; defaults to 60 seconds. */
    readonly refreshSkewMs?: number;
}

/**
 * Install cross-tab session synchronisation and proactive token refresh.
 *
 * - A `storage` event carrying the access-token key (or `key === null`, a
 *   full `storage.clear()`) mirrors a session change made by another tab: a
 *   cleared value discards the session locally, a new value re-hydrates
 *   state from storage and refetches the current user.
 * - The store's `expiresAt` is watched; whenever it is set, a refresh is
 *   scheduled ahead of the parsed expiry so the session renews before it
 *   lapses.
 * - On install, an already-authenticated store refetches its user record.
 *
 * @param options - the Pinia instance and optional overrides
 * @returns a teardown function that removes the listener, cancels any
 *   pending refresh timer, and stops the watcher
 */
export function installSessionLifecycle(options: SessionLifecycleOptions): () => void {
    const store = useAuthStore(options.pinia);
    const target = options.targetWindow ?? globalThis.window;
    const scheduler = createRefreshScheduler(
        store,
        options.clock ?? (() => Date.now()),
        options.refreshSkewMs ?? DEFAULT_REFRESH_SKEW_MS,
    );
    const onStorage = createStorageListener(store);

    target.addEventListener('storage', onStorage);

    const stopWatch = watch(() => store.expiresAt, scheduler.schedule, { immediate: true });

    if (store.isAuthenticated) {
        store.rehydrateUser().catch(() => {
            // Swallowed: a dead session is handled by the 401-refresh flow
            // or the session-loss watcher.
        });
    }

    return (): void => {
        target.removeEventListener('storage', onStorage);
        scheduler.cancel();
        stopWatch();
    };
}

/**
 * Build the `storage` event handler that mirrors another tab's session
 * change onto this tab's store.
 *
 * @param store - the auth store instance
 * @returns the event handler to attach to the target window
 */
function createStorageListener(store: AuthStore): (event: StorageEvent) => void {
    return (event: StorageEvent): void => {
        if (event.key !== ACCESS_TOKEN_STORAGE_KEY && event.key !== null) {
            return;
        }

        if (event.newValue === null) {
            store.clearLocal();

            return;
        }

        store.hydrateFromStorage();
        store.rehydrateUser().catch(() => {
            // Swallowed: a dead session is handled by the 401-refresh flow
            // or the session-loss watcher.
        });
    };
}

/** A schedule/cancel pair for the proactive refresh timer. */
interface RefreshScheduler {
    readonly schedule: (expiresAt: string | null) => void;
    readonly cancel: () => void;
}

/**
 * Build a scheduler that arranges a single proactive refresh ahead of a
 * parsed expiry, replacing any previously scheduled attempt.
 *
 * @param store - the auth store instance
 * @param clock - resolves the current time in epoch milliseconds
 * @param refreshSkewMs - how long before expiry to fire the refresh
 * @returns the scheduler
 */
function createRefreshScheduler(store: AuthStore, clock: () => number, refreshSkewMs: number): RefreshScheduler {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cancel = (): void => {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
    };

    const schedule = (expiresAt: string | null): void => {
        cancel();

        const expiryMs = expiresAt === null ? null : parseWireTimestamp(expiresAt);

        if (expiryMs === null) {
            return;
        }

        const delay = Math.max(0, expiryMs - clock() - refreshSkewMs);

        if (delay > MAX_TIMEOUT_DELAY_MS) {
            // setTimeout delays beyond the signed 32-bit range fire
            // immediately; re-evaluate when the horizon is reached instead.
            timer = setTimeout(() => {
                schedule(expiresAt);
            }, MAX_TIMEOUT_DELAY_MS);

            return;
        }

        timer = setTimeout(() => {
            store.refresh().catch(() => {
                // A failed proactive refresh is handled by the 401-refresh
                // flow or the session-loss watcher.
            });
        }, delay);
    };

    return { schedule, cancel };
}

/**
 * Parse the server's wire-format timestamp (`'YYYY-MM-DD HH:MM:SS'`) as a
 * UTC instant.
 *
 * The auth API emits naive timestamps with no offset; this assumes they are
 * always UTC by joining the date and time with `'T'` and appending `'Z'`
 * before delegating to `Date.parse`.
 *
 * @param wireTimestamp - the wire-format timestamp
 * @returns the parsed instant in epoch milliseconds, or null when unparseable
 */
function parseWireTimestamp(wireTimestamp: string): number | null {
    const parsed = Date.parse(`${wireTimestamp.replace(' ', 'T')}Z`);

    return Number.isNaN(parsed) ? null : parsed;
}
