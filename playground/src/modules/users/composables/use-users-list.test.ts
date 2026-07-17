/**
 * Unit tests for useUsersList.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';

import { parseWireTimestamp, useUsersList } from '@/modules/users/composables/use-users-list';
import { initialiseApi, resetApi } from '@/services/api';
import { FakeHttpClient } from '@/test-support/fake-http-client';

/**
 * Build a `Record<string, unknown>` from an array of `[key, value]` pairs.
 *
 * Wraps `Object.fromEntries` so callers can write snake_case API field names as
 * plain string literals inside array elements rather than as object-literal
 * keys - keeping non-camelCase field names out of any position that Biome's
 * naming-convention or literal-keys rules inspect.
 *
 * @param entries - key-value pairs for the record
 * @returns a plain `Record<string, unknown>`
 */
function wire(entries: ReadonlyArray<readonly [string, unknown]>): Record<string, unknown> {
    return Object.fromEntries(entries);
}

/** A valid raw user row as returned by the API. */
function userRow(id: string, fullName: string): Record<string, unknown> {
    return wire([
        ['id', id],
        ['full_name', fullName],
        ['email', `${id}@example.com`],
        ['created_at', '2026-01-01 00:00:00'],
    ]);
}

/** Flushes pending microtasks so an in-flight fetch settles. */
async function flushAll(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 0));
}

describe('useUsersList', () => {
    let fake: FakeHttpClient;

    beforeEach(() => {
        fake = new FakeHttpClient();
        initialiseApi(fake);
    });

    afterEach(() => {
        resetApi();
    });

    describe('initial fetch', () => {
        it('renders the rows and meta from the initial fetch', async () => {
            fake.queueResponse({
                data: [userRow('u1', 'Alice Smith'), userRow('u2', 'Bob Jones')],
                meta: wire([
                    ['current_page', 1],
                    ['last_page', 1],
                    ['per_page', 25],
                    ['total', 2],
                ]),
            });

            const usersList = useUsersList();

            expect(usersList.isLoading.value).toBe(true);
            expect(usersList.hasLoaded.value).toBe(false);

            await flushAll();

            expect(usersList.hasLoaded.value).toBe(true);
            expect(usersList.rows.value).toHaveLength(2);
            expect(usersList.rows.value[0]?.fullName).toBe('Alice Smith');
            expect(usersList.meta.value).toEqual({ currentPage: 1, lastPage: 1, perPage: 25, total: 2 });
        });

        it('exposes an empty rows array and null meta before any fetch has resolved', () => {
            const usersList = useUsersList();

            expect(usersList.rows.value).toEqual([]);
            expect(usersList.meta.value).toBeNull();
        });
    });

    describe('search debounce', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('collapses two keystrokes within the debounce window into one query change', async () => {
            fake.queueResponse({ data: [] });
            fake.queueResponse({ data: [] });

            const usersList = useUsersList();

            await vi.advanceTimersByTimeAsync(0);
            expect(fake.calls).toHaveLength(1);

            usersList.searchInput.value = 'a';
            await vi.advanceTimersByTimeAsync(100);

            usersList.searchInput.value = 'ab';
            await vi.advanceTimersByTimeAsync(299);

            expect(usersList.searchTerm.value).toBe('');
            expect(fake.calls).toHaveLength(1);

            await vi.advanceTimersByTimeAsync(1);

            expect(usersList.searchTerm.value).toBe('ab');
            expect(fake.calls).toHaveLength(2);
        });

        it('clears a pending debounce timer when the enclosing effect scope stops', async () => {
            fake.queueResponse({ data: [] });

            const scope = effectScope();
            const usersList = scope.run(() => useUsersList());

            if (usersList === undefined) {
                throw new Error('useUsersList did not initialise inside the effect scope');
            }

            await vi.advanceTimersByTimeAsync(0);

            usersList.searchInput.value = 'zzz';
            await vi.advanceTimersByTimeAsync(0);

            scope.stop();

            await vi.advanceTimersByTimeAsync(350);

            expect(usersList.searchTerm.value).toBe('');
            expect(fake.calls).toHaveLength(1);
        });
    });

    describe('search', () => {
        it('commits a term immediately, bypassing the debounce', async () => {
            fake.queueResponse({ data: [] });

            const usersList = useUsersList();

            await flushAll();

            usersList.search('bob');

            expect(usersList.searchTerm.value).toBe('bob');
        });
    });

    describe('sortBy', () => {
        it('updates the active sort and resets the page to 1', async () => {
            fake.queueResponse({ data: [] });

            const usersList = useUsersList();

            await flushAll();

            usersList.next();
            expect(usersList.page.value).toBe(2);

            usersList.sortBy('full_name');

            expect(usersList.sort.value).toEqual({ column: 'full_name', direction: 'asc' });
            expect(usersList.page.value).toBe(1);
        });
    });

    describe('pagination', () => {
        it('advances unconditionally when no meta is present yet', () => {
            const usersList = useUsersList();

            usersList.next();

            expect(usersList.page.value).toBe(2);
        });

        it('advances to the next page when meta reports more pages remain', async () => {
            fake.queueResponse({
                data: [],
                meta: wire([
                    ['current_page', 1],
                    ['last_page', 2],
                    ['per_page', 25],
                    ['total', 30],
                ]),
            });

            const usersList = useUsersList();

            await flushAll();

            usersList.next();

            expect(usersList.page.value).toBe(2);
        });

        it('does not advance past the last page when meta indicates the end', async () => {
            fake.queueResponse({
                data: [],
                meta: wire([
                    ['current_page', 1],
                    ['last_page', 1],
                    ['per_page', 25],
                    ['total', 5],
                ]),
            });

            const usersList = useUsersList();

            await flushAll();

            usersList.next();

            expect(usersList.page.value).toBe(1);
        });

        it('clamps previous at page 1', async () => {
            fake.queueResponse({ data: [] });

            const usersList = useUsersList();

            await flushAll();

            usersList.previous();

            expect(usersList.page.value).toBe(1);
        });
    });

    describe('error handling', () => {
        it('surfaces a fetch failure as error and clears it on a successful refetch', async () => {
            fake.queueError(new Error('network down'));

            const usersList = useUsersList();

            await flushAll();

            expect(usersList.error.value).toBeInstanceOf(Error);
            expect(usersList.rows.value).toEqual([]);

            fake.queueResponse({ data: [userRow('u1', 'Alice Smith')] });

            await usersList.refetch();

            expect(usersList.error.value).toBeNull();
            expect(usersList.rows.value).toHaveLength(1);
        });
    });
});

describe('parseWireTimestamp', () => {
    it('parses a wire-format timestamp as a UTC instant', () => {
        const parsed = parseWireTimestamp('2026-01-01 00:00:00');

        expect(parsed.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });

    it('throws when the timestamp cannot be parsed', () => {
        expect(() => parseWireTimestamp('not-a-timestamp')).toThrow('not-a-timestamp');
    });
});
