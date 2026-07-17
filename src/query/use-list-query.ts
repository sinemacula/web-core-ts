/**
 * Screen-facing list-query composable.
 *
 * `useListQuery` is the primary UI surface for resource lists. It accepts plain
 * values - "set the status filter to 'active'", "search for 'Alice'", "sort by
 * name descending" - and encapsulates all wire-protocol knowledge in the
 * {@link ListQueryDefinition} declared once by the module author.
 *
 * Compile order (applied on every reactive recomputation):
 * 1. `ApiQuery.create()`
 * 2. `definition.base` (always-applied shaping)
 * 3. Each set filter, in insertion order
 * 4. Active search term (when non-empty)
 * 5. Active sort (explicit, then `defaultSort`, then none)
 * 6. `limit(pageSize ?? 25)` and `page(currentPage)`
 * 7. Each registered refinement, in call order
 *
 * Changing any filter, the search term, or the active sort resets the page to 1
 * - standard list UX so stale page offsets are never sent to the server.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { ComputedRef, Ref } from 'vue';
import { computed, ref } from 'vue';

import type { QueryParameters } from '../http/http-client';
import { ApiQuery } from './api-query';
import type { ListFilter } from './list-filter';
import type { FilterValueOf, ListQueryDefinition, SortDefault } from './list-query-definition';
import { QueryError } from './query-error';

/** Default page size when the definition does not specify one. */
const DEFAULT_PAGE_SIZE = 25;

/** Minimum valid page number. */
const MIN_PAGE = 1;

/**
 * The reactive list-query state returned by {@link useListQuery}.
 *
 * Screen developers use the read-only computed refs to drive their UI (e.g.
 * bind `parameters` to a data-fetching watcher) and call the mutating methods
 * to respond to user interactions.
 *
 * @typeParam Filters - the named-filter record from the definition; drives the
 * key- and value-typing of {@link setFilter} and {@link clearFilter}
 */
export interface ListQuery<Filters extends Record<string, ListFilter<never>>> {
    /**
     * The compiled `ApiQuery` instance, recomputed whenever any reactive state
     * changes.
     */
    readonly query: ComputedRef<ApiQuery>;

    /**
     * The flat query-parameter record derived from {@link query}, ready to pass
     * to an `HttpClient` method.
     */
    readonly parameters: ComputedRef<QueryParameters>;

    /**
     * Snapshot of the currently active filter values, keyed by filter name.
     * `null` entries are not stored; cleared filters are absent from the
     * record.
     */
    readonly filterValues: ComputedRef<Readonly<Partial<Record<keyof Filters & string, unknown>>>>;

    /**
     * The current free-text search term (empty string when no search is
     * active).
     */
    readonly searchTerm: ComputedRef<string>;

    /**
     * The active sort, or `null` when neither an explicit sort nor a
     * `defaultSort` is set.
     */
    readonly sort: ComputedRef<SortDefault | null>;

    /** The current 1-based page number. */
    readonly page: ComputedRef<number>;

    /**
     * Set a named filter to a concrete value.
     *
     * Passing `null` is equivalent to calling {@link clearFilter} - the filter
     * is removed from the active set and the page resets to 1.
     *
     * @param name - the filter name declared in the definition
     * @param value - the filter value, or `null` to clear
     */
    setFilter<K extends keyof Filters & string>(name: K, value: FilterValueOf<Filters[K]> | null): void;

    /**
     * Clear a single named filter. Resets the page to 1.
     *
     * @param name - the filter name to clear
     */
    clearFilter(name: keyof Filters & string): void;

    /** Clear all active filters. Resets the page to 1. */
    clearFilters(): void;

    /**
     * Set the free-text search term. An empty string clears the search. Resets
     * the page to 1.
     *
     * @param term - the search term
     */
    search(term: string): void;

    /**
     * Set the active sort column and direction.
     *
     * - If `column` is not in `definition.sortable`, throws an `Error` naming
     *   the column and the allowed list. When `sortable` is `undefined`, all
     *   columns are accepted.
     * - Calling with a different column, or with an explicit `direction`, sets
     *   that sort directly.
     * - Calling with the same column and no explicit `direction` toggles the
     *   direction between `'asc'` and `'desc'`.
     * - Resets the page to 1.
     *
     * @param column - the column to sort by
     * @param direction - optional explicit direction; omit to toggle when the
     * column is already active
     * @throws {Error} when `column` is not in `sortable`
     */
    sortBy(column: string, direction?: 'asc' | 'desc'): void;

    /** Advance to the next page. Does not touch filters or sort. */
    next(): void;

    /**
     * Go to the previous page, clamped at page 1. Does not touch filters or
     * sort.
     */
    previous(): void;

    /**
     * Jump to an arbitrary page, clamped at page 1. Does not touch filters or
     * sort.
     *
     * @param page - the target 1-based page number
     */
    goTo(page: number): void;

    /**
     * Register a persistent advanced refinement. Refinements are applied after
     * all standard query steps, in the order they are registered. A new call
     * appends to the existing list; earlier refinements are preserved.
     *
     * @param mutate - a function that receives the partially-built query and
     * returns the refined query
     */
    refine(mutate: (query: ApiQuery) => ApiQuery): void;

    /**
     * Reset everything - filters, search, sort, page, and refinements - back to
     * the definition's defaults.
     */
    reset(): void;
}

/**
 * Create reactive list-query state from a {@link ListQueryDefinition}.
 *
 * @param definition - the frozen definition produced by {@link defineListQuery}
 * @returns the reactive {@link ListQuery} state and control methods
 * @typeParam Filters - inferred from the definition; drives typed `setFilter`
 */
export function useListQuery<Filters extends Record<string, ListFilter<never>>>(
    definition: ListQueryDefinition<Filters>,
): ListQuery<Filters> {
    /**
     * Active filter entries in insertion order.
     *
     * Each entry pairs the screen-vocabulary name (for `filterValues`) with the
     * typed {@link ListFilter} instance and the concrete value. Storing the
     * instance here avoids a definition lookup at compile time, eliminating a
     * structurally-unreachable guard branch.
     */
    const activeFilters = ref<Map<string, { filter: ListFilter<unknown>; value: unknown }>>(new Map());
    const activeSearch = ref('');
    const activeSort = ref<SortDefault | null>(null);
    const currentPage = ref(MIN_PAGE);
    const refinements = ref<Array<(query: ApiQuery) => ApiQuery>>([]);

    const state: ListQueryState = { activeFilters, activeSearch, activeSort, currentPage, refinements };

    const query = computed<ApiQuery>(() => compileQuery(definition, state));
    const parameters = computed<QueryParameters>(() => query.value.toQueryParameters());
    const filterValues = computed<Readonly<Partial<Record<keyof Filters & string, unknown>>>>(() =>
        deriveFilterValues<Filters>(activeFilters.value),
    );
    const searchTerm = computed<string>(() => activeSearch.value);
    const sort = computed<SortDefault | null>(() => activeSort.value);
    const page = computed<number>(() => currentPage.value);

    return {
        query,
        parameters,
        filterValues,
        searchTerm,
        sort,
        page,
        ...createFilterMutations(definition, state),
        ...createNavigationMutations(definition, state),
    };
}

/**
 * The mutable reactive state a {@link useListQuery} instance compiles and
 * mutates.
 */
interface ListQueryState {
    readonly activeFilters: Ref<Map<string, { filter: ListFilter<unknown>; value: unknown }>>;
    readonly activeSearch: Ref<string>;
    readonly activeSort: Ref<SortDefault | null>;
    readonly currentPage: Ref<number>;
    readonly refinements: Ref<Array<(query: ApiQuery) => ApiQuery>>;
}

/**
 * The filter-set and search controls of the {@link ListQuery} contract.
 *
 * @typeParam Filters - the named-filter record from the definition
 */
type FilterMutations<Filters extends Record<string, ListFilter<never>>> = Pick<
    ListQuery<Filters>,
    'setFilter' | 'clearFilter' | 'clearFilters' | 'search'
>;

/**
 * The sort, pagination, refinement, and reset controls of the {@link ListQuery}
 * contract.
 *
 * @typeParam Filters - the named-filter record from the definition
 */
type NavigationMutations<Filters extends Record<string, ListFilter<never>>> = Pick<
    ListQuery<Filters>,
    'sortBy' | 'next' | 'previous' | 'goTo' | 'refine' | 'reset'
>;

/**
 * Compile an {@link ApiQuery} from the current list-query state.
 *
 * Applies, in order, the definition's base shaping, each active filter in
 * insertion order, the active search term, the resolved sort, pagination, and
 * every registered refinement.
 *
 * @param definition - the frozen definition produced by {@link defineListQuery}
 * @param state - the reactive state to read the current values from
 * @returns the query compiled for the current state
 * @typeParam Filters - the named-filter record from the definition
 */
function compileQuery<Filters extends Record<string, ListFilter<never>>>(
    definition: ListQueryDefinition<Filters>,
    state: ListQueryState,
): ApiQuery {
    let q = ApiQuery.create();

    // 1. Base shaping
    if (definition.base) {
        q = definition.base(q);
    }

    // 2. Active filters (insertion order)
    for (const entry of state.activeFilters.value.values()) {
        q = entry.filter.apply(q, entry.value);
    }

    // 3. Search term
    const { search: searchFilter } = definition;

    if (state.activeSearch.value !== '' && searchFilter !== undefined) {
        q = searchFilter.apply(q, state.activeSearch.value);
    }

    // 4. Sort (explicit → defaultSort → none)
    const sort = state.activeSort.value ?? definition.defaultSort ?? null;

    if (sort !== null) {
        q = q.orderBy(sort.column, sort.direction);
    }

    // 5. Pagination
    q = q.limit(definition.pageSize ?? DEFAULT_PAGE_SIZE).page(state.currentPage.value);

    // 6. Refinements
    for (const refineFn of state.refinements.value) {
        q = refineFn(q);
    }

    return q;
}

/**
 * Snapshot the active filter values as a plain record keyed by filter name.
 *
 * @param activeFilters - the active filter entries in insertion order
 * @returns the active values keyed by filter name; cleared filters are absent
 */
function deriveFilterValues<Filters extends Record<string, ListFilter<never>>>(
    activeFilters: Map<string, { filter: ListFilter<unknown>; value: unknown }>,
): Readonly<Partial<Record<keyof Filters & string, unknown>>> {
    const result: Partial<Record<string, unknown>> = {};

    for (const [key, entry] of activeFilters) {
        result[key] = entry.value;
    }

    return result as Readonly<Partial<Record<keyof Filters & string, unknown>>>;
}

/**
 * Build the filter-set and search controls for a {@link useListQuery} instance.
 *
 * Every control resets the page to 1 so a stale offset is never sent after the
 * result set changes shape.
 *
 * @param definition - the frozen definition produced by {@link defineListQuery}
 * @param state - the reactive state the controls mutate
 * @returns the filter-set and search half of the {@link ListQuery} contract
 * @typeParam Filters - the named-filter record from the definition
 */
function createFilterMutations<Filters extends Record<string, ListFilter<never>>>(
    definition: ListQueryDefinition<Filters>,
    state: ListQueryState,
): FilterMutations<Filters> {
    /**
     * Set a named filter to a concrete value, or clear it when `value` is null.
     *
     * @param name - the filter name declared in the definition
     * @param value - the filter value, or `null` to clear
     */
    function setFilter<K extends keyof Filters & string>(name: K, value: FilterValueOf<Filters[K]> | null): void {
        if (value === null) {
            clearFilter(name);

            return;
        }

        const filterDef: ListFilter<unknown> | undefined = (definition.filters as Record<string, ListFilter<unknown>>)[
            name
        ];

        if (filterDef === undefined) {
            return;
        }

        const next = new Map(state.activeFilters.value);

        next.set(name, { filter: filterDef, value });
        state.activeFilters.value = next;
        state.currentPage.value = MIN_PAGE;
    }

    /**
     * Remove a single named filter from the active set.
     *
     * @param name - the filter name to clear
     */
    function clearFilter(name: keyof Filters & string): void {
        if (!state.activeFilters.value.has(name)) {
            return;
        }

        const next = new Map(state.activeFilters.value);

        next.delete(name);
        state.activeFilters.value = next;
        state.currentPage.value = MIN_PAGE;
    }

    /**
     * Remove every active filter.
     */
    function clearFilters(): void {
        if (state.activeFilters.value.size === 0) {
            return;
        }

        state.activeFilters.value = new Map();
        state.currentPage.value = MIN_PAGE;
    }

    /**
     * Set the free-text search term; an empty string clears the search.
     *
     * @param term - the search term
     */
    function search(term: string): void {
        state.activeSearch.value = term;
        state.currentPage.value = MIN_PAGE;
    }

    return { setFilter, clearFilter, clearFilters, search };
}

/**
 * Build the sort, pagination, refinement, and reset controls for a
 * {@link useListQuery} instance.
 *
 * @param definition - the frozen definition produced by {@link defineListQuery}
 * @param state - the reactive state the controls mutate
 * @returns the sort, pagination, refinement, and reset half of the
 * {@link ListQuery} contract
 * @typeParam Filters - the named-filter record from the definition
 */
function createNavigationMutations<Filters extends Record<string, ListFilter<never>>>(
    definition: ListQueryDefinition<Filters>,
    state: ListQueryState,
): NavigationMutations<Filters> {
    /**
     * Set or toggle the active sort, rejecting columns outside `sortable`.
     *
     * @param column - the column to sort by
     * @param direction - explicit direction; omit to toggle an already-active
     * column
     * @throws {@link QueryError} when `column` is not in `sortable`
     */
    function sortBy(column: string, direction?: 'asc' | 'desc'): void {
        const { sortable } = definition;

        if (sortable !== undefined && !sortable.includes(column)) {
            throw new QueryError(
                `Cannot sort by '${column}'. Allowed columns: ${sortable.map(c => `'${c}'`).join(', ')}.`,
            );
        }

        let resolvedDirection: 'asc' | 'desc';

        if (direction !== undefined) {
            resolvedDirection = direction;
        } else if (state.activeSort.value?.column === column) {
            resolvedDirection = state.activeSort.value.direction === 'asc' ? 'desc' : 'asc';
        } else {
            resolvedDirection = 'asc';
        }

        state.activeSort.value = { column, direction: resolvedDirection };
        state.currentPage.value = MIN_PAGE;
    }

    /**
     * Advance to the next page.
     */
    function next(): void {
        state.currentPage.value += 1;
    }

    /**
     * Step back one page, clamped at page 1.
     */
    function previous(): void {
        state.currentPage.value = Math.max(MIN_PAGE, state.currentPage.value - 1);
    }

    /**
     * Jump to an arbitrary page, clamped at page 1.
     *
     * @param targetPage - the target 1-based page number
     */
    function goTo(targetPage: number): void {
        state.currentPage.value = Math.max(MIN_PAGE, targetPage);
    }

    /**
     * Append a persistent refinement applied after all standard query steps.
     *
     * @param mutate - receives the partially-built query and returns the
     * refined query
     */
    function refine(mutate: (query: ApiQuery) => ApiQuery): void {
        state.refinements.value = [...state.refinements.value, mutate];
    }

    /**
     * Reset filters, search, sort, page, and refinements to the definition's
     * defaults.
     */
    function reset(): void {
        state.activeFilters.value = new Map();
        state.activeSearch.value = '';
        state.activeSort.value = null;
        state.currentPage.value = MIN_PAGE;
        state.refinements.value = [];
    }

    return { sortBy, next, previous, goTo, refine, reset };
}
