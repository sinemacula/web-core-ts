/**
 * Unit tests for router-factory.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import type { RouteLocationNormalized, RouteLocationNormalizedLoaded } from 'vue-router';
import { createMemoryHistory } from 'vue-router';

import type { RouteMiddleware } from './middleware';
import { next, redirect } from '@sinemacula/foundation/router/middleware';
import { createApplicationRouter, resolveScrollPosition } from './router-factory';

const EmptyComponent = defineComponent({ render: () => null });

describe('resolveScrollPosition', () => {
    it('returns the saved position when one is provided', () => {
        const saved = { left: 10, top: 20 };
        const to = { hash: '' } as unknown as RouteLocationNormalized;

        const result = resolveScrollPosition(to, {} as RouteLocationNormalizedLoaded, saved);

        expect(result).toStrictEqual(saved);
    });

    it('returns a hash anchor target when no saved position and hash is present', () => {
        const to = { hash: '#section' } as unknown as RouteLocationNormalized;

        const result = resolveScrollPosition(to, {} as RouteLocationNormalizedLoaded, null);

        expect(result).toStrictEqual({ el: '#section' });
    });

    it('returns top-left zero when no saved position and no hash', () => {
        const to = { hash: '' } as unknown as RouteLocationNormalized;

        const result = resolveScrollPosition(to, {} as RouteLocationNormalizedLoaded, null);

        expect(result).toStrictEqual({ top: 0, left: 0 });
    });
});

describe('createApplicationRouter', () => {
    it('uses the provided history instead of web history', () => {
        const history = createMemoryHistory();

        const router = createApplicationRouter({ routes: [], history });

        expect(router.options.history).toBe(history);
    });

    it('uses createWebHistory when no history override is provided', () => {
        const router = createApplicationRouter({ routes: [] });

        expect(router.options.history).toBeDefined();
    });

    it('registers the given routes on the router', () => {
        const router = createApplicationRouter({
            history: createMemoryHistory(),
            routes: [{ path: '/home', component: EmptyComponent }],
        });

        const found = router.getRoutes().find(route => route.path === '/home');

        expect(found).toBeDefined();
    });

    it('navigates normally when a route has no middleware', async () => {
        const router = createApplicationRouter({
            history: createMemoryHistory(),
            routes: [
                { path: '/', component: EmptyComponent },
                { path: '/about', component: EmptyComponent },
            ],
        });

        await router.push('/about');

        expect(router.currentRoute.value.path).toBe('/about');
    });

    it('allows navigation when middleware returns next', async () => {
        const passingMiddleware: RouteMiddleware = { handle: async () => next() };
        const router = createApplicationRouter({
            history: createMemoryHistory(),
            routes: [
                { path: '/', component: EmptyComponent },
                { path: '/protected', component: EmptyComponent, meta: { middleware: [passingMiddleware] } },
            ],
        });

        await router.push('/protected');

        expect(router.currentRoute.value.path).toBe('/protected');
    });

    it('redirects navigation when middleware returns redirect', async () => {
        const redirectingMiddleware: RouteMiddleware = { handle: async () => redirect('/') };
        const router = createApplicationRouter({
            history: createMemoryHistory(),
            routes: [
                { path: '/', component: EmptyComponent },
                { path: '/guarded', component: EmptyComponent, meta: { middleware: [redirectingMiddleware] } },
            ],
        });

        await router.push('/guarded');

        expect(router.currentRoute.value.path).toBe('/');
    });

    it('covers the meta.middleware null-coalesce branch with a route that has no meta', async () => {
        const router = createApplicationRouter({
            history: createMemoryHistory(),
            routes: [
                { path: '/', component: EmptyComponent },
                { path: '/plain', component: EmptyComponent },
            ],
        });

        await router.push('/plain');

        expect(router.currentRoute.value.path).toBe('/plain');
    });

    it('runs global middleware before matched-record meta middleware', async () => {
        const order: string[] = [];
        const recording = (name: string): RouteMiddleware => ({
            handle: () => {
                order.push(name);

                return Promise.resolve(next());
            },
        });
        const router = createApplicationRouter({
            history: createMemoryHistory(),
            globalMiddleware: [recording('global-one'), recording('global-two')],
            routes: [
                { path: '/', component: EmptyComponent },
                { path: '/ordered', component: EmptyComponent, meta: { middleware: [recording('meta')] } },
            ],
        });

        await router.push('/ordered');

        expect(order).toStrictEqual(['global-one', 'global-two', 'meta']);
        expect(router.currentRoute.value.path).toBe('/ordered');
    });

    it('short-circuits later global and meta middleware when a global middleware redirects', async () => {
        const secondGlobalHandle = vi.fn(async () => next());
        const metaHandle = vi.fn(async () => next());
        const redirectingGlobal: RouteMiddleware = {
            handle: async context => (context.to.path === '/guarded' ? redirect('/safe') : next()),
        };
        const router = createApplicationRouter({
            history: createMemoryHistory(),
            globalMiddleware: [redirectingGlobal, { handle: secondGlobalHandle }],
            routes: [
                { path: '/', component: EmptyComponent },
                { path: '/safe', component: EmptyComponent },
                { path: '/guarded', component: EmptyComponent, meta: { middleware: [{ handle: metaHandle }] } },
            ],
        });

        await router.push('/guarded');

        expect(router.currentRoute.value.path).toBe('/safe');
        expect(metaHandle).not.toHaveBeenCalled();
        expect(secondGlobalHandle).toHaveBeenCalledTimes(1);
    });

    it('runs global middleware on navigations to routes that declare no middleware', async () => {
        const globalHandle = vi.fn(async () => next());
        const router = createApplicationRouter({
            history: createMemoryHistory(),
            globalMiddleware: [{ handle: globalHandle }],
            routes: [
                { path: '/', component: EmptyComponent },
                { path: '/plain', component: EmptyComponent },
            ],
        });

        await router.push('/plain');
        await router.push('/');

        expect(globalHandle).toHaveBeenCalledTimes(2);
    });
});
