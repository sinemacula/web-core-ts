/**
 * Unit tests for AUTH_ROUTE_NAMES.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';

import { AUTH_ROUTE_NAMES } from '@/modules/auth/route-names';

describe('AUTH_ROUTE_NAMES', () => {
    it('exports the login route name', () => {
        expect(AUTH_ROUTE_NAMES.login).toBe('auth.login');
    });
});
