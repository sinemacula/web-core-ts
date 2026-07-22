/**
 * Web application service singletons (composition root).
 *
 * Presents the unified web service surface: the base singletons from
 * `@sinemacula/foundation` plus the web-only locale switcher, with the
 * notification accessors re-narrowed to their concrete reactive services so the
 * hosts can read the reactive queue. `resetWebCoreServices` clears base + web.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import {
    confirmDialogs as baseConfirmDialogs,
    resetFoundationServices,
    toasts as baseToasts,
} from '@sinemacula/foundation/app/services';
import { createServiceHolder } from '@sinemacula/foundation/support/service-holder';
import type { LocaleSwitcher } from '../i18n/application-i18n';
import type { ConfirmService } from '../notifications/confirm-service';
import type { ToastService } from '../notifications/toast-service';

// biome-ignore lint/performance/noBarrelFile: the web composition root re-exports the base composition-root surface (a deliberate seam, not a convenience barrel)
export {
    analytics,
    api,
    appConfig,
    appConfigRepository,
    appStorage,
    colorScheme,
    featureFlags,
    installAnalytics,
    installApi,
    installColorScheme,
    installConfig,
    installConfirm,
    installFeatureFlags,
    installLogger,
    installRealtime,
    installReporting,
    installStorage,
    installToasts,
    logger,
    realtime,
    reporting,
} from '@sinemacula/foundation/app/services';

/**
 * The active toast service, narrowed to the concrete reactive service.
 *
 * @returns the active toast service
 */
export function toasts(): ToastService {
    return baseToasts() as ToastService;
}

/**
 * The active confirmation dialog service, narrowed to the concrete reactive
 * service.
 *
 * @returns the active confirm service
 */
export function confirmDialogs(): ConfirmService {
    return baseConfirmDialogs() as ConfirmService;
}

const localeSwitcherHolder = createServiceHolder<LocaleSwitcher>('locale switcher');

/**
 * Install the locale switcher. Called once at boot.
 *
 * @param instance - the locale switcher to install
 */
export function installLocaleSwitcher(instance: LocaleSwitcher): void {
    localeSwitcherHolder.install(instance);
}

/**
 * The active locale switcher.
 *
 * @returns the active locale switcher
 * @throws Error when accessed before {@link installLocaleSwitcher} has been
 * called
 */
export function localeSwitcher(): LocaleSwitcher {
    return localeSwitcherHolder.resolve();
}

/**
 * Clear every service holder - base and web - back to uninstalled. Test-only.
 */
export function resetWebCoreServices(): void {
    resetFoundationServices();
    localeSwitcherHolder.reset();
}
