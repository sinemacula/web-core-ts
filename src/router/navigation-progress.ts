/**
 * Router navigation-progress tracker.
 *
 * Exposes whether the router currently has a navigation in flight, so the host
 * application can render a progress indicator without every route having to
 * manage the flag itself.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { Ref } from 'vue';
import { getCurrentScope, onScopeDispose, ref } from 'vue';
import type { Router } from 'vue-router';

/**
 * The reactive navigation-progress state returned by
 * {@link createNavigationProgress}.
 */
export interface NavigationProgress {
    /** `true` while a navigation is in flight. */
    readonly isNavigating: Ref<boolean>;

    /** Remove the router hooks and reset `isNavigating` to false. */
    stop(): void;
}

/**
 * Track whether `router` has a navigation currently in flight.
 *
 * `isNavigating` is set to true when a navigation starts (`beforeEach`) and
 * back to false once it settles, whether it completes (`afterEach`) or fails
 * (`onError`). When called inside an active effect scope, `stop()` is
 * registered via `onScopeDispose` so the hooks are removed automatically when
 * the host component unmounts.
 *
 * @param router - the router to observe
 * @returns the reactive navigation state and a `stop()` to remove the hooks
 */
export function createNavigationProgress(router: Router): NavigationProgress {
    const isNavigating = ref(false);

    const removeBeforeEach = router.beforeEach(() => {
        isNavigating.value = true;
    });

    const removeAfterEach = router.afterEach(() => {
        isNavigating.value = false;
    });

    const removeOnError = router.onError(() => {
        isNavigating.value = false;
    });

    /**
     * Remove the navigation hooks and reset `isNavigating` to false.
     */
    function stop(): void {
        removeBeforeEach();
        removeAfterEach();
        removeOnError();
        isNavigating.value = false;
    }

    if (getCurrentScope() !== undefined) {
        onScopeDispose(stop);
    }

    return { isNavigating, stop };
}
