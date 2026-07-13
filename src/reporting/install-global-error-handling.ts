/**
 * Global error handling installer.
 *
 * Wires the Vue error handler and browser window error/rejection listeners
 * to the provided ErrorReporter so that all unhandled exceptions are captured
 * in one place regardless of their origin.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
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
 * - A `window 'unhandledrejection'` listener catches unhandled Promise rejections.
 *
 * @param options - the app, reporter, optional trail and optional window target
 */
export function installGlobalErrorHandling(options: GlobalErrorHandlingOptions): void {
    const { app, reporter, trail } = options;
    const target = options.targetWindow ?? globalThis.window;

    app.config.errorHandler = (err, _instance, info) => {
        const context: Record<string, unknown> = { source: 'vue', info };

        if (trail !== undefined) {
            context.breadcrumbs = trail.list();
        }

        reporter.captureError(err, context);
    };

    target.addEventListener('error', event => {
        const context: Record<string, unknown> = { source: 'window' };

        if (trail !== undefined) {
            context.breadcrumbs = trail.list();
        }

        reporter.captureError(event.error ?? event.message, context);
    });

    target.addEventListener('unhandledrejection', event => {
        const context: Record<string, unknown> = { source: 'unhandledrejection' };

        if (trail !== undefined) {
            context.breadcrumbs = trail.list();
        }

        reporter.captureError(event.reason, context);
    });
}
