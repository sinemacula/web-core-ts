/**
 * Application error-reporting service.
 *
 * Thin delegating re-export of the kernel error reporter holder under the
 * application's established accessor names. `resetReporting` clears every
 * kernel service holder between tests.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

export {
    installReporting as initialiseReporting,
    reporting,
    resetWebCoreServices as resetReporting,
} from '@sinemacula/web-core/app/services';
