/**
 * Unit tests for can and useCan.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { MemoryStorage } from '@sinemacula/web-core/storage/memory-storage';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { can, useCan } from '@/modules/auth/authorization';
import type { AuthenticatedUser } from '@/modules/auth/services/auth-api';
import { useAuthStore } from '@/modules/auth/stores/auth-store';
import { initialiseApi, resetApi } from '@/services/api';
import { initialiseStorage, resetStorage } from '@/services/storage';
import { FakeHttpClient } from '@/test-support/fake-http-client';

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

describe('can', () => {
    beforeEach(() => {
        initialiseStorage(new MemoryStorage());
        initialiseApi(new FakeHttpClient());
        setActivePinia(createPinia());
    });

    afterEach(() => {
        resetApi();
        resetStorage();
    });

    it('returns false when no user is signed in', () => {
        expect(can('users.view')).toBe(false);
    });

    it('returns true when the signed-in user holds the permission', () => {
        useAuthStore().user = userWithPermissions(['users.view']);

        expect(can('users.view')).toBe(true);
    });

    it('returns false when the signed-in user lacks the permission', () => {
        useAuthStore().user = userWithPermissions(['billing.view']);

        expect(can('users.view')).toBe(false);
    });

    it('returns true when the permission matches a wildcard grant', () => {
        useAuthStore().user = userWithPermissions(['users.*']);

        expect(can('users.edit.self')).toBe(true);
    });
});

describe('useCan', () => {
    beforeEach(() => {
        initialiseStorage(new MemoryStorage());
        initialiseApi(new FakeHttpClient());
        setActivePinia(createPinia());
    });

    afterEach(() => {
        resetApi();
        resetStorage();
    });

    it('returns a function reflecting the current permission state', () => {
        const checkPermission = useCan();

        expect(checkPermission('users.view')).toBe(false);
    });

    it('re-evaluates when the store user changes', () => {
        const checkPermission = useCan();

        expect(checkPermission('users.view')).toBe(false);

        useAuthStore().user = userWithPermissions(['users.view']);

        expect(checkPermission('users.view')).toBe(true);
    });

    it('reflects a permission being lost when the store user changes again', () => {
        useAuthStore().user = userWithPermissions(['users.view']);

        const checkPermission = useCan();

        expect(checkPermission('users.view')).toBe(true);

        useAuthStore().user = userWithPermissions([]);

        expect(checkPermission('users.view')).toBe(false);
    });
});
