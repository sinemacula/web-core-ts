/**
 * Unit tests for the session context holder.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { afterEach, describe, expect, it } from 'vitest';

import { TokenRefreshCoordinator } from '@sinemacula/foundation/http/token-refresh-coordinator';
import { MemoryStorage } from '@sinemacula/foundation/storage/memory-storage';
import type { SessionApi } from '@sinemacula/foundation/session/session-api';
import type { SessionContext } from './session-context';
import { installSessionContext, resetSessionContext, sessionContext } from './session-context';

/** Build a session API stand-in that fails loudly if any method is invoked. */
function createSessionApiStub(): SessionApi {
    const fail = (): Promise<never> => Promise.reject(new Error('not implemented'));

    return { login: fail, refresh: fail, logout: fail, currentUser: fail };
}

/** Build a fully-populated context for installation. */
function createContext(): SessionContext {
    return {
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
    };
}

describe('sessionContext', () => {
    afterEach(() => {
        resetSessionContext();
    });

    it('throws before the context is installed', () => {
        expect(() => sessionContext()).toThrowError('session context accessed before initialisation');
    });

    it('returns the installed context', () => {
        const context = createContext();

        installSessionContext(context);

        expect(sessionContext()).toBe(context);
    });

    it('replaces a previously installed context', () => {
        const first = createContext();
        const second = createContext();

        installSessionContext(first);
        installSessionContext(second);

        expect(sessionContext()).toBe(second);
    });

    it('throws again after resetSessionContext', () => {
        installSessionContext(createContext());
        resetSessionContext();

        expect(() => sessionContext()).toThrowError('session context accessed before initialisation');
    });
});
