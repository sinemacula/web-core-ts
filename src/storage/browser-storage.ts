/**
 * Key-value storage adapter over the Web Storage API.
 *
 * Web Storage can throw (private browsing, quota, disabled storage); every
 * operation here is best-effort so a storage failure never takes the
 * application down.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { KeyValueStorage } from './key-value-storage';

/**
 * Persist values in a browser `Storage` area.
 */
export class BrowserStorage implements KeyValueStorage {
    readonly #storage: Storage;

    constructor(storage: Storage) {
        this.#storage = storage;
    }

    get(key: string): string | null {
        try {
            return this.#storage.getItem(key);
        } catch {
            return null;
        }
    }

    set(key: string, value: string): void {
        try {
            this.#storage.setItem(key, value);
        } catch {
            // Best-effort: storage may be unavailable or full.
        }
    }

    remove(key: string): void {
        try {
            this.#storage.removeItem(key);
        } catch {
            // Best-effort: storage may be unavailable.
        }
    }
}
