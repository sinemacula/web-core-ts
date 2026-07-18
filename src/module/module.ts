/**
 * Feature module contract.
 *
 * The application is composed of modules: each contributes routes, optional
 * lazily-loaded translations, global navigation guards, stores, and lifecycle
 * hooks, alongside its own internal views and services. The module list is a
 * caller-owned, explicitly ordered array consumed by `createModuleRegistry` in
 * `./module-registry` - no filesystem magic, no auto-imports.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { Pinia } from 'pinia';
import type { App } from 'vue';
import type { RouteRecordRaw, Router } from 'vue-router';

import type { ConfigRepository } from '../config/config-repository';
import type { Environment } from '../config/environment';
import type { HttpClient, RequestInterceptor, ResponseErrorHandler, UnauthorizedHandler } from '../http/http-client';
import type { ApplicationI18n } from '../i18n/application-i18n';
import type { RouteMiddleware } from '../router/middleware';
import type { KeyValueStorage } from '../storage/key-value-storage';

/**
 * A flat or nested bag of translation key/value pairs for one locale.
 */
export type LocaleMessages = Record<string, unknown>;

/**
 * Resolve a module's translations for one locale.
 */
export type LocaleMessageLoader = (locale: string) => Promise<LocaleMessages | null>;

/**
 * Removes whatever a module installed at boot (listeners, watchers, timers).
 */
export type ModuleTeardown = () => void;

/**
 * Platform seams resolved once by the application preset and threaded to every
 * module hook.
 */
export interface ResolvedPlatform {
    /** The fetch implementation threaded to every module hook. */
    readonly fetchFn: typeof fetch;

    /** The window modules read and drive. */
    readonly targetWindow: Window;

    /** The document modules read and render into. */
    readonly targetDocument: Document;

    /** Reads the current time as epoch milliseconds. */
    readonly clock: () => number;
}

/**
 * Collector handed to {@link ModuleDefinition.register}; contributions feed the
 * construction of the application HTTP client.
 */
export interface ModuleHttpRegistrar {
    /**
     * Appended after preset-level interceptors, in registry order.
     */
    addRequestInterceptor(interceptor: RequestInterceptor): void;

    /**
     * Single slot - one refresh authority per application. A second call throws
     * a `ModuleRegistryError` naming both contributing modules.
     */
    setUnauthorizedHandler(handler: UnauthorizedHandler): void;

    /**
     * Run after the preset's response-error handler, in registry order.
     */
    addResponseErrorHandler(handler: ResponseErrorHandler): void;
}

/**
 * Phase 1 context: contribute cross-cutting hooks before shared services exist.
 * Synchronous by design.
 */
export interface ModuleRegisterContext {
    /** The application configuration repository. */
    readonly config: ConfigRepository<Record<string, unknown>>;

    /** The resolved runtime environment. */
    readonly environment: Environment;

    /** The application key/value storage. */
    readonly storage: KeyValueStorage;

    /** The application Pinia instance. */
    readonly pinia: Pinia;

    /** The resolved platform seams. */
    readonly platform: ResolvedPlatform;

    /** The HTTP machinery registrar. */
    readonly http: ModuleHttpRegistrar;
}

/**
 * Phase 2 context: runtime effects once the app, pinia, HTTP client, i18n and
 * router exist; runs before mount.
 */
export interface ModuleBootContext {
    /** The Vue application instance. */
    readonly app: App;

    /** The application router. */
    readonly router: Router;

    /** The application Pinia instance. */
    readonly pinia: Pinia;

    /** The application i18n instance. */
    readonly i18n: ApplicationI18n;

    /** The built application HTTP client. */
    readonly http: HttpClient;

    /** The application key/value storage. */
    readonly storage: KeyValueStorage;

    /** The application configuration repository. */
    readonly config: ConfigRepository<Record<string, unknown>>;

    /** The resolved platform seams. */
    readonly platform: ResolvedPlatform;
}

/**
 * A store hook instantiated eagerly at the stores phase; matches the shape of a
 * `defineStore` result, and its `$dispose` is composed into application
 * disposal.
 */
export type ModuleStoreFactory = (pinia: Pinia) => {
    /**
     * Dispose the store; composed into application disposal.
     */
    $dispose(): void;
};

/**
 * A self-contained feature area of the application.
 */
export interface ModuleDefinition {
    /** Unique module name; also the namespace for its translations. Uniqueness is enforced by the registry. */
    readonly name: string;

    /** Routes contributed to the application router. */
    readonly routes: readonly RouteRecordRaw[];

    /** Lazily-loaded translations, keyed under the module name. */
    readonly locales?: LocaleMessageLoader;

    /** Global navigation middleware, run on every navigation before route-level `meta.middleware`, in registry order. Instances may be created at module-definition time and must defer all store and service access to `handle()`. */
    readonly guards?: readonly RouteMiddleware[];

    /** Stores instantiated eagerly at the stores phase (after pinia and storage install, before i18n and the router), in registry order. A `useXStore` hook fits directly. */
    readonly stores?: readonly ModuleStoreFactory[];

    /** Contribute HTTP machinery (interceptors, the single unauthorized handler, extra response-error handlers) before the client is built. Synchronous by design. */
    readonly register?: (context: ModuleRegisterContext) => void;

    /** Imperative installation of module-owned runtime behaviour; runs after router creation, before mount. May return a teardown removing whatever it installed. */
    readonly boot?: (context: ModuleBootContext) => ModuleTeardown | undefined | Promise<ModuleTeardown | undefined>;

    /** This module owns the application catch-all; the registry orders it last. At most one module per registry may declare it. Keeping the catch-all last within the module's own routes array remains the module's responsibility. */
    readonly fallback?: boolean;
}

/**
 * Build a {@link LocaleMessageLoader} from a per-locale import map.
 *
 * @param loaders - dynamic importers keyed by locale code
 * @returns a loader resolving null for locales the module does not provide
 */
export function createLocaleLoader(
    loaders: Readonly<Record<string, () => Promise<LocaleMessages>>>,
): LocaleMessageLoader {
    return async (locale: string): Promise<LocaleMessages | null> => {
        const loader = loaders[locale];

        return loader === undefined ? null : await loader();
    };
}

/**
 * Flatten the routes contributed by a set of modules.
 *
 * @param modules - the module registry
 * @returns every module route, in registry order
 */
export function collectModuleRoutes(modules: readonly ModuleDefinition[]): RouteRecordRaw[] {
    return modules.flatMap(definition => [...definition.routes]);
}

/**
 * Load and namespace every module's translations for one locale.
 *
 * @param modules - the module registry
 * @param locale - the locale to load
 * @returns module translations keyed by module name
 */
export async function collectModuleMessages(
    modules: readonly ModuleDefinition[],
    locale: string,
): Promise<Record<string, LocaleMessages>> {
    const messages: Record<string, LocaleMessages> = {};

    for (const definition of modules) {
        const loaded = definition.locales === undefined ? null : await definition.locales(locale);

        if (loaded !== null) {
            messages[definition.name] = loaded;
        }
    }

    return messages;
}

/**
 * Flatten the global navigation guards contributed by a set of modules.
 *
 * @param modules - the module registry
 * @returns every module guard, in registry order
 */
export function collectModuleGuards(modules: readonly ModuleDefinition[]): RouteMiddleware[] {
    return modules.flatMap(definition => [...(definition.guards ?? [])]);
}
