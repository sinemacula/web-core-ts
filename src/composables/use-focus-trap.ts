/**
 * Focus trap composable.
 *
 * Provides a lifecycle-agnostic focus trap that the host component drives via
 * `activate` and `deactivate`. Traps keyboard focus inside a container element
 * by intercepting Tab and Shift+Tab so focus wraps to the opposite boundary
 * instead of leaving the container.
 *
 * Design decisions:
 * - No Vue lifecycle hooks (`onMounted`, `onUnmounted`) - the host is
 *   responsible for calling `activate`/`deactivate` from watchers. This makes
 *   the composable unit-testable with a plain happy-dom container without
 *   needing to mount a Vue component.
 * - Empty-container behaviour: when no focusable descendants exist, `activate`
 *   is a safe no-op (no listener is installed, no focus attempt is made). This
 *   avoids throwing when a dialog renders with a loading state.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { Ref } from 'vue';

/** Selector for all elements that participate in the tab order. */
const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Controls returned by {@link useFocusTrap}.
 */
export interface FocusTrapControls {

    /**
     * Activate the focus trap.
     *
     * Remembers the currently-focused element so focus can be restored on
     * deactivate. Queries the container for focusable descendants and focuses
     * the first one. Installs a keydown listener that wraps Tab / Shift+Tab at
     * the boundaries. When no focusable descendants exist this is a safe no-op.
     */
    activate(): void;

    /**
     * Deactivate the focus trap.
     *
     * Removes the keydown listener and restores focus to the element that was
     * active when `activate` was called, provided that element is still
     * attached to the document. No-op when the trap was never activated or when
     * there is nothing to restore.
     */
    deactivate(): void;
}

/**
 * Collect every focusable descendant of `container` in DOM order.
 *
 * @param container - the root element to search
 * @returns an array of focusable elements
 */
function getFocusable(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * Handle a Tab keydown event inside a trapped container.
 *
 * Wraps focus to the last element when Shift+Tab is pressed on the first, and
 * to the first element when Tab is pressed on the last. All other combinations
 * are left to default browser behaviour.
 *
 * @param event - the keyboard event
 * @param container - the container element to search for focusable children
 */
function handleTrapKeydown(event: KeyboardEvent, container: HTMLElement): void {
    const focusable = getFocusable(container);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (first === undefined || last === undefined) {
        return;
    }

    if (event.shiftKey) {
        if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
        }
    } else if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

/**
 * Create a reusable focus trap for the given container ref.
 *
 * The host drives the trap by calling `activate()` when the container becomes
 * visible and `deactivate()` when it is hidden. The trap itself makes no DOM
 * mutations and installs no Vue lifecycle hooks.
 *
 * @param container - a ref to the container element to trap focus within
 * @returns activate/deactivate controls for the focus trap
 */
export function useFocusTrap(container: Ref<HTMLElement | null>): FocusTrapControls {
    let previouslyFocused: HTMLElement | null = null;
    let keydownHandler: ((event: KeyboardEvent) => void) | null = null;

    /**
     * Remember the active element, focus the first trap target, and intercept
     * Tab. No-op when the container is absent or holds nothing focusable.
     */
    function activate(): void {
        const el = container.value;

        if (el === null) {
            return;
        }

        const focusable = getFocusable(el);
        const firstFocusable = focusable[0];

        if (firstFocusable === undefined) {
            return;
        }

        if (document.activeElement instanceof HTMLElement) {
            previouslyFocused = document.activeElement;
        }
        firstFocusable.focus();

        keydownHandler = (event: KeyboardEvent): void => {
            if (event.key === 'Tab') {
                handleTrapKeydown(event, el);
            }
        };

        el.addEventListener('keydown', keydownHandler);
    }

    /**
     * Stop intercepting Tab and restore focus to the pre-activation element.
     */
    function deactivate(): void {
        const el = container.value;

        if (el !== null && keydownHandler !== null) {
            el.removeEventListener('keydown', keydownHandler);
        }

        keydownHandler = null;

        if (previouslyFocused?.isConnected) {
            previouslyFocused.focus();
        }

        previouslyFocused = null;
    }

    return { activate, deactivate };
}
