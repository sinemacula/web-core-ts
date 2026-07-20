/**
 * Boot tests for the application composition.
 *
 * The kernel preset's behaviour is covered by its own suite; these tests pin
 * what is application-specific about the composition the entry point feeds it:
 * the configuration registry resolving the fetched runtime document, the
 * session module guarding the app routes, and the errors module owning the
 * catch-all through its fallback marker.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { WebCoreApp } from '@sinemacula/web-core/app/create-web-core-app';
import { createWebCoreApp } from '@sinemacula/web-core/app/create-web-core-app';
import { resetWebCoreServices } from '@sinemacula/web-core/app/services';
import { ConfigurationError, createWebEnvironment } from '@sinemacula/web-core/config/web-environment';
import { createSessionModule } from '@sinemacula/web-core/session/create-session-module';
import { resetSessionContext } from '@sinemacula/web-core/session/session-context';
import { MemoryStorage } from '@sinemacula/web-core/storage/memory-storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';

import App from '@/App.vue';
import type { Configuration } from '@/config';
import { defineConfiguration } from '@/config';
import { REQUIRED_RUNTIME_KEYS } from '@/config/runtime';
import { sharedLocaleLoaders } from '@/locales';
import { localeFormats } from '@/locales/formats';
import { AUTH_ROUTE_NAMES } from '@/modules/auth/route-names';
import { ERRORS_ROUTE_NAMES } from '@/modules/errors/route-names';
import { modules } from '@/modules';

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

/** A complete runtime environment document. */
function runtimeDocument(overrides: Record<string, string> = {}): Record<string, string> {
    return {
        ...wire([
            ['API_URL', 'http://localhost:8000'],
            ['APP_URL', 'http://localhost:5173'],
            ['APP_ENV', 'local'],
            ['APP_VERSION', 'dev'],
            ['APP_NAME', 'TestApp'],
            ['DEFAULT_LOCALE', 'en-US'],
            ['ENABLED_LOCALES', '["en-US"]'],
        ]),
        ...overrides,
    };
}

describe('application boot', () => {
    let booted: WebCoreApp<Configuration> | null = null;

    /**
     * Boot the application with the entry point's composition through the
     * platform seams.
     *
     * @param options - the dev flag and runtime document for this boot
     * @returns the assembled application handle
     */
    async function boot(
        options: { dev?: boolean; runtime?: Record<string, string> } = {},
    ): Promise<WebCoreApp<Configuration>> {
        const body = JSON.stringify(options.runtime ?? runtimeDocument());
        const fetchFn = vi.fn(
            async () => new Response(body, { status: 200, headers: { 'content-type': 'application/json' } }),
        );

        booted = await createWebCoreApp({
            root: App,
            modules: [createSessionModule(), ...modules],
            config: {
                createEnvironment: runtime =>
                    createWebEnvironment({
                        runtime,
                        dev: options.dev ?? true,
                        requiredKeys: REQUIRED_RUNTIME_KEYS,
                    }),
                define: defineConfiguration,
            },
            http: { unexpectedErrorToastKey: 'common.states.error' },
            i18n: { sharedLoaders: sharedLocaleLoaders, formats: localeFormats },
            monitors: { updates: { toastKey: 'common.updates.available' } },
            platform: {
                fetchFn,
                storage: new MemoryStorage(),
                history: createMemoryHistory(),
                targetDocument: document.implementation.createHTMLDocument('t'),
                localeCandidates: ['en-US'],
            },
        });

        return booted;
    }

    afterEach(() => {
        booted?.dispose();
        booted = null;
        resetWebCoreServices();
        resetSessionContext();
    });

    it('freezes the application configuration from the fetched runtime document', async () => {
        const app = await boot();

        expect(app.config.app.name).toBe('TestApp');
        expect(app.config.api.baseUrl).toBe('http://localhost:8000');
    });

    it('redirects an unauthenticated visit to the login route', async () => {
        const app = await boot();

        await app.router.push('/');
        await app.router.isReady();

        expect(app.router.currentRoute.value.name).toBe(AUTH_ROUTE_NAMES.login);
    });

    it('routes unknown paths to the errors module catch-all', async () => {
        const app = await boot();

        await app.router.isReady();
        await app.router.push('/definitely-not-a-route');

        expect(app.router.currentRoute.value.name).toBe(ERRORS_ROUTE_NAMES.notFound);
    });

    it('switches locales through the installed locale switcher', async () => {
        const app = await boot({ runtime: runtimeDocument(wire([['ENABLED_LOCALES', '["en-US","fr-FR"]']])) });

        await app.services.localeSwitcher.switchTo('fr-FR');

        expect(app.services.localeSwitcher.current.value).toBe('fr-FR');
    });

    it('fails closed in production when a required runtime key is missing', async () => {
        const runtime = runtimeDocument();

        delete runtime['API_URL'];

        await expect(boot({ dev: false, runtime })).rejects.toBeInstanceOf(ConfigurationError);
        await expect(boot({ dev: false, runtime })).rejects.toThrow('API_URL');
    });
});
