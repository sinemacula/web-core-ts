/**
 * Tests for the plugin's rule registry.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { describe, expect, it } from 'vitest';
import plugin from './plugin.js';

const RULES = [
    'module-export-names',
    'module-import-boundary',
    'module-name-matches-folder',
    'no-snake-case-keys',
    'route-name-namespacing',
    'route-name-via-constant',
];

describe('plugin', () => {
    it('registers exactly the module-contract rules', () => {
        expect(Object.keys(plugin.rules).sort()).toEqual(RULES);
    });

    it('names the plugin so flat config can reference it', () => {
        expect(plugin.meta.name).toBe('@sinemacula/web-core');
    });

    it.each(RULES)('exposes %s as a well-formed rule', name => {
        const rule = plugin.rules[name];

        expect(rule.meta.messages).toBeDefined();
        expect(typeof rule.create).toBe('function');
    });
});
