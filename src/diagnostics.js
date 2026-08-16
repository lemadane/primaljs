/**
 * PrimalJS Development Diagnostics & Error Subsystem
 */

export class PrimalJSError extends Error {
    constructor(message, context = {}) {
        super(`PrimalJS: ${message}`);
        this.name = "PrimalJSError";
        this.context = context;
    }
}

let isDevMode = false;

export function setDevMode(enabled) {
    isDevMode = Boolean(enabled);
}

export function isDev() {
    return isDevMode;
}

export function warnDiagnostic(message, context = {}) {
    if (isDevMode) {
        console.warn(`PrimalJS Warning: ${message}`, context);
    }
}

export function assertDiagnostic(condition, message, context = {}) {
    if (!condition) {
        throw new PrimalJSError(message, context);
    }
}
