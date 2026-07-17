/**
 * Login form behaviour.
 *
 * All behaviour for the login screen lives here, in plain TypeScript, so the
 * view stays a thin template. Validation is handled by vee-validate 4 with a
 * zod 4 schema bridged through the shared typed-schema adapter. Client-side
 * validation errors and the server's 422 field errors are both surfaced as
 * field messages; anything else collapses to a form-level translation key.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { HttpError, HttpValidationError } from '@sinemacula/web-core/http/http-error';
import { useSessionStore } from '@sinemacula/web-core/session/session-store';
import { useForm } from 'vee-validate';
import type { ComputedRef, Ref } from 'vue';
import { computed, ref } from 'vue';
import * as z from 'zod';

import { applyServerValidationErrors } from '@/forms/server-errors';
import { zodToTypedSchema } from '@/forms/typed-schema';

const loginSchema = z.object({
    email: z.string().min(1, 'auth.login.validation.emailRequired').email('auth.login.validation.emailInvalid'),
    password: z.string().min(1, 'auth.login.validation.passwordRequired'),
});

/**
 * Reactive state and submission behaviour for the login screen.
 */
export interface LoginForm {
    readonly email: Ref<string>;
    readonly password: Ref<string>;

    /**
     * Translation key for the email field error, or '' when valid/untouched.
     */
    readonly emailError: ComputedRef<string>;

    /**
     * Translation key for the password field error, or '' when valid/untouched.
     */
    readonly passwordError: ComputedRef<string>;

    /** Form-level (API) error translation key, or null when none. */
    readonly error: Ref<string | null>;
    readonly isSubmitting: ComputedRef<boolean> | Ref<boolean>;

    /**
     * Validates first; returns false when invalid or when the API call fails.
     */
    submit(): Promise<boolean>;
}

/**
 * Build the login form state and submission behaviour.
 *
 * vee-validate manages field-level validation against the zod schema; `error`
 * carries the form-level API error as a translation key.
 *
 * @returns the reactive form
 */
export function useLoginForm(): LoginForm {
    const { isSubmitting, defineField, errors, validate, setErrors } = useForm({
        validationSchema: zodToTypedSchema(loginSchema),
        initialValues: { email: '', password: '' },
    });

    const [email] = defineField('email');
    const [password] = defineField('password');

    const emailError = computed(() => errors.value.email ?? '');
    const passwordError = computed(() => errors.value.password ?? '');

    const error = ref<string | null>(null);
    const inFlight = ref(false);

    /**
     * Validate, then log in; re-entrant calls are ignored while one is in
     * flight.
     */
    const submit = async (): Promise<boolean> => {
        if (inFlight.value) {
            return false;
        }

        inFlight.value = true;

        try {
            return await attemptLogin({
                validate,
                login: () => useSessionStore().login({ email: email.value, password: password.value }),
                applyServerErrors: caught => applyServerValidationErrors(caught, setErrors),
                error,
            });
        } finally {
            inFlight.value = false;
        }
    };

    return { email, password, emailError, passwordError, error, isSubmitting, submit };
}

/**
 * The callbacks {@link attemptLogin} needs from the form to run one attempt.
 */
interface LoginAttempt {
    /** Run field validation and report whether the inputs are valid. */
    readonly validate: () => Promise<{ valid: boolean }>;

    /** Perform the session login with the current credentials. */
    readonly login: () => Promise<void>;

    /** Surface a caught failure as field errors; returns true when it did. */
    readonly applyServerErrors: (caught: unknown) => boolean;

    /** The form-level error key sink. */
    readonly error: Ref<string | null>;
}

/**
 * Validate the inputs and, when valid, attempt the session login.
 *
 * @param attempt - the form callbacks driving this attempt
 * @returns true on success, false on invalid input or a failed API call
 */
async function attemptLogin(attempt: LoginAttempt): Promise<boolean> {
    const { valid } = await attempt.validate();

    if (!valid) {
        return false;
    }

    try {
        attempt.error.value = null;
        await attempt.login();

        return true;
    } catch (caught) {
        if (!attempt.applyServerErrors(caught)) {
            attempt.error.value = resolveLoginErrorKey(caught);
        }

        return false;
    }
}

/**
 * Map a login failure onto a translation key.
 *
 * @param caught - the thrown failure
 * @returns the translation key describing the failure
 */
export function resolveLoginErrorKey(caught: unknown): string {
    if (caught instanceof HttpValidationError || (caught instanceof HttpError && caught.status === 401)) {
        return 'auth.login.errors.invalid';
    }

    return 'common.states.error';
}
