/**
 * Auth API gateway.
 *
 * The module's single point of contact with the auth endpoints. Responses
 * are validated and mapped at this boundary, so the rest of the module works
 * with camel-cased domain types and never touches raw payloads.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { HttpClient } from '@sinemacula/web-core/http/http-client';
import { isRecord } from '@sinemacula/web-core/support/is-record';

import type { DeviceFingerprint } from '@/modules/auth/device';

/**
 * Credentials submitted by the user on the login form.
 */
export interface LoginCredentials {
    readonly email: string;
    readonly password: string;
}

/**
 * The full login payload: form credentials plus device fingerprint.
 */
export type LoginInput = LoginCredentials & DeviceFingerprint;

/**
 * The session returned by login and refresh endpoints.
 */
export interface AuthenticatedSession {
    readonly accessToken: string;
    readonly refreshToken: string;
    readonly expiresAt: string;
}

/**
 * The authenticated user record returned by GET users/self.
 */
export interface AuthenticatedUser {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly fullName: string;
    readonly email: string;
    readonly permissions: readonly string[];
}

/**
 * Typed access to the auth endpoints.
 */
export class AuthApi {
    readonly #client: HttpClient;

    /**
     * @param client - the HTTP client used to reach the auth endpoints
     */
    constructor(client: HttpClient) {
        this.#client = client;
    }

    /**
     * Exchange credentials and device fingerprint for a session.
     *
     * @param input - the login input (credentials + device fingerprint)
     * @returns the authenticated session
     * @throws Error when the server response does not match the expected shape
     */
    async login(input: LoginInput): Promise<AuthenticatedSession> {
        const body = wire([
            ['email', input.email],
            ['password', input.password],
            ['uuid', input.uuid],
            ['os', input.os],
        ]);

        const raw = await this.#client.post<unknown>('auth', body);

        return mapSessionPayload(raw);
    }

    /**
     * Exchange a refresh token for a new session.
     *
     * Sends `retryOnUnauthorized: false` so a failed refresh cannot recurse,
     * and `notifyOnError: false` because a failed background refresh surfaces
     * through the session-loss redirect, not a generic error toast.
     *
     * @param refreshToken - the refresh token from the current session
     * @returns the new authenticated session
     * @throws Error when the server response does not match the expected shape
     */
    async refresh(refreshToken: string): Promise<AuthenticatedSession> {
        const body = wire([['refresh_token', refreshToken]]);
        const raw = await this.#client.patch<unknown>('auth', body, { notifyOnError: false, retryOnUnauthorized: false });

        return mapSessionPayload(raw);
    }

    /**
     * Invalidate the current session server-side.
     */
    async logout(): Promise<void> {
        await this.#client.delete('auth');
    }

    /**
     * Fetch the authenticated user record.
     *
     * @returns the authenticated user
     * @throws Error when the server response does not match the expected shape
     */
    async getCurrentUser(): Promise<AuthenticatedUser> {
        const raw = await this.#client.get<unknown>('users/self');

        return mapUserPayload(raw);
    }
}

/**
 * Build a `Record<string, unknown>` from an array of `[key, value]` pairs.
 *
 * Keeps snake_case wire-field names out of object-literal key positions so
 * Biome's naming-convention rule never sees them.
 *
 * @param entries - key-value pairs for the record
 * @returns a plain `Record<string, unknown>`
 */
function wire(entries: ReadonlyArray<readonly [string, unknown]>): Record<string, unknown> {
    return Object.fromEntries(entries);
}

/**
 * Unwrap the `{ data: {...} }` envelope from a server response.
 *
 * @param payload - the raw response payload
 * @returns the unwrapped data record
 * @throws Error when the envelope is absent or malformed
 */
function unwrapData(payload: unknown): Record<string, unknown> {
    if (!isRecord(payload) || !isRecord(payload.data)) {
        throw new Error('The response did not match the expected envelope shape.');
    }

    return payload.data;
}

/**
 * Validate and map a raw session envelope onto the domain type.
 *
 * @param payload - the raw response payload
 * @returns the mapped session
 * @throws Error when the payload does not match the expected shape
 */
function mapSessionPayload(payload: unknown): AuthenticatedSession {
    const data = unwrapData(payload);
    const token = data.token;
    const refreshToken = data.refresh_token;
    const expiresAt = data.expires_at;

    if (typeof token !== 'string' || typeof refreshToken !== 'string' || typeof expiresAt !== 'string') {
        throw new Error('The session response did not match the expected shape.');
    }

    return { accessToken: token, refreshToken, expiresAt };
}

/**
 * Validate and map a raw user envelope onto the domain type.
 *
 * @param payload - the raw response payload
 * @returns the mapped user
 * @throws Error when the payload does not match the expected shape
 */
function mapUserPayload(payload: unknown): AuthenticatedUser {
    const data = unwrapData(payload);

    if (
        typeof data.id !== 'string' ||
        typeof data.first_name !== 'string' ||
        typeof data.last_name !== 'string' ||
        typeof data.full_name !== 'string' ||
        typeof data.email !== 'string'
    ) {
        throw new Error('The user response did not match the expected shape.');
    }

    return {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        fullName: data.full_name,
        email: data.email,
        permissions: mapPermissions(data.permissions),
    };
}

/**
 * Extract the flat permission-string list from the raw user payload.
 *
 * This is the adaptation point: APIs that nest permissions differently (e.g.
 * under memberships or roles) adjust the mapping here so the rest of the app
 * only ever sees a flat list of permission strings.
 *
 * @param value - the raw `permissions` field from the user payload
 * @returns the string entries of `value` when it is an array, otherwise an
 *   empty array
 */
function mapPermissions(value: unknown): readonly string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((entry): entry is string => typeof entry === 'string');
}
