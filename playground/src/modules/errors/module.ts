/**
 * Errors module definition.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { ModuleDefinition } from '@sinemacula/web-core/module/module';
import { createLocaleLoader } from '@sinemacula/web-core/module/module';

import { errorsRoutes } from './routes';

export const errorsModule: ModuleDefinition = {
    name: 'errors',
    routes: errorsRoutes,
    fallback: true,
    locales: createLocaleLoader({
        'en-US': async () => (await import('./locales/en-us')).default,
        'fr-FR': async () => (await import('./locales/fr-fr')).default,
    }),
};
