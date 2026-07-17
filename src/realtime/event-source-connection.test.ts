/**
 * Unit tests for event-source-connection.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventSourceConnection, type EventSourceFactory } from './event-source-connection';
import { ExponentialBackoff } from './exponential-backoff';

/** Minimal fake EventSource for injection via the factory. */
class FakeEventSource {
    readonly url: string;
    readonly withCredentials: boolean;
    onopen: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    readonly #listeners: Map<string, Array<(event: MessageEvent) => void>> = new Map();
    #closed: boolean = false;

    closeCalls: number = 0;

    constructor(url: string, init: EventSourceInit) {
        this.url = url;
        this.withCredentials = init.withCredentials ?? false;
    }

    addEventListener(type: string, listener: (event: MessageEvent) => void): void {
        let list = this.#listeners.get(type);

        if (list === undefined) {
            list = [];
            this.#listeners.set(type, list);
        }

        list.push(listener);
    }

    close(): void {
        this.#closed = true;
        this.closeCalls++;
    }

    get closed(): boolean {
        return this.#closed;
    }

    emitOpen(): void {
        this.onopen?.(new Event('open'));
    }

    emitError(): void {
        this.onerror?.(new Event('error'));
    }

    emitMessage(type: string, data: unknown): void {
        const listeners = this.#listeners.get(type) ?? [];
        const event = new MessageEvent(type, { data });

        for (const listener of listeners) {
            listener(event);
        }
    }
}

/**
 * Creates a typed {@link EventSourceFactory} that records each fake it creates.
 * The cast to `EventSource` is confined to a single line inside the closure so
 * every test body can use the strongly-typed {@link FakeEventSource} directly.
 */
function makeFactory(): { sources: FakeEventSource[]; factory: EventSourceFactory } {
    const sources: FakeEventSource[] = [];

    const factory: EventSourceFactory = (url, init) => {
        const source = new FakeEventSource(url, init);

        sources.push(source);

        return source as unknown as EventSource;
    };

    return { sources, factory };
}

/** Fixed-delay backoff for deterministic reconnect assertions. */
function fixedBackoff(delay: number): ExponentialBackoff {
    return new ExponentialBackoff({ initialDelay: delay, multiplier: 1, maxDelay: delay });
}

/** A promise plus its externally callable settlement functions. */
interface Deferred<T> {
    readonly promise: Promise<T>;
    readonly resolve: (value: T) => void;
    readonly reject: (reason: unknown) => void;
}

/** Creates a promise whose settlement is controlled from the test body. */
function deferred<T = void>(): Deferred<T> {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;

    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
}

describe('EventSourceConnection', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('initial state', () => {
        it('starts in the idle state', () => {
            const { factory } = makeFactory();
            const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

            expect(conn.state).toBe('idle');
        });
    });

    describe('connect()', () => {
        it('transitions to connecting and creates an EventSource', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

            conn.connect();

            expect(conn.state).toBe('connecting');
            expect(sources).toHaveLength(1);
        });

        it('passes the url string to the factory', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({ url: 'http://sse/events', eventSourceFactory: factory });

            conn.connect();

            const source = sources.at(0);

            expect(source).toBeDefined();
            expect(source?.url).toBe('http://sse/events');
        });

        it('resolves a url function on each connect', () => {
            const { sources, factory } = makeFactory();
            const token = 'token-a';
            const conn = new EventSourceConnection({ url: () => `http://sse?t=${token}`, eventSourceFactory: factory });

            conn.connect();

            const source = sources.at(0);

            expect(source).toBeDefined();
            expect(source?.url).toBe('http://sse?t=token-a');
        });

        it('passes withCredentials to the factory', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({
                url: 'http://sse',
                withCredentials: true,
                eventSourceFactory: factory,
            });

            conn.connect();

            const source = sources.at(0);

            expect(source).toBeDefined();
            expect(source?.withCredentials).toBe(true);
        });

        it('defaults withCredentials to false', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

            conn.connect();

            const source = sources.at(0);

            expect(source).toBeDefined();
            expect(source?.withCredentials).toBe(false);
        });

        it('is a no-op when already connecting', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

            conn.connect();
            conn.connect();

            expect(sources).toHaveLength(1);
        });

        it('is a no-op when already open', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

            conn.connect();
            sources.at(0)?.emitOpen();
            conn.connect();

            expect(sources).toHaveLength(1);
        });

        it('transitions to open when onopen fires', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

            conn.connect();
            sources.at(0)?.emitOpen();

            expect(conn.state).toBe('open');
        });

        it('exercises the default EventSource factory when no factory is injected', () => {
            // happy-dom does not ship an EventSource stub, so we install a
            // minimal constructible shim on globalThis to exercise the default
            // factory path.
            const globals = globalThis as Record<string, unknown>;
            const OriginalEventSource = globals.EventSource;

            class FakeEventSourceShim extends FakeEventSource {}

            globals.EventSource = FakeEventSourceShim;

            try {
                const conn = new EventSourceConnection({ url: 'http://localhost/sse' });

                expect(() => conn.connect()).not.toThrow();
            } finally {
                globals.EventSource = OriginalEventSource;
            }
        });

        it('uses a default ExponentialBackoff when none is provided', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

            conn.connect();
            sources.at(0)?.emitError();

            // Default backoff: first attempt delay is 1 000 ms.
            vi.advanceTimersByTime(999);
            expect(sources).toHaveLength(1);

            vi.advanceTimersByTime(1);
            expect(sources).toHaveLength(2);
        });
    });

    describe('disconnect()', () => {
        it('transitions to closed', () => {
            const { factory } = makeFactory();
            const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

            conn.connect();
            conn.disconnect();

            expect(conn.state).toBe('closed');
        });

        it('closes the underlying EventSource', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

            conn.connect();
            conn.disconnect();

            const source = sources.at(0);

            expect(source).toBeDefined();
            expect(source?.closeCalls).toBe(1);
        });

        it('cancels a pending reconnect timer', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({
                url: 'http://sse',
                backoff: fixedBackoff(500),
                eventSourceFactory: factory,
            });

            conn.connect();
            sources.at(0)?.emitError();

            // Reconnect is pending; disconnect before the timer fires.
            conn.disconnect();

            vi.advanceTimersByTime(1_000);

            // Still only the original source - reconnect was cancelled.
            expect(sources).toHaveLength(1);
        });

        it('does not reconnect after disconnect even when an error fires', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({
                url: 'http://sse',
                backoff: fixedBackoff(100),
                eventSourceFactory: factory,
            });

            conn.connect();
            conn.disconnect();

            vi.advanceTimersByTime(5_000);

            expect(sources).toHaveLength(1);
        });
    });

    describe('reconnect on error', () => {
        it('schedules a reconnect after an error', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({
                url: 'http://sse',
                backoff: fixedBackoff(200),
                eventSourceFactory: factory,
            });

            conn.connect();
            sources.at(0)?.emitError();

            expect(sources).toHaveLength(1);

            vi.advanceTimersByTime(200);

            expect(sources).toHaveLength(2);
        });

        it('advances backoff delay on successive errors', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({
                url: 'http://sse',
                backoff: new ExponentialBackoff({ initialDelay: 100, multiplier: 2, maxDelay: 10_000 }),
                eventSourceFactory: factory,
            });

            conn.connect();
            sources.at(0)?.emitError();

            // attempt=0 → 100 ms
            vi.advanceTimersByTime(100);
            expect(sources).toHaveLength(2);

            sources.at(1)?.emitError();

            // attempt=1 → 200 ms
            vi.advanceTimersByTime(199);
            expect(sources).toHaveLength(2);

            vi.advanceTimersByTime(1);
            expect(sources).toHaveLength(3);
        });

        it('resets the attempt counter after a successful open', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({
                url: 'http://sse',
                backoff: new ExponentialBackoff({ initialDelay: 100, multiplier: 2, maxDelay: 10_000 }),
                eventSourceFactory: factory,
            });

            conn.connect();
            // Fail twice to advance the attempt counter.
            sources.at(0)?.emitError();
            vi.advanceTimersByTime(100);

            sources.at(1)?.emitError();
            vi.advanceTimersByTime(200);

            // Now open successfully → attempt resets.
            sources.at(2)?.emitOpen();

            sources.at(2)?.emitError();

            // Next delay should be 100 ms again (attempt 0).
            vi.advanceTimersByTime(99);
            expect(sources).toHaveLength(3);

            vi.advanceTimersByTime(1);
            expect(sources).toHaveLength(4);
        });

        it('uses the url function on each reconnect', () => {
            const { sources, factory } = makeFactory();
            let counter = 0;
            const conn = new EventSourceConnection({
                url: () => `http://sse?n=${++counter}`,
                backoff: fixedBackoff(50),
                eventSourceFactory: factory,
            });

            conn.connect();
            sources.at(0)?.emitError();

            vi.advanceTimersByTime(50);

            const first = sources.at(0);
            const second = sources.at(1);

            expect(first).toBeDefined();
            expect(second).toBeDefined();
            expect(first?.url).toBe('http://sse?n=1');
            expect(second?.url).toBe('http://sse?n=2');
        });

        it('re-attaches registered event listeners to the new source after reconnect', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({
                url: 'http://sse',
                backoff: fixedBackoff(50),
                eventSourceFactory: factory,
            });

            const received: string[] = [];

            conn.on('update', msg => received.push(msg.data));
            conn.connect();
            sources.at(0)?.emitError();

            vi.advanceTimersByTime(50);

            sources.at(1)?.emitOpen();
            sources.at(1)?.emitMessage('update', 'hello');

            expect(received).toEqual(['hello']);
        });
    });

    describe('beforeReconnect', () => {
        it('is not invoked for the initial connect()', () => {
            const { factory } = makeFactory();
            const beforeReconnect = vi.fn(() => Promise.resolve());
            const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory, beforeReconnect });

            conn.connect();

            expect(beforeReconnect).not.toHaveBeenCalled();
        });

        it('is not invoked for a manual connect() call', () => {
            const { sources, factory } = makeFactory();
            const beforeReconnect = vi.fn(() => Promise.resolve());
            const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory, beforeReconnect });

            conn.connect();
            conn.disconnect();
            conn.connect();

            expect(beforeReconnect).not.toHaveBeenCalled();
            expect(sources).toHaveLength(2);
        });

        it('is invoked after the backoff delay fires, not immediately on error', async () => {
            const { sources, factory } = makeFactory();
            const beforeReconnect = vi.fn(() => Promise.resolve());
            const conn = new EventSourceConnection({
                url: 'http://sse',
                backoff: fixedBackoff(100),
                eventSourceFactory: factory,
                beforeReconnect,
            });

            conn.connect();
            sources.at(0)?.emitError();

            expect(beforeReconnect).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(100);

            expect(beforeReconnect).toHaveBeenCalledTimes(1);
        });

        it('creates the new EventSource only after the hook resolves', async () => {
            const { sources, factory } = makeFactory();
            const gate = deferred<void>();
            const conn = new EventSourceConnection({
                url: 'http://sse',
                backoff: fixedBackoff(100),
                eventSourceFactory: factory,
                beforeReconnect: () => gate.promise,
            });

            conn.connect();
            sources.at(0)?.emitError();

            await vi.advanceTimersByTimeAsync(100);

            // Hook is pending: no second source yet.
            expect(sources).toHaveLength(1);

            gate.resolve();
            await gate.promise;

            expect(sources).toHaveLength(2);
        });

        it('schedules the next backoff attempt without creating a transport when the hook rejects', async () => {
            const { sources, factory } = makeFactory();
            let calls = 0;
            const conn = new EventSourceConnection({
                url: 'http://sse',
                backoff: fixedBackoff(100),
                eventSourceFactory: factory,
                beforeReconnect: () =>
                    ++calls === 1 ? Promise.reject(new Error('token refresh failed')) : Promise.resolve(),
            });

            conn.connect();
            sources.at(0)?.emitError();

            await vi.advanceTimersByTimeAsync(100);

            // First hook call rejected: attempt abandoned, no transport
            // created.
            expect(sources).toHaveLength(1);
            expect(conn.state).toBe('connecting');

            await vi.advanceTimersByTimeAsync(100);

            // Next backoff attempt: hook resolves, transport is created.
            expect(sources).toHaveLength(2);
            expect(calls).toBe(2);
        });

        it('does not create a transport when disconnected while the hook is pending and it resolves', async () => {
            const { sources, factory } = makeFactory();
            const gate = deferred<void>();
            const conn = new EventSourceConnection({
                url: 'http://sse',
                backoff: fixedBackoff(100),
                eventSourceFactory: factory,
                beforeReconnect: () => gate.promise,
            });

            conn.connect();
            sources.at(0)?.emitError();

            await vi.advanceTimersByTimeAsync(100);

            conn.disconnect();
            gate.resolve();
            await gate.promise;

            expect(sources).toHaveLength(1);
            expect(conn.state).toBe('closed');

            // No further reconnect is ever scheduled.
            await vi.advanceTimersByTimeAsync(10_000);

            expect(sources).toHaveLength(1);
            expect(conn.state).toBe('closed');
        });

        it('does not schedule anything when disconnected while the hook is pending and it rejects', async () => {
            const { sources, factory } = makeFactory();
            const gate = deferred<void>();
            const conn = new EventSourceConnection({
                url: 'http://sse',
                backoff: fixedBackoff(100),
                eventSourceFactory: factory,
                beforeReconnect: () => gate.promise,
            });

            conn.connect();
            sources.at(0)?.emitError();

            await vi.advanceTimersByTimeAsync(100);

            conn.disconnect();
            gate.reject(new Error('token refresh failed'));
            await gate.promise.catch(() => {
                // Rejection is expected here; the abandonment is asserted
                // below.
            });

            expect(sources).toHaveLength(1);
            expect(conn.state).toBe('closed');

            await vi.advanceTimersByTimeAsync(10_000);

            expect(sources).toHaveLength(1);
            expect(conn.state).toBe('closed');
        });
    });

    describe('on()', () => {
        it('delivers matching messages to the handler', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

            const received: string[] = [];

            conn.on('ping', msg => received.push(msg.data));
            conn.connect();
            sources.at(0)?.emitMessage('ping', 'pong');

            expect(received).toEqual(['pong']);
        });

        it('coerces data to a string', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

            const received: string[] = [];

            conn.on('tick', msg => received.push(msg.data));
            conn.connect();
            sources.at(0)?.emitMessage('tick', 42);

            expect(received).toEqual(['42']);
        });

        it('delivers messages to multiple handlers for the same event', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

            const a: string[] = [];
            const b: string[] = [];

            conn.on('update', msg => a.push(msg.data));
            conn.on('update', msg => b.push(msg.data));
            conn.connect();
            sources.at(0)?.emitMessage('update', 'x');

            expect(a).toEqual(['x']);
            expect(b).toEqual(['x']);
        });

        it('does not deliver messages for a different event', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

            const received: string[] = [];

            conn.on('ping', msg => received.push(msg.data));
            conn.connect();
            sources.at(0)?.emitMessage('other', 'ignored');

            expect(received).toEqual([]);
        });

        it('attaches addEventListener when registered after connect', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

            conn.connect();

            const received: string[] = [];

            conn.on('late', msg => received.push(msg.data));
            sources.at(0)?.emitMessage('late', 'hi');

            expect(received).toEqual(['hi']);
        });

        it('includes the event name in the message', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

            const events: string[] = [];

            conn.on('myEvent', msg => events.push(msg.event));
            conn.connect();
            sources.at(0)?.emitMessage('myEvent', 'data');

            expect(events).toEqual(['myEvent']);
        });

        describe('unsubscribe', () => {
            it('stops delivery after unsubscribe is called', () => {
                const { sources, factory } = makeFactory();
                const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

                const received: string[] = [];
                const unsub = conn.on('ping', msg => received.push(msg.data));

                conn.connect();
                sources.at(0)?.emitMessage('ping', 'first');
                unsub();
                sources.at(0)?.emitMessage('ping', 'second');

                expect(received).toEqual(['first']);
            });

            it('does not affect other handlers for the same event', () => {
                const { sources, factory } = makeFactory();
                const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

                const a: string[] = [];
                const b: string[] = [];

                const unsubA = conn.on('evt', msg => a.push(msg.data));

                conn.on('evt', msg => b.push(msg.data));
                conn.connect();
                sources.at(0)?.emitMessage('evt', '1');
                unsubA();
                sources.at(0)?.emitMessage('evt', '2');

                expect(a).toEqual(['1']);
                expect(b).toEqual(['1', '2']);
            });
        });
    });

    describe('onStateChange()', () => {
        it('notifies on state transitions', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

            const states: string[] = [];

            conn.onStateChange(s => states.push(s));
            conn.connect();
            sources.at(0)?.emitOpen();
            conn.disconnect();

            expect(states).toEqual(['connecting', 'open', 'closed']);
        });

        it('does not emit duplicate states', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({
                url: 'http://sse',
                backoff: fixedBackoff(50),
                eventSourceFactory: factory,
            });

            const states: string[] = [];

            conn.onStateChange(s => states.push(s));
            conn.connect();
            // Error → connecting again (should not re-emit 'connecting' if
            // already connecting).
            sources.at(0)?.emitError();

            expect(states).toEqual(['connecting']);
        });

        describe('unsubscribe', () => {
            it('stops state notifications after unsubscribe', () => {
                const { sources, factory } = makeFactory();
                const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

                const states: string[] = [];
                const unsub = conn.onStateChange(s => states.push(s));

                conn.connect();
                unsub();
                sources.at(0)?.emitOpen();

                expect(states).toEqual(['connecting']);
            });
        });
    });
});
