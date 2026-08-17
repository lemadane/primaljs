import "./setup.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRouter, createApp, html, register } from "../src/index.js";

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

    it("resolves async dynamic component loaders (e.g. component: () => import(...))", async () => {
        function DashboardPage() {
            return html`<div class="dashboard-page">Dashboard Content Loaded</div>`;
        }

        register(DashboardPage);

        const router = createRouter({
            routes: [
                {
                    path: "/dashboard",
                    component: () => Promise.resolve({ default: DashboardPage })
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
                    component: () => Promise.reject(new Error("Network bundle fetch failure"))
                }
            ]
        });

        await router.resolveRoute("/failed-load");

        assert.ok(caughtError);
        assert.equal(caughtError.message, "Network bundle fetch failure");
    });

    it("discards stale async navigation resolutions if newer navigation arrives", async () => {
        let slowGuardResolved = false;

        function SlowPage() { return html`<div class="slow">Slow Page</div>`; }
        function FastPage() { return html`<div class="fast">Fast Page</div>`; }

        register(SlowPage, FastPage);

        const router = createRouter({
            routes: [
                {
                    path: "/slow",
                    async beforeEnter() {
                        await new Promise(r => setTimeout(r, 100));
                        slowGuardResolved = true;
                    },
                    component: SlowPage
                },
                {
                    path: "/fast",
                    component: FastPage
                }
            ]
        });

        const app = createApp({ router });
        const handle = app.mount("#app");

        // 1. Trigger slow navigation
        const p1 = router.resolveRoute("/slow");
        // 2. Immediately trigger fast navigation before p1 finishes
        const p2 = router.resolveRoute("/fast");

        await Promise.all([p1, p2]);

        // Verify active page is FastPage and not overwritten by SlowPage
        assert.equal(document.querySelector(".fast").textContent, "Fast Page");
        assert.equal(document.querySelector(".slow"), null);

        handle.dispose();
    });
});
