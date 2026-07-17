/**
 * Application toast notification service.
 *
 * Thin delegating re-export of the kernel toast holder under the application's
 * established accessor names. `resetToasts` clears every kernel service holder
 * between tests.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

export {
    installToasts as initialiseToasts,
    resetWebCoreServices as resetToasts,
    toasts,
} from '@sinemacula/web-core/app/services';
