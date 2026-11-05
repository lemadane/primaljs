import "./setup.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRouter, lazy } from "../src/router.js";
import { html } from "../src/html.js";
import { createApp } from "../src/app.js";
import { register } from "../src/registry.js";

describe("PrimalJS Router Promise & Error Handling Hardening", () => {
    it("delegates beforeEnter guard exceptions to custom onError handler", async () => {
        let caughtError = null;

        const router = createRouter({
            onError(err) {
                caughtError = err;
            },
            routes: [
                {
                    path: "/protected",
                    beforeEnter() {
                        throw new Error("Guard unauthorized access error");
                    },
                    component: () => html`<h2>Protected</h2>`
                }
            ]
        });

        await router.resolveRoute("/protected");

        assert.ok(caughtError);
        assert.equal(caughtError.message, "Guard unauthorized access error");
    });

    it("resolves async dynamic component loaders (e.g. component: lazy(() => import(...)))", async () => {
        function DashboardPage() {
            return html`<div class="dashboard-page">Dashboard Content Loaded</div>`;
        }

        register(DashboardPage);

        const router = createRouter({
            routes: [
                {
                    path: "/dashboard",
                    component: lazy(() => Promise.resolve({ default: DashboardPage }))
                }
            ]
        });

        const app = createApp({ router });
        const handle = app.mount("#app");

        await router.resolveRoute("/dashboard");

        assert.equal(document.querySelector(".dashboard-page").textContent, "Dashboard Content Loaded");

        handle.dispose();
    });

    it("delegates dynamic component import rejections to onError handler", async () => {
        let caughtError = null;

        const router = createRouter({
            onError(err) {
                caughtError = err;
            },
            routes: [
                {
                    path: "/failed-load",
                    component: lazy(() => Promise.reject(new Error("Network bundle fetch failure")))
                }
            ]
        });

        await router.resolveRoute("/failed-load");

        assert.ok(caughtError);
        assert.equal(caughtError.message, "Network bundle fetch failure");
    });

    it("discards stale async navigation resolutions if newer navigation arrives", async () => {
        let slowGuardResolved = false;

        const router = createRouter({
            routes: [
                {
                    path: "/slow",
                    async beforeEnter() {
                        await new Promise(r => setTimeout(r, 100));
                        slowGuardResolved = true;
                        return true;
                    },
                    component: () => html`<h2>Slow Page</h2>`
                },
                {
                    path: "/fast",
                    component: () => html`<h2 class="fast-page">Fast Page</h2>`
                }
            ]
        });

        const app = createApp({ router });
        const handle = app.mount("#app");

        // Start slow navigation
        const slowPromise = router.resolveRoute("/slow");

        // Immediately trigger fast navigation
        await router.resolveRoute("/fast");

        assert.equal(document.querySelector(".fast-page").textContent, "Fast Page");

        // Wait for slow navigation to complete
        await slowPromise;

        // Ensure fast page was NOT overwritten by late-resolving slow navigation
        assert.equal(document.querySelector(".fast-page").textContent, "Fast Page");

        handle.dispose();
    });

    it("discards stale async navigation rejections if newer navigation arrives", async () => {
        let reportedError = null;

        const router = createRouter({
            onError(err) {
                reportedError = err;
            },
            routes: [
                {
                    path: "/rejecting-slow",
                    async beforeEnter() {
                        await new Promise(r => setTimeout(r, 80));
                        throw new Error("Stale navigation rejection error");
                    },
                    component: () => html`<h2>Slow Fail</h2>`
                },
                {
                    path: "/fast-success",
                    component: () => html`<h2 class="fast-success-page">Fast Success Page</h2>`
                }
            ]
        });

        const app = createApp({ router });
        const handle = app.mount("#app");

        // Start slow navigation that will reject
        const slowPromise = router.resolveRoute("/rejecting-slow");

        // Immediately navigate to fast-success
        await router.resolveRoute("/fast-success");

        assert.equal(document.querySelector(".fast-success-page").textContent, "Fast Success Page");

        // Wait for slow rejection to settle
        await slowPromise;

        // Verify stale rejection did NOT report to onError handler
        assert.equal(reportedError, null);

        handle.dispose();
    });

    it("resets and clears SEO metadata when navigating from a route with meta to a route without meta", async () => {
        const router = createRouter({
            routes: [
                {
                    path: "/product",
                    meta: {
                        title: "Product Title",
                        description: "Product Description"
                    },
                    component: () => html`<h2>Product</h2>`
                },
                {
                    path: "/about",
                    component: () => html`<h2>About</h2>`
                }
            ]
        });

        // 1. Navigate to route with meta
        await router.resolveRoute("/product");
        assert.equal(document.title, "Product Title");
        assert.equal(document.querySelector('meta[name="description"]').getAttribute("content"), "Product Description");

        // 2. Navigate to route without meta -> stale meta must be cleared!
        await router.resolveRoute("/about");
        assert.equal(document.title, "");
        assert.equal(document.querySelector('meta[name="description"]'), null);

        // 3. Navigate to unmatched route -> meta must remain cleared
        await router.resolveRoute("/non-existent");
        assert.equal(document.title, "");
        assert.equal(document.querySelector('meta[name="description"]'), null);
    });
});

for (const mode of ["history", "hash"]) {
    it(`cancelled ${mode} navigation restores query and fragment`, async () => {
        const router = createRouter({ mode, routes: [
            { path: "/ok", component: () => null },
            { path: "/blocked", beforeEnter: () => false, component: () => null }
        ] });
        try {
            await router.resolveRoute("/ok", "?tab=2", "#section");
            window.history.replaceState({}, "", mode === "hash" ? "/shell?outer=1#/blocked" : "/blocked");
            await router.resolveRoute("/blocked");
            assert.equal(window.location.pathname + window.location.search + window.location.hash,
                mode === "hash" ? "/shell?outer=1#/ok?tab=2#section" : "/ok?tab=2#section");
        } finally {
            router.destroy();
        }
    });
}
