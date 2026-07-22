/**
 * Reactive composable wrapping an `ApiQuery` instance.
 *
 * `useApiQuery` is the UI seam between filter/sort components and the query
 * layer. Components call `apply` to derive a new query state; the `parameters`
 * computed ref re-evaluates automatically and can be fed directly into a data-
 * fetching composable or watcher.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { ComputedRef } from 'vue';
import { computed, shallowRef } from 'vue';

import type { QueryParameters } from '@sinemacula/foundation/http/http-client';
import { ApiQuery } from './api-query';

/**
 * Options accepted by {@link useApiQuery}.
 */
export interface UseApiQueryOptions {
    /** An optional builder that seeds the initial query state. */
    readonly initial?: (query: ApiQuery) => ApiQuery;
}

/**
 * The reactive query state returned by {@link useApiQuery}.
 */
export interface ApiQueryState {
    /** The current `ApiQuery` instance, updated on every `apply` or `reset`. */
    readonly query: ComputedRef<ApiQuery>;

    /** The current `QueryParameters`, recomputed whenever `query` changes. */
    readonly parameters: ComputedRef<QueryParameters>;

    /**
     * Replace the held query by applying `mutate` to it.
     *
     * @param mutate - receives the current query and returns the new query
     */
    apply(mutate: (query: ApiQuery) => ApiQuery): void;

    /**
     * Reset the query back to the initial state.
     */
    reset(): void;
}

/**
 * Create reactive query state for a single API endpoint.
 *
 * @param options - optional seed builder for the initial query
 * @returns the reactive query state and control methods
 */
export function useApiQuery(options?: UseApiQueryOptions): ApiQueryState {
    const initial = options?.initial ? options.initial(ApiQuery.create()) : ApiQuery.create();
    const current = shallowRef<ApiQuery>(initial);

    const query = computed(() => current.value);
    const parameters = computed(() => current.value.toQueryParameters());

    /**
     * Replace the current query with the result of applying `mutate` to it.
     *
     * @param mutate - transforms the current query into the next one
     */
    function apply(mutate: (query: ApiQuery) => ApiQuery): void {
        current.value = mutate(current.value);
    }

    /** Restore the query to the seed state captured at creation. */
    function reset(): void {
        current.value = initial;
    }

    return { query, parameters, apply, reset };
}
