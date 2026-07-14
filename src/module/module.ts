/**
 * Feature module contract.
 *
 * The application is composed of modules: each contributes routes, optional
 * lazily-loaded translations, and its own internal views, stores and
 * services. The registry in `src/modules` is the single explicit list the
 * bootstrap consumes — no filesystem magic, no auto-imports.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { RouteRecordRaw } from 'vue-router';

/**
 * A flat or nested bag of translation key/value pairs for one locale.
 */
export type LocaleMessages = Record<string, unknown>;

/**
 * Resolve a module's translations for one locale.
 */
export type LocaleMessageLoader = (locale: string) => Promise<LocaleMessages | null>;

/**
 * A self-contained feature area of the application.
 */
export interface ModuleDefinition {
    /** Unique module name; also the namespace for its translations. */
    readonly name: string;

    /** Routes contributed to the application router. */
    readonly routes: readonly RouteRecordRaw[];

    /** Lazily-loaded translations, keyed under the module name. */
    readonly locales?: LocaleMessageLoader;
}

/**
 * Build a {@link LocaleMessageLoader} from a per-locale import map.
 *
 * @param loaders - dynamic importers keyed by locale code
 * @returns a loader resolving null for locales the module does not provide
 */
export function createLocaleLoader(
    loaders: Readonly<Record<string, () => Promise<LocaleMessages>>>,
): LocaleMessageLoader {
    return async (locale: string): Promise<LocaleMessages | null> => {
        const loader = loaders[locale];

        return loader === undefined ? null : await loader();
    };
}

/**
 * Flatten the routes contributed by a set of modules.
 *
 * @param modules - the module registry
 * @returns every module route, in registry order
 */
export function collectModuleRoutes(modules: readonly ModuleDefinition[]): RouteRecordRaw[] {
    return modules.flatMap(definition => [...definition.routes]);
}

/**
 * Load and namespace every module's translations for one locale.
 *
 * @param modules - the module registry
 * @param locale - the locale to load
 * @returns module translations keyed by module name
 */
export async function collectModuleMessages(
    modules: readonly ModuleDefinition[],
    locale: string,
): Promise<Record<string, LocaleMessages>> {
    const messages: Record<string, LocaleMessages> = {};

    for (const definition of modules) {
        const loaded = definition.locales === undefined ? null : await definition.locales(locale);

        if (loaded !== null) {
            messages[definition.name] = loaded;
        }
    }

    return messages;
}
