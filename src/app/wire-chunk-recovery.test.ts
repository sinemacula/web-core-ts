/**
 * Unit tests for wire-chunk-recovery.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import type { RouteRecordRaw, Router } from 'vue-router';
import { createMemoryHistory, createRouter } from 'vue-router';

import type { ErrorReporter } from '../reporting/error-reporter';
import { MemoryStorage } from '../storage/memory-storage';
import { wireChunkRecovery } from './wire-chunk-recovery';

const EmptyComponent = defineComponent({ render: () => null });

function chunkImportError(): TypeError {
    return new TypeError('Failed to fetch dynamically imported module: http://example.com/assets/broken.js');
}

function buildRouter(brokenLoader: () => Promise<never>): Router {
    const routes: RouteRecordRaw[] = [
        { path: '/', component: EmptyComponent },
        { path: '/broken', component: brokenLoader },
    ];

    return createRouter({ history: createMemoryHistory(), routes });
}

function fakeReporter(): ErrorReporter {
    return { captureError: vi.fn(), captureMessage: vi.fn(), setUser: vi.fn() };
}

async function navigateToBroken(router: Router): Promise<void> {
    await router.push('/broken').catch(() => {
        // The router's own promise rejects alongside the onError handler under test.
    });
}

describe('wireChunkRecovery', () => {
    it('installs recovery by default and reloads on the first chunk-load failure', async () => {
        const router = buildRouter(() => Promise.reject(chunkImportError()));
        const storage = new MemoryStorage();
        const reload = vi.fn();

        const teardown = wireChunkRecovery({
            router,
            storage,
            reporter: fakeReporter(),
            reload,
            clock: () => 1_000,
        });

        await navigateToBroken(router);

        expect(typeof teardown).toBe('function');
        expect(reload).toHaveBeenCalledWith('/broken');
        expect(storage.get('chunk-recovery./broken')).toBe('1000');
    });

    it('returns null and installs nothing when disabled', async () => {
        const router = buildRouter(() => Promise.reject(chunkImportError()));
        const storage = new MemoryStorage();
        const reporter = fakeReporter();
        const reload = vi.fn();

        const teardown = wireChunkRecovery({ router, storage, reporter, enabled: false, reload });

        await navigateToBroken(router);

        expect(teardown).toBeNull();
        expect(reload).not.toHaveBeenCalled();
        expect(reporter.captureError).not.toHaveBeenCalled();
        expect(storage.get('chunk-recovery./broken')).toBeNull();
    });

    it('installs recovery when enabled explicitly', async () => {
        const router = buildRouter(() => Promise.reject(chunkImportError()));
        const storage = new MemoryStorage();
        const reload = vi.fn();

        wireChunkRecovery({ router, storage, reporter: fakeReporter(), enabled: true, reload, clock: () => 1_000 });

        await navigateToBroken(router);

        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('threads the clock and recovery window through to the reload-loop guard', async () => {
        const router = buildRouter(() => Promise.reject(chunkImportError()));
        const storage = new MemoryStorage();
        const reporter = fakeReporter();
        const reload = vi.fn();
        let now = 1_000;

        wireChunkRecovery({ router, storage, reporter, reload, clock: () => now, windowMs: 5_000 });

        await navigateToBroken(router);

        now += 4_999;
        await navigateToBroken(router);

        expect(reload).toHaveBeenCalledTimes(1);
        expect(reporter.captureError).toHaveBeenCalledWith(expect.any(TypeError), {
            source: 'router',
            path: '/broken',
        });

        now += 1;
        await navigateToBroken(router);

        expect(reload).toHaveBeenCalledTimes(2);
        expect(storage.get('chunk-recovery./broken')).toBe('6000');
    });

    it('forwards non-chunk router errors to the reporter with the default tuning', async () => {
        const router = buildRouter(() => Promise.reject(new Error('exploded while parsing props')));
        const storage = new MemoryStorage();
        const reporter = fakeReporter();

        wireChunkRecovery({ router, storage, reporter });

        await navigateToBroken(router);

        expect(reporter.captureError).toHaveBeenCalledWith(expect.any(Error), { source: 'router', path: '/broken' });
        expect(storage.get('chunk-recovery./broken')).toBeNull();
    });

    it('returns a teardown that removes the error handler', async () => {
        const router = buildRouter(() => Promise.reject(chunkImportError()));
        const storage = new MemoryStorage();
        const reporter = fakeReporter();
        const reload = vi.fn();

        const teardown = wireChunkRecovery({ router, storage, reporter, reload, clock: () => 1_000 });

        teardown?.();

        await navigateToBroken(router);

        expect(reload).not.toHaveBeenCalled();
        expect(reporter.captureError).not.toHaveBeenCalled();
    });
});
