/**
 * Environment source backed by a plain object.
 *
 * Used for the runtime environment document (`runtime-env.json`) and as a
 * convenient stub in tests.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { EnvironmentSource } from './environment';

/**
 * Read environment values from an in-memory record.
 */
export class ObjectEnvironmentSource implements EnvironmentSource {
    readonly #values: Readonly<Record<string, string>>;

    constructor(values: Readonly<Record<string, string>>) {
        this.#values = values;
    }

    get(key: string): string | undefined {
        return this.#values[key];
    }
}
