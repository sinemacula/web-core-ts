/**
 * Application error-reporting service.
 *
 * Holds the boot-time {@link ErrorReporter} singleton used by every module
 * that needs to capture exceptions or diagnostic messages. The bootstrap
 * wires a vendor adapter (e.g. Sentry); tests wire a null or spy adapter.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { ErrorReporter } from '@sinemacula/web-core/reporting/error-reporter';

let reporter: ErrorReporter | null = null;

/**
 * Install the error reporter. Called once by the application bootstrap.
 *
 * @param instance - the error reporter to install
 */
export function initialiseReporting(instance: ErrorReporter): void {
    reporter = instance;
}

/**
 * The active error reporter.
 *
 * @returns the active error reporter
 * @throws Error when accessed before {@link initialiseReporting} has been called
 */
export function reporting(): ErrorReporter {
    if (reporter === null) {
        throw new Error('The error reporter was accessed before initialisation. Call initialiseReporting() first.');
    }

    return reporter;
}

/**
 * Discard the error reporter singleton. Test use only.
 */
export function resetReporting(): void {
    reporter = null;
}
