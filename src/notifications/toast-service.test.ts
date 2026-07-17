/**
 * Unit tests for toast-service.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastService } from './toast-service';

describe('ToastService', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('constructor', () => {
        it('initialises with an empty toast list', () => {
            const service = new ToastService();

            expect(service.toasts.value).toStrictEqual([]);
        });

        it('accepts a custom default duration', () => {
            const service = new ToastService(1_000);
            const id = service.show('success', 'msg');

            expect(service.toasts.value).toHaveLength(1);

            vi.advanceTimersByTime(1_000);

            expect(service.toasts.value).toHaveLength(0);
            expect(id).toBe('toast-1');
        });
    });

    describe('show', () => {
        it('adds a toast and returns its id', () => {
            const service = new ToastService();
            const id = service.show('success', 'hello');

            expect(id).toBe('toast-1');
            expect(service.toasts.value).toHaveLength(1);
            expect(service.toasts.value[0]).toMatchObject({ id: 'toast-1', variant: 'success', message: 'hello' });
        });

        it('ids increment across calls', () => {
            const service = new ToastService();

            expect(service.show('success', 'a')).toBe('toast-1');
            expect(service.show('error', 'b')).toBe('toast-2');
            expect(service.show('information', 'c')).toBe('toast-3');
        });

        it('uses the per-show duration override', () => {
            const service = new ToastService(5_000);
            service.show('success', 'msg', { duration: 1_000 });

            vi.advanceTimersByTime(999);

            expect(service.toasts.value).toHaveLength(1);

            vi.advanceTimersByTime(1);

            expect(service.toasts.value).toHaveLength(0);
        });

        it('uses the default duration when no override is given', () => {
            const service = new ToastService(5_000);
            service.show('success', 'msg');

            vi.advanceTimersByTime(4_999);

            expect(service.toasts.value).toHaveLength(1);

            vi.advanceTimersByTime(1);

            expect(service.toasts.value).toHaveLength(0);
        });

        it('records the duration on the toast', () => {
            const service = new ToastService(5_000);
            service.show('success', 'msg', { duration: 3_000 });

            expect(service.toasts.value[0]?.duration).toBe(3_000);
        });

        it('does not schedule a timer when duration is 0 (sticky)', () => {
            const service = new ToastService(0);
            service.show('success', 'sticky');

            vi.advanceTimersByTime(60_000);

            expect(service.toasts.value).toHaveLength(1);
        });

        it('auto-dismisses using the default 5 000 ms when constructed with no argument', () => {
            const service = new ToastService();
            service.show('success', 'msg');

            vi.advanceTimersByTime(5_000);

            expect(service.toasts.value).toHaveLength(0);
        });

        it('multiple toasts are auto-dismissed independently', () => {
            const service = new ToastService();
            service.show('success', 'a', { duration: 1_000 });
            service.show('error', 'b', { duration: 2_000 });

            vi.advanceTimersByTime(1_000);

            expect(service.toasts.value).toHaveLength(1);
            expect(service.toasts.value[0]?.message).toBe('b');

            vi.advanceTimersByTime(1_000);

            expect(service.toasts.value).toHaveLength(0);
        });
    });

    describe('success / error / information / warning', () => {
        it('success delegates to show with success variant', () => {
            const service = new ToastService();
            const id = service.success('msg');

            expect(id).toBe('toast-1');
            expect(service.toasts.value[0]?.variant).toBe('success');
        });

        it('error delegates to show with error variant', () => {
            const service = new ToastService();
            const id = service.error('msg');

            expect(id).toBe('toast-1');
            expect(service.toasts.value[0]?.variant).toBe('error');
        });

        it('information delegates to show with information variant', () => {
            const service = new ToastService();
            const id = service.information('msg');

            expect(id).toBe('toast-1');
            expect(service.toasts.value[0]?.variant).toBe('information');
        });

        it('warning delegates to show with warning variant', () => {
            const service = new ToastService();
            const id = service.warning('msg');

            expect(id).toBe('toast-1');
            expect(service.toasts.value[0]?.variant).toBe('warning');
        });

        it('convenience methods forward options to show', () => {
            const service = new ToastService(5_000);
            service.success('msg', { duration: 500 });

            vi.advanceTimersByTime(500);

            expect(service.toasts.value).toHaveLength(0);
        });
    });

    describe('dismiss', () => {
        it('removes a toast by id', () => {
            const service = new ToastService();
            const id = service.show('success', 'msg', { duration: 0 });

            service.dismiss(id);

            expect(service.toasts.value).toHaveLength(0);
        });

        it('is a no-op for an unknown id', () => {
            const service = new ToastService();
            service.show('success', 'msg', { duration: 0 });

            service.dismiss('toast-unknown');

            expect(service.toasts.value).toHaveLength(1);
        });

        it('cancels the auto-dismiss timer so the toast does not reappear/double-dismiss', () => {
            const service = new ToastService();
            const id = service.show('success', 'msg', { duration: 1_000 });

            service.dismiss(id);

            expect(service.toasts.value).toHaveLength(0);

            // Advancing the clock should not throw or re-add the toast
            vi.advanceTimersByTime(2_000);

            expect(service.toasts.value).toHaveLength(0);
        });

        it('does not affect other toasts', () => {
            const service = new ToastService();
            const id1 = service.show('success', 'a', { duration: 0 });
            service.show('error', 'b', { duration: 0 });

            service.dismiss(id1);

            expect(service.toasts.value).toHaveLength(1);
            expect(service.toasts.value[0]?.message).toBe('b');
        });
    });

    describe('clear', () => {
        it('removes all toasts', () => {
            const service = new ToastService();
            service.show('success', 'a', { duration: 0 });
            service.show('error', 'b', { duration: 0 });

            service.clear();

            expect(service.toasts.value).toHaveLength(0);
        });

        it('cancels all pending auto-dismiss timers', () => {
            const service = new ToastService();
            service.show('success', 'a', { duration: 1_000 });
            service.show('error', 'b', { duration: 2_000 });

            service.clear();

            vi.advanceTimersByTime(5_000);

            expect(service.toasts.value).toHaveLength(0);
        });

        it('is a no-op on an already-empty list', () => {
            const service = new ToastService();

            expect(() => service.clear()).not.toThrow();
            expect(service.toasts.value).toHaveLength(0);
        });
    });
});
