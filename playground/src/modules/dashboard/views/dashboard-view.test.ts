/**
 * Component tests for dashboard-view.
 *
 * Mounts the view inside a minimal Vue app to exercise the template and setup
 * script; sign-out API behaviour is covered by auth-store.test.ts.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { Environment } from '@sinemacula/web-core/config/environment';
import { ObjectEnvironmentSource } from '@sinemacula/web-core/config/object-environment-source';
import type { LocaleSwitcher } from '@sinemacula/web-core/i18n/application-i18n';
import { MemoryStorage } from '@sinemacula/web-core/storage/memory-storage';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, createApp } from 'vue';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';

import { AUTH_ROUTE_NAMES } from '@/modules/auth/route-names';
import DashboardView from '@/modules/dashboard/views/dashboard-view.vue';
import { initialiseApi, resetApi } from '@/services/api';
import { initialiseConfiguration, resetConfiguration } from '@/services/config';
import { initialiseLocaleSwitcher, resetLocaleSwitcher } from '@/services/locale';
import { initialiseStorage, resetStorage } from '@/services/storage';
import { FakeHttpClient } from '@/test-support/fake-http-client';
import { installTestSession, resetSessionContext } from '@/test-support/install-test-session';

const ACCESS_TOKEN_STORAGE_KEY = 'auth.access_token';

/**
 * Minimal no-op stub that satisfies the {@link LocaleSwitcher} interface,
 * required because DashboardView renders DefaultLayout's locale switcher.
 */
const stubLocaleSwitcher: LocaleSwitcher = {
    current: computed(() => 'en-US'),
    switchTo: async () => undefined,
};

/**
 * Build a `Record<string, string>` from an array of `[key, value]` pairs.
 *
 * Wraps `Object.fromEntries` so callers can write SCREAMING_SNAKE_CASE env keys
 * as plain string literals without triggering Biome's naming-convention rule on
 * object literal keys.
 *
 * @param entries - key-value pairs for the record
 * @returns a plain `Record<string, string>`
 */
function wire(entries: ReadonlyArray<readonly [string, string]>): Record<string, string> {
    return Object.fromEntries(entries);
}

interface MountedDashboardView {
    readonly container: HTMLDivElement;
    readonly router: ReturnType<typeof createRouter>;
    readonly unmount: () => void;
}

/**
 * Mount DashboardView with the minimal plugins it needs.
 *
 * @returns the DOM container, router instance, and an unmount callback
 */
function mountDashboardView(): MountedDashboardView {
    const pinia = createPinia();
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: {} });
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: DashboardView },
            { path: '/login', name: AUTH_ROUTE_NAMES.login, component: { template: '<div />' } },
        ],
    });

    const container = document.createElement('div') as HTMLDivElement;

    document.body.appendChild(container);

    const app = createApp(DashboardView);

    setActivePinia(pinia);
    app.use(pinia).use(i18n).use(router);
    app.mount(container);

    return {
        container,
        router,
        unmount: () => {
            app.unmount();
            container.remove();
        },
    };
}

describe('DashboardView', () => {
    beforeEach(() => {
        const storage = new MemoryStorage();

        storage.set(ACCESS_TOKEN_STORAGE_KEY, 'valid-token');
        initialiseStorage(storage);
        installTestSession(storage);
        initialiseApi(new FakeHttpClient());
        initialiseConfiguration(new Environment(new ObjectEnvironmentSource(wire([['APP_NAME', 'TestApp']]))));
        initialiseLocaleSwitcher(stubLocaleSwitcher);
        setActivePinia(createPinia());
    });

    afterEach(() => {
        resetApi();
        resetStorage();
        resetConfiguration();
        resetLocaleSwitcher();
        resetSessionContext();
    });

    it('renders the dashboard card', () => {
        const { container, unmount } = mountDashboardView();

        expect(container.querySelector('.dashboard__welcome')).not.toBeNull();

        unmount();
    });

    it('calls logout and navigates to login on sign-out', async () => {
        const fake = new FakeHttpClient();

        // Queue a response for the logout API call
        fake.queueResponse(null);
        initialiseApi(fake);

        const { container, router, unmount } = mountDashboardView();

        await router.isReady();

        const pushSpy = vi.spyOn(router, 'push');

        const signOutButton = container.querySelector('button');

        if (signOutButton === null) {
            throw new Error('sign-out button not found');
        }

        signOutButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        await new Promise<void>(resolve => setTimeout(resolve, 50));

        expect(pushSpy).toHaveBeenCalledWith({ name: AUTH_ROUTE_NAMES.login });

        unmount();
    });
});
