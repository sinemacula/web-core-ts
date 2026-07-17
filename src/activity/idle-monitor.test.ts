/**
 * Unit tests for idle-monitor.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IdleMonitor } from './idle-monitor';

/**
 * Build a fake `Window` whose activity listeners can be triggered and inspected
 * directly.
 *
 * @returns the fake window plus test helpers to emit events and inspect
 * listeners
 */
function fakeWindow(): {
    window: Window;
    emit: (type: string) => void;
    listenerCount: (type: string) => number;
} {
    const listeners = new Map<string, Set<EventListener>>();

    const target = {
        addEventListener: (type: string, listener: EventListener) => {
            const set = listeners.get(type) ?? new Set<EventListener>();

            set.add(listener);
            listeners.set(type, set);
        },
        removeEventListener: (type: string, listener: EventListener) => {
            listeners.get(type)?.delete(listener);
        },
    } as unknown as Window;

    return {
        window: target,
        emit: type => {
            for (const listener of listeners.get(type) ?? []) {
                listener(new Event(type));
            }
        },
        listenerCount: type => listeners.get(type)?.size ?? 0,
    };
}

describe('IdleMonitor', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('notifies handlers after the timeout elapses with no activity', () => {
        const fake = fakeWindow();
        const monitor = new IdleMonitor({ timeoutMs: 1_000, targetWindow: fake.window });
        const handler = vi.fn();

        monitor.onIdle(handler);
        monitor.start();
        vi.advanceTimersByTime(1_000);

        expect(handler).toHaveBeenCalledTimes(1);

        monitor.stop();
    });

    it('resets the countdown when an activity event occurs', () => {
        const fake = fakeWindow();
        const monitor = new IdleMonitor({ timeoutMs: 1_000, targetWindow: fake.window });
        const handler = vi.fn();

        monitor.onIdle(handler);
        monitor.start();
        vi.advanceTimersByTime(600);
        fake.emit('pointerdown');
        vi.advanceTimersByTime(600);

        expect(handler).not.toHaveBeenCalled();

        vi.advanceTimersByTime(400);

        expect(handler).toHaveBeenCalledTimes(1);

        monitor.stop();
    });

    it('resets the countdown via touch()', () => {
        const fake = fakeWindow();
        const monitor = new IdleMonitor({ timeoutMs: 1_000, targetWindow: fake.window });
        const handler = vi.fn();

        monitor.onIdle(handler);
        monitor.start();
        vi.advanceTimersByTime(600);
        monitor.touch();
        vi.advanceTimersByTime(600);

        expect(handler).not.toHaveBeenCalled();

        vi.advanceTimersByTime(400);

        expect(handler).toHaveBeenCalledTimes(1);

        monitor.stop();
    });

    it('ignores touch() when not started', () => {
        const fake = fakeWindow();
        const monitor = new IdleMonitor({ timeoutMs: 1_000, targetWindow: fake.window });
        const handler = vi.fn();

        monitor.onIdle(handler);
        monitor.touch();
        vi.advanceTimersByTime(1_000);

        expect(handler).not.toHaveBeenCalled();
    });

    it('re-arms after firing so a later idle period notifies again', () => {
        const fake = fakeWindow();
        const monitor = new IdleMonitor({ timeoutMs: 1_000, targetWindow: fake.window });
        const handler = vi.fn();

        monitor.onIdle(handler);
        monitor.start();
        vi.advanceTimersByTime(1_000);

        expect(handler).toHaveBeenCalledTimes(1);

        fake.emit('keydown');
        vi.advanceTimersByTime(1_000);

        expect(handler).toHaveBeenCalledTimes(2);

        monitor.stop();
    });

    it('notifies every subscribed handler', () => {
        const fake = fakeWindow();
        const monitor = new IdleMonitor({ timeoutMs: 1_000, targetWindow: fake.window });
        const first = vi.fn();
        const second = vi.fn();

        monitor.onIdle(first);
        monitor.onIdle(second);
        monitor.start();
        vi.advanceTimersByTime(1_000);

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);

        monitor.stop();
    });

    it('stops delivering to unsubscribed handlers', () => {
        const fake = fakeWindow();
        const monitor = new IdleMonitor({ timeoutMs: 1_000, targetWindow: fake.window });
        const handler = vi.fn();

        const unsubscribe = monitor.onIdle(handler);

        unsubscribe();
        monitor.start();
        vi.advanceTimersByTime(1_000);

        expect(handler).not.toHaveBeenCalled();

        monitor.stop();
    });

    it('cancels the countdown on stop so no notification follows', () => {
        const fake = fakeWindow();
        const monitor = new IdleMonitor({ timeoutMs: 1_000, targetWindow: fake.window });
        const handler = vi.fn();

        monitor.onIdle(handler);
        monitor.start();
        monitor.stop();
        vi.advanceTimersByTime(1_000);

        expect(handler).not.toHaveBeenCalled();
    });

    it('is idempotent across repeated start and stop calls', () => {
        const fake = fakeWindow();
        const monitor = new IdleMonitor({ timeoutMs: 1_000, targetWindow: fake.window });

        monitor.start();
        monitor.start();

        expect(fake.listenerCount('pointerdown')).toBe(1);

        monitor.stop();
        monitor.stop();

        expect(fake.listenerCount('pointerdown')).toBe(0);
    });

    it('supports a custom activity events list', () => {
        const fake = fakeWindow();
        const monitor = new IdleMonitor({ timeoutMs: 1_000, events: ['scroll'], targetWindow: fake.window });
        const handler = vi.fn();

        monitor.onIdle(handler);
        monitor.start();
        vi.advanceTimersByTime(600);
        fake.emit('scroll');
        vi.advanceTimersByTime(600);

        expect(handler).not.toHaveBeenCalled();
        expect(fake.listenerCount('pointerdown')).toBe(0);

        monitor.stop();
    });

    it('uses the global window when no target window is provided', () => {
        const fake = fakeWindow();

        vi.stubGlobal('window', fake.window);

        const monitor = new IdleMonitor({ timeoutMs: 1_000 });
        const handler = vi.fn();

        monitor.onIdle(handler);
        monitor.start();
        vi.advanceTimersByTime(1_000);

        expect(handler).toHaveBeenCalledTimes(1);

        monitor.stop();
    });
});
