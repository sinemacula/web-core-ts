/**
 * Unit tests for runtime-environment.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';

import { RUNTIME_ENVIRONMENT_URL } from './runtime-environment';

describe('RUNTIME_ENVIRONMENT_URL', () => {
    it('is the artifact-relative runtime document location', () => {
        expect(RUNTIME_ENVIRONMENT_URL).toBe('/runtime-env.json');
    });
});
