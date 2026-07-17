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
            errors: [{ messageId: 'unnamespaced' }],
        },
        {
            filename: 'src/modules/auth/route-names.ts',
            code: "export const AUTH_ROUTE_NAMES = { home: 'users.home' } as const;",
            errors: [{ messageId: 'unnamespaced' }],
        },
        {
            filename: 'src/modules/auth/route-names.ts',
            code: "export const AUTH_ROUTE_NAMES = { bad: 'auth.Not_Kebab' } as const;",
            errors: [{ messageId: 'unnamespaced' }],
        },
        // Previously bypassed: satisfies / as const satisfies wrappers.
        {
            filename: 'src/modules/auth/route-names.ts',
            code: "export const AUTH_ROUTE_NAMES = { login: 'login' } as const satisfies Record<string, string>;",
            errors: [{ messageId: 'unnamespaced' }],
        },
        {
            filename: 'src/modules/auth/route-names.ts',
            code: "export const AUTH_ROUTE_NAMES = { login: 'login' } satisfies Record<string, string>;",
            errors: [{ messageId: 'unnamespaced' }],
        },
        // Previously bypassed: a template-literal value.
        {
            filename: 'src/modules/auth/route-names.ts',
            code: 'export const AUTH_ROUTE_NAMES = { login: `login` } as const;',
            errors: [{ messageId: 'unnamespaced' }],
        },
    ],
});
