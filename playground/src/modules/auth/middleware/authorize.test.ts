/**
 * Unit tests for the authorize middleware.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { MiddlewareContext } from '@sinemacula/web-core/router/middleware';
import { MemoryStorage } from '@sinemacula/web-core/storage/memory-storage';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { authorize } from '@/modules/auth/middleware/authorize';
import { AUTH_ROUTE_NAMES } from '@/modules/auth/route-names';
import type { AuthenticatedUser } from '@/modules/auth/services/auth-api';
import { ACCESS_TOKEN_STORAGE_KEY, useAuthStore } from '@/modules/auth/stores/auth-store';
import { initialiseApi, resetApi } from '@/services/api';
import { initialiseStorage, resetStorage } from '@/services/storage';
import { FakeHttpClient } from '@/test-support/fake-http-client';

const context = { to: { fullPath: '/users' }, from: {} } as unknown as MiddlewareContext;

/** An authenticated user record granted the given permissions. */
function userWithPermissions(permissions: readonly string[]): AuthenticatedUser {
    return {
        id: 'u1',
        firstName: 'Alice',
        lastName: 'Smith',
        fullName: 'Alice Smith',
        email: 'alice@example.com',
        permissions,
    };
}

describe('authorize', () => {
    let storage: MemoryStorage;

    beforeEach(() => {
        storage = new MemoryStorage();
        initialiseStorage(storage);
        initialiseApi(new FakeHttpClient());
        setActivePinia(createPinia());
    });

    afterEach(() => {
        resetApi();
        resetStorage();
    });

    describe('when the visitor is not authenticated', () => {
        it('redirects to the login route, carrying the attempted path', () => {
            const result = authorize('users.view').handle(context);

            expect(result).toStrictEqual({
                kind: 'redirect',
                to: { name: AUTH_ROUTE_NAMES.login, query: { redirect: '/users' } },
            });
        });
    });

    describe('when the visitor is authenticated', () => {
        beforeEach(() => {
            storage.set(ACCESS_TOKEN_STORAGE_KEY, 'valid-token');
        });

        it('redirects to the default target when the user lacks the permission', () => {
            useAuthStore().user = userWithPermissions([]);

            const result = authorize('users.view').handle(context);

            expect(result).toStrictEqual({ kind: 'redirect', to: '/forbidden' });
        });

        it('redirects to a custom target when the user lacks the permission', () => {
            useAuthStore().user = userWithPermissions([]);

            const result = authorize('users.view', { name: 'forbidden.route' }).handle(context);

            expect(result).toStrictEqual({ kind: 'redirect', to: { name: 'forbidden.route' } });
        });

        it('returns next when the user holds the permission', () => {
            useAuthStore().user = userWithPermissions(['users.view']);

            const result = authorize('users.view').handle(context);

            expect(result).toStrictEqual({ kind: 'next' });
        });

        it('returns next when the user holds the permission via a wildcard grant', () => {
            useAuthStore().user = userWithPermissions(['users.*']);

            const result = authorize('users.view').handle(context);

            expect(result).toStrictEqual({ kind: 'next' });
        });
    });
});
