/**
 * Unit tests for localeFormats.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';

import { localeFormats } from '@/locales/formats';

describe('localeFormats', () => {
    it('defines short and long datetime formats for en-US and fr-FR', () => {
        expect(localeFormats.datetime?.['en-US']).toEqual({
            short: { year: 'numeric', month: 'numeric', day: 'numeric' },
            long: {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
                hour: 'numeric',
                minute: 'numeric',
            },
        });
        expect(localeFormats.datetime?.['fr-FR']).toEqual({
            short: { year: 'numeric', month: 'numeric', day: 'numeric' },
            long: {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
                hour: 'numeric',
                minute: 'numeric',
            },
        });
    });

    it('defines a USD currency format for en-US and a EUR currency format for fr-FR', () => {
        expect(localeFormats.number?.['en-US']?.currency).toEqual({ style: 'currency', currency: 'USD' });
        expect(localeFormats.number?.['fr-FR']?.currency).toEqual({ style: 'currency', currency: 'EUR' });
    });

    it('defines decimal and percent formats for both locales', () => {
        expect(localeFormats.number?.['en-US']?.decimal).toEqual({ style: 'decimal' });
        expect(localeFormats.number?.['en-US']?.percent).toEqual({ style: 'percent' });
        expect(localeFormats.number?.['fr-FR']?.decimal).toEqual({ style: 'decimal' });
        expect(localeFormats.number?.['fr-FR']?.percent).toEqual({ style: 'percent' });
    });
});
