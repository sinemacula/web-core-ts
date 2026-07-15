/**
 * Application analytics service.
 *
 * Thin delegating re-export of the kernel analytics holder under the
 * application's established accessor names. `resetAnalytics` clears every
 * kernel service holder between tests.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

export {
    analytics,
    installAnalytics as initialiseAnalytics,
    resetWebCoreServices as resetAnalytics,
} from '@sinemacula/web-core/app/services';
