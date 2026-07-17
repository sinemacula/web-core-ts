/**
 * Application router factory.
 *
 * Builds the Vue Router instance from module-contributed routes and installs
 * the middleware pipeline as a global guard, running any global middleware
 * before the middleware declared on the matched records. Scroll behaviour
 * restores saved positions, honours hash anchors, and otherwise returns to the
 * top.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { RouteLocationNormalized, RouteRecordRaw, Router, RouterHistory, RouterScrollBehavior } from 'vue-router';
import { createRouter, createWebHistory } from 'vue-router';

import type { RouteMiddleware } from './middleware';
import { runMiddlewarePipeline } from './middleware';

/**
 * Options for building the application router.
 */
export interface RouterFactoryOptions {

    /** The routes to install on the router. */
    readonly routes: readonly RouteRecordRaw[];

    /** The history implementation; defaults to HTML5 history. */
    readonly history?: RouterHistory;

    /** Middleware run on every navigation before matched-record meta middleware. */
    readonly globalMiddleware?: readonly RouteMiddleware[];
}

/**
 * Build the application router.
 *
 * @param options - the routes to install plus optional history and global
 * middleware overrides
 * @returns the configured router
 */
export function createApplicationRouter(options: RouterFactoryOptions): Router {
    const globalMiddleware = options.globalMiddleware ?? [];

    const router = createRouter({
        history: options.history ?? createWebHistory(),
        routes: [...options.routes],
        scrollBehavior: resolveScrollPosition,
    });

    router.beforeEach(async (to, from) => {
        const result = await runMiddlewarePipeline([...globalMiddleware, ...collectRouteMiddleware(to)], { to, from });

        return result.kind === 'redirect' ? result.to : true;
    });

    return router;
}

/**
 * Gather the middleware declared by every matched route record.
 *
 * @param to - the target route
 * @returns the middleware to run, parent-first
 */
function collectRouteMiddleware(to: RouteLocationNormalized) {
    return to.matched.flatMap(record => record.meta.middleware ?? []);
}

/**
 * Resolve the scroll position for a navigation.
 *
 * @param to - the target route
 * @param _from - the previous route
 * @param savedPosition - the position saved by the browser history, if any
 * @returns the scroll target
 */
export const resolveScrollPosition: RouterScrollBehavior = (to, _from, savedPosition) => {
    if (savedPosition !== null) {
        return savedPosition;
    }

    if (to.hash !== '') {
        return { el: to.hash };
    }

    return { top: 0, left: 0 };
};
