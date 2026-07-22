/**
 * Unit tests for module.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';

import type { RouteMiddleware } from '../router/middleware';
import { next } from '@sinemacula/foundation/router/middleware';
import type { ModuleDefinition } from './module';
import { collectModuleGuards, collectModuleMessages, collectModuleRoutes, createLocaleLoader } from './module';

const EmptyComponent = defineComponent({ render: () => null });

/**
 * Build a distinct pass-through guard so ordering is observable by identity.
 */
function createGuard(): RouteMiddleware {
    return { handle: () => next() };
}

describe('createLocaleLoader', () => {
    it('returns the messages when the locale is present in the map', async () => {
        const messages = { greeting: 'Hello' };
        const loader = createLocaleLoader({
            'en-GB': async () => messages,
        });

        const result = await loader('en-GB');

        expect(result).toStrictEqual(messages);
    });

    it('returns null when the locale is absent from the map', async () => {
        const loader = createLocaleLoader({
            'en-GB': async () => ({ greeting: 'Hello' }),
        });

        const result = await loader('fr-FR');

        expect(result).toBeNull();
    });
});

describe('collectModuleRoutes', () => {
    it('returns an empty array when no modules are given', () => {
        expect(collectModuleRoutes([])).toStrictEqual([]);
    });

    it('flattens routes from all modules in registry order', () => {
        const routeA = { path: '/a', component: EmptyComponent };
        const routeB = { path: '/b', component: EmptyComponent };
        const routeC = { path: '/c', component: EmptyComponent };

        const moduleA: ModuleDefinition = { name: 'a', routes: [routeA, routeB] };
        const moduleB: ModuleDefinition = { name: 'b', routes: [routeC] };

        expect(collectModuleRoutes([moduleA, moduleB])).toStrictEqual([routeA, routeB, routeC]);
    });

    it('returns routes from a single module', () => {
        const route = { path: '/x', component: EmptyComponent };
        const definition: ModuleDefinition = { name: 'x', routes: [route] };

        expect(collectModuleRoutes([definition])).toStrictEqual([route]);
    });
});

describe('collectModuleMessages', () => {
    it('returns an empty object when no modules are given', async () => {
        const result = await collectModuleMessages([], 'en-GB');

        expect(result).toStrictEqual({});
    });

    it('namespaces loaded messages under the module name', async () => {
        const messages = { hello: 'world' };
        const definition: ModuleDefinition = {
            name: 'dashboard',
            routes: [],
            locales: async () => messages,
        };

        const result = await collectModuleMessages([definition], 'en-GB');

        expect(result).toStrictEqual({ dashboard: messages });
    });

    it('skips modules that have no locales property', async () => {
        const definition: ModuleDefinition = { name: 'settings', routes: [] };

        const result = await collectModuleMessages([definition], 'en-GB');

        expect(result).toStrictEqual({});
    });

    it('skips modules whose loader returns null', async () => {
        const definition: ModuleDefinition = {
            name: 'profile',
            routes: [],
            locales: async () => null,
        };

        const result = await collectModuleMessages([definition], 'en-GB');

        expect(result).toStrictEqual({});
    });

    it('collects messages from multiple modules, skipping those with null results', async () => {
        const messagesA = { key: 'value' };
        const alphaModule: ModuleDefinition = { name: 'alpha', routes: [], locales: async () => messagesA };
        const betaModule: ModuleDefinition = { name: 'beta', routes: [], locales: async () => null };
        const gammaModule: ModuleDefinition = { name: 'gamma', routes: [] };

        const result = await collectModuleMessages([alphaModule, betaModule, gammaModule], 'en-GB');

        expect(result).toStrictEqual({ alpha: messagesA });
    });
});

describe('collectModuleGuards', () => {
    it('returns an empty array when no modules are given', () => {
        expect(collectModuleGuards([])).toStrictEqual([]);
    });

    it('returns an empty array when no module declares guards', () => {
        const definition: ModuleDefinition = { name: 'plain', routes: [] };

        expect(collectModuleGuards([definition])).toStrictEqual([]);
    });

    it('returns the guards of a single module', () => {
        const guard = createGuard();
        const definition: ModuleDefinition = { name: 'guarded', routes: [], guards: [guard] };

        expect(collectModuleGuards([definition])).toStrictEqual([guard]);
    });

    it('flattens guards from all modules in registry order, skipping guardless modules', () => {
        const guardA = createGuard();
        const guardB = createGuard();
        const guardC = createGuard();

        const alphaModule: ModuleDefinition = { name: 'alpha', routes: [], guards: [guardA, guardB] };
        const betaModule: ModuleDefinition = { name: 'beta', routes: [] };
        const gammaModule: ModuleDefinition = { name: 'gamma', routes: [], guards: [guardC] };

        expect(collectModuleGuards([alphaModule, betaModule, gammaModule])).toStrictEqual([guardA, guardB, guardC]);
    });
});
