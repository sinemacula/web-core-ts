/**
 * Knip dead-code detection configuration.
 *
 * The repository is an npm workspace: the kernel package at the root plus the
 * playground harness. Vue single-file components are compiled down to their
 * script blocks so Knip can follow imports through `.vue` files.
 *
 * The vite/vitest plugins are disabled in favour of listing the config
 * files as static entries: executing the Vite config under Knip's loader
 * breaks on ESM-only plugin packages, while static analysis resolves the
 * same dependencies without running anything.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { KnipConfig } from 'knip';

const SCRIPT_BLOCK = /<script[^>]*>([\s\S]*?)<\/script>/gim;

const config: KnipConfig = {
    workspaces: {
        '.': {
            entry: ['src/**/*.test.ts', 'e2e/**/*.spec.ts', 'vitest.config.ts', 'playwright.config.ts'],
            project: ['src/**/*.ts', 'e2e/**/*.ts'],
            playwright: false,
            vitest: false,
        },
        playground: {
            entry: ['src/main.ts', 'src/**/*.test.ts', 'src/test-support/setup-network-guard.ts', 'vite.config.ts'],
            project: ['src/**/*.ts', 'src/**/*.vue'],
            vite: false,
        },
    },
    ignoreBinaries: ['qlty'],
    ignoreExportsUsedInFile: true,
    compilers: {
        vue: (text: string) => [...text.matchAll(SCRIPT_BLOCK)].map(match => match[1]).join('\n'),
    },
};

export default config;
