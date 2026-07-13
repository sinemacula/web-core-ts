/**
 * Unit tests for post-login redirect target handling.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';

import { appendRedirectTarget, REDIRECT_QUERY_KEY, sanitiseRedirectTarget } from '@/modules/auth/redirect';

describe('sanitiseRedirectTarget', () => {
    it('accepts a valid relative path', () => {
        expect(sanitiseRedirectTarget('/dashboard')).toBe('/dashboard');
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

    it('rejects the login route to avoid a bounce loop', () => {
        expect(sanitiseRedirectTarget('/login')).toBeNull();
    });

    it('rejects a login route carrying its own query', () => {
        expect(sanitiseRedirectTarget('/login?redirect=%2F')).toBeNull();
    });

    it('rejects a non-string value', () => {
        expect(sanitiseRedirectTarget(42)).toBeNull();
    });

    it('rejects an array value', () => {
        expect(sanitiseRedirectTarget(['/dashboard'])).toBeNull();
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
