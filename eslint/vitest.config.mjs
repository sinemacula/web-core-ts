import { defineConfig } from 'vitest/config';

// The eslint preset ships as plain JS with its own RuleTester suite, kept out
// of the kernel's src coverage. Run it with: vitest run --config eslint/vitest.config.mjs
export default defineConfig({
    test: {
        include: ['eslint/**/*.test.js'],
    },
});
