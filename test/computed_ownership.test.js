import "./setup.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { signal, computed, effect } from "../src/signal.js";
import { ComponentContext, pushContext, popContext, destroyContext } from "../src/lifecycle.js";

describe("PrimalJS Computed Ownership & Resource Disposal", () => {
    it("unsubscribes computed from upstream signals when context is destroyed", () => {
        const count = signal(5);
        const ctx = new ComponentContext("TestComponent");

        pushContext(ctx);
        const doubled = computed(() => count.value * 2);
        popContext();

        // Evaluate computed value initially
        assert.equal(doubled.value, 10);
        assert.equal(count.subscribers.size, 1);

        // Destroy component context
        destroyContext(ctx);

        // Count subscribers set must be unlinked and empty
        assert.equal(count.subscribers.size, 0);

        // Updating upstream count must not re-evaluate or throw
        count.value = 20;
        assert.equal(doubled.value, 10); // Returns cached value post-disposal
    });

    it("supports explicit .dispose() call on Computed instance", () => {
        const factor = signal(3);
        const base = signal(10);
        const product = computed(() => base.value * factor.value);

        assert.equal(product.value, 30);
        assert.equal(base.subscribers.size, 1);
        assert.equal(factor.subscribers.size, 1);

        // Explicitly dispose computed
        product.dispose();

        assert.equal(base.subscribers.size, 0);
        assert.equal(factor.subscribers.size, 0);

        // State changes do not notify disposed computed
        factor.value = 5;
        base.value = 100;
        assert.equal(product.value, 30);
    });

    it("cleans up nested computeds when outer owner context is disposed", () => {
        const outerSignal = signal("A");
        const ctx = new ComponentContext("Parent");

        pushContext(ctx);
        const outerComputed = computed(() => `Outer: ${outerSignal.value}`);

        const childCtx = new ComponentContext("Child");
        pushContext(childCtx);
        const innerComputed = computed(() => `Inner: ${outerComputed.value}`);
        popContext();
        popContext();

        assert.equal(innerComputed.value, "Inner: Outer: A");
        assert.equal(outerSignal.subscribers.size, 1);

        // Disposing parent context recursively disposes child context and both computeds
        destroyContext(ctx);

        assert.equal(outerSignal.subscribers.size, 0);
        assert.equal(outerComputed.subscribers.size, 0);
    });
});
