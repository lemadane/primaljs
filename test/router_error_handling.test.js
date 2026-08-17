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
});
