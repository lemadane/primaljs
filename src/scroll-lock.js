/**
 * PrimalJS Lifecycle-Aware Scroll Lock Helper: scrollLock()
 * Reference-counted page/container scroll locker with style & layout preservation.
 */

import { getCurrentContext } from "./lifecycle.js";

function _getDocScrollLock() {
    if (typeof globalThis !== "undefined" && globalThis.document) return globalThis.document;
    if (typeof document !== "undefined") return document;
    return null;
}

function _getWinScrollLock() {
    if (typeof globalThis !== "undefined" && globalThis.window) return globalThis.window;
    if (typeof window !== "undefined") return window;
    return null;
}

const targetLocks = new Map();

function calculateScrollbarWidth() {
    const win = _getWinScrollLock();
    const doc = _getDocScrollLock();
    if (!win || !doc || !doc.documentElement) return 0;

    const innerWidth = win.innerWidth;
    const clientWidth = doc.documentElement.clientWidth;
    return Math.max(0, innerWidth - clientWidth);
}

function resolveTargetElement(target) {
    const doc = _getDocScrollLock();
    if (target === undefined) {
        return doc ? doc.body : null;
    }

    let el = target;
    if (typeof target === "object" && target !== null && "current" in target) {
        el = target.current;
    }
    if (typeof el === "string" && doc) {
        el = doc.querySelector(el);
    }
    if (typeof Element !== "undefined" && el instanceof Element) {
        return el;
    }
    return null;
}

function applyScrollLockToElement(el) {
    if (!el) return;
    const doc = _getDocScrollLock();
    const isBody = doc && (el === doc.body || el === doc.documentElement);

    let state = targetLocks.get(el);
    if (!state) {
        const computedPaddingRight = typeof window !== "undefined" && window.getComputedStyle ? window.getComputedStyle(el).paddingRight : "0px";
        state = {
            count: 0,
            preservedState: {
                overflow: el.style.overflow,
                overflowX: el.style.overflowX,
                overflowY: el.style.overflowY,
                paddingRight: el.style.paddingRight
            }
        };
        targetLocks.set(el, state);
    }

    if (state.count === 0) {
        el.style.overflow = "hidden";
        if (isBody) {
            const scrollbarWidth = calculateScrollbarWidth();
            if (scrollbarWidth > 0) {
                const basePadding = parseFloat(state.preservedState.paddingRight) || 0;
                el.style.paddingRight = `${basePadding + scrollbarWidth}px`;
            }
        }
    }
    state.count++;
}

function releaseScrollLockFromElement(el) {
    if (!el) return;
    const state = targetLocks.get(el);
    if (!state) return;

    state.count--;
    if (state.count <= 0) {
        el.style.overflow = state.preservedState.overflow;
        el.style.overflowX = state.preservedState.overflowX;
        el.style.overflowY = state.preservedState.overflowY;
        el.style.paddingRight = state.preservedState.paddingRight;
        targetLocks.delete(el);
    }
}

/**
 * Temporarily locks page or container scrolling with automatic lifecycle cleanup and reference counting.
 *
 * @param {Element | object | string} [target] - Optional target element or ref (defaults to page body)
 * @returns {() => void} Unlock function
 */
export function scrollLock(target) {
    let ownsLock = true;
    let lockCurrentlyAcquired = false;
    let acquiredElement = null;

    function acquire() {
        if (!ownsLock || lockCurrentlyAcquired) return;
        const el = resolveTargetElement(target);
        if (!el) return;
        acquiredElement = el;
        lockCurrentlyAcquired = true;
        applyScrollLockToElement(el);
    }

    function release() {
        if (!lockCurrentlyAcquired || !acquiredElement) return;
        const el = acquiredElement;
        acquiredElement = null;
        lockCurrentlyAcquired = false;
        releaseScrollLockFromElement(el);
    }

    function unlock() {
        release();
        ownsLock = false;
    }

    acquire();

    const ctx = getCurrentContext();
    if (ctx) {
        const isRefTarget = typeof target === "object" && target !== null && "current" in target;
        if (isRefTarget) {
            ctx.addMountHook(() => {
                if (ownsLock && !lockCurrentlyAcquired) {
                    acquire();
                }
            });
        }

        ctx.addDestroyHook(() => {
            unlock();
        });

        ctx.addDeactivateHook(() => {
            release();
        });

        ctx.addReactivateHook(() => {
            if (ownsLock) {
                acquire();
            }
        });
    }

    return unlock;
}

export function _resetScrollLockStateForTest() {
    for (const [el, state] of targetLocks.entries()) {
        el.style.overflow = state.preservedState.overflow;
        el.style.overflowX = state.preservedState.overflowX;
        el.style.overflowY = state.preservedState.overflowY;
        el.style.paddingRight = state.preservedState.paddingRight;
    }
    targetLocks.clear();
}
