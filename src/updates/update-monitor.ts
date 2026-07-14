/**
 * Deployed-version monitoring.
 *
 * Static artifacts cannot push "a new release is out" to running tabs, so
 * the monitor polls a small version document (by default the runtime
 * environment document, which deploys rewrite per release) on an interval
 * and whenever the tab regains visibility. When the deployed version
 * differs from the booted version, subscribers are notified once per new
 * version - the application decides what to do (sticky toast, reload, ...).
 *
 * No service worker is involved by design: the application has no offline
 * requirement, and a worker's install/activate lifecycle introduces the
 * very stale-version problems this monitor exists to solve.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { isRecord } from '../support/is-record';

export type UpdateHandler = (nextVersion: string) => void;

export interface UpdateMonitorOptions {
    /** The version the running application was booted with. */
    readonly currentVersion: string;
    /** The version document location; defaults to the runtime environment document. */
    readonly url?: string;
    /** Poll interval in milliseconds; defaults to five minutes. */
    readonly interval?: number;
    readonly fetchFn?: typeof fetch;
    /** Extract the deployed version from the parsed document; defaults to the APP_VERSION entry. */
    readonly extractVersion?: (payload: unknown) => string | null;
    /** The document whose visibility triggers focus checks; defaults to the global document. */
    readonly targetDocument?: Document;
}

const DEFAULT_URL = '/runtime-env.json';
const DEFAULT_INTERVAL = 300_000;

/**
 * Polls the deployed version and notifies subscribers when it changes.
 */
export class UpdateMonitor {
    readonly #currentVersion: string;
    readonly #url: string;
    readonly #interval: number;
    readonly #fetchFn: typeof fetch;
    readonly #extractVersion: (payload: unknown) => string | null;
    readonly #targetDocument: Document;
    readonly #handlers = new Set<UpdateHandler>();
    readonly #onVisibilityChange = (): void => {
        if (this.#targetDocument.visibilityState === 'visible') {
            this.#poll();
        }
    };

    readonly #poll = (): void => {
        this.checkNow().catch(() => {
            // checkNow swallows transport errors itself; this guards against
            // subscriber callbacks that throw.
        });
    };

    #timer: ReturnType<typeof setInterval> | null = null;
    #notifiedVersion: string | null = null;

    constructor(options: UpdateMonitorOptions) {
        this.#currentVersion = options.currentVersion;
        this.#url = options.url ?? DEFAULT_URL;
        this.#interval = options.interval ?? DEFAULT_INTERVAL;
        this.#fetchFn = options.fetchFn ?? ((input, init) => globalThis.fetch(input, init));
        this.#extractVersion = options.extractVersion ?? extractAppVersion;
        this.#targetDocument = options.targetDocument ?? globalThis.document;
    }

    /**
     * Begin polling. Calling start on a running monitor is a no-op.
     */
    start(): void {
        if (this.#timer !== null) {
            return;
        }

        this.#timer = setInterval(this.#poll, this.#interval);

        this.#targetDocument.addEventListener('visibilitychange', this.#onVisibilityChange);
    }

    /**
     * Stop polling and detach the visibility listener.
     */
    stop(): void {
        if (this.#timer === null) {
            return;
        }

        clearInterval(this.#timer);
        this.#timer = null;

        this.#targetDocument.removeEventListener('visibilitychange', this.#onVisibilityChange);
    }

    /**
     * Subscribe to update notifications.
     *
     * @param handler - invoked with the newly deployed version
     * @returns an unsubscribe function
     */
    onUpdate(handler: UpdateHandler): () => void {
        this.#handlers.add(handler);

        return () => {
            this.#handlers.delete(handler);
        };
    }

    /**
     * Check the deployed version immediately.
     *
     * Transport failures and malformed documents are swallowed: a missed
     * check is harmless because the next tick retries.
     */
    async checkNow(): Promise<void> {
        let next: string | null;

        try {
            const response = await this.#fetchFn(this.#url, {
                cache: 'no-store',
                headers: { accept: 'application/json' },
            });

            if (!response.ok) {
                return;
            }

            next = this.#extractVersion(await response.json());
        } catch {
            return;
        }

        if (next === null || next === '' || next === this.#currentVersion || next === this.#notifiedVersion) {
            return;
        }

        this.#notifiedVersion = next;

        for (const handler of this.#handlers) {
            handler(next);
        }
    }
}

/**
 * Extract the APP_VERSION entry from a runtime environment document.
 *
 * @param payload - the parsed version document
 * @returns the deployed version, or null when absent
 */
function extractAppVersion(payload: unknown): string | null {
    const version = isRecord(payload) ? payload.APP_VERSION : null;

    return typeof version === 'string' ? version : null;
}
