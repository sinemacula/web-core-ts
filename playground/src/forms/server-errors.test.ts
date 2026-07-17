/**
 * Unit tests for applyServerValidationErrors.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { HttpError, HttpValidationError } from '@sinemacula/web-core/http/http-error';
import { describe, expect, it, vi } from 'vitest';

import { applyServerValidationErrors } from '@/forms/server-errors';

describe('applyServerValidationErrors', () => {
    it('maps the first message per field and applies it in a single call', () => {
        const setErrors = vi.fn();
        const error = new HttpValidationError(
            422,
            'Unprocessable',
            {},
            {
                email: ['The email has already been taken.', 'The email is invalid.'],
                password: ['The password is too short.'],
            },
        );

        const result = applyServerValidationErrors(error, setErrors);

        expect(result).toBe(true);
        expect(setErrors).toHaveBeenCalledTimes(1);
        expect(setErrors).toHaveBeenCalledWith({
            email: 'The email has already been taken.',
            password: 'The password is too short.',
        });
    });

    it('skips fields whose message array is empty', () => {
        const setErrors = vi.fn();
        const error = new HttpValidationError(
            422,
            'Unprocessable',
            {},
            {
                email: ['The email has already been taken.'],
                password: [],
            },
        );

        const result = applyServerValidationErrors(error, setErrors);

        expect(result).toBe(true);
        expect(setErrors).toHaveBeenCalledWith({ email: 'The email has already been taken.' });
    });

    it('returns false without applying anything when the errors map is empty', () => {
        const setErrors = vi.fn();
        const error = new HttpValidationError(422, 'Unprocessable', {}, {});

        const result = applyServerValidationErrors(error, setErrors);

        expect(result).toBe(false);
        expect(setErrors).not.toHaveBeenCalled();
    });

    it('returns false without applying anything when every field has an empty message array', () => {
        const setErrors = vi.fn();
        const error = new HttpValidationError(422, 'Unprocessable', {}, { email: [] });

        const result = applyServerValidationErrors(error, setErrors);

        expect(result).toBe(false);
        expect(setErrors).not.toHaveBeenCalled();
    });

    it('returns false for a non-HttpValidationError failure', () => {
        const setErrors = vi.fn();

        const result = applyServerValidationErrors(new Error('unexpected'), setErrors);

        expect(result).toBe(false);
        expect(setErrors).not.toHaveBeenCalled();
    });

    it('returns false for an HttpError with a 422 status that is not the validation subclass', () => {
        const setErrors = vi.fn();

        const result = applyServerValidationErrors(new HttpError(422, 'Unprocessable'), setErrors);

        expect(result).toBe(false);
        expect(setErrors).not.toHaveBeenCalled();
    });
});
