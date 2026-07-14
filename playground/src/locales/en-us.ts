/**
 * Shared application translations — English (United States).
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
        updates: {
            available: 'A new version is available. Refresh to update.',
        },
    },
};

export default messages;
