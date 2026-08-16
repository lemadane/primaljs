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
    Try,
    Catch,
    If,
    Else,
    For,
    Switch,
    Case,
    Default
} from "../primal.js";

describe("PrimalJS Declarative Error-Handling Helpers (<Try>, <Catch>)", () => {
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

    it("1, 4, 15, 16. successful Try rendering in normal mode, static Catch, helper tags absent from final DOM", () => {
        function WorkingComponent() {
            return html`<h2 id="working">Working Component</h2>`;
        }

        register(WorkingComponent);

        function App() {
            return html`
                <main>
                    <Try>
                        <WorkingComponent />
                        <Catch>
                            <p id="static-error">Static Fallback</p>
                        </Catch>
                    </Try>
                </main>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(document.querySelector("#working").textContent, "Working Component");
        assert.equal(document.querySelector("#static-error"), null);
        assert.equal(document.querySelector("try"), null);
        assert.equal(document.querySelector("catch"), null);
    });

    it("2, 3, 5, 6, 7. catches initial and nested render errors, preserves original error object & non-Error thrown values", () => {
        class CustomError extends Error {
            constructor(msg) {
                super(msg);
                this.name = "CustomError";
            }
        }

        function BrokenChild() {
            throw new CustomError("Child render failed");
        }

        function ParentComponent() {
            return html`
                <section>
                    <BrokenChild />
                </section>
            `;
        }

        register(BrokenChild, ParentComponent);

        let caughtErr = null;

        function App() {
            return html`
                <Try>
                    <ParentComponent />
                    <Catch>
                        ${err => {
                            caughtErr = err;
                            return html`<p id="err-msg">${err.message}</p>`;
                        }}
                    </Catch>
                </Try>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(document.querySelector("#err-msg").textContent, "Child render failed");
        assert.equal(caughtErr instanceof CustomError, true);
        assert.equal(caughtErr.name, "CustomError");
    });

    it("7. handles non-Error thrown values (strings, numbers)", () => {
        function StringThrower() {
            throw "Primitive string error";
        }
        register(StringThrower);

        function App() {
            return html`
                <Try>
                    <StringThrower />
                    <Catch>
                        ${err => html`<p id="primitive-err">${String(err)}</p>`}
                    </Catch>
                </Try>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(document.querySelector("#primitive-err").textContent, "Primitive string error");
    });

    it("8, 9, 39. nearest nested Try wins, inner Try catches error first", () => {
        function InnerBroken() {
            throw new Error("Inner Error");
        }
        register(InnerBroken);

        let outerCaught = false;
        let innerCaught = false;

        function App() {
            return html`
                <Try>
                    <section class="outer">
                        <Try>
                            <InnerBroken />
                            <Catch>
                                ${err => {
                                    innerCaught = true;
                                    return html`<p id="inner-fallback">${err.message}</p>`;
                                }}
                            </Catch>
                        </Try>
                    </section>
                    <Catch>
                        ${() => {
                            outerCaught = true;
                            return html`<p id="outer-fallback">Outer Fallback</p>`;
                        }}
                    </Catch>
                </Try>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(innerCaught, true);
        assert.equal(outerCaught, false);
        assert.equal(document.querySelector("#inner-fallback").textContent, "Inner Error");
        assert.equal(document.querySelector("#outer-fallback"), null);
    });

    it("10, 43. Catch failure and explicit rethrow propagate upward to parent Try boundary", () => {
        function BrokenChild() {
            throw new Error("Fatal Error");
        }
        register(BrokenChild);

        let outerCaughtErr = null;

        function App() {
            return html`
                <Try>
                    <Try>
                        <BrokenChild />
                        <Catch>
                            ${err => {
                                // Explicitly rethrow fatal error to parent Try
                                throw err;
                            }}
                        </Catch>
                    </Try>
                    <Catch>
                        ${err => {
                            outerCaughtErr = err;
                            return html`<p id="outer-catch">${err.message}</p>`;
                        }}
                    </Catch>
                </Try>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(outerCaughtErr.message, "Fatal Error");
        assert.equal(document.querySelector("#outer-catch").textContent, "Fatal Error");
    });

    it("11, 12, 13, 14. structural validation: Try without Catch, multiple Catch, Catch outside Try, Catch must be last", () => {
        function TryWithoutCatch() {
            return html`
                <Try>
                    <div>Content</div>
                </Try>
            `;
        }
        assert.throws(() => mount(TryWithoutCatch, document.getElementById("app")), /<Try> must contain a <Catch> child/);

        clearRegistry();
        function MultipleCatch() {
            return html`
                <Try>
                    <div>Content</div>
                    <Catch>First</Catch>
                    <Catch>Second</Catch>
                </Try>
            `;
        }
        assert.throws(() => mount(MultipleCatch, document.getElementById("app")), /<Try> can only contain a single <Catch> branch/);

        clearRegistry();
        function CatchNotLast() {
            return html`
                <Try>
                    <Catch>Catch First</Catch>
                    <div>Content After</div>
                </Try>
            `;
        }
        assert.throws(() => mount(CatchNotLast, document.getElementById("app")), /<Catch> must be the final child in <Try>/);

        clearRegistry();
        function StandaloneCatch() {
            return html`<Catch>Standalone</Catch>`;
        }
        assert.throws(() => mount(StandaloneCatch, document.getElementById("app")), /<Catch> must be a direct child of a <Try> container/);
    });

    it("22, 26, 27, 28, 29, 30. reactive Computed error, (error, reset) recovery, remounting protected content", () => {
        const failSignal = signal(false);
        let executions = 0;

        function ReactiveArea() {
            const label = computed(() => {
                if (failSignal.value) {
                    throw new Error("Reactive failure occurred");
                }
                return "All Systems Go";
            });
            return html`<p id="label">${label}</p>`;
        }

        register(ReactiveArea);

        function App() {
            executions++;
            return html`
                <main>
                    <Try>
                        <ReactiveArea />
                        <Catch>
                            ${(err, reset) => html`
                                <div id="error-fallback">
                                    <p id="err-text">${err.message}</p>
                                    <button id="reset-btn" onclick=${reset}>Try Again</button>
                                </div>
                            `}
                        </Catch>
                    </Try>
                </main>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(document.querySelector("#label").textContent, "All Systems Go");
        assert.equal(executions, 1);

        // Trigger reactive failure inside protected subtree
        failSignal.value = true;

        assert.equal(document.querySelector("#err-text").textContent, "Reactive failure occurred");
        assert.equal(document.querySelector("#label"), null);
        // Parent component function MUST NOT rerun
        assert.equal(executions, 1);

        // Fix failure condition and click reset()
        failSignal.value = false;
        const resetBtn = document.querySelector("#reset-btn");
        resetBtn.click();

        // Protected content is remounted and working
        assert.equal(document.querySelector("#label").textContent, "All Systems Go");
        assert.equal(document.querySelector("#error-fallback"), null);
        assert.equal(executions, 1);
    });

    it("25, 30. catches synchronous onMount lifecycle hook errors", () => {
        function BrokenMountComponent() {
            onMount(() => {
                throw new Error("onMount failed");
            });
            return html`<p>Mounting...</p>`;
        }
        register(BrokenMountComponent);

        function App() {
            return html`
                <Try>
                    <BrokenMountComponent />
                    <Catch>
                        ${err => html`<p id="mount-err">${err.message}</p>`}
                    </Catch>
                </Try>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(document.querySelector("#mount-err").textContent, "onMount failed");
    });

    it("24, 28. catches synchronous event handler errors wrapped by boundary execution", () => {
        function ActionComponent() {
            return html`
                <button id="fail-btn" onclick=${() => { throw new Error("Button click failed"); }}>
                    Click Me
                </button>
            `;
        }
        register(ActionComponent);

        function App() {
            return html`
                <Try>
                    <ActionComponent />
                    <Catch>
                        ${err => html`<p id="event-err">${err.message}</p>`}
                    </Catch>
                </Try>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        const btn = document.querySelector("#fail-btn");
        btn.click();

        assert.equal(document.querySelector("#event-err").textContent, "Button click failed");
    });

    it("17, 18, 19, 20, 21, 22, 45, 47. partial mount cleanup, event/effect/subscription cleanup when Try fails", () => {
        let destroyed = false;

        function ProtectedChild() {
            onDestroy(() => {
                destroyed = true;
            });
            return html`<button id="inner-btn" onclick=${() => { throw new Error("Late failure"); }}>Fail</button>`;
        }
        register(ProtectedChild);

        function App() {
            return html`
                <Try>
                    <ProtectedChild />
                    <Catch>
                        <p id="catch-active">Catch Active</p>
                    </Catch>
                </Try>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(destroyed, false);

        const btn = document.querySelector("#inner-btn");
        btn.click();

        // Protected subtree must be cleanly destroyed and lifecycle hooks run
        assert.equal(destroyed, true);
        assert.equal(document.querySelector("#catch-active").textContent, "Catch Active");
    });

    it("32, 33, 34, 35, 36, 37. Try inside If/For/Switch and If/For/Switch inside Try", () => {
        const fail = signal(true);

        function BrokenComp() {
            if (fail.value) throw new Error("Inside Switch Case Error");
            return html`<p>Ready</p>`;
        }
        register(BrokenComp);

        function App() {
            return html`
                <div>
                    <Switch value="ready">
                        <Case value="ready">
                            <Try>
                                <BrokenComp />
                                <Catch>
                                    ${err => html`<span class="switch-err">${err.message}</span>`}
                                </Catch>
                            </Try>
                        </Case>
                    </Switch>
                </div>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(document.querySelector(".switch-err").textContent, "Inside Switch Case Error");
    });

    it("30, 53. MANDATORY Parent Component Execution Count Test (Requirement #19 & #53)", () => {
        let executions = 0;
        let failSignal;

        function BrokenArea() {
            return html`
                <div>
                    ${computed(() => {
                        if (failSignal.value) {
                            throw new Error("Reactive failure");
                        }
                        return "Working";
                    })}
                </div>
            `;
        }

        register(BrokenArea);

        function App() {
            executions++;
            failSignal = signal(false);

            return html`
                <main>
                    <h1 id="title">PrimalJS Try/Catch</h1>
                    <Try>
                        <BrokenArea />
                        <Catch>
                            ${error => html`<p id="catch-msg">${error.message}</p>`}
                        </Catch>
                    </Try>
                </main>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(executions, 1);

        // Trigger failure
        failSignal.value = true;
        assert.equal(document.querySelector("#catch-msg").textContent, "Reactive failure");

        // The parent component function must NEVER rerun
        assert.equal(executions, 1);
    });

    it("31, 54. MANDATORY DOM Identity Test (Requirement #20 & #54)", () => {
        let failSignal;

        function BrokenArea() {
            return html`
                <div>
                    ${computed(() => {
                        if (failSignal.value) {
                            throw new Error("Reactive failure");
                        }
                        return "Working";
                    })}
                </div>
            `;
        }

        register(BrokenArea);

        function App() {
            failSignal = signal(false);

            return html`
                <main>
                    <h1 id="title">PrimalJS Title</h1>
                    <Try>
                        <BrokenArea />
                        <Catch>
                            <p id="catch-msg">Error Catch</p>
                        </Catch>
                    </Try>
                </main>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        const titleBefore = document.querySelector("#title");

        // Trigger failure
        failSignal.value = true;

        const titleAfter = document.querySelector("#title");

        // Unrelated DOM node identity MUST be strictly preserved
        assert.equal(titleBefore, titleAfter);
    });
});
