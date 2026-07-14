/**
 * Unit tests for AuthApi.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuthApi } from '@/modules/auth/services/auth-api';
import { initialiseApi, resetApi } from '@/services/api';
import { FakeHttpClient } from '@/test-support/fake-http-client';

/**
 * Build a `Record<string, unknown>` from an array of `[key, value]` pairs.
 *
 * Wraps `Object.fromEntries` so callers can write snake_case API field names
 * as plain string literals inside array elements rather than as object-literal
 * keys - keeping non-camelCase field names out of any position that Biome's
 * naming-convention or literal-keys rules inspect.
 *
 * @param entries - key-value pairs for the record
 * @returns a plain `Record<string, unknown>`
 */
function wire(entries: ReadonlyArray<readonly [string, unknown]>): Record<string, unknown> {
    return Object.fromEntries(entries);
}

/** A valid session envelope as returned by the API. */
function sessionEnvelope(): Record<string, unknown> {
    return {
        data: wire([
            ['token', 'tok-abc'],
            ['refresh_token', 'ref-abc'],
            ['expires_at', '2026-12-31 23:59:59'],
        ]),
    };
}

/** A valid user envelope as returned by the API. */
function userEnvelope(permissions?: unknown): Record<string, unknown> {
    const entries: Array<readonly [string, unknown]> = [
        ['id', 'u1'],
        ['first_name', 'Alice'],
        ['last_name', 'Smith'],
        ['full_name', 'Alice Smith'],
        ['email', 'alice@example.com'],
    ];

    if (permissions !== undefined) {
        entries.push(['permissions', permissions]);
    }

    return { data: wire(entries) };
}

describe('AuthApi', () => {
    let fake: FakeHttpClient;
    let authApi: AuthApi;

    beforeEach(() => {
        fake = new FakeHttpClient();
        initialiseApi(fake);
        authApi = new AuthApi(fake);
    });

    afterEach(() => {
        resetApi();
    });

    describe('login', () => {
        it('maps a valid response onto AuthenticatedSession', async () => {
            fake.queueResponse(sessionEnvelope());

            const session = await authApi.login({
                email: 'alice@example.com',
                password: 'secret',
                uuid: 'device-uuid',
                os: 'WEB',
            });

            expect(session.accessToken).toBe('tok-abc');
            expect(session.refreshToken).toBe('ref-abc');
            expect(session.expiresAt).toBe('2026-12-31 23:59:59');
        });

        it('posts to auth with the supplied credentials and device fields', async () => {
            fake.queueResponse(sessionEnvelope());

            await authApi.login({
                email: 'alice@example.com',
                password: 'secret',
                uuid: 'device-uuid',
                os: 'WEB',
            });

            const call = fake.calls.at(0);

            expect(call?.method).toBe('POST');
            expect(call?.path).toBe('auth');
            expect((call?.body as Record<string, unknown>).email).toBe('alice@example.com');
            expect((call?.body as Record<string, unknown>).uuid).toBe('device-uuid');
            expect((call?.body as Record<string, unknown>).os).toBe('WEB');
        });

        it('throws when the response has no data envelope', async () => {
            fake.queueResponse('not-a-record');

            await expect(authApi.login({ email: 'a@b.com', password: 'p', uuid: 'u', os: 'WEB' })).rejects.toThrow(
                'The response did not match the expected envelope shape.',
            );
        });

        it('throws when data.token is missing', async () => {
            fake.queueResponse({
                data: wire([
                    ['refresh_token', 'r'],
                    ['expires_at', '2026-01-01 00:00:00'],
                ]),
            });

            await expect(authApi.login({ email: 'a@b.com', password: 'p', uuid: 'u', os: 'WEB' })).rejects.toThrow(
                'The session response did not match the expected shape.',
            );
        });

        it('throws when data.refresh_token is missing', async () => {
            fake.queueResponse({
                data: wire([
                    ['token', 't'],
                    ['expires_at', '2026-01-01 00:00:00'],
                ]),
            });

            await expect(authApi.login({ email: 'a@b.com', password: 'p', uuid: 'u', os: 'WEB' })).rejects.toThrow(
                'The session response did not match the expected shape.',
            );
        });

        it('throws when data.expires_at is missing', async () => {
            fake.queueResponse({
                data: wire([
                    ['token', 't'],
                    ['refresh_token', 'r'],
                ]),
            });

            await expect(authApi.login({ email: 'a@b.com', password: 'p', uuid: 'u', os: 'WEB' })).rejects.toThrow(
                'The session response did not match the expected shape.',
            );
        });
    });

    describe('refresh', () => {
        it('maps a valid response onto AuthenticatedSession', async () => {
            fake.queueResponse(sessionEnvelope());

            const session = await authApi.refresh('my-refresh-token');

            expect(session.accessToken).toBe('tok-abc');
            expect(session.refreshToken).toBe('ref-abc');
            expect(session.expiresAt).toBe('2026-12-31 23:59:59');
        });

        it('patches auth with the refresh token', async () => {
            fake.queueResponse(sessionEnvelope());

            await authApi.refresh('my-refresh-token');

            const call = fake.calls.at(0);
            const body = call?.body as Record<string, unknown> | undefined;

            expect(call?.method).toBe('PATCH');
            expect(call?.path).toBe('auth');
            expect(body?.refresh_token).toBe('my-refresh-token');
        });

        it('throws when the response envelope is malformed', async () => {
            fake.queueResponse(null);

            await expect(authApi.refresh('tok')).rejects.toThrow(
                'The response did not match the expected envelope shape.',
            );
        });
    });

    describe('logout', () => {
        it('deletes auth', async () => {
            await authApi.logout();

            const call = fake.calls.at(0);

            expect(call?.method).toBe('DELETE');
            expect(call?.path).toBe('auth');
        });
    });

    describe('getCurrentUser', () => {
        it('maps a valid response onto AuthenticatedUser', async () => {
            fake.queueResponse(userEnvelope());

            const user = await authApi.getCurrentUser();

            expect(user.id).toBe('u1');
            expect(user.firstName).toBe('Alice');
            expect(user.lastName).toBe('Smith');
            expect(user.fullName).toBe('Alice Smith');
            expect(user.email).toBe('alice@example.com');
        });

        it('maps the permissions array when present', async () => {
            fake.queueResponse(userEnvelope(['users.view', 'billing.view']));

            const user = await authApi.getCurrentUser();

            expect(user.permissions).toEqual(['users.view', 'billing.view']);
        });

        it('filters out non-string entries from a mixed-type permissions array', async () => {
            fake.queueResponse(userEnvelope(['users.view', 42, null, 'billing.view']));

            const user = await authApi.getCurrentUser();

            expect(user.permissions).toEqual(['users.view', 'billing.view']);
        });

        it('maps permissions to an empty array when the field is absent', async () => {
            fake.queueResponse(userEnvelope());

            const user = await authApi.getCurrentUser();

            expect(user.permissions).toEqual([]);
        });

        it('maps permissions to an empty array when the field is not an array', async () => {
            fake.queueResponse(userEnvelope('not-an-array'));

            const user = await authApi.getCurrentUser();

            expect(user.permissions).toEqual([]);
        });

        it('gets users/self', async () => {
            fake.queueResponse(userEnvelope());

            await authApi.getCurrentUser();

            const call = fake.calls.at(0);

            expect(call?.method).toBe('GET');
            expect(call?.path).toBe('users/self');
        });

        it('throws when the response has no data envelope', async () => {
            fake.queueResponse('bad');

            await expect(authApi.getCurrentUser()).rejects.toThrow(
                'The response did not match the expected envelope shape.',
            );
        });

        it('throws when user fields are missing', async () => {
            fake.queueResponse({ data: wire([['id', 'u1']]) });

            await expect(authApi.getCurrentUser()).rejects.toThrow(
                'The user response did not match the expected shape.',
            );
        });

        it('throws when user.first_name is not a string', async () => {
            fake.queueResponse({
                data: wire([
                    ['id', 'u1'],
                    ['first_name', 42],
                    ['last_name', 'Smith'],
                    ['full_name', 'Alice Smith'],
                    ['email', 'alice@example.com'],
                ]),
            });

            await expect(authApi.getCurrentUser()).rejects.toThrow(
                'The user response did not match the expected shape.',
            );
        });
    });
});
