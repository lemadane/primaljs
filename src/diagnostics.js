/**
 * PrimalJS Development Diagnostics & Error Subsystem
 */

/**
 * Custom Error class for PrimalJS framework errors with diagnostic context metadata.
 */
export class PrimalJSError extends Error {
    /**
     * @param {string} message
     * @param {Record<string, any>} [context={}]
     */
    constructor(message, context = {}) {
        super(`PrimalJS: ${message}`);
        this.name = "PrimalJSError";
        /** @type {Record<string, any>} */
        this.context = context;
    }
}

let isDevMode = false;

/**
 * Enables or disables PrimalJS dev diagnostic mode.
 *
 * @param {boolean} enabled
 */
export function setDevMode(enabled) {
    isDevMode = Boolean(enabled);
}

/**
 * Returns whether dev diagnostic mode is currently active.
 *
 * @returns {boolean}
 */
export function isDev() {
    return isDevMode;
}

/**
 * Logs a diagnostic warning if dev mode is enabled.
 *
 * @param {string} message
 * @param {Record<string, any>} [context={}]
 */
export function warnDiagnostic(message, context = {}) {
    if (isDevMode) {
        console.warn(`PrimalJS Warning: ${message}`, context);
    }
}

/**
 * Asserts a condition, throwing a PrimalJSError if false.
 *
 * @param {any} condition
 * @param {string} message
 * @param {Record<string, any>} [context={}]
 */
export function assertDiagnostic(condition, message, context = {}) {
    if (!condition) {
        throw new PrimalJSError(message, context);
    }
}

