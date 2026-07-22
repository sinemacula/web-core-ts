/**
 * Integration tests for createWebCoreApp.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { Pinia } from 'pinia';
import { createPinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, onMounted } from 'vue';
import type { RouterHistory } from 'vue-router';
import { createMemoryHistory } from 'vue-router';

import { NullAnalyticsTracker } from '@sinemacula/foundation/analytics/null-analytics-tracker';
import type { Environment } from '@sinemacula/foundation/config/environment';
import { createWebEnvironment } from '../config/web-environment';
import { StaticFeatureFlags } from '@sinemacula/foundation/feature-flags/static-feature-flags';
import type { HttpClient, RequestInterceptor, UnauthorizedHandler } from '@sinemacula/foundation/http/http-client';
import { NullLogger } from '@sinemacula/foundation/logging/null-logger';
import type { ModuleBootContext, ModuleDefinition, ModuleRegisterContext } from '../module/module';
import { ModuleRegistryError } from '../module/module-registry';
import { ConfirmService } from '../notifications/confirm-service';
import { ToastService } from '../notifications/toast-service';
import type { RealtimeConnection } from '@sinemacula/foundation/realtime/realtime-connection';
import { NullErrorReporter } from '@sinemacula/foundation/reporting/null-error-reporter';
import type { RouteMiddleware } from '../router/middleware';
import { next } from '../router/middleware';
import { BrowserStorage } from '../storage/browser-storage';
import { MemoryStorage } from '@sinemacula/foundation/storage/memory-storage';
import type { WebCoreApp, WebCoreAppOptions } from './create-web-core-app';
import { createWebCoreApp, observeBootPhases } from './create-web-core-app';
import {
    analytics,
    api,
    appConfig,
    appStorage,
    colorScheme,
    confirmDialogs,
    featureFlags,
    localeSwitcher,
    logger,
    realtime,
    reporting,
    resetWebCoreServices,
    toasts,
} from './services';
import { WebCoreAppError } from './web-core-app-error';
import type { WireHttpClientTools } from './wire-http-client';

const BOOT_PHASE_ORDER = [
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

const EmptyComponent = defineComponent({ render: () => null });

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

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function makeFetch(
    runtime: Record<string, string> | (() => Record<string, string>) = {},
    apiResponder: (url: string, init?: RequestInit) => Response = () => jsonResponse(null),
): ReturnType<typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>> {
    return vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>((input, init) => {
        const url = String(input);

        if (url.endsWith('env.json')) {
            return Promise.resolve(jsonResponse(typeof runtime === 'function' ? runtime() : runtime));
        }

        return Promise.resolve(apiResponder(url, init));
    });
}

type TestWindow = Window & {
    dispatchToListeners(type: string, event: Event): void;
    listenerCount(type: string): number;
};

function makeWindow(languages: readonly string[] = ['en-US']): TestWindow {
    const listeners = new Map<string, EventListenerOrEventListenerObject[]>();

    return {
        navigator: { onLine: true, languages },
        matchMedia: () => ({
            matches: false,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
        }),
        addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
            const existing = listeners.get(type) ?? [];

            existing.push(listener);
            listeners.set(type, existing);
        },
        removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
            const existing = listeners.get(type) ?? [];
            const index = existing.indexOf(listener);

            if (index !== -1) {
                existing.splice(index, 1);
            }
        },
        listenerCount(type: string) {
            return (listeners.get(type) ?? []).length;
        },
        dispatchToListeners(type: string, event: Event) {
            for (const listener of listeners.get(type) ?? []) {
                if (typeof listener === 'function') {
                    listener(event);
                } else {
                    listener.handleEvent(event);
                }
            }
        },
    } as unknown as TestWindow;
}

function defineTestConfiguration(environment: Environment) {
    return {
        api: { baseUrl: environment.string('API_URL', 'https://api.test'), timeout: 5_000 },
        app: {
            name: environment.string('APP_NAME', 'Kernel App'),
            environment: environment.string('APP_ENV', 'testing'),
            version: environment.string('APP_VERSION', 'dev'),
        },
        featureFlags: { flags: { beta: true } },
        locales: {
            default: 'en-US',
            enabled: ['en-US', 'fr-FR'],
            supported: {
                'en-US': { direction: 'ltr' as const },
                'fr-FR': { direction: 'ltr' as const },
            },
        },
    };
}

type TestConfiguration = ReturnType<typeof defineTestConfiguration>;

function makeConfig(runtimeUrl?: string): WebCoreAppOptions<TestConfiguration>['config'] {
    return {
        createEnvironment: (runtime: Readonly<Record<string, string>>): Environment =>
            createWebEnvironment({ runtime, dev: true }),
        define: defineTestConfiguration,
        ...(runtimeUrl === undefined ? {} : { runtimeUrl }),
    };
}

interface Seams {
    readonly fetchFn: ReturnType<typeof makeFetch>;
    readonly storage: MemoryStorage;
    readonly targetWindow: TestWindow;
    readonly targetDocument: Document;
    readonly clock: () => number;
    readonly history: RouterHistory;
    readonly localeCandidates: readonly string[];
}

function makeSeams(fetchFn: ReturnType<typeof makeFetch> = makeFetch()): Seams {
    return {
        fetchFn,
        storage: new MemoryStorage(),
        targetWindow: makeWindow(),
        targetDocument: document.implementation.createHTMLDocument('t'),
        clock: (): number => 1_000,
        history: createMemoryHistory(),
        localeCandidates: ['en-US'],
    };
}

function makeRoot(events: string[] = []): ReturnType<typeof defineComponent> {
    return defineComponent({
        setup() {
            onMounted(() => {
                events.push('mounted');
            });

            return () => h('div', { class: 'root' }, 'root');
        },
    });
}

function homeModule(overrides: Partial<ModuleDefinition> = {}): ModuleDefinition {
    return {
        name: 'home',
        routes: [{ path: '/', name: 'home.index', component: EmptyComponent }],
        ...overrides,
    };
}

function makeRealtime(order: string[]): RealtimeConnection {
    return {
        state: 'idle',
        connect() {
            // The preset never connects; applications decide when to.
        },
        disconnect() {
            order.push('realtime.disconnect');
        },
        on: () => () => {
            // No subscriptions are made by these tests.
        },
        onStateChange: () => () => {
            // No subscriptions are made by these tests.
        },
    };
}

function bootApp(
    overrides: Partial<WebCoreAppOptions<TestConfiguration>> = {},
): Promise<WebCoreApp<TestConfiguration>> {
    return createWebCoreApp<TestConfiguration>({
        root: makeRoot(),
        modules: [homeModule()],
        config: makeConfig(),
        platform: makeSeams(),
        ...overrides,
    });
}

describe('createWebCoreApp', () => {
    afterEach(() => {
        resetWebCoreServices();
    });

    describe('boot phases', () => {
        it('runs every boot phase in the designed order', async () => {
            const phases: string[] = [];
            const detach = observeBootPhases(phase => {
                phases.push(phase);
            });

            const app = await bootApp();

            detach();

            expect(phases).toEqual([...BOOT_PHASE_ORDER]);

            app.dispose();
        });

        it('stops recording phases once the observer is detached', async () => {
            const phases: string[] = [];

            observeBootPhases(phase => {
                phases.push(phase);
            })();

            const app = await bootApp();

            expect(phases).toEqual([]);

            app.dispose();
        });
    });

    describe('runtime document and configuration', () => {
        it('fetches the runtime document from the configured url and freezes the defined configuration', async () => {
            const fetchFn = makeFetch(
                wire([
                    ['APP_NAME', 'Runtime App'],
                    ['API_URL', 'https://api.runtime.test'],
                ]),
            );

            const app = await bootApp({ config: makeConfig('/custom-env.json'), platform: makeSeams(fetchFn) });

            expect(fetchFn).toHaveBeenCalledTimes(1);
            expect(fetchFn).toHaveBeenCalledWith('/custom-env.json', {
                cache: 'no-store',
                headers: { accept: 'application/json' },
            });
            expect(app.config.app.name).toBe('Runtime App');
            expect(app.config.api.baseUrl).toBe('https://api.runtime.test');
            expect(Object.isFrozen(app.config)).toBe(true);
            expect(Object.isFrozen(app.config.app)).toBe(true);
            expect(appConfig<TestConfiguration>()).toBe(app.config);
            expect(app.services.config.all()).toBe(app.config);

            app.dispose();
        });
    });

    describe('service installation', () => {
        it('installs every provided service and exposes the same references on the handle', async () => {
            const toastService = new ToastService();
            const confirmService = new ConfirmService();
            const reporter = new NullErrorReporter();
            const tracker = new NullAnalyticsTracker();
            const logging = new NullLogger();
            const flags = new StaticFeatureFlags({ beta: false });
            const connection = makeRealtime([]);
            const reporterFactory = vi.fn(() => reporter);
            const analyticsFactory = vi.fn(() => tracker);
            const loggerFactory = vi.fn(() => logging);
            const flagsFactory = vi.fn(() => flags);
            const realtimeFactory = vi.fn(() => connection);
            const pinia = createPinia();
            const seams = makeSeams();

            const app = await bootApp({
                pinia,
                observability: { reporter: reporterFactory, analytics: analyticsFactory, logger: loggerFactory },
                featureFlags: flagsFactory,
                realtime: realtimeFactory,
                notifications: { toasts: toastService, confirm: confirmService },
                platform: seams,
            });

            expect(app.pinia).toBe(pinia);
            expect(api()).toBe(app.services.http);
            expect(appStorage()).toBe(seams.storage);
            expect(app.services.storage).toBe(seams.storage);
            expect(toasts()).toBe(toastService);
            expect(app.services.toasts).toBe(toastService);
            expect(confirmDialogs()).toBe(confirmService);
            expect(app.services.confirm).toBe(confirmService);
            expect(reporting()).toBe(reporter);
            expect(app.services.reporting).toBe(reporter);
            expect(analytics()).toBe(tracker);
            expect(app.services.analytics).toBe(tracker);
            expect(logger()).toBe(logging);
            expect(app.services.logger).toBe(logging);
            expect(featureFlags()).toBe(flags);
            expect(app.services.featureFlags).toBe(flags);
            expect(localeSwitcher()).toBe(app.services.localeSwitcher);
            expect(realtime()).toBe(connection);
            expect(app.services.realtime).toBe(connection);
            expect(reporterFactory).toHaveBeenCalledWith(app.config);
            expect(analyticsFactory).toHaveBeenCalledWith(app.config);
            expect(loggerFactory).toHaveBeenCalledWith(app.config);
            expect(flagsFactory).toHaveBeenCalledWith(app.config);
            expect(realtimeFactory).toHaveBeenCalledWith(app.config);

            app.dispose();
        });
    });

    describe('module lifecycle', () => {
        it('registers modules in registry order with the fallback module moved last', async () => {
            const order: string[] = [];
            const contexts: ModuleRegisterContext[] = [];
            const environments: Environment[] = [];
            const pinia = createPinia();
            const seams = makeSeams();
            const fallback = homeModule({
                name: 'errors',
                fallback: true,
                routes: [{ path: '/:pathMatch(.*)*', name: 'errors.notFound', component: EmptyComponent }],
                register: () => {
                    order.push('register:errors');
                },
            });
            const alpha = homeModule({
                name: 'alpha',
                register: context => {
                    order.push('register:alpha');
                    contexts.push(context);
                },
            });

            const app = await bootApp({
                modules: [fallback, alpha],
                pinia,
                config: {
                    createEnvironment: runtime => {
                        const environment = createWebEnvironment({ runtime, dev: true });

                        environments.push(environment);

                        return environment;
                    },
                    define: defineTestConfiguration,
                },
                platform: seams,
            });

            expect(order).toEqual(['register:alpha', 'register:errors']);
            expect(contexts[0]?.config).toBe(app.services.config);
            expect(contexts[0]?.environment).toBe(environments[0]);
            expect(contexts[0]?.storage).toBe(seams.storage);
            expect(contexts[0]?.pinia).toBe(pinia);
            expect(contexts[0]?.platform.fetchFn).toBe(seams.fetchFn);
            expect(contexts[0]?.platform.targetWindow).toBe(seams.targetWindow);
            expect(contexts[0]?.platform.targetDocument).toBe(seams.targetDocument);
            expect(contexts[0]?.platform.clock).toBe(seams.clock);

            app.dispose();
        });

        it('boots modules with the assembled runtime context', async () => {
            const contexts: ModuleBootContext[] = [];
            const pinia = createPinia();
            const seams = makeSeams();

            const app = await bootApp({
                modules: [
                    homeModule({
                        boot: context => {
                            contexts.push(context);

                            return undefined;
                        },
                    }),
                ],
                pinia,
                platform: seams,
            });

            expect(contexts).toHaveLength(1);
            expect(contexts[0]?.app).toBe(app.app);
            expect(contexts[0]?.router).toBe(app.router);
            expect(contexts[0]?.pinia).toBe(pinia);
            expect(contexts[0]?.i18n).toBe(app.i18n);
            expect(contexts[0]?.http).toBe(app.services.http);
            expect(contexts[0]?.storage).toBe(seams.storage);
            expect(contexts[0]?.config).toBe(app.services.config);
            expect(contexts[0]?.platform.clock).toBe(seams.clock);

            app.dispose();
        });

        it('instantiates module store factories with the application pinia', async () => {
            const received: Pinia[] = [];
            const pinia = createPinia();

            const app = await bootApp({
                modules: [
                    homeModule({
                        stores: [
                            instance => {
                                received.push(instance);

                                return {
                                    $dispose() {
                                        // Disposal ordering is covered
                                        // separately.
                                    },
                                };
                            },
                        ],
                    }),
                ],
                pinia,
            });

            expect(received).toEqual([pinia]);

            app.dispose();
        });

        it('tears down already-booted modules when a later boot rejects', async () => {
            const order: string[] = [];

            await expect(
                bootApp({
                    modules: [
                        homeModule({
                            name: 'alpha',
                            boot: () => () => {
                                order.push('teardown:alpha');
                            },
                        }),
                        homeModule({
                            name: 'beta',
                            routes: [{ path: '/beta', name: 'beta.index', component: EmptyComponent }],
                            boot: () => {
                                throw new Error('beta boot failed');
                            },
                        }),
                    ],
                }),
            ).rejects.toThrow('beta boot failed');

            expect(order).toEqual(['teardown:alpha']);
        });

        it('rejects module lists that fail registry validation', async () => {
            const boot = bootApp({ modules: [homeModule({ name: 'dupe' }), homeModule({ name: 'dupe' })] });

            await expect(boot).rejects.toBeInstanceOf(ModuleRegistryError);
            await expect(boot).rejects.toThrow('Duplicate module names: "dupe".');
        });
    });

    describe('http wiring', () => {
        it('runs preset interceptors before module-contributed interceptors', async () => {
            let captured: RequestInit | undefined;
            const fetchFn = makeFetch({}, (_url, init) => {
                captured = init;

                return jsonResponse(null);
            });
            const preset: RequestInterceptor = request => ({
                ...request,
                headers: { ...request.headers, 'x-trace': 'preset' },
            });

            const app = await bootApp({
                modules: [
                    homeModule({
                        register: context => {
                            context.http.addRequestInterceptor(request => ({
                                ...request,
                                headers: { ...request.headers, 'x-trace': `${request.headers['x-trace']}+module` },
                            }));
                        },
                    }),
                ],
                http: { interceptors: [preset] },
                platform: makeSeams(fetchFn),
            });

            await api().get('ping');

            expect((captured?.headers as Record<string, string>)['x-trace']).toBe('preset+module');

            app.dispose();
        });

        it('routes 401 responses through the module-contributed unauthorized handler', async () => {
            const onUnauthorized = vi.fn<UnauthorizedHandler>(async () => false);
            const fetchFn = makeFetch({}, () => jsonResponse({ message: 'Unauthorized' }, 401));

            const app = await bootApp({
                modules: [
                    homeModule({
                        register: context => {
                            context.http.setUnauthorizedHandler(onUnauthorized);
                        },
                    }),
                ],
                platform: makeSeams(fetchFn),
            });

            await api()
                .get('secure')
                .catch(() => {
                    // The 401 rejection itself is not under test here.
                });

            expect(onUnauthorized).toHaveBeenCalledTimes(1);

            app.dispose();
        });

        it('raises the configured toast and reports unexpected api failures', async () => {
            const toastService = new ToastService();
            const reporter = new NullErrorReporter();
            const captureSpy = vi.spyOn(reporter, 'captureError');
            const fetchFn = makeFetch({}, () => jsonResponse({}, 500));

            const app = await bootApp({
                http: { unexpectedErrorToastKey: 'app.errors.unexpected' },
                notifications: { toasts: toastService },
                observability: { reporter: () => reporter },
                platform: makeSeams(fetchFn),
            });

            await api()
                .get('boom')
                .catch(() => {
                    // The rejection itself is under test in the http suite.
                });

            expect(toastService.toasts.value).toHaveLength(1);
            expect(toastService.toasts.value[0]?.message).toBe('app.errors.unexpected');
            expect(captureSpy).toHaveBeenCalledTimes(1);
            expect(captureSpy.mock.calls[0]?.[1]).toEqual({
                source: 'http',
                method: 'GET',
                url: 'https://api.test/boom',
            });

            app.dispose();
        });

        it('lets an application response-error handler fully replace the default', async () => {
            const onResponseError = vi.fn();
            const toastService = new ToastService();
            const fetchFn = makeFetch({}, () => jsonResponse({}, 500));

            const app = await bootApp({
                http: { onResponseError, unexpectedErrorToastKey: 'app.errors.unexpected' },
                notifications: { toasts: toastService },
                platform: makeSeams(fetchFn),
            });

            await api()
                .get('boom')
                .catch(() => {
                    // The rejection itself is under test in the http suite.
                });

            expect(onResponseError).toHaveBeenCalledTimes(1);
            expect(toastService.toasts.value).toHaveLength(0);

            app.dispose();
        });

        it('installs the client returned by the http client override with the resolved tools', async () => {
            const fake = { get: vi.fn() } as unknown as HttpClient;
            const preset: RequestInterceptor = request => request;
            const contributed: RequestInterceptor = request => request;
            const onUnauthorized = vi.fn<UnauthorizedHandler>(async () => false);
            const seams = makeSeams();
            const client = vi.fn((_tools: WireHttpClientTools<TestConfiguration>) => fake);

            const app = await bootApp({
                modules: [
                    homeModule({
                        register: context => {
                            context.http.addRequestInterceptor(contributed);
                            context.http.setUnauthorizedHandler(onUnauthorized);
                        },
                    }),
                ],
                http: { client, interceptors: [preset] },
                platform: seams,
            });

            expect(api()).toBe(fake);
            expect(app.services.http).toBe(fake);
            expect(client).toHaveBeenCalledTimes(1);

            const tools = client.mock.calls[0]?.[0];

            expect(tools?.config).toBe(app.config);
            expect(tools?.fetchFn).toBe(seams.fetchFn);
            expect(tools?.interceptors).toEqual([preset, contributed]);
            expect(tools?.onUnauthorized).toBe(onUnauthorized);
            expect(typeof tools?.onResponseError).toBe('function');

            app.dispose();
        });
    });

    describe('locale wiring', () => {
        it('wires detection, module messages, shared loaders and the switcher through the seams', async () => {
            const seams = makeSeams();

            seams.storage.set('app.locale', 'fr-FR');

            const app = await bootApp({
                modules: [homeModule({ locales: async locale => ({ greeting: `hello-${locale}` }) })],
                i18n: {
                    sharedLoaders: {
                        'en-US': async () => ({ shared: { title: 'Shared' } }),
                        'fr-FR': async () => ({ shared: { title: 'Partage' } }),
                    },
                    formats: { number: { 'fr-FR': { decimal: { style: 'decimal' } } } },
                    localeStorageKey: 'app.locale',
                    duplicateNamespaceStrategy: 'module-wins',
                },
                platform: seams,
            });

            expect(app.i18n.global.locale.value).toBe('fr-FR');
            expect(seams.targetDocument.documentElement.getAttribute('lang')).toBe('fr-FR');
            expect(seams.targetDocument.documentElement.getAttribute('dir')).toBe('ltr');
            expect(app.i18n.global.t('home.greeting')).toBe('hello-fr-FR');
            expect(app.i18n.global.t('shared.title')).toBe('Partage');
            expect(app.i18n.global.getNumberFormat('fr-FR')).toEqual({ decimal: { style: 'decimal' } });
            expect(localeSwitcher().current.value).toBe('fr-FR');

            app.dispose();
        });

        it('detects the locale from the window navigator languages when no candidates are supplied', async () => {
            const seams = makeSeams();
            const platform = {
                fetchFn: seams.fetchFn,
                storage: seams.storage,
                targetWindow: makeWindow(['fr-FR']),
                targetDocument: seams.targetDocument,
                clock: seams.clock,
                history: seams.history,
            };

            const app = await bootApp({ platform });

            expect(app.i18n.global.locale.value).toBe('fr-FR');
            expect(localeSwitcher().current.value).toBe('fr-FR');
            expect(seams.targetDocument.documentElement.getAttribute('lang')).toBe('fr-FR');

            app.dispose();
        });
    });

    describe('colour-scheme wiring', () => {
        it('wires the colour-scheme service through the seams and exposes it on the handle', async () => {
            const seams = makeSeams();

            seams.storage.set('theme', 'dark');

            const app = await bootApp({ platform: seams });

            expect(app.services.colorScheme.preference()).toBe('dark');
            expect(app.services.colorScheme.resolved()).toBe('dark');
            expect(colorScheme()).toBe(app.services.colorScheme);
            expect(seams.targetDocument.documentElement.getAttribute('data-theme')).toBe('dark');

            app.dispose();
        });

        it('applies the configured default preference when nothing is stored', async () => {
            const seams = makeSeams();

            const app = await bootApp({ colorScheme: { defaultPreference: 'dark' }, platform: seams });

            expect(app.services.colorScheme.preference()).toBe('dark');
            expect(seams.targetDocument.documentElement.getAttribute('data-theme')).toBe('dark');

            app.dispose();
        });

        it('honours the colour-scheme storage key and theme colours', async () => {
            const seams = makeSeams();

            seams.storage.set('app.theme', 'light');

            const app = await bootApp({
                colorScheme: { storageKey: 'app.theme', themeColors: { light: '#ffffff', dark: '#000000' } },
                platform: seams,
            });

            expect(app.services.colorScheme.preference()).toBe('light');
            expect(seams.targetDocument.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
                '#ffffff',
            );

            app.dispose();
        });

        it('defaults the preference to system when no option or stored value is present', async () => {
            const app = await bootApp();

            expect(app.services.colorScheme.preference()).toBe('system');

            app.dispose();
        });

        it('disposes the colour-scheme service on teardown', async () => {
            const app = await bootApp();
            const disposeSpy = vi.spyOn(app.services.colorScheme, 'dispose');

            app.dispose();

            expect(disposeSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('router wiring', () => {
        it('runs module guards on navigation and resolves unknown paths to the fallback module', async () => {
            const guarded: string[] = [];
            const guard: RouteMiddleware = {
                handle: context => {
                    guarded.push(context.to.fullPath);

                    return next();
                },
            };
            const seams = makeSeams();

            const app = await bootApp({
                modules: [
                    homeModule({ guards: [guard] }),
                    homeModule({
                        name: 'errors',
                        fallback: true,
                        routes: [{ path: '/:pathMatch(.*)*', name: 'errors.notFound', component: EmptyComponent }],
                    }),
                ],
                platform: seams,
            });

            await app.router.push('/missing/path');

            expect(app.router.currentRoute.value.name).toBe('errors.notFound');
            expect(guarded).toContain('/missing/path');
            expect(seams.targetDocument.title).toBe('Kernel App');

            app.dispose();
        });
    });

    describe('start', () => {
        it('mounts the root component only after the initial navigation has resolved', async () => {
            const events: string[] = [];
            const guard: RouteMiddleware = {
                handle: () => {
                    events.push('navigation');

                    return next();
                },
            };
            const seams = makeSeams();
            const host = seams.targetDocument.createElement('div');

            seams.targetDocument.body.appendChild(host);

            const app = await bootApp({
                root: makeRoot(events),
                modules: [homeModule({ guards: [guard] })],
                platform: seams,
            });

            await app.start(host);

            expect(events).toEqual(['navigation', 'mounted']);
            expect(host.innerHTML).toContain('root');

            app.dispose();
        });
    });

    describe('monitors', () => {
        it('arms the update monitor against the runtime url and surfaces new versions as sticky toasts', async () => {
            let version = '1.0.0';
            const fetchFn = makeFetch(() => wire([['APP_VERSION', version]]));
            const toastService = new ToastService();

            const app = await bootApp({
                config: makeConfig('/custom-env.json'),
                notifications: { toasts: toastService },
                monitors: { updates: { toastKey: 'app.updates.available', pollIntervalMs: 60_000 } },
                platform: makeSeams(fetchFn),
            });

            expect(app.monitors.updates).not.toBeNull();
            expect(app.monitors.connectivity).not.toBeNull();

            version = '2.0.0';

            await app.monitors.updates?.checkNow();

            expect(fetchFn).toHaveBeenLastCalledWith('/custom-env.json', {
                cache: 'no-store',
                headers: { accept: 'application/json' },
            });
            expect(toastService.toasts.value).toHaveLength(1);
            expect(toastService.toasts.value[0]?.message).toBe('app.updates.available');
            expect(toastService.toasts.value[0]?.variant).toBe('information');
            expect(toastService.toasts.value[0]?.duration).toBe(0);

            app.dispose();
        });

        it('rejects with WebCoreAppError when update monitoring is enabled with no way to surface updates', async () => {
            const boot = bootApp({ monitors: { updates: { enabled: true } } });

            await expect(boot).rejects.toBeInstanceOf(WebCoreAppError);
            await expect(boot).rejects.toThrow(
                'Update monitoring is enabled but cannot surface updates: ' +
                    'provide monitors.updates.toastKey or monitors.updates.onUpdate.',
            );
        });
    });

    describe('chunk recovery', () => {
        it('recovers stale-deploy chunk failures through the injected reload and clock seams', async () => {
            const reload = vi.fn();
            const seams = makeSeams();

            const app = await bootApp({
                modules: [
                    homeModule({
                        routes: [
                            { path: '/', name: 'home.index', component: EmptyComponent },
                            {
                                path: '/lazy',
                                name: 'home.lazy',
                                component: () =>
                                    Promise.reject(
                                        new Error('Failed to fetch dynamically imported module: /assets/lazy.js'),
                                    ),
                            },
                        ],
                    }),
                ],
                monitors: { chunkRecovery: { enabled: true, reload, windowMs: 30_000 } },
                platform: seams,
            });

            await app.router.push('/lazy').catch(() => {
                // The failed navigation rejection is expected.
            });

            expect(reload).toHaveBeenCalledTimes(1);
            expect(reload).toHaveBeenCalledWith('/lazy');
            expect(seams.storage.get('chunk-recovery./lazy')).toBe('1000');

            app.dispose();
        });

        it('installs no recovery when it is disabled', async () => {
            const reload = vi.fn();

            const app = await bootApp({
                modules: [
                    homeModule({
                        routes: [
                            { path: '/', name: 'home.index', component: EmptyComponent },
                            {
                                path: '/lazy',
                                name: 'home.lazy',
                                component: () =>
                                    Promise.reject(
                                        new Error('Failed to fetch dynamically imported module: /assets/lazy.js'),
                                    ),
                            },
                        ],
                    }),
                ],
                monitors: { chunkRecovery: { enabled: false, reload }, connectivity: { enabled: true } },
            });

            await app.router.push('/lazy').catch(() => {
                // The failed navigation rejection is expected.
            });

            expect(reload).not.toHaveBeenCalled();
            expect(app.monitors.updates).toBeNull();
            expect(app.monitors.connectivity).not.toBeNull();

            app.dispose();
        });
    });

    describe('error handling and page tracking', () => {
        it('tracks page views and captures window errors until disposal', async () => {
            const reporter = new NullErrorReporter();
            const tracker = new NullAnalyticsTracker();
            const captureSpy = vi.spyOn(reporter, 'captureError');
            const pageSpy = vi.spyOn(tracker, 'page');
            const seams = makeSeams();

            const app = await bootApp({
                modules: [
                    homeModule({
                        routes: [
                            { path: '/', name: 'home.index', component: EmptyComponent },
                            { path: '/other', name: 'home.other', component: EmptyComponent },
                        ],
                    }),
                ],
                observability: { reporter: () => reporter, analytics: () => tracker },
                platform: seams,
            });

            await app.router.isReady();

            expect(pageSpy).toHaveBeenCalledWith('home.index', { path: '/' });

            await app.router.push('/other');

            expect(pageSpy).toHaveBeenCalledWith('home.other', { path: '/other' });

            const failure = new Error('window failure');

            seams.targetWindow.dispatchToListeners('error', new ErrorEvent('error', { error: failure }));

            expect(captureSpy).toHaveBeenCalledWith(failure, expect.objectContaining({ source: 'window' }));

            app.dispose();

            const pageCalls = pageSpy.mock.calls.length;

            seams.targetDocument.title = 'sentinel';

            await app.router.push('/');

            expect(pageSpy.mock.calls.length).toBe(pageCalls);
            expect(seams.targetDocument.title).toBe('sentinel');
            expect(seams.targetWindow.listenerCount('error')).toBe(0);
            expect(seams.targetWindow.listenerCount('unhandledrejection')).toBe(0);
        });
    });

    describe('dispose', () => {
        it('disposes everything the boot installed in reverse order', async () => {
            const order: string[] = [];
            const fetchFn = makeFetch(wire([['APP_VERSION', '1.0.0']]));

            const app = await bootApp({
                modules: [
                    homeModule({
                        name: 'alpha',
                        stores: [
                            () => ({
                                $dispose() {
                                    order.push('dispose:store-1');
                                },
                            }),
                            () => ({
                                $dispose() {
                                    order.push('dispose:store-2');
                                },
                            }),
                        ],
                        boot: () => () => {
                            order.push('teardown:alpha');
                        },
                    }),
                    homeModule({
                        name: 'errors',
                        fallback: true,
                        routes: [{ path: '/:pathMatch(.*)*', name: 'errors.notFound', component: EmptyComponent }],
                        boot: () => () => {
                            order.push('teardown:errors');
                        },
                    }),
                ],
                realtime: () => makeRealtime(order),
                monitors: { updates: { toastKey: 'app.updates.available' } },
                platform: makeSeams(fetchFn),
            });

            const updates = app.monitors.updates;
            const connectivity = app.monitors.connectivity;

            expect(updates).not.toBeNull();
            expect(connectivity).not.toBeNull();

            if (updates === null || connectivity === null) {
                return;
            }

            const updatesStop = updates.stop.bind(updates);
            const connectivityStop = connectivity.stop.bind(connectivity);

            vi.spyOn(updates, 'stop').mockImplementation(() => {
                order.push('updates.stop');
                updatesStop();
            });
            vi.spyOn(connectivity, 'stop').mockImplementation(() => {
                order.push('connectivity.stop');
                connectivityStop();
            });

            app.dispose();

            expect(order).toEqual([
                'connectivity.stop',
                'updates.stop',
                'realtime.disconnect',
                'teardown:errors',
                'teardown:alpha',
                'dispose:store-2',
                'dispose:store-1',
            ]);

            app.dispose();

            expect(order).toHaveLength(7);
        });

        it('leaves service holders installed after dispose until resetWebCoreServices', async () => {
            const app = await bootApp();

            app.dispose();

            expect(() => api()).not.toThrow();
            expect(() => toasts()).not.toThrow();

            resetWebCoreServices();

            expect(() => api()).toThrow('http client accessed before initialisation');
            expect(() => toasts()).toThrow('toast service accessed before initialisation');
        });
    });

    describe('platform defaults', () => {
        it('boots on the global platform when no seams are provided', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn(async () => jsonResponse(wire([['APP_NAME', 'Default App']]))),
            );

            document.body.innerHTML = '<div id="app"></div>';

            try {
                const clockValues: number[] = [];

                const app = await createWebCoreApp<TestConfiguration>({
                    root: makeRoot(),
                    modules: [
                        homeModule({
                            boot: context => {
                                clockValues.push(context.platform.clock());

                                return undefined;
                            },
                        }),
                    ],
                    config: makeConfig(),
                });

                expect(globalThis.fetch).toHaveBeenCalledWith('/runtime-env.json', {
                    cache: 'no-store',
                    headers: { accept: 'application/json' },
                });
                expect(app.config.app.name).toBe('Default App');
                expect(appStorage()).toBeInstanceOf(BrowserStorage);
                expect(toasts()).toBeInstanceOf(ToastService);
                expect(confirmDialogs()).toBeInstanceOf(ConfirmService);
                expect(reporting()).toBeInstanceOf(NullErrorReporter);
                expect(analytics()).toBeInstanceOf(NullAnalyticsTracker);
                expect(logger()).toBeInstanceOf(NullLogger);
                expect(featureFlags()).toBeInstanceOf(StaticFeatureFlags);
                expect(featureFlags().isEnabled('beta')).toBe(true);
                expect(app.monitors.updates).toBeNull();
                expect(app.monitors.connectivity).toBeNull();
                expect(app.services.realtime).toBeNull();
                expect(() => realtime()).toThrow('realtime connection accessed before initialisation');
                expect(clockValues).toHaveLength(1);
                expect(clockValues[0]).toBeGreaterThan(0);
                expect(clockValues[0]).toBeLessThanOrEqual(Date.now());

                await app.start();

                expect(document.querySelector('#app')?.innerHTML).toContain('root');

                app.dispose();
            } finally {
                vi.unstubAllGlobals();
                document.body.innerHTML = '';
            }
        });
    });
});
