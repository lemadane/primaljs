/**
 * PrimalJS DOM Mounting & Declarative <Load> Component Switcher Runtime
 */

import { isSignal, effect, untrack } from "./signal.js";
import {
    ComponentContext,
    pushContext,
    popContext,
    getCurrentContext,
    triggerMount,
    destroyContext,
    deactivateContext,
    reactivateContext
} from "./lifecycle.js";
import { convertToDOMNode } from "./html.js";
import { getKeepCache } from "./keep.js";

export function clearAnchorRange(startAnchor, endAnchor) {
    const parent = startAnchor.parentNode;
    if (!parent) return;

    let current = startAnchor.nextSibling;
    while (current && current !== endAnchor) {
        const next = current.nextSibling;
        parent.removeChild(current);
        current = next;
    }
}

export function insertAfterAnchor(startAnchor, domNode) {
    const parent = startAnchor.parentNode;
    if (!parent || !domNode) return;
    parent.insertBefore(domNode, startAnchor.nextSibling);
}

/**
 * @typedef {Object} AppHandle
 * @property {() => void} dispose Disposes the mounted application and cleans up reactive subscriptions.
 */

/**
 * @typedef {(props?: any) => import("./html.js").TemplateResult | Element | DocumentFragment | string | null} Component
 */

/**
 * Declarative `<Load>` Component Helper.
 * Dynamically mounts a component in an owned real-DOM range without parent rerenders.
 *
 * @param {{ component: Component | import("./signal.js").Signal<Component> | null | undefined } & Record<string, any>} props
 * @returns {DocumentFragment}
 */
export function Load(props) {
    const ctx = getCurrentContext();
    const startAnchor = document.createComment("primal:load:start");
    const endAnchor = document.createComment("primal:load:end");

    const fragment = document.createDocumentFragment();
    fragment.appendChild(startAnchor);
    fragment.appendChild(endAnchor);

    let activeCompFn = null;
    let activeCompCtx = null;
    let activeCacheKey = null;

    const keepCache = getKeepCache(ctx);

    function detachActiveComp() {
        if (!activeCompCtx) return;

        if (keepCache && activeCacheKey !== null) {
            const nodes = [];
            const frag = document.createDocumentFragment();
            const parent = startAnchor.parentNode;
            if (parent) {
                let current = startAnchor.nextSibling;
                while (current && current !== endAnchor) {
                    const next = current.nextSibling;
                    nodes.push(current);
                    frag.appendChild(current);
                    current = next;
                }
            }

            deactivateContext(activeCompCtx);

            keepCache.set(activeCacheKey, {
                key: activeCacheKey,
                compCtx: activeCompCtx,
                fragment: frag,
                nodes: nodes
            });
        } else {
            destroyContext(activeCompCtx);
            clearAnchorRange(startAnchor, endAnchor);
        }

        activeCompCtx = null;
        activeCompFn = null;
        activeCacheKey = null;
    }

    const disposer = effect(() => {
        let compFn = props ? props.component : null;
        if (isSignal(compFn)) {
            compFn = compFn.value;
        } else if (typeof compFn === "function" && compFn.kind === undefined && !compFn.name) {
            compFn = compFn();
        }

        if (compFn === null || compFn === undefined) {
            detachActiveComp();
            return;
        }

        if (typeof compFn !== "function") {
            throw new Error("<Load> 'component' prop must be a function component, Signal, null, or undefined.");
        }

        let rawKey = props ? (props.key !== undefined ? props.key : props.Key) : undefined;
        if (rawKey === undefined && props && props.id !== undefined) {
            rawKey = props.id;
        }
        if (isSignal(rawKey)) {
            rawKey = rawKey.value;
        } else if (typeof rawKey === "function" && !rawKey.name && rawKey.kind === undefined) {
            rawKey = rawKey();
        }

        const cacheKey = rawKey !== undefined && rawKey !== null
            ? `${compFn.name || "Component"}:${rawKey}`
            : compFn;

        if (compFn === activeCompFn && cacheKey === activeCacheKey) {
            return;
        }

        if (keepCache && keepCache.has(cacheKey)) {
            const cached = keepCache.get(cacheKey);
            detachActiveComp();

            activeCompFn = compFn;
            activeCompCtx = cached.compCtx;
            activeCacheKey = cacheKey;

            const parent = startAnchor.parentNode;
            if (parent && cached.fragment) {
                parent.insertBefore(cached.fragment, endAnchor);
                cached.fragment = null;
            }

            reactivateContext(activeCompCtx);
            return;
        }

        detachActiveComp();

        activeCompFn = compFn;
        activeCacheKey = cacheKey;
        activeCompCtx = new ComponentContext(compFn.name || "MountedComponent");
        if (ctx) {
            activeCompCtx.parent = ctx;
            if (!ctx.children.includes(activeCompCtx)) {
                ctx.children.push(activeCompCtx);
            }
            if (ctx.templateValues) activeCompCtx.templateValues = ctx.templateValues;
            if (ctx.capitalTags) activeCompCtx.capitalTags = ctx.capitalTags;
        }

        const forwardedProps = {};
        if (props) {
            for (const key of Object.keys(props)) {
                if (key !== "component" && key !== "key" && key !== "Key" && key !== "__templateValues" && key !== "__capitalTags") {
                    forwardedProps[key] = props[key];
                }
            }
        }
        forwardedProps.__templateValues = props ? props.__templateValues : [];
        forwardedProps.__capitalTags = props ? props.__capitalTags : new Set();

        pushContext(activeCompCtx);
        let compDOM;
        try {
            compDOM = untrack(() => {
                const compResult = compFn(forwardedProps);
                return convertToDOMNode(compResult, activeCompCtx);
            });
        } finally {
            popContext();
        }

        if (compDOM) {
            insertAfterAnchor(startAnchor, compDOM);
            triggerMount(activeCompCtx);
        }
    });

    if (ctx) {
        ctx.addEffect(() => {
            disposer();
            detachActiveComp();
        });
    }

    return fragment;
}

/**
 * Mounts a PrimalJS root component to a target DOM selector or Element.
 *
 * @param {Component} Component
 * @param {string | Element} target
 * @param {{ onError?: (error: Error, context?: any) => void }} [options]
 * @returns {AppHandle}
 */
export function mount(Component, target, options = {}) {
    const targetEl = typeof target === "string" ? document.querySelector(target) : target;
    if (!targetEl) {
        throw new Error(`Mount target not found: ${target}`);
    }

    if (targetEl._primalCtx) {
        unmount(targetEl);
    }

    const rootCtx = new ComponentContext(Component.name || "Root");
    if (options && typeof options.onError === "function") {
        rootCtx.appOnError = options.onError;
    }
    targetEl._primalCtx = rootCtx;

    try {
        pushContext(rootCtx);
        let result;
        try {
            result = typeof Component === "function" ? Component() : Component;
        } finally {
            popContext();
        }

        targetEl.innerHTML = "";
        const domNode = convertToDOMNode(result, rootCtx);
        if (domNode) {
            targetEl.appendChild(domNode);
        }

        triggerMount(rootCtx);
    } catch (err) {
        delete targetEl._primalCtx;
        destroyContext(rootCtx);
        targetEl.innerHTML = "";
        throw err;
    }

    const appHandle = {
        dispose() {
            unmount(targetEl);
        }
    };

    return appHandle;
}

/**
 * Unmounts a mounted PrimalJS application from a target element and cleans up context.
 *
 * @param {string | Element} target
 */
export function unmount(target) {
    const targetEl = typeof target === "string" ? document.querySelector(target) : target;
    if (!targetEl) return;

    if (targetEl._primalCtx) {
        const ctx = targetEl._primalCtx;
        delete targetEl._primalCtx;
        destroyContext(ctx);
    }
    targetEl.innerHTML = "";
}
