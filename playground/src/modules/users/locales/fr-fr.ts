/**
 * Users module translations - French (France).
 *
 * Namespaced under `users.` by the module registry.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { LocaleMessages } from '@sinemacula/web-core/module/module';

const messages: LocaleMessages = {
    index: {
        title: 'Utilisateurs',
        search: 'Rechercher des utilisateurs',
        columns: {
            fullName: 'Nom complet',
            email: 'E-mail',
            createdAt: 'Créé le',
        },
        actions: {
            retry: 'Réessayer',
            previousPage: 'Précédent',
            nextPage: 'Suivant',
        },
        pagination: 'Page {current} sur {last}',
    },
};

export default messages;
