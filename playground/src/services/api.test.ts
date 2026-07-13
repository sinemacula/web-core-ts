/**
 * Unit tests for the API service.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { afterEach, describe, expect, it } from 'vitest';

import { api, initialiseApi, resetApi } from '@/services/api';
import { FakeHttpClient } from '@/test-support/fake-http-client';

describe('api service', () => {
    afterEach(() => {
        resetApi();
    });

    it('returns the installed client after initialisation', () => {
        const client = new FakeHttpClient();

        initialiseApi(client);

        expect(api()).toBe(client);
    });

    it('throws before initialisation when api() is called', () => {
        expect(() => api()).toThrow('The API client was accessed before initialisation');
    });

    it('throws again after resetApi() clears the singleton', () => {
        const client = new FakeHttpClient();

        initialiseApi(client);
        resetApi();

        expect(() => api()).toThrow('The API client was accessed before initialisation');
    });
});
