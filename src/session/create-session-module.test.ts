/**
 * Unit tests for createSessionModule.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { Pinia } from 'pinia';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, nextTick } from 'vue';
import type { RouteLocationRaw, Router } from 'vue-router';

import type { AnalyticsTracker } from '@sinemacula/foundation/analytics/analytics-tracker';
import {
    installAnalytics,
    installApi,
    installFeatureFlags,
    installReporting,
    resetWebCoreServices,
} from '../app/services';
import { ConfigRepository } from '../config/config-repository';
import { Environment } from '../config/environment';
import type { FeatureFlags, FlagEvaluationContext, FlagValue } from '../feature-flags/feature-flags';
import type { HttpClient, HttpRequest } from '../http/http-client';
import { createApplicationI18n } from '../i18n/application-i18n';
import type { ModuleBootContext, ModuleDefinition, ModuleTeardown, ResolvedPlatform } from '../module/module';
import type { ModuleHttpContributions } from '../module/module-registry';
import { registerModules } from '../module/module-registry';
import type { ErrorReporter, ReportedUser } from '@sinemacula/foundation/reporting/error-reporter';
import { MemoryStorage } from '@sinemacula/foundation/storage/memory-storage';
import type { SessionModuleOptions } from './create-session-module';
import { createSessionModule } from './create-session-module';
import type { SessionApi, SessionDevice } from './session-api';
import { resetSessionContext, sessionContext } from './session-context';
import type { SessionStore } from './session-store';
import { useSessionStore } from './session-store';
import type { SessionTokens } from './session-tokens';
import type { SessionUser } from './session-user';

const EmptyComponent = defineComponent({ render: () => null });

const NOW = 1_700_000_000_000;
const MAX_TIMEOUT_DELAY_MS = 2_147_483_647;

const ACCESS_TOKEN_KEY = 'auth.access_token';
const REFRESH_TOKEN_KEY = 'auth.refresh_token';
const EXPIRES_AT_KEY = 'auth.expires_at';
const DEVICE_UUID_KEY = 'auth.device_uuid';

/**
 * An in-memory {@link SessionApi} fake that records every call and replays
 * queued outcomes in order.
 */
class FakeSessionApi implements SessionApi {
    readonly calls: string[] = [];
    readonly loginCalls: Array<{ credentials: unknown; device: SessionDevice }> = [];
    readonly refreshCalls: string[] = [];

    readonly #sessions: Array<SessionTokens | Error> = [];
    readonly #users: Array<SessionUser | Error> = [];

    /**
     * Queue an outcome for the next login or refresh call.
     *
     * @param outcome - the tokens to resolve with, or the error to reject with
     */
    queueSession(outcome: SessionTokens | Error): void {
        this.#sessions.push(outcome);
    }

    /**
     * Queue an outcome for the next currentUser call.
     *
     * @param outcome - the user to resolve with, or the error to reject with
     */
    queueUser(outcome: SessionUser | Error): void {
        this.#users.push(outcome);
    }

    login(credentials: unknown, device: SessionDevice): Promise<SessionTokens> {
        this.calls.push('login');
        this.loginCalls.push({ credentials, device });

        return take(this.#sessions);
    }

    refresh(refreshToken: string): Promise<SessionTokens> {
        this.calls.push('refresh');
        this.refreshCalls.push(refreshToken);

        return take(this.#sessions);
    }

    logout(): Promise<void> {
        this.calls.push('logout');

        return Promise.resolve();
    }

    currentUser(): Promise<SessionUser> {
        this.calls.push('currentUser');

        return take(this.#users);
    }
}

/**
 * Consume the next queued outcome.
 *
 * @param queue - the outcome queue
 * @returns a promise resolving or rejecting with the next outcome
 */
function take<T>(queue: Array<T | Error>): Promise<T> {
    const outcome = queue.shift();

    if (outcome === undefined) {
        return Promise.reject(new Error('No queued outcome.'));
    }

    return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome);
}

/** A valid token bundle as returned by the gateway. */
function tokens(overrides: Partial<SessionTokens> = {}): SessionTokens {
    return {
        accessToken: 'new-token',
        refreshToken: 'new-refresh-token',
        expiresAtEpochMs: null,
        ...overrides,
    };
}

/** A mapped user record as returned by the gateway. */
function user(overrides: Partial<SessionUser> = {}): SessionUser {
    return { id: 'u1', email: 'alice@example.com', name: 'Alice Smith', permissions: [], ...overrides };
}

type StorageListener = (event: StorageEvent) => void;

/** A minimal fake window recording `storage` listeners for direct dispatch. */
interface FakeWindow {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
    listenerCount(): number;
    dispatchStorage(init: { key: string | null; newValue: string | null }): void;
}

/** Build the fake window. */
function makeWindow(): FakeWindow {
    const listeners = new Set<StorageListener>();

    return {
        addEventListener: (_type: string, listener: EventListenerOrEventListenerObject): void => {
            listeners.add(listener as StorageListener);
        },
        removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject): void => {
            listeners.delete(listener as StorageListener);
        },
        listenerCount: (): number => listeners.size,
        dispatchStorage: (init: { key: string | null; newValue: string | null }): void => {
            const event = { key: init.key, newValue: init.newValue } as StorageEvent;

            for (const listener of listeners) {
                listener(event);
            }
        },
    };
}

/** Build an HTTP client stand-in that fails loudly if any method is invoked. */
function createHttpClientStub(): HttpClient {
    const fail = (): Promise<never> => Promise.reject(new Error('The stub HTTP client must not be called.'));

    return { get: fail, post: fail, put: fail, patch: fail, delete: fail, download: fail };
}

/** A recorded call made against {@link FakeHttpClient}. */
interface RecordedHttpCall {
    readonly method: string;
    readonly path: string;
}

/**
 * An in-memory {@link HttpClient} fake recording calls and replaying queued
 * payloads.
 */
class FakeHttpClient implements HttpClient {
    readonly calls: RecordedHttpCall[] = [];
    readonly #queue: unknown[] = [];

    /**
     * Queue a response payload for the next call.
     *
     * @param value - the payload the next call resolves with
     */
    queueResponse(value: unknown): void {
        this.#queue.push(value);
    }

    get<T>(path: string): Promise<T> {
        return this.#consume('GET', path);
    }

    post<T>(path: string): Promise<T> {
        return this.#consume('POST', path);
    }

    put<T>(path: string): Promise<T> {
        return this.#consume('PUT', path);
    }

    patch<T>(path: string): Promise<T> {
        return this.#consume('PATCH', path);
    }

    delete<T>(path: string): Promise<T> {
        return this.#consume('DELETE', path);
    }

    download(path: string): Promise<Blob> {
        return this.#consume('DOWNLOAD', path);
    }

    #consume<T>(method: string, path: string): Promise<T> {
        this.calls.push({ method, path });

        return Promise.resolve(this.#queue.shift() as T);
    }
}

/** A recording {@link ErrorReporter} capturing identity changes. */
class RecordingReporter implements ErrorReporter {
    readonly users: Array<ReportedUser | null> = [];

    captureError(): void {
        // Identity tests only observe setUser.
    }

    captureMessage(): void {
        // Identity tests only observe setUser.
    }

    setUser(reported: ReportedUser | null): void {
        this.users.push(reported);
    }
}

/** A recording {@link AnalyticsTracker} capturing identify and reset calls. */
class RecordingAnalytics implements AnalyticsTracker {
    readonly identified: string[] = [];
    resets = 0;

    track(): void {
        // Identity tests only observe identify and reset.
    }

    page(): void {
        // Identity tests only observe identify and reset.
    }

    identify(id: string): void {
        this.identified.push(id);
    }

    reset(): void {
        this.resets += 1;
    }
}

/** A recording {@link FeatureFlags} capturing evaluation contexts. */
class RecordingFeatureFlags implements FeatureFlags {
    readonly contexts: FlagEvaluationContext[] = [];

    isEnabled(): boolean {
        return false;
    }

    variant<Value extends FlagValue>(_key: string, fallback: Value): Value {
        return fallback;
    }

    setContext(context: FlagEvaluationContext): void {
        this.contexts.push(context);
    }

    onChange(): () => void {
        return () => undefined;
    }
}

/** Everything a test needs after registering the module. */
interface Harness {
    readonly module: ModuleDefinition;
    readonly storage: MemoryStorage;
    readonly pinia: Pinia;
    readonly win: FakeWindow;
    readonly contributions: ModuleHttpContributions;
    readonly bootContext: ModuleBootContext;
    readonly pushes: RouteLocationRaw[];
}

describe('createSessionModule', () => {
    let now: number;
    let fake: FakeSessionApi;
    let reporter: RecordingReporter;
    let tracker: RecordingAnalytics;
    let flags: RecordingFeatureFlags;

    /**
     * Register the module through the real registry path and assemble the boot
     * context around it.
     *
     * @param options - session module options; a fake API is injected unless
     * the test supplies its own or opts into the shipped default
     * @param setup - harness seams: the routed path, a push rejection, and the
     * default-gateway opt-in
     * @returns the harness
     */
    function createHarness(
        options: SessionModuleOptions = {},
        setup: { fullPath?: string; pushRejection?: Error; defaultApi?: boolean } = {},
    ): Harness {
        const module = createSessionModule(setup.defaultApi === true ? options : { api: () => fake, ...options });
        const storage = new MemoryStorage();
        const pinia = createPinia();

        setActivePinia(pinia);

        const win = makeWindow();
        const platform: ResolvedPlatform = {
            fetchFn: () => Promise.resolve(new Response()),
            targetWindow: win as unknown as Window,
            targetDocument: document,
            clock: () => now,
        };
        const contributions = registerModules([module], {
            config: new ConfigRepository({}),
            environment: new Environment({ get: () => undefined }),
            storage,
            pinia,
            platform,
        });
        const pushes: RouteLocationRaw[] = [];
        const router = {
            currentRoute: { value: { fullPath: setup.fullPath ?? '/dashboard' } },
            push: (to: RouteLocationRaw): Promise<void> => {
                pushes.push(to);

                return setup.pushRejection === undefined ? Promise.resolve() : Promise.reject(setup.pushRejection);
            },
        } as unknown as Router;
        const bootContext: ModuleBootContext = {
            app: createApp(EmptyComponent),
            router,
            pinia,
            i18n: createApplicationI18n('en-GB'),
            http: createHttpClientStub(),
            storage,
            config: new ConfigRepository({}),
            platform,
        };

        return { module, storage, pinia, win, contributions, bootContext, pushes };
    }

    /**
     * Boot the module, asserting a teardown is always returned.
     *
     * @param harness - the registered harness
     * @returns the module teardown
     */
    async function boot(harness: Harness): Promise<ModuleTeardown> {
        const teardown = await harness.module.boot?.(harness.bootContext);

        if (teardown === undefined) {
            throw new Error('The session module must return a boot teardown.');
        }

        return teardown;
    }

    beforeEach(() => {
        vi.useFakeTimers();
        now = NOW;
        fake = new FakeSessionApi();
        reporter = new RecordingReporter();
        tracker = new RecordingAnalytics();
        flags = new RecordingFeatureFlags();
        installApi(createHttpClientStub());
        installReporting(reporter);
        installAnalytics(tracker);
        installFeatureFlags(flags);
    });

    afterEach(() => {
        vi.useRealTimers();
        resetWebCoreServices();
        resetSessionContext();
    });

    describe('module shape', () => {
        it('returns a module named session with no routes, locales or fallback', () => {
            const module = createSessionModule();

            expect(module.name).toBe('session');
            expect(module.routes).toStrictEqual([]);
            expect(module.locales).toBeUndefined();
            expect(module.fallback).toBeUndefined();
            expect(typeof module.register).toBe('function');
            expect(typeof module.boot).toBe('function');
            expect(module.stores).toHaveLength(1);
        });

        it('honours a custom registry name', () => {
            expect(createSessionModule({ name: 'auth-session' }).name).toBe('auth-session');
        });
    });

    describe('register phase', () => {
        it('installs the session context with the default storage keys', () => {
            createHarness();

            expect(sessionContext().storageKeys).toStrictEqual({
                accessToken: 'auth.access_token',
                refreshToken: 'auth.refresh_token',
                expiresAt: 'auth.expires_at',
                deviceUuid: 'auth.device_uuid',
            });
        });

        it('merges storage-key overrides over the defaults', () => {
            createHarness({ storageKeys: { accessToken: 'session.token' } });

            expect(sessionContext().storageKeys).toStrictEqual({
                accessToken: 'session.token',
                refreshToken: 'auth.refresh_token',
                expiresAt: 'auth.expires_at',
                deviceUuid: 'auth.device_uuid',
            });
        });

        it('installs the session context with the default route identity', () => {
            createHarness();

            expect(sessionContext().routes).toStrictEqual({
                login: { name: 'auth.login' },
                loginPath: '/login',
                home: '/',
                forbidden: '/forbidden',
            });
        });

        it('merges route overrides over the defaults', () => {
            createHarness({ routes: { login: { name: 'sign-in' }, loginPath: '/sign-in' } });

            expect(sessionContext().routes).toStrictEqual({
                login: { name: 'sign-in' },
                loginPath: '/sign-in',
                home: '/',
                forbidden: '/forbidden',
            });
        });

        it('registers the session store under the default auth id', () => {
            const harness = createHarness();

            expect(sessionContext().storeId).toBe('auth');
            expect((useSessionStore(harness.pinia) as unknown as Record<'$id', string>).$id).toBe('auth');
        });

        it('registers the session store under a custom id', () => {
            const harness = createHarness({ storeId: 'session-custom' });

            expect((useSessionStore(harness.pinia) as unknown as Record<'$id', string>).$id).toBe('session-custom');
        });

        it('hydrates a legacy persisted expiry through the wire-timestamp parser', () => {
            const harness = createHarness();

            harness.storage.set(EXPIRES_AT_KEY, '2026-06-30 12:00:00');

            expect(useSessionStore(harness.pinia).expiresAtEpochMs).toBe(1_782_820_800_000);
        });

        it('hydrates an unparseable legacy expiry as null', () => {
            const harness = createHarness();

            harness.storage.set(EXPIRES_AT_KEY, 'not-a-timestamp');

            expect(useSessionStore(harness.pinia).expiresAtEpochMs).toBeNull();
        });

        it('contributes exactly one request interceptor and no response-error handlers', () => {
            const harness = createHarness();

            expect(harness.contributions.requestInterceptors).toHaveLength(1);
            expect(harness.contributions.responseErrorHandlers).toHaveLength(0);
            expect(harness.contributions.onUnauthorized).not.toBeNull();
        });

        it('attaches the store access token through the bearer interceptor', async () => {
            const harness = createHarness();

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok-123');

            const request: HttpRequest = { method: 'GET', url: '/x', headers: {}, body: undefined };
            const intercepted = await harness.contributions.requestInterceptors[0]?.(request);

            expect(intercepted?.headers).toStrictEqual({ authorization: 'Bearer tok-123' });
        });

        it('leaves requests untouched through the bearer interceptor when signed out', async () => {
            const harness = createHarness();
            const request: HttpRequest = { method: 'GET', url: '/x', headers: {}, body: undefined };

            const intercepted = await harness.contributions.requestInterceptors[0]?.(request);

            expect(intercepted).toBe(request);
        });

        it('refreshes the session through the contributed unauthorized handler', async () => {
            const harness = createHarness();

            harness.storage.set(REFRESH_TOKEN_KEY, 'old-refresh');

            const store = useSessionStore(harness.pinia);

            fake.queueSession(tokens({ accessToken: 'fresh-token' }));

            const retried = await harness.contributions.onUnauthorized?.();

            expect(retried).toBe(true);
            expect(fake.refreshCalls).toStrictEqual(['old-refresh']);
            expect(store.accessToken).toBe('fresh-token');
        });

        it('single-flights concurrent unauthorized refreshes through the coordinator', async () => {
            const harness = createHarness();

            harness.storage.set(REFRESH_TOKEN_KEY, 'old-refresh');
            useSessionStore(harness.pinia);
            fake.queueSession(tokens());

            const [first, second] = await Promise.all([
                harness.contributions.onUnauthorized?.(),
                harness.contributions.onUnauthorized?.(),
            ]);

            expect(first).toBe(true);
            expect(second).toBe(true);
            expect(fake.refreshCalls).toStrictEqual(['old-refresh']);
        });
    });

    describe('session API gateway', () => {
        it('resolves the API lazily over the HTTP holder on first access', () => {
            resetWebCoreServices();

            const harness = createHarness({}, { defaultApi: true });

            expect(harness.contributions.requestInterceptors).toHaveLength(1);
            expect(() => sessionContext().api).toThrowError('http client accessed before initialisation');
        });

        it('builds the default gateway over the installed HTTP client', async () => {
            createHarness({}, { defaultApi: true });

            const http = new FakeHttpClient();

            installApi(http);
            http.queueResponse(undefined);

            await sessionContext().api.logout();

            expect(http.calls).toStrictEqual([{ method: 'DELETE', path: 'auth' }]);
        });

        it('memoises the gateway across accesses', () => {
            createHarness({}, { defaultApi: true });
            installApi(new FakeHttpClient());

            expect(sessionContext().api).toBe(sessionContext().api);
        });

        it('passes the installed HTTP client to a custom API factory', () => {
            let received: HttpClient | null = null;
            const factory = (http: HttpClient): SessionApi => {
                received = http;

                return fake;
            };

            createHarness({ api: factory });

            const installed = new FakeHttpClient();

            installApi(installed);

            expect(sessionContext().api).toBe(fake);
            expect(received).toBe(installed);
        });
    });

    describe('stores phase', () => {
        it('instantiates the session store hydrated from storage', () => {
            const harness = createHarness();

            harness.storage.set(ACCESS_TOKEN_KEY, 'persisted-token');

            const store = harness.module.stores?.[0]?.(harness.pinia) as SessionStore;

            expect(store.accessToken).toBe('persisted-token');
            expect(typeof store.$dispose).toBe('function');
        });
    });

    describe('cross-tab sync', () => {
        it('clears the session locally when the access-token key is removed in another tab', async () => {
            const harness = createHarness();

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');

            const store = useSessionStore(harness.pinia);

            await boot(harness);

            harness.win.dispatchStorage({ key: ACCESS_TOKEN_KEY, newValue: null });

            expect(store.accessToken).toBeNull();
        });

        it('clears the session locally on a full storage clear (key null, newValue null)', async () => {
            const harness = createHarness();

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');

            const store = useSessionStore(harness.pinia);

            await boot(harness);

            harness.win.dispatchStorage({ key: null, newValue: null });

            expect(store.accessToken).toBeNull();
        });

        it('hydrates from storage and rehydrates the user when a token appears in another tab', async () => {
            const harness = createHarness();
            const store = useSessionStore(harness.pinia);

            await boot(harness);

            harness.storage.set(ACCESS_TOKEN_KEY, 'new-tab-token');
            harness.storage.set(REFRESH_TOKEN_KEY, 'new-tab-refresh');
            fake.queueUser(user());

            harness.win.dispatchStorage({ key: ACCESS_TOKEN_KEY, newValue: 'new-tab-token' });
            await vi.advanceTimersByTimeAsync(0);

            expect(store.accessToken).toBe('new-tab-token');
            expect(store.refreshToken).toBe('new-tab-refresh');
            expect(store.user?.email).toBe('alice@example.com');
        });

        it('ignores storage events for unrelated keys', async () => {
            const harness = createHarness();

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');

            const store = useSessionStore(harness.pinia);

            await boot(harness);

            harness.win.dispatchStorage({ key: 'some.other.key', newValue: null });

            expect(store.accessToken).toBe('tok');
        });

        it('listens on the overridden access-token key', async () => {
            const harness = createHarness({ storageKeys: { accessToken: 'session.token' } });

            harness.storage.set('session.token', 'tok');

            const store = useSessionStore(harness.pinia);

            await boot(harness);

            harness.win.dispatchStorage({ key: ACCESS_TOKEN_KEY, newValue: null });
            expect(store.accessToken).toBe('tok');

            harness.win.dispatchStorage({ key: 'session.token', newValue: null });
            expect(store.accessToken).toBeNull();
        });

        it('swallows a rehydrateUser failure triggered by a cross-tab storage event', async () => {
            const harness = createHarness();
            const store = useSessionStore(harness.pinia);
            const rehydrateMock = vi.fn((): Promise<void> => Promise.reject(new Error('rehydrate failed')));

            store.rehydrateUser = rehydrateMock;

            await boot(harness);

            harness.storage.set(ACCESS_TOKEN_KEY, 'new-tab-token');
            harness.win.dispatchStorage({ key: ACCESS_TOKEN_KEY, newValue: 'new-tab-token' });
            await vi.advanceTimersByTimeAsync(0);

            expect(rehydrateMock).toHaveBeenCalledTimes(1);
        });

        it('does not react to storage events after teardown', async () => {
            const harness = createHarness();

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');

            const store = useSessionStore(harness.pinia);
            const teardown = await boot(harness);

            teardown();
            harness.win.dispatchStorage({ key: ACCESS_TOKEN_KEY, newValue: null });

            expect(store.accessToken).toBe('tok');
            expect(harness.win.listenerCount()).toBe(0);
        });

        it('installs no storage listener when crossTabSync is disabled', async () => {
            const harness = createHarness({ crossTabSync: false });

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');

            const store = useSessionStore(harness.pinia);

            await boot(harness);

            expect(harness.win.listenerCount()).toBe(0);

            harness.win.dispatchStorage({ key: ACCESS_TOKEN_KEY, newValue: null });
            expect(store.accessToken).toBe('tok');
        });
    });

    describe('proactive refresh', () => {
        it('schedules a refresh ahead of the hydrated expiry by the skew amount', async () => {
            const harness = createHarness({ refreshSkewMs: 1_000 });

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');
            harness.storage.set(REFRESH_TOKEN_KEY, 'refresh-token');
            harness.storage.set(EXPIRES_AT_KEY, String(NOW + 5_000));
            fake.queueUser(user());
            fake.queueSession(tokens());

            useSessionStore(harness.pinia);
            await boot(harness);

            await vi.advanceTimersByTimeAsync(3_999);
            expect(fake.refreshCalls).toStrictEqual([]);

            await vi.advanceTimersByTimeAsync(1);
            expect(fake.refreshCalls).toStrictEqual(['refresh-token']);
        });

        it('schedules a refresh when the expiry changes after boot', async () => {
            const harness = createHarness({ refreshSkewMs: 1_000 });

            harness.storage.set(REFRESH_TOKEN_KEY, 'refresh-token');

            const store = useSessionStore(harness.pinia);

            await boot(harness);

            fake.queueSession(tokens());
            harness.storage.set(EXPIRES_AT_KEY, String(NOW + 5_000));
            store.hydrateFromStorage();

            await vi.advanceTimersByTimeAsync(3_999);
            expect(fake.refreshCalls).toStrictEqual([]);

            await vi.advanceTimersByTimeAsync(1);
            expect(fake.refreshCalls).toStrictEqual(['refresh-token']);
        });

        it('clamps the delay to zero when the expiry has already passed', async () => {
            const harness = createHarness();

            harness.storage.set(REFRESH_TOKEN_KEY, 'refresh-token');
            harness.storage.set(EXPIRES_AT_KEY, String(NOW - 10_000));
            fake.queueSession(tokens());

            useSessionStore(harness.pinia);
            await boot(harness);

            await vi.advanceTimersByTimeAsync(0);

            expect(fake.refreshCalls).toStrictEqual(['refresh-token']);
        });

        it('uses the default 60-second skew when refreshSkewMs is not provided', async () => {
            const harness = createHarness();

            harness.storage.set(REFRESH_TOKEN_KEY, 'refresh-token');
            harness.storage.set(EXPIRES_AT_KEY, String(NOW + 60_000 + 1_000));
            fake.queueSession(tokens());

            useSessionStore(harness.pinia);
            await boot(harness);

            await vi.advanceTimersByTimeAsync(999);
            expect(fake.refreshCalls).toStrictEqual([]);

            await vi.advanceTimersByTimeAsync(1);
            expect(fake.refreshCalls).toStrictEqual(['refresh-token']);
        });

        it('re-evaluates instead of firing when the delay exceeds the timer range', async () => {
            const harness = createHarness({ refreshSkewMs: 1_000 });

            harness.storage.set(REFRESH_TOKEN_KEY, 'refresh-token');
            harness.storage.set(EXPIRES_AT_KEY, String(NOW + 4_000_000_000_000));

            useSessionStore(harness.pinia);
            await boot(harness);

            await vi.advanceTimersByTimeAsync(MAX_TIMEOUT_DELAY_MS);

            expect(fake.refreshCalls).toStrictEqual([]);
        });

        it('fires after re-arming once the horizon brings the delay into range', async () => {
            const harness = createHarness({ refreshSkewMs: 1_000 });

            harness.storage.set(REFRESH_TOKEN_KEY, 'refresh-token');
            harness.storage.set(EXPIRES_AT_KEY, String(NOW + MAX_TIMEOUT_DELAY_MS + 2_000));
            fake.queueSession(tokens());

            useSessionStore(harness.pinia);
            await boot(harness);

            await vi.advanceTimersByTimeAsync(MAX_TIMEOUT_DELAY_MS - 1);
            expect(fake.refreshCalls).toStrictEqual([]);

            now = NOW + MAX_TIMEOUT_DELAY_MS;
            await vi.advanceTimersByTimeAsync(1);
            expect(fake.refreshCalls).toStrictEqual([]);

            await vi.advanceTimersByTimeAsync(999);
            expect(fake.refreshCalls).toStrictEqual([]);

            await vi.advanceTimersByTimeAsync(1);
            expect(fake.refreshCalls).toStrictEqual(['refresh-token']);
        });

        it('does not schedule a refresh when no expiry is known', async () => {
            const harness = createHarness();

            harness.storage.set(REFRESH_TOKEN_KEY, 'refresh-token');

            useSessionStore(harness.pinia);
            await boot(harness);

            await vi.advanceTimersByTimeAsync(1_000_000);

            expect(fake.refreshCalls).toStrictEqual([]);
        });

        it('cancels the pending timer when the expiry is cleared', async () => {
            const harness = createHarness({ refreshSkewMs: 1_000 });

            harness.storage.set(REFRESH_TOKEN_KEY, 'refresh-token');
            harness.storage.set(EXPIRES_AT_KEY, String(NOW + 5_000));

            const store = useSessionStore(harness.pinia);

            await boot(harness);

            harness.storage.remove(EXPIRES_AT_KEY);
            store.hydrateFromStorage();

            await vi.advanceTimersByTimeAsync(10_000);

            expect(fake.refreshCalls).toStrictEqual([]);
        });

        it('reschedules when the expiry changes, cancelling the previous timer', async () => {
            const harness = createHarness({ refreshSkewMs: 1_000 });

            harness.storage.set(REFRESH_TOKEN_KEY, 'refresh-token');
            harness.storage.set(EXPIRES_AT_KEY, String(NOW + 5_000));

            const store = useSessionStore(harness.pinia);

            await boot(harness);

            fake.queueSession(tokens());
            harness.storage.set(EXPIRES_AT_KEY, String(NOW + 20_000));
            store.hydrateFromStorage();

            await vi.advanceTimersByTimeAsync(4_000);
            expect(fake.refreshCalls).toStrictEqual([]);

            await vi.advanceTimersByTimeAsync(15_000);
            expect(fake.refreshCalls).toStrictEqual(['refresh-token']);
        });

        it('does not fire a scheduled refresh after teardown', async () => {
            const harness = createHarness({ refreshSkewMs: 1_000 });

            harness.storage.set(REFRESH_TOKEN_KEY, 'refresh-token');
            harness.storage.set(EXPIRES_AT_KEY, String(NOW + 5_000));

            useSessionStore(harness.pinia);

            const teardown = await boot(harness);

            teardown();

            await vi.advanceTimersByTimeAsync(10_000);

            expect(fake.refreshCalls).toStrictEqual([]);
        });

        it('does not react to expiry changes after teardown', async () => {
            const harness = createHarness({ refreshSkewMs: 1_000 });

            harness.storage.set(REFRESH_TOKEN_KEY, 'refresh-token');

            const store = useSessionStore(harness.pinia);
            const teardown = await boot(harness);

            teardown();

            harness.storage.set(EXPIRES_AT_KEY, String(NOW + 2_000));
            store.hydrateFromStorage();

            await vi.advanceTimersByTimeAsync(10_000);

            expect(fake.refreshCalls).toStrictEqual([]);
        });

        it('swallows a failed proactive refresh', async () => {
            const harness = createHarness({ refreshSkewMs: 1_000 });
            const store = useSessionStore(harness.pinia);
            const refreshMock = vi.fn((): Promise<boolean> => Promise.reject(new Error('refresh failed')));

            store.refresh = refreshMock;
            harness.storage.set(EXPIRES_AT_KEY, String(NOW + 1_000));
            store.hydrateFromStorage();

            await boot(harness);
            await vi.advanceTimersByTimeAsync(0);

            expect(refreshMock).toHaveBeenCalledTimes(1);
        });

        it('routes the proactive refresh through the shared coordinator', async () => {
            const harness = createHarness({ refreshSkewMs: 1_000 });

            harness.storage.set(EXPIRES_AT_KEY, String(NOW));

            const store = useSessionStore(harness.pinia);

            let resolveRefresh!: (value: boolean) => void;
            const refreshMock = vi.fn(
                () =>
                    new Promise<boolean>(resolve => {
                        resolveRefresh = resolve;
                    }),
            );

            store.refresh = refreshMock;

            await boot(harness);
            await vi.advanceTimersByTimeAsync(0);

            const joined = harness.contributions.onUnauthorized?.();

            resolveRefresh(true);

            await expect(joined).resolves.toBe(true);
            expect(refreshMock).toHaveBeenCalledTimes(1);
        });

        it('schedules nothing when proactiveRefresh is disabled', async () => {
            const harness = createHarness({ proactiveRefresh: false });

            harness.storage.set(REFRESH_TOKEN_KEY, 'refresh-token');
            harness.storage.set(EXPIRES_AT_KEY, String(NOW - 10_000));

            useSessionStore(harness.pinia);
            await boot(harness);

            await vi.advanceTimersByTimeAsync(1_000_000);

            expect(fake.refreshCalls).toStrictEqual([]);
        });
    });

    describe('boot rehydration', () => {
        it('rehydrates the user at boot when already authenticated', async () => {
            const harness = createHarness();

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');
            fake.queueUser(user());

            const store = useSessionStore(harness.pinia);

            await boot(harness);
            await vi.advanceTimersByTimeAsync(0);

            expect(store.user?.email).toBe('alice@example.com');
        });

        it('does not rehydrate the user at boot when unauthenticated', async () => {
            const harness = createHarness();
            const store = useSessionStore(harness.pinia);
            const rehydrateMock = vi.fn();

            store.rehydrateUser = rehydrateMock;

            await boot(harness);
            await vi.advanceTimersByTimeAsync(0);

            expect(rehydrateMock).not.toHaveBeenCalled();
        });

        it('swallows a rehydrateUser failure triggered by boot rehydration', async () => {
            const harness = createHarness();

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');

            const store = useSessionStore(harness.pinia);
            const rehydrateMock = vi.fn((): Promise<void> => Promise.reject(new Error('boot rehydrate failed')));

            store.rehydrateUser = rehydrateMock;

            await boot(harness);
            await vi.advanceTimersByTimeAsync(0);

            expect(rehydrateMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('session-loss redirect', () => {
        it('pushes the login route carrying the sanitised current path when the session is lost', async () => {
            const harness = createHarness();

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');

            const store = useSessionStore(harness.pinia);

            await boot(harness);

            store.clearLocal();
            await nextTick();

            expect(harness.pushes).toStrictEqual([{ name: 'auth.login', query: { redirect: '/dashboard' } }]);
        });

        it('omits the redirect parameter when the current path is not a safe target', async () => {
            const harness = createHarness({}, { fullPath: '/login?redirect=%2Fdashboard' });

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');

            const store = useSessionStore(harness.pinia);

            await boot(harness);

            store.clearLocal();
            await nextTick();

            expect(harness.pushes).toStrictEqual([{ name: 'auth.login' }]);
        });

        it('respects a custom login route and loop-guard path', async () => {
            const harness = createHarness(
                { routes: { login: '/sign-in', loginPath: '/sign-in' } },
                { fullPath: '/sign-in' },
            );

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');

            const store = useSessionStore(harness.pinia);

            await boot(harness);

            store.clearLocal();
            await nextTick();

            expect(harness.pushes).toStrictEqual(['/sign-in']);
        });

        it('does not push when the session transitions from unauthenticated to authenticated', async () => {
            const harness = createHarness();
            const store = useSessionStore(harness.pinia);

            await boot(harness);

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');
            store.hydrateFromStorage();
            await nextTick();

            expect(harness.pushes).toStrictEqual([]);
        });

        it('does not push when sessionLossRedirect is disabled', async () => {
            const harness = createHarness({ sessionLossRedirect: false });

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');

            const store = useSessionStore(harness.pinia);

            await boot(harness);

            store.clearLocal();
            await nextTick();

            expect(harness.pushes).toStrictEqual([]);
        });

        it('does not push after teardown', async () => {
            const harness = createHarness();

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');

            const store = useSessionStore(harness.pinia);
            const teardown = await boot(harness);

            teardown();

            store.clearLocal();
            await nextTick();

            expect(harness.pushes).toStrictEqual([]);
        });

        it('swallows a rejected navigation', async () => {
            const harness = createHarness({}, { pushRejection: new Error('navigation aborted') });

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');

            const store = useSessionStore(harness.pinia);

            await boot(harness);

            store.clearLocal();
            await nextTick();
            await vi.advanceTimersByTimeAsync(0);

            expect(harness.pushes).toHaveLength(1);
        });
    });

    describe('identity fan-out', () => {
        it('identifies every channel with the default mapping when the user loads', async () => {
            const harness = createHarness();

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');
            fake.queueUser(user());

            useSessionStore(harness.pinia);
            await boot(harness);
            await vi.advanceTimersByTimeAsync(0);

            expect(reporter.users).toStrictEqual([{ id: 'u1', email: 'alice@example.com', name: 'Alice Smith' }]);
            expect(tracker.identified).toStrictEqual(['u1']);
            expect(flags.contexts).toStrictEqual([{ userId: 'u1' }]);
        });

        it('stringifies a numeric user id across every channel', async () => {
            const harness = createHarness();

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');
            fake.queueUser(user({ id: 7 }));

            useSessionStore(harness.pinia);
            await boot(harness);
            await vi.advanceTimersByTimeAsync(0);

            expect(reporter.users).toStrictEqual([{ id: '7', email: 'alice@example.com', name: 'Alice Smith' }]);
            expect(tracker.identified).toStrictEqual(['7']);
            expect(flags.contexts).toStrictEqual([{ userId: '7' }]);
        });

        it('omits null email and name from the reported identity', async () => {
            const harness = createHarness();

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');
            fake.queueUser(user({ email: null, name: null }));

            useSessionStore(harness.pinia);
            await boot(harness);
            await vi.advanceTimersByTimeAsync(0);

            expect(reporter.users).toStrictEqual([{ id: 'u1' }]);
        });

        it('clears every channel together on sign-out', async () => {
            const harness = createHarness();

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');
            fake.queueUser(user());

            const store = useSessionStore(harness.pinia);

            await boot(harness);
            await vi.advanceTimersByTimeAsync(0);

            store.clearLocal();
            await nextTick();

            expect(reporter.users).toStrictEqual([{ id: 'u1', email: 'alice@example.com', name: 'Alice Smith' }, null]);
            expect(tracker.resets).toBe(1);
            expect(flags.contexts).toStrictEqual([{ userId: 'u1' }, {}]);
        });

        it('merges custom per-channel mappings over the defaults', async () => {
            const harness = createHarness({
                identity: { analytics: identified => `analytics-${String(identified.id)}` },
            });

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');
            fake.queueUser(user());

            useSessionStore(harness.pinia);
            await boot(harness);
            await vi.advanceTimersByTimeAsync(0);

            expect(tracker.identified).toStrictEqual(['analytics-u1']);
            expect(reporter.users).toStrictEqual([{ id: 'u1', email: 'alice@example.com', name: 'Alice Smith' }]);
            expect(flags.contexts).toStrictEqual([{ userId: 'u1' }]);
        });

        it('merges a custom reporting mapping over the default', async () => {
            const harness = createHarness({
                identity: { reporting: identified => ({ id: `reporting-${String(identified.id)}` }) },
            });

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');
            fake.queueUser(user());

            useSessionStore(harness.pinia);
            await boot(harness);
            await vi.advanceTimersByTimeAsync(0);

            expect(reporter.users).toStrictEqual([{ id: 'reporting-u1' }]);
            expect(tracker.identified).toStrictEqual(['u1']);
            expect(flags.contexts).toStrictEqual([{ userId: 'u1' }]);
        });

        it('merges a custom feature-flag mapping over the default', async () => {
            const harness = createHarness({
                identity: { featureFlags: identified => ({ userId: `flags-${String(identified.id)}` }) },
            });

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');
            fake.queueUser(user());

            useSessionStore(harness.pinia);
            await boot(harness);
            await vi.advanceTimersByTimeAsync(0);

            expect(flags.contexts).toStrictEqual([{ userId: 'flags-u1' }]);
            expect(reporter.users).toStrictEqual([{ id: 'u1', email: 'alice@example.com', name: 'Alice Smith' }]);
            expect(tracker.identified).toStrictEqual(['u1']);
        });

        it('disables the fan-out entirely when identity is false', async () => {
            const harness = createHarness({ identity: false });

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');
            fake.queueUser(user());

            const store = useSessionStore(harness.pinia);

            await boot(harness);
            await vi.advanceTimersByTimeAsync(0);

            store.clearLocal();
            await nextTick();

            expect(reporter.users).toStrictEqual([]);
            expect(tracker.identified).toStrictEqual([]);
            expect(tracker.resets).toBe(0);
            expect(flags.contexts).toStrictEqual([]);
        });

        it('does not fan out after teardown', async () => {
            const harness = createHarness();
            const store = useSessionStore(harness.pinia);
            const teardown = await boot(harness);

            teardown();

            harness.storage.set(ACCESS_TOKEN_KEY, 'tok');
            store.hydrateFromStorage();
            fake.queueUser(user());

            await store.rehydrateUser();
            await nextTick();

            expect(store.user?.id).toBe('u1');
            expect(reporter.users).toStrictEqual([]);
        });
    });

    describe('device fingerprint', () => {
        it('generates and persists the uuid on first use', () => {
            const harness = createHarness({ generateUuid: () => 'test-uuid-1234' });

            expect(sessionContext().device()).toStrictEqual({ uuid: 'test-uuid-1234', os: 'WEB' });
            expect(harness.storage.get(DEVICE_UUID_KEY)).toBe('test-uuid-1234');
        });

        it('reuses the stored uuid on subsequent calls', () => {
            let callCount = 0;

            createHarness({
                generateUuid: () => {
                    callCount += 1;

                    return `uuid-${callCount}`;
                },
            });

            expect(sessionContext().device()).toStrictEqual({ uuid: 'uuid-1', os: 'WEB' });
            expect(sessionContext().device()).toStrictEqual({ uuid: 'uuid-1', os: 'WEB' });
            expect(callCount).toBe(1);
        });

        it('reuses a uuid seeded into storage before the first call', () => {
            const harness = createHarness({ generateUuid: () => 'should-not-be-used' });

            harness.storage.set(DEVICE_UUID_KEY, 'pre-seeded-uuid');

            expect(sessionContext().device()).toStrictEqual({ uuid: 'pre-seeded-uuid', os: 'WEB' });
        });

        it('reports a custom deviceOs', () => {
            createHarness({ deviceOs: 'KIOSK', generateUuid: () => 'uuid-kiosk' });

            expect(sessionContext().device()).toStrictEqual({ uuid: 'uuid-kiosk', os: 'KIOSK' });
        });

        it('persists the uuid under an overridden storage key', () => {
            const harness = createHarness({
                storageKeys: { deviceUuid: 'custom.device' },
                generateUuid: () => 'uuid-custom-key',
            });

            sessionContext().device();

            expect(harness.storage.get('custom.device')).toBe('uuid-custom-key');
            expect(harness.storage.get(DEVICE_UUID_KEY)).toBeNull();
        });

        it('defaults the uuid factory to crypto.randomUUID', () => {
            const randomSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000');

            createHarness({});

            expect(sessionContext().device()).toStrictEqual({
                uuid: '00000000-0000-4000-8000-000000000000',
                os: 'WEB',
            });

            randomSpy.mockRestore();
        });

        it('sends the fingerprint with login through the store', async () => {
            const harness = createHarness({ generateUuid: () => 'login-uuid' });

            fake.queueSession(tokens());
            fake.queueUser(user());

            await useSessionStore(harness.pinia).login({ email: 'alice@example.com', password: 'secret' });

            expect(fake.loginCalls).toStrictEqual([
                {
                    credentials: { email: 'alice@example.com', password: 'secret' },
                    device: { uuid: 'login-uuid', os: 'WEB' },
                },
            ]);
            expect(harness.storage.get(DEVICE_UUID_KEY)).toBe('login-uuid');
        });
    });

    describe('teardown', () => {
        it('is safe to call twice', async () => {
            const harness = createHarness();
            const teardown = await boot(harness);

            teardown();

            expect(() => {
                teardown();
            }).not.toThrow();
            expect(harness.win.listenerCount()).toBe(0);
        });
    });
});
