/**
 * Composition helper for the standard web application environment.
 *
 * Builds an {@link Environment} from the fetched runtime document without the
 * kernel ever evaluating `import.meta.env` - the caller passes the build-time
 * record and dev flag from its own build context. In development the runtime
 * document is chained ahead of the prefixed build-time variables, so a
 * deployed value always beats a local default. In production the runtime
 * document stands alone and every required key must be present and non-empty,
 * because missing keys indicate a broken deployment and the application must
 * fail loudly rather than silently boot against incorrect defaults.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { ChainEnvironmentSource } from './chain-environment-source';
import { Environment } from './environment';
import { ObjectEnvironmentSource } from './object-environment-source';
import { PrefixedEnvironmentSource } from './prefixed-environment-source';

const DEFAULT_BUILD_TIME_PREFIX = 'VITE_';

/**
 * Thrown when required runtime configuration keys are missing or empty.
 */
export class ConfigurationError extends Error {
    /**
     * @param message - description of the missing keys
     */
    constructor(message: string) {
        super(message);
        this.name = 'ConfigurationError';
    }
}

/**
 * Inputs for {@link createWebEnvironment}.
 */
export interface WebEnvironmentOptions {
    /**
     * The fetched runtime document. Standalone callers may pass
     * `fetchRuntimeEnvironment`'s result.
     */
    readonly runtime: Readonly<Record<string, string>>;
    /**
     * Whether the application runs in a development build. The caller passes
     * `import.meta.env.DEV`, resolved in the application's build context.
     */
    readonly dev: boolean;
    /**
     * The build-time variable record (`import.meta.env`), chained after the
     * runtime document in development only.
     */
    readonly buildTimeEnv?: Readonly<Record<string, unknown>>;
    /**
     * The prefix carried by build-time variable keys. Defaults to `VITE_`.
     */
    readonly buildTimePrefix?: string;
    /**
     * Keys that must be present and non-empty in the runtime document for a
     * production deployment to be considered valid. Ignored in development.
     */
    readonly requiredKeys?: readonly string[];
}

/**
 * Build the application environment from the runtime document.
 *
 * @param options - the runtime document, dev flag, and production gate
 * @returns the composed environment
 * @throws {ConfigurationError} in production when required runtime keys are
 *   missing or empty
 */
export function createWebEnvironment(options: WebEnvironmentOptions): Environment {
    if (options.dev) {
        return new Environment(
            new ChainEnvironmentSource([
                new ObjectEnvironmentSource(options.runtime),
                new PrefixedEnvironmentSource(
                    options.buildTimeEnv ?? {},
                    options.buildTimePrefix ?? DEFAULT_BUILD_TIME_PREFIX,
                ),
            ]),
        );
    }

    assertRequiredKeys(options.runtime, options.requiredKeys ?? []);

    return new Environment(new ObjectEnvironmentSource(options.runtime));
}

/**
 * Assert that every required key is present and non-empty.
 *
 * @param runtime - the resolved runtime environment values
 * @param requiredKeys - the keys the deployment must define
 * @throws {ConfigurationError} when one or more required keys are missing
 *   or empty
 */
function assertRequiredKeys(runtime: Readonly<Record<string, string>>, requiredKeys: readonly string[]): void {
    const missing = requiredKeys.filter(key => {
        const value = runtime[key];

        return value === undefined || value === '';
    });

    if (missing.length > 0) {
        throw new ConfigurationError(`Runtime configuration is missing required keys: ${missing.join(', ')}.`);
    }
}
