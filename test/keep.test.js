import "./setup.js";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
    html,
    signal,
    mount,
    unmount,
    clearRegistry,
    register,
    onMount,
    onDestroy,
    ref,
    Load,
    Keep,
    Place,
    Animate,
    Guard
} from "../src/index.js";

describe("PrimalJS <Keep> DOM / Component Lifecycle Preservation Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        clearRegistry();
    });

    it("1. First child mounts normally", () => {
        function Dashboard() {
            return html`<div id="dashboard">Dashboard View</div>`;
        }

        const activePage = signal(Dashboard);

        function App() {
            return html`
                <Keep>
                    <Load component=${activePage} />
                </Keep>
            `;
        }

        mount(App, container);
        assert.equal(container.querySelector("#dashboard").textContent, "Dashboard View");
    });

    it("2. Switching away does not destroy it & 3. Returning restores same DOM node", () => {
        function Dashboard() {
            return html`<div id="dashboard">Dashboard</div>`;
        }
        function Settings() {
            return html`<div id="settings">Settings</div>`;
        }

        const activePage = signal(Dashboard);

        function App() {
            return html`
                <Keep>
                    <Load component=${activePage} />
                </Keep>
            `;
        }

        mount(App, container);
        const beforeNode = container.querySelector("#dashboard");
        assert.ok(beforeNode);

        // Switch to Settings
        activePage.value = Settings;
        assert.equal(container.querySelector("#dashboard"), null);
        assert.ok(container.querySelector("#settings"));

        // Switch back to Dashboard
        activePage.value = Dashboard;
        const afterNode = container.querySelector("#dashboard");
        assert.ok(afterNode);

        // DOM node identity MUST be strictly preserved!
        assert.strictEqual(beforeNode, afterNode, "DOM node identity must be preserved across switches");
    });

    it("4. Component function does not execute again on restore", () => {
        let dashboardExecutions = 0;
        let settingsExecutions = 0;

        function Dashboard() {
            dashboardExecutions++;
            return html`<div id="dashboard">Dashboard</div>`;
        }
        function Settings() {
            settingsExecutions++;
            return html`<div id="settings">Settings</div>`;
        }

        const activePage = signal(Dashboard);

        function App() {
            return html`
                <Keep>
                    <Load component=${activePage} />
                </Keep>
            `;
        }

        mount(App, container);

        // Dashboard -> Settings -> Dashboard -> Settings -> Dashboard
        activePage.value = Settings;
        activePage.value = Dashboard;
        activePage.value = Settings;
        activePage.value = Dashboard;

        assert.equal(dashboardExecutions, 1, "Dashboard component function must execute EXACTLY ONCE");
        assert.equal(settingsExecutions, 1, "Settings component function must execute EXACTLY ONCE");
    });

    it("5. onMount runs once & 6. onDestroy does not run when kept & 7. onDestroy runs once on final destruction", () => {
        let mountCount = 0;
        let destroyCount = 0;

        function Dashboard() {
            onMount(() => { mountCount++; });
            onDestroy(() => { destroyCount++; });
            return html`<div id="dashboard">Dashboard</div>`;
        }
        function Settings() {
            return html`<div id="settings">Settings</div>`;
        }

        const activePage = signal(Dashboard);

        function App() {
            return html`
                <Keep>
                    <Load component=${activePage} />
                </Keep>
            `;
        }

        const app = mount(App, container);
        assert.equal(mountCount, 1);
        assert.equal(destroyCount, 0);

        // Switch away -> component is KEPT, onDestroy MUST NOT run!
        activePage.value = Settings;
        assert.equal(mountCount, 1);
        assert.equal(destroyCount, 0, "onDestroy must NOT run when kept");

        // Restore -> onMount MUST NOT run again!
        activePage.value = Dashboard;
        assert.equal(mountCount, 1, "onMount must NOT run on restore");
        assert.equal(destroyCount, 0);

        // Final application disposal -> onDestroy runs EXACTLY ONCE!
        app.dispose();
        assert.equal(destroyCount, 1, "onDestroy must run exactly once on final application disposal");
    });

    it("8. Local Signal values survive", () => {
        const localSignal = signal("initial");

        function Dashboard() {
            return html`<div id="local">${localSignal}</div>`;
        }
        function Settings() {
            return html`<div id="settings">Settings</div>`;
        }

        const activePage = signal(Dashboard);

        function App() {
            return html`
                <Keep>
                    <Load component=${activePage} />
                </Keep>
            `;
        }

        mount(App, container);
        assert.equal(container.querySelector("#local").textContent, "initial");

        // Mutate local signal
        localSignal.value = "updated-state";
        assert.equal(container.querySelector("#local").textContent, "updated-state");

        // Switch away and return
        activePage.value = Settings;
        activePage.value = Dashboard;

        assert.equal(container.querySelector("#local").textContent, "updated-state");
    });

    it("9. Native input state & 10. Checkbox state survive", () => {
        function FormPage() {
            return html`
                <div id="form-page">
                    <input id="text-input" type="text" value="default" />
                    <input id="check-box" type="checkbox" />
                    <textarea id="text-area"></textarea>
                </div>
            `;
        }
        function OtherPage() {
            return html`<div id="other">Other</div>`;
        }

        const activePage = signal(FormPage);

        function App() {
            return html`
                <Keep>
                    <Load component=${activePage} />
                </Keep>
            `;
        }

        mount(App, container);

        const input = container.querySelector("#text-input");
        const checkbox = container.querySelector("#check-box");
        const textarea = container.querySelector("#text-area");

        input.value = "hello world";
        checkbox.checked = true;
        textarea.value = "long form body";

        // Switch away and back
        activePage.value = OtherPage;
        activePage.value = FormPage;

        const restoredInput = container.querySelector("#text-input");
        const restoredCheckbox = container.querySelector("#check-box");
        const restoredTextarea = container.querySelector("#text-area");

        assert.strictEqual(input, restoredInput);
        assert.equal(restoredInput.value, "hello world");
        assert.equal(restoredCheckbox.checked, true);
        assert.equal(restoredTextarea.value, "long form body");
    });

    it("11. ref() remains valid across switches & 23. ref is cleaned on final destruction", () => {
        const inputRef = ref();

        function Editor() {
            return html`<input ref=${inputRef} id="editor-input" />`;
        }
        function Other() {
            return html`<div>Other</div>`;
        }

        const activePage = signal(Editor);

        function App() {
            return html`
                <Keep>
                    <Load component=${activePage} />
                </Keep>
            `;
        }

        const app = mount(App, container);
        assert.ok(inputRef.current);
        assert.equal(inputRef.current.id, "editor-input");

        // Switch away and back
        activePage.value = Other;
        activePage.value = Editor;

        assert.ok(inputRef.current);
        assert.equal(inputRef.current.id, "editor-input");

        // Final dispose -> ref MUST be cleaned!
        app.dispose();
        assert.equal(inputRef.current, null, "ref.current must be set to null on final destruction");
    });

    it("12. Nested component instances survive", () => {
        let childExecutions = 0;

        function NestedChild() {
            childExecutions++;
            return html`<span id="nested-child">Nested</span>`;
        }
        function Dashboard() {
            return html`
                <div id="parent-dash">
                    <NestedChild />
                </div>
            `;
        }
        function Other() {
            return html`<div>Other</div>`;
        }

        register(NestedChild);
        const activePage = signal(Dashboard);

        function App() {
            return html`
                <Keep>
                    <Load component=${activePage} />
                </Keep>
            `;
        }

        mount(App, container);
        assert.equal(childExecutions, 1);

        activePage.value = Other;
        activePage.value = Dashboard;

        assert.equal(childExecutions, 1, "Nested component must NOT re-execute on restore");
        assert.ok(container.querySelector("#nested-child"));
    });

    it("13. Multiple root nodes survive", () => {
        function MultiRoot() {
            return html`
                <h1 id="title">Title</h1>
                <p id="desc">Description</p>
            `;
        }
        function Other() {
            return html`<div>Other</div>`;
        }

        const activePage = signal(MultiRoot);

        function App() {
            return html`
                <Keep>
                    <Load component=${activePage} />
                </Keep>
            `;
        }

        mount(App, container);
        const titleBefore = container.querySelector("#title");
        const descBefore = container.querySelector("#desc");

        activePage.value = Other;
        activePage.value = MultiRoot;

        assert.strictEqual(container.querySelector("#title"), titleBefore);
        assert.strictEqual(container.querySelector("#desc"), descBefore);
    });

    it("14. Event listeners & 15. Signal effects do not duplicate after 100 switches (Stress Test)", () => {
        let clickCount = 0;
        let effectCount = 0;
        const sharedSignal = signal(0);

        function Dashboard() {
            return html`
                <div>
                    <button id="btn" onclick=${() => clickCount++}>Click</button>
                    <div id="count">${() => { effectCount++; return sharedSignal.value; }}</div>
                </div>
            `;
        }
        function Settings() {
            return html`<div>Settings</div>`;
        }

        const activePage = signal(Dashboard);

        function App() {
            return html`
                <Keep>
                    <Load component=${activePage} />
                </Keep>
            `;
        }

        mount(App, container);
        const initialEffectRun = effectCount;

        // Perform 100 rapid switches!
        for (let i = 0; i < 100; i++) {
            activePage.value = Settings;
            activePage.value = Dashboard;
        }

        // Click button
        container.querySelector("#btn").click();
        assert.equal(clickCount, 1, "Event listener must be called EXACTLY ONCE per click without duplicate bindings");

        // Mutate signal
        sharedSignal.value++;
        assert.equal(container.querySelector("#count").textContent, "1");
    });

    it("16. Reactive updates continue while cached & 17. Cached DOM reflects latest signal state when restored", () => {
        const counter = signal(10);

        function Dashboard() {
            return html`<div id="val">${counter}</div>`;
        }
        function Settings() {
            return html`<div>Settings</div>`;
        }

        const activePage = signal(Dashboard);

        function App() {
            return html`
                <Keep>
                    <Load component=${activePage} />
                </Keep>
            `;
        }

        mount(App, container);
        assert.equal(container.querySelector("#val").textContent, "10");

        // Switch to Settings (Dashboard is KEPT in cache)
        activePage.value = Settings;

        // Mutate signal while Dashboard is in background cache!
        counter.value = 99;

        // Restore Dashboard
        activePage.value = Dashboard;

        assert.equal(container.querySelector("#val").textContent, "99", "Restored DOM must reflect signal updates that occurred while cached");
    });

    it("18. Multiple identities cached independently", () => {
        function PageA() { return html`<div id="page-a">Page A</div>`; }
        function PageB() { return html`<div id="page-b">Page B</div>`; }
        function PageC() { return html`<div id="page-c">Page C</div>`; }

        const activePage = signal(PageA);

        function App() {
            return html`
                <Keep>
                    <Load component=${activePage} />
                </Keep>
            `;
        }

        mount(App, container);
        const nodeA = container.querySelector("#page-a");

        activePage.value = PageB;
        const nodeB = container.querySelector("#page-b");

        activePage.value = PageC;
        const nodeC = container.querySelector("#page-c");

        // Restore PageA, then PageB
        activePage.value = PageA;
        assert.strictEqual(container.querySelector("#page-a"), nodeA);

        activePage.value = PageB;
        assert.strictEqual(container.querySelector("#page-b"), nodeB);
    });

    it("19. Keyed instances (key=${id}) remain distinct & 20. Same component function with different key is not confused", () => {
        let userDetailExecutions = 0;

        function UserDetail(props) {
            userDetailExecutions++;
            return html`<div id="user-card">User ID: ${props.id}</div>`;
        }

        const userId = signal(1);

        function App() {
            return html`
                <Keep>
                    <Load component=${UserDetail} key=${userId} id=${userId} />
                </Keep>
            `;
        }

        mount(App, container);
        assert.equal(container.querySelector("#user-card").textContent, "User ID: 1");
        assert.equal(userDetailExecutions, 1);

        // Switch to userId 2
        userId.value = 2;
        assert.equal(container.querySelector("#user-card").textContent, "User ID: 2");
        assert.equal(userDetailExecutions, 2);

        // Switch back to userId 1
        userId.value = 1;
        assert.equal(container.querySelector("#user-card").textContent, "User ID: 1");
        assert.equal(userDetailExecutions, 2, "UserDetail for key 1 must be restored from cache without re-executing");
    });

    it("21. Nested <Keep> works recursively & 22. Destroying parent <Keep> destroys all cached subtrees", () => {
        let innerDestroyCount = 0;

        function InnerPanel() {
            onDestroy(() => { innerDestroyCount++; });
            return html`<div id="inner">Inner Panel</div>`;
        }
        function OuterPage() {
            const panelSignal = signal(InnerPanel);
            return html`
                <div id="outer">
                    <Keep>
                        <Load component=${panelSignal} />
                    </Keep>
                </div>
            `;
        }
        function OtherPage() {
            return html`<div id="other">Other</div>`;
        }

        const outerPageSignal = signal(OuterPage);

        function App() {
            return html`
                <Keep>
                    <Load component=${outerPageSignal} />
                </Keep>
            `;
        }

        const app = mount(App, container);
        assert.ok(container.querySelector("#inner"));
        assert.equal(innerDestroyCount, 0);

        // Switch outer page -> OuterPage is kept by outer Keep
        outerPageSignal.value = OtherPage;
        assert.equal(innerDestroyCount, 0);

        // Destroy application -> all nested Keep caches and onDestroy hooks MUST run!
        app.dispose();
        assert.equal(innerDestroyCount, 1, "Destroying parent Keep must destroy all nested cached contexts");
    });

    it("26. Ordinary <Load> without <Keep> destroys as before", () => {
        let destroyCount = 0;

        function Dashboard() {
            onDestroy(() => { destroyCount++; });
            return html`<div id="dashboard">Dashboard</div>`;
        }
        function Settings() {
            return html`<div id="settings">Settings</div>`;
        }

        const activePage = signal(Dashboard);

        function App() {
            return html`
                <Load component=${activePage} />
            `;
        }

        mount(App, container);
        assert.equal(destroyCount, 0);

        activePage.value = Settings;
        assert.equal(destroyCount, 1, "<Load> without <Keep> MUST destroy context on switch");
    });

    it("27. <Keep> + <Place> portal nodes hide while kept and restore on activation", () => {
        const modalTarget = document.createElement("div");
        modalTarget.id = "modal-root";
        document.body.appendChild(modalTarget);

        function PortalPage() {
            return html`
                <div id="page">
                    Page Content
                    <Place to="#modal-root">
                        <div id="portal-dialog">Modal Content</div>
                    </Place>
                </div>
            `;
        }
        function OtherPage() {
            return html`<div id="other">Other Page</div>`;
        }

        const activePage = signal(PortalPage);

        function App() {
            return html`
                <Keep>
                    <Load component=${activePage} />
                </Keep>
            `;
        }

        mount(App, container);
        assert.ok(modalTarget.querySelector("#portal-dialog"), "Portal node must be in modal-root when active");

        // Switch away -> page is KEPT, portal node MUST NOT remain visible in modal-root!
        activePage.value = OtherPage;
        assert.equal(modalTarget.querySelector("#portal-dialog"), null, "Portal node MUST be detached while kept");

        // Switch back -> portal node MUST re-attach!
        activePage.value = PortalPage;
        assert.ok(modalTarget.querySelector("#portal-dialog"), "Portal node MUST re-attach on restore");

        modalTarget.remove();
    });

    it("30. LRU eviction with max prop (<Keep max=${1}>)", () => {
        let pageADestroyed = 0;
        let pageBDestroyed = 0;

        function PageA() {
            onDestroy(() => { pageADestroyed++; });
            return html`<div id="page-a">A</div>`;
        }
        function PageB() {
            onDestroy(() => { pageBDestroyed++; });
            return html`<div id="page-b">B</div>`;
        }
        function PageC() { return html`<div id="page-c">C</div>`; }

        const activePage = signal(PageA);

        function App() {
            return html`
                <Keep max=${1}>
                    <Load component=${activePage} />
                </Keep>
            `;
        }

        mount(App, container);
        assert.equal(pageADestroyed, 0);

        // Visit B (cache contains A [size 1], active is B)
        activePage.value = PageB;
        assert.equal(pageADestroyed, 0);

        // Visit C (B is moved to cache, cache size becomes 2 > 1. PageA MUST BE EVICTED AND DESTROYED!)
        activePage.value = PageC;
        assert.equal(pageADestroyed, 1, "PageA (least recently used) must be evicted and destroyed when max capacity is reached");
        assert.equal(pageBDestroyed, 0);
    });
});
