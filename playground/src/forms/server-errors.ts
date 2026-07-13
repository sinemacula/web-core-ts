/**
 * Server-side 422 validation error mapping for forms.
 *
 * Bridges an API rejection onto vee-validate's field-error map so a form can
 * surface server-side validation without duplicating the mapping in every
 * submit handler. Server messages are display-ready English text from the
 * API, so views render them verbatim: vue-i18n's `t()` passes an unrecognised
 * key straight through, which is exactly what an English sentence needs.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import { HttpValidationError } from '@sinemacula/web-core/http/http-error';

/**
 * Applies a field-name-to-message map to a form.
 *
 * @param fields - the field errors to apply, keyed by field name
 */
export type FieldErrorSetter = (fields: Readonly<Record<string, string>>) => void;

/**
 * Map a 422 validation failure onto form field errors.
 *
 * Builds a `{ field: firstMessage }` map from every field that has at least
 * one message, skipping fields whose message array is empty, and applies it
 * with a single `setErrors` call.
 *
 * @param error - the thrown failure to inspect
 * @param setErrors - applies the mapped field errors to the form
 * @returns true when at least one field message was applied to the form;
 *   false when `error` is not a validation failure, or the failure carries an
 *   error map with no field messages — callers should fall through to their
 *   generic error handling in that case
 */
export function applyServerValidationErrors(error: unknown, setErrors: FieldErrorSetter): boolean {
    if (!(error instanceof HttpValidationError)) {
        return false;
    }

    const fieldMessages: Record<string, string> = {};

    for (const [field, messages] of Object.entries(error.errors)) {
        const firstMessage = messages[0];

        if (firstMessage !== undefined) {
            fieldMessages[field] = firstMessage;
        }
    }

    if (Object.keys(fieldMessages).length === 0) {
        return false;
    }

    setErrors(fieldMessages);

    return true;
}
