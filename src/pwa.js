/**
 * PrimalJS Zero-Dependency PWA Engine
 */

import { reportGlobalError } from "./app.js";

/**
 * @typedef {Object} PwaOptions
 * @property {boolean} [enabled=true] Enables or disables PWA Service Worker registration.
 * @property {string} [swPath="./sw.js"] Path to the Service Worker script.
 * @property {string} [scope="./"] Scope for the Service Worker.
 * @property {"auto" | "prompt"} [updateStrategy="auto"] Strategy for handling Service Worker updates.
 * @property {boolean} [reloadOnUpdate=true] Automatically reload page on worker update.
 * @property {boolean} [cleanup] Unregister Service Workers and clear caches.
 * @property {() => void} [onUpdateAvailable] Callback when a new worker update is ready (for "prompt" mode).
 * @property {() => void} [onOfflineReady] Callback when application is cached for offline use.
 */

/**
 * Configures and registers Service Workers for Progressive Web App support.
 *
 * @param {PwaOptions | boolean} [options={}]
 */
export function setupPwa(options = {}) {

    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
        return;
    }

    const enabled = typeof options === "boolean" ? options : (options && options.enabled !== false);
    const swPath = (options && options.swPath) || "./sw.js";

    if (options && options.cleanup) {
        unregisterServiceWorkers(swPath);
        return;
    }

    if (!enabled) return;

    const updateStrategy = (options && typeof options === "object" && options.updateStrategy) || "auto";

    const doRegister = () => {
        try {
            navigator.serviceWorker.register(swPath, { scope: (options && options.scope) || "./" })
                .then(reg => {
                    const handleInstalling = (worker) => {
                        if (!worker) return;
                        worker.onstatechange = () => {
                            if (worker.state === "installed") {
                                if (navigator.serviceWorker.controller) {
                                    if (updateStrategy === "auto") {
                                        try { worker.postMessage({ type: "SKIP_WAITING" }); } catch (_) {}
                                        if (options && options.reloadOnUpdate !== false) {
                                            window.location.reload();
                                        }
                                    } else if (options && typeof options.onUpdateAvailable === "function") {
                                        options.onUpdateAvailable();
                                    }
                                } else if (options && typeof options.onOfflineReady === "function") {
                                    options.onOfflineReady();
                                }
                            }
                        };
                    };

                    if (reg.waiting) {
                        handleInstalling(reg.waiting);
                    }
                    if (reg.installing) {
                        handleInstalling(reg.installing);
                    }

                    reg.onupdatefound = () => {
                        handleInstalling(reg.installing);
                    };
                })
                .catch(err => {
                    reportGlobalError(err, { type: "pwa_registration", swPath });
                });
        } catch (err) {
            reportGlobalError(err, { type: "pwa_setup", swPath });
        }
    };

    if (typeof document !== "undefined" && (document.readyState === "complete" || document.readyState === "interactive")) {
        doRegister();
    } else {
        window.addEventListener("load", doRegister, { once: true });
    }
}

/**
 * Safely unregisters service workers by exact target URL, scope, or file path, and clears PrimalJS cache stores.
 * Returns a Promise that resolves when all cleanup tasks finish.
 */
export async function unregisterServiceWorkers(targetPath = "") {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
            const scriptURL = (reg.active && reg.active.scriptURL)
                || (reg.installing && reg.installing.scriptURL)
                || (reg.waiting && reg.waiting.scriptURL)
                || "";

            let isTargetWorker = false;

            if (targetPath) {
                let targetURL = "";
                try {
                    targetURL = new URL(targetPath, window.location.href).href;
                } catch (_) {}

                isTargetWorker = (targetURL && scriptURL === targetURL)
                    || (targetURL && reg.scope === targetURL);
            } else {
                // Without an explicit targetPath, match workers registered under the current document's scope/path
                isTargetWorker = typeof window.location !== "undefined" && (
                    scriptURL.startsWith(window.location.href) ||
                    (reg.scope && window.location.href.startsWith(reg.scope))
                );
            }

            if (isTargetWorker) {
                try {
                    await reg.unregister();
                } catch (_) {}
            }
        }
    } catch (err) {
        reportGlobalError(err, { type: "pwa_unregister" });
    }

    const cacheStore = typeof caches !== "undefined" ? caches : (typeof window !== "undefined" ? window.caches : null);

    if (cacheStore && typeof cacheStore.keys === "function") {
        try {
            const keys = await cacheStore.keys();
            for (const key of keys) {
                if (key.startsWith("primal-") || key.startsWith("primaljs-")) {
                    try {
                        await cacheStore.delete(key);
                    } catch (_) {}
                }
            }
        } catch (err) {
            reportGlobalError(err, { type: "pwa_cache_cleanup" });
        }
    }
}
