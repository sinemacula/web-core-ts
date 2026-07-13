/**
 * Unit tests for authRoutes.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { MemoryStorage } from '@sinemacula/web-core/storage/memory-storage';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AUTH_ROUTE_NAMES } from '@/modules/auth/route-names';
import { authRoutes } from '@/modules/auth/routes';
import { initialiseApi, resetApi } from '@/services/api';
import { initialiseStorage, resetStorage } from '@/services/storage';
import { FakeHttpClient } from '@/test-support/fake-http-client';

describe('authRoutes', () => {
    const [route] = authRoutes;

    if (route === undefined) {
        throw new Error('authRoutes is empty — at least one route is required');
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
        expect(authRoutes).toHaveLength(1);
    });

    it('defines the login route at /login', () => {
        expect(route.path).toBe('/login');
        expect(route.name).toBe(AUTH_ROUTE_NAMES.login);
    });

    it('sets the meta title translation key', () => {
        expect(route.meta?.title).toBe('auth.login.title');
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
