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
        // A sibling whose name merely ends in `module.ts` is not the module file.
        {
            filename: 'src/modules/auth/submodule.ts',
            code: "export const authModule: ModuleDefinition = { name: 'login' };",
        },
        // Not typed as a ModuleDefinition and not `satisfies` - out of scope (module-export-names is the backstop).
        {
            filename: 'src/modules/auth/module.ts',
            code: "const config = { name: 'anything' };",
        },
        // `satisfies` a different type is not a module declaration.
        {
            filename: 'src/modules/auth/module.ts',
            code: "export const authModule = { name: 'login' } satisfies Record<string, string>;",
        },
        // A module.ts sitting directly under modules/ has no folder to match against.
        {
            filename: 'src/modules/module.ts',
            code: "export const anyModule: ModuleDefinition = { name: 'whatever' };",
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
        // Declared but not initialised - nothing to inspect, so no report.
        {
            filename: 'src/modules/auth/module.ts',
            code: 'let authModule: ModuleDefinition;',
        },
        // No type, no initialiser - not a module declaration.
        {
            filename: 'src/modules/auth/module.ts',
            code: 'let plain;',
        },
        // Value is not an object literal (built elsewhere) - out of scope.
        {
            filename: 'src/modules/auth/module.ts',
            code: 'export const authModule: ModuleDefinition = buildModule();',
        },
        // No `name` property to check.
        {
            filename: 'src/modules/auth/module.ts',
            code: 'export const authModule: ModuleDefinition = { routes: [] };',
        },
        // `name` is a reference, not a literal - not statically checkable.
        {
            filename: 'src/modules/auth/module.ts',
            code: 'export const authModule: ModuleDefinition = { name: folderName };',
        },
        // `name` is a non-string literal - not a folder name.
        {
            filename: 'src/modules/auth/module.ts',
            code: 'export const authModule: ModuleDefinition = { name: 123 };',
        },
        // A computed key is skipped; a quoted `name` key resolves the same as an identifier.
        {
            filename: 'src/modules/auth/module.ts',
            code: "export const authModule: ModuleDefinition = { [dynamic]: 1, 'name': 'auth' };",
        },
    ],
    invalid: [
        {
            filename: 'src/modules/auth/module.ts',
            code: "export const authModule: ModuleDefinition = { name: 'login', routes: [] };",
            errors: [{ messageId: 'mismatch', data: { folder: 'auth', name: 'login' } }],
        },
        {
            filename: 'src/modules/dashboard/module.ts',
            code: "const dashboardModule: ModuleDefinition = { name: 'dash' }; export { dashboardModule };",
            errors: [{ messageId: 'mismatch', data: { folder: 'dashboard', name: 'dash' } }],
        },
        // Backslash (Windows) paths are normalised before the folder is read.
        {
            filename: 'src\\modules\\auth\\module.ts',
            code: "export const authModule: ModuleDefinition = { name: 'login' };",
            errors: [{ messageId: 'mismatch', data: { folder: 'auth', name: 'login' } }],
        },
        // A spread sits alongside the mismatched name.
        {
            filename: 'src/modules/auth/module.ts',
            code: "export const authModule: ModuleDefinition = { ...defaults, name: 'login' };",
            errors: [{ messageId: 'mismatch', data: { folder: 'auth', name: 'login' } }],
        },
        // Previously bypassed: satisfies / as / as const / qualified-type all now caught.
        {
            filename: 'src/modules/auth/module.ts',
            code: "export const authModule = { name: 'login' } satisfies ModuleDefinition;",
            errors: [{ messageId: 'mismatch', data: { folder: 'auth', name: 'login' } }],
        },
        {
            filename: 'src/modules/auth/module.ts',
            code: "export const authModule = { name: 'login' } as ModuleDefinition;",
            errors: [{ messageId: 'mismatch', data: { folder: 'auth', name: 'login' } }],
        },
        {
            filename: 'src/modules/auth/module.ts',
            code: "export const authModule: ModuleDefinition = { name: 'login' } as const;",
            errors: [{ messageId: 'mismatch', data: { folder: 'auth', name: 'login' } }],
        },
        {
            filename: 'src/modules/auth/module.ts',
            code: "export const authModule: core.ModuleDefinition = { name: 'login' };",
            errors: [{ messageId: 'mismatch', data: { folder: 'auth', name: 'login' } }],
        },
    ],
});
