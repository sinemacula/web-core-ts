/**
 * API client configuration definition.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { Environment } from '@sinemacula/foundation/config/environment';

/**
 * Configuration for the API HTTP client.
 */
export interface ApiConfig {
    /** The base URL of the API client. */
    readonly baseUrl: string;

    /** The request timeout in milliseconds. */
    readonly timeout: number;
}

/**
 * Resolve the API client configuration from the environment.
 *
 * @param env - the typed environment reader
 * @returns the resolved API configuration
 */
export function apiConfig(env: Environment): ApiConfig {
    return {
        baseUrl: env.string('API_URL', 'http://localhost:8000'),
        timeout: env.integer('API_TIMEOUT', 30_000),
    };
}
