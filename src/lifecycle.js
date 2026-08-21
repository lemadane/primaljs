/**
 * PrimalJS Lifecycle & Component Context Management
 */

import { Owner } from "./owner.js";
import { reportGlobalError } from "./app.js";

/**
 * Represents a component instance execution context, managing lifecycle hooks, reactivity ownership, and error boundaries.
 */
export class ComponentContext extends Owner {
    /**
     * @param {string} [name="Component"]
     */
    constructor(name = "Component") {
        super(name);
        /** @type {ComponentContext | null} */
        this.parent = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;
        if (this.parent) {
            this.appOnError = this.parent.appOnError;
            if (!this.parent.children.includes(this)) {
                this.parent.children.push(this);
            }
        } else {
            /** @type {((error: Error, context?: any) => void) | null} */
            this.appOnError = null;
        }
        /** @type {any[]} */
        this.templateValues = [];
        /** @type {Set<string>} */
        this.capitalTags = new Set();
    }
}

/** @type {ComponentContext[]} */
const contextStack = [];

/**
 * Pushes a component context onto the active execution stack.
 *
 * @param {ComponentContext} ctx
 */
export function pushContext(ctx) {
    contextStack.push(ctx);
}

/**
 * Pops the active component context from the execution stack.
 *
 * @returns {ComponentContext | undefined}
 */
export function popContext() {
    return contextStack.pop();
}

/**
 * Gets the currently executing ComponentContext, if any.
 *
 * @returns {ComponentContext | null}
 */
export function getCurrentContext() {
    return contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;
}

/**
 * Registers a callback to execute after the current component is mounted into the real DOM.
 *
 * @param {() => void} fn
 */
export function onMount(fn) {
    const ctx = getCurrentContext();
    if (ctx) {
        ctx.addMountHook(fn);
    }
}

/**
 * Registers a cleanup callback to execute when the current component is unmounted or destroyed.
 *
 * @param {() => void} fn
 */
export function onDestroy(fn) {
    const ctx = getCurrentContext();
    if (ctx) {
        ctx.addDestroyHook(fn);
    }
}

/**
 * Triggers mount hooks for a context and its children.
 *
 * @param {ComponentContext} ctx
 */
export function triggerMount(ctx) {
    if (!ctx || ctx.isMounted || ctx.isDestroyed) return;
    ctx.isMounted = true;

    for (const hook of ctx.mountHooks) {
        try {
            hook();
        } catch (err) {
            reportGlobalError(err, { type: "onMount", component: ctx.name });
        }
    };
    ctx.mountHooks = [];

    for (const child of [...ctx.children]) {
        triggerMount(child);
    }
}

/**
 * Destroys a component context and releases all effects, signals, and child contexts.
 *
 * @param {ComponentContext} ctx
 */
export function destroyContext(ctx) {
    if (!ctx) return;
    ctx.dispose();
}

