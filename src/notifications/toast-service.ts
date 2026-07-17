/**
 * Toast notification state and lifecycle manager.
 *
 * This service owns only state (the active toast list) and lifecycle
 * (auto-dismiss timers). Rendering is entirely the application's concern - a
 * thin host component subscribes to {@link ToastService.toasts} and renders the
 * list; this service never touches the DOM.
 *
 * Auto-dismiss: when a toast is shown with a non-zero duration a `setTimeout`
 * is scheduled. Dismissing or clearing a toast cancels its pending timer so no
 * stale callbacks fire.
 *
 * Toast ids are derived from an internal incrementing sequence (`toast-1`,
 * `toast-2`, …) to keep them deterministic in tests.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { ComputedRef } from 'vue';
import { computed, ref } from 'vue';

/** The visual emphasis of a toast notification. */
export type ToastVariant = 'success' | 'error' | 'information' | 'warning';

/**
 * A single toast notification.
 *
 * By convention {@link message} is a translation key; the rendering host is
 * responsible for translating it before display.
 */
export interface Toast {

    /** The unique id assigned when the toast was shown. */
    readonly id: string;

    /** The visual emphasis of the toast. */
    readonly variant: ToastVariant;

    /** The message, by convention a translation key. */
    readonly message: string;

    /** Milliseconds before auto-dismiss; 0 disables it. */
    readonly duration: number;
}

/**
 * Options accepted by the per-show methods.
 */
export interface ShowToastOptions {

    /** Auto-dismiss duration in milliseconds; 0 disables it. */
    readonly duration?: number;
}

const DEFAULT_DURATION = 5_000;

/**
 * Product-agnostic service that manages the reactive toast queue.
 *
 * Construct one shared instance per application and inject it wherever toasts
 * need to be triggered. Mount a single host component that reads {@link toasts}
 * to render the list.
 */
export class ToastService {

    /** Fallback auto-dismiss duration in milliseconds. */
    readonly #defaultDuration: number;

    /** The reactive list of currently visible toasts. */
    readonly #list = ref<Toast[]>([]);

    /** Pending auto-dismiss timers, keyed by toast id. */
    readonly #timers = new Map<string, ReturnType<typeof setTimeout>>();

    /** Monotonic counter backing generated toast ids. */
    #sequence = 0;

    /** The reactive, read-only list of currently visible toasts. */
    readonly toasts: ComputedRef<readonly Toast[]>;

    constructor(defaultDuration: number = DEFAULT_DURATION) {
        this.#defaultDuration = defaultDuration;
        this.toasts = computed(() => this.#list.value);
    }

    /**
     * Show a toast notification.
     *
     * @param variant - the visual emphasis
     * @param message - the message (by convention a translation key)
     * @param options - optional per-show overrides
     * @returns the id of the newly created toast
     */
    show(variant: ToastVariant, message: string, options?: ShowToastOptions): string {
        const id = `toast-${++this.#sequence}`;
        const duration = options?.duration ?? this.#defaultDuration;

        this.#list.value = [...this.#list.value, { id, variant, message, duration }];

        if (duration > 0) {
            this.#timers.set(
                id,
                setTimeout(() => {
                    this.dismiss(id);
                }, duration),
            );
        }

        return id;
    }

    /**
     * Show a success toast.
     *
     * @param message - the message (by convention a translation key)
     * @param options - optional per-show overrides
     * @returns the id of the newly created toast
     */
    success(message: string, options?: ShowToastOptions): string {
        return this.show('success', message, options);
    }

    /**
     * Show an error toast.
     *
     * @param message - the message (by convention a translation key)
     * @param options - optional per-show overrides
     * @returns the id of the newly created toast
     */
    error(message: string, options?: ShowToastOptions): string {
        return this.show('error', message, options);
    }

    /**
     * Show an information toast.
     *
     * @param message - the message (by convention a translation key)
     * @param options - optional per-show overrides
     * @returns the id of the newly created toast
     */
    information(message: string, options?: ShowToastOptions): string {
        return this.show('information', message, options);
    }

    /**
     * Show a warning toast.
     *
     * @param message - the message (by convention a translation key)
     * @param options - optional per-show overrides
     * @returns the id of the newly created toast
     */
    warning(message: string, options?: ShowToastOptions): string {
        return this.show('warning', message, options);
    }

    /**
     * Dismiss a specific toast by id.
     *
     * Cancels any pending auto-dismiss timer for the toast. No-op for unknown
     * ids.
     *
     * @param id - the toast id to remove
     */
    dismiss(id: string): void {
        const timer = this.#timers.get(id);

        if (timer !== undefined) {
            clearTimeout(timer);
            this.#timers.delete(id);
        }

        this.#list.value = this.#list.value.filter(toast => toast.id !== id);
    }

    /**
     * Remove all toasts and cancel all pending auto-dismiss timers.
     */
    clear(): void {
        for (const timer of this.#timers.values()) {
            clearTimeout(timer);
        }

        this.#timers.clear();
        this.#list.value = [];
    }
}
