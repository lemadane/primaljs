/**
 * PrimalJS Declarative <WithinView> Viewport-Aware Lifecycle Component
 * Delays mounting/instantiating child subtrees until the component position enters or approaches the browser viewport.
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
import { warnDiagnostic } from "./diagnostics.js";

/**
 * Built-in Declarative <WithinView> Component.
 *
 * @param {{ margin?: string, threshold?: number | number[], minHeight?: string, fallback?: any, once?: boolean, children?: any, __templateValues?: any[], __capitalTags?: Set<string> }} props
 * @returns {DocumentFragment}
 */
export function WithinView(props) {
    props = props || {};
    const parentCtx = getCurrentContext();

    const margin = typeof props.margin === "string" ? props.margin : "0px";
    const threshold = props.threshold !== undefined ? props.threshold : 0;
    const minHeightRaw = props.minHeight || props.minheight || props["min-height"];
    const minHeight = typeof minHeightRaw === "string" ? minHeightRaw : "0px";
    const once = props.once !== false;

    const startAnchor = document.createComment("primal:withinview:start");
    const endAnchor = document.createComment("primal:withinview:end");

    const placeholderEl = document.createElement("div");
    placeholderEl.setAttribute("data-primal-within-view", "");
    if (minHeight && minHeight !== "0px") {
        placeholderEl.style.minHeight = minHeight;
    }
    placeholderEl.style.display = "block";
    placeholderEl.style.width = "100%";

    const fragment = document.createDocumentFragment();
    fragment.appendChild(startAnchor);

    let fallbackCtx = null;
    let fallbackDOM = null;

    if (props.fallback !== undefined && props.fallback !== null) {
        fallbackCtx = new ComponentContext("WithinViewFallback");
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
            placeholderEl.appendChild(fallbackDOM);
            triggerMount(fallbackCtx);
        }
    }

    fragment.appendChild(placeholderEl);
    fragment.appendChild(endAnchor);

    let isDisposed = false;
    let activeChildCtx = null;
    let activeChildNodes = [];
    let observer = null;
    let isActivated = false;

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

    function cleanupFallback() {
        if (fallbackCtx) {
            if (parentCtx && parentCtx.children) {
                const idx = parentCtx.children.indexOf(fallbackCtx);
                if (idx !== -1) parentCtx.children.splice(idx, 1);
            }
            destroyContext(fallbackCtx);
            fallbackCtx = null;
        }
        if (placeholderEl && fallbackDOM && fallbackDOM.parentNode === placeholderEl) {
            placeholderEl.removeChild(fallbackDOM);
        }
        fallbackDOM = null;
    }

    function activateChild() {
        if (isDisposed) return;
        if (isActivated && once) return;

        isActivated = true;
        cleanupFallback();

        activeChildCtx = new ComponentContext("WithinViewContent");
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

        const parent = startAnchor.parentNode || placeholderEl.parentNode;
        if (parent) {
            parent.insertBefore(childDOM, endAnchor);
            if (placeholderEl.parentNode === parent) {
                parent.removeChild(placeholderEl);
            }
        } else {
            placeholderEl.appendChild(childDOM);
        }

        triggerMount(activeChildCtx);

        if (once && observer) {
            observer.disconnect();
            observer = null;
        }
    }

    function deactivateChild() {
        if (isDisposed || once) return;
        isActivated = false;
        cleanupChild();
    }

    const hasObserverSupport = typeof window !== "undefined" && typeof window.IntersectionObserver !== "undefined";

    if (!hasObserverSupport) {
        warnDiagnostic("PrimalJS <WithinView>: IntersectionObserver unavailable, mounting children immediately.");
        activateChild();
    } else {
        observer = new window.IntersectionObserver((entries) => {
            if (isDisposed) return;
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    activateChild();
                } else if (!once && isActivated) {
                    deactivateChild();
                }
            }
        }, {
            root: null,
            rootMargin: margin,
            threshold: threshold
        });

        // Delay observing until placeholder element is attached to DOM
        Promise.resolve().then(() => {
            if (!isDisposed && observer && placeholderEl && placeholderEl.parentNode) {
                observer.observe(placeholderEl);
            }
        });
    }

    if (parentCtx) {
        parentCtx.addEffect(() => {
            isDisposed = true;
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            cleanupFallback();
            cleanupChild();
            if (placeholderEl && placeholderEl.parentNode) {
                placeholderEl.parentNode.removeChild(placeholderEl);
            }
        });
    }

    return fragment;
}
