/**
 * Application configuration definition.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { Environment } from '@sinemacula/web-core/config/environment';

/**
 * Top-level application configuration resolved from the environment.
 */
export interface AppConfig {
    /** The application environment name. */
    readonly environment: string;

    /** The application display name. */
    readonly name: string;

    /** The deployed application version. */
    readonly version: string;

    /** The base URLs the application uses. */
    readonly urls: {
        /** The API base URL. */
        readonly api: string;

        /** The application base URL. */
        readonly app: string;

        /** The static asset base URL. */
        readonly static: string;

        /** The realtime stream base URL. */
        readonly stream: string;
    };
}

/**
 * Resolve the application configuration from the environment.
 *
 * @param env - the typed environment reader
 * @returns the resolved application configuration
 */
export function appConfig(env: Environment): AppConfig {
    const api = env.string('API_URL', 'http://localhost:8000');
    const app = env.string('APP_URL', 'http://localhost:5173');

    return {
        environment: env.string('APP_ENV', 'production'),
        name: env.string('APP_NAME', 'Web Core'),
        version: env.string('APP_VERSION', 'dev'),
        urls: {
            api,
            app,
            static: env.string('STATIC_URL', app),
            stream: env.string('STREAM_URL', api),
        },
    };
}
