/**
 * Application locale-switcher service.
 *
 * Thin delegating re-export of the kernel locale switcher holder under the
 * application's established accessor names. `resetLocaleSwitcher` clears every
 * kernel service holder between tests.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

export {
    installLocaleSwitcher as initialiseLocaleSwitcher,
    localeSwitcher,
    resetWebCoreServices as resetLocaleSwitcher,
} from '@sinemacula/web-core/app/services';
