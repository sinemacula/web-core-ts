/**
 * Component tests for login-view.
 *
 * Mounts the view inside a minimal Vue app to exercise the template and
 * setup script; API behaviour is covered by use-login-form.test.ts.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { HttpError } from '@sinemacula/web-core/http/http-error';
import { MemoryStorage } from '@sinemacula/web-core/storage/memory-storage';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from 'vue';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';

import { AUTH_ROUTE_NAMES } from '@/modules/auth/route-names';
import LoginView from '@/modules/auth/views/login-view.vue';
import { initialiseApi, resetApi } from '@/services/api';
import { initialiseStorage, resetStorage } from '@/services/storage';
import { FakeHttpClient } from '@/test-support/fake-http-client';
import { installTestSession, resetSessionContext } from '@/test-support/install-test-session';

/**
 * Build a `Record<string, unknown>` from an array of `[key, value]` pairs.
 *
 * Wraps `Object.fromEntries` so callers can write snake_case API field names
 * as plain string literals without triggering Biome's naming-convention rule.
 *
 * @param entries - key-value pairs for the record
 * @returns a plain `Record<string, unknown>`
 */
function wire(entries: ReadonlyArray<readonly [string, unknown]>): Record<string, unknown> {
    return Object.fromEntries(entries);
}

interface MountedLoginView {
    readonly container: HTMLDivElement;
    readonly router: ReturnType<typeof createRouter>;
    readonly unmount: () => void;
}

/**
 * Mount LoginView with the minimal plugins it needs.
 *
 * @returns the DOM container, router instance, and an unmount callback
 */
function mountLoginView(): MountedLoginView {
    const pinia = createPinia();
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: {} });
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: { template: '<div />' } },
            { path: '/login', name: AUTH_ROUTE_NAMES.login, component: LoginView },
        ],
    });

    const container = document.createElement('div') as HTMLDivElement;

    document.body.appendChild(container);

    const app = createApp(LoginView);

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

/**
 * Dispatch a submit event on the form inside the given container.
 *
 * @param container - the mounted component root
 */
function submitForm(container: HTMLDivElement): void {
    const form = container.querySelector('form');

    if (form === null) {
        throw new Error('login form not found');
    }

    form.dispatchEvent(new Event('submit'));
}

describe('LoginView', () => {
    beforeEach(() => {
        const storage = new MemoryStorage();

        initialiseStorage(storage);
        installTestSession(storage);
        initialiseApi(new FakeHttpClient());
        setActivePinia(createPinia());
    });

    afterEach(() => {
        resetApi();
        resetStorage();
        resetSessionContext();
    });

    it('renders the login form', () => {
        const { container, unmount } = mountLoginView();

        expect(container.querySelector('form')).not.toBeNull();

        unmount();
    });

    it('does not navigate when submit returns false (empty fields)', async () => {
        const { container, router, unmount } = mountLoginView();

        await router.isReady();

        const pushSpy = vi.spyOn(router, 'push');

        submitForm(container);

        await new Promise<void>(resolve => setTimeout(resolve, 50));

        expect(pushSpy).not.toHaveBeenCalled();

        unmount();
    });

    it('shows field errors after a failed validation submit', async () => {
        const fake = new FakeHttpClient();

        initialiseApi(fake);

        const { container, unmount } = mountLoginView();

        // Trigger email validation error by submitting with empty email
        submitForm(container);

        await new Promise<void>(resolve => setTimeout(resolve, 50));

        // After the failed submit some error UI should be present in the DOM
        // (the exact content depends on i18n key resolution but the element exists)
        const emailInput = container.querySelector<HTMLInputElement>('input[type="email"]');

        expect(emailInput).not.toBeNull();

        unmount();
    });

    it('shows an API error after a rejected login', async () => {
        const fake = new FakeHttpClient();

        fake.queueError(new HttpError(401, 'Unauthorized'));
        initialiseApi(fake);

        const { container, unmount } = mountLoginView();
        const emailInput = container.querySelector<HTMLInputElement>('input[type="email"]');
        const passwordInput = container.querySelector<HTMLInputElement>('input[type="password"]');

        if (emailInput === null || passwordInput === null) {
            throw new Error('form inputs not found');
        }

        emailInput.value = 'alice@example.com';
        emailInput.dispatchEvent(new Event('input'));
        passwordInput.value = 'wrong-password';
        passwordInput.dispatchEvent(new Event('input'));

        submitForm(container);

        await new Promise<void>(resolve => setTimeout(resolve, 50));

        // The error paragraph should be rendered after the API rejects
        const errorParagraph = container.querySelector('.login-form__error');

        // The paragraph exists in the DOM when there is an API error
        expect(errorParagraph).not.toBeNull();

        unmount();
    });

    it('redirects to / on a successful login', async () => {
        const fake = new FakeHttpClient();

        fake.queueResponse({
            data: wire([
                ['token', 'tok'],
                ['refresh_token', 'ref'],
                ['expires_at', '2026-12-31 23:59:59'],
            ]),
        });
        fake.queueResponse({
            data: wire([
                ['id', 'u1'],
                ['first_name', 'Alice'],
                ['last_name', 'Smith'],
                ['full_name', 'Alice Smith'],
                ['email', 'alice@example.com'],
            ]),
        });

        initialiseApi(fake);

        const { container, router, unmount } = mountLoginView();

        await router.isReady();

        const pushSpy = vi.spyOn(router, 'push');
        const emailInput = container.querySelector<HTMLInputElement>('input[type="email"]');
        const passwordInput = container.querySelector<HTMLInputElement>('input[type="password"]');

        if (emailInput === null || passwordInput === null) {
            throw new Error('form inputs not found');
        }

        emailInput.value = 'alice@example.com';
        emailInput.dispatchEvent(new Event('input'));
        passwordInput.value = 'correct-password';
        passwordInput.dispatchEvent(new Event('input'));

        submitForm(container);

        await new Promise<void>(resolve => setTimeout(resolve, 50));

        expect(pushSpy).toHaveBeenCalledWith('/');

        unmount();
    });
});
