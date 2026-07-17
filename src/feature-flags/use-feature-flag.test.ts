/**
 * Unit tests for useFeatureFlag and useVariant composables.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';
import { effectScope } from 'vue';

import { StaticFeatureFlags } from './static-feature-flags';
import { useFeatureFlag, useVariant } from './use-feature-flag';

describe('useFeatureFlag', () => {
    it('returns the current boolean value of the flag', () => {
        const flags = new StaticFeatureFlags({ 'feat-a': true });

        const scope = effectScope();
        const result = scope.run(() => useFeatureFlag(flags, 'feat-a'));

        expect(result?.value).toBe(true);

        scope.stop();
    });

    it('defaults to false when the flag is absent and no fallback is given', () => {
        const flags = new StaticFeatureFlags();

        const scope = effectScope();
        const result = scope.run(() => useFeatureFlag(flags, 'missing'));

        expect(result?.value).toBe(false);

        scope.stop();
    });

    it('uses the explicit fallback when the flag is absent', () => {
        const flags = new StaticFeatureFlags();

        const scope = effectScope();
        const result = scope.run(() => useFeatureFlag(flags, 'missing', true));

        expect(result?.value).toBe(true);

        scope.stop();
    });

    it('updates reactively when the flag set is replaced', () => {
        const flags = new StaticFeatureFlags({ 'feat-a': false });

        const scope = effectScope();
        const result = scope.run(() => useFeatureFlag(flags, 'feat-a'));

        expect(result?.value).toBe(false);

        flags.replace({ 'feat-a': true });

        expect(result?.value).toBe(true);

        scope.stop();
    });

    it('stops reacting after the scope is disposed', () => {
        const flags = new StaticFeatureFlags({ 'feat-a': false });

        const scope = effectScope();
        const result = scope.run(() => useFeatureFlag(flags, 'feat-a'));

        expect(result?.value).toBe(false);

        scope.stop();

        flags.replace({ 'feat-a': true });

        // The computed ref value is frozen at the value it had when the scope
        // stopped; it no longer tracks changes.
        expect(result?.value).toBe(false);
    });
});

describe('useVariant', () => {
    it('returns the current string variant value', () => {
        const flags = new StaticFeatureFlags({ flow: 'checkout-v2' });

        const scope = effectScope();
        const result = scope.run(() => useVariant(flags, 'flow', 'checkout-v1'));

        expect(result?.value).toBe('checkout-v2');

        scope.stop();
    });

    it('returns the current number variant value', () => {
        const flags = new StaticFeatureFlags({ limit: 100 });

        const scope = effectScope();
        const result = scope.run(() => useVariant(flags, 'limit', 0));

        expect(result?.value).toBe(100);

        scope.stop();
    });

    it('returns the fallback when the key is absent', () => {
        const flags = new StaticFeatureFlags();

        const scope = effectScope();
        const result = scope.run(() => useVariant(flags, 'missing', 'default'));

        expect(result?.value).toBe('default');

        scope.stop();
    });

    it('updates reactively when the flag set is replaced', () => {
        const flags = new StaticFeatureFlags({ flow: 'checkout-v1' });

        const scope = effectScope();
        const result = scope.run(() => useVariant(flags, 'flow', 'checkout-v1'));

        expect(result?.value).toBe('checkout-v1');

        flags.replace({ flow: 'checkout-v2' });

        expect(result?.value).toBe('checkout-v2');

        scope.stop();
    });

    it('stops reacting after the scope is disposed', () => {
        const flags = new StaticFeatureFlags({ flow: 'checkout-v1' });

        const scope = effectScope();
        const result = scope.run(() => useVariant(flags, 'flow', 'checkout-v1'));

        expect(result?.value).toBe('checkout-v1');

        scope.stop();

        flags.replace({ flow: 'checkout-v2' });

        // The computed was cached at checkout-v1; since the onChange
        // subscription was removed by onScopeDispose, tick is never bumped and
        // the cached value is returned unchanged.
        expect(result?.value).toBe('checkout-v1');
    });
});
