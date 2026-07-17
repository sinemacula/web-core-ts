/**
 * Unit tests for the useResource composable.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';
import { effectScope, getCurrentScope, ref } from 'vue';

import type { ResourceFetcher } from './use-resource';
import { useResource } from './use-resource';

// ---------------------------------------------------------------------------
// Helper: a promise a test can resolve or reject on demand
// ---------------------------------------------------------------------------
interface Deferred<Value> {
    readonly promise: Promise<Value>;
    readonly resolve: (value: Value) => void;
    readonly reject: (reason: unknown) => void;
}

/** Creates a deferred promise so tests can control resolution timing. */
function createDeferred<Value>(): Deferred<Value> {
    let resolve!: (value: Value) => void;
    let reject!: (reason: unknown) => void;

    const promise = new Promise<Value>((resolveValue, rejectValue) => {
        resolve = resolveValue;
        reject = rejectValue;
    });

    return { promise, resolve, reject };
}

// ---------------------------------------------------------------------------
// Helper: a fetcher that records every call so a test can drive each run
// ---------------------------------------------------------------------------
interface FetcherCall<Value> {
    readonly signal: AbortSignal;
    readonly deferred: Deferred<Value>;
}

/** Creates a `ResourceFetcher` that queues a controllable deferred per call. */
function createFetcherQueue<Value>(): {
    readonly fetcher: ResourceFetcher<Value>;
    readonly calls: FetcherCall<Value>[];
} {
    const calls: FetcherCall<Value>[] = [];

    const fetcher: ResourceFetcher<Value> = signal => {
        const deferred = createDeferred<Value>();

        calls.push({ signal, deferred });

        return deferred.promise;
    };

    return { fetcher, calls };
}

/** Flushes both the microtask queue and Vue's scheduler queue. */
async function flushAll(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 0));
}

describe('useResource', () => {
    // -------------------------------------------------------------------------
    // Initial fetch
    // -------------------------------------------------------------------------
    describe('initial fetch', () => {
        it('fetches immediately on creation by default', () => {
            const { fetcher, calls } = createFetcherQueue<number>();
            const resource = useResource({ fetcher });

            expect(calls).toHaveLength(1);
            expect(resource.isLoading.value).toBe(true);
        });

        it('resolves into data and flips isLoading back to false', async () => {
            const { fetcher, calls } = createFetcherQueue<number>();
            const resource = useResource({ fetcher });

            calls.at(0)?.deferred.resolve(42);
            await flushAll();

            expect(resource.data.value).toBe(42);
            expect(resource.isLoading.value).toBe(false);
        });

        it('starts with null data and no error', () => {
            const { fetcher } = createFetcherQueue<number>();
            const resource = useResource({ fetcher });

            expect(resource.data.value).toBeNull();
            expect(resource.error.value).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // immediate: false
    // -------------------------------------------------------------------------
    describe('immediate: false', () => {
        it('does not fetch on creation', () => {
            const { fetcher, calls } = createFetcherQueue<number>();
            const resource = useResource({ fetcher, immediate: false });

            expect(calls).toHaveLength(0);
            expect(resource.isLoading.value).toBe(false);
        });

        it('still fetches once refetch is called', () => {
            const { fetcher, calls } = createFetcherQueue<number>();

            useResource({ fetcher, immediate: false }).refetch();

            expect(calls).toHaveLength(1);
        });
    });

    // -------------------------------------------------------------------------
    // Watch-triggered refetch
    // -------------------------------------------------------------------------
    describe('watch-triggered refetch', () => {
        it('refetches when the watch source changes, keeping stale data while loading', async () => {
            const { fetcher, calls } = createFetcherQueue<number>();
            const source = ref('a');
            const resource = useResource({ fetcher, watch: source });

            calls.at(0)?.deferred.resolve(1);
            await flushAll();

            expect(resource.data.value).toBe(1);

            source.value = 'b';
            await flushAll();

            expect(calls).toHaveLength(2);
            expect(resource.data.value).toBe(1);
            expect(resource.isLoading.value).toBe(true);

            calls.at(1)?.deferred.resolve(2);
            await flushAll();

            expect(resource.data.value).toBe(2);
        });

        it('accepts an array of watch sources', async () => {
            const { fetcher, calls } = createFetcherQueue<number>();
            const first = ref(1);
            const second = ref(1);

            useResource({ fetcher, watch: [first, second] });

            calls.at(0)?.deferred.resolve(1);
            await flushAll();

            second.value = 2;
            await flushAll();

            expect(calls).toHaveLength(2);
        });
    });

    // -------------------------------------------------------------------------
    // Supersede: an older run resolving or rejecting late is discarded
    // -------------------------------------------------------------------------
    describe('supersede', () => {
        it('a late-resolving superseded run does not overwrite data or flip isLoading', async () => {
            const { fetcher, calls } = createFetcherQueue<number>();
            const resource = useResource({ fetcher, immediate: false });

            const firstRun = resource.refetch();
            const secondRun = resource.refetch();

            expect(calls).toHaveLength(2);
            expect(calls.at(0)?.signal.aborted).toBe(true);

            calls.at(1)?.deferred.resolve(200);
            await secondRun;

            expect(resource.data.value).toBe(200);
            expect(resource.isLoading.value).toBe(false);

            calls.at(0)?.deferred.resolve(100);
            await flushAll();

            expect(resource.data.value).toBe(200);
            expect(resource.isLoading.value).toBe(false);

            await firstRun;
        });

        it('a late-rejecting superseded run is discarded and does not set error', async () => {
            const { fetcher, calls } = createFetcherQueue<number>();
            const resource = useResource({ fetcher, immediate: false });

            const firstRun = resource.refetch();
            const secondRun = resource.refetch();

            calls.at(1)?.deferred.resolve(50);
            await secondRun;

            expect(resource.error.value).toBeNull();

            calls.at(0)?.deferred.reject(new Error('late failure'));
            await flushAll();

            expect(resource.error.value).toBeNull();
            expect(resource.data.value).toBe(50);

            await firstRun;
        });
    });

    // -------------------------------------------------------------------------
    // Abort swallowed: a rejection from the run's own aborted signal
    // -------------------------------------------------------------------------
    describe('abort swallowed', () => {
        it('leaves error null when the current run rejects because its own signal was aborted', async () => {
            const { fetcher, calls } = createFetcherQueue<number>();
            const resource = useResource({ fetcher });

            resource.stop();

            expect(calls.at(0)?.signal.aborted).toBe(true);

            calls.at(0)?.deferred.reject(new DOMException('aborted', 'AbortError'));
            await flushAll();

            expect(resource.error.value).toBeNull();
            expect(resource.isLoading.value).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // Error handling
    // -------------------------------------------------------------------------
    describe('error handling', () => {
        it('captures a genuine rejection as error', async () => {
            const { fetcher, calls } = createFetcherQueue<number>();
            const resource = useResource({ fetcher });
            const failure = new Error('boom');

            calls.at(0)?.deferred.reject(failure);
            await flushAll();

            expect(resource.error.value).toBe(failure);
            expect(resource.isLoading.value).toBe(false);
        });

        it('clears the error synchronously at the start of the next run', async () => {
            const { fetcher, calls } = createFetcherQueue<number>();
            const resource = useResource({ fetcher, immediate: false });

            const firstRun = resource.refetch();

            calls.at(0)?.deferred.reject(new Error('boom'));
            await firstRun;

            expect(resource.error.value).toBeInstanceOf(Error);

            const secondRun = resource.refetch();

            expect(resource.error.value).toBeNull();

            calls.at(1)?.deferred.resolve(1);
            await secondRun;
        });

        it('keeps the previous data when a reload fails (stale-while-revalidate)', async () => {
            const { fetcher, calls } = createFetcherQueue<number>();
            const resource = useResource({ fetcher, immediate: false });

            const firstRun = resource.refetch();

            calls.at(0)?.deferred.resolve(10);
            await firstRun;

            expect(resource.data.value).toBe(10);

            const secondRun = resource.refetch();

            calls.at(1)?.deferred.reject(new Error('boom'));
            await secondRun;

            expect(resource.data.value).toBe(10);
            expect(resource.error.value).toBeInstanceOf(Error);
        });
    });

    // -------------------------------------------------------------------------
    // hasLoaded transitions
    // -------------------------------------------------------------------------
    describe('hasLoaded', () => {
        it('is false before any run has resolved', () => {
            const { fetcher } = createFetcherQueue<number>();
            const resource = useResource({ fetcher, immediate: false });

            expect(resource.hasLoaded.value).toBe(false);
        });

        it('becomes true after the first successful resolution', async () => {
            const { fetcher, calls } = createFetcherQueue<number>();
            const resource = useResource({ fetcher });

            calls.at(0)?.deferred.resolve(1);
            await flushAll();

            expect(resource.hasLoaded.value).toBe(true);
        });

        it('remains true after a later run fails', async () => {
            const { fetcher, calls } = createFetcherQueue<number>();
            const resource = useResource({ fetcher });

            calls.at(0)?.deferred.resolve(1);
            await flushAll();

            const nextRun = resource.refetch();

            calls.at(1)?.deferred.reject(new Error('boom'));
            await nextRun;

            expect(resource.hasLoaded.value).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // refetch
    // -------------------------------------------------------------------------
    describe('refetch', () => {
        it('runs the fetcher again and awaits its own settlement', async () => {
            const { fetcher, calls } = createFetcherQueue<number>();
            const resource = useResource({ fetcher, immediate: false });

            const promise = resource.refetch();

            expect(calls).toHaveLength(1);
            expect(resource.isLoading.value).toBe(true);

            calls.at(0)?.deferred.resolve(5);
            await promise;

            expect(resource.data.value).toBe(5);
            expect(resource.isLoading.value).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // stop
    // -------------------------------------------------------------------------
    describe('stop', () => {
        it('aborts the in-flight run and stops further watch reactions', async () => {
            const { fetcher, calls } = createFetcherQueue<number>();
            const source = ref(1);
            const resource = useResource({ fetcher, watch: source });

            resource.stop();

            expect(calls.at(0)?.signal.aborted).toBe(true);

            source.value = 2;
            await flushAll();

            expect(calls).toHaveLength(1);
        });

        it('is a no-op abort when called before any run has started', () => {
            const { fetcher } = createFetcherQueue<number>();
            const resource = useResource({ fetcher, immediate: false });

            expect(() => resource.stop()).not.toThrow();
        });
    });

    // -------------------------------------------------------------------------
    // Scope-dispose cleanup
    // -------------------------------------------------------------------------
    describe('scope-dispose cleanup', () => {
        it('stops automatically when the enclosing effect scope is disposed', async () => {
            const { fetcher, calls } = createFetcherQueue<number>();
            const source = ref(1);
            const scope = effectScope();

            const resource = scope.run(() => useResource({ fetcher, watch: source }));

            expect(resource).toBeDefined();
            expect(calls).toHaveLength(1);

            scope.stop();

            expect(calls.at(0)?.signal.aborted).toBe(true);

            source.value = 2;
            await flushAll();

            expect(calls).toHaveLength(1);
        });

        it('works when created outside any effect scope', async () => {
            expect(getCurrentScope()).toBeUndefined();

            const { fetcher, calls } = createFetcherQueue<number>();
            const resource = useResource({ fetcher });

            calls.at(0)?.deferred.resolve(7);
            await flushAll();

            expect(resource.data.value).toBe(7);
        });
    });
});
