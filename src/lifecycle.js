/**
 * PrimalJS Lifecycle & Component Context Management
 */

import { Owner } from "./owner.js";

export class ComponentContext extends Owner {
    constructor(name = "Component") {
        super(name);
        this.parent = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;
        if (this.parent) {
            this.tryBoundary = this.parent.tryBoundary;
            if (!this.parent.children.includes(this)) {
                this.parent.children.push(this);
            }
        }
        this.templateValues = [];
        this.capitalTags = new Set();
    }
}

const contextStack = [];

export function pushContext(ctx) {
    contextStack.push(ctx);
}

export function popContext() {
    return contextStack.pop();
}

export function getCurrentContext() {
    return contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;
}

export function onMount(fn) {
    const ctx = getCurrentContext();
    if (ctx) {
        ctx.addMountHook(fn);
    }
}

export function onDestroy(fn) {
    const ctx = getCurrentContext();
    if (ctx) {
        ctx.addDestroyHook(fn);
    }
}

export function triggerMount(ctx) {
    if (!ctx || ctx.isMounted || ctx.isDestroyed) return;
    ctx.isMounted = true;

    for (const hook of ctx.mountHooks) {
        try {
            hook();
        } catch (err) {
            if (ctx.tryBoundary && typeof ctx.tryBoundary.handleError === "function" && !ctx.tryBoundary.isDestroyed) {
                ctx.tryBoundary.handleError(err);
            } else {
                console.error(`Error in onMount hook of ${ctx.name}:`, err);
            }
        }
    }
    ctx.mountHooks = [];

    for (const child of ctx.children) {
        triggerMount(child);
    }
}

export function destroyContext(ctx) {
    if (!ctx) return;
    ctx.dispose();
}
