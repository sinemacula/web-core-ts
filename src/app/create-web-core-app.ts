/**
 * Bootstrap preset assembling a complete web application from the kernel.
 *
 * `createWebCoreApp` runs a fixed sequence of boot phases over the kernel's
 * primitives: it fetches the runtime environment document, freezes the
 * application configuration, installs every kernel service singleton, runs
 * the module lifecycle (register, stores, boot), and wires i18n, routing,
 * observability, chunk recovery, realtime and the release monitors. Every
 * subsystem is overridable through the options and every platform dependency
 * is injectable, so applications boot with a declarative options object and
 * tests drive the full sequence through seams. The returned handle mounts
 * the application after the router is ready and disposes everything the
 * boot installed in reverse order.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { Pinia } from 'pinia';
import { createPinia } from 'pinia';
import type { App, Component } from 'vue';
import { createApp } from 'vue';
import type { Router, RouterHistory } from 'vue-router';

import type { AnalyticsTracker } from '../analytics/analytics-tracker';
import { installPageTracking } from '../analytics/install-page-tracking';
import { ConfigRepository } from '../config/config-repository';
import type { Environment } from '../config/environment';
import { RUNTIME_ENVIRONMENT_URL, fetchRuntimeEnvironment } from '../config/runtime-environment';
import type { ConnectivityMonitor } from '../connectivity/connectivity-monitor';
import type { FeatureFlags } from '../feature-flags/feature-flags';
import { StaticFeatureFlags } from '../feature-flags/static-feature-flags';
import type { HttpClient, RequestInterceptor, ResponseErrorHandler } from '../http/http-client';
import type { ApplicationI18n, LocaleFormats, LocaleSwitcher } from '../i18n/application-i18n';
import type { Logger } from '../logging/logger';
import type { LocaleMessages, ModuleDefinition, ResolvedPlatform } from '../module/module';
import type { ModuleHttpContributions } from '../module/module-registry';
import { bootModules, createModuleRegistry, registerModules } from '../module/module-registry';
import { ConfirmService } from '../notifications/confirm-service';
import { ToastService } from '../notifications/toast-service';
import type { RealtimeConnection } from '../realtime/realtime-connection';
import type { ErrorReporter } from '../reporting/error-reporter';
import { installGlobalErrorHandling } from '../reporting/install-global-error-handling';
import { BrowserStorage } from '../storage/browser-storage';
import type { KeyValueStorage } from '../storage/key-value-storage';
import type { UpdateMonitor } from '../updates/update-monitor';
import {
    installConfig,
    installConfirm,
    installFeatureFlags,
    installRealtime,
    installStorage,
    installToasts,
    toasts,
} from './services';
import type { WebCoreConfig } from './web-core-config';
import { wireChunkRecovery } from './wire-chunk-recovery';
import type { WireHttpClientTools } from './wire-http-client';
import { wireHttpClient } from './wire-http-client';
import type { WiredLocale } from './wire-locale';
import { wireLocale } from './wire-locale';
import type { UpdateMonitorWiring, WiredMonitors } from './wire-monitors';
import { wireMonitors } from './wire-monitors';
import type { WiredObservability } from './wire-observability';
import { wireObservability } from './wire-observability';
import { wireRouter } from './wire-router';

const DEFAULT_MOUNT_SELECTOR = '#app';

// Internal by design: phase insertions must never be breaking API changes.
const BOOT_PHASES = [
    'runtime-environment',
    'configuration',
    'storage',
    'module-registry',
    'application',
    'feature-flags',
    'notifications',
    'observability',
    'register-modules',
    'http-client',
    'stores',
    'locale',
    'router',
    'error-handling',
    'boot-modules',
    'chunk-recovery',
    'realtime',
    'monitors',
] as const;

type BootPhase = (typeof BOOT_PHASES)[number];

let phaseRecorder: ((phase: BootPhase) => void) | null = null;

/**
 * Test-only: observe the name of every executed boot phase, in order.
 *
 * @param recorder - receives each phase name as the boot reaches it
 * @returns a remover that detaches the recorder
 */
export function observeBootPhases(recorder: (phase: string) => void): () => void {
    phaseRecorder = recorder;

    return () => {
        phaseRecorder = null;
    };
}

/**
 * Report a phase to the installed test recorder, when one is attached.
 *
 * @param phase - the phase being entered
 */
function recordPhase(phase: BootPhase): void {
    phaseRecorder?.(phase);
}

/**
 * Configuration construction options.
 */
export interface WebCoreConfigOptions<T extends WebCoreConfig> {
    /**
     * Caller-owned environment construction - the only place build-time
     * variables may appear. Receives the fetched runtime document; throw to
     * abort boot. Pair with `createWebEnvironment` for the standard
     * dev-chain and production required-keys behaviour.
     */
    readonly createEnvironment: (runtime: Readonly<Record<string, string>>) => Environment;

    /** Configuration definition over the environment; the result is deep-frozen. */
    readonly define: (environment: Environment) => T;

    /**
     * One URL for both the runtime-environment fetch and the update
     * monitor's default poll target. Default '/runtime-env.json'.
     */
    readonly runtimeUrl?: string;
}

/**
 * HTTP client construction options.
 */
export interface WebCoreHttpOptions<T extends WebCoreConfig> {
    /** Preset-level interceptors; module contributions are appended after these. */
    readonly interceptors?: readonly RequestInterceptor[];

    /** Full replacement of the preset response-error handler. */
    readonly onResponseError?: ResponseErrorHandler;

    /** Arms the default handler's toast; the kernel ships no translation keys. */
    readonly unexpectedErrorToastKey?: string;

    /** Full adapter override; receives the resolved construction inputs. */
    readonly client?: (tools: WireHttpClientTools<T>) => HttpClient;
}

/**
 * Internationalisation options.
 */
export interface WebCoreI18nOptions {
    /** Shared (non-module) translation loaders keyed by locale. */
    readonly sharedLoaders?: Readonly<Record<string, () => Promise<LocaleMessages>>>;

    /** Datetime and number formats installed on the i18n instance. */
    readonly formats?: LocaleFormats;

    /** The storage key the locale preference persists under. Default 'locale'. */
    readonly localeStorageKey?: string;

    /**
     * Behaviour when a module name shadows a shared top-level translation
     * key. Default 'error'; 'module-wins' restores the shadowing merge.
     */
    readonly duplicateNamespaceStrategy?: 'error' | 'module-wins';
}

/**
 * Observability adapter factories; without one the local environment gets
 * console adapters and every other environment gets the null adapters.
 */
export interface WebCoreObservabilityOptions<T extends WebCoreConfig> {
    readonly reporter?: (settings: Readonly<T>) => ErrorReporter;
    readonly analytics?: (settings: Readonly<T>) => AnalyticsTracker;
    readonly logger?: (settings: Readonly<T>) => Logger;
}

/**
 * State-only notification services; rendering hosts stay application-side.
 */
export interface WebCoreNotificationOptions {
    readonly toasts?: ToastService;
    readonly confirm?: ConfirmService;
}

/**
 * Chunk-load-failure recovery tuning.
 */
export interface WebCoreChunkRecoveryOptions {
    /** Whether recovery is installed at all. Default true. */
    readonly enabled?: boolean;

    /** Performs the recovery reload; defaults to a full document navigation. */
    readonly reload?: (path: string) => void;

    /** The reload-loop guard window in milliseconds. */
    readonly windowMs?: number;
}

/**
 * Release monitoring options.
 */
export interface WebCoreMonitorOptions<T extends WebCoreConfig> {
    readonly updates?: UpdateMonitorWiring<T>;

    /** Connectivity monitoring; defaults to on exactly when the update monitor runs. */
    readonly connectivity?: { readonly enabled?: boolean };

    readonly chunkRecovery?: WebCoreChunkRecoveryOptions;
}

/**
 * Platform seams threaded to every subsystem that accepts them.
 */
export interface WebCorePlatformOptions {
    readonly fetchFn?: typeof fetch;

    /** The application storage adapter; defaults to browser local storage. */
    readonly storage?: KeyValueStorage;

    readonly targetWindow?: Window;
    readonly targetDocument?: Document;

    /** Resolves the current time; defaults to `Date.now`. */
    readonly clock?: () => number;

    /** The router history implementation; defaults to web history. */
    readonly history?: RouterHistory;

    /** Preferred locales, most preferred first; defaults to `navigator.languages`. */
    readonly localeCandidates?: readonly string[];
}

/**
 * Options accepted by {@link createWebCoreApp}.
 */
export interface WebCoreAppOptions<T extends WebCoreConfig> {
    /** Root component mounted by {@link WebCoreApp.start}. */
    readonly root: Component;

    /** Explicit ordered module list, validated by the module registry. */
    readonly modules: readonly ModuleDefinition[];

    /** Injectable for tests; defaults to a fresh pinia instance. */
    readonly pinia?: Pinia;

    readonly config: WebCoreConfigOptions<T>;
    readonly http?: WebCoreHttpOptions<T>;
    readonly i18n?: WebCoreI18nOptions;
    readonly observability?: WebCoreObservabilityOptions<T>;

    /** Feature-flag provider factory; defaults to the config-driven static adapter. */
    readonly featureFlags?: (settings: Readonly<T>) => FeatureFlags;

    /**
     * Opt-in realtime connection, installed into the realtime holder and
     * disconnected on dispose. No default - the kernel knows no endpoint.
     */
    readonly realtime?: (settings: Readonly<T>) => RealtimeConnection;

    readonly notifications?: WebCoreNotificationOptions;
    readonly monitors?: WebCoreMonitorOptions<T>;
    readonly platform?: WebCorePlatformOptions;
}

/**
 * Direct typed references to every service the preset installed.
 */
export interface WebCoreServices<T> {
    readonly config: ConfigRepository<T & Record<string, unknown>>;
    readonly http: HttpClient;
    readonly storage: KeyValueStorage;
    readonly toasts: ToastService;
    readonly confirm: ConfirmService;
    readonly reporting: ErrorReporter;
    readonly analytics: AnalyticsTracker;
    readonly logger: Logger;
    readonly featureFlags: FeatureFlags;
    readonly localeSwitcher: LocaleSwitcher;
    readonly realtime: RealtimeConnection | null;
}

/**
 * The assembled application handle returned by {@link createWebCoreApp}.
 */
export interface WebCoreApp<T extends WebCoreConfig> {
    readonly app: App<Element>;
    readonly router: Router;
    readonly pinia: Pinia;
    readonly i18n: ApplicationI18n;

    /** The frozen configuration tree. */
    readonly config: Readonly<T>;

    readonly services: WebCoreServices<T>;

    readonly monitors: {
        readonly updates: UpdateMonitor | null;
        readonly connectivity: ConnectivityMonitor | null;
    };

    /**
     * Await router readiness, then mount - initialisation completes strictly
     * before any component renders.
     *
     * @param selector - the mount target; default '#app'
     */
    start(selector?: string | Element): Promise<void>;

    /**
     * Idempotently tear down everything the boot installed, in reverse:
     * monitors, realtime disconnect, chunk recovery, module boot teardowns,
     * store disposals, then the page-tracking, global-error-handling and
     * title-sync uninstalls. Service holders are left installed;
     * `resetWebCoreServices` is the separate test affordance.
     */
    dispose(): void;
}

/**
 * Boot a web application through the kernel's phase sequence.
 *
 * @param options - the application's modules, configuration and overrides
 * @returns the assembled application handle, ready to start
 * @throws {ModuleRegistryError} when the module list fails validation
 * @throws {WebCoreAppError} when the monitor options cannot work
 */
export async function createWebCoreApp<T extends WebCoreConfig>(
    options: WebCoreAppOptions<T>,
): Promise<WebCoreApp<T>> {
    const platform = resolvePlatform(options.platform);
    const runtimeUrl = options.config.runtimeUrl ?? RUNTIME_ENVIRONMENT_URL;

    recordPhase('runtime-environment');

    const runtime = await fetchRuntimeEnvironment(platform.fetchFn, runtimeUrl);

    recordPhase('configuration');

    const environment = options.config.createEnvironment(runtime);
    const repository = new ConfigRepository(options.config.define(environment) as T & Record<string, unknown>);
    const settings: Readonly<T> = repository.all();

    installConfig(repository);

    recordPhase('storage');

    const storage = options.platform?.storage ?? new BrowserStorage(platform.targetWindow.localStorage);

    installStorage(storage);

    recordPhase('module-registry');

    const registry = createModuleRegistry(options.modules);

    recordPhase('application');

    const app = createApp(options.root);
    const pinia = options.pinia ?? createPinia();

    app.use(pinia);

    recordPhase('feature-flags');

    const flags = options.featureFlags?.(settings) ?? new StaticFeatureFlags(settings.featureFlags.flags);

    installFeatureFlags(flags);

    recordPhase('notifications');

    const toastService = options.notifications?.toasts ?? new ToastService();
    const confirmService = options.notifications?.confirm ?? new ConfirmService();

    installToasts(toastService);
    installConfirm(confirmService);

    recordPhase('observability');

    const observability = resolveObservability(settings, options.observability);

    recordPhase('register-modules');

    const contributions = registerModules(registry.modules, {
        config: repository,
        environment,
        storage,
        pinia,
        platform,
    });

    recordPhase('http-client');

    const http = resolveHttpClient(settings, platform.fetchFn, contributions, options.http);

    recordPhase('stores');

    const storeHandles = registry.modules.flatMap(definition =>
        (definition.stores ?? []).map(factory => factory(pinia)),
    );

    recordPhase('locale');

    const { i18n, switcher } = await resolveLocale(settings, registry.modules, storage, platform, options);

    app.use(i18n);

    recordPhase('router');

    const { router, titleSyncTeardown } = wireRouter({
        modules: registry.modules,
        i18n,
        appName: settings.app.name,
        ...(options.platform?.history === undefined ? {} : { history: options.platform.history }),
        targetDocument: platform.targetDocument,
    });

    app.use(router);

    recordPhase('error-handling');

    const errorHandlingTeardown = installGlobalErrorHandling({
        app,
        reporter: observability.reporter,
        trail: observability.trail,
        targetWindow: platform.targetWindow,
    });
    const pageTrackingTeardown = installPageTracking({
        router,
        tracker: observability.analytics,
        trail: observability.trail,
    });

    recordPhase('boot-modules');

    const moduleTeardown = await bootModules(registry.modules, {
        app,
        router,
        pinia,
        i18n,
        http,
        storage,
        config: repository,
        platform,
    });

    recordPhase('chunk-recovery');

    const chunkRecoveryTeardown = resolveChunkRecovery(
        router,
        storage,
        observability.reporter,
        platform.clock,
        options.monitors?.chunkRecovery,
    );

    recordPhase('realtime');

    const realtimeConnection = options.realtime === undefined ? null : options.realtime(settings);

    if (realtimeConnection !== null) {
        installRealtime(realtimeConnection);
    }

    recordPhase('monitors');

    const monitors = resolveMonitors(settings, runtimeUrl, platform, options.monitors);

    let disposed = false;

    return {
        app,
        router,
        pinia,
        i18n,
        config: settings,
        services: {
            config: repository,
            http,
            storage,
            toasts: toastService,
            confirm: confirmService,
            reporting: observability.reporter,
            analytics: observability.analytics,
            logger: observability.logger,
            featureFlags: flags,
            localeSwitcher: switcher,
            realtime: realtimeConnection,
        },
        monitors,
        async start(selector: string | Element = DEFAULT_MOUNT_SELECTOR): Promise<void> {
            await router.isReady();

            app.mount(selector);
        },
        dispose(): void {
            if (disposed) {
                return;
            }

            disposed = true;

            monitors.connectivity?.stop();
            monitors.updates?.stop();
            realtimeConnection?.disconnect();
            chunkRecoveryTeardown?.();
            moduleTeardown();

            for (const handle of [...storeHandles].reverse()) {
                handle.$dispose();
            }

            pageTrackingTeardown();
            errorHandlingTeardown();
            titleSyncTeardown();
        },
    };
}

/**
 * Resolve the platform seams handed to every subsystem and module hook.
 *
 * @param platform - the caller's overrides, when any were provided
 * @returns the fully-resolved platform
 */
function resolvePlatform(platform: WebCorePlatformOptions | undefined): ResolvedPlatform {
    return {
        fetchFn: platform?.fetchFn ?? ((input, init) => globalThis.fetch(input, init)),
        targetWindow: platform?.targetWindow ?? globalThis.window,
        targetDocument: platform?.targetDocument ?? globalThis.document,
        clock: platform?.clock ?? ((): number => Date.now()),
    };
}

/**
 * Resolve and install the observability services.
 *
 * @param settings - the frozen application configuration
 * @param factories - the caller's adapter factories, when any were provided
 * @returns the installed instances plus the breadcrumb trail
 */
function resolveObservability<T extends WebCoreConfig>(
    settings: Readonly<T>,
    factories: WebCoreObservabilityOptions<T> | undefined,
): WiredObservability {
    return wireObservability({
        config: settings,
        ...(factories?.reporter === undefined ? {} : { reporter: factories.reporter }),
        ...(factories?.analytics === undefined ? {} : { analytics: factories.analytics }),
        ...(factories?.logger === undefined ? {} : { logger: factories.logger }),
    });
}

/**
 * Build and install the application HTTP client.
 *
 * @param settings - the frozen application configuration
 * @param fetchFn - the resolved fetch seam
 * @param contributions - the register phase's module HTTP contributions
 * @param http - the caller's HTTP options, when any were provided
 * @returns the installed HTTP client
 */
function resolveHttpClient<T extends WebCoreConfig>(
    settings: Readonly<T>,
    fetchFn: typeof fetch,
    contributions: ModuleHttpContributions,
    http: WebCoreHttpOptions<T> | undefined,
): HttpClient {
    return wireHttpClient({
        config: settings,
        fetchFn,
        contributions,
        ...(http?.interceptors === undefined ? {} : { interceptors: http.interceptors }),
        ...(http?.onResponseError === undefined ? {} : { onResponseError: http.onResponseError }),
        ...(http?.unexpectedErrorToastKey === undefined
            ? {}
            : { unexpectedErrorToastKey: http.unexpectedErrorToastKey }),
        ...(http?.client === undefined ? {} : { client: http.client }),
    });
}

/**
 * Wire internationalisation and install the locale switcher.
 *
 * @param settings - the frozen application configuration
 * @param modules - the registry's ordered module list
 * @param storage - the application storage adapter
 * @param platform - the resolved platform seams
 * @param options - the full boot options carrying the i18n and locale seams
 * @returns the i18n instance and the installed locale switcher
 */
function resolveLocale<T extends WebCoreConfig>(
    settings: Readonly<T>,
    modules: readonly ModuleDefinition[],
    storage: KeyValueStorage,
    platform: ResolvedPlatform,
    options: WebCoreAppOptions<T>,
): Promise<WiredLocale> {
    const i18n = options.i18n;

    return wireLocale({
        config: settings,
        modules,
        ...(i18n?.sharedLoaders === undefined ? {} : { sharedLoaders: i18n.sharedLoaders }),
        ...(i18n?.formats === undefined ? {} : { formats: i18n.formats }),
        ...(i18n?.localeStorageKey === undefined ? {} : { localeStorageKey: i18n.localeStorageKey }),
        ...(i18n?.duplicateNamespaceStrategy === undefined
            ? {}
            : { duplicateNamespaceStrategy: i18n.duplicateNamespaceStrategy }),
        storage,
        localeCandidates: options.platform?.localeCandidates ?? [...platform.targetWindow.navigator.languages],
        targetDocument: platform.targetDocument,
    });
}

/**
 * Wire chunk-load-failure recovery onto the router.
 *
 * @param router - the application router
 * @param storage - the application storage adapter
 * @param reporter - the installed error reporter
 * @param clock - the resolved clock seam
 * @param tuning - the caller's recovery tuning, when any was provided
 * @returns the teardown removing the error handler, or null when disabled
 */
function resolveChunkRecovery(
    router: Router,
    storage: KeyValueStorage,
    reporter: ErrorReporter,
    clock: () => number,
    tuning: WebCoreChunkRecoveryOptions | undefined,
): (() => void) | null {
    return wireChunkRecovery({
        router,
        storage,
        reporter,
        clock,
        ...(tuning?.enabled === undefined ? {} : { enabled: tuning.enabled }),
        ...(tuning?.reload === undefined ? {} : { reload: tuning.reload }),
        ...(tuning?.windowMs === undefined ? {} : { windowMs: tuning.windowMs }),
    });
}

/**
 * Wire the update and connectivity monitors.
 *
 * @param settings - the frozen application configuration
 * @param runtimeUrl - the runtime document URL, the default poll target
 * @param platform - the resolved platform seams
 * @param monitors - the caller's monitor options, when any were provided
 * @returns the started monitors, each null when disabled
 */
function resolveMonitors<T extends WebCoreConfig>(
    settings: Readonly<T>,
    runtimeUrl: string,
    platform: ResolvedPlatform,
    monitors: WebCoreMonitorOptions<T> | undefined,
): WiredMonitors {
    return wireMonitors({
        settings,
        runtimeUrl,
        toasts,
        ...(monitors?.updates === undefined ? {} : { updates: monitors.updates }),
        ...(monitors?.connectivity === undefined ? {} : { connectivity: monitors.connectivity }),
        fetchFn: platform.fetchFn,
        targetWindow: platform.targetWindow,
        targetDocument: platform.targetDocument,
    });
}
