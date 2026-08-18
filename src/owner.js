/**
 * PrimalJS Owner — Shared Ownership & Resource Disposal Tree
 */

import { reportGlobalError } from "./app.js";

export class Owner {
    constructor(name = "Owner") {
        this.name = name;
        this.parent = null;
        this.children = [];
        this.effects = [];
        this.destroyHooks = [];
        this.mountHooks = [];
        this.tryBoundary = null;
        this.isDestroyed = false;
        this.isMounted = false;
    }

    addEffect(disposer) {
        if (typeof disposer === "function") {
            this.effects.push(disposer);
        }
    }

    addDestroyHook(hook) {
        if (typeof hook === "function") {
            this.destroyHooks.push(hook);
        }
    }

    addMountHook(hook) {
        if (typeof hook === "function") {
            this.mountHooks.push(hook);
        }
    }

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
