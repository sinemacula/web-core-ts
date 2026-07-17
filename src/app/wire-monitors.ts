/**
 * Update and connectivity monitor wiring for the bootstrap preset.
 *
 * The update monitor polls the deployed version and surfaces new releases
 * through an application-supplied sticky toast key or handler - the kernel
 * ships no translation keys, so without one of those the monitor stays off.
 * Enabling it explicitly while providing neither is a configuration error and
 * boot fails loudly. The connectivity monitor pauses update polling while the
 * browser is offline and resumes it when connectivity returns.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { ConnectivityMonitor } from '../connectivity/connectivity-monitor';
import type { ToastService } from '../notifications/toast-service';
import { UpdateMonitor } from '../updates/update-monitor';
import { WebCoreAppError } from './web-core-app-error';

const DEV_VERSION_SENTINEL = 'dev';

/**
 * The configuration slice the monitor wiring reads.
 */
export interface MonitorWiringSettings {

    /** Application identity carrying the deployed version. */
    readonly app: {
        /** The deployed application version. */
        readonly version: string;
    };
}

/**
 * Update-monitor options accepted by {@link wireMonitors}.
 */
export interface UpdateMonitorWiring<T> {

    /** Whether the update monitor runs. Default: the deployed version is not 'dev'. */
    readonly enabled?: boolean | ((settings: Readonly<T>) => boolean);

    /** The version document location. Defaults to the runtime environment URL. */
    readonly url?: string;

    /** Poll interval in milliseconds. */
    readonly pollIntervalMs?: number;

    /** Application-owned toast key shown sticky (duration 0) on a new version. */
    readonly toastKey?: string;

    /** Full handler for new versions; wins over `toastKey`. */
    readonly onUpdate?: (version: string) => void;
}

/**
 * Options for {@link wireMonitors}.
 */
export interface WireMonitorsOptions<T extends MonitorWiringSettings> {

    /** The frozen application configuration. */
    readonly settings: Readonly<T>;

    /** Update-monitor options; omit to take the version-derived defaults. */
    readonly updates?: UpdateMonitorWiring<T>;

    /** Connectivity monitoring; defaults to on exactly when the update monitor runs. */
    readonly connectivity?: {
        /** Whether connectivity monitoring runs. */
        readonly enabled?: boolean;
    };

    /** The runtime environment document URL, the update monitor's default poll target. */
    readonly runtimeUrl: string;

    /** Toast service accessor, read lazily per update rather than at wiring time. */
    readonly toasts: () => ToastService;

    /** The fetch seam used to poll the version document. */
    readonly fetchFn?: typeof fetch;

    /** The window whose connectivity events are observed. */
    readonly targetWindow?: Window;

    /** The document the update monitor watches for visibility. */
    readonly targetDocument?: Document;
}

/**
 * The wired monitors; either is null when disabled.
 */
export interface WiredMonitors {

    /** The running update monitor, or null when it does not run. */
    readonly updates: UpdateMonitor | null;

    /** The running connectivity monitor, or null when disabled. */
    readonly connectivity: ConnectivityMonitor | null;
}

/**
 * Wire the update and connectivity monitors.
 *
 * @param options - the configuration, monitor options and platform seams
 * @returns the started monitors, each null when disabled
 * @throws {WebCoreAppError} when updates are explicitly enabled with neither a
 * toast key nor an update handler
 */
export function wireMonitors<T extends MonitorWiringSettings>(options: WireMonitorsOptions<T>): WiredMonitors {
    const updates = wireUpdates(options);

    return { updates, connectivity: wireConnectivity(options, updates) };
}

/**
 * Wire the deployed-version monitor.
 *
 * @param options - the monitor wiring options
 * @returns the started monitor, or null when it does not run
 * @throws {WebCoreAppError} when updates are explicitly enabled with neither a
 * toast key nor an update handler
 */
function wireUpdates<T extends MonitorWiringSettings>(options: WireMonitorsOptions<T>): UpdateMonitor | null {
    const wiring = options.updates;
    const handler = resolveUpdateHandler(wiring, options.toasts);
    const enabled = resolveUpdatesEnabled(wiring?.enabled, options.settings);

    if (handler === null) {
        if (wiring?.enabled !== undefined && enabled) {
            throw new WebCoreAppError(
                'Update monitoring is enabled but cannot surface updates: ' +
                    'provide monitors.updates.toastKey or monitors.updates.onUpdate.',
            );
        }

        return null;
    }

    if (!enabled) {
        return null;
    }

    const monitor = new UpdateMonitor({
        currentVersion: options.settings.app.version,
        url: wiring?.url ?? options.runtimeUrl,
        ...(wiring?.pollIntervalMs === undefined ? {} : { interval: wiring.pollIntervalMs }),
        ...(options.fetchFn === undefined ? {} : { fetchFn: options.fetchFn }),
        ...(options.targetDocument === undefined ? {} : { targetDocument: options.targetDocument }),
    });

    monitor.onUpdate(handler);
    monitor.start();

    return monitor;
}

/**
 * Resolve what happens when a new version is deployed.
 *
 * @param wiring - the update-monitor options
 * @param toasts - the lazy toast service accessor
 * @returns the update handler, or null when the application supplied none
 */
function resolveUpdateHandler<T>(
    wiring: UpdateMonitorWiring<T> | undefined,
    toasts: () => ToastService,
): ((version: string) => void) | null {
    if (wiring?.onUpdate !== undefined) {
        return wiring.onUpdate;
    }

    const toastKey = wiring?.toastKey;

    if (toastKey === undefined) {
        return null;
    }

    return () => {
        toasts().information(toastKey, { duration: 0 });
    };
}

/**
 * Resolve the update monitor's enabled state.
 *
 * @param enabled - the caller's flag or predicate, when provided
 * @param settings - the frozen application configuration
 * @returns whether the monitor should run
 */
function resolveUpdatesEnabled<T extends MonitorWiringSettings>(
    enabled: boolean | ((settings: Readonly<T>) => boolean) | undefined,
    settings: Readonly<T>,
): boolean {
    if (enabled === undefined) {
        return settings.app.version !== DEV_VERSION_SENTINEL;
    }

    return typeof enabled === 'boolean' ? enabled : enabled(settings);
}

/**
 * Wire the connectivity monitor, pausing update polling while offline.
 *
 * @param options - the monitor wiring options
 * @param updates - the running update monitor, or null when it does not run
 * @returns the started monitor, or null when disabled
 */
function wireConnectivity<T extends MonitorWiringSettings>(
    options: WireMonitorsOptions<T>,
    updates: UpdateMonitor | null,
): ConnectivityMonitor | null {
    const enabled = options.connectivity?.enabled ?? updates !== null;

    if (!enabled) {
        return null;
    }

    const monitor = new ConnectivityMonitor({
        ...(options.targetWindow === undefined ? {} : { targetWindow: options.targetWindow }),
    });

    if (updates !== null) {
        monitor.onChange(online => {
            if (online) {
                updates.start();
            } else {
                updates.stop();
            }
        });
    }

    monitor.start();

    return monitor;
}
