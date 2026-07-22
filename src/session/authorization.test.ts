/**
 * Unit tests for can and useCan.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TokenRefreshCoordinator } from '@sinemacula/foundation/http/token-refresh-coordinator';
import { MemoryStorage } from '@sinemacula/foundation/storage/memory-storage';
import { can, useCan } from './authorization';
import type { SessionApi } from '@sinemacula/foundation/session/session-api';
import { installSessionContext, resetSessionContext } from './session-context';
import { useSessionStore } from './session-store';
import type { SessionUser } from '@sinemacula/foundation/session/session-user';

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
function setStoreUser(user: SessionUser | null): void {
    (useSessionStore() as unknown as { user: SessionUser | null }).user = user;
}

/** Install a test session context over fresh collaborators. */
function installTestContext(): void {
    installSessionContext({
        storageKeys: {
            accessToken: 'auth.access_token',
            refreshToken: 'auth.refresh_token',
            expiresAt: 'auth.expires_at',
            deviceUuid: 'auth.device_uuid',
        },
        routes: { login: { name: 'auth.login' }, loginPath: '/login', home: '/', forbidden: '/forbidden' },
        storage: new MemoryStorage(),
        storeId: 'auth',
        api: createSessionApiStub(),
        coordinator: new TokenRefreshCoordinator({ refresh: () => Promise.resolve(false) }),
        parseTimestamp: () => null,
        device: () => ({ uuid: 'device-uuid', os: 'WEB' }),
    });
}

describe('can', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        installTestContext();
    });

    afterEach(() => {
        resetSessionContext();
    });

    it('returns false when no user is signed in', () => {
        expect(can('users.view')).toBe(false);
    });

    it('returns true when the signed-in user holds the permission', () => {
        setStoreUser(userWithPermissions(['users.view']));

        expect(can('users.view')).toBe(true);
    });

    it('returns false when the signed-in user lacks the permission', () => {
        setStoreUser(userWithPermissions(['billing.view']));

        expect(can('users.view')).toBe(false);
    });

    it('returns true when the permission matches a wildcard grant', () => {
        setStoreUser(userWithPermissions(['users.*']));

        expect(can('users.edit.self')).toBe(true);
    });
});

describe('useCan', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        installTestContext();
    });

    afterEach(() => {
        resetSessionContext();
    });

    it('returns a function reflecting the current permission state', () => {
        const checkPermission = useCan();

        expect(checkPermission('users.view')).toBe(false);
    });

    it('re-evaluates when the store user changes', () => {
        const checkPermission = useCan();

        expect(checkPermission('users.view')).toBe(false);

        setStoreUser(userWithPermissions(['users.view']));

        expect(checkPermission('users.view')).toBe(true);
    });

    it('reflects a permission being lost when the store user changes again', () => {
        setStoreUser(userWithPermissions(['users.view']));

        const checkPermission = useCan();

        expect(checkPermission('users.view')).toBe(true);

        setStoreUser(userWithPermissions([]));

        expect(checkPermission('users.view')).toBe(false);
    });
});
