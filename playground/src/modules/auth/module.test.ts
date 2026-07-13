/**
 * Unit tests for authModule.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { MemoryStorage } from '@sinemacula/web-core/storage/memory-storage';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Direct locale import ensures the data file is covered
import enUs from '@/modules/auth/locales/en-us';
import frFr from '@/modules/auth/locales/fr-fr';
import { authModule } from '@/modules/auth/module';
import { initialiseApi, resetApi } from '@/services/api';
import { initialiseStorage, resetStorage } from '@/services/storage';
import { FakeHttpClient } from '@/test-support/fake-http-client';

describe('authModule', () => {
    beforeEach(() => {
        initialiseStorage(new MemoryStorage());
        initialiseApi(new FakeHttpClient());
        setActivePinia(createPinia());
    });

    afterEach(() => {
        resetApi();
        resetStorage();
    });

    it('has the name auth', () => {
        expect(authModule.name).toBe('auth');
    });

    it('wires the auth routes', () => {
        expect(authModule.routes).toHaveLength(1);
    });

    it('loads en-US locale messages', async () => {
        const messages = await authModule.locales?.('en-US');

        expect(messages).not.toBeNull();
        expect(messages).toEqual(enUs);
    });

    it('loads fr-FR locale messages', async () => {
        const messages = await authModule.locales?.('fr-FR');

        expect(messages).not.toBeNull();
        expect(messages).toEqual(frFr);
    });

    it('returns null for an unsupported locale', async () => {
        const messages = await authModule.locales?.('xx-XX');

        expect(messages).toBeNull();
    });
});
