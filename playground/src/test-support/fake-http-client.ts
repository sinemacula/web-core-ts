/**
 * In-memory {@link HttpClient} fake for tests.
 *
 * Records every call and replays queued results in order. An empty queue
 * resolves to undefined, matching a 204-style response.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { HttpClient, HttpRequestOptions } from '@sinemacula/web-core/http/http-client';

interface RecordedCall {
    readonly method: string;
    readonly path: string;
    readonly body: unknown;
}

type QueuedResult =
    | { readonly kind: 'resolve'; readonly value: unknown }
    | { readonly kind: 'reject'; readonly error: unknown };

/**
 * A scriptable, call-recording HTTP client.
 */
export class FakeHttpClient implements HttpClient {
    readonly calls: RecordedCall[] = [];
    readonly #queue: QueuedResult[] = [];

    /**
     * Queue a successful response payload.
     *
     * @param value - the payload the next call resolves with
     */
    queueResponse(value: unknown): void {
        this.#queue.push({ kind: 'resolve', value });
    }

    /**
     * Queue a failure.
     *
     * @param error - the error the next call rejects with
     */
    queueError(error: unknown): void {
        this.#queue.push({ kind: 'reject', error });
    }

    get<T>(path: string, _options?: HttpRequestOptions): Promise<T> {
        return this.#consume('GET', path, undefined);
    }

    post<T>(path: string, body?: unknown, _options?: HttpRequestOptions): Promise<T> {
        return this.#consume('POST', path, body);
    }

    put<T>(path: string, body?: unknown, _options?: HttpRequestOptions): Promise<T> {
        return this.#consume('PUT', path, body);
    }

    patch<T>(path: string, body?: unknown, _options?: HttpRequestOptions): Promise<T> {
        return this.#consume('PATCH', path, body);
    }

    delete<T>(path: string, _options?: HttpRequestOptions): Promise<T> {
        return this.#consume('DELETE', path, undefined);
    }

    download(path: string, _options?: HttpRequestOptions): Promise<Blob> {
        return this.#consume('GET', path, undefined);
    }

    #consume<T>(method: string, path: string, body: unknown): Promise<T> {
        this.calls.push({ method, path, body });

        const result = this.#queue.shift() ?? { kind: 'resolve', value: undefined };

        return result.kind === 'reject' ? Promise.reject(result.error) : Promise.resolve(result.value as T);
    }
}
