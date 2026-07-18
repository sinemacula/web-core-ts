/**
 * Page tracking installer.
 *
 * Registers an after-navigation hook on the Vue Router that fires a page-view
 * event for every completed navigation, and optionally records the navigation
 * as a breadcrumb on the session trail.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { Router } from 'vue-router';

import type { BreadcrumbTrail } from '../reporting/breadcrumb-trail';
import type { AnalyticsTracker } from './analytics-tracker';

/**
 * Options for installing the page-tracking hook.
 */
export interface PageTrackingOptions {
    /** The Vue Router instance to attach the after-navigation hook to. */
    readonly router: Router;

    /** The tracker that receives every page-view call. */
    readonly tracker: AnalyticsTracker;

    /** Optional breadcrumb trail; when present each navigation is appended. */
    readonly trail?: BreadcrumbTrail;
}

/**
 * Install an after-navigation hook that tracks page views and records
 * breadcrumbs.
 *
 * @param options - the router, tracker and optional breadcrumb trail
 * @returns a teardown that removes the hook; safe to call more than once
 */
export function installPageTracking(options: PageTrackingOptions): () => void {
    const { router, tracker, trail } = options;

    return router.afterEach((to, from) => {
        tracker.page(String(to.name ?? to.path), { path: to.fullPath });

        if (trail !== undefined) {
            trail.add({ category: 'navigation', message: `${from.fullPath} -> ${to.fullPath}` });
        }
    });
}
