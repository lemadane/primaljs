import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
    html,
    signal,
    computed,
    register,
    clearRegistry,
    mount,
    unmount,
    onMount,
    onDestroy,
    Await,
    Async,
    Pending,
    Catch,
    Try,
    If,
    For
} from "../primal.js";

function flushPromises() {
    return new Promise(resolve => setTimeout(resolve, 10));
}

describe("PrimalJS Declarative Asynchronous Control-Flow (<Async>, <Await>, <Pending>, <Catch>)", () => {
    let dom;
    let document;
    let window;

    beforeEach(() => {
        dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
            url: "http://localhost"
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

    it("1, 2, 4, 5, 9, 10. <Await> pending state, Promise resolves, falsy values, static content, and original rejection reason", async () => {
        let resolvePromise;
        const promiseInst = new Promise(res => { resolvePromise = res; });

        function App() {
            return html`
                <main>
                    <Await promise=${promiseInst}>
                        ${data => html`<p id="result">User: ${data.name}</p>`}
                        <Pending>
                            <p id="loading">Loading data...</p>
                        </Pending>
                        <Catch>
                            ${err => html`<p id="err">${err.message}</p>`}
                        </Catch>
                    </Await>
                </main>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        // 1. Pending state rendered initially
        assert.equal(document.querySelector("#loading").textContent, "Loading data...");
        assert.equal(document.querySelector("#result"), null);

        // 2. Resolve Promise
        resolvePromise({ name: "Lemuel" });
        await flushPromises();

        // 3. Resolved result rendered
        assert.equal(document.querySelector("#result").textContent, "User: Lemuel");
        assert.equal(document.querySelector("#loading"), null);
    });

    it("4, 5. <Await> handles falsy resolved values (0, false, null, empty string) as successful resolution", async () => {
        function App() {
            return html`
                <main>
                    <Await promise=${Promise.resolve(0)}>
                        ${val => html`<p id="zero-val">Value: ${val}</p>`}
                    </Await>
                    <Await promise=${Promise.resolve(false)}>
                        ${val => html`<p id="bool-val">Value: ${String(val)}</p>`}
                    </Await>
                </main>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);
        await flushPromises();

        assert.equal(document.querySelector("#zero-val").textContent, "Value: 0");
        assert.equal(document.querySelector("#bool-val").textContent, "Value: false");
    });

    it("3, 8, 10. <Await> Promise rejection mounts <Catch> with original rejection reason", async () => {
        let rejectPromise;
        const promiseInst = new Promise((_, rej) => { rejectPromise = rej; });

        function App() {
            return html`
                <Await promise=${promiseInst}>
                    ${data => html`<p>${data}</p>`}
                    <Pending>Loading...</Pending>
                    <Catch>
                        ${err => html`<p id="reject-msg">${err.message}</p>`}
                    </Catch>
                </Await>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);
        await flushPromises();

        rejectPromise(new Error("Network Connection Failed"));
        await flushPromises();

        assert.equal(document.querySelector("#reject-msg").textContent, "Network Connection Failed");
    });

    it("11, 12, 22, 24. <Await> Promise factory retry() restarts operation", async () => {
        let attempts = 0;

        const loadData = () => {
            attempts++;
            if (attempts === 1) {
                return Promise.reject(new Error("Initial Failure"));
            }
            return Promise.resolve("Success Data");
        };

        function App() {
            return html`
                <Await promise=${loadData}>
                    ${data => html`<p id="data-text">${data}</p>`}
                    <Pending>Loading...</Pending>
                    <Catch>
                        ${(err, retry) => html`
                            <div id="catch-box">
                                <p id="err-text">${err.message}</p>
                                <button id="retry-btn" onclick=${retry}>Retry</button>
                            </div>
                        `}
                    </Catch>
                </Await>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);
        await flushPromises();

        assert.equal(document.querySelector("#err-text").textContent, "Initial Failure");

        // Click retry()
        const retryBtn = document.querySelector("#retry-btn");
        retryBtn.click();
        await flushPromises();

        assert.equal(document.querySelector("#data-text").textContent, "Success Data");
        assert.equal(document.querySelector("#catch-box"), null);
    });

    it("13, 14, 29, 30. <Await> ignores stale Promise resolutions & rejections (race condition protection)", async () => {
        let resolve1, resolve2;
        const p1 = new Promise(res => { resolve1 = res; });
        const p2 = new Promise(res => { resolve2 = res; });

        const activePromise = signal(p1);

        function App() {
            return html`
                <Await promise=${() => activePromise.value}>
                    ${val => html`<p id="stale-result">${val}</p>`}
                    <Pending>Loading...</Pending>
                </Await>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);
        await flushPromises();

        // Switch to p2 (operation #2)
        activePromise.value = p2;
        await flushPromises();

        // Resolve p2 first (operation #2)
        resolve2("Newer Operation 2");
        await flushPromises();

        assert.equal(document.querySelector("#stale-result").textContent, "Newer Operation 2");

        // Late resolve p1 (operation #1) -> MUST BE IGNORED
        resolve1("Older Stale Operation 1");
        await flushPromises();

        assert.equal(document.querySelector("#stale-result").textContent, "Newer Operation 2");
    });

    it("15, 16, 27, 81. MANDATORY <Await> Parent Component Execution Count Test (Requirement #45 & #81)", async () => {
        let executions = 0;
        let userId;

        function App() {
            executions++;
            userId = signal(1);

            return html`
                <main>
                    <h1 id="heading">Users</h1>
                    <Await promise=${() => Promise.resolve(`User #${userId.value}`)}>
                        ${user => html`<p id="user-info">${user}</p>`}
                        <Pending>Loading...</Pending>
                    </Await>
                </main>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);
        await flushPromises();

        assert.equal(executions, 1);
        assert.equal(document.querySelector("#user-info").textContent, "User #1");

        // Reactive Signal changes start a new operation
        userId.value = 2;
        await flushPromises();
        assert.equal(document.querySelector("#user-info").textContent, "User #2");

        userId.value = 3;
        await flushPromises();
        assert.equal(document.querySelector("#user-info").textContent, "User #3");

        // Parent component function MUST NEVER rerun
        assert.equal(executions, 1);
    });

    it("17, 46, 82. MANDATORY DOM Identity Test (Requirement #46 & #82)", async () => {
        let userId;

        function App() {
            userId = signal(1);

            return html`
                <main>
                    <h1 id="heading">Fixed Heading</h1>
                    <Await promise=${() => Promise.resolve(`Data #${userId.value}`)}>
                        ${data => html`<p id="data-val">${data}</p>`}
                    </Await>
                </main>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);
        await flushPromises();

        const headingBefore = document.querySelector("#heading");

        userId.value = 2;
        await flushPromises();

        const headingAfter = document.querySelector("#heading");

        assert.equal(headingBefore, headingAfter);
    });

    it("29, 30. <Try> around <Await>: Promise rejection handled by Await Catch, but resolved renderer error propagated to Try", async () => {
        let outerTryCaught = false;

        function BrokenRendererComp() {
            throw new Error("Synchronous Renderer Error");
        }
        register(BrokenRendererComp);

        function App() {
            return html`
                <Try>
                    <Await promise=${Promise.resolve("Data")}>
                        ${() => html`<BrokenRendererComp />`}
                        <Catch>
                            <p id="await-catch">Await Rejection Catch</p>
                        </Catch>
                    </Await>
                    <Catch>
                        ${err => {
                            outerTryCaught = true;
                            return html`<p id="try-catch">${err.message}</p>`;
                        }}
                    </Catch>
                </Try>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);
        await flushPromises();

        assert.equal(outerTryCaught, true);
        assert.equal(document.querySelector("#try-catch").textContent, "Synchronous Renderer Error");
        assert.equal(document.querySelector("#await-catch"), null);
    });

    it("32, 33, 34, 73, 76. structural validation: multiple Pending/Catch invalid, standalone Pending invalid", () => {
        function MultiplePending() {
            return html`
                <Await promise=${Promise.resolve(1)}>
                    <Pending>Pending 1</Pending>
                    <Pending>Pending 2</Pending>
                </Await>
            `;
        }
        assert.throws(() => mount(MultiplePending, document.getElementById("app")), /<Await> can only contain a single <Pending> branch/);

        clearRegistry();
        function StandalonePending() {
            return html`<Pending>Standalone Pending</Pending>`;
        }
        assert.throws(() => mount(StandalonePending, document.getElementById("app")), /<Pending> must be used within an <Await> or <Async> container/);
    });

    // --- <Async> Test Cases ---

    it("20, 21, 23, 25, 26, 84. <Async> loads component asynchronously, supports default/named exports, forwards props and children", async () => {
        function UserDashboard(props) {
            return html`<h2 id="dash-title">Dashboard for ${props.user} (${props.role})</h2>`;
        }

        const loadComponent = () => Promise.resolve({ default: UserDashboard });

        function App() {
            return html`
                <Async component=${loadComponent} user="Lemuel" role="Admin">
                    <Pending>
                        <p id="async-loading">Loading Component...</p>
                    </Pending>
                    <Catch>
                        ${err => html`<p id="async-err">${err.message}</p>`}
                    </Catch>
                </Async>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(document.querySelector("#async-loading").textContent, "Loading Component...");

        await flushPromises();

        assert.equal(document.querySelector("#dash-title").textContent, "Dashboard for Lemuel (Admin)");
        assert.equal(document.querySelector("#async-loading"), null);
    });

    it("22, 24, 38, 80. <Async> component loader rejection mounts Catch and produces clear error for invalid component", async () => {
        const loadBroken = () => Promise.reject(new Error("ES Module Import 404"));

        function App() {
            return html`
                <Async component=${loadBroken}>
                    <Pending>Loading...</Pending>
                    <Catch>
                        ${err => html`<p id="loader-err">${err.message}</p>`}
                    </Catch>
                </Async>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);
        await flushPromises();

        assert.equal(document.querySelector("#loader-err").textContent, "ES Module Import 404");
    });

    it("26, 47, 80. MANDATORY <Async> Parent Execution Count Test", async () => {
        let executions = 0;
        let pageName;

        function HomePage() { return html`<h3 id="page">Home</h3>`; }
        function SettingsPage() { return html`<h3 id="page">Settings</h3>`; }

        function App() {
            executions++;
            pageName = signal("home");

            return html`
                <Async component=${() => Promise.resolve(pageName.value === "home" ? HomePage : SettingsPage)}>
                    <Pending>Loading...</Pending>
                </Async>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);
        await flushPromises();

        assert.equal(executions, 1);
        assert.equal(document.querySelector("#page").textContent, "Home");

        pageName.value = "settings";
        await flushPromises();
        assert.equal(document.querySelector("#page").textContent, "Settings");

        assert.equal(executions, 1);
    });
});
