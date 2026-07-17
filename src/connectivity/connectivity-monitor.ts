/**
 * Network-connectivity monitoring.
 *
 * The browser's `navigator.onLine` flag and the `online`/`offline` window
 * events are the only signal the kernel has for reachability; this monitor
 * wraps them so subscribers are notified once per actual state change rather
 * than once per event (browsers can fire either event more than once in a row).
 * Consumers use the signal to pause work that is pointless while offline - the
 * update monitor pauses its polling, and realtime connections pause reconnect
 * attempts rather than storming a network that is known to be down. The
 * application wires those pauses; this module only detects the state.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

export type ConnectivityHandler = (online: boolean) => void;

export interface ConnectivityMonitorOptions {
    /**
     * The window whose connectivity events are observed; defaults to the global
     * window.
     */
    readonly targetWindow?: Window;
}

/**
 * Tracks browser network connectivity and notifies subscribers on change.
 */
export class ConnectivityMonitor {
    readonly #targetWindow: Window;
    readonly #handlers = new Set<ConnectivityHandler>();
    readonly #onOnline = (): void => {
        this.#setOnline(true);
    };

    readonly #onOffline = (): void => {
        this.#setOnline(false);
    };

    #online: boolean;
    #started: boolean = false;

    constructor(options: ConnectivityMonitorOptions = {}) {
        this.#targetWindow = options.targetWindow ?? globalThis.window;
        this.#online = this.#targetWindow.navigator.onLine;
    }

    /** The current connectivity state. */
    get online(): boolean {
        return this.#online;
    }

    /**
     * Begin observing connectivity events. Calling start on a running monitor
     * is a no-op.
     */
    start(): void {
        if (this.#started) {
            return;
        }

        this.#started = true;

        this.#targetWindow.addEventListener('online', this.#onOnline);
        this.#targetWindow.addEventListener('offline', this.#onOffline);
    }

    /**
     * Stop observing and detach the connectivity listeners.
     */
    stop(): void {
        if (!this.#started) {
            return;
        }

        this.#started = false;

        this.#targetWindow.removeEventListener('online', this.#onOnline);
        this.#targetWindow.removeEventListener('offline', this.#onOffline);
    }

    /**
     * Subscribe to connectivity changes.
     *
     * @param handler - invoked with the new state, once per actual change
     * @returns an unsubscribe function
     */
    onChange(handler: ConnectivityHandler): () => void {
        this.#handlers.add(handler);

        return () => {
            this.#handlers.delete(handler);
        };
    }

    /**
     * Record a new state and notify subscribers only when it actually changed.
     *
     * @param online - the connectivity state reported by the latest event
     */
    #setOnline(online: boolean): void {
        if (online === this.#online) {
            return;
        }

        this.#online = online;

        for (const handler of this.#handlers) {
            handler(online);
        }
    }
}
