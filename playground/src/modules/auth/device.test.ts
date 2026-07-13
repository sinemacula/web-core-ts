/**
 * Unit tests for the device fingerprint helper.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { MemoryStorage } from '@sinemacula/web-core/storage/memory-storage';
import { describe, expect, it } from 'vitest';

import { DEVICE_UUID_STORAGE_KEY, deviceFingerprint } from '@/modules/auth/device';

describe('deviceFingerprint', () => {
    it('generates a uuid and stores it on first call', () => {
        const storage = new MemoryStorage();
        const generateUuid = () => 'test-uuid-1234';

        const fp = deviceFingerprint(storage, generateUuid);

        expect(fp.uuid).toBe('test-uuid-1234');
        expect(fp.os).toBe('WEB');
        expect(storage.get(DEVICE_UUID_STORAGE_KEY)).toBe('test-uuid-1234');
    });

    it('reuses the stored uuid on subsequent calls', () => {
        const storage = new MemoryStorage();
        let callCount = 0;
        const generateUuid = () => {
            callCount++;

            return `uuid-${callCount}`;
        };

        const first = deviceFingerprint(storage, generateUuid);
        const second = deviceFingerprint(storage, generateUuid);

        expect(first.uuid).toBe('uuid-1');
        expect(second.uuid).toBe('uuid-1');
        expect(callCount).toBe(1);
    });

    it('reuses a uuid that was seeded into storage before the first call', () => {
        const storage = new MemoryStorage();

        storage.set(DEVICE_UUID_STORAGE_KEY, 'pre-seeded-uuid');

        const generateUuid = () => 'should-not-be-called';
        const fp = deviceFingerprint(storage, generateUuid);

        expect(fp.uuid).toBe('pre-seeded-uuid');
    });

    it('always returns os as WEB', () => {
        const storage = new MemoryStorage();
        const fp = deviceFingerprint(storage, () => 'any-uuid');

        expect(fp.os).toBe('WEB');
    });
});
