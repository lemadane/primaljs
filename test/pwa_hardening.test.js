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

    it("unregisters PrimalJS service workers and clears PrimalJS cache stores safely", async () => {
        let unregisteredCount = 0;

        const fakeRegistrations = [
            {
                active: { scriptURL: "http://localhost/primal-sw.js" },
                unregister() {
                    unregisteredCount++;
                    return Promise.resolve(true);
                }
            },
            {
                active: { scriptURL: "http://localhost/other-sw.js" },
                unregister() {
                    unregisteredCount++;
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

        await unregisterServiceWorkers("./primal-sw.js");

        assert.equal(unregisteredCount, 1);
        assert.deepEqual(deletedCacheKeys, ["primal-v1", "primaljs-cache"]);
    });
});
