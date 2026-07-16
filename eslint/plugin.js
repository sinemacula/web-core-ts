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
import routeNameNamespacing from './rules/route-name-namespacing.js';
import routeNameViaConstant from './rules/route-name-via-constant.js';

export default {
    meta: {
        name: '@sinemacula/web-core',
    },
    rules: {
        'module-name-matches-folder': moduleNameMatchesFolder,
        'route-name-namespacing': routeNameNamespacing,
        'route-name-via-constant': routeNameViaConstant,
    },
};
