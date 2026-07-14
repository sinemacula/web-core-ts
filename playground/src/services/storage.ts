/**
 * Application storage service.
 *
 * Thin delegating re-export of the kernel storage holder under the
 * application's established accessor names. `resetStorage` clears every
 * kernel service holder between tests.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

export {
    appStorage,
    installStorage as initialiseStorage,
    resetWebCoreServices as resetStorage,
} from '@sinemacula/web-core/app/services';
