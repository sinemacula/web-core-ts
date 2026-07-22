/**
 * Route middleware, bound to vue-router.
 *
 * Specialises the framework-agnostic pipeline from `@sinemacula/foundation` to
 * vue-router's route and location types, and pulls in the route-meta
 * augmentation so middleware are type-checked at the route definition site.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import './route-meta';

import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router';

import type {
    MiddlewareContext as BaseMiddlewareContext,
    MiddlewareResult as BaseMiddlewareResult,
    RouteMiddleware as BaseRouteMiddleware,
} from '@sinemacula/foundation/router/middleware';


/**
 * The navigation being evaluated, over vue-router routes.
 */
export type MiddlewareContext = BaseMiddlewareContext<RouteLocationNormalized>;

/**
 * A middleware pipeline decision, over vue-router locations.
 */
export type MiddlewareResult = BaseMiddlewareResult<RouteLocationRaw>;

/**
 * A single navigation guard unit, over vue-router routes and locations.
 */
export type RouteMiddleware = BaseRouteMiddleware<RouteLocationNormalized, RouteLocationRaw>;
