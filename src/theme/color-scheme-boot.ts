/**
 * First-paint colour-scheme boot script.
 *
 * Runs before the kernel module graph loads, so it reads `localStorage`
 * directly and stamps `[data-theme]` only for an explicit `light`/`dark`
 * choice; every other value falls through to the pure-CSS
 * `@media (prefers-color-scheme)` path with no attribute and no flash.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import { COLOR_SCHEME_STORAGE_KEY } from '@sinemacula/foundation/theme/color-scheme';

/**
 * Inline script that applies a stored explicit scheme at first paint.
 */
export const COLOR_SCHEME_BOOT_SCRIPT = `try{var t=localStorage.getItem('${COLOR_SCHEME_STORAGE_KEY}');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;
