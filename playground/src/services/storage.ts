/**
 * Application storage service.
 *
 * Holds the boot-time {@link KeyValueStorage} singleton. Production wires a
 * {@link BrowserStorage} over `window.localStorage`; tests wire a
 * {@link MemoryStorage}.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { KeyValueStorage } from '@sinemacula/web-core/storage/key-value-storage';

let storage: KeyValueStorage | null = null;

/**
 * Install the storage adapter. Called once by the application bootstrap.
 *
 * @param adapter - the storage adapter to install
 */
export function initialiseStorage(adapter: KeyValueStorage): void {
    storage = adapter;
}

/**
 * The active storage adapter.
 *
 * @returns the active storage adapter
 * @throws Error when accessed before {@link initialiseStorage} has
 *   been called
 */
export function appStorage(): KeyValueStorage {
    if (storage === null) {
        throw new Error('Storage was accessed before initialisation. Call initialiseStorage() first.');
    }

    return storage;
}

/**
 * Discard the storage singleton. Test use only.
 */
export function resetStorage(): void {
    storage = null;
}
