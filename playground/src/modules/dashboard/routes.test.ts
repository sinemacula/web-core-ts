/**
 * Unit tests for dashboardRoutes.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { MemoryStorage } from '@sinemacula/web-core/storage/memory-storage';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DASHBOARD_ROUTE_NAMES } from '@/modules/dashboard/route-names';
import { dashboardRoutes } from '@/modules/dashboard/routes';
import { initialiseApi, resetApi } from '@/services/api';
import { initialiseStorage, resetStorage } from '@/services/storage';
import { FakeHttpClient } from '@/test-support/fake-http-client';

describe('dashboardRoutes', () => {
    const [route] = dashboardRoutes;

    if (route === undefined) {
        throw new Error('dashboardRoutes is empty - at least one route is required');
    }

    beforeEach(() => {
        initialiseStorage(new MemoryStorage());
        initialiseApi(new FakeHttpClient());
        setActivePinia(createPinia());
    });

    afterEach(() => {
        resetApi();
        resetStorage();
    });

    it('contains exactly one route', () => {
        expect(dashboardRoutes).toHaveLength(1);
    });

    it('defines the home route at /', () => {
        expect(route.path).toBe('/');
        expect(route.name).toBe(DASHBOARD_ROUTE_NAMES.home);
    });

    it('sets the meta title translation key', () => {
        expect(route.meta?.title).toBe('dashboard.home.title');
    });

    it('attaches one middleware entry', () => {
        const middleware = route.meta?.middleware ?? [];

        expect(middleware).toHaveLength(1);
    });

    it('resolves the lazy component loader', async () => {
        const component = await (route.component as () => Promise<unknown>)();

        expect(component).toBeDefined();
    });
});
