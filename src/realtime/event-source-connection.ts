/**
 * SSE adapter for the {@link RealtimeConnection} port.
 *
 * Wraps the browser's native {@link EventSource} API. Note that native
 * EventSource cannot send custom request headers; the recommended pattern for
 * authenticated streams is to embed the token in the query string via the `url`
 * function form, which is called fresh on every connect so that per-connect
 * credentials are always current.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { ExponentialBackoff } from './exponential-backoff';
import { runReconnect } from './reconnect';
import type {
    RealtimeConnection,
    RealtimeMessage,
    RealtimeMessageHandler,
    RealtimeState,
    RealtimeStateHandler,
} from './realtime-connection';

/**
 * Injectable factory for {@link EventSource} instances.
 *
 * @param url - the SSE endpoint URL
 * @param init - EventSource initialisation options
 * @returns a new EventSource
 */
export type EventSourceFactory = (url: string, init: EventSourceInit) => EventSource;

/** Construction options for {@link EventSourceConnection}. */
export interface EventSourceConnectionOptions {

    /** The SSE endpoint URL, or a function that returns it. The function form is called on every `connect()`, enabling per-connect auth tokens in the query string - the recommended way to authenticate SSE streams because native EventSource cannot send custom headers. */
    readonly url: string | (() => string);

    /** Pass `true` to include credentials (cookies) in the SSE request. Defaults to `false`. */
    readonly withCredentials?: boolean;

    /** Backoff strategy for reconnects. Defaults to `new ExponentialBackoff()`. */
    readonly backoff?: ExponentialBackoff;

    /** Override the EventSource constructor. Defaults to `(url, init) => new EventSource(url, init)`. */
    readonly eventSourceFactory?: EventSourceFactory;

    /** Awaited after the backoff delay fires and before each reconnect attempt opens a new EventSource. Never called for the initial `connect()` or a manual `connect()` call. Wire the application's `TokenRefreshCoordinator` here so an expired token is refreshed before each reconnect, and pair it with the `url()` builder reading the fresh token; without this an expired-token connection retries forever with stale credentials. Rejection abandons the attempt and the next reconnect is scheduled through the existing backoff path. */
    readonly beforeReconnect?: () => Promise<void>;
}

/**
 * SSE adapter implementing {@link RealtimeConnection}.
 *
 * Reconnects automatically on error using the provided backoff strategy. All
 * registered event listeners are re-attached to every new EventSource after a
 * reconnect. When `beforeReconnect` is supplied, it is awaited before each
 * reconnect opens a new EventSource.
 */
export class EventSourceConnection implements RealtimeConnection {

    /** The endpoint URL, or a factory returning it per connect. */
    readonly #url: string | (() => string);

    /** Whether the SSE request includes credentials. */
    readonly #withCredentials: boolean;

    /** The backoff strategy spacing reconnect attempts. */
    readonly #backoff: ExponentialBackoff;

    /** The factory that constructs each EventSource. */
    readonly #factory: EventSourceFactory;

    /** Optional hook awaited before each reconnect. */
    readonly #beforeReconnect: (() => Promise<void>) | undefined;

    /** Registered message handlers, keyed by event name. */
    readonly #messageHandlers: Map<string, Set<RealtimeMessageHandler>> = new Map();

    /** Registered connection-state change handlers. */
    readonly #stateHandlers: Set<RealtimeStateHandler> = new Set();

    /** The active EventSource, or null when not open. */
    #source: EventSource | null = null;

    /** The current connection lifecycle state. */
    #state: RealtimeState = 'idle';

    /** The current zero-based reconnect attempt counter. */
    #attempt: number = 0;

    /** The pending reconnect timer, or null when none. */
    #reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * Construct a new SSE connection.
     *
     * @param options - URL, credentials, backoff strategy, and optional
     * EventSource factory
     */
    constructor(options: EventSourceConnectionOptions) {
        this.#url = options.url;
        this.#withCredentials = options.withCredentials ?? false;
        this.#backoff = options.backoff ?? new ExponentialBackoff();
        this.#factory = options.eventSourceFactory ?? ((url, init) => new EventSource(url, init));
        this.#beforeReconnect = options.beforeReconnect;
    }

    /**
     * The current connection lifecycle state.
     */
    get state(): RealtimeState {
        return this.#state;
    }

    /**
     * Open the SSE connection. No-op when already connecting or open.
     */
    connect(): void {
        if (this.#state === 'connecting' || this.#state === 'open') {
            return;
        }

        this.#openSource();
    }

    /**
     * Close the connection permanently, cancelling any pending reconnect.
     */
    disconnect(): void {
        this.#cancelReconnect();
        this.#closeSource();
        this.#setState('closed');
    }

    /**
     * Subscribe to messages for a specific event name.
     *
     * @param event - the event name to subscribe to
     * @param handler - called for each matching incoming message
     * @returns an unsubscribe function
     */
    on(event: string, handler: RealtimeMessageHandler): () => void {
        let handlers = this.#messageHandlers.get(event);

        if (handlers === undefined) {
            handlers = new Set();
            this.#messageHandlers.set(event, handlers);

            if (this.#source !== null) {
                this.#attachEventListener(this.#source, event);
            }
        }

        handlers.add(handler);

        return () => {
            this.#messageHandlers.get(event)?.delete(handler);
        };
    }

    /**
     * Subscribe to connection state changes.
     *
     * @param handler - called each time the state transitions
     * @returns an unsubscribe function
     */
    onStateChange(handler: RealtimeStateHandler): () => void {
        this.#stateHandlers.add(handler);

        return () => {
            this.#stateHandlers.delete(handler);
        };
    }

    /**
     * Open a fresh EventSource, wire its lifecycle handlers, and re-attach
     * every registered event listener.
     */
    #openSource(): void {
        this.#setState('connecting');

        const url = typeof this.#url === 'function' ? this.#url() : this.#url;
        const source = this.#factory(url, { withCredentials: this.#withCredentials });

        source.onopen = () => {
            this.#attempt = 0;
            this.#setState('open');
        };

        source.onerror = () => {
            source.close();
            this.#source = null;
            this.#scheduleReconnect();
        };

        for (const event of this.#messageHandlers.keys()) {
            this.#attachEventListener(source, event);
        }

        this.#source = source;
    }

    /**
     * Attach a listener for one event name that fans frames out to its
     * handlers.
     *
     * @param source - the EventSource to attach the listener to
     * @param event - the event name to listen for
     */
    #attachEventListener(source: EventSource, event: string): void {
        source.addEventListener(event, (messageEvent: MessageEvent) => {
            const message: RealtimeMessage = { event, data: String(messageEvent.data) };

            this.#messageHandlers.get(event)?.forEach(handler => handler(message));
        });
    }

    /**
     * Enter the connecting state and schedule the next reconnect after the
     * backoff delay for the current attempt.
     */
    #scheduleReconnect(): void {
        const delay = this.#backoff.delayFor(this.#attempt++);

        this.#setState('connecting');

        this.#reconnectTimer = setTimeout(() => {
            this.#reconnectTimer = null;
            void this.#runReconnect();
        }, delay);
    }

    /**
     * Run one reconnect attempt, awaiting the optional beforeReconnect hook
     * first. A disconnect that lands while the hook is pending must leave no
     * trace once it settles, so the closed state is re-checked afterwards.
     */
    async #runReconnect(): Promise<void> {
        await runReconnect({
            beforeReconnect: this.#beforeReconnect,
            isClosed: () => this.#state === 'closed',
            reopen: () => this.#openSource(),
            reschedule: () => this.#scheduleReconnect(),
        });
    }

    /**
     * Detach the lifecycle handlers from the active EventSource and close it.
     */
    #closeSource(): void {
        if (this.#source !== null) {
            this.#source.onopen = null;
            this.#source.onerror = null;
            this.#source.close();
            this.#source = null;
        }
    }

    /**
     * Cancel any pending reconnect timer.
     */
    #cancelReconnect(): void {
        if (this.#reconnectTimer !== null) {
            clearTimeout(this.#reconnectTimer);
            this.#reconnectTimer = null;
        }
    }

    /**
     * Transition to `next`, notifying state subscribers only on a real change.
     *
     * @param next - the state to transition to
     */
    #setState(next: RealtimeState): void {
        if (this.#state === next) {
            return;
        }

        this.#state = next;

        for (const handler of this.#stateHandlers) {
            handler(next);
        }
    }
}
