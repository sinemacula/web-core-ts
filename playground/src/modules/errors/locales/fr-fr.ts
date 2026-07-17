/**
 * Errors module translations - French (France).
 *
 * Namespaced under `errors.` by the module registry.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { LocaleMessages } from '@sinemacula/web-core/module/module';

const messages: LocaleMessages = {
    notFound: {
        title: 'Page introuvable',
        message: "La page que vous recherchez n'existe pas ou a été déplacée.",
        action: "Retour à l'accueil",
    },
    forbidden: {
        title: 'Accès refusé',
        message: "Vous n'avez pas la permission de consulter cette page.",
        action: "Retour à l'accueil",
    },
    fatal: {
        title: "Une erreur s'est produite",
        message: "Une erreur inattendue s'est produite. Recharger la page résout généralement le problème.",
        action: 'Recharger',
    },
};

export default messages;
