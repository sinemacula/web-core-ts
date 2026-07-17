/**
 * Unit tests for browser-storage.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';

import { BrowserStorage } from './browser-storage';

function makeStorage(initial: Record<string, string> = {}): Storage {
    const map = new Map<string, string>(Object.entries(initial));

    return {
        get length() {
            return map.size;
        },
        key(index: number): string | null {
            return [...map.keys()][index] ?? null;
        },
        getItem(key: string): string | null {
            return map.get(key) ?? null;
        },
        setItem(key: string, value: string): void {
            map.set(key, value);
        },
        removeItem(key: string): void {
            map.delete(key);
        },
        clear(): void {
            map.clear();
        },
    } as unknown as Storage;
}

function makeThrowingStorage(): Storage {
    return {
        get length() {
            return 0;
        },
        key(): string | null {
            return null;
        },
        getItem(): string | null {
            throw new Error('storage unavailable');
        },
        setItem(): void {
            throw new Error('storage unavailable');
        },
        removeItem(): void {
            throw new Error('storage unavailable');
        },
        clear(): void {
            throw new Error('storage unavailable');
        },
    } as unknown as Storage;
}

describe('BrowserStorage', () => {
    describe('get', () => {
        it('returns the stored value for an existing key', () => {
            const storage = new BrowserStorage(makeStorage({ myKey: 'myValue' }));

            expect(storage.get('myKey')).toBe('myValue');
        });

        it('returns null for a missing key', () => {
            const storage = new BrowserStorage(makeStorage());

            expect(storage.get('absent')).toBeNull();
        });

        it('returns null when the underlying storage throws', () => {
            const storage = new BrowserStorage(makeThrowingStorage());

            expect(storage.get('any')).toBeNull();
        });
    });

    describe('set', () => {
        it('stores the value so it can be retrieved', () => {
            const native = makeStorage();
            const storage = new BrowserStorage(native);

            storage.set('k', 'v');

            expect(storage.get('k')).toBe('v');
        });

        it('does not throw when the underlying storage throws', () => {
            const storage = new BrowserStorage(makeThrowingStorage());

            expect(() => storage.set('k', 'v')).not.toThrow();
        });
    });

    describe('remove', () => {
        it('removes an existing key so get returns null afterwards', () => {
            const native = makeStorage({ x: 'y' });
            const storage = new BrowserStorage(native);

            storage.remove('x');

            expect(storage.get('x')).toBeNull();
        });

        it('does not throw when the underlying storage throws', () => {
            const storage = new BrowserStorage(makeThrowingStorage());

            expect(() => storage.remove('x')).not.toThrow();
        });
    });
});
