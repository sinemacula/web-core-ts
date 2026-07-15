/**
 * Application configuration service.
 *
 * App-typed wrapper over the kernel configuration holder, keeping the
 * Laravel-style accessors used across the application: `config()` for the
 * fully-typed tree, `configValue()` for dot-notation lookups. The bootstrap
 * preset installs the production repository; `initialiseConfiguration` is
 * the equivalent test-time seam over the configuration registry.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { appConfig, appConfigRepository, installConfig } from '@sinemacula/web-core/app/services';
import { ConfigRepository } from '@sinemacula/web-core/config/config-repository';
import type { Environment } from '@sinemacula/web-core/config/environment';

import type { Configuration } from '@/config';
import { defineConfiguration } from '@/config';

export { resetWebCoreServices as resetConfiguration } from '@sinemacula/web-core/app/services';

/**
 * Resolve every configuration definition and install the frozen result.
 *
 * @param env - the typed environment reader
 */
export function initialiseConfiguration(env: Environment): void {
    installConfig(new ConfigRepository(defineConfiguration(env)));
}

/**
 * The fully-typed configuration tree.
 *
 * @returns the frozen configuration root
 * @throws Error when accessed before configuration is installed
 */
export function config(): Readonly<Configuration> {
    return appConfig<Configuration>();
}

/**
 * Resolve a configuration value by dot-notation path.
 *
 * @param path - the dot-notation path (e.g. `app.urls.api`)
 * @param fallback - the value returned when the path does not resolve
 * @returns the resolved value, or the fallback
 * @throws Error when accessed before configuration is installed
 */
export function configValue(path: string, fallback?: unknown): unknown {
    return appConfigRepository().get(path, fallback);
}
