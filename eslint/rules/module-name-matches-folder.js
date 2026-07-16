/**
 * Require a module's declared name to match its folder.
 *
 * A `ModuleDefinition` in `modules/<folder>/module.ts` must declare
 * `name: '<folder>'`. The name is the module's identity and its i18n namespace,
 * so a mismatch silently misroutes translations and route names. The runtime
 * registry only rejects duplicate names, never a name that disagrees with its
 * folder, so this closes that gap statically.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { createRule, moduleFolder } from './lib.js';

/** Whether a property is the non-computed `name` key of an object. */
function isNameProperty(property) {
    return property.type === 'Property'
        && !property.computed
        && ((property.key.type === 'Identifier' && property.key.name === 'name')
            || (property.key.type === 'Literal' && property.key.value === 'name'));
}

export default createRule({
    name: 'module-name-matches-folder',
    meta: {
        type: 'problem',
        docs: {
            description: "Require a module's declared name to match its folder.",
        },
        schema: [],
        messages: {
            mismatch: "This module lives in '{{folder}}' but declares name '{{name}}'; they must match.",
        },
    },
    defaultOptions: [],
    create(context) {
        const filename = (context.filename ?? context.getFilename()).replace(/\\/g, '/');

        if (!/(?:^|\/)module\.ts$/.test(filename)) {
            return {};
        }

        const folder = moduleFolder(filename);

        if (folder === null) {
            return {};
        }

        return {
            VariableDeclarator(node) {
                const annotation = node.id?.typeAnnotation?.typeAnnotation;

                if (annotation?.typeName?.name !== 'ModuleDefinition' || node.init?.type !== 'ObjectExpression') {
                    return;
                }

                const nameProperty = node.init.properties.find(isNameProperty);

                if (nameProperty?.value.type !== 'Literal' || typeof nameProperty.value.value !== 'string') {
                    return;
                }

                if (nameProperty.value.value !== folder) {
                    context.report({
                        node: nameProperty.value,
                        messageId: 'mismatch',
                        data: { folder, name: nameProperty.value.value },
                    });
                }
            },
        };
    },
});
