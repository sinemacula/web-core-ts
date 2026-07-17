/**
 * Zod-to-vee-validate schema bridge.
 *
 * vee-validate 4.15 does not implement the Standard Schema contract, so a zod
 * object schema cannot be handed to `useForm`'s `validationSchema` option
 * directly. This module is the minimal inline adapter that bridges a zod object
 * schema to vee-validate's `TypedSchema` contract, so every form composable in
 * the app validates against zod without a third-party bridge package.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { TypedSchema, TypedSchemaError } from 'vee-validate';
import type * as z from 'zod';

/**
 * Wrap a zod 4 object schema in the `TypedSchema` contract expected by
 * vee-validate 4. Runs validation via `safeParse`; the first issue per path is
 * forwarded as the field error so the message string is the translation key.
 *
 * @param schema - the zod object schema to adapt
 * @returns a vee-validate `TypedSchema` backed by the given zod schema
 */
export function zodToTypedSchema<T extends z.ZodObject<z.ZodRawShape>>(
    schema: T,
): TypedSchema<z.input<T>, z.output<T>> {
    return {
        // biome-ignore lint/style/useNamingConvention: vee-validate contract
        __type: 'VVTypedSchema' as const,
        parse(values: z.input<T>): Promise<{
            /** The parsed output when validation succeeds. */
            value?: z.output<T>;

            /** The field errors, one entry per failing path. */
            errors: TypedSchemaError[];
        }> {
            const result = schema.safeParse(values);

            if (result.success) {
                return Promise.resolve({ value: result.data, errors: [] });
            }

            // Collect only the first error per dotted path to avoid duplicate
            // entries for the same field (zod 4 can emit multiple issues for a
            // single field when multiple checks fail).
            const seen = new Set<string>();
            const errors: TypedSchemaError[] = [];

            for (const issue of result.error.issues) {
                const dotPath = issue.path.map(String).join('.');

                if (!seen.has(dotPath)) {
                    seen.add(dotPath);
                    // exactOptionalPropertyTypes: include `path` only when
                    // non-empty.
                    const entry: TypedSchemaError = dotPath
                        ? { path: dotPath, errors: [issue.message] }
                        : { errors: [issue.message] };

                    errors.push(entry);
                }
            }

            return Promise.resolve({ errors });
        },
    };
}
