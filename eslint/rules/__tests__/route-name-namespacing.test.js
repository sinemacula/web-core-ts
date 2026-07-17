/**
 * Tests for the route-name-namespacing rule.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import rule from '../route-name-namespacing.js';
import { ruleTester } from './tester.js';

ruleTester.run('route-name-namespacing', rule, {
    valid: [
        {
            filename: 'src/modules/auth/route-names.ts',
            code: "export const AUTH_ROUTE_NAMES = { login: 'auth.login' } as const;",
        },
        {
            filename: 'src/modules/errors/route-names.ts',
            code: "export const ERRORS_ROUTE_NAMES = { notFound: 'errors.not-found' } as const;",
        },
        // Not a route-names.ts file - ignored.
        {
            filename: 'src/modules/auth/module.ts',
            code: "const config = { key: 'anything' };",
        },
        // A sibling whose name merely ends in `route-names.ts` is not the contract file.
        {
            filename: 'src/modules/auth/sub-route-names.ts',
            code: "export const AUTH_ROUTE_NAMES = { login: 'login' } as const;",
        },
        // A route-names.ts directly under modules/ has no folder namespace to enforce.
        {
            filename: 'src/modules/route-names.ts',
            code: "export const ROUTE_NAMES = { login: 'anything' } as const;",
        },
        // Not a _ROUTE_NAMES binding, or not an object literal - out of scope.
        {
            filename: 'src/modules/auth/route-names.ts',
            code: 'const helper = { login: 1 };',
        },
        {
            filename: 'src/modules/auth/route-names.ts',
            code: "export const AUTH_ROUTE_NAMES_MAP = { login: 'login' } as const;",
        },
        {
            filename: 'src/modules/auth/route-names.ts',
            code: 'const { AUTH_ROUTE_NAMES } = imported;',
        },
        {
            filename: 'src/modules/auth/route-names.ts',
            code: 'export const AUTH_ROUTE_NAMES = buildNames();',
        },
        {
            filename: 'src/modules/auth/route-names.ts',
            code: 'let AUTH_ROUTE_NAMES;',
        },
        // A spread element is not a route-name property.
        {
            filename: 'src/modules/auth/route-names.ts',
            code: "export const AUTH_ROUTE_NAMES = { ...base, login: 'auth.login' } as const;",
        },
        // Nested groups are walked recursively; all namespaced.
        {
            filename: 'src/modules/auth/route-names.ts',
            code: "export const AUTH_ROUTE_NAMES = { profile: { view: 'auth.profile.view' } } as const;",
        },
        // Non-string values (a number, a reference) carry no route name to check.
        {
            filename: 'src/modules/auth/route-names.ts',
            code: 'export const AUTH_ROUTE_NAMES = { count: 1, dynamic: build() } as const;',
        },
        // Correctly namespaced via satisfies / as const satisfies.
        {
            filename: 'src/modules/auth/route-names.ts',
            code: "export const AUTH_ROUTE_NAMES = { login: 'auth.login' } as const satisfies Record<string, string>;",
        },
        {
            filename: 'src/modules/auth/route-names.ts',
            code: "export const AUTH_ROUTE_NAMES = { login: 'auth.login' } satisfies Record<string, string>;",
        },
    ],
    invalid: [
        {
            filename: 'src/modules/auth/route-names.ts',
            code: "export const AUTH_ROUTE_NAMES = { login: 'login' } as const;",
            errors: [{ messageId: 'unnamespaced', data: { value: 'login', folder: 'auth' } }],
        },
        {
            filename: 'src/modules/auth/route-names.ts',
            code: "export const AUTH_ROUTE_NAMES = { home: 'users.home' } as const;",
            errors: [{ messageId: 'unnamespaced', data: { value: 'users.home', folder: 'auth' } }],
        },
        {
            filename: 'src/modules/auth/route-names.ts',
            code: "export const AUTH_ROUTE_NAMES = { bad: 'auth.Not_Kebab' } as const;",
            errors: [{ messageId: 'unnamespaced', data: { value: 'auth.Not_Kebab', folder: 'auth' } }],
        },
        // Backslash (Windows) paths are normalised before the folder is read.
        {
            filename: 'src\\modules\\auth\\route-names.ts',
            code: "export const AUTH_ROUTE_NAMES = { login: 'login' } as const;",
            errors: [{ messageId: 'unnamespaced', data: { value: 'login', folder: 'auth' } }],
        },
        // A nested group value must be namespaced too.
        {
            filename: 'src/modules/auth/route-names.ts',
            code: "export const AUTH_ROUTE_NAMES = { profile: { view: 'view' } } as const;",
            errors: [{ messageId: 'unnamespaced', data: { value: 'view', folder: 'auth' } }],
        },
        // Previously bypassed: satisfies / as const satisfies wrappers.
        {
            filename: 'src/modules/auth/route-names.ts',
            code: "export const AUTH_ROUTE_NAMES = { login: 'login' } as const satisfies Record<string, string>;",
            errors: [{ messageId: 'unnamespaced', data: { value: 'login', folder: 'auth' } }],
        },
        {
            filename: 'src/modules/auth/route-names.ts',
            code: "export const AUTH_ROUTE_NAMES = { login: 'login' } satisfies Record<string, string>;",
            errors: [{ messageId: 'unnamespaced', data: { value: 'login', folder: 'auth' } }],
        },
        // Previously bypassed: a template-literal value.
        {
            filename: 'src/modules/auth/route-names.ts',
            code: 'export const AUTH_ROUTE_NAMES = { login: `login` } as const;',
            errors: [{ messageId: 'unnamespaced', data: { value: 'login', folder: 'auth' } }],
        },
    ],
});
