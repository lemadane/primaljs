import assert from "node:assert/strict";
import { test, describe, beforeEach, afterEach } from "node:test";
import { JSDOM } from "jsdom";

import {
    html,
    signal,
    mount,
    Delay,
    Wait,
    Briefly,
    Failed,
    register,
    clearRegistry
} from "../src/index.js";

describe("PrimalJS Expressive Control Flow (<Delay>, <Wait>, <Briefly>, <Failed>)", () => {
    let dom;
    let window;
    let document;
    let container;

    beforeEach(() => {
        dom = new JSDOM("<!DOCTYPE html><html><body><div id='app'></div></body></html>", {
            url: "http://localhost/"
        });
        window = dom.window;
        document = window.document;
        globalThis.window = window;
        globalThis.document = document;
        globalThis.Node = window.Node;
        globalThis.HTMLElement = window.HTMLElement;
        globalThis.DocumentFragment = window.DocumentFragment;
        globalThis.AbortController = window.AbortController;

        clearRegistry();
        register(Delay, Wait, Briefly, Failed);
        container = document.getElementById("app");
    });

    afterEach(() => {
        delete globalThis.window;
        delete globalThis.document;
        delete globalThis.Node;
        delete globalThis.HTMLElement;
        delete globalThis.DocumentFragment;
        delete globalThis.AbortController;
    });

    test("<Delay> task with <Briefly> loading and <Failed> error fallback", async () => {
        const userId = signal(1);

        const fetchUser = (id, { signal: abortSignal }) => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (id === 1) {
                        resolve({ id: 1, name: "Lemuel" });
                    } else {
                        reject(new Error("User not found"));
                    }
                }, 20);
            });
        };

        function App() {
            return html`
                <Delay task=${({ signal: abortSignal }) => fetchUser(userId.value, { signal: abortSignal })}>
                    ${user => html`<div class="user-card">${user.name}</div>`}
                    <Briefly><p class="loading">Loading user...</p></Briefly>
                    <Failed>${(err, retry) => html`<button class="retry-btn" onclick=${retry}>Retry ${err.message}</button>`}</Failed>
                </Delay>
            `;
        }

        const app = mount(App, container);

        // 1. Initial pending state shows <Briefly>
        assert.ok(container.querySelector(".loading"));
        assert.equal(container.querySelector(".loading").textContent, "Loading user...");

        // Wait for resolution
        await new Promise(r => setTimeout(r, 40));

        // 2. Resolved state shows user-card
        assert.equal(container.querySelector(".loading"), null);
        assert.ok(container.querySelector(".user-card"));
        assert.equal(container.querySelector(".user-card").textContent, "Lemuel");

        // 3. Trigger error by updating signal to userId 2
        userId.value = 2;
        assert.ok(container.querySelector(".loading"));

        await new Promise(r => setTimeout(r, 40));

        // 4. Failed state shows retry button with error message
        assert.equal(container.querySelector(".user-card"), null);
        assert.ok(container.querySelector(".retry-btn"));
        assert.equal(container.querySelector(".retry-btn").textContent, "Retry User not found");

        app.dispose();
    });

    test("<Wait> unwraps single promise with <Briefly> and <Failed>", async () => {
        let shouldFail = false;

        const getAnalytics = () => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (shouldFail) {
                        reject(new Error("Analytics Offline"));
                    } else {
                        resolve({ visits: 4200 });
                    }
                }, 20);
            });
        };

        function AnalyticsApp() {
            return html`
                <Wait for=${getAnalytics()}>
                    ${data => html`<div class="visits">Visits: ${data.visits}</div>`}
                    <Briefly><span class="spinner">Fetching...</span></Briefly>
                    <Failed>${(err, retry) => html`<p class="err-text">${err.message}</p>`}</Failed>
                </Wait>
            `;
        }

        const app = mount(AnalyticsApp, container);

        // Pending
        assert.ok(container.querySelector(".spinner"));

        await new Promise(r => setTimeout(r, 40));

        // Resolved
        assert.equal(container.querySelector(".spinner"), null);
        assert.ok(container.querySelector(".visits"));
        assert.equal(container.querySelector(".visits").textContent, "Visits: 4200");

        app.dispose();
    });
});
