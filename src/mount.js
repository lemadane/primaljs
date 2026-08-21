/**
 * PrimalJS DOM Mounting & Declarative <Mount> Component Switcher Runtime
 */

import { isSignal, effect, untrack } from "./signal.js";
import {
    ComponentContext,
    pushContext,
    popContext,
    getCurrentContext,
    triggerMount,
    destroyContext
} from "./lifecycle.js";
import { convertToDOMNode } from "./html.js";

function clearAnchorRange(startAnchor, endAnchor) {
    const parent = startAnchor.parentNode;
    if (!parent) return;

    let current = startAnchor.nextSibling;
    while (current && current !== endAnchor) {
        const next = current.nextSibling;
        parent.removeChild(current);
        current = next;
    }
}

function insertAfterAnchor(startAnchor, domNode) {
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
 * Declarative `<Mount>` Component Helper.
 * Dynamically mounts a component in an owned real-DOM range without parent rerenders.
 *
 * @param {{ component: Component | import("./signal.js").Signal<Component> | null | undefined } & Record<string, any>} props
 * @returns {DocumentFragment}
 */
export function Mount(props) {
    const ctx = getCurrentContext();
    const startAnchor = document.createComment("primal:mount:start");
    const endAnchor = document.createComment("primal:mount:end");

    const fragment = document.createDocumentFragment();
    fragment.appendChild(startAnchor);
    fragment.appendChild(endAnchor);

    let activeCompFn = null;
    let activeCompCtx = null;

    function cleanupActiveComp() {
        if (activeCompCtx) {
            destroyContext(activeCompCtx);
            activeCompCtx = null;
        }
        clearAnchorRange(startAnchor, endAnchor);
    }

    const disposer = effect(() => {
        let compFn = props ? props.component : null;
        if (isSignal(compFn)) {
            compFn = compFn.value;
        } else if (typeof compFn === "function" && compFn.kind === undefined && !compFn.name) {
            compFn = compFn();
        }

        if (compFn === null || compFn === undefined) {
            cleanupActiveComp();
            activeCompFn = null;
            return;
        }

        if (typeof compFn !== "function") {
            throw new Error("<Mount> 'component' prop must be a function component, Signal, null, or undefined.");
        }

        if (compFn === activeCompFn) {
            return;
        }

        cleanupActiveComp();

        activeCompFn = compFn;
        activeCompCtx = new ComponentContext(compFn.name || "MountedComponent");
        if (ctx) {
            activeCompCtx.parent = ctx;
            if (!ctx.children.includes(activeCompCtx)) {
                ctx.children.push(activeCompCtx);
            }
            if (ctx.tryBoundary) activeCompCtx.tryBoundary = ctx.tryBoundary;
            if (ctx.templateValues) activeCompCtx.templateValues = ctx.templateValues;
            if (ctx.capitalTags) activeCompCtx.capitalTags = ctx.capitalTags;
        }

        const forwardedProps = {};
        if (props) {
            for (const key of Object.keys(props)) {
                if (key !== "component" && key !== "__templateValues" && key !== "__capitalTags" && key !== "__isControlFlowChild") {
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
            cleanupActiveComp();
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

