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

const MODULE_TS_FILES = ['**/modules/**/*.ts', '**/modules/**/*.tsx'];

export default [
    {
        files: MODULE_TS_FILES,
        plugins: {
            '@sinemacula/web-core': plugin,
        },
        languageOptions: {
            parser: tseslint.parser,
        },
        rules: {
            '@sinemacula/web-core/module-name-matches-folder': 'error',
        },
    },
];
