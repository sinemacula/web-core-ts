/**
 * Tests for the no-snake-case-keys rule.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import rule from '../no-snake-case-keys.js';
import { ruleTester } from './tester.js';

ruleTester.run('no-snake-case-keys', rule, {
    valid: [
        // wire() is the sanctioned path - no snake_case key.
        { filename: 'src/http/client.ts', code: "const body = wire([['refresh_token', token]]);" },
        // Destructuring an external payload is fine.
        { filename: 'src/http/client.ts', code: 'const { refresh_token } = response;' },
        // Declaring a type that models an external shape is fine.
        { filename: 'src/http/client.ts', code: 'interface Auth { refresh_token: string; }' },
        // camelCase keys are fine.
        { filename: 'src/http/client.ts', code: 'const o = { refreshToken: 1, userId: 2 };' },
        // A computed key from a variable (not a literal) is not statically a snake_case key.
        { filename: 'src/http/client.ts', code: 'const o = { [field]: 1 };' },
        // Test files are exempt.
        { filename: 'src/http/client.test.ts', code: 'const o = { refresh_token: 1 };' },
    ],
    invalid: [
        {
            filename: 'src/http/client.ts',
            code: 'const o = { refresh_token: 1 };',
            errors: [{ messageId: 'snake' }],
        },
        {
            filename: 'src/http/client.ts',
            code: "const o = { 'created_at': 1 };",
            errors: [{ messageId: 'snake' }],
        },
        // Previously bypassed: a computed string-literal key.
        {
            filename: 'src/http/client.ts',
            code: "const o = { ['refresh_token']: 1 };",
            errors: [{ messageId: 'snake' }],
        },
    ],
});
