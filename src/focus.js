/**
 * PrimalJS Declarative <Focus> Accessibility & Focus Management Lifecycle Component
 * Manages autofocus, keyboard focus trapping (Tab/Shift+Tab), and focus restoration for subtrees.
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

/** @type {any[]} */
const focusStack = [];

const TABBABLE_SELECTOR = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    'area[href]',
    'summary',
    'iframe',
    'audio[controls]',
    'video[controls]',
    '[contenteditable]',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

function isElementVisible(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return false;
    if (el.disabled) return false;
    if (el.getAttribute("tabindex") === "-1") return false;
    if (el.hasAttribute("hidden")) return false;
    if (el.closest && el.closest("[inert]")) return false;

    const style = typeof window !== "undefined" && window.getComputedStyle ? window.getComputedStyle(el) : null;
    if (style) {
        if (style.display === "none" || style.visibility === "hidden") return false;
    }

    return true;
}

export function getFocusableElementsFromNodes(nodes) {
    const focusables = [];
    for (const node of nodes) {
        if (!node) continue;
        if (node.nodeType === 1) { // ELEMENT_NODE
            if (node.matches(TABBABLE_SELECTOR) && isElementVisible(node)) {
                focusables.push(node);
            }
            const descendants = node.querySelectorAll(TABBABLE_SELECTOR);
            for (const child of descendants) {
                if (isElementVisible(child)) {
                    focusables.push(child);
                }
            }
        }
    }
    return focusables;
}

export function getOwnedDOMNodes(startAnchor, endAnchor) {
    const nodes = [];
    let curr = startAnchor ? startAnchor.nextSibling : null;
    while (curr && curr !== endAnchor) {
        nodes.push(curr);
        curr = curr.nextSibling;
    }
    return nodes;
}

/**
 * Built-in Declarative <Focus> Component.
 *
 * @param {{ trap?: boolean, restore?: boolean, autofocus?: boolean, initial?: any, children?: any, __templateValues?: any[], __capitalTags?: Set<string> }} props
 * @returns {DocumentFragment}
 */
export function Focus(props) {
    props = props || {};
    const parentCtx = getCurrentContext();

    const trap = props.trap !== false;
    const restore = props.restore !== false;
    const autofocus = props.autofocus !== false;
    const initial = props.initial;

    const startAnchor = document.createComment("primal:focus:start");
    const endAnchor = document.createComment("primal:focus:end");

    const fragment = document.createDocumentFragment();
    fragment.appendChild(startAnchor);

    let childCtx = new ComponentContext("FocusContent");
    if (parentCtx) {
        childCtx.parent = parentCtx;
        if (!parentCtx.children.includes(childCtx)) {
            parentCtx.children.push(childCtx);
        }
        if (parentCtx.templateValues) childCtx.templateValues = parentCtx.templateValues;
        if (parentCtx.capitalTags) childCtx.capitalTags = parentCtx.capitalTags;
    }

    pushContext(childCtx);
    let childDOM;
    try {
        childDOM = convertToDOMNode(props.children, childCtx);
        if (childDOM) {
            resolveInnerSubtree(childDOM, props.__templateValues, childCtx, props.__capitalTags);
        }
    } finally {
        popContext();
    }

    if (childDOM) {
        fragment.appendChild(childDOM);
    }
    fragment.appendChild(endAnchor);

    triggerMount(childCtx);

    const doc = typeof document !== "undefined" ? document : null;
    let previousActiveElement = doc ? doc.activeElement : null;
    let isDisposed = false;
    let isKept = false;

    const controller = {
        ctx: childCtx,
        isKept: () => isKept,
        isDisposed: () => isDisposed,
        getOwnedNodes: () => getOwnedDOMNodes(startAnchor, endAnchor),
        getFocusables: () => getFocusableElementsFromNodes(getOwnedDOMNodes(startAnchor, endAnchor)),
        handleKeyDown: null,
        handleFocusIn: null
    };

    function isTopmostActiveController() {
        for (let i = focusStack.length - 1; i >= 0; i--) {
            const ctrl = focusStack[i];
            if (!ctrl.isDisposed() && !ctrl.isKept()) {
                return ctrl === controller;
            }
        }
        return false;
    }

    controller.handleKeyDown = (event) => {
        if (!trap || isDisposed || isKept || !isTopmostActiveController()) return;
        if (event.key !== "Tab") return;

        const focusables = controller.getFocusables();
        const active = doc ? doc.activeElement : null;

        if (focusables.length === 0) {
            event.preventDefault();
            const nodes = controller.getOwnedNodes();
            for (const node of nodes) {
                if (node.nodeType === 1) {
                    if (!node.hasAttribute("tabindex")) {
                        node.setAttribute("tabindex", "-1");
                    }
                    try { node.focus(); } catch (_) {}
                    break;
                }
            }
            return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey) { // Shift + Tab
            if (active === first || !focusables.includes(active)) {
                event.preventDefault();
                try { last.focus(); } catch (_) {}
            }
        } else { // Tab
            if (active === last || !focusables.includes(active)) {
                event.preventDefault();
                try { first.focus(); } catch (_) {}
            }
        }
    };

    controller.handleFocusIn = (event) => {
        if (!trap || isDisposed || isKept || !isTopmostActiveController()) return;
        const target = event.target;
        if (!target) return;

        const focusables = controller.getFocusables();
        if (focusables.length > 0 && !focusables.includes(target)) {
            const nodes = controller.getOwnedNodes();
            let isInside = false;
            for (const node of nodes) {
                if (node.nodeType === 1 && (node === target || node.contains(target))) {
                    isInside = true;
                    break;
                }
            }
            if (!isInside) {
                try { focusables[0].focus(); } catch (_) {}
            }
        }
    };

    function attachListeners() {
        if (doc) {
            doc.addEventListener("keydown", controller.handleKeyDown, true);
            doc.addEventListener("focusin", controller.handleFocusIn, true);
        }
    }

    function detachListeners() {
        if (doc) {
            doc.removeEventListener("keydown", controller.handleKeyDown, true);
            doc.removeEventListener("focusin", controller.handleFocusIn, true);
        }
    }

    function performAutofocus() {
        if (!autofocus || isDisposed || isKept) return;

        const nodes = controller.getOwnedNodes();
        let targetEl = null;

        // Priority 1: Descendant with [autofocus]
        for (const node of nodes) {
            if (node.nodeType === 1) {
                if (node.hasAttribute("autofocus") && isElementVisible(node)) {
                    targetEl = node;
                    break;
                }
                const autoChild = node.querySelector("[autofocus]");
                if (autoChild && isElementVisible(autoChild)) {
                    targetEl = autoChild;
                    break;
                }
            }
        }

        // Priority 2: Explicit initial target prop
        if (!targetEl && initial) {
            if (typeof initial === "string") {
                for (const node of nodes) {
                    if (node.nodeType === 1) {
                        if (node.matches(initial)) {
                            targetEl = node;
                            break;
                        }
                        const found = node.querySelector(initial);
                        if (found) {
                            targetEl = found;
                            break;
                        }
                    }
                }
            } else if (initial && initial.nodeType === 1 && isElementVisible(initial)) {
                targetEl = initial;
            } else if (initial && initial.current && initial.current.nodeType === 1 && isElementVisible(initial.current)) {
                targetEl = initial.current;
            }
        }

        // Priority 3: First focusable element
        if (!targetEl) {
            const focusables = controller.getFocusables();
            if (focusables.length > 0) {
                targetEl = focusables[0];
            }
        }

        // Priority 4: Subtree root element with tabindex=-1
        if (!targetEl) {
            for (const node of nodes) {
                if (node.nodeType === 1) {
                    if (!node.hasAttribute("tabindex")) {
                        node.setAttribute("tabindex", "-1");
                    }
                    targetEl = node;
                    break;
                }
            }
        }

        if (targetEl && typeof targetEl.focus === "function") {
            try {
                targetEl.focus();
            } catch (_) {}
        }
    }

    focusStack.push(controller);
    attachListeners();

    Promise.resolve().then(() => {
        performAutofocus();
    });

    if (parentCtx) {
        parentCtx.addDeactivateHook(() => {
            isKept = true;
        });

        parentCtx.addReactivateHook(() => {
            isKept = false;
        });

        parentCtx.addEffect(() => {
            isDisposed = true;
            detachListeners();

            const idx = focusStack.indexOf(controller);
            if (idx !== -1) {
                focusStack.splice(idx, 1);
            }

            if (childCtx) {
                if (parentCtx.children) {
                    const cIdx = parentCtx.children.indexOf(childCtx);
                    if (cIdx !== -1) parentCtx.children.splice(cIdx, 1);
                }
                destroyContext(childCtx);
                childCtx = null;
            }

            // Restore focus
            if (restore && previousActiveElement && previousActiveElement.isConnected) {
                if (!previousActiveElement.disabled && typeof previousActiveElement.focus === "function") {
                    try {
                        previousActiveElement.focus();
                    } catch (_) {}
                }
            }

            if (startAnchor.parentNode) startAnchor.parentNode.removeChild(startAnchor);
            if (endAnchor.parentNode) endAnchor.parentNode.removeChild(endAnchor);
        });
    }

    return fragment;
}
