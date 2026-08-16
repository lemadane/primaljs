/**
 * PrimalJS Owner — Shared Ownership & Resource Disposal Tree
 */

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

        for (const child of this.children) {
            child.dispose();
        }
        this.children = [];

        for (const hook of this.destroyHooks) {
            try {
                hook();
            } catch (err) {
                console.error(`Error in onDestroy hook of ${this.name}:`, err);
            }
        }
        this.destroyHooks = [];

        for (const disposer of this.effects) {
            try {
                disposer();
            } catch (err) {
                console.error(`Error disposing effect in ${this.name}:`, err);
            }
        }
        this.effects = [];
        this.mountHooks = [];
    }
}
