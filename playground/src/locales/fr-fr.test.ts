/**
 * Unit tests for fr-fr locale messages.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';

import messages from '@/locales/fr-fr';

describe('fr-fr locale messages', () => {
    it('exports a default object', () => {
        expect(messages).toBeDefined();
        expect(typeof messages).toBe('object');
    });

    it('contains common.actions keys as non-empty strings', () => {
        const common = (messages as Record<string, unknown>)['common'] as Record<string, unknown>;
        const actions = common['actions'] as Record<string, unknown>;

        expect(typeof actions['cancel']).toBe('string');
        expect(typeof actions['confirm']).toBe('string');
        expect(typeof actions['save']).toBe('string');
        expect(typeof actions['signOut']).toBe('string');
    });

    it('contains common.states keys as non-empty strings', () => {
        const common = (messages as Record<string, unknown>)['common'] as Record<string, unknown>;
        const states = common['states'] as Record<string, unknown>;

        expect(typeof states['empty']).toBe('string');
        expect(typeof states['error']).toBe('string');
        expect(typeof states['loading']).toBe('string');
    });
});
