/**
 * Unit tests for the reporting service.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { ErrorReporter } from '@sinemacula/foundation/reporting/error-reporter';
import { afterEach, describe, expect, it } from 'vitest';
import { initialiseReporting, reporting, resetReporting } from '@/services/reporting';

/**
 * Minimal no-op stub that satisfies the {@link ErrorReporter} interface.
 */
const stubReporter: ErrorReporter = {
    captureError: () => undefined,
    captureMessage: () => undefined,
    setUser: () => undefined,
};

describe('reporting service', () => {
    afterEach(() => {
        resetReporting();
    });

    it('returns the installed reporter after initialisation', () => {
        initialiseReporting(stubReporter);

        expect(reporting()).toBe(stubReporter);
    });

    it('throws before initialisation when reporting() is called', () => {
        expect(() => reporting()).toThrow('error reporter accessed before initialisation');
    });

    it('throws again after resetReporting() clears the singleton', () => {
        initialiseReporting(stubReporter);
        resetReporting();

        expect(() => reporting()).toThrow('error reporter accessed before initialisation');
    });
});
