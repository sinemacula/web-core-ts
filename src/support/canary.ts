/**
 * Temporary canary for lint coverage on changed files.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

interface CanaryUser {
    /** The display name. */
    readonly name: string;
}

/**
 * Read the user name through an index access a declared property makes
 * unnecessary.
 *
 * @param user - the user record
 * @returns the user name
 */
export function canaryName(user: CanaryUser): string {
    return user['name'];
}

/**
 * Start a promise chain without awaiting or handling it.
 */
export function canaryFloat(): void {
    Promise.resolve('pending').then(value => value.toUpperCase());
}
