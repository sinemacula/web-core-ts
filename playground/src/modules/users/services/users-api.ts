/**
 * Users API gateway.
 *
 * Scopes the kernel `ResourceClient` to the `users` endpoint: envelope
 * unwrapping, pagination-meta mapping and query merging all live in the
 * kernel already, so this file only supplies the two things specific to this
 * resource - the domain shape and the wire-record validator.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { HttpClient } from '@sinemacula/web-core/http/http-client';
import type { RawRecord, ResourceMapper } from '@sinemacula/web-core/query/envelope';
import { ResourceClient } from '@sinemacula/web-core/query/resource-client';

import { PlaygroundError } from '@/errors/playground-error';

/**
 * A row in the users list.
 */
export interface UserListItem {
    readonly id: string;
    readonly fullName: string;
    readonly email: string;
    readonly createdAt: string;
}

/**
 * Validate and map a raw wire record onto a {@link UserListItem}.
 *
 * @param raw - the raw wire record
 * @returns the mapped user row
 * @throws PlaygroundError when a required field is missing or of the wrong type
 */
export const mapUserRow: ResourceMapper<UserListItem> = (raw: RawRecord): UserListItem => {
    if (
        typeof raw.id !== 'string' ||
        typeof raw.full_name !== 'string' ||
        typeof raw.email !== 'string' ||
        typeof raw.created_at !== 'string'
    ) {
        throw new PlaygroundError('The user row did not match the expected shape.');
    }

    return {
        id: raw.id,
        fullName: raw.full_name,
        email: raw.email,
        createdAt: raw.created_at,
    };
};

/**
 * Build a {@link ResourceClient} scoped to the `users` endpoint.
 *
 * @param client - the HTTP client to reach the API with
 * @returns a typed resource client for user list rows
 */
export function createUsersClient(client: HttpClient): ResourceClient<UserListItem> {
    return new ResourceClient({ client, path: 'users', map: mapUserRow });
}
