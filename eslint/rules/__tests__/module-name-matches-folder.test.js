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
        // Not typed as a ModuleDefinition - out of scope.
        {
            filename: 'src/modules/auth/module.ts',
            code: "const config = { name: 'anything' };",
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
    ],
});
