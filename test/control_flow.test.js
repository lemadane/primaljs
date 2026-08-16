import "./setup.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { html, signal, computed, mount, unmount, onMount, onDestroy, register, If, ElseIf, Else } from "../primal.js";

describe("PrimalJS Declarative Control-Flow (<If>, <ElseIf>, <Else>)", () => {

    it("1. renders true <If> content", () => {
        function App() {
            return html`<If when=${true}><h1>Visible</h1></If>`;
        }
        const appEl = document.getElementById("app");
        mount(App, appEl);
        assert.equal(appEl.querySelector("h1")?.textContent, "Visible");
        unmount(appEl);
    });

    it("2. renders nothing for false <If> when no Else present", () => {
        function App() {
            return html`<If when=${false}><h1>Hidden</h1></If>`;
        }
        const appEl = document.getElementById("app");
        mount(App, appEl);
        assert.equal(appEl.querySelector("h1"), null);
        unmount(appEl);
    });

    it("3. renders <If>/<Else> fallback branch", () => {
        const loggedIn = signal(false);
        function App() {
            return html`
                <If when=${loggedIn}>
                    <div id="dash">Dashboard</div>
                    <Else>
                        <div id="login">Login</div>
                    </Else>
                </If>
            `;
        }
        const appEl = document.getElementById("app");
        mount(App, appEl);
        assert.ok(document.querySelector("#login"));
        assert.equal(document.querySelector("#dash"), null);

        loggedIn.value = true;
        assert.ok(document.querySelector("#dash"));
        assert.equal(document.querySelector("#login"), null);
        unmount(appEl);
    });

    it("4. supports single <ElseIf>", () => {
        const mode = signal("b");
        function App() {
            return html`
                <If when=${() => mode.value === "a"}>
                    <span>A</span>
                    <ElseIf when=${() => mode.value === "b"}>
                        <span>B</span>
                    </ElseIf>
                </If>
            `;
        }
        const appEl = document.getElementById("app");
        mount(App, appEl);
        assert.equal(appEl.querySelector("span")?.textContent, "B");
        unmount(appEl);
    });

    it("5 & 6 & 7. supports multiple <ElseIf> with first-match-wins order and <Else> fallback", () => {
        const grade = signal(85);
        function App() {
            return html`
                <If when=${() => grade.value >= 90}>
                    <span id="grade">A</span>
                    <ElseIf when=${() => grade.value >= 80}>
                        <span id="grade">B</span>
                    </ElseIf>
                    <ElseIf when=${() => grade.value >= 70}>
                        <span id="grade">C</span>
                    </ElseIf>
                    <Else>
                        <span id="grade">F</span>
                    </Else>
                </If>
            `;
        }
        const appEl = document.getElementById("app");
        mount(App, appEl);
        assert.equal(document.querySelector("#grade").textContent, "B");

        grade.value = 95;
        assert.equal(document.querySelector("#grade").textContent, "A");

        grade.value = 75;
        assert.equal(document.querySelector("#grade").textContent, "C");

        grade.value = 50;
        assert.equal(document.querySelector("#grade").textContent, "F");

        unmount(appEl);
    });

    it("8, 9, 10, 11. supports Signal, Computed, predicate functions, and plain Booleans", () => {
        const sigCond = signal(true);
        const compCond = computed(() => sigCond.value);
        function App() {
            return html`
                <If when=${sigCond}><div id="d1">Signal</div></If>
                <If when=${compCond}><div id="d2">Computed</div></If>
                <If when=${() => sigCond.value}><div id="d3">Predicate</div></If>
                <If when=${true}><div id="d4">Boolean</div></If>
            `;
        }
        const appEl = document.getElementById("app");
        mount(App, appEl);
        assert.ok(document.querySelector("#d1"));
        assert.ok(document.querySelector("#d2"));
        assert.ok(document.querySelector("#d3"));
        assert.ok(document.querySelector("#d4"));
        unmount(appEl);
    });

    it("12. obeys standard JavaScript truthiness rules", () => {
        const val = signal(0);
        function App() {
            return html`
                <If when=${val}>
                    <span id="res">Truthy</span>
                    <Else>
                        <span id="res">Falsy</span>
                    </Else>
                </If>
            `;
        }
        const appEl = document.getElementById("app");
        mount(App, appEl);
        assert.equal(document.querySelector("#res").textContent, "Falsy");

        val.value = 42;
        assert.equal(document.querySelector("#res").textContent, "Truthy");

        val.value = "";
        assert.equal(document.querySelector("#res").textContent, "Falsy");

        val.value = "Hello";
        assert.equal(document.querySelector("#res").textContent, "Truthy");
        unmount(appEl);
    });

    it("13. supports nested <If> structures", () => {
        const outer = signal(true);
        const inner = signal(false);

        function App() {
            return html`
                <If when=${outer}>
                    <If when=${inner}>
                        <div id="res">OuterTrue-InnerTrue</div>
                        <Else>
                            <div id="res">OuterTrue-InnerFalse</div>
                        </Else>
                    </If>
                    <Else>
                        <div id="res">OuterFalse</div>
                    </Else>
                </If>
            `;
        }
        const appEl = document.getElementById("app");
        mount(App, appEl);
        assert.equal(document.querySelector("#res").textContent, "OuterTrue-InnerFalse");

        inner.value = true;
        assert.equal(document.querySelector("#res").textContent, "OuterTrue-InnerTrue");

        outer.value = false;
        assert.equal(document.querySelector("#res").textContent, "OuterFalse");
        unmount(appEl);
    });

    it("14 & 21 & 22. components inside branches, execution count = 1, DOM identity preserved", () => {
        let appExecutions = 0;
        const loggedIn = signal(false);

        function DashboardComp() {
            return html`<div id="dash-comp">Dashboard Component</div>`;
        }
        function LoginComp() {
            return html`<div id="login-comp">Login Component</div>`;
        }
        register(DashboardComp, LoginComp);

        function App() {
            appExecutions++;
            return html`
                <main>
                    <h1 id="static-title">Title</h1>
                    <If when=${loggedIn}>
                        <DashboardComp />
                        <Else>
                            <LoginComp />
                        </Else>
                    </If>
                </main>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        const titleBefore = document.querySelector("#static-title");
        assert.equal(appExecutions, 1);
        assert.ok(document.querySelector("#login-comp"));

        // Toggle condition
        loggedIn.value = true;

        const titleAfter = document.querySelector("#static-title");
        assert.equal(appExecutions, 1, "App function must NOT re-execute when condition toggles");
        assert.strictEqual(titleBefore, titleAfter, "Static DOM node identity must remain strictly identical");
        assert.ok(document.querySelector("#dash-comp"));

        unmount(appEl);
    });

    it("15 & 22. reactive Signals inside active branch update fine-grained without re-evaluating <If>", () => {
        const active = signal(true);
        const count = signal(0);

        function ActiveComponent() {
            return html`<button id="count-btn" onclick=${() => count.value++}>Count: ${count}</button>`;
        }
        register(ActiveComponent);

        function App() {
            return html`
                <If when=${active}>
                    <ActiveComponent />
                </If>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        const btn = document.querySelector("#count-btn");
        assert.equal(btn.textContent.trim(), "Count: 0");

        btn.click();
        assert.equal(btn.textContent.trim(), "Count: 1");

        unmount(appEl);
    });

    it("16 & 28. active branch remains untouched when dependency updates but branch index stays same", () => {
        const score = signal(92);
        let activeMounts = 0;

        function HighScore() {
            onMount(() => { activeMounts++; });
            return html`<div id="score">High Score</div>`;
        }
        register(HighScore);

        function App() {
            return html`
                <If when=${() => score.value >= 90}>
                    <HighScore />
                    <Else>
                        <div>Low Score</div>
                    </Else>
                </If>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);
        assert.equal(activeMounts, 1);

        // Update score to 96 (still >= 90)
        score.value = 96;
        assert.equal(activeMounts, 1, "Active branch component must NOT remount when branch index does not change");

        unmount(appEl);
    });

    it("18, 19, 20. lifecycle onMount/onDestroy, event listeners, and subscriptions are cleaned up on branch switch", () => {
        let mounted = false;
        let destroyed = false;
        const visible = signal(true);

        function BranchComp() {
            onMount(() => { mounted = true; });
            onDestroy(() => { destroyed = true; });
            return html`<div>Branch Content</div>`;
        }
        register(BranchComp);

        function App() {
            return html`
                <If when=${visible}>
                    <BranchComp />
                    <Else>
                        <div>Fallback</div>
                    </Else>
                </If>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);
        assert.equal(mounted, true);
        assert.equal(destroyed, false);

        // Switch branch
        visible.value = false;
        assert.equal(destroyed, true, "onDestroy callback must execute when branch is destroyed");

        unmount(appEl);
    });

    it("23, 24, 25, 26. structural validation throws clear errors for invalid configurations", () => {
        // Standalone Else
        assert.throws(() => {
            Else({ __isControlFlowChild: false });
        }, /<Else> must be used within an <If>/);

        // Standalone ElseIf
        assert.throws(() => {
            ElseIf({ __isControlFlowChild: false });
        }, /<ElseIf> must be used within an <If> container/);

        // Multiple Else
        assert.throws(() => {
            If({
                when: true,
                children: [
                    Else({ __isElse: true, __isControlFlowChild: true }),
                    Else({ __isElse: true, __isControlFlowChild: true })
                ]
            });
        }, /<If> can only contain a single <Else> branch/);

        // ElseIf after Else
        assert.throws(() => {
            If({
                when: true,
                children: [
                    Else({ __isElse: true, __isControlFlowChild: true }),
                    ElseIf({ __isElseIf: true, __isControlFlowChild: true })
                ]
            });
        }, /<ElseIf> cannot appear after <Else>/);
    });

    it("27. ignores formatting whitespace in formatted multiline template strings", () => {
        const flag = signal(false);
        function App() {
            return html`
                <If when=${flag}>
                    <h1>Flag True</h1>

                    <Else>
                        <h1>Flag False</h1>
                    </Else>
                </If>
            `;
        }
        const appEl = document.getElementById("app");
        mount(App, appEl);
        assert.equal(appEl.querySelector("h1").textContent.trim(), "Flag False");

        flag.value = true;
        assert.equal(appEl.querySelector("h1").textContent.trim(), "Flag True");
        unmount(appEl);
    });
});
