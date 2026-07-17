/**
 * Auth module translations - French (France).
 *
 * Namespaced under `auth.` by the module registry.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { LocaleMessages } from '@sinemacula/web-core/module/module';

const messages: LocaleMessages = {
    login: {
        actions: {
            submit: 'Se connecter',
        },
        errors: {
            invalid: 'Ces identifiants ne correspondent à aucun compte.',
        },
        fields: {
            email: 'Adresse e-mail',
            password: 'Mot de passe',
        },
        subtitle: 'Connectez-vous à votre console Sine Macula.',
        title: 'Se connecter',
        validation: {
            emailInvalid: 'Saisissez une adresse e-mail valide.',
            emailRequired: 'Saisissez votre adresse e-mail.',
            passwordRequired: 'Saisissez votre mot de passe.',
        },
    },
};

export default messages;
