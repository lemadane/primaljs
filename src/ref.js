/**
 * PrimalJS Ref API
 */

/**
 * Holds a mutable reference container with a `.current` property.
 *
 * @template T
 */
export class Ref {
    /**
     * @param {T | null} [initialValue=null]
     */
    constructor(initialValue = null) {
        /** @type {T | null} */
        this.current = initialValue;
    }
}

/**
 * Creates a mutable reference container, or returns the initial function directly if passed.
 *
 * @template T
 * @param {T} [initialValue=null]
 * @returns {T extends Function ? T : Ref<T>}
 */
export function ref(initialValue = null) {
    if (typeof initialValue === "function") {
        return /** @type {any} */ (initialValue);
    }
    return /** @type {any} */ (new Ref(initialValue));
}

/**
 * Checks whether a value is a Ref object.
 *
 * @param {any} val
 * @returns {boolean}
 */
export function isRef(val) {
    return val instanceof Ref || (val !== null && typeof val === "object" && "current" in val);
}

