/**
 * Enforce the module import boundary.
 *
 * A file reaches another feature module only through its public surface
 * (`@/modules/<name>`), never a deep internal path (`@/modules/<name>/<file>`) -
 * but a module may freely import its OWN internals. The kernel is imported by
 * subpath (`@sinemacula/web-core/<area>/<file>`), never the bare package barrel.
 * Test files are exempt: they may reach across boundaries to assert internals.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

// biome-ignore-all lint/style/useNamingConvention: ESLint AST visitor keys

import { createRule, isTestPath, moduleFolder } from './lib.js';

const KERNEL_BARREL = '@sinemacula/web-core';

// `@/modules/<name>/<anything-deeper>` - the deep-internal form. `@/modules/<name>`
// alone (the public surface) has no trailing segment and is allowed.
const MODULE_INTERNAL = /^@\/modules\/([^/]+)\/.+/;

// Stryker disable all: declarative rule metadata, not behaviour (verified via messageId and data)
export default createRule({
    name: 'module-import-boundary',
    meta: {
        type: 'problem',
        docs: {
            description: 'Reach other modules through their public surface, and the kernel by subpath.',
        },
        schema: [],
        messages: {
            barrel: 'Import a kernel subpath (@sinemacula/web-core/<area>/<file>), not the package barrel.',
            crossModule:
                "Reach module '{{module}}' through its public surface (@/modules/{{module}}), not its internals.",
        },
    },
    defaultOptions: [],
    // Stryker restore all
    create(context) {
        const filename = context.filename.replace(/\\/g, '/');

        if (isTestPath(filename)) {
            return {};
        }

        const ownModule = moduleFolder(filename);

        /** Report on an import/export source that crosses a boundary. */
        function check(source) {
            // A local `export { x }` has a null source; import/export sources are
            // otherwise always string literals.
            if (source?.type !== 'Literal') {
                return;
            }

            if (source.value === KERNEL_BARREL) {
                context.report({ node: source, messageId: 'barrel' });

                return;
            }

            const match = MODULE_INTERNAL.exec(source.value);

            if (match !== null && match[1] !== ownModule) {
                context.report({ node: source, messageId: 'crossModule', data: { module: match[1] } });
            }
        }

        return {
            ImportDeclaration(node) {
                check(node.source);
            },
            ImportExpression(node) {
                check(node.source);
            },
            ExportNamedDeclaration(node) {
                check(node.source);
            },
            ExportAllDeclaration(node) {
                check(node.source);
            },
        };
    },
});
