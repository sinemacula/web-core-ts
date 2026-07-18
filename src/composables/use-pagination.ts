/**
 * Reactive pagination state composable.
 *
 * Encapsulates current page, page count, and navigation helpers. All derived
 * values are computed reactively from the caller-provided total ref so the
 * pagination updates automatically when the data set changes.
 *
 * Clamping note: when `total` shrinks and the current page falls outside the
 * valid range, the consumer is responsible for re-clamping via
 * {@link Pagination.goTo} after reloading data. All navigation helpers ({@link
 * Pagination.next}, {@link Pagination.previous}, and {@link Pagination.goTo})
 * clamp into `[1, pageCount]` on every call.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { ComputedRef, Ref } from 'vue';
import { computed, ref } from 'vue';

/**
 * Options accepted by {@link usePagination}.
 */
export interface UsePaginationOptions {
    /** Reactive total item count the page bounds are derived from. */
    readonly total: Ref<number>;

    /** Items shown per page; defaults to the standard page size. */
    readonly perPage?: number;

    /** Page to start on; defaults to the first page. */
    readonly initialPage?: number;
}

/**
 * The reactive pagination state returned by {@link usePagination}.
 */
export interface Pagination {
    /** The current page, counting from one. */
    readonly page: Ref<number>;

    /** The resolved number of items per page. */
    readonly perPage: number;

    /** The total number of pages, always at least one. */
    readonly pageCount: ComputedRef<number>;

    /** Whether a page exists before the current one. */
    readonly hasPrevious: ComputedRef<boolean>;

    /** Whether a page exists after the current one. */
    readonly hasNext: ComputedRef<boolean>;

    /** The zero-based index of the first item on the current page. */
    readonly offset: ComputedRef<number>;

    /**
     * Advance one page, stopping at the last.
     */
    next(): void;

    /**
     * Step back one page, stopping at the first.
     */
    previous(): void;

    /**
     * Jump to a page, clamped into the valid range.
     *
     * @param page - the requested page number, before clamping
     */
    goTo(page: number): void;
}

const DEFAULT_PER_PAGE = 25;
const DEFAULT_INITIAL_PAGE = 1;

/**
 * Create reactive pagination state for a data set with a known total.
 *
 * @param options - the total item count ref, page size, and initial page
 * @returns the reactive pagination state and navigation helpers
 */
export function usePagination(options: UsePaginationOptions): Pagination {
    const perPage = options.perPage ?? DEFAULT_PER_PAGE;
    const page = ref(options.initialPage ?? DEFAULT_INITIAL_PAGE);

    const pageCount = computed(() => Math.max(1, Math.ceil(options.total.value / perPage)));
    const hasPrevious = computed(() => page.value > 1);
    const hasNext = computed(() => page.value < pageCount.value);
    const offset = computed(() => (page.value - 1) * perPage);

    /**
     * Jump to a page, clamped into the valid `[1, pageCount]` range.
     *
     * @param target - the requested page number, before clamping
     */
    function goTo(target: number): void {
        page.value = Math.min(Math.max(1, target), pageCount.value);
    }

    /**
     * Advance one page, stopping at the last.
     */
    function next(): void {
        goTo(page.value + 1);
    }

    /**
     * Step back one page, stopping at the first.
     */
    function previous(): void {
        goTo(page.value - 1);
    }

    return { page, perPage, pageCount, hasPrevious, hasNext, offset, next, previous, goTo };
}
