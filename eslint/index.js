/**
 * web-core ESLint preset: the framework module contract.
 *
 * A flat-config layer web-core apps enable alongside the shared
 * coding-standards base/vue presets. It enforces the `modules/<name>/...`
 * structure the kernel fixes. Framework-specific by design; the generic rules
 * stay in coding-standards.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';
import plugin from './plugin.js';

const TS_FILES = ['**/*.ts', '**/*.tsx'];
const VUE_FILES = ['**/*.vue'];
const MODULE_TS_FILES = ['**/modules/**/*.ts', '**/modules/**/*.tsx'];

/** Conventions + import boundary applied everywhere the framework runs. */
const CONVENTIONS = {
    '@sinemacula/web-core/no-snake-case-keys': 'error',
    '@sinemacula/web-core/module-import-boundary': 'error',
};

export default [
    {
        // Kernel-wide conventions and the import boundary, on TypeScript files.
        files: TS_FILES,
        plugins: {
            '@sinemacula/web-core': plugin,
        },
        languageOptions: {
            parser: tseslint.parser,
        },
        rules: CONVENTIONS,
    },
    {
        // The same conventions and boundary on Vue single-file components - the
        // view layer is exactly where cross-module reaching is most likely.
        files: VUE_FILES,
        plugins: {
            '@sinemacula/web-core': plugin,
        },
        languageOptions: {
            parser: vueParser,
            parserOptions: {
                parser: tseslint.parser,
            },
        },
        rules: CONVENTIONS,
    },
    {
        // The feature-module contract (module.ts / routes.ts / route-names.ts).
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
];
