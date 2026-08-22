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

let lockCount = 0;
let preservedState = null;

function calculateScrollbarWidth() {
    const win = _getWinScrollLock();
    const doc = _getDocScrollLock();
    if (!win || !doc || !doc.documentElement) return 0;

    const innerWidth = win.innerWidth;
    const clientWidth = doc.documentElement.clientWidth;
    return Math.max(0, innerWidth - clientWidth);
}

function applyGlobalScrollLock() {
    const doc = _getDocScrollLock();
    if (!doc || !doc.body) return;

    const body = doc.body;
    const scrollbarWidth = calculateScrollbarWidth();
    const computedPaddingRight = typeof window !== "undefined" && window.getComputedStyle ? window.getComputedStyle(body).paddingRight : "0px";

    preservedState = {
        overflow: body.style.overflow,
        overflowX: body.style.overflowX,
        overflowY: body.style.overflowY,
        paddingRight: body.style.paddingRight
    };

    body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
        const basePadding = parseFloat(computedPaddingRight) || 0;
        body.style.paddingRight = `${basePadding + scrollbarWidth}px`;
    }
}

function releaseGlobalScrollLock() {
    const doc = _getDocScrollLock();
    if (!doc || !doc.body || !preservedState) return;

    const body = doc.body;
    body.style.overflow = preservedState.overflow;
    body.style.overflowX = preservedState.overflowX;
    body.style.overflowY = preservedState.overflowY;
    body.style.paddingRight = preservedState.paddingRight;

    preservedState = null;
}

/**
 * Temporarily locks page or container scrolling with automatic lifecycle cleanup and reference counting.
 *
 * @param {Element | object} [target] - Optional target element or ref (defaults to page body)
 * @returns {() => void} Unlock function
 */
export function scrollLock(target) {
    let isLocked = true;

    function acquire() {
        if (!isLocked) return;
        if (lockCount === 0) {
            applyGlobalScrollLock();
        }
        lockCount++;
    }

    function release() {
        if (!isLocked) return;
        isLocked = false;
        if (lockCount > 0) {
            lockCount--;
            if (lockCount === 0) {
                releaseGlobalScrollLock();
            }
        }
    }

    acquire();

    const ctx = getCurrentContext();
    if (ctx) {
        ctx.addDestroyHook(() => {
            unlock();
        });

        ctx.addDeactivateHook(() => {
            if (isLocked && lockCount > 0) {
                lockCount--;
                if (lockCount === 0) {
                    releaseGlobalScrollLock();
                }
            }
        });

        ctx.addReactivateHook(() => {
            if (isLocked) {
                if (lockCount === 0) {
                    applyGlobalScrollLock();
                }
                lockCount++;
            }
        });
    }

    function unlock() {
        release();
    }

    return unlock;
}

export function _resetScrollLockStateForTest() {
    lockCount = 0;
    preservedState = null;
}
