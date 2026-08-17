import "./setup.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mount, activate, effect, signal, onDestroy } from "../src/index.js";

describe("PrimalJS mount() & activate() Exception Safety", () => {
    it("cleans up partial contexts and targetEl._primalCtx when mount() throws an exception", () => {
        let destroyed = false;
        const count = signal(0);

        function BrokenComponent() {
            effect(() => {
                const val = count.value;
            });
            onDestroy(() => {
                destroyed = true;
            });
            throw new Error("Render-time crash during mount!");
        }

        const targetEl = document.getElementById("app");
        assert.equal(targetEl._primalCtx, undefined);

        assert.throws(() => {
            mount(BrokenComponent, "#app");
        }, /Render-time crash/);

        // Verify targetEl._primalCtx reference was removed
        assert.equal(targetEl._primalCtx, undefined);
        // Verify targetEl container was reset
        assert.equal(targetEl.innerHTML, "");
        // Verify onDestroy cleanup ran for partial context
        assert.equal(destroyed, true);
        // Verify signal subscriber was unlinked
        assert.equal(count.subscribers.size, 0);
    });

    it("cleans up partial contexts and targetEl._primalCtx when activate() throws an exception", () => {
        let destroyed = false;
        const count = signal(10);

        function BrokenActivationApp() {
            effect(() => {
                const val = count.value;
            });
            onDestroy(() => {
                destroyed = true;
            });
            throw new Error("Activation crash!");
        }

        const targetEl = document.getElementById("app");
        targetEl.innerHTML = `<div>Pre-rendered content</div>`;
        assert.equal(targetEl._primalCtx, undefined);

        assert.throws(() => {
            activate(BrokenActivationApp, "#app");
        }, /Activation crash/);

        assert.equal(targetEl._primalCtx, undefined);
        assert.equal(destroyed, true);
        assert.equal(count.subscribers.size, 0);
    });
});
