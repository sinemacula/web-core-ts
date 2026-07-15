/**
 * Bootstrap preset failure.
 *
 * Thrown when the application preset is asked to boot with an option
 * combination that cannot work, so misconfiguration surfaces loudly at boot
 * instead of silently producing an application with missing behaviour.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

/**
 * An invalid bootstrap preset option combination.
 */
export class WebCoreAppError extends Error {
    /**
     * @param message - description of the invalid option combination
     */
    constructor(message: string) {
        super(message);
        this.name = 'WebCoreAppError';
    }
}
