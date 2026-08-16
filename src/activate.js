/**
 * PrimalJS DOM Activation Engine
 * Attaches Signal bindings and event listeners directly to existing prerendered HTML without Virtual DOM tree diffing.
 */

import { mount } from "./mount.js";

export function activate(App, target, initialState = {}) {
    if (typeof document === "undefined") return null;

    let targetEl = typeof target === "string" ? document.querySelector(target) : target;
    if (!targetEl) {
        throw new Error(`[PrimalJS activate] Target element '${target}' not found in document.`);
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

    const bindElements = targetEl.querySelectorAll("[data-primal-bind]");
    if (bindElements.length > 0) {
        // Activate existing DOM elements with binding markers
        for (const el of bindElements) {
            const bindId = el.getAttribute("data-primal-bind");
            if (serializedState[bindId] !== undefined) {
                el.textContent = serializedState[bindId];
            }
        }
    }

    // Mount application behavior onto root
    return mount(App, targetEl);
}
