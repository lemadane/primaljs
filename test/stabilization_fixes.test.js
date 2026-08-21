import { describe, it } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { signal } from "../src/signal.js";
import { html } from "../src/html.js";
import { mount } from "../src/mount.js";
import { activate } from "../src/activate.js";
import { head } from "../src/seo.js";
import { createRouter, RouteOutlet } from "../src/router.js";
import { createApp } from "../src/app.js";
import { unregisterServiceWorkers } from "../src/pwa.js";
import { getCurrentContext } from "../src/lifecycle.js";
import { register } from "../src/registry.js";

describe("PrimalJS 0.1.0-alpha.1 Stabilization & Regression Fixes", () => {
    it("2. activate() preserves pre-rendered DOM without clearing innerHTML", () => {
        const appEl = document.getElementById("app");
        appEl.innerHTML = '<main id="ssr-root"><h1>Pre-rendered Content</h1><span data-primal-bind="msg">Old</span></main>';

        const ssrHeaderBefore = document.querySelector("h1");
        assert.ok(ssrHeaderBefore);

        function App(state) {
            return null;
        }

        const handle = activate(App, appEl, { msg: "Activated Text" });

        const ssrHeaderAfter = document.querySelector("h1");
        // Pre-rendered DOM element identity MUST be preserved!
        assert.equal(ssrHeaderBefore, ssrHeaderAfter);
        assert.equal(document.querySelector("span").textContent, "Activated Text");

        handle.dispose();
    });

    it("5. Restricts PWA cleanup to PrimalJS-owned workers and caches", async () => {
        let unregisteredCount = 0;
        let deletedCaches = [];

        // Mock navigator.serviceWorker & caches
        const mockRegistrations = [
            { active: { scriptURL: "http://localhost/sw.js" }, unregister: () => { unregisteredCount++; } },
            { active: { scriptURL: "http://localhost/third-party-sw.js" }, unregister: () => { unregisteredCount++; } },
            { active: { scriptURL: "http://localhost/primal-sw.js" }, unregister: () => { unregisteredCount++; } }
        ];

        Object.defineProperty(globalThis.navigator, "serviceWorker", {
            value: {
                getRegistrations: async () => mockRegistrations
            },
            configurable: true,
            writable: true
        });

        globalThis.caches = {
            keys: async () => ["primal-cache-v1", "third-party-cache", "primaljs-app"],
            delete: async (key) => { deletedCaches.push(key); }
        };

        unregisterServiceWorkers("./sw.js");
        await new Promise(r => setTimeout(r, 10));

        // Only target ./sw.js worker unregistered (1/3), third-party untouched
        assert.equal(unregisteredCount, 1);
        // Only primal- and primaljs- caches deleted
        assert.deepEqual(deletedCaches, ["primal-cache-v1", "primaljs-app"]);
    });

    it("6. Resets and removes stale SEO head metadata when navigating to empty metadata routes", () => {
        head({
            title: "Route A Title",
            description: "Route A Description",
            image: "http://localhost/og.png",
            canonical: "http://localhost/route-a"
        });

        assert.equal(document.title, "Route A Title");
        assert.ok(document.querySelector('meta[name="description"]'));
        assert.ok(document.querySelector('meta[property="og:image"]'));
        assert.ok(document.querySelector('link[rel="canonical"]'));

        // Navigate to route B with no metadata (null)
        head(null);

        assert.equal(document.querySelector('meta[name="description"]'), null);
        assert.equal(document.querySelector('meta[property="og:image"]'), null);
        assert.equal(document.querySelector('link[rel="canonical"]'), null);
    });

    it("7. Disposes router popstate event listener when application is disposed", () => {
        let removedEvent = null;
        const originalRemove = window.removeEventListener;

        window.removeEventListener = (event, fn) => {
            if (event === "popstate") {
                removedEvent = event;
            }
            originalRemove.call(window, event, fn);
        };

        const router = createRouter({
            routes: [{ path: "/", component: () => html`<h1>Home</h1>` }]
        });

        const app = createApp({
            router
        });

        const appEl = document.getElementById("app");
        app.mount(appEl);

        app.dispose();

        assert.equal(removedEvent, "popstate");
        window.removeEventListener = originalRemove;
    });
});
