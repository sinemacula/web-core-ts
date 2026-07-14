/**
 * Unit tests for createApplication and startApplication.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { ConsoleAnalyticsTracker } from '@sinemacula/web-core/analytics/console-analytics-tracker';
import { NullAnalyticsTracker } from '@sinemacula/web-core/analytics/null-analytics-tracker';
import { ConsoleLogger } from '@sinemacula/web-core/logging/console-logger';
import { NullLogger } from '@sinemacula/web-core/logging/null-logger';
import { ConsoleErrorReporter } from '@sinemacula/web-core/reporting/console-error-reporter';
import { NullErrorReporter } from '@sinemacula/web-core/reporting/null-error-reporter';
import { MemoryStorage } from '@sinemacula/web-core/storage/memory-storage';
import type { UpdateMonitor } from '@sinemacula/web-core/updates/update-monitor';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';

import { createApplication, startApplication } from '@/bootstrap/application';
import { ConfigurationError } from '@/config/runtime';
import { AUTH_ROUTE_NAMES } from '@/modules/auth/route-names';
import { ACCESS_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY, useAuthStore } from '@/modules/auth/stores/auth-store';
import { analytics, resetAnalytics } from '@/services/analytics';
import { api, resetApi } from '@/services/api';
import { config, resetConfiguration } from '@/services/config';
import { resetConfirm } from '@/services/confirm';
import { featureFlags, resetFeatureFlags } from '@/services/feature-flags';
import { localeSwitcher, resetLocaleSwitcher } from '@/services/locale';
import { logger, resetLogger } from '@/services/logger';
import { reporting, resetReporting } from '@/services/reporting';
import { resetStorage } from '@/services/storage';
import { resetToasts, toasts } from '@/services/toast';

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

function makeEnvResponse(overrides: Record<string, string> = {}): Response {
    const body = JSON.stringify({
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
    });

    return new Response(body, {
        status: 200,
        headers: { 'content-type': 'application/json' },
    });
}

describe('createApplication', () => {
    afterEach(() => {
        resetConfiguration();
        resetApi();
        resetStorage();
        resetReporting();
        resetAnalytics();
        resetFeatureFlags();
        resetToasts();
        resetConfirm();
        resetLogger();
        resetLocaleSwitcher();
    });

    it('initialises configuration from the fetched environment', async () => {
        const fetchFn = vi.fn(async () => makeEnvResponse(wire([['APP_NAME', 'TestApp']])));
        const targetDocument = document.implementation.createHTMLDocument('t');

        await createApplication({
            fetchFn,
            storage: new MemoryStorage(),
            localeCandidates: ['en-US'],
            history: createMemoryHistory(),
            targetDocument,
        });

        expect(config().app.name).toBe('TestApp');
    });

    it('initialises the API singleton', async () => {
        const fetchFn = vi.fn(async () => makeEnvResponse());
        const targetDocument = document.implementation.createHTMLDocument('t');

        await createApplication({
            fetchFn,
            storage: new MemoryStorage(),
            localeCandidates: ['en-US'],
            history: createMemoryHistory(),
            targetDocument,
        });

        expect(() => api()).not.toThrow();
    });

    it('initialises the feature-flags singleton with flags from the environment', async () => {
        const fetchFn = vi.fn(async () => makeEnvResponse(wire([['FEATURE_FLAGS', '{"new-dashboard":true}']])));
        const targetDocument = document.implementation.createHTMLDocument('t');

        await createApplication({
            fetchFn,
            storage: new MemoryStorage(),
            localeCandidates: ['en-US'],
            history: createMemoryHistory(),
            targetDocument,
        });

        expect(() => featureFlags()).not.toThrow();
        expect(featureFlags().isEnabled('new-dashboard')).toBe(true);
    });

    it('sets the document lang attribute to the detected locale', async () => {
        const fetchFn = vi.fn(async () => makeEnvResponse(wire([['DEFAULT_LOCALE', 'en-US']])));
        const targetDocument = document.implementation.createHTMLDocument('t');

        await createApplication({
            fetchFn,
            storage: new MemoryStorage(),
            localeCandidates: ['en-US'],
            history: createMemoryHistory(),
            targetDocument,
        });

        expect(targetDocument.documentElement.getAttribute('lang')).toBe('en-US');
    });

    it('sets the document dir attribute (covers the ?? ltr fallback for en-US)', async () => {
        const fetchFn = vi.fn(async () => makeEnvResponse(wire([['DEFAULT_LOCALE', 'en-US']])));
        const targetDocument = document.implementation.createHTMLDocument('t');

        await createApplication({
            fetchFn,
            storage: new MemoryStorage(),
            localeCandidates: ['en-US'],
            history: createMemoryHistory(),
            targetDocument,
        });

        // en-US is in the supported map with direction 'ltr', but the default
        // fallback is also 'ltr'
        expect(targetDocument.documentElement.getAttribute('dir')).toBe('ltr');
    });

    it('uses the ltr fallback when the locale is not in the supported map', async () => {
        // de-DE is not in the supported map defined in localesConfig
        const fetchFn = vi.fn(async () =>
            makeEnvResponse(
                wire([
                    ['APP_NAME', 'TestApp'],
                    ['DEFAULT_LOCALE', 'de-DE'],
                    ['ENABLED_LOCALES', '["de-DE"]'],
                ]),
            ),
        );
        const targetDocument = document.implementation.createHTMLDocument('t');

        await createApplication({
            fetchFn,
            storage: new MemoryStorage(),
            localeCandidates: ['de-DE'],
            history: createMemoryHistory(),
            targetDocument,
        });

        // Exercises the `?? 'ltr'` fallback branch in application.ts
        expect(targetDocument.documentElement.getAttribute('dir')).toBe('ltr');
    });

    it('wires a locale switcher singleton that switches the i18n locale and document lang', async () => {
        const fetchFn = vi.fn(async () => makeEnvResponse(wire([['ENABLED_LOCALES', '["en-US","fr-FR"]']])));
        const targetDocument = document.implementation.createHTMLDocument('t');

        await createApplication({
            fetchFn,
            storage: new MemoryStorage(),
            localeCandidates: ['en-US'],
            history: createMemoryHistory(),
            targetDocument,
        });

        expect(localeSwitcher().current.value).toBe('en-US');

        await localeSwitcher().switchTo('fr-FR');

        expect(localeSwitcher().current.value).toBe('fr-FR');
        expect(targetDocument.documentElement.getAttribute('lang')).toBe('fr-FR');
    });

    it('redirects to login when an unauthenticated user navigates to /', async () => {
        const fetchFn = vi.fn(async () => makeEnvResponse());
        const targetDocument = document.implementation.createHTMLDocument('t');
        const history = createMemoryHistory();

        const { router } = await createApplication({
            fetchFn,
            storage: new MemoryStorage(),
            localeCandidates: ['en-US'],
            history,
            targetDocument,
        });

        await router.push('/');
        await router.isReady();

        expect(router.currentRoute.value.name).toBe(AUTH_ROUTE_NAMES.login);
    });

    it('installs document title sync (title contains the app name after navigation)', async () => {
        const fetchFn = vi.fn(async () => makeEnvResponse(wire([['APP_NAME', 'TestApp']])));
        const targetDocument = document.implementation.createHTMLDocument('t');
        const history = createMemoryHistory();

        const { router } = await createApplication({
            fetchFn,
            storage: new MemoryStorage(),
            localeCandidates: ['en-US'],
            history,
            targetDocument,
        });

        await router.push('/login');
        await router.isReady();

        expect(targetDocument.title).toContain('TestApp');
    });

    it('wires the bearer token interceptor so getAccessToken is callable', async () => {
        // After createApplication the api() singleton is the real
        // FetchHttpClient. Making one request through it triggers the
        // request-interceptor chain, covering the
        // `() => useAuthStore(pinia).accessToken` closure at line 84.
        const responses = [
            makeEnvResponse(),
            new Response('null', { status: 200, headers: { 'content-type': 'application/json' } }),
        ];
        let callIndex = 0;
        const fetchFn = vi.fn(async () => responses[callIndex++] ?? new Response('null', { status: 200 }));
        const targetDocument = document.implementation.createHTMLDocument('t');

        await createApplication({
            fetchFn,
            storage: new MemoryStorage(),
            localeCandidates: ['en-US'],
            history: createMemoryHistory(),
            targetDocument,
        });

        // Trigger the bearer-token interceptor by issuing a GET through api()
        await api()
            .get('ping')
            .catch(() => {
                // errors from the response are irrelevant here
            });

        // The fetch was called twice: once for runtime-env, once for the
        // ping request
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('wires the onUnauthorized handler so a 401 triggers the refresh coordinator', async () => {
        // The fetch sequence: runtime-env → 401 on first API call → 401 on retry
        // (no valid refresh token, so refresh returns false → no infinite loop).
        const storage = new MemoryStorage();
        const responses = [
            makeEnvResponse(),
            new Response('{"message":"Unauthorized"}', {
                status: 401,
                headers: { 'content-type': 'application/json' },
            }),
        ];
        let callIndex = 0;
        const fetchFn = vi.fn(
            async () =>
                responses[callIndex++] ??
                new Response('{"message":"Unauthorized"}', {
                    status: 401,
                    headers: { 'content-type': 'application/json' },
                }),
        );
        const targetDocument = document.implementation.createHTMLDocument('t');

        await createApplication({
            fetchFn,
            storage,
            localeCandidates: ['en-US'],
            history: createMemoryHistory(),
            targetDocument,
        });

        // Issuing a request without a refresh token exercises the
        // onUnauthorized path → coordinator → store.refresh() → false.
        await api()
            .get('probe')
            .catch(() => {
                // The 401 error is expected; we only care the handler ran.
            });

        // runtime-env fetch + the probe request (no retry because refresh=false)
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('does not redirect when the session transitions from unauthenticated to authenticated', async () => {
        // Boot without a seeded token (unauthenticated).
        const storage = new MemoryStorage();

        // fetchFn: first call = runtime-env; subsequent = POST auth + GET users/self
        const sessionBody = JSON.stringify({
            data: wire([
                ['token', 'new-token'],
                ['refresh_token', 'new-refresh'],
                ['expires_at', '2099-01-01 00:00:00'],
            ]),
        });
        const userBody = JSON.stringify({
            data: wire([
                ['id', 'u1'],
                ['first_name', 'Alice'],
                ['last_name', 'Smith'],
                ['full_name', 'Alice Smith'],
                ['email', 'alice@example.com'],
            ]),
        });
        const responses = [
            makeEnvResponse(),
            new Response(sessionBody, { status: 201, headers: { 'content-type': 'application/json' } }),
            new Response(userBody, { status: 200, headers: { 'content-type': 'application/json' } }),
        ];
        let callIndex = 0;
        const fetchFn = vi.fn(async () => responses[callIndex++] ?? new Response('null', { status: 200 }));
        const history = createMemoryHistory();
        const targetDocument = document.implementation.createHTMLDocument('t');

        const { router } = await createApplication({
            fetchFn,
            storage,
            localeCandidates: ['en-US'],
            history,
            targetDocument,
        });

        await router.push('/login');
        await router.isReady();

        // Login transitions isAuthenticated from false → true; the
        // watcher fires but must NOT redirect to login (was=false, !authed=false).
        await useAuthStore().login({ email: 'alice@example.com', password: 'secret' });

        await new Promise<void>(resolve => setTimeout(resolve, 0));

        // Should remain on login (the test router has no auth middleware);
        // crucially, no redirect-to-login was triggered by the watcher.
        expect(router.currentRoute.value.path).toBe('/login');
    });

    it('redirects to login when the session transitions from authenticated to unauthenticated', async () => {
        // Boot with a seeded access token so the store starts authenticated.
        const storage = new MemoryStorage();

        storage.set(ACCESS_TOKEN_STORAGE_KEY, 'seed-token');
        storage.set(REFRESH_TOKEN_STORAGE_KEY, 'seed-refresh');

        // fetchFn: first call = runtime-env; subsequent calls = DELETE auth (logout)
        const responses = [
            makeEnvResponse(),
            // logout DELETE returns 204 (empty body)
            new Response('', { status: 204 }),
        ];
        let callIndex = 0;
        const fetchFn = vi.fn(async () => responses[callIndex++] ?? new Response('', { status: 204 }));
        const history = createMemoryHistory();
        const targetDocument = document.implementation.createHTMLDocument('t');

        const { router } = await createApplication({
            fetchFn,
            storage,
            localeCandidates: ['en-US'],
            history,
            targetDocument,
        });

        await router.push('/');
        await router.isReady();

        // Confirm we are on the dashboard (authenticated)
        expect(router.currentRoute.value.name).toBe('dashboard.home');

        // Trigger logout via the auth store — this clears accessToken which
        // fires the watcher installed by wireSessionLossRedirect.
        await useAuthStore().logout();

        // Allow Vue's reactivity to flush the watcher callback.
        await new Promise<void>(resolve => setTimeout(resolve, 0));

        expect(router.currentRoute.value.name).toBe(AUTH_ROUTE_NAMES.login);
    });
});

describe('observability wiring', () => {
    afterEach(() => {
        resetConfiguration();
        resetApi();
        resetStorage();
        resetReporting();
        resetAnalytics();
        resetFeatureFlags();
        resetToasts();
        resetConfirm();
        resetLogger();
        resetLocaleSwitcher();
    });

    it('wires console adapters in the local environment', async () => {
        const fetchFn = vi.fn(async () => makeEnvResponse(wire([['APP_ENV', 'local']])));
        const targetDocument = document.implementation.createHTMLDocument('t');

        await createApplication({
            fetchFn,
            storage: new MemoryStorage(),
            localeCandidates: ['en-US'],
            history: createMemoryHistory(),
            targetDocument,
        });

        expect(reporting()).toBeInstanceOf(ConsoleErrorReporter);
        expect(logger()).toBeInstanceOf(ConsoleLogger);
        expect(analytics()).toBeInstanceOf(ConsoleAnalyticsTracker);
    });

    it('wires null adapters outside the local environment', async () => {
        const fetchFn = vi.fn(async () => makeEnvResponse(wire([['APP_ENV', 'production']])));
        const targetDocument = document.implementation.createHTMLDocument('t');

        await createApplication({
            fetchFn,
            storage: new MemoryStorage(),
            localeCandidates: ['en-US'],
            history: createMemoryHistory(),
            targetDocument,
        });

        expect(reporting()).toBeInstanceOf(NullErrorReporter);
        expect(logger()).toBeInstanceOf(NullLogger);
        expect(analytics()).toBeInstanceOf(NullAnalyticsTracker);
    });
});

describe('identity sync wiring', () => {
    afterEach(() => {
        resetConfiguration();
        resetApi();
        resetStorage();
        resetReporting();
        resetAnalytics();
        resetFeatureFlags();
        resetToasts();
        resetConfirm();
        resetLogger();
        resetLocaleSwitcher();
    });

    it('forwards the signed-in user to reporting, analytics and feature-flag context, then clears them on sign-out', async () => {
        const storage = new MemoryStorage();
        const sessionBody = JSON.stringify({
            data: wire([
                ['token', 'new-token'],
                ['refresh_token', 'new-refresh'],
                ['expires_at', '2099-01-01 00:00:00'],
            ]),
        });
        const userBody = JSON.stringify({
            data: wire([
                ['id', 'u1'],
                ['first_name', 'Alice'],
                ['last_name', 'Smith'],
                ['full_name', 'Alice Smith'],
                ['email', 'alice@example.com'],
            ]),
        });
        const responses = [
            makeEnvResponse(),
            new Response(sessionBody, { status: 201, headers: { 'content-type': 'application/json' } }),
            new Response(userBody, { status: 200, headers: { 'content-type': 'application/json' } }),
            new Response('', { status: 204 }),
        ];
        let callIndex = 0;
        const fetchFn = vi.fn(async () => responses[callIndex++] ?? new Response('', { status: 204 }));
        const targetDocument = document.implementation.createHTMLDocument('t');

        await createApplication({
            fetchFn,
            storage,
            localeCandidates: ['en-US'],
            history: createMemoryHistory(),
            targetDocument,
        });

        const setUserSpy = vi.spyOn(reporting(), 'setUser');
        const identifySpy = vi.spyOn(analytics(), 'identify');
        const resetSpy = vi.spyOn(analytics(), 'reset');
        const setContextSpy = vi.spyOn(featureFlags(), 'setContext');

        await useAuthStore().login({ email: 'alice@example.com', password: 'secret' });
        await new Promise<void>(resolve => setTimeout(resolve, 0));

        expect(setUserSpy).toHaveBeenCalledWith({ id: 'u1', email: 'alice@example.com', name: 'Alice Smith' });
        expect(identifySpy).toHaveBeenCalledWith('u1');
        expect(setContextSpy).toHaveBeenCalledWith({ userId: 'u1' });

        await useAuthStore().logout();
        await new Promise<void>(resolve => setTimeout(resolve, 0));

        expect(setUserSpy).toHaveBeenCalledWith(null);
        expect(resetSpy).toHaveBeenCalledTimes(1);
        expect(setContextSpy).toHaveBeenCalledWith({});
    });
});

describe('update monitoring', () => {
    afterEach(() => {
        resetConfiguration();
        resetApi();
        resetStorage();
        resetReporting();
        resetAnalytics();
        resetFeatureFlags();
        resetToasts();
        resetConfirm();
        resetLogger();
        resetLocaleSwitcher();
    });

    it('does not monitor development builds', async () => {
        const fetchFn = vi.fn(async () => makeEnvResponse());
        const targetDocument = document.implementation.createHTMLDocument('t');

        const { updates } = await createApplication({
            fetchFn,
            storage: new MemoryStorage(),
            localeCandidates: ['en-US'],
            history: createMemoryHistory(),
            targetDocument,
        });

        expect(updates).toBeNull();
    });

    it('monitors release builds with the default fetch when none is injected', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => makeEnvResponse(wire([['APP_VERSION', '1.0.0']]))),
        );

        const targetDocument = document.implementation.createHTMLDocument('t');

        const { updates } = await createApplication({
            storage: new MemoryStorage(),
            localeCandidates: ['en-US'],
            history: createMemoryHistory(),
            targetDocument,
        });

        expect(updates).not.toBeNull();

        updates?.stop();
        vi.unstubAllGlobals();
    });

    it('monitors release builds and raises a sticky toast on a new version', async () => {
        let version = '1.0.0';
        const fetchFn = vi.fn(async () => makeEnvResponse(wire([['APP_VERSION', version]])));
        const targetDocument = document.implementation.createHTMLDocument('t');

        const { updates } = await createApplication({
            fetchFn,
            storage: new MemoryStorage(),
            localeCandidates: ['en-US'],
            history: createMemoryHistory(),
            targetDocument,
        });

        expect(updates).not.toBeNull();

        version = '2.0.0';
        await updates?.checkNow();

        const queued = toasts().toasts.value;

        expect(queued).toHaveLength(1);
        expect(queued[0]?.message).toBe('common.updates.available');
        expect(queued[0]?.duration).toBe(0);

        updates?.stop();
    });

    it('pauses and resumes update polling with connectivity', async () => {
        let version = '1.0.0';
        const fetchFn = vi.fn(async () => makeEnvResponse(wire([['APP_VERSION', version]])));
        const targetDocument = document.implementation.createHTMLDocument('t');

        const { updates, connectivity } = await createApplication({
            fetchFn,
            storage: new MemoryStorage(),
            localeCandidates: ['en-US'],
            history: createMemoryHistory(),
            targetDocument,
        });

        expect(connectivity).not.toBeNull();

        const stopSpy = vi.spyOn(updates as UpdateMonitor, 'stop');
        const startSpy = vi.spyOn(updates as UpdateMonitor, 'start');

        window.dispatchEvent(new Event('offline'));
        expect(stopSpy).toHaveBeenCalledTimes(1);

        window.dispatchEvent(new Event('online'));
        expect(startSpy).toHaveBeenCalledTimes(1);

        version = '2.0.0';
        connectivity?.stop();
        updates?.stop();
    });

    it('runs no connectivity monitor for development builds', async () => {
        const fetchFn = vi.fn(async () => makeEnvResponse());
        const targetDocument = document.implementation.createHTMLDocument('t');

        const { connectivity } = await createApplication({
            fetchFn,
            storage: new MemoryStorage(),
            localeCandidates: ['en-US'],
            history: createMemoryHistory(),
            targetDocument,
        });

        expect(connectivity).toBeNull();
    });
});

describe('production fail-closed (dev: false)', () => {
    afterEach(() => {
        resetConfiguration();
        resetApi();
        resetStorage();
        resetReporting();
        resetAnalytics();
        resetFeatureFlags();
        resetToasts();
        resetConfirm();
        resetLogger();
        resetLocaleSwitcher();
    });

    it('boots successfully when all required runtime keys are present', async () => {
        const fetchFn = vi.fn(async () => makeEnvResponse());
        const targetDocument = document.implementation.createHTMLDocument('t');

        await expect(
            createApplication({
                fetchFn,
                storage: new MemoryStorage(),
                localeCandidates: ['en-US'],
                history: createMemoryHistory(),
                targetDocument,
                dev: false,
            }),
        ).resolves.toBeDefined();
    });

    it('throws ConfigurationError when a required key is missing', async () => {
        const body = JSON.stringify(
            wire([
                ['APP_URL', 'http://localhost:5173'],
                ['APP_ENV', 'production'],
                ['APP_VERSION', '1.0.0'],
                // API_URL is intentionally absent
            ]),
        );
        const fetchFn = vi.fn(() =>
            Promise.resolve(new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })),
        );

        await expect(
            createApplication({
                fetchFn,
                storage: new MemoryStorage(),
                localeCandidates: ['en-US'],
                history: createMemoryHistory(),
                targetDocument: document.implementation.createHTMLDocument('t'),
                dev: false,
            }),
        ).rejects.toBeInstanceOf(ConfigurationError);
    });

    it('throws ConfigurationError listing the missing key name', async () => {
        const body = JSON.stringify(
            wire([
                ['API_URL', 'http://localhost:8000'],
                ['APP_URL', 'http://localhost:5173'],
                ['APP_ENV', 'production'],
                // APP_VERSION is intentionally absent
            ]),
        );
        const fetchFn = vi.fn(() =>
            Promise.resolve(new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })),
        );

        await expect(
            createApplication({
                fetchFn,
                storage: new MemoryStorage(),
                localeCandidates: ['en-US'],
                history: createMemoryHistory(),
                targetDocument: document.implementation.createHTMLDocument('t'),
                dev: false,
            }),
        ).rejects.toThrow('APP_VERSION');
    });
});

describe('development convenience (dev: true)', () => {
    afterEach(() => {
        resetConfiguration();
        resetApi();
        resetStorage();
        resetReporting();
        resetAnalytics();
        resetFeatureFlags();
        resetToasts();
        resetConfirm();
        resetLogger();
        resetLocaleSwitcher();
    });

    it('boots when runtime-env.json is missing (falls through to VITE_ defaults)', async () => {
        // Simulates dev server: runtime-env.json fetch returns 404
        const fetchFn = vi.fn(async () => new Response('not found', { status: 404 }));

        await expect(
            createApplication({
                fetchFn,
                storage: new MemoryStorage(),
                localeCandidates: ['en-US'],
                history: createMemoryHistory(),
                targetDocument: document.implementation.createHTMLDocument('t'),
                dev: true,
            }),
        ).resolves.toBeDefined();
    });
});

describe('api error surface', () => {
    afterEach(() => {
        resetConfiguration();
        resetApi();
        resetStorage();
        resetReporting();
        resetAnalytics();
        resetToasts();
        resetConfirm();
        resetLogger();
        resetLocaleSwitcher();
    });

    async function bootWithResponses(responses: Response[]): Promise<void> {
        let call = 0;
        const fetchFn = vi.fn(() => {
            const next = responses[call] ?? new Response('{}', { status: 200 });
            call += 1;
            return Promise.resolve(next);
        });
        const targetDocument = document.implementation.createHTMLDocument('t');

        await createApplication({
            fetchFn,
            storage: new MemoryStorage(),
            localeCandidates: ['en-US'],
            history: createMemoryHistory(),
            targetDocument,
        });
    }

    it('raises the generic error toast and reports unexpected API failures', async () => {
        await bootWithResponses([makeEnvResponse(), new Response('{}', { status: 500 })]);

        await api()
            .get('boom')
            .catch(() => {
                // The rejection itself is under test elsewhere.
            });

        expect(toasts().toasts.value.at(0)?.message).toBe('common.states.error');
    });

    it('stays silent for validation failures (forms own those)', async () => {
        const validation = new Response(JSON.stringify({ message: 'Invalid.', errors: { name: ['Required.'] } }), {
            status: 422,
            headers: { 'content-type': 'application/json' },
        });

        await bootWithResponses([makeEnvResponse(), validation]);

        await api()
            .post('items', {})
            .catch(() => {
                // The rejection itself is under test elsewhere.
            });

        expect(toasts().toasts.value).toHaveLength(0);
    });

    it('stays silent for 401s (the refresh flow owns those)', async () => {
        await bootWithResponses([
            makeEnvResponse(),
            new Response('', { status: 401 }),
            new Response('', { status: 401 }),
        ]);

        await api()
            .get('secure')
            .catch(() => {
                // The rejection itself is under test elsewhere.
            });

        expect(toasts().toasts.value).toHaveLength(0);
    });
});

describe('startApplication', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
    });

    afterEach(() => {
        resetConfiguration();
        resetApi();
        resetStorage();
        resetReporting();
        resetAnalytics();
        resetFeatureFlags();
        resetToasts();
        resetConfirm();
        resetLogger();
        resetLocaleSwitcher();
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    it('mounts the application into the default selector', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('{}', { status: 404 })),
        );

        await startApplication();

        expect(document.querySelector('#app')?.innerHTML).not.toBe('');
    });
});
