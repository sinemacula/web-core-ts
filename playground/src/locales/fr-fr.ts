/**
 * Shared application translations - French (France).
 *
 * Module-specific translations live with their module; only genuinely
 * cross-cutting strings belong here.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { LocaleMessages } from '@sinemacula/web-core/module/module';

const messages: LocaleMessages = {
    common: {
        actions: {
            cancel: 'Annuler',
            confirm: 'Confirmer',
            dismiss: 'Ignorer',
            save: 'Enregistrer',
            signOut: 'Se déconnecter',
        },
        locale: {
            label: 'Langue',
        },
        nav: {
            label: 'Principal',
            dashboard: 'Tableau de bord',
            users: 'Utilisateurs',
        },
        states: {
            empty: "Rien à afficher pour l'instant.",
            error: "Une erreur s'est produite. Veuillez réessayer.",
            loading: 'Chargement…',
        },
        updates: {
            available: 'Une nouvelle version est disponible. Actualisez pour la mettre à jour.',
        },
    },
};

export default messages;
