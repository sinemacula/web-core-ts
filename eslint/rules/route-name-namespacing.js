/**
 * Require route names to be namespaced under the module folder.
 *
 * Every value in a module's `_ROUTE_NAMES` map must read `<folder>.<kebab>`
 * (for example `auth.login`, `errors.not-found`). The first segment is the
 * module name, which is also the i18n namespace, so an un-namespaced or
 * mis-namespaced route name collides across modules and breaks
 * title/translation lookup.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

// biome-ignore-all lint/style/useNamingConvention: ESLint AST visitor keys

import { createRule, moduleFolder, unwrapExpression } from './lib.js';

/** Escape a string for literal use inside a regular expression. */
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Every route-name string value in an object, recursively - both plain string
 * literals and single-quasi template literals (`` `auth.login` ``).
 */
function routeNameValues(objectExpression) {
    const values = [];

    for (const property of objectExpression.properties) {
        if (property.type !== 'Property') {
            continue;
        }

        const value = property.value;

        if (value.type === 'Literal' && typeof value.value === 'string') {
            values.push({ node: value, text: value.value });
        } else if (value.type === 'TemplateLiteral' && value.expressions.length === 0) {
            values.push({ node: value, text: value.quasis[0].value.cooked });
        } else if (value.type === 'ObjectExpression') {
            values.push(...routeNameValues(value));
        }
    }

    return values;
}

export default createRule({
    name: 'route-name-namespacing',
    meta: {
        type: 'problem',
        docs: {
            description: 'Require route names to be namespaced under the module folder.',
        },
        schema: [],
        messages: {
            unnamespaced: "Route name '{{value}}' must be namespaced as '{{folder}}.<kebab>'.",
        },
    },
    defaultOptions: [],
    create(context) {
        const filename = (context.filename ?? context.getFilename()).replace(/\\/g, '/');

        if (!/(?:^|\/)route-names\.ts$/.test(filename)) {
            return {};
        }

        const folder = moduleFolder(filename);

        if (folder === null) {
            return {};
        }

        const pattern = new RegExp(
            `^${escapeRegExp(folder)}\\.[a-z0-9]+(?:-[a-z0-9]+)*(?:\\.[a-z0-9]+(?:-[a-z0-9]+)*)*$`,
        );

        return {
            VariableDeclarator(node) {
                if (node.id?.type !== 'Identifier' || !/_ROUTE_NAMES$/.test(node.id.name)) {
                    return;
                }

                const object = unwrapExpression(node.init);

                if (object?.type !== 'ObjectExpression') {
                    return;
                }

                for (const { node: literal, text } of routeNameValues(object)) {
                    if (!pattern.test(text)) {
                        context.report({
                            node: literal,
                            messageId: 'unnamespaced',
                            data: { value: text, folder },
                        });
                    }
                }
            },
        };
    },
});
