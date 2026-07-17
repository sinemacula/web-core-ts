/**
 * Auth module definition.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { ModuleDefinition } from '@sinemacula/web-core/module/module';
import { createLocaleLoader } from '@sinemacula/web-core/module/module';

import { authRoutes } from './routes';

export const authModule: ModuleDefinition = {
    name: 'auth',
    routes: authRoutes,
    locales: createLocaleLoader({
        'en-US': async () => (await import('./locales/en-us')).default,
        'fr-FR': async () => (await import('./locales/fr-fr')).default,
    }),
};
