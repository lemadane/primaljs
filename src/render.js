/**
 * PrimalJS Declarative <Render> Component Helper
 * Dynamically mounts an already-available component in an owned real-DOM range without parent rerenders.
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

export function Render(props) {
    const ctx = getCurrentContext();
    const startAnchor = document.createComment("primal:render:start");
    const endAnchor = document.createComment("primal:render:end");

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
            throw new Error("<Render> 'component' prop must be a function component, Signal, null, or undefined.");
        }

        if (compFn === activeCompFn) {
            return;
        }

        cleanupActiveComp();

        activeCompFn = compFn;
        activeCompCtx = new ComponentContext(compFn.name || "RenderedComponent");

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
            const compResult = compFn(forwardedProps);
            compDOM = convertToDOMNode(compResult, activeCompCtx);
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
