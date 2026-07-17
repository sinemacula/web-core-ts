/**
 * Unit tests for the feature-flags service.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { FeatureFlags } from '@sinemacula/web-core/feature-flags/feature-flags';
import { afterEach, describe, expect, it } from 'vitest';

import { featureFlags, initialiseFeatureFlags, resetFeatureFlags } from '@/services/feature-flags';

/**
 * Minimal no-op stub that satisfies the {@link FeatureFlags} interface.
 */
const stubFlags: FeatureFlags = {
    isEnabled: () => false,
    variant: (_key, fallback) => fallback,
    setContext: () => undefined,
    onChange: () => () => undefined,
};

describe('feature-flags service', () => {
    afterEach(() => {
        resetFeatureFlags();
    });

    it('returns the installed adapter after initialisation', () => {
        initialiseFeatureFlags(stubFlags);

        expect(featureFlags()).toBe(stubFlags);
    });

    it('throws before initialisation when featureFlags() is called', () => {
        expect(() => featureFlags()).toThrow('feature-flag adapter accessed before initialisation');
    });

    it('throws again after resetFeatureFlags() clears the singleton', () => {
        initialiseFeatureFlags(stubFlags);
        resetFeatureFlags();

        expect(() => featureFlags()).toThrow('feature-flag adapter accessed before initialisation');
    });
});
