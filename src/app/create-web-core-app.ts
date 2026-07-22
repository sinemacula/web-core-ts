/**
 * Bootstrap preset assembling a complete web application from the kernel.
 *
 * `createWebCoreApp` runs a fixed sequence of boot phases over the kernel's
 * primitives: it fetches the runtime environment document, freezes the
 * application configuration, installs every kernel service singleton, runs the
 * module lifecycle (register, stores, boot), and wires i18n, routing,
 * observability, chunk recovery, realtime and the release monitors. Every
 * subsystem is overridable through the options and every platform dependency is
 * injectable, so applications boot with a declarative options object and tests
 * drive the full sequence through seams. The returned handle mounts the
 * application after the router is ready and disposes everything the boot
 * installed in reverse order.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { Pinia } from 'pinia';
import { createPinia } from 'pinia';
import type { App, Component } from 'vue';
import { createApp } from 'vue';
import type { Router, RouterHistory } from 'vue-router';

import type { AnalyticsTracker } from '@sinemacula/foundation/analytics/analytics-tracker';
import { installPageTracking } from '../analytics/install-page-tracking';
import { ConfigRepository } from '@sinemacula/foundation/config/config-repository';
import type { Environment } from '@sinemacula/foundation/config/environment';
import { RUNTIME_ENVIRONMENT_URL, fetchRuntimeEnvironment } from '../config/runtime-environment';
import type { ConnectivityMonitor } from '../connectivity/connectivity-monitor';
import type { FeatureFlags } from '@sinemacula/foundation/feature-flags/feature-flags';
import { StaticFeatureFlags } from '@sinemacula/foundation/feature-flags/static-feature-flags';
import type { HttpClient, RequestInterceptor, ResponseErrorHandler } from '@sinemacula/foundation/http/http-client';
import type { ApplicationI18n, LocaleFormats, LocaleSwitcher } from '../i18n/application-i18n';
import type { Logger } from '@sinemacula/foundation/logging/logger';
import type { LocaleMessages, ModuleDefinition, ModuleStoreFactory, ResolvedPlatform } from '../module/module';
import type { ModuleHttpContributions, ModuleRegistry } from '../module/module-registry';
import { bootModules, createModuleRegistry, registerModules } from '../module/module-registry';
import { ConfirmService } from '../notifications/confirm-service';
import { ToastService } from '../notifications/toast-service';
import type { RealtimeConnection } from '@sinemacula/foundation/realtime/realtime-connection';
import type { ErrorReporter } from '@sinemacula/foundation/reporting/error-reporter';
import { installGlobalErrorHandling } from '../reporting/install-global-error-handling';
import { BrowserStorage } from '../storage/browser-storage';
import type { KeyValueStorage } from '@sinemacula/foundation/storage/key-value-storage';
import type { ColorSchemePreference } from '../theme/color-scheme';
import type { ColorSchemeService } from '../theme/color-scheme-service';
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
import { wireColorScheme } from './wire-color-scheme';
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
    'color-scheme',
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
 * Not part of the supported public surface: the phase names and their order are
 * internal and may change without notice.
 *
 * @internal
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
    /** Caller-owned environment construction - the only place build-time variables may appear. Receives the fetched runtime document; throw to abort boot. Pair with `createWebEnvironment` for the standard dev-chain and production required-keys behaviour. */
    readonly createEnvironment: (runtime: Readonly<Record<string, string>>) => Environment;

    /** Configuration definition over the environment; the result is deep-frozen. */
    readonly define: (environment: Environment) => T;

    /** One URL for both the runtime-environment fetch and the update monitor's default poll target. Default '/runtime-env.json'. */
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

    /** Behaviour when a module name shadows a shared top-level translation key. Default 'error'; 'module-wins' restores the shadowing merge. */
    readonly duplicateNamespaceStrategy?: 'error' | 'module-wins';
}

/**
 * Colour-scheme options.
 */
export interface WebCoreColorSchemeOptions {
    /** The preference applied when nothing is stored. Default 'system'. */
    readonly defaultPreference?: ColorSchemePreference;

    /** The storage key the preference persists under. Default 'theme'. */
    readonly storageKey?: string;

    /** The surface-page colours applied to the `theme-color` meta tag. */
    readonly themeColors?: {
        /** The colour applied in the light scheme. */
        readonly light: string;

        /** The colour applied in the dark scheme. */
        readonly dark: string;
    };
}

/**
 * Observability adapter factories; without one the local environment gets
 * console adapters and every other environment gets the null adapters.
 */
export interface WebCoreObservabilityOptions<T extends WebCoreConfig> {
    /** Error-reporter factory; wins over the environment default. */
    readonly reporter?: (settings: Readonly<T>) => ErrorReporter;

    /** Analytics-tracker factory; wins over the environment default. */
    readonly analytics?: (settings: Readonly<T>) => AnalyticsTracker;

    /** Logger factory; wins over the environment default. */
    readonly logger?: (settings: Readonly<T>) => Logger;
}

/**
 * State-only notification services; rendering hosts stay application-side.
 */
export interface WebCoreNotificationOptions {
    /** Replacement toast service; defaults to a fresh state-only service. */
    readonly toasts?: ToastService;

    /** Replacement confirm service; defaults to a fresh state-only service. */
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
    /** Update-monitor options; omit to take the version-derived defaults. */
    readonly updates?: UpdateMonitorWiring<T>;

    /** Connectivity monitoring; defaults to on exactly when the update monitor runs. */
    readonly connectivity?: {
        /** Whether connectivity monitoring runs. */
        readonly enabled?: boolean;
    };

    /** Chunk-load-failure recovery tuning. */
    readonly chunkRecovery?: WebCoreChunkRecoveryOptions;
}

/**
 * Platform seams threaded to every subsystem that accepts them.
 */
export interface WebCorePlatformOptions {
    /** The fetch implementation; defaults to the global `fetch`. */
    readonly fetchFn?: typeof fetch;

    /** The application storage adapter; defaults to browser local storage. */
    readonly storage?: KeyValueStorage;

    /** The window seam; defaults to the global `window`. */
    readonly targetWindow?: Window;

    /** The document seam; defaults to the global `document`. */
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

    /** Configuration construction options. */
    readonly config: WebCoreConfigOptions<T>;

    /** HTTP client construction options. */
    readonly http?: WebCoreHttpOptions<T>;

    /** Internationalisation options. */
    readonly i18n?: WebCoreI18nOptions;

    /** Colour-scheme options. */
    readonly colorScheme?: WebCoreColorSchemeOptions;

    /** Observability adapter factories. */
    readonly observability?: WebCoreObservabilityOptions<T>;

    /** Feature-flag provider factory; defaults to the config-driven static adapter. */
    readonly featureFlags?: (settings: Readonly<T>) => FeatureFlags;

    /** Opt-in realtime connection, installed into the realtime holder and disconnected on dispose. No default - the kernel knows no endpoint. */
    readonly realtime?: (settings: Readonly<T>) => RealtimeConnection;

    /** State-only notification services. */
    readonly notifications?: WebCoreNotificationOptions;

    /** Release monitoring options. */
    readonly monitors?: WebCoreMonitorOptions<T>;

    /** Platform seams threaded to every subsystem. */
    readonly platform?: WebCorePlatformOptions;
}

/**
 * Direct typed references to every service the preset installed.
 */
export interface WebCoreServices<T> {
    /** The application configuration repository. */
    readonly config: ConfigRepository<T & Record<string, unknown>>;

    /** The installed HTTP client. */
    readonly http: HttpClient;

    /** The application storage adapter. */
    readonly storage: KeyValueStorage;

    /** The toast notification service. */
    readonly toasts: ToastService;

    /** The confirmation dialog service. */
    readonly confirm: ConfirmService;

    /** The installed error reporter. */
    readonly reporting: ErrorReporter;

    /** The installed analytics tracker. */
    readonly analytics: AnalyticsTracker;

    /** The installed logger. */
    readonly logger: Logger;

    /** The feature-flag provider. */
    readonly featureFlags: FeatureFlags;

    /** The runtime locale switcher. */
    readonly localeSwitcher: LocaleSwitcher;

    /** The colour-scheme service. */
    readonly colorScheme: ColorSchemeService;

    /** The realtime connection, or null when none was installed. */
    readonly realtime: RealtimeConnection | null;
}

/**
 * The assembled application handle returned by {@link createWebCoreApp}.
 */
export interface WebCoreApp<T extends WebCoreConfig> {
    /** The Vue application instance. */
    readonly app: App<Element>;

    /** The application router. */
    readonly router: Router;

    /** The Pinia instance backing the stores. */
    readonly pinia: Pinia;

    /** The i18n instance. */
    readonly i18n: ApplicationI18n;

    /** The frozen configuration tree. */
    readonly config: Readonly<T>;

    /** Direct typed references to every service the preset installed. */
    readonly services: WebCoreServices<T>;

    /** The release monitors, each null when it does not run. */
    readonly monitors: {
        /** The running update monitor, or null when it does not run. */
        readonly updates: UpdateMonitor | null;

        /** The running connectivity monitor, or null when disabled. */
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
 * The kernel services and Vue application produced by the foundation phases.
 */
interface AppFoundation<T extends WebCoreConfig> {
    /** The constructed runtime environment. */
    readonly environment: Environment;

    /** The frozen configuration repository. */
    readonly repository: ConfigRepository<T & Record<string, unknown>>;

    /** The frozen configuration tree. */
    readonly settings: Readonly<T>;

    /** The installed storage adapter. */
    readonly storage: KeyValueStorage;

    /** The installed colour-scheme service. */
    readonly colorScheme: ColorSchemeService;

    /** The validated module registry. */
    readonly registry: ModuleRegistry;

    /** The Vue application instance. */
    readonly app: App<Element>;

    /** The Pinia instance backing the stores. */
    readonly pinia: Pinia;

    /** The installed feature-flag provider. */
    readonly flags: FeatureFlags;

    /** The installed toast service. */
    readonly toastService: ToastService;

    /** The installed confirm service. */
    readonly confirmService: ConfirmService;

    /** The wired observability instances and breadcrumb trail. */
    readonly observability: WiredObservability;
}

/**
 * The HTTP client, eager store handles and locale wiring from the module
 * phases.
 */
interface ModuleLayer {
    /** The installed HTTP client. */
    readonly http: HttpClient;

    /** The eager store handles instantiated during boot. */
    readonly storeHandles: readonly ReturnType<ModuleStoreFactory>[];

    /** The wired i18n instance. */
    readonly i18n: ApplicationI18n;

    /** The installed runtime locale switcher. */
    readonly switcher: LocaleSwitcher;
}

/**
 * The router and teardown handles from the app-integration phases.
 */
interface AppIntegration {
    /** The wired application router. */
    readonly router: Router;

    /** Removes the document-title synchronisation hook. */
    readonly titleSyncTeardown: () => void;

    /** Removes the global error handling. */
    readonly errorHandlingTeardown: () => void;

    /** Removes the page-tracking subscription. */
    readonly pageTrackingTeardown: () => void;

    /** Runs the module boot teardowns. */
    readonly moduleTeardown: () => void;
}

/**
 * The realtime connection, monitors and chunk-recovery teardown from the
 * release phases.
 */
interface ReleaseLayer {
    /** Removes the chunk-recovery error handler, or null when disabled. */
    readonly chunkRecoveryTeardown: (() => void) | null;

    /** The installed realtime connection, or null when none. */
    readonly realtimeConnection: RealtimeConnection | null;

    /** The started release monitors. */
    readonly monitors: WiredMonitors;
}

/**
 * Boot a web application through the kernel's phase sequence.
 *
 * @param options - the application's modules, configuration and overrides
 * @returns the assembled application handle, ready to start
 * @throws {ModuleRegistryError} when the module list fails validation
 * @throws {WebCoreAppError} when the monitor options cannot work
 */
export async function createWebCoreApp<T extends WebCoreConfig>(options: WebCoreAppOptions<T>): Promise<WebCoreApp<T>> {
    const platform = resolvePlatform(options.platform);
    const runtimeUrl = options.config.runtimeUrl ?? RUNTIME_ENVIRONMENT_URL;

    const foundation = await bootFoundation(options, platform, runtimeUrl);
    const moduleLayer = await bootModuleLayer(options, platform, foundation);
    const integration = await wireAppIntegration(options, platform, foundation, moduleLayer);
    const release = wireReleaseMonitors(options, platform, runtimeUrl, foundation, integration);

    return assembleApp(foundation, moduleLayer, integration, release);
}

/**
 * Run the foundation phases: fetch the runtime environment, freeze the
 * configuration, install storage, feature flags and notifications, create the
 * Vue application, and resolve observability.
 *
 * @param options - the application's modules, configuration and overrides
 * @param platform - the resolved platform seams
 * @param runtimeUrl - the runtime document URL
 * @returns the kernel services and application feeding the later phases
 */
async function bootFoundation<T extends WebCoreConfig>(
    options: WebCoreAppOptions<T>,
    platform: ResolvedPlatform,
    runtimeUrl: string,
): Promise<AppFoundation<T>> {
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

    recordPhase('color-scheme');

    const colorScheme = resolveColorScheme(storage, platform, options);

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

    return {
        environment,
        repository,
        settings,
        storage,
        colorScheme,
        registry,
        app,
        pinia,
        flags,
        toastService,
        confirmService,
        observability,
    };
}

/**
 * Run the module phases: register modules, build the HTTP client, instantiate
 * eager stores, and wire internationalisation.
 *
 * @param options - the application's modules, configuration and overrides
 * @param platform - the resolved platform seams
 * @param foundation - the services and application from the foundation phases
 * @returns the HTTP client, eager store handles and locale wiring
 */
async function bootModuleLayer<T extends WebCoreConfig>(
    options: WebCoreAppOptions<T>,
    platform: ResolvedPlatform,
    foundation: AppFoundation<T>,
): Promise<ModuleLayer> {
    const { settings, repository, environment, storage, registry, app, pinia } = foundation;

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

    return { http, storeHandles, i18n, switcher };
}

/**
 * Run the app-integration phases: wire the router, install global error
 * handling and page tracking, then boot the modules.
 *
 * @param options - the application's modules, configuration and overrides
 * @param platform - the resolved platform seams
 * @param foundation - the services and application from the foundation phases
 * @param moduleLayer - the HTTP client and locale wiring from the module phases
 * @returns the router and the teardown handles installed by these phases
 */
async function wireAppIntegration<T extends WebCoreConfig>(
    options: WebCoreAppOptions<T>,
    platform: ResolvedPlatform,
    foundation: AppFoundation<T>,
    moduleLayer: ModuleLayer,
): Promise<AppIntegration> {
    const { settings, repository, storage, registry, app, pinia, observability } = foundation;
    const { http, i18n } = moduleLayer;

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

    return { router, titleSyncTeardown, errorHandlingTeardown, pageTrackingTeardown, moduleTeardown };
}

/**
 * Run the release phases: wire chunk-load recovery, connect realtime, and start
 * the update and connectivity monitors.
 *
 * @param options - the application's modules, configuration and overrides
 * @param platform - the resolved platform seams
 * @param runtimeUrl - the runtime document URL, the default monitor poll target
 * @param foundation - the services and application from the foundation phases
 * @param integration - the router wired by the app-integration phases
 * @returns the chunk-recovery teardown, realtime connection and monitors
 */
function wireReleaseMonitors<T extends WebCoreConfig>(
    options: WebCoreAppOptions<T>,
    platform: ResolvedPlatform,
    runtimeUrl: string,
    foundation: AppFoundation<T>,
    integration: AppIntegration,
): ReleaseLayer {
    const { settings, storage, observability } = foundation;
    const { router } = integration;

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

    return { chunkRecoveryTeardown, realtimeConnection, monitors };
}

/**
 * Assemble the application handle from the results of every boot phase.
 *
 * @param foundation - the services and application from the foundation phases
 * @param moduleLayer - the HTTP client, eager stores and locale wiring
 * @param integration - the router and teardown handles
 * @param release - the realtime connection, monitors and chunk-recovery
 * teardown
 * @returns the assembled application handle, ready to start
 */
function assembleApp<T extends WebCoreConfig>(
    foundation: AppFoundation<T>,
    moduleLayer: ModuleLayer,
    integration: AppIntegration,
    release: ReleaseLayer,
): WebCoreApp<T> {
    const { app, pinia, settings, repository, storage, colorScheme, toastService, confirmService, observability, flags } =
        foundation;
    const { http, switcher, i18n } = moduleLayer;
    const { router } = integration;
    const { realtimeConnection, monitors } = release;

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
            colorScheme,
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

            teardownApp(moduleLayer, integration, release, colorScheme);
        },
    };
}

/**
 * Tear down everything the boot installed, in reverse order: monitors,
 * realtime, chunk recovery, module boots, stores, then the page-tracking,
 * error-handling and title-sync uninstalls, and finally the colour-scheme
 * OS-change listener.
 *
 * @param moduleLayer - the eager store handles to dispose
 * @param integration - the module boot and page, error and title teardowns
 * @param release - the monitors, realtime connection and chunk-recovery
 * teardown
 * @param colorScheme - the colour-scheme service to dispose
 */
function teardownApp(
    moduleLayer: ModuleLayer,
    integration: AppIntegration,
    release: ReleaseLayer,
    colorScheme: ColorSchemeService,
): void {
    const { storeHandles } = moduleLayer;
    const { moduleTeardown, titleSyncTeardown, errorHandlingTeardown, pageTrackingTeardown } = integration;
    const { chunkRecoveryTeardown, realtimeConnection, monitors } = release;

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
    colorScheme.dispose();
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
 * Wire and install the colour-scheme service.
 *
 * @param storage - the application storage adapter
 * @param platform - the resolved platform seams
 * @param options - the full boot options carrying the colour-scheme seams
 * @returns the installed colour-scheme service
 */
function resolveColorScheme<T extends WebCoreConfig>(
    storage: KeyValueStorage,
    platform: ResolvedPlatform,
    options: WebCoreAppOptions<T>,
): ColorSchemeService {
    const colorScheme = options.colorScheme;

    return wireColorScheme({
        config: { colorScheme: { default: colorScheme?.defaultPreference ?? 'system' } },
        storage,
        ...(colorScheme?.storageKey === undefined ? {} : { colorSchemeStorageKey: colorScheme.storageKey }),
        ...(colorScheme?.themeColors === undefined ? {} : { themeColors: colorScheme.themeColors }),
        targetWindow: platform.targetWindow,
        targetDocument: platform.targetDocument,
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
