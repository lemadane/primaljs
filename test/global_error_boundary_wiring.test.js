import "./setup.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp, html, onMount, onDestroy, effect, signal, register } from "../src/index.js";

describe("PrimalJS createApp.onError Global Error Boundary Wiring", () => {
    it("wires createApp.onError into unhandled event handler crashes", () => {
        let reportedError = null;
        let reportedContext = null;

        function CrashyButton() {
            return html`<button id="crash-btn" onclick=${() => { throw new Error("Button click crash!"); }}>Click Me</button>`;
        }

        register(CrashyButton);

        const app = createApp({
            root: CrashyButton,
            onError(err, ctx) {
                reportedError = err;
                reportedContext = ctx;
            }
        });

        app.mount("#app");

        const btn = document.getElementById("crash-btn");
        btn.click();

        assert.ok(reportedError);
        assert.equal(reportedError.message, "Button click crash!");
        assert.equal(reportedContext.type, "event_handler");

        app.dispose();
    });

    it("wires createApp.onError into unhandled onMount lifecycle hook crashes", () => {
        let reportedError = null;
        let reportedContext = null;

        function CrashyMount() {
            onMount(() => {
                throw new Error("onMount hook crash!");
            });
            return html`<div>Mount Content</div>`;
        }

        register(CrashyMount);

        const app = createApp({
            root: CrashyMount,
            onError(err, ctx) {
                reportedError = err;
                reportedContext = ctx;
            }
        });

        app.mount("#app");

        assert.ok(reportedError);
        assert.equal(reportedError.message, "onMount hook crash!");
        assert.equal(reportedContext.type, "onMount");

        app.dispose();
    });

    it("wires createApp.onError into unhandled onDestroy lifecycle hook crashes", () => {
        let reportedError = null;
        let reportedContext = null;

        function CrashyDestroy() {
            onDestroy(() => {
                throw new Error("onDestroy hook crash!");
            });
            return html`<div>Destroy Content</div>`;
        }

        register(CrashyDestroy);

        const app = createApp({
            root: CrashyDestroy,
            onError(err, ctx) {
                reportedError = err;
                reportedContext = ctx;
            }
        });

        const handle = app.mount("#app");
        handle.dispose();

        assert.ok(reportedError);
        assert.equal(reportedError.message, "onDestroy hook crash!");
        assert.equal(reportedContext.type, "onDestroy");
    });

    it("wires createApp.onError into unhandled reactive effect crashes", () => {
        let reportedError = null;
        let reportedContext = null;

        const count = signal(0);

        function CrashyEffect() {
            effect(() => {
                if (count.value > 0) {
                    throw new Error("Reactive effect crash!");
                }
            });
            return html`<div>Effect Content</div>`;
        }

        register(CrashyEffect);

        const app = createApp({
            root: CrashyEffect,
            onError(err, ctx) {
                reportedError = err;
                reportedContext = ctx;
            }
        });

        app.mount("#app");

        assert.throws(() => {
            count.value = 1;
        }, /Reactive effect crash/);

        assert.ok(reportedError);
        assert.equal(reportedError.message, "Reactive effect crash!");
        assert.equal(reportedContext.type, "effect");

        app.dispose();
    });
});
