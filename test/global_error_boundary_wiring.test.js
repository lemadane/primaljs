import "./setup.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp, signal, html, onMount, onDestroy, effect, register } from "../src/index.js";

describe("PrimalJS createApp.onError Global Error Boundary Wiring", () => {
    it("wires createApp.onError into unhandled event handler crashes", () => {
        let reportedError = null;
        let reportedContext = null;

        function CrashyButton() {
            const handleClick = () => {
                throw new Error("Event handler crash!");
            };
            return html`<button id="btn" onclick=${handleClick}>Click Me</button>`;
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

        const btn = document.querySelector("#btn");
        assert.ok(btn);
        btn.click();

        assert.ok(reportedError);
        assert.equal(reportedError.message, "Event handler crash!");
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

        assert.equal(reportedError, null);

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

    it("wires createApp.onError into initial root component execution failure during mount", () => {
        let reportedError = null;
        let reportedContext = null;

        function CrashyRoot() {
            throw new Error("Root component initial render crash!");
        }

        register(CrashyRoot);

        const app = createApp({
            root: CrashyRoot,
            onError(err, ctx) {
                reportedError = err;
                reportedContext = ctx;
            }
        });

        app.mount("#app");

        assert.ok(reportedError);
        assert.equal(reportedError.message, "Root component initial render crash!");
        assert.equal(reportedContext.type, "mount");

        app.dispose();
    });

    it("isolates onError handlers across independent createApp instances", () => {
        let app1Error = null;
        let app2Error = null;

        function Comp1() {
            onMount(() => { throw new Error("App 1 Error"); });
            return html`<div>App 1</div>`;
        }

        function Comp2() {
            onMount(() => { throw new Error("App 2 Error"); });
            return html`<div>App 2</div>`;
        }

        register(Comp1, Comp2);

        const app1 = createApp({
            root: Comp1,
            onError(err) { app1Error = err; }
        });

        const app2 = createApp({
            root: Comp2,
            onError(err) { app2Error = err; }
        });

        app1.mount("#app");
        assert.ok(app1Error);
        assert.equal(app1Error.message, "App 1 Error");
        assert.equal(app2Error, null);

        app1.dispose();

        app2.mount("#app");
        assert.ok(app2Error);
        assert.equal(app2Error.message, "App 2 Error");

        app2.dispose();
    });

    it("isolates onError handlers for SIMULTANEOUSLY mounted createApp instances", () => {
        let appAError = null;
        let appBError = null;

        document.body.innerHTML = '<div id="container-a"></div><div id="container-b"></div>';

        function ComponentA() {
            onDestroy(() => { throw new Error("App A Destroy Failure"); });
            return html`<div>Content A</div>`;
        }

        function ComponentB() {
            onDestroy(() => { throw new Error("App B Destroy Failure"); });
            return html`<div>Content B</div>`;
        }

        register(ComponentA, ComponentB);

        const appA = createApp({
            root: ComponentA,
            onError(err) { appAError = err; }
        });

        const appB = createApp({
            root: ComponentB,
            onError(err) { appBError = err; }
        });

        // Mount both simultaneously
        const handleA = appA.mount("#container-a");
        const handleB = appB.mount("#container-b");

        // Trigger destroy failure in App A while App B is active
        handleA.dispose();

        assert.ok(appAError, "App A's error handler MUST receive App A's destroy error");
        assert.equal(appAError.message, "App A Destroy Failure");
        assert.equal(appBError, null, "App B's error handler MUST NOT receive App A's error");

        handleB.dispose();
        assert.ok(appBError, "App B's error handler receives App B's destroy error");
        assert.equal(appBError.message, "App B Destroy Failure");
    });
});
