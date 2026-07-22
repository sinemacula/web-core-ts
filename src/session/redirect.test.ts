/**
 * Unit tests for post-login redirect target handling.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { afterEach, describe, expect, it } from 'vitest';

import { TokenRefreshCoordinator } from '../http/token-refresh-coordinator';
import { MemoryStorage } from '@sinemacula/foundation/storage/memory-storage';
import { appendRedirectTarget, REDIRECT_QUERY_KEY, sanitiseRedirectTarget } from './redirect';
import type { SessionApi } from './session-api';
import { installSessionContext, resetSessionContext } from './session-context';

/** Build a session API stand-in that fails loudly if any method is invoked. */
function createSessionApiStub(): SessionApi {
    const fail = (): Promise<never> => Promise.reject(new Error('not implemented'));

    return { login: fail, refresh: fail, logout: fail, currentUser: fail };
}

/** Install a test session context carrying the given login path. */
function installTestContext(loginPath: string): void {
    installSessionContext({
        storageKeys: {
            accessToken: 'auth.access_token',
            refreshToken: 'auth.refresh_token',
            expiresAt: 'auth.expires_at',
            deviceUuid: 'auth.device_uuid',
        },
        routes: { login: { name: 'auth.login' }, loginPath, home: '/', forbidden: '/forbidden' },
        storage: new MemoryStorage(),
        storeId: 'auth',
        api: createSessionApiStub(),
        coordinator: new TokenRefreshCoordinator({ refresh: () => Promise.resolve(false) }),
        parseTimestamp: () => null,
        device: () => ({ uuid: 'device-uuid', os: 'WEB' }),
    });
}

describe('sanitiseRedirectTarget', () => {
    it('accepts a valid relative path', () => {
        expect(sanitiseRedirectTarget('/dashboard')).toBe('/dashboard');
    });

    it('accepts the root path', () => {
        expect(sanitiseRedirectTarget('/')).toBe('/');
    });

    it('accepts a nested path carrying its own query string', () => {
        expect(sanitiseRedirectTarget('/settings/billing?tab=invoices')).toBe('/settings/billing?tab=invoices');
    });

    it('rejects a protocol-relative target', () => {
        expect(sanitiseRedirectTarget('//evil.example.com')).toBeNull();
    });

    it('rejects an absolute external url', () => {
        expect(sanitiseRedirectTarget('https://evil.example.com')).toBeNull();
    });

    it('rejects a target containing a backslash', () => {
        expect(sanitiseRedirectTarget('/\\evil.example.com')).toBeNull();
    });

    it('rejects the default login path to avoid a bounce loop', () => {
        expect(sanitiseRedirectTarget('/login')).toBeNull();
    });

    it('rejects the default login path carrying its own query', () => {
        expect(sanitiseRedirectTarget('/login?redirect=%2F')).toBeNull();
    });

    it('rejects any target sharing the login-path prefix', () => {
        expect(sanitiseRedirectTarget('/login/help')).toBeNull();
    });

    it('rejects a non-string value', () => {
        expect(sanitiseRedirectTarget(42)).toBeNull();
    });

    it('rejects an array value', () => {
        expect(sanitiseRedirectTarget(['/dashboard'])).toBeNull();
    });

    it('rejects a custom login path when one is supplied', () => {
        expect(sanitiseRedirectTarget('/signin', '/signin')).toBeNull();
    });

    it('rejects a custom login path carrying its own query', () => {
        expect(sanitiseRedirectTarget('/signin?redirect=%2F', '/signin')).toBeNull();
    });

    it('accepts the default login path when a custom login path is supplied', () => {
        expect(sanitiseRedirectTarget('/login', '/signin')).toBe('/login');
    });

    it('still rejects a protocol-relative target under a custom login path', () => {
        expect(sanitiseRedirectTarget('//evil.example.com', '/signin')).toBeNull();
    });

    it('still accepts an ordinary path under a custom login path', () => {
        expect(sanitiseRedirectTarget('/dashboard', '/signin')).toBe('/dashboard');
    });

    describe('with an installed session context', () => {
        afterEach(() => {
            resetSessionContext();
        });

        it('rejects the context login path on a bare call', () => {
            installTestContext('/signin');

            expect(sanitiseRedirectTarget('/signin')).toBeNull();
        });

        it('rejects the context login path carrying its own query', () => {
            installTestContext('/signin');

            expect(sanitiseRedirectTarget('/signin?redirect=%2F')).toBeNull();
        });

        it('accepts a target sharing the built-in login-path prefix', () => {
            installTestContext('/signin');

            expect(sanitiseRedirectTarget('/login-history')).toBe('/login-history');
        });

        it('prefers an explicit login path over the context login path', () => {
            installTestContext('/signin');

            expect(sanitiseRedirectTarget('/signin', '/login')).toBe('/signin');
        });
    });
});

describe('appendRedirectTarget', () => {
    it('merges the redirect target into an existing query on the object form', () => {
        const location = { name: 'auth.login', query: { locale: 'en-US' } };

        const result = appendRedirectTarget(location, '/dashboard');

        expect(result).toStrictEqual({ name: 'auth.login', query: { locale: 'en-US', redirect: '/dashboard' } });
        expect(location).toStrictEqual({ name: 'auth.login', query: { locale: 'en-US' } });
    });

    it('adds a query when the object form has none', () => {
        const location = { name: 'auth.login' };

        const result = appendRedirectTarget(location, '/dashboard');

        expect(result).toStrictEqual({ name: 'auth.login', query: { redirect: '/dashboard' } });
        expect(location).toStrictEqual({ name: 'auth.login' });
    });

    it('appends a query string to the string form when none is present', () => {
        expect(appendRedirectTarget('/login', '/dashboard')).toBe('/login?redirect=%2Fdashboard');
    });

    it('appends to an existing query string on the string form', () => {
        expect(appendRedirectTarget('/login?locale=en-US', '/dashboard')).toBe(
            '/login?locale=en-US&redirect=%2Fdashboard',
        );
    });

    it('uses REDIRECT_QUERY_KEY as the query parameter name', () => {
        expect(REDIRECT_QUERY_KEY).toBe('redirect');
    });
});
