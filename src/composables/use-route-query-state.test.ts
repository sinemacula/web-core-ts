/**
 * Unit tests for use-route-query-state.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { useRouteQueryState } from './use-route-query-state';

const EmptyComponent = defineComponent({ render: () => null });

function makeRouter(initialQuery: Record<string, string> = {}) {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/', component: EmptyComponent }],
    });

    const qs = new URLSearchParams(initialQuery).toString();
    const url = qs.length > 0 ? `/?${qs}` : '/';

    return { router, url };
}

describe('useRouteQueryState', () => {
    describe('values', () => {
        it('returns defaults when the URL has no query params', async () => {
            const { router, url } = makeRouter();
            await router.push(url);

            const state = useRouteQueryState(router, { defaults: { page: '1', sort: 'name' } });

            expect(state.values.value).toStrictEqual({ page: '1', sort: 'name' });
        });

        it('overlays actual query values over defaults', async () => {
            const { router, url } = makeRouter({ page: '3' });
            await router.push(url);

            const state = useRouteQueryState(router, { defaults: { page: '1', sort: 'name' } });

            expect(state.values.value).toStrictEqual({ page: '3', sort: 'name' });
        });

        it('does not include foreign (unmanaged) query keys in values', async () => {
            const { router, url } = makeRouter({ page: '2', extra: 'ignored' });
            await router.push(url);

            const state = useRouteQueryState(router, { defaults: { page: '1' } });

            expect(state.values.value).toStrictEqual({ page: '2' });
            expect('extra' in state.values.value).toBe(false);
        });

        it('uses the first element when the query value is an array', async () => {
            const router = createRouter({
                history: createMemoryHistory(),
                routes: [{ path: '/', component: EmptyComponent }],
            });
            await router.push({ path: '/', query: { tag: ['alpha', 'beta'] } });

            const state = useRouteQueryState(router, { defaults: { tag: 'all' } });

            expect(state.values.value['tag']).toBe('alpha');
        });

        it('falls back to the default when the array is empty-like (all null elements)', async () => {
            const router = createRouter({
                history: createMemoryHistory(),
                routes: [{ path: '/', component: EmptyComponent }],
            });
            await router.push({ path: '/', query: { tag: [null] } });

            const state = useRouteQueryState(router, { defaults: { tag: 'all' } });

            expect(state.values.value['tag']).toBe('all');
        });

        it('reacts to route changes', async () => {
            const { router, url } = makeRouter({ page: '1' });
            await router.push(url);

            const state = useRouteQueryState(router, { defaults: { page: '1' } });

            expect(state.values.value['page']).toBe('1');

            await router.push({ query: { page: '5' } });

            expect(state.values.value['page']).toBe('5');
        });
    });

    describe('get', () => {
        it('returns the resolved value for a managed key', async () => {
            const { router, url } = makeRouter({ page: '7' });
            await router.push(url);

            const state = useRouteQueryState(router, { defaults: { page: '1' } });

            expect(state.get('page')).toBe('7');
        });

        it('returns the default for a managed key absent from the query', async () => {
            const { router, url } = makeRouter();
            await router.push(url);

            const state = useRouteQueryState(router, { defaults: { page: '1' } });

            expect(state.get('page')).toBe('1');
        });

        it('returns empty string for an entirely unknown key', async () => {
            const { router, url } = makeRouter();
            await router.push(url);

            const state = useRouteQueryState(router, { defaults: { page: '1' } });

            expect(state.get('nonexistent')).toBe('');
        });
    });

    describe('set', () => {
        it('updates a managed key in the URL via router.replace', async () => {
            const { router, url } = makeRouter({ page: '1' });
            await router.push(url);

            const state = useRouteQueryState(router, { defaults: { page: '1', sort: 'name' } });

            await state.set({ page: '3' });

            expect(router.currentRoute.value.query['page']).toBe('3');
        });

        it('merges the patch over existing query params', async () => {
            const { router, url } = makeRouter({ page: '2', sort: 'date' });
            await router.push(url);

            const state = useRouteQueryState(router, { defaults: { page: '1', sort: 'name' } });

            await state.set({ page: '4' });

            expect(router.currentRoute.value.query['page']).toBe('4');
            expect(router.currentRoute.value.query['sort']).toBe('date');
        });

        it('removes the key from the URL when set to null', async () => {
            const { router, url } = makeRouter({ page: '3' });
            await router.push(url);

            const state = useRouteQueryState(router, { defaults: { page: '1' } });

            await state.set({ page: null });

            expect(router.currentRoute.value.query['page']).toBeUndefined();
        });

        it('preserves foreign (unmanaged) query parameters', async () => {
            const { router } = makeRouter();
            await router.push({ path: '/', query: { page: '2', foreign: 'kept' } });

            const state = useRouteQueryState(router, { defaults: { page: '1' } });

            await state.set({ page: '3' });

            expect(router.currentRoute.value.query['foreign']).toBe('kept');
            expect(router.currentRoute.value.query['page']).toBe('3');
        });

        it('silently ignores patch keys that are not in defaults', async () => {
            const { router, url } = makeRouter({ page: '1' });
            await router.push(url);

            const state = useRouteQueryState(router, { defaults: { page: '1' } });

            await state.set({ unknown: 'value' });

            expect(router.currentRoute.value.query['unknown']).toBeUndefined();
            expect(router.currentRoute.value.query['page']).toBe('1');
        });

        it('can set multiple keys in a single call', async () => {
            const { router, url } = makeRouter();
            await router.push(url);

            const state = useRouteQueryState(router, { defaults: { page: '1', sort: 'name', dir: 'asc' } });

            await state.set({ page: '2', sort: 'date', dir: 'desc' });

            expect(router.currentRoute.value.query['page']).toBe('2');
            expect(router.currentRoute.value.query['sort']).toBe('date');
            expect(router.currentRoute.value.query['dir']).toBe('desc');
        });
    });
});
