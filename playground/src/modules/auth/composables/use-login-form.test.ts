/**
 * Unit tests for useLoginForm and resolveLoginErrorKey.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { HttpError, HttpValidationError } from '@sinemacula/web-core/http/http-error';
import { MemoryStorage } from '@sinemacula/web-core/storage/memory-storage';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h } from 'vue';
import type { LoginForm } from '@/modules/auth/composables/use-login-form';
import { resolveLoginErrorKey, useLoginForm } from '@/modules/auth/composables/use-login-form';
import { initialiseApi, resetApi } from '@/services/api';
import { initialiseStorage, resetStorage } from '@/services/storage';
import { FakeHttpClient } from '@/test-support/fake-http-client';
import { installTestSession, resetSessionContext } from '@/test-support/install-test-session';

/**
 * Build a `Record<string, unknown>` from an array of `[key, value]` pairs.
 *
 * Wraps `Object.fromEntries` so callers can write snake_case API field names as
 * plain string literals inside array elements rather than as object-literal
 * keys - keeping non-camelCase field names out of any position that Biome's
 * naming-convention or literal-keys rules inspect.
 *
 * @param entries - key-value pairs for the record
 * @returns a plain `Record<string, unknown>`
 */
function wire(entries: ReadonlyArray<readonly [string, unknown]>): Record<string, unknown> {
    return Object.fromEntries(entries);
}

interface MountedLoginForm {
    readonly form: LoginForm;
    readonly unmount: () => void;
}

/**
 * Mount `useLoginForm` inside a real Vue component setup so that vee-validate's
 * lifecycle hooks (`onMounted`, `provide`) have a valid component instance to
 * attach to.
 *
 * @returns the form composable result and a cleanup function
 * @throws Error when the composable fails to initialise (should never happen)
 */
function mountLoginForm(): MountedLoginForm {
    const forms: LoginForm[] = [];

    const TestComponent = defineComponent({
        setup() {
            forms.push(useLoginForm());

            return {};
        },
        render() {
            return h('div');
        },
    });

    const pinia = createPinia();
    const div = document.createElement('div');
    const app = createApp(TestComponent).use(pinia);

    setActivePinia(pinia);
    app.mount(div);

    const form = forms[0];

    if (form === undefined) {
        throw new Error('useLoginForm did not initialise');
    }

    return { form, unmount: () => app.unmount() };
}

describe('useLoginForm', () => {
    let fake: FakeHttpClient;

    beforeEach(() => {
        const storage = new MemoryStorage();

        initialiseStorage(storage);
        installTestSession(storage);
        fake = new FakeHttpClient();
        initialiseApi(fake);
    });

    afterEach(() => {
        resetApi();
        resetStorage();
        resetSessionContext();
    });

    it('initialises with empty fields and no error', () => {
        const { form, unmount } = mountLoginForm();

        expect(form.email.value).toBe('');
        expect(form.password.value).toBe('');
        expect(form.emailError.value).toBe('');
        expect(form.passwordError.value).toBe('');
        expect(form.error.value).toBeNull();
        expect(form.isSubmitting.value).toBe(false);

        unmount();
    });

    describe('submit - validation', () => {
        it('returns false and sets emailRequired key when email is empty', async () => {
            const { form, unmount } = mountLoginForm();

            form.email.value = '';
            form.password.value = 'secret';

            const result = await form.submit();

            expect(result).toBe(false);
            expect(form.emailError.value).toBe('auth.login.validation.emailRequired');
            expect(fake.calls).toHaveLength(0);

            unmount();
        });

        it('returns false and sets emailInvalid key when email is malformed', async () => {
            const { form, unmount } = mountLoginForm();

            form.email.value = 'not-an-email';
            form.password.value = 'secret';

            const result = await form.submit();

            expect(result).toBe(false);
            expect(form.emailError.value).toBe('auth.login.validation.emailInvalid');
            expect(fake.calls).toHaveLength(0);

            unmount();
        });

        it('returns false and sets passwordRequired key when password is empty', async () => {
            const { form, unmount } = mountLoginForm();

            form.email.value = 'alice@example.com';
            form.password.value = '';

            const result = await form.submit();

            expect(result).toBe(false);
            expect(form.passwordError.value).toBe('auth.login.validation.passwordRequired');
            expect(fake.calls).toHaveLength(0);

            unmount();
        });
    });

    describe('submit - API', () => {
        it('returns true and clears error on a successful login', async () => {
            const { form, unmount } = mountLoginForm();

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

            form.email.value = 'alice@example.com';
            form.password.value = 'correct-password';

            const result = await form.submit();

            expect(result).toBe(true);
            expect(form.error.value).toBeNull();
            expect(form.isSubmitting.value).toBe(false);

            unmount();
        });

        it('returns false and sets an error key on a failed login', async () => {
            const { form, unmount } = mountLoginForm();

            fake.queueError(new HttpError(401, 'Unauthorized'));

            form.email.value = 'alice@example.com';
            form.password.value = 'wrong-password';

            const result = await form.submit();

            expect(result).toBe(false);
            expect(form.error.value).toBe('auth.login.errors.invalid');
            expect(form.isSubmitting.value).toBe(false);

            unmount();
        });

        it('clears the API error on a subsequent submit attempt', async () => {
            const { form, unmount } = mountLoginForm();

            fake.queueError(new HttpError(401, 'Unauthorized'));

            form.email.value = 'alice@example.com';
            form.password.value = 'wrong-password';

            await form.submit();

            expect(form.error.value).toBe('auth.login.errors.invalid');

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

            await form.submit();

            expect(form.error.value).toBeNull();

            unmount();
        });

        it('sets field messages and leaves the form-level error null on a 422 with field errors', async () => {
            const { form, unmount } = mountLoginForm();

            fake.queueError(
                new HttpValidationError(
                    422,
                    'Unprocessable',
                    {},
                    {
                        email: ['The email has already been taken.'],
                        password: [],
                    },
                ),
            );

            form.email.value = 'alice@example.com';
            form.password.value = 'secret';

            const result = await form.submit();

            expect(result).toBe(false);
            expect(form.emailError.value).toBe('The email has already been taken.');
            expect(form.passwordError.value).toBe('');
            expect(form.error.value).toBeNull();

            unmount();
        });

        it('falls through to the generic error key on a 422 with an empty errors map', async () => {
            const { form, unmount } = mountLoginForm();

            fake.queueError(new HttpValidationError(422, 'Unprocessable', {}, {}));

            form.email.value = 'alice@example.com';
            form.password.value = 'secret';

            const result = await form.submit();

            expect(result).toBe(false);
            expect(form.error.value).toBe('auth.login.errors.invalid');

            unmount();
        });

        it('guards against double-submit by returning false on the second call', async () => {
            const { form, unmount } = mountLoginForm();

            // Queue the session + user responses for one login; a second API
            // call sequence would exhaust the queue and return undefined.
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

            form.email.value = 'alice@example.com';
            form.password.value = 'correct-password';

            const first = form.submit();
            const second = form.submit(); // called while first is in-flight

            const [firstResult, secondResult] = await Promise.all([first, second]);

            expect(firstResult).toBe(true);
            expect(secondResult).toBe(false);
            // POST auth + GET users/self = 2 calls total (guard blocks a second
            // login)
            expect(fake.calls).toHaveLength(2);

            unmount();
        });
    });
});

describe('resolveLoginErrorKey', () => {
    it('returns the invalid credentials key for HttpValidationError', () => {
        const error = new HttpValidationError(422, 'Unprocessable', {}, {});

        expect(resolveLoginErrorKey(error)).toBe('auth.login.errors.invalid');
    });

    it('returns the invalid credentials key for HttpError with status 401', () => {
        const error = new HttpError(401, 'Unauthorized');

        expect(resolveLoginErrorKey(error)).toBe('auth.login.errors.invalid');
    });

    it('returns the generic error key for an HttpError with a non-401 status', () => {
        const error = new HttpError(500, 'Internal Server Error');

        expect(resolveLoginErrorKey(error)).toBe('common.states.error');
    });

    it('returns the generic error key for a plain Error', () => {
        const error = new Error('unexpected');

        expect(resolveLoginErrorKey(error)).toBe('common.states.error');
    });
});
