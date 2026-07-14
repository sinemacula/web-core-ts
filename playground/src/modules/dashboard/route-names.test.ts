/**
 * Unit tests for DASHBOARD_ROUTE_NAMES.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';

import { DASHBOARD_ROUTE_NAMES } from '@/modules/dashboard/route-names';

describe('DASHBOARD_ROUTE_NAMES', () => {
    it('exports the home route name', () => {
        expect(DASHBOARD_ROUTE_NAMES.home).toBe('dashboard.home');
    });
});
