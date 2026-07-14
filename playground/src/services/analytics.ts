/**
 * Application analytics service.
 *
 * Holds the boot-time {@link AnalyticsTracker} singleton used by every module
 * that needs to track user actions or page views. The bootstrap wires a vendor
 * adapter (e.g. Segment, PostHog); tests wire a null or spy adapter.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { AnalyticsTracker } from '@sinemacula/web-core/analytics/analytics-tracker';

let tracker: AnalyticsTracker | null = null;

/**
 * Install the analytics tracker. Called once by the application bootstrap.
 *
 * @param instance - the analytics tracker to install
 */
export function initialiseAnalytics(instance: AnalyticsTracker): void {
    tracker = instance;
}

/**
 * The active analytics tracker.
 *
 * @returns the active analytics tracker
 * @throws Error when accessed before {@link initialiseAnalytics} has been called
 */
export function analytics(): AnalyticsTracker {
    if (tracker === null) {
        throw new Error('The analytics tracker was accessed before initialisation. Call initialiseAnalytics() first.');
    }

    return tracker;
}

/**
 * Discard the analytics tracker singleton. Test use only.
 */
export function resetAnalytics(): void {
    tracker = null;
}
