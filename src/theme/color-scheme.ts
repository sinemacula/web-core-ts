/**
 * Colour-scheme types, storage contract and first-paint boot script.
 *
 * The boot script runs before the kernel module graph loads, so it reads
 * `localStorage` directly and stamps `[data-theme]` only for an explicit
 * `light`/`dark` choice; every other value falls through to the pure-CSS
 * `@media (prefers-color-scheme)` path with no attribute and no flash.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

/**
 * A user's colour-scheme choice, including deferring to the OS.
 */
export type ColorSchemePreference = 'light' | 'dark' | 'system';

/**
 * A concrete colour scheme after resolving `system` against the OS.
 */
export type ResolvedColorScheme = 'light' | 'dark';

/**
 * The storage key for the persisted colour-scheme preference.
 */
export const COLOR_SCHEME_STORAGE_KEY = 'theme';

/**
 * Inline script that applies a stored explicit scheme at first paint.
 */
export const COLOR_SCHEME_BOOT_SCRIPT = `try{var t=localStorage.getItem('${COLOR_SCHEME_STORAGE_KEY}');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;

/**
 * Compose the storage key for a namespaced application.
 *
 * @param namespace - the application namespace, or null for none
 * @param key - the base storage key
 * @returns the namespaced key, or the base key when no namespace
 */
export function composeColorSchemeStorageKey(namespace: string | null, key = COLOR_SCHEME_STORAGE_KEY): string {
    return namespace ? `${namespace}.${key}` : key;
}
