/**
 * Unit tests for the confirm service.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { ConfirmService } from '@sinemacula/web-core/notifications/confirm-service';
import { afterEach, describe, expect, it } from 'vitest';
import { confirmDialogs, initialiseConfirm, resetConfirm } from '@/services/confirm';

describe('confirm service', () => {
    afterEach(() => {
        resetConfirm();
    });

    it('returns the installed service after initialisation', () => {
        const instance = new ConfirmService();

        initialiseConfirm(instance);

        expect(confirmDialogs()).toBe(instance);
    });

    it('throws before initialisation when confirmDialogs() is called', () => {
        expect(() => confirmDialogs()).toThrow('confirmation dialog service accessed before initialisation');
    });

    it('throws again after resetConfirm() clears the singleton', () => {
        const instance = new ConfirmService();

        initialiseConfirm(instance);
        resetConfirm();

        expect(() => confirmDialogs()).toThrow('confirmation dialog service accessed before initialisation');
    });
});
