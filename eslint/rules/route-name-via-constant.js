/**
 * Require route names to reference a `_ROUTE_NAMES` constant, not an inline
 * string.
 *
 * A route's `name` must be a member of the module's `_ROUTE_NAMES` map so the
 * value is defined once and referenced everywhere. Writing the name inline in
 * `routes.ts` drifts from the constant and defeats the namespacing guarantee.
 * Only `name` keys on a route record (an object that also carries `path` or
 * `component`) are checked, so nested `meta` names are left alone.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

// biome-ignore-all lint/style/useNamingConvention: ESLint AST visitor keys

import { createRule } from './lib.js';

/** The static name of a non-computed property key, or null. */
function keyName(property) {
    if (property.type !== 'Property' || property.computed) {
        return null;
    }

    if (property.key.type === 'Identifier') {
        return property.key.name;
    }

    if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
        return property.key.value;
    }

    return null;
}

/** Whether an object expression is a route record (carries `path` or `component`). */
function isRouteObject(objectExpression) {
    return objectExpression.properties.some(property => {
        const name = keyName(property);

        return name === 'path' || name === 'component';
    });
}

/** The inline route name a value carries (string literal or single-quasi template), or null. */
function inlineName(value) {
    if (value.type === 'Literal' && typeof value.value === 'string') {
        return value.value;
    }

    if (value.type === 'TemplateLiteral' && value.expressions.length === 0) {
        return value.quasis[0].value.cooked;
    }

    return null;
}

// Stryker disable all: declarative rule metadata, not behaviour (verified via
// messageId and data)
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
    // Stryker restore all
    create(context) {
        const filename = context.filename.replace(/\\/g, '/');

        if (!/(?:^|\/)routes\.ts$/.test(filename)) {
            return {};
        }

        return {
            Property(node) {
                if (
                    keyName(node) !== 'name' ||
                    node.parent?.type !== 'ObjectExpression' ||
                    !isRouteObject(node.parent)
                ) {
                    return;
                }

                const inline = inlineName(node.value);

                if (inline !== null) {
                    context.report({ node: node.value, messageId: 'inline', data: { value: inline } });
                }
            },
        };
    },
});
