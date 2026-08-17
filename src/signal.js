/**
 * PrimalJS Fine-Grained Reactive Signal System (Signals, Computeds, Effects, Batching, Untracking)
 */

import { getCurrentContext } from "./lifecycle.js";
import { reportGlobalError } from "./app.js";

let activeEffect = null;
const effectStack = [];

let batchDepth = 0;
const pendingNotifyEffects = new Set();

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

export function untrack(fn) {
    const prevActive = activeEffect;
    activeEffect = null;
    try {
        return fn();
    } finally {
        activeEffect = prevActive;
    }
}

export class Signal {
    constructor(initialValue) {
        this._value = initialValue;
        this.subscribers = new Set();
        this.__isSignal = true;
    }

    get value() {
        if (activeEffect && !activeEffect.disposed) {
            this.subscribers.add(activeEffect);
            activeEffect.deps.add(this);
        }
        return this._value;
    }

    set value(newValue) {
        if (!Object.is(this._value, newValue)) {
            this._value = newValue;
            this.notify();
        }
    }

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

    toString() {
        return String(this.value);
    }
}

export function signal(initialValue) {
    return new Signal(initialValue);
}

export class Computed {
    constructor(fn) {
        this.fn = fn;
        this._value = undefined;
        this._dirty = true;
        this.subscribers = new Set();
        this.deps = new Set();
        this.__isSignal = true;
        this.__isComputed = true;
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

    get value() {
        if (this._disposed) {
            return this._value;
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
                    return this._value;
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

        return this._value;
    }

    _cleanupDeps() {
        for (const dep of this._effect.deps) {
            dep.subscribers.delete(this._effect);
        }
        this._effect.deps.clear();
    }

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

    dispose() {
        if (this._disposed) return;
        this._disposed = true;
        this._cleanupDeps();
        this._effect.disposed = true;
        this.subscribers.clear();
    }

    toString() {
        return String(this.value);
    }
}

export function computed(fn) {
    return new Computed(fn);
}

export class ReactiveEffect {
    constructor(fn) {
        this.fn = fn;
        this.deps = new Set();
        this.disposed = false;
        this.cleanupFn = null;
        const ctx = getCurrentContext();
        this.tryBoundary = ctx ? ctx.tryBoundary : null;
        if (ctx) {
            ctx.addEffect(() => this.dispose());
        }
        this.run();
    }

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
            reportGlobalError(err, { type: "effect" });
            throw err;
        } finally {
            activeEffect = prevActive;
            effectStack.pop();
        }
    }

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

    dispose() {
        if (this.disposed) return;
        this.cleanup();
        this.disposed = true;
    }
}

export function effect(fn) {
    const eff = new ReactiveEffect(fn);
    return () => eff.dispose();
}

export function getCurrentEffect() {
    return activeEffect;
}
