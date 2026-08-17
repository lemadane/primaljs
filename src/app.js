/**
 * PrimalJS createApp Application Factory & Global Error Boundary Dispatcher
 */

import { mount, unmount } from "./mount.js";
import { activate } from "./activate.js";
import { setupPwa } from "./pwa.js";
import { setDevMode, PrimalJSError } from "./diagnostics.js";

let globalOnErrorHandler = null;
let isHandlingGlobalError = false;
const activeAppHandlers = [];

export function reportGlobalError(error, context = {}) {
    if (isHandlingGlobalError) {
        console.error("PrimalJS: Error inside global onError handler:", error);
        return;
    }
    isHandlingGlobalError = true;
    try {
        let handled = false;
        if (activeAppHandlers.length > 0) {
            const currentAppHandler = activeAppHandlers[activeAppHandlers.length - 1];
            if (typeof currentAppHandler === "function") {
                currentAppHandler(error, context);
                handled = true;
            }
        }
        if (!handled && typeof globalOnErrorHandler === "function") {
            globalOnErrorHandler(error, context);
            handled = true;
        }
        if (!handled) {
            console.error("PrimalJS Uncaught Error:", error, context);
        }
    } catch (handlerErr) {
        console.error("PrimalJS: Unhandled exception inside custom onError handler:", handlerErr, "Original error:", error);
    } finally {
        isHandlingGlobalError = false;
    }
}

export function setGlobalOnError(handler) {
    if (typeof handler === "function" || handler === null) {
        globalOnErrorHandler = handler;
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

    let uncaughtErrorListener = null;
    let unhandledRejectionListener = null;

    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
        uncaughtErrorListener = (event) => {
            reportGlobalError(event.error || new Error(event.message || "Uncaught Exception"), {
                type: "uncaughtException",
                filename: event.filename,
                lineno: event.lineno
            });
        };
        unhandledRejectionListener = (event) => {
            reportGlobalError(event.reason || new Error("Unhandled Promise Rejection"), {
                type: "unhandledRejection"
            });
        };

        window.addEventListener("error", uncaughtErrorListener);
        window.addEventListener("unhandledrejection", unhandledRejectionListener);
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
        if (typeof onError === "function") {
            const idx = activeAppHandlers.indexOf(onError);
            if (idx !== -1) {
                activeAppHandlers.splice(idx, 1);
            }
        }
        if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
            if (uncaughtErrorListener) window.removeEventListener("error", uncaughtErrorListener);
            if (unhandledRejectionListener) window.removeEventListener("unhandledrejection", unhandledRejectionListener);
        }
    };

    const pushAppHandler = () => {
        if (typeof onError === "function") {
            if (!activeAppHandlers.includes(onError)) {
                activeAppHandlers.push(onError);
            }
        }
    };

    return {
        mount(target) {
            pushAppHandler();
            try {
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
            } catch (err) {
                reportGlobalError(err, { type: "mount" });
                return {
                    dispose: disposeApp
                };
            }
        },
        activate(target, initialState) {
            pushAppHandler();
            try {
                if (rootComponent) {
                    mountedAppHandle = activate(rootComponent, target, initialState);
                    return {
                        dispose: disposeApp
                    };
                }
            } catch (err) {
                reportGlobalError(err, { type: "activate" });
                return {
                    dispose: disposeApp
                };
            }
        },
        dispose: disposeApp
    };
}
