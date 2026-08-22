/**
 * PrimalJS Client-Side DOM Activation Engine: hydrate()
 * Attaches Signal bindings, reactive effects, event listeners, refs, and ComponentContext lifecycle hooks
 * directly to an existing browser DOM subtree without recreating matching HTML nodes or clearing innerHTML.
 */

import { ComponentContext, pushContext, popContext, triggerMount, destroyContext } from "./lifecycle.js";
import { mount, unmount } from "./load.js";
import { activateTemplate, TemplateResult } from "./html.js";

/**
 * Hydrates/adopts an existing DOM subtree in the browser and connects it to a PrimalJS component/template.
 *
 * @param {import("./load.js").Component} App Component function.
 * @param {string | Element} target Selector string or DOM Element container.
 * @param {Record<string, any> | { onError?: (error: Error, context?: any) => void }} [initialPropsOrOptions={}]
 * @param {{ onError?: (error: Error, context?: any) => void }} [options={}]
 * @returns {import("./load.js").AppHandle | null}
 */
export function hydrate(App, target, initialPropsOrOptions = {}, options = {}) {
    if (typeof document === "undefined") return null;

    let initialProps = {};
    let opts = {};

    if (typeof initialPropsOrOptions === "object" && initialPropsOrOptions !== null) {
        if ("onError" in initialPropsOrOptions && Object.keys(initialPropsOrOptions).every(k => k === "onError" || k === "dev")) {
            opts = initialPropsOrOptions;
        } else {
            initialProps = initialPropsOrOptions;
            opts = options || {};
        }
    }

    const targetEl = typeof target === "string" ? document.querySelector(target) : target;
    if (!targetEl) {
        throw new Error(`[PrimalJS hydrate] Target element '${target}' not found in document.`);
    }

    // Check if target is already managed by PrimalJS
    if (targetEl._primalCtx) {
        if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
            throw new Error(`[PrimalJS hydrate]: Target '${typeof target === "string" ? target : targetEl.tagName}' is already managed by PrimalJS.`);
        } else {
            unmount(targetEl);
        }
    }

    // Check for empty target -> fallback to mount() if target has no DOM children
    const hasChildren = Array.from(targetEl.childNodes).some(n => {
        if (n.nodeType === Node.ELEMENT_NODE) return true;
        if (n.nodeType === Node.TEXT_NODE && n.nodeValue.trim().length > 0) return true;
        return false;
    });

    if (!hasChildren) {
        if (typeof console !== "undefined" && console.warn) {
            console.warn(`[PrimalJS hydrate]: Target container has no existing DOM to hydrate; falling back to mount().`);
        }
        return mount(App, targetEl, initialProps);
    }

    const stateScript = document.getElementById("primal-state");
    let serializedState = initialProps;
    if (stateScript && stateScript.textContent) {
        try {
            serializedState = { ...initialProps, ...JSON.parse(stateScript.textContent) };
        } catch (err) {
            console.warn("[PrimalJS hydrate] Failed to parse #primal-state JSON:", err);
        }
    }

    // Hydrate state markers on existing DOM elements without clearing container
    const bindElements = targetEl.querySelectorAll("[data-primal-bind]");
    if (bindElements.length > 0) {
        for (const el of bindElements) {
            const bindId = el.getAttribute("data-primal-bind");
            if (serializedState[bindId] !== undefined && el.textContent !== String(serializedState[bindId])) {
                el.textContent = serializedState[bindId];
            }
        }
    }

    const rootCtx = new ComponentContext(App.name || "Root");
    if (opts && typeof opts.onError === "function") {
        rootCtx.appOnError = opts.onError;
    }
    targetEl._primalCtx = rootCtx;

    try {
        let compResult;
        pushContext(rootCtx);
        try {
            if (typeof App === "function") {
                compResult = App(serializedState);
            }
        } finally {
            popContext();
        }

        if (compResult && compResult instanceof TemplateResult) {
            activateTemplate(targetEl, compResult, rootCtx, false);
        }

        // Trigger onMount hooks recursively on activated DOM context
        triggerMount(rootCtx);
    } catch (err) {
        delete targetEl._primalCtx;
        destroyContext(rootCtx);
        throw err;
    }

    const appHandle = {
        dispose() {
            if (targetEl._primalCtx === rootCtx) {
                delete targetEl._primalCtx;
                destroyContext(rootCtx);
            }
        }
    };

    return appHandle;
}

/**
 * Activates/hydrates a pre-rendered DOM subtree without destroying or recreating existing HTML nodes.
 * Alias for hydrate().
 */
export function activate(App, target, initialState = {}, options = {}) {
    return hydrate(App, target, initialState, options);
}
