/**
 * Application API service.
 *
 * Holds the boot-time {@link HttpClient} singleton used by every module's
 * API gateway. The bootstrap wires a {@link FetchHttpClient} configured from
 * `config().api`; tests wire a fake.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { HttpClient } from '@sinemacula/web-core/http/http-client';

let client: HttpClient | null = null;

/**
 * Install the API client. Called once by the application bootstrap.
 *
 * @param instance - the HTTP client to install
 */
export function initialiseApi(instance: HttpClient): void {
    client = instance;
}

/**
 * The active API client.
 *
 * @returns the active HTTP client
 * @throws Error when accessed before {@link initialiseApi} has been called
 */
export function api(): HttpClient {
    if (client === null) {
        throw new Error('The API client was accessed before initialisation. Call initialiseApi() first.');
    }

    return client;
}

/**
 * Discard the API client singleton. Test use only.
 */
export function resetApi(): void {
    client = null;
}
