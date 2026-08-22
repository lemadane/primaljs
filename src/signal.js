/**
 * PrimalJS Fine-Grained Reactive Signal System (Signals, Computeds, Effects, Batching, Untracking)
 */

import { getCurrentContext } from "./lifecycle.js";
import { reportGlobalError } from "./app.js";

let activeEffect = null;
const effectStack = [];

let batchDepth = 0;
const pendingNotifyEffects = new Set();

/**
 * Checks if a value is a PrimalJS Signal or Computed instance.
 *
 * @param {any} val
 * @returns {boolean}
 */
export function isSignal(val) {
    return val !== null && typeof val === "object" && val.__isSignal === true;
}

function flushBatch() {
    const effectsToRun = Array.from(pendingNotifyEffects);
    pendingNotifyEffects.clear();
    for (const eff of effectsToRun) {
        if (!eff.disposed) {
            eff.run();
        }
    }
}

/**
 * Batches multiple signal updates so dependent effects run only once after completion.
 *
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export function batch(fn) {
    batchDepth++;
    try {
        return fn();
    } finally {
        batchDepth--;
        if (batchDepth === 0) {
            flushBatch();
        }
    }
}

/**
 * Runs a function without tracking signal dependencies accessed inside it.
 *
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export function untrack(fn) {
    const prevActive = activeEffect;
    activeEffect = null;
    try {
        return fn();
    } finally {
        activeEffect = prevActive;
    }
}

/**
 * A reactive state holder containing a value that notifies subscribers on change.
 *
 * @template T
 */
export class Signal {
    /**
     * @param {T} initialValue
     */
    constructor(initialValue) {
        /** @private @type {T} */
        this._value = initialValue;
        /** @type {Set<ReactiveEffect | Object>} */
        this.subscribers = new Set();
        /** @type {boolean} */
        this.__isSignal = true;
    }

    /**
     * Reads the current signal value and registers reactive dependency tracking.
     *
     * @returns {T}
     */
    get value() {
        if (activeEffect && !activeEffect.disposed) {
            this.subscribers.add(activeEffect);
            activeEffect.deps.add(this);
        }
        return this._value;
    }

    /**
     * Updates the signal value and notifies all subscribers if changed.
     *
     * @param {T} newValue
     */
    set value(newValue) {
        if (!Object.is(this._value, newValue)) {
            this._value = newValue;
            this.notify();
        }
    }

    /**
     * Notifies subscribers of a value change.
     */
    notify() {
        const subs = Array.from(this.subscribers);
        for (const sub of subs) {
            if (sub.disposed) {
                this.subscribers.delete(sub);
                continue;
            }
            if (batchDepth > 0) {
                pendingNotifyEffects.add(sub);
            } else {
                sub.run();
            }
        }
    }

    /**
     * Returns the string representation of the signal value.
     *
     * @returns {string}
     */
    toString() {
        return String(this.value);
    }
}

/**
 * Creates a reactive signal.
 *
 * @template T
 * @param {T} initialValue
 * @returns {Signal<T>}
 */
export function signal(initialValue) {
    return new Signal(initialValue);
}

/**
 * A derived reactive value computed from signal dependencies.
 *
 * @template T
 */
export class Computed {
    /**
     * @param {() => T} fn
     */
    constructor(fn) {
        /** @type {() => T} */
        this.fn = fn;
        /** @private @type {T | undefined} */
        this._value = undefined;
        /** @private @type {boolean} */
        this._dirty = true;
        /** @type {Set<ReactiveEffect | Object>} */
        this.subscribers = new Set();
        /** @type {Set<Signal<any> | Computed<any>>} */
        this.deps = new Set();
        /** @type {boolean} */
        this.__isSignal = true;
        /** @type {boolean} */
        this.__isComputed = true;
        /** @private @type {boolean} */
        this._disposed = false;

        const ctx = getCurrentContext();
        if (ctx) {
            ctx.addEffect(() => this.dispose());
        }

        this._effect = {
            run: () => {
                if (this._disposed) return;
                if (!this._dirty) {
                    this._dirty = true;
                    this.notify();
                }
            },
            deps: new Set(),
            disposed: false
        };
    }

    /**
     * Gets the computed value, recalculating it if dirty.
     *
     * @returns {T}
     */
    get value() {
        if (this._disposed) {
            return /** @type {T} */ (this._value);
        }

        if (this._dirty) {
            this._cleanupDeps();
            effectStack.push(this._effect);
            const prevActive = activeEffect;
            activeEffect = this._effect;
            try {
                this._value = this.fn();
            } catch (err) {
                const ctx = getCurrentContext();
                const tryBoundary = ctx ? ctx.tryBoundary : null;
                if (tryBoundary && typeof tryBoundary.handleError === "function") {
                    tryBoundary.handleError(err);
                    return /** @type {T} */ (this._value);
                }
                throw err;
            } finally {
                activeEffect = prevActive;
                effectStack.pop();
            }
            this._dirty = false;
        }

        if (activeEffect && !activeEffect.disposed) {
            this.subscribers.add(activeEffect);
            activeEffect.deps.add(this);
        }

        return /** @type {T} */ (this._value);
    }

    /** @private */
    _cleanupDeps() {
        for (const dep of this._effect.deps) {
            dep.subscribers.delete(this._effect);
        }
        this._effect.deps.clear();
    }

    /**
     * Notifies subscribers that the computed value may have changed.
     */
    notify() {
        if (this._disposed) return;
        const subs = Array.from(this.subscribers);
        for (const sub of subs) {
            if (sub.disposed) {
                this.subscribers.delete(sub);
                continue;
            }
            if (batchDepth > 0) {
                pendingNotifyEffects.add(sub);
            } else {
                sub.run();
            }
        }
    }

    /**
     * Disposes the computed calculation and unsubscribes from dependencies.
     */
    dispose() {
        if (this._disposed) return;
        this._disposed = true;
        this._cleanupDeps();
        this._effect.disposed = true;
        this.subscribers.clear();
    }

    /**
     * Returns string representation of the computed value.
     *
     * @returns {string}
     */
    toString() {
        return String(this.value);
    }
}

/**
 * Creates a derived reactive value.
 *
 * @template T
 * @param {() => T} fn
 * @returns {Computed<T>}
 */
export function computed(fn) {
    return new Computed(fn);
}

/**
 * Represents a reactive side-effect computation.
 */
export class ReactiveEffect {
    /**
     * @param {() => void | (() => void)} fn
     */
    constructor(fn) {
        /** @type {() => void | (() => void)} */
        this.fn = fn;
        /** @type {Set<Signal<any> | Computed<any>>} */
        this.deps = new Set();
        /** @type {boolean} */
        this.disposed = false;
        /** @type {(() => void) | null} */
        this.cleanupFn = null;
        const ctx = getCurrentContext();
        this.ctx = ctx;
        this.tryBoundary = ctx ? ctx.tryBoundary : null;
        if (ctx) {
            ctx.addEffect(() => this.dispose());
        }
        this.run();
    }

    /**
     * Runs the effect callback and records dependencies.
     */
    run() {
        if (this.disposed) return;
        this.cleanup();
        effectStack.push(this);
        const prevActive = activeEffect;
        activeEffect = this;
        try {
            const res = this.fn();
            if (typeof res === "function") {
                this.cleanupFn = res;
            }
        } catch (err) {
            if (this.tryBoundary && typeof this.tryBoundary.handleError === "function") {
                this.tryBoundary.handleError(err);
                return;
            }
            const effectCtx = this.ctx || (this.owner && (this.owner.mountHooks || this.owner.name) ? this.owner : null) || getCurrentContext();
            const handled = reportGlobalError(err, { type: "effect", ctx: effectCtx, owner: this });
            if (!handled) {
                throw err;
            }
        } finally {
            activeEffect = prevActive;
            effectStack.pop();
        }
    }

    /**
     * Executes cleanup for the previous effect run.
     */
    cleanup() {
        if (this.cleanupFn) {
            try {
                this.cleanupFn();
            } catch (err) {
                reportGlobalError(err, { type: "effect_cleanup" });
            }
            this.cleanupFn = null;
        }
        for (const dep of this.deps) {
            dep.subscribers.delete(this);
        }
        this.deps.clear();
    }

    /**
     * Disposes the reactive effect.
     */
    dispose() {
        if (this.disposed) return;
        this.cleanup();
        this.disposed = true;
    }
}

/**
 * Runs a reactive side effect whenever referenced signals change.
 *
 * @param {() => void | (() => void)} fn
 * @returns {() => void} Disposer function to stop the effect.
 */
export function effect(fn) {
    const eff = new ReactiveEffect(fn);
    return () => eff.dispose();
}

/**
 * Returns the currently active ReactiveEffect, if any.
 *
 * @returns {ReactiveEffect | null}
 */
export function getCurrentEffect() {
    return activeEffect;
}

