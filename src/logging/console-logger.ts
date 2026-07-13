/**
 * Console logger adapter.
 *
 * Writes log entries to the browser console for use during development. Not
 * intended for production — swap in a real provider adapter via the Logger
 * port when deploying.
 *
 * @author Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright 2026 Sine Macula Limited
 */

import type { LogFields, Logger, LogLevel } from './logger';

const LEVEL_ORDER: Readonly<Record<LogLevel, number>> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

/**
 * A logger that writes to the browser console, dropping entries below a
 * configured minimum level.
 *
 * `console.log` and `console.debug` are disallowed by lint tooling, so both
 * `debug` and `info` write via `console.info`; `warn` and `error` write via
 * their matching console method.
 */
export class ConsoleLogger implements Logger {
    readonly #minimumLevel: LogLevel;

    /**
     * @param minimumLevel - the lowest level written to the console (default 'debug')
     */
    constructor(minimumLevel: LogLevel = 'debug') {
        this.#minimumLevel = minimumLevel;
    }

    debug(message: string, fields?: LogFields): void {
        this.#write('debug', console.info, message, fields);
    }

    info(message: string, fields?: LogFields): void {
        this.#write('info', console.info, message, fields);
    }

    warn(message: string, fields?: LogFields): void {
        this.#write('warn', console.warn, message, fields);
    }

    error(message: string, fields?: LogFields): void {
        this.#write('error', console.error, message, fields);
    }

    /**
     * Write an entry to the given console sink, dropping it when the level
     * falls below the configured minimum.
     *
     * @param level - the level of this entry
     * @param sink - the console method to write through
     * @param message - the human-readable message
     * @param fields - structured key-value pairs to attach to the entry
     */
    #write(level: LogLevel, sink: (...args: unknown[]) => void, message: string, fields?: LogFields): void {
        if (LEVEL_ORDER[level] < LEVEL_ORDER[this.#minimumLevel]) {
            return;
        }

        sink(`[Logger:${level}]`, message, ...(fields !== undefined ? [fields] : []));
    }
}
