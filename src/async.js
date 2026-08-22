/**
 * PrimalJS Declarative Async Resource Components (<Wait>, <Delay>, <Briefly>, <Failed>)
 */

import { html } from "./html.js";
import { signal, isSignal, effect } from "./signal.js";
import { getCurrentContext } from "./lifecycle.js";
import { reportGlobalError } from "./app.js";

/**
 * Custom Timeout Error class for <Wait> and <Delay> operation timeouts.
 */
export class TimeoutError extends Error {
    constructor(message = "Operation timed out") {
        super(message);
        this.name = "TimeoutError";
    }
}

/**
 * Validates and normalizes timeout option values.
 *
 * @param {any} value
 * @returns {number | null}
 */
export function normalizeTimeout(value) {
    if (value == null) return null;
    const timeout = Number(value);
    if (!Number.isFinite(timeout) || timeout < 0) {
        throw new TypeError("<Wait> timeout must be a non-negative number");
    }
    return timeout;
}

/**
 * Safely observes a Promise with a timeout and cleanup callback.
 *
 * @param {Promise<any>} promise
 * @param {number | null} timeout
 * @param {{ resolve: (val: any) => void, reject: (err: any) => void }} handlers
 * @returns {() => void} Cleanup function
 */
export function observePromise(promise, timeout, handlers) {
    let active = true;
    let timer = null;

    const succeed = (value) => {
        if (!active) return;
        active = false;
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
        handlers.resolve(value);
    };

    const fail = (error) => {
        if (!active) return;
        active = false;
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
        handlers.reject(error);
    };

    Promise.resolve(promise).then(succeed, fail);

    if (timeout != null) {
        timer = setTimeout(() => {
            fail(new TimeoutError(`Operation timed out after ${timeout}ms`));
        }, timeout);
    }

    return () => {
        active = false;
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
    };
}

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
 * @param {{ for?: Promise<any> | (() => Promise<any>) | import("./signal.js").Signal<Promise<any>>, timeout?: number, children?: any, __templateValues?: any[] }} props
 */
export function Wait(props) {
    const state = signal({ status: "pending", data: null, error: null });
    const ctx = getCurrentContext();
    const templateValues = props ? props.__templateValues : [];
    const { resolvedSlot, brieflySlot, failedSlot } = parseSlots(props ? props.children : null, templateValues);

    const rawTimeout = props ? (props.timeout !== undefined ? props.timeout : props.Timeout) : undefined;
    const timeout = normalizeTimeout(rawTimeout);

    let currentOpId = 0;
    let activeCancelObservation = null;

    const cleanupObservation = () => {
        if (activeCancelObservation) {
            activeCancelObservation();
            activeCancelObservation = null;
        }
    };

    const runWait = () => {
        cleanupObservation();
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

        activeCancelObservation = observePromise(p, timeout, {
            resolve(res) {
                if (opId === currentOpId) {
                    state.value = { status: "resolved", data: res, error: null };
                }
            },
            reject(err) {
                if (opId === currentOpId) {
                    state.value = { status: "rejected", data: null, error: err };
                }
            }
        });
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
            cleanupObservation();
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
 * @param {{ task?: (options: { signal: AbortSignal }) => Promise<any>, run?: any, timeout?: number, children?: any, __templateValues?: any[] }} props
 */
export function Delay(props) {
    const state = signal({ status: "pending", data: null, error: null });
    const ctx = getCurrentContext();
    const templateValues = props ? props.__templateValues : [];
    const { resolvedSlot, brieflySlot, failedSlot } = parseSlots(props ? props.children : null, templateValues);

    const rawTimeout = props ? (props.timeout !== undefined ? props.timeout : props.Timeout) : undefined;
    const timeout = normalizeTimeout(rawTimeout);

    let currentOpId = 0;
    let activeAbortController = null;
    let activeTimeoutTimer = null;

    const cleanupTask = () => {
        if (activeTimeoutTimer !== null) {
            clearTimeout(activeTimeoutTimer);
            activeTimeoutTimer = null;
        }
        if (activeAbortController) {
            activeAbortController.abort();
            activeAbortController = null;
        }
    };

    const runTask = () => {
        cleanupTask();

        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        activeAbortController = controller;

        const opId = ++currentOpId;
        state.value = { status: "pending", data: null, error: null };

        const taskFn = props ? (props.task || props.run) : null;
        if (typeof taskFn !== "function") {
            state.value = { status: "resolved", data: null, error: null };
            return;
        }

        let isTimedOut = false;
        if (timeout != null) {
            activeTimeoutTimer = setTimeout(() => {
                isTimedOut = true;
                const err = new TimeoutError(`Operation timed out after ${timeout}ms`);
                if (controller) {
                    try { controller.abort(err); } catch (_) {}
                }
                if (opId === currentOpId) {
                    state.value = { status: "rejected", data: null, error: err };
                }
            }, timeout);
        }

        let p;
        try {
            p = taskFn({ signal: controller ? controller.signal : undefined });
        } catch (err) {
            p = Promise.reject(err);
        }

        if (!p || typeof p.then !== "function") {
            if (activeTimeoutTimer !== null) {
                clearTimeout(activeTimeoutTimer);
                activeTimeoutTimer = null;
            }
            if (!isTimedOut && opId === currentOpId) {
                state.value = { status: "resolved", data: p, error: null };
            }
            return;
        }

        p.then(
            (res) => {
                if (activeTimeoutTimer !== null) {
                    clearTimeout(activeTimeoutTimer);
                    activeTimeoutTimer = null;
                }
                if (!isTimedOut && opId === currentOpId) {
                    state.value = { status: "resolved", data: res, error: null };
                }
            },
            (err) => {
                if (activeTimeoutTimer !== null) {
                    clearTimeout(activeTimeoutTimer);
                    activeTimeoutTimer = null;
                }
                if (!isTimedOut && opId === currentOpId) {
                    if (err && err.name === "AbortError" && !isTimedOut) {
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
            cleanupTask();
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
