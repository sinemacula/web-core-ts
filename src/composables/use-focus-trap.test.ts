/**
 * Unit tests for use-focus-trap.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { useFocusTrap } from './use-focus-trap';

/**
 * Build a container div with the given inner HTML and append it to the document
 * body so `isConnected` works correctly.
 *
 * @param innerHtml - the HTML string to place inside the container
 * @returns the mounted container element
 */
function buildContainer(innerHtml: string): HTMLElement {
    const div = document.createElement('div');

    div.innerHTML = innerHtml;
    document.body.appendChild(div);

    return div;
}

/**
 * Dispatch a synthetic keydown event on the document active element.
 *
 * @param key - the key value (e.g. 'Tab')
 * @param shiftKey - whether the Shift modifier is held
 */
function pressKey(key: string, shiftKey = false): void {
    const target = document.activeElement ?? document.body;

    target.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }));
}

describe('useFocusTrap', () => {
    let container: HTMLElement;

    afterEach(() => {
        container?.remove();
    });

    describe('empty container', () => {
        beforeEach(() => {
            container = buildContainer('');
        });

        it('activate is a safe no-op when there are no focusable descendants', () => {
            const el = ref<HTMLElement | null>(container);
            const trap = useFocusTrap(el);

            expect(() => trap.activate()).not.toThrow();
        });

        it('does not install a keydown listener when there are no focusable descendants', () => {
            const el = ref<HTMLElement | null>(container);
            const trap = useFocusTrap(el);

            trap.activate();

            // deactivate should not throw even though activate was a no-op
            expect(() => trap.deactivate()).not.toThrow();
        });
    });

    describe('null container ref', () => {
        it('activate is a safe no-op when the container ref is null', () => {
            const el = ref<HTMLElement | null>(null);
            const trap = useFocusTrap(el);

            expect(() => trap.activate()).not.toThrow();
        });

        it('deactivate is a safe no-op when the container ref is null', () => {
            const el = ref<HTMLElement | null>(null);
            const trap = useFocusTrap(el);

            expect(() => trap.deactivate()).not.toThrow();
        });
    });

    describe('single focusable element', () => {
        beforeEach(() => {
            container = buildContainer('<button id="only">Only</button>');
        });

        it('focuses the first (only) element on activate', () => {
            const el = ref<HTMLElement | null>(container);
            const trap = useFocusTrap(el);

            trap.activate();

            expect(document.activeElement?.id).toBe('only');
        });

        it('Tab on the only element wraps back to itself', () => {
            const el = ref<HTMLElement | null>(container);
            const trap = useFocusTrap(el);

            trap.activate();
            pressKey('Tab');

            expect(document.activeElement?.id).toBe('only');
        });

        it('Shift+Tab on the only element wraps back to itself', () => {
            const el = ref<HTMLElement | null>(container);
            const trap = useFocusTrap(el);

            trap.activate();
            pressKey('Tab', true);

            expect(document.activeElement?.id).toBe('only');
        });
    });

    describe('multiple focusable elements', () => {
        beforeEach(() => {
            container = buildContainer(`
                <button id="first">First</button>
                <button id="middle">Middle</button>
                <button id="last">Last</button>
            `);
        });

        it('focuses the first element on activate', () => {
            const el = ref<HTMLElement | null>(container);
            const trap = useFocusTrap(el);

            trap.activate();

            expect(document.activeElement?.id).toBe('first');
        });

        it('Tab on the last element wraps to the first', () => {
            const el = ref<HTMLElement | null>(container);
            const trap = useFocusTrap(el);

            trap.activate();

            // move focus to last
            (container.querySelector<HTMLElement>('#last') as HTMLElement).focus();
            pressKey('Tab');

            expect(document.activeElement?.id).toBe('first');
        });

        it('Shift+Tab on the first element wraps to the last', () => {
            const el = ref<HTMLElement | null>(container);
            const trap = useFocusTrap(el);

            trap.activate();
            pressKey('Tab', true);

            expect(document.activeElement?.id).toBe('last');
        });

        it('Tab on a middle element does not interfere', () => {
            const el = ref<HTMLElement | null>(container);
            const trap = useFocusTrap(el);

            trap.activate();

            (container.querySelector<HTMLElement>('#middle') as HTMLElement).focus();
            pressKey('Tab');

            // default behaviour: focus stays on middle (no preventDefault in
            // this path)
            expect(document.activeElement?.id).toBe('middle');
        });

        it('Shift+Tab on a middle element does not interfere', () => {
            const el = ref<HTMLElement | null>(container);
            const trap = useFocusTrap(el);

            trap.activate();

            (container.querySelector<HTMLElement>('#middle') as HTMLElement).focus();
            pressKey('Tab', true);

            expect(document.activeElement?.id).toBe('middle');
        });
    });

    describe('non-Tab keys', () => {
        beforeEach(() => {
            container = buildContainer('<button id="btn">Button</button>');
        });

        it('ignores non-Tab keydown events', () => {
            const el = ref<HTMLElement | null>(container);
            const trap = useFocusTrap(el);

            trap.activate();

            expect(() => pressKey('Enter')).not.toThrow();
            expect(() => pressKey('Escape')).not.toThrow();
            expect(() => pressKey('ArrowDown')).not.toThrow();
        });
    });

    describe('Tab when container becomes empty after activation', () => {
        it('is a safe no-op when all focusable elements are removed after activate', () => {
            container = buildContainer('<button id="dyn">Dynamic</button>');

            const el = ref<HTMLElement | null>(container);
            const trap = useFocusTrap(el);

            trap.activate();

            // Remove the button so the container is now empty
            (container.querySelector<HTMLElement>('#dyn') as HTMLElement).remove();

            // Fire the Tab event directly on the container (the listener is
            // attached there)
            expect(() => {
                container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false, bubbles: true }));
            }).not.toThrow();

            trap.deactivate();
        });
    });

    describe('deactivate when no element was focused before activate', () => {
        it('deactivate is a safe no-op when activeElement was not an HTMLElement at activation time', () => {
            // Simulate a non-HTMLElement active element (e.g. SVGElement or
            // null)
            const spy = vi.spyOn(document, 'activeElement', 'get').mockReturnValueOnce(null);

            container = buildContainer('<button id="sole">Sole</button>');

            const el = ref<HTMLElement | null>(container);
            const trap = useFocusTrap(el);

            trap.activate();
            spy.mockRestore();

            expect(() => trap.deactivate()).not.toThrow();
        });
    });

    describe('deactivate', () => {
        it('restores focus to the element that was active before activate', () => {
            const trigger = document.createElement('button');

            trigger.id = 'trigger';
            document.body.appendChild(trigger);
            trigger.focus();

            container = buildContainer('<button id="inside">Inside</button>');

            const el = ref<HTMLElement | null>(container);
            const trap = useFocusTrap(el);

            trap.activate();
            expect(document.activeElement?.id).toBe('inside');

            trap.deactivate();
            expect(document.activeElement?.id).toBe('trigger');

            trigger.remove();
        });

        it('does not restore focus when the previous element has been removed from the DOM', () => {
            const trigger = document.createElement('button');

            trigger.id = 'detached';
            document.body.appendChild(trigger);
            trigger.focus();

            container = buildContainer('<button id="inside">Inside</button>');

            const el = ref<HTMLElement | null>(container);
            const trap = useFocusTrap(el);

            trap.activate();

            trigger.remove(); // detach before deactivate

            expect(() => trap.deactivate()).not.toThrow();
        });

        it('removes the keydown listener so Tab no longer wraps after deactivate', () => {
            container = buildContainer('<button id="a">A</button><button id="b">B</button>');

            const el = ref<HTMLElement | null>(container);
            const trap = useFocusTrap(el);

            trap.activate();
            trap.deactivate();

            // After deactivate, Tab at the last element should not wrap
            (container.querySelector<HTMLElement>('#b') as HTMLElement).focus();

            const activeBeforeTab = document.activeElement?.id;

            pressKey('Tab'); // no listener → no wrap

            // Focus stays on 'b' because the listener was removed
            expect(document.activeElement?.id).toBe(activeBeforeTab);
        });
    });
});
