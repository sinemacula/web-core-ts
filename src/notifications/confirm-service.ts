/**
 * Promise-based confirmation dialog state manager.
 *
 * This service owns only the reactive state (the active confirmation request)
 * and the resolution lifecycle. Rendering is entirely the application's concern
 * - a thin host component subscribes to {@link ConfirmService.active} and
 * renders the dialog; this service never touches the DOM.
 *
 * Sequential semantics: only one confirmation dialog is surface at a time.
 * Subsequent calls to {@link ConfirmService.confirm} while a request is already
 * active are queued (FIFO) and surfaced automatically once the current request
 * is settled via {@link ConfirmService.settle}.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { ComputedRef } from 'vue';
import { computed, ref } from 'vue';

/**
 * The data that drives a confirmation dialog.
 *
 * By convention {@link title}, {@link message}, {@link confirmLabel}, and
 * {@link cancelLabel} are translation keys; the rendering host translates them
 * before display.
 */
export interface ConfirmRequest {
    readonly title: string;
    readonly message: string;
    readonly confirmLabel?: string;
    readonly cancelLabel?: string;
}

/**
 * A {@link ConfirmRequest} that has been assigned an id and is currently active
 * (i.e. waiting for the user to settle it).
 */
export interface ActiveConfirm extends ConfirmRequest {
    readonly id: string;
}

interface PendingEntry {
    readonly request: ConfirmRequest;
    readonly resolve: (outcome: boolean) => void;
}

/**
 * Product-agnostic service that manages the reactive confirmation queue.
 *
 * Construct one shared instance per application and inject it wherever a
 * destructive action requires explicit user confirmation. Mount a single host
 * component that reads {@link active} to render the modal.
 */
export class ConfirmService {
    readonly #queue: PendingEntry[] = [];
    readonly #active = ref<ActiveConfirm | null>(null);
    #sequence = 0;
    #currentResolve: ((outcome: boolean) => void) | null = null;

    /** The reactive, read-only currently-active confirmation request. */
    readonly active: ComputedRef<ActiveConfirm | null>;

    constructor() {
        this.active = computed(() => this.#active.value);
    }

    /**
     * Request a user confirmation.
     *
     * If a confirmation dialog is already open the request is queued and
     * surfaced after the current one settles.
     *
     * @param request - the content to display in the confirmation dialog
     * @returns a promise that resolves to `true` when the user confirms, or
     * `false` when the user cancels
     */
    confirm(request: ConfirmRequest): Promise<boolean> {
        return new Promise<boolean>(resolve => {
            if (this.#active.value === null) {
                this.#surface({ request, resolve });
            } else {
                this.#queue.push({ request, resolve });
            }
        });
    }

    /**
     * Settle the currently active confirmation request.
     *
     * Resolves the associated promise with the given outcome, then surfaces the
     * next queued request (if any). No-op when there is no active request.
     *
     * @param outcome - `true` when the user confirmed, `false` when cancelled
     */
    settle(outcome: boolean): void {
        if (this.#active.value === null || this.#currentResolve === null) {
            return;
        }

        const resolve = this.#currentResolve;

        this.#active.value = null;
        this.#currentResolve = null;

        resolve(outcome);

        const next = this.#queue.shift();

        if (next !== undefined) {
            this.#surface(next);
        }
    }

    /**
     * Make an entry the active confirmation request.
     *
     * @param entry - the queued entry to surface
     */
    #surface(entry: PendingEntry): void {
        const id = `confirm-${++this.#sequence}`;

        this.#currentResolve = entry.resolve;
        this.#active.value = { ...entry.request, id };
    }
}
