/**
 * PrimalJS Ref API
 */

export class Ref {
    constructor(initialValue = null) {
        this.current = initialValue;
    }
}

export function ref(initialValue = null) {
    if (typeof initialValue === "function") {
        return initialValue;
    }
    return new Ref(initialValue);
}

export function isRef(val) {
    return val instanceof Ref || (val !== null && typeof val === "object" && "current" in val);
}
