/**
 * Device fingerprint helper.
 *
 * Generates and persists a stable per-device UUID so the auth API can
 * track sessions across reloads. The uuid is written to storage on first
 * call and reused on every subsequent call.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { KeyValueStorage } from '@sinemacula/web-core/storage/key-value-storage';

/**
 * Storage key under which the device UUID is persisted.
 */
export const DEVICE_UUID_STORAGE_KEY = 'auth.device_uuid';

/**
 * The device fingerprint submitted with every login request.
 */
export interface DeviceFingerprint {
    readonly uuid: string;
    readonly os: 'WEB';
}

/**
 * Return the stable device fingerprint for this browser.
 *
 * On first call a UUID is generated and stored; subsequent calls reuse the
 * stored value so the same device always presents the same fingerprint.
 *
 * @param storage - the key-value store used to persist the uuid
 * @param generateUuid - uuid factory; defaults to `crypto.randomUUID()`
 * @returns the device fingerprint
 */
export function deviceFingerprint(
    storage: KeyValueStorage,
    generateUuid: () => string = () => crypto.randomUUID(),
): DeviceFingerprint {
    const existing = storage.get(DEVICE_UUID_STORAGE_KEY);

    if (existing !== null) {
        return { uuid: existing, os: 'WEB' };
    }

    const uuid = generateUuid();

    storage.set(DEVICE_UUID_STORAGE_KEY, uuid);

    return { uuid, os: 'WEB' };
}
