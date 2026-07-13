/**
 * Application configuration service.
 *
 * Holds the boot-time {@link ConfigRepository} singleton and exposes the
 * Laravel-style accessors used across the application: `config()` for the
 * fully-typed tree, `configValue()` for dot-notation lookups.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { ConfigRepository } from '@sinemacula/web-core/config/config-repository';
import type { Environment } from '@sinemacula/web-core/config/environment';

import type { Configuration } from '@/config';
import { defineConfiguration } from '@/config';

let repository: ConfigRepository<Configuration> | null = null;

/**
 * Resolve every configuration definition and freeze the result.
 *
 * Called once by the application bootstrap, before anything reads
 * configuration.
 *
 * @param env - the typed environment reader
 */
export function initialiseConfiguration(env: Environment): void {
    repository = new ConfigRepository(defineConfiguration(env));
}

/**
 * The fully-typed configuration tree.
 *
 * @returns the frozen configuration root
 * @throws Error when accessed before {@link initialiseConfiguration} has
 *   been called
 */
export function config(): Readonly<Configuration> {
    return resolveRepository().all();
}

/**
 * Resolve a configuration value by dot-notation path.
 *
 * @param path - the dot-notation path (e.g. `app.urls.api`)
 * @param fallback - the value returned when the path does not resolve
 * @returns the resolved value, or the fallback
 * @throws Error when accessed before {@link initialiseConfiguration} has
 *   been called
 */
export function configValue(path: string, fallback?: unknown): unknown {
    return resolveRepository().get(path, fallback);
}

/**
 * Discard the configuration singleton. Test use only.
 */
export function resetConfiguration(): void {
    repository = null;
}

/**
 * The active repository, or a hard failure when boot has not run.
 *
 * @returns the active configuration repository
 */
function resolveRepository(): ConfigRepository<Configuration> {
    if (repository === null) {
        throw new Error('Configuration was accessed before initialisation. Call initialiseConfiguration() first.');
    }

    return repository;
}
