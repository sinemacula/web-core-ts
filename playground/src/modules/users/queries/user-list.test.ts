/**
 * Unit tests for the userList query definition.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { useListQuery } from '@sinemacula/web-core/query/use-list-query';
import { describe, expect, it } from 'vitest';

import { userList } from '@/modules/users/queries/user-list';

/**
 * Build a `Record<string, unknown>` from an array of `[key, value]` pairs.
 *
 * Wraps `Object.fromEntries` so callers can write snake_case API field names
 * as plain string literals inside array elements rather than as object-literal
 * keys - keeping non-camelCase field names out of any position that Biome's
 * naming-convention rule inspects.
 *
 * @param entries - key-value pairs for the record
 * @returns a plain `Record<string, unknown>`
 */
function wire(entries: ReadonlyArray<readonly [string, unknown]>): Record<string, unknown> {
    return Object.fromEntries(entries);
}

describe('userList', () => {
    it('declares no named filters', () => {
        expect(userList.filters).toEqual({});
    });

    it('searches across full_name and email', () => {
        const { parameters, search } = useListQuery(userList);

        search('alice');

        const filters = JSON.parse(String(parameters.value.filters));

        expect(filters).toEqual(
            wire([
                [
                    '$or',
                    wire([
                        ['full_name', wire([['$like', 'alice']])],
                        ['email', wire([['$like', 'alice']])],
                    ]),
                ],
            ]),
        );
    });

    it('sorts by full_name and created_at only', () => {
        expect(userList.sortable).toEqual(['full_name', 'created_at']);
    });

    it('defaults to sorting by created_at descending', () => {
        expect(userList.defaultSort).toEqual({ column: 'created_at', direction: 'desc' });
    });

    it('defaults to a page size of 25', () => {
        expect(userList.pageSize).toBe(25);
    });

    it('is frozen', () => {
        expect(Object.isFrozen(userList)).toBe(true);
    });
});
