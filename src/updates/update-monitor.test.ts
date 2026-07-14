/**
 * Unit tests for update-monitor.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UpdateMonitor } from './update-monitor';

/**
 * Build a `Record<string, string>` from an array of `[key, value]` pairs.
 *
 * Wraps `Object.fromEntries` so callers can write wire-field names as plain
 * string literals inside array elements rather than as object-literal keys -
 * keeping non-camelCase environment keys out of any position that Biome's
 * naming-convention or literal-keys rules inspect.
 *
 * @param entries - key-value pairs for the record
 * @returns a plain `Record<string, string>`
 */
function wire(entries: ReadonlyArray<readonly [string, string]>): Record<string, string> {
    return Object.fromEntries(entries);
}

function versionResponse(version: string): Response {
    return new Response(JSON.stringify(wire([['APP_VERSION', version]])), {
        status: 200,
        headers: { 'content-type': 'application/json' },
    });
}

function makeFetch(impl: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
    return vi.fn<(url: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(impl);
}

describe('UpdateMonitor', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('notifies subscribers when the deployed version changes', async () => {
        const fetchFn = makeFetch(async () => versionResponse('2.0.0'));
        const monitor = new UpdateMonitor({ currentVersion: '1.0.0', fetchFn });
        const handler = vi.fn();

        monitor.onUpdate(handler);
        await monitor.checkNow();

        expect(handler).toHaveBeenCalledWith('2.0.0');
    });

    it('does not notify when the deployed version matches the booted version', async () => {
        const fetchFn = makeFetch(async () => versionResponse('1.0.0'));
        const monitor = new UpdateMonitor({ currentVersion: '1.0.0', fetchFn });
        const handler = vi.fn();

        monitor.onUpdate(handler);
        await monitor.checkNow();

        expect(handler).not.toHaveBeenCalled();
    });

    it('notifies once per new version across repeated checks', async () => {
        const fetchFn = makeFetch(async () => versionResponse('2.0.0'));
        const monitor = new UpdateMonitor({ currentVersion: '1.0.0', fetchFn });
        const handler = vi.fn();

        monitor.onUpdate(handler);
        await monitor.checkNow();
        await monitor.checkNow();

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('ignores non-ok responses', async () => {
        const fetchFn = makeFetch(() => Promise.resolve(new Response('{}', { status: 404 })));
        const monitor = new UpdateMonitor({ currentVersion: '1.0.0', fetchFn });
        const handler = vi.fn();

        monitor.onUpdate(handler);
        await monitor.checkNow();

        expect(handler).not.toHaveBeenCalled();
    });

    it('ignores transport failures', async () => {
        const fetchFn = makeFetch(() => Promise.reject(new Error('offline')));
        const monitor = new UpdateMonitor({ currentVersion: '1.0.0', fetchFn });
        const handler = vi.fn();

        monitor.onUpdate(handler);
        await monitor.checkNow();

        expect(handler).not.toHaveBeenCalled();
    });

    it('ignores documents without a usable version', async () => {
        const fetchFn = makeFetch(
            async () =>
                new Response('{"other":true}', { status: 200, headers: { 'content-type': 'application/json' } }),
        );
        const monitor = new UpdateMonitor({ currentVersion: '1.0.0', fetchFn });
        const handler = vi.fn();

        monitor.onUpdate(handler);
        await monitor.checkNow();

        expect(handler).not.toHaveBeenCalled();
    });

    it('ignores empty version strings', async () => {
        const fetchFn = makeFetch(async () => versionResponse(''));
        const monitor = new UpdateMonitor({ currentVersion: '1.0.0', fetchFn });
        const handler = vi.fn();

        monitor.onUpdate(handler);
        await monitor.checkNow();

        expect(handler).not.toHaveBeenCalled();
    });

    it('supports a custom url, interval and version extractor', async () => {
        const fetchFn = makeFetch(
            async () =>
                new Response('{"release":"5"}', { status: 200, headers: { 'content-type': 'application/json' } }),
        );
        const extractVersion = (payload: unknown): string | null =>
            typeof payload === 'object' && payload !== null && 'release' in payload
                ? String((payload as Record<string, unknown>).release)
                : null;
        const monitor = new UpdateMonitor({
            currentVersion: '1',
            url: '/version.json',
            interval: 1_000,
            fetchFn,
            extractVersion,
        });
        const handler = vi.fn();

        monitor.onUpdate(handler);
        monitor.start();
        await vi.advanceTimersByTimeAsync(1_000);

        expect(fetchFn).toHaveBeenCalledWith('/version.json', expect.objectContaining({ cache: 'no-store' }));
        expect(handler).toHaveBeenCalledWith('5');

        monitor.stop();
    });

    it('polls on the default interval once started and stops cleanly', async () => {
        const fetchFn = makeFetch(async () => versionResponse('1.0.0'));
        const monitor = new UpdateMonitor({ currentVersion: '1.0.0', fetchFn });

        monitor.start();
        monitor.start();
        await vi.advanceTimersByTimeAsync(300_000);

        expect(fetchFn).toHaveBeenCalledTimes(1);

        monitor.stop();
        monitor.stop();
        await vi.advanceTimersByTimeAsync(600_000);

        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('checks when the document becomes visible', () => {
        const fetchFn = makeFetch(() => Promise.resolve(versionResponse('1.0.0')));
        const monitor = new UpdateMonitor({ currentVersion: '1.0.0', fetchFn, targetDocument: document });

        monitor.start();
        document.dispatchEvent(new Event('visibilitychange'));

        expect(fetchFn).toHaveBeenCalledTimes(1);

        monitor.stop();
        document.dispatchEvent(new Event('visibilitychange'));

        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('does not check while the document is hidden', () => {
        const fetchFn = makeFetch(async () => versionResponse('2.0.0'));
        const listeners = new Map<string, EventListener>();
        const hiddenDocument = {
            visibilityState: 'hidden',
            addEventListener: (type: string, listener: EventListener) => {
                listeners.set(type, listener);
            },
            removeEventListener: () => {
                // Not exercised in this test.
            },
        } as unknown as Document;
        const monitor = new UpdateMonitor({ currentVersion: '1.0.0', fetchFn, targetDocument: hiddenDocument });

        monitor.start();
        listeners.get('visibilitychange')?.(new Event('visibilitychange'));

        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('ignores documents that are not records', async () => {
        const fetchFn = makeFetch(
            async () => new Response('[1,2]', { status: 200, headers: { 'content-type': 'application/json' } }),
        );
        const monitor = new UpdateMonitor({ currentVersion: '1.0.0', fetchFn });
        const handler = vi.fn();

        monitor.onUpdate(handler);
        await monitor.checkNow();

        expect(handler).not.toHaveBeenCalled();
    });

    it('stops delivering to unsubscribed handlers', async () => {
        const fetchFn = makeFetch(async () => versionResponse('2.0.0'));
        const monitor = new UpdateMonitor({ currentVersion: '1.0.0', fetchFn });
        const handler = vi.fn();

        const unsubscribe = monitor.onUpdate(handler);
        unsubscribe();
        await monitor.checkNow();

        expect(handler).not.toHaveBeenCalled();
    });

    it('uses the global fetch when no fetch function is provided', async () => {
        const stub = makeFetch(() => Promise.resolve(versionResponse('3.0.0')));
        vi.stubGlobal('fetch', stub);

        const monitor = new UpdateMonitor({ currentVersion: '1.0.0' });
        const handler = vi.fn();

        monitor.onUpdate(handler);
        await monitor.checkNow();

        expect(handler).toHaveBeenCalledWith('3.0.0');
    });

    it('keeps polling when a subscriber throws', async () => {
        const fetchFn = makeFetch(() => Promise.resolve(versionResponse('2.0.0')));
        const monitor = new UpdateMonitor({ currentVersion: '1.0.0', fetchFn, interval: 1_000 });

        monitor.onUpdate(() => {
            throw new Error('subscriber failure');
        });
        monitor.start();
        await vi.advanceTimersByTimeAsync(1_000);

        expect(fetchFn).toHaveBeenCalledTimes(1);

        monitor.stop();
    });
});
