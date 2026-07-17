/**
 * Unit tests for confirm-service.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';

import { ConfirmService } from './confirm-service';

describe('ConfirmService', () => {
    describe('initial state', () => {
        it('starts with no active confirmation', () => {
            const service = new ConfirmService();

            expect(service.active.value).toBeNull();
        });
    });

    describe('confirm', () => {
        it('surfaces the request immediately when no dialog is open', () => {
            const service = new ConfirmService();

            service.confirm({ title: 'title', message: 'msg' });

            expect(service.active.value).toMatchObject({ title: 'title', message: 'msg', id: 'confirm-1' });
        });

        it('assigns incrementing ids to successive requests', () => {
            const service = new ConfirmService();

            service.confirm({ title: 'first', message: 'msg' });

            expect(service.active.value?.id).toBe('confirm-1');

            service.settle(true);

            service.confirm({ title: 'second', message: 'msg' });

            expect(service.active.value?.id).toBe('confirm-2');
        });

        it('queues a second request while the first is active', () => {
            const service = new ConfirmService();

            service.confirm({ title: 'first', message: 'msg' });
            service.confirm({ title: 'second', message: 'msg' });

            expect(service.active.value?.title).toBe('first');
        });

        it('returns a promise that resolves to true when confirmed', async () => {
            const service = new ConfirmService();
            const promise = service.confirm({ title: 'title', message: 'msg' });

            service.settle(true);

            await expect(promise).resolves.toBe(true);
        });

        it('returns a promise that resolves to false when cancelled', async () => {
            const service = new ConfirmService();
            const promise = service.confirm({ title: 'title', message: 'msg' });

            service.settle(false);

            await expect(promise).resolves.toBe(false);
        });

        it('includes optional labels in the active request', () => {
            const service = new ConfirmService();

            service.confirm({
                title: 'title',
                message: 'msg',
                confirmLabel: 'confirm.btn',
                cancelLabel: 'cancel.btn',
            });

            expect(service.active.value?.confirmLabel).toBe('confirm.btn');
            expect(service.active.value?.cancelLabel).toBe('cancel.btn');
        });
    });

    describe('settle', () => {
        it('clears the active request after settling', async () => {
            const service = new ConfirmService();
            const promise = service.confirm({ title: 'title', message: 'msg' });

            service.settle(true);

            await promise;

            expect(service.active.value).toBeNull();
        });

        it('is a no-op when there is no active request', () => {
            const service = new ConfirmService();

            expect(() => service.settle(true)).not.toThrow();
            expect(service.active.value).toBeNull();
        });

        it('surfaces the next queued request after settling', async () => {
            const service = new ConfirmService();

            const first = service.confirm({ title: 'first', message: 'msg' });
            service.confirm({ title: 'second', message: 'msg' });

            service.settle(true);

            await first;

            expect(service.active.value?.title).toBe('second');
        });

        it('resolves queued promises in FIFO order', async () => {
            const service = new ConfirmService();

            const first = service.confirm({ title: 'first', message: 'msg' });
            const second = service.confirm({ title: 'second', message: 'msg' });
            const third = service.confirm({ title: 'third', message: 'msg' });

            service.settle(true);
            await first;

            service.settle(false);
            await second;

            service.settle(true);
            await third;

            const [firstResult, secondResult, thirdResult] = await Promise.all([first, second, third]);

            expect(firstResult).toBe(true);
            expect(secondResult).toBe(false);
            expect(thirdResult).toBe(true);
        });

        it('clears the queue fully - no active request after settling the last', async () => {
            const service = new ConfirmService();

            const first = service.confirm({ title: 'first', message: 'msg' });
            const second = service.confirm({ title: 'second', message: 'msg' });

            service.settle(true);
            await first;

            service.settle(false);
            await second;

            expect(service.active.value).toBeNull();
        });

        it('assigns a fresh id to each queued request when surfaced', async () => {
            const service = new ConfirmService();

            const first = service.confirm({ title: 'first', message: 'msg' });
            service.confirm({ title: 'second', message: 'msg' });

            expect(service.active.value?.id).toBe('confirm-1');

            service.settle(true);
            await first;

            expect(service.active.value?.id).toBe('confirm-2');
        });
    });
});
