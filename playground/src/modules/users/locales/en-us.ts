/**
 * Users module translations — English (United States).
 *
 * Namespaced under `users.` by the module registry.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { LocaleMessages } from '@sinemacula/web-core/module/module';

const messages: LocaleMessages = {
    index: {
        title: 'Users',
        search: 'Search users',
        columns: {
            fullName: 'Full name',
            email: 'Email',
            createdAt: 'Created',
        },
        actions: {
            retry: 'Retry',
            previousPage: 'Previous',
            nextPage: 'Next',
        },
        pagination: 'Page {current} of {last}',
    },
};

export default messages;
