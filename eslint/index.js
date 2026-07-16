/**
 * web-core ESLint preset: the framework module contract.
 *
 * A flat-config layer web-core apps enable alongside the shared coding-standards
 * base/vue presets. It enforces the `modules/<name>/...` structure the kernel
 * fixes. Framework-specific by design; the generic rules stay in coding-standards.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import tseslint from 'typescript-eslint';
import plugin from './plugin.js';

const TS_FILES = ['**/*.ts', '**/*.tsx'];
const MODULE_TS_FILES = ['**/modules/**/*.ts', '**/modules/**/*.tsx'];

export default [
    {
        // Kernel-wide conventions and import boundaries.
        files: TS_FILES,
        plugins: {
            '@sinemacula/web-core': plugin,
        },
        languageOptions: {
            parser: tseslint.parser,
        },
        rules: {
            '@sinemacula/web-core/no-snake-case-keys': 'error',
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: '@sinemacula/web-core',
                            message:
                                'Import a kernel subpath (@sinemacula/web-core/<area>/<file>), not the package barrel.',
                        },
                    ],
                    patterns: [
                        {
                            group: ['@/modules/*/*', '@/modules/*/**'],
                            message:
                                'Reach another module through its public surface (@/modules/<name>), not its internals.',
                        },
                    ],
                },
            ],
        },
    },
    {
        // The feature-module contract.
        files: MODULE_TS_FILES,
        plugins: {
            '@sinemacula/web-core': plugin,
        },
        languageOptions: {
            parser: tseslint.parser,
        },
        rules: {
            '@sinemacula/web-core/module-name-matches-folder': 'error',
            '@sinemacula/web-core/module-export-names': 'error',
            '@sinemacula/web-core/route-name-namespacing': 'error',
            '@sinemacula/web-core/route-name-via-constant': 'error',
        },
    },
    {
        // Tests may reach across boundaries to assert internals.
        files: ['**/*.test.ts', '**/*.test.tsx'],
        rules: {
            'no-restricted-imports': 'off',
        },
    },
];
