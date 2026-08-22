import "./setup.js";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
    html,
    signal,
    mount,
    clearRegistry,
    register,
    Wait,
    Delay,
    Briefly,
    Failed,
    Boundary
} from "../src/index.js";

describe("PrimalJS Async Resource Components (<Wait>, <Delay>, <Briefly>, <Failed>)", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        clearRegistry();
    });

    it("1. <Wait>: renders <Briefly> while pending and resolved data on fulfillment", async () => {
        let resolveFn;
        const promise = new Promise((resolve) => {
            resolveFn = resolve;
        });

        function App() {
            return html`
                <Wait for=${promise}>
                    ${user => html`<div class="user-card">User: ${user.name}</div>`}

                    <Briefly>
                        <div class="spinner">Loading user...</div>
                    </Briefly>
                </Wait>
            `;
        }

        register(Wait, Briefly, App);
        mount(App, container);

        assert.equal(container.querySelector(".spinner").textContent, "Loading user...");
        assert.equal(container.querySelector(".user-card"), null);

        // Resolve Promise
        resolveFn({ name: "Lemuel Adane" });
        await new Promise(r => setTimeout(r, 25));

        assert.equal(container.querySelector(".user-card").textContent, "User: Lemuel Adane");
        assert.equal(container.querySelector(".spinner"), null);
    });

    it("2. <Wait>: renders <Failed> slot on rejection and supports retry()", async () => {
        let rejectFn;
        let resolveFn;
        let attempt = 0;

        function createPromise() {
            attempt++;
            return new Promise((resolve, reject) => {
                if (attempt === 1) {
                    rejectFn = reject;
                } else {
                    resolveFn = resolve;
                }
            });
        }

        const promiseSignal = signal(createPromise());

        function App() {
            return html`
                <Wait for=${promiseSignal}>
                    ${data => html`<div class="data">${data}</div>`}

                    <Briefly>
                        <div class="loading">Loading...</div>
                    </Briefly>

                    <Failed>
                        ${(err, retry) => html`
                            <div class="error-box">
                                <span>Failed: ${err.message}</span>
                                <button class="retry-btn" onclick=${() => {
                                    promiseSignal.value = createPromise();
                                    retry();
                                }}>Retry</button>
                            </div>
                        `}
                    </Failed>
                </Wait>
            `;
        }

        register(Wait, Briefly, Failed, App);
        mount(App, container);

        // Reject first attempt
        rejectFn(new Error("Network Timeout"));
        await new Promise(r => setTimeout(r, 10));

        assert.equal(container.querySelector(".error-box span").textContent, "Failed: Network Timeout");

        // Click retry
        const retryBtn = container.querySelector(".retry-btn");
        retryBtn.click();
        await new Promise(r => setTimeout(r, 5));

        assert.equal(container.querySelector(".loading").textContent, "Loading...");

        // Fulfill second attempt
        resolveFn("Success Data");
        await new Promise(r => setTimeout(r, 10));

        assert.equal(container.querySelector(".data").textContent, "Success Data");
    });

    it("3. <Wait>: propagates error to <Boundary> when <Failed> is absent", async () => {
        let rejectFn;
        const promise = new Promise((_, reject) => {
            rejectFn = reject;
        });

        function App() {
            return html`
                <Boundary fallback=${(err) => html`<div class="boundary-error">Boundary Caught: ${err.message}</div>`}>
                    <Wait for=${promise}>
                        ${data => html`<div>${data}</div>`}

                        <Briefly>
                            <div class="loading">Loading...</div>
                        </Briefly>
                    </Wait>
                </Boundary>
            `;
        }

        register(Wait, Briefly, Boundary, App);
        mount(App, container);

        assert.equal(container.querySelector(".loading").textContent, "Loading...");

        // Reject Promise without local <Failed> slot
        rejectFn(new Error("Fatal Async Error"));
        await new Promise(r => setTimeout(r, 10));

        assert.equal(container.querySelector(".boundary-error").textContent, "Boundary Caught: Fatal Async Error");
    });

    it("4. <Wait>: discards stale Promise resolutions when for prop updates", async () => {
        let resolve1;
        let resolve2;

        const p1 = new Promise(r => { resolve1 = r; });
        const p2 = new Promise(r => { resolve2 = r; });

        const activePromise = signal(p1);

        function App() {
            return html`
                <Wait for=${activePromise}>
                    ${data => html`<div class="res">${data}</div>`}
                </Wait>
            `;
        }

        register(Wait, App);
        mount(App, container);

        // Switch to p2
        activePromise.value = p2;
        await new Promise(r => setTimeout(r, 5));

        // Resolve p1 (stale)
        resolve1("Stale P1 Result");
        await new Promise(r => setTimeout(r, 10));

        assert.equal(container.querySelector(".res"), null, "Stale P1 resolution must be ignored");

        // Resolve p2 (current)
        resolve2("Fresh P2 Result");
        await new Promise(r => setTimeout(r, 10));

        assert.equal(container.querySelector(".res").textContent, "Fresh P2 Result");
    });

    it("5. <Delay>: executes reactive async task, passes AbortController signal & handles dependencies", async () => {
        const userId = signal(1);
        const abortedIds = [];

        function App() {
            return html`
                <Delay task=${({ signal: abortSignal }) => {
                    const id = userId.value;
                    return new Promise((resolve, reject) => {
                        const timer = setTimeout(() => {
                            resolve(`User Data for ID ${id}`);
                        }, 30);

                        if (abortSignal) {
                            abortSignal.addEventListener("abort", () => {
                                clearTimeout(timer);
                                abortedIds.push(id);
                                reject(new DOMException("Aborted", "AbortError"));
                            });
                        }
                    });
                }}>
                    ${user => html`<div class="user">${user}</div>`}

                    <Briefly>
                        <div class="skeleton">Fetching user...</div>
                    </Briefly>
                </Delay>
            `;
        }

        register(Delay, Briefly, App);
        mount(App, container);

        assert.equal(container.querySelector(".skeleton").textContent, "Fetching user...");

        // Rapidly change userId signal before request 1 finishes
        await new Promise(r => setTimeout(r, 10));
        userId.value = 2;

        await new Promise(r => setTimeout(r, 50));

        assert.ok(abortedIds.includes(1), "Task for userId 1 must be aborted");
        assert.equal(container.querySelector(".user").textContent, "User Data for ID 2");
    });
});
