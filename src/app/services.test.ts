/**
 * Unit tests for the web application service singletons.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { afterEach, describe, expect, it } from 'vitest';
import { computed } from 'vue';

import { MemoryStorage } from '@sinemacula/foundation/storage/memory-storage';
import type { LocaleSwitcher } from '../i18n/application-i18n';
import { ConfirmService } from '../notifications/confirm-service';
import { ToastService } from '../notifications/toast-service';
import {
    appStorage,
    confirmDialogs,
    installConfirm,
    installLocaleSwitcher,
    installStorage,
    installToasts,
    localeSwitcher,
    resetWebCoreServices,
    toasts,
} from './services';

/** Build an inert locale switcher stand-in. */
function createLocaleSwitcherStub(): LocaleSwitcher {
    return {
        current: computed(() => 'en'),
        switchTo: () => Promise.resolve(),
    };
}

describe('web core services', () => {
    afterEach(() => {
        resetWebCoreServices();
    });

    describe('locale switcher', () => {
        it('throws its exact message before install', () => {
            expect(() => localeSwitcher()).toThrow('locale switcher accessed before initialisation');
        });

        it('resolves the exact installed instance', () => {
            const switcher = createLocaleSwitcherStub();

            installLocaleSwitcher(switcher);

            expect(localeSwitcher()).toBe(switcher);
        });
    });

    describe('re-narrowed notification accessors', () => {
        it('toasts() returns the installed concrete ToastService', () => {
            const service = new ToastService();

            installToasts(service);

            expect(toasts()).toBe(service);
        });

        it('confirmDialogs() returns the installed concrete ConfirmService', () => {
            const service = new ConfirmService();

            installConfirm(service);

            expect(confirmDialogs()).toBe(service);
        });
    });

    it('resetWebCoreServices clears both base and web holders', () => {
        installStorage(new MemoryStorage());
        installLocaleSwitcher(createLocaleSwitcherStub());

        resetWebCoreServices();

        expect(() => appStorage()).toThrow('application storage accessed before initialisation');
        expect(() => localeSwitcher()).toThrow('locale switcher accessed before initialisation');
    });
});
