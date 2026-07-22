/**
 * Unit tests for the session guard factories.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TokenRefreshCoordinator } from '@sinemacula/foundation/http/token-refresh-coordinator';
import type { MiddlewareContext } from '../router/middleware';
import { MemoryStorage } from '@sinemacula/foundation/storage/memory-storage';
import type { SessionRoutes } from './create-session-module';
import { authenticated, authorize, guestOnly } from './middleware';
import type { SessionApi } from './session-api';
import { installSessionContext, resetSessionContext } from './session-context';
import { useSessionStore } from './session-store';
import type { SessionUser } from './session-user';

const ACCESS_TOKEN_KEY = 'auth.access_token';

const context = { to: { fullPath: '/settings/billing' }, from: {} } as unknown as MiddlewareContext;

/** Build a session API stand-in that fails loudly if any method is invoked. */
function createSessionApiStub(): SessionApi {
    const fail = (): Promise<never> => Promise.reject(new Error('not implemented'));

    return { login: fail, refresh: fail, logout: fail, currentUser: fail };
}

/** An authenticated user record granted the given permissions. */
function userWithPermissions(permissions: readonly string[]): SessionUser {
    return { id: 'u1', email: 'alice@example.com', name: 'Alice Smith', permissions };
}

/** Write the session user directly onto the store state. */
function setStoreUser(user: SessionUser): void {
    (useSessionStore() as unknown as { user: SessionUser | null }).user = user;
}

describe('session guards', () => {
    let storage: MemoryStorage;

    /**
     * Install a test session context over fresh collaborators.
     *
     * @param routes - optional route-identity overrides
     */
    function installTestContext(routes: Partial<SessionRoutes> = {}, currentUser?: () => Promise<SessionUser>): void {
        installSessionContext({
            storageKeys: {
                accessToken: ACCESS_TOKEN_KEY,
                refreshToken: 'auth.refresh_token',
                expiresAt: 'auth.expires_at',
                deviceUuid: 'auth.device_uuid',
            },
            routes: {
                login: { name: 'auth.login' },
                loginPath: '/login',
                home: '/',
                forbidden: '/forbidden',
                ...routes,
            },
            storage,
            storeId: 'auth',
            api: currentUser === undefined ? createSessionApiStub() : { ...createSessionApiStub(), currentUser },
            coordinator: new TokenRefreshCoordinator({ refresh: () => Promise.resolve(false) }),
            parseTimestamp: () => null,
            device: () => ({ uuid: 'device-uuid', os: 'WEB' }),
        });
    }

    beforeEach(() => {
        storage = new MemoryStorage();
        setActivePinia(createPinia());
        installTestContext();
    });

    afterEach(() => {
        resetSessionContext();
    });

    describe('authenticated', () => {
        describe('when the user is authenticated', () => {
            beforeEach(() => {
                storage.set(ACCESS_TOKEN_KEY, 'valid-token');
                useSessionStore();
            });

            it('returns next', () => {
                expect(authenticated().handle(context)).toStrictEqual({ kind: 'next' });
            });

            it('returns next with a custom redirect target (redirect is never triggered)', () => {
                expect(authenticated({ name: 'some.route' }).handle(context)).toStrictEqual({ kind: 'next' });
            });
        });

        describe('when the user is not authenticated', () => {
            it('redirects to the context login route by default, carrying the attempted path', () => {
                expect(authenticated().handle(context)).toStrictEqual({
                    kind: 'redirect',
                    to: { name: 'auth.login', query: { redirect: '/settings/billing' } },
                });
            });

            it('redirects to a custom target when one is provided, carrying the attempted path', () => {
                expect(authenticated({ name: 'custom.route' }).handle(context)).toStrictEqual({
                    kind: 'redirect',
                    to: { name: 'custom.route', query: { redirect: '/settings/billing' } },
                });
            });

            it('resolves the default login route from the context lazily at handle time', () => {
                const guard = authenticated();

                resetSessionContext();
                installTestContext({ login: { name: 'custom.login' } });

                expect(guard.handle(context)).toStrictEqual({
                    kind: 'redirect',
                    to: { name: 'custom.login', query: { redirect: '/settings/billing' } },
                });
            });
        });
    });

    describe('guestOnly', () => {
        describe('when the user is not authenticated', () => {
            it('returns next', () => {
                expect(guestOnly().handle(context)).toStrictEqual({ kind: 'next' });
            });

            it('returns next with a custom redirect target (redirect is never triggered)', () => {
                expect(guestOnly({ name: 'some.route' }).handle(context)).toStrictEqual({ kind: 'next' });
            });
        });

        describe('when the user is authenticated', () => {
            beforeEach(() => {
                storage.set(ACCESS_TOKEN_KEY, 'valid-token');
                useSessionStore();
            });

            it('redirects to the context home route by default', () => {
                expect(guestOnly().handle(context)).toStrictEqual({ kind: 'redirect', to: '/' });
            });

            it('redirects to a custom target when one is provided', () => {
                expect(guestOnly({ name: 'custom.route' }).handle(context)).toStrictEqual({
                    kind: 'redirect',
                    to: { name: 'custom.route' },
                });
            });

            it('resolves the default home route from the context lazily at handle time', () => {
                const guard = guestOnly();

                resetSessionContext();
                installTestContext({ home: '/dashboard' });

                expect(guard.handle(context)).toStrictEqual({ kind: 'redirect', to: '/dashboard' });
            });
        });
    });

    describe('authorize', () => {
        describe('when the visitor is not authenticated', () => {
            it('redirects to the context login route, carrying the attempted path', async () => {
                expect(await authorize('users.view').handle(context)).toStrictEqual({
                    kind: 'redirect',
                    to: { name: 'auth.login', query: { redirect: '/settings/billing' } },
                });
            });
        });

        describe('when the visitor is authenticated with the user already loaded', () => {
            beforeEach(() => {
                storage.set(ACCESS_TOKEN_KEY, 'valid-token');
                useSessionStore();
            });

            it('redirects to the context forbidden route when the user lacks the permission', async () => {
                setStoreUser(userWithPermissions([]));

                expect(await authorize('users.view').handle(context)).toStrictEqual({
                    kind: 'redirect',
                    to: '/forbidden',
                });
            });

            it('redirects to a custom target when the user lacks the permission', async () => {
                setStoreUser(userWithPermissions([]));

                expect(await authorize('users.view', { name: 'forbidden.route' }).handle(context)).toStrictEqual({
                    kind: 'redirect',
                    to: { name: 'forbidden.route' },
                });
            });

            it('resolves the default forbidden route from the context lazily at handle time', async () => {
                const guard = authorize('users.view');

                setStoreUser(userWithPermissions([]));
                resetSessionContext();
                installTestContext({ forbidden: '/no-access' });

                expect(await guard.handle(context)).toStrictEqual({ kind: 'redirect', to: '/no-access' });
            });

            it('returns next when the user holds the permission', async () => {
                setStoreUser(userWithPermissions(['users.view']));

                expect(await authorize('users.view').handle(context)).toStrictEqual({ kind: 'next' });
            });

            it('returns next when the user holds the permission via a wildcard grant', async () => {
                setStoreUser(userWithPermissions(['users.*']));

                expect(await authorize('users.view').handle(context)).toStrictEqual({ kind: 'next' });
            });
        });

        describe('when the user is not yet loaded', () => {
            it('waits for the user to load, then admits when the permission is held', async () => {
                resetSessionContext();
                installTestContext({}, () => Promise.resolve(userWithPermissions(['users.view'])));
                storage.set(ACCESS_TOKEN_KEY, 'valid-token');
                useSessionStore();

                expect(await authorize('users.view').handle(context)).toStrictEqual({ kind: 'next' });
            });

            it('waits for the user to load, then redirects to forbidden without the permission', async () => {
                resetSessionContext();
                installTestContext({}, () => Promise.resolve(userWithPermissions([])));
                storage.set(ACCESS_TOKEN_KEY, 'valid-token');
                useSessionStore();

                expect(await authorize('users.view').handle(context)).toStrictEqual({
                    kind: 'redirect',
                    to: '/forbidden',
                });
            });
        });
    });
});
