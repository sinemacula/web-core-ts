/**
 * Unit tests for the kernel-standard application singletons.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { afterEach, describe, expect, it } from 'vitest';
import { computed } from 'vue';

import { NullAnalyticsTracker } from '@sinemacula/foundation/analytics/null-analytics-tracker';
import { ConfigRepository } from '../config/config-repository';
import { StaticFeatureFlags } from '@sinemacula/foundation/feature-flags/static-feature-flags';
import type { HttpClient } from '../http/http-client';
import type { LocaleSwitcher } from '../i18n/application-i18n';
import { NullLogger } from '@sinemacula/foundation/logging/null-logger';
import { ConfirmService } from '../notifications/confirm-service';
import { ToastService } from '../notifications/toast-service';
import type { RealtimeConnection } from '../realtime/realtime-connection';
import { NullErrorReporter } from '@sinemacula/foundation/reporting/null-error-reporter';
import { MemoryStorage } from '@sinemacula/foundation/storage/memory-storage';
import type { ColorSchemeService } from '../theme/color-scheme-service';
import {
    analytics,
    api,
    appConfig,
    appConfigRepository,
    appStorage,
    colorScheme,
    confirmDialogs,
    featureFlags,
    installAnalytics,
    installApi,
    installColorScheme,
    installConfig,
    installConfirm,
    installFeatureFlags,
    installLocaleSwitcher,
    installLogger,
    installRealtime,
    installReporting,
    installStorage,
    installToasts,
    localeSwitcher,
    logger,
    realtime,
    reporting,
    resetWebCoreServices,
    toasts,
} from './services';

/** Build an HTTP client stand-in that fails loudly if any method is invoked. */
function createHttpClientStub(): HttpClient {
    const fail = (): Promise<never> => Promise.reject(new Error('not implemented'));

    return { get: fail, post: fail, put: fail, patch: fail, delete: fail, download: fail };
}

/** Build an inert locale switcher stand-in. */
function createLocaleSwitcherStub(): LocaleSwitcher {
    return {
        current: computed(() => 'en'),
        switchTo: () => Promise.resolve(),
    };
}

/** Build an inert colour-scheme service stand-in. */
function createColorSchemeStub(): ColorSchemeService {
    return { dispose: () => undefined } as unknown as ColorSchemeService;
}

/** Build an inert realtime connection stand-in. */
function createRealtimeConnectionStub(): RealtimeConnection {
    return {
        state: 'idle',
        connect: () => undefined,
        disconnect: () => undefined,
        on: () => () => undefined,
        onStateChange: () => () => undefined,
    };
}

interface ServiceCase {
    readonly accessorName: string;
    readonly message: string;
    readonly install: () => unknown;
    readonly accessor: () => unknown;
}

const serviceCases: readonly ServiceCase[] = [
    {
        accessorName: 'appConfigRepository',
        message: 'configuration accessed before initialisation',
        install: () => {
            const repository = new ConfigRepository({ app: { name: 'playground' } });

            installConfig(repository);

            return repository;
        },
        accessor: () => appConfigRepository(),
    },
    {
        accessorName: 'api',
        message: 'http client accessed before initialisation',
        install: () => {
            const client = createHttpClientStub();

            installApi(client);

            return client;
        },
        accessor: api,
    },
    {
        accessorName: 'appStorage',
        message: 'application storage accessed before initialisation',
        install: () => {
            const storage = new MemoryStorage();

            installStorage(storage);

            return storage;
        },
        accessor: appStorage,
    },
    {
        accessorName: 'toasts',
        message: 'toast service accessed before initialisation',
        install: () => {
            const service = new ToastService();

            installToasts(service);

            return service;
        },
        accessor: toasts,
    },
    {
        accessorName: 'confirmDialogs',
        message: 'confirmation dialog service accessed before initialisation',
        install: () => {
            const service = new ConfirmService();

            installConfirm(service);

            return service;
        },
        accessor: confirmDialogs,
    },
    {
        accessorName: 'reporting',
        message: 'error reporter accessed before initialisation',
        install: () => {
            const reporter = new NullErrorReporter();

            installReporting(reporter);

            return reporter;
        },
        accessor: reporting,
    },
    {
        accessorName: 'analytics',
        message: 'analytics tracker accessed before initialisation',
        install: () => {
            const tracker = new NullAnalyticsTracker();

            installAnalytics(tracker);

            return tracker;
        },
        accessor: analytics,
    },
    {
        accessorName: 'logger',
        message: 'logger accessed before initialisation',
        install: () => {
            const instance = new NullLogger();

            installLogger(instance);

            return instance;
        },
        accessor: logger,
    },
    {
        accessorName: 'featureFlags',
        message: 'feature-flag adapter accessed before initialisation',
        install: () => {
            const flags = new StaticFeatureFlags({ beta: true });

            installFeatureFlags(flags);

            return flags;
        },
        accessor: featureFlags,
    },
    {
        accessorName: 'localeSwitcher',
        message: 'locale switcher accessed before initialisation',
        install: () => {
            const switcher = createLocaleSwitcherStub();

            installLocaleSwitcher(switcher);

            return switcher;
        },
        accessor: localeSwitcher,
    },
    {
        accessorName: 'colorScheme',
        message: 'colour scheme service accessed before initialisation',
        install: () => {
            const service = createColorSchemeStub();

            installColorScheme(service);

            return service;
        },
        accessor: colorScheme,
    },
    {
        accessorName: 'realtime',
        message: 'realtime connection accessed before initialisation',
        install: () => {
            const connection = createRealtimeConnectionStub();

            installRealtime(connection);

            return connection;
        },
        accessor: realtime,
    },
];

describe('web core services', () => {
    afterEach(() => {
        resetWebCoreServices();
    });

    for (const serviceCase of serviceCases) {
        it(`${serviceCase.accessorName}() throws its exact message before install`, () => {
            expect(() => serviceCase.accessor()).toThrow(serviceCase.message);
        });

        it(`${serviceCase.accessorName}() resolves the exact installed instance`, () => {
            const instance = serviceCase.install();

            expect(serviceCase.accessor()).toBe(instance);
        });
    }

    it('runs the expected number of service pairs', () => {
        expect(serviceCases).toHaveLength(12);
    });

    it('keeps every other accessor uninstalled when one service is installed', () => {
        for (const installed of serviceCases) {
            const instance = installed.install();

            for (const other of serviceCases) {
                if (other === installed) {
                    expect(other.accessor()).toBe(instance);
                } else {
                    expect(() => other.accessor()).toThrow(other.message);
                }
            }

            resetWebCoreServices();
        }
    });

    it('resets every holder through resetWebCoreServices', () => {
        for (const serviceCase of serviceCases) {
            serviceCase.install();
        }

        for (const serviceCase of serviceCases) {
            expect(() => serviceCase.accessor()).not.toThrow();
        }

        resetWebCoreServices();

        for (const serviceCase of serviceCases) {
            expect(() => serviceCase.accessor()).toThrow(serviceCase.message);
        }
    });

    it('resolves a freshly installed instance after a reset', () => {
        installApi(createHttpClientStub());
        resetWebCoreServices();

        const replacement = createHttpClientStub();

        installApi(replacement);

        expect(api()).toBe(replacement);
    });

    describe('appConfig', () => {
        it('throws the configuration message before install', () => {
            expect(() => appConfig()).toThrow('configuration accessed before initialisation');
        });

        it('returns the exact frozen tree held by the repository', () => {
            const repository = new ConfigRepository({ app: { name: 'playground', version: '1.2.3' } });

            installConfig(repository);

            expect(appConfig()).toBe(repository.all());
        });

        it('returns a deep-frozen tree', () => {
            installConfig(new ConfigRepository({ app: { name: 'playground' } }));

            const tree = appConfig<{ app: { name: string } }>();

            expect(Object.isFrozen(tree)).toBe(true);
            expect(Object.isFrozen(tree.app)).toBe(true);
        });

        it('exposes the configured values through the typed cast', () => {
            installConfig(new ConfigRepository({ app: { name: 'playground', version: '1.2.3' } }));

            const tree = appConfig<{ app: { name: string; version: string } }>();

            expect(tree.app.name).toBe('playground');
            expect(tree.app.version).toBe('1.2.3');
        });
    });

    describe('appConfigRepository', () => {
        it('resolves dot-notation paths on the installed repository', () => {
            installConfig(new ConfigRepository({ app: { name: 'playground' } }));

            expect(appConfigRepository().get('app.name')).toBe('playground');
            expect(appConfigRepository().get('app.missing', 'fallback')).toBe('fallback');
        });
    });
});
