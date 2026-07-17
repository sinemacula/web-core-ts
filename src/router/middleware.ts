/**
 * Route middleware contract and pipeline.
 *
 * Laravel-style navigation middleware: each route lists middleware in its meta,
 * the pipeline runs them in order, and the first non-`next` result
 * short-circuits navigation. Results are a discriminated union, never an
 * imperative `next()` callback.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import './route-meta';

import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router';

/**
 * The navigation being evaluated by a middleware pipeline.
 */
export interface MiddlewareContext {

    /** The route being navigated to. */
    readonly to: RouteLocationNormalized;

    /** The route being navigated from. */
    readonly from: RouteLocationNormalized;
}

/**
 * Discriminated union describing a middleware pipeline decision.
 */
export type MiddlewareResult =
    | {
        /** Discriminant marking a proceed decision. */
        readonly kind: 'next';
    }
    | {
        /** Discriminant marking a redirect decision. */
        readonly kind: 'redirect';

        /** The location to redirect the navigation to. */
        readonly to: RouteLocationRaw;
    };

/**
 * A single navigation guard unit.
 */
export interface RouteMiddleware {

    /**
     * Inspect a navigation and decide whether it proceeds.
     *
     * @param context - the navigation being evaluated
     * @returns the middleware decision
     */
    handle(context: MiddlewareContext): MiddlewareResult | Promise<MiddlewareResult>;
}

/**
 * Allow the navigation to proceed.
 *
 * @returns the `next` decision
 */
export function next(): MiddlewareResult {
    return { kind: 'next' };
}

/**
 * Redirect the navigation elsewhere.
 *
 * @param to - the redirect target
 * @returns the `redirect` decision
 */
export function redirect(to: RouteLocationRaw): MiddlewareResult {
    return { kind: 'redirect', to };
}

/**
 * Run middleware in order until one short-circuits.
 *
 * @param middleware - the middleware to run
 * @param context - the navigation being evaluated
 * @returns the first non-`next` decision, or `next` when all pass
 */
export async function runMiddlewarePipeline(
    middleware: readonly RouteMiddleware[],
    context: MiddlewareContext,
): Promise<MiddlewareResult> {
    for (const entry of middleware) {
        const result = await entry.handle(context);

        if (result.kind !== 'next') {
            return result;
        }
    }

    return next();
}
