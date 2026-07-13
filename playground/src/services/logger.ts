/**
 * Application logging service.
 *
 * Holds the boot-time {@link Logger} singleton used by every module that
 * needs to log a message. The bootstrap wires a console adapter locally and
 * a shipping sink in production; tests wire a null or spy adapter.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { Logger } from '@sinemacula/web-core/logging/logger';

let instance: Logger | null = null;

/**
 * Install the logger. Called once by the application bootstrap.
 *
 * @param logger - the logger to install
 */
export function initialiseLogger(logger: Logger): void {
    instance = logger;
}

/**
 * The active logger.
 *
 * @returns the active logger
 * @throws Error when accessed before {@link initialiseLogger} has been called
 */
export function logger(): Logger {
    if (instance === null) {
        throw new Error('The logger was accessed before initialisation. Call initialiseLogger() first.');
    }

    return instance;
}

/**
 * Discard the logger singleton. Test use only.
 */
export function resetLogger(): void {
    instance = null;
}
