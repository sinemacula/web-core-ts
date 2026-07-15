/**
 * Users list screen state - the reference composition of the query layer.
 *
 * This composable is the worked example for building a resource list screen
 * out of the three query-layer primitives, each owning one concern:
 *
 * 1. `useListQuery(userList)` - the screen-facing query builder. Turns plain
 *    values ("search for 'alice'", "sort by full_name") into a compiled
 *    `ApiQuery` and its flat `parameters`, resetting the page whenever a
 *    filter, search term, or sort changes.
 * 2. `createUsersClient(api())` - the typed HTTP gateway. A `ResourceClient`
 *    scoped to the `users` endpoint that unwraps the response envelope and
 *    validates every row through `mapUserRow`.
 * 3. `useResource(...)` - the execution and lifecycle layer. Re-runs the
 *    client's `list` method whenever `list.parameters` changes, aborting a
 *    superseded run and exposing `data`, `error`, `isLoading` and
 *    `hasLoaded` as reactive state.
 *
 * Free-text search is debounced here, not in the view: `searchInput` is the
 * ref the view binds to directly, and every keystroke restarts a 300ms timer
 * before the settled value is committed to the list query via `list.search`.
 * Keeping the timer here (rather than in `users-view.vue`) is what keeps the
 * view a pure template - all behaviour, including timing, lives in this file.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { PaginationMeta } from '@sinemacula/web-core/query/envelope';
import type { SortDefault } from '@sinemacula/web-core/query/list-query-definition';
import { useListQuery } from '@sinemacula/web-core/query/use-list-query';
import { useResource } from '@sinemacula/web-core/query/use-resource';
import type { ComputedRef, Ref } from 'vue';
import { computed, getCurrentScope, onScopeDispose, ref, watch } from 'vue';

import { PlaygroundError } from '@/errors/playground-error';
import { api } from '@/services/api';

import { userList } from '../queries/user-list';
import type { UserListItem } from '../services/users-api';
import { createUsersClient } from '../services/users-api';

/** Debounce window applied to free-text search input, in milliseconds. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Parse the API's wire-format timestamp (`'YYYY-MM-DD HH:MM:SS'`) as a UTC
 * instant, mirroring the auth module's session-expiry parsing. The view uses
 * this to hand a real `Date` to `useI18n().d()` for locale-aware rendering
 * of a row's `createdAt`.
 *
 * @param wireTimestamp - the wire-format timestamp
 * @returns the parsed instant as a `Date`
 * @throws PlaygroundError when the timestamp cannot be parsed
 */
export function parseWireTimestamp(wireTimestamp: string): Date {
    const parsed = Date.parse(`${wireTimestamp.replace(' ', 'T')}Z`);

    if (Number.isNaN(parsed)) {
        throw new PlaygroundError(`The wire timestamp "${wireTimestamp}" could not be parsed.`);
    }

    return new Date(parsed);
}

/**
 * Reactive state and controls for the users list screen.
 */
export interface UsersList {
    /** The current page of mapped user rows. */
    readonly rows: ComputedRef<readonly UserListItem[]>;
    /** Pagination metadata for the current page, or null before the first response. */
    readonly meta: ComputedRef<PaginationMeta | null>;
    /** True while the latest request is in flight. */
    readonly isLoading: Ref<boolean>;
    /** True once a request has resolved successfully at least once. */
    readonly hasLoaded: ComputedRef<boolean>;
    /** Whatever the latest request threw, or null when none. */
    readonly error: Ref<unknown>;
    /** Two-way bound search field value; debounces into the list query. */
    readonly searchInput: Ref<string>;
    /** The search term currently committed to the list query. */
    readonly searchTerm: ComputedRef<string>;
    /**
     * Commit a search term immediately, bypassing the debounce.
     *
     * @param term - the search term
     */
    search(term: string): void;
    /** The active sort, or null when none is set. */
    readonly sort: ComputedRef<SortDefault | null>;
    /**
     * Sort by a column, toggling direction when the column is already active.
     *
     * @param column - the column to sort by
     */
    sortBy(column: string): void;
    /** The current 1-based page number. */
    readonly page: ComputedRef<number>;
    /** Advance to the next page; a no-op once `meta` reports the last page. */
    next(): void;
    /** Go to the previous page, clamped at page 1. */
    previous(): void;
    /** Re-run the current request. */
    refetch(): Promise<void>;
}

/**
 * Build the debounced search input ref.
 *
 * Every change to the returned ref restarts a {@link SEARCH_DEBOUNCE_MS}
 * timer before `commit` is called with the settled value. The pending timer
 * is cleared on scope disposal so a stale commit cannot fire after teardown.
 *
 * @param commit - called with the settled search term once the debounce window elapses
 * @param initial - the initial value of the search input
 * @returns the debounced search input ref
 */
function useSearchDebounce(commit: (term: string) => void, initial: string): Ref<string> {
    const searchInput = ref(initial);
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    watch(searchInput, value => {
        if (debounceTimer !== undefined) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => commit(value), SEARCH_DEBOUNCE_MS);
    });

    if (getCurrentScope() !== undefined) {
        onScopeDispose(() => {
            if (debounceTimer !== undefined) {
                clearTimeout(debounceTimer);
            }
        });
    }

    return searchInput;
}

/**
 * Build a `next()` control guarded against advancing past the last page.
 *
 * @param page - the current 1-based page number
 * @param meta - the latest pagination metadata, or null before the first response
 * @param advance - the underlying page-advance function
 * @returns a `next()` function that is a no-op once `meta` reports the last page
 */
function createGuardedNext(
    page: ComputedRef<number>,
    meta: ComputedRef<PaginationMeta | null>,
    advance: () => void,
): () => void {
    return (): void => {
        const currentMeta = meta.value;

        if (currentMeta !== null && page.value >= currentMeta.lastPage) {
            return;
        }

        advance();
    };
}

/**
 * Build the reactive state and controls for the users list screen.
 *
 * @returns the reactive {@link UsersList} state and control methods
 */
export function useUsersList(): UsersList {
    const list = useListQuery(userList);
    const client = createUsersClient(api());

    const resource = useResource({
        fetcher: signal => client.list(list.query.value, { signal }),
        watch: list.parameters,
    });

    const rows = computed<readonly UserListItem[]>(() => resource.data.value?.items ?? []);
    const meta = computed<PaginationMeta | null>(() => resource.data.value?.meta ?? null);
    const searchInput = useSearchDebounce(list.search, list.searchTerm.value);

    return {
        rows,
        meta,
        isLoading: resource.isLoading,
        hasLoaded: resource.hasLoaded,
        error: resource.error,
        searchInput,
        searchTerm: list.searchTerm,
        search: list.search,
        sort: list.sort,
        sortBy: list.sortBy,
        page: list.page,
        next: createGuardedNext(list.page, meta, list.next),
        previous: list.previous,
        refetch: resource.refetch,
    };
}
