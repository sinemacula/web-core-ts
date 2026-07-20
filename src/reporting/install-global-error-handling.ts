/**
 * Global error handling installer.
 *
 * Wires the Vue error handler and browser window error/rejection listeners to
 * the provided ErrorReporter so that all unhandled exceptions are captured in
 * one place regardless of their origin.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { App } from 'vue';

import type { BreadcrumbTrail } from './breadcrumb-trail';
import type { ErrorReporter } from './error-reporter';

/**
 * Options for installing global error handling.
 */
export interface GlobalErrorHandlingOptions {
    /** The Vue application instance to attach the error handler to. */
    readonly app: App;

    /** The reporter that receives every captured error or message. */
    readonly reporter: ErrorReporter;

    /** Optional breadcrumb trail; when present its snapshot is attached to every report. */
    readonly trail?: BreadcrumbTrail;

    /** The window to attach native error listeners to (default globalThis.window). */
    readonly targetWindow?: Window;
}

/**
 * Install Vue and browser-global error listeners that forward to `reporter`.
 *
 * - `app.config.errorHandler` catches errors thrown inside Vue components.
 * - A `window 'error'` listener catches synchronous script errors.
 * - A `window 'unhandledrejection'` listener catches unhandled Promise
 *   rejections.
 *
 * The returned teardown restores the Vue error handler that was in place before
 * installation and removes both window listeners; calling it more than once is
 * a no-op.
 *
 * @param options - the app, reporter, optional trail and optional window target
 * @returns a teardown that undoes the installation
 */
export function installGlobalErrorHandling(options: GlobalErrorHandlingOptions): () => void {
    const { app, reporter, trail } = options;
    const target = options.targetWindow ?? globalThis.window;
    const previousErrorHandler = app.config.errorHandler;

    app.config.errorHandler = (err, _instance, info) => {
        const context: Record<string, unknown> = { source: 'vue', info };

        if (trail !== undefined) {
            context['breadcrumbs'] = trail.list();
        }

        reporter.captureError(err, context);
    };

    /** Forward a synchronous window error to the reporter with breadcrumbs. */
    const onError = (event: ErrorEvent): void => {
        const context: Record<string, unknown> = { source: 'window' };

        if (trail !== undefined) {
            context['breadcrumbs'] = trail.list();
        }

        reporter.captureError(event.error ?? event.message, context);
    };

    /**
     * Forward an unhandled promise rejection to the reporter with breadcrumbs.
     */
    const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
        const context: Record<string, unknown> = { source: 'unhandledrejection' };

        if (trail !== undefined) {
            context['breadcrumbs'] = trail.list();
        }

        reporter.captureError(event.reason, context);
    };

    target.addEventListener('error', onError);
    target.addEventListener('unhandledrejection', onUnhandledRejection);

    let installed = true;

    return () => {
        if (!installed) {
            return;
        }

        installed = false;

        // Conditional restore: exactOptionalPropertyTypes forbids assigning
        // undefined back.
        if (previousErrorHandler === undefined) {
            delete app.config.errorHandler;
        } else {
            app.config.errorHandler = previousErrorHandler;
        }

        target.removeEventListener('error', onError);
        target.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
}
