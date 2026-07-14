/**
 * Application feature-flag service.
 *
 * Thin delegating re-export of the kernel feature-flag holder under the
 * application's established accessor names. `resetFeatureFlags` clears every
 * kernel service holder between tests.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

export {
    featureFlags,
    installFeatureFlags as initialiseFeatureFlags,
    resetWebCoreServices as resetFeatureFlags,
} from '@sinemacula/web-core/app/services';
