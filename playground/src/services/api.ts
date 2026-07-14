/**
 * Application API service.
 *
 * Thin delegating re-export of the kernel HTTP client holder under the
 * application's established accessor names. `resetApi` clears every kernel
 * service holder between tests.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

export { api, installApi as initialiseApi, resetWebCoreServices as resetApi } from '@sinemacula/web-core/app/services';
