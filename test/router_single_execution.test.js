import "./setup.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRouter, html, mount, lazy } from "../src/index.js";

describe("Router Component Single Execution Guarantee (Requirement: executions === 1)", () => {
    it("executes standard route component function EXACTLY ONCE on navigation", async () => {
        let executions = 0;

        function UsersPage() {
            executions++;
            return html`<h1>Users Page</h1>`;
        }

        const router = createRouter({
            routes: [
                { path: "/users", component: UsersPage }
            ]
        });

        mount(() => router.RouterView(), "#app");

        await router.resolveRoute("/users");
        await new Promise(r => setTimeout(r, 10));

        assert.equal(executions, 1, "Ordinary route component function must execute EXACTLY ONCE");
        assert.equal(document.querySelector("h1")?.textContent, "Users Page");

        router.destroy();
    });

    it("executes explicit lazy route component function (lazy(() => import(...))) EXACTLY ONCE on navigation", async () => {
        let lazyExecutions = 0;

        function LazyReportsPage() {
            lazyExecutions++;
            return html`<h1>Lazy Reports Page</h1>`;
        }

        const router = createRouter({
            routes: [
                {
                    path: "/reports",
                    component: lazy(() => Promise.resolve({ default: LazyReportsPage }))
                }
            ]
        });

        mount(() => router.RouterView(), "#app");

        await router.resolveRoute("/reports");
        await new Promise(r => setTimeout(r, 10));

        assert.equal(lazyExecutions, 1, "Lazy route component function must execute EXACTLY ONCE");
        assert.equal(document.querySelector("h1")?.textContent, "Lazy Reports Page");

        router.destroy();
    });
});
