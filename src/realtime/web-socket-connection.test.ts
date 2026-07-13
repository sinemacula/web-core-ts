/**
 * Unit tests for web-socket-connection.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExponentialBackoff } from './exponential-backoff';
import { WebSocketConnection, type WebSocketFactory } from './web-socket-connection';

/** Minimal fake WebSocket for injection via the factory. */
class FakeWebSocket {
    readonly url: string;
    readonly protocols: string | readonly string[] | undefined;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;

    #closed: boolean = false;
    closeCalls: number = 0;
    sentMessages: string[] = [];

    constructor(url: string, protocols?: string | readonly string[]) {
        this.url = url;
        this.protocols = protocols;
    }

    send(data: string): void {
        this.sentMessages.push(data);
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

    emitMessage(data: string): void {
        this.onmessage?.(new MessageEvent('message', { data }));
    }

    emitClose(): void {
        this.onclose?.(new CloseEvent('close'));
    }
}

/**
 * Creates a typed {@link WebSocketFactory} that records each fake it creates.
 * The cast to `WebSocket` is confined to a single line inside the closure so
 * every test body can use the strongly-typed {@link FakeWebSocket} directly.
 */
function makeFactory(): { sockets: FakeWebSocket[]; factory: WebSocketFactory } {
    const sockets: FakeWebSocket[] = [];

    const factory: WebSocketFactory = (url, protocols) => {
        const socket = new FakeWebSocket(url, protocols);

        sockets.push(socket);

        return socket as unknown as WebSocket;
    };

    return { sockets, factory };
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

describe('WebSocketConnection', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('initial state', () => {
        it('starts in the idle state', () => {
            const { factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            expect(conn.state).toBe('idle');
        });
    });

    describe('connect()', () => {
        it('transitions to connecting and creates a WebSocket', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            conn.connect();

            expect(conn.state).toBe('connecting');
            expect(sockets).toHaveLength(1);
        });

        it('passes the url string to the factory', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test/path', webSocketFactory: factory });

            conn.connect();

            const socket = sockets.at(0);

            expect(socket).toBeDefined();
            expect(socket?.url).toBe('ws://test/path');
        });

        it('resolves a url function on each connect', () => {
            const { sockets, factory } = makeFactory();
            const token = 'a';
            const conn = new WebSocketConnection({ url: () => `ws://test?t=${token}`, webSocketFactory: factory });

            conn.connect();

            const socket = sockets.at(0);

            expect(socket).toBeDefined();
            expect(socket?.url).toBe('ws://test?t=a');
        });

        it('passes protocols to the factory', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', protocols: 'v1', webSocketFactory: factory });

            conn.connect();

            const socket = sockets.at(0);

            expect(socket).toBeDefined();
            expect(socket?.protocols).toBe('v1');
        });

        it('is a no-op when already connecting', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            conn.connect();
            conn.connect();

            expect(sockets).toHaveLength(1);
        });

        it('is a no-op when already open', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            conn.connect();
            sockets.at(0)?.emitOpen();
            conn.connect();

            expect(sockets).toHaveLength(1);
        });

        it('transitions to open when onopen fires', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            conn.connect();
            sockets.at(0)?.emitOpen();

            expect(conn.state).toBe('open');
        });

        it('uses a default ExponentialBackoff when none is provided', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            conn.connect();
            sockets.at(0)?.emitClose();

            // Default backoff: first attempt delay is 1 000 ms.
            vi.advanceTimersByTime(999);
            expect(sockets).toHaveLength(1);

            vi.advanceTimersByTime(1);
            expect(sockets).toHaveLength(2);
        });

        it('exercises the default WebSocket factory with no protocols', () => {
            // happy-dom provides a WebSocket stub so connect() does not throw;
            // this covers the protocols === undefined branch in the default factory.
            const conn = new WebSocketConnection({ url: 'ws://localhost' });

            expect(() => conn.connect()).not.toThrow();
        });

        it('exercises the default WebSocket factory with a string protocol', () => {
            // Covers the typeof protocols === 'string' branch in the default factory.
            const conn = new WebSocketConnection({ url: 'ws://localhost', protocols: 'v1' });

            expect(() => conn.connect()).not.toThrow();
        });

        it('exercises the default WebSocket factory with an array of protocols', () => {
            // Covers the readonly string[] → string[] cast branch in the default factory.
            const conn = new WebSocketConnection({ url: 'ws://localhost', protocols: ['v1', 'v2'] });

            expect(() => conn.connect()).not.toThrow();
        });
    });

    describe('disconnect()', () => {
        it('transitions to closed', () => {
            const { factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            conn.connect();
            conn.disconnect();

            expect(conn.state).toBe('closed');
        });

        it('closes the underlying WebSocket', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            conn.connect();
            conn.disconnect();

            const socket = sockets.at(0);

            expect(socket).toBeDefined();
            expect(socket?.closeCalls).toBe(1);
        });

        it('cancels a pending reconnect timer', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({
                url: 'ws://test',
                backoff: fixedBackoff(500),
                webSocketFactory: factory,
            });

            conn.connect();
            sockets.at(0)?.emitClose();
            conn.disconnect();

            vi.advanceTimersByTime(1_000);

            expect(sockets).toHaveLength(1);
        });

        it('does not reconnect after disconnect because onclose is cleared before close', () => {
            // disconnect() clears socket.onclose before calling close(), so the
            // close event cannot trigger a reconnect even if the underlying
            // transport delivers it synchronously.
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({
                url: 'ws://test',
                backoff: fixedBackoff(100),
                webSocketFactory: factory,
            });

            conn.connect();
            conn.disconnect();

            vi.advanceTimersByTime(5_000);

            expect(sockets).toHaveLength(1);
        });
    });

    describe('reconnect on close', () => {
        it('schedules a reconnect when the server closes the connection', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({
                url: 'ws://test',
                backoff: fixedBackoff(200),
                webSocketFactory: factory,
            });

            conn.connect();
            sockets.at(0)?.emitClose();

            expect(sockets).toHaveLength(1);

            vi.advanceTimersByTime(200);

            expect(sockets).toHaveLength(2);
        });

        it('advances the backoff delay on successive closes', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({
                url: 'ws://test',
                backoff: new ExponentialBackoff({ initialDelay: 100, multiplier: 2, maxDelay: 10_000 }),
                webSocketFactory: factory,
            });

            conn.connect();
            sockets.at(0)?.emitClose();

            // attempt=0 → 100 ms
            vi.advanceTimersByTime(100);
            expect(sockets).toHaveLength(2);

            sockets.at(1)?.emitClose();

            // attempt=1 → 200 ms
            vi.advanceTimersByTime(199);
            expect(sockets).toHaveLength(2);

            vi.advanceTimersByTime(1);
            expect(sockets).toHaveLength(3);
        });

        it('resets the attempt counter after a successful open', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({
                url: 'ws://test',
                backoff: new ExponentialBackoff({ initialDelay: 100, multiplier: 2, maxDelay: 10_000 }),
                webSocketFactory: factory,
            });

            conn.connect();
            sockets.at(0)?.emitClose();
            vi.advanceTimersByTime(100);

            sockets.at(1)?.emitClose();
            vi.advanceTimersByTime(200);

            // Open successfully → attempt resets.
            sockets.at(2)?.emitOpen();
            sockets.at(2)?.emitClose();

            // Next delay should be 100 ms again.
            vi.advanceTimersByTime(99);
            expect(sockets).toHaveLength(3);

            vi.advanceTimersByTime(1);
            expect(sockets).toHaveLength(4);
        });

        it('uses the url function on each reconnect', () => {
            const { sockets, factory } = makeFactory();
            let n = 0;
            const conn = new WebSocketConnection({
                url: () => `ws://test?n=${++n}`,
                backoff: fixedBackoff(50),
                webSocketFactory: factory,
            });

            conn.connect();
            sockets.at(0)?.emitClose();

            vi.advanceTimersByTime(50);

            const first = sockets.at(0);
            const second = sockets.at(1);

            expect(first).toBeDefined();
            expect(second).toBeDefined();
            expect(first?.url).toBe('ws://test?n=1');
            expect(second?.url).toBe('ws://test?n=2');
        });
    });

    describe('beforeReconnect', () => {
        it('is not invoked for the initial connect()', () => {
            const { factory } = makeFactory();
            const beforeReconnect = vi.fn(() => Promise.resolve());
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory, beforeReconnect });

            conn.connect();

            expect(beforeReconnect).not.toHaveBeenCalled();
        });

        it('is not invoked for a manual connect() call', () => {
            const { sockets, factory } = makeFactory();
            const beforeReconnect = vi.fn(() => Promise.resolve());
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory, beforeReconnect });

            conn.connect();
            conn.disconnect();
            conn.connect();

            expect(beforeReconnect).not.toHaveBeenCalled();
            expect(sockets).toHaveLength(2);
        });

        it('is invoked after the backoff delay fires, not immediately on close', async () => {
            const { sockets, factory } = makeFactory();
            const beforeReconnect = vi.fn(() => Promise.resolve());
            const conn = new WebSocketConnection({
                url: 'ws://test',
                backoff: fixedBackoff(100),
                webSocketFactory: factory,
                beforeReconnect,
            });

            conn.connect();
            sockets.at(0)?.emitClose();

            expect(beforeReconnect).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(100);

            expect(beforeReconnect).toHaveBeenCalledTimes(1);
        });

        it('creates the new WebSocket only after the hook resolves', async () => {
            const { sockets, factory } = makeFactory();
            const gate = deferred<void>();
            const conn = new WebSocketConnection({
                url: 'ws://test',
                backoff: fixedBackoff(100),
                webSocketFactory: factory,
                beforeReconnect: () => gate.promise,
            });

            conn.connect();
            sockets.at(0)?.emitClose();

            await vi.advanceTimersByTimeAsync(100);

            // Hook is pending: no second socket yet.
            expect(sockets).toHaveLength(1);

            gate.resolve();
            await gate.promise;

            expect(sockets).toHaveLength(2);
        });

        it('schedules the next backoff attempt without creating a transport when the hook rejects', async () => {
            const { sockets, factory } = makeFactory();
            let calls = 0;
            const conn = new WebSocketConnection({
                url: 'ws://test',
                backoff: fixedBackoff(100),
                webSocketFactory: factory,
                beforeReconnect: () =>
                    ++calls === 1 ? Promise.reject(new Error('token refresh failed')) : Promise.resolve(),
            });

            conn.connect();
            sockets.at(0)?.emitClose();

            await vi.advanceTimersByTimeAsync(100);

            // First hook call rejected: attempt abandoned, no transport created.
            expect(sockets).toHaveLength(1);
            expect(conn.state).toBe('connecting');

            await vi.advanceTimersByTimeAsync(100);

            // Next backoff attempt: hook resolves, transport is created.
            expect(sockets).toHaveLength(2);
            expect(calls).toBe(2);
        });

        it('does not create a transport when disconnected while the hook is pending and it resolves', async () => {
            const { sockets, factory } = makeFactory();
            const gate = deferred<void>();
            const conn = new WebSocketConnection({
                url: 'ws://test',
                backoff: fixedBackoff(100),
                webSocketFactory: factory,
                beforeReconnect: () => gate.promise,
            });

            conn.connect();
            sockets.at(0)?.emitClose();

            await vi.advanceTimersByTimeAsync(100);

            conn.disconnect();
            gate.resolve();
            await gate.promise;

            expect(sockets).toHaveLength(1);
            expect(conn.state).toBe('closed');

            // No further reconnect is ever scheduled.
            await vi.advanceTimersByTimeAsync(10_000);

            expect(sockets).toHaveLength(1);
            expect(conn.state).toBe('closed');
        });

        it('does not schedule anything when disconnected while the hook is pending and it rejects', async () => {
            const { sockets, factory } = makeFactory();
            const gate = deferred<void>();
            const conn = new WebSocketConnection({
                url: 'ws://test',
                backoff: fixedBackoff(100),
                webSocketFactory: factory,
                beforeReconnect: () => gate.promise,
            });

            conn.connect();
            sockets.at(0)?.emitClose();

            await vi.advanceTimersByTimeAsync(100);

            conn.disconnect();
            gate.reject(new Error('token refresh failed'));
            await gate.promise.catch(() => {
                // Rejection is expected here; the abandonment is asserted below.
            });

            expect(sockets).toHaveLength(1);
            expect(conn.state).toBe('closed');

            await vi.advanceTimersByTimeAsync(10_000);

            expect(sockets).toHaveLength(1);
            expect(conn.state).toBe('closed');
        });
    });

    describe('on()', () => {
        it('delivers the raw frame to message subscribers', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            const received: string[] = [];

            conn.on('message', msg => received.push(msg.data));
            conn.connect();
            sockets.at(0)?.emitOpen();
            sockets.at(0)?.emitMessage('hello');

            expect(received).toEqual(['hello']);
        });

        it('sets event to "message" for raw frame delivery', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            const events: string[] = [];

            conn.on('message', msg => events.push(msg.event));
            conn.connect();
            sockets.at(0)?.emitOpen();
            sockets.at(0)?.emitMessage('data');

            expect(events).toEqual(['message']);
        });

        it('delivers an envelope frame to both message and named-event subscribers', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            const messages: string[] = [];
            const updates: string[] = [];

            conn.on('message', msg => messages.push(msg.data));
            conn.on('update', msg => updates.push(msg.data));
            conn.connect();
            sockets.at(0)?.emitOpen();
            sockets.at(0)?.emitMessage(JSON.stringify({ event: 'update', data: 'payload' }));

            expect(messages).toEqual([JSON.stringify({ event: 'update', data: 'payload' })]);
            expect(updates).toEqual(['payload']);
        });

        it('stringifies non-string envelope data', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            const received: string[] = [];

            conn.on('tick', msg => received.push(msg.data));
            conn.connect();
            sockets.at(0)?.emitOpen();
            sockets.at(0)?.emitMessage(JSON.stringify({ event: 'tick', data: { value: 42 } }));

            expect(received).toEqual([JSON.stringify({ value: 42 })]);
        });

        it('handles a JSON envelope whose data is null', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            const received: string[] = [];

            conn.on('evt', msg => received.push(msg.data));
            conn.connect();
            sockets.at(0)?.emitOpen();
            sockets.at(0)?.emitMessage(JSON.stringify({ event: 'evt', data: null }));

            expect(received).toEqual(['null']);
        });

        it('does not dispatch to named-event subscribers for non-JSON frames', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            const namedReceived: string[] = [];
            const messageReceived: string[] = [];

            conn.on('update', msg => namedReceived.push(msg.data));
            conn.on('message', msg => messageReceived.push(msg.data));
            conn.connect();
            sockets.at(0)?.emitOpen();
            sockets.at(0)?.emitMessage('not json');

            expect(namedReceived).toEqual([]);
            expect(messageReceived).toEqual(['not json']);
        });

        it('does not dispatch to named-event subscribers for invalid envelope shapes', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            const namedReceived: string[] = [];

            conn.on('update', msg => namedReceived.push(msg.data));
            conn.connect();
            sockets.at(0)?.emitOpen();

            // Missing 'event' field.
            sockets.at(0)?.emitMessage(JSON.stringify({ data: 'something' }));
            // Non-string 'event' field.
            sockets.at(0)?.emitMessage(JSON.stringify({ event: 42, data: 'something' }));
            // Missing 'data' field.
            sockets.at(0)?.emitMessage(JSON.stringify({ event: 'update' }));

            expect(namedReceived).toEqual([]);
        });

        it('delivers envelope "message" event frames only to message subscribers once', () => {
            // An envelope with event='message' should not be double-delivered.
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            const received: string[] = [];

            conn.on('message', msg => received.push(msg.data));
            conn.connect();
            sockets.at(0)?.emitOpen();
            sockets.at(0)?.emitMessage(JSON.stringify({ event: 'message', data: 'hi' }));

            // Delivered once via the raw-frame path; not a second time from the envelope path.
            expect(received).toHaveLength(1);
        });

        it('does not deliver messages when no handlers are registered for the event', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            conn.connect();
            sockets.at(0)?.emitOpen();

            // No handler registered — must not throw.
            expect(() => sockets.at(0)?.emitMessage('hello')).not.toThrow();
        });

        describe('unsubscribe', () => {
            it('stops delivery after unsubscribe is called', () => {
                const { sockets, factory } = makeFactory();
                const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

                const received: string[] = [];
                const unsub = conn.on('message', msg => received.push(msg.data));

                conn.connect();
                sockets.at(0)?.emitOpen();
                sockets.at(0)?.emitMessage('first');
                unsub();
                sockets.at(0)?.emitMessage('second');

                expect(received).toEqual(['first']);
            });

            it('does not affect other handlers for the same event', () => {
                const { sockets, factory } = makeFactory();
                const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

                const a: string[] = [];
                const b: string[] = [];
                const unsubA = conn.on('message', msg => a.push(msg.data));

                conn.on('message', msg => b.push(msg.data));
                conn.connect();
                sockets.at(0)?.emitOpen();
                sockets.at(0)?.emitMessage('1');
                unsubA();
                sockets.at(0)?.emitMessage('2');

                expect(a).toEqual(['1']);
                expect(b).toEqual(['1', '2']);
            });
        });
    });

    describe('send()', () => {
        it('sends data over the open socket', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            conn.connect();
            sockets.at(0)?.emitOpen();
            conn.send('hello');

            const socket = sockets.at(0);

            expect(socket).toBeDefined();
            expect(socket?.sentMessages).toEqual(['hello']);
        });

        it('throws when the socket is not open (idle)', () => {
            const { factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            expect(() => conn.send('msg')).toThrow('Cannot send: WebSocket is not open.');
        });

        it('throws when the socket is connecting', () => {
            const { factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            conn.connect();

            expect(() => conn.send('msg')).toThrow('Cannot send: WebSocket is not open.');
        });

        it('throws when the socket is closed', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            conn.connect();
            sockets.at(0)?.emitOpen();
            conn.disconnect();

            expect(() => conn.send('msg')).toThrow('Cannot send: WebSocket is not open.');
        });
    });

    describe('onStateChange()', () => {
        it('notifies on state transitions', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

            const states: string[] = [];

            conn.onStateChange(s => states.push(s));
            conn.connect();
            sockets.at(0)?.emitOpen();
            conn.disconnect();

            expect(states).toEqual(['connecting', 'open', 'closed']);
        });

        it('does not emit duplicate states', () => {
            const { sockets, factory } = makeFactory();
            const conn = new WebSocketConnection({
                url: 'ws://test',
                backoff: fixedBackoff(50),
                webSocketFactory: factory,
            });

            const states: string[] = [];

            conn.onStateChange(s => states.push(s));
            conn.connect();
            // Close → reconnect pending → already 'connecting', should not re-emit.
            sockets.at(0)?.emitClose();

            expect(states).toEqual(['connecting']);
        });

        describe('unsubscribe', () => {
            it('stops state notifications after unsubscribe', () => {
                const { sockets, factory } = makeFactory();
                const conn = new WebSocketConnection({ url: 'ws://test', webSocketFactory: factory });

                const states: string[] = [];
                const unsub = conn.onStateChange(s => states.push(s));

                conn.connect();
                unsub();
                sockets.at(0)?.emitOpen();

                expect(states).toEqual(['connecting']);
            });
        });
    });
});
