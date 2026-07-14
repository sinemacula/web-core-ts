/**
 * Unit tests for errorsModule.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';

// Direct locale import ensures the data file is covered
import enUs from '@/modules/errors/locales/en-us';
import frFr from '@/modules/errors/locales/fr-fr';
import { errorsModule } from '@/modules/errors/module';

describe('errorsModule', () => {
    it('has the name errors', () => {
        expect(errorsModule.name).toBe('errors');
    });

    it('wires the errors routes', () => {
        expect(errorsModule.routes).toHaveLength(2);
    });

    it('loads en-US locale messages', async () => {
        const messages = await errorsModule.locales?.('en-US');

        expect(messages).not.toBeNull();
        expect(messages).toEqual(enUs);
    });

    it('loads fr-FR locale messages', async () => {
        const messages = await errorsModule.locales?.('fr-FR');

        expect(messages).not.toBeNull();
        expect(messages).toEqual(frFr);
    });

    it('returns null for an unsupported locale', async () => {
        const messages = await errorsModule.locales?.('xx-XX');

        expect(messages).toBeNull();
    });
});
