/**
 * Reactive feature-flag composables.
 *
 * Wraps a {@link FeatureFlags} port in Vue's reactivity system so that
 * templates and computed properties automatically re-evaluate whenever the
 * flag set changes (e.g. after a remote refresh or a test-driven
 * {@link StaticFeatureFlags.replace} call).
 *
 * The subscription is cleaned up via {@link onScopeDispose} so there are no
 * memory leaks when a component or effect scope is torn down.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { ComputedRef } from 'vue';
import { computed, onScopeDispose, ref } from 'vue';

import type { FeatureFlags, FlagValue } from './feature-flags';

/**
 * Return a reactive boolean computed ref that re-evaluates whenever the flag
 * set changes.
 *
 * @param flags - the feature-flag port to read from
 * @param key - the flag key to resolve
 * @param fallback - the value returned when the flag is absent or non-boolean;
 *   defaults to `false`
 * @returns a computed ref that always reflects the current flag value
 */
export function useFeatureFlag(flags: FeatureFlags, key: string, fallback = false): ComputedRef<boolean> {
    const tick = ref(0);

    const unsubscribe = flags.onChange(() => {
        tick.value += 1;
    });

    onScopeDispose(unsubscribe);

    return computed(() => {
        // Read tick to subscribe this computed to flag-set change notifications.
        tick.value;

        return flags.isEnabled(key, fallback);
    });
}

/**
 * Return a reactive variant computed ref that re-evaluates whenever the flag
 * set changes.
 *
 * @param flags - the feature-flag port to read from
 * @param key - the flag key to resolve
 * @param fallback - the value returned when the flag is absent or the wrong
 *   type; its type pins the return type
 * @returns a computed ref that always reflects the current variant value
 */
export function useVariant<Value extends FlagValue>(
    flags: FeatureFlags,
    key: string,
    fallback: Value,
): ComputedRef<Value> {
    const tick = ref(0);

    const unsubscribe = flags.onChange(() => {
        tick.value += 1;
    });

    onScopeDispose(unsubscribe);

    return computed(() => {
        // Read tick to subscribe this computed to flag-set change notifications.
        tick.value;

        return flags.variant(key, fallback);
    });
}
