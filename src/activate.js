/**
 * PrimalJS DOM Activation Engine
 * Attaches Signal bindings, event listeners, and lifecycle hooks directly to existing pre-rendered HTML DOM without clearing innerHTML or recreating nodes.
 */

import { ComponentContext, pushContext, popContext, triggerMount, destroyContext } from "./lifecycle.js";
import { unmount } from "./mount.js";
import { activateTemplate, TemplateResult } from "./html.js";

export function activate(App, target, initialState = {}, options = {}) {
    if (typeof document === "undefined") return null;

    const targetEl = typeof target === "string" ? document.querySelector(target) : target;
    if (!targetEl) {
        throw new Error(`[PrimalJS activate] Target element '${target}' not found in document.`);
    }

    if (targetEl._primalCtx) {
        unmount(targetEl);
    }

    const stateScript = document.getElementById("primal-state");
    let serializedState = initialState;
    if (stateScript && stateScript.textContent) {
        try {
            serializedState = { ...initialState, ...JSON.parse(stateScript.textContent) };
        } catch (err) {
            console.warn("[PrimalJS activate] Failed to parse #primal-state JSON:", err);
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
    if (options && typeof options.onError === "function") {
        rootCtx.appOnError = options.onError;
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
            activateTemplate(targetEl, compResult, rootCtx);
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
            unmount(targetEl);
        }
    };

    return appHandle;
}
