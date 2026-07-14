/**
 * Unit tests for the toast service.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { ToastService } from '@sinemacula/web-core/notifications/toast-service';
import { afterEach, describe, expect, it } from 'vitest';
import { initialiseToasts, resetToasts, toasts } from '@/services/toast';

describe('toast service', () => {
    afterEach(() => {
        resetToasts();
    });

    it('returns the installed service after initialisation', () => {
        const instance = new ToastService();

        initialiseToasts(instance);

        expect(toasts()).toBe(instance);
    });

    it('throws before initialisation when toasts() is called', () => {
        expect(() => toasts()).toThrow('toast service accessed before initialisation');
    });

    it('throws again after resetToasts() clears the singleton', () => {
        const instance = new ToastService();

        initialiseToasts(instance);
        resetToasts();

        expect(() => toasts()).toThrow('toast service accessed before initialisation');
    });
});
