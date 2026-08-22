/**
 * PrimalJS Lifecycle-Aware Keyboard Event Helper: onKey()
 * Registers a keyboard event listener that automatically follows PrimalJS owner lifecycle.
 */

import { getCurrentContext } from "./lifecycle.js";

function _getDocOnKey() {
    if (typeof globalThis !== "undefined" && globalThis.document) return globalThis.document;
    if (typeof document !== "undefined") return document;
    return null;
}

/**
 * Registers a keyboard event listener that automatically follows PrimalJS owner lifecycle.
 *
 * @param {any} targetOrKey - Target element/ref/document OR key string (e.g. "Escape", "Enter", "k")
 * @param {any} keyOrHandler - Key string OR handler callback
 * @param {Function | object} [handlerOrOptions] - Handler callback OR options object
 * @param {object} [options] - Options object
 * @returns {() => void} Unsubscribe function
 */
export function onKey(targetOrKey, keyOrHandler, handlerOrOptions, options) {
    let target = null;
    let key = "";
    let handler = null;
    let opts = {};

    if (typeof targetOrKey === "string") {
        target = _getDocOnKey();
        key = targetOrKey;
        handler = keyOrHandler;
        opts = handlerOrOptions || {};
    } else {
        target = targetOrKey;
        key = keyOrHandler;
        handler = handlerOrOptions;
        opts = options || {};
    }

    const eventName = opts.event || "keydown";
    const ignoreEditable = Boolean(opts.ignoreEditable);

    let isSubscribed = true;
    let attachedTarget = null;

    function matchModifiers(e) {
        if (opts.ctrl !== undefined && Boolean(e.ctrlKey) !== Boolean(opts.ctrl)) return false;
        if (opts.shift !== undefined && Boolean(e.shiftKey) !== Boolean(opts.shift)) return false;
        if (opts.alt !== undefined && Boolean(e.altKey) !== Boolean(opts.alt)) return false;
        if (opts.meta !== undefined && Boolean(e.metaKey) !== Boolean(opts.meta)) return false;
        return true;
    }

    function isEditableElement(el) {
        if (!el) return false;
        const tag = el.tagName ? el.tagName.toLowerCase() : "";
        if (tag === "input" || tag === "textarea" || tag === "select") return true;
        if (el.isContentEditable) return true;
        return false;
    }

    function listener(e) {
        if (!isSubscribed) return;
        if (ignoreEditable && isEditableElement(e.target)) return;

        const eventKey = e.key ? e.key.toLowerCase() : "";
        const expectedKey = key ? key.toLowerCase() : "";

        if (expectedKey && eventKey !== expectedKey) return;
        if (!matchModifiers(e)) return;

        if (typeof handler === "function") {
            handler(e);
        }
    }

    function resolveTarget() {
        if (!target) return null;
        if (typeof target === "function") {
            try { return target(); } catch (_) { return null; }
        }
        if (target && typeof target === "object" && "current" in target) {
            return target.current;
        }
        return target;
    }

    function attach() {
        if (!isSubscribed) return;
        const resolved = resolveTarget();
        if (resolved && resolved !== attachedTarget && typeof resolved.addEventListener === "function") {
            detach();
            attachedTarget = resolved;
            attachedTarget.addEventListener(eventName, listener, opts.capture);
        }
    }

    function detach() {
        if (attachedTarget && typeof attachedTarget.removeEventListener === "function") {
            attachedTarget.removeEventListener(eventName, listener, opts.capture);
            attachedTarget = null;
        }
    }

    attach();

    // Retry attach after mount to resolve refs populated during template binding
    Promise.resolve().then(() => {
        if (isSubscribed && !attachedTarget) {
            attach();
        }
    });

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
