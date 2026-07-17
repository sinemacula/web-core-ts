/**
 * Unit tests for use-pagination.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { usePagination } from './use-pagination';

describe('usePagination', () => {
    describe('defaults', () => {
        it('starts on page 1 when no initialPage is given', () => {
            const { page } = usePagination({ total: ref(100) });

            expect(page.value).toBe(1);
        });

        it('uses 25 as the default perPage', () => {
            const { perPage } = usePagination({ total: ref(100) });

            expect(perPage).toBe(25);
        });

        it('respects a custom initialPage', () => {
            const { page } = usePagination({ total: ref(100), initialPage: 3 });

            expect(page.value).toBe(3);
        });

        it('respects a custom perPage', () => {
            const { perPage } = usePagination({ total: ref(100), perPage: 10 });

            expect(perPage).toBe(10);
        });
    });

    describe('pageCount', () => {
        it('calculates page count as ceil(total / perPage)', () => {
            const { pageCount } = usePagination({ total: ref(100), perPage: 10 });

            expect(pageCount.value).toBe(10);
        });

        it('rounds up for a non-exact division', () => {
            const { pageCount } = usePagination({ total: ref(101), perPage: 10 });

            expect(pageCount.value).toBe(11);
        });

        it('returns 1 when total is 0', () => {
            const { pageCount } = usePagination({ total: ref(0), perPage: 10 });

            expect(pageCount.value).toBe(1);
        });

        it('returns 1 for a single partial page', () => {
            const { pageCount } = usePagination({ total: ref(5), perPage: 10 });

            expect(pageCount.value).toBe(1);
        });

        it('reacts when total changes', () => {
            const total = ref(100);
            const { pageCount } = usePagination({ total, perPage: 10 });

            expect(pageCount.value).toBe(10);

            total.value = 200;

            expect(pageCount.value).toBe(20);
        });
    });

    describe('hasPrevious', () => {
        it('is false on page 1', () => {
            const { hasPrevious } = usePagination({ total: ref(100) });

            expect(hasPrevious.value).toBe(false);
        });

        it('is true on page 2', () => {
            const { hasPrevious } = usePagination({ total: ref(100), initialPage: 2 });

            expect(hasPrevious.value).toBe(true);
        });
    });

    describe('hasNext', () => {
        it('is true when not on the last page', () => {
            const { hasNext } = usePagination({ total: ref(100), perPage: 10 });

            expect(hasNext.value).toBe(true);
        });

        it('is false on the last page', () => {
            const { hasNext } = usePagination({ total: ref(100), perPage: 10, initialPage: 10 });

            expect(hasNext.value).toBe(false);
        });

        it('is false when total is 0 (only page is 1)', () => {
            const { hasNext } = usePagination({ total: ref(0) });

            expect(hasNext.value).toBe(false);
        });
    });

    describe('offset', () => {
        it('is 0 on page 1', () => {
            const { offset } = usePagination({ total: ref(100), perPage: 10 });

            expect(offset.value).toBe(0);
        });

        it('is perPage on page 2', () => {
            const { offset } = usePagination({ total: ref(100), perPage: 10, initialPage: 2 });

            expect(offset.value).toBe(10);
        });

        it('calculates correctly for arbitrary page and perPage', () => {
            const { offset } = usePagination({ total: ref(1000), perPage: 25, initialPage: 5 });

            expect(offset.value).toBe(100);
        });
    });

    describe('next', () => {
        it('advances to the next page', () => {
            const { page, next } = usePagination({ total: ref(100), perPage: 10 });

            next();

            expect(page.value).toBe(2);
        });

        it('clamps at the last page', () => {
            const { page, next } = usePagination({ total: ref(100), perPage: 10, initialPage: 10 });

            next();

            expect(page.value).toBe(10);
        });
    });

    describe('previous', () => {
        it('moves back to the previous page', () => {
            const { page, previous } = usePagination({ total: ref(100), perPage: 10, initialPage: 3 });

            previous();

            expect(page.value).toBe(2);
        });

        it('clamps at page 1', () => {
            const { page, previous } = usePagination({ total: ref(100), perPage: 10 });

            previous();

            expect(page.value).toBe(1);
        });
    });

    describe('goTo', () => {
        it('navigates to the specified page', () => {
            const { page, goTo } = usePagination({ total: ref(100), perPage: 10 });

            goTo(5);

            expect(page.value).toBe(5);
        });

        it('clamps below 1', () => {
            const { page, goTo } = usePagination({ total: ref(100), perPage: 10 });

            goTo(0);

            expect(page.value).toBe(1);
        });

        it('clamps above pageCount', () => {
            const { page, goTo } = usePagination({ total: ref(100), perPage: 10 });

            goTo(99);

            expect(page.value).toBe(10);
        });

        it('clamps correctly when total shrinks', () => {
            const total = ref(100);
            const { page, goTo } = usePagination({ total, perPage: 10, initialPage: 10 });

            total.value = 30;
            goTo(page.value);

            expect(page.value).toBe(3);
        });
    });
});
