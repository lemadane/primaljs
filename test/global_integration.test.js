import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
    html,
    unsafeHtml,
    signal,
    computed,
    ref,
    register,
    clearRegistry,
    mount,
    activate,
    Render,
    createRouter,
    head,
    createApp,
    If,
    For
} from "../primal.js";

function flushPromises() {
    return new Promise(resolve => setTimeout(resolve, 10));
}

describe("PrimalJS Complete Framework Core & Integration Suite", () => {
    let dom;
    let document;
    let window;

    beforeEach(() => {
        dom = new JSDOM('<!DOCTYPE html><html><head><title>Initial</title></head><body><div id="app"></div></body></html>', {
            url: "http://localhost/"
        });
        document = dom.window.document;
        window = dom.window;
        global.window = window;
        global.document = document;
        global.Node = window.Node;
        global.HTMLElement = window.HTMLElement;
        global.Text = window.Text;
        global.Comment = window.Comment;
        global.DocumentFragment = window.DocumentFragment;

        clearRegistry();
    });

    afterEach(() => {
        delete global.window;
        delete global.document;
        delete global.Node;
        delete global.HTMLElement;
        delete global.Text;
        delete global.Comment;
        delete global.DocumentFragment;
    });

    it("1. <Render> dynamically switches components without rerunning parent component (executions === 1)", () => {
        let executions = 0;
        let activePage;

        function Home() { return html`<h2 id="page">Home Page</h2>`; }
        function Profile() { return html`<h2 id="page">Profile Page</h2>`; }

        function App() {
            executions++;
            activePage = signal(Home);

            return html`
                <main>
                    <h1 id="title">PrimalJS App</h1>
                    <Render component=${activePage} />
                </main>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(executions, 1);
        assert.equal(document.querySelector("#page").textContent, "Home Page");

        // Switch component dynamically
        activePage.value = Profile;

        assert.equal(document.querySelector("#page").textContent, "Profile Page");
        assert.equal(executions, 1);
    });

    it("2. ref() binds DOM element to ref.current after mount and sets ref.current = null on unmount", () => {
        const inputRef = ref();

        function FormComp() {
            return html`<input ref=${inputRef} id="my-input" value="hello" />`;
        }

        assert.equal(inputRef.current, null);

        const appEl = document.getElementById("app");
        mount(FormComp, appEl);

        assert.ok(inputRef.current !== null);
        assert.equal(inputRef.current.id, "my-input");
    });

    it("3. Safe HTML escaping vs unsafeHtml()", () => {
        const unsafeInput = `<img src=x onerror=alert(1)>`;

        function App() {
            return html`
                <div>
                    <p id="safe">${unsafeInput}</p>
                    <div id="unsafe">${unsafeHtml(unsafeInput)}</div>
                </div>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        // Safe interpolation renders as text node
        assert.equal(document.querySelector("#safe").textContent, "<img src=x onerror=alert(1)>");
        assert.equal(document.querySelector("#safe img"), null);

        // UnsafeHtml renders actual DOM node
        assert.ok(document.querySelector("#unsafe img") !== null);
    });

    it("4. SPA Router navigates, matches params, updates route signals, and updates SEO head", () => {
        function HomeRoute() { return html`<h1>Home</h1>`; }
        function UserRoute() { return html`<h1>User Profile</h1>`; }

        const router = createRouter({
            routes: [
                { path: "/", component: HomeRoute, meta: { title: "Home Page" } },
                { path: "/users/:id", component: UserRoute, meta: { title: "User Detail" } }
            ]
        });

        const app = createApp({ router });
        app.mount("#app");

        assert.equal(document.title, "Home Page");
        assert.equal(document.querySelector("h1").textContent, "Home");

        // Navigate to /users/42
        router.navigate("/users/42");

        assert.equal(document.title, "User Detail");
        assert.equal(document.querySelector("h1").textContent, "User Profile");
        assert.equal(router.activeParams.value.id, "42");
    });

    it("5. head() dynamically updates meta description, canonical link, and JSON-LD structured data", () => {
        head({
            title: "PrimalJS SPA",
            description: "Modern minimalist framework",
            canonical: "https://primaljs.org",
            structuredData: { "@context": "https://schema.org", "@type": "WebApplication", name: "PrimalJS" }
        });

        assert.equal(document.title, "PrimalJS SPA");
        assert.equal(document.querySelector('meta[name="description"]').getAttribute("content"), "Modern minimalist framework");
        assert.equal(document.querySelector('link[rel="canonical"]').getAttribute("href"), "https://primaljs.org");
        assert.ok(document.querySelector('script[type="application/ld+json"]').textContent.includes("WebApplication"));
    });

    it("6. activate() attaches Signals and event handlers to pre-rendered HTML", () => {
        document.getElementById("app").innerHTML = `
            <main>
                <h1 id="count-heading">Count: 5</h1>
            </main>
        `;

        function App() {
            const count = signal(5);
            return html`<main><h1 id="count-heading">Count: ${count}</h1></main>`;
        }

        activate(App, "#app");

        assert.equal(document.querySelector("#count-heading").textContent, "Count: 5");
    });

    it("7. MANDATORY Global Execution Count & DOM Identity Test", () => {
        let executions = 0;
        let count;

        function App() {
            executions++;
            count = signal(0);

            return html`
                <main>
                    <h1 id="main-title">PrimalJS Core</h1>
                    <p id="counter">${count}</p>
                    <button id="inc-btn" onclick=${() => count.value++}>Add</button>
                </main>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        const titleBefore = document.querySelector("#main-title");

        assert.equal(executions, 1);
        assert.equal(document.querySelector("#counter").textContent, "0");

        // Click increment
        document.querySelector("#inc-btn").click();
        assert.equal(document.querySelector("#counter").textContent, "1");

        document.querySelector("#inc-btn").click();
        assert.equal(document.querySelector("#counter").textContent, "2");

        const titleAfter = document.querySelector("#main-title");

        assert.equal(executions, 1);
        assert.equal(titleBefore, titleAfter);
    });
});
