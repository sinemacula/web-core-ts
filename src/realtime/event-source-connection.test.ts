/**
 * Unit tests for event-source-connection.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventSourceConnection, type EventSourceFactory } from './event-source-connection';
import { describeRealtimeContract, type RealtimeContractHarness } from './test-support/realtime-connection-contract';

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

/** Adapts the SSE adapter and its fake to the shared realtime contract. */
function makeSseContractHarness(): RealtimeContractHarness {
    return {
        create(options) {
            const { sources, factory } = makeFactory();
            const connection = new EventSourceConnection({ ...options, eventSourceFactory: factory });

            return {
                connection,
                transports: {
                    get length() {
                        return sources.length;
                    },
                    at(index) {
                        const source = sources.at(index);

                        if (source === undefined) {
                            return undefined;
                        }

                        return {
                            get url() {
                                return source.url;
                            },
                            get closeCalls() {
                                return source.closeCalls;
                            },
                            open: () => source.emitOpen(),
                            fail: () => source.emitError(),
                            message: (event, data) => source.emitMessage(event, data),
                        };
                    },
                },
            };
        },
    };
}

describeRealtimeContract(makeSseContractHarness());

describe('EventSourceConnection', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('connect()', () => {
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

        it('exercises the default EventSource factory when no factory is injected', () => {
            // happy-dom does not ship an EventSource stub, so we install a
            // minimal constructible shim on globalThis to exercise the default
            // factory path.
            const globals = globalThis as Record<string, unknown>;
            const OriginalEventSource = globals['EventSource'];

            class FakeEventSourceShim extends FakeEventSource {}

            globals['EventSource'] = FakeEventSourceShim;

            try {
                const conn = new EventSourceConnection({ url: 'http://localhost/sse' });

                expect(() => conn.connect()).not.toThrow();
            } finally {
                globals['EventSource'] = OriginalEventSource;
            }
        });
    });

    describe('on()', () => {
        it('coerces data to a string', () => {
            const { sources, factory } = makeFactory();
            const conn = new EventSourceConnection({ url: 'http://sse', eventSourceFactory: factory });

            const received: string[] = [];

            conn.on('tick', msg => received.push(msg.data));
            conn.connect();
            sources.at(0)?.emitMessage('tick', 42);

            expect(received).toEqual(['42']);
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
    });
});
