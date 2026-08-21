/**
 * PrimalJS Owner — Shared Ownership & Resource Disposal Tree
 */

import { reportGlobalError } from "./app.js";

/**
 * Shared ownership tree node for tracking sub-effects, lifecycle hooks, and child context disposal.
 */
export class Owner {
    /**
     * @param {string} [name="Owner"]
     */
    constructor(name = "Owner") {
        /** @type {string} */
        this.name = name;
        /** @type {Owner | null} */
        this.parent = null;
        /** @type {Owner[]} */
        this.children = [];
        /** @type {(() => void)[]} */
        this.effects = [];
        /** @type {(() => void)[]} */
        this.destroyHooks = [];
        /** @type {(() => void)[]} */
        this.mountHooks = [];
        /** @type {any} */
        this.tryBoundary = null;
        /** @type {boolean} */
        this.isDestroyed = false;
        /** @type {boolean} */
        this.isMounted = false;
    }

    /**
     * Adds an effect disposer to be called when this owner is disposed.
     *
     * @param {() => void} disposer
     */
    addEffect(disposer) {
        if (typeof disposer === "function") {
            this.effects.push(disposer);
        }
    }

    /**
     * Adds an onDestroy hook callback.
     *
     * @param {() => void} hook
     */
    addDestroyHook(hook) {
        if (typeof hook === "function") {
            this.destroyHooks.push(hook);
        }
    }

    /**
     * Adds an onMount hook callback.
     *
     * @param {() => void} hook
     */
    addMountHook(hook) {
        if (typeof hook === "function") {
            this.mountHooks.push(hook);
        }
    }

    /**
     * Disposes this owner, invoking destroy hooks, effect disposers, and disposing child owners recursively.
     */
    dispose() {
        if (this.isDestroyed) return;
        this.isDestroyed = true;

        if (this.parent && Array.isArray(this.parent.children)) {
            const idx = this.parent.children.indexOf(this);
            if (idx !== -1) {
                this.parent.children.splice(idx, 1);
            }
        }

        for (const child of [...this.children]) {
            child.dispose();
        }
        this.children = [];

        for (const hook of this.destroyHooks) {
            try {
                hook();
            } catch (err) {
                reportGlobalError(err, { type: "onDestroy", component: this.name, ctx: this });
            }
        }
        this.destroyHooks = [];

        for (const disposer of this.effects) {
            try {
                disposer();
            } catch (err) {
                reportGlobalError(err, { type: "effect_cleanup", component: this.name, ctx: this });
            }
        }
        this.effects = [];
        this.mountHooks = [];
    }
}

