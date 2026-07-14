/**
 * Application confirmation dialog service.
 *
 * Thin delegating re-export of the kernel confirmation dialog holder under
 * the application's established accessor names. `resetConfirm` clears every
 * kernel service holder between tests.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

export {
    confirmDialogs,
    installConfirm as initialiseConfirm,
    resetWebCoreServices as resetConfirm,
} from '@sinemacula/web-core/app/services';
