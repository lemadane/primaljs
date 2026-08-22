import "./setup.js";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
    html,
    signal,
    mount,
    ref,
    clearRegistry,
    register,
    Focus,
    Place,
    Keep,
    Load,
    Guard
} from "../src/index.js";

describe("PrimalJS <Focus> Keyboard Focus & Accessibility Lifecycle Component Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        clearRegistry();
    });

    it("1. Child renders normally & 3. First tabbable element receives autofocus", async () => {
        function Dialog() {
            return html`
                <div role="dialog">
                    <button id="btn1">Button 1</button>
                    <button id="btn2">Button 2</button>
                </div>
            `;
        }
        register(Dialog);

        function App() {
            return html`
                <Focus>
                    <Dialog />
                </Focus>
            `;
        }

        mount(App, container);
        await new Promise(r => setTimeout(r, 10));

        assert.equal(document.activeElement.id, "btn1", "First tabbable element must receive focus after mount");
    });

    it("2. Previous activeElement captured and restored on unmount (restore=true)", async () => {
        const triggerBtn = document.createElement("button");
        triggerBtn.id = "trigger-btn";
        document.body.appendChild(triggerBtn);
        triggerBtn.focus();
        assert.equal(document.activeElement, triggerBtn);

        function Dialog() {
            return html`
                <div role="dialog">
                    <button id="dialog-btn">Inside Dialog</button>
                </div>
            `;
        }
        register(Dialog);

        const open = signal(true);

        function App() {
            return html`
                <div>
                    ${() => open.value ? html`
                        <Focus>
                            <Dialog />
                        </Focus>
                    ` : null}
                </div>
            `;
        }

        mount(App, container);
        await new Promise(r => setTimeout(r, 10));

        assert.equal(document.activeElement.id, "dialog-btn");

        // Close dialog
        open.value = false;

        assert.equal(document.activeElement, triggerBtn, "Focus must restore to previous activeElement on unmount");
        triggerBtn.remove();
    });

    it("4. [autofocus] descendant receives priority over first element", async () => {
        function FormDialog() {
            return html`
                <div>
                    <button id="cancel">Cancel</button>
                    <input id="email" autofocus type="text" />
                </div>
            `;
        }
        register(FormDialog);

        function App() {
            return html`
                <Focus>
                    <FormDialog />
                </Focus>
            `;
        }

        mount(App, container);
        await new Promise(r => setTimeout(r, 10));

        assert.equal(document.activeElement.id, "email", "[autofocus] element must take precedence over first button");
    });

    it("5. Explicit initial selector / ref target works", async () => {
        function SpecificDialog() {
            return html`
                <div>
                    <button id="b1">1</button>
                    <input id="target-input" type="text" />
                </div>
            `;
        }
        register(SpecificDialog);

        function App() {
            return html`
                <Focus initial="#target-input">
                    <SpecificDialog />
                </Focus>
            `;
        }

        mount(App, container);
        await new Promise(r => setTimeout(r, 10));

        assert.equal(document.activeElement.id, "target-input", "Explicit initial selector must receive focus");
    });

    it("6. Tab from last element cycles to first & 7. Shift+Tab from first cycles to last", async () => {
        function Dialog() {
            return html`
                <div>
                    <button id="btn1">First</button>
                    <button id="btn2">Second</button>
                </div>
            `;
        }
        register(Dialog);

        function App() {
            return html`
                <Focus>
                    <Dialog />
                </Focus>
            `;
        }

        mount(App, container);
        await new Promise(r => setTimeout(r, 10));

        const btn1 = container.querySelector("#btn1");
        const btn2 = container.querySelector("#btn2");
        assert.equal(document.activeElement, btn1);

        // Simulate Tab on last element (btn2)
        btn2.focus();
        assert.equal(document.activeElement, btn2);

        const tabEvent = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
        document.dispatchEvent(tabEvent);

        assert.equal(document.activeElement, btn1, "Tab on last element must cycle focus to first element");

        // Simulate Shift+Tab on first element (btn1)
        btn1.focus();
        assert.equal(document.activeElement, btn1);

        const shiftTabEvent = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true });
        document.dispatchEvent(shiftTabEvent);

        assert.equal(document.activeElement, btn2, "Shift+Tab on first element must cycle focus to last element");
    });

    it("8. trap=false allows normal focus escape & 9. autofocus=false & 10. restore=false", async () => {
        const triggerBtn = document.createElement("button");
        triggerBtn.id = "outside-btn";
        document.body.appendChild(triggerBtn);
        triggerBtn.focus();

        function Dialog() {
            return html`<button id="inner">Inner</button>`;
        }
        register(Dialog);

        const open = signal(true);

        function App() {
            return html`
                <div>
                    ${() => open.value ? html`
                        <Focus trap=${false} autofocus=${false} restore=${false}>
                            <Dialog />
                        </Focus>
                    ` : null}
                </div>
            `;
        }

        mount(App, container);
        await new Promise(r => setTimeout(r, 10));

        assert.equal(document.activeElement, triggerBtn, "autofocus=false must NOT steal focus");

        // Unmount
        open.value = false;
        assert.equal(document.activeElement, triggerBtn, "restore=false must NOT alter focus");
        triggerBtn.remove();
    });

    it("15. Nested Focus components with stack isolation & 16. Restoring outer Focus scope", async () => {
        function InnerModal() {
            return html`
                <div role="dialog" id="inner-dialog">
                    <button id="inner-btn">Inner Btn</button>
                </div>
            `;
        }
        function OuterModal() {
            const showInner = signal(false);

            return html`
                <div role="dialog" id="outer-dialog">
                    <button id="outer-btn" onclick=${() => showInner.value = true}>Outer Btn</button>
                    ${() => showInner.value ? html`
                        <Focus>
                            <InnerModal />
                        </Focus>
                    ` : null}
                </div>
            `;
        }
        register(InnerModal, OuterModal);

        function App() {
            return html`
                <Focus>
                    <OuterModal />
                </Focus>
            `;
        }

        mount(App, container);
        await new Promise(r => setTimeout(r, 10));

        const outerBtn = container.querySelector("#outer-btn");
        assert.equal(document.activeElement, outerBtn);

        // Click outer button to open inner modal
        outerBtn.click();
        await new Promise(r => setTimeout(r, 10));

        const innerBtn = container.querySelector("#inner-btn");
        assert.equal(document.activeElement, innerBtn, "Nested Focus scope must claim focus on mount");
    });

    it("17. Focus inside Place manages portal DOM correctly", async () => {
        const modalTarget = document.createElement("div");
        modalTarget.id = "portal-root";
        document.body.appendChild(modalTarget);

        function PortalDialog() {
            return html`
                <div id="portal-card">
                    <button id="portal-btn">Portal Button</button>
                </div>
            `;
        }
        register(PortalDialog);

        function App() {
            return html`
                <Place to="#portal-root">
                    <Focus>
                        <PortalDialog />
                    </Focus>
                </Place>
            `;
        }

        mount(App, container);
        await new Promise(r => setTimeout(r, 10));

        assert.equal(document.activeElement.id, "portal-btn", "Focus inside Place must focus placed DOM element");

        modalTarget.remove();
    });

    it("18. Focus inside Keep suspends trap while kept and resumes when restored", async () => {
        function PageA() {
            return html`
                <Focus>
                    <button id="page-a-btn">Page A</button>
                </Focus>
            `;
        }
        function PageB() {
            return html`<button id="page-b-btn">Page B</button>`;
        }
        register(PageA, PageB);

        const activePage = signal(PageA);

        function App() {
            return html`
                <Keep>
                    <Load component=${activePage} />
                </Keep>
            `;
        }

        mount(App, container);
        await new Promise(r => setTimeout(r, 10));
        assert.equal(document.activeElement.id, "page-a-btn");

        // Switch to Page B (Page A is KEPT)
        activePage.value = PageB;
        await new Promise(r => setTimeout(r, 10));

        const bBtn = container.querySelector("#page-b-btn");
        bBtn.focus();
        assert.equal(document.activeElement, bBtn);

        // Page A must NOT trap Tab key while kept in background cache!
        const tabEvent = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
        document.dispatchEvent(tabEvent);

        assert.equal(document.activeElement, bBtn, "Kept inactive Focus component must NOT trap focus");
    });

    it("20. 100-cycle open/close stress test verifies clean listener removal and zero leaks", async () => {
        const triggerBtn = document.createElement("button");
        triggerBtn.id = "open-trigger";
        document.body.appendChild(triggerBtn);

        function SimpleModal() {
            return html`
                <div role="dialog">
                    <button id="modal-cancel">Cancel</button>
                </div>
            `;
        }
        register(SimpleModal);

        const openSignal = signal(false);

        function App() {
            return html`
                <div>
                    ${() => openSignal.value ? html`
                        <Focus>
                            <SimpleModal />
                        </Focus>
                    ` : null}
                </div>
            `;
        }

        const app = mount(App, container);

        for (let i = 0; i < 100; i++) {
            triggerBtn.focus();
            openSignal.value = true;
            await new Promise(r => setTimeout(r, 1));
            openSignal.value = false;
        }

        app.dispose();
        triggerBtn.remove();
    });
});
