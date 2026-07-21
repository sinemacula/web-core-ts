/**
 * Shared application translations - French (France).
 *
 * Module-specific translations live with their module; only genuinely
 * cross-cutting strings belong here.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
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
        theme: {
            label: 'Thème',
            light: 'Clair',
            dark: 'Sombre',
            system: 'Système',
        },
        updates: {
            available: 'Une nouvelle version est disponible. Actualisez pour la mettre à jour.',
        },
    },
    httpErrors: {
        badRequest: { title: 'Requête incorrecte', message: "Le serveur n'a pas pu comprendre la requête." },
        forbidden: { title: 'Accès refusé', message: "Vous n'avez pas l'autorisation d'accéder à cette page." },
        notFound: { title: 'Page introuvable', message: 'La page que vous recherchez est introuvable.' },
        methodNotAllowed: { title: 'Méthode non autorisée', message: "Cette méthode de requête n'est pas autorisée ici." },
        uriTooLong: { title: 'URI trop longue', message: "L'adresse de la requête est trop longue à traiter." },
        rangeNotSatisfiable: { title: 'Plage non satisfaisable', message: 'La plage demandée ne peut pas être fournie.' },
        internalServerError: { title: 'Erreur interne du serveur', message: "Une erreur s'est produite de notre côté." },
        notImplemented: { title: 'Non implémenté', message: 'Le serveur ne prend pas en charge cette requête.' },
        badGateway: { title: 'Mauvaise passerelle', message: 'Le serveur a reçu une réponse non valide en amont.' },
        serviceUnavailable: {
            title: 'Service indisponible',
            message: 'Le service est temporairement indisponible. Veuillez réessayer sous peu.',
        },
        gatewayTimeout: {
            title: 'Délai de la passerelle dépassé',
            message: 'Le serveur en amont a mis trop de temps à répondre.',
        },
        home: "Retour à la page d'accueil",
    },
};

export default messages;
