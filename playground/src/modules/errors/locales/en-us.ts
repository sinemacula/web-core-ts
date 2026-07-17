/**
 * Errors module translations - English (United States).
 *
 * Namespaced under `errors.` by the module registry.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { LocaleMessages } from '@sinemacula/web-core/module/module';

const messages: LocaleMessages = {
    notFound: {
        title: 'Page not found',
        message: "The page you're looking for doesn't exist or has moved.",
        action: 'Back to home',
    },
    forbidden: {
        title: 'Access denied',
        message: "You don't have permission to view this page.",
        action: 'Back to home',
    },
    fatal: {
        title: 'Something went wrong',
        message: 'An unexpected error occurred. Reloading the page usually fixes it.',
        action: 'Reload',
    },
};

export default messages;
