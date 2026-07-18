/**
 * User-idle detection.
 *
 * A tab may go untouched for a policy-defined period - most commonly to trigger
 * an auto-logout - but that policy is an application decision, not a kernel one.
 * This monitor is the
 * seam: it arms a countdown on a small set of activity events, resets the
 * countdown whenever activity is observed, and notifies subscribers once the
 * countdown lapses. Applications wire the notification to whatever policy they
 * need (`onIdle` calling into an auth logout, a warning dialog, and so on); the
 * kernel only detects idleness.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

export interface IdleMonitorOptions {
    /** Milliseconds of inactivity before subscribers are notified. */
    readonly timeoutMs: number;

    /** Event types treated as activity; defaults to pointer, keyboard, wheel and touch input. */
    readonly events?: readonly string[];

    /** The window whose activity events are observed; defaults to the global window. */
    readonly targetWindow?: Window;
}

const DEFAULT_EVENTS: readonly string[] = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

/**
 * Detects periods of user inactivity and notifies subscribers once idle.
 */
export class IdleMonitor {
    /** Milliseconds of inactivity before subscribers are notified. */
    readonly #timeoutMs: number;

    /** The event types treated as user activity. */
    readonly #events: readonly string[];

    /** The window whose activity events are observed. */
    readonly #targetWindow: Window;

    /** The registered idle subscribers. */
    readonly #handlers = new Set<() => void>();

    /**
     * Rearms the countdown when activity is observed.
     */
    readonly #onActivity = (): void => {
        this.#rearm();
    };

    /**
     * Notifies subscribers once the countdown lapses.
     */
    readonly #onTimeout = (): void => {
        this.#timer = null;

        for (const handler of this.#handlers) {
            handler();
        }
    };

    /** The pending idle timeout handle, or null when disarmed. */
    #timer: ReturnType<typeof setTimeout> | null = null;

    /** Whether the monitor is currently running. */
    #started: boolean = false;

    constructor(options: IdleMonitorOptions) {
        this.#timeoutMs = options.timeoutMs;
        this.#events = options.events ?? DEFAULT_EVENTS;
        this.#targetWindow = options.targetWindow ?? globalThis.window;
    }

    /**
     * Arm the idle countdown and attach activity listeners. Calling start on a
     * running monitor is a no-op.
     */
    start(): void {
        if (this.#started) {
            return;
        }

        this.#started = true;

        for (const type of this.#events) {
            this.#targetWindow.addEventListener(type, this.#onActivity);
        }

        this.#arm();
    }

    /**
     * Disarm the countdown and detach the activity listeners.
     */
    stop(): void {
        if (!this.#started) {
            return;
        }

        this.#started = false;

        for (const type of this.#events) {
            this.#targetWindow.removeEventListener(type, this.#onActivity);
        }

        this.#disarm();
    }

    /**
     * Signal activity manually, resetting the countdown just as a listened
     * event would.
     */
    touch(): void {
        this.#rearm();
    }

    /**
     * Subscribe to idle notifications.
     *
     * @param handler - invoked once per idle period
     * @returns an unsubscribe function
     */
    onIdle(handler: () => void): () => void {
        this.#handlers.add(handler);

        return () => {
            this.#handlers.delete(handler);
        };
    }

    /**
     * Reset the countdown to a fresh timeout, unless the monitor is stopped.
     */
    #rearm(): void {
        if (!this.#started) {
            return;
        }

        this.#disarm();
        this.#arm();
    }

    /**
     * Schedule the timeout that notifies subscribers once inactivity lapses.
     */
    #arm(): void {
        this.#timer = setTimeout(this.#onTimeout, this.#timeoutMs);
    }

    /**
     * Cancel the pending timeout when one is scheduled.
     */
    #disarm(): void {
        if (this.#timer !== null) {
            clearTimeout(this.#timer);
            this.#timer = null;
        }
    }
}
