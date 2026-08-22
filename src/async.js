/**
 * PrimalJS Declarative Async Resource Components (<Wait>, <Delay>, <Briefly>, <Failed>)
 */

import { html } from "./html.js";
import { signal, isSignal, effect } from "./signal.js";
import { getCurrentContext } from "./lifecycle.js";
import { reportGlobalError } from "./app.js";

/**
 * Slot marker component for pending/loading state inside <Wait> or <Delay>.
 * @param {{ children?: any }} props
 */
export function Briefly(props) {
    return {
        __isBriefly: true,
        children: props ? props.children : null
    };
}

/**
 * Slot marker component for error/rejection state inside <Wait> or <Delay>.
 * @param {{ children?: any }} props
 */
export function Failed(props) {
    return {
        __isFailed: true,
        children: props ? props.children : null
    };
}

function parseSlots(children, templateValues) {
    let resolvedSlot = null;
    let brieflySlot = null;
    let failedSlot = null;

    const extractSlotFromNode = (node) => {
        if (!node) return null;
        if (typeof node === "function" || isSignal(node)) return node;

        if (typeof node === "object" && node.nodeType === Node.COMMENT_NODE) {
            const text = node.nodeValue ? node.nodeValue.trim() : "";
            if (text.startsWith("primal-ph-") && templateValues) {
                const idx = parseInt(text.replace("primal-ph-", ""), 10);
                return templateValues[idx];
            }
        }
        if (typeof node === "object" && node.nodeType === Node.ELEMENT_NODE) {
            const comments = [];
            const walkComments = (n) => {
                for (const c of Array.from(n.childNodes || [])) {
                    if (c.nodeType === Node.COMMENT_NODE && c.nodeValue && c.nodeValue.trim().startsWith("primal-ph-")) {
                        comments.push(c);
                    } else if (c.nodeType === Node.ELEMENT_NODE) {
                        walkComments(c);
                    }
                }
            };
            walkComments(node);

            if (comments.length === 1 && templateValues) {
                const idx = parseInt(comments[0].nodeValue.trim().replace("primal-ph-", ""), 10);
                return templateValues[idx];
            }
            const valid = Array.from(node.childNodes).filter(n => n.nodeType !== Node.TEXT_NODE || n.nodeValue.trim().length > 0);
            return valid.length === 1 ? valid[0] : (valid.length > 0 ? valid : node);
        }
        return node;
    };

    const list = Array.isArray(children) ? children : [children];
    for (const item of list) {
        if (!item) continue;
        if (typeof item === "string" && !item.trim()) continue;
        const isElement = item && typeof item === "object" && item.nodeType === Node.ELEMENT_NODE;
        const cleanTag = isElement ? item.nodeName.replace(/-COMPONENT$/i, "").toUpperCase() : "";

        if (cleanTag === "BRIEFLY" || (typeof item === "object" && item.__isBriefly)) {
            brieflySlot = extractSlotFromNode(item) || (item.children !== undefined ? item.children : item);
        } else if (cleanTag === "FAILED" || (typeof item === "object" && item.__isFailed)) {
            failedSlot = extractSlotFromNode(item) || (item.children !== undefined ? item.children : item);
        } else {
            resolvedSlot = extractSlotFromNode(item) || item;
        }
    }
    return { resolvedSlot, brieflySlot, failedSlot };
}

function renderSlot(slot, arg1, arg2) {
    if (!slot) return null;
    if (typeof slot === "function") {
        return slot(arg1, arg2);
    }
    return slot;
}

/**
 * Declarative Promise Unwrap & Observation Component.
 *
 * @param {{ for?: Promise<any> | (() => Promise<any>) | import("./signal.js").Signal<Promise<any>>, children?: any, __templateValues?: any[] }} props
 */
export function Wait(props) {
    const state = signal({ status: "pending", data: null, error: null });
    const ctx = getCurrentContext();
    const templateValues = props ? props.__templateValues : [];
    const { resolvedSlot, brieflySlot, failedSlot } = parseSlots(props ? props.children : null, templateValues);

    let currentOpId = 0;

    const runWait = () => {
        const opId = ++currentOpId;
        state.value = { status: "pending", data: null, error: null };

        let p = props ? props.for : null;
        if (isSignal(p)) {
            p = p.value;
        } else if (typeof p === "function") {
            try {
                p = p();
            } catch (err) {
                p = Promise.reject(err);
            }
        }

        if (!p || typeof p.then !== "function") {
            state.value = { status: "resolved", data: p, error: null };
            return;
        }

        p.then(
            (res) => {
                if (opId === currentOpId) {
                    state.value = { status: "resolved", data: res, error: null };
                }
            },
            (err) => {
                if (opId === currentOpId) {
                    state.value = { status: "rejected", data: null, error: err };
                }
            }
        );
    };

    const retry = () => {
        runWait();
    };

    const disposer = effect(() => {
        runWait();
    });

    if (ctx) {
        ctx.addEffect(() => {
            disposer();
            currentOpId++;
        });
    }

    return html`
        ${() => {
            const currentState = state.value;

            if (currentState.status === "pending") {
                return renderSlot(brieflySlot);
            } else if (currentState.status === "resolved") {
                return renderSlot(resolvedSlot, currentState.data);
            } else if (currentState.status === "rejected") {
                if (failedSlot) {
                    return renderSlot(failedSlot, currentState.error, retry);
                } else {
                    const handled = reportGlobalError(currentState.error, {
                        type: "async_wait",
                        ctx: ctx
                    });
                    if (!handled) {
                        console.error("PrimalJS <Wait>: Uncaught Promise rejection:", currentState.error);
                    }
                    return null;
                }
            }
        }}
    `;
}

/**
 * Declarative Reactive Task Component (owns AbortController & task lifecycle).
 *
 * @param {{ task?: (options: { signal: AbortSignal }) => Promise<any>, run?: any, children?: any, __templateValues?: any[] }} props
 */
export function Delay(props) {
    const state = signal({ status: "pending", data: null, error: null });
    const ctx = getCurrentContext();
    const templateValues = props ? props.__templateValues : [];
    const { resolvedSlot, brieflySlot, failedSlot } = parseSlots(props ? props.children : null, templateValues);

    let currentOpId = 0;
    let activeAbortController = null;

    const runTask = () => {
        if (activeAbortController) {
            activeAbortController.abort();
            activeAbortController = null;
        }

        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        activeAbortController = controller;

        const opId = ++currentOpId;
        state.value = { status: "pending", data: null, error: null };

        const taskFn = props ? (props.task || props.run) : null;
        if (typeof taskFn !== "function") {
            state.value = { status: "resolved", data: null, error: null };
            return;
        }

        let p;
        try {
            p = taskFn({ signal: controller ? controller.signal : undefined });
        } catch (err) {
            p = Promise.reject(err);
        }

        if (!p || typeof p.then !== "function") {
            state.value = { status: "resolved", data: p, error: null };
            return;
        }

        p.then(
            (res) => {
                if (opId === currentOpId) {
                    state.value = { status: "resolved", data: res, error: null };
                }
            },
            (err) => {
                if (opId === currentOpId) {
                    if (err && err.name === "AbortError") {
                        return;
                    }
                    state.value = { status: "rejected", data: null, error: err };
                }
            }
        );
    };

    const retry = () => {
        runTask();
    };

    const disposer = effect(() => {
        runTask();
    });

    if (ctx) {
        ctx.addEffect(() => {
            disposer();
            currentOpId++;
            if (activeAbortController) {
                activeAbortController.abort();
                activeAbortController = null;
            }
        });
    }

    return html`
        ${() => {
            const currentState = state.value;

            if (currentState.status === "pending") {
                return renderSlot(brieflySlot);
            } else if (currentState.status === "resolved") {
                return renderSlot(resolvedSlot, currentState.data);
            } else if (currentState.status === "rejected") {
                if (failedSlot) {
                    return renderSlot(failedSlot, currentState.error, retry);
                } else {
                    const handled = reportGlobalError(currentState.error, {
                        type: "async_task",
                        ctx: ctx
                    });
                    if (!handled) {
                        console.error("PrimalJS <Delay>: Uncaught task rejection:", currentState.error);
                    }
                    return null;
                }
            }
        }}
    `;
}
