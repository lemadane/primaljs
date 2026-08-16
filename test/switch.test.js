import { describe, it, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import {
    html,
    signal,
    computed,
    effect,
    register,
    clearRegistry,
    mount,
    unmount,
    onMount,
    onDestroy,
    If,
    ElseIf,
    Else,
    Switch,
    Case,
    Default
} from "../src/index.js";

let dom;

before(() => {
    dom = new JSDOM("<!DOCTYPE html><html><body><div id='app'></div></body></html>");
    global.window = dom.window;
    global.document = dom.window.document;
    global.Node = dom.window.Node;
    global.Element = dom.window.Element;
    global.NodeFilter = dom.window.NodeFilter || {
        SHOW_ALL: -1,
        SHOW_ELEMENT: 1,
        SHOW_COMMENT: 128
    };
});

beforeEach(() => {
    clearRegistry();
    document.body.innerHTML = "<div id='app'></div>";
});

describe("PrimalJS Declarative Switch Control-Flow (<Switch>, <Case>, <Default>)", () => {

    it("1, 2, 3. matches first, middle, or final Case", () => {
        const status = signal("first");
        function App() {
            return html`
                <Switch value=${status}>
                    <Case value="first">
                        <span id="res">First</span>
                    </Case>

                    <Case value="middle">
                        <span id="res">Middle</span>
                    </Case>

                    <Case value="final">
                        <span id="res">Final</span>
                    </Case>

                    <Default>
                        <span id="res">Default</span>
                    </Default>
                </Switch>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);
        assert.equal(document.querySelector("#res").textContent, "First");

        status.value = "middle";
        assert.equal(document.querySelector("#res").textContent, "Middle");

        status.value = "final";
        assert.equal(document.querySelector("#res").textContent, "Final");

        unmount(appEl);
    });

    it("4 & 5. Default fallback and empty region when no match and no Default", () => {
        const status = signal("unknown");
        function AppWithDefault() {
            return html`
                <Switch value=${status}>
                    <Case value="a">A</Case>
                    <Default>
                        <span id="res">DefaultFallback</span>
                    </Default>
                </Switch>
            `;
        }

        const appEl = document.getElementById("app");
        mount(AppWithDefault, appEl);
        assert.equal(document.querySelector("#res").textContent, "DefaultFallback");

        unmount(appEl);

        function AppNoDefault() {
            return html`
                <main id="container">
                    <Switch value=${status}>
                        <Case value="a">A</Case>
                    </Switch>
                </main>
            `;
        }

        mount(AppNoDefault, appEl);
        assert.equal(document.querySelector("main#container").children.length, 0);
        unmount(appEl);
    });

    it("6, 7, 8, 9. supports Signal, Computed, getter function, and plain values", () => {
        const status = signal("loading");
        const upperStatus = computed(() => status.value.toUpperCase());

        function App() {
            return html`
                <section>
                    <Switch value=${status}>
                        <Case value="loading">
                            <span id="sig">SigLoading</span>
                        </Case>
                    </Switch>

                    <Switch value=${upperStatus}>
                        <Case value="LOADING">
                            <span id="comp">CompLoading</span>
                        </Case>
                    </Switch>

                    <Switch value=${() => status.value}>
                        <Case value="loading">
                            <span id="getter">GetLoading</span>
                        </Case>
                    </Switch>

                    <Switch value=${"plain"}>
                        <Case value="plain">
                            <span id="plain">PlainVal</span>
                        </Case>
                    </Switch>
                </section>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(document.querySelector("#sig").textContent, "SigLoading");
        assert.equal(document.querySelector("#comp").textContent, "CompLoading");
        assert.equal(document.querySelector("#getter").textContent, "GetLoading");
        assert.equal(document.querySelector("#plain").textContent, "PlainVal");

        unmount(appEl);
    });

    it("10, 11, 12. first-match-wins order, no fallthrough, no Break required", () => {
        const role = signal("admin");

        function Admin() { return html`<span id="res">Admin</span>`; }
        function Manager() { return html`<span id="res">Manager</span>`; }
        register(Admin, Manager);

        function App() {
            return html`
                <Switch value=${role}>
                    <Case value="admin">
                        <Admin />
                    </Case>

                    <Case value="admin">
                        <span id="res">DuplicateAdmin</span>
                    </Case>

                    <Case value="manager">
                        <Manager />
                    </Case>
                </Switch>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        // First match wins
        const elements = document.querySelectorAll("#res");
        assert.equal(elements.length, 1);
        assert.equal(elements[0].textContent, "Admin");

        unmount(appEl);
    });

    it("13 & 39. multiple values array matching and empty array behavior", () => {
        const status = signal("pending");

        function App() {
            return html`
                <Switch value=${status}>
                    <Case values=${["pending", "processing"]}>
                        <span id="res">Working</span>
                    </Case>

                    <Case values=${[]}>
                        <span id="res">NeverMatches</span>
                    </Case>

                    <Case value="complete">
                        <span id="res">Complete</span>
                    </Case>
                </Switch>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(document.querySelector("#res").textContent, "Working");

        status.value = "processing";
        assert.equal(document.querySelector("#res").textContent, "Working");

        status.value = "complete";
        assert.equal(document.querySelector("#res").textContent, "Complete");

        unmount(appEl);
    });

    it("14 & 15 & 31. predicate Case and predicate dependency tracking", () => {
        const score = signal(80);
        const minimum = signal(75);

        function App() {
            return html`
                <Switch value=${score}>
                    <Case when=${val => val >= minimum.value}>
                        <span id="res">Passed</span>
                    </Case>

                    <Default>
                        <span id="res">Failed</span>
                    </Default>
                </Switch>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);
        assert.equal(document.querySelector("#res").textContent, "Passed");

        // Change predicate dependency minimum from 75 to 85
        minimum.value = 85;
        assert.equal(document.querySelector("#res").textContent, "Failed");

        // Change score to 90
        score.value = 90;
        assert.equal(document.querySelector("#res").textContent, "Passed");

        unmount(appEl);
    });

    it("16 & 17 & 32. Object.is strict equality semantics (NaN, 0/-0, type safety, object ref)", () => {
        const nanSig = signal(NaN);
        const zeroSig = signal(0);
        const objRef = { id: 42 };
        const objSig = signal(objRef);
        const numSig = signal(1);

        function App() {
            return html`
                <section>
                    <Switch value=${nanSig}>
                        <Case value=${NaN}>
                            <span id="nan">MatchedNaN</span>
                        </Case>
                    </Switch>

                    <Switch value=${zeroSig}>
                        <Case value=${-0}>
                            <span id="zero">MatchedMinusZero</span>
                        </Case>
                        <Default>
                            <span id="zero">MatchedZero</span>
                        </Default>
                    </Switch>

                    <Switch value=${numSig}>
                        <Case value="1">
                            <span id="type">StringOne</span>
                        </Case>
                        <Case value=${1}>
                            <span id="type">NumberOne</span>
                        </Case>
                    </Switch>

                    <Switch value=${objSig}>
                        <Case value=${objRef}>
                            <span id="obj">ObjectRefMatched</span>
                        </Case>
                    </Switch>
                </section>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(document.querySelector("#nan").textContent, "MatchedNaN");
        assert.equal(document.querySelector("#zero").textContent, "MatchedZero");
        assert.equal(document.querySelector("#type").textContent, "NumberOne");
        assert.equal(document.querySelector("#obj").textContent, "ObjectRefMatched");

        unmount(appEl);
    });

    it("18, 19, 20, 28. supports nested Switch, Switch inside If, If inside Case, and Components inside Case", () => {
        const loggedIn = signal(true);
        const section = signal("settings");
        const settingsTab = signal("security");

        function SecuritySettings() { return html`<span id="nested">SecurityView</span>`; }
        function ProfileSettings() { return html`<span id="nested">ProfileView</span>`; }
        register(SecuritySettings, ProfileSettings);

        function App() {
            return html`
                <If when=${loggedIn}>
                    <Switch value=${section}>
                        <Case value="settings">
                            <Switch value=${settingsTab}>
                                <Case value="profile">
                                    <ProfileSettings />
                                </Case>

                                <Case value="security">
                                    <If when=${true}>
                                        <SecuritySettings />
                                    </If>
                                </Case>
                            </Switch>
                        </Case>
                    </Switch>
                </If>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);
        assert.equal(document.querySelector("#nested").textContent, "SecurityView");

        settingsTab.value = "profile";
        assert.equal(document.querySelector("#nested").textContent, "ProfileView");

        unmount(appEl);
    });

    it("19, 30, 31. execution count === 1 and unrelated DOM identity preserved", () => {
        let executions = 0;
        const status = signal("loading");

        function App() {
            executions++;
            return html`
                <main>
                    <h1 id="title">PrimalJS</h1>

                    <Switch value=${status}>
                        <Case value="loading">
                            <span id="res">Loading</span>
                        </Case>

                        <Case value="ready">
                            <span id="res">Ready</span>
                        </Case>

                        <Default>
                            <span id="res">Unknown</span>
                        </Default>
                    </Switch>
                </main>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(executions, 1);
        const titleBefore = document.querySelector("#title");

        status.value = "ready";
        assert.equal(executions, 1);
        const titleAfter = document.querySelector("#title");
        assert.equal(titleBefore, titleAfter);

        status.value = "unknown";
        assert.equal(executions, 1);
        assert.equal(document.querySelector("#res").textContent, "Unknown");

        unmount(appEl);
    });

    it("21 & 29. active branch remains untouched when switch value changes but branch index stays same", () => {
        let compExecutions = 0;
        const score = signal(95);
        const count = signal(10);

        function ExcellentComp() {
            compExecutions++;
            return html`<span id="res">Score: ${score}, Count: ${count}</span>`;
        }
        register(ExcellentComp);

        function App() {
            return html`
                <Switch value=${score}>
                    <Case when=${val => val >= 90}>
                        <ExcellentComp />
                    </Case>

                    <Default>
                        <span>Other</span>
                    </Default>
                </Switch>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(compExecutions, 1);
        assert.ok(document.querySelector("#res").textContent.includes("Score: 95"));

        // Change score to 96 (still matches Case when >= 90)
        score.value = 96;
        assert.equal(compExecutions, 1, "Branch component must NOT remount when branch index stays same");
        assert.ok(document.querySelector("#res").textContent.includes("Score: 96"));

        // Update inner signal
        count.value = 20;
        assert.equal(compExecutions, 1);
        assert.ok(document.querySelector("#res").textContent.includes("Count: 20"));

        unmount(appEl);
    });

    it("24, 25, 26, 27, 28, 29, 40. lifecycle onMount/onDestroy, event listeners, and subscriptions cleaned up on branch switch", () => {
        let mounted = false;
        let destroyed = false;
        let buttonClicked = false;
        const status = signal("a");
        const innerSig = signal("inner");

        function BranchComp() {
            onMount(() => { mounted = true; });
            onDestroy(() => { destroyed = true; });

            function handleClick() {
                buttonClicked = true;
            }

            return html`
                <div>
                    <button id="btn" onclick=${handleClick}>Click</button>
                    <span id="inner">${innerSig}</span>
                </div>
            `;
        }
        register(BranchComp);

        function App() {
            return html`
                <Switch value=${status}>
                    <Case value="a">
                        <BranchComp />
                    </Case>

                    <Default>
                        <span id="fallback">Fallback</span>
                    </Default>
                </Switch>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(mounted, true);
        assert.equal(destroyed, false);

        // Click button inside active branch
        const btn = document.querySelector("#btn");
        btn.click();
        assert.equal(buttonClicked, true);

        // Switch branch
        status.value = "b";
        assert.equal(destroyed, true);
        assert.equal(document.querySelector("#fallback").textContent, "Fallback");

        unmount(appEl);
    });

    it("32, 33, 34, 35, 36, 37, 38. structural validation throws clear errors for invalid configurations", () => {
        // 32. Standalone <Case>
        function StandaloneCase() {
            return html`<Case value="a">A</Case>`;
        }
        const appEl = document.getElementById("app");
        assert.throws(() => mount(StandaloneCase, appEl), /<Case> must be used within a <Switch> container/);
        unmount(appEl);

        // 33. Standalone <Default>
        function StandaloneDefault() {
            return html`<Default>A</Default>`;
        }
        assert.throws(() => mount(StandaloneDefault, appEl), /<Default> must be used within a <Switch> container/);
        unmount(appEl);

        // 34. Multiple <Default>
        function MultipleDefault() {
            return html`
                <Switch value="a">
                    <Default>First</Default>
                    <Default>Second</Default>
                </Switch>
            `;
        }
        assert.throws(() => mount(MultipleDefault, appEl), /<Switch> can only contain a single <Default> branch/);
        unmount(appEl);

        // 35. <Default> before <Case>
        function DefaultBeforeCase() {
            return html`
                <Switch value="a">
                    <Default>First</Default>
                    <Case value="a">CaseA</Case>
                </Switch>
            `;
        }
        assert.throws(() => mount(DefaultBeforeCase, appEl), /<Case> cannot appear after <Default>/);
        unmount(appEl);

        // 36. value + values invalid
        function ValueAndValues() {
            return html`
                <Switch value="a">
                    <Case value="a" values=${["a", "b"]}>Invalid</Case>
                </Switch>
            `;
        }
        assert.throws(() => mount(ValueAndValues, appEl), /<Case> cannot specify multiple matching modes/);
        unmount(appEl);

        // 37. value + when invalid
        function ValueAndWhen() {
            return html`
                <Switch value="a">
                    <Case value="a" when=${v => true}>Invalid</Case>
                </Switch>
            `;
        }
        assert.throws(() => mount(ValueAndWhen, appEl), /<Case> cannot specify multiple matching modes/);
        unmount(appEl);

        // 38. values + when invalid
        function ValuesAndWhen() {
            return html`
                <Switch value="a">
                    <Case values=${["a"]} when=${v => true}>Invalid</Case>
                </Switch>
            `;
        }
        assert.throws(() => mount(ValuesAndWhen, appEl), /<Case> cannot specify multiple matching modes/);
        unmount(appEl);

        // Zero modes specified
        function ZeroModes() {
            return html`
                <Switch value="a">
                    <Case>Invalid</Case>
                </Switch>
            `;
        }
        assert.throws(() => mount(ZeroModes, appEl), /<Case> must specify exactly one matching mode/);
        unmount(appEl);
    });
});
