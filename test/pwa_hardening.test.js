import "./setup.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { setupPwa, unregisterServiceWorkers } from "../src/pwa.js";

describe("PrimalJS PWA Engine Hardening & Cleanup", () => {
    it("handles setupPwa when document.readyState is complete", () => {
        let registeredSw = null;

        // Mock navigator.serviceWorker
        globalThis.navigator.serviceWorker = {
            register(path) {
                registeredSw = path;
                return Promise.resolve({
                    installing: null,
                    waiting: null,
                    active: null
                });
            },
            getRegistrations() {
                return Promise.resolve([]);
            }
        };

        setupPwa({ swPath: "./custom-sw.js" });

        assert.equal(registeredSw, "./custom-sw.js");
    });

    it("unregisters targeted service workers using exact URL/scope matching without removing independent worker scripts", async () => {
        const unregisteredScripts = [];

        const fakeRegistrations = [
            {
                active: { scriptURL: "http://localhost/sw.js" },
                scope: "http://localhost/",
                unregister() {
                    unregisteredScripts.push(this.active.scriptURL);
                    return Promise.resolve(true);
                }
            },
            {
                active: { scriptURL: "http://localhost/my-primal-data-worker.js" },
                scope: "http://localhost/data/",
                unregister() {
                    unregisteredScripts.push(this.active.scriptURL);
                    return Promise.resolve(true);
                }
            }
        ];

        globalThis.navigator.serviceWorker = {
            getRegistrations() {
                return Promise.resolve(fakeRegistrations);
            }
        };

        let deletedCacheKeys = [];
        globalThis.caches = {
            keys() {
                return Promise.resolve(["primal-v1", "primaljs-cache", "other-cache"]);
            },
            delete(key) {
                deletedCacheKeys.push(key);
                return Promise.resolve(true);
            }
        };

        // Target sw.js specifically
        await unregisterServiceWorkers("./sw.js");

        assert.deepEqual(unregisteredScripts, ["http://localhost/sw.js"]);
        assert.deepEqual(deletedCacheKeys, ["primal-v1", "primaljs-cache"]);
    });
});
