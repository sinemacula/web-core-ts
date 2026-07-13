/**
 * Unit tests for the logger service.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { Logger } from '@sinemacula/web-core/logging/logger';
import { afterEach, describe, expect, it } from 'vitest';
import { initialiseLogger, logger, resetLogger } from '@/services/logger';

/**
 * Minimal no-op stub that satisfies the {@link Logger} interface.
 */
const stubLogger: Logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

describe('logger service', () => {
    afterEach(() => {
        resetLogger();
    });

    it('returns the installed logger after initialisation', () => {
        initialiseLogger(stubLogger);

        expect(logger()).toBe(stubLogger);
    });

    it('throws before initialisation when logger() is called', () => {
        expect(() => logger()).toThrow('The logger was accessed before initialisation');
    });

    it('throws again after resetLogger() clears the singleton', () => {
        initialiseLogger(stubLogger);
        resetLogger();

        expect(() => logger()).toThrow('The logger was accessed before initialisation');
    });
});
