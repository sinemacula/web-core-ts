/**
 * Unit tests for the authenticated middleware.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { MiddlewareContext } from '@sinemacula/web-core/router/middleware';
import { MemoryStorage } from '@sinemacula/web-core/storage/memory-storage';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { authenticated } from '@/modules/auth/middleware/authenticated';
import { AUTH_ROUTE_NAMES } from '@/modules/auth/route-names';
import { ACCESS_TOKEN_STORAGE_KEY, useAuthStore } from '@/modules/auth/stores/auth-store';
import { initialiseApi, resetApi } from '@/services/api';
import { initialiseStorage, resetStorage } from '@/services/storage';
import { FakeHttpClient } from '@/test-support/fake-http-client';

const context = { to: { fullPath: '/settings/billing' }, from: {} } as unknown as MiddlewareContext;

describe('authenticated', () => {
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

    describe('when the user is authenticated', () => {
        beforeEach(() => {
            storage.set(ACCESS_TOKEN_STORAGE_KEY, 'valid-token');
            useAuthStore(); // prime the store state from storage
        });

        it('returns next', () => {
            const result = authenticated().handle(context);

            expect(result).toStrictEqual({ kind: 'next' });
        });

        it('returns next with a custom redirect target (redirect is never triggered)', () => {
            const result = authenticated({ name: 'some.route' }).handle(context);

            expect(result).toStrictEqual({ kind: 'next' });
        });
    });

    describe('when the user is not authenticated', () => {
        it('redirects to the login route by default, carrying the attempted path', () => {
            const result = authenticated().handle(context);

            expect(result).toStrictEqual({
                kind: 'redirect',
                to: { name: AUTH_ROUTE_NAMES.login, query: { redirect: '/settings/billing' } },
            });
        });

        it('redirects to a custom target when one is provided, carrying the attempted path', () => {
            const result = authenticated({ name: 'custom.route' }).handle(context);

            expect(result).toStrictEqual({
                kind: 'redirect',
                to: { name: 'custom.route', query: { redirect: '/settings/billing' } },
            });
        });
    });
});
