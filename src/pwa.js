/**
 * PrimalJS Zero-Dependency PWA Engine
 */

import { reportGlobalError } from "./app.js";

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

    const doRegister = () => {
        try {
            navigator.serviceWorker.register(swPath, { scope: options.scope || "./" })
                .then(reg => {
                    if (options.updateStrategy === "prompt" || options.updateStrategy === "auto") {
                        const handleInstalling = (worker) => {
                            if (!worker) return;
                            worker.onstatechange = () => {
                                if (worker.state === "installed" && navigator.serviceWorker.controller) {
                                    if (options.updateStrategy === "auto") {
                                        try { worker.postMessage({ type: "SKIP_WAITING" }); } catch (_) {}
                                        if (options.reloadOnUpdate !== false) {
                                            window.location.reload();
                                        }
                                    } else if (typeof options.onUpdateAvailable === "function") {
                                        options.onUpdateAvailable();
                                    }
                                }
                            };
                        };

                        if (reg.waiting) {
                            handleInstalling(reg.waiting);
                        }

                        reg.onupdatefound = () => {
                            handleInstalling(reg.installing);
                        };
                    }
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
 * Safely unregisters PrimalJS-owned service workers and clears PrimalJS cache stores.
 * Returns a Promise that resolves when all cleanup tasks finish.
 */
export async function unregisterServiceWorkers(targetPath = "") {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const targetName = targetPath ? targetPath.replace("./", "") : "";

    try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
            const scriptURL = (reg.active && reg.active.scriptURL)
                || (reg.installing && reg.installing.scriptURL)
                || (reg.waiting && reg.waiting.scriptURL)
                || "";

            let fileName = scriptURL;
            try {
                fileName = new URL(scriptURL).pathname.split("/").pop();
            } catch (_) {}

            const isPrimalWorker = fileName.includes("primal")
                || (targetName && fileName === targetName);

            if (isPrimalWorker) {
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
