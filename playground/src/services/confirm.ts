/**
 * Application confirmation dialog service.
 *
 * Holds the boot-time {@link ConfirmService} singleton used by every module
 * that needs to display a promise-based confirmation dialog. The bootstrap
 * constructs and installs one shared instance; tests wire their own instance.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { ConfirmService } from '@sinemacula/web-core/notifications/confirm-service';

let service: ConfirmService | null = null;

/**
 * Install the confirmation dialog service. Called once by the application bootstrap.
 *
 * @param instance - the confirm service to install
 */
export function initialiseConfirm(instance: ConfirmService): void {
    service = instance;
}

/**
 * The active confirmation dialog service.
 *
 * @returns the active confirm service
 * @throws Error when accessed before {@link initialiseConfirm} has been called
 */
export function confirmDialogs(): ConfirmService {
    if (service === null) {
        throw new Error(
            'The confirmation dialog service was accessed before initialisation. Call initialiseConfirm() first.',
        );
    }

    return service;
}

/**
 * Discard the confirmation dialog service singleton. Test use only.
 */
export function resetConfirm(): void {
    service = null;
}
