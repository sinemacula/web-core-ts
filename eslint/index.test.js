/**
 * Tests for the flat-config preset wiring.
 *
 * These assert the preset switches the right rules on for the right files:
 * conventions and the import boundary everywhere (including .vue), the
 * feature-module contract only under modules/, and the test-file exemption.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';
import config from './index.js';

const linter = new Linter({ configType: 'flat' });

function lint(code, filename) {
    return linter.verify(code, config, { filename });
}

function ruleIds(messages) {
    return messages.map(message => message.ruleId);
}

describe('preset config', () => {
    it('enforces the import boundary on .ts files', () => {
        const messages = lint("import { x } from '@sinemacula/web-core';", 'src/app.ts');

        expect(ruleIds(messages)).toEqual(['@sinemacula/web-core/module-import-boundary']);
    });

    it('enforces the import boundary inside .vue single-file components', () => {
        const code =
            '<script setup lang="ts">\nimport { x } from \'@/modules/users/composables/use-thing\';\n</script>';
        const messages = lint(code, 'src/App.vue');

        expect(ruleIds(messages)).toEqual(['@sinemacula/web-core/module-import-boundary']);
    });

    it('exempts test files from the import boundary', () => {
        const messages = lint("import { x } from '@/modules/users/composables/use-thing';", 'src/app.test.ts');

        expect(messages).toEqual([]);
    });

    it('applies the feature-module contract only under modules/', () => {
        const outside = lint('export const AUTH_ROUTES = {} as const;', 'src/config/routes.ts');
        const inside = lint(
            "export const authModule: ModuleDefinition = { name: 'wrong' };",
            'src/modules/auth/module.ts',
        );

        expect(outside).toEqual([]);
        expect(ruleIds(inside)).toContain('@sinemacula/web-core/module-name-matches-folder');
    });
});
