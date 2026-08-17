import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createApp, setGlobalOnError } from "../src/app.js";
import { signal, effect } from "../src/signal.js";
import { html } from "../src/html.js";
import { onMount, onDestroy } from "../src/lifecycle.js";

let dom;
let window;
let document;

before(() => {
    dom = new JSDOM("<!DOCTYPE html><html><body><div id='app'></div></body></html>", {
        url: "http://localhost/",
        runScripts: "dangerously"
    });
    window = dom.window;
    document = window.document;

    globalThis.window = window;
    globalThis.document = document;
    globalThis.HTMLElement = window.HTMLElement;
    globalThis.Node = window.Node;
    globalThis.Event = window.Event;
    globalThis.MouseEvent = window.MouseEvent;
    globalThis.CustomEvent = window.CustomEvent;
});

beforeEach(() => {
    setGlobalOnError(null);
    document.body.innerHTML = "<div id='app'></div>";
});

describe("createApp({ onError }) Global Error Boundary Connection", () => {
    it("captures event handler exceptions via createApp.onError", async () => {
        let reportedError = null;
        let reportedContext = null;

        function ComponentWithBadHandler() {
            return html`<button class="bad-btn" onclick=${() => { throw new Error("Event Handler Crashed"); }}>Click Me</button>`;
        }

        const app = createApp({
            root: ComponentWithBadHandler,
            onError(err, ctx) {
                reportedError = err;
                reportedContext = ctx;
            }
        });

        const handle = app.mount("#app");
        const btn = document.querySelector(".bad-btn");
        assert.ok(btn);

        btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

        assert.ok(reportedError);
        assert.equal(reportedError.message, "Event Handler Crashed");
        assert.equal(reportedContext.type, "event_handler");

        handle.dispose();
    });

    it("captures onMount hook exceptions via createApp.onError", async () => {
        let reportedError = null;
        let reportedContext = null;

        function ComponentWithBadMount() {
            onMount(() => {
                throw new Error("onMount Lifecycle Hook Crashed");
            });
            return html`<div>Component Content</div>`;
        }

        const app = createApp({
            root: ComponentWithBadMount,
            onError(err, ctx) {
                reportedError = err;
                reportedContext = ctx;
            }
        });

        const handle = app.mount("#app");

        assert.ok(reportedError);
        assert.equal(reportedError.message, "onMount Lifecycle Hook Crashed");
        assert.equal(reportedContext.type, "onMount");

        handle.dispose();
    });

    it("captures window error events via createApp.onError", async () => {
        let reportedError = null;
        let reportedContext = null;

        const app = createApp({
            root: () => html`<div>App Root</div>`,
            onError(err, ctx) {
                reportedError = err;
                reportedContext = ctx;
            }
        });

        const handle = app.mount("#app");

        const uncaughtErr = new Error("Uncaught Window Error");
        const event = new window.ErrorEvent("error", {
            error: uncaughtErr,
            message: uncaughtErr.message,
            filename: "app.js",
            lineno: 42
        });

        window.dispatchEvent(event);

        assert.ok(reportedError);
        assert.equal(reportedError.message, "Uncaught Window Error");
        assert.equal(reportedContext.type, "uncaughtException");

        handle.dispose();
    });

    it("captures window unhandledrejection events via createApp.onError", async () => {
        let reportedError = null;
        let reportedContext = null;

        const app = createApp({
            root: () => html`<div>App Root</div>`,
            onError(err, ctx) {
                reportedError = err;
                reportedContext = ctx;
            }
        });

        const handle = app.mount("#app");

        const rejectedReason = new Error("Unhandled Promise Rejection Error");
        const rejectedPromise = Promise.reject(rejectedReason);
        rejectedPromise.catch(() => {});

        let rejEvent;
        try {
            rejEvent = new window.PromiseRejectionEvent("unhandledrejection", {
                reason: rejectedReason,
                promise: rejectedPromise
            });
        } catch (_) {
            rejEvent = new window.Event("unhandledrejection");
            rejEvent.reason = rejectedReason;
            rejEvent.promise = rejectedPromise;
        }

        window.dispatchEvent(rejEvent);

        assert.ok(reportedError);
        assert.equal(reportedError.message, "Unhandled Promise Rejection Error");
        assert.equal(reportedContext.type, "unhandledRejection");

        handle.dispose();
    });
});
