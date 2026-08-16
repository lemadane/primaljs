/**
 * PrimalJS Zero-Dependency PWA Engine
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

    window.addEventListener("load", () => {
        navigator.serviceWorker.register(swPath)
            .then(reg => {
                if (options.updateStrategy === "prompt") {
                    reg.onupdatefound = () => {
                        const installingWorker = reg.installing;
                        if (installingWorker) {
                            installingWorker.onstatechange = () => {
                                if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                                    if (typeof options.onUpdateAvailable === "function") {
                                        options.onUpdateAvailable();
                                    }
                                }
                            };
                        }
                    };
                }
            })
            .catch(err => {
                console.warn("[PrimalJS PWA] Service worker registration failed:", err);
            });
    });
}

/**
 * Safely unregisters PrimalJS-owned service workers and clears PrimalJS cache stores.
 */
export function unregisterServiceWorkers(targetPath = "") {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const targetName = targetPath ? targetPath.replace("./", "") : "";

    navigator.serviceWorker.getRegistrations()
        .then(registrations => {
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
                    reg.unregister();
                }
            }
        });

    const cacheStore = typeof caches !== "undefined" ? caches : (typeof window !== "undefined" ? window.caches : null);

    if (cacheStore && typeof cacheStore.keys === "function") {
        cacheStore.keys().then(keys => {
            for (const key of keys) {
                if (key.startsWith("primal-") || key.startsWith("primaljs-")) {
                    cacheStore.delete(key);
                }
            }
        });
    }
}
