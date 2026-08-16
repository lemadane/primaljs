import { describe, it } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { createApp, reportGlobalError } from "../src/app.js";
import { PrimalJSError, setDevMode } from "../src/diagnostics.js";
import { html } from "../src/html.js";

describe("PrimalJS Development Diagnostics & Global Error Handling", () => {
    it("instantiates PrimalJSError with custom message and context", () => {
        const err = new PrimalJSError("<ElseIf> cannot appear after <Else>.", { component: "Dashboard" });
        assert.equal(err.name, "PrimalJSError");
        assert.equal(err.message, "PrimalJS: <ElseIf> cannot appear after <Else>.");
        assert.deepEqual(err.context, { component: "Dashboard" });
    });

    it("createApp configures onError handler and receives unhandled errors with context", () => {
        let reportedErr = null;
        let reportedCtx = null;

        const app = createApp({
            root: () => html`<div id="root">Hello</div>`,
            dev: true,
            onError(err, context) {
                reportedErr = err;
                reportedCtx = context;
            }
        });

        const appEl = document.getElementById("app");
        const handle = app.mount(appEl);

        const testError = new Error("Uncaught Error");
        reportGlobalError(testError, { type: "component_render", component: "App" });

        assert.equal(reportedErr, testError);
        assert.deepEqual(reportedCtx, { type: "component_render", component: "App" });

        handle.dispose();
    });

    it("prevents infinite error handling loops if global onError handler itself throws", () => {
        const app = createApp({
            root: () => html`<div>Test</div>`,
            onError() {
                throw new Error("Error inside onError callback");
            }
        });

        const appEl = document.getElementById("app");
        const handle = app.mount(appEl);

        assert.doesNotThrow(() => {
            reportGlobalError(new Error("Initial Error"));
        });

        handle.dispose();
    });
});
