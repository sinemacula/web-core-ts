/**
 * Unit tests for the storage service.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { MemoryStorage } from '@sinemacula/web-core/storage/memory-storage';
import { afterEach, describe, expect, it } from 'vitest';

import { appStorage, initialiseStorage, resetStorage } from '@/services/storage';

describe('storage service', () => {
    afterEach(() => {
        resetStorage();
    });

    it('returns the installed adapter after initialisation', () => {
        const adapter = new MemoryStorage();

        initialiseStorage(adapter);

        expect(appStorage()).toBe(adapter);
    });

    it('throws before initialisation when appStorage() is called', () => {
        expect(() => appStorage()).toThrow('Storage was accessed before initialisation');
    });

    it('throws again after resetStorage() clears the singleton', () => {
        const adapter = new MemoryStorage();

        initialiseStorage(adapter);
        resetStorage();

        expect(() => appStorage()).toThrow('Storage was accessed before initialisation');
    });
});
