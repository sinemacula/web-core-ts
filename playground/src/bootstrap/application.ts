/**
 * Application composition root.
 *
 * The one place where everything is wired together: the runtime environment
 * is fetched, configuration is frozen, the service singletons are
 * initialised, and the Vue application is assembled from the module
 * registry. Every dependency is overridable through the options for tests;
 * production callers use the defaults.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { AnalyticsTracker } from '@sinemacula/web-core/analytics/analytics-tracker';
import { ConsoleAnalyticsTracker } from '@sinemacula/web-core/analytics/console-analytics-tracker';
import { installPageTracking } from '@sinemacula/web-core/analytics/install-page-tracking';
import { NullAnalyticsTracker } from '@sinemacula/web-core/analytics/null-analytics-tracker';
import { ConnectivityMonitor } from '@sinemacula/web-core/connectivity/connectivity-monitor';

import { ChainEnvironmentSource } from '@sinemacula/web-core/config/chain-environment-source';
import { Environment } from '@sinemacula/web-core/config/environment';
import { ObjectEnvironmentSource } from '@sinemacula/web-core/config/object-environment-source';
import { PrefixedEnvironmentSource } from '@sinemacula/web-core/config/prefixed-environment-source';
import { fetchRuntimeEnvironment } from '@sinemacula/web-core/config/runtime-environment';
import { StaticFeatureFlags } from '@sinemacula/web-core/feature-flags/static-feature-flags';
import { createBearerTokenInterceptor } from '@sinemacula/web-core/http/bearer-token-interceptor';
import { FetchHttpClient } from '@sinemacula/web-core/http/fetch-http-client';
import type { HttpRequest } from '@sinemacula/web-core/http/http-client';
import { HttpError, HttpValidationError } from '@sinemacula/web-core/http/http-error';
import { TokenRefreshCoordinator } from '@sinemacula/web-core/http/token-refresh-coordinator';
import type { ApplicationI18n } from '@sinemacula/web-core/i18n/application-i18n';
import {
    activateLocale,
    createApplicationI18n,
    createLocaleSwitcher,
} from '@sinemacula/web-core/i18n/application-i18n';
import { installDocumentTitleSync } from '@sinemacula/web-core/i18n/document-title';
import { LocaleService } from '@sinemacula/web-core/i18n/locale-service';
import { ConsoleLogger } from '@sinemacula/web-core/logging/console-logger';
import type { Logger } from '@sinemacula/web-core/logging/logger';
import { NullLogger } from '@sinemacula/web-core/logging/null-logger';
import { collectModuleRoutes } from '@sinemacula/web-core/module/module';
import { ConfirmService } from '@sinemacula/web-core/notifications/confirm-service';
import { ToastService } from '@sinemacula/web-core/notifications/toast-service';
import { BreadcrumbTrail } from '@sinemacula/web-core/reporting/breadcrumb-trail';
import { ConsoleErrorReporter } from '@sinemacula/web-core/reporting/console-error-reporter';
import type { ErrorReporter } from '@sinemacula/web-core/reporting/error-reporter';
import { installGlobalErrorHandling } from '@sinemacula/web-core/reporting/install-global-error-handling';
import { NullErrorReporter } from '@sinemacula/web-core/reporting/null-error-reporter';
import { installChunkErrorRecovery } from '@sinemacula/web-core/router/chunk-error-recovery';
import { createApplicationRouter } from '@sinemacula/web-core/router/router-factory';
import { BrowserStorage } from '@sinemacula/web-core/storage/browser-storage';
import type { KeyValueStorage } from '@sinemacula/web-core/storage/key-value-storage';
import { UpdateMonitor } from '@sinemacula/web-core/updates/update-monitor';
import type { Pinia } from 'pinia';
import { createPinia } from 'pinia';
import type { App as VueApp } from 'vue';
import { createApp, watch } from 'vue';
import type { Router, RouterHistory } from 'vue-router';

import App from '@/App.vue';
import type { Configuration } from '@/config';
import { assertRuntimeConfig } from '@/config/runtime';
import { sharedLocaleLoaders } from '@/locales';
import { localeFormats } from '@/locales/formats';
import { modules } from '@/modules';
import { AUTH_ROUTE_NAMES, appendRedirectTarget, installSessionLifecycle } from '@/modules/auth';
import { useAuthStore } from '@/modules/auth/stores/auth-store';
import { analytics, initialiseAnalytics } from '@/services/analytics';
import { initialiseApi } from '@/services/api';
import { config, initialiseConfiguration } from '@/services/config';
import { initialiseConfirm } from '@/services/confirm';
import { featureFlags, initialiseFeatureFlags } from '@/services/feature-flags';
import { initialiseLocaleSwitcher } from '@/services/locale';
import { initialiseLogger } from '@/services/logger';
import { initialiseReporting, reporting } from '@/services/reporting';
import { appStorage, initialiseStorage } from '@/services/storage';
import { initialiseToasts, toasts } from '@/services/toast';

/** Options accepted by {@link createApplication}; all fields are test-time overrides. */
export interface CreateApplicationOptions {
    readonly fetchFn?: typeof fetch;
    readonly storage?: KeyValueStorage;
    readonly localeCandidates?: readonly string[];
    readonly history?: RouterHistory;
    readonly targetDocument?: Document;
    /** Override the dev/production branch for testing; defaults to `import.meta.env.DEV`. */
    readonly dev?: boolean;
}

/** The assembled Vue application, its router, and the monitors running for release builds. */
export interface CreatedApplication {
    readonly app: VueApp<Element>;
    readonly router: Router;
    readonly updates: UpdateMonitor | null;
    readonly connectivity: ConnectivityMonitor | null;
}

/**
 * Assemble the application.
 *
 * @param options - test-time overrides; production uses the defaults
 * @returns the Vue app, router and update monitor, ready to mount
 */
export async function createApplication(options: CreateApplicationOptions = {}): Promise<CreatedApplication> {
    const isDev = options.dev ?? import.meta.env.DEV;

    await resolveEnvironment(isDev, options.fetchFn);

    initialiseStorage(options.storage ?? new BrowserStorage(window.localStorage));

    const settings = config();
    const app = createApp(App);
    const pinia = createPinia();

    app.use(pinia);

    initialiseFeatureFlags(new StaticFeatureFlags(settings.featureFlags.flags));
    initialiseApi(buildApiClient(settings, pinia, options.fetchFn));
    installSessionLifecycle({ pinia });
    initialiseToasts(new ToastService());
    initialiseConfirm(new ConfirmService());

    const i18n = createApplicationI18n(settings.locales.default, localeFormats);

    const localeService = await activateApplicationLocale({
        i18n,
        settings,
        ...(options.localeCandidates === undefined ? {} : { localeCandidates: options.localeCandidates }),
        ...(options.targetDocument === undefined ? {} : { targetDocument: options.targetDocument }),
        isDev,
    });

    wireLocaleSwitcher(i18n, settings, localeService, options.targetDocument);

    app.use(i18n);

    const router = buildRouterWithTitleSync({
        settings,
        i18n,
        ...(options.history === undefined ? {} : { history: options.history }),
        ...(options.targetDocument === undefined ? {} : { targetDocument: options.targetDocument }),
    });

    app.use(router);

    wireObservability(app, router, settings);
    wireSessionLossRedirect(pinia, router);
    wireIdentitySync(pinia);

    installChunkErrorRecovery({ router, storage: appStorage(), reporter: reporting() });

    const updates = wireUpdateMonitor(settings, options.fetchFn);

    return { app, router, updates, connectivity: wireConnectivity(updates) };
}

/**
 * Assemble the application and mount it.
 *
 * @param selector - the CSS selector for the mount target element
 */
export async function startApplication(selector = '#app'): Promise<void> {
    const { app, router } = await createApplication();

    await router.isReady();

    app.mount(selector);
}

/**
 * Fetch the runtime environment and freeze the configuration singleton.
 *
 * In development, VITE_* build variables are chained as a convenience fallback
 * after the runtime document. In production, the runtime document must contain
 * all required keys — if any are missing the application throws before mounting.
 *
 * @param isDev - true when running in the Vite dev server; false for production builds
 * @param fetchFn - optional fetch override for tests
 * @throws {ConfigurationError} in production when required runtime keys are missing
 */
async function resolveEnvironment(isDev: boolean, fetchFn?: typeof fetch): Promise<void> {
    const runtime = await fetchRuntimeEnvironment(fetchFn);

    if (isDev) {
        initialiseConfiguration(
            new Environment(
                new ChainEnvironmentSource([
                    new ObjectEnvironmentSource(runtime),
                    new PrefixedEnvironmentSource(import.meta.env, 'VITE_'),
                ]),
            ),
        );
    } else {
        assertRuntimeConfig(runtime);
        initialiseConfiguration(new Environment(new ObjectEnvironmentSource(runtime)));
    }
}

/**
 * Build a `TokenRefreshCoordinator` backed by the auth store's refresh action.
 *
 * @param pinia - the active Pinia instance
 * @returns the coordinator
 */
function createRefreshCoordinator(pinia: Pinia): TokenRefreshCoordinator {
    return new TokenRefreshCoordinator({
        refresh: () => useAuthStore(pinia).refresh(),
    });
}

/**
 * Construct the API HTTP client with the bearer-token interceptor and
 * token-refresh coordinator wired in.
 *
 * @param settings - resolved application configuration
 * @param pinia - the active Pinia instance used to read the access token
 * @param fetchFn - optional fetch override for tests
 * @returns the configured {@link FetchHttpClient}
 */
function buildApiClient(settings: Configuration, pinia: Pinia, fetchFn?: typeof fetch): FetchHttpClient {
    const coordinator = createRefreshCoordinator(pinia);

    return new FetchHttpClient({
        baseUrl: settings.api.baseUrl,
        timeout: settings.api.timeout,
        requestInterceptors: [createBearerTokenInterceptor({ getAccessToken: () => useAuthStore(pinia).accessToken })],
        onUnauthorized: () => coordinator.refresh(),
        onResponseError: notifyUnexpectedApiError,
        ...(fetchFn === undefined ? {} : { fetchFn }),
    });
}

/**
 * Surface an unexpected API failure to the user and the error reporter.
 *
 * Validation failures stay silent here (forms render their field errors) and
 * 401s belong to the refresh flow; everything else raises the generic error
 * toast and is captured with request context.
 *
 * @param error - the failure thrown by the HTTP client
 * @param request - the request that failed
 */
function notifyUnexpectedApiError(error: unknown, request: HttpRequest): void {
    if (error instanceof HttpValidationError || (error instanceof HttpError && error.status === 401)) {
        return;
    }

    toasts().error('common.states.error');
    reporting().captureError(error, { source: 'http', method: request.method, url: request.url });
}

/**
 * Install a watcher that redirects to the login screen whenever the session
 * transitions from authenticated to unauthenticated (e.g. after a failed
 * token refresh).
 *
 * @param pinia - the active Pinia instance
 * @param router - the application router
 */
function wireSessionLossRedirect(pinia: Pinia, router: Router): void {
    watch(
        () => useAuthStore(pinia).isAuthenticated,
        async (authed, was) => {
            if (was && !authed) {
                await router.push(
                    appendRedirectTarget({ name: AUTH_ROUTE_NAMES.login }, router.currentRoute.value.fullPath),
                );
            }
        },
    );
}

/**
 * Keep reporting, analytics and feature-flag targeting in sync with the
 * authenticated user: all three receive the same identity on sign-in and
 * are cleared together on sign-out.
 *
 * @param pinia - the active Pinia instance
 */
function wireIdentitySync(pinia: Pinia): void {
    watch(
        () => useAuthStore(pinia).user,
        user => {
            if (user === null) {
                reporting().setUser(null);
                analytics().reset();
                featureFlags().setContext({});

                return;
            }

            reporting().setUser({ id: user.id, email: user.email, name: user.fullName });
            analytics().identify(user.id);
            featureFlags().setContext({ userId: user.id });
        },
    );
}

/**
 * Install error reporting, analytics and the breadcrumb session trail.
 *
 * Local development gets console adapters; every other environment gets the
 * null adapters until a provider adapter (Sentry, Segment, ...) is wired in.
 *
 * @param app - the Vue application
 * @param router - the application router
 * @param settings - resolved application configuration
 */
function wireObservability(app: VueApp<Element>, router: Router, settings: Configuration): void {
    const isLocal = settings.app.environment === 'local';
    const reporter: ErrorReporter = isLocal ? new ConsoleErrorReporter() : new NullErrorReporter();
    const tracker: AnalyticsTracker = isLocal ? new ConsoleAnalyticsTracker() : new NullAnalyticsTracker();
    const logging: Logger = isLocal ? new ConsoleLogger() : new NullLogger();
    const trail = new BreadcrumbTrail();

    initialiseReporting(reporter);
    initialiseAnalytics(tracker);
    initialiseLogger(logging);

    installGlobalErrorHandling({ app, reporter, trail });
    installPageTracking({ router, tracker, trail });
}

/**
 * Start deployed-version monitoring for release builds.
 *
 * Development builds (version `dev`) are never monitored. When a new version
 * is deployed, a sticky toast invites the user to refresh.
 *
 * @param settings - resolved application configuration
 * @param fetchFn - optional fetch override for tests
 * @returns the running monitor, or null for development builds
 */
function wireUpdateMonitor(settings: Configuration, fetchFn?: typeof fetch): UpdateMonitor | null {
    if (settings.app.version === 'dev') {
        return null;
    }

    const monitor = new UpdateMonitor({
        currentVersion: settings.app.version,
        ...(fetchFn === undefined ? {} : { fetchFn }),
    });

    monitor.onUpdate(() => {
        toasts().information('common.updates.available', { duration: 0 });
    });

    monitor.start();

    return monitor;
}

/**
 * Pause update polling while the browser is offline.
 *
 * Development builds run no update monitor, so connectivity tracking is
 * skipped entirely there.
 *
 * @param updates - the running update monitor, or null for development builds
 * @returns the started connectivity monitor, or null when nothing to pause
 */
function wireConnectivity(updates: UpdateMonitor | null): ConnectivityMonitor | null {
    if (updates === null) {
        return null;
    }

    const connectivity = new ConnectivityMonitor();

    connectivity.onChange(online => {
        if (online) {
            updates.start();
        } else {
            updates.stop();
        }
    });

    connectivity.start();

    return connectivity;
}

/** Options for {@link activateApplicationLocale}. */
interface ActivateApplicationLocaleOptions {
    readonly i18n: ApplicationI18n;
    readonly settings: Configuration;
    readonly localeCandidates?: readonly string[];
    readonly targetDocument?: Document;
    readonly isDev: boolean;
}

/**
 * Detect the user's preferred locale and activate it on the i18n instance.
 *
 * The default locale's messages are always loaded alongside the active locale
 * so that vue-i18n's fallback chain resolves to real translations.
 *
 * @param options - i18n instance, configuration, optional candidate list, and target document
 * @returns the locale service used for detection, reused to build the runtime locale switcher
 */
async function activateApplicationLocale({
    i18n,
    settings,
    localeCandidates,
    targetDocument,
}: ActivateApplicationLocaleOptions): Promise<LocaleService> {
    const localeService = new LocaleService({
        defaultLocale: settings.locales.default,
        enabledLocales: settings.locales.enabled,
        storage: appStorage(),
    });

    const locale = localeService.detect(localeCandidates ?? [...window.navigator.languages]);

    await activateLocale({
        i18n,
        modules,
        sharedLoaders: sharedLocaleLoaders,
        locale,
        direction: settings.locales.supported[locale]?.direction ?? 'ltr',
        fallbackLocale: settings.locales.default,
        ...(targetDocument === undefined ? {} : { targetDocument }),
    });

    return localeService;
}

/**
 * Build the runtime locale switcher and install it as the active singleton.
 *
 * Reuses the {@link LocaleService} instance used for boot-time detection so
 * persisted preferences and enabled-locale matching stay consistent between
 * boot and any later runtime switch.
 *
 * @param i18n - the application i18n instance
 * @param settings - resolved application configuration
 * @param localeService - the locale service used for boot-time detection
 * @param targetDocument - optional target document override for tests
 */
function wireLocaleSwitcher(
    i18n: ApplicationI18n,
    settings: Configuration,
    localeService: LocaleService,
    targetDocument?: Document,
): void {
    initialiseLocaleSwitcher(
        createLocaleSwitcher({
            i18n,
            modules,
            sharedLoaders: sharedLocaleLoaders,
            localeService,
            supported: settings.locales.supported,
            fallbackLocale: settings.locales.default,
            ...(targetDocument === undefined ? {} : { targetDocument }),
        }),
    );
}

/** Options for {@link buildRouterWithTitleSync}. */
interface RouterOptions {
    readonly settings: Configuration;
    readonly i18n: ApplicationI18n;
    readonly history?: RouterHistory;
    readonly targetDocument?: Document;
}

/**
 * Create the application router and install the document-title synchronisation hook.
 *
 * @param options - configuration, i18n instance, optional history override, and target document
 * @returns the configured router
 */
function buildRouterWithTitleSync({ settings, i18n, history, targetDocument }: RouterOptions): Router {
    const router = createApplicationRouter({
        routes: collectModuleRoutes(modules),
        ...(history === undefined ? {} : { history }),
    });

    installDocumentTitleSync({
        router,
        i18n,
        appName: settings.app.name,
        ...(targetDocument === undefined ? {} : { targetDocument }),
    });

    return router;
}
