/**
 * Feature-flag configuration definition.
 *
 * Reads the flag set from the runtime environment document so that flags can be
 * delivered at deploy time without rebuilding the artifact. A remote provider
 * (LaunchDarkly, PostHog, Flagsmith, Unleash, …) can replace this static
 * delivery mechanism by implementing the {@link FeatureFlags} port without
 * touching this file.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { Environment } from '@sinemacula/web-core/config/environment';
import type { FlagValue } from '@sinemacula/web-core/feature-flags/feature-flags';

/**
 * Feature-flag configuration resolved from the environment.
 */
export interface FeatureFlagsConfig {
    readonly flags: Readonly<Record<string, FlagValue>>;
}

/**
 * Resolve the feature-flag configuration from the environment.
 *
 * @param env - the typed environment reader
 * @returns the resolved feature-flag configuration
 */
export function featureFlagsConfig(env: Environment): FeatureFlagsConfig {
    return {
        flags: env.json<Record<string, FlagValue>>('FEATURE_FLAGS', {}),
    };
}
