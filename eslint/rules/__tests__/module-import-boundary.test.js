/**
 * Tests for the module-import-boundary rule.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import rule from '../module-import-boundary.js';
import { ruleTester } from './tester.js';

ruleTester.run('module-import-boundary', rule, {
    valid: [
        // The kernel packages are reached by subpath.
        { filename: 'src/app.ts', code: "import { httpClient } from '@sinemacula/web-core/http/client';" },
        { filename: 'src/app.ts', code: "import { Environment } from '@sinemacula/foundation/config/environment';" },
        // Another module is reached through its public surface.
        { filename: 'src/modules/auth/module.ts', code: "import { usersModule } from '@/modules/users';" },
        // A module freely imports its OWN internals.
        {
            filename: 'src/modules/auth/routes.ts',
            code: "import { useLoginForm } from '@/modules/auth/composables/use-login-form';",
        },
        // Ordinary package and relative imports are untouched.
        { filename: 'src/app.ts', code: "import { defineComponent } from 'vue';" },
        { filename: 'src/modules/auth/routes.ts', code: "import { helper } from './helper';" },
        // A local re-export carries no source to inspect.
        { filename: 'src/modules/auth/module.ts', code: 'const thing = 1; export { thing };' },
        // A dynamic import of a computed specifier is not a static path.
        { filename: 'src/modules/auth/routes.ts', code: 'export const load = () => import(chunkPath);' },
        // A dynamic import of own internals is fine.
        {
            filename: 'src/modules/auth/routes.ts',
            code: "export const load = () => import('@/modules/auth/views/login-view.vue');",
        },
        // Test files may reach across boundaries to assert internals.
        {
            filename: 'src/modules/users/__tests__/registry.test.ts',
            code: "import { secret } from '@/modules/auth/composables/use-login-form';",
        },
        {
            filename: 'src/modules/users/registry.spec.ts',
            code: "import { pkg } from '@sinemacula/web-core';",
        },
    ],
    invalid: [
        // Neither bare package barrel is ever imported.
        {
            filename: 'src/app.ts',
            code: "import { httpClient } from '@sinemacula/web-core';",
            errors: [{ messageId: 'barrel' }],
        },
        {
            filename: 'src/app.ts',
            code: "import { Environment } from '@sinemacula/foundation';",
            errors: [{ messageId: 'barrel' }],
        },
        // Reaching into another module's internals.
        {
            filename: 'src/modules/auth/routes.ts',
            code: "import { thing } from '@/modules/users/composables/use-thing';",
            errors: [{ messageId: 'crossModule', data: { module: 'users' } }],
        },
        // A non-module file reaching into a module's internals is still a
        // breach.
        {
            filename: 'src/app.ts',
            code: "import { thing } from '@/modules/users/composables/use-thing';",
            errors: [{ messageId: 'crossModule', data: { module: 'users' } }],
        },
        // Every import/export form is covered: dynamic import, re-export, star
        // re-export.
        {
            filename: 'src/modules/auth/routes.ts',
            code: "export const load = () => import('@/modules/users/views/list-view.vue');",
            errors: [{ messageId: 'crossModule', data: { module: 'users' } }],
        },
        {
            filename: 'src/modules/auth/module.ts',
            code: "export { thing } from '@/modules/users/composables/use-thing';",
            errors: [{ messageId: 'crossModule', data: { module: 'users' } }],
        },
        {
            filename: 'src/modules/auth/module.ts',
            code: "export * from '@/modules/users/composables/use-thing';",
            errors: [{ messageId: 'crossModule', data: { module: 'users' } }],
        },
        {
            filename: 'src/modules/auth/module.ts',
            code: "export { httpClient } from '@sinemacula/web-core';",
            errors: [{ messageId: 'barrel' }],
        },
    ],
});
