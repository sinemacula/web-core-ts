/**
 * Unit tests for dashboardModule.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { MemoryStorage } from '@sinemacula/web-core/storage/memory-storage';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Direct locale import ensures the data file is covered
import enUs from '@/modules/dashboard/locales/en-us';
import frFr from '@/modules/dashboard/locales/fr-fr';
import { dashboardModule } from '@/modules/dashboard/module';
import { initialiseApi, resetApi } from '@/services/api';
import { initialiseStorage, resetStorage } from '@/services/storage';
import { FakeHttpClient } from '@/test-support/fake-http-client';

describe('dashboardModule', () => {
    beforeEach(() => {
        initialiseStorage(new MemoryStorage());
        initialiseApi(new FakeHttpClient());
        setActivePinia(createPinia());
    });

    afterEach(() => {
        resetApi();
        resetStorage();
    });

    it('has the name dashboard', () => {
        expect(dashboardModule.name).toBe('dashboard');
    });

    it('wires the dashboard routes', () => {
        expect(dashboardModule.routes).toHaveLength(1);
    });

    it('loads en-US locale messages', async () => {
        const messages = await dashboardModule.locales?.('en-US');

        expect(messages).not.toBeNull();
        expect(messages).toEqual(enUs);
    });

    it('loads fr-FR locale messages', async () => {
        const messages = await dashboardModule.locales?.('fr-FR');

        expect(messages).not.toBeNull();
        expect(messages).toEqual(frFr);
    });

    it('returns null for an unsupported locale', async () => {
        const messages = await dashboardModule.locales?.('xx-XX');

        expect(messages).toBeNull();
    });
});
