/**
 * Application logging service.
 *
 * Thin delegating re-export of the kernel logger holder under the application's
 * established accessor names. `resetLogger` clears every kernel service holder
 * between tests.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

export {
    installLogger as initialiseLogger,
    logger,
    resetWebCoreServices as resetLogger,
} from '@sinemacula/web-core/app/services';
