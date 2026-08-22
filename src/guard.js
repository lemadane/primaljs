/**
 * PrimalJS Localized UI Guard (Error Boundary) Component
 */

import { html } from "./html.js";
import { signal } from "./signal.js";
import { getCurrentContext } from "./lifecycle.js";

/**
 * Local UI Guard (Error Boundary) Component.
 * Catches unhandled errors within its child context tree and renders a fallback UI.
 *
 * @param {{ fallback?: ((error: Error, retry: () => void) => any) | any, children?: any }} props
 * @returns {import("./html.js").TemplateResult}
 */
export function Guard(props) {
    props = props || {};
    const errorSignal = signal(null);
    const parentCtx = getCurrentContext();

    const retry = () => {
        errorSignal.value = null;
    };

    if (parentCtx) {
        parentCtx.localErrorHandler = (err) => {
            errorSignal.value = err || new Error("Unknown error");
            return true; // Error handled locally
        };
    }

    return html`
        ${() => {
            const err = errorSignal.value;
            if (err) {
                if (typeof props.fallback === "function") {
                    return props.fallback(err, retry);
                }
                return props.fallback || html`<div class="primal-error-boundary">An error occurred: ${err.message || String(err)}</div>`;
            }
            return props.children;
        }}
    `;
}

/** Backward compatibility alias for Guard */
export function Boundary(props) {
    return Guard(props);
}
