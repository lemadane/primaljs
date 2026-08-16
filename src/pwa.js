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
        unregisterServiceWorkers();
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

export function unregisterServiceWorkers() {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.getRegistrations()
        .then(registrations => {
            for (const reg of registrations) {
                reg.unregister();
            }
        });

    if ("caches" in window) {
        caches.keys().then(keys => {
            for (const key of keys) {
                caches.delete(key);
            }
        });
    }
}
