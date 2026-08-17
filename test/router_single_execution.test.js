import "./setup.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRouter, html, mount, lazy, useRoute, createApp } from "../src/index.js";

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

    it("updates route params when same route component remains active (/users/1 -> /users/2)", async () => {
        function UserPage() {
            const route = useRoute();
            return html`<h1 id="user-id">User ${route.params.id}</h1>`;
        }

        const router = createRouter({
            routes: [
                {
                    path: "/users/:id",
                    component: UserPage
                }
            ]
        });

        const app = createApp({ router });
        app.mount("#app");

        await router.resolveRoute("/users/1");
        assert.equal(document.querySelector("#user-id").textContent.trim(), "User 1");

        await router.resolveRoute("/users/2");
        assert.equal(document.querySelector("#user-id").textContent.trim(), "User 2");

        router.destroy();
    });

    it("updates route content when query parameters change on same route component (/search?q=java -> /search?q=spring)", async () => {
        function SearchPage() {
            const route = useRoute();
            return html`<h1 id="query-term">Query: ${route.query.get("q")}</h1>`;
        }

        const router = createRouter({
            routes: [
                {
                    path: "/search",
                    component: SearchPage
                }
            ]
        });

        const app = createApp({ router });
        const handle = app.mount("#app");

        await router.resolveRoute("/search", "?q=java");
        assert.equal(document.querySelector("#query-term").textContent.trim(), "Query: java");

        await router.resolveRoute("/search", "?q=spring");
        assert.equal(document.querySelector("#query-term").textContent.trim(), "Query: spring");

        handle.dispose();
        router.destroy();
    });

    it("updates route content when URL hash fragment changes on same route component (/docs#install -> /docs#configuration)", async () => {
        function DocsPage() {
            const route = useRoute();
            return html`<h1 id="hash-target">Section: ${route.hash}</h1>`;
        }

        const router = createRouter({
            routes: [
                {
                    path: "/docs",
                    component: DocsPage
                }
            ]
        });

        const app = createApp({ router });
        const handle = app.mount("#app");

        await router.resolveRoute("/docs", "", "#install");
        assert.equal(document.querySelector("#hash-target").textContent.trim(), "Section: #install");

        await router.resolveRoute("/docs", "", "#configuration");
        assert.equal(document.querySelector("#hash-target").textContent.trim(), "Section: #configuration");

        handle.dispose();
        router.destroy();
    });

    it("preserves parent layout component while remounting leaf route component on parameter changes", async () => {
        let layoutExecutions = 0;
        let pageExecutions = 0;

        function DashboardLayout() {
            layoutExecutions++;
            return html`
                <div class="layout">
                    <header>Dashboard Header</header>
                    ${router.RouterView({ depth: 1 })}
                </div>
            `;
        }

        function MemberDetail() {
            pageExecutions++;
            const route = useRoute();
            return html`<h2 id="member-name">Member ${route.params.id}</h2>`;
        }

        const router = createRouter({
            routes: [
                {
                    path: "/dashboard",
                    component: DashboardLayout,
                    children: [
                        { path: "members/:id", component: MemberDetail }
                    ]
                }
            ]
        });

        const app = createApp({ router });
        const handle = app.mount("#app");

        await router.resolveRoute("/dashboard/members/101");

        const layoutElBefore = document.querySelector(".layout");
        assert.equal(layoutExecutions, 1);
        assert.equal(pageExecutions, 1);
        assert.equal(document.querySelector("#member-name").textContent, "Member 101");

        await router.resolveRoute("/dashboard/members/102");

        const layoutElAfter = document.querySelector(".layout");
        assert.equal(layoutElAfter, layoutElBefore, "Parent layout DOM element must be PRESERVED across child param changes");
        assert.equal(layoutExecutions, 1, "Parent layout function MUST NOT re-execute when child params change");
        assert.equal(pageExecutions, 2, "Leaf component MUST re-execute for new parameter instance");
        assert.equal(document.querySelector("#member-name").textContent, "Member 102");

        handle.dispose();
        router.destroy();
    });
});
