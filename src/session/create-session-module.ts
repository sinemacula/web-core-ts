/**
 * Session module factory.
 *
 * Builds the opt-in session module: a plain registry entry that installs the
 * session context, contributes the bearer-token interceptor and the single
 * unauthorized (token-refresh) handler at the register phase, instantiates the
 * session store at the stores phase, and wires cross-tab session
 * synchronisation, proactive token refresh, session-loss redirection and
 * identity fan-out at the boot phase. Login UI, locale copy and the user field
 * mapping stay app-side.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { watch } from 'vue';
import type { RouteLocationRaw, Router } from 'vue-router';

import { analytics, api, featureFlags, reporting } from '../app/services';
import { createBearerTokenInterceptor } from '@sinemacula/foundation/http/bearer-token-interceptor';
import type { HttpClient } from '@sinemacula/foundation/http/http-client';
import { TokenRefreshCoordinator } from '@sinemacula/foundation/http/token-refresh-coordinator';
import type { ModuleBootContext, ModuleDefinition, ModuleRegisterContext, ModuleTeardown } from '../module/module';
import type { KeyValueStorage } from '@sinemacula/foundation/storage/key-value-storage';
import { createDefaultSessionApi } from './default-session-api';
import { appendRedirectTarget, sanitiseRedirectTarget } from './redirect';
import type { SessionApi, SessionDevice } from '@sinemacula/foundation/session/session-api';
import type { SessionRoutes as BaseSessionRoutes } from '@sinemacula/foundation/session/session-routes';
import type { SessionStorageKeys } from '@sinemacula/foundation/session/session-storage-keys';
import { DEFAULT_SESSION_STORAGE_KEYS } from '@sinemacula/foundation/session/session-storage-keys';
import { installSessionContext, sessionContext } from './session-context';
import type { SessionStore } from './session-store';
import { useSessionStore } from './session-store';
import type { SessionUser } from '@sinemacula/foundation/session/session-user';

export type { SessionStorageKeys } from '@sinemacula/foundation/session/session-storage-keys';

/**
 * Route identity over vue-router locations. Defaults: login
 * `{ name: 'auth.login' }`, loginPath '/login', home '/', forbidden
 * '/forbidden' - the forbidden default is a path string by design: the
 * application's fallback or errors module owns the page.
 */
export type SessionRoutes = BaseSessionRoutes<RouteLocationRaw>;

/**
 * Per-channel identity mappings fanned out to the reporting, analytics and
 * feature-flag holders whenever the session user changes.
 */
export interface SessionIdentityMapping<U extends SessionUser> {
    /** Maps the user onto the error reporter identity. Default `{ id, email, name }` with null fields omitted. */
    readonly reporting?: (user: U) => {
        /** The reporter identity id. */
        id: string;

        /** The reporter identity email; omitted when null. */
        email?: string;

        /** The reporter identity name; omitted when null. */
        name?: string;
    };

    /** Maps the user onto the analytics identify() id. Default the stringified user id. */
    readonly analytics?: (user: U) => string;

    /** Maps the user onto the feature-flag evaluation context. Default `{ userId }`. */
    readonly featureFlags?: (user: U) => Readonly<Record<string, string>>;
}

/**
 * Options for {@link createSessionModule}; every default mirrors the
 * organisation's reference application.
 */
export interface SessionModuleOptions<
    U extends SessionUser = SessionUser,
    C = {
        /** The submitted account email address. */
        email: string;

        /** The submitted account password. */
        password: string;
    },
> {
    /** Registry name (the module has no routes and no locales). Default 'session'. */
    readonly name?: string;

    /** The pinia store id the session store registers under. Default 'auth'. */
    readonly storeId?: string;

    /** Session API factory over the application HTTP client. Default {@link createDefaultSessionApi}. */
    readonly api?: (http: HttpClient) => SessionApi<U, C>;

    /** Overrides for the persisted storage keys. */
    readonly storageKeys?: Partial<SessionStorageKeys>;

    /** Overrides for the route identity. */
    readonly routes?: Partial<SessionRoutes>;

    /** How long before expiry the proactive refresh fires, in milliseconds. Default 60 seconds. */
    readonly refreshSkewMs?: number;

    /** The operating-system label reported in the device fingerprint. Default 'WEB'. */
    readonly deviceOs?: string;

    /** Device uuid factory. Default `crypto.randomUUID()`. */
    readonly generateUuid?: () => string;

    /** Mirror session changes made by other tabs. Default true. */
    readonly crossTabSync?: boolean;

    /** Refresh the session ahead of its expiry. Default true. */
    readonly proactiveRefresh?: boolean;

    /** Redirect to the login route when the session transitions from authenticated to unauthenticated, carrying the sanitised current path as the redirect query parameter. Default true. */
    readonly sessionLossRedirect?: boolean;

    /** Identity fan-out to the reporting, analytics and feature-flag holders; per-channel overrides merge over the defaults, and false disables the fan-out entirely. */
    readonly identity?: false | SessionIdentityMapping<U>;
}

const DEFAULT_ROUTES: SessionRoutes = {
    login: { name: 'auth.login' },
    loginPath: '/login',
    home: '/',
    forbidden: '/forbidden',
};

const DEFAULT_MODULE_NAME = 'session';
const DEFAULT_STORE_ID = 'auth';
const DEFAULT_DEVICE_OS = 'WEB';
const DEFAULT_REFRESH_SKEW_MS = 60_000;
const MAX_TIMEOUT_DELAY_MS = 2_147_483_647;

/**
 * Create the session module.
 *
 * At register it installs the session context (storage keys, route identity,
 * the lazily-built API gateway over the installed HTTP client, and the single
 * token-refresh coordinator), contributes the bearer-token interceptor, and
 * claims the unauthorized-handler slot with the coordinator. At boot it wires
 * the session lifecycle and returns one teardown removing everything it
 * installed.
 *
 * @param options - overrides for the reference-application defaults
 * @returns the module definition for the application registry
 */
export function createSessionModule<
    U extends SessionUser = SessionUser,
    C = {
        /** The submitted account email address. */
        email: string;

        /** The submitted account password. */
        password: string;
    },
>(options: SessionModuleOptions<U, C> = {}): ModuleDefinition {
    const storageKeys: SessionStorageKeys = { ...DEFAULT_SESSION_STORAGE_KEYS, ...options.storageKeys };
    const routes: SessionRoutes = { ...DEFAULT_ROUTES, ...options.routes };
    const storeId = options.storeId ?? DEFAULT_STORE_ID;
    const deviceOs = options.deviceOs ?? DEFAULT_DEVICE_OS;
    const generateUuid = options.generateUuid ?? ((): string => crypto.randomUUID());
    const apiFactory =
        options.api ?? ((http: HttpClient): SessionApi<U, C> => createDefaultSessionApi<U>(http) as SessionApi<U, C>);
    const identity = resolveIdentityMapping(options.identity);
    const lifecycle: LifecycleOptions<U> = {
        storageKeys,
        routes,
        refreshSkewMs: options.refreshSkewMs ?? DEFAULT_REFRESH_SKEW_MS,
        crossTabSync: options.crossTabSync ?? true,
        proactiveRefresh: options.proactiveRefresh ?? true,
        sessionLossRedirect: options.sessionLossRedirect ?? true,
        identity,
    };

    return {
        name: options.name ?? DEFAULT_MODULE_NAME,
        routes: [],
        register: context =>
            registerSession<U, C>(context, { storageKeys, routes, storeId, apiFactory, generateUuid, deviceOs }),
        stores: [pinia => useSessionStore(pinia)],
        boot: context => bootSessionLifecycle(context, lifecycle),
    };
}

/**
 * The resolved register-phase collaborators the session context is built from.
 */
interface RegisterConfig<U extends SessionUser, C> {
    /** The resolved storage keys the session persists under. */
    readonly storageKeys: SessionStorageKeys;

    /** The resolved route identity. */
    readonly routes: SessionRoutes;

    /** The pinia store id the session store registers under. */
    readonly storeId: string;

    /** Builds the session API gateway over the application HTTP client. */
    readonly apiFactory: (http: HttpClient) => SessionApi<U, C>;

    /** The device uuid factory. */
    readonly generateUuid: () => string;

    /** The operating-system label reported in the device fingerprint. */
    readonly deviceOs: string;
}

/**
 * Install the session context, contribute the bearer-token interceptor, and
 * claim the single unauthorized-handler slot at the register phase.
 *
 * @param context - the module register context
 * @param config - the resolved collaborators the session context is built from
 */
function registerSession<U extends SessionUser, C>(context: ModuleRegisterContext, config: RegisterConfig<U, C>): void {
    const coordinator = new TokenRefreshCoordinator({
        refresh: () => useSessionStore(context.pinia).refresh(),
    });

    let gateway: SessionApi<U, C> | null = null;

    installSessionContext<U>({
        storageKeys: config.storageKeys,
        routes: config.routes,
        storage: context.storage,
        storeId: config.storeId,
        coordinator,
        parseTimestamp: parseLegacyTimestamp,
        device: () =>
            deviceFingerprint(context.storage, config.storageKeys.deviceUuid, config.generateUuid, config.deviceOs),
        get api(): SessionApi<U> {
            gateway ??= config.apiFactory(api());

            return gateway as unknown as SessionApi<U>;
        },
    });

    context.http.addRequestInterceptor(
        createBearerTokenInterceptor({
            getAccessToken: () => useSessionStore(context.pinia).accessToken,
        }),
    );
    context.http.setUnauthorizedHandler(() => coordinator.refresh());
}

/** The resolved boot-phase toggles and collaborator inputs. */
interface LifecycleOptions<U extends SessionUser> {
    /** The resolved storage keys the session persists under. */
    readonly storageKeys: SessionStorageKeys;

    /** The resolved route identity. */
    readonly routes: SessionRoutes;

    /** How long before expiry the proactive refresh fires, in milliseconds. */
    readonly refreshSkewMs: number;

    /** Whether to mirror session changes made by other tabs. */
    readonly crossTabSync: boolean;

    /** Whether to refresh the session ahead of its expiry. */
    readonly proactiveRefresh: boolean;

    /** Whether to redirect to login when the session is lost. */
    readonly sessionLossRedirect: boolean;

    /** The resolved identity fan-out mapping, or null when disabled. */
    readonly identity: Required<SessionIdentityMapping<U>> | null;
}

/**
 * Wire the session lifecycle at the boot phase.
 *
 * @param context - the module boot context
 * @param options - the resolved lifecycle options
 * @returns one teardown removing the listener, timer and watchers
 */
function bootSessionLifecycle<U extends SessionUser>(
    context: ModuleBootContext,
    options: LifecycleOptions<U>,
): ModuleTeardown {
    const store = useSessionStore<U>(context.pinia);
    const teardowns: ModuleTeardown[] = [];

    if (options.crossTabSync) {
        teardowns.push(wireCrossTabSync(context, store, options.storageKeys));
    }

    if (options.proactiveRefresh) {
        teardowns.push(wireProactiveRefresh(context, store, options.refreshSkewMs));
    }

    if (store.isAuthenticated) {
        store.rehydrateUser().catch(() => {
            // Swallowed: a dead session is handled by the 401-refresh flow or
            // the session-loss watcher.
        });
    }

    if (options.sessionLossRedirect) {
        teardowns.push(wireSessionLossRedirect(context, store, options.routes));
    }

    if (options.identity !== null) {
        teardowns.push(wireIdentityFanOut(store, options.identity));
    }

    return () => {
        for (const teardown of [...teardowns].reverse()) {
            teardown();
        }
    };
}

/**
 * Mirror another tab's session change onto this tab's store for as long as the
 * returned teardown is uncalled.
 *
 * @param context - the module boot context
 * @param store - the session store
 * @param storageKeys - the resolved storage keys
 * @returns a teardown detaching the `storage` listener
 */
function wireCrossTabSync(
    context: ModuleBootContext,
    store: SessionStore,
    storageKeys: SessionStorageKeys,
): ModuleTeardown {
    const target = context.platform.targetWindow;
    const onStorage = createStorageListener(store, storageKeys.accessToken);

    target.addEventListener('storage', onStorage);

    return () => {
        target.removeEventListener('storage', onStorage);
    };
}

/**
 * Arm the proactive refresh timer and keep it tracking the session expiry.
 *
 * @param context - the module boot context
 * @param store - the session store
 * @param refreshSkewMs - how long before expiry the refresh fires
 * @returns a teardown stopping the expiry watcher and cancelling the timer
 */
function wireProactiveRefresh(context: ModuleBootContext, store: SessionStore, refreshSkewMs: number): ModuleTeardown {
    const scheduler = createRefreshScheduler(sessionContext().coordinator, context.platform.clock, refreshSkewMs);
    const stopExpiryWatch = watch(() => store.expiresAtEpochMs, scheduler.schedule, { immediate: true });

    return () => {
        stopExpiryWatch();
        scheduler.cancel();
    };
}

/**
 * Redirect to the login route whenever the session transitions from
 * authenticated to unauthenticated.
 *
 * @param context - the module boot context
 * @param store - the session store
 * @param routes - the resolved route identity
 * @returns a teardown stopping the session-loss watcher
 */
function wireSessionLossRedirect(
    context: ModuleBootContext,
    store: SessionStore,
    routes: SessionRoutes,
): ModuleTeardown {
    return watch(
        () => store.isAuthenticated,
        (authenticated, previously) => {
            if (previously && !authenticated) {
                redirectToLogin(context.router, routes);
            }
        },
    );
}

/**
 * Fan the session identity out to the reporting, analytics and feature-flag
 * holders whenever the session user changes.
 *
 * @param store - the session store
 * @param mapping - the resolved per-channel identity mappings
 * @returns a teardown stopping the identity watcher
 */
function wireIdentityFanOut<U extends SessionUser>(
    store: SessionStore<U>,
    mapping: Required<SessionIdentityMapping<U>>,
): ModuleTeardown {
    return watch(
        () => store.user,
        user => {
            applyIdentity(mapping, user);
        },
    );
}

/**
 * Build the `storage` event handler that mirrors another tab's session change
 * onto this tab's store.
 *
 * @param store - the session store
 * @param accessTokenKey - the raw storage key carrying the access token
 * @returns the event handler to attach to the target window
 */
function createStorageListener(store: SessionStore, accessTokenKey: string): (event: StorageEvent) => void {
    return (event: StorageEvent): void => {
        if (event.key !== accessTokenKey && event.key !== null) {
            return;
        }

        if (event.newValue === null) {
            store.clearLocal();

            return;
        }

        store.hydrateFromStorage();
        store.rehydrateUser().catch(() => {
            // Swallowed: a dead session is handled by the 401-refresh flow or
            // the session-loss watcher.
        });
    };
}

/** A schedule/cancel pair for the proactive refresh timer. */
interface RefreshScheduler {
    /** Arm a proactive refresh ahead of the given expiry, or cancel when null. */
    readonly schedule: (expiresAtEpochMs: number | null) => void;

    /** Cancel any pending proactive refresh. */
    readonly cancel: () => void;
}

/**
 * Build a scheduler that arranges a single proactive refresh ahead of the
 * session expiry, replacing any previously scheduled attempt.
 *
 * The timer routes through the token-refresh coordinator - never the store
 * directly - so a proactive refresh can never race a reactive 401 refresh.
 *
 * @param coordinator - the single refresh authority
 * @param clock - resolves the current time in epoch milliseconds
 * @param refreshSkewMs - how long before expiry to fire the refresh
 * @returns the scheduler
 */
function createRefreshScheduler(
    coordinator: TokenRefreshCoordinator,
    clock: () => number,
    refreshSkewMs: number,
): RefreshScheduler {
    let timer: ReturnType<typeof setTimeout> | null = null;

    /** Cancel any pending proactive refresh, leaving no timer armed. */
    const cancel = (): void => {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
    };

    /**
     * Arm a single proactive refresh ahead of the session expiry, replacing any
     * previously scheduled attempt.
     *
     * @param expiresAtEpochMs - the expiry to refresh ahead of, or null to
     * cancel without arming a new timer
     */
    const schedule = (expiresAtEpochMs: number | null): void => {
        cancel();

        if (expiresAtEpochMs === null) {
            return;
        }

        const delay = Math.max(0, expiresAtEpochMs - clock() - refreshSkewMs);

        if (delay > MAX_TIMEOUT_DELAY_MS) {
            // setTimeout delays beyond the signed 32-bit range fire
            // immediately; re-evaluate at the horizon instead.
            timer = setTimeout(() => {
                schedule(expiresAtEpochMs);
            }, MAX_TIMEOUT_DELAY_MS);

            return;
        }

        timer = setTimeout(() => {
            coordinator.refresh().catch(() => {
                // A failed proactive refresh is handled by the 401-refresh flow
                // or the session-loss watcher.
            });
        }, delay);
    };

    return { schedule, cancel };
}

/**
 * Push the login route, carrying the sanitised current path as the redirect
 * query parameter when it is a safe return target.
 *
 * @param router - the application router
 * @param routes - the resolved route identity
 */
function redirectToLogin(router: Router, routes: SessionRoutes): void {
    const target = sanitiseRedirectTarget(router.currentRoute.value.fullPath, routes.loginPath);
    const destination = target === null ? routes.login : appendRedirectTarget(routes.login, target);

    router.push(destination).catch(() => {
        // Swallowed: a rejected navigation must not surface as an unhandled
        // rejection.
    });
}

/**
 * Merge the caller's identity mapping over the per-channel defaults.
 *
 * @param identity - the caller-supplied mapping, false to disable, or undefined
 * @returns the fully-resolved mapping, or null when the fan-out is disabled
 */
function resolveIdentityMapping<U extends SessionUser>(
    identity: false | SessionIdentityMapping<U> | undefined,
): Required<SessionIdentityMapping<U>> | null {
    if (identity === false) {
        return null;
    }

    return {
        reporting: identity?.reporting ?? defaultReportedIdentity,
        analytics: identity?.analytics ?? ((user: U): string => String(user.id)),
        featureFlags:
            identity?.featureFlags ??
            ((user: U): Readonly<Record<string, string>> => ({
                userId: String(user.id),
            })),
    };
}

/**
 * Map a session user onto the default error-reporter identity.
 *
 * @param user - the signed-in user
 * @returns the reported identity, with null email and name omitted
 */
function defaultReportedIdentity(user: SessionUser): {
    /** The reporter identity id. */
    id: string;

    /** The reporter identity email; omitted when null. */
    email?: string;

    /** The reporter identity name; omitted when null. */
    name?: string;
} {
    return {
        id: String(user.id),
        ...(user.email === null ? {} : { email: user.email }),
        ...(user.name === null ? {} : { name: user.name }),
    };
}

/**
 * Fan the session identity out to the reporting, analytics and feature-flag
 * holders, clearing all three together on sign-out.
 *
 * @param mapping - the resolved per-channel mappings
 * @param user - the session user, or null when signed out
 */
function applyIdentity<U extends SessionUser>(mapping: Required<SessionIdentityMapping<U>>, user: U | null): void {
    if (user === null) {
        reporting().setUser(null);
        analytics().reset();
        featureFlags().setContext({});

        return;
    }

    reporting().setUser(mapping.reporting(user));
    analytics().identify(mapping.analytics(user));
    featureFlags().setContext(mapping.featureFlags(user));
}

/**
 * Return the stable device fingerprint for this browser.
 *
 * On first call a uuid is generated and persisted; subsequent calls reuse the
 * stored value so the same device always presents the same fingerprint.
 *
 * @param storage - the key-value store the uuid persists in
 * @param key - the storage key the uuid persists under
 * @param generateUuid - the uuid factory
 * @param os - the operating-system label to report
 * @returns the device fingerprint
 */
function deviceFingerprint(
    storage: KeyValueStorage,
    key: string,
    generateUuid: () => string,
    os: string,
): SessionDevice {
    const existing = storage.get(key);

    if (existing !== null) {
        return { uuid: existing, os };
    }

    const uuid = generateUuid();

    storage.set(key, uuid);

    return { uuid, os };
}

/**
 * Parse a legacy persisted wire timestamp (`YYYY-MM-DD HH:MM:SS`, assumed UTC)
 * as an epoch-millisecond instant during hydration.
 *
 * @param value - the persisted legacy timestamp
 * @returns the parsed instant in epoch milliseconds, or null when unparseable
 */
function parseLegacyTimestamp(value: string): number | null {
    const parsed = Date.parse(`${value.replace(' ', 'T')}Z`);

    return Number.isNaN(parsed) ? null : parsed;
}
