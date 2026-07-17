/**
 * Filter-expression types for the laravel-api-toolkit 2.x wire protocol.
 *
 * These types describe the **shape** of the filter tree that {@link ApiQuery}
 * assembles and JSON-encodes into the `filters` URL query parameter. A fully
 * recursive TypeScript type would collide with the index-signature restrictions
 * that `noUncheckedIndexedAccess` imposes, so the outermost `FilterTree` is a
 * loosely-typed `Record`; the builder methods on `ApiQuery` are the typed,
 * ergonomic surface.
 *
 * ## Supported tree shapes
 *
 * ### Equality (shorthand)
 * ```json
 * { "name": "Alice" }
 * ```
 *
 * ### Comparison operators
 * ```json
 * { "age": { "$ge": 18, "$le": 65 } }
 * ```
 * All operator keys are `$`-prefixed: `$eq`, `$neq`, `$gt`, `$lt`, `$ge`,
 * `$le`, `$like`, `$in`, `$between`, `$contains`, `$null`, `$notNull`.
 *
 * ### Logical groups
 * ```json
 * { "$and": { "status": "active", "role": "admin" } }
 * { "$or":  { "name": { "$like": "alice" }, "email": { "$like": "alice" } } }
 * ```
 * Protocol limitation: each field may appear **once** inside a group object.
 *
 * ### Relation filters (nested)
 * ```json
 * { "posts": { "title": { "$like": "news" } } }
 * ```
 *
 * ### Relation existence
 * Bare array form: `{ "$has": ["posts", "comments"] }`
 * Conditioned form: `{ "$has": { "posts": { "published": true } } }`
 * Mixed form (bare + conditioned): use the object form with `{}` for bare
 * relations - `{ "$has": { "posts": {}, "comments": { "title": "X" } } }`.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

/** A primitive scalar value accepted as a filter operand. */
export type FilterScalar = string | number | boolean;

/**
 * Comparison and membership operators supported by the toolkit wire protocol.
 *
 * Multiple operators on the same field are merged into one object:
 * `{ "$ge": 18, "$le": 65 }`.
 */
export interface FilterOperators {
    // biome-ignore-start lint/style/useNamingConvention: toolkit keys
    readonly $eq?: FilterScalar;
    readonly $neq?: FilterScalar;
    readonly $gt?: FilterScalar;
    readonly $lt?: FilterScalar;
    readonly $ge?: FilterScalar;
    readonly $le?: FilterScalar;
    readonly $like?: string;
    readonly $in?: readonly FilterScalar[];
    readonly $between?: readonly [FilterScalar, FilterScalar];
    readonly $contains?: FilterScalar | readonly FilterScalar[];
    readonly $null?: true;
    readonly $notNull?: true;
    // biome-ignore-end lint/style/useNamingConvention: toolkit keys
}

/**
 * The assembled filter tree passed to `JSON.stringify` and sent as the
 * `filters` query parameter.
 *
 * Assembled exclusively by {@link ApiQuery}; callers interact through the typed
 * builder API, not by constructing this record directly.
 */
export type FilterTree = Record<string, unknown>;
