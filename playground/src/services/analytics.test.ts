/**
 * Unit tests for the analytics service.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { AnalyticsTracker } from '@sinemacula/web-core/analytics/analytics-tracker';
import { afterEach, describe, expect, it } from 'vitest';
import { analytics, initialiseAnalytics, resetAnalytics } from '@/services/analytics';

/**
 * Minimal no-op stub that satisfies the {@link AnalyticsTracker} interface.
 */
const stubTracker: AnalyticsTracker = {
    track: () => undefined,
    page: () => undefined,
    identify: () => undefined,
    reset: () => undefined,
};

describe('analytics service', () => {
    afterEach(() => {
        resetAnalytics();
    });

    it('returns the installed tracker after initialisation', () => {
        initialiseAnalytics(stubTracker);

        expect(analytics()).toBe(stubTracker);
    });

    it('throws before initialisation when analytics() is called', () => {
        expect(() => analytics()).toThrow('analytics tracker accessed before initialisation');
    });

    it('throws again after resetAnalytics() clears the singleton', () => {
        initialiseAnalytics(stubTracker);
        resetAnalytics();

        expect(() => analytics()).toThrow('analytics tracker accessed before initialisation');
    });
});
