/**
 * Shared application translations - English (United States).
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
            cancel: 'Cancel',
            confirm: 'Confirm',
            dismiss: 'Dismiss',
            save: 'Save',
            signOut: 'Sign out',
        },
        locale: {
            label: 'Language',
        },
        nav: {
            label: 'Main',
            dashboard: 'Dashboard',
            users: 'Users',
        },
        states: {
            empty: 'Nothing to show yet.',
            error: 'Something went wrong. Please try again.',
            loading: 'Loading…',
        },
        theme: {
            label: 'Theme',
            light: 'Light',
            dark: 'Dark',
            system: 'System',
        },
        updates: {
            available: 'A new version is available. Refresh to update.',
        },
    },
    httpErrors: {
        badRequest: { title: 'Bad Request', message: 'The server could not understand the request.' },
        forbidden: { title: 'Forbidden', message: 'You do not have permission to view this page.' },
        notFound: { title: 'Not Found', message: 'The page you are looking for could not be found.' },
        methodNotAllowed: { title: 'Method Not Allowed', message: 'That request method is not allowed here.' },
        uriTooLong: { title: 'URI Too Long', message: 'The request address is too long to process.' },
        rangeNotSatisfiable: { title: 'Range Not Satisfiable', message: 'The requested range cannot be served.' },
        internalServerError: { title: 'Internal Server Error', message: 'Something went wrong on our end.' },
        notImplemented: { title: 'Not Implemented', message: 'The server does not support this request.' },
        badGateway: { title: 'Bad Gateway', message: 'The server received an invalid response upstream.' },
        serviceUnavailable: {
            title: 'Service Unavailable',
            message: 'The service is temporarily unavailable. Please try again shortly.',
        },
        gatewayTimeout: { title: 'Gateway Timeout', message: 'The upstream server took too long to respond.' },
        home: 'Return to the homepage',
    },
};

export default messages;
