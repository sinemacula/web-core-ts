/**
 * The @sinemacula/web-core ESLint plugin.
 *
 * Bundles the framework's module-contract rules. The flat-config preset in
 * index.js is what switches them on for a consumer's `modules/` tree.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import moduleNameMatchesFolder from './rules/module-name-matches-folder.js';

export default {
    meta: {
        name: '@sinemacula/web-core',
    },
    rules: {
        'module-name-matches-folder': moduleNameMatchesFolder,
    },
};
