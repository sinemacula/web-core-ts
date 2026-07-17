/**
 * Request-state composable - the execution half of the query layer.
 *
 * `useResource` runs a {@link ResourceFetcher} and exposes its loading, error,
 * and data lifecycle as reactive state. Screens compose it with a
 * `useListQuery` `parameters` computed ref (via `watch`) and a `ResourceClient`
 * method as the fetcher; `useListQuery` decides *what* to ask for, and this
 * composable owns *when* to run, when to abort a stale run, and what the latest
 * settled state looks like.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { ComputedRef, Ref, WatchSource } from 'vue';
import { computed, getCurrentScope, onScopeDispose, ref, watch } from 'vue';

/**
 * Executes a single run of a request, given the `AbortSignal` for that run.
 *
 * Fetchers that forward the signal to their transport (e.g. `HttpClient`'s
 * `signal` option) let {@link useResource} cancel superseded or stopped runs at
 * the network layer.
 *
 * @typeParam Value - the resolved value type
 */
export type ResourceFetcher<Value> = (signal: AbortSignal) => Promise<Value>;

/**
 * Options accepted by {@link useResource}.
 *
 * @typeParam Value - the resolved value type
 */
export interface UseResourceOptions<Value> {
    /** Executes a single run of the request. */
    readonly fetcher: ResourceFetcher<Value>;

    /**
     * One or more reactive sources that trigger a refetch when they change,
     * e.g. a `useListQuery` `parameters` computed ref.
     */
    readonly watch?: WatchSource<unknown> | ReadonlyArray<WatchSource<unknown>>;

    /**
     * Whether to run the fetcher immediately on creation.
     *
     * @defaultValue true
     */
    readonly immediate?: boolean;
}

/**
 * The reactive request-state returned by {@link useResource}.
 *
 * @typeParam Value - the resolved value type
 */
export interface Resource<Value> {
    /** The most recently resolved value, or `null` before the first success. */
    readonly data: Ref<Value | null>;

    /**
     * Whatever the fetcher threw on its most recent run, or `null` when none.
     */
    readonly error: Ref<unknown>;

    /** `true` while the latest run is in flight. */
    readonly isLoading: Ref<boolean>;

    /** `true` once a run has resolved successfully at least once. */
    readonly hasLoaded: ComputedRef<boolean>;

    /**
     * Run the fetcher again, superseding any run already in flight.
     *
     * @returns a promise that settles once this run has settled
     */
    refetch(): Promise<void>;

    /** Abort any in-flight run and stop reacting to the watch source(s). */
    stop(): void;
}

/**
 * Execute a {@link ResourceFetcher} and expose its lifecycle as reactive state.
 *
 * Fetches immediately on creation unless `immediate` is `false`, and again
 * whenever `watch` fires. Every run gets its own `AbortController`, which
 * aborts the previous in-flight run; a sequence-token guard discards results
 * and errors from superseded runs regardless of whether the fetcher honours the
 * signal, since the abort alone cannot force a non-cooperative fetcher to stop.
 * `error` resets to `null` at the start of each run, and `data` is left
 * untouched while a reload is in flight so the screen can keep showing the
 * stale value. When a run's own signal turns out to be aborted, its rejection
 * is swallowed - a cancel is not an error.
 *
 * @param options - the fetcher, optional watch source(s), and immediate flag
 * @returns the reactive resource state and control methods
 * @typeParam Value - the resolved value type
 */
export function useResource<Value>(options: UseResourceOptions<Value>): Resource<Value> {
    const { fetcher, watch: watchSource, immediate = true } = options;

    // Vue's `ref` cannot infer `Value | null` from a naked generic parameter;
    // the cast pins the type the `Resource<Value>` contract requires.
    const data = ref(null) as Ref<Value | null>;
    const error = ref<unknown>(null);
    const isLoading = ref(false);
    const resolvedOnce = ref(false);

    const { run, abort } = createRunner(fetcher, { data, error, isLoading, resolvedOnce });

    /**
     * Run the fetcher again, superseding any run already in flight.
     *
     * @returns a promise that settles once this run has settled
     */
    async function refetch(): Promise<void> {
        await run();
    }

    let stopWatch: (() => void) | null = null;

    /**
     * Abort any in-flight run and stop reacting to the watch source(s).
     */
    function stop(): void {
        abort();
        stopWatch?.();
    }

    if (watchSource !== undefined) {
        const sources: ReadonlyArray<WatchSource<unknown>> = Array.isArray(watchSource) ? watchSource : [watchSource];

        stopWatch = watch(sources, () => {
            run();
        });
    }

    if (immediate) {
        run();
    }

    if (getCurrentScope() !== undefined) {
        onScopeDispose(stop);
    }

    return {
        data,
        error,
        isLoading,
        hasLoaded: computed(() => resolvedOnce.value),
        refetch,
        stop,
    };
}

/**
 * The reactive fields a runner settles as a request progresses.
 *
 * @typeParam Value - the resolved value type
 */
interface ResourceState<Value> {
    readonly data: Ref<Value | null>;
    readonly error: Ref<unknown>;
    readonly isLoading: Ref<boolean>;
    readonly resolvedOnce: Ref<boolean>;
}

/**
 * Drive sequential runs of a fetcher, settling `state` for the latest run only.
 *
 * Owns the sequence token and the active `AbortController` so a superseded or
 * stopped run neither settles `state` nor surfaces its rejection. The returned
 * `abort` cancels the in-flight run without starting a new one.
 *
 * @param fetcher - executes a single run given that run's abort signal
 * @param state - the reactive fields settled as each run progresses
 * @returns the run trigger and an abort control for the in-flight run
 * @typeParam Value - the resolved value type
 */
function createRunner<Value>(
    fetcher: ResourceFetcher<Value>,
    state: ResourceState<Value>,
): { run: () => Promise<void>; abort: () => void } {
    let sequence = 0;
    let activeController: AbortController | null = null;

    /**
     * Execute one run, discarding its outcome when a newer run supersedes it.
     *
     * @returns a promise that settles once this run has settled
     */
    async function run(): Promise<void> {
        const token = ++sequence;

        activeController?.abort();

        const controller = new AbortController();

        activeController = controller;
        state.error.value = null;
        state.isLoading.value = true;

        try {
            const result = await fetcher(controller.signal);

            if (token !== sequence) {
                return;
            }

            state.data.value = result;
            state.resolvedOnce.value = true;
        } catch (caught) {
            if (token !== sequence || controller.signal.aborted) {
                return;
            }

            state.error.value = caught;
        } finally {
            if (token === sequence) {
                state.isLoading.value = false;
            }
        }
    }

    /**
     * Abort the in-flight run without starting a new one.
     */
    function abort(): void {
        activeController?.abort();
    }

    return { run, abort };
}
