/**
 * Users list query definition.
 *
 * Declares the users list's query capabilities once, in the vocabulary the
 * screen and its tests use: free-text search across the full name and email
 * columns, sorting by full name or creation date, and a 25-row page size.
 * No named filters yet - this list declares none.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { filter } from '@sinemacula/web-core/query/list-filter';
import { defineListQuery } from '@sinemacula/web-core/query/list-query-definition';

/**
 * The users list query definition, passed to `useListQuery` by
 * {@link useUsersList}.
 */
export const userList = defineListQuery({
    filters: {},
    search: filter.searchAcross(['full_name', 'email']),
    sortable: ['full_name', 'created_at'],
    defaultSort: { column: 'created_at', direction: 'desc' },
    pageSize: 25,
});
