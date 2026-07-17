/**
 * Runtime configuration validation.
 *
 * Enforces that required runtime keys are present before the application boots.
 * In production, missing keys indicate a broken deployment, so the application
 * must fail loudly rather than silently boot against incorrect defaults.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

/**
 * Keys that must be present and non-empty in the runtime environment document
 * for a production deployment to be considered valid.
 */
export const REQUIRED_RUNTIME_KEYS = ['API_URL', 'APP_URL', 'APP_ENV', 'APP_VERSION'] as const;

/**
 * Thrown when required runtime configuration keys are missing or empty.
 */
export class ConfigurationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConfigurationError';
    }
}

/**
 * Assert that all required runtime keys are present and non-empty.
 *
 * @param values - the resolved runtime environment values
 * @throws {ConfigurationError} when one or more required keys are missing or
 * empty
 */
export function assertRuntimeConfig(values: Readonly<Record<string, string>>): void {
    const missing = REQUIRED_RUNTIME_KEYS.filter(key => {
        const value = values[key];

        return value === undefined || value === '';
    });

    if (missing.length > 0) {
        throw new ConfigurationError(`Runtime configuration is missing required keys: ${missing.join(', ')}.`);
    }
}
