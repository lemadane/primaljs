/**
 * PrimalJS createApp Application Factory & Global Error Boundary Dispatcher
 */

import { mount, unmount } from "./mount.js";
import { activate } from "./activate.js";
import { setupPwa } from "./pwa.js";
import { setDevMode, PrimalJSError } from "./diagnostics.js";

let globalOnErrorHandler = null;
let isHandlingGlobalError = false;

export function reportGlobalError(error, context = {}) {
    if (isHandlingGlobalError) {
        console.error("PrimalJS: Error inside global onError handler:", error);
        return;
    }
    if (typeof globalOnErrorHandler === "function") {
        isHandlingGlobalError = true;
        try {
            globalOnErrorHandler(error, context);
        } catch (handlerErr) {
            console.error("PrimalJS: Unhandled exception inside custom onError handler:", handlerErr, "Original error:", error);
        } finally {
            isHandlingGlobalError = false;
        }
    } else {
        console.error("PrimalJS Uncaught Error:", error, context);
    }
}

export function createApp(config = {}) {
    const rootComponent = config.root || config.app;
    const router = config.router;
    const pwaOptions = config.pwa;
    const devMode = config.dev;
    const onError = config.onError;

    if (devMode !== undefined) {
        setDevMode(devMode);
    }

    if (typeof onError === "function") {
        globalOnErrorHandler = onError;
    }

    if (pwaOptions) {
        setupPwa(pwaOptions);
    }

    let mountedAppHandle = null;

    const disposeApp = () => {
        if (router && typeof router.destroy === "function") {
            router.destroy();
        }
        if (mountedAppHandle && typeof mountedAppHandle.dispose === "function") {
            mountedAppHandle.dispose();
            mountedAppHandle = null;
        }
    };

    return {
        mount(target) {
            if (router) {
                const targetEl = typeof target === "string" ? document.querySelector(target) : target;
                if (targetEl) {
                    targetEl.innerHTML = "";
                    mountedAppHandle = mount(() => router.RouterView(), targetEl);
                    return {
                        dispose: disposeApp
                    };
                }
                return;
            }
            if (rootComponent) {
                mountedAppHandle = mount(rootComponent, target);
                return {
                    dispose: disposeApp
                };
            }
        },
        activate(target, initialState) {
            if (rootComponent) {
                mountedAppHandle = activate(rootComponent, target, initialState);
                return {
                    dispose: disposeApp
                };
            }
        },
        dispose: disposeApp
    };
}
