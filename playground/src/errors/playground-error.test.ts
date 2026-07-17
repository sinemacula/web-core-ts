/**
 * Unit tests for PlaygroundError.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';

import { PlaygroundError } from '@/errors/playground-error';

describe('PlaygroundError', () => {
    it('sets the name property to PlaygroundError', () => {
        const error = new PlaygroundError('boom');

        expect(error.name).toBe('PlaygroundError');
    });

    it('sets the message from the first argument', () => {
        const error = new PlaygroundError('boom');

        expect(error.message).toBe('boom');
    });

    it('is an instance of Error', () => {
        const error = new PlaygroundError('boom');

        expect(error).toBeInstanceOf(Error);
    });

    it('is an instance of PlaygroundError', () => {
        const error = new PlaygroundError('boom');

        expect(error).toBeInstanceOf(PlaygroundError);
    });

    it('stores the cause when options are provided', () => {
        const cause = new Error('root cause');
        const error = new PlaygroundError('wrapped', { cause });

        expect(error.cause).toBe(cause);
    });
});
