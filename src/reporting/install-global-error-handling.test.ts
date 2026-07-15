/**
 * Unit tests for install-global-error-handling.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent } from 'vue';

import { BreadcrumbTrail } from './breadcrumb-trail';
import type { ErrorReporter, ReportedUser } from './error-reporter';
import { installGlobalErrorHandling } from './install-global-error-handling';

const Stub = defineComponent({ render: () => null });

function makeReporter(): ErrorReporter & {
    captureErrorCalls: Array<{ error: unknown; context: Readonly<Record<string, unknown>> | undefined }>;
} {
    const captureErrorCalls: Array<{ error: unknown; context: Readonly<Record<string, unknown>> | undefined }> = [];

    return {
        captureErrorCalls,
        captureError(error: unknown, context?: Readonly<Record<string, unknown>>) {
            captureErrorCalls.push({ error, context });
        },
        captureMessage(_message: string, _context?: Readonly<Record<string, unknown>>) {
            // Messages are not asserted by these tests.
        },
        setUser(_user: ReportedUser | null) {
            // User assignment is not asserted by these tests.
        },
    };
}

function makeWindow(): Window & {
    dispatchError(init: ErrorEventInit): void;
    dispatchRejection(reason: unknown): void;
    listenerCount(type: string): number;
} {
    const listeners = new Map<string, EventListenerOrEventListenerObject[]>();

    const win = {
        addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
            const existing = listeners.get(type) ?? [];

            existing.push(listener);
            listeners.set(type, existing);
        },
        removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
            const existing = listeners.get(type) ?? [];
            const index = existing.indexOf(listener);

            if (index !== -1) {
                existing.splice(index, 1);
            }
        },
        listenerCount(type: string) {
            return (listeners.get(type) ?? []).length;
        },
        dispatchError(init: ErrorEventInit) {
            const event = new ErrorEvent('error', init);
            const handlers = listeners.get('error') ?? [];

            for (const h of handlers) {
                if (typeof h === 'function') {
                    h(event);
                } else {
                    h.handleEvent(event);
                }
            }
        },
        dispatchRejection(reason: unknown) {
            // PromiseRejectionEvent is not available in happy-dom; simulate it
            // by constructing a plain object with the shape the listener reads.
            const event = { type: 'unhandledrejection', reason } as PromiseRejectionEvent;
            const handlers = listeners.get('unhandledrejection') ?? [];

            for (const h of handlers) {
                if (typeof h === 'function') {
                    h(event as unknown as Event);
                } else {
                    h.handleEvent(event as unknown as Event);
                }
            }
        },
    } as unknown as Window & {
        dispatchError(init: ErrorEventInit): void;
        dispatchRejection(reason: unknown): void;
        listenerCount(type: string): number;
    };

    return win;
}

describe('installGlobalErrorHandling', () => {
    describe('Vue error handler', () => {
        it('captures Vue errors via app.config.errorHandler', () => {
            const app = createApp(Stub);
            const reporter = makeReporter();
            const win = makeWindow();

            installGlobalErrorHandling({ app, reporter, targetWindow: win });

            const error = new Error('vue error');

            app.config.errorHandler?.(error, null, 'render function');

            expect(reporter.captureErrorCalls).toHaveLength(1);
            expect(reporter.captureErrorCalls[0]?.error).toBe(error);
        });

        it('includes source vue and info in context', () => {
            const app = createApp(Stub);
            const reporter = makeReporter();
            const win = makeWindow();

            installGlobalErrorHandling({ app, reporter, targetWindow: win });

            app.config.errorHandler?.(new Error('x'), null, 'setup function');

            expect(reporter.captureErrorCalls[0]?.context).toMatchObject({ source: 'vue', info: 'setup function' });
        });

        it('omits breadcrumbs key when no trail is provided', () => {
            const app = createApp(Stub);
            const reporter = makeReporter();
            const win = makeWindow();

            installGlobalErrorHandling({ app, reporter, targetWindow: win });

            app.config.errorHandler?.(new Error('x'), null, 'setup');

            expect(reporter.captureErrorCalls[0]?.context).not.toHaveProperty('breadcrumbs');
        });

        it('includes breadcrumbs snapshot when a trail is provided', () => {
            const app = createApp(Stub);
            const reporter = makeReporter();
            const win = makeWindow();
            const trail = new BreadcrumbTrail(50, () => 0);

            trail.add({ category: 'ui', message: 'click' });

            installGlobalErrorHandling({ app, reporter, trail, targetWindow: win });

            app.config.errorHandler?.(new Error('x'), null, 'setup');

            const ctx = reporter.captureErrorCalls[0]?.context as Record<string, unknown>;

            expect(ctx.breadcrumbs).toStrictEqual(trail.list());
        });
    });

    describe('window error listener', () => {
        it('captures the error property of the event when present', () => {
            const app = createApp(Stub);
            const reporter = makeReporter();
            const win = makeWindow();

            installGlobalErrorHandling({ app, reporter, targetWindow: win });

            const error = new Error('script error');

            win.dispatchError({ error, message: 'script error' });

            expect(reporter.captureErrorCalls[0]?.error).toBe(error);
        });

        it('falls back to event.message when event.error is null', () => {
            const app = createApp(Stub);
            const reporter = makeReporter();
            const win = makeWindow();

            installGlobalErrorHandling({ app, reporter, targetWindow: win });

            win.dispatchError({ error: null, message: 'fallback message' });

            expect(reporter.captureErrorCalls[0]?.error).toBe('fallback message');
        });

        it('omits breadcrumbs key in context when no trail is provided', () => {
            const app = createApp(Stub);
            const reporter = makeReporter();
            const win = makeWindow();

            installGlobalErrorHandling({ app, reporter, targetWindow: win });

            win.dispatchError({ error: new Error('x'), message: 'x' });

            expect(reporter.captureErrorCalls[0]?.context).not.toHaveProperty('breadcrumbs');
        });

        it('includes breadcrumbs snapshot when a trail is provided', () => {
            const app = createApp(Stub);
            const reporter = makeReporter();
            const win = makeWindow();
            const trail = new BreadcrumbTrail(50, () => 0);

            trail.add({ category: 'nav', message: 'pushed' });

            installGlobalErrorHandling({ app, reporter, trail, targetWindow: win });

            win.dispatchError({ error: new Error('x'), message: 'x' });

            const ctx = reporter.captureErrorCalls[0]?.context as Record<string, unknown>;

            expect(ctx.breadcrumbs).toStrictEqual(trail.list());
        });
    });

    describe('window unhandledrejection listener', () => {
        it('captures the rejection reason', () => {
            const app = createApp(Stub);
            const reporter = makeReporter();
            const win = makeWindow();

            installGlobalErrorHandling({ app, reporter, targetWindow: win });

            const reason = new Error('promise rejection');

            win.dispatchRejection(reason);

            expect(reporter.captureErrorCalls[0]?.error).toBe(reason);
        });

        it('omits breadcrumbs key in context when no trail is provided', () => {
            const app = createApp(Stub);
            const reporter = makeReporter();
            const win = makeWindow();

            installGlobalErrorHandling({ app, reporter, targetWindow: win });

            win.dispatchRejection('string reason');

            expect(reporter.captureErrorCalls[0]?.context).not.toHaveProperty('breadcrumbs');
        });

        it('includes breadcrumbs snapshot when a trail is provided', () => {
            const app = createApp(Stub);
            const reporter = makeReporter();
            const win = makeWindow();
            const trail = new BreadcrumbTrail(50, () => 0);

            trail.add({ category: 'http', message: 'fetch failed' });

            installGlobalErrorHandling({ app, reporter, trail, targetWindow: win });

            win.dispatchRejection(new Error('rejected'));

            const ctx = reporter.captureErrorCalls[0]?.context as Record<string, unknown>;

            expect(ctx.breadcrumbs).toStrictEqual(trail.list());
        });
    });

    describe('targetWindow default', () => {
        it('uses globalThis.window when targetWindow is omitted', () => {
            const app = createApp(Stub);
            const reporter = makeReporter();
            const addSpy = vi.spyOn(globalThis.window, 'addEventListener');
            const removeSpy = vi.spyOn(globalThis.window, 'removeEventListener');

            const teardown = installGlobalErrorHandling({ app, reporter });

            expect(addSpy).toHaveBeenCalledWith('error', expect.any(Function));
            expect(addSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

            teardown();

            const addedError = addSpy.mock.calls.find(call => call[0] === 'error')?.[1];
            const addedRejection = addSpy.mock.calls.find(call => call[0] === 'unhandledrejection')?.[1];
            const removedError = removeSpy.mock.calls.find(call => call[0] === 'error')?.[1];
            const removedRejection = removeSpy.mock.calls.find(call => call[0] === 'unhandledrejection')?.[1];

            expect(removedError).toBe(addedError);
            expect(removedRejection).toBe(addedRejection);

            addSpy.mockRestore();
            removeSpy.mockRestore();
        });
    });

    describe('teardown', () => {
        it('restores the previous Vue error handler', () => {
            const app = createApp(Stub);
            const previous = vi.fn();

            app.config.errorHandler = previous;

            const teardown = installGlobalErrorHandling({ app, reporter: makeReporter(), targetWindow: makeWindow() });

            teardown();

            expect(app.config.errorHandler).toBe(previous);
        });

        it('resets the Vue error handler to undefined when none was set', () => {
            const app = createApp(Stub);
            const teardown = installGlobalErrorHandling({ app, reporter: makeReporter(), targetWindow: makeWindow() });

            teardown();

            expect(app.config.errorHandler).toBeUndefined();
        });

        it('routes Vue errors to the restored handler instead of the reporter after teardown', () => {
            const app = createApp(Stub);
            const reporter = makeReporter();
            const previous = vi.fn();

            app.config.errorHandler = previous;

            const teardown = installGlobalErrorHandling({ app, reporter, targetWindow: makeWindow() });

            teardown();

            const error = new Error('after teardown');

            app.config.errorHandler?.(error, null, 'render function');

            expect(reporter.captureErrorCalls).toHaveLength(0);
            expect(previous).toHaveBeenCalledTimes(1);
            expect(previous).toHaveBeenCalledWith(error, null, 'render function');
        });

        it('stops capturing window error events after teardown', () => {
            const app = createApp(Stub);
            const reporter = makeReporter();
            const win = makeWindow();

            const teardown = installGlobalErrorHandling({ app, reporter, targetWindow: win });

            teardown();

            win.dispatchError({ error: new Error('x'), message: 'x' });

            expect(reporter.captureErrorCalls).toHaveLength(0);
        });

        it('stops capturing unhandled rejections after teardown', () => {
            const app = createApp(Stub);
            const reporter = makeReporter();
            const win = makeWindow();

            const teardown = installGlobalErrorHandling({ app, reporter, targetWindow: win });

            teardown();

            win.dispatchRejection(new Error('x'));

            expect(reporter.captureErrorCalls).toHaveLength(0);
        });

        it('removes exactly the two listeners it added', () => {
            const app = createApp(Stub);
            const win = makeWindow();

            const teardown = installGlobalErrorHandling({ app, reporter: makeReporter(), targetWindow: win });

            expect(win.listenerCount('error')).toBe(1);
            expect(win.listenerCount('unhandledrejection')).toBe(1);

            teardown();

            expect(win.listenerCount('error')).toBe(0);
            expect(win.listenerCount('unhandledrejection')).toBe(0);
        });

        it('leaves listeners registered by other consumers in place', () => {
            const app = createApp(Stub);
            const win = makeWindow();
            const other = vi.fn();

            win.addEventListener('error', other);

            const teardown = installGlobalErrorHandling({ app, reporter: makeReporter(), targetWindow: win });

            teardown();

            expect(win.listenerCount('error')).toBe(1);

            win.dispatchError({ error: new Error('x'), message: 'x' });

            expect(other).toHaveBeenCalledTimes(1);
        });

        it('is a no-op when called a second time', () => {
            const app = createApp(Stub);
            const reporter = makeReporter();
            const win = makeWindow();

            const teardown = installGlobalErrorHandling({ app, reporter, targetWindow: win });

            teardown();

            const replacement = vi.fn();

            app.config.errorHandler = replacement;

            teardown();

            expect(app.config.errorHandler).toBe(replacement);

            win.dispatchError({ error: new Error('x'), message: 'x' });
            win.dispatchRejection('reason');

            expect(reporter.captureErrorCalls).toHaveLength(0);
        });
    });
});
