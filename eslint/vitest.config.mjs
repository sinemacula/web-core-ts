/**
 * Vitest config for the web-core eslint preset.
 *
 * The preset ships as plain JS with its own RuleTester suite, kept out of the
 * kernel's `src` coverage. Run it with:
 * `vitest run --config eslint/vitest.config.mjs`.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['eslint/**/*.test.js'],
    },
});
