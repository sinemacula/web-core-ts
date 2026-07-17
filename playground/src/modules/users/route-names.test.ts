/**
 * Unit tests for USERS_ROUTE_NAMES.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';

import { USERS_ROUTE_NAMES } from '@/modules/users/route-names';

describe('USERS_ROUTE_NAMES', () => {
    it('exports the index route name', () => {
        expect(USERS_ROUTE_NAMES.index).toBe('users.index');
    });
});
