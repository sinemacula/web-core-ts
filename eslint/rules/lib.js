/**
 * Shared helpers for the web-core ESLint rules.
 *
 * These rules encode the framework's module contract (`modules/<name>/...`) and
 * ship with the kernel so every web-core app enforces the same layout. They are
 * framework-specific by design and never belong in the generic shared
 * standards.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { ESLintUtils } from '@typescript-eslint/utils';

/** Shared rule factory linking each rule to its documentation anchor. */
export const createRule = ESLintUtils.RuleCreator(name => `https://github.com/sinemacula/web-core-ts#${name}`);

/** Whether the file path marks it as test code. */
export function isTestPath(filename) {
    const path = filename.replace(/\\/g, '/');

    return path.includes('/__tests__/') || /\.(test|spec)\.[cm]?[jt]sx?$/.test(path);
}

/**
 * The feature-module folder a file belongs to (the segment after `modules/`),
 * or null when the file sits outside a module tree.
 */
export function moduleFolder(filename) {
    const parts = filename.replace(/\\/g, '/').split('/');
    const index = parts.lastIndexOf('modules');

    return index >= 0 && parts[index + 1] ? parts[index + 1] : null;
}

/**
 * Convert a kebab-case name to camelCase (`user-settings` -> `userSettings`).
 */
export function toCamelCase(kebab) {
    return kebab.replace(/-([a-z0-9])/g, (_, character) => character.toUpperCase());
}

/**
 * Convert a kebab-case name to UPPER_SNAKE_CASE (`user-settings` ->
 * `USER_SETTINGS`).
 */
export function toUpperSnakeCase(kebab) {
    return kebab.replace(/-/g, '_').toUpperCase();
}
