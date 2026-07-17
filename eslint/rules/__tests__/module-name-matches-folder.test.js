/**
 * Tests for the module-name-matches-folder rule.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import rule from '../module-name-matches-folder.js';
import { ruleTester } from './tester.js';

ruleTester.run('module-name-matches-folder', rule, {
    valid: [
        {
            filename: 'src/modules/auth/module.ts',
            code: "export const authModule: ModuleDefinition = { name: 'auth', routes: [] };",
        },
        {
            filename: 'app/modules/users/module.ts',
            code: "const usersModule: ModuleDefinition = { name: 'users' }; export { usersModule };",
        },
        // Not a module.ts file - ignored.
        {
            filename: 'src/modules/auth/routes.ts',
            code: "const authRoutes: RouteRecordRaw[] = [{ name: 'auth.login' }];",
        },
        // Not typed as a ModuleDefinition and not `satisfies` - out of scope (module-export-names is the backstop).
        {
            filename: 'src/modules/auth/module.ts',
            code: "const config = { name: 'anything' };",
        },
        // Matching name via the idiomatic assertion forms.
        {
            filename: 'src/modules/auth/module.ts',
            code: "export const authModule = { name: 'auth' } satisfies ModuleDefinition;",
        },
        {
            filename: 'src/modules/auth/module.ts',
            code: "export const authModule: ModuleDefinition = { name: 'auth' } as const;",
        },
        {
            filename: 'src/modules/auth/module.ts',
            code: "export const authModule: core.ModuleDefinition = { name: 'auth' };",
        },
    ],
    invalid: [
        {
            filename: 'src/modules/auth/module.ts',
            code: "export const authModule: ModuleDefinition = { name: 'login', routes: [] };",
            errors: [{ messageId: 'mismatch' }],
        },
        {
            filename: 'src/modules/dashboard/module.ts',
            code: "const dashboardModule: ModuleDefinition = { name: 'dash' }; export { dashboardModule };",
            errors: [{ messageId: 'mismatch' }],
        },
        // Previously bypassed: satisfies / as / as const / qualified-type all now caught.
        {
            filename: 'src/modules/auth/module.ts',
            code: "export const authModule = { name: 'login' } satisfies ModuleDefinition;",
            errors: [{ messageId: 'mismatch' }],
        },
        {
            filename: 'src/modules/auth/module.ts',
            code: "export const authModule = { name: 'login' } as ModuleDefinition;",
            errors: [{ messageId: 'mismatch' }],
        },
        {
            filename: 'src/modules/auth/module.ts',
            code: "export const authModule: ModuleDefinition = { name: 'login' } as const;",
            errors: [{ messageId: 'mismatch' }],
        },
        {
            filename: 'src/modules/auth/module.ts',
            code: "export const authModule: core.ModuleDefinition = { name: 'login' };",
            errors: [{ messageId: 'mismatch' }],
        },
    ],
});
