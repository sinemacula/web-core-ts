/**
 * Application feature-flag service.
 *
 * Holds the boot-time {@link FeatureFlags} singleton used by every module that
 * needs to evaluate feature flags. The bootstrap wires a static adapter (or a
 * remote-provider adapter); tests wire a stub or a
 * {@link StaticFeatureFlags} instance.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { FeatureFlags } from '@sinemacula/web-core/feature-flags/feature-flags';

let instance: FeatureFlags | null = null;

/**
 * Install the feature-flag adapter. Called once by the application bootstrap.
 *
 * @param flags - the feature-flag adapter to install
 */
export function initialiseFeatureFlags(flags: FeatureFlags): void {
    instance = flags;
}

/**
 * The active feature-flag adapter.
 *
 * @returns the active feature-flag adapter
 * @throws Error when accessed before {@link initialiseFeatureFlags} has been called
 */
export function featureFlags(): FeatureFlags {
    if (instance === null) {
        throw new Error(
            'The feature-flag adapter was accessed before initialisation. Call initialiseFeatureFlags() first.',
        );
    }

    return instance;
}

/**
 * Discard the feature-flag adapter singleton. Test use only.
 */
export function resetFeatureFlags(): void {
    instance = null;
}
