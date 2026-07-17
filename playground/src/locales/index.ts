/**
 * Shared translation loaders.
 *
 * Locales load lazily: only the active locale's messages enter the bundle graph
 * at runtime. Add a locale by creating a sibling file and registering its
 * importer here.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { LocaleMessages } from '@sinemacula/web-core/module/module';

export const sharedLocaleLoaders: Readonly<Record<string, () => Promise<LocaleMessages>>> = {
    'en-US': async () => (await import('./en-us')).default,
    'fr-FR': async () => (await import('./fr-fr')).default,
};
