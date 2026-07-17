/**
 * Module registry.
 *
 * The explicit, ordered list of feature modules composed into the application.
 * Register a new module here - there is no filesystem magic.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { ModuleDefinition } from '@sinemacula/web-core/module/module';

import { authModule } from './auth/module';
import { dashboardModule } from './dashboard/module';
import { errorsModule } from './errors/module';
import { usersModule } from './users/module';

export const modules: readonly ModuleDefinition[] = [authModule, dashboardModule, usersModule, errorsModule];
