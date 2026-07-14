/**
 * Unit tests for wire-monitors.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { describe, expect, it, vi } from 'vitest';

import { ToastService } from '../notifications/toast-service';
import type { UpdateMonitor } from '../updates/update-monitor';
import { WebCoreAppError } from './web-core-app-error';
import type { MonitorWiringSettings, WireMonitorsOptions } from './wire-monitors';
import { wireMonitors } from './wire-monitors';

const THROW_MESSAGE =
    'Update monitoring is enabled but cannot surface updates: ' +
    'provide monitors.updates.toastKey or monitors.updates.onUpdate.';

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

function makeFetch(version: string) {
    return vi.fn<(url: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () =>
        versionResponse(version),
    );
}

interface Harness {
    readonly settings: MonitorWiringSettings;
    readonly service: ToastService;
    readonly toasts: () => ToastService;
    readonly fetchFn: ReturnType<typeof makeFetch>;
    readonly options: WireMonitorsOptions<MonitorWiringSettings>;
}

function makeHarness(
    overrides: Partial<WireMonitorsOptions<MonitorWiringSettings>> = {},
    deployedVersion = '2.0.0',
): Harness {
    const settings: MonitorWiringSettings = { app: { version: '1.0.0' } };
    const service = new ToastService();
    const toasts = vi.fn(() => service);
    const fetchFn = makeFetch(deployedVersion);
    const options: WireMonitorsOptions<MonitorWiringSettings> = {
        settings,
        runtimeUrl: '/runtime-env.json',
        toasts,
        fetchFn,
        targetDocument: document.implementation.createHTMLDocument('t'),
        ...overrides,
    };

    return { settings, service, toasts, fetchFn, options };
}

describe('wireMonitors update monitoring', () => {
    it('stays off when neither a toast key nor an update handler is provided', () => {
        const { options } = makeHarness();

        const { updates, connectivity } = wireMonitors(options);

        expect(updates).toBeNull();
        expect(connectivity).toBeNull();
    });

    it('stays off for the dev version sentinel', () => {
        const { options } = makeHarness({
            settings: { app: { version: 'dev' } },
            updates: { toastKey: 'app.updates.available' },
        });

        const { updates, connectivity } = wireMonitors(options);

        expect(updates).toBeNull();
        expect(connectivity).toBeNull();
    });

    it('arms with a toast key on release builds and raises a sticky toast on a new version', async () => {
        const { options, service, toasts } = makeHarness({ updates: { toastKey: 'app.updates.available' } });

        const { updates, connectivity } = wireMonitors(options);

        expect(updates).not.toBeNull();
        expect(toasts).not.toHaveBeenCalled();

        await updates?.checkNow();

        expect(toasts).toHaveBeenCalledTimes(1);
        expect(service.toasts.value).toHaveLength(1);
        expect(service.toasts.value[0]?.message).toBe('app.updates.available');
        expect(service.toasts.value[0]?.variant).toBe('information');
        expect(service.toasts.value[0]?.duration).toBe(0);

        updates?.stop();
        connectivity?.stop();
    });

    it('prefers the onUpdate handler over the toast key', async () => {
        const onUpdate = vi.fn();
        const { options, service, toasts } = makeHarness({
            updates: { toastKey: 'app.updates.available', onUpdate },
        });

        const { updates, connectivity } = wireMonitors(options);

        await updates?.checkNow();

        expect(onUpdate).toHaveBeenCalledWith('2.0.0');
        expect(toasts).not.toHaveBeenCalled();
        expect(service.toasts.value).toHaveLength(0);

        updates?.stop();
        connectivity?.stop();
    });

    it('polls the runtime environment url by default', async () => {
        const { options, fetchFn } = makeHarness({ updates: { toastKey: 'app.updates.available' } });

        const { updates, connectivity } = wireMonitors(options);

        await updates?.checkNow();

        expect(fetchFn).toHaveBeenCalledWith('/runtime-env.json', {
            cache: 'no-store',
            headers: { accept: 'application/json' },
        });

        updates?.stop();
        connectivity?.stop();
    });

    it('polls the configured url instead of the runtime default', async () => {
        const { options, fetchFn } = makeHarness({
            updates: { toastKey: 'app.updates.available', url: '/version.json' },
        });

        const { updates, connectivity } = wireMonitors(options);

        await updates?.checkNow();

        expect(fetchFn).toHaveBeenCalledWith('/version.json', {
            cache: 'no-store',
            headers: { accept: 'application/json' },
        });

        updates?.stop();
        connectivity?.stop();
    });

    it('starts polling on the configured interval', async () => {
        vi.useFakeTimers();

        try {
            const { options, fetchFn } = makeHarness({
                updates: { toastKey: 'app.updates.available', pollIntervalMs: 1_000 },
            });

            const { updates, connectivity } = wireMonitors(options);

            expect(fetchFn).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(999);

            expect(fetchFn).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(1);

            expect(fetchFn).toHaveBeenCalledTimes(1);

            updates?.stop();
            connectivity?.stop();
        } finally {
            vi.useRealTimers();
        }
    });

    it('arms when enabled is explicitly true despite the dev sentinel', () => {
        const { options } = makeHarness({
            settings: { app: { version: 'dev' } },
            updates: { enabled: true, toastKey: 'app.updates.available' },
        });

        const { updates, connectivity } = wireMonitors(options);

        expect(updates).not.toBeNull();

        updates?.stop();
        connectivity?.stop();
    });

    it('stays off when enabled is explicitly false', () => {
        const { options } = makeHarness({ updates: { enabled: false, toastKey: 'app.updates.available' } });

        const { updates } = wireMonitors(options);

        expect(updates).toBeNull();
    });

    it('passes the frozen settings to an enabled predicate', () => {
        const enabled = vi.fn((settings: Readonly<MonitorWiringSettings>) => settings.app.version === '1.0.0');
        const { options, settings } = makeHarness({ updates: { enabled, toastKey: 'app.updates.available' } });

        const { updates, connectivity } = wireMonitors(options);

        expect(updates).not.toBeNull();
        expect(enabled).toHaveBeenCalledTimes(1);
        expect(enabled.mock.calls[0]?.[0]).toBe(settings);

        updates?.stop();
        connectivity?.stop();
    });

    it('stays off when an enabled predicate returns false', () => {
        const { options } = makeHarness({ updates: { enabled: () => false, toastKey: 'app.updates.available' } });

        const { updates } = wireMonitors(options);

        expect(updates).toBeNull();
    });

    it('throws when enabled is explicitly true with no way to surface updates', () => {
        const { options } = makeHarness({ updates: { enabled: true } });

        expect(() => wireMonitors(options)).toThrowError(WebCoreAppError);
        expect(() => wireMonitors(options)).toThrow(THROW_MESSAGE);
    });

    it('names the error WebCoreAppError', () => {
        const { options } = makeHarness({ updates: { enabled: true } });

        try {
            wireMonitors(options);
            expect.unreachable('wireMonitors must throw');
        } catch (error) {
            expect((error as Error).name).toBe('WebCoreAppError');
        }
    });

    it('throws when an enabled predicate returns true with no way to surface updates', () => {
        const { options } = makeHarness({ updates: { enabled: () => true } });

        expect(() => wireMonitors(options)).toThrow(THROW_MESSAGE);
    });

    it('does not throw when an enabled predicate returns false with no way to surface updates', () => {
        const { options } = makeHarness({ updates: { enabled: () => false } });

        expect(wireMonitors(options)).toEqual({ updates: null, connectivity: null });
    });
});

describe('wireMonitors connectivity', () => {
    it('pauses and resumes update polling with connectivity by default', () => {
        const { options } = makeHarness({ updates: { toastKey: 'app.updates.available' } });

        const { updates, connectivity } = wireMonitors(options);

        expect(connectivity).not.toBeNull();

        const stopSpy = vi.spyOn(updates as UpdateMonitor, 'stop');
        const startSpy = vi.spyOn(updates as UpdateMonitor, 'start');

        window.dispatchEvent(new Event('offline'));

        expect(stopSpy).toHaveBeenCalledTimes(1);

        window.dispatchEvent(new Event('online'));

        expect(startSpy).toHaveBeenCalledTimes(1);

        connectivity?.stop();
        updates?.stop();
    });

    it('stays off when disabled explicitly while updates run', () => {
        const { options } = makeHarness({
            updates: { toastKey: 'app.updates.available' },
            connectivity: { enabled: false },
        });

        const { updates, connectivity } = wireMonitors(options);

        expect(updates).not.toBeNull();
        expect(connectivity).toBeNull();

        updates?.stop();
    });

    it('runs without an update monitor when enabled explicitly', () => {
        const { options } = makeHarness({ connectivity: { enabled: true }, targetWindow: window });

        const { updates, connectivity } = wireMonitors(options);

        expect(updates).toBeNull();
        expect(connectivity).not.toBeNull();
        expect(() => {
            window.dispatchEvent(new Event('offline'));
            window.dispatchEvent(new Event('online'));
        }).not.toThrow();

        connectivity?.stop();
    });

    it('uses the platform defaults when no seams are given', () => {
        const { updates, connectivity } = wireMonitors({
            settings: { app: { version: '1.0.0' } },
            runtimeUrl: '/runtime-env.json',
            toasts: () => new ToastService(),
            updates: { toastKey: 'app.updates.available' },
        });

        expect(updates).not.toBeNull();
        expect(connectivity).not.toBeNull();

        updates?.stop();
        connectivity?.stop();
    });
});
