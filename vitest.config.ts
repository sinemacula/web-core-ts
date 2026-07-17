/**
 * Vitest test-runner configuration.
 *
 * Tests are colocated with source (`*.test.ts`). Coverage is measured over the
 * plain TypeScript surface only: Vue single-file components are kept thin
 * (template plus wiring) so every line of behaviour lives in fully-covered
 * `.ts` modules.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { resolve } from 'node:path';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            '@': resolve(process.cwd(), 'playground/src'),
        },
    },
    test: {
        environment: 'happy-dom',
        setupFiles: ['playground/src/test-support/setup-network-guard.ts'],
        include: ['src/**/*.test.ts', 'playground/src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            include: ['src/**/*.ts', 'playground/src/**/*.ts'],
            exclude: ['**/*.test.ts', 'playground/src/main.ts', 'playground/src/test-support/**', '**/*.d.ts'],
            thresholds: {
                lines: 100,
                functions: 100,
                branches: 100,
                statements: 100,
            },
        },
    },
});
