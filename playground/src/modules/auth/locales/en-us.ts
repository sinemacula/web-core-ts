/**
 * Auth module translations — English (United States).
 *
 * Namespaced under `auth.` by the module registry.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { LocaleMessages } from '@sinemacula/web-core/module/module';

const messages: LocaleMessages = {
    login: {
        actions: {
            submit: 'Sign in',
        },
        errors: {
            invalid: 'Those credentials do not match our records.',
        },
        fields: {
            email: 'Email address',
            password: 'Password',
        },
        subtitle: 'Sign in to your Sine Macula console.',
        title: 'Sign in',
        validation: {
            emailInvalid: 'Enter a valid email address.',
            emailRequired: 'Enter your email address.',
            passwordRequired: 'Enter your password.',
        },
    },
};

export default messages;
