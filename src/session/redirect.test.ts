/**
 * Unit tests for post-login redirect target attachment.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';

import { REDIRECT_QUERY_KEY } from '@sinemacula/foundation/session/redirect';
import { appendRedirectTarget } from './redirect';

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
