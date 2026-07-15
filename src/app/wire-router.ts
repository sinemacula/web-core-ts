/**
 * Router wiring for the bootstrap preset.
 *
 * Builds the application router from the registry's module-contributed
 * routes and global guards, then installs the document-title
 * synchronisation hook, surfacing its teardown so the preset can compose it
 * into application disposal.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { Router, RouterHistory } from 'vue-router';

import type { ApplicationI18n } from '../i18n/application-i18n';
import { installDocumentTitleSync } from '../i18n/document-title';
import type { ModuleDefinition } from '../module/module';
import { collectModuleGuards, collectModuleRoutes } from '../module/module';
import { createApplicationRouter } from '../router/router-factory';

/**
 * Options for {@link wireRouter}.
 */
export interface WireRouterOptions {
    /** The registry's ordered module list, the source of routes and guards. */
    readonly modules: readonly ModuleDefinition[];

    /** The i18n instance translating `meta.title` keys for the document title. */
    readonly i18n: ApplicationI18n;

    /** The application name suffixed onto every document title. */
    readonly appName: string;

    /** The router history implementation; defaults to web history. */
    readonly history?: RouterHistory;

    /** The document whose title is synchronised. */
    readonly targetDocument?: Document;
}

/**
 * The wired router and the title-sync teardown.
 */
export interface WiredRouter {
    readonly router: Router;

    /** Removes the document-title synchronisation hook. */
    readonly titleSyncTeardown: () => void;
}

/**
 * Wire the application router.
 *
 * @param options - the module list, i18n instance, application name and platform seams
 * @returns the router and the teardown removing the title-sync hook
 */
export function wireRouter(options: WireRouterOptions): WiredRouter {
    const router = createApplicationRouter({
        routes: collectModuleRoutes(options.modules),
        ...(options.history === undefined ? {} : { history: options.history }),
        globalMiddleware: collectModuleGuards(options.modules),
    });

    const titleSyncTeardown = installDocumentTitleSync({
        router,
        i18n: options.i18n,
        appName: options.appName,
        ...(options.targetDocument === undefined ? {} : { targetDocument: options.targetDocument }),
    });

    return { router, titleSyncTeardown };
}
