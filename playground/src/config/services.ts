/**
 * Third-party service configuration definition.
 *
 * Keys are optional by design: a deployment that does not configure a service
 * resolves to null and the integration stays disabled.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { Environment } from '@sinemacula/web-core/config/environment';

/**
 * Third-party service configuration resolved from the environment.
 */
export interface ServicesConfig {
    readonly segment: {
        readonly writeKey: string | null;
    };
    readonly sentry: {
        readonly dsn: string | null;
    };
}

/**
 * Resolve the third-party service configuration from the environment.
 *
 * @param env - the typed environment reader
 * @returns the resolved service configuration
 */
export function servicesConfig(env: Environment): ServicesConfig {
    return {
        segment: {
            writeKey: env.string('SEGMENT_WRITE_KEY') ?? null,
        },
        sentry: {
            dsn: env.string('SENTRY_DSN') ?? null,
        },
    };
}
