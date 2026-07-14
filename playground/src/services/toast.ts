/**
 * Application toast notification service.
 *
 * Holds the boot-time {@link ToastService} singleton used by every module
 * that needs to display non-blocking toast notifications. The bootstrap
 * constructs and installs one shared instance; tests wire their own instance.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { ToastService } from '@sinemacula/web-core/notifications/toast-service';

let service: ToastService | null = null;

/**
 * Install the toast notification service. Called once by the application bootstrap.
 *
 * @param instance - the toast service to install
 */
export function initialiseToasts(instance: ToastService): void {
    service = instance;
}

/**
 * The active toast notification service.
 *
 * @returns the active toast service
 * @throws Error when accessed before {@link initialiseToasts} has been called
 */
export function toasts(): ToastService {
    if (service === null) {
        throw new Error('The toast service was accessed before initialisation. Call initialiseToasts() first.');
    }

    return service;
}

/**
 * Discard the toast service singleton. Test use only.
 */
export function resetToasts(): void {
    service = null;
}
