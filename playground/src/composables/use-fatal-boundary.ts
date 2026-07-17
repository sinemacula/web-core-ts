/**
 * Application-level fatal error boundary composable.
 *
 * Catches errors thrown by any descendant component so the application can fall
 * back to a minimal panel instead of a blank screen. The error is reported and
 * propagation is stopped so the global Vue error handler does not also capture
 * it a second time.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { Ref } from 'vue';
import { onErrorCaptured, ref } from 'vue';

import { reporting } from '@/services/reporting';

/**
 * The reactive fatal-boundary state returned by {@link useFatalBoundary}.
 */
export interface FatalBoundary {
    /** `true` once a descendant component has thrown an uncaught error. */
    readonly fatal: Ref<boolean>;

    /**
     * Clear the fatal state, allowing the guarded content to render again.
     */
    reset(): void;
}

/**
 * Install an error boundary around the calling component's descendants.
 *
 * Must be called from a component's `setup()` (or `<script setup>`), since it
 * registers Vue's `onErrorCaptured` lifecycle hook.
 *
 * @returns the reactive fatal state and a reset() to clear it
 */
export function useFatalBoundary(): FatalBoundary {
    const fatal = ref(false);

    onErrorCaptured((error: unknown, _instance, info: string) => {
        reporting().captureError(error, { source: 'fatal-boundary', info });
        fatal.value = true;

        return false;
    });

    /**
     * Clear the fatal state so the guarded content renders again.
     */
    function reset(): void {
        fatal.value = false;
    }

    return { fatal, reset };
}
