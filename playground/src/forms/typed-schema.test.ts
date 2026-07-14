/**
 * Unit tests for zodToTypedSchema.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import { zodToTypedSchema } from '@/forms/typed-schema';

describe('zodToTypedSchema', () => {
    it('returns the parsed value with no errors when validation succeeds', async () => {
        const schema = z.object({ name: z.string() });
        const typed = zodToTypedSchema(schema);

        const result = await typed.parse({ name: 'Alice' });

        expect(result.value).toStrictEqual({ name: 'Alice' });
        expect(result.errors).toStrictEqual([]);
    });

    it('maps a field issue onto its dotted path', async () => {
        const schema = z.object({ email: z.string().min(1, 'required') });
        const typed = zodToTypedSchema(schema);

        const result = await typed.parse({ email: '' });

        expect(result.errors).toStrictEqual([{ path: 'email', errors: ['required'] }]);
    });

    it('maps root-level issues without a field path', async () => {
        const schema = z.object({ name: z.string() }).refine(() => false, 'form-level issue');
        const typed = zodToTypedSchema(schema);

        const result = await typed.parse({ name: 'x' });

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.errors).toStrictEqual(['form-level issue']);
        expect(result.errors[0]?.path).toBeUndefined();
    });

    it('keeps only the first issue per dotted path when a field fails multiple checks', async () => {
        const schema = z.object({
            password: z.string().min(8, 'tooShort').regex(/[0-9]/, 'needsDigit'),
        });
        const typed = zodToTypedSchema(schema);

        const result = await typed.parse({ password: 'abc' });

        expect(result.errors).toStrictEqual([{ path: 'password', errors: ['tooShort'] }]);
    });
});
