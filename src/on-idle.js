/**
 * PrimalJS Declarative <OnIdle> Browser Idle-Aware Lifecycle Component
 * Delays creation and mounting of child subtrees until browser idle time (requestIdleCallback).
 */

import {
    ComponentContext,
    pushContext,
    popContext,
    getCurrentContext,
    triggerMount,
    destroyContext
} from "./lifecycle.js";
import { convertToDOMNode, resolveInnerSubtree } from "./html.js";

function getWindow() {
    if (typeof globalThis !== "undefined" && globalThis.window) return globalThis.window;
    if (typeof window !== "undefined") return window;
    return null;
}

/**
 * Validates and normalizes idle timeout option values.
 *
 * @param {any} value
 * @returns {number | null}
 */
export function normalizeIdleTimeout(value) {
    if (value == null) return null;
    const timeout = Number(value);
    if (!Number.isFinite(timeout) || timeout < 0) {
        throw new TypeError("<OnIdle> timeout must be a non-negative number");
    }
    return timeout;
}

/**
 * Built-in Declarative <OnIdle> Component.
 * Delays creation and mounting of child subtrees until browser idle time.
 *
 * @param {{ timeout?: number, fallback?: any, children?: any, __templateValues?: any[], __capitalTags?: Set<string> }} props
 * @returns {DocumentFragment}
 */
export function OnIdle(props) {
    props = props || {};
    const parentCtx = getCurrentContext();

    const rawTimeout = props.timeout !== undefined ? props.timeout : props.Timeout;
    const timeout = normalizeIdleTimeout(rawTimeout);

    const startAnchor = document.createComment("primal:onidle:start");
    const endAnchor = document.createComment("primal:onidle:end");

    const fragment = document.createDocumentFragment();
    fragment.appendChild(startAnchor);

    let fallbackCtx = null;
    let fallbackDOM = null;

    if (props.fallback !== undefined && props.fallback !== null) {
        fallbackCtx = new ComponentContext("OnIdleFallback");
        if (parentCtx) {
            fallbackCtx.parent = parentCtx;
            if (!parentCtx.children.includes(fallbackCtx)) {
                parentCtx.children.push(fallbackCtx);
            }
            if (parentCtx.templateValues) fallbackCtx.templateValues = parentCtx.templateValues;
            if (parentCtx.capitalTags) fallbackCtx.capitalTags = parentCtx.capitalTags;
        }

        pushContext(fallbackCtx);
        try {
            const rawFallback = typeof props.fallback === "function" ? props.fallback() : props.fallback;
            fallbackDOM = convertToDOMNode(rawFallback, fallbackCtx);
            if (fallbackDOM) {
                resolveInnerSubtree(fallbackDOM, props.__templateValues, fallbackCtx, props.__capitalTags);
            }
        } finally {
            popContext();
        }

        if (fallbackDOM) {
            fragment.appendChild(fallbackDOM);
            triggerMount(fallbackCtx);
        }
    }

    fragment.appendChild(endAnchor);

    let state = "WAITING"; // "WAITING" | "ACTIVATED" | "DESTROYED"
    let activeChildCtx = null;
    let activeChildNodes = [];
    let idleCallbackId = null;
    let fallbackTimerId = null;

    function cleanupCallback() {
        const win = getWindow();
        if (idleCallbackId !== null) {
            if (win && typeof win.cancelIdleCallback === "function") {
                win.cancelIdleCallback(idleCallbackId);
            }
            idleCallbackId = null;
        }
        if (fallbackTimerId !== null) {
            clearTimeout(fallbackTimerId);
            fallbackTimerId = null;
        }
    }

    function cleanupFallback() {
        if (fallbackCtx) {
            if (parentCtx && parentCtx.children) {
                const idx = parentCtx.children.indexOf(fallbackCtx);
                if (idx !== -1) parentCtx.children.splice(idx, 1);
            }
            destroyContext(fallbackCtx);
            fallbackCtx = null;
        }
        if (fallbackDOM && fallbackDOM.parentNode) {
            fallbackDOM.parentNode.removeChild(fallbackDOM);
            fallbackDOM = null;
        }
    }

    function cleanupChild() {
        if (activeChildCtx) {
            if (parentCtx && parentCtx.children) {
                const idx = parentCtx.children.indexOf(activeChildCtx);
                if (idx !== -1) parentCtx.children.splice(idx, 1);
            }
            destroyContext(activeChildCtx);
            activeChildCtx = null;
        }
        for (const node of activeChildNodes) {
            if (node && node.parentNode) {
                node.parentNode.removeChild(node);
            }
        }
        activeChildNodes = [];
    }

    function activateChild() {
        if (state !== "WAITING") return;
        state = "ACTIVATED";
        cleanupCallback();
        cleanupFallback();

        activeChildCtx = new ComponentContext("OnIdleContent");
        if (parentCtx) {
            activeChildCtx.parent = parentCtx;
            if (!parentCtx.children.includes(activeChildCtx)) {
                parentCtx.children.push(activeChildCtx);
            }
            if (parentCtx.templateValues) activeChildCtx.templateValues = parentCtx.templateValues;
            if (parentCtx.capitalTags) activeChildCtx.capitalTags = parentCtx.capitalTags;
        }

        pushContext(activeChildCtx);
        let childDOM;
        try {
            childDOM = convertToDOMNode(props.children, activeChildCtx);
            if (childDOM) {
                resolveInnerSubtree(childDOM, props.__templateValues, activeChildCtx, props.__capitalTags);
            }
        } finally {
            popContext();
        }

        if (childDOM) {
            if (childDOM.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                activeChildNodes = Array.from(childDOM.childNodes);
            } else {
                activeChildNodes = [childDOM];
            }
        }

        const parent = startAnchor.parentNode || endAnchor.parentNode;
        if (parent) {
            parent.insertBefore(childDOM, endAnchor);
        }

        triggerMount(activeChildCtx);
    }

    const win = getWindow();
    const hasRequestIdleSupport = win && typeof win.requestIdleCallback === "function";

    if (hasRequestIdleSupport) {
        const options = timeout !== null ? { timeout } : undefined;
        idleCallbackId = win.requestIdleCallback((deadline) => {
            if (state === "WAITING") {
                activateChild();
            }
        }, options);
    } else {
        fallbackTimerId = setTimeout(() => {
            if (state === "WAITING") {
                activateChild();
            }
        }, 1);
    }

    if (parentCtx) {
        parentCtx.addEffect(() => {
            state = "DESTROYED";
            cleanupCallback();
            cleanupFallback();
            cleanupChild();
            if (startAnchor.parentNode) startAnchor.parentNode.removeChild(startAnchor);
            if (endAnchor.parentNode) endAnchor.parentNode.removeChild(endAnchor);
        });
    }

    return fragment;
}
