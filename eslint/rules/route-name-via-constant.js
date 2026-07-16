/**
 * Require route names to reference a `_ROUTE_NAMES` constant, not an inline string.
 *
 * A route's `name` must be a member of the module's `_ROUTE_NAMES` map so the
 * value is defined once and referenced everywhere. Writing the name inline in
 * `routes.ts` drifts from the constant and defeats the namespacing guarantee.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

// biome-ignore-all lint/style/useNamingConvention: ESLint visitor keys are AST node-type names.

import { createRule } from './lib.js';

/** Whether a property is the non-computed `name` key of an object. */
function isNameKey(property) {
    return (
        property.type === 'Property' &&
        !property.computed &&
        ((property.key.type === 'Identifier' && property.key.name === 'name') ||
            (property.key.type === 'Literal' && property.key.value === 'name'))
    );
}

export default createRule({
    name: 'route-name-via-constant',
    meta: {
        type: 'problem',
        docs: {
            description: 'Require route names to reference a _ROUTE_NAMES constant, not an inline string.',
        },
        schema: [],
        messages: {
            inline: "Reference a _ROUTE_NAMES constant instead of the inline route name '{{value}}'.",
        },
    },
    defaultOptions: [],
    create(context) {
        const filename = (context.filename ?? context.getFilename()).replace(/\\/g, '/');

        if (!/(?:^|\/)routes\.ts$/.test(filename)) {
            return {};
        }

        return {
            Property(node) {
                if (isNameKey(node) && node.value.type === 'Literal' && typeof node.value.value === 'string') {
                    context.report({
                        node: node.value,
                        messageId: 'inline',
                        data: { value: node.value.value },
                    });
                }
            },
        };
    },
});
