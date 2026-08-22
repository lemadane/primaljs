/**
 * PrimalJS Lifecycle-Aware Outside Interaction Helper: onOutsideClick()
 * Runs a callback when pointer interactions occur outside target element(s).
 */

import { getCurrentContext } from "./lifecycle.js";

function _getDocOutsideClick() {
    if (typeof globalThis !== "undefined" && globalThis.document) return globalThis.document;
    if (typeof document !== "undefined") return document;
    return null;
}

/**
 * Runs a handler callback when pointer interactions occur outside target element(s).
 * Supports single target or array of targets [triggerRef, menuRef] for portal compositions (<Place>).
 *
 * @param {any | any[]} targets - DOM element, PrimalJS ref, selector string, or array of targets
 * @param {Function} handler - Handler callback receiving native PointerEvent/MouseEvent
 * @param {object} [options] - Options object
 * @returns {() => void} Unsubscribe function
 */
export function onOutsideClick(targets, handler, options) {
    options = options || {};
    const eventName = options.event || "pointerdown";
    const capture = options.capture !== false;

    let isSubscribed = true;
    const doc = _getDocOutsideClick();

    function resolveSingleTarget(t) {
        if (!t) return null;
        if (typeof t === "function") {
            try { return t(); } catch (_) { return null; }
        }
        if (typeof t === "object" && "current" in t) {
            return t.current;
        }
        if (typeof t === "string" && doc) {
            return doc.querySelector(t);
        }
        return t;
    }

    function resolveAllTargets() {
        const rawList = Array.isArray(targets) ? targets : [targets];
        const resolved = [];
        for (const item of rawList) {
            const el = resolveSingleTarget(item);
            if (el) resolved.push(el);
        }
        return resolved;
    }

    function listener(e) {
        if (!isSubscribed) return;
        const targetElements = resolveAllTargets();
        if (targetElements.length === 0) return;

        const path = typeof e.composedPath === "function" ? e.composedPath() : [];
        const eventTarget = e.target;

        for (const el of targetElements) {
            if (path.length > 0 && path.includes(el)) {
                return; // Inside one of the target elements!
            }
            if (el === eventTarget || (el.contains && el.contains(eventTarget))) {
                return; // Inside target!
            }
        }

        // Outside all targets!
        if (typeof handler === "function") {
            handler(e);
        }
    }

    function attach() {
        if (doc && typeof doc.addEventListener === "function") {
            doc.addEventListener(eventName, listener, capture);
        }
    }

    function detach() {
        if (doc && typeof doc.removeEventListener === "function") {
            doc.removeEventListener(eventName, listener, capture);
        }
    }

    attach();

    const ctx = getCurrentContext();
    if (ctx) {
        ctx.addDestroyHook(() => {
            unsubscribe();
        });

        ctx.addDeactivateHook(() => {
            detach();
        });

        ctx.addReactivateHook(() => {
            if (isSubscribed) {
                attach();
            }
        });
    }

    function unsubscribe() {
        if (!isSubscribed) return;
        isSubscribed = false;
        detach();
    }

    return unsubscribe;
}
