/**
 * Chunk-load-failure recovery for the router.
 *
 * A deploy removes the previous build's hashed chunk files, so a tab left open
 * since before that deploy fails to lazy-load any route it has not already
 * visited. The update monitor warns about this proactively by polling the
 * deployed version; this module recovers from it reactively, from inside the
 * router's own error channel, catching the tab that missed the warning or
 * navigated before it was shown.
 *
 * A chunk-load failure is treated as recoverable once per target path within a
 * rolling window: the first failure triggers a full document reload, which
 * fetches the fresh `index.html` and the chunks it now references. A second
 * failure for the same path inside that window means the reload did not cure it
 * - a genuinely broken deploy - so the failure is reported instead of retried
 * forever.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { Router } from 'vue-router';

import type { ErrorReporter } from '../reporting/error-reporter';
import type { KeyValueStorage } from '../storage/key-value-storage';

const CHUNK_ERROR_MESSAGE_PATTERN =
    /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i;
const DEFAULT_WINDOW_MS = 60_000;
const STORAGE_KEY_PREFIX = 'chunk-recovery.';

/**
 * Options for installing chunk-load-failure recovery on a router.
 */
export interface ChunkErrorRecoveryOptions {
    /** The router whose navigation errors are inspected and recovered. */
    readonly router: Router;

    /**
     * Records the last recovery attempt per path, guarding against reload
     * loops.
     */
    readonly storage: KeyValueStorage;

    /**
     * Receives non-chunk router errors, and chunk errors a reload did not cure.
     */
    readonly reporter?: ErrorReporter;

    /**
     * Performs the recovery reload; defaults to a full document navigation to
     * `targetPath`.
     */
    readonly reload?: (targetPath: string) => void;

    /**
     * Resolves the current time; defaults to `Date.now`, injected for tests.
     */
    readonly clock?: () => number;

    /**
     * The reload-loop guard window in milliseconds; defaults to sixty seconds.
     */
    readonly windowMs?: number;
}

/**
 * Install a router error handler that recovers from stale-deploy chunk-load
 * failures and forwards every other router error to the reporter.
 *
 * @param options - the router to guard plus its storage and reporter
 * dependencies and recovery tuning
 * @returns a teardown that removes the error handler
 */
export function installChunkErrorRecovery(options: ChunkErrorRecoveryOptions): () => void {
    const { router, storage, reporter } = options;
    const reload = options.reload ?? defaultReload;
    const clock = options.clock ?? Date.now;
    const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;

    return router.onError((error: unknown, to) => {
        const targetPath = to.fullPath;

        if (!isChunkLoadError(error)) {
            reporter?.captureError(error, { source: 'router', path: targetPath });
            return;
        }

        const key = STORAGE_KEY_PREFIX + targetPath;
        const lastReloadAt = storage.get(key);
        const now = clock();

        if (lastReloadAt !== null && now - Number(lastReloadAt) < windowMs) {
            reporter?.captureError(error, { source: 'router', path: targetPath });
            return;
        }

        storage.set(key, String(now));
        reload(targetPath);
    });
}

/**
 * Determine whether an error is the browser's dynamic-import failure for a
 * chunk that no longer exists, as opposed to any other router error.
 *
 * @param error - the value thrown or passed to the router's error handler
 * @returns true when the error is an `Error` whose message matches a known
 * chunk-load failure
 */
export function isChunkLoadError(error: unknown): boolean {
    return error instanceof Error && CHUNK_ERROR_MESSAGE_PATTERN.test(error.message);
}

/**
 * Reload the current document at `targetPath`.
 *
 * A full document load, rather than a client-side navigation, is required so
 * the browser fetches the current `index.html` and its current hashed chunks.
 *
 * @param targetPath - the path to navigate the document to
 */
function defaultReload(targetPath: string): void {
    globalThis.location.href = targetPath;
}
