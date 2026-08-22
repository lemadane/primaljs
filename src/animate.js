/**
 * PrimalJS Declarative <Animate> DOM Lifecycle Animation Component
 * Coordinates CSS enter/leave animations with PrimalJS component ownership and deferred subtree destruction.
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

function getTopLevelElements(nodes) {
    const elements = [];
    for (const node of nodes) {
        if (node && node.nodeType === Node.ELEMENT_NODE) {
            elements.push(node);
        }
    }
    return elements;
}

function listenAnimationEnd(elements, onComplete, fallbackMs) {
    if (!elements || elements.length === 0) {
        onComplete();
        return () => {};
    }

    let completed = false;
    let timeoutId = null;
    const pendingElements = new Set(elements.filter(el => el && el.addEventListener));

    if (pendingElements.size === 0) {
        onComplete();
        return () => {};
    }

    const cleanup = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        for (const el of elements) {
            if (el && el.removeEventListener) {
                el.removeEventListener("animationend", handleEnd);
                el.removeEventListener("transitionend", handleEnd);
            }
        }
    };

    const handleEnd = (evt) => {
        if (completed) return;
        if (evt && evt.target && pendingElements.has(evt.target)) {
            pendingElements.delete(evt.target);
            if (pendingElements.size === 0) {
                completed = true;
                cleanup();
                onComplete();
            }
        }
    };

    for (const el of pendingElements) {
        el.addEventListener("animationend", handleEnd);
        el.addEventListener("transitionend", handleEnd);
    }

    const durationMs = typeof fallbackMs === "number" && fallbackMs > 0 ? fallbackMs : 500;
    timeoutId = setTimeout(() => {
        if (!completed) {
            completed = true;
            cleanup();
            onComplete();
        }
    }, durationMs + 50);

    return cleanup;
}

function normalizeChildrenProp(children) {
    if (!children) return children;
    if (Array.isArray(children)) {
        const valid = children.filter(c => {
            if (typeof c === "string" && !c.trim()) return false;
            if (c && c.nodeType === Node.TEXT_NODE && !c.nodeValue.trim()) return false;
            return true;
        });
        return valid.length === 1 ? valid[0] : (valid.length > 0 ? valid : children);
    }
    return children;
}

/**
 * Built-in Declarative <Animate> Component.
 *
 * @param {{ enter?: string, leave?: string, duration?: number, enterDuration?: number, leaveDuration?: number, appear?: boolean, children?: any, __templateValues?: any[], __capitalTags?: Set<string> }} props
 * @returns {DocumentFragment}
 */
export function Animate(props) {
    props = props || {};
    const parentCtx = getCurrentContext();

    const enterClass = typeof props.enter === "string" ? props.enter.trim() : "";
    const leaveClass = typeof props.leave === "string" ? props.leave.trim() : "";
    const duration = typeof props.duration === "number" ? props.duration : undefined;
    const enterDuration = typeof props.enterDuration === "number" ? props.enterDuration : duration;
    const leaveDuration = typeof props.leaveDuration === "number" ? props.leaveDuration : duration;
    const appear = props.appear !== false;

    const startAnchor = document.createComment("primal:animate:start");
    const endAnchor = document.createComment("primal:animate:end");
    const fragment = document.createDocumentFragment();
    fragment.appendChild(startAnchor);
    fragment.appendChild(endAnchor);

    let state = "EMPTY"; // "EMPTY" | "ENTERING" | "ACTIVE" | "LEAVING"
    let currentChildCtx = null;
    let currentNodes = [];
    let currentOperationId = 0;
    let cancelCurrentAnimation = null;
    let isDisposed = false;
    let isInitialMount = true;

    function cleanupAnimationListener() {
        if (cancelCurrentAnimation) {
            cancelCurrentAnimation();
            cancelCurrentAnimation = null;
        }
    }

    function removeNodesFromDOM(nodes) {
        for (const n of nodes) {
            if (n && n.parentNode) {
                n.parentNode.removeChild(n);
            }
        }
    }

    function removeClassFromElements(elements, className) {
        if (!className) return;
        const classes = className.split(/\s+/);
        for (const el of elements) {
            if (el && el.classList) {
                el.classList.remove(...classes);
            }
        }
    }

    function addClassToElements(elements, className) {
        if (!className) return;
        const classes = className.split(/\s+/);
        for (const el of elements) {
            if (el && el.classList) {
                el.classList.add(...classes);
            }
        }
    }

    function detachAndDestroySubtree() {
        cleanupAnimationListener();
        if (currentChildCtx) {
            if (parentCtx && parentCtx.children) {
                const idx = parentCtx.children.indexOf(currentChildCtx);
                if (idx !== -1) parentCtx.children.splice(idx, 1);
            }
            destroyContext(currentChildCtx);
            currentChildCtx = null;
        }
        removeNodesFromDOM(currentNodes);
        currentNodes = [];
        state = "EMPTY";
    }

    function startEnterPhase(childValue) {
        const opId = ++currentOperationId;
        cleanupAnimationListener();

        let childDOM;
        currentChildCtx = new ComponentContext("AnimateContent");
        if (parentCtx) {
            currentChildCtx.parent = parentCtx;
            if (!parentCtx.children.includes(currentChildCtx)) {
                parentCtx.children.push(currentChildCtx);
            }
            if (parentCtx.templateValues) currentChildCtx.templateValues = parentCtx.templateValues;
            if (parentCtx.capitalTags) currentChildCtx.capitalTags = parentCtx.capitalTags;
        }

        pushContext(currentChildCtx);
        try {
            childDOM = convertToDOMNode(childValue, currentChildCtx);
            if (childDOM) {
                resolveInnerSubtree(childDOM, props.__templateValues, currentChildCtx, props.__capitalTags);
            }
        } finally {
            popContext();
        }

        if (!childDOM) {
            state = "EMPTY";
            return;
        }

        if (childDOM.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            currentNodes = Array.from(childDOM.childNodes);
        } else {
            currentNodes = [childDOM];
        }

        const parent = startAnchor.parentNode || endAnchor.parentNode;
        if (parent) {
            parent.insertBefore(childDOM, endAnchor);
        }

        triggerMount(currentChildCtx);

        const elements = getTopLevelElements(currentNodes);
        const shouldAnimate = enterClass && (appear || !isInitialMount);

        if (shouldAnimate && elements.length > 0) {
            state = "ENTERING";
            addClassToElements(elements, enterClass);

            cancelCurrentAnimation = listenAnimationEnd(elements, () => {
                if (isDisposed || opId !== currentOperationId || state !== "ENTERING") return;
                removeClassFromElements(elements, enterClass);
                state = "ACTIVE";
            }, enterDuration);
        } else {
            state = "ACTIVE";
        }

        isInitialMount = false;
    }

    function startLeavePhase() {
        if (!currentChildCtx || currentNodes.length === 0 || state === "EMPTY") {
            detachAndDestroySubtree();
            return;
        }

        const opId = ++currentOperationId;
        cleanupAnimationListener();

        const elements = getTopLevelElements(currentNodes);

        if (enterClass) {
            removeClassFromElements(elements, enterClass);
        }

        if (leaveClass && elements.length > 0) {
            state = "LEAVING";
            addClassToElements(elements, leaveClass);

            cancelCurrentAnimation = listenAnimationEnd(elements, () => {
                if (isDisposed || opId !== currentOperationId || state !== "LEAVING") return;
                detachAndDestroySubtree();
            }, leaveDuration);
        } else {
            detachAndDestroySubtree();
        }
    }

    function cancelLeaveAndReactivate() {
        const opId = ++currentOperationId;
        cleanupAnimationListener();

        const elements = getTopLevelElements(currentNodes);
        if (leaveClass) {
            removeClassFromElements(elements, leaveClass);
        }

        if (enterClass && elements.length > 0) {
            state = "ENTERING";
            addClassToElements(elements, enterClass);

            cancelCurrentAnimation = listenAnimationEnd(elements, () => {
                if (isDisposed || opId !== currentOperationId || state !== "ENTERING") return;
                removeClassFromElements(elements, enterClass);
                state = "ACTIVE";
            }, enterDuration);
        } else {
            state = "ACTIVE";
        }
    }

    function updateChild(val) {
        const hasValue = val !== null && val !== undefined && val !== false;

        if (hasValue) {
            if (state === "LEAVING") {
                // Interrupted Leave: cancel leave and restore existing active subtree
                cancelLeaveAndReactivate();
            } else if (state === "EMPTY") {
                startEnterPhase(val);
            }
        } else {
            if (state === "ACTIVE" || state === "ENTERING") {
                startLeavePhase();
            }
        }
    }

    const rawChildren = normalizeChildrenProp(props.children);

    let evalFn = null;
    if (isSignal(rawChildren)) {
        evalFn = () => rawChildren.value;
    } else if (typeof rawChildren === "function" && !rawChildren.name && rawChildren.kind === undefined) {
        evalFn = rawChildren;
    } else if (Array.isArray(rawChildren)) {
        const reactiveItem = rawChildren.find(item => isSignal(item) || (typeof item === "function" && !item.name && item.kind === undefined));
        if (reactiveItem) {
            evalFn = () => {
                const results = rawChildren.map(item => {
                    if (isSignal(item)) return item.value;
                    if (typeof item === "function" && !item.name && item.kind === undefined) return item();
                    return item;
                });
                const valid = results.filter(r => r !== null && r !== undefined && r !== false);
                return valid.length === 1 ? valid[0] : (valid.length > 0 ? valid : null);
            };
        }
    }

    if (evalFn) {
        const disposer = effect(() => {
            const val = evalFn();
            updateChild(val);
        });

        if (parentCtx) {
            parentCtx.addEffect(() => {
                isDisposed = true;
                disposer();
                detachAndDestroySubtree();
            });
        }
    } else {
        updateChild(rawChildren);
        if (parentCtx) {
            parentCtx.addEffect(() => {
                isDisposed = true;
                detachAndDestroySubtree();
            });
        }
    }

    return fragment;
}
