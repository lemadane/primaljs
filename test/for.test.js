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
    For,
    Continue,
    Break,
    Else,
    If,
    Switch,
    Case,
    Default
} from "../primal.js";

describe("PrimalJS Declarative For Loop Control-Flow (<For>, <Continue>, <Break>, <Else>)", () => {
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

    it("1, 5, 6, 7. basic Array iteration, callback arguments (item, index), plain number index", () => {
        const users = [
            { id: 1, name: "John" },
            { id: 2, name: "Anna" }
        ];

        function App() {
            return html`
                <main>
                    <For each=${users}>
                        ${(user, index) => html`
                            <p class="user-item" data-index=${index}>
                                ${index + 1}. ${user.name}
                            </p>
                        `}
                    </For>
                </main>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        const items = document.querySelectorAll(".user-item");
        assert.equal(items.length, 2);
        assert.equal(items[0].textContent.trim(), "1. John");
        assert.equal(items[1].textContent.trim(), "2. Anna");
        assert.equal(items[0].getAttribute("data-index"), "0");
        assert.equal(items[1].getAttribute("data-index"), "1");

        // The <For> component tag must not remain in the user-visible DOM
        assert.equal(document.querySelector("for"), null);
    });

    it("2, 3, 4. Signal, Computed, and reactive getter collections update only <For> region", () => {
        const list = signal(["A", "B"]);
        const upperList = computed(() => list.value.map(item => item.toLowerCase()));

        function App() {
            return html`
                <div>
                    <For each=${list}>
                        ${item => html`<span class="sig">${item}</span>`}
                    </For>
                    <For each=${upperList}>
                        ${item => html`<span class="comp">${item}</span>`}
                    </For>
                    <For each=${() => list.value.map(x => x + "!")}>
                        ${item => html`<span class="get">${item}</span>`}
                    </For>
                </div>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.deepEqual(Array.from(document.querySelectorAll(".sig")).map(el => el.textContent), ["A", "B"]);
        assert.deepEqual(Array.from(document.querySelectorAll(".comp")).map(el => el.textContent), ["a", "b"]);
        assert.deepEqual(Array.from(document.querySelectorAll(".get")).map(el => el.textContent), ["A!", "B!"]);

        list.value = ["A", "B", "C"];
        assert.deepEqual(Array.from(document.querySelectorAll(".sig")).map(el => el.textContent), ["A", "B", "C"]);
        assert.deepEqual(Array.from(document.querySelectorAll(".comp")).map(el => el.textContent), ["a", "b", "c"]);
        assert.deepEqual(Array.from(document.querySelectorAll(".get")).map(el => el.textContent), ["A!", "B!", "C!"]);
    });

    it("8, 9, 11, 29, 30, 31. <Else> empty collection fallback, optional Else, transition empty <-> non-empty", () => {
        const users = signal([]);

        function App() {
            return html`
                <section>
                    <For each=${users}>
                        ${user => html`<div class="item">${user.name}</div>`}
                        <Else>
                            <p id="empty-state">No users found.</p>
                        </Else>
                    </For>
                </section>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        // Initially empty: renders <Else>
        assert.equal(document.querySelector("#empty-state").textContent, "No users found.");
        assert.equal(document.querySelectorAll(".item").length, 0);

        // Transition to non-empty: destroys <Else>, mounts list items
        users.value = [{ id: 1, name: "John" }, { id: 2, name: "Anna" }];
        assert.equal(document.querySelector("#empty-state"), null);
        assert.equal(document.querySelectorAll(".item").length, 2);

        // Transition back to empty: destroys items, mounts <Else>
        users.value = [];
        assert.equal(document.querySelector("#empty-state").textContent, "No users found.");
        assert.equal(document.querySelectorAll(".item").length, 0);
    });

    it("10, 11, 12, 13. structural validation: only one <Else>, Else must be last", () => {
        const users = signal([]);

        function MultipleElse() {
            return html`
                <For each=${users}>
                    ${user => html`<div>${user.name}</div>`}
                    <Else>First Else</Else>
                    <Else>Second Else</Else>
                </For>
            `;
        }
        assert.throws(() => mount(MultipleElse, document.getElementById("app")), /<For> can only contain a single <Else> branch/);

        clearRegistry();
        function ElseBeforeCallback() {
            return html`
                <For each=${users}>
                    <Else>First</Else>
                    ${user => html`<div>${user.name}</div>`}
                </For>
            `;
        }
        assert.throws(() => mount(ElseBeforeCallback, document.getElementById("app")), /<Else> must appear after the iteration callback in <For>/);
    });

    it("12, 13, 14, 16, 17, 20. unconditional and conditional <Continue>, sequence order, Else does not run when items Continue", () => {
        const users = signal([
            { name: "John", active: false },
            { name: "Mike", active: true },
            { name: "Anna", active: false }
        ]);

        function App() {
            return html`
                <main>
                    <For each=${users}>
                        ${user => html`
                            <span class="prefix">User:</span>
                            <Continue when=${() => !user.active} />
                            <span class="active-user">${user.name}</span>
                        `}
                        <Else>
                            <span id="no-users">No Users</span>
                        </Else>
                    </For>
                </main>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        // <Else> must NOT render merely because items were skipped by <Continue> (source collection has 3 items)
        assert.equal(document.querySelector("#no-users"), null);

        // Active users rendered after <Continue>
        const activeNames = Array.from(document.querySelectorAll(".active-user")).map(el => el.textContent);
        assert.deepEqual(activeNames, ["Mike"]);
    });

    it("15, 16, 17, 18, 19, 21, 23. unconditional and conditional <Break>, sequence order, Else does not run after Break", () => {
        const users = signal([
            { id: 1, name: "John", stop: false },
            { id: 2, name: "Mike", stop: true },
            { id: 3, name: "Anna", stop: false }
        ]);

        function App() {
            return html`
                <main>
                    <For each=${users}>
                        ${user => html`
                            <Break when=${() => user.stop} />
                            <span class="user-name">${user.name}</span>
                        `}
                        <Else>
                            <span id="no-users">No Users</span>
                        </Else>
                    </For>
                </main>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        // <Else> must NOT render after <Break> (source collection is not empty)
        assert.equal(document.querySelector("#no-users"), null);

        // Break at item 2 stops processing: item 1 renders, item 2 and 3 do not render
        const renderedNames = Array.from(document.querySelectorAll(".user-name")).map(el => el.textContent);
        assert.deepEqual(renderedNames, ["John"]);
    });

    it("22, 45, 46. Continue and Break together ordering semantics", () => {
        const items = signal([1, 2, 3, 4, 5]);

        function App() {
            return html`
                <div>
                    <For each=${items}>
                        ${item => html`
                            <Continue when=${() => item % 2 === 1} />
                            <Break when=${() => item === 4} />
                            <span class="num">${item}</span>
                        `}
                    </For>
                </div>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        // 1: odd -> continues (skips break and span)
        // 2: even -> passes continue, passes break -> renders 2
        // 3: odd -> continues (skips break and span)
        // 4: even -> passes continue -> hits break at 4 -> stops loop!
        const rendered = Array.from(document.querySelectorAll(".num")).map(el => el.textContent);
        assert.deepEqual(rendered, ["2"]);
    });

    it("24, 25, 26, 47. nested For loops and local scope of Continue/Break", () => {
        const groups = signal([
            { id: 1, name: "Group A", users: [{ id: 1, name: "A1", active: false }, { id: 2, name: "A2", active: true }] },
            { id: 2, name: "Group B", users: [{ id: 3, name: "B1", active: true }] }
        ]);

        function App() {
            return html`
                <div>
                    <For each=${groups} key=${g => g.id}>
                        ${group => html`
                            <div class="group">
                                <h3>${group.name}</h3>
                                <For each=${group.users} key=${u => u.id}>
                                    ${user => html`
                                        <Continue when=${() => !user.active} />
                                        <span class="inner-user">${user.name}</span>
                                    `}
                                </For>
                            </div>
                        `}
                    </For>
                </div>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        const groupTitles = Array.from(document.querySelectorAll("h3")).map(el => el.textContent);
        assert.deepEqual(groupTitles, ["Group A", "Group B"]);

        const innerUsers = Array.from(document.querySelectorAll(".inner-user")).map(el => el.textContent);
        assert.deepEqual(innerUsers, ["A2", "B1"]);
    });

    it("27, 28, 29. standalone Continue, Break, and Else produce clear development errors outside container", () => {
        function StandaloneContinue() {
            return html`<Continue />`;
        }
        assert.throws(() => mount(StandaloneContinue, document.getElementById("app")), /<Continue> must be used inside a <For> iteration callback/);

        clearRegistry();
        function StandaloneBreak() {
            return html`<Break />`;
        }
        assert.throws(() => mount(StandaloneBreak, document.getElementById("app")), /<Break> must be used inside a <For> iteration callback/);

        clearRegistry();
        function StandaloneElse() {
            return html`<Else>Standalone</Else>`;
        }
        assert.throws(() => mount(StandaloneElse, document.getElementById("app")), /<Else> must be used within an <If> or <For> container/);
    });

    it("30, 31, 32. For inside If, If inside For, Switch inside For", () => {
        const showList = signal(true);
        const tasks = signal([
            { id: 1, title: "Task 1", status: "pending", urgent: true },
            { id: 2, title: "Task 2", status: "complete", urgent: false }
        ]);

        function App() {
            return html`
                <div>
                    <If when=${showList}>
                        <For each=${tasks} key=${t => t.id}>
                            ${task => html`
                                <div class="task-row">
                                    <If when=${task.urgent}>
                                        <span class="badge">URGENT</span>
                                    </If>
                                    <Switch value=${task.status}>
                                        <Case value="pending">
                                            <span class="st-pending">${task.title}</span>
                                        </Case>
                                        <Case value="complete">
                                            <span class="st-complete">${task.title}</span>
                                        </Case>
                                    </Switch>
                                </div>
                            `}
                        </For>
                    </If>
                </div>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(document.querySelectorAll(".task-row").length, 2);
        assert.equal(document.querySelector(".badge").textContent, "URGENT");
        assert.equal(document.querySelector(".st-pending").textContent, "Task 1");
        assert.equal(document.querySelector(".st-complete").textContent, "Task 2");
    });

    it("33, 34, 35, 36, 37, 43, 44. component composition, lifecycle onMount/onDestroy, event listener & effect cleanup", () => {
        let mountCount = 0;
        let destroyCount = 0;
        let clickCount = 0;

        function UserItem(props) {
            onMount(() => mountCount++);
            onDestroy(() => destroyCount++);

            return html`
                <button class="btn-item" onclick=${() => clickCount++}>
                    ${props.name}
                </button>
            `;
        }

        register(UserItem);

        const users = signal([
            { id: 1, name: "John" },
            { id: 2, name: "Anna" }
        ]);

        function App() {
            return html`
                <div>
                    <For each=${users} key=${u => u.id}>
                        ${u => html`<UserItem name=${u.name} />`}
                    </For>
                </div>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(mountCount, 2);
        assert.equal(destroyCount, 0);

        const btn1 = document.querySelectorAll(".btn-item")[0];
        btn1.click();
        assert.equal(clickCount, 1);

        // Remove item 2: destroys item 2 lifecycle and listeners
        users.value = [{ id: 1, name: "John" }];
        assert.equal(destroyCount, 1);

        // Unmount app: destroys item 1
        unmount(appEl);
        assert.equal(destroyCount, 2);
    });

    it("38, 39, 40, 41, 42. keyed insertion, removal, reordering, DOM identity preservation, duplicate key error", () => {
        const users = signal([
            { id: 1, name: "John" },
            { id: 2, name: "Anna" }
        ]);

        function App() {
            return html`
                <div>
                    <For each=${users} key=${u => u.id}>
                        ${u => html`<div data-id=${u.id}>${u.name}</div>`}
                    </For>
                </div>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        const johnBefore = document.querySelector('[data-id="1"]');
        const annaBefore = document.querySelector('[data-id="2"]');

        // Keyed reordering and insertion (insert id=3 before 1, swap 1 and 2)
        users.value = [
            { id: 2, name: "Anna" },
            { id: 3, name: "Mike" },
            { id: 1, name: "John" }
        ];

        const johnAfter = document.querySelector('[data-id="1"]');
        const annaAfter = document.querySelector('[data-id="2"]');

        // Original DOM node identities MUST be strictly preserved
        assert.equal(johnBefore, johnAfter);
        assert.equal(annaBefore, annaAfter);

        const currentIds = Array.from(document.querySelectorAll("[data-id]")).map(el => el.getAttribute("data-id"));
        assert.deepEqual(currentIds, ["2", "3", "1"]);

        // Duplicate key detection throws error
        assert.throws(() => {
            users.value = [{ id: 1, name: "John" }, { id: 1, name: "Duplicate" }];
        }, /<For> detected duplicate key '1'/);
    });

    it("46, 60. MANDATORY Component Execution Count Test (Requirement #34 & #60)", () => {
        let executions = 0;
        let users;

        function App() {
            executions++;
            users = signal([]);

            return html`
                <main>
                    <h1 id="title">Users List</h1>
                    <For each=${users} key=${u => u.id}>
                        ${u => html`<p>${u.name}</p>`}
                        <Else>Empty</Else>
                    </For>
                </main>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(executions, 1);

        users.value = [{ id: 1, name: "A" }];
        users.value = [{ id: 1, name: "A" }, { id: 2, name: "B" }];
        users.value = [];
        users.value = [{ id: 3, name: "C" }];

        // The parent component function must NEVER rerun merely because the collection updated
        assert.equal(executions, 1);
    });

    it("47, 59. MANDATORY DOM Identity Test (Requirement #35 & #59)", () => {
        let users;

        function App() {
            users = signal([
                { id: 1, name: "John" },
                { id: 2, name: "Anna" }
            ]);

            return html`
                <main>
                    <h1 id="heading">Users</h1>
                    <For each=${users} key=${u => u.id}>
                        ${u => html`<div data-user-id=${u.id}>${u.name}</div>`}
                    </For>
                </main>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        const headingBefore = document.querySelector("#heading");
        const johnBefore = document.querySelector('[data-user-id="1"]');

        users.value = [
            { id: 3, name: "Mike" },
            { id: 1, name: "John" },
            { id: 2, name: "Anna" }
        ];

        const headingAfter = document.querySelector("#heading");
        const johnAfter = document.querySelector('[data-user-id="1"]');

        assert.equal(headingBefore, headingAfter);
        assert.equal(johnBefore, johnAfter);
    });

    it("48, 49, 50, 51. null, undefined, non-iterable, and Promise collection handling", () => {
        const nullSig = signal(null);

        function NullApp() {
            return html`
                <For each=${nullSig}>
                    ${item => html`<div>${item}</div>`}
                    <Else><p id="null-else">Null Fallback</p></Else>
                </For>
            `;
        }
        mount(NullApp, document.getElementById("app"));
        assert.equal(document.querySelector("#null-else").textContent, "Null Fallback");

        clearRegistry();
        function NonIterableApp() {
            return html`
                <For each=${123}>
                    ${item => html`<div>${item}</div>`}
                </For>
            `;
        }
        assert.throws(() => mount(NonIterableApp, document.getElementById("app")), /<For> 'each' prop must be an Array or iterable collection/);

        clearRegistry();
        function PromiseApp() {
            return html`
                <For each=${Promise.resolve([1, 2])}>
                    ${item => html`<div>${item}</div>`}
                </For>
            `;
        }
        assert.throws(() => mount(PromiseApp, document.getElementById("app")), /<For> 'each' prop received a Promise. Use <Await> for Promise handling/);
    });
});
