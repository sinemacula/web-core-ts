/**
 * Chunk-load-failure recovery wiring for the bootstrap preset.
 *
 * Installs the router's stale-deploy chunk recovery with the preset-resolved
 * storage, reporter and platform seams. Enabled by default; disabling it
 * leaves the router's error channel to the reporter alone.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { Router } from 'vue-router';

import type { ErrorReporter } from '../reporting/error-reporter';
import { installChunkErrorRecovery } from '../router/chunk-error-recovery';
import type { KeyValueStorage } from '../storage/key-value-storage';

/**
 * Options for {@link wireChunkRecovery}.
 */
export interface WireChunkRecoveryOptions {
    /** The router whose navigation errors are inspected and recovered. */
    readonly router: Router;

    /** Records the last recovery attempt per path, guarding against reload loops. */
    readonly storage: KeyValueStorage;

    /** Receives non-chunk router errors, and chunk errors a reload did not cure. */
    readonly reporter: ErrorReporter;

    /** Whether recovery is installed at all. Default true. */
    readonly enabled?: boolean;

    /** Performs the recovery reload; defaults to a full document navigation. */
    readonly reload?: (path: string) => void;

    /** Resolves the current time; defaults to `Date.now`. */
    readonly clock?: () => number;

    /** The reload-loop guard window in milliseconds. */
    readonly windowMs?: number;
}

/**
 * Wire chunk-load-failure recovery onto the router.
 *
 * @param options - the router, its collaborators and recovery tuning
 * @returns the teardown removing the error handler, or null when disabled
 */
export function wireChunkRecovery(options: WireChunkRecoveryOptions): (() => void) | null {
    if (!(options.enabled ?? true)) {
        return null;
    }

    return installChunkErrorRecovery({
        router: options.router,
        storage: options.storage,
        reporter: options.reporter,
        ...(options.reload === undefined ? {} : { reload: options.reload }),
        ...(options.clock === undefined ? {} : { clock: options.clock }),
        ...(options.windowMs === undefined ? {} : { windowMs: options.windowMs }),
    });
}
