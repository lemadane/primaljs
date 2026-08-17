/**
 * PrimalJS DOM Mounting & Root Application Disposal Runtime
 */

import { ComponentContext, pushContext, popContext, triggerMount, destroyContext } from "./lifecycle.js";
import { convertToDOMNode } from "./html.js";

export function mount(Component, target) {
    const targetEl = typeof target === "string" ? document.querySelector(target) : target;
    if (!targetEl) {
        throw new Error(`Mount target not found: ${target}`);
    }

    if (targetEl._primalCtx) {
        unmount(targetEl);
    }

    const rootCtx = new ComponentContext(Component.name || "Root");
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
