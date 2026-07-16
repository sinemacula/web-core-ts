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
            code: "export const authRoutes = [{ name: NAMES.login, meta: { title: 'auth.login.title' } }];",
        },
        // Not a routes.ts file - ignored (e.g. module.ts declares name inline).
        {
            filename: 'src/modules/auth/module.ts',
            code: "export const authModule = { name: 'auth' };",
        },
    ],
    invalid: [
        {
            filename: 'src/modules/auth/routes.ts',
            code: "export const authRoutes = [{ path: '/login', name: 'auth.login' }];",
            errors: [{ messageId: 'inline' }],
        },
    ],
});
