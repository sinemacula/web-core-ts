/**
 * Shared playground failure.
 *
 * The playground is the reference application that exercises the kernel. Its
 * own modules throw this rather than the base `Error`, so a failure raised by
 * application code stays attributable and distinct from a kernel or transport
 * error.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

/**
 * A failure raised by the playground application's own code.
 */
export class PlaygroundError extends Error {

    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'PlaygroundError';
    }
}
