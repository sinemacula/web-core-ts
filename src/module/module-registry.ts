/**
 * Module registry construction and lifecycle execution.
 *
 * `createModuleRegistry` validates a caller-owned module list (unique names, at
 * most one fallback) and fixes the effective order: declaration order with the
 * fallback module moved last. `registerModules` runs the synchronous register
 * phase and collects each module's HTTP contributions, `bootModules` runs the
 * boot phase and composes the returned teardowns into one LIFO disposal, and
 * `createModuleMessageSource` loads module translations in parallel with a
 * per-locale memo, preserving the namespacing semantics of
 * `collectModuleMessages`.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import type { RequestInterceptor, ResponseErrorHandler, UnauthorizedHandler } from '../http/http-client';
import type {
    LocaleMessages,
    ModuleBootContext,
    ModuleDefinition,
    ModuleHttpRegistrar,
    ModuleRegisterContext,
    ModuleTeardown,
} from './module';

/**
 * A module list failed registry validation or lifecycle execution.
 */
export class ModuleRegistryError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ModuleRegistryError';
    }
}

/**
 * A validated module list in its effective order.
 */
export interface ModuleRegistry {
    /** Effective order: declaration order, with the (at most one) fallback module moved last. Frozen. */
    readonly modules: readonly ModuleDefinition[];
}

/**
 * Validate and order a module list.
 *
 * @param modules - the caller-owned module list, in declaration order
 * @returns the frozen registry, with the fallback module moved last
 * @throws {@link ModuleRegistryError} when a module name is duplicated, listing
 * every duplicate sorted, or when more than one module declares fallback,
 * naming each of them
 */
export function createModuleRegistry(modules: readonly ModuleDefinition[]): ModuleRegistry {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const definition of modules) {
        if (seen.has(definition.name)) {
            duplicates.add(definition.name);
        }

        seen.add(definition.name);
    }

    if (duplicates.size > 0) {
        const names = [...duplicates]
            .sort()
            .map(name => `"${name}"`)
            .join(', ');

        throw new ModuleRegistryError(`Duplicate module names: ${names}.`);
    }

    const fallbacks = modules.filter(definition => definition.fallback === true);

    if (fallbacks.length > 1) {
        const names = fallbacks.map(definition => `"${definition.name}"`).join(', ');

        throw new ModuleRegistryError(
            `Multiple fallback modules: ${names}; at most one module may own the application catch-all.`,
        );
    }

    const ordered = [...modules.filter(definition => definition.fallback !== true), ...fallbacks];

    return Object.freeze({ modules: Object.freeze(ordered) });
}

/**
 * The HTTP machinery collected from every module's register phase.
 */
export interface ModuleHttpContributions {
    /** Request interceptors gathered in registry order. */
    readonly requestInterceptors: readonly RequestInterceptor[];

    /** The single unauthorized handler, or null when none was set. */
    readonly onUnauthorized: UnauthorizedHandler | null;

    /** Response-error handlers gathered in registry order. */
    readonly responseErrorHandlers: readonly ResponseErrorHandler[];
}

/**
 * Run every module's register hook sequentially in registry order.
 *
 * @param modules - the registry's ordered module list
 * @param context - the register-phase context, minus the collector
 * @returns the frozen HTTP contributions collected across all modules
 * @throws {@link ModuleRegistryError} when a second module sets the
 * unauthorized handler, naming both contributing modules
 */
export function registerModules(
    modules: readonly ModuleDefinition[],
    context: Omit<ModuleRegisterContext, 'http'>,
): ModuleHttpContributions {
    const requestInterceptors: RequestInterceptor[] = [];
    const responseErrorHandlers: ResponseErrorHandler[] = [];

    let onUnauthorized: UnauthorizedHandler | null = null;
    let unauthorizedOwner: string | null = null;

    for (const definition of modules) {
        if (definition.register === undefined) {
            continue;
        }

        const http: ModuleHttpRegistrar = {
            addRequestInterceptor: interceptor => {
                requestInterceptors.push(interceptor);
            },
            setUnauthorizedHandler: handler => {
                if (unauthorizedOwner !== null) {
                    throw new ModuleRegistryError(
                        `Modules "${unauthorizedOwner}" and "${definition.name}" both set the unauthorized handler; ` +
                            'only one refresh authority is allowed.',
                    );
                }

                onUnauthorized = handler;
                unauthorizedOwner = definition.name;
            },
            addResponseErrorHandler: handler => {
                responseErrorHandlers.push(handler);
            },
        };

        definition.register({ ...context, http });
    }

    return Object.freeze({
        requestInterceptors: Object.freeze(requestInterceptors),
        onUnauthorized,
        responseErrorHandlers: Object.freeze(responseErrorHandlers),
    });
}

/**
 * Run every module's boot hook sequentially in registry order.
 *
 * A rejected boot tears down the already-booted modules in LIFO order and
 * rethrows the failure.
 *
 * @param modules - the registry's ordered module list
 * @param context - the boot-phase context
 * @returns one composed teardown disposing every module in LIFO order
 */
export async function bootModules(
    modules: readonly ModuleDefinition[],
    context: ModuleBootContext,
): Promise<ModuleTeardown> {
    const teardowns: ModuleTeardown[] = [];

    for (const definition of modules) {
        if (definition.boot === undefined) {
            continue;
        }

        let teardown: ModuleTeardown | undefined;

        try {
            teardown = await definition.boot(context);
        } catch (error) {
            disposeLifo(teardowns);

            throw error;
        }

        if (teardown !== undefined) {
            teardowns.push(teardown);
        }
    }

    return () => {
        disposeLifo(teardowns);
    };
}

/**
 * Memoised, parallel loading of module translations.
 */
export interface ModuleMessageSource {
    /**
     * Load and namespace every module's translations for one locale.
     *
     * @param locale - the locale to load
     * @returns module translations keyed by module name
     */
    messages(locale: string): Promise<Record<string, LocaleMessages>>;
}

/**
 * Build a {@link ModuleMessageSource} over a module list.
 *
 * Loaders run in parallel and each locale is loaded at most once; the
 * namespacing and null-skip semantics match `collectModuleMessages`.
 *
 * @param modules - the registry's ordered module list
 * @returns the memoised message source
 */
export function createModuleMessageSource(modules: readonly ModuleDefinition[]): ModuleMessageSource {
    const cache = new Map<string, Promise<Record<string, LocaleMessages>>>();

    return {
        messages: locale => {
            const cached = cache.get(locale);

            if (cached !== undefined) {
                return cached;
            }

            const loading = loadModuleMessages(modules, locale);

            cache.set(locale, loading);

            return loading;
        },
    };
}

/**
 * Run the collected teardowns in reverse installation order.
 *
 * @param teardowns - the teardowns, in installation order
 */
function disposeLifo(teardowns: readonly ModuleTeardown[]): void {
    for (const teardown of [...teardowns].reverse()) {
        teardown();
    }
}

/**
 * Load and namespace every module's translations for one locale in parallel.
 *
 * @param modules - the registry's ordered module list
 * @param locale - the locale to load
 * @returns module translations keyed by module name
 */
async function loadModuleMessages(
    modules: readonly ModuleDefinition[],
    locale: string,
): Promise<Record<string, LocaleMessages>> {
    const loaded = await Promise.all(
        modules.map(async definition => {
            const result = definition.locales === undefined ? null : await definition.locales(locale);

            return [definition.name, result] as const;
        }),
    );

    const messages: Record<string, LocaleMessages> = {};

    for (const [name, result] of loaded) {
        if (result !== null) {
            messages[name] = result;
        }
    }

    return messages;
}
