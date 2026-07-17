/**
 * Tests for the route-name-via-constant rule.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import rule from '../route-name-via-constant.js';
import { ruleTester } from './tester.js';

ruleTester.run('route-name-via-constant', rule, {
    valid: [
        {
            filename: 'src/modules/auth/routes.ts',
            code: "export const authRoutes = [{ path: '/login', name: AUTH_ROUTE_NAMES.login }];",
        },
        // An inline `title` (not `name`) is fine.
        {
            filename: 'src/modules/auth/routes.ts',
            code: "export const authRoutes = [{ path: '/x', name: NAMES.login, meta: { title: 'auth.login.title' } }];",
        },
        // Not a routes.ts file - ignored (e.g. module.ts declares name inline).
        {
            filename: 'src/modules/auth/module.ts',
            code: "export const authModule = { name: 'auth' };",
        },
        // A sibling whose name merely ends in `routes.ts` is not the contract file.
        {
            filename: 'src/modules/auth/subroutes.ts',
            code: "export const authRoutes = [{ path: '/x', name: 'auth.login' }];",
        },
        // A `name` inside a nested non-route object (a transition) is not a route name.
        {
            filename: 'src/modules/auth/routes.ts',
            code: "export const authRoutes = [{ path: '/x', name: NAMES.login, meta: { transition: { name: 'fade' } } }];",
        },
        // A computed name key is not a static `name` - left alone.
        {
            filename: 'src/modules/auth/routes.ts',
            code: "export const authRoutes = [{ path: '/x', [dynamic]: 'auth.login' }];",
        },
        // A non-string key on a route record is ignored, and a member-expression name is fine.
        {
            filename: 'src/modules/auth/routes.ts',
            code: "export const authRoutes = [{ path: '/x', 5: 'y', name: NAMES.login }];",
        },
        // A bare object with neither path nor component is not a route record.
        {
            filename: 'src/modules/auth/routes.ts',
            code: "export const authRoutes = [{ name: 'auth.login', meta: {} }];",
        },
    ],
    invalid: [
        {
            filename: 'src/modules/auth/routes.ts',
            code: "export const authRoutes = [{ path: '/login', name: 'auth.login' }];",
            errors: [{ messageId: 'inline', data: { value: 'auth.login' } }],
        },
        // Backslash (Windows) paths are normalised before the file is matched.
        {
            filename: 'src\\modules\\auth\\routes.ts',
            code: "export const authRoutes = [{ path: '/login', name: 'auth.login' }];",
            errors: [{ messageId: 'inline', data: { value: 'auth.login' } }],
        },
        // A spread sits alongside the inline name on a route record.
        {
            filename: 'src/modules/auth/routes.ts',
            code: "export const authRoutes = [{ ...base, path: '/login', name: 'auth.login' }];",
            errors: [{ messageId: 'inline', data: { value: 'auth.login' } }],
        },
        // Previously bypassed: a template-literal inline name on a route record.
        {
            filename: 'src/modules/auth/routes.ts',
            code: "export const authRoutes = [{ path: '/login', name: `auth.login` }];",
            errors: [{ messageId: 'inline', data: { value: 'auth.login' } }],
        },
        // Quoted keys resolve the same as identifiers.
        {
            filename: 'src/modules/auth/routes.ts',
            code: "export const authRoutes = [{ 'path': '/login', 'name': 'auth.login' }];",
            errors: [{ messageId: 'inline', data: { value: 'auth.login' } }],
        },
        // A route record identified by `component` rather than `path`.
        {
            filename: 'src/modules/auth/routes.ts',
            code: "export const authRoutes = [{ component: LoginView, name: 'auth.login' }];",
            errors: [{ messageId: 'inline', data: { value: 'auth.login' } }],
        },
    ],
});
