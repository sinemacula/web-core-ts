/**
 * Configuration registry.
 *
 * Mirrors Laravel's `config/` directory: one typed definition per concern,
 * aggregated here into the single tree the {@link ConfigRepository} freezes
 * at boot. Add new definitions by creating a sibling file and registering it
 * in {@link defineConfiguration}.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { Environment } from '@sinemacula/web-core/config/environment';

import { apiConfig } from './api';
import { appConfig } from './app';
import { featureFlagsConfig } from './feature-flags';
import { localesConfig } from './locales';
import { servicesConfig } from './services';

/**
 * Resolve every configuration definition against the environment.
 *
 * @param env - the typed environment reader
 * @returns the full configuration tree
 */
export function defineConfiguration(env: Environment) {
    return {
        api: apiConfig(env),
        app: appConfig(env),
        featureFlags: featureFlagsConfig(env),
        locales: localesConfig(env),
        services: servicesConfig(env),
    };
}

/**
 * The fully-typed configuration tree returned by {@link defineConfiguration}.
 */
export type Configuration = ReturnType<typeof defineConfiguration>;
