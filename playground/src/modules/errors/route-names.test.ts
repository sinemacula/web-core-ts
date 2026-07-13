/**
 * Unit tests for ERRORS_ROUTE_NAMES.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';

import { ERRORS_ROUTE_NAMES } from '@/modules/errors/route-names';

describe('ERRORS_ROUTE_NAMES', () => {
    it('exports the forbidden route name', () => {
        expect(ERRORS_ROUTE_NAMES.forbidden).toBe('errors.forbidden');
    });

    it('exports the not-found route name', () => {
        expect(ERRORS_ROUTE_NAMES.notFound).toBe('errors.not-found');
    });
});
