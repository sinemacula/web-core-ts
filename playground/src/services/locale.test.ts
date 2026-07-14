/**
 * Unit tests for the locale-switcher service.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { LocaleSwitcher } from '@sinemacula/web-core/i18n/application-i18n';
import { afterEach, describe, expect, it } from 'vitest';
import { computed } from 'vue';

import { initialiseLocaleSwitcher, localeSwitcher, resetLocaleSwitcher } from '@/services/locale';

/**
 * Minimal no-op stub that satisfies the {@link LocaleSwitcher} interface.
 */
const stubSwitcher: LocaleSwitcher = {
    current: computed(() => 'en-US'),
    switchTo: async () => undefined,
};

describe('locale-switcher service', () => {
    afterEach(() => {
        resetLocaleSwitcher();
    });

    it('returns the installed switcher after initialisation', () => {
        initialiseLocaleSwitcher(stubSwitcher);

        expect(localeSwitcher()).toBe(stubSwitcher);
    });

    it('throws before initialisation when localeSwitcher() is called', () => {
        expect(() => localeSwitcher()).toThrow('The locale switcher was accessed before initialisation');
    });

    it('throws again after resetLocaleSwitcher() clears the singleton', () => {
        initialiseLocaleSwitcher(stubSwitcher);
        resetLocaleSwitcher();

        expect(() => localeSwitcher()).toThrow('The locale switcher was accessed before initialisation');
    });
});
