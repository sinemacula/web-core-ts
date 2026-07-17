/**
 * Document title synchronisation.
 *
 * Routes declare a translation key in `meta.title`; after every navigation the
 * document title becomes the translated key suffixed with the application name.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { Router } from 'vue-router';

import type { ApplicationI18n } from './application-i18n';

/**
 * Options for installing the document title synchronisation hook.
 */
export interface DocumentTitleOptions {
    readonly router: Router;
    readonly i18n: ApplicationI18n;
    readonly appName: string;
    readonly targetDocument?: Document;
}

/**
 * Install an after-navigation hook that keeps the document title in sync.
 *
 * @param options - the router, i18n instance and application name
 * @returns a teardown removing the navigation hook
 */
export function installDocumentTitleSync(options: DocumentTitleOptions): () => void {
    const target = options.targetDocument ?? globalThis.document;

    return options.router.afterEach(route => {
        const key = route.meta.title;

        target.title = key === undefined ? options.appName : `${options.i18n.global.t(key)} | ${options.appName}`;
    });
}
