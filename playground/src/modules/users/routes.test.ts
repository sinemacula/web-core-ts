/**
 * Unit tests for usersRoutes.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { MemoryStorage } from '@sinemacula/web-core/storage/memory-storage';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { USERS_ROUTE_NAMES } from '@/modules/users/route-names';
import { usersRoutes } from '@/modules/users/routes';
import { initialiseApi, resetApi } from '@/services/api';
import { initialiseStorage, resetStorage } from '@/services/storage';
import { FakeHttpClient } from '@/test-support/fake-http-client';

describe('usersRoutes', () => {
    const [route] = usersRoutes;

    if (route === undefined) {
        throw new Error('usersRoutes is empty - at least one route is required');
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
        expect(usersRoutes).toHaveLength(1);
    });

    it('defines the index route at /users', () => {
        expect(route.path).toBe('/users');
        expect(route.name).toBe(USERS_ROUTE_NAMES.index);
    });

    it('sets the meta title translation key', () => {
        expect(route.meta?.title).toBe('users.index.title');
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
