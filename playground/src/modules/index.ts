/**
 * Module registry.
 *
 * The explicit, ordered list of feature modules composed into the
 * application. Register a new module here — there is no filesystem magic.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { ModuleDefinition } from '@sinemacula/web-core/module/module';

import { authModule } from './auth/module';
import { dashboardModule } from './dashboard/module';
import { errorsModule } from './errors/module';
import { usersModule } from './users/module';

// The errors module contributes the `/:pathMatch(.*)*` catch-all route. Vue
// Router matches routes in registration order, so this module must stay last
// or its catch-all would shadow every route registered after it.
export const modules: readonly ModuleDefinition[] = [authModule, dashboardModule, usersModule, errorsModule];
