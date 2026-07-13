/**
 * Console analytics tracker adapter.
 *
 * Writes every analytics call to the browser console via `console.info` for
 * use during development. Not intended for production — swap in a real
 * provider adapter via the AnalyticsTracker port when deploying.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { AnalyticsTracker } from './analytics-tracker';

/**
 * An analytics tracker that logs every call with `console.info`.
 */
export class ConsoleAnalyticsTracker implements AnalyticsTracker {
    track(event: string, properties?: Readonly<Record<string, unknown>>): void {
        console.info('[AnalyticsTracker] track', event, ...(properties !== undefined ? [properties] : []));
    }

    page(name: string, properties?: Readonly<Record<string, unknown>>): void {
        console.info('[AnalyticsTracker] page', name, ...(properties !== undefined ? [properties] : []));
    }

    identify(id: string, traits?: Readonly<Record<string, unknown>>): void {
        console.info('[AnalyticsTracker] identify', id, ...(traits !== undefined ? [traits] : []));
    }

    reset(): void {
        console.info('[AnalyticsTracker] reset');
    }
}
