/**
 * PrimalJS Localized UI Error Boundary Component
 */

import { html } from "./html.js";
import { signal } from "./signal.js";
import { getCurrentContext } from "./lifecycle.js";

/**
 * Local UI Error Boundary Component.
 * Catches unhandled errors within its child context tree and renders a fallback UI.
 *
 * @param {{ fallback?: ((error: Error, retry: () => void) => any) | any, children?: any }} props
 * @returns {import("./html.js").TemplateResult}
 */
export function Boundary(props) {
    const errorSignal = signal(null);
    const parentCtx = getCurrentContext();

    const retry = () => {
        errorSignal.value = null;
    };

    if (parentCtx) {
        parentCtx.localErrorHandler = (err) => {
            errorSignal.value = err;
            return true; // Error handled locally
        };
    }

    return html`
        ${() => {
            if (errorSignal.value) {
                if (typeof props.fallback === "function") {
                    return props.fallback(errorSignal.value, retry);
                }
                return props.fallback || html`<div class="primal-error-boundary">An error occurred: ${errorSignal.value.message || String(errorSignal.value)}</div>`;
            }
            return props.children;
        }}
    `;
}
