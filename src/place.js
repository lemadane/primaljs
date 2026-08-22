/**
 * PrimalJS Declarative <Place> Portal Component
 * Renders child content into a target DOM location while preserving logical component ownership and lifecycle.
 */

import { isSignal, effect } from "./signal.js";
import {
    ComponentContext,
    pushContext,
    popContext,
    getCurrentContext,
    triggerMount,
    destroyContext
} from "./lifecycle.js";
import { convertToDOMNode, resolveInnerSubtree } from "./html.js";
import { warnDiagnostic } from "./diagnostics.js";

function resolveTarget(toProp) {
    let val = toProp;
    if (isSignal(val)) {
        val = val.value;
    } else if (typeof val === "function" && !val.name && val.kind === undefined) {
        val = val();
    }

    if (!val) return null;

    if (typeof val === "string") {
        if (typeof document === "undefined") return null;
        const found = document.querySelector(val);
        if (!found) {
            warnDiagnostic(`PrimalJS <Place>: target not found: ${val}`);
            return null;
        }
        return found;
    }

    if (typeof Element !== "undefined" && val instanceof Element) {
        return val;
    }

    if (typeof DocumentFragment !== "undefined" && val instanceof DocumentFragment) {
        return val;
    }

    return null;
}

/**
 * Built-in Declarative <Place> Portal Component.
 *
 * @param {{ to: string | Element | DocumentFragment | import("./signal.js").Signal<any> | (() => any), children?: any, __templateValues?: any[], __capitalTags?: Set<string> }} props
 * @returns {DocumentFragment}
 */
export function Place(props) {
    props = props || {};
    const parentCtx = getCurrentContext();

    const startAnchor = document.createComment("primal:place:start");
    const endAnchor = document.createComment("primal:place:end");
    const fragment = document.createDocumentFragment();
    fragment.appendChild(startAnchor);
    fragment.appendChild(endAnchor);

    const placeChildCtx = new ComponentContext("PlaceContent");
    if (parentCtx) {
        placeChildCtx.parent = parentCtx;
        if (!parentCtx.children.includes(placeChildCtx)) {
            parentCtx.children.push(placeChildCtx);
        }
        if (parentCtx.templateValues) placeChildCtx.templateValues = parentCtx.templateValues;
        if (parentCtx.capitalTags) placeChildCtx.capitalTags = parentCtx.capitalTags;
    }

    pushContext(placeChildCtx);
    let childDOM;
    try {
        childDOM = convertToDOMNode(props.children, placeChildCtx);
        if (childDOM) {
            resolveInnerSubtree(childDOM, props.__templateValues, placeChildCtx, props.__capitalTags);
        }
    } finally {
        popContext();
    }

    let placedNodes = [];
    if (childDOM) {
        if (childDOM.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            placedNodes = Array.from(childDOM.childNodes);
        } else {
            placedNodes = [childDOM];
        }
    }

    triggerMount(placeChildCtx);

    let currentTargetEl = null;

    function detachNodes() {
        for (const node of placedNodes) {
            if (node && node.parentNode) {
                node.parentNode.removeChild(node);
            }
        }
        currentTargetEl = null;
    }

    function attachNodes(targetEl) {
        if (!targetEl) {
            detachNodes();
            return;
        }

        if (targetEl !== currentTargetEl) {
            detachNodes();
            for (const node of placedNodes) {
                if (node) {
                    targetEl.appendChild(node);
                }
            }
            currentTargetEl = targetEl;
        }
    }

    const targetDisposer = effect(() => {
        const targetEl = resolveTarget(props.to);
        if (targetEl) {
            attachNodes(targetEl);
        } else {
            detachNodes();
        }
    });

    placeChildCtx.addDeactivateHook(() => {
        detachNodes();
    });

    placeChildCtx.addReactivateHook(() => {
        const targetEl = resolveTarget(props.to);
        if (targetEl) {
            attachNodes(targetEl);
        }
    });

    if (parentCtx) {
        parentCtx.addEffect(() => {
            targetDisposer();
            detachNodes();
            destroyContext(placeChildCtx);
        });
    }

    return fragment;
}
