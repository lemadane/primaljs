/**
 * PrimalJS Declarative <Keep> DOM / Component Lifecycle Preservation Component
 * Preserves previously mounted dynamic component instances and DOM subtrees instead of destroying them when inactive.
 */

import { getCurrentContext, destroyContext, deactivateContext, reactivateContext } from "./lifecycle.js";
import { isSignal } from "./signal.js";

/**
 * Manages cached component subtrees, DOM ranges, and optional LRU eviction for <Keep>.
 */
export class KeepCache {
    /**
     * @param {number | null} [max=null]
     */
    constructor(max = null) {
        /** @type {number | null} */
        this.max = typeof max === "number" && max > 0 ? max : null;
        /** @type {Map<any, { key: any, compCtx: import("./lifecycle.js").ComponentContext, fragment: DocumentFragment | null, nodes: Node[] }>} */
        this.items = new Map();
        /** @type {any[]} */
        this.accessOrder = [];
    }

    /**
     * Checks if a key exists in the cache.
     * @param {any} key
     * @returns {boolean}
     */
    has(key) {
        return this.items.has(key);
    }

    /**
     * Retrieves a cached item and updates its LRU access position.
     * @param {any} key
     * @returns {{ key: any, compCtx: import("./lifecycle.js").ComponentContext, fragment: DocumentFragment | null, nodes: Node[] } | undefined}
     */
    get(key) {
        if (!this.items.has(key)) return undefined;
        const idx = this.accessOrder.indexOf(key);
        if (idx !== -1) {
            this.accessOrder.splice(idx, 1);
        }
        this.accessOrder.push(key);
        return this.items.get(key);
    }

    /**
     * Stores a component subtree in the cache and performs LRU eviction if capacity is exceeded.
     * @param {any} key
     * @param {{ key: any, compCtx: import("./lifecycle.js").ComponentContext, fragment: DocumentFragment | null, nodes: Node[] }} item
     */
    set(key, item) {
        if (this.items.has(key)) {
            const idx = this.accessOrder.indexOf(key);
            if (idx !== -1) this.accessOrder.splice(idx, 1);
        }
        this.items.set(key, item);
        this.accessOrder.push(key);

        if (this.max !== null && this.items.size > this.max) {
            this.evictLRU();
        }
    }

    /**
     * Evicts the least recently used inactive cached component instance.
     */
    evictLRU() {
        if (this.accessOrder.length === 0) return;
        const lruKey = this.accessOrder.shift();
        const item = this.items.get(lruKey);
        if (item) {
            this.items.delete(lruKey);
            if (item.compCtx) {
                destroyContext(item.compCtx);
            }
            if (item.nodes) {
                for (const node of item.nodes) {
                    if (node && node.parentNode) {
                        node.parentNode.removeChild(node);
                    }
                }
            }
        }
    }

    /**
     * Destroys all cached subtrees, disposes contexts, and cleans up DOM.
     */
    destroy() {
        for (const item of this.items.values()) {
            if (item.compCtx) {
                destroyContext(item.compCtx);
            }
            if (item.nodes) {
                for (const node of item.nodes) {
                    if (node && node.parentNode) {
                        node.parentNode.removeChild(node);
                    }
                }
            }
        }
        this.items.clear();
        this.accessOrder = [];
    }
}

/**
 * Traverses context hierarchy upwards to locate surrounding <Keep> cache instance.
 *
 * @param {import("./lifecycle.js").ComponentContext | null} ctx
 * @returns {KeepCache | null}
 */
export function getKeepCache(ctx) {
    let curr = ctx;
    while (curr) {
        if (curr._keepCache) {
            return curr._keepCache;
        }
        curr = curr.parent;
    }
    return null;
}

/**
 * Built-in Declarative <Keep> Component.
 * Preserves dynamic component instances and DOM nodes across switch operations.
 *
 * @param {{ max?: number, children?: any, __templateValues?: any[] }} props
 * @returns {any}
 */
export function Keep(props) {
    props = props || {};
    const ctx = getCurrentContext();

    const rawMax = props.max !== undefined ? props.max : props.Max;
    const maxLimit = typeof rawMax === "number" && rawMax > 0 ? rawMax : null;

    const keepCache = new KeepCache(maxLimit);
    if (ctx) {
        ctx._keepCache = keepCache;
        ctx.addDestroyHook(() => {
            keepCache.destroy();
        });
    }

    return props.children;
}
