import { describe, it } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { signal } from "../src/signal.js";
import { html } from "../src/html.js";
import { mount } from "../src/load.js";
import { createRouter, RouteOutlet, useRoute, navigate } from "../src/router.js";
import { register } from "../src/registry.js";
import { onMount, getCurrentContext } from "../src/lifecycle.js";

function DashboardLayout() {
    return html`
        <div id="layout">
            <aside id="sidebar">Sidebar</aside>
            <main>
                <RouteOutlet />
            </main>
        </div>
    `;
}

function UsersPage() {
    const route = useRoute();
    return html`<h1 id="page-title">Users Page (${route.params.userId || "all"})</h1>`;
}

function SettingsPage() {
    return html`<h1 id="page-title">Settings Page</h1>`;
}

register(DashboardLayout);
register(UsersPage);
register(SettingsPage);
register(RouteOutlet);

describe("PrimalJS SPA Router Lifecycle & Nested Layouts", () => {
    it("preserves layout DOM and component instance across child route navigation", async () => {
        let layoutMounts = 0;

        function Layout() {
            onMount(() => { layoutMounts++; });
            return html`
                <div id="dashboard-layout">
                    <header id="header">Dashboard Header</header>
                    <main>
                        <RouteOutlet />
                    </main>
                </div>
            `;
        }
        register(Layout);

        window.history.replaceState({}, "", "/");

        const router = createRouter({
            routes: [
                {
                    path: "/dashboard",
                    component: Layout,
                    children: [
                        { path: "users", component: UsersPage },
                        { path: "settings", component: SettingsPage }
                    ]
                }
            ]
        });

        function App() {
            return router.RouterView();
        }

        const appEl = document.getElementById("app");
        const app = mount(App, appEl);

        router.navigate("/dashboard/users");
        await new Promise(r => setTimeout(r, 10));

        const headerBefore = document.querySelector("#header");
        assert.ok(headerBefore);
        assert.equal(layoutMounts, 1);
        assert.equal(document.querySelector("#page-title").textContent, "Users Page (all)");

        // Navigate to settings
        router.navigate("/dashboard/settings");
        await new Promise(r => setTimeout(r, 10));

        const headerAfter = document.querySelector("#header");
        // Layout DOM identity MUST be preserved!
        assert.equal(headerBefore, headerAfter);
        assert.equal(layoutMounts, 1);
        assert.equal(document.querySelector("#page-title").textContent, "Settings Page");

        app.dispose();
        router.destroy();
    });

    it("supports route guards (beforeEnter) and route redirects", async () => {
        const loggedIn = signal(false);

        const router = createRouter({
            routes: [
                {
                    path: "/public",
                    component: () => html`<h1 id="page">Public</h1>`
                },
                {
                    path: "/admin",
                    component: () => html`<h1 id="page">Admin</h1>`,
                    beforeEnter: () => {
                        if (!loggedIn.value) {
                            return "/login";
                        }
                    }
                },
                {
                    path: "/login",
                    component: () => html`<h1 id="page">Login</h1>`
                }
            ]
        });

        function App() {
            return router.RouterView();
        }

        const appEl = document.getElementById("app");
        const app = mount(App, appEl);

        router.navigate("/public");
        await new Promise(r => setTimeout(r, 10));
        assert.equal(document.querySelector("#page").textContent, "Public");

        // Attempting to navigate to /admin while loggedIn is false should redirect to /login
        router.navigate("/admin");
        await new Promise(r => setTimeout(r, 10));
        assert.equal(document.querySelector("#page").textContent, "Login");

        // Log in and navigate to /admin
        loggedIn.value = true;
        router.navigate("/admin");
        await new Promise(r => setTimeout(r, 10));
        assert.equal(document.querySelector("#page").textContent, "Admin");

        app.dispose();
        router.destroy();
    });
});
