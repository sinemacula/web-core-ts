/**
 * Route meta augmentation.
 *
 * Declares the shape of `route.meta` across the application so middleware and
 * titles are type-checked at the route definition site.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { RouteMiddleware } from './middleware';

declare module 'vue-router' {
    interface RouteMeta {

        /** Translation key for the document title. */
        title?: string;

        /** Middleware evaluated, in order, before the route is entered. */
        middleware?: readonly RouteMiddleware[];
    }
}
