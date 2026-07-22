/**
 * Unit tests for chunk-error-recovery.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import type { RouteRecordRaw, Router } from 'vue-router';
import { createMemoryHistory, createRouter } from 'vue-router';

import type { ErrorReporter } from '../reporting/error-reporter';
import { MemoryStorage } from '@sinemacula/foundation/storage/memory-storage';
import { installChunkErrorRecovery, isChunkLoadError } from './chunk-error-recovery';

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
        // The router's own promise rejects alongside the onError handler under
        // test.
    });
}

describe('installChunkErrorRecovery', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('reloads at the target path on the first chunk-load failure and stamps the recovery window', async () => {
        const router = buildRouter(() => Promise.reject(chunkImportError()));
        const storage = new MemoryStorage();
        const reload = vi.fn();
        const clock = () => 1_000;

        installChunkErrorRecovery({ router, storage, reload, clock, windowMs: 60_000 });
        await navigateToBroken(router);

        expect(reload).toHaveBeenCalledWith('/broken');
        expect(storage.get('chunk-recovery./broken')).toBe('1000');
    });

    it('does not reload and reports when the same path fails again inside the window', async () => {
        const router = buildRouter(() => Promise.reject(chunkImportError()));
        const storage = new MemoryStorage();
        const reload = vi.fn();
        const reporter = fakeReporter();
        let now = 1_000;
        const clock = () => now;

        installChunkErrorRecovery({ router, storage, reporter, reload, clock, windowMs: 60_000 });
        await navigateToBroken(router);

        now += 30_000;
        await navigateToBroken(router);

        expect(reload).toHaveBeenCalledTimes(1);
        expect(reporter.captureError).toHaveBeenCalledWith(expect.any(TypeError), {
            source: 'router',
            path: '/broken',
        });
    });

    it('reloads again once the recovery window has elapsed', async () => {
        const router = buildRouter(() => Promise.reject(chunkImportError()));
        const storage = new MemoryStorage();
        const reload = vi.fn();
        let now = 1_000;
        const clock = () => now;

        installChunkErrorRecovery({ router, storage, reload, clock, windowMs: 60_000 });
        await navigateToBroken(router);

        now += 60_000;
        await navigateToBroken(router);

        expect(reload).toHaveBeenCalledTimes(2);
        expect(storage.get('chunk-recovery./broken')).toBe('61000');
    });

    it('reports without reloading when the router error is not a chunk-load failure', async () => {
        const router = buildRouter(() => Promise.reject(new Error('exploded while parsing props')));
        const storage = new MemoryStorage();
        const reload = vi.fn();
        const reporter = fakeReporter();

        installChunkErrorRecovery({ router, storage, reporter, reload, clock: () => 1_000 });
        await navigateToBroken(router);

        expect(reload).not.toHaveBeenCalled();
        expect(reporter.captureError).toHaveBeenCalledWith(expect.any(Error), { source: 'router', path: '/broken' });
    });

    it('does not throw when no reporter is present for a non-chunk error', async () => {
        const router = buildRouter(() => Promise.reject(new Error('exploded while parsing props')));
        const storage = new MemoryStorage();
        const reload = vi.fn();

        installChunkErrorRecovery({ router, storage, reload, clock: () => 1_000 });
        await navigateToBroken(router);

        expect(reload).not.toHaveBeenCalled();
    });

    it('does not throw when no reporter is present for a chunk error inside the recovery window', async () => {
        const router = buildRouter(() => Promise.reject(chunkImportError()));
        const storage = new MemoryStorage();
        const reload = vi.fn();
        let now = 1_000;
        const clock = () => now;

        installChunkErrorRecovery({ router, storage, reload, clock, windowMs: 60_000 });
        await navigateToBroken(router);

        now += 1_000;
        await navigateToBroken(router);

        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('uses the default window of sixty seconds when none is provided', async () => {
        const router = buildRouter(() => Promise.reject(chunkImportError()));
        const storage = new MemoryStorage();
        const reload = vi.fn();
        const reporter = fakeReporter();
        let now = 0;
        const clock = () => now;

        installChunkErrorRecovery({ router, storage, reporter, reload, clock });
        await navigateToBroken(router);

        now += 59_999;
        await navigateToBroken(router);

        expect(reload).toHaveBeenCalledTimes(1);
        expect(reporter.captureError).toHaveBeenCalledTimes(1);

        now += 1;
        await navigateToBroken(router);

        expect(reload).toHaveBeenCalledTimes(2);
    });

    it('uses Date.now as the default clock when none is provided', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(5_000);

        try {
            const router = buildRouter(() => Promise.reject(chunkImportError()));
            const storage = new MemoryStorage();
            const reload = vi.fn();

            installChunkErrorRecovery({ router, storage, reload });
            await navigateToBroken(router);

            expect(storage.get('chunk-recovery./broken')).toBe('5000');
        } finally {
            vi.useRealTimers();
        }
    });

    it('returns a teardown that removes the error handler', async () => {
        const router = buildRouter(() => Promise.reject(chunkImportError()));
        const storage = new MemoryStorage();
        const reload = vi.fn();
        const reporter = fakeReporter();

        const teardown = installChunkErrorRecovery({ router, storage, reporter, reload, clock: () => 1_000 });
        teardown();

        await navigateToBroken(router);

        expect(reload).not.toHaveBeenCalled();
        expect(reporter.captureError).not.toHaveBeenCalled();
        expect(storage.get('chunk-recovery./broken')).toBeNull();
    });

    it('stops recovering after teardown while earlier recoveries stand', async () => {
        const router = buildRouter(() => Promise.reject(chunkImportError()));
        const storage = new MemoryStorage();
        const reload = vi.fn();
        let now = 1_000;
        const clock = () => now;

        const teardown = installChunkErrorRecovery({ router, storage, reload, clock, windowMs: 60_000 });
        await navigateToBroken(router);

        expect(reload).toHaveBeenCalledTimes(1);

        teardown();
        now += 60_000;
        await navigateToBroken(router);

        expect(reload).toHaveBeenCalledTimes(1);
        expect(storage.get('chunk-recovery./broken')).toBe('1000');
    });

    it('reloads via a full document navigation to globalThis.location when no reload function is provided', async () => {
        const location = { href: '' };
        vi.stubGlobal('location', location);

        const router = buildRouter(() => Promise.reject(chunkImportError()));
        const storage = new MemoryStorage();

        installChunkErrorRecovery({ router, storage, clock: () => 1_000 });
        await navigateToBroken(router);

        expect(location.href).toBe('/broken');
    });
});

describe('isChunkLoadError', () => {
    it('matches a failed dynamic import message', () => {
        expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: /assets/chunk.js'))).toBe(true);
    });

    it('matches a dynamic import loading error message', () => {
        expect(isChunkLoadError(new Error('Error loading dynamically imported module'))).toBe(true);
    });

    it('matches a module script import failure message', () => {
        expect(isChunkLoadError(new Error('Importing a module script failed'))).toBe(true);
    });

    it('returns false for an unrelated error message', () => {
        expect(isChunkLoadError(new Error('exploded while parsing props'))).toBe(false);
    });

    it('returns false for non-Error values', () => {
        expect(isChunkLoadError('failed to fetch dynamically imported module')).toBe(false);
        expect(isChunkLoadError({ message: 'failed to fetch dynamically imported module' })).toBe(false);
        expect(isChunkLoadError(null)).toBe(false);
        expect(isChunkLoadError(undefined)).toBe(false);
    });
});
