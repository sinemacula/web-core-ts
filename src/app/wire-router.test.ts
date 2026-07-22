/**
 * Unit tests for wire-router.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { createMemoryHistory } from 'vue-router';

import type { ApplicationI18n } from '../i18n/application-i18n';
import { createApplicationI18n } from '../i18n/application-i18n';
import type { ModuleDefinition } from '../module/module';
import type { RouteMiddleware } from '../router/middleware';
import { next, redirect } from '@sinemacula/foundation/router/middleware';
import type { WireRouterOptions } from './wire-router';
import { wireRouter } from './wire-router';

const EmptyComponent = defineComponent({ render: () => null });

function buildI18n(): ApplicationI18n {
    const i18n = createApplicationI18n('en-US');

    i18n.global.setLocaleMessage('en-US', { page: { title: 'Home' } });

    return i18n;
}

function baseOptions(
    modules: readonly ModuleDefinition[],
    overrides: Partial<WireRouterOptions> = {},
): WireRouterOptions {
    return {
        modules,
        i18n: buildI18n(),
        appName: 'TestApp',
        history: createMemoryHistory(),
        targetDocument: document.implementation.createHTMLDocument('t'),
        ...overrides,
    };
}

describe('wireRouter', () => {
    afterEach(() => {
        document.title = '';
    });

    it('installs the routes contributed by every module', async () => {
        const modules: ModuleDefinition[] = [
            { name: 'a', routes: [{ path: '/', component: EmptyComponent }] },
            { name: 'b', routes: [{ path: '/reports', component: EmptyComponent }] },
        ];
        const { router } = wireRouter(baseOptions(modules));

        await router.push('/reports');

        expect(router.currentRoute.value.path).toBe('/reports');
    });

    it('runs module guards before route-level middleware', async () => {
        const calls: string[] = [];
        const moduleGuard: RouteMiddleware = {
            handle: () => {
                calls.push('global');

                return next();
            },
        };
        const routeGuard: RouteMiddleware = {
            handle: () => {
                calls.push('route');

                return next();
            },
        };
        const modules: ModuleDefinition[] = [
            {
                name: 'a',
                routes: [{ path: '/', component: EmptyComponent, meta: { middleware: [routeGuard] } }],
                guards: [moduleGuard],
            },
        ];
        const { router } = wireRouter(baseOptions(modules));

        await router.push('/');

        expect(calls).toEqual(['global', 'route']);
    });

    it('lets a module guard redirect a navigation', async () => {
        const guard: RouteMiddleware = {
            handle: context => (context.to.path === '/secret' ? redirect('/login') : next()),
        };
        const modules: ModuleDefinition[] = [
            {
                name: 'a',
                routes: [
                    { path: '/', component: EmptyComponent },
                    { path: '/login', component: EmptyComponent },
                    { path: '/secret', component: EmptyComponent },
                ],
                guards: [guard],
            },
        ];
        const { router } = wireRouter(baseOptions(modules));

        await router.push('/secret');

        expect(router.currentRoute.value.path).toBe('/login');
    });

    it('titles routes with a translated meta title suffixed with the app name', async () => {
        const targetDocument = document.implementation.createHTMLDocument('t');
        const modules: ModuleDefinition[] = [
            { name: 'a', routes: [{ path: '/', component: EmptyComponent, meta: { title: 'page.title' } }] },
        ];
        const { router } = wireRouter(baseOptions(modules, { targetDocument }));

        await router.push('/');

        expect(targetDocument.title).toBe('Home | TestApp');
    });

    it('titles routes without a meta title with the app name alone', async () => {
        const targetDocument = document.implementation.createHTMLDocument('t');
        const modules: ModuleDefinition[] = [{ name: 'a', routes: [{ path: '/', component: EmptyComponent }] }];
        const { router } = wireRouter(baseOptions(modules, { targetDocument }));

        await router.push('/');

        expect(targetDocument.title).toBe('TestApp');
    });

    it('returns a teardown that stops the title synchronisation', async () => {
        const targetDocument = document.implementation.createHTMLDocument('t');
        const modules: ModuleDefinition[] = [
            {
                name: 'a',
                routes: [
                    { path: '/', component: EmptyComponent },
                    { path: '/next', component: EmptyComponent },
                ],
            },
        ];
        const { router, titleSyncTeardown } = wireRouter(baseOptions(modules, { targetDocument }));

        await router.push('/');

        titleSyncTeardown();
        targetDocument.title = 'sentinel';

        await router.push('/next');

        expect(targetDocument.title).toBe('sentinel');
    });

    it('defaults to web history and the global document when no seams are given', async () => {
        const modules: ModuleDefinition[] = [{ name: 'a', routes: [{ path: '/', component: EmptyComponent }] }];
        const { router } = wireRouter({ modules, i18n: buildI18n(), appName: 'TestApp' });

        await router.push('/');

        expect(document.title).toBe('TestApp');
    });
});
